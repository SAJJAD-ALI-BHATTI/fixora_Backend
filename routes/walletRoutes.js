const express = require("express");

const {
    getMyWallet
} = require(
    "../controllers/walletController"
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
    getMyWallet
);

module.exports = router;