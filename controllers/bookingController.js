const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Conversation = require("../models/Conversation");
const { reserveMarketplacePayment, refundMarketplaceReservation } = require("../utils/marketplaceEscrow");
const { hasPassed } = require("../utils/schedule");
const { createNotification } = require("../utils/notification");

async function expirePendingBookings() {
    const pending = await Booking.find({ status: "pending" }).select("_id date time");
    const expiredIds = pending.filter(item => hasPassed(item.date, item.time)).map(item => item._id);
    if (expiredIds.length) await Booking.updateMany({ _id: { $in: expiredIds }, status: "pending" }, { $set: { status: "missed" } });
}

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
        if (hasPassed(date, time)) {
            return res.status(400).json({ success: false, message: "Please choose a future booking date and time." });
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

        // A service can only be booked inside the city where its provider operates.
        // City is taken from the provider's published service location, not from a global catalogue.
        const serviceCity = String(service.city || "").trim();
        const requestedAddress = String(location || "").trim();
        if (serviceCity && !requestedAddress.toLowerCase().includes(serviceCity.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `This provider serves ${serviceCity} only. Please enter a service address in ${serviceCity}.`
            });
        }

        const customerWallet = await Wallet.findOne({ user: req.user._id }).select("balance").lean();
        const availableBalance = Number(customerWallet?.balance || 0);
        if (availableBalance < Number(service.price)) {
            return res.status(400).json({ success: false, message: `Insufficient wallet balance. This service costs PKR ${Number(service.price).toLocaleString()} and your available balance is PKR ${availableBalance.toLocaleString()}. Please contact the administrator to add funds.` });
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

        // Real-time + persistent alert for the vendor (best effort: never blocks the booking)
        createNotification({
            recipient: service.vendor,
            sender: req.user._id,
            type: "bookingCreated",
            title: "Congratulations! You've received a new service booking!",
            message: `${populatedBooking.customer?.name || "A customer"} booked "${populatedBooking.service?.title || "your service"}" for ${date} at ${time}.`,
            data: {
                kind: "booking",
                bookingId: booking._id,
                serviceTitle: populatedBooking.service?.title,
                customerName: populatedBooking.customer?.name,
                amount: Number(service.price),
                date,
                time,
                link: `/vendor/orders/${booking._id}`
            }
        }).catch((e) => console.warn("bookingCreated notification failed:", e.message));

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
        await expirePendingBookings();
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
        await expirePendingBookings();
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
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        if (booking.status === "pending" && hasPassed(booking.date, booking.time)) {
            booking.status = "missed";
            await booking.save();
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

        if (booking.status === "pending" && hasPassed(booking.date, booking.time)) {
            booking.status = "missed";
            await booking.save();
            return res.status(400).json({ success: false, message: "This booking time has passed. It is now marked as missed and can no longer be accepted." });
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

        if (isVendor && status === "accepted" && !booking.fundsReserved) {
            const provider = await User.findById(booking.vendor).select("role status");
            if (!provider || !["vendor", "taskRunner"].includes(provider.role) || provider.status !== "approved") {
                return res.status(403).json({ success: false, message: "Only an approved provider can accept bookings." });
            }
            const transaction = await reserveMarketplacePayment({
                customerId: booking.customer, providerId: booking.vendor, providerRole: provider.role,
                amount: booking.amount, bookingId: booking._id, serviceId: booking.service,
                description: "Wallet funds reserved for accepted service booking"
            });
            booking.paymentTransaction = transaction._id;
            booking.fundsReserved = true;
            booking.reservedAt = new Date();
            booking.paymentStatus = "reserved";
            // Make a direct conversation available to both sides immediately on acceptance.
            let conversation = await Conversation.findOne({ isGroup: false, participants: { $all: [booking.customer, booking.vendor], $size: 2 } });
            if (!conversation) await Conversation.create({ participants: [booking.customer, booking.vendor] });
            // Notification delivery must not roll back an otherwise valid reservation/acceptance.
            createNotification({ recipient: booking.customer, sender: booking.vendor, type: "bookingAccepted", title: "Booking accepted", message: "Your provider accepted the booking. You can now message each other.", data: { bookingId: booking._id } }).catch(notificationError => console.error("Booking acceptance notification failed:", notificationError.message));
        }

        if (status === "cancelled" && booking.fundsReserved && booking.paymentStatus === "reserved") {
            await refundMarketplaceReservation({ transactionId: booking.paymentTransaction, customerId: booking.customer });
            booking.fundsReserved = false;
            booking.paymentStatus = "refunded";
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
