const Notification = require("../models/Notification");

const getNotifications = async (
    req,
    res,
    next
) => {
    try {
        const filter = { recipient: req.user._id };
        if (req.query.unread === "true") filter.isRead = false;
        if (req.query.types) {
            const types = String(req.query.types).split(",").map((t) => t.trim()).filter(Boolean);
            if (types.length) filter.type = { $in: types };
        }
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 200);

        let query = Notification.find(filter)
            .populate(
                "sender",
                "name profileImage"
            )
            .sort({ createdAt: -1 });
        if (limit) query = query.limit(limit);
        const notifications = await query;

        const unreadCount =
            await Notification.countDocuments({
                recipient: req.user._id,
                isRead: false
            });

        res.status(200).json({
            success: true,
            data: {
                notifications,
                unreadCount
            }
        });
    } catch (error) {
        next(error);
    }
};

const getUnreadCount = async (
    req,
    res,
    next
) => {
    try {
        const unreadCount =
            await Notification.countDocuments({
                recipient: req.user._id,
                isRead: false
            });

        res.status(200).json({
            success: true,
            data: {
                unreadCount
            }
        });
    } catch (error) {
        next(error);
    }
};

const markAsRead = async (
    req,
    res,
    next
) => {
    try {
        const notification =
            await Notification.findOne({
                _id: req.params.id,
                recipient: req.user._id
            });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        notification.isRead = true;

        await notification.save();

        res.status(200).json({
            success: true,
            message:
                "Notification marked as read",
            data: {
                notification
            }
        });
    } catch (error) {
        next(error);
    }
};

const markAllAsRead = async (
    req,
    res,
    next
) => {
    try {
        await Notification.updateMany(
            {
                recipient: req.user._id,
                isRead: false
            },
            {
                $set: {
                    isRead: true
                }
            }
        );

        res.status(200).json({
            success: true,
            message:
                "All notifications marked as read"
        });
    } catch (error) {
        next(error);
    }
};

const deleteNotification = async (
    req,
    res,
    next
) => {
    try {
        const notification =
            await Notification.findOne({
                _id: req.params.id,
                recipient: req.user._id
            });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        await notification.deleteOne();

        res.status(200).json({
            success: true,
            message:
                "Notification deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
};