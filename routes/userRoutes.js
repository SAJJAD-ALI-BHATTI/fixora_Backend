const express = require("express");
const { getVendorProfile } = require("../controllers/userController");
const { authenticateUser } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/vendors/:id",
    authenticateUser,
    requireRole("customer"),
    getVendorProfile
);

module.exports = router;
