const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { previewFor } = require("../utils/chatPrivacy");

const populateConversation = (query) => query
  .populate("participants", "name email role profileImage status")
  .populate({
    path: "lastMessage",
    populate: { path: "sender", select: "name profileImage role" },
  })
  .sort({ lastMessageAt: -1 });

async function withUnread(conversations, userId) {
  if (!conversations.length) return conversations;
  const ids = conversations.map((c) => c._id);
  const rows = await Message.aggregate([
    {
      $match: {
        conversation: { $in: ids },
        deleted: { $ne: true },
        unsent: { $ne: true },
        deletedFor: { $nin: [new mongoose.Types.ObjectId(String(userId))] },
        sender: { $ne: new mongoose.Types.ObjectId(String(userId)) },
        readBy: { $nin: [new mongoose.Types.ObjectId(String(userId))] },
      },
    },
    { $group: { _id: "$conversation", count: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((row) => [String(row._id), row.count]));
  return conversations.map((conversation) => {
    const plain = previewFor(conversation, userId);
    return { ...plain, unreadCount: map.get(String(plain._id)) || 0 };
  });
}

const getAdminConversations = async (req, res, next) => {
  try {
    const conversations = await populateConversation(
      Conversation.find({ participants: req.user._id, isGroup: false })
    );
    res.json({ success: true, data: { conversations: await withUnread(conversations, req.user._id) } });
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
      participants: { $all: [req.user._id, user._id], $size: 2 },
    });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.user._id, user._id] });
    }
    conversation = await populateConversation(Conversation.findById(conversation._id));
    res.json({ success: true, data: { conversation } });
  } catch (e) { next(e); }
};

module.exports = { getAdminConversations, getChatUsers, getOrCreateAdminConversation };
