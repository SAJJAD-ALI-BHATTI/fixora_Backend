const express = require("express");

const {
    createOffer,
    getTaskOffers,
    getMyOffers,
    getOfferById,
    withdrawOffer,
    acceptOffer,
    rejectOffer,
    counterOffer,
    acceptCounterOffer,
    rejectCounterOffer
} = require("../controllers/offerController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const {
    requireRole
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateUser);

router.post(
    "/task/:taskId",
    requireRole("taskRunner"),
    createOffer
);

router.get(
    "/task/:taskId",
    requireRole("customer"),
    getTaskOffers
);

router.get(
    "/runner/my-offers",
    requireRole("taskRunner"),
    getMyOffers
);

router.get(
    "/:id",
    getOfferById
);

router.patch(
    "/:id/withdraw",
    requireRole("taskRunner"),
    withdrawOffer
);

router.patch(
    "/:id/accept",
    requireRole("customer"),
    acceptOffer
);

router.patch(
    "/:id/counter",
    requireRole("customer"),
    counterOffer
);

router.patch(
    "/:id/accept-counter",
    requireRole("taskRunner"),
    acceptCounterOffer
);

router.patch(
    "/:id/reject-counter",
    requireRole("taskRunner"),
    rejectCounterOffer
);

router.patch(
    "/:id/reject",
    requireRole("customer"),
    rejectOffer
);

module.exports = router;