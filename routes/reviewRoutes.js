const express = require("express");

const {
    createBookingReview,
    createTaskReview,
    getServiceReviews,
    getTaskRunnerReviews,
    getVendorReviews,
    getMyReviews,
    updateReview,
    deleteReview
} = require("../controllers/reviewController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const {
    requireRole
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/service/:serviceId",
    getServiceReviews
);

router.get(
    "/vendor/:vendorId",
    getVendorReviews
);

router.get(
    "/runner/:runnerId",
    getTaskRunnerReviews
);

router.use(authenticateUser);

router.post(
    "/booking/:bookingId",
    requireRole("customer"),
    createBookingReview
);

router.post(
    "/task/:taskId",
    requireRole("customer"),
    createTaskReview
);

router.get(
    "/my-reviews",
    requireRole("customer"),
    getMyReviews
);

router.patch(
    "/:id",
    requireRole("customer"),
    updateReview
);

router.delete(
    "/:id",
    requireRole("customer"),
    deleteReview
);

module.exports = router;