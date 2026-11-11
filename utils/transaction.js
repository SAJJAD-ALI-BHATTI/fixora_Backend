const crypto = require("crypto");
const {
    calculateCommission,
    calculateProviderAmount
} = require("../config/payment");
const Transaction = require("../models/Transaction");

const {
    createNotification
} = require("./notification");

const generateReference = () => {
    return `FIX-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;
};


const createTransaction = async ({
    customer,
    vendor = null,
    taskRunner = null,
    booking = null,
    task = null,
    service = null,
    type,
    amount,
    currency = "PKR",
    paymentMethod,
    description = "",
    metadata = {},
   platformCommission =
        calculateCommission(amount),

providerAmount =
        calculateProviderAmount(amount)
}) => {

    const transaction =
        await Transaction.create({
            customer,
            vendor,
            taskRunner,
            booking,
            task,
            platformCommission,
            providerAmount,
            service,
            type,
            amount,
            currency,
            paymentMethod,
            description,
            metadata,
            reference:
                generateReference()
        });

    return transaction;
};


const markTransactionPaid = async (
    transactionId,
    providerData = {}
) => {

    const transaction =
        await Transaction.findById(
            transactionId
        );

    if (!transaction) {
        throw new Error(
            "Transaction not found"
        );
    }

    transaction.status = "paid";

    transaction.paidAt = new Date();

    if (providerData.provider) {
        transaction.provider =
            providerData.provider;
    }

    if (
        providerData.providerTransactionId
    ) {
        transaction.providerTransactionId =
            providerData.providerTransactionId;
    }

    if (providerData.metadata) {
        transaction.metadata = {
            ...transaction.metadata,
            ...providerData.metadata
        };
    }

    await transaction.save();

    await createNotification({
        recipient: transaction.customer,
        type: "system",
        title: "Payment Successful",
        message:
            `Your payment of ${transaction.amount} ${transaction.currency} was successful.`,
        data: {
            transactionId:
                transaction._id,
            reference:
                transaction.reference
        }
    });

    return transaction;
};


const markTransactionFailed = async (
    transactionId,
    reason = ""
) => {

    const transaction =
        await Transaction.findById(
            transactionId
        );

    if (!transaction) {
        throw new Error(
            "Transaction not found"
        );
    }

    transaction.status = "failed";

    transaction.metadata = {
        ...transaction.metadata,
        failureReason: reason
    };

    await transaction.save();

    await createNotification({
        recipient: transaction.customer,
        type: "system",
        title: "Payment Failed",
        message:
            "Your payment could not be completed.",
        data: {
            transactionId:
                transaction._id,
            reference:
                transaction.reference
        }
    });

    return transaction;
};


module.exports = {
    generateReference,
    createTransaction,
    markTransactionPaid,
    markTransactionFailed
};