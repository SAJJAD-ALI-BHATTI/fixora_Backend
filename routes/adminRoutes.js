const express = require("express");

const {
    getUsers,
    getVendors,
    getTaskRunners,
    approveVendor,
    rejectVendor,
    approveTaskRunner,
    rejectTaskRunner,
    suspendUser,
    activateUser,
    getServices,
    getBookings,
    getTasks,
    getOffers,
    getOnlineUsers
} = require("../controllers/adminController");

const { getAdminSettings, updateAdminSettings } = require("../controllers/adminSettingsController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const {
    requireRole
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateUser);
router.use(requireRole("admin"));

router.get("/users", getUsers);
router.get("/online-users", getOnlineUsers);
router.get("/settings", getAdminSettings);
router.patch("/settings", updateAdminSettings);

router.get("/vendors", getVendors);

router.get("/task-runners", getTaskRunners);

router.patch(
    "/vendors/:id/approve",
    approveVendor
);

router.patch(
    "/vendors/:id/reject",
    rejectVendor
);

router.patch(
    "/task-runners/:id/approve",
    approveTaskRunner
);

router.patch(
    "/task-runners/:id/reject",
    rejectTaskRunner
);

router.patch(
    "/users/:id/suspend",
    suspendUser
);

router.patch(
    "/users/:id/activate",
    activateUser
);

router.get("/services", getServices);
router.get("/bookings", getBookings);
router.get("/tasks", getTasks);
router.get("/offers", getOffers);

module.exports = router;