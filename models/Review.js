const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
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

        service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            default: null
        },

        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            default: null
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            default: null
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },

        comment: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000
        }
    },
    {
        timestamps: true
    }
);

reviewSchema.index(
    {
        customer: 1,
        booking: 1
    },
    {
        unique: true,
        sparse: true
    }
);

reviewSchema.index(
    {
        customer: 1,
        task: 1
    },
    {
        unique: true,
        sparse: true
    }
);

module.exports = mongoose.model("Review", reviewSchema);