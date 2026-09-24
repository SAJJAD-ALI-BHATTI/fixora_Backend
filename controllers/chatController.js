const Conversation =
    require("../models/Conversation");

const Message =
    require("../models/Message");


// CREATE CONVERSATION

const createConversation =
    async (
        req,
        res,
        next
    ) => {
        try {

            const {
                participantId
            } = req.body;

            let conversation =
                await Conversation.findOne({
                    participants: {
                        $all: [
                            req.user._id,
                            participantId
                        ]
                    },
                    isGroup: false
                });

            if (!conversation) {
                conversation =
                    await Conversation.create({
                        participants: [
                            req.user._id,
                            participantId
                        ]
                    });
            }

            res.status(200).json({
                success: true,
                data: {
                    conversation
                }
            });

        } catch (error) {
            next(error);
        }
    };


// GET MY CONVERSATIONS

const getMyConversations =
    async (
        req,
        res,
        next
    ) => {
        try {

            const conversations =
                await Conversation.find({
                    participants:
                        req.user._id
                })
                    .populate(
                        "participants",
                        "name profileImage"
                    )
                    .populate(
                        "lastMessage"
                    )
                    .sort({
                        lastMessageAt: -1
                    });

            res.status(200).json({
                success: true,
                data: {
                    conversations
                }
            });

        } catch (error) {
            next(error);
        }
    };


// GET MESSAGES

const getMessages =
    async (
        req,
        res,
        next
    ) => {
        try {

            const messages =
                await Message.find({
                    conversation:
                        req.params.id
                })
                    .populate(
                        "sender",
                        "name profileImage"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .limit(50);

            res.status(200).json({
                success: true,
                data: {
                    messages:
                        messages.reverse()
                }
            });

        } catch (error) {
            next(error);
        }
    };

module.exports = {
    createConversation,
    getMyConversations,
    getMessages
};