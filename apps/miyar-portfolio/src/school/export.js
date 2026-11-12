// تصدير خطة التحسين: صفحة طباعة (PDF من المتصفح) وملف Word قابل للتعديل.
const fs = require('fs');
const path = require('path');
const docx = require('docx');
const { LEVELS } = require('./indicators');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null ? '-' : `${Math.round(n * 100) / 100}%`);
const levelColor = (name) => (LEVELS.find((l) => l.name === name) || {}).color || '#555';
const TITLE = 'خطة التحسين المدرسي';
const SUB = 'مبنية على نتائج تقرير التقويم المدرسي الذاتي';

function logoData(school, uploadsDir) {
  if (!school.logo) return null;
  const p = path.join(uploadsDir, school.logo);
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).slice(1).toLowerCase();
  return { buf: fs.readFileSync(p), type: ext === 'jpg' ? 'jpeg' : ext };
}

// ---------- صفحة الطباعة ----------
function printHtml({ school, report, plan, trial, uploadsDir }) {
  const logo = logoData(school, uploadsDir);
  const logoTag = logo ? `<img class="logo" src="data:image/${logo.type};base64,${logo.buf.toString('base64')}" alt="">` : '';
  const rows = plan.rows.map((r, i) => `
<tr>
  <td class="c">${i + 1}</td>
  <td><b><bdi dir="ltr">${esc(r.code)}</bdi></b><br>${esc(r.indicator)}<div class="std">${esc(r.domain)} / ${esc(r.standard)}</div></td>
  <td class="c"><b>${fmt(r.pct)}</b><br><span class="lv" style="background:${levelColor(r.level)}">${esc(r.level)}</span><div class="std">أولوية ${esc(r.priority)}</div></td>
  <td class="need">${esc(r.need)}</td>
  <td>${esc(r.goal)}</td>
  <td><ol>${r.procedures.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></td>
  <td>${esc(r.responsible)}</td>
  <td class="c">${esc(r.from)}<br>إلى<br>${esc(r.to)}</td>
  <td>${esc(r.measure)}</td>
  <td><ul>${r.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></td>
</tr>`).join('');
  const lv = Object.entries(plan.byLevel).map(([k, v]) => `<span class="lv" style="background:${levelColor(k)}">${esc(k)}: ${v}</span>`).join(' ');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE} - ${esc(school.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; }
body { font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #10201e; margin: 0; background: #eef2f1; font-size: 11px; line-height: 1.55; }
.page { background: #fff; max-width: 297mm; margin: 12px auto; padding: 12mm; position: relative; }
.head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0f766e; padding-bottom: 10px; margin-bottom: 12px; }
.head .logo { width: 70px; height: 70px; object-fit: contain; }
.head h1 { margin: 0; font-size: 22px; color: #0f766e; }
.head .meta { margin-inline-start: auto; text-align: left; font-size: 12px; color: #444; }
.sum { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.sum div { border: 1px solid #dde5e4; border-radius: 8px; padding: 8px 10px; }
.sum b { display: block; font-size: 18px; color: #0f766e; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { background: #0f766e; color: #fff; font-weight: 600; padding: 6px 4px; font-size: 11px; }
td { border: 1px solid #cfd9d7; padding: 5px; vertical-align: top; }
tr:nth-child(even) td { background: #f7faf9; }
td.c { text-align: center; }
td.need { font-size: 10px; color: #333; }
.std { color: #667; font-size: 10px; margin-top: 3px; }
.lv { display: inline-block; color: #fff; border-radius: 99px; padding: 0 8px; font-size: 10px; font-weight: 600; }
ol, ul { margin: 0; padding-inline-start: 16px; }
thead { display: table-header-group; } tr { page-break-inside: avoid; }
.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 22px; text-align: center; font-size: 12px; }
.sign div { border-top: 1px dashed #999; padding-top: 6px; }
.strengths { margin: 0 0 12px; font-size: 11px; }
.wm { position: fixed; inset: 0; display: grid; place-items: center; pointer-events: none; font-size: 80px; color: rgba(180, 35, 24, .09); transform: rotate(-20deg); font-weight: 700; }
.tools { text-align: center; padding: 10px; }
.tools button { font: inherit; padding: 8px 18px; border-radius: 8px; border: 0; background: #0f766e; color: #fff; cursor: pointer; }
.trial { background: #fff4e5; border: 1px solid #f5c26b; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; font-size: 12px; }
@media print { body { background: #fff; } .page { margin: 0; padding: 0; max-width: none; } .tools { display: none; } }
</style></head><body>
<div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div>
${trial ? '<div class="wm">نسخة تجريبية</div>' : ''}
<div class="page">
  <div class="head">${logoTag}<div><h1>${TITLE}</h1><div>${SUB}${report.cycle ? ` (${esc(report.cycle)})` : ''}</div></div>
    <div class="meta"><b>${esc(school.name)}</b><br>${school.ministry_number ? `الرقم الوزاري: ${esc(school.ministry_number)}<br>` : ''}${esc(school.office)}<br>العام الدراسي ${esc(school.year)}</div></div>
  ${trial ? `<div class="trial">هذه نسخة تجريبية تعرض أول ${plan.rows.length} مؤشرات من أصل ${plan.total}. فعّل باقة المدرسة لتحصل على الخطة كاملة بدون علامة مائية وبصيغة Word.</div>` : ''}
  <div class="sum">
    <div>الأداء العام<b>${fmt(report.overall)}</b></div>
    <div>مؤشرات تحتاج تحسين<b>${plan.total}</b></div>
    <div>مؤشرات في مستوى التميز<b>${plan.strengths.length}</b></div>
    <div>توزيع المؤشرات<br>${lv}</div>
  </div>
  ${plan.strengths.length ? `<p class="strengths"><b>أبرز نقاط القوة:</b> ${plan.strengths.slice(0, 5).map((s) => `<bdi dir="ltr">${esc(s.code)}</bdi> (${fmt(s.pct)})`).join('، ')}</p>` : ''}
  <table><thead><tr>
    <th style="width:3%">م</th><th style="width:14%">المؤشر</th><th style="width:7%">النسبة والمستوى</th><th style="width:13%">الاحتياج (توصية التقرير)</th><th style="width:9%">الهدف</th><th style="width:18%">الإجراءات</th><th style="width:9%">المسؤول</th><th style="width:7%">الزمن</th><th style="width:10%">مؤشر التحقق</th><th style="width:10%">الشواهد</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div class="sign"><div>رئيس فريق التميز</div><div>قائد المدرسة<br>${esc(school.principal)}</div><div>الختم</div></div>
</div></body></html>`;
}

// ---------- Word ----------
const FONT = 'Sakkal Majalla';
const run = (text, o = {}) => new docx.TextRun({ text: String(text ?? ''), rightToLeft: true, font: FONT, size: o.size || 22, bold: o.bold, color: o.color });
const para = (children, o = {}) => new docx.Paragraph({ bidirectional: true, alignment: o.align || docx.AlignmentType.RIGHT, spacing: { after: o.after ?? 40 }, children: Array.isArray(children) ? children : [children] });
const lines = (arr, numbered) => arr.map((t, i) => para(run(`${numbered ? `${i + 1}. ` : '• '}${t}`, { size: 20 }), { after: 20 }));
const cell = (content, o = {}) => new docx.TableCell({
  children: Array.isArray(content) ? content : [para(run(content, { size: o.size || 20, bold: o.bold, color: o.color }), { align: o.align })],
  shading: o.fill ? { fill: o.fill, type: docx.ShadingType.CLEAR, color: 'auto' } : undefined,
  width: o.w ? { size: o.w, type: docx.WidthType.PERCENTAGE } : undefined,
  margins: { top: 60, bottom: 60, left: 80, right: 80 },
});

async function planDocx({ school, report, plan, uploadsDir }) {
  const W = [3, 14, 7, 13, 9, 18, 9, 7, 10, 10];
  const heads = ['م', 'المؤشر', 'النسبة والمستوى', 'الاحتياج (توصية التقرير)', 'الهدف', 'الإجراءات', 'المسؤول', 'الزمن', 'مؤشر التحقق', 'الشواهد'];
  const header = new docx.TableRow({ tableHeader: true, children: heads.map((h, i) => cell(h, { bold: true, color: 'FFFFFF', fill: '0F766E', w: W[i], align: docx.AlignmentType.CENTER })) });
  const body = plan.rows.map((r, i) => new docx.TableRow({ cantSplit: true, children: [
    cell(String(i + 1), { w: W[0], align: docx.AlignmentType.CENTER }),
    cell([para(run(`\u202A${r.code}\u202C`, { bold: true, size: 20 })), para(run(r.indicator, { size: 20 })), para(run(`${r.domain} / ${r.standard}`, { size: 16, color: '666666' }))], { w: W[1] }),
    cell([para(run(fmt(r.pct), { bold: true, size: 22 }), { align: docx.AlignmentType.CENTER }), para(run(r.level, { size: 18, color: levelColor(r.level).slice(1) }), { align: docx.AlignmentType.CENTER })], { w: W[2] }),
    cell(r.need, { w: W[3], size: 18 }),
    cell(r.goal, { w: W[4] }),
    cell(lines(r.procedures, true), { w: W[5] }),
    cell(r.responsible, { w: W[6] }),
    cell(`${r.from} - ${r.to}`, { w: W[7], align: docx.AlignmentType.CENTER }),
    cell(r.measure, { w: W[8] }),
    cell(lines(r.evidence, false), { w: W[9] }),
  ] }));
  const logo = logoData(school, uploadsDir);
  const headKids = [];
  if (logo && ['png', 'jpeg', 'gif'].includes(logo.type)) headKids.push(new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.ImageRun({ type: logo.type === 'jpeg' ? 'jpg' : logo.type, data: logo.buf, transformation: { width: 80, height: 80 } })] }));
  const doc = new docx.Document({
    creator: 'خطط معيار',
    title: `${TITLE} - ${school.name}`,
    styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
    sections: [{
      properties: { page: { size: { orientation: docx.PageOrientation.LANDSCAPE }, margin: { top: 600, bottom: 600, left: 600, right: 600 } } },
      children: [
        ...headKids,
        para(run(TITLE, { size: 36, bold: true, color: '0F766E' }), { align: docx.AlignmentType.CENTER }),
        para(run(`${SUB}${report.cycle ? ` (${report.cycle})` : ''}`, { size: 24 }), { align: docx.AlignmentType.CENTER }),
        para([run(`${school.name}`, { bold: true, size: 24 }), run(`${school.ministry_number ? `  |  الرقم الوزاري: ${school.ministry_number}` : ''}  |  العام الدراسي ${school.year}`, { size: 22 })], { align: docx.AlignmentType.CENTER, after: 120 }),
        para(run(`الأداء العام: ${fmt(report.overall)}  |  مؤشرات تحتاج تحسين: ${plan.total}  |  مؤشرات في مستوى التميز: ${plan.strengths.length}`, { size: 22 }), { after: 160 }),
        new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows: [header, ...body] }),
        para(run(''), { after: 400 }),
        new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, borders: docx.TableBorders.NONE, rows: [new docx.TableRow({ children: ['رئيس فريق التميز', `قائد المدرسة\n${school.principal || ''}`, 'الختم'].map((t) => cell(t.split('\n').map((l) => para(run(l, { bold: true }), { align: docx.AlignmentType.CENTER })))) })] }),
      ],
    }],
  });
  return docx.Packer.toBuffer(doc);
}

module.exports = { printHtml, planDocx };
