const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        type: {
            type: String,
            enum: [
                "bookingCreated",
                "bookingAccepted",
                "bookingRejected",
                "bookingCompleted",
                "taskCreated",
                "newOffer",
                "counterOffer",
                "counterOfferAccepted",
                "counterOfferRejected",
                "offerAccepted",
                "offerRejected",
                "taskAssigned",
                "taskStarted",
                "taskCompleted",
                "reviewReceived",
                "accountApproved",
                "accountRejected",
                "system"
            ],
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        message: {
            type: String,
            required: true,
            trim: true
        },

        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        isRead: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Notification",
    notificationSchema
);