const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
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
        }
    },
    {
        timestamps: true
    }
);


// A user cannot favorite the same service twice
favoriteSchema.index(
    { user: 1, service: 1 },
    {
        unique: true,
        partialFilterExpression: {
            service: {
                $exists: true,
                $ne: null
            }
        }
    }
);


// A user cannot favorite the same task twice
favoriteSchema.index(
    { user: 1, task: 1 },
    {
        unique: true,
        partialFilterExpression: {
            task: {
                $exists: true,
                $ne: null
            }
        }
    }
);


module.exports = mongoose.model(
    "Favorite",
    favoriteSchema
);