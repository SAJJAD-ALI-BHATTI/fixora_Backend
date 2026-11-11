const User = require("../models/User");
const { createNotification } = require("../utils/notification");
const { signedUrl } = require("../utils/kyc");

const KYC_ROLES = ["vendor", "taskRunner"];
const SELECT = "-password";

const summary = (u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    phone: u.phone || "",
    role: u.role,
    status: u.status,
    profileImage: u.profileImage || "",
    createdAt: u.createdAt,
    verification: {
        state: u.verification?.state || "not_required",
        submittedAt: u.verification?.submittedAt || null,
        resubmittedAt: u.verification?.resubmittedAt || null,
        reviewedAt: u.verification?.reviewedAt || null,
        reviewNote: u.verification?.reviewNote || ""
    }
});

// GET /admin/verifications?state=pending|info_requested|approved|rejected|all&role=&q=
const listVerifications = async (req, res, next) => {
    try {
        const { state = "all", role, q } = req.query;
        const filter = { role: { $in: KYC_ROLES } };
        if (role && KYC_ROLES.includes(role)) filter.role = role;
        if (state !== "all") {
            // accounts registered before KYC existed have no state: infer from status
            if (state === "approved") filter.$or = [{ "verification.state": "approved" }, { "verification.state": "not_required", status: "approved" }];
            else if (state === "rejected") filter.$or = [{ "verification.state": "rejected" }, { "verification.state": "not_required", status: "rejected" }];
            else if (state === "pending") filter.$or = [{ "verification.state": "pending" }, { "verification.state": "not_required", status: "pending" }];
            else filter["verification.state"] = state;
        }
        if (q) {
            const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$and = [{ $or: [{ name: rx }, { email: rx }, { phone: rx }] }];
        }

        const [users, counts] = await Promise.all([
            User.find(filter).select(SELECT).sort({ "verification.submittedAt": -1, createdAt: -1 }).limit(300),
            User.aggregate([
                { $match: { role: { $in: KYC_ROLES } } },
                { $group: { _id: { $cond: [{ $eq: ["$verification.state", "not_required"] }, { $switch: { branches: [{ case: { $eq: ["$status", "pending"] }, then: "pending" }, { case: { $eq: ["$status", "approved"] }, then: "approved" }, { case: { $eq: ["$status", "rejected"] }, then: "rejected" }], default: "other" } }, "$verification.state"] }, n: { $sum: 1 } } }
            ])
        ]);

        const tally = { pending: 0, info_requested: 0, approved: 0, rejected: 0 };
        counts.forEach((c) => { if (c._id in tally) tally[c._id] = c.n; });

        res.json({ success: true, data: { verifications: users.map(summary), counts: tally } });
    } catch (e) { next(e); }
};

// GET /admin/verifications/:id  (includes short-lived signed document URLs)
const getVerification = async (req, res, next) => {
    try {
        const user = await User.findOne({ _id: req.params.id, role: { $in: KYC_ROLES } })
            .select(`${SELECT} +verification.documents +verification.history`)
            .populate("verification.reviewedBy", "name email");
        if (!user) return res.status(404).json({ success: false, message: "Registration not found" });

        const d = user.verification?.documents || {};
        const documents = {
            profileImage: { url: d.profileImage?.url || user.profileImage || "" },
            cnicFront: { url: signedUrl(d.cnicFront?.url) },
            cnicBack: { url: signedUrl(d.cnicBack?.url) }
        };
        const history = (user.verification?.history || []).map((h) => ({ action: h.action, note: h.note, at: h.at }));

        res.json({
            success: true,
            data: {
                verification: {
                    ...summary(user),
                    location: user.location || null,
                    infoRequest: user.verification?.infoRequest || null,
                    reviewedBy: user.verification?.reviewedBy ? { name: user.verification.reviewedBy.name, email: user.verification.reviewedBy.email } : null,
                    documents,
                    documentsExpireIn: 600,
                    history
                }
            }
        });
    } catch (e) { next(e); }
};

const review = (action) => async (req, res, next) => {
    try {
        const note = String(req.body?.note || req.body?.message || "").trim().slice(0, 1000);
        if (action !== "approve" && note.length < 5) {
            return res.status(400).json({
                success: false,
                message: action === "reject" ? "Please give a reason for rejecting this registration" : "Please describe the additional information required"
            });
        }

        const user = await User.findOne({ _id: req.params.id, role: { $in: KYC_ROLES } }).select("-password +verification.history");
        if (!user) return res.status(404).json({ success: false, message: "Registration not found" });

        const now = new Date();
        const label = user.role === "vendor" ? "vendor" : "task runner";
        const v = user.verification;

        if (action === "approve") {
            user.status = "approved";
            v.state = "approved";
            v.infoRequest = { message: "", requestedAt: null };
        } else if (action === "reject") {
            user.status = "rejected";
            v.state = "rejected";
        } else {
            user.status = "pending";
            v.state = "info_requested";
            v.infoRequest = { message: note, requestedAt: now };
        }
        v.reviewedAt = now;
        v.reviewedBy = req.user._id;
        v.reviewNote = note;
        v.history.push({ action: action === "request" ? "info_requested" : action === "approve" ? "approved" : "rejected", note, by: req.user._id, at: now });
        await user.save();

        const copy = {
            approve: { type: "accountApproved", title: "Your account is approved 🎉", message: `Welcome aboard! Your ${label} account has been verified. You can now start receiving ${user.role === "vendor" ? "bookings" : "task offers"}.` },
            reject: { type: "accountRejected", title: "Registration not approved", message: `Your ${label} registration was not approved. Reason: ${note}` },
            request: { type: "accountInfoRequested", title: "More information needed", message: `Our team needs more information to verify your account: ${note}` }
        }[action];
        try {
            await createNotification({ recipient: user._id, sender: req.user._id, ...copy, data: { link: "/dashboard", state: v.state } });
        } catch (n) { console.warn("verification notification failed:", n.message); }

        res.json({ success: true, message: { approve: "Registration approved", reject: "Registration rejected", request: "Additional information requested" }[action], data: { verification: summary(user) } });
    } catch (e) { next(e); }
};

module.exports = { listVerifications, getVerification, approve: review("approve"), reject: review("reject"), requestInfo: review("request"), review };
