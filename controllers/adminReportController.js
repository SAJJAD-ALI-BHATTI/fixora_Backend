const crypto = require("crypto");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Task = require("../models/Task");
const Transaction = require("../models/Transaction");
const ReportLog = require("../models/ReportLog");
const { CATEGORIES, buildReport } = require("../utils/reportBuilder");
const { buildReportPdf } = require("../utils/reportPdf");
const { buildReportXlsx } = require("../utils/reportExcel");

const PREVIEW_ROWS = 100;
const secret = () => process.env.REPORT_SECRET || process.env.JWT_SECRET || "fixora-report-secret";
const sign = (id, checksum, at) => crypto.createHmac("sha256", secret()).update(`${id}.${checksum}.${new Date(at).toISOString()}`).digest("hex");
const clientUrl = () => String(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
const verifyUrlFor = (id) => `${clientUrl()}/verify/report/${id}`;

function newReportId(now) {
    const d = now.toISOString().slice(0, 10).replace(/-/g, "");
    return `FXR-${d}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

const categories = (req, res) => {
    res.json({ success: true, data: { categories: Object.entries(CATEGORIES).map(([id, c]) => ({ id, ...c })) } });
};

// Preview: same data as the export, without issuing a reference number.
const previewReport = async (req, res, next) => {
    try {
        const report = await buildReport(req.body || {});
        const shown = report.rows.slice(0, PREVIEW_ROWS);
        res.json({ success: true, data: { report: { ...report, description: CATEGORIES[report.category].description, rows: shown, previewTruncated: report.rows.length > shown.length, rowsInExport: report.rows.length } } });
    } catch (e) { next(e); }
};

// Generate: issues a reference, logs it, and returns JSON (for print), PDF or XLSX.
const generateReport = async (req, res, next) => {
    try {
        const format = ["pdf", "xlsx", "json"].includes(req.body?.format) ? req.body.format : "json";
        const built = await buildReport(req.body || {});
        const now = new Date();
        const reportId = newReportId(now);
        const checksum = crypto.createHash("sha256").update(JSON.stringify({ c: built.category, p: built.period, f: built.filters, k: built.columns.map((c) => c.key), r: built.rows, s: built.summary })).digest("hex");
        const signature = sign(reportId, checksum, now);

        await ReportLog.create({
            reportId, category: built.category, title: built.title, filters: built.filters, period: { from: built.period.from, to: built.period.to },
            generatedBy: req.user._id, generatedByName: req.user.name, generatedAt: now, format, rowCount: built.rows.length, checksum, signature
        });

        const report = { ...built, description: CATEGORIES[built.category].description, reportId, generatedAt: now, generatedByName: req.user.name, checksum, verifyUrl: verifyUrlFor(reportId) };
        const base = `Fixora-${built.category}-${reportId}`;

        if (format === "pdf") {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${base}.pdf"`);
            res.setHeader("X-Report-Id", reportId);
            res.setHeader("Access-Control-Expose-Headers", "X-Report-Id, Content-Disposition");
            return res.send(buildReportPdf(report, { verifyUrl: report.verifyUrl }));
        }
        if (format === "xlsx") {
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
            res.setHeader("X-Report-Id", reportId);
            res.setHeader("Access-Control-Expose-Headers", "X-Report-Id, Content-Disposition");
            return res.send(buildReportXlsx(report, { verifyUrl: report.verifyUrl }));
        }
        res.json({ success: true, data: { report } });
    } catch (e) { next(e); }
};

// Public: confirm a report reference was really issued by this platform.
const verifyReport = async (req, res, next) => {
    try {
        const id = String(req.params.id || "").trim().toUpperCase();
        const log = /^FXR-\d{8}-[A-F0-9]{6}$/.test(id) ? await ReportLog.findOne({ reportId: id }).lean() : null;
        if (!log) return res.status(404).json({ success: false, valid: false, message: "No report with this reference was issued by Fixora." });
        const valid = sign(log.reportId, log.checksum, log.generatedAt) === log.signature;
        const code = String(req.query.code || "").trim().toUpperCase();
        res.json({
            success: true,
            data: {
                valid,
                reportId: log.reportId, title: log.title, category: log.category, period: log.period, generatedAt: log.generatedAt, rowCount: log.rowCount,
                integrityCode: log.checksum.slice(0, 16).toUpperCase(),
                codeChecked: Boolean(code), codeMatches: code ? log.checksum.toUpperCase().startsWith(code.replace(/[^A-F0-9]/g, "")) && code.length >= 8 : null
            }
        });
    } catch (e) { next(e); }
};

// ---- legacy endpoints kept for backwards compatibility ----
const reportData = async () => {
    const [users, bookings, tasks, payments] = await Promise.all([
        User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Task.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Transaction.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, amount: { $sum: "$amount" }, commission: { $sum: { $ifNull: ["$platformCommission", 0] } }, count: { $sum: 1 } } }])
    ]);
    return { users, bookings, tasks, payments: payments[0] || { amount: 0, commission: 0, count: 0 } };
};
const getReportData = async (req, res, next) => { try { res.json({ success: true, data: await reportData() }); } catch (e) { next(e); } };
const downloadReportPdf = (req, res, next) => { req.body = { category: "overview", format: "pdf", ...req.query }; return generateReport(req, res, next); };

module.exports = { categories, previewReport, generateReport, verifyReport, getReportData, downloadReportPdf };
