const User = require("../models/User");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Task = require("../models/Task");
const Transaction = require("../models/Transaction");
const Offer = require("../models/Offer");

const DAY = 86400000;

/** Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive). Defaults to the last 30 days. */
function parseRange(query = {}) {
    const now = new Date();
    let to = query.to ? new Date(`${String(query.to).slice(0, 10)}T23:59:59.999Z`) : now;
    if (Number.isNaN(to.getTime())) to = now;
    let from = query.from ? new Date(`${String(query.from).slice(0, 10)}T00:00:00.000Z`) : new Date(to.getTime() - 29 * DAY);
    if (Number.isNaN(from.getTime())) from = new Date(to.getTime() - 29 * DAY);
    if (from > to) [from, to] = [to, from];
    const span = to.getTime() - from.getTime() + 1;
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - span + 1);
    return { from, to, prevFrom, prevTo, days: Math.max(1, Math.round(span / DAY)) };
}

const inRange = (field, a, b) => ({ [field]: { $gte: a, $lte: b } });
const paidMatch = (a, b) => ({
    status: "paid",
    type: { $in: ["bookingPayment", "taskPayment"] },
    $expr: { $and: [{ $gte: [{ $ifNull: ["$paidAt", "$createdAt"] }, a] }, { $lte: [{ $ifNull: ["$paidAt", "$createdAt"] }, b] }] }
});

async function revenueIn(a, b) {
    const r = await Transaction.aggregate([
        { $match: paidMatch(a, b) },
        { $group: { _id: null, volume: { $sum: "$amount" }, commission: { $sum: { $ifNull: ["$platformCommission", 0] } }, count: { $sum: 1 } } }
    ]);
    return r[0] || { volume: 0, commission: 0, count: 0 };
}

const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur ? 100 : 0);
const compare = (cur, prev) => ({ current: cur, previous: prev, change: pct(cur, prev) });

async function buildAnalytics(query) {
    const { from, to, prevFrom, prevTo, days } = parseRange(query);
    const bucket = days > 120 ? "%Y-%m" : "%Y-%m-%d";

    const [
        customers, vendors, runners, pendingApprovals, services, activeServices,
        bookingsCur, bookingsPrev, tasksCur, tasksPrev,
        completedBookings, completedTasks, completedBookingsPrev, completedTasksPrev,
        usersCur, usersPrev, revCur, revPrev, offersCur
    ] = await Promise.all([
        User.countDocuments({ role: "customer" }),
        User.countDocuments({ role: "vendor" }),
        User.countDocuments({ role: "taskRunner" }),
        User.countDocuments({ role: { $in: ["vendor", "taskRunner"] }, status: "pending" }),
        Service.countDocuments(),
        Service.countDocuments({ status: "active" }),
        Booking.countDocuments(inRange("createdAt", from, to)),
        Booking.countDocuments(inRange("createdAt", prevFrom, prevTo)),
        Task.countDocuments(inRange("createdAt", from, to)),
        Task.countDocuments(inRange("createdAt", prevFrom, prevTo)),
        Booking.countDocuments({ ...inRange("createdAt", from, to), status: "completed" }),
        Task.countDocuments({ ...inRange("createdAt", from, to), status: "completed" }),
        Booking.countDocuments({ ...inRange("createdAt", prevFrom, prevTo), status: "completed" }),
        Task.countDocuments({ ...inRange("createdAt", prevFrom, prevTo), status: "completed" }),
        User.countDocuments({ ...inRange("createdAt", from, to), role: { $ne: "admin" } }),
        User.countDocuments({ ...inRange("createdAt", prevFrom, prevTo), role: { $ne: "admin" } }),
        revenueIn(from, to),
        revenueIn(prevFrom, prevTo),
        Offer.countDocuments(inRange("createdAt", from, to))
    ]);

    const [bookingSeries, taskSeries, userSeries, revenueSeries, bookingStatus, taskStatus] = await Promise.all([
        Booking.aggregate([{ $match: inRange("createdAt", from, to) }, { $group: { _id: { $dateToString: { format: bucket, date: "$createdAt" } }, n: { $sum: 1 } } }]),
        Task.aggregate([{ $match: inRange("createdAt", from, to) }, { $group: { _id: { $dateToString: { format: bucket, date: "$createdAt" } }, n: { $sum: 1 } } }]),
        User.aggregate([{ $match: { ...inRange("createdAt", from, to), role: { $ne: "admin" } } }, { $group: { _id: { $dateToString: { format: bucket, date: "$createdAt" } }, n: { $sum: 1 } } }]),
        Transaction.aggregate([
            { $match: paidMatch(from, to) },
            { $group: { _id: { $dateToString: { format: bucket, date: { $ifNull: ["$paidAt", "$createdAt"] } } }, revenue: { $sum: "$amount" }, commission: { $sum: { $ifNull: ["$platformCommission", 0] } } } }
        ]),
        Booking.aggregate([{ $match: inRange("createdAt", from, to) }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
        Task.aggregate([{ $match: inRange("createdAt", from, to) }, { $group: { _id: "$status", n: { $sum: 1 } } }])
    ]);

    // zero-filled timeline so charts have a continuous axis
    const keys = [];
    if (bucket === "%Y-%m") {
        const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
        while (d <= to) { keys.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
    } else {
        for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t <= to.getTime(); t += DAY) keys.push(new Date(t).toISOString().slice(0, 10));
    }
    const map = (rows, field = "n") => Object.fromEntries(rows.map((r) => [r._id, r[field]]));
    const b = map(bookingSeries), t = map(taskSeries), u = map(userSeries), rv = map(revenueSeries, "revenue"), cm = map(revenueSeries, "commission");
    const timeline = keys.map((k) => ({ date: k, bookings: b[k] || 0, tasks: t[k] || 0, newUsers: u[k] || 0, revenue: rv[k] || 0, commission: cm[k] || 0 }));

    // ----- rankings (period-scoped) -----
    const [hotServices, popularTasks, custBookings, custTasks, custSpend, topVendors, topRunners] = await Promise.all([
        Booking.aggregate([
            { $match: inRange("createdAt", from, to) },
            { $group: { _id: "$service", bookings: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] } } } },
            { $sort: { bookings: -1, revenue: -1 } }, { $limit: 8 },
            { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
            { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "users", localField: "service.vendor", foreignField: "_id", as: "vendor" } },
            { $project: { _id: 1, bookings: 1, completed: 1, revenue: 1, title: { $ifNull: ["$service.title", "Removed service"] }, category: "$service.category", vendor: { $arrayElemAt: ["$vendor.name", 0] } } }
        ]),
        Task.aggregate([
            { $match: inRange("createdAt", from, to) },
            { $group: { _id: "$category", requests: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, avgBudget: { $avg: "$budget" } } },
            { $sort: { requests: -1 } }, { $limit: 8 }
        ]),
        Booking.aggregate([{ $match: inRange("createdAt", from, to) }, { $group: { _id: "$customer", n: { $sum: 1 } } }]),
        Task.aggregate([{ $match: inRange("createdAt", from, to) }, { $group: { _id: "$customer", n: { $sum: 1 } } }]),
        Transaction.aggregate([{ $match: { ...paidMatch(from, to), customer: { $ne: null } } }, { $group: { _id: "$customer", spent: { $sum: "$amount" } } }]),
        Booking.aggregate([
            { $match: inRange("createdAt", from, to) },
            { $group: { _id: "$vendor", received: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, earnings: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] } } } },
            { $sort: { completed: -1, received: -1 } }, { $limit: 8 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
            { $project: { received: 1, completed: 1, earnings: 1, name: { $arrayElemAt: ["$u.name", 0] }, email: { $arrayElemAt: ["$u.email", 0] }, image: { $arrayElemAt: ["$u.profileImage", 0] } } }
        ]),
        Task.aggregate([
            { $match: { ...inRange("createdAt", from, to), assignedRunner: { $ne: null } } },
            { $group: { _id: "$assignedRunner", assigned: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, earnings: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, { $ifNull: ["$agreedAmount", "$budget"] }, 0] } } } },
            { $sort: { completed: -1, assigned: -1 } }, { $limit: 8 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
            { $project: { assigned: 1, completed: 1, earnings: 1, name: { $arrayElemAt: ["$u.name", 0] }, email: { $arrayElemAt: ["$u.email", 0] }, image: { $arrayElemAt: ["$u.profileImage", 0] } } }
        ])
    ]);

    const cust = new Map();
    const bump = (id, key, v) => { const k = String(id); const r = cust.get(k) || { id: k, bookings: 0, tasks: 0, spent: 0 }; r[key] += v; cust.set(k, r); };
    custBookings.forEach((r) => bump(r._id, "bookings", r.n));
    custTasks.forEach((r) => bump(r._id, "tasks", r.n));
    custSpend.forEach((r) => bump(r._id, "spent", r.spent));
    const topCustRaw = [...cust.values()].map((c) => ({ ...c, orders: c.bookings + c.tasks })).sort((a, z) => z.orders - a.orders || z.spent - a.spent).slice(0, 8);
    const custUsers = await User.find({ _id: { $in: topCustRaw.map((c) => c.id) } }).select("name email profileImage").lean();
    const byId = Object.fromEntries(custUsers.map((u) => [String(u._id), u]));
    const topCustomers = topCustRaw.map((c) => ({ ...c, name: byId[c.id]?.name || "Deleted user", email: byId[c.id]?.email || "", image: byId[c.id]?.profileImage || "" }));

    // ----- recent activity (global, newest first) -----
    const [ru, rb, rt, rx] = await Promise.all([
        User.find({ role: { $ne: "admin" } }).sort({ createdAt: -1 }).limit(6).select("name role status createdAt").lean(),
        Booking.find().sort({ createdAt: -1 }).limit(6).populate("customer", "name").populate("service", "title").select("status amount createdAt customer service").lean(),
        Task.find().sort({ createdAt: -1 }).limit(6).populate("customer", "name").select("title status budget createdAt customer").lean(),
        Transaction.find({ status: "paid" }).sort({ paidAt: -1, createdAt: -1 }).limit(6).select("type amount paidAt createdAt").lean()
    ]);
    const roleLabel = { customer: "customer", vendor: "vendor", taskRunner: "task runner" };
    const activity = [
        ...ru.map((u) => ({ kind: "user", at: u.createdAt, title: `${u.name} joined as a ${roleLabel[u.role] || u.role}`, meta: u.status === "pending" ? "Awaiting approval" : "" })),
        ...rb.map((x) => ({ kind: "booking", at: x.createdAt, title: `${x.customer?.name || "A customer"} booked ${x.service?.title || "a service"}`, meta: `${x.status} · PKR ${Number(x.amount || 0).toLocaleString()}` })),
        ...rt.map((x) => ({ kind: "task", at: x.createdAt, title: `${x.customer?.name || "A customer"} posted “${x.title}”`, meta: `${x.status} · budget PKR ${Number(x.budget || 0).toLocaleString()}` })),
        ...rx.map((x) => ({ kind: "payment", at: x.paidAt || x.createdAt, title: `${x.type === "taskPayment" ? "Task" : "Booking"} payment settled`, meta: `PKR ${Number(x.amount || 0).toLocaleString()}` }))
    ].sort((a, z) => new Date(z.at) - new Date(a.at)).slice(0, 12);

    return {
        range: { from, to, days, previous: { from: prevFrom, to: prevTo }, granularity: bucket === "%Y-%m" ? "month" : "day" },
        totals: {
            customers, vendors, taskRunners: runners, pendingApprovals, services, activeServices,
            bookings: bookingsCur, tasks: tasksCur, offers: offersCur,
            completedOrders: completedBookings + completedTasks,
            completedBookings, completedTasks,
            revenue: revCur.volume, commission: revCur.commission, paidTransactions: revCur.count, newUsers: usersCur
        },
        comparison: {
            bookings: compare(bookingsCur, bookingsPrev),
            tasks: compare(tasksCur, tasksPrev),
            completedOrders: compare(completedBookings + completedTasks, completedBookingsPrev + completedTasksPrev),
            revenue: compare(revCur.volume, revPrev.volume),
            commission: compare(revCur.commission, revPrev.commission),
            newUsers: compare(usersCur, usersPrev)
        },
        timeline,
        statuses: {
            bookings: bookingStatus.map((r) => ({ status: r._id, count: r.n })),
            tasks: taskStatus.map((r) => ({ status: r._id, count: r.n }))
        },
        rankings: { hotServices, popularTasks, topCustomers, topVendors, topRunners },
        activity
    };
}

module.exports = { buildAnalytics, parseRange, inRange, paidMatch, DAY };
