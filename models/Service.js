const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
    {
        vendor: {
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

        price: {
            type: Number,
            required: true,
            min: 0
        },

        duration: {
            type: String,
            required: true,
            trim: true
        },

        images: {
            type: [String],
            default: []
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
            },
            
        },

        availability: {
            type: Boolean,
            default: true
        },

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },

        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        }
    },
    {
        timestamps: true
    }
);
serviceSchema.index({
    location: "2dsphere"
});

module.exports = mongoose.model("Service", serviceSchema);