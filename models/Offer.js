const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
    {
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true
        },

        runner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        message: {
            type: String,
            default: "",
            trim: true
        },

        estimatedTime: {
            type: String,
            default: "",
            trim: true
        },

        status: {
            type: String,
            enum: [
                "pending",
                "countered",
                "accepted",
                "rejected",
                "withdrawn"
            ],
            default: "pending"
        },

        counterOffers: [{
            amount: {
                type: Number,
                required: true,
                min: 0
            },
            message: {
                type: String,
                default: "",
                trim: true
            },
            estimatedTime: {
                type: String,
                default: "",
                trim: true
            },
            by: {
                type: String,
                enum: ["customer", "taskRunner"],
                required: true
            },
            status: {
                type: String,
                enum: ["pending", "accepted", "rejected"],
                default: "pending"
            }
        }]
    },
    {
        timestamps: true
    }
);

offerSchema.index(
    {
        task: 1,
        runner: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model("Offer", offerSchema);