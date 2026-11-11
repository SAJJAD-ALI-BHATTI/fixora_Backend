const { PdfDoc, PW, PH, textWidth, fit } = require("./pdfWriter");

const NAVY = "#0F1B2D", ORANGE = "#C2410C", INK = "#1F2937", MUTED = "#6B7280", LINE = "#E5E7EB", ZEBRA = "#F7F8FA", SOFT = "#FFF7ED";
const M = 40, CW = PW - M * 2;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (v) => String(v).padStart(2, "0");
const fmtDate = (d) => { if (!d) return "-"; const x = new Date(d); return `${p2(x.getUTCDate())} ${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const fmtStamp = (d) => { const x = new Date(d); return `${fmtDate(x)}, ${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())} UTC`; };
const num = (v) => Math.round(Number(v || 0)).toLocaleString("en-US");

function cellText(col, v) {
    if (v === null || v === undefined || v === "") return "-";
    if (col.type === "money") return num(v);
    if (col.type === "number") return num(v);
    if (col.type === "date") return fmtDate(v);
    return String(v);
}

/** Fixora logo mark: orange rounded square with a stylised wrench. */
function logo(doc, x, y, s = 30) {
    doc.rect(x, y, s, s, { fill: ORANGE, r: s * 0.26 });
    const u = s / 24;
    doc.line(x + 7.2 * u, y + 17 * u, x + 14 * u, y + 10.2 * u, { color: "#FFFFFF", lw: 3.2 * u, cap: 1 });
    doc.circle(x + 15.4 * u, y + 8.6 * u, 4.6 * u, { fill: "#FFFFFF" });
    doc.rect(x + 16.4 * u, y + 3.4 * u, 3.4 * u, 3.6 * u, { fill: ORANGE });
}

function header(doc, report, first) {
    logo(doc, M, 30, first ? 34 : 24);
    doc.text(M + (first ? 44 : 33), first ? 53 : 47, "Fixora", { size: first ? 18 : 13, bold: true, color: NAVY });
    if (first) doc.text(M + 44, 66, "Hyperlocal services marketplace", { size: 8, color: MUTED });
    doc.text(PW - M, first ? 50 : 44, first ? "OFFICIAL SYSTEM REPORT" : report.title, { size: first ? 8 : 8.5, bold: true, color: first ? ORANGE : MUTED, align: "right" });
    doc.text(PW - M, first ? 63 : 56, `Ref. ${report.reportId}`, { size: 8, color: MUTED, align: "right" });
    doc.line(M, first ? 78 : 66, PW - M, first ? 78 : 66, { color: ORANGE, lw: 1.4 });
}

function metaBlock(doc, report, y) {
    const f = report.filters || {};
    const filterText = Object.entries(f).map(([k, v]) => `${k}: ${v}`).join("  |  ") || "None (all records)";
    doc.text(M, y + 4, report.title, { size: 21, bold: true, color: NAVY });
    doc.text(M, y + 22, report.description || "", { size: 9.5, color: MUTED });
    const rows = [
        ["Report reference", report.reportId], ["Generated", fmtStamp(report.generatedAt)],
        ["Reporting period", `${fmtDate(report.period.from)}  to  ${fmtDate(report.period.to)}  (${report.period.days} days)`],
        ["Prepared for", report.generatedByName || "Administrator"], ["Filters applied", filterText],
        ["Records", `${num(report.rows.length)} shown${report.truncated ? ` of ${num(report.totalRows)} (list truncated)` : ""}`]
    ];
    const top = y + 36, rh = 17;
    doc.rect(M, top, CW, rows.length * rh + 8, { fill: ZEBRA, stroke: LINE, lw: 0.6, r: 6 });
    rows.forEach(([k, v], i) => {
        doc.text(M + 12, top + 17 + i * rh - 1, k.toUpperCase(), { size: 6.8, bold: true, color: MUTED });
        doc.text(M + 112, top + 17 + i * rh - 1, fit(v, 9, CW - 124), { size: 9, color: INK });
    });
    return top + rows.length * rh + 8 + 14;
}

function summaryCards(doc, items, y) {
    if (!items?.length) return y;
    const cols = items.length <= 4 ? items.length : items.length <= 6 ? 3 : 5;
    const gap = 8, w = (CW - gap * (cols - 1)) / cols, h = 46;
    items.forEach((it, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = M + c * (w + gap), yy = y + r * (h + gap);
        doc.rect(x, yy, w, h, { fill: "#FFFFFF", stroke: LINE, lw: 0.8, r: 6 });
        doc.rect(x, yy + 8, 2.4, h - 16, { fill: ORANGE });
        doc.text(x + 10, yy + 16, fit(it.label.toUpperCase(), 6.6, w - 16, true), { size: 6.6, bold: true, color: MUTED });
        doc.text(x + 10, yy + 35, fit(it.value, 13, w - 16, true), { size: 13, bold: true, color: NAVY });
    });
    const rowsN = Math.ceil(items.length / cols);
    return y + rowsN * (h + gap) + 6;
}

function barChart(doc, chart, y) {
    const items = (chart?.items || []).filter((i) => Number.isFinite(i.value)).slice(0, 8);
    if (!items.length) return y;
    const max = Math.max(...items.map((i) => i.value), 1);
    const labelW = 120, valW = 70, barX = M + 12 + labelW, barW = CW - 24 - labelW - valW, rh = 16;
    const h = 30 + items.length * rh;
    doc.rect(M, y, CW, h, { stroke: LINE, lw: 0.8, r: 6 });
    doc.text(M + 12, y + 17, chart.title, { size: 9, bold: true, color: NAVY });
    items.forEach((it, i) => {
        const yy = y + 30 + i * rh;
        doc.text(M + 12, yy + 7, fit(it.label, 8, labelW - 6), { size: 8, color: INK });
        doc.rect(barX, yy, barW, 9, { fill: "#F1F2F4", r: 2 });
        if (it.value > 0) doc.rect(barX, yy, Math.max(3, (it.value / max) * barW), 9, { fill: i === 0 ? ORANGE : NAVY, r: 2 });
        doc.text(PW - M - 12, yy + 7.4, num(it.value), { size: 8, bold: true, color: INK, align: "right" });
    });
    return y + h + 14;
}

function stamp(doc, report, y, verifyUrl) {
    const h = 96;
    doc.rect(M, y, CW, h, { fill: SOFT, stroke: ORANGE, lw: 1, r: 8 });
    const cx = M + 52, cy = y + h / 2;
    doc.circle(cx, cy, 36, { stroke: ORANGE, lw: 1.6 });
    doc.circle(cx, cy, 31, { stroke: ORANGE, lw: 0.6 });
    doc.text(cx, cy - 7, "FIXORA", { size: 11, bold: true, color: ORANGE, align: "center" });
    doc.line(cx - 22, cy - 2, cx + 22, cy - 2, { color: ORANGE, lw: 0.6 });
    doc.text(cx, cy + 8, "SYSTEM", { size: 6.6, bold: true, color: ORANGE, align: "center" });
    doc.text(cx, cy + 16, "GENERATED", { size: 6.6, bold: true, color: ORANGE, align: "center" });
    const tx = M + 106;
    doc.text(tx, y + 20, "System-generated verification mark", { size: 10, bold: true, color: NAVY });
    doc.text(tx, y + 34, `Report ID  ${report.reportId}`, { size: 8.5, bold: true, color: INK });
    doc.text(tx, y + 46, `Integrity code  ${report.checksum.slice(0, 16).toUpperCase()}`, { size: 8.5, color: INK });
    doc.text(tx, y + 58, fit(`Verify online  ${verifyUrl}`, 8.5, CW - 118), { size: 8.5, color: ORANGE });
    doc.text(tx, y + 74, fit("This mark shows the report was produced by the Fixora platform at the time above.", 7.4, CW - 118), { size: 7.4, color: MUTED });
    doc.text(tx, y + 84, fit("It is an automated reference only - NOT a legally certified signature, seal or notarised document.", 7.4, CW - 118), { size: 7.4, bold: true, color: MUTED });
    return y + h + 10;
}

function buildReportPdf(report, { verifyUrl }) {
    const doc = new PdfDoc({ title: `${report.title} (${report.reportId})`, subject: `Fixora report ${report.reportId}`, date: new Date(report.generatedAt) });
    const BOTTOM = PH - 56;
    const cols = report.columns;
    const totalW = cols.reduce((a, c) => a + (c.w || 1), 0);
    const widths = cols.map((c) => ((c.w || 1) / totalW) * CW);
    const rowH = 17;

    doc.addPage();
    header(doc, report, true);
    let y = metaBlock(doc, report, 92);
    y = summaryCards(doc, report.summary, y);
    y = barChart(doc, report.chart, y);

    const drawHead = () => {
        doc.rect(M, y, CW, 20, { fill: NAVY, r: 3 });
        let x = M;
        cols.forEach((c, i) => {
            const right = c.type === "money" || c.type === "number";
            doc.text(right ? x + widths[i] - 5 : x + 5, y + 13.5, fit(c.label.toUpperCase(), 6.6, widths[i] - 10, true), { size: 6.8, bold: true, color: "#FFFFFF", align: right ? "right" : "left" });
            x += widths[i];
        });
        y += 20;
    };

    if (report.rows.length === 0) {
        doc.rect(M, y, CW, 50, { fill: ZEBRA, stroke: LINE, r: 6 });
        doc.text(PW / 2, y + 29, "No records match the selected period and filters.", { size: 10, color: MUTED, align: "center" });
        y += 64;
    } else {
        doc.text(M, y + 8, "DETAILED RECORDS", { size: 8, bold: true, color: ORANGE });
        y += 16;
        drawHead();
        report.rows.forEach((row, ri) => {
            if (y + rowH > BOTTOM) { doc.addPage(); header(doc, report, false); y = 82; drawHead(); }
            if (ri % 2) doc.rect(M, y, CW, rowH, { fill: ZEBRA });
            let x = M;
            cols.forEach((c, i) => {
                const right = c.type === "money" || c.type === "number";
                const t = fit(cellText(c, row[c.key]), 7.8, widths[i] - 10);
                doc.text(right ? x + widths[i] - 5 : x + 5, y + 11.5, t, { size: 7.8, color: INK, align: right ? "right" : "left" });
                x += widths[i];
            });
            y += rowH;
        });
        doc.line(M, y, PW - M, y, { color: LINE, lw: 0.8 });
        y += 12;
        if (report.truncated) {
            doc.text(M, y + 6, `Note: ${num(report.totalRows)} records matched; the first ${num(report.rows.length)} are listed. Narrow the filters for a complete list.`, { size: 7.8, color: MUTED });
            y += 16;
        }
    }

    if (y + 106 > BOTTOM) { doc.addPage(); header(doc, report, false); y = 84; }
    stamp(doc, report, y + 4, verifyUrl);

    // footers with page numbers
    const total = doc.pages.length;
    for (let i = 0; i < total; i++) {
        doc.use(i);
        doc.line(M, PH - 44, PW - M, PH - 44, { color: LINE, lw: 0.8 });
        doc.text(M, PH - 31, "Fixora  -  System-generated report. Not a legal signature or certified document.", { size: 7, color: MUTED });
        doc.text(M, PH - 21, `Ref ${report.reportId}  |  Integrity ${report.checksum.slice(0, 12).toUpperCase()}  |  Generated ${fmtStamp(report.generatedAt)}`, { size: 7, color: MUTED });
        doc.text(PW - M, PH - 26, `Page ${i + 1} of ${total}`, { size: 8.5, bold: true, color: NAVY, align: "right" });
    }
    return doc.build();
}

module.exports = { buildReportPdf, cellText, fmtDate, fmtStamp };
