const express = require("express");

const {
    register,
    login,
    updateProfile,
    changePassword,
    sendOtp,
    sendEmailCode,
    verifyEmailCode,
    verifyOtp,
    resetPassword,
    uploadVerificationDocuments,
    resubmitVerification
} = require("../controllers/authController");

const multer = require("multer");
const { rateLimit } = require("../utils/rateLimit");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const User = require("../models/User");

const router = express.Router();

const docUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 3 },
    fileFilter: (req, file, cb) =>
        /^image\/(jpe?g|png|webp)$/.test(file.mimetype)
            ? cb(null, true)
            : cb(new Error("Only JPG, PNG or WebP images are allowed"))
}).fields([
    { name: "profileImage", maxCount: 1 },
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 }
]);

// Convert multer errors into friendly 400s
const handleDocUpload = (req, res, next) =>
    docUpload(req, res, (err) => {
        if (!err) return next();
        const message = err.code === "LIMIT_FILE_SIZE" ? "Each image must be 5 MB or smaller" : err.message;
        res.status(400).json({ success: false, message });
    });

router.post(
    "/register/documents",
    rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyPrefix: "kyc-upload", message: "Too many uploads. Please try again later." }),
    handleDocUpload,
    uploadVerificationDocuments
);

router.post("/verification/documents", authenticateUser, handleDocUpload, uploadVerificationDocuments);
router.post("/verification/resubmit", authenticateUser, resubmitVerification);

const emailLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "email-code", message: "Too many requests. Please wait a few minutes and try again." });
router.post("/email/send-code", emailLimit, sendEmailCode);
router.post("/email/verify", emailLimit, verifyEmailCode);

router.post("/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyPrefix: "register" }), register);

router.post("/login", login);

const otpLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "otp", message: "Too many requests. Please wait a few minutes and try again." });

// OTP password-reset workflow: send -> verify -> reset
router.post("/otp/send", otpLimit, sendOtp);
router.post("/otp/resend", otpLimit, sendOtp);
router.post("/otp/verify", otpLimit, verifyOtp);
router.post("/otp/reset", otpLimit, resetPassword);

// Backwards-compatible aliases
router.post("/forgot-password", otpLimit, sendOtp);
router.post("/reset-password", otpLimit, resetPassword);

router.patch("/me", authenticateUser, updateProfile);

router.patch("/password", authenticateUser, changePassword);

router.get("/me", authenticateUser, async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select(
            "-password"
        );

        res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            data: {
                user
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;