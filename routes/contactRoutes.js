const express = require("express");
const { createContactInquiry } = require("../controllers/contactController");
const router = express.Router();
router.post("/", createContactInquiry);
module.exports = router;
