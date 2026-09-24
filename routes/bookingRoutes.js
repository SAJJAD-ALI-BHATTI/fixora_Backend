const express = require("express");

const {
    createBooking,
    getCustomerBookings,
    getVendorBookings,
    getBookingById,
    updateBookingStatus
} = require("../controllers/bookingController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const {
    requireRole
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateUser);

router.post(
    "/",
    requireRole("customer"),
    createBooking
);

router.get(
    "/customer",
    requireRole("customer"),
    getCustomerBookings
);

router.get(
    "/vendor",
    requireRole("vendor"),
    getVendorBookings
);

router.get(
    "/:id",
    getBookingById
);

router.patch(
    "/:id/status",
    updateBookingStatus
);

module.exports = router;