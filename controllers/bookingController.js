const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");

const createBooking = async (req, res, next) => {
    try {
        const {
            serviceId,
            date,
            time,
            location,
            additionalInstructions
        } = req.body;

        if (!serviceId || !date || !time || !location) {
            return res.status(400).json({
                success: false,
                message:
                    "Service, date, time and location are required"
            });
        }

        const service = await Service.findById(serviceId);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        if (
            service.status !== "active" ||
            !service.availability
        ) {
            return res.status(400).json({
                success: false,
                message: "This service is currently unavailable"
            });
        }

        const vendor = await User.findById(service.vendor);

        if (
            !vendor ||
            vendor.role !== "vendor" ||
            vendor.status !== "approved"
        ) {
            return res.status(400).json({
                success: false,
                message: "Vendor is not currently available"
            });
        }

        const booking = await Booking.create({
            customer: req.user._id,
            vendor: service.vendor,
            service: service._id,
            date,
            time,
            location,
            additionalInstructions:
                additionalInstructions || "",
            amount: service.price
        });

        const populatedBooking = await Booking.findById(
            booking._id
        )
            .populate(
                "customer",
                "name email phone profileImage"
            )
            .populate(
                "vendor",
                "name email phone profileImage location"
            )
            .populate(
                "service",
                "title category price duration images"
            );

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            data: {
                booking: populatedBooking
            }
        });
    } catch (error) {
        next(error);
    }
};

const getCustomerBookings = async (
    req,
    res,
    next
) => {
    try {
        const bookings = await Booking.find({
            customer: req.user._id
        })
            .populate(
                "vendor",
                "name email phone profileImage location"
            )
            .populate(
                "service",
                "title category price duration images"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Customer bookings retrieved successfully",
            data: {
                bookings
            }
        });
    } catch (error) {
        next(error);
    }
};

const getVendorBookings = async (
    req,
    res,
    next
) => {
    try {
        const bookings = await Booking.find({
            vendor: req.user._id
        })
            .populate(
                "customer",
                "name email phone profileImage location"
            )
            .populate(
                "service",
                "title category price duration images"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Vendor bookings retrieved successfully",
            data: {
                bookings
            }
        });
    } catch (error) {
        next(error);
    }
};

const getBookingById = async (
    req,
    res,
    next
) => {
    try {
        const booking = await Booking.findById(
            req.params.id
        )
            .populate(
                "customer",
                "name email phone profileImage location"
            )
            .populate(
                "vendor",
                "name email phone profileImage location"
            )
            .populate(
                "service",
                "title category description price duration images location"
            );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        const isCustomer =
            booking.customer._id.toString() ===
            req.user._id.toString();

        const isVendor =
            booking.vendor._id.toString() ===
            req.user._id.toString();

        const isAdmin = req.user.role === "admin";

        if (!isCustomer && !isVendor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this booking"
            });
        }

        res.status(200).json({
            success: true,
            message: "Booking retrieved successfully",
            data: {
                booking
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateBookingStatus = async (
    req,
    res,
    next
) => {
    try {
        const { status } = req.body;

        const allowedStatuses = [
            "accepted",
            "rejected",
            "inProgress",
            "completed",
            "cancelled"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking status"
            });
        }

        const booking = await Booking.findById(
            req.params.id
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        const userId = req.user._id.toString();

        const isCustomer =
            booking.customer.toString() === userId;

        const isVendor =
            booking.vendor.toString() === userId;

        /*
          Vendor actions:
          pending -> accepted
          pending -> rejected
          accepted -> inProgress
          inProgress -> completed
        */

        if (isVendor) {
            if (
                status === "accepted" ||
                status === "rejected"
            ) {
                if (booking.status !== "pending") {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Only pending bookings can be accepted or rejected"
                    });
                }
            }

            if (status === "inProgress") {
                if (booking.status !== "accepted") {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Only accepted bookings can be started"
                    });
                }
            }

            if (status === "completed") {
                if (booking.status !== "inProgress") {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Only in-progress bookings can be completed"
                    });
                }
            }

            if (status === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message:
                        "Vendor cannot cancel a booking using this endpoint"
                });
            }
        } else if (isCustomer) {
            if (status !== "cancelled") {
                return res.status(403).json({
                    success: false,
                    message:
                        "Customer can only cancel a booking"
                });
            }

            if (
                !["pending", "accepted"].includes(
                    booking.status
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "This booking can no longer be cancelled"
                });
            }
        } else if (req.user.role === "admin") {
            // Admin can update booking status when necessary.
        } else {
            return res.status(403).json({
                success: false,
                message:
                    "You do not have permission to update this booking"
            });
        }

        booking.status = status;

        await booking.save();

        const updatedBooking = await Booking.findById(
            booking._id
        )
            .populate(
                "customer",
                "name email phone profileImage"
            )
            .populate(
                "vendor",
                "name email phone profileImage"
            )
            .populate(
                "service",
                "title category price duration"
            );

        res.status(200).json({
            success: true,
            message: "Booking status updated successfully",
            data: {
                booking: updatedBooking
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createBooking,
    getCustomerBookings,
    getVendorBookings,
    getBookingById,
    updateBookingStatus
};