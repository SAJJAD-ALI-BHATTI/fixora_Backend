const User = require("../models/User");
const Booking = require("../models/Booking");
const Task = require("../models/Task");
const Transaction = require("../models/Transaction");

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

function escapePdf(text) { return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function buildPdf(lines) {
  const content = ["BT", "/F1 11 Tf", "50 760 Td", "14 TL", ...lines.map((line, i) => `${i ? "T* " : ""}(${escapePdf(line)}) Tj`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj, i) => { offsets[i + 1] = Buffer.byteLength(pdf, "utf8"); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "utf8"); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf, "utf8");
}

const downloadReportPdf = async (req, res, next) => {
  try {
    const data = await reportData(); const lines = [
      "FIXORA MARKETPLACE REPORT", `Generated: ${new Date().toLocaleString()}`, "",
      "FINANCIAL SUMMARY", `Paid transaction volume: PKR ${Number(data.payments.amount || 0).toLocaleString()}`, `Platform commission: PKR ${Number(data.payments.commission || 0).toLocaleString()}`, `Paid transactions: ${data.payments.count || 0}`, "",
      "USERS BY ROLE", ...data.users.map(x => `${x._id}: ${x.count}`), "", "BOOKINGS BY STATUS", ...data.bookings.map(x => `${x._id}: ${x.count}`), "", "TASKS BY STATUS", ...data.tasks.map(x => `${x._id}: ${x.count}`)
    ];
    const pdf = buildPdf(lines.slice(0, 48)); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename=fixora-report-${Date.now()}.pdf`); res.send(pdf);
  } catch (e) { next(e); }
};
module.exports = { getReportData, downloadReportPdf };
