// تصدير خطة التحسين: صفحة طباعة (PDF من المتصفح) وملف Word قابل للتعديل.
const fs = require('fs');
const path = require('path');
const docx = require('docx');
const { LEVELS, levelOf, planTypeOf, supervisoryOf } = require('./indicators');
const { methodsFor } = require('./bank');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null ? '-' : `${Math.round(n * 100) / 100}%`);
const levelColor = (name) => (LEVELS.find((l) => l.name === name) || {}).color || '#555';
const TITLE = 'خطة التحسين المدرسي';
// الإجراءات كانت نصوصاً في النسخة الأولى، والآن {text, when, done}
const procs = (r) => (r.procedures || []).map((p) => (typeof p === 'string' ? { text: p, when: '', done: false } : p));
const progress = (rows) => { const all = rows.flatMap(procs); return { done: all.filter((p) => p.done).length, total: all.length }; };
const pctOf = ({ done, total }) => (total ? Math.round((done / total) * 100) : 0);
// ملخص المجالات: عدد المؤشرات تحت التميز في كل مجال
function domainSummary(plan) {
  const m = new Map();
  for (const r of plan.rows) { const k = r.domain; const v = m.get(k) || { n: 0, min: 101 }; v.n++; v.min = Math.min(v.min, r.pct); m.set(k, v); }
  return [...m.entries()];
}
const SUB = 'مبنية على نتائج تقرير التقويم المدرسي الذاتي';
const STAGE = { basic: 'متوسطة / ابتدائية', secondary: 'الثانوية' };
// الخطط القديمة ما فيها الحقول الجديدة، نكملها وقت التصدير
// أسماء المعلمين المسند لهم إجراءات المؤشر (تنضاف للتنفيذ والمسؤولية)
const people = (r) => [...new Set(procs(r).map((p) => p.assignee_name).filter(Boolean))];
const respOf = (r) => { const n = people(r); return n.length ? `${r.responsible}\nالمنفذون: ${n.join('، ')}` : r.responsible; };
const evText = (p) => (p.evidence ? `شاهد: ${p.evidence.title} (رمز التحقق ${p.evidence.code})` : '');

// ترويسة وزارة التعليم (خيار في بيانات المدرسة، مفعّل افتراضياً)
const MOE = (() => { try { return fs.readFileSync(path.join(__dirname, 'assets', 'moe-logo.png')); } catch { return null; } })();
const useMoe = (school) => !!MOE && school.ministry_logo !== 0;
const LH_CSS = `.lh { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; font-size: 11.5px; line-height: 1.8; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1.5px solid #4a8c86; }
.lh-c img { height: 74px; display: block; } .lh-l { display: flex; gap: 10px; align-items: center; justify-content: flex-end; text-align: left; } .lh-l img { width: 60px; height: 60px; object-fit: contain; }
.head.t { justify-content: center; text-align: center; border-bottom: 0; margin-bottom: 4px; }`;
function letterheadHtml(school, logo) {
  if (!useMoe(school)) return '';
  return `<div class="lh"><div class="lh-r"><b>المملكة العربية السعودية</b><br><b>وزارة التعليم</b>${school.office ? `<br>${esc(school.office)}` : ''}${school.name ? `<br>${esc(school.name)}` : ''}</div>
  <div class="lh-c"><img src="data:image/png;base64,${MOE.toString('base64')}" alt="وزارة التعليم"></div>
  <div class="lh-l"><div>${school.ministry_number ? `الرقم الوزاري: <bdi dir="ltr">${esc(school.ministry_number)}</bdi><br>` : ''}العام الدراسي: ${esc(school.year)}</div>${logo ? `<img src="data:image/${logo.type};base64,${logo.buf.toString('base64')}" alt="">` : ''}</div></div>`;
}

const full = (r) => ({ ...r, supervisory: r.supervisory ?? supervisoryOf(r.code), methods: r.methods ?? methodsFor(r.code.split('-').slice(0, 2).join('-')), committee: r.committee ?? r.responsible, supervisor: r.supervisor || '', note: r.note || '' });
const dateAr = (t) => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(t ? new Date(t) : new Date());
// البيانات الأساسية بنفس ترتيب استمارات الوزارة
function basics(school, report) {
  const lv = report.overall != null ? levelOf(report.overall).name : '';
  return [
    ['اسم المدرسة', school.name], ['المرحلة', STAGE[school.stage] || ''], ['الرقم الوزاري', school.ministry_number || ''],
    ['جنس المدرسة', school.gender], ['نوع المبنى', school.building], ['الفترة', school.period],
    ['مكتب / إدارة التعليم', school.office], ['العام الدراسي', school.year],
    ['مستوى الأداء العام للمدرسة في التقويم المدرسي (آخر تقرير)', report.overall != null ? `${fmt(report.overall)} - ${lv}` : ''],
  ];
}
const basicsHtml = (school, report) => `<table class="basic"><tbody>${basics(school, report).reduce((a, c, i) => { if (i % 3 === 0) a.push([]); a[a.length - 1].push(c); return a; }, []).map((tr) => `<tr>${tr.map(([k, v]) => `<th>${esc(k)}</th><td>${esc(v) || '&nbsp;'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
// التوصيات: نص المستخدم، وإذا فاضي نقترح من بيانات الخطة
function recsOf(plan, kind) {
  if (plan.recommendations) return plan.recommendations.split('\n').map((x) => x.trim()).filter(Boolean);
  if (kind === 'plan') return ['عرض الخطة على منسوبي المدرسة ومناقشتها واعتمادها من لجنة التميز.', 'توزيع المهام على اللجان المنفذة وتحديد مواعيد المتابعة الدورية.', 'توثيق الشواهد أولاً بأول لكل إجراء منفذ.'];
  const late = plan.rows.map(full).filter((r) => progress([r]).done === 0).slice(0, 5);
  const all = progress(plan.rows);
  const out = [];
  if (late.length) out.push(`البدء في تنفيذ إجراءات المؤشرات التي لم يُنفذ منها شيء بعد: ${late.map((r) => `\u2066${r.code}\u2069`).join('، ')}.`);
  if (all.total && all.done / all.total < 0.5) out.push('عقد اجتماع للجنة التميز لمراجعة أسباب تأخر التنفيذ ووضع مواعيد بديلة.');
  out.push('استكمال توثيق الشواهد للإجراءات المنفذة.');
  return out;
}
const recsHtml = (list) => `<h2 class="sec">ثالثاً: التوصيات والمقترحات</h2><ol class="recs">${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;

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
  const rows = plan.rows.map(full).map((r, i) => `
<tr>
  <td class="c">${i + 1}</td>
  <td><b>${esc(r.supervisory || r.domain)}</b><div class="std">${esc(r.domain)} / ${esc(r.standard)}</div></td>
  <td><b><bdi dir="ltr">${esc(r.code)}</bdi></b><br>${esc(r.indicator)}<div class="c" style="margin-top:4px"><b>${fmt(r.pct)}</b> <span class="lv" style="background:${levelColor(r.level)}">${esc(r.level)}</span> <span class="std">← ${r.target}%</span></div></td>
  <td class="need">${esc(r.need)}<div class="std"><b>الهدف:</b> ${esc(r.goal)}</div></td>
  <td><ol>${procs(r).map((p) => `<li>${esc(p.text)}${p.when ? ` <span class="when">(${esc(p.when)})</span>` : ''}</li>`).join('')}</ol></td>
  <td>${esc(r.methods)}</td>
  <td class="c">${esc(r.from)}<br>إلى<br>${esc(r.to)}</td>
  <td>${esc(respOf(r)).replace(/\n/g, '<br>')}</td>
  <td>${esc(r.measure)}<ul class="std">${r.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></td>
</tr>`).join('');
  const ptype = planTypeOf(report.overall);
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
${LH_CSS}
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
.when { color: #0f766e; font-size: 10px; white-space: nowrap; }
.pri { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.pri > div { border: 1px solid #dde5e4; border-radius: 8px; padding: 8px 10px; }
.pri h3 { margin: 0 0 4px; font-size: 13px; color: #0f766e; }
.pri ol, .pri ul { font-size: 11px; }
.basic { margin-bottom: 12px; } .basic th { background: #eef6f5; color: #0f4f4a; font-weight: 600; width: 13%; text-align: right; } .basic td { width: 20%; }
.sec { font-size: 14px; color: #0f766e; margin: 14px 0 6px; break-after: avoid; }
.recs { font-size: 12px; } .ptype { background: #eef6f5; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; font-size: 12px; }
.trial { background: #fff4e5; border: 1px solid #f5c26b; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; font-size: 12px; }
@media print { body { background: #fff; } .page { margin: 0; padding: 0; max-width: none; } .tools { display: none; } }
</style></head><body>
<div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div>
${trial ? `<div class="wm">${plan.sample ? 'نموذج للعرض' : 'نسخة تجريبية'}</div>` : ''}
<div class="page">
  ${letterheadHtml(school, logo)}<div class="head${useMoe(school) ? ' t' : ''}">${useMoe(school) ? '' : logoTag}<div><h1>${TITLE}</h1><div>${SUB}${report.cycle ? ` (${esc(report.cycle)})` : ''}</div></div>
    ${useMoe(school) ? '' : `<div class="meta"><b>${esc(school.name)}</b><br>${school.ministry_number ? `الرقم الوزاري: ${esc(school.ministry_number)}<br>` : ''}${esc(school.office)}<br>العام الدراسي ${esc(school.year)}</div>`}</div>
  ${plan.sample ? `<div class="trial">هذا نموذج مبني على تقرير مدرسة حقيقية بعد إخفاء بياناتها، للعرض فقط. ارفع تقرير مدرستك لتحصل على خطتها.</div>` : trial ? `<div class="trial">هذه نسخة تجريبية تعرض أول ${plan.rows.length} مؤشرات من أصل ${plan.total}. فعّل باقة المدرسة لتحصل على الخطة كاملة بدون علامة مائية وبصيغة Word.</div>` : ''}
  <h2 class="sec">أولاً: البيانات الأساسية</h2>
  ${basicsHtml(school, report)}
  ${ptype ? `<div class="ptype">مستوى المدرسة العام <b>${esc(levelOf(report.overall).name)}</b>، والمطلوب حسب النموذج الإشرافي: <b>${esc(ptype)}</b>.</div>` : ''}
  <div class="sum">
    <div>الأداء العام<b>${fmt(report.overall)}</b></div>
    <div>مؤشرات تحتاج تحسين<b>${plan.total}</b></div>
    <div>مؤشرات في مستوى التميز<b>${plan.strengths.length}</b></div>
    <div>توزيع المؤشرات<br>${lv}</div>
  </div>
  <div class="pri">
    <div><h3>أولويات التحسين</h3><ol>${plan.rows.slice(0, 5).map((r) => `<li><bdi dir="ltr">${esc(r.code)}</bdi> ${esc(r.indicator)} <b>(${fmt(r.pct)})</b></li>`).join('')}</ol>
      <div class="std">المؤشرات تحت التميز حسب المجال: ${domainSummary(plan).map(([d, v]) => `${esc(d)} ${v.n}`).join('، ')}</div></div>
    <div><h3>أبرز نقاط القوة (للاستدامة)</h3><ul>${plan.strengths.slice(0, 5).map((s) => `<li><bdi dir="ltr">${esc(s.code)}</bdi> ${esc(s.indicator)} <b>(${fmt(s.pct)})</b></li>`).join('') || '<li>لا يوجد</li>'}</ul></div>
  </div>
  <h2 class="sec">ثانياً: إجراءات خطة التحسين</h2>
  <table><thead><tr>
    <th style="width:3%">م</th><th style="width:9%">المجال</th><th style="width:15%">العنصر / المؤشر المراد تحسينه</th><th style="width:15%">وصف الاحتياج والهدف</th><th style="width:20%">إجراءات التحسين</th><th style="width:10%">أساليب وطرق التحسين</th><th style="width:7%">مدة الإنجاز</th><th style="width:9%">التنفيذ والمسؤولية</th><th style="width:12%">مؤشر التحقق والشواهد</th>
  </tr></thead><tbody>${rows}</tbody></table>
  ${recsHtml(recsOf(plan, 'plan'))}
  <div class="sign"><div>رئيس لجنة التميز</div><div>مدير/ة المدرسة<br>${esc(school.principal)}<br>التوقيع</div><div>ختم المدرسة</div></div>
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

const heading = (t) => para(run(t, { size: 26, bold: true, color: '0F766E' }), { after: 80 });
const basicsDocx = (school, report) => {
  const b = basics(school, report);
  const trs = [];
  for (let i = 0; i < b.length; i += 3) trs.push(new docx.TableRow({ children: b.slice(i, i + 3).flatMap(([k, v]) => [cell(k, { bold: true, fill: 'EEF6F5', w: 13 }), cell(v || ' ', { w: 20 })]) }));
  return new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows: trs });
};
const signDocx = (items) => new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, borders: docx.TableBorders.NONE, rows: [new docx.TableRow({ children: items.map((t) => cell(t.split('\n').map((l) => para(run(l, { bold: true }), { align: docx.AlignmentType.CENTER })))) })] });
const logoKids = (school, uploadsDir) => {
  const logo = logoData(school, uploadsDir);
  return logo && ['png', 'jpeg', 'gif'].includes(logo.type) ? [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.ImageRun({ type: logo.type === 'jpeg' ? 'jpg' : logo.type, data: logo.buf, transformation: { width: 80, height: 80 } })] })] : [];
};
function letterheadDocx(school, uploadsDir) {
  if (!useMoe(school)) return logoKids(school, uploadsDir);
  const logo = logoData(school, uploadsDir);
  const none = { top: { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' } };
  const c = (children, w) => new docx.TableCell({ borders: none, width: { size: w, type: docx.WidthType.PERCENTAGE }, verticalAlign: docx.VerticalAlign.CENTER, children });
  const R = [run('المملكة العربية السعودية', { bold: true, size: 22 }), run('وزارة التعليم', { bold: true, size: 22 }), ...(school.office ? [run(school.office, { size: 20 })] : []), ...(school.name ? [run(school.name, { size: 20 })] : [])].map((r) => para(r, { after: 0 }));
  const L = [];
  if (logo && ['png', 'jpeg', 'gif'].includes(logo.type)) L.push(new docx.Paragraph({ alignment: docx.AlignmentType.LEFT, children: [new docx.ImageRun({ type: logo.type === 'jpeg' ? 'jpg' : logo.type, data: logo.buf, transformation: { width: 62, height: 62 } })] }));
  if (school.ministry_number) L.push(para(run(`الرقم الوزاري: ⁦${school.ministry_number}⁩`, { size: 20 }), { align: docx.AlignmentType.LEFT, after: 0 }));
  L.push(para(run(`العام الدراسي: ${school.year || ''}`, { size: 20 }), { align: docx.AlignmentType.LEFT, after: 0 }));
  const M = [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.ImageRun({ type: 'png', data: MOE, transformation: { width: 104, height: 80 } })] })];
  return [
    new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, borders: docx.TableBorders.NONE, rows: [new docx.TableRow({ children: [c(R, 38), c(M, 24), c(L, 38)] })] }),
    new docx.Paragraph({ border: { bottom: { style: docx.BorderStyle.SINGLE, size: 8, color: '4A8C86', space: 1 } }, spacing: { after: 120 }, children: [] }),
  ];
}
const landscape = { page: { size: { orientation: docx.PageOrientation.LANDSCAPE }, margin: { top: 600, bottom: 600, left: 600, right: 600 } } };

async function planDocx({ school, report, plan, uploadsDir }) {
  const W = [3, 9, 15, 15, 20, 10, 7, 9, 12];
  const heads = ['م', 'المجال', 'العنصر / المؤشر المراد تحسينه', 'وصف الاحتياج والهدف', 'إجراءات التحسين', 'أساليب وطرق التحسين', 'مدة الإنجاز', 'التنفيذ والمسؤولية', 'مؤشر التحقق والشواهد'];
  const header = new docx.TableRow({ tableHeader: true, children: heads.map((h, i) => cell(h, { bold: true, color: 'FFFFFF', fill: '0F766E', w: W[i], align: docx.AlignmentType.CENTER })) });
  const body = plan.rows.map(full).map((r, i) => new docx.TableRow({ cantSplit: true, children: [
    cell(String(i + 1), { w: W[0], align: docx.AlignmentType.CENTER }),
    cell([para(run(r.supervisory || r.domain, { bold: true, size: 20 })), para(run(`${r.domain} / ${r.standard}`, { size: 16, color: '666666' }))], { w: W[1] }),
    cell([para(run(`\u202A${r.code}\u202C`, { bold: true, size: 20 })), para(run(r.indicator, { size: 20 })), para([run(fmt(r.pct), { bold: true, size: 20 }), run(`  ${r.level}  ← ${r.target}%`, { size: 18, color: levelColor(r.level).slice(1) })])], { w: W[2] }),
    cell([para(run(r.need, { size: 18 })), para([run('الهدف: ', { bold: true, size: 18 }), run(r.goal, { size: 18 })])], { w: W[3] }),
    cell(lines(procs(r).map((p) => (p.when ? `${p.text} (${p.when})` : p.text)), true), { w: W[4] }),
    cell(r.methods, { w: W[5], size: 18 }),
    cell(`${r.from} - ${r.to}`, { w: W[6], align: docx.AlignmentType.CENTER, size: 18 }),
    cell(respOf(r).split('\n').map((l) => para(run(l, { size: 18 }))), { w: W[7] }),
    cell([para(run(r.measure, { size: 18 })), ...lines(r.evidence, false)], { w: W[8] }),
  ] }));
  const logo = logoData(school, uploadsDir);
  const headKids = [];
  if (logo && ['png', 'jpeg', 'gif'].includes(logo.type)) headKids.push(new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.ImageRun({ type: logo.type === 'jpeg' ? 'jpg' : logo.type, data: logo.buf, transformation: { width: 80, height: 80 } })] }));
  const doc = new docx.Document({
    creator: 'معياري للمدرسة',
    title: `${TITLE} - ${school.name}`,
    styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
    sections: [{
      properties: { page: { size: { orientation: docx.PageOrientation.LANDSCAPE }, margin: { top: 600, bottom: 600, left: 600, right: 600 } } },
      children: [
        ...letterheadDocx(school, uploadsDir),
        para(run(TITLE, { size: 36, bold: true, color: '0F766E' }), { align: docx.AlignmentType.CENTER }),
        para(run(`${SUB}${report.cycle ? ` (${report.cycle})` : ''}`, { size: 24 }), { align: docx.AlignmentType.CENTER }),
        ...(useMoe(school) ? [] : [para([run(`${school.name}`, { bold: true, size: 24 }), run(`${school.ministry_number ? `  |  الرقم الوزاري: ${school.ministry_number}` : ''}  |  العام الدراسي ${school.year}`, { size: 22 })], { align: docx.AlignmentType.CENTER, after: 120 })]),
        heading('أولاً: البيانات الأساسية'),
        basicsDocx(school, report),
        ...(planTypeOf(report.overall) ? [para(run(`مستوى المدرسة العام: ${levelOf(report.overall).name}، والمطلوب حسب النموذج الإشرافي: ${planTypeOf(report.overall)}.`, { size: 22 }), { after: 80 })] : []),
        para(run(`مؤشرات تحتاج تحسين: ${plan.total}  |  مؤشرات في مستوى التميز: ${plan.strengths.length}`, { size: 22 }), { after: 120 }),
        heading('ثانياً: إجراءات خطة التحسين'),
        new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows: [header, ...body] }),
        heading('ثالثاً: التوصيات والمقترحات'),
        ...lines(recsOf(plan, 'plan'), true),
        para(run(''), { after: 300 }),
        signDocx(['رئيس لجنة التميز', `مدير/ة المدرسة\n${school.principal || ''}\nالتوقيع`, 'ختم المدرسة']),
      ],
    }],
  });
  return docx.Packer.toBuffer(doc);
}

// ---------- تقرير متابعة التنفيذ ----------
// مبني على حقول «استمارة المدرسة (2): تنفيذ خطة التحسين» في النموذج الإشرافي:
// المجال، العنصر المراد تحسينه، الإجراءات المنفذة، مقدم خدمات دعم التميز (لجان المدرسة / المشرف التربوي)،
// ثم التوصيات والمقترحات وتوقيع مدير المدرسة والختم. ونضيف عليها نسبة الإنجاز وتاريخ التنفيذ والمتبقي.
const FOLLOW_TITLE = 'تقرير متابعة تنفيذ خطة التحسين';
function followRows(plan) {
  // نرتب حسب المجال عشان يتجمع في الجدول مثل الاستمارة
  const rows = plan.rows.map(full);
  const order = [...new Set(rows.map((r) => r.supervisory || r.domain))];
  return order.flatMap((d) => rows.filter((r) => (r.supervisory || r.domain) === d));
}
function followupHtml({ school, report, plan, uploadsDir, base = '' }) {
  const logo = logoData(school, uploadsDir);
  const all = progress(plan.rows);
  const rows = followRows(plan);
  // المجال يتكرر في كل صف (بدل دمج الخلايا) عشان الجدول ينقسم صح بين الصفحات
  let prev = '';
  const trs = rows.map((r) => {
    const d = r.supervisory || r.domain;
    const first = d !== prev; prev = d;
    const ps = procs(r); const pr = progress([r]);
    const done = ps.filter((p) => p.done); const left = ps.filter((p) => !p.done);
    return `<tr><td class="dom${first ? '' : ' rep'}">${esc(d)}</td>
    <td><b><bdi dir="ltr">${esc(r.code)}</bdi></b> ${esc(r.indicator)}<div class="std">${fmt(r.pct)} ← المستهدف ${r.target}%</div></td>
    <td>${done.length ? `<ul class="chk">${done.map((p) => `<li class="ok">✔ ${esc(p.text)}${p.done_at ? ` <span class="when">(${esc(dateAr(p.done_at))})</span>` : ''}${p.assignee_name ? `<div class="std">المنفذ: ${esc(p.assignee_name)}</div>` : ''}${p.evidence ? `<div class="std">📎 ${base ? `<a href="${esc(base)}/v/${esc(p.evidence.code)}">${esc(evText(p))}</a>` : esc(evText(p))}</div>` : ''}</li>`).join('')}</ul>` : '<span class="std">لم يُنفذ شيء بعد</span>'}</td>
    <td>${left.length ? `<ul class="chk">${left.map((p) => `<li>○ ${esc(p.text)}${p.when ? ` <span class="when">(${esc(p.when)})</span>` : ''}${p.assignee_name ? `<div class="std">المسند إلى: ${esc(p.assignee_name)}</div>` : ''}</li>`).join('')}</ul>` : '<span class="ok">اكتملت الإجراءات</span>'}${r.note ? `<div class="std"><b>ملاحظة:</b> ${esc(r.note)}</div>` : ''}</td>
    <td class="c"><b>${pctOf(pr)}%</b><div class="bar"><i style="width:${pctOf(pr)}%"></i></div></td>
    <td>${esc(r.committee)}</td><td>${esc(r.supervisor) || '&nbsp;'}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${FOLLOW_TITLE} - ${esc(school.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 10mm; } * { box-sizing: border-box; }
body { font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #10201e; margin: 0; background: #eef2f1; font-size: 11px; line-height: 1.55; }
.page { background: #fff; max-width: 297mm; margin: 12px auto; padding: 12mm; }
.head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0f766e; padding-bottom: 10px; margin-bottom: 10px; }
.head img { width: 64px; height: 64px; object-fit: contain; }
${LH_CSS} .head h1 { margin: 0; font-size: 20px; color: #0f766e; } .head .meta { margin-inline-start: auto; text-align: left; font-size: 12px; }
.sec { font-size: 14px; color: #0f766e; margin: 12px 0 6px; }
.big { display: flex; gap: 16px; align-items: center; border: 1px solid #dde5e4; border-radius: 8px; padding: 8px 14px; margin: 10px 0; }
.big b { font-size: 22px; color: #0f766e; } .big .bar { flex: 1; height: 12px; }
table { width: 100%; border-collapse: collapse; } th { background: #0f766e; color: #fff; padding: 5px; font-weight: 600; } td { border: 1px solid #cfd9d7; padding: 5px; vertical-align: top; } td.c { text-align: center; }
td.dom { background: #eef6f5; font-weight: 700; color: #0f4f4a; text-align: center; vertical-align: middle; } td.dom.rep { color: #8aa5a1; font-weight: 400; }
.sec { break-after: avoid; }
.basic th { background: #eef6f5; color: #0f4f4a; width: 13%; text-align: right; } .basic td { width: 20%; }
.chk a { color: inherit; } .chk { list-style: none; margin: 0; padding: 0; } .ok { color: #0b8f55; } .when { color: #667; font-size: 10px; } .std { color: #667; font-size: 10px; margin-top: 3px; }
.bar { height: 8px; background: #e2e8e7; border-radius: 99px; overflow: hidden; margin-top: 4px; } .bar i { display: block; height: 100%; background: #0f766e; }
.recs { font-size: 12px; }
.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 22px; text-align: center; font-size: 12px; } .sign div { border-top: 1px dashed #999; padding-top: 6px; }
.tools { text-align: center; padding: 10px; } .tools button { font: inherit; padding: 8px 18px; border-radius: 8px; border: 0; background: #0f766e; color: #fff; cursor: pointer; }
thead { display: table-header-group; } tr { page-break-inside: avoid; }
@media print { body { background: #fff; } .page { margin: 0; padding: 0; } .tools { display: none; } }
</style></head><body><div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div><div class="page">
${letterheadHtml(school, logo)}<div class="head${useMoe(school) ? ' t' : ''}">${logo && !useMoe(school) ? `<img src="data:image/${logo.type};base64,${logo.buf.toString('base64')}" alt="">` : ''}<div><h1>${FOLLOW_TITLE}</h1><div>بتاريخ ${esc(dateAr())}</div></div>
${useMoe(school) ? '' : `<div class="meta"><b>${esc(school.name)}</b><br>${school.ministry_number ? `الرقم الوزاري: ${esc(school.ministry_number)}<br>` : ''}العام الدراسي ${esc(school.year)}</div>`}</div>
<h2 class="sec">أولاً: البيانات الأساسية</h2>
${basicsHtml(school, report)}
<div class="big"><span>نسبة الإنجاز الكلية</span><b>${pctOf(all)}%</b><span>(${all.done} من ${all.total} إجراء)</span><div class="bar"><i style="width:${pctOf(all)}%"></i></div></div>
<h2 class="sec">ثانياً: إجراءات تنفيذ خطة التحسين</h2>
<table><thead><tr><th rowspan="2" style="width:9%">المجال</th><th rowspan="2" style="width:19%">العنصر / المؤشر المراد تحسينه</th><th rowspan="2" style="width:22%">الإجراءات المنفذة</th><th rowspan="2" style="width:20%">إجراءات لم تُنفذ بعد</th><th rowspan="2" style="width:7%">نسبة الإنجاز</th><th colspan="2">مقدم خدمات دعم التميز المدرسي</th></tr>
<tr><th style="width:12%">لجان المدرسة</th><th style="width:11%">المشرف التربوي</th></tr></thead><tbody>${trs}</tbody></table>
${recsHtml(recsOf(plan, 'followup'))}
<div class="sign"><div>رئيس لجنة التميز</div><div>مدير/ة المدرسة<br>${esc(school.principal)}<br>التوقيع</div><div>ختم المدرسة</div></div>
</div></body></html>`;
}

async function followupDocx({ school, report, plan, uploadsDir }) {
  const all = progress(plan.rows);
  const rows = followRows(plan);
  const W = [10, 19, 22, 20, 7, 12, 10];
  const h1 = new docx.TableRow({ tableHeader: true, children: ['المجال', 'العنصر / المؤشر المراد تحسينه', 'الإجراءات المنفذة', 'إجراءات لم تُنفذ بعد', 'نسبة الإنجاز', 'لجان المدرسة', 'المشرف التربوي'].map((t, i) => cell(t, { bold: true, color: 'FFFFFF', fill: '0F766E', w: W[i], align: docx.AlignmentType.CENTER })) });
  const body = rows.map((r) => {
    const ps = procs(r);
    const done = ps.filter((p) => p.done); const left = ps.filter((p) => !p.done);
    return new docx.TableRow({ cantSplit: true, children: [
      cell(r.supervisory || r.domain, { w: W[0], bold: true, fill: 'EEF6F5', align: docx.AlignmentType.CENTER }),
      cell([para(run(`‪${r.code}‬`, { bold: true, size: 20 })), para(run(r.indicator, { size: 20 })), para(run(`${fmt(r.pct)} ← المستهدف ${r.target}%`, { size: 16, color: '666666' }))], { w: W[1] }),
      cell(done.length ? done.flatMap((p) => [para(run(`✔ ${p.text}${p.done_at ? ` (${dateAr(p.done_at)})` : ''}`, { size: 18, color: '0B8F55' }), { after: 0 }), ...[p.assignee_name && `المنفذ: ${p.assignee_name}`, evText(p)].filter(Boolean).map((t) => para(run(t, { size: 16, color: '666666' }), { after: 0 })), para(run('', { size: 8 }), { after: 20 })]) : 'لم يُنفذ شيء بعد', { w: W[2], size: 18 }),
      cell([...(left.length ? left.flatMap((p) => [para(run(`○ ${p.text}${p.when ? ` (${p.when})` : ''}`, { size: 18 }), { after: 20 }), ...(p.assignee_name ? [para(run(`المسند إلى: ${p.assignee_name}`, { size: 16, color: '666666' }), { after: 20 })] : [])]) : [para(run('اكتملت الإجراءات', { size: 18, color: '0B8F55' }))]), ...(r.note ? [para(run(`ملاحظة: ${r.note}`, { size: 16, color: '666666' }))] : [])], { w: W[3] }),
      cell(`${pctOf(progress([r]))}%`, { w: W[4], bold: true, align: docx.AlignmentType.CENTER }),
      cell(r.committee, { w: W[5], size: 18 }),
      cell(r.supervisor || ' ', { w: W[6], size: 18 }),
    ] });
  });
  const doc = new docx.Document({
    creator: 'معياري للمدرسة', title: `${FOLLOW_TITLE} - ${school.name}`,
    styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
    sections: [{ properties: landscape, children: [
      ...letterheadDocx(school, uploadsDir),
      para(run(FOLLOW_TITLE, { size: 36, bold: true, color: '0F766E' }), { align: docx.AlignmentType.CENTER }),
      para(run(`بتاريخ ${dateAr()}`, { size: 22 }), { align: docx.AlignmentType.CENTER, after: 120 }),
      heading('أولاً: البيانات الأساسية'),
      basicsDocx(school, report),
      para(run(`نسبة الإنجاز الكلية: ${pctOf(all)}% (${all.done} من ${all.total} إجراء)`, { size: 24, bold: true }), { after: 120 }),
      heading('ثانياً: إجراءات تنفيذ خطة التحسين'),
      para(run('مقدم خدمات دعم التميز المدرسي: لجان المدرسة والمشرف التربوي (العمودان الأخيران).', { size: 18, color: '666666' })),
      new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows: [h1, ...body] }),
      heading('ثالثاً: التوصيات والمقترحات'),
      ...lines(recsOf(plan, 'followup'), true),
      para(run(''), { after: 300 }),
      signDocx(['رئيس لجنة التميز', `مدير/ة المدرسة\n${school.principal || ''}\nالتوقيع`, 'ختم المدرسة']),
    ] }],
  });
  return docx.Packer.toBuffer(doc);
}

module.exports = { printHtml, planDocx, followupHtml, followupDocx, progress, procs, esc, LH_CSS, letterheadHtml, letterheadDocx, logoData, useMoe, run, para, cell, lines, heading, signDocx, FONT, dateAr };
