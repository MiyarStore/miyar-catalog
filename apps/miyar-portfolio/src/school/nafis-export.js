// طباعة وتصدير «الخطة العلاجية لنافس» (PDF من المتصفح، وWord)
const docx = require('docx');
const { esc, LH_CSS, letterheadHtml, letterheadDocx, logoData, useMoe, run, para, cell, lines, heading, signDocx, FONT } = require('./export');
const { analyze, CLS } = require('./nafis');

const TITLE = 'الخطة العلاجية لنتائج نافس';
const sub = (card) => `مبنية على بطاقة الأداء المدرسي في منصة تميز${card.year ? ` - نتائج ${card.year}هـ` : ''}`;
const pct = (n) => (n == null ? '-' : `${n}%`);
const sgn = (n) => (n == null ? '-' : `\u2066${n > 0 ? '+' : ''}${n}\u2069`);
const clsName = (c) => (c ? CLS[c].name : '-');
const tag = (c) => (c ? `<span class="lv" style="background:${CLS[c].color}">${CLS[c].name}</span>` : '-');
const GENDER = { boys: 'بنين', girls: 'بنات' };

function basics(school, card) {
  return [
    ['اسم المدرسة', school.name], ['الرقم الوزاري', school.ministry_number || ''], ['مكتب / إدارة التعليم', school.office],
    ['العام الدراسي', school.year], ['نتائج نافس', card.year ? `${card.year}هـ` : ''], ['جنس المدرسة', GENDER[school.gender] || school.gender || ''],
  ];
}
const recList = (plan) => String(plan.recommendations || '').split('\n').map((x) => x.trim()).filter(Boolean);

// ---------- صفحة الطباعة ----------
function nafisHtml({ school, card, plan, trial, uploadsDir }) {
  const a = analyze(card);
  const logo = logoData(school, uploadsDir);
  const moe = useMoe(school);
  const bar = (v, k) => `<div class="bars"><i style="width:${v ?? 0}%"></i><u style="inset-inline-start:${k ?? 0}%"></u></div>`;
  const grades = a.grades.map((g) => `
  <h3 class="gh">${esc(g.name)}</h3>
  <div class="gmeta">المسجلون: <b>${g.students ?? '-'}</b> · المختبرون: <b>${g.tested ?? '-'}</b> · نسبة المشاركة: <b>${pct(g.participation)}</b>${g.index != null ? ` · المؤشر الجامع: <b>${g.index}</b>${g.change != null ? ` (${sgn(g.change)} عن العام الماضي)` : ''}` : ''}</div>
  <table><thead><tr><th style="width:14%">المادة</th><th>إتقان المدرسة</th><th>الإدارة</th><th>المملكة</th><th>الفرق عن المملكة</th><th>التغير عن العام الماضي</th><th>التصنيف</th><th>المستهدف</th></tr></thead><tbody>
  ${g.subjects.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td class="c"><b>${pct(s.mastery)}</b></td><td class="c">${pct(s.office)}</td><td class="c">${pct(s.ksa)}</td><td class="c">${sgn(s.gap)}</td><td class="c">${sgn(s.change)}</td><td class="c">${tag(s.cls)}</td><td class="c">${pct(s.target)}</td></tr>`).join('')}
  </tbody></table>
  <table class="dom"><thead><tr><th style="width:14%">المادة</th><th style="width:22%">المجال الفرعي</th><th>المدرسة</th><th>الإدارة</th><th>المملكة</th><th>الفرق</th><th style="width:20%">المدرسة مقابل المملكة</th><th>التصنيف</th></tr></thead><tbody>
  ${g.subjects.flatMap((s) => s.domains.map((d, i) => `<tr>${i === 0 ? `<td rowspan="${s.domains.length}"><b>${esc(s.name)}</b></td>` : ''}<td>${esc(d.name)}</td><td class="c"><b>${pct(d.school)}</b></td><td class="c">${pct(d.office)}</td><td class="c">${pct(d.ksa)}</td><td class="c">${sgn(d.gap)}</td><td>${bar(d.school, d.ksa)}</td><td class="c">${tag(d.cls)}</td></tr>`)).join('') || '<tr><td colspan="8" class="c std">لم تُدخل المجالات الفرعية</td></tr>'}
  </tbody></table>`).join('');

  let n = 0;
  const groups = [];
  for (const r of plan.rows) { const k = `${r.grade_name}|${r.subject_name}`; const last = groups[groups.length - 1]; if (last && last.k === k) last.rows.push(r); else groups.push({ k, rows: [r] }); }
  const rows = groups.map((gr) => gr.rows.map((r, i) => `<tr>
    <td class="c">${++n}</td>
    ${i === 0 ? `<td rowspan="${gr.rows.length}"><b>${esc(r.subject_name)}</b><div class="std">${esc(r.grade_name)}</div></td>` : ''}
    <td><b>${esc(r.domain)}</b><div>${tag(r.cls)}</div></td>
    <td class="c"><b>${pct(r.school)}</b><div class="std">المملكة ${pct(r.ksa)}</div></td>
    <td class="c"><b>${pct(r.target)}</b></td>
    <td><ol>${r.actions.map((x) => `<li>${esc(x.text)}${x.when ? ` <span class="when">(${esc(x.when)})</span>` : ''}</li>`).join('')}</ol></td>
    <td>${esc(r.owner)}</td>
    <td>${esc(r.measure)}</td>
  </tr>`).join('')).join('');
  const S = plan.summary || {};
  const recs = recList(plan);
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
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 8px; }
th { background: #0f766e; color: #fff; font-weight: 600; padding: 6px 4px; font-size: 11px; }
td { border: 1px solid #cfd9d7; padding: 5px; vertical-align: top; }
td.c { text-align: center; }
.dom th { background: #3f8f88; }
.std { color: #667; font-size: 10px; margin-top: 2px; }
.lv { display: inline-block; color: #fff; border-radius: 99px; padding: 0 8px; font-size: 10px; font-weight: 600; white-space: nowrap; }
ol, ul { margin: 0; padding-inline-start: 16px; }
thead { display: table-header-group; } tr { page-break-inside: avoid; }
.sec { font-size: 14px; color: #0f766e; margin: 14px 0 6px; break-after: avoid; }
.gh { font-size: 13px; margin: 10px 0 2px; } .gmeta { font-size: 11.5px; margin-bottom: 6px; color: #333; }
.basic th { background: #eef6f5; color: #0f4f4a; font-weight: 600; width: 13%; text-align: right; } .basic td { width: 20%; }
.bars { position: relative; height: 10px; background: #edf1f0; border-radius: 99px; margin-top: 3px; }
.bars i { position: absolute; inset-block: 0; inset-inline-start: 0; background: #0f766e; border-radius: 99px; }
.bars u { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #b42318; }
.exec { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .exec > div { border: 1px solid #dde5e4; border-radius: 8px; padding: 8px 10px; }
.exec h3 { margin: 0 0 4px; font-size: 13px; color: #0f766e; } .exec ul, .exec ol { font-size: 11.5px; }
.decision { background: #eef6f5; border-radius: 8px; padding: 8px 12px; margin: 8px 0; font-size: 12px; }
.when { color: #0f766e; font-size: 10px; }
.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 22px; text-align: center; font-size: 12px; }
.sign div { border-top: 1px dashed #999; padding-top: 6px; }
.wm { position: fixed; inset: 0; display: grid; place-items: center; pointer-events: none; font-size: 80px; color: rgba(180, 35, 24, .09); transform: rotate(-20deg); font-weight: 700; }
.trial { background: #fff4e5; border: 1px solid #f5c26b; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; font-size: 12px; }
.tools { text-align: center; padding: 10px; }
.tools button { font: inherit; padding: 8px 18px; border-radius: 8px; border: 0; background: #0f766e; color: #fff; cursor: pointer; }
.legend { font-size: 10.5px; color: #555; margin: -2px 0 8px; }
@media print { body { background: #fff; } .page { margin: 0; padding: 0; max-width: none; } .tools { display: none; } }
</style></head><body>
<div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div>
${trial ? `<div class="wm">${card.sample ? 'نموذج للعرض' : 'نسخة تجريبية'}</div>` : ''}
<div class="page">
  ${letterheadHtml(school, logo)}<div class="head${moe ? ' t' : ''}">${!moe && logo ? `<img class="logo" src="data:image/${logo.type};base64,${logo.buf.toString('base64')}" alt="">` : ''}<div><h1>${TITLE}</h1><div>${esc(sub(card))}</div></div>
    ${moe ? '' : `<div class="meta"><b>${esc(school.name)}</b><br>${school.ministry_number ? `الرقم الوزاري: ${esc(school.ministry_number)}<br>` : ''}${esc(school.office)}<br>العام الدراسي ${esc(school.year)}</div>`}</div>
  ${card.sample ? '<div class="trial">هذا نموذج مبني على بطاقة نافس لمدرسة حقيقية بعد إخفاء بياناتها، للعرض فقط. أدخل أرقام بطاقة مدرستك لتحصل على خطتها.</div>' : trial ? `<div class="trial">هذه نسخة تجريبية تعرض أول ${plan.rows.length} مجالات من أصل ${plan.total}. فعّل الباقة لتحصل على الخطة كاملة بدون علامة مائية وبصيغة Word.</div>` : ''}
  <h2 class="sec">أولاً: البيانات الأساسية</h2>
  <table class="basic"><tbody>${[0, 3].map((i) => `<tr>${basics(school, card).slice(i, i + 3).map(([k, v]) => `<th>${esc(k)}</th><td>${esc(v) || '&nbsp;'}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <h2 class="sec">ثانياً: تحليل النتائج</h2>
  <div class="legend">التصنيف مقارنة بمتوسط المملكة: <b>نقطة قوة</b> أعلى بـ 3 نقاط فأكثر، <b>أولوية عاجلة</b> أقل بـ 3 نقاط فأكثر، و<b>يحتاج تحسيناً</b> ما بينهما. الخط الأحمر في الشريط هو متوسط المملكة. المستهدف مرحلي: يقرّب المدرسة من متوسط المملكة بين 5 و15 نقطة.</div>
  ${grades}
  <h2 class="sec">ثالثاً: الملخص التنفيذي لقائد/ة المدرسة</h2>
  <div class="exec">
    <div><h3>النتائج باختصار</h3><ul>${(S.lines || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>
    <div><h3>أكبر الفجوات (أولوية عاجلة)</h3><ol>${(plan.priorities || []).map((d) => `<li>${esc(d.domain)} - ${esc(d.subject_name)} (${esc(d.grade_name)}): ${pct(d.school)} مقابل ${pct(d.ksa)}</li>`).join('') || '<li>لا يوجد</li>'}</ol>
      <h3 style="margin-top:6px">نقاط القوة</h3><ul>${(plan.strengths || []).slice(0, 5).map((d) => `<li>${esc(d.domain)} - ${esc(d.subject_name)}: ${pct(d.school)} (${sgn(d.gap)} عن المملكة)</li>`).join('') || '<li>لا يوجد مجال أعلى من متوسط المملكة بـ 3 نقاط</li>'}</ul></div>
  </div>
  ${S.decision ? `<div class="decision"><b>القرار المقترح:</b> ${esc(S.decision)}</div>` : ''}
  <ol style="font-size:12px">${(S.steps || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
  <h2 class="sec">رابعاً: الخطة العلاجية لكل مادة ومجال</h2>
  <table><thead><tr><th style="width:3%">م</th><th style="width:9%">المادة</th><th style="width:13%">المجال الفرعي</th><th style="width:8%">الواقع (خط الأساس)</th><th style="width:6%">المستهدف</th><th style="width:33%">الإجراءات العلاجية</th><th style="width:12%">المسؤول</th><th style="width:16%">مؤشر المتابعة</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="c">كل المجالات أعلى من متوسط المملكة، والخطة إثرائية (انظر الإجراءات على مستوى المدرسة)</td></tr>'}</tbody></table>
  <h2 class="sec">خامساً: إجراءات على مستوى المدرسة</h2>
  <table><thead><tr><th style="width:3%">م</th><th style="width:55%">الإجراء</th><th style="width:22%">المسؤول</th><th>التوقيت</th></tr></thead><tbody>
  ${(plan.school_actions || []).map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.text)}</td><td>${esc(x.owner)}</td><td>${esc(x.when)}</td></tr>`).join('')}</tbody></table>
  ${recs.length ? `<h2 class="sec">سادساً: التوصيات</h2><ol style="font-size:12px">${recs.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
  <div class="sign"><div>منسق/ة نافس</div><div>قائد/ة المدرسة<br>${esc(school.principal)}<br>التوقيع</div><div>ختم المدرسة</div></div>
</div></body></html>`;
}

// ---------- Word ----------
const C = docx.AlignmentType.CENTER;
const table = (rows) => new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows });
const headRow = (heads, W, fill = '0F766E') => new docx.TableRow({ tableHeader: true, children: heads.map((h, i) => cell(h, { bold: true, color: 'FFFFFF', fill, w: W[i], align: C })) });
const clsCell = (c, w) => cell(clsName(c), { w, align: C, bold: true, color: c ? CLS[c].color.slice(1) : undefined });

async function nafisDocx({ school, card, plan, uploadsDir }) {
  const a = analyze(card);
  const kids = [
    ...letterheadDocx(school, uploadsDir),
    para(run(TITLE, { size: 36, bold: true, color: '0F766E' }), { align: C }),
    para(run(sub(card), { size: 24 }), { align: C, after: 120 }),
    heading('أولاً: البيانات الأساسية'),
    table([0, 3].map((i) => new docx.TableRow({ children: basics(school, card).slice(i, i + 3).flatMap(([k, v]) => [cell(k, { bold: true, fill: 'EEF6F5', w: 13 }), cell(v || ' ', { w: 20 })]) }))),
    heading('ثانياً: تحليل النتائج'),
    para(run('التصنيف مقارنة بمتوسط المملكة: نقطة قوة أعلى بـ 3 نقاط فأكثر، أولوية عاجلة أقل بـ 3 نقاط فأكثر، ويحتاج تحسيناً ما بينهما.', { size: 18, color: '555555' })),
  ];
  for (const g of a.grades) {
    kids.push(para(run(g.name, { bold: true, size: 24 }), { after: 20 }));
    kids.push(para(run(`المسجلون: ${g.students ?? '-'}  |  المختبرون: ${g.tested ?? '-'}  |  نسبة المشاركة: ${pct(g.participation)}${g.index != null ? `  |  المؤشر الجامع: ${g.index}${g.change != null ? ` (${sgn(g.change)})` : ''}` : ''}`, { size: 20 }), { after: 60 }));
    const W1 = [16, 12, 12, 12, 12, 12, 12, 12];
    kids.push(table([headRow(['المادة', 'إتقان المدرسة', 'الإدارة', 'المملكة', 'الفرق عن المملكة', 'التغير عن العام الماضي', 'التصنيف', 'المستهدف'], W1),
      ...g.subjects.map((s) => new docx.TableRow({ children: [cell(s.name, { w: W1[0], bold: true }), cell(pct(s.mastery), { w: W1[1], align: C, bold: true }), cell(pct(s.office), { w: W1[2], align: C }), cell(pct(s.ksa), { w: W1[3], align: C }), cell(sgn(s.gap), { w: W1[4], align: C }), cell(sgn(s.change), { w: W1[5], align: C }), clsCell(s.cls, W1[6]), cell(pct(s.target), { w: W1[7], align: C })] }))]));
    kids.push(para(run(''), { after: 60 }));
    const W2 = [16, 28, 12, 12, 12, 8, 12];
    const drows = g.subjects.flatMap((s) => s.domains.map((d) => new docx.TableRow({ children: [cell(s.name, { w: W2[0] }), cell(d.name, { w: W2[1] }), cell(pct(d.school), { w: W2[2], align: C, bold: true }), cell(pct(d.office), { w: W2[3], align: C }), cell(pct(d.ksa), { w: W2[4], align: C }), cell(sgn(d.gap), { w: W2[5], align: C }), clsCell(d.cls, W2[6])] })));
    if (drows.length) kids.push(table([headRow(['المادة', 'المجال الفرعي', 'المدرسة', 'الإدارة', 'المملكة', 'الفرق', 'التصنيف'], W2, '3F8F88'), ...drows]));
    kids.push(para(run(''), { after: 80 }));
  }
  const S = plan.summary || {};
  kids.push(heading('ثالثاً: الملخص التنفيذي لقائد/ة المدرسة'));
  kids.push(...lines(S.lines || [], false));
  if ((plan.priorities || []).length) { kids.push(para(run('أكبر الفجوات (أولوية عاجلة):', { bold: true }))); kids.push(...lines(plan.priorities.map((d) => `${d.domain} - ${d.subject_name} (${d.grade_name}): ${pct(d.school)} مقابل ${pct(d.ksa)}`), true)); }
  if ((plan.strengths || []).length) { kids.push(para(run('نقاط القوة:', { bold: true }))); kids.push(...lines(plan.strengths.slice(0, 5).map((d) => `${d.domain} - ${d.subject_name}: ${pct(d.school)} (${sgn(d.gap)} عن المملكة)`), false)); }
  if (S.decision) kids.push(para([run('القرار المقترح: ', { bold: true }), run(S.decision)], { after: 60 }));
  kids.push(...lines(S.steps || [], true));
  kids.push(heading('رابعاً: الخطة العلاجية لكل مادة ومجال'));
  const W3 = [4, 10, 14, 9, 7, 30, 12, 14];
  kids.push(table([headRow(['م', 'المادة', 'المجال الفرعي', 'الواقع (خط الأساس)', 'المستهدف', 'الإجراءات العلاجية', 'المسؤول', 'مؤشر المتابعة'], W3),
    ...plan.rows.map((r, i) => new docx.TableRow({ cantSplit: true, children: [
      cell(String(i + 1), { w: W3[0], align: C }),
      cell([para(run(r.subject_name, { bold: true, size: 20 })), para(run(r.grade_name, { size: 16, color: '666666' }))], { w: W3[1] }),
      cell([para(run(r.domain, { bold: true, size: 20 })), para(run(clsName(r.cls), { size: 18, bold: true, color: CLS[r.cls].color.slice(1) }))], { w: W3[2] }),
      cell([para(run(pct(r.school), { bold: true, size: 20 }), { align: C }), para(run(`المملكة ${pct(r.ksa)}`, { size: 16, color: '666666' }), { align: C })], { w: W3[3] }),
      cell(pct(r.target), { w: W3[4], align: C, bold: true }),
      cell(lines(r.actions.map((x) => (x.when ? `${x.text} (${x.when})` : x.text)), true), { w: W3[5] }),
      cell(r.owner, { w: W3[6], size: 18 }),
      cell(r.measure, { w: W3[7], size: 18 }),
    ] }))]));
  kids.push(heading('خامساً: إجراءات على مستوى المدرسة'));
  const W4 = [4, 56, 22, 18];
  kids.push(table([headRow(['م', 'الإجراء', 'المسؤول', 'التوقيت'], W4), ...(plan.school_actions || []).map((x, i) => new docx.TableRow({ children: [cell(String(i + 1), { w: W4[0], align: C }), cell(x.text, { w: W4[1] }), cell(x.owner, { w: W4[2], size: 18 }), cell(x.when, { w: W4[3], size: 18 })] }))]));
  const recs = recList(plan);
  if (recs.length) { kids.push(heading('سادساً: التوصيات')); kids.push(...lines(recs, true)); }
  kids.push(para(run(''), { after: 300 }));
  kids.push(signDocx(['منسق/ة نافس', `قائد/ة المدرسة\n${school.principal || ''}\nالتوقيع`, 'ختم المدرسة']));
  const doc = new docx.Document({
    creator: 'معياري للمدرسة',
    title: `${TITLE} - ${school.name}`,
    styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
    sections: [{ properties: { page: { size: { orientation: docx.PageOrientation.LANDSCAPE }, margin: { top: 600, bottom: 600, left: 600, right: 600 } } }, children: kids }],
  });
  return docx.Packer.toBuffer(doc);
}

module.exports = { nafisHtml, nafisDocx, NAFIS_TITLE: TITLE };
