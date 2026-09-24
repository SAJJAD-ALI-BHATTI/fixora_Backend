const express = require("express");
const { authenticateUser } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { getCustomerWallets, creditCustomerWallet } = require("../controllers/adminWalletController");
const router = express.Router();
router.use(authenticateUser, requireRole("admin"));
router.get("/customers", getCustomerWallets);
router.post("/customers/:userId/credit", creditCustomerWallet);
module.exports = router;
