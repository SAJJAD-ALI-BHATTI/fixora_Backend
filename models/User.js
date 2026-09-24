const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        phone: {
            type: String,
            trim: true
        },

        password: {
            type: String,
            required: true,
            minlength: 8,
            maxlength: 72
        },

        role: {
            type: String,
            enum: ["customer", "vendor", "taskRunner", "admin"],
            default: "customer"
        },

        profileImage: {
            type: String,
            default: ""
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

        passwordResetToken: {
            type: String,
            default: null,
            select: false
        },

        passwordResetExpires: {
            type: Date,
            default: null,
            select: false
        },

        status: {
            type: String,
            enum: ["active", "pending", "approved", "rejected", "suspended"],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);
userSchema.index({
    location: "2dsphere"
});
module.exports = mongoose.model("User", userSchema);