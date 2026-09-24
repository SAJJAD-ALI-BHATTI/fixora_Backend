const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        budget: {
            type: Number,
            required: true,
            min: 0
        },

        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point"
            },

            coordinates: {
                type: [Number],
                default: [0, 0]
            },

            address: {
                type: String,
                default: ""
            }
        },

        preferredDate: {
            type: Date,
            required: true
        },

        preferredTime: {
            type: String,
            required: true
        },

        images: {
            type: [String],
            default: []
        },

        status: {
            type: String,
            enum: [
                "open",
                "assigned",
                "inProgress",
                "completed",
                "cancelled"
            ],
            default: "open"
        },

        assignedRunner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        agreedAmount: {
            type: Number,
            default: 0,
            min: 0
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

taskSchema.index({
    location: "2dsphere"
});

module.exports = mongoose.model("Task", taskSchema);