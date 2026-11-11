// Minimal dependency-free PDF writer (A4, Helvetica, vector drawing). Coordinates use a top-left origin.
const zlib = require("zlib");

const PW = 595.28, PH = 841.89;

// Helvetica / Helvetica-Bold advance widths for ASCII 32..126 (per 1000 em)
const REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const REPLACE = { "“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-", "…": "...", "•": "·", "₨": "Rs", " ": " " };
function clean(str) {
    return String(str ?? "").replace(/[“”‘’–—…•₨ ]/g, (c) => REPLACE[c]).replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e¡-ÿ]/g, "?");
}
function textWidth(str, size, bold = false) {
    const t = bold ? BLD : REG;
    let w = 0;
    for (const ch of clean(str)) { const c = ch.charCodeAt(0); w += c >= 32 && c <= 126 ? t[c - 32] : 556; }
    return (w * size) / 1000;
}
function fit(str, size, maxW, bold = false) {
    let s = clean(str);
    if (textWidth(s, size, bold) <= maxW) return s;
    while (s.length > 1 && textWidth(`${s}...`, size, bold) > maxW) s = s.slice(0, -1);
    return `${s.trimEnd()}...`;
}
const esc = (s) => clean(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const n = (v) => (Math.round(v * 100) / 100).toString();
function rgb(hex) {
    const h = String(hex || "#000000").replace("#", "");
    return [0, 2, 4].map((i) => n(parseInt(h.slice(i, i + 2), 16) / 255)).join(" ");
}

class PdfDoc {
    constructor(info = {}) { this.pages = []; this.info = info; this.cur = null; }
    addPage() { this.cur = []; this.pages.push(this.cur); return this.pages.length - 1; }
    use(i) { this.cur = this.pages[i]; }
    op(s) { this.cur.push(s); }

    rect(x, y, w, h, { fill, stroke, lw = 0.8, r = 0 } = {}) {
        const Y = PH - y - h;
        if (fill) this.op(`${rgb(fill)} rg`);
        if (stroke) this.op(`${rgb(stroke)} RG ${n(lw)} w`);
        const paint = fill && stroke ? "B" : fill ? "f" : stroke ? "S" : "n";
        if (!r) { this.op(`${n(x)} ${n(Y)} ${n(w)} ${n(h)} re ${paint}`); return; }
        const k = 0.5523 * r;
        const x2 = x + w, y2 = Y + h;
        this.op([
            `${n(x + r)} ${n(Y)} m`, `${n(x2 - r)} ${n(Y)} l`, `${n(x2 - r + k)} ${n(Y)} ${n(x2)} ${n(Y + r - k)} ${n(x2)} ${n(Y + r)} c`,
            `${n(x2)} ${n(y2 - r)} l`, `${n(x2)} ${n(y2 - r + k)} ${n(x2 - r + k)} ${n(y2)} ${n(x2 - r)} ${n(y2)} c`,
            `${n(x + r)} ${n(y2)} l`, `${n(x + r - k)} ${n(y2)} ${n(x)} ${n(y2 - r + k)} ${n(x)} ${n(y2 - r)} c`,
            `${n(x)} ${n(Y + r)} l`, `${n(x)} ${n(Y + r - k)} ${n(x + r - k)} ${n(Y)} ${n(x + r)} ${n(Y)} c`, `h ${paint}`
        ].join("\n"));
    }
    circle(cx, cy, r, opts = {}) {
        const { fill, stroke, lw = 0.8 } = opts;
        const k = 0.5523 * r, X = cx, Y = PH - cy;
        if (fill) this.op(`${rgb(fill)} rg`);
        if (stroke) this.op(`${rgb(stroke)} RG ${n(lw)} w`);
        const paint = fill && stroke ? "B" : fill ? "f" : stroke ? "S" : "n";
        this.op([`${n(X + r)} ${n(Y)} m`, `${n(X + r)} ${n(Y + k)} ${n(X + k)} ${n(Y + r)} ${n(X)} ${n(Y + r)} c`, `${n(X - k)} ${n(Y + r)} ${n(X - r)} ${n(Y + k)} ${n(X - r)} ${n(Y)} c`,
            `${n(X - r)} ${n(Y - k)} ${n(X - k)} ${n(Y - r)} ${n(X)} ${n(Y - r)} c`, `${n(X + k)} ${n(Y - r)} ${n(X + r)} ${n(Y - k)} ${n(X + r)} ${n(Y)} c h ${paint}`].join("\n"));
    }
    line(x1, y1, x2, y2, { color = "#000000", lw = 0.8, cap = 0, dash } = {}) {
        this.op(`${rgb(color)} RG ${n(lw)} w ${cap} J ${dash ? `[${dash}] 0 d` : "[] 0 d"} ${n(x1)} ${n(PH - y1)} m ${n(x2)} ${n(PH - y2)} l S [] 0 d`);
    }
    text(x, y, str, { size = 10, bold = false, color = "#111827", align = "left" } = {}) {
        const s = clean(str);
        const w = textWidth(s, size, bold);
        const X = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
        this.op(`BT /${bold ? "F2" : "F1"} ${n(size)} Tf ${rgb(color)} rg ${n(X)} ${n(PH - y)} Td (${esc(s)}) Tj ET`);
    }

    build() {
        const objs = [];
        const add = (b) => { objs.push(Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1")); return objs.length; };
        add("<< /Type /Catalog /Pages 2 0 R >>");
        add(""); // pages placeholder (index 2)
        add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
        const kids = [];
        for (const ops of this.pages) {
            const stream = zlib.deflateSync(Buffer.from(ops.join("\n"), "latin1"));
            const contentId = objs.length + 2;
            const pageId = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(PW)} ${n(PH)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
            add(Buffer.concat([Buffer.from(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream", "latin1")]));
            kids.push(`${pageId} 0 R`);
        }
        objs[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`, "latin1");
        const d = (this.info.date || new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14);
        const infoId = add(`<< /Title (${esc(this.info.title || "Fixora Report")}) /Author (${esc(this.info.author || "Fixora")}) /Producer (Fixora Report Engine) /Subject (${esc(this.info.subject || "")}) /CreationDate (D:${d}Z) >>`);

        const parts = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
        const offsets = [];
        let pos = parts[0].length;
        objs.forEach((o, i) => {
            offsets.push(pos);
            const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), o, Buffer.from("\nendobj\n", "latin1")]);
            parts.push(b); pos += b.length;
        });
        let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
        offsets.forEach((o) => { xref += `${String(o).padStart(10, "0")} 00000 n \n`; });
        xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${pos}\n%%EOF`;
        parts.push(Buffer.from(xref, "latin1"));
        return Buffer.concat(parts);
    }
}

module.exports = { PdfDoc, PW, PH, textWidth, fit, clean };
