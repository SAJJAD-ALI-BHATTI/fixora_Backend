const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { sendSmtpEmail } = require("../utils/smtp");

const User = require("../models/User");
const PasswordOtp = require("../models/PasswordOtp");
const EmailVerification = require("../models/EmailVerification");
const { checkEmailDeliverable } = require("../utils/emailCheck");
const imagekit = require("../config/imagekit");
const generateToken = require("../utils/generateToken");
const { KYC_FOLDER, AVATAR_FOLDER, sniffImage, publicVerification, validateDocuments, cleanDocuments } = require("../utils/kyc");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_SENDS = 5;
const OTP_WINDOW_MS = 60 * 60 * 1000;

const sessionUser = (user) => ({
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    profileImage: user.profileImage || "",
    location: user.location || null,
    role: user.role,
    status: user.status,
    verification: publicVerification(user)
});

const hashOtp = (email, otp) =>
    crypto.createHmac("sha256", process.env.JWT_SECRET || "fixora-otp").update(`${email}:${otp}`).digest("hex");

const maskEmail = (email) => {
    const [name, domain] = email.split("@");
    return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 2))}@${domain}`;
};

const register = async (req, res, next) => {
    try {
        const {
            name,
            email,
            phone,
            password,
            role,
            location
        } = req.body;

        const normalizedEmail = String(email || "").trim().toLowerCase();
        const passwordValue = String(password || "");
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
        const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

        if (!String(name || "").trim() || !normalizedEmail || !passwordValue) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (!emailPattern.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        if (!strongPassword.test(passwordValue)) {
            return res.status(400).json({
                success: false,
                message: "Password must be 8–72 characters and include uppercase, lowercase, number and special character"
            });
        }

        const deliverable = await checkEmailDeliverable(normalizedEmail);
        if (!deliverable.ok) {
            return res.status(400).json({ success: false, code: "EMAIL_UNDELIVERABLE", message: deliverable.message });
        }

        // The address must have been proven with a one-time code (see /auth/email/send-code)
        try {
            const proof = jwt.verify(String(req.body.emailToken || ""), process.env.JWT_SECRET);
            if (proof.purpose !== "email-verified" || proof.email !== normalizedEmail) throw new Error("mismatch");
        } catch {
            return res.status(400).json({
                success: false,
                code: "EMAIL_NOT_VERIFIED",
                message: "Please verify your email address with the code we send you before creating your account."
            });
        }

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        const allowedRoles = ["customer", "vendor", "taskRunner"];

        const selectedRole = role || "customer";

        if (!allowedRoles.includes(selectedRole)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role"
            });
        }

        const needsKyc = selectedRole !== "customer";
        const phoneDigits = String(phone || "").replace(/\D/g, "");

        if (needsKyc) {
            if (phoneDigits.length < 10 || phoneDigits.length > 15) {
                return res.status(400).json({
                    success: false,
                    message: "A valid phone number is required for vendors and task runners"
                });
            }
            const docErrors = validateDocuments(req.body.documents);
            if (docErrors.length) {
                return res.status(400).json({
                    success: false,
                    message: docErrors[0],
                    data: { errors: docErrors }
                });
            }
        }

        const hashedPassword = await bcrypt.hash(passwordValue, 10);

        const userStatus =
            selectedRole === "customer" ? "active" : "pending";

        const documents = needsKyc ? cleanDocuments(req.body.documents) : null;
        const now = new Date();

        const user = await User.create({
            name: String(name).trim(),
            email: normalizedEmail,
            phone: String(phone || "").trim(),
            password: hashedPassword,
            role: selectedRole,
            location,
            status: userStatus,
            ...(needsKyc ? {
                profileImage: documents.profileImage.url,
                verification: {
                    state: "pending",
                    submittedAt: now,
                    documents,
                    history: [{ action: "submitted", note: "Registration submitted for review", at: now }]
                }
            } : {})
        });

        if (needsKyc) {
            try {
                const { createNotification } = require("../utils/notification");
                const admins = await User.find({ role: "admin" }).select("_id");
                await Promise.all(admins.map((a) => createNotification({
                    recipient: a._id,
                    sender: user._id,
                    type: "approvalPending",
                    title: "New registration awaiting approval",
                    message: `${user.name} registered as a ${selectedRole === "vendor" ? "vendor" : "task runner"} and is waiting for verification.`,
                    data: { userId: user._id, role: selectedRole, link: `/admin/verifications/${user._id}` }
                })));
            } catch (notifyError) {
                console.warn("Admin notification failed:", notifyError.message);
            }
        }

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: "Registration successful",
            data: {
                user: sessionUser(user),
                token
            }
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (user.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended"
            });
        }

        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: sessionUser(user),
                token
            }
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// UPDATE CURRENT USER PROFILE
// ==========================================

const updateProfile = async (req, res, next) => {
    try {
        const { name, phone, location, profileImage } = req.body;

        const updates = {};

        if (name !== undefined) {
            if (!String(name).trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Name cannot be empty"
                });
            }
            updates.name = String(name).trim();
        }

        if (phone !== undefined) {
            updates.phone = String(phone).trim();
        }

        if (profileImage !== undefined) {
            updates.profileImage = String(profileImage).trim();
        }

        if (location !== undefined) {
            if (!location || typeof location !== "object") {
                return res.status(400).json({
                    success: false,
                    message: "Location must be an object"
                });
            }

            const coordinates = location.coordinates;

            if (coordinates !== undefined) {
                if (
                    !Array.isArray(coordinates) ||
                    coordinates.length !== 2 ||
                    coordinates.some((value) => !Number.isFinite(Number(value)))
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Location coordinates must be [longitude, latitude]"
                    });
                }

                const longitude = Number(coordinates[0]);
                const latitude = Number(coordinates[1]);

                if (
                    longitude < -180 || longitude > 180 ||
                    latitude < -90 || latitude > 90
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid location coordinates"
                    });
                }

                updates.location = {
                    type: "Point",
                    coordinates: [longitude, latitude],
                    address: String(location.address || "").trim()
                };
            } else if (location.address !== undefined) {
                updates.location = {
                    type: "Point",
                    coordinates: req.user.location?.coordinates || [0, 0],
                    address: String(location.address || "").trim()
                };
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: { user }
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// CHANGE CURRENT USER PASSWORD
// ==========================================

const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (String(newPassword).length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters"
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const matches = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!matches) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully",
            data: {}
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// FORGOT PASSWORD — OTP WORKFLOW
// ==========================================

const retryError = (res, message, retryAfter) =>
    res.status(429).json({ success: false, message, data: { retryAfter: Math.max(1, Math.ceil(retryAfter / 1000)) } });

const sendOtp = async (req, res, next) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();

        if (!EMAIL_PATTERN.test(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address" });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                code: "EMAIL_NOT_REGISTERED",
                message: "We couldn't find a Fixora account registered with this email address."
            });
        }
        if (user.role === "admin") {
            return res.status(403).json({
                success: false,
                code: "NOT_ELIGIBLE",
                message: "Password reset is not available for this account. Please contact platform support."
            });
        }

        const now = Date.now();
        let record = await PasswordOtp.findOne({ email });

        if (record) {
            if (record.lockedUntil && record.lockedUntil.getTime() > now) {
                return retryError(res, "Too many incorrect attempts. Please try again later.", record.lockedUntil.getTime() - now);
            }
            if (record.lastSentAt && now - record.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
                return retryError(res, "Please wait before requesting another code.", OTP_RESEND_COOLDOWN_MS - (now - record.lastSentAt.getTime()));
            }
            if (now - record.windowStart.getTime() >= OTP_WINDOW_MS) {
                record.windowStart = new Date(now);
                record.sendCount = 0;
            }
            if (record.sendCount >= OTP_MAX_SENDS) {
                return retryError(res, "You've requested too many codes. Please try again later.", OTP_WINDOW_MS - (now - record.windowStart.getTime()));
            }
        } else {
            record = new PasswordOtp({ email, user: user._id, windowStart: new Date(now), sendCount: 0 });
        }

        const otp = String(crypto.randomInt(100000, 1000000));
        record.user = user._id;
        record.otpHash = hashOtp(email, otp);
        record.otpExpiresAt = new Date(now + OTP_TTL_MS);
        record.attempts = 0;
        record.sendCount += 1;
        record.lastSentAt = new Date(now);
        record.lockedUntil = null;
        record.purgeAt = new Date(now + OTP_WINDOW_MS + OTP_LOCK_MS);
        await record.save();

        const smtpReady = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].every((k) => process.env[k]);
        let devOtp;

        if (!smtpReady && process.env.NODE_ENV !== "production") {
            devOtp = otp; // local development without SMTP
            console.log(`[dev] Password reset OTP for ${email}: ${otp}`);
        } else {
            try {
                await sendSmtpEmail({
                    to: email,
                    subject: "Your Fixora verification code",
                    replyTo: process.env.SMTP_FROM || process.env.SMTP_USER,
                    text: `Hello ${user.name},\n\nYour Fixora password reset code is:\n\n    ${otp}\n\nThis code expires in 10 minutes. Never share it with anyone — Fixora staff will never ask for it.\n\nIf you didn't request this, you can safely ignore this email; your password will not change.\n\nFixora Support`
                });
            } catch (mailError) {
                record.otpHash = null;
                record.otpExpiresAt = null;
                record.sendCount = Math.max(0, record.sendCount - 1);
                record.lastSentAt = null;
                await record.save();
                console.error("OTP email failed:", mailError.message);
                return res.status(502).json({
                    success: false,
                    message: "We couldn't send the verification email right now. Please try again in a moment."
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "A 6-digit verification code has been sent to your email.",
            data: {
                email,
                maskedEmail: maskEmail(email),
                expiresIn: OTP_TTL_MS / 1000,
                resendIn: OTP_RESEND_COOLDOWN_MS / 1000,
                maxAttempts: OTP_MAX_ATTEMPTS,
                remainingSends: OTP_MAX_SENDS - record.sendCount,
                ...(devOtp ? { devOtp } : {})
            }
        });
    } catch (error) {
        next(error);
    }
};

const verifyOtp = async (req, res, next) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const otp = String(req.body?.otp || "").trim();

        if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ success: false, message: "Enter the 6-digit code we emailed you." });
        }

        const record = await PasswordOtp.findOne({ email });
        const now = Date.now();

        if (!record || !record.otpHash) {
            return res.status(400).json({ success: false, code: "OTP_MISSING", message: "No active code found. Please request a new one." });
        }
        if (record.lockedUntil && record.lockedUntil.getTime() > now) {
            return retryError(res, "Too many incorrect attempts. Please try again later.", record.lockedUntil.getTime() - now);
        }
        if (!record.otpExpiresAt || record.otpExpiresAt.getTime() <= now) {
            return res.status(400).json({ success: false, code: "OTP_EXPIRED", message: "This code has expired. Please request a new one." });
        }

        const given = Buffer.from(hashOtp(email, otp));
        const stored = Buffer.from(record.otpHash);
        const ok = given.length === stored.length && crypto.timingSafeEqual(given, stored);

        if (!ok) {
            record.attempts += 1;
            if (record.attempts >= OTP_MAX_ATTEMPTS) {
                record.lockedUntil = new Date(now + OTP_LOCK_MS);
                record.otpHash = null;
                record.otpExpiresAt = null;
                await record.save();
                return retryError(res, "Too many incorrect attempts. This code is now locked.", OTP_LOCK_MS);
            }
            await record.save();
            const left = OTP_MAX_ATTEMPTS - record.attempts;
            return res.status(400).json({
                success: false,
                code: "OTP_INVALID",
                message: `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`,
                data: { attemptsLeft: left }
            });
        }

        const user = await User.findOne({ _id: record.user, email, role: { $ne: "admin" } }).select("+passwordResetToken +passwordResetExpires");
        if (!user) {
            return res.status(400).json({ success: false, message: "This account is no longer eligible for password reset." });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        user.passwordResetToken = crypto.createHash("sha256").update(rawToken).digest("hex");
        user.passwordResetExpires = new Date(now + 10 * 60 * 1000);
        await user.save({ validateBeforeSave: false });

        // single use
        record.otpHash = null;
        record.otpExpiresAt = null;
        record.attempts = 0;
        await record.save();

        return res.status(200).json({
            success: true,
            message: "Code verified. You can now choose a new password.",
            data: { resetToken: rawToken, expiresIn: 600 }
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// RESET PASSWORD
// ==========================================

const resetPassword = async (req, res, next) => {
    try {
        const token = String(req.body?.token || "").trim();
        const email = String(req.body?.email || "").trim().toLowerCase();
        const newPassword = String(req.body?.password || "");
        const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

        if (!token || !email || !newPassword) {
            return res.status(400).json({ success: false, message: "Reset token, email and new password are required" });
        }
        if (!strongPassword.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must be 8–72 characters and include uppercase, lowercase, number and special character"
            });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
            email,
            role: { $ne: "admin" },
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() }
        }).select("+passwordResetToken +passwordResetExpires");

        if (!user) {
            return res.status(400).json({ success: false, message: "Your verification session has expired. Please request a new code." });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();
        await PasswordOtp.deleteOne({ email });

        return res.status(200).json({
            success: true,
            message: "Password reset successfully. You can now sign in.",
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// EMAIL OWNERSHIP VERIFICATION (SIGN-UP)
// ==========================================

const sendEmailCode = async (req, res, next) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const check = await checkEmailDeliverable(email);
        if (!check.ok) return res.status(400).json({ success: false, code: "EMAIL_UNDELIVERABLE", message: check.message });

        if (await User.exists({ email })) {
            return res.status(409).json({ success: false, code: "EMAIL_TAKEN", message: "An account with this email already exists. Try signing in instead." });
        }

        const now = Date.now();
        let record = await EmailVerification.findOne({ email });
        if (record) {
            if (record.lockedUntil && record.lockedUntil.getTime() > now) {
                return retryError(res, "Too many incorrect attempts. Please try again later.", record.lockedUntil.getTime() - now);
            }
            if (record.lastSentAt && now - record.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
                return retryError(res, "Please wait before requesting another code.", OTP_RESEND_COOLDOWN_MS - (now - record.lastSentAt.getTime()));
            }
            if (now - record.windowStart.getTime() >= OTP_WINDOW_MS) { record.windowStart = new Date(now); record.sendCount = 0; }
            if (record.sendCount >= OTP_MAX_SENDS) {
                return retryError(res, "You've requested too many codes. Please try again later.", OTP_WINDOW_MS - (now - record.windowStart.getTime()));
            }
        } else {
            record = new EmailVerification({ email, windowStart: new Date(now), sendCount: 0 });
        }

        const code = String(crypto.randomInt(100000, 1000000));
        record.codeHash = hashOtp(`signup:${email}`, code);
        record.codeExpiresAt = new Date(now + OTP_TTL_MS);
        record.attempts = 0;
        record.sendCount += 1;
        record.lastSentAt = new Date(now);
        record.lockedUntil = null;
        record.purgeAt = new Date(now + OTP_WINDOW_MS + OTP_LOCK_MS);
        await record.save();

        const smtpReady = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].every((k) => process.env[k]);
        let devCode;
        if (!smtpReady && process.env.NODE_ENV !== "production") {
            devCode = code;
            console.log(`[dev] Sign-up verification code for ${email}: ${code}`);
        } else {
            try {
                await sendSmtpEmail({
                    to: email,
                    subject: "Confirm your email for Fixora",
                    text: `Welcome to Fixora!\n\nYour email verification code is:\n\n    ${code}\n\nIt expires in 10 minutes. If you didn't try to create a Fixora account, you can ignore this email.\n\nFixora Support`
                });
            } catch (mailError) {
                record.codeHash = null; record.codeExpiresAt = null; record.sendCount = Math.max(0, record.sendCount - 1); record.lastSentAt = null;
                await record.save();
                console.error("Verification email failed:", mailError.message);
                return res.status(502).json({ success: false, message: "We couldn't deliver a code to that address. Check it is a real, working email and try again." });
            }
        }

        return res.status(200).json({
            success: true,
            message: "We sent a 6-digit code to your email.",
            data: { email, maskedEmail: maskEmail(email), expiresIn: OTP_TTL_MS / 1000, resendIn: OTP_RESEND_COOLDOWN_MS / 1000, maxAttempts: OTP_MAX_ATTEMPTS, ...(devCode ? { devCode } : {}) }
        });
    } catch (error) { next(error); }
};

const verifyEmailCode = async (req, res, next) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const code = String(req.body?.code || "").trim();
        if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
            return res.status(400).json({ success: false, message: "Enter the 6-digit code we emailed you." });
        }
        const record = await EmailVerification.findOne({ email });
        const now = Date.now();
        if (!record || !record.codeHash) return res.status(400).json({ success: false, code: "OTP_MISSING", message: "No active code found. Please request a new one." });
        if (record.lockedUntil && record.lockedUntil.getTime() > now) return retryError(res, "Too many incorrect attempts. Please try again later.", record.lockedUntil.getTime() - now);
        if (!record.codeExpiresAt || record.codeExpiresAt.getTime() <= now) return res.status(400).json({ success: false, code: "OTP_EXPIRED", message: "This code has expired. Please request a new one." });

        const given = Buffer.from(hashOtp(`signup:${email}`, code));
        const stored = Buffer.from(record.codeHash);
        if (!(given.length === stored.length && crypto.timingSafeEqual(given, stored))) {
            record.attempts += 1;
            if (record.attempts >= OTP_MAX_ATTEMPTS) {
                record.lockedUntil = new Date(now + OTP_LOCK_MS); record.codeHash = null; record.codeExpiresAt = null;
                await record.save();
                return retryError(res, "Too many incorrect attempts. This code is now locked.", OTP_LOCK_MS);
            }
            await record.save();
            const left = OTP_MAX_ATTEMPTS - record.attempts;
            return res.status(400).json({ success: false, code: "OTP_INVALID", message: `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`, data: { attemptsLeft: left } });
        }

        record.codeHash = null; record.codeExpiresAt = null; record.attempts = 0;
        await record.save();
        const emailToken = jwt.sign({ email, purpose: "email-verified" }, process.env.JWT_SECRET, { expiresIn: "30m" });
        return res.status(200).json({ success: true, message: "Email verified.", data: { emailToken, expiresIn: 1800 } });
    } catch (error) { next(error); }
};

// ==========================================
// REGISTRATION / VERIFICATION DOCUMENT UPLOAD
// ==========================================

const DOC_FIELDS = { profileImage: AVATAR_FOLDER, cnicFront: KYC_FOLDER, cnicBack: KYC_FOLDER };

const uploadVerificationDocuments = async (req, res, next) => {
    try {
        const files = req.files || {};
        const names = Object.keys(DOC_FIELDS).filter((k) => files[k]?.[0]);

        if (!names.length) {
            return res.status(400).json({ success: false, message: "Please attach at least one image" });
        }

        const result = {};
        for (const key of names) {
            const file = files[key][0];
            if (!sniffImage(file.buffer)) {
                return res.status(400).json({ success: false, message: `${key === "profileImage" ? "Profile image" : "CNIC"} must be a JPG, PNG or WebP image` });
            }
            const uploaded = await imagekit.upload({
                file: file.buffer,
                fileName: `${key}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${file.mimetype.split("/")[1] || "jpg"}`,
                folder: DOC_FIELDS[key],
                isPrivateFile: key !== "profileImage"
            });
            result[key] = { url: uploaded.url, fileId: uploaded.fileId };
        }

        res.status(201).json({ success: true, message: "Documents uploaded", data: { documents: result } });
    } catch (error) {
        next(error);
    }
};

const resubmitVerification = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select("+verification.documents +verification.history");
        if (!user || !["vendor", "taskRunner"].includes(user.role)) {
            return res.status(403).json({ success: false, message: "Only vendors and task runners can submit verification" });
        }
        if (!["info_requested", "rejected", "pending"].includes(user.verification?.state)) {
            return res.status(400).json({ success: false, message: "Your account does not need further verification" });
        }

        const current = user.verification.documents?.toObject?.() || {};
        const incoming = req.body?.documents || {};
        const merged = {
            profileImage: incoming.profileImage?.url ? incoming.profileImage : current.profileImage,
            cnicFront: incoming.cnicFront?.url ? incoming.cnicFront : current.cnicFront,
            cnicBack: incoming.cnicBack?.url ? incoming.cnicBack : current.cnicBack
        };
        const errors = validateDocuments(merged);
        if (errors.length) return res.status(400).json({ success: false, message: errors[0], data: { errors } });

        const phoneDigits = String(req.body?.phone ?? user.phone ?? "").replace(/\D/g, "");
        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
            return res.status(400).json({ success: false, message: "A valid phone number is required" });
        }

        const now = new Date();
        user.phone = String(req.body?.phone ?? user.phone).trim();
        user.profileImage = merged.profileImage.url;
        user.verification.documents = cleanDocuments(merged);
        user.verification.state = "pending";
        user.verification.resubmittedAt = now;
        user.verification.infoRequest = { message: "", requestedAt: null };
        user.status = "pending";
        user.verification.history.push({ action: "resubmitted", note: String(req.body?.note || "").slice(0, 500), by: user._id, at: now });
        await user.save();

        res.status(200).json({ success: true, message: "Thanks! Your documents were sent for review.", data: { user: sessionUser(user) } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    sendEmailCode,
    verifyEmailCode,
    sendOtp,
    verifyOtp,
    uploadVerificationDocuments,
    resubmitVerification,
    resetPassword,
    login,
    updateProfile,
    changePassword
};