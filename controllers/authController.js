const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendSmtpEmail } = require("../utils/smtp");

const User = require("../models/User");
const generateToken = require("../utils/generateToken");

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

        const hashedPassword = await bcrypt.hash(passwordValue, 10);

        const userStatus =
            selectedRole === "customer" ? "active" : "pending";

        const user = await User.create({
            name,
            email: normalizedEmail,
            phone,
            password: hashedPassword,
            role: selectedRole,
            location,
            status: userStatus
        });

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: "Registration successful",
            data: {
                user: {
                    id: user._id,
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone || "",
                    profileImage: user.profileImage || "",
                    location: user.location || null,
                    role: user.role,
                    status: user.status
                },
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
                user: {
                    id: user._id,
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone || "",
                    profileImage: user.profileImage || "",
                    location: user.location || null,
                    role: user.role,
                    status: user.status
                },
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
// FORGOT PASSWORD
// ==========================================

const forgotPassword = async (req, res, next) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

        if (!emailPattern.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        const user = await User.findOne({ email }).select("+passwordResetToken +passwordResetExpires");

        // Never reveal whether an account exists.
        if (!user || user.role === "admin") {
            return res.status(200).json({
                success: true,
                message: "If an eligible account exists, a password reset email has been sent.",
                data: {}
            });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        user.passwordResetToken = crypto.createHash("sha256").update(rawToken).digest("hex");
        user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
        await user.save({ validateBeforeSave: false });

        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

        try {
            await sendSmtpEmail({
                to: email,
                subject: "Reset your Fixora password",
                replyTo: process.env.SMTP_FROM || process.env.SMTP_USER,
                text: `Hello ${user.name},\n\nWe received a request to reset your Fixora password.\n\nOpen this secure link within 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\nFixora Support`
            });
        } catch (mailError) {
            user.passwordResetToken = null;
            user.passwordResetExpires = null;
            await user.save({ validateBeforeSave: false });
            return next(mailError);
        }

        return res.status(200).json({
            success: true,
            message: "If an eligible account exists, a password reset email has been sent.",
            data: {}
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
            return res.status(400).json({ success: false, message: "This password reset link is invalid or has expired" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password reset successfully. You can now sign in.",
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    forgotPassword,
    resetPassword,
    login,
    updateProfile,
    changePassword
};