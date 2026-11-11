const express = require("express");

const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
} = require("../controllers/notificationController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateUser);

router.get("/", getNotifications);

router.get(
    "/unread-count",
    getUnreadCount
);

router.patch(
    "/read-all",
    markAllAsRead
);

router.patch(
    "/:id/read",
    markAsRead
);

router.delete(
    "/:id",
    deleteNotification
);

module.exports = router;