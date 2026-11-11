const express = require("express");
const {
  createConversation,
  getOrCreateSupportConversation,
  getMyConversations,
  getMessages,
  markConversationRead,
  getUnreadSummary,
  getPresence,
  unsendMessage,
  hideMessage,
  clearConversation,
} = require("../controllers/chatController");
const { authenticateUser } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authenticateUser);

router.post("/support", getOrCreateSupportConversation);
router.post("/conversations", createConversation);
router.get("/conversations", getMyConversations);
router.patch("/conversations/:id/read", markConversationRead);
router.get("/messages/:id", getMessages);
router.get("/unread", getUnreadSummary);
router.get("/presence", getPresence);
router.delete("/messages/:messageId", unsendMessage);
router.patch("/messages/:messageId/hide", hideMessage);
router.delete("/conversations/:id/messages", clearConversation);

module.exports = router;
