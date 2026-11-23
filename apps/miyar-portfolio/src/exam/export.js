// ورقة الاختبار بالشكل المعتاد في مدارس الوزارة: الترويسة، بيانات الطالب، جدول رصد الدرجات، الأسئلة مقسمة حسب النوع،
// ثم النموذج (ب) وورقة التظليل ومفتاح الإجابة وجدول المواصفات. نسخة طباعة (PDF) ونسخة Word قابلة للتعديل.
const docx = require('docx');
const { letterheadHtml, letterheadDocx, LH_CSS, esc, run, para, cell, FONT } = require('../school/export');
const E = require('./exam');

const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
const LET = ['أ', 'ب', 'ج', 'د', 'هـ'];
const mk = (n) => { const v = Math.round(n * 100) / 100; return `${v} ${v === 1 ? 'درجة' : v === 2 ? 'درجتان' : v <= 10 && Number.isInteger(v) ? 'درجات' : 'درجة'}`; };
const dAr = (s) => { if (!s) return ''; try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${s}T12:00:00Z`)); } catch { return s; } };
const durAr = (m) => (!m ? '' : m >= 60 ? `${Math.floor(m / 60) === 1 ? 'ساعة' : Math.floor(m / 60) === 2 ? 'ساعتان' : `${Math.floor(m / 60)} ساعات`}${m % 60 ? ` و${m % 60} دقيقة` : ''}` : `${m} دقيقة`);
const teacherWord = (u) => (u.gender === 'f' ? 'معلمة المادة' : 'معلم المادة');
const studentWord = (u) => (u.gender === 'f' ? 'الطالبة' : 'الطالب');

const CSS = `@page { size: A4; margin: 11mm; }
body { background: #e9eeed; color: #111; font-size: 14px; margin: 0; font-family: 'IBM Plex Sans Arabic', 'Sakkal Majalla', system-ui, sans-serif; }
.toolbar { position: sticky; top: 0; z-index: 5; background: #fff; border-bottom: 1px solid #dfe6e5; padding: 10px 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.page { background: #fff; width: 210mm; max-width: 100%; box-sizing: border-box; margin: 14px auto; padding: 11mm 12mm; box-shadow: 0 2px 12px rgba(0,0,0,.08); position: relative; }
table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #555; padding: 4px 6px; text-align: center; }
.meta td, .meta th { font-size: 13px; } .meta th { background: #eef3f2; width: 13%; font-weight: 600; }
h1 { font-size: 17px; text-align: center; margin: 8px 0 6px; } .model { display: inline-block; border: 1.5px solid #111; border-radius: 6px; padding: 0 10px; margin-inline-start: 6px; }
.stu { margin: 6px 0; } .stu td { text-align: right; height: 26px; } .stu th { background: #eef3f2; width: 14%; }
.grades th { background: #eef3f2; font-size: 12.5px; } .grades td { height: 22px; font-size: 12.5px; }
.inst { border: 1px dashed #777; border-radius: 8px; padding: 6px 10px; margin: 8px 0; font-size: 13px; line-height: 1.8; } .inst b { display: inline; }
.sec { break-inside: avoid-page; margin: 12px 0 4px; } .sec h2 { font-size: 15px; margin: 0 0 6px; padding: 4px 8px; background: #eef3f2; border-inline-start: 4px solid #0f766e; display: flex; justify-content: space-between; gap: 8px; }
.sec h2 span { font-weight: 600; white-space: nowrap; }
.it { break-inside: avoid; margin: 0 0 8px; line-height: 1.75; } .it .n { font-weight: 700; margin-inline-end: 4px; }
.ch { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 10px; margin: 2px 22px 0 0; } .ch.c2 { grid-template-columns: repeat(2, 1fr); } .ch.c1 { grid-template-columns: 1fr; }
.ch span b { margin-inline-end: 4px; }
.tf td { text-align: right; } .tf td.b { width: 48px; text-align: center; } .tf td.n { width: 28px; }
.mt td { text-align: right; vertical-align: top; } .mt td.n, .mt td.b { width: 30px; text-align: center; } .mt th { background: #eef3f2; }
.ln { border-bottom: 1px dotted #888; height: 24px; }
.end { text-align: center; margin-top: 14px; font-weight: 700; } .sig { display: flex; justify-content: space-between; margin-top: 10px; font-size: 13px; }
.foot { position: absolute; bottom: 5mm; left: 0; right: 0; text-align: center; font-size: 11px; color: #555; }
.key td, .key th, .spec td, .spec th { font-size: 12.5px; } .key th, .spec th { background: #0f766e; color: #fff; } .key td.t { text-align: right; }
.spec tfoot td { font-weight: 700; background: #eef3f2; }
.bub td { padding: 3px; font-size: 12.5px; } .bub i { display: inline-grid; place-items: center; width: 20px; height: 20px; border: 1.3px solid #333; border-radius: 50%; font-style: normal; font-size: 11px; margin: 0 2px; }
.bub-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.btn { display: inline-flex; gap: 6px; align-items: center; background: #0f766e; color: #fff; border: 0; padding: 7px 14px; border-radius: 9px; font: inherit; cursor: pointer; text-decoration: none; font-size: 13px; } .btn.ghost { background: #eef5f4; color: #0f766e; }
.muted { color: #555; } .warn { background: #fff7e6; border: 1px solid #f0c36d; border-radius: 8px; padding: 8px 12px; margin: 8px auto; max-width: 210mm; box-sizing: border-box; font-size: 13px; }
${LH_CSS}
@media print { body { background: #fff; } .toolbar, .warn { display: none; } .page { margin: 0; box-shadow: none; width: auto; padding: 0 0 8mm; page-break-after: always; } .foot { bottom: 0; } }`;

const schoolOf = (u, d) => ({ office: u.office, name: u.school, year: d.year || u.year, ministry_number: '' });
const lessonOf = (d) => new Map(d.lessons.map((l) => [l.id, l]));
const levelName = (k) => (E.LEVELS.find((l) => l.key === k) || {}).name || '';

function choicesHtml(c) {
  const long = Math.max(...c.map((x) => x.length));
  const cls = long > 38 ? 'c1' : long > 16 ? 'c2' : '';
  return `<div class="ch ${cls}">${c.map((x, i) => `<span><b>${LET[i]})</b>${esc(x)}</span>`).join('')}</div>`;
}
function sectionHtml(type, items, no, d) {
  const T = E.TYPES[type];
  const marks = items.reduce((a, it) => a + it.mark, 0);
  const head = `<h2>السؤال ${ORD[no] || no + 1}: ${esc(T.head)}<span>(${mk(marks)})</span></h2>`;
  const t = (it) => esc(it.text || '..............................................................');
  if (type === 'tf') return `<div class="sec">${head}<table class="tf">${items.map((it, i) => `<tr><td class="n">${i + 1}</td><td>${t(it)}</td><td class="b">(&nbsp;&nbsp;&nbsp;&nbsp;)</td></tr>`).join('')}</table></div>`;
  if (type === 'match') {
    const col = E.matchColumn(items);
    return `<div class="sec">${head}<table class="mt"><thead><tr><th class="n">م</th><th>العمود (أ)</th><th class="b">الرقم</th><th>العمود (ب)</th></tr></thead><tbody>${col.map((c, i) => `<tr><td class="n">${items[i] ? i + 1 : ''}</td><td>${items[i] ? t(items[i]) : ''}</td><td class="b"></td><td>${esc(c.text || '..........')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const lines = { short: 2, essay: 6 }[type] || 0;
  return `<div class="sec">${head}${items.map((it, i) => `<div class="it"><span class="n">${i + 1})</span>${t(it)}${items.length > 1 && !E.TYPES[type].obj ? ` <span class="muted">(${mk(it.mark)})</span>` : ''}${type === 'mcq' && it.choices.length ? choicesHtml(it.choices) : ''}${lines ? `${'<div class="ln"></div>'.repeat(lines)}` : ''}</div>`).join('')}</div>`;
}

function paperHtml({ u, d, v = 1, model }) {
  const groups = E.version(d, v);
  const total = E.total(d);
  const lh = letterheadHtml(schoolOf(u, d), null);
  const meta = [['المادة', d.subject], ['الصف', d.grade], ['الزمن', durAr(d.duration)], ['التاريخ', d.date ? dAr(d.date) : '...../...../.....']];
  const gradeCols = groups.map((g, i) => ORD[i] || i + 1);
  return `<div class="page">${lh}
  <table class="meta"><tr>${meta.map(([k, val]) => `<th>${k}</th><td>${esc(val) || '&nbsp;'}</td>`).join('')}</tr></table>
  <h1>أسئلة ${esc(E.KINDS[d.kind])}${d.subject ? ` لمادة ${esc(d.subject)}` : ''}${d.term ? ` - ${esc(d.term)}` : ''}${d.year ? ` - العام الدراسي ${esc(d.year)}` : ''}${model ? `<span class="model">النموذج (${model})</span>` : ''}</h1>
  ${d.options.names ? `<table class="stu"><tr><th>اسم ${studentWord(u)}</th><td colspan="3"></td><th>الفصل</th><td style="width:12%"></td><th>رقم الجلوس</th><td style="width:14%"></td></tr></table>` : ''}
  ${d.kind === 'hw' ? '' : `<table class="grades"><tr><th>السؤال</th>${gradeCols.map((c) => `<th>${c}</th>`).join('')}<th>المجموع</th></tr>
    <tr><th>الدرجة</th>${groups.map(() => '<td></td>').join('')}<td>...... / <b>${total}</b></td></tr>
    <tr><th>المصحح</th>${groups.map(() => '<td></td>').join('')}<td></td></tr><tr><th>المراجع</th>${groups.map(() => '<td></td>').join('')}<td></td></tr>
    <tr><th>الدرجة كتابة</th><td colspan="${groups.length + 1}" style="text-align:right"></td></tr></table>`}
  <div class="inst"><b>تعليمات:</b> اقرأ كل سؤال بعناية قبل الإجابة. عدد الأسئلة ${groups.length} ${groups.length > 2 && groups.length < 11 ? 'أسئلة' : 'سؤال'}${d.duration ? `، والزمن ${durAr(d.duration)}` : ''}، والدرجة الكلية ${total}. أجب في المكان المخصص بخط واضح.${d.options.bubble && v ? ' ظلّل إجابات الاختيار من متعدد والصح والخطأ في ورقة التظليل.' : ''}${d.notes ? ` ${esc(d.notes)}` : ''}</div>
  ${groups.map((g, i) => sectionHtml(g[0].type, g, i, d)).join('')}
  <div class="end">انتهت الأسئلة<br><span style="font-weight:400">مع تمنياتي لكم بالتوفيق والنجاح</span></div>
  <div class="sig"><span>${teacherWord(u)}: ${esc(u.full_name || '')}</span><span>${d.subject ? esc(d.subject) : ''}</span></div>
  </div>`;
}

function bubbleHtml({ u, d }) {
  const items = E.version(d, 1).flat().filter((it) => it.type === 'mcq' || it.type === 'tf');
  if (!items.length) return '';
  const rows = items.map((it, i) => `<tr><td><b>${i + 1}</b></td><td>${it.type === 'tf' ? '<i>ص</i><i>خ</i>' : LET.slice(0, Math.max(it.choices.length, 2)).map((l) => `<i>${l}</i>`).join('')}</td></tr>`);
  const half = Math.ceil(rows.length / 2);
  return `<div class="page">${letterheadHtml(schoolOf(u, d), null)}<h1>ورقة التظليل: ${esc(E.titleOf(d))}</h1>
  <table class="stu"><tr><th>اسم ${studentWord(u)}</th><td colspan="3"></td><th>الفصل</th><td style="width:14%"></td></tr></table>
  <p class="muted" style="font-size:12.5px">ظلّل دائرة واحدة لكل فقرة. الترقيم متسلسل لفقرات الاختيار من متعدد ثم الصح والخطأ كما في ورقة الأسئلة.</p>
  <div class="bub-wrap"><table class="bub">${rows.slice(0, half).join('')}</table><table class="bub">${rows.slice(half).join('')}</table></div></div>`;
}

function keyHtml({ u, d }) {
  const L = lessonOf(d);
  const vers = d.options.versions === 2 ? [1, 2] : [1];
  return vers.map((v) => {
    const groups = E.version(d, v);
    return `<div class="page">${letterheadHtml(schoolOf(u, d), null)}<h1>مفتاح الإجابة${vers.length > 1 ? ` - النموذج (${v === 1 ? 'أ' : 'ب'})` : ''}: ${esc(E.titleOf(d))}</h1>
    ${groups.map((g, gi) => {
      const col = g[0].type === 'match' ? E.matchColumn(g) : null;
      return `<h3 style="margin:10px 0 4px">السؤال ${ORD[gi]}: ${E.TYPES[g[0].type].name}</h3><table class="key"><thead><tr><th style="width:5%">م</th><th>الإجابة</th><th style="width:22%">الدرس</th><th style="width:10%">المستوى</th><th style="width:8%">الدرجة</th></tr></thead><tbody>
      ${g.map((it, i) => { let a = it.answer || '-';
        if (it.type === 'mcq') { const k = it.choices.indexOf(it.answer); a = k >= 0 ? `${LET[k]}) ${it.answer}` : it.answer; }
        if (col) { const k = col.findIndex((c) => c.i === i); a = `${it.text} ← ${it.answer}${k >= 0 ? ` (البند ${k + 1} في العمود ب)` : ''}`; }
        return `<tr><td>${i + 1}</td><td class="t">${esc(a).replace(/\n/g, '<br>')}</td><td>${esc((L.get(it.lesson) || {}).title || '-')}</td><td>${levelName(it.level)}</td><td>${it.mark}</td></tr>`; }).join('')}</tbody></table>`;
    }).join('')}<p style="text-align:left;font-weight:700">المجموع: ${E.total(d)}</p></div>`;
  }).join('');
}

function specHtml({ u, d }) {
  const sp = E.spec(d);
  // الفعلي في الورقة (بعد تعديلات المعلم) لكل درس ومستوى
  const act = new Map(); const actM = new Map();
  for (const it of d.items) { const k = `${it.lesson}:${it.level}`; act.set(k, (act.get(k) || 0) + 1); actM.set(it.lesson, (actM.get(it.lesson) || 0) + it.mark); }
  const levels = E.LEVELS;
  const rows = sp.lessons.map((l, i) => `<tr><td>${i + 1}</td><td style="text-align:right">${esc(l.title)}${l.unit ? `<br><span class="muted" style="font-size:11px">${esc(l.unit)}</span>` : ''}</td><td>${l.periods}</td><td>${l.weight}%</td>${levels.map((lv) => `<td>${act.get(`${l.id}:${lv.key}`) || 0}</td>`).join('')}<td>${levels.reduce((a, lv) => a + (act.get(`${l.id}:${lv.key}`) || 0), 0)}</td><td>${Math.round((actM.get(l.id) || 0) * 100) / 100}</td></tr>`).join('');
  const colTot = levels.map((lv) => d.items.filter((it) => it.level === lv.key).length);
  const n = d.items.length || 1;
  return `<div class="page">${letterheadHtml(schoolOf(u, d), null)}<h1>جدول مواصفات ${esc(E.titleOf(d))}</h1>
  <table class="meta" style="margin-bottom:8px"><tr><th>المادة</th><td>${esc(d.subject)}</td><th>الصف</th><td>${esc(d.grade)}</td><th>عدد الأسئلة</th><td>${d.items.length}</td><th>الدرجة</th><td>${E.total(d)}</td></tr></table>
  <table class="spec"><thead><tr><th rowspan="2">م</th><th rowspan="2">الدرس / الموضوع</th><th rowspan="2">عدد الحصص</th><th rowspan="2">الوزن النسبي</th><th colspan="${levels.length}">مستويات الأسئلة (عدد الفقرات)</th><th rowspan="2">مجموع الفقرات</th><th rowspan="2">الدرجة</th></tr>
  <tr>${levels.map((lv) => `<th>${lv.name}<br>${d.levels[lv.key] || 0}%</th>`).join('')}</tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><td colspan="2">المجموع</td><td>${sp.periods}</td><td>100%</td>${colTot.map((c) => `<td>${c}<br><span style="font-weight:400;font-size:11px">${Math.round((c / n) * 100)}%</span></td>`).join('')}<td>${d.items.length}</td><td>${E.total(d)}</td></tr></tfoot></table>
  <p class="muted" style="font-size:12px;line-height:1.8">الوزن النسبي لكل درس محسوب بعدد حصصه من مجموع حصص الدروس المشمولة، وعدد الفقرات في كل خلية = عدد فقرات الاختبار × وزن الدرس × نسبة المستوى، مع التقريب بحيث يطابق المجموع. الأرقام أعلاه هي الفعلية في ورقة الأسئلة بعد مراجعة ${teacherWord(u)}.</p>
  <table style="margin-top:8px"><thead><tr><th>مستوى</th><th>ما يقيسه</th></tr></thead><tbody>${levels.map((lv) => `<tr><td>${lv.name}</td><td style="text-align:right">${lv.desc}</td></tr>`).join('')}</tbody></table>
  <div class="sig" style="margin-top:30px"><span>${teacherWord(u)}: ${esc(u.full_name || '')}</span><span>${u.gender === 'f' ? 'المشرفة التربوية' : 'المشرف التربوي'}</span><span>مدير المدرسة${u.principal ? `: ${esc(u.principal)}` : ''}</span></div></div>`;
}

function shell(title, body) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`;
}

// k: all | paper | b | bubble | key | spec
function build({ u, d, k = 'all', back = '/app#/exam', docxUrl = '' }) {
  const two = d.options.versions === 2;
  const parts = [];
  if (k === 'all' || k === 'paper') parts.push(paperHtml({ u, d, v: 1, model: two ? 'أ' : '' }));
  if ((k === 'all' && two) || k === 'b') parts.push(paperHtml({ u, d, v: 2, model: 'ب' }));
  if ((k === 'all' && d.options.bubble) || k === 'bubble') parts.push(bubbleHtml({ u, d }));
  if ((k === 'all' && d.options.key) || k === 'key') parts.push(keyHtml({ u, d }));
  if ((k === 'all' && d.options.spec) || k === 'spec') parts.push(specHtml({ u, d }));
  const empty = d.items.filter((it) => !it.text.trim()).length;
  const bar = `<div class="toolbar"><a class="btn ghost" href="${esc(back)}">→ رجوع</a><button class="btn" onclick="print()">🖨️ طباعة / حفظ PDF</button>${docxUrl ? `<a class="btn ghost" href="${esc(docxUrl)}">📄 Word قابل للتعديل</a>` : ''}<span class="muted" style="font-size:12px">اختر «حفظ كـ PDF» من نافذة الطباعة</span></div>`;
  const warn = empty ? `<div class="warn">باقي ${empty} ${empty > 10 ? 'فقرة' : 'فقرات'} بدون نص، تظهر كنقاط في الورقة. أكملها من صفحة الاختبار قبل الطباعة.</div>` : '';
  return shell(E.titleOf(d), bar + warn + (parts.join('') || '<div class="page"><p style="text-align:center;padding:40mm 0">ما فيه أسئلة بعد.</p></div>'));
}

// ---------- Word ----------
const AL = docx.AlignmentType;
const tbl = (rows, o = {}) => new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows, ...(o.noBorder ? { borders: docx.TableBorders.NONE } : {}) });
const tr = (cells, o = {}) => new docx.TableRow({ children: cells, cantSplit: true, tableHeader: o.header });
const gray = 'EEF3F2';
function paperDocx({ u, d, v, model, uploadsDir }) {
  const groups = E.version(d, v);
  const total = E.total(d);
  const out = [...letterheadDocx(schoolOf(u, d), uploadsDir)];
  out.push(tbl([tr([['المادة', d.subject], ['الصف', d.grade], ['الزمن', durAr(d.duration)], ['التاريخ', d.date ? dAr(d.date) : '...../...../.....']].flatMap(([k, val]) => [cell(k, { bold: true, fill: gray, w: 10 }), cell(val || ' ', { w: 15 })]))]));
  out.push(para(run(`أسئلة ${E.KINDS[d.kind]}${d.subject ? ` لمادة ${d.subject}` : ''}${d.term ? ` - ${d.term}` : ''}${d.year ? ` - العام الدراسي ${d.year}` : ''}${model ? `   النموذج (${model})` : ''}`, { bold: true, size: 28 }), { align: AL.CENTER, after: 80 }));
  if (d.options.names) out.push(tbl([tr([cell(`اسم ${studentWord(u)}`, { bold: true, fill: gray, w: 14 }), cell(' ', { w: 40 }), cell('الفصل', { bold: true, fill: gray, w: 9 }), cell(' ', { w: 10 }), cell('رقم الجلوس', { bold: true, fill: gray, w: 12 }), cell(' ', { w: 15 })])]));
  if (d.kind !== 'hw') {
    const blanks = () => groups.map(() => cell(' '));
    out.push(para(run(' ', { size: 8 }), { after: 0 }));
    out.push(tbl([
      tr([cell('السؤال', { bold: true, fill: gray }), ...groups.map((g, i) => cell(ORD[i], { bold: true, fill: gray, align: AL.CENTER })), cell('المجموع', { bold: true, fill: gray, align: AL.CENTER })]),
      tr([cell('الدرجة', { bold: true, fill: gray }), ...blanks(), cell(`...... / ${total}`, { align: AL.CENTER })]),
      tr([cell('المصحح', { bold: true, fill: gray }), ...blanks(), cell(' ')]),
      tr([cell('المراجع', { bold: true, fill: gray }), ...blanks(), cell(' ')]),
    ]));
  }
  out.push(para([run('تعليمات: ', { bold: true, size: 22 }), run(`اقرأ كل سؤال بعناية قبل الإجابة. عدد الأسئلة ${groups.length}${d.duration ? `، والزمن ${durAr(d.duration)}` : ''}، والدرجة الكلية ${total}. أجب في المكان المخصص بخط واضح.${d.notes ? ` ${d.notes}` : ''}`, { size: 22 })], { after: 120 }));
  groups.forEach((g, gi) => {
    const type = g[0].type; const T = E.TYPES[type];
    const marks = g.reduce((a, it) => a + it.mark, 0);
    out.push(new docx.Paragraph({ bidirectional: true, alignment: AL.RIGHT, spacing: { before: 160, after: 80 }, shading: { fill: gray, type: docx.ShadingType.CLEAR, color: 'auto' }, keepNext: true, children: [run(`السؤال ${ORD[gi]}: ${T.head}  (${mk(marks)})`, { bold: true, size: 24 })] }));
    const txt = (it) => it.text || '..............................................................';
    if (type === 'tf') { out.push(tbl(g.map((it, i) => tr([cell(String(i + 1), { w: 5, align: AL.CENTER }), cell(txt(it), { w: 85, size: 22 }), cell('(      )', { w: 10, align: AL.CENTER })])))); return; }
    if (type === 'match') {
      const col = E.matchColumn(g);
      out.push(tbl([tr([cell('م', { bold: true, fill: gray, w: 5 }), cell('العمود (أ)', { bold: true, fill: gray, w: 40 }), cell('الرقم', { bold: true, fill: gray, w: 8 }), cell('العمود (ب)', { bold: true, fill: gray, w: 47 })]),
        ...col.map((c, i) => tr([cell(g[i] ? String(i + 1) : ' ', { w: 5, align: AL.CENTER }), cell(g[i] ? txt(g[i]) : ' ', { w: 40, size: 22 }), cell(' ', { w: 8 }), cell(c.text || ' ', { w: 47, size: 22 })]))]));
      return;
    }
    g.forEach((it, i) => {
      out.push(new docx.Paragraph({ bidirectional: true, alignment: AL.RIGHT, spacing: { after: 40 }, keepNext: type === 'mcq', children: [run(`${i + 1}) `, { bold: true, size: 24 }), run(txt(it), { size: 24 }), ...(!T.obj && g.length > 1 ? [run(`  (${mk(it.mark)})`, { size: 20, color: '555555' })] : [])] }));
      if (type === 'mcq' && it.choices.length) {
        const long = Math.max(...it.choices.map((c) => c.length));
        const per = long > 38 ? 1 : long > 16 ? 2 : 4;
        const rows = [];
        for (let k = 0; k < it.choices.length; k += per) rows.push(tr(it.choices.slice(k, k + per).map((c, j) => cell(`${LET[k + j]}) ${c}`, { size: 22, w: Math.floor(100 / per) }))));
        out.push(tbl(rows, { noBorder: true }));
      }
      const lines = { short: 2, essay: 6 }[type] || 0;
      for (let k = 0; k < lines; k++) out.push(para(run('.............................................................................................................................................', { size: 22, color: '888888' }), { after: 60 }));
    });
  });
  out.push(para(run('انتهت الأسئلة', { bold: true, size: 24 }), { align: AL.CENTER, after: 0 }));
  out.push(para(run('مع تمنياتي لكم بالتوفيق والنجاح', { size: 22 }), { align: AL.CENTER, after: 120 }));
  out.push(para(run(`${teacherWord(u)}: ${u.full_name || ''}`, { bold: true, size: 22 }), { align: AL.LEFT }));
  return out;
}
function keyDocx({ u, d, uploadsDir }) {
  const L = lessonOf(d);
  const out = [...letterheadDocx(schoolOf(u, d), uploadsDir), para(run(`مفتاح الإجابة: ${E.titleOf(d)}`, { bold: true, size: 28 }), { align: AL.CENTER, after: 100 })];
  E.version(d, 1).forEach((g, gi) => {
    const col = g[0].type === 'match' ? E.matchColumn(g) : null;
    out.push(para(run(`السؤال ${ORD[gi]}: ${E.TYPES[g[0].type].name}`, { bold: true, size: 24, color: '0F766E' }), { after: 60 }));
    out.push(tbl([tr(['م', 'الإجابة', 'الدرس', 'المستوى', 'الدرجة'].map((h, i) => cell(h, { bold: true, color: 'FFFFFF', fill: '0F766E', w: [6, 50, 24, 10, 10][i], align: AL.CENTER })), { header: true }),
      ...g.map((it, i) => { let a = it.answer || '-';
        if (it.type === 'mcq') { const k = it.choices.indexOf(it.answer); a = k >= 0 ? `${LET[k]}) ${it.answer}` : it.answer; }
        if (col) { const k = col.findIndex((c) => c.i === i); a = `${it.text} ← ${it.answer}${k >= 0 ? ` (البند ${k + 1})` : ''}`; }
        return tr([cell(String(i + 1), { align: AL.CENTER }), cell(a.split('\n').map((l) => para(run(l, { size: 20 }))), {}), cell((L.get(it.lesson) || {}).title || '-', { size: 18 }), cell(levelName(it.level), { size: 18, align: AL.CENTER }), cell(String(it.mark), { align: AL.CENTER })]); })]));
  });
  return out;
}
async function examDocx({ u, d, uploadsDir }) {
  const two = d.options.versions === 2;
  const sec = (children, brk) => ({ properties: { page: { margin: { top: 640, bottom: 640, left: 700, right: 700 } } }, children });
  const sections = [sec(paperDocx({ u, d, v: 1, model: two ? 'أ' : '', uploadsDir }))];
  if (two) sections.push(sec(paperDocx({ u, d, v: 2, model: 'ب', uploadsDir })));
  if (d.options.key) sections.push(sec(keyDocx({ u, d, uploadsDir })));
  const doc = new docx.Document({ creator: 'معياري للمعلم', title: E.titleOf(d), styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } }, sections });
  return docx.Packer.toBuffer(doc);
}

module.exports = { build, examDocx };
