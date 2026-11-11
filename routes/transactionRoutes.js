const express = require("express");

const {
    getMyTransactions,
    getProviderTransactions,
    getTransactionById,
    getTransactionByReference,
    getTransactionSummary
} = require(
    "../controllers/transactionController"
);

const {
    authenticateUser
} = require(
    "../middleware/authMiddleware"
);

const router = express.Router();

router.use(authenticateUser);

router.get(
    "/",
    getMyTransactions
);

router.get(
    "/provider",
    require("../middleware/roleMiddleware").requireRole("vendor", "taskRunner"),
    getProviderTransactions
);

router.get(
    "/summary",
    getTransactionSummary
);

router.get(
    "/reference/:reference",
    getTransactionByReference
);

router.get(
    "/:id",
    getTransactionById
);

module.exports = router;