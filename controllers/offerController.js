const Offer = require("../models/Offer");
const Task = require("../models/Task");
const User = require("../models/User");

const {
    createNotification
} = require("../utils/notification");


// ==========================================
// CREATE OFFER
// ==========================================

const createOffer = async (req, res, next) => {
    try {
        const {
            amount,
            message,
            estimatedTime
        } = req.body;

        if (amount === undefined) {
            return res.status(400).json({
                success: false,
                message: "Offer amount is required"
            });
        }

        if (Number(amount) < 0) {
            return res.status(400).json({
                success: false,
                message: "Offer amount cannot be negative"
            });
        }

        const task = await Task.findById(
            req.params.taskId
        );

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (task.status !== "open") {
            return res.status(400).json({
                success: false,
                message:
                    "Offers can only be submitted for open tasks"
            });
        }

        const runner = await User.findById(
            req.user._id
        );

        if (
            !runner ||
            runner.role !== "taskRunner" ||
            runner.status !== "approved"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only approved task runners can submit offers"
            });
        }

        if (
            task.customer.toString() ===
            req.user._id.toString()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "You cannot submit an offer on your own task"
            });
        }

        const existingOffer = await Offer.findOne({
            task: task._id,
            runner: req.user._id,
            status: {
                $in: [
                    "pending",
                    "countered",
                    "accepted"
                ]
            }
        });

        if (existingOffer) {
            return res.status(409).json({
                success: false,
                message:
                    "You already have an active offer for this task"
            });
        }

        const offer = await Offer.create({
            task: task._id,
            runner: req.user._id,
            amount: Number(amount),
            message: message || "",
            estimatedTime:
                estimatedTime || ""
        });


        // ------------------------------------------
        // NOTIFY CUSTOMER
        // ------------------------------------------

        await createNotification({
            recipient: task.customer,
            sender: req.user._id,
            type: "newOffer",
            title: "New Offer Received",
            message:
                `${runner.name} submitted an offer for your task.`,
            data: {
                taskId: task._id,
                offerId: offer._id
            }
        });


        const populatedOffer =
            await Offer.findById(
                offer._id
            )
                .populate(
                    "runner",
                    "name email phone profileImage location"
                )
                .populate(
                    "task",
                    "title category description budget location preferredDate preferredTime status"
                );

        res.status(201).json({
            success: true,
            message:
                "Offer submitted successfully",
            data: {
                offer: populatedOffer
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// GET TASK OFFERS
// ==========================================

const getTaskOffers = async (
    req,
    res,
    next
) => {
    try {
        const task = await Task.findById(
            req.params.taskId
        );

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (
            task.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the task owner can view offers"
            });
        }

        const offers = await Offer.find({
            task: task._id
        })
            .populate(
                "runner",
                "name email phone profileImage location"
            )
            .sort({
                createdAt: -1
            });

        res.status(200).json({
            success: true,
            message:
                "Task offers retrieved successfully",
            data: {
                count: offers.length,
                offers
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// GET MY OFFERS
// ==========================================

const getMyOffers = async (
    req,
    res,
    next
) => {
    try {
        const offers = await Offer.find({
            runner: req.user._id
        })
            .populate(
                "task",
                "title category description budget location preferredDate preferredTime status"
            )
            .sort({
                createdAt: -1
            });

        res.status(200).json({
            success: true,
            message:
                "Your offers retrieved successfully",
            data: {
                offers
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// GET OFFER BY ID
// ==========================================

const getOfferById = async (
    req,
    res,
    next
) => {
    try {
        const offer =
            await Offer.findById(
                req.params.id
            )
                .populate(
                    "runner",
                    "name email phone profileImage location"
                )
                .populate(
                    "task",
                    "title category description budget location preferredDate preferredTime status customer"
                );

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

        const isRunner =
            offer.runner._id.toString() ===
            req.user._id.toString();

        const isCustomer =
            offer.task.customer.toString() ===
            req.user._id.toString();

        if (!isRunner && !isCustomer) {
            return res.status(403).json({
                success: false,
                message:
                    "You do not have access to this offer"
            });
        }

        res.status(200).json({
            success: true,
            message:
                "Offer retrieved successfully",
            data: {
                offer
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// WITHDRAW OFFER
// ==========================================

const withdrawOffer = async (
    req,
    res,
    next
) => {
    try {
        const offer =
            await Offer.findById(
                req.params.id
            );

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

        if (
            offer.runner.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only withdraw your own offer"
            });
        }

        if (offer.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    "Only pending offers can be withdrawn"
            });
        }

        offer.status = "withdrawn";

        await offer.save();


        // ------------------------------------------
        // NOTIFY CUSTOMER
        // ------------------------------------------

        const task =
            await Task.findById(
                offer.task
            );

        if (task) {
            await createNotification({
                recipient: task.customer,
                sender: req.user._id,
                type: "system",
                title: "Offer Withdrawn",
                message:
                    "A task runner withdrew their offer.",
                data: {
                    taskId: task._id,
                    offerId: offer._id
                }
            });
        }


        res.status(200).json({
            success: true,
            message:
                "Offer withdrawn successfully"
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// ACCEPT OFFER
// ==========================================

const acceptOffer = async (
    req,
    res,
    next
) => {
    try {
        const offer =
            await Offer.findById(
                req.params.id
            );

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

        const task =
            await Task.findById(
                offer.task
            );

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (
            task.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the task owner can accept an offer"
            });
        }

        if (task.status !== "open") {
            return res.status(400).json({
                success: false,
                message:
                    "This task is no longer accepting offers"
            });
        }

        if (offer.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    "Only pending offers can be accepted"
            });
        }


        // ------------------------------------------
        // ASSIGN RUNNER
        // ------------------------------------------

        task.assignedRunner =
            offer.runner;
        task.agreedAmount = Number(offer.amount);
        task.paymentStatus = "pending";

        task.status = "assigned";

        await task.save();


        // ------------------------------------------
        // ACCEPT SELECTED OFFER
        // ------------------------------------------

        offer.status = "accepted";

        await offer.save();


        // ------------------------------------------
        // REJECT OTHER OFFERS
        // ------------------------------------------

        await Offer.updateMany(
            {
                task: task._id,
                _id: {
                    $ne: offer._id
                },
                status: "pending"
            },
            {
                $set: {
                    status: "rejected"
                }
            }
        );


        // ------------------------------------------
        // NOTIFY SELECTED RUNNER
        // ------------------------------------------

        await createNotification({
            recipient: offer.runner,
            sender: req.user._id,
            type: "offerAccepted",
            title: "Offer Accepted",
            message:
                "Your offer has been accepted by the customer.",
            data: {
                taskId: task._id,
                offerId: offer._id
            }
        });


        // ------------------------------------------
        // NOTIFY OTHER RUNNERS
        // ------------------------------------------

        const rejectedOffers =
            await Offer.find({
                task: task._id,
                status: "rejected",
                _id: {
                    $ne: offer._id
                }
            });

        for (
            const rejectedOffer
            of rejectedOffers
        ) {
            await createNotification({
                recipient:
                    rejectedOffer.runner,
                sender:
                    req.user._id,
                type: "offerRejected",
                title:
                    "Offer Not Selected",
                message:
                    "Another task runner was selected for this task.",
                data: {
                    taskId:
                        task._id,
                    offerId:
                        rejectedOffer._id
                }
            });
        }


        // ------------------------------------------
        // TASK ASSIGNMENT NOTIFICATION
        // ------------------------------------------

        await createNotification({
            recipient: offer.runner,
            sender: req.user._id,
            type: "taskAssigned",
            title: "Task Assigned",
            message:
                "You have been assigned a new task.",
            data: {
                taskId: task._id,
                offerId: offer._id
            }
        });


        const updatedOffer =
            await Offer.findById(
                offer._id
            )
                .populate(
                    "runner",
                    "name email phone profileImage location"
                )
                .populate(
                    "task",
                    "title category description budget location preferredDate preferredTime status assignedRunner"
                );

        res.status(200).json({
            success: true,
            message:
                "Offer accepted successfully",
            data: {
                offer: updatedOffer
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// REJECT OFFER
// ==========================================

const rejectOffer = async (
    req,
    res,
    next
) => {
    try {
        const offer =
            await Offer.findById(
                req.params.id
            );

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

        const task =
            await Task.findById(
                offer.task
            );

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (
            task.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the task owner can reject an offer"
            });
        }

        if (offer.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    "Only pending offers can be rejected"
            });
        }

        offer.status = "rejected";

        await offer.save();


        // ------------------------------------------
        // NOTIFY RUNNER
        // ------------------------------------------

        await createNotification({
            recipient: offer.runner,
            sender: req.user._id,
            type: "offerRejected",
            title: "Offer Rejected",
            message:
                "The customer rejected your offer.",
            data: {
                taskId: task._id,
                offerId: offer._id
            }
        });


        res.status(200).json({
            success: true,
            message:
                "Offer rejected successfully"
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// CUSTOMER COUNTER OFFER
// ==========================================

const counterOffer = async (req, res, next) => {
    try {
        const { amount, message, estimatedTime } = req.body;

        if (amount === undefined || Number.isNaN(Number(amount))) {
            return res.status(400).json({
                success: false,
                message: "Counter offer amount is required"
            });
        }

        if (Number(amount) < 0) {
            return res.status(400).json({
                success: false,
                message: "Counter offer amount cannot be negative"
            });
        }

        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offer not found"
            });
        }

        const task = await Task.findById(offer.task);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (task.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only the task owner can make a counter offer"
            });
        }

        if (task.status !== "open") {
            return res.status(400).json({
                success: false,
                message: "Counter offers are only available while the task is open"
            });
        }

        if (offer.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Only pending offers can be countered"
            });
        }

        offer.counterOffers.push({
            amount: Number(amount),
            message: message || "",
            estimatedTime: estimatedTime || "",
            by: "customer",
            status: "pending"
        });
        offer.status = "countered";

        await offer.save();

        await createNotification({
            recipient: offer.runner,
            sender: req.user._id,
            type: "counterOffer",
            title: "Counter Offer Received",
            message: "The customer sent you a counter offer.",
            data: {
                taskId: task._id,
                offerId: offer._id
            }
        });

        const updatedOffer = await Offer.findById(offer._id)
            .populate("runner", "name email phone profileImage location")
            .populate("task", "title category description budget location preferredDate preferredTime status assignedRunner customer");

        return res.status(200).json({
            success: true,
            message: "Counter offer sent successfully",
            data: { offer: updatedOffer }
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// TASK RUNNER ACCEPT COUNTER OFFER
// ==========================================

const acceptCounterOffer = async (req, res, next) => {
    try {
        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        if (offer.runner.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only respond to your own offer"
            });
        }

        const task = await Task.findById(offer.task);
        if (!task) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        if (task.status !== "open") {
            return res.status(400).json({
                success: false,
                message: "This task is no longer accepting offers"
            });
        }

        const latestCounter = offer.counterOffers?.[offer.counterOffers.length - 1];
        if (!latestCounter || latestCounter.by !== "customer" || latestCounter.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "There is no pending customer counter offer"
            });
        }

        latestCounter.status = "accepted";
        offer.amount = latestCounter.amount;
        offer.message = latestCounter.message;
        offer.estimatedTime = latestCounter.estimatedTime;
        offer.status = "accepted";

        task.assignedRunner = offer.runner;
        task.agreedAmount = Number(offer.amount);
        task.paymentStatus = "pending";
        task.status = "assigned";

        await task.save();
        await offer.save();

        await Offer.updateMany(
            {
                task: task._id,
                _id: { $ne: offer._id },
                status: { $in: ["pending", "countered"] }
            },
            { $set: { status: "rejected" } }
        );

        await createNotification({
            recipient: task.customer,
            sender: req.user._id,
            type: "counterOfferAccepted",
            title: "Counter Offer Accepted",
            message: "The task runner accepted your counter offer.",
            data: { taskId: task._id, offerId: offer._id }
        });

        await createNotification({
            recipient: offer.runner,
            sender: task.customer,
            type: "taskAssigned",
            title: "Task Assigned",
            message: "You accepted the customer's counter offer and the task is assigned to you.",
            data: { taskId: task._id, offerId: offer._id }
        });

        const updatedOffer = await Offer.findById(offer._id)
            .populate("runner", "name email phone profileImage location")
            .populate("task", "title category description budget location preferredDate preferredTime status assignedRunner customer");

        return res.status(200).json({
            success: true,
            message: "Counter offer accepted successfully",
            data: { offer: updatedOffer }
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// TASK RUNNER REJECT COUNTER OFFER
// ==========================================

const rejectCounterOffer = async (req, res, next) => {
    try {
        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        if (offer.runner.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only respond to your own offer"
            });
        }

        const task = await Task.findById(offer.task);
        if (!task) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        const latestCounter = offer.counterOffers?.[offer.counterOffers.length - 1];
        if (!latestCounter || latestCounter.by !== "customer" || latestCounter.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "There is no pending customer counter offer"
            });
        }

        latestCounter.status = "rejected";
        offer.status = "pending";
        await offer.save();

        await createNotification({
            recipient: task.customer,
            sender: req.user._id,
            type: "counterOfferRejected",
            title: "Counter Offer Rejected",
            message: "The task runner rejected your counter offer. Your original offer is still available.",
            data: { taskId: task._id, offerId: offer._id }
        });

        return res.status(200).json({
            success: true,
            message: "Counter offer rejected successfully",
            data: { offer }
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    createOffer,
    getTaskOffers,
    getMyOffers,
    getOfferById,
    withdrawOffer,
    acceptOffer,
    rejectOffer,
    counterOffer,
    acceptCounterOffer,
    rejectCounterOffer
};