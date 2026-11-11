const express = require("express");

const {
    requestPayout,
    getMyPayouts,
    getAllPayouts,
    processPayout
} = require(
    "../controllers/payoutController"
);

const {
    authenticateUser
} = require(
    "../middleware/authMiddleware"
);

const {
    requireRole
} = require(
    "../middleware/roleMiddleware"
);

const router = express.Router();

router.use(authenticateUser);


// User

router.post(
    "/",
    requireRole(
        "vendor",
        "taskRunner"
    ),
    requestPayout
);

router.get(
    "/my-payouts",
    requireRole(
        "vendor",
        "taskRunner"
    ),
    getMyPayouts
);


// Admin

router.get(
    "/admin/all",
    requireRole("admin"),
    getAllPayouts
);

router.patch(
    "/admin/:id",
    requireRole("admin"),
    processPayout
);


module.exports = router;