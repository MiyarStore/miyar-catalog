import re, copy
from docx import Document
from docx.shared import Pt
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

FONT = "Sakkal Majalla"
DARK, MUTED, TEAL = "24404A", "5A6B70", "2F8F83"
GREEN, ZEBRA, LIGHT, BORDER = "CFEAC2", "F6FBF4", "EEF8EA", "9BBFA9"
W = 10092
SCALE = 0.9
HSCALE = 0.85
AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
GEN = re.compile(r"\{([^{}/]*)/([^{}/]*)\}")


class Doc:
    def __init__(self, template, girls, header_title, sub="ابتدائي • متوسط • ثانوي"):
        self.d = Document(template)
        self.girls = girls
        body = self.d.element.body
        for el in list(body):
            if el.tag != qn("w:sectPr"):
                body.remove(el)
        hdr = self.d.sections[0].header
        p = hdr.paragraphs[0]
        rs = p.runs
        rs[0].text = header_title
        for r in rs[1:]:
            r.text = ""
        if len(rs) > 1:
            rs[1].text = "   |   " + sub
        self.body = body

    def g(self, t):
        t = GEN.sub(lambda m: m.group(2) if self.girls else m.group(1), t)
        return t

    # ---------- low level ----------
    def _rpr(self, r, size, bold, color):
        rpr = r._r.get_or_add_rPr()
        f = OxmlElement("w:rFonts")
        for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
            f.set(qn(a), FONT)
        rpr.insert(0, f)
        if bold:
            for t in ("w:b", "w:bCs"):
                rpr.append(OxmlElement(t))
        c = OxmlElement("w:color"); c.set(qn("w:val"), color); rpr.append(c)
        for t in ("w:sz", "w:szCs"):
            e = OxmlElement(t); e.set(qn("w:val"), str(int(round(size * 2 * SCALE)))); rpr.append(e)
        rpr.append(OxmlElement("w:rtl"))

    def _ppr(self, p, align, before, after, keep=False, line=None):
        ppr = p._p.get_or_add_pPr()
        ppr.append(OxmlElement("w:bidi"))
        if keep:
            ppr.append(OxmlElement("w:keepNext"))
        sp = OxmlElement("w:spacing"); sp.set(qn("w:before"), str(before)); sp.set(qn("w:after"), str(after))
        line = line or 228
        if line:
            sp.set(qn("w:line"), str(line)); sp.set(qn("w:lineRule"), "exact" if line < 100 else "auto")
        ppr.append(sp)
        jc = OxmlElement("w:jc"); jc.set(qn("w:val"), {"right": "left", "left": "right", "center": "center", "both": "both"}[align]); ppr.append(jc)

    def _fill(self, p, text, size, bold, color):
        text = self.g(text)
        parts = re.split(r"(\*\*[^*]+\*\*)", text)
        for part in parts:
            if not part:
                continue
            b = bold
            if part.startswith("**"):
                part, b = part[2:-2], True
            r = p.add_run(part)
            self._rpr(r, size, b, color)

    def P(self, text="", size=11.5, bold=False, color=DARK, align="right", before=0, after=80, keep=False, container=None, line=None):
        if container is None:
            p = self.d.add_paragraph()
        else:
            p = container.add_paragraph()
        self._ppr(p, align, before, after, keep, line)
        if text:
            self._fill(p, text, size, bold, color)
        return p

    def br(self):
        last = self.body[-2] if self.body[-1].tag == qn("w:sectPr") else self.body[-1]
        if last.tag == qn("w:p") and not "".join(last.itertext()).strip():
            self.body.remove(last)
        p = self.d.add_paragraph()
        self._ppr(p, "right", 0, 0, line=20)
        r = p.add_run(); br = OxmlElement("w:br"); br.set(qn("w:type"), "page"); r._r.append(br)

    def bullets(self, items, size=11.5, color=DARK, num=False, after=40):
        for i, it in enumerate(items, 1):
            pre = (str(i).translate(AR) + ".  ") if num else "•  "
            self.P(pre + it, size=size, color=color, after=after)

    # ---------- tables ----------
    def _tbl(self, rows, cols, widths):
        t = self.d.add_table(rows=rows, cols=cols)
        tbl = t._tbl
        tp = tbl.tblPr
        for tag in ("w:tblStyle",):
            for e in tp.findall(qn(tag)):
                tp.remove(e)
        jc = OxmlElement("w:jc"); jc.set(qn("w:val"), "center"); tp.append(jc)
        tp.append(OxmlElement("w:bidiVisual"))
        lay = OxmlElement("w:tblLayout"); lay.set(qn("w:type"), "fixed"); tp.append(lay)
        tw = OxmlElement("w:tblW"); tw.set(qn("w:w"), str(sum(widths))); tw.set(qn("w:type"), "dxa"); tp.append(tw)
        b = OxmlElement("w:tblBorders")
        for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
            e = OxmlElement(f"w:{side}"); e.set(qn("w:val"), "single"); e.set(qn("w:sz"), "4"); e.set(qn("w:color"), BORDER); e.set(qn("w:space"), "0"); b.append(e)
        tp.append(b)
        cm = OxmlElement("w:tblCellMar")
        for side, v in (("top", 30), ("bottom", 30), ("left", 80), ("right", 80)):
            e = OxmlElement(f"w:{side}"); e.set(qn("w:w"), str(v)); e.set(qn("w:type"), "dxa"); cm.append(e)
        tp.append(cm)
        grid = tbl.tblGrid
        for gc, w in zip(grid.findall(qn("w:gridCol")), widths):
            gc.set(qn("w:w"), str(w))
        for row in t.rows:
            for c, w in zip(row.cells, widths):
                tcpr = c._tc.get_or_add_tcPr()
                e = OxmlElement("w:tcW"); e.set(qn("w:w"), str(w)); e.set(qn("w:type"), "dxa"); tcpr.append(e)
        return t

    def _shade(self, cell, fill):
        tcpr = cell._tc.get_or_add_tcPr()
        s = OxmlElement("w:shd"); s.set(qn("w:val"), "clear"); s.set(qn("w:color"), "auto"); s.set(qn("w:fill"), fill); tcpr.append(s)

    def _valign(self, cell):
        tcpr = cell._tc.get_or_add_tcPr()
        v = OxmlElement("w:vAlign"); v.set(qn("w:val"), "center"); tcpr.append(v)

    def _cell(self, cell, text, size, bold, color, align, fill=None):
        if fill:
            self._shade(cell, fill)
        self._valign(cell)
        p = cell.paragraphs[0]
        lines = self.g(text).split("\n") if text else [""]
        for i, ln in enumerate(lines):
            if i:
                p = cell.add_paragraph()
            self._ppr(p, align, 0, 0)
            if ln:
                self._fill(p, ln, size, bold, color)

    def _height(self, row, h):
        trpr = row._tr.get_or_add_trPr()
        e = OxmlElement("w:trHeight"); e.set(qn("w:val"), str(int(h * HSCALE))); e.set(qn("w:hRule"), "atLeast"); trpr.append(e)

    def _cant_split(self, row, header=False):
        trpr = row._tr.get_or_add_trPr()
        trpr.append(OxmlElement("w:cantSplit"))
        if header:
            trpr.append(OxmlElement("w:tblHeader"))

    def table(self, headers, rows, widths, size=10.5, blank=0, h=None, align_first="center", aligns=None, hfill=GREEN, zebra=True, after=120, bold_first=False):
        ncols = len(widths)
        if headers and not any(headers):
            headers = None
        tot = sum(widths); widths = [round(w * W / tot) for w in widths]
        allrows = list(rows) + [[""] * ncols for _ in range(blank)]
        t = self._tbl(len(allrows) + (1 if headers else 0), ncols, widths)
        ri = 0
        if headers:
            r = t.rows[0]; self._cant_split(r, True)
            for c, hd in zip(r.cells, headers):
                self._cell(c, hd, size, True, DARK, "center", hfill)
            ri = 1
        for k, data in enumerate(allrows):
            r = t.rows[ri + k]; self._cant_split(r)
            if h:
                self._height(r, h)
            fill = ZEBRA if (zebra and k % 2 == 1) else None
            for j, (c, val) in enumerate(zip(r.cells, data)):
                al = (aligns[j] if aligns else ("center" if j == 0 else "right"))
                self._cell(c, str(val), size, bold_first and j == 0, DARK, al, fill)
        self.P("", after=after, size=4)
        return t

    def kv(self, pairs, cols=2, size=11, h=420, after=120, lw=1.0, vw=2.0):
        # pairs laid out in `cols` label/value couples per row
        widths = []
        for _ in range(cols):
            widths += [lw, vw]
        tot = sum(widths); widths = [round(w * W / tot) for w in widths]
        nrows = (len(pairs) + cols - 1) // cols
        t = self._tbl(nrows, cols * 2, widths)
        for i, (k, v) in enumerate(pairs):
            r = t.rows[i // cols]; self._height(r, h); self._cant_split(r)
            j = (i % cols) * 2
            self._cell(r.cells[j], k, size, True, DARK, "right", LIGHT)
            self._cell(r.cells[j + 1], v, size, False, DARK, "right")
        self.P("", after=after, size=4)
        return t

    def bar(self, text, sub=None, fill=DARK, color="FFFFFF", size=15, subcolor=GREEN, after=140, pad=120):
        t = self._tbl(1, 1, [W])
        tb = t._tbl.tblPr.find(qn("w:tblBorders"))
        for e in tb:
            e.set(qn("w:val"), "nil")
        c = t.rows[0].cells[0]
        self._shade(c, fill)
        tcpr = c._tc.get_or_add_tcPr()
        mar = OxmlElement("w:tcMar")
        for side, v in (("top", pad), ("bottom", pad)):
            e = OxmlElement(f"w:{side}"); e.set(qn("w:w"), str(v)); e.set(qn("w:type"), "dxa"); mar.append(e)
        tcpr.append(mar)
        p = c.paragraphs[0]; self._ppr(p, "center", 0, 0); self._fill(p, text, size, True, color)
        if sub:
            p2 = c.add_paragraph(); self._ppr(p2, "center", 20, 0); self._fill(p2, sub, 11, False, subcolor)
        self.P("", after=after, size=4)

    def section(self, text, sub=None):
        self.bar(text, sub, fill=DARK, color="FFFFFF", size=16, subcolor=GREEN)

    def form(self, text, sub=None):
        self.bar(text, sub, fill=GREEN, color=DARK, size=14.5, subcolor=TEAL, after=100, pad=70)

    def h(self, text, size=13, color=TEAL, before=80, after=60):
        self.P(text, size=size, bold=True, color=color, before=before, after=after, keep=True)

    def note(self, text, size=10.5):
        t = self._tbl(1, 1, [W])
        c = t.rows[0].cells[0]
        self._cell(c, text, size, False, DARK, "right", LIGHT)
        self.P("", after=100, size=4)

    def sign(self, roles, after=60):
        n = len(roles)
        t = self._tbl(2, n, [W // n] * n)
        tb = t._tbl.tblPr.find(qn("w:tblBorders"))
        for e in tb:
            e.set(qn("w:val"), "nil")
        for c, r in zip(t.rows[0].cells, roles):
            self._cell(c, r, 11, True, DARK, "center")
        for c in t.rows[1].cells:
            self._cell(c, "الاسم: ........................\nالتوقيع: ......................", 10.5, False, MUTED, "center")
        self.P("", after=after, size=4)

    def save(self, path):
        self.d.save(path)
