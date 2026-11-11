const express = require("express");
const { authenticateUser } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { confirmBookingPayment, confirmTaskPayment } = require("../controllers/paymentController");
const router = express.Router();
router.use(authenticateUser, requireRole("customer"));
router.post("/bookings/:id/confirm", confirmBookingPayment);
router.post("/tasks/:id/confirm", confirmTaskPayment);
module.exports = router;
