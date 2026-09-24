const mongoose = require("mongoose");

const conversationSchema =
    new mongoose.Schema(
        {
            participants: [
                {
                    type:
                        mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true
                }
            ],

            isGroup: {
                type: Boolean,
                default: false
            },

            groupName: {
                type: String,
                default: ""
            },

            groupImage: {
                type: String,
                default: ""
            },

            lastMessage: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: "Message",
                default: null
            },

            lastMessageAt: {
                type: Date,
                default: Date.now
            }
        },
        {
            timestamps: true
        }
    );

conversationSchema.index({
    participants: 1
});

conversationSchema.index({
    lastMessageAt: -1
});

module.exports = mongoose.model(
    "Conversation",
    conversationSchema
);