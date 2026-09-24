const User = require("../models/User");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Task = require("../models/Task");
const Offer = require("../models/Offer");
const Transaction = require("../models/Transaction");
const Payout = require("../models/Payout");
const { getPlatformCommissionPercent } = require("../config/payment");


// ==========================================
// DASHBOARD OVERVIEW
// ==========================================

const getDashboardOverview = async (
    req,
    res,
    next
) => {
    try {
        const [
            totalUsers,
            totalVendors,
            totalTaskRunners,
            totalCustomers,
            totalServices,
            totalBookings,
            totalTasks,
            totalOffers,
            pendingPayouts
        ] = await Promise.all([
            User.countDocuments(),

            User.countDocuments({
                role: "vendor"
            }),

            User.countDocuments({
                role: "taskRunner"
            }),

            User.countDocuments({
                role: "customer"
            }),

            Service.countDocuments(),

            Booking.countDocuments(),

            Task.countDocuments(),

            Offer.countDocuments(),

            Payout.countDocuments({
                status: {
                    $in: [
                        "pending",
                        "processing"
                    ]
                }
            })
        ]);


        // --------------------------------------
        // TRANSACTION STATS
        // --------------------------------------

        const transactionStats =
            await Transaction.aggregate([
                {
                    $group: {
                        _id: "$status",
                        amount: {
                            $sum: "$amount"
                        },
                        count: {
                            $sum: 1
                        }
                    }
                }
            ]);


        const payments = {
            pending: {
                count: 0,
                amount: 0
            },

            processing: {
                count: 0,
                amount: 0
            },

            paid: {
                count: 0,
                amount: 0
            },

            failed: {
                count: 0,
                amount: 0
            },

            refunded: {
                count: 0,
                amount: 0
            }
        };


        transactionStats.forEach(
            (item) => {
                if (payments[item._id]) {
                    payments[item._id] = {
                        count: item.count,
                        amount: item.amount
                    };
                }
            }
        );


        res.status(200).json({
            success: true,

            data: {
                users: {
                    total: totalUsers,
                    customers: totalCustomers,
                    vendors: totalVendors,
                    taskRunners:
                        totalTaskRunners
                },

                marketplace: {
                    services:
                        totalServices,
                    bookings:
                        totalBookings,
                    tasks:
                        totalTasks,
                    offers:
                        totalOffers
                },

                payments,

                payouts: {
                    pending:
                        pendingPayouts
                }
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// PLATFORM REVENUE
// ==========================================

const getPlatformRevenue = async (
    req,
    res,
    next
) => {
    try {

        const revenue =
            await Transaction.aggregate([
                {
                    $match: {
                        status: "paid"
                    }
                },

                {
                    $group: {
                        _id: null,

                        totalPayments: { $sum: "$amount" },

                        platformCommission: {
                            $sum: {
                                $ifNull: ["$platformCommission", 0]
                            }
                        },

                        transactionCount: { $sum: 1 }
                    }
                }
            ]);


        const totalPayments =
            revenue.length > 0
                ? revenue[0].totalPayments
                : 0;

        const transactionCount =
            revenue.length > 0
                ? revenue[0].transactionCount
                : 0;


        const commissionPercent = await getPlatformCommissionPercent();


        const recordedCommission =
            revenue.length > 0
                ? Number(revenue[0].platformCommission || 0)
                : 0;

        const platformCommission = recordedCommission > 0
            ? recordedCommission
            : Number((totalPayments * commissionPercent / 100).toFixed(2));


        const providerEarnings =
            Number(
                (
                    totalPayments -
                    platformCommission
                ).toFixed(2)
            );


        res.status(200).json({
            success: true,

            data: {
                totalPayments,
                transactionCount,
                commissionPercent,
                platformCommission,
                providerEarnings
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// REVENUE BY MONTH
// ==========================================

const getMonthlyRevenue = async (
    req,
    res,
    next
) => {
    try {

        const year =
            Number(
                req.query.year ||
                new Date().getFullYear()
            );


        const monthlyRevenue =
            await Transaction.aggregate([
                {
                    $match: {
                        status: "paid",

                        paidAt: {
                            $gte:
                                new Date(
                                    `${year}-01-01`
                                ),

                            $lt:
                                new Date(
                                    `${year + 1}-01-01`
                                )
                        }
                    }
                },

                {
                    $group: {
                        _id: {
                            month: {
                                $month:
                                    "$paidAt"
                            }
                        },

                        total: {
                            $sum: "$amount"
                        },

                        transactions: {
                            $sum: 1
                        }
                    }
                },

                {
                    $sort: {
                        "_id.month": 1
                    }
                }
            ]);


        const result = Array.from(
            {
                length: 12
            },
            (_, index) => ({
                month:
                    index + 1,
                total: 0,
                transactions: 0
            })
        );


        monthlyRevenue.forEach(
            (item) => {
                const index =
                    item._id.month - 1;

                result[index].total =
                    item.total;

                result[index].transactions =
                    item.transactions;
            }
        );


        res.status(200).json({
            success: true,

            data: {
                year,
                revenue: result
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// USER STATISTICS
// ==========================================

const getUserStatistics = async (
    req,
    res,
    next
) => {
    try {

        const statistics =
            await User.aggregate([
                {
                    $group: {
                        _id: "$role",
                        count: {
                            $sum: 1
                        }
                    }
                }
            ]);


        const statusStatistics =
            await User.aggregate([
                {
                    $group: {
                        _id: "$status",
                        count: {
                            $sum: 1
                        }
                    }
                }
            ]);


        res.status(200).json({
            success: true,

            data: {
                byRole:
                    statistics,

                byStatus:
                    statusStatistics
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// BOOKING STATISTICS
// ==========================================

const getBookingStatistics = async (
    req,
    res,
    next
) => {
    try {

        const statistics =
            await Booking.aggregate([
                {
                    $group: {
                        _id: "$status",
                        count: {
                            $sum: 1
                        }
                    }
                }
            ]);


        res.status(200).json({
            success: true,

            data: {
                statistics
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// TASK STATISTICS
// ==========================================

const getTaskStatistics = async (
    req,
    res,
    next
) => {
    try {

        const statistics =
            await Task.aggregate([
                {
                    $group: {
                        _id: "$status",
                        count: {
                            $sum: 1
                        }
                    }
                }
            ]);


        res.status(200).json({
            success: true,

            data: {
                statistics
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// RECENT TRANSACTIONS
// ==========================================

const getRecentTransactions = async (
    req,
    res,
    next
) => {
    try {

        const limit =
            Math.min(
                Number(
                    req.query.limit || 10
                ),
                50
            );


        const transactions =
            await Transaction.find()
                .populate(
                    "customer",
                    "name email"
                )
                .populate(
                    "vendor",
                    "name email"
                )
                .populate(
                    "taskRunner",
                    "name email"
                )
                .sort({
                    createdAt: -1
                })
                .limit(limit);


        res.status(200).json({
            success: true,

            data: {
                transactions
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// RECENT USERS
// ==========================================

const getRecentUsers = async (
    req,
    res,
    next
) => {
    try {

        const limit =
            Math.min(
                Number(
                    req.query.limit || 10
                ),
                50
            );


        const users =
            await User.find()
                .select(
                    "name email role status profileImage createdAt"
                )
                .sort({
                    createdAt: -1
                })
                .limit(limit);


        res.status(200).json({
            success: true,

            data: {
                users
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// RECENT BOOKINGS
// ==========================================

const getRecentBookings = async (
    req,
    res,
    next
) => {
    try {

        const limit =
            Math.min(
                Number(
                    req.query.limit || 10
                ),
                50
            );


        const bookings =
            await Booking.find()
                .populate(
                    "customer",
                    "name email"
                )
                .populate(
                    "vendor",
                    "name email"
                )
                .populate(
                    "service",
                    "title category"
                )
                .sort({
                    createdAt: -1
                })
                .limit(limit);


        res.status(200).json({
            success: true,

            data: {
                bookings
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// RECENT TASKS
// ==========================================

const getRecentTasks = async (
    req,
    res,
    next
) => {
    try {

        const limit =
            Math.min(
                Number(
                    req.query.limit || 10
                ),
                50
            );


        const tasks =
            await Task.find()
                .populate(
                    "customer",
                    "name email"
                )
                .populate(
                    "assignedRunner",
                    "name email"
                )
                .sort({
                    createdAt: -1
                })
                .limit(limit);


        res.status(200).json({
            success: true,

            data: {
                tasks
            }
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    getDashboardOverview,
    getPlatformRevenue,
    getMonthlyRevenue,
    getUserStatistics,
    getBookingStatistics,
    getTaskStatistics,
    getRecentTransactions,
    getRecentUsers,
    getRecentBookings,
    getRecentTasks
};