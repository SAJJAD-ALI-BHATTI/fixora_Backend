const Booking = require("../models/Booking");
const Task = require("../models/Task");
const User = require("../models/User");
const { settleMarketplacePayment } = require("../utils/marketplacePayment");

const confirmBookingPayment = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id }).populate("service", "title");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.status !== "completed") return res.status(400).json({ success: false, message: "The vendor must mark the booking completed before you can confirm payment." });
    if (booking.paymentStatus === "paid") return res.status(409).json({ success: false, message: "This booking has already been paid." });
    const vendor = await User.findOne({ _id: booking.vendor, role: "vendor" });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const transaction = await settleMarketplacePayment({
      customerId: req.user._id,
      providerId: vendor._id,
      providerRole: "vendor",
      amount: booking.amount,
      bookingId: booking._id,
      serviceId: booking.service?._id || booking.service,
      description: `Payment for ${booking.service?.title || "service booking"}`,
      finalize: async ({ session, transaction }) => {
        booking.paymentStatus = "paid";
        booking.paymentTransaction = transaction._id;
        booking.customerConfirmedAt = new Date();
        await booking.save({ session });
      }
    });

    const updatedBooking = await Booking.findById(booking._id).populate("vendor", "name email phone profileImage location").populate("service", "title category price duration images");
    res.status(200).json({ success: true, message: "Service confirmed and payment completed.", data: { booking: updatedBooking, transaction } });
  } catch (error) { next(error); }
};

const confirmTaskPayment = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, customer: req.user._id });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    if (task.status !== "completed") return res.status(400).json({ success: false, message: "The task runner must mark the task completed before you can confirm payment." });
    if (task.paymentStatus === "paid") return res.status(409).json({ success: false, message: "This task has already been paid." });
    if (!task.assignedRunner) return res.status(400).json({ success: false, message: "No task runner is assigned to this task." });
    const runner = await User.findOne({ _id: task.assignedRunner, role: "taskRunner" });
    if (!runner) return res.status(404).json({ success: false, message: "Task runner not found" });
    const amount = Number(task.agreedAmount || task.budget);
    if (!amount) return res.status(400).json({ success: false, message: "No agreed task amount is available for payment." });

    const transaction = await settleMarketplacePayment({
      customerId: req.user._id,
      providerId: runner._id,
      providerRole: "taskRunner",
      amount,
      taskId: task._id,
      description: `Payment for task: ${task.title}`,
      finalize: async ({ session, transaction }) => {
        task.paymentStatus = "paid";
        task.paymentTransaction = transaction._id;
        task.customerConfirmedAt = new Date();
        await task.save({ session });
      }
    });

    const updatedTask = await Task.findById(task._id).populate("assignedRunner", "name email phone profileImage location");
    res.status(200).json({ success: true, message: "Task confirmed and payment completed.", data: { task: updatedTask, transaction } });
  } catch (error) { next(error); }
};

module.exports = { confirmBookingPayment, confirmTaskPayment };
