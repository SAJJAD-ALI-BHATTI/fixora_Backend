const express = require("express");
const cors = require("cors");

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
const userRoutes =
    require("./routes/userRoutes");



const {
    notFound,
    errorHandler
} = require("./middleware/errorMiddleware");

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "https://fixora-frontend-ch0b5gk4g-devs-learners.vercel.app",
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    })
);

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to the Fixora API"
    });
});

app.use("/api/test", testRoutes);

app.use("/api/auth", authRoutes);

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
app.use(notFound);

app.use(errorHandler);

module.exports = app;