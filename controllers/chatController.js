const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { getOnlineUserIds, getIO } = require("../socket/socket");
const { previewFor } = require("../utils/chatPrivacy");

const PARTICIPANT_FIELDS = "name profileImage role status";

function isValidId(id) {
  return Boolean(id) && mongoose.Types.ObjectId.isValid(id);
}

function asObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}

function populateConversation(query) {
  return query
    .populate("participants", PARTICIPANT_FIELDS)
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "name profileImage role" },
    })
    .sort({ lastMessageAt: -1 });
}

async function attachUnreadCounts(conversations, userId) {
  if (!conversations.length) return conversations;
  const ids = conversations.map((c) => c._id);
  const rows = await Message.aggregate([
    {
      $match: {
        conversation: { $in: ids },
        deleted: { $ne: true },
        unsent: { $ne: true },
        deletedFor: { $nin: [asObjectId(userId)] },
        sender: { $ne: asObjectId(userId) },
        readBy: { $nin: [asObjectId(userId)] },
      },
    },
    { $group: { _id: "$conversation", count: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((row) => [String(row._id), row.count]));
  return conversations.map((conversation) => {
    const plain = conversation.toObject ? conversation.toObject() : conversation;
    return { ...previewFor(plain, userId), unreadCount: map.get(String(plain._id)) || 0 };
  });
}

async function assertParticipant(conversationId, userId) {
  if (!isValidId(conversationId)) return null;
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return null;
  const allowed = conversation.participants.some((participant) => String(participant) === String(userId));
  return allowed ? conversation : false;
}

const createConversation = async (req, res, next) => {
  try {
    const participantId = String(req.body.participantId || "");
    if (!isValidId(participantId)) {
      return res.status(400).json({ success: false, message: "Select a valid participant." });
    }
    if (String(participantId) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "You cannot start a conversation with yourself." });
    }

    const other = await User.findOne({ _id: participantId, status: { $ne: "suspended" } }).select("_id role");
    if (!other) {
      return res.status(404).json({ success: false, message: "That user is not available for messaging." });
    }

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, other._id], $size: 2 },
    });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.user._id, other._id] });
    }

    conversation = await populateConversation(Conversation.findById(conversation._id));
    res.status(200).json({ success: true, data: { conversation } });
  } catch (error) {
    next(error);
  }
};

const getMyConversations = async (req, res, next) => {
  try {
    const conversations = await populateConversation(
      Conversation.find({ participants: req.user._id, isGroup: false })
    );
    const withUnread = await attachUnreadCounts(conversations, req.user._id);
    res.status(200).json({ success: true, data: { conversations: withUnread } });
  } catch (error) {
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const access = await assertParticipant(req.params.id, req.user._id);
    if (access === null) return res.status(404).json({ success: false, message: "Conversation not found." });
    if (access === false) return res.status(403).json({ success: false, message: "You are not part of this conversation." });

    const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);
    const before = req.query.before;
    const filter = { conversation: req.params.id, deleted: { $ne: true }, deletedFor: { $nin: [req.user._id] } };
    if (before && !Number.isNaN(Date.parse(before))) {
      filter.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(filter)
      .populate("sender", PARTICIPANT_FIELDS)
      .sort({ createdAt: -1 })
      .limit(limit);

    await Message.updateMany(
      { conversation: req.params.id, sender: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(),
        hasMore: messages.length === limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

const markConversationRead = async (req, res, next) => {
  try {
    const access = await assertParticipant(req.params.id, req.user._id);
    if (access === null) return res.status(404).json({ success: false, message: "Conversation not found." });
    if (access === false) return res.status(403).json({ success: false, message: "You are not part of this conversation." });

    await Message.updateMany(
      { conversation: req.params.id, sender: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    const unread = await Message.countDocuments({
      conversation: { $in: await Conversation.find({ participants: req.user._id }).distinct("_id") },
      deleted: { $ne: true },
      unsent: { $ne: true },
      deletedFor: { $nin: [req.user._id] },
      sender: { $ne: req.user._id },
      readBy: { $nin: [req.user._id] },
    });

    res.status(200).json({ success: true, data: { unreadCount: unread } });
  } catch (error) {
    next(error);
  }
};

const getUnreadSummary = async (req, res, next) => {
  try {
    const conversationIds = await Conversation.find({ participants: req.user._id }).distinct("_id");
    const unreadCount = conversationIds.length
      ? await Message.countDocuments({
          conversation: { $in: conversationIds },
          deleted: { $ne: true },
          unsent: { $ne: true },
          deletedFor: { $nin: [req.user._id] },
          sender: { $ne: req.user._id },
          readBy: { $nin: [req.user._id] },
        })
      : 0;
    res.status(200).json({ success: true, data: { unreadCount } });
  } catch (error) {
    next(error);
  }
};

const getPresence = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: { userIds: getOnlineUserIds() } });
  } catch (error) {
    next(error);
  }
};

const getOrCreateSupportConversation = async (req, res, next) => {
  try {
    const admin = await User.findOne({ role: "admin", status: { $ne: "suspended" } }).sort({ createdAt: 1 }).select("_id");
    if (!admin) {
      return res.status(503).json({ success: false, message: "Fixora support is not configured yet. Please try again later." });
    }
    if (String(admin._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: "Administrators should use the admin messaging center." });
    }

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, admin._id], $size: 2 },
    });
    if (!conversation) conversation = await Conversation.create({ participants: [req.user._id, admin._id] });
    conversation = await populateConversation(Conversation.findById(conversation._id));
    res.status(200).json({ success: true, data: { conversation } });
  } catch (error) {
    next(error);
  }
};

const emitConversation = (conversation, event, payload) => {
  try {
    const io = getIO();
    io.to(`conversation:${conversation._id}`).emit(event, payload);
    conversation.participants.forEach((p) => io.to(`user:${String(p)}`).emit(event, payload));
  } catch {
    /* socket not initialised (tests / serverless) */
  }
};

// Unsend: sender retracts a message for everyone. Content is wiped, a placeholder remains.
const unsendMessage = async (req, res, next) => {
  try {
    if (!isValidId(req.params.messageId)) return res.status(400).json({ success: false, message: "Invalid message." });
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, message: "Message not found." });
    const conversation = await assertParticipant(message.conversation, req.user._id);
    if (!conversation) return res.status(403).json({ success: false, message: "You are not part of this conversation." });
    if (String(message.sender) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only unsend your own messages." });
    }
    if (!message.unsent) {
      message.unsent = true;
      message.unsentAt = new Date();
      message.text = "";
      message.attachments = [];
      await message.save();
    }
    const payload = {
      conversationId: String(conversation._id),
      messageId: String(message._id),
      senderId: String(req.user._id),
      unsentAt: message.unsentAt,
    };
    emitConversation(conversation, "messageUnsent", payload);
    res.status(200).json({ success: true, data: payload });
  } catch (error) {
    next(error);
  }
};

// Delete a single message from the caller's own view only.
const hideMessage = async (req, res, next) => {
  try {
    if (!isValidId(req.params.messageId)) return res.status(400).json({ success: false, message: "Invalid message." });
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, message: "Message not found." });
    const conversation = await assertParticipant(message.conversation, req.user._id);
    if (!conversation) return res.status(403).json({ success: false, message: "You are not part of this conversation." });
    await Message.updateOne({ _id: message._id }, { $addToSet: { deletedFor: req.user._id, readBy: req.user._id } });
    res.status(200).json({ success: true, data: { messageId: String(message._id), conversationId: String(conversation._id) } });
  } catch (error) {
    next(error);
  }
};

// Clear chat: remove every current message from the caller's view. The other person keeps their copy.
const clearConversation = async (req, res, next) => {
  try {
    const access = await assertParticipant(req.params.id, req.user._id);
    if (access === null) return res.status(404).json({ success: false, message: "Conversation not found." });
    if (access === false) return res.status(403).json({ success: false, message: "You are not part of this conversation." });
    await Message.updateMany(
      { conversation: req.params.id },
      { $addToSet: { deletedFor: req.user._id, readBy: req.user._id } }
    );
    try {
      getIO().to(`user:${String(req.user._id)}`).emit("chatCleared", { conversationId: String(req.params.id) });
    } catch { /* socket unavailable */ }
    res.status(200).json({ success: true, data: { conversationId: String(req.params.id) } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  unsendMessage,
  hideMessage,
  clearConversation,
  getOrCreateSupportConversation,
  createConversation,
  getMyConversations,
  getMessages,
  markConversationRead,
  getUnreadSummary,
  getPresence,
};
