const User = require("../models/User");

const getVendorProfile = async (req, res, next) => {
    try {
        const vendor = await User.findOne({
            _id: req.params.id,
            role: "vendor",
            status: { $in: ["approved", "active"] }
        }).select("name email phone profileImage location role status createdAt");

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Vendor profile retrieved successfully",
            data: { vendor }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getVendorProfile };
