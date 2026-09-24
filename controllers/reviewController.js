const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Task = require("../models/Task");
const Service = require("../models/Service");

const createBookingReview = async (req, res, next) => {
    try {
        const {
            rating,
            comment
        } = req.body;

        if (!rating) {
            return res.status(400).json({
                success: false,
                message: "Rating is required"
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        const booking = await Booking.findById(
            req.params.bookingId
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        if (
            booking.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the customer can review this booking"
            });
        }

        if (booking.status !== "completed") {
            return res.status(400).json({
                success: false,
                message:
                    "You can only review completed bookings"
            });
        }

        const existingReview = await Review.findOne({
            customer: req.user._id,
            booking: booking._id
        });

        if (existingReview) {
            return res.status(409).json({
                success: false,
                message:
                    "You have already reviewed this booking"
            });
        }

        const review = await Review.create({
            customer: req.user._id,
            vendor: booking.vendor,
            service: booking.service,
            booking: booking._id,
            rating,
            comment: comment || ""
        });

        await updateServiceRating(booking.service);

        const populatedReview = await Review.findById(
            review._id
        )
            .populate(
                "customer",
                "name profileImage"
            )
            .populate(
                "vendor",
                "name profileImage"
            )
            .populate(
                "service",
                "title category"
            );

        res.status(201).json({
            success: true,
            message: "Review created successfully",
            data: {
                review: populatedReview
            }
        });
    } catch (error) {
        next(error);
    }
};

const createTaskReview = async (req, res, next) => {
    try {
        const {
            rating,
            comment
        } = req.body;

        if (!rating) {
            return res.status(400).json({
                success: false,
                message: "Rating is required"
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
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

        if (
            task.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the task owner can submit a review"
            });
        }

        if (task.status !== "completed") {
            return res.status(400).json({
                success: false,
                message:
                    "You can only review completed tasks"
            });
        }

        if (!task.assignedRunner) {
            return res.status(400).json({
                success: false,
                message:
                    "This task has no assigned runner"
            });
        }

        const existingReview = await Review.findOne({
            customer: req.user._id,
            task: task._id
        });

        if (existingReview) {
            return res.status(409).json({
                success: false,
                message:
                    "You have already reviewed this task"
            });
        }

        const review = await Review.create({
            customer: req.user._id,
            taskRunner: task.assignedRunner,
            task: task._id,
            rating,
            comment: comment || ""
        });

        const populatedReview = await Review.findById(
            review._id
        )
            .populate(
                "customer",
                "name profileImage"
            )
            .populate(
                "taskRunner",
                "name profileImage"
            )
            .populate(
                "task",
                "title category"
            );

        res.status(201).json({
            success: true,
            message: "Review created successfully",
            data: {
                review: populatedReview
            }
        });
    } catch (error) {
        next(error);
    }
};

const getServiceReviews = async (
    req,
    res,
    next
) => {
    try {
        const reviews = await Review.find({
            service: req.params.serviceId
        })
            .populate(
                "customer",
                "name profileImage"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Service reviews retrieved successfully",
            data: {
                count: reviews.length,
                reviews
            }
        });
    } catch (error) {
        next(error);
    }
};

const getTaskRunnerReviews = async (
    req,
    res,
    next
) => {
    try {
        const reviews = await Review.find({
            taskRunner: req.params.runnerId
        })
            .populate(
                "customer",
                "name profileImage"
            )
            .populate(
                "task",
                "title category"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message:
                "Task runner reviews retrieved successfully",
            data: {
                count: reviews.length,
                reviews
            }
        });
    } catch (error) {
        next(error);
    }
};

const getVendorReviews = async (
    req,
    res,
    next
) => {
    try {
        const reviews = await Review.find({
            vendor: req.params.vendorId
        })
            .populate(
                "customer",
                "name profileImage"
            )
            .populate(
                "service",
                "title category"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message:
                "Vendor reviews retrieved successfully",
            data: {
                count: reviews.length,
                reviews
            }
        });
    } catch (error) {
        next(error);
    }
};

const getMyReviews = async (req, res, next) => {
    try {
        const reviews = await Review.find({
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
                "task",
                "title category"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Your reviews retrieved successfully",
            data: {
                reviews
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateReview = async (req, res, next) => {
    try {
        const {
            rating,
            comment
        } = req.body;

        const review = await Review.findById(
            req.params.id
        );

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }

        if (
            review.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only update your own review"
            });
        }

        if (rating !== undefined) {
            if (rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Rating must be between 1 and 5"
                });
            }

            review.rating = rating;
        }

        if (comment !== undefined) {
            review.comment = comment;
        }

        await review.save();

        if (review.service) {
            await updateServiceRating(review.service);
        }

        const updatedReview = await Review.findById(
            review._id
        )
            .populate(
                "customer",
                "name profileImage"
            )
            .populate(
                "vendor",
                "name profileImage"
            )
            .populate(
                "taskRunner",
                "name profileImage"
            );

        res.status(200).json({
            success: true,
            message: "Review updated successfully",
            data: {
                review: updatedReview
            }
        });
    } catch (error) {
        next(error);
    }
};

const deleteReview = async (req, res, next) => {
    try {
        const review = await Review.findById(
            req.params.id
        );

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }

        if (
            review.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only delete your own review"
            });
        }

        const serviceId = review.service;

        await review.deleteOne();

        if (serviceId) {
            await updateServiceRating(serviceId);
        }

        res.status(200).json({
            success: true,
            message: "Review deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

const updateServiceRating = async (
    serviceId
) => {
    const result = await Review.aggregate([
        {
            $match: {
                service: serviceId
            }
        },
        {
            $group: {
                _id: "$service",
                averageRating: {
                    $avg: "$rating"
                }
            }
        }
    ]);

    const rating =
        result.length > 0
            ? Number(result[0].averageRating.toFixed(1))
            : 0;

    await Service.findByIdAndUpdate(
        serviceId,
        {
            rating
        }
    );
};

module.exports = {
    createBookingReview,
    createTaskReview,
    getServiceReviews,
    getTaskRunnerReviews,
    getVendorReviews,
    getMyReviews,
    updateReview,
    deleteReview
};