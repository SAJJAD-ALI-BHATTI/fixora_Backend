const mongoose = require("mongoose");

const messageSchema =
    new mongoose.Schema(
        {
            conversation: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: "Conversation",
                required: true,
                index: true
            },

            sender: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },

            text: {
                type: String,
                default: ""
            },

            type: {
                type: String,
                enum: [
                    "text",
                    "image",
                    "file"
                ],
                default: "text"
            },

            attachments: [
                {
                    url: String,
                    fileId: String,
                    name: String,
                    size: Number
                }
            ],

            readBy: [
                {
                    type:
                        mongoose.Schema.Types.ObjectId,
                    ref: "User"
                }
            ],

            edited: {
                type: Boolean,
                default: false
            },

            deleted: {
                type: Boolean,
                default: false
            }
        },
        {
            timestamps: true
        }
    );

messageSchema.index({
    conversation: 1,
    createdAt: -1
});

module.exports = mongoose.model(
    "Message",
    messageSchema
);