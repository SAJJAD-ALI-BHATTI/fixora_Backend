// Minimal .xlsx writer (OOXML in a "stored" zip). No dependencies.
const zlib = require("zlib");

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(files) {
    const local = [], central = [];
    let offset = 0;
    for (const [name, content] of files) {
        const data = Buffer.from(content, "utf8");
        const comp = zlib.deflateRawSync(data);
        const nameBuf = Buffer.from(name, "utf8");
        const crc = crc32(data);
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
        lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
        lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
        local.push(lh, nameBuf, comp);
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
        ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
        ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
        central.push(ch, nameBuf);
        offset += lh.length + nameBuf.length + comp.length;
    }
    const cd = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, cd, end]);
}

const x = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i) => { let s = ""; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const serial = (d) => { const t = new Date(d).getTime(); return Number.isNaN(t) ? null : t / 86400000 + 25569; };

// styles: 0 default, 1 title, 2 header, 3 money, 4 number, 5 date, 6 label, 7 muted, 8 zebra-text
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="dd\\ mmm\\ yyyy"/></numFmts>
<fonts count="5"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF0F1B2D"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF6B7280"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F1B2D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC2410C"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E7EB"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="left"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function sheetXml(rows, { widths = [], freezeRow = 0 } = {}) {
    const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
    const pane = freezeRow ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : "";
    const body = rows.map((cells, r) => {
        const cs = cells.map((c, ci) => {
            if (c === null || c === undefined) return "";
            const ref = `${colName(ci)}${r + 1}`;
            const cell = typeof c === "object" && !(c instanceof Date) ? c : { v: c };
            const s = cell.s ?? 0;
            if (cell.v === "" || cell.v === null || cell.v === undefined) return `<c r="${ref}" s="${s}"/>`;
            if (cell.v instanceof Date) { const n = serial(cell.v); return n === null ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}"><v>${n}</v></c>`; }
            if (typeof cell.v === "number" && Number.isFinite(cell.v)) return `<c r="${ref}" s="${s}"><v>${cell.v}</v></c>`;
            return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${x(cell.v)}</t></is></c>`;
        }).join("");
        return `<row r="${r + 1}"${cells.height ? ` ht="${cells.height}" customHeight="1"` : ""}>${cs}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${body}</sheetData></worksheet>`;
}

function buildXlsx(sheets) {
    const names = sheets.map((s) => x(s.name).slice(0, 31));
    return zip([
        ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
        ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
        ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
        ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
        ["xl/styles.xml", STYLES],
        ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows, s)])
    ]);
}

const S = { cell: 0, title: 1, head: 2, money: 3, number: 4, date: 5, label: 6, muted: 7, band: 8 };
module.exports = { buildXlsx, S };
