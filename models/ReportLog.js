const mongoose = require("mongoose");

// Every exported report is logged so its reference number can be verified later.
const reportLogSchema = new mongoose.Schema({
    reportId: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    period: { from: Date, to: Date },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    generatedByName: { type: String, default: "" },
    generatedAt: { type: Date, required: true },
    format: { type: String, default: "json" },
    rowCount: { type: Number, default: 0 },
    checksum: { type: String, required: true },
    signature: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("ReportLog", reportLogSchema);
