const crypto = require("crypto");

const Payout =
    require("../models/Payout");

const {
    getOrCreateWallet,
    deductBalance
} = require("../utils/wallet");

const {
    createNotification
} = require("../utils/notification");


const generatePayoutReference = () => {
    return `PAY-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;
};


// ==========================================
// REQUEST PAYOUT
// ==========================================

const requestPayout = async (
    req,
    res,
    next
) => {
    try {
        const {
            amount,
            method,
            accountName,
            accountNumber
        } = req.body;

        if (
            !amount ||
            !method ||
            !accountName ||
            !accountNumber
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Amount, method, account name and account number are required"
            });
        }

        const payoutAmount =
            Number(amount);

        if (
            Number.isNaN(payoutAmount) ||
            payoutAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid payout amount"
            });
        }

        const wallet =
            await getOrCreateWallet(
                req.user._id
            );

        if (
            wallet.balance <
            payoutAmount
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Insufficient wallet balance"
            });
        }

        const activePayout =
            await Payout.findOne({
                user: req.user._id,
                status: {
                    $in: [
                        "pending",
                        "processing"
                    ]
                }
            });

        if (activePayout) {
            return res.status(409).json({
                success: false,
                message:
                    "You already have a payout being processed"
            });
        }

        await deductBalance(
            req.user._id,
            payoutAmount
        );

        const payout =
            await Payout.create({
                user: req.user._id,
                amount: payoutAmount,
                method,
                accountName,
                accountNumber,
                reference:
                    generatePayoutReference()
            });

        res.status(201).json({
            success: true,
            message:
                "Payout request submitted successfully",
            data: {
                payout
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// MY PAYOUTS
// ==========================================

const getMyPayouts = async (
    req,
    res,
    next
) => {
    try {
        const payouts =
            await Payout.find({
                user: req.user._id
            })
                .sort({
                    createdAt: -1
                });

        res.status(200).json({
            success: true,
            data: {
                count: payouts.length,
                payouts
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// ADMIN: GET PAYOUTS
// ==========================================

const getAllPayouts = async (
    req,
    res,
    next
) => {
    try {
        const payouts =
            await Payout.find()
                .populate(
                    "user",
                    "name email phone profileImage"
                )
                .sort({
                    createdAt: -1
                });

        res.status(200).json({
            success: true,
            data: {
                count: payouts.length,
                payouts
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// ADMIN: PROCESS PAYOUT
// ==========================================

const processPayout = async (
    req,
    res,
    next
) => {
    try {
        const {
            status,
            adminNote
        } = req.body;

        const payout =
            await Payout.findById(
                req.params.id
            );

        if (!payout) {
            return res.status(404).json({
                success: false,
                message:
                    "Payout not found"
            });
        }

        const allowedStatuses = [
            "processing",
            "completed",
            "failed",
            "cancelled"
        ];

        if (
            !allowedStatuses.includes(
                status
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid payout status"
            });
        }

        if (
            payout.status ===
            "completed" ||
            payout.status ===
            "cancelled"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This payout can no longer be updated"
            });
        }


        // --------------------------------------
        // FAILED / CANCELLED
        // RETURN MONEY TO WALLET
        // --------------------------------------

        if (
            (
                status === "failed" ||
                status === "cancelled"
            ) &&
            payout.status !== "failed" &&
            payout.status !== "cancelled"
        ) {
            const wallet =
                await getOrCreateWallet(
                    payout.user
                );

            wallet.balance +=
                payout.amount;

            wallet.totalWithdrawn -=
                payout.amount;

            await wallet.save();
        }


        payout.status = status;

        if (adminNote !== undefined) {
            payout.adminNote =
                adminNote;
        }

        if (status === "completed") {
            payout.processedAt =
                new Date();
        }

        await payout.save();


        // --------------------------------------
        // NOTIFY USER
        // --------------------------------------

        let title =
            "Payout Updated";

        let message =
            "Your payout status has been updated.";

        if (status === "processing") {
            title =
                "Payout Processing";

            message =
                "Your payout is now being processed.";
        }

        if (status === "completed") {
            title =
                "Payout Completed";

            message =
                `Your payout of ${payout.amount} PKR has been completed.`;
        }

        if (status === "failed") {
            title =
                "Payout Failed";

            message =
                "Your payout failed and the amount was returned to your wallet.";
        }

        if (status === "cancelled") {
            title =
                "Payout Cancelled";

            message =
                "Your payout was cancelled and the amount was returned to your wallet.";
        }

        await createNotification({
            recipient: payout.user,
            sender: req.user._id,
            type: "system",
            title,
            message,
            data: {
                payoutId:
                    payout._id,
                reference:
                    payout.reference,
                status:
                    payout.status
            }
        });


        res.status(200).json({
            success: true,
            message:
                "Payout updated successfully",
            data: {
                payout
            }
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    requestPayout,
    getMyPayouts,
    getAllPayouts,
    processPayout
};