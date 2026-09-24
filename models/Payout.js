const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        amount: {
            type: Number,
            required: true,
            min: 1
        },

        currency: {
            type: String,
            default: "PKR",
            uppercase: true
        },

        method: {
            type: String,
            enum: [
                "bankTransfer",
                "jazzcash",
                "easypaisa"
            ],
            required: true
        },

        accountName: {
            type: String,
            required: true,
            trim: true
        },

        accountNumber: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: [
                "pending",
                "processing",
                "completed",
                "failed",
                "cancelled"
            ],
            default: "pending"
        },

        reference: {
            type: String,
            unique: true,
            required: true
        },

        adminNote: {
            type: String,
            default: ""
        },

        processedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

payoutSchema.index({
    user: 1,
    createdAt: -1
});

module.exports = mongoose.model(
    "Payout",
    payoutSchema
);