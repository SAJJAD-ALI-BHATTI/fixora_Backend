const express = require("express");
const cors = require("cors");
const compression = require("compression");

const testRoutes = require("./routes/testRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const taskRoutes = require("./routes/taskRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const offerRoutes = require("./routes/offerRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require(
    "./routes/notificationRoutes"
);
const transactionRoutes =
    require("./routes/transactionRoutes");


const walletRoutes =
    require("./routes/walletRoutes");

const payoutRoutes =
    require("./routes/payoutRoutes");

const adminDashboardRoutes =
    require(
        "./routes/adminDashboardRoutes"
    );

const discoveryRoutes =
    require("./routes/discoveryRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminWalletRoutes = require("./routes/adminWalletRoutes");
const contactRoutes = require("./routes/contactRoutes");
const favoriteRoutes =
    require("./routes/favoriteRoutes");

const chatRoutes =
    require("./routes/chatRoutes");
const adminChatRoutes = require("./routes/adminChatRoutes");
const walletTopUpRoutes = require("./routes/walletTopUpRoutes");
const userRoutes =
    require("./routes/userRoutes");



const {
    notFound,
    errorHandler
} = require("./middleware/errorMiddleware");

const app = express();

const { isAllowedOrigin } = require("./utils/allowedOrigins");

app.use(
    cors({
        // Unknown origins simply get no CORS headers (the browser blocks them) instead of a server error.
        origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        maxAge: 86400,
    })
);

app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Cheap wins for repeated read-heavy marketplace endpoints
app.use("/api/discovery", (_req, res, next) => {
    res.set("Cache-Control", "public, max-age=20, stale-while-revalidate=40");
    next();
});

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to the Fixora API"
    });
});

app.use("/api/test", testRoutes);

app.use("/api/auth", authRoutes);

// Public report-authenticity lookup (no auth, rate limited)
const { verifyReport } = require("./controllers/adminReportController");
const { rateLimit } = require("./utils/rateLimit");
app.get("/api/verify/report/:id", rateLimit({ windowMs: 10 * 60 * 1000, max: 60, keyPrefix: "verify" }), verifyReport);

app.use("/api/admin", adminRoutes);

app.use("/api/users", userRoutes);

app.use("/api/services", serviceRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/tasks", taskRoutes);

app.use("/api/upload", uploadRoutes);

app.use("/api/offers", offerRoutes);
app.use("/api/reviews", reviewRoutes);
app.use(
    "/api/notifications",
    notificationRoutes
);
app.use(
    "/api/transactions",
    transactionRoutes
);
app.use(
    "/api/admin/dashboard",
    adminDashboardRoutes
);


app.use(
    "/api/wallet",
    walletRoutes
);

app.use("/api/payments", paymentRoutes);
app.use("/api/admin/wallets", adminWalletRoutes);
app.use("/api/contact", contactRoutes);

app.use(
    "/api/payouts",
    payoutRoutes
);


app.use(
    "/api/discovery",
    discoveryRoutes
);

app.use(
    "/api/favorites",
    favoriteRoutes
);

app.use(
    "/api/chat",
    chatRoutes
);
app.use("/api/admin/chat", adminChatRoutes);
app.use("/api/wallet-topups", walletTopUpRoutes);
app.use(notFound);

app.use(errorHandler);

module.exports = app;