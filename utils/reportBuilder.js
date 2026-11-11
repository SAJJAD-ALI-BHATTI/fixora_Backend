const User = require("../models/User");
const Booking = require("../models/Booking");
const Task = require("../models/Task");
const Transaction = require("../models/Transaction");
const { buildAnalytics, parseRange, inRange } = require("./analytics");

const MAX_ROWS = 5000;

const CATEGORIES = {
    overview: { title: "Platform Performance Summary", description: "Headline KPIs and a day-by-day activity table", filters: [] },
    users: { title: "User Registry Report", description: "All members who joined in the period", filters: ["role", "status"] },
    vendors: { title: "Vendor Performance Report", description: "Orders received, completed and earnings per vendor", filters: ["party"] },
    taskRunners: { title: "Task Runner Performance Report", description: "Tasks assigned, completed and earnings per runner", filters: ["party"] },
    bookings: { title: "Service Bookings Report", description: "Every booking created in the period", filters: ["status", "party"] },
    tasks: { title: "Custom Tasks Report", description: "Every task posted in the period", filters: ["status", "party"] },
    transactions: { title: "Transactions & Revenue Report", description: "Payments, commission and settlements", filters: ["status", "type", "party"] }
};

const label = (s) => String(s || "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

async function partyIds(party) {
    if (!party || !String(party).trim()) return null;
    const r = rx(String(party).trim());
    const users = await User.find({ $or: [{ name: r }, { email: r }] }).select("_id").limit(50).lean();
    return users.map((u) => u._id);
}

const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);
const countBy = (rows, key) => {
    const m = new Map();
    rows.forEach((r) => m.set(r[key], (m.get(r[key]) || 0) + 1));
    return [...m.entries()].map(([k, v]) => ({ label: label(k), value: v })).sort((a, b) => b.value - a.value);
};
const money = (n) => `PKR ${Math.round(Number(n || 0)).toLocaleString("en-US")}`;

async function buildReport(input = {}) {
    const category = CATEGORIES[input.category] ? input.category : "overview";
    const meta = CATEGORIES[category];
    const range = parseRange(input);
    const filters = {};
    ["role", "status", "type", "party"].forEach((k) => { if (input[k] && String(input[k]).trim() && input[k] !== "all") filters[k] = String(input[k]).trim(); });

    const base = {
        category, title: meta.title,
        period: { from: range.from, to: range.to, days: range.days },
        filters
    };
    let columns = [], rows = [], summary = [], chart = null, totalRows = 0;

    if (category === "overview") {
        const a = await buildAnalytics(input);
        columns = [
            { key: "date", label: "Date", type: "text", w: 2 }, { key: "bookings", label: "Bookings", type: "number", w: 1.4 },
            { key: "tasks", label: "Tasks", type: "number", w: 1.2 }, { key: "newUsers", label: "New users", type: "number", w: 1.4 },
            { key: "revenue", label: "Revenue (PKR)", type: "money", w: 2 }, { key: "commission", label: "Commission (PKR)", type: "money", w: 2 }
        ];
        rows = a.timeline; totalRows = rows.length;
        summary = [
            { label: "Paid volume", value: money(a.totals.revenue) }, { label: "Platform commission", value: money(a.totals.commission) },
            { label: "Bookings", value: String(a.totals.bookings) }, { label: "Tasks", value: String(a.totals.tasks) },
            { label: "Completed orders", value: String(a.totals.completedOrders) }, { label: "New members", value: String(a.totals.newUsers) },
            { label: "Customers (total)", value: String(a.totals.customers) }, { label: "Vendors / Runners", value: `${a.totals.vendors} / ${a.totals.taskRunners}` },
            { label: "Pending approvals", value: String(a.totals.pendingApprovals) }, { label: "Services", value: String(a.totals.services) }
        ];
        const pts = rows.slice(-14);
        chart = { title: "Paid volume (PKR) — most recent periods", items: pts.map((p) => ({ label: p.date.slice(5) || p.date, value: p.revenue })) };
        if (rows.length > MAX_ROWS) rows = rows.slice(-MAX_ROWS);
    }

    if (category === "users") {
        const q = { ...inRange("createdAt", range.from, range.to), role: filters.role ? filters.role : { $in: ["customer", "vendor", "taskRunner"] } };
        if (filters.status) q.status = filters.status;
        totalRows = await User.countDocuments(q);
        const users = await User.find(q).select("name email phone role status createdAt").sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        columns = [
            { key: "name", label: "Name", w: 2.4 }, { key: "email", label: "Email", w: 3 }, { key: "phone", label: "Phone", w: 1.8 },
            { key: "role", label: "Role", w: 1.3 }, { key: "status", label: "Status", w: 1.2 }, { key: "joined", label: "Joined", type: "date", w: 1.6 }
        ];
        rows = users.map((u) => ({ name: u.name, email: u.email, phone: u.phone || "—", role: label(u.role), status: label(u.status), joined: u.createdAt }));
        summary = [{ label: "Members listed", value: String(totalRows) }, ...countBy(rows, "role").map((r) => ({ label: r.label, value: String(r.value) })), { label: "Pending approval", value: String(rows.filter((r) => r.status === "Pending").length) }];
        chart = { title: "Members by role", items: countBy(rows, "role") };
    }

    if (category === "vendors" || category === "taskRunners") {
        const isVendor = category === "vendors";
        const ids = await partyIds(filters.party);
        const match = { ...inRange("createdAt", range.from, range.to) };
        const field = isVendor ? "vendor" : "assignedRunner";
        if (!isVendor) match.assignedRunner = { $ne: null };
        if (ids) match[field] = { $in: ids };
        const Model = isVendor ? Booking : Task;
        const amount = isVendor ? "$amount" : { $ifNull: ["$agreedAmount", "$budget"] };
        const agg = await Model.aggregate([
            { $match: match },
            { $group: { _id: `$${field}`, received: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $in: ["$status", ["cancelled", "rejected", "missed"]] }, 1, 0] } }, earnings: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, amount, 0] } } } },
            { $sort: { completed: -1, received: -1 } }, { $limit: MAX_ROWS },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
            { $project: { received: 1, completed: 1, cancelled: 1, earnings: 1, name: { $arrayElemAt: ["$u.name", 0] }, email: { $arrayElemAt: ["$u.email", 0] }, status: { $arrayElemAt: ["$u.status", 0] } } }
        ]);
        totalRows = agg.length;
        columns = [
            { key: "name", label: isVendor ? "Vendor" : "Task runner", w: 2.4 }, { key: "email", label: "Email", w: 3 }, { key: "status", label: "Status", w: 1.2 },
            { key: "received", label: isVendor ? "Received" : "Assigned", type: "number", w: 1.3 }, { key: "completed", label: "Completed", type: "number", w: 1.4 },
            { key: "cancelled", label: "Lost", type: "number", w: 1 }, { key: "earnings", label: "Earnings (PKR)", type: "money", w: 2 }
        ];
        rows = agg.map((r) => ({ name: r.name || "Deleted user", email: r.email || "—", status: label(r.status || ""), received: r.received, completed: r.completed, cancelled: r.cancelled, earnings: r.earnings }));
        summary = [
            { label: isVendor ? "Active vendors" : "Active runners", value: String(rows.length) }, { label: isVendor ? "Orders received" : "Tasks assigned", value: String(sum(rows, "received")) },
            { label: "Completed", value: String(sum(rows, "completed")) }, { label: "Total earnings", value: money(sum(rows, "earnings")) }
        ];
        chart = { title: "Earnings by top performers (PKR)", items: rows.slice(0, 8).map((r) => ({ label: r.name, value: r.earnings })) };
    }

    if (category === "bookings" || category === "tasks") {
        const isB = category === "bookings";
        const q = { ...inRange("createdAt", range.from, range.to) };
        if (filters.status) q.status = filters.status;
        const ids = await partyIds(filters.party);
        if (ids) q.$or = isB ? [{ customer: { $in: ids } }, { vendor: { $in: ids } }] : [{ customer: { $in: ids } }, { assignedRunner: { $in: ids } }];
        const Model = isB ? Booking : Task;
        totalRows = await Model.countDocuments(q);
        let find = Model.find(q).sort({ createdAt: -1 }).limit(MAX_ROWS).populate("customer", "name");
        find = isB ? find.populate("vendor", "name").populate("service", "title") : find.populate("assignedRunner", "name");
        const docs = await find.lean();
        if (isB) {
            columns = [
                { key: "ref", label: "Ref", w: 1.3 }, { key: "created", label: "Created", type: "date", w: 1.5 }, { key: "customer", label: "Customer", w: 2 }, { key: "vendor", label: "Vendor", w: 2 },
                { key: "service", label: "Service", w: 2.3 }, { key: "when", label: "Scheduled", w: 2.1 }, { key: "amount", label: "Amount (PKR)", type: "money", w: 1.7 }, { key: "status", label: "Status", w: 1.5 }
            ];
            rows = docs.map((b) => ({ ref: String(b._id).slice(-8).toUpperCase(), created: b.createdAt, customer: b.customer?.name || "—", vendor: b.vendor?.name || "—", service: b.service?.title || "—", when: `${b.date || ""} ${b.time || ""}`.trim(), amount: b.amount, status: label(b.status) }));
            summary = [{ label: "Bookings", value: String(totalRows) }, { label: "Total value", value: money(sum(rows, "amount")) }, { label: "Completed", value: String(rows.filter((r) => r.status === "Completed").length) }, { label: "Cancelled / rejected", value: String(rows.filter((r) => ["Cancelled", "Rejected", "Missed"].includes(r.status)).length) }];
        } else {
            columns = [
                { key: "ref", label: "Ref", w: 1.3 }, { key: "created", label: "Created", type: "date", w: 1.5 }, { key: "title", label: "Task", w: 2.8 }, { key: "category", label: "Category", w: 1.6 },
                { key: "customer", label: "Customer", w: 2 }, { key: "runner", label: "Runner", w: 2 }, { key: "budget", label: "Budget (PKR)", type: "money", w: 1.7 }, { key: "status", label: "Status", w: 1.5 }
            ];
            rows = docs.map((t) => ({ ref: String(t._id).slice(-8).toUpperCase(), created: t.createdAt, title: t.title, category: t.category, customer: t.customer?.name || "—", runner: t.assignedRunner?.name || "Unassigned", budget: t.agreedAmount || t.budget, status: label(t.status) }));
            summary = [{ label: "Tasks", value: String(totalRows) }, { label: "Total budget", value: money(sum(rows, "budget")) }, { label: "Completed", value: String(rows.filter((r) => r.status === "Completed").length) }, { label: "Still open", value: String(rows.filter((r) => r.status === "Open").length) }];
        }
        chart = { title: `${isB ? "Bookings" : "Tasks"} by status`, items: countBy(rows, "status") };
    }

    if (category === "transactions") {
        const q = { ...inRange("createdAt", range.from, range.to) };
        if (filters.status) q.status = filters.status;
        if (filters.type) q.type = filters.type;
        const ids = await partyIds(filters.party);
        if (ids) q.$or = [{ customer: { $in: ids } }, { vendor: { $in: ids } }, { taskRunner: { $in: ids } }];
        totalRows = await Transaction.countDocuments(q);
        const docs = await Transaction.find(q).sort({ createdAt: -1 }).limit(MAX_ROWS).populate("customer", "name").populate("vendor", "name").populate("taskRunner", "name").lean();
        columns = [
            { key: "ref", label: "Reference", w: 2.2 }, { key: "date", label: "Date", type: "date", w: 1.6 }, { key: "type", label: "Type", w: 1.8 }, { key: "customer", label: "Customer", w: 2 },
            { key: "provider", label: "Provider", w: 2 }, { key: "amount", label: "Amount (PKR)", type: "money", w: 1.8 }, { key: "commission", label: "Commission", type: "money", w: 1.6 }, { key: "status", label: "Status", w: 1.2 }
        ];
        rows = docs.map((t) => ({ ref: t.reference || String(t._id).slice(-8).toUpperCase(), date: t.paidAt || t.createdAt, type: label(t.type), customer: t.customer?.name || "—", provider: t.vendor?.name || t.taskRunner?.name || "—", amount: t.amount, commission: t.platformCommission || 0, status: label(t.status) }));
        const paid = rows.filter((r) => r.status === "Paid");
        summary = [{ label: "Transactions", value: String(totalRows) }, { label: "Paid volume", value: money(sum(paid, "amount")) }, { label: "Commission earned", value: money(sum(paid, "commission")) }, { label: "Failed / refunded", value: String(rows.filter((r) => ["Failed", "Refunded"].includes(r.status)).length) }];
        const byType = new Map();
        paid.forEach((r) => byType.set(r.type, (byType.get(r.type) || 0) + r.amount));
        chart = { title: "Paid volume by type (PKR)", items: [...byType.entries()].map(([k, v]) => ({ label: k, value: v })) };
    }

    const truncated = totalRows > rows.length;
    return { ...base, columns: columns.map((c) => ({ type: "text", ...c })), rows, summary, chart, totalRows: totalRows || rows.length, truncated };
}

module.exports = { CATEGORIES, buildReport, MAX_ROWS, money };
