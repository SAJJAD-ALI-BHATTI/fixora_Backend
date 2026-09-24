const express = require("express");

const {
    register,
    login,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword
} = require("../controllers/authController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const User = require("../models/User");

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

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