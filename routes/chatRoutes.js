const express = require("express");

const {
    createConversation,
    getMyConversations,
    getMessages
} = require(
    "../controllers/chatController"
);

const {
    authenticateUser
} = require(
    "../middleware/authMiddleware"
);

const router =
    express.Router();

router.use(
    authenticateUser
);

router.post(
    "/conversations",
    createConversation
);

router.get(
    "/conversations",
    getMyConversations
);

router.get(
    "/messages/:id",
    getMessages
);

module.exports = router;