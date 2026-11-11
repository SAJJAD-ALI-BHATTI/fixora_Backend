const cors = require("cors");
const app = require("../app");
const connectDB = require("../config/db");
const { isAllowedOrigin } = require("../utils/allowedOrigins");

let dbPromise;

// Runs before anything can fail, so even error responses (e.g. database down) carry CORS headers
// and the browser shows the real message instead of a misleading "CORS policy" error.
const corsMiddleware = cors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
});

module.exports = (req, res) =>
    corsMiddleware(req, res, async () => {
        // Preflight requests never need the database
        if (req.method === "OPTIONS") {
            res.statusCode = 204;
            return res.end();
        }

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
    });
