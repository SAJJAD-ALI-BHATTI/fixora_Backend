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
        },

        // KYC / approval workflow (vendors and task runners only)
        verification: {
            state: {
                type: String,
                enum: ["not_required", "pending", "info_requested", "approved", "rejected"],
                default: "not_required"
            },
            submittedAt: { type: Date, default: null },
            resubmittedAt: { type: Date, default: null },
            reviewedAt: { type: Date, default: null },
            reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            reviewNote: { type: String, default: "" },
            infoRequest: {
                message: { type: String, default: "" },
                requestedAt: { type: Date, default: null }
            },
            history: {
                type: [
                    new mongoose.Schema({
                        action: String,
                        note: { type: String, default: "" },
                        by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
                        at: { type: Date, default: Date.now }
                    }, { _id: false })
                ],
                default: [],
                select: false
            },
            // CNIC images are private files; never returned unless explicitly selected
            documents: {
                type: new mongoose.Schema({
                    cnicFront: { url: String, fileId: String },
                    cnicBack: { url: String, fileId: String },
                    profileImage: { url: String, fileId: String }
                }, { _id: false }),
                select: false
            }
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