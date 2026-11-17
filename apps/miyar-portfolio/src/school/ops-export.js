// تصدير الخطة التشغيلية (طباعة PDF وWord) والعرض التقديمي للمدرسة.
const docx = require('docx');
const { LEVELS, levelOf } = require('./indicators');
const { TYPES } = require('./operational');
const X = require('./export');
const { esc, basicsHtml, basicsDocx, LH_CSS, letterheadHtml, letterheadDocx, logoData, useMoe, run, para, cell, lines, heading, signDocx, FONT, dateAr } = X;

const TITLE = 'الخطة التشغيلية للمدرسة';
const fmt = (n) => (n == null ? '-' : `${Math.round(n * 100) / 100}%`);
const lvColor = (p) => (p == null ? '#888' : levelOf(p).color);
const imgTag = (logo, cls = '') => (logo ? `<img class="${cls}" src="data:image/${logo.type};base64,${logo.buf.toString('base64')}" alt="">` : '');
const SW = [['s', 'نقاط القوة', '#0b8f55'], ['w', 'نقاط الضعف', '#d33a2c'], ['o', 'الفرص', '#1a6fe0'], ['t', 'التحديات', '#d9690a']];
const swotHtml = (sw) => `<div class="swot">${SW.map(([k, t, c]) => `<div style="border-color:${c}"><h3 style="color:${c}">${t}</h3><ul>${(sw[k] || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="std">-</li>'}</ul></div>`).join('')}</div>`;
const tag = (t) => `<span class="tp" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`;

const CSS = `@page { size: A4 landscape; margin: 10mm; } * { box-sizing: border-box; }
body { font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #10201e; margin: 0; background: #eef2f1; font-size: 11px; line-height: 1.6; }
.page { background: #fff; max-width: 297mm; margin: 12px auto; padding: 12mm; position: relative; }
.head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0f766e; padding-bottom: 10px; margin-bottom: 10px; }
.head img { width: 64px; height: 64px; object-fit: contain; } .head h1 { margin: 0; font-size: 20px; color: #0f766e; } .head .meta { margin-inline-start: auto; text-align: left; font-size: 12px; }
${LH_CSS}
.sec { font-size: 14px; color: #0f766e; margin: 14px 0 6px; break-after: avoid; }
table { width: 100%; border-collapse: collapse; } th { background: #0f766e; color: #fff; padding: 5px; font-weight: 600; } td { border: 1px solid #cfd9d7; padding: 5px; vertical-align: top; } td.c { text-align: center; }
.basic th { background: #eef6f5; color: #0f4f4a; width: 13%; text-align: right; } .basic td { width: 20%; }
.vm { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } .vm div { border: 1px solid #dde5e4; border-radius: 8px; padding: 8px; } .vm b { color: #0f766e; display: block; }
.swot { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .swot > div { border: 1.5px solid; border-radius: 8px; padding: 6px 10px; } .swot h3 { margin: 0 0 4px; font-size: 13px; } .swot ul { margin: 0; padding-inline-start: 18px; }
.tp { color: #fff; border-radius: 99px; padding: 1px 8px; font-size: 10px; white-space: nowrap; } .std { color: #667; font-size: 10px; } ol { margin: 0; padding-inline-start: 16px; }
.bar { height: 7px; background: #e2e8e7; border-radius: 99px; overflow: hidden; margin-top: 4px; } .bar i { display: block; height: 100%; background: #0f766e; }
.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 22px; text-align: center; font-size: 12px; } .sign div { border-top: 1px dashed #999; padding-top: 6px; }
.tools { text-align: center; padding: 10px; } .tools button { font: inherit; padding: 8px 18px; border-radius: 8px; border: 0; background: #0f766e; color: #fff; cursor: pointer; }
.wm { position: fixed; inset: 0; display: grid; place-items: center; pointer-events: none; font-size: 70px; color: rgba(15,118,110,.08); transform: rotate(-20deg); font-weight: 700; }
thead { display: table-header-group; } tr { page-break-inside: avoid; }
@media print { body { background: #fff; } .page { margin: 0; padding: 0; } .tools { display: none; } }`;

function head(school, logo, title) {
  return `${letterheadHtml(school, logo)}<div class="head${useMoe(school) ? ' t' : ''}">${logo && !useMoe(school) ? imgTag(logo) : ''}<div><h1>${title}</h1><div>بتاريخ ${esc(dateAr())}</div></div>
${useMoe(school) ? '' : `<div class="meta"><b>${esc(school.name)}</b><br>${school.ministry_number ? `الرقم الوزاري: ${esc(school.ministry_number)}<br>` : ''}العام الدراسي ${esc(school.year)}</div>`}</div>`;
}

function opsHtml({ school, report, ops, trial, uploadsDir }) {
  const logo = logoData(school, uploadsDir);
  const progs = ops.programs.map((p, i) => `<tr>
    <td class="c">${i + 1}</td>
    <td><b>${esc(p.name)}</b><div style="margin-top:3px">${tag(p.type)}</div><div class="std">${esc(p.domain)} / ${esc(p.standard)}</div></td>
    <td>${p.code ? `<b><bdi dir="ltr">${esc(p.code)}</bdi></b> ` : ''}${esc(p.indicator)}${p.pct != null ? `<div class="std">الحالي ${fmt(p.pct)} ← المستهدف ${p.target}%</div>` : ''}<div style="margin-top:4px"><b>الهدف:</b> ${esc(p.goal)}</div></td>
    <td><ol>${p.procedures.map((x) => `<li>${esc(x.text)}${x.when ? ` <span class="std">(${esc(x.when)})</span>` : ''}</li>`).join('')}</ol></td>
    <td>${esc(p.responsible)}</td>
    <td class="c">${esc(p.from)}<br>إلى<br>${esc(p.to)}</td>
    <td>${esc(p.kpi)}${p.budget ? `<div class="std">الميزانية: ${esc(p.budget)}</div>` : ''}</td>
    <td class="c">${p.progress ? `<b>${p.progress.pct}%</b><div class="bar"><i style="width:${p.progress.pct}%"></i></div>` : '<span class="std">-</span>'}${p.opinions.n ? `<div class="std">رأي المعلمين: ${p.opinions.avg ?? '-'} / 5 (${p.opinions.n})</div>` : ''}</td>
  </tr>`).join('');
  const goals = ops.goals.map((g, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(g.domain)}</b></td><td class="c">${fmt(g.pct)} <span class="tp" style="background:${lvColor(g.pct)}">${esc(g.level)}</span></td><td>${esc(g.text)}</td><td class="c">${g.programs.length}</td></tr>`).join('');
  const types = Object.entries(ops.byType).filter(([, n]) => n).map(([t, n]) => `${tag(t)} ${n}`).join(' &nbsp; ');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE} - ${esc(school.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>
${trial ? '<div class="wm">نسخة تجريبية</div>' : ''}<div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div><div class="page">
${head(school, logo, TITLE)}
<h2 class="sec">أولاً: البيانات الأساسية</h2>${basicsHtml(school, report)}
${ops.vision || ops.mission || ops.values ? `<h2 class="sec">ثانياً: التوجهات</h2><div class="vm"><div><b>الرؤية</b>${esc(ops.vision) || '-'}</div><div><b>الرسالة</b>${esc(ops.mission) || '-'}</div><div><b>القيم</b>${esc(ops.values) || '-'}</div></div>` : ''}
<h2 class="sec">تحليل الواقع (SWOT)</h2>${swotHtml(ops.swot)}
<h2 class="sec">الأهداف العامة (من مجالات التقويم المدرسي)</h2>
<table><thead><tr><th style="width:4%">م</th><th style="width:18%">المجال</th><th style="width:14%">الأداء الحالي</th><th>الهدف العام</th><th style="width:9%">البرامج</th></tr></thead><tbody>${goals}</tbody></table>
<h2 class="sec">البرامج والمبادرات</h2><p class="std" style="font-size:11px">${ops.programs.length} برنامج: ${types}. الأهداف التفصيلية مبنية على مؤشرات التقويم المدرسي ونتائج نافس.</p>
<table><thead><tr><th style="width:3%">م</th><th style="width:14%">البرنامج ونوعه</th><th style="width:20%">المؤشر والهدف التفصيلي</th><th style="width:24%">الإجراءات</th><th style="width:10%">المسؤول</th><th style="width:8%">الزمن</th><th style="width:13%">مؤشر القياس</th><th style="width:8%">الإنجاز</th></tr></thead><tbody>${progs}</tbody></table>
<div class="sign"><div>رئيس لجنة التميز</div><div>مدير/ة المدرسة<br>${esc(school.principal)}<br>التوقيع</div><div>ختم المدرسة</div></div>
</div></body></html>`;
}

async function opsDocx({ school, report, ops, uploadsDir }) {
  const L = docx.AlignmentType;
  const tbl = (rows) => new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows });
  const hdr = (hs, W) => new docx.TableRow({ tableHeader: true, children: hs.map((h, i) => cell(h, { bold: true, color: 'FFFFFF', fill: '0F766E', w: W[i], align: L.CENTER })) });
  const SWc = { s: 'E7F5EE', w: 'FBEAE8', o: 'E8F0FC', t: 'FCEFE3' };
  const swot = tbl([0, 2].map((k) => new docx.TableRow({ children: SW.slice(k, k + 2).map(([key, t, c]) => cell([para(run(t, { bold: true, color: c.slice(1), size: 22 })), ...lines(ops.swot[key] || [], false)], { w: 50, fill: SWc[key] })) })));
  const GW = [5, 20, 15, 50, 10];
  const goals = tbl([hdr(['م', 'المجال', 'الأداء الحالي', 'الهدف العام', 'البرامج'], GW), ...ops.goals.map((g, i) => new docx.TableRow({ children: [cell(String(i + 1), { w: GW[0], align: L.CENTER }), cell(g.domain, { w: GW[1], bold: true }), cell(`${fmt(g.pct)} ${g.level}`, { w: GW[2], align: L.CENTER }), cell(g.text, { w: GW[3] }), cell(String(g.programs.length), { w: GW[4], align: L.CENTER })] }))]);
  const PW = [3, 14, 20, 25, 10, 8, 12, 8];
  const progs = tbl([hdr(['م', 'البرنامج ونوعه', 'المؤشر والهدف التفصيلي', 'الإجراءات', 'المسؤول', 'الزمن', 'مؤشر القياس', 'الإنجاز'], PW), ...ops.programs.map((p, i) => new docx.TableRow({ cantSplit: true, children: [
    cell(String(i + 1), { w: PW[0], align: L.CENTER }),
    cell([para(run(p.name, { bold: true, size: 20 })), para(run(TYPES[p.type].name, { bold: true, size: 18, color: TYPES[p.type].color.slice(1) })), para(run(`${p.domain} / ${p.standard}`, { size: 16, color: '666666' }))], { w: PW[1] }),
    cell([para(run(`${p.code ? `‪${p.code}‬ ` : ''}${p.indicator}`, { size: 18 })), ...(p.pct != null ? [para(run(`الحالي ${fmt(p.pct)} ← المستهدف ${p.target}%`, { size: 16, color: '666666' }))] : []), para([run('الهدف: ', { bold: true, size: 18 }), run(p.goal, { size: 18 })])], { w: PW[2] }),
    cell(lines(p.procedures.map((x) => (x.when ? `${x.text} (${x.when})` : x.text)), true), { w: PW[3] }),
    cell(p.responsible, { w: PW[4], size: 18 }),
    cell(`${p.from} - ${p.to}`, { w: PW[5], size: 18, align: L.CENTER }),
    cell([para(run(p.kpi, { size: 18 })), ...(p.budget ? [para(run(`الميزانية: ${p.budget}`, { size: 16, color: '666666' }))] : [])], { w: PW[6] }),
    cell(p.progress ? `${p.progress.pct}%` : '-', { w: PW[7], align: L.CENTER, bold: true }),
  ] }))]);
  const vm = ops.vision || ops.mission || ops.values ? [heading('التوجهات'), ...[['الرؤية', ops.vision], ['الرسالة', ops.mission], ['القيم', ops.values]].filter(([, v]) => v).map(([k, v]) => para([run(`${k}: `, { bold: true }), run(v)]))] : [];
  const doc = new docx.Document({
    creator: 'معياري للمدرسة', title: `${TITLE} - ${school.name}`,
    styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
    sections: [{ properties: { page: { size: { orientation: docx.PageOrientation.LANDSCAPE }, margin: { top: 600, bottom: 600, left: 600, right: 600 } } }, children: [
      ...letterheadDocx(school, uploadsDir),
      para(run(TITLE, { size: 36, bold: true, color: '0F766E' }), { align: L.CENTER }),
      para(run(`العام الدراسي ${school.year || ''}`, { size: 22 }), { align: L.CENTER, after: 120 }),
      heading('أولاً: البيانات الأساسية'), basicsDocx(school, report),
      ...vm,
      heading('تحليل الواقع (SWOT)'), swot,
      heading('الأهداف العامة (من مجالات التقويم المدرسي)'), goals,
      heading('البرامج والمبادرات'), progs,
      para(run(''), { after: 300 }),
      signDocx(['رئيس لجنة التميز', `مدير/ة المدرسة\n${school.principal || ''}\nالتوقيع`, 'ختم المدرسة']),
    ] }],
  });
  return docx.Packer.toBuffer(doc);
}

// ---------- العرض التقديمي للمدرسة ----------
// شرائح 16:9، تتصفح بالأسهم أو السحب، وتنطبع كل شريحة في صفحة (PDF).
function deckHtml({ school, report, ops, nafisA, evidence, trial, uploadsDir }) {
  const logo = logoData(school, uploadsDir);
  const inds = report.indicators.filter((i) => i.pct != null);
  const lvCount = LEVELS.map((l) => ({ ...l, n: inds.filter((i) => levelOf(i.pct).key === l.key).length }));
  const bars = (list) => `<div class="bars">${list.map((x) => `<div class="br"><span class="bl">${esc(x.name)}</span><div class="bt"><i style="width:${x.pct}%;background:${lvColor(x.pct)}"></i></div><b>${fmt(x.pct)}</b></div>`).join('')}</div>`;
  const top = [...inds].sort((a, b) => b.pct - a.pct).slice(0, 5);
  const low = [...inds].sort((a, b) => a.pct - b.pct).slice(0, 5);
  const indList = (xs) => `<ol class="il">${xs.map((i) => `<li><span>${esc(i.text)}</span><b style="color:${lvColor(i.pct)}">${fmt(i.pct)}</b></li>`).join('')}</ol>`;
  const slides = [];
  const S = (title, body, cls = '') => slides.push(`<section class="sl ${cls}"><header><h2>${title}</h2><span>${esc(school.name)}</span></header><div class="bd">${body}</div><footer>${slides.length + 1}</footer></section>`);
  slides.push(`<section class="sl cover">${logo ? imgTag(logo, 'clogo') : ''}<h1>${esc(school.name || 'المدرسة')}</h1><p class="sub">واقع المدرسة وأولوياتها وخطتها للعام الدراسي ${esc(school.year)}</p><p class="meta">${esc(school.office || '')}${school.principal ? ` · قائد المدرسة: ${esc(school.principal)}` : ''}</p><footer>1</footer></section>`);
  const lv = report.overall != null ? levelOf(report.overall) : null;
  S('الأداء العام في التقويم المدرسي', `<div class="two"><div class="big" style="--c:${lv ? lv.color : '#888'}"><b>${fmt(report.overall)}</b><span>${lv ? `مستوى ${lv.name}` : ''}</span>${report.cycle ? `<small>${esc(report.cycle)}</small>` : ''}</div>
    <div><p class="lead">توزيع ${inds.length} مؤشر حسب المستوى</p>${lvCount.map((l) => `<div class="br"><span class="bl">${l.name}</span><div class="bt"><i style="width:${inds.length ? (l.n / inds.length) * 100 : 0}%;background:${l.color}"></i></div><b>${l.n}</b></div>`).join('')}</div></div>`);
  S('الأداء حسب المجالات', bars(ops.domains));
  S('الأداء حسب المعايير', bars(ops.standards), 'dense');
  S('أبرز نقاط القوة', indList(top));
  S('الأولويات: المؤشرات الأضعف', indList(low));
  S('تحليل الواقع (SWOT)', swotHtml(ops.swot), 'dense');
  if (nafisA && nafisA.subjects.length) {
    S('نتائج نافس', `<table class="nt"><thead><tr><th>الصف</th><th>المادة</th><th>المدرسة</th><th>الإدارة</th><th>المملكة</th><th>الفرق عن المملكة</th><th>التغير عن العام الماضي</th></tr></thead><tbody>${nafisA.subjects.map((s) => `<tr><td>${esc(s.grade_name)}</td><td><b>${esc(s.name)}</b></td><td><b>${fmt(s.mastery)}</b></td><td>${fmt(s.office)}</td><td>${fmt(s.ksa)}</td><td style="color:${s.gap >= 0 ? '#0b8f55' : '#d33a2c'}"><b>${s.gap > 0 ? '+' : ''}${s.gap ?? '-'}</b></td><td>${s.change == null ? '-' : `${s.change > 0 ? '▲ +' : '▼ '}${s.change}`}</td></tr>`).join('')}</tbody></table>`, 'dense');
  }
  S('الأهداف العامة', `<ol class="il">${ops.goals.map((g) => `<li><span>${esc(g.text)}</span><b>${g.programs.length} برنامج</b></li>`).join('')}</ol>`);
  const tps = Object.entries(ops.byType).filter(([, n]) => n);
  S('برامج الخطة التشغيلية', `<div class="chips">${tps.map(([t, n]) => `<div style="--c:${TYPES[t].color}"><b>${n}</b>${TYPES[t].name}</div>`).join('')}</div><ol class="il sm">${ops.programs.slice(0, 9).map((p) => `<li><span>${esc(p.name)}</span><b style="color:${TYPES[p.type].color}">${TYPES[p.type].name}</b></li>`).join('')}</ol>${ops.programs.length > 9 ? `<p class="lead">و${ops.programs.length - 9} برامج أخرى في الخطة المطبوعة.</p>` : ''}`, 'dense');
  if (ops.progress.total) S('متابعة التنفيذ', `<div class="two"><div class="big" style="--c:#0f766e"><b>${ops.progress.pct}%</b><span>${ops.progress.done} من ${ops.progress.total} إجراء منجز</span></div><div>${bars(ops.programs.filter((p) => p.progress).sort((a, b) => b.progress.pct - a.progress.pct).slice(0, 7).map((p) => ({ name: p.name.replace('برنامج تحسين: ', ''), pct: p.progress.pct })))}</div></div>`);
  if (evidence) S('جاهزية ملف شواهد التقويم', `<div class="two"><div class="big" style="--c:#0f766e"><b>${evidence.pct}%</b><span>${evidence.covered} من ${evidence.total} مؤشر عليه شاهد</span><small>${evidence.evidence} شاهد في الملف</small></div><div>${bars(evidence.domains.map((d) => ({ name: d.name, pct: d.pct })))}</div></div>`);
  S('دور كل منا', `<ul class="roles"><li><b>القيادة المدرسية</b>متابعة البرامج شهرياً وتذليل العقبات</li><li><b>المعلمون</b>تنفيذ الإجراءات المسندة وتوثيقها بالشواهد من «مهامي» في معياري</li><li><b>اللجان</b>قياس مؤشرات البرامج ورفع تقارير المتابعة</li><li><b>الأسرة والمجتمع</b>الشراكة في برامج الحضور والتحصيل والسلوك</li></ul>`);
  slides.push(`<section class="sl cover end"><h1>شركاء في التميز</h1><p class="sub">${esc(school.name)}</p><footer>${slides.length + 1}</footer></section>`);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عرض المدرسة - ${esc(school.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"><style>
@page { size: 297mm 167mm; margin: 0; } * { box-sizing: border-box; }
html, body { margin: 0; background: #1b2b29; font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #10201e; }
.deck { height: 100vh; overflow-y: auto; scroll-snap-type: y mandatory; }
.sl { position: relative; width: min(100vw, 177.78vh); aspect-ratio: 16/9; margin: 0 auto 10px; background: #fff; scroll-snap-align: center; display: flex; flex-direction: column; padding: 3.2% 4.5%; overflow: hidden; font-size: clamp(10px, 1.5vw, 22px); }
.sl header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: .2em solid #0f766e; padding-bottom: .4em; margin-bottom: 1em; } .sl header h2 { margin: 0; font-size: 1.9em; color: #0f766e; } .sl header span { color: #6b7f7c; font-size: .8em; }
.sl footer { position: absolute; bottom: 2.2%; left: 3%; color: #9ab; font-size: .75em; }
.bd { flex: 1; min-height: 0; }
.cover { background: linear-gradient(135deg, #0f766e, #134e4a); color: #fff; justify-content: center; align-items: center; text-align: center; } .cover h1 { font-size: 3em; margin: .2em 0; } .cover .sub { font-size: 1.3em; opacity: .92; margin: 0; } .cover .meta { opacity: .75; } .cover footer { color: #9fd; }
.clogo { width: 6em; height: 6em; object-fit: contain; background: #fff; border-radius: 1em; padding: .4em; }
.two { display: grid; grid-template-columns: 1fr 1.6fr; gap: 2em; align-items: center; height: 100%; }
.big { border: .25em solid var(--c); border-radius: 1em; padding: 1em; text-align: center; display: flex; flex-direction: column; gap: .2em; } .big b { font-size: 3.4em; color: var(--c); line-height: 1.1; } .big span { font-size: 1.1em; font-weight: 600; } .big small { color: #6b7f7c; }
.lead { color: #4a5f5c; margin: 0 0 .6em; }
.bars { display: flex; flex-direction: column; gap: .55em; } .br { display: grid; grid-template-columns: 11em 1fr 4em; gap: .7em; align-items: center; } .bl { font-size: .9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .bt { height: 1em; background: #e6eceb; border-radius: 99px; overflow: hidden; } .bt i { display: block; height: 100%; border-radius: 99px; } .br b { font-size: .9em; text-align: left; }
.dense { font-size: clamp(9px, 1.25vw, 19px); }
.il { margin: 0; padding: 0; list-style: none; counter-reset: n; display: flex; flex-direction: column; gap: .6em; } .il li { counter-increment: n; display: grid; grid-template-columns: 2em 1fr auto; gap: .7em; align-items: center; background: #f3f7f6; border-radius: .5em; padding: .55em .8em; } .il li::before { content: counter(n); background: #0f766e; color: #fff; border-radius: 50%; width: 1.7em; height: 1.7em; display: grid; place-items: center; font-size: .85em; } .il.sm li { padding: .35em .7em; font-size: .9em; }
.swot { display: grid; grid-template-columns: 1fr 1fr; gap: .8em; height: 100%; } .swot > div { border: .15em solid; border-radius: .7em; padding: .5em .9em; overflow: hidden; } .swot h3 { margin: 0 0 .3em; } .swot ul { margin: 0; padding-inline-start: 1.2em; font-size: .85em; } .std { color: #889; }
.chips { display: flex; gap: .8em; margin-bottom: 1em; } .chips div { flex: 1; border-radius: .7em; background: var(--c); color: #fff; padding: .5em; text-align: center; font-weight: 600; } .chips b { display: block; font-size: 1.8em; }
.nt { width: 100%; border-collapse: collapse; } .nt th { background: #0f766e; color: #fff; padding: .45em; } .nt td { border-bottom: 1px solid #dde5e4; padding: .45em; text-align: center; }
.roles { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1em; } .roles li { background: #f3f7f6; border-radius: .7em; padding: 1em; } .roles b { display: block; color: #0f766e; font-size: 1.2em; margin-bottom: .2em; }
.tools { position: fixed; top: 10px; left: 10px; z-index: 5; display: flex; gap: 6px; } .tools button { font: inherit; font-size: 14px; padding: 7px 14px; border-radius: 8px; border: 0; background: #fff; color: #0f766e; cursor: pointer; font-weight: 600; }
.wm { position: absolute; inset: 0; display: grid; place-items: center; font-size: 5em; color: rgba(15,118,110,.08); transform: rotate(-18deg); pointer-events: none; font-weight: 700; }
@media print { html, body { background: #fff; } .deck { height: auto; overflow: visible; } .sl { width: 297mm; height: 167mm; aspect-ratio: auto; margin: 0; font-size: 15px; break-after: page; } .dense { font-size: 13px; } .tools { display: none; } }
</style></head><body><div class="tools"><button onclick="print()">طباعة / حفظ PDF</button><button onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">ملء الشاشة</button></div>
<div class="deck" id="d">${trial ? slides.map((s) => s.replace('</section>', '<div class="wm">نسخة تجريبية</div></section>')).join('') : slides.join('')}</div>
<script>const d=document.getElementById('d');addEventListener('keydown',e=>{const k=e.key;if(['ArrowDown','ArrowLeft','PageDown',' '].includes(k)){e.preventDefault();d.scrollBy({top:d.querySelector('.sl').offsetHeight+10,behavior:'smooth'})}if(['ArrowUp','ArrowRight','PageUp'].includes(k)){e.preventDefault();d.scrollBy({top:-(d.querySelector('.sl').offsetHeight+10),behavior:'smooth'})}});</script>
</body></html>`;
}

module.exports = { opsHtml, opsDocx, deckHtml, OPS_TITLE: TITLE };
