const app = require("../app");
const connectDB = require("../config/db");

let dbPromise;

module.exports = async (req, res) => {
    if (!dbPromise) {
        dbPromise = connectDB();
    }

    try {
        await dbPromise;
        return app(req, res);
    } catch (error) {
        dbPromise = null;
        console.error("Database connection failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
};
