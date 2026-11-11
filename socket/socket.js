const {
    Server
} = require("socket.io");

const jwt = require("jsonwebtoken");

const Message =
    require("../models/Message");

const Conversation =
    require("../models/Conversation");

const User = require("../models/User");


let io;

const connectedUsers = new Map();


// ==========================================
// INITIALIZE SOCKET
// ==========================================

const initializeSocket = (httpServer) => {

    io = new Server(httpServer, {
        cors: {
            origin: (origin, cb) => cb(null, require("../utils/allowedOrigins").isAllowedOrigin(origin)),

            methods: [
                "GET",
                "POST",
                "PATCH",
                "DELETE"
            ]
        }
    });


    // ======================================
    // SOCKET AUTHENTICATION
    // ======================================

    io.use((socket, next) => {
        try {

            const token =
                socket.handshake.auth?.token;

            if (!token) {
                return next(
                    new Error(
                        "Authentication required"
                    )
                );
            }


            const decoded =
                jwt.verify(
                    token,
                    process.env.JWT_SECRET
                );


            const authenticatedUserId =
                decoded.userId ||
                decoded.id ||
                decoded._id;

            if (!authenticatedUserId) {
                return next(
                    new Error(
                        "Invalid authentication token: user id missing"
                    )
                );
            }

            socket.userId =
                authenticatedUserId;

            User.findById(authenticatedUserId).select("role status").lean()
                .then((user) => {
                    if (!user || user.status === "suspended") return next(new Error("Account unavailable"));
                    socket.userRole = user.role;
                    next();
                })
                .catch(() => next(new Error("Authentication lookup failed")));

        } catch (error) {

            next(
                new Error(
                    "Invalid authentication token"
                )
            );
        }
    });


    // ======================================
    // CONNECTION
    // ======================================

    io.on(
        "connection",
        (socket) => {

            if (!socket.userId) {
                socket.disconnect(true);
                return;
            }

            const userId =
                socket.userId.toString();


            // ------------------------------
            // USER ROOM
            // ------------------------------

            socket.join(
                `user:${userId}`
            );


            if (!connectedUsers.has(userId)) {
                connectedUsers.set(userId, new Set());
            }
            connectedUsers.get(userId).add(socket.id);


            // ------------------------------
            // ONLINE STATUS
            // ------------------------------

            io.emit(
                "userOnline",
                {
                    userId
                }
            );


            // ==================================
            // JOIN CHAT
            // ==================================

            socket.on(
                "joinConversation",
                async (conversationId) => {
                    try {
                        if (!conversationId) return;
                        const conversation = await Conversation.findById(conversationId).select("participants");
                        if (!conversation) return;
                        const allowed = conversation.participants.some(
                            (participant) => participant.toString() === userId
                        );
                        if (!allowed) {
                            socket.emit("chatError", { message: "You are not part of this conversation" });
                            return;
                        }
                        socket.join(`conversation:${conversationId}`);
                    } catch (error) {
                        socket.emit("chatError", { message: "Unable to join conversation" });
                    }
                }
            );


            // ==================================
            // LEAVE CHAT
            // ==================================

            socket.on(
                "leaveConversation",
                (
                    conversationId
                ) => {

                    socket.leave(
                        `conversation:${conversationId}`
                    );
                }
            );


            // ==================================
            // SEND MESSAGE
            // ==================================

            socket.on(
                "sendMessage",
                async (data) => {

                    try {

                        let {
                            conversationId,
                            text = "",
                            type = "text",
                            attachments = []
                        } = data || {};

                        // Sanitise client input
                        text = typeof text === "string" ? text.slice(0, 4000) : "";
                        type = ["text", "image", "file"].includes(type) ? type : "text";
                        attachments = (Array.isArray(attachments) ? attachments : [])
                            .filter((a) => a && typeof a.url === "string" && /^https?:\/\//i.test(a.url))
                            .slice(0, 5)
                            .map((a) => ({
                                url: a.url,
                                fileId: typeof a.fileId === "string" ? a.fileId : undefined,
                                name: typeof a.name === "string" ? a.name.slice(0, 200) : undefined,
                                size: Number(a.size) || undefined
                            }));


                        if (!conversationId) {
                            return;
                        }


                        // --------------------------
                        // CHECK CONVERSATION
                        // --------------------------

                        const conversation =
                            await Conversation.findById(
                                conversationId
                            );


                        if (!conversation) {

                            socket.emit(
                                "chatError",
                                {
                                    message:
                                        "Conversation not found"
                                }
                            );

                            return;
                        }


                        // --------------------------
                        // CHECK PARTICIPANT
                        // --------------------------

                        const isParticipant =
                            conversation
                                .participants
                                .some(
                                    (participant) =>
                                        participant
                                            .toString() ===
                                        userId
                                );

                        if (!isParticipant) {
                            socket.emit("chatError", {
                                message: "You are not part of this conversation"
                            });
                            return;
                        }


                        // --------------------------
                        // VALIDATE MESSAGE
                        // --------------------------

                        if (
                            !text.trim() &&
                            attachments.length === 0
                        ) {
                            return;
                        }


                        // --------------------------
                        // CREATE MESSAGE
                        // --------------------------

                        const message =
                            await Message.create({
                                conversation:
                                    conversationId,

                                sender:
                                    userId,

                                text:
                                    text.trim(),

                                type,

                                attachments,

                                readBy: [
                                    userId
                                ]
                            });


                        // --------------------------
                        // UPDATE CONVERSATION
                        // --------------------------

                        conversation.lastMessage =
                            message._id;

                        conversation.lastMessageAt =
                            new Date();

                        await conversation.save();


                        // --------------------------
                        // POPULATE MESSAGE
                        // --------------------------

                        const populatedMessage =
                            await Message
                                .findById(
                                    message._id
                                )
                                .populate(
                                    "sender",
                                    "name profileImage"
                                );


                        // --------------------------
                        // SEND TO CHAT ROOM
                        // --------------------------

                        const payload = populatedMessage.toObject
                            ? populatedMessage.toObject()
                            : populatedMessage;
                        payload.conversationId = conversationId;

                        io.to(`conversation:${conversationId}`).emit("newMessage", payload);

                        conversation.participants.forEach((participant) => {
                            const participantId = participant.toString();
                            io.to(`user:${participantId}`).emit("newChatMessage", {
                                conversationId,
                                message: payload,
                            });
                        });

                    } catch (error) {

                        console.error(
                            "Send message error:",
                            error
                        );

                        socket.emit(
                            "chatError",
                            {
                                message:
                                    "Failed to send message"
                            }
                        );
                    }
                }
            );


            // ==================================
            // TYPING START
            // ==================================

            socket.on("typingStart", async (conversationId) => {
                if (!conversationId) return;
                socket.to(`conversation:${conversationId}`).emit("userTyping", {
                    userId,
                    conversationId,
                });
            });

            socket.on("typingStop", async (conversationId) => {
                if (!conversationId) return;
                socket.to(`conversation:${conversationId}`).emit("userStoppedTyping", {
                    userId,
                    conversationId,
                });
            });

            socket.on("readConversation", async (conversationId) => {
                try {
                    if (!conversationId) return;
                    const conversation = await Conversation.findById(conversationId).select("participants");
                    if (!conversation) return;
                    const allowed = conversation.participants.some(
                        (participant) => participant.toString() === userId
                    );
                    if (!allowed) return;
                    await Message.updateMany(
                        { conversation: conversationId, sender: { $ne: userId } },
                        { $addToSet: { readBy: userId } }
                    );
                    io.to(`conversation:${conversationId}`).emit("conversationRead", {
                        conversationId,
                        userId,
                    });
                } catch (error) {
                    console.error("Read conversation error:", error);
                }
            });


            // ==================================
            // READ MESSAGE
            // ==================================

            socket.on(
                "readMessage",
                async (
                    messageId
                ) => {

                    try {

                        const message =
                            await Message.findById(
                                messageId
                            );


                        if (!message) {
                            return;
                        }


                        const conversation =
                            await Conversation
                                .findById(
                                    message
                                        .conversation
                                );


                        if (!conversation) {
                            return;
                        }


                        const isParticipant =
                            conversation
                                .participants
                                .some(
                                    (participant) =>
                                        participant
                                            .toString() ===
                                        userId
                                );

                        if (!isParticipant) {
                            return;
                        }


                        await Message.findByIdAndUpdate(
                            messageId,
                            {
                                $addToSet: {
                                    readBy:
                                        userId
                                }
                            }
                        );


                        io.to(
                            `conversation:${message.conversation}`
                        ).emit(
                            "messageRead",
                            {
                                messageId,
                                userId
                            }
                        );

                    } catch (error) {

                        console.error(
                            "Read message error:",
                            error
                        );
                    }
                }
            );


            // ==================================
            // DISCONNECT
            // ==================================

            socket.on(
                "disconnect",
                () => {

                    const sockets = connectedUsers.get(userId);
                    if (sockets) {
                        sockets.delete(socket.id);
                        if (sockets.size === 0) {
                            connectedUsers.delete(userId);
                            io.emit("userOffline", { userId });
                        }
                    }
                }
            );
        }
    );


    return io;
};


// ==========================================
// GET IO
// ==========================================

const getIO = () => {

    if (!io) {
        throw new Error(
            "Socket.IO has not been initialized"
        );
    }

    return io;
};


// ==========================================
// EMIT TO USER
// ==========================================

const emitToUser = (
    userId,
    event,
    data
) => {

    getIO()
        .to(
            `user:${userId.toString()}`
        )
        .emit(
            event,
            data
        );
};


// ==========================================
// CHECK ONLINE USER
// ==========================================

const isUserOnline = (userId) => {
    const sockets = connectedUsers.get(userId.toString());
    return Boolean(sockets && sockets.size);
};

const getOnlineUserIds = () => Array.from(connectedUsers.keys());


module.exports = {
    initializeSocket,
    getIO,
    emitToUser,
    isUserOnline,
    getOnlineUserIds
};