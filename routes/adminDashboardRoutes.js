const express = require("express");

const {
    getDashboardOverview,
    getAnalytics,
    getPlatformRevenue,
    getMonthlyRevenue,
    getUserStatistics,
    getBookingStatistics,
    getTaskStatistics,
    getRecentTransactions,
    getRecentUsers,
    getRecentBookings,
    getRecentTasks
} = require(
    "../controllers/adminDashboardController"
);

const { getReportData, downloadReportPdf, categories, previewReport, generateReport } = require("../controllers/adminReportController");

const {
    authenticateUser
} = require(
    "../middleware/authMiddleware"
);

const {
    requireRole
} = require(
    "../middleware/roleMiddleware"
);

const router = express.Router();


// ==========================================
// ADMIN AUTH
// ==========================================

router.use(
    authenticateUser
);

router.use(
    requireRole("admin")
);


// ==========================================
// DASHBOARD
// ==========================================

router.get(
    "/overview",
    getDashboardOverview
);

router.get("/analytics", getAnalytics);
router.get("/reports", getReportData);
router.get("/reports/pdf", downloadReportPdf);
router.get("/reports/categories", categories);
router.post("/reports/preview", previewReport);
router.post("/reports/generate", generateReport);


// ==========================================
// REVENUE
// ==========================================

router.get(
    "/revenue",
    getPlatformRevenue
);

router.get(
    "/revenue/monthly",
    getMonthlyRevenue
);


// ==========================================
// STATISTICS
// ==========================================

router.get(
    "/users/statistics",
    getUserStatistics
);

router.get(
    "/bookings/statistics",
    getBookingStatistics
);

router.get(
    "/tasks/statistics",
    getTaskStatistics
);


// ==========================================
// RECENT DATA
// ==========================================

router.get(
    "/transactions/recent",
    getRecentTransactions
);

router.get(
    "/users/recent",
    getRecentUsers
);

router.get(
    "/bookings/recent",
    getRecentBookings
);

router.get(
    "/tasks/recent",
    getRecentTasks
);


module.exports = router;