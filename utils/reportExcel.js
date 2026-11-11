const { buildXlsx, S } = require("./xlsxWriter");
const { fmtStamp, fmtDate } = require("./reportPdf");

function buildReportXlsx(report, { verifyUrl }) {
    const f = Object.entries(report.filters || {}).map(([k, v]) => `${k}: ${v}`).join(" | ") || "None (all records)";
    const summary = [
        [{ v: "FIXORA", s: S.band }, { v: "", s: S.band }, { v: "", s: S.band }],
        [{ v: report.title, s: S.title }],
        [{ v: report.description || "", s: S.muted }],
        [],
        [{ v: "Report reference", s: S.label }, report.reportId],
        [{ v: "Generated", s: S.label }, fmtStamp(report.generatedAt)],
        [{ v: "Reporting period", s: S.label }, `${fmtDate(report.period.from)} to ${fmtDate(report.period.to)} (${report.period.days} days)`],
        [{ v: "Prepared for", s: S.label }, report.generatedByName || "Administrator"],
        [{ v: "Filters applied", s: S.label }, f],
        [{ v: "Records", s: S.label }, `${report.rows.length}${report.truncated ? ` of ${report.totalRows} (truncated)` : ""}`],
        [],
        [{ v: "Key figures", s: S.head }, { v: "", s: S.head }],
        ...report.summary.map((it) => [it.label, { v: it.value, s: S.cell }]),
        [],
        [{ v: "System-generated verification", s: S.head }, { v: "", s: S.head }],
        [{ v: "Integrity code", s: S.label }, report.checksum.slice(0, 16).toUpperCase()],
        [{ v: "Verify online", s: S.label }, verifyUrl],
        [{ v: "This workbook was produced automatically by the Fixora platform. It is a system-generated reference and NOT a legally certified signature or notarised document.", s: S.muted }]
    ];
    const head = report.columns.map((c) => ({ v: c.label, s: S.head }));
    const data = [head, ...report.rows.map((r) => report.columns.map((c) => {
        const v = r[c.key];
        if (c.type === "money") return { v: Number(v || 0), s: S.money };
        if (c.type === "number") return { v: Number(v || 0), s: S.number };
        if (c.type === "date") return { v: v ? new Date(v) : "", s: S.date };
        return { v: v ?? "", s: S.cell };
    }))];
    return buildXlsx([
        { name: "Summary", rows: summary, widths: [26, 70, 20] },
        { name: "Data", rows: data, widths: report.columns.map((c) => Math.round((c.w || 1) * 12)), freezeRow: 1 }
    ]);
}

module.exports = { buildReportXlsx };
