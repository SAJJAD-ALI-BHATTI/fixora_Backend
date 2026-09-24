const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        vendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        taskRunner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            default: null
        },

        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            default: null
        },

        service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            default: null
        },

        type: {
            type: String,
            enum: [
                "bookingPayment",
                "taskPayment",
                "walletTopUp",
                "refund",
                "payout"
            ],
            required: true
        },

        amount: { type: Number, required: true, min: 0 },

        platformCommission: { type: Number, default: 0, min: 0 },

        providerAmount: { type: Number, default: 0, min: 0 },

        currency: {
            type: String,
            default: "PKR",
            uppercase: true
        },

        paymentMethod: {
            type: String,
            enum: [
                "cash",
                "card",
                "jazzcash",
                "easypaisa",
                "bankTransfer",
                "wallet",
                "adminCredit"
            ],
            required: true
        },

        status: {
            type: String,
            enum: [
                "pending",
                "processing",
                "paid",
                "failed",
                "refunded",
                "cancelled"
            ],
            default: "pending"
        },

        provider: {
            type: String,
            default: null
        },

        providerTransactionId: {
            type: String,
            default: null,
            index: true
        },

        reference: {
            type: String,
            unique: true,
            required: true
        },

        description: {
            type: String,
            default: ""
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        paidAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

transactionSchema.index({
    customer: 1,
    createdAt: -1
});

transactionSchema.index({
    vendor: 1,
    createdAt: -1
});

transactionSchema.index({
    taskRunner: 1,
    createdAt: -1
});

transactionSchema.index({
    booking: 1
});

transactionSchema.index({
    task: 1
});

module.exports = mongoose.model(
    "Transaction",
    transactionSchema
);