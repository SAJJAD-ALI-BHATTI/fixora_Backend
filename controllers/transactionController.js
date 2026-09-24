const Transaction =
    require("../models/Transaction");


// ==========================================
// GET MY TRANSACTIONS
// ==========================================

const getMyTransactions = async (
    req,
    res,
    next
) => {
    try {

        const transactions =
            await Transaction.find({
                customer: req.user._id
            })
                .populate(
                    "vendor",
                    "name profileImage"
                )
                .populate(
                    "taskRunner",
                    "name profileImage"
                )
                .populate(
                    "service",
                    "title category"
                )
                .populate(
                    "booking"
                )
                .populate(
                    "task",
                    "title category"
                )
                .sort({
                    createdAt: -1
                });

        res.status(200).json({
            success: true,
            data: {
                count:
                    transactions.length,
                transactions
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// GET PROVIDER TRANSACTIONS (VENDOR / RUNNER)
// ==========================================

const getProviderTransactions = async (req, res, next) => {
    try {
        const filter = req.user.role === "vendor"
            ? { vendor: req.user._id }
            : { taskRunner: req.user._id };

        const transactions = await Transaction.find(filter)
            .populate("customer", "name email profileImage")
            .populate("vendor", "name profileImage")
            .populate("taskRunner", "name profileImage")
            .populate("service", "title category")
            .populate("booking")
            .populate("task", "title category")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                count: transactions.length,
                transactions
            }
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// GET TRANSACTION BY ID
// ==========================================

const getTransactionById = async (
    req,
    res,
    next
) => {
    try {

        const transaction =
            await Transaction.findById(
                req.params.id
            )
                .populate(
                    "customer",
                    "name email phone"
                )
                .populate(
                    "vendor",
                    "name email phone"
                )
                .populate(
                    "taskRunner",
                    "name email phone"
                )
                .populate(
                    "service",
                    "title category"
                )
                .populate(
                    "booking"
                )
                .populate(
                    "task",
                    "title category"
                );

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message:
                    "Transaction not found"
            });
        }


        const userId =
            req.user._id.toString();

        const hasAccess =
            transaction.customer &&
            transaction.customer._id.toString() ===
            userId;

        const isVendor =
            transaction.vendor &&
            transaction.vendor._id.toString() ===
            userId;

        const isRunner =
            transaction.taskRunner &&
            transaction.taskRunner._id.toString() ===
            userId;

        if (
            !hasAccess &&
            !isVendor &&
            !isRunner &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You do not have access to this transaction"
            });
        }


        res.status(200).json({
            success: true,
            data: {
                transaction
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// GET TRANSACTION BY REFERENCE
// ==========================================

const getTransactionByReference =
    async (
        req,
        res,
        next
    ) => {
        try {

            const transaction =
                await Transaction.findOne({
                    reference:
                        req.params.reference
                });

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Transaction not found"
                });
            }

            if (
                transaction.customer.toString() !==
                req.user._id.toString() &&
                req.user.role !== "admin"
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You do not have access to this transaction"
                });
            }

            res.status(200).json({
                success: true,
                data: {
                    transaction
                }
            });

        } catch (error) {
            next(error);
        }
    };


// ==========================================
// TRANSACTION SUMMARY
// ==========================================

const getTransactionSummary = async (
    req,
    res,
    next
) => {
    try {

        const result =
            await Transaction.aggregate([
                {
                    $match: {
                        customer:
                            req.user._id
                    }
                },
                {
                    $group: {
                        _id: "$status",
                        total: {
                            $sum: "$amount"
                        },
                        count: {
                            $sum: 1
                        }
                    }
                }
            ]);

        const summary = {
            pending: {
                count: 0,
                total: 0
            },
            processing: {
                count: 0,
                total: 0
            },
            paid: {
                count: 0,
                total: 0
            },
            failed: {
                count: 0,
                total: 0
            },
            refunded: {
                count: 0,
                total: 0
            },
            cancelled: {
                count: 0,
                total: 0
            }
        };

        result.forEach((item) => {
            if (summary[item._id]) {
                summary[item._id] = {
                    count: item.count,
                    total: item.total
                };
            }
        });

        res.status(200).json({
            success: true,
            data: {
                summary
            }
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    getMyTransactions,
    getProviderTransactions,
    getTransactionById,
    getTransactionByReference,
    getTransactionSummary
};