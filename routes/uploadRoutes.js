const express = require("express");

const {
    uploadImages
} = require("../controllers/uploadController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post(
    "/images",
    authenticateUser,
    upload.array("images", 10),
    uploadImages
);

module.exports = router;