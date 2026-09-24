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
            origin:
                process.env.CLIENT_URL ||
                "http://localhost:5173",

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


            connectedUsers.set(
                userId,
                socket.id
            );


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
                (
                    conversationId
                ) => {

                    socket.join(
                        `conversation:${conversationId}`
                    );
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

                        const {
                            conversationId,
                            text = "",
                            type = "text",
                            attachments = []
                        } = data;


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

                        const isAdmin = socket.userRole === "admin";

                        if (!isParticipant && !isAdmin) {

                            socket.emit(
                                "chatError",
                                {
                                    message:
                                        "You are not part of this conversation"
                                }
                            );

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

                        io.to(
                            `conversation:${conversationId}`
                        ).emit(
                            "newMessage",
                            populatedMessage
                        );


                        // --------------------------
                        // NOTIFY OTHER USERS
                        // --------------------------

                        conversation
                            .participants
                            .forEach(
                                (participant) => {

                                    const participantId =
                                        participant
                                            .toString();


                                    if (
                                        participantId !==
                                        userId
                                    ) {

                                        io.to(
                                            `user:${participantId}`
                                        ).emit(
                                            "newChatMessage",
                                            {
                                                conversationId,
                                                message:
                                                    populatedMessage
                                            }
                                        );
                                    }
                                }
                            );

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

            socket.on(
                "typingStart",
                (
                    conversationId
                ) => {

                    socket.to(
                        `conversation:${conversationId}`
                    ).emit(
                        "userTyping",
                        {
                            userId,
                            conversationId
                        }
                    );
                }
            );


            // ==================================
            // TYPING STOP
            // ==================================

            socket.on(
                "typingStop",
                (
                    conversationId
                ) => {

                    socket.to(
                        `conversation:${conversationId}`
                    ).emit(
                        "userStoppedTyping",
                        {
                            userId,
                            conversationId
                        }
                    );
                }
            );


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

                        const isAdmin = socket.userRole === "admin";

                        if (!isParticipant && !isAdmin) {
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

                    if (
                        connectedUsers.get(
                            userId
                        ) === socket.id
                    ) {

                        connectedUsers.delete(
                            userId
                        );


                        io.emit(
                            "userOffline",
                            {
                                userId
                            }
                        );
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

const isUserOnline = (
    userId
) => {

    return connectedUsers.has(
        userId.toString()
    );
};

const getOnlineUserIds = () => Array.from(connectedUsers.keys());


module.exports = {
    initializeSocket,
    getIO,
    emitToUser,
    isUserOnline,
    getOnlineUserIds
};