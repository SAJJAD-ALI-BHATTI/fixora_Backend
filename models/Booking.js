const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        vendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true
        },

        date: {
            type: Date,
            required: true
        },

        time: {
            type: String,
            required: true
        },

        location: {
            type: String,
            required: true,
            trim: true
        },

        additionalInstructions: {
            type: String,
            default: "",
            trim: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            enum: [
                "pending",
                "accepted",
                "rejected",
                "inProgress",
                "completed",
                "cancelled"
            ],
            default: "pending"
        },

        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "failed", "refunded"],
            default: "pending"
        },

        paymentTransaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transaction",
            default: null
        },

        customerConfirmedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Booking", bookingSchema);