const Conversation = require("../models/Conversation");
const User = require("../models/User");

const populateConversation = (query) => query
  .populate("participants", "name email role profileImage status")
  .populate("lastMessage")
  .sort({ lastMessageAt: -1 });

// Only conversations where the admin is an actual participant are shown.
// Customer↔vendor, customer↔runner, and other marketplace chats stay private.
const getAdminConversations = async (req, res, next) => {
  try {
    const conversations = await populateConversation(
      Conversation.find({ participants: req.user._id, isGroup: false })
    );
    res.json({ success: true, data: { conversations } });
  } catch (e) { next(e); }
};

const getChatUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: "admin" }, status: { $ne: "suspended" } })
      .select("name email role profileImage status")
      .sort({ name: 1 });
    res.json({ success: true, data: { users } });
  } catch (e) { next(e); }
};

const getOrCreateAdminConversation = async (req, res, next) => {
  try {
    const participantId = String(req.params.userId || "");
    if (!participantId || participantId === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "Select a valid user." });
    }
    const user = await User.findOne({ _id: participantId, role: { $ne: "admin" } }).select("name email role profileImage status");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, user._id], $size: 2 }
    });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.user._id, user._id] });
    }
    conversation = await populateConversation(Conversation.findById(conversation._id));
    res.json({ success: true, data: { conversation } });
  } catch (e) { next(e); }
};

module.exports = { getAdminConversations, getChatUsers, getOrCreateAdminConversation };
