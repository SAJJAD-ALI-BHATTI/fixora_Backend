const User = require("../models/User");
const { getOnlineUserIds } = require("../socket/socket");

const getUsers = async (req, res, next) => {
    try {
        const users = await User.find()
            .select("-password")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: {
                users
            }
        });
    } catch (error) {
        next(error);
    }
};

const getVendors = async (req, res, next) => {
    try {
        const vendors = await User.find({
            role: "vendor"
        })
            .select("-password")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Vendors retrieved successfully",
            data: {
                vendors
            }
        });
    } catch (error) {
        next(error);
    }
};

const getTaskRunners = async (req, res, next) => {
    try {
        const taskRunners = await User.find({
            role: "taskRunner"
        })
            .select("-password")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Task runners retrieved successfully",
            data: {
                taskRunners
            }
        });
    } catch (error) {
        next(error);
    }
};

const approveVendor = async (req, res, next) => {
    try {
        const vendor = await User.findOne({
            _id: req.params.id,
            role: "vendor"
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found"
            });
        }

        vendor.status = "approved";

        await vendor.save();

        res.status(200).json({
            success: true,
            message: "Vendor approved successfully",
            data: {
                vendor: {
                    id: vendor._id,
                    name: vendor.name,
                    email: vendor.email,
                    role: vendor.role,
                    status: vendor.status
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

const rejectVendor = async (req, res, next) => {
    try {
        const vendor = await User.findOne({
            _id: req.params.id,
            role: "vendor"
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found"
            });
        }

        vendor.status = "rejected";

        await vendor.save();

        res.status(200).json({
            success: true,
            message: "Vendor rejected successfully"
        });
    } catch (error) {
        next(error);
    }
};

const approveTaskRunner = async (req, res, next) => {
    try {
        const taskRunner = await User.findOne({
            _id: req.params.id,
            role: "taskRunner"
        });

        if (!taskRunner) {
            return res.status(404).json({
                success: false,
                message: "Task runner not found"
            });
        }

        taskRunner.status = "approved";

        await taskRunner.save();

        res.status(200).json({
            success: true,
            message: "Task runner approved successfully",
            data: {
                taskRunner: {
                    id: taskRunner._id,
                    name: taskRunner.name,
                    email: taskRunner.email,
                    role: taskRunner.role,
                    status: taskRunner.status
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

const rejectTaskRunner = async (req, res, next) => {
    try {
        const taskRunner = await User.findOne({
            _id: req.params.id,
            role: "taskRunner"
        });

        if (!taskRunner) {
            return res.status(404).json({
                success: false,
                message: "Task runner not found"
            });
        }

        taskRunner.status = "rejected";

        await taskRunner.save();

        res.status(200).json({
            success: true,
            message: "Task runner rejected successfully"
        });
    } catch (error) {
        next(error);
    }
};

const suspendUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.role === "admin") {
            return res.status(400).json({
                success: false,
                message: "Admin account cannot be suspended"
            });
        }

        user.status = "suspended";

        await user.save();

        res.status(200).json({
            success: true,
            message: "User suspended successfully"
        });
    } catch (error) {
        next(error);
    }
};

const activateUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.status = "active";

        await user.save();

        res.status(200).json({
            success: true,
            message: "User activated successfully"
        });
    } catch (error) {
        next(error);
    }
};

const getOnlineUsers = async (req, res, next) => {
    try {
        res.json({ success: true, data: { userIds: getOnlineUserIds() } });
    } catch (error) { next(error); }
};

module.exports = {
    getUsers,
    getVendors,
    getTaskRunners,
    approveVendor,
    rejectVendor,
    approveTaskRunner,
    rejectTaskRunner,
    suspendUser,
    activateUser,
    getOnlineUsers
};
const getServices = async (req,res,next)=>{try{const Service=require("../models/Service");const services=await Service.find().populate("vendor","name email").sort({createdAt:-1});res.json({success:true,data:{services}})}catch(e){next(e)}};
const getBookings = async (req,res,next)=>{try{const Booking=require("../models/Booking");const bookings=await Booking.find().populate("customer","name email").populate("vendor","name email").populate("service","title").sort({createdAt:-1});res.json({success:true,data:{bookings}})}catch(e){next(e)}};
const getTasks = async (req,res,next)=>{try{const Task=require("../models/Task");const tasks=await Task.find().populate("customer","name email").populate("assignedRunner","name email").sort({createdAt:-1});res.json({success:true,data:{tasks}})}catch(e){next(e)}};
const getOffers = async (req,res,next)=>{try{const Offer=require("../models/Offer");const offers=await Offer.find().populate("task","title budget").populate("runner","name email").sort({createdAt:-1});res.json({success:true,data:{offers}})}catch(e){next(e)}};

module.exports.getServices=getServices;
module.exports.getBookings=getBookings;
module.exports.getTasks=getTasks;
module.exports.getOffers=getOffers;
