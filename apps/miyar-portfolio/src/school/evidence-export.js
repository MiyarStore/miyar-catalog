// «ملف شواهد التقويم»: صفحة المقيّم العامة، وفهرس الشواهد للطباعة، وملف Word.
const docx = require('docx');
const QRCode = require('qrcode');
const { esc, LH_CSS, letterheadHtml, letterheadDocx, logoData, run, para, cell, heading, signDocx, FONT, dateAr } = require('./export');

const TITLE = 'ملف شواهد التقويم المدرسي';
const STAGE = { basic: 'متوسطة / ابتدائية', secondary: 'الثانوية' };
const qr = (text) => QRCode.toDataURL(text, { margin: 1, width: 220, color: { dark: '#10201e', light: '#ffffff' } });
const evLabel = (x) => x.title + (x.teacher ? ` (من ملف ${x.teacher.name || 'معلم'})` : '');

// روابط الشاهد: الملف، أو الرابط، أو رمز التحقق لشاهد المعلم
function evLinks(x, fileHref, base) {
  const out = [];
  if (x.file) out.push(`<a href="${esc(fileHref(x))}" target="_blank" rel="noopener">📄 ${esc(x.file.name || 'الملف')}</a>`);
  if (x.url) out.push(`<a href="${esc(x.url)}" target="_blank" rel="noopener nofollow">🔗 الرابط</a>`);
  const v = x.teacher ? x.teacher.verify : x.verify;
  if (v) out.push(`<a href="${esc(base)}/v/${esc(v)}" target="_blank" rel="noopener">✔ رمز التحقق <bdi dir="ltr">${esc(v)}</bdi></a>`);
  return out.join(' ');
}
const autoAsItem = (a) => ({ title: a.title, kind_name: 'شاهد تنفيذ من خطة التحسين', note: `${a.teacher ? `المنفذ: ${a.teacher}. ` : ''}الإجراء: ${a.proc}`, verify: a.verify });

// ---------- صفحة المقيّم (للقراءة فقط) ----------
function publicHtml({ school, file, token, base, uploadsDir }) {
  const logo = logoData(school, uploadsDir);
  const fileHref = (x) => `/e/${token}/f/${x.id}`;
  const doms = file.domains.map((d) => {
    const stds = file.standards.filter((s) => s.code.startsWith(`${d.code}-`));
    return `<section id="d${d.code}"><h2>${esc(d.name)} <small>${d.covered} من ${d.total} مؤشر · ${d.evidence} شاهد</small></h2>
    ${stds.map((s) => `<h3>معيار ${esc(s.name)}</h3>${file.indicators.filter((i) => i.standard === s.code).map((i) => {
      const list = [...i.items, ...i.auto.map(autoAsItem)];
      return `<details class="ind ${i.covered ? '' : 'miss'}"${i.covered ? '' : ' open'}><summary><bdi dir="ltr" class="code">${esc(i.code)}</bdi><span>${esc(i.text)}</span><b class="n">${i.count}</b></summary>
      ${list.length ? `<ul>${list.map((x) => `<li><b>${esc(evLabel(x))}</b> <span class="k">${esc(x.kind_name)}</span>${x.note ? `<div class="note">${esc(x.note)}</div>` : ''}<div class="lnk">${evLinks(x, fileHref, base)}</div></li>`).join('')}</ul>` : '<p class="note">لا يوجد شاهد مرفوع لهذا المؤشر.</p>'}</details>`;
    }).join('')}`).join('')}</section>`;
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${TITLE} - ${esc(school.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root { --bg:#f3f6f5; --card:#fff; --text:#10201e; --muted:#5b6b69; --line:#dfe7e5; --brand:#0f766e; --miss:#b42318; }
@media (prefers-color-scheme: dark) { :root { --bg:#0f1716; --card:#172321; --text:#e6efed; --muted:#9db0ad; --line:#2a3a37; --brand:#3cc0b2; --miss:#f08a7e; } }
* { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; line-height: 1.6; }
.wrap { max-width: 920px; margin: 0 auto; padding: 16px; }
header.top { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; display: flex; gap: 14px; align-items: center; }
header.top img { width: 64px; height: 64px; object-fit: contain; } h1 { margin: 0; font-size: 20px; } .muted { color: var(--muted); font-size: 13px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 12px 0; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; font-size: 13px; color: var(--muted); } .stat b { display: block; font-size: 22px; color: var(--text); }
nav.doms { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; } nav.doms a { background: var(--card); border: 1px solid var(--line); border-radius: 99px; padding: 4px 12px; text-decoration: none; color: var(--text); font-size: 13px; }
section { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px; margin-bottom: 12px; }
h2 { font-size: 18px; margin: 0 0 6px; color: var(--brand); } h2 small { font-size: 12px; color: var(--muted); font-weight: 400; } h3 { font-size: 14px; margin: 14px 0 6px; }
details.ind { border: 1px solid var(--line); border-radius: 10px; margin-bottom: 6px; padding: 0 10px; } details.ind.miss { border-color: var(--miss); }
summary { display: flex; gap: 8px; align-items: baseline; padding: 8px 0; cursor: pointer; font-size: 14px; } summary span { flex: 1; } .code { color: var(--muted); font-size: 12px; white-space: nowrap; }
.n { background: var(--brand); color: #fff; border-radius: 99px; min-width: 24px; text-align: center; font-size: 12px; padding: 0 6px; } .miss .n { background: var(--miss); }
ul { margin: 0 0 10px; padding-inline-start: 18px; } li { margin-bottom: 8px; font-size: 14px; } .k { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 99px; padding: 0 6px; }
.note { font-size: 12.5px; color: var(--muted); } .lnk a { font-size: 13px; color: var(--brand); margin-inline-end: 10px; word-break: break-all; }
footer { text-align: center; font-size: 12px; color: var(--muted); padding: 12px; }
</style></head><body><div class="wrap">
<header class="top">${logo ? `<img src="data:image/${logo.type};base64,${logo.buf.toString('base64')}" alt="">` : ''}<div><h1>${esc(school.name || 'المدرسة')}</h1>
<div class="muted">${TITLE}${school.office ? ` · ${esc(school.office)}` : ''}${school.ministry_number ? ` · الرقم الوزاري <bdi dir="ltr">${esc(school.ministry_number)}</bdi>` : ''} · ${esc(school.year || '')}</div></div></header>
<div class="stats"><div class="stat">المؤشرات المغطاة<b>${file.covered} / ${file.total}</b></div><div class="stat">نسبة التغطية<b>${file.pct}%</b></div><div class="stat">عدد الشواهد<b>${file.evidence}</b></div></div>
<nav class="doms">${file.domains.map((d) => `<a href="#d${d.code}">${esc(d.name)} (${d.pct}%)</a>`).join('')}</nav>
${doms}
<footer>صفحة للاطلاع فقط، أعدتها المدرسة عبر «معياري للمدرسة». آخر تحديث ${esc(dateAr())}.</footer>
</div></body></html>`;
}

// ---------- فهرس الشواهد للطباعة ----------
async function evidenceHtml({ school, file, trial, link, uploadsDir }) {
  const logo = logoData(school, uploadsDir);
  const code = link ? await qr(link) : null;
  let n = 0;
  const doms = file.domains.map((d) => `<h2 class="sec">${esc(d.name)} <span class="std">(${d.covered} من ${d.total} مؤشر مغطى)</span></h2>
  <table><thead><tr><th style="width:4%">م</th><th style="width:9%">رمز المؤشر</th><th style="width:33%">المؤشر</th><th>الشواهد</th><th style="width:6%">العدد</th></tr></thead><tbody>
  ${file.indicators.filter((i) => i.domain === d.code).map((i) => {
    const list = [...i.items, ...i.auto.map(autoAsItem)];
    return `<tr class="${i.covered ? '' : 'miss'}"><td class="c">${++n}</td><td class="c"><bdi dir="ltr">${esc(i.code)}</bdi></td><td>${esc(i.text)}</td>
    <td>${list.length ? `<ol>${list.map((x) => `<li>${esc(evLabel(x))} <span class="std">(${esc(x.kind_name)})</span></li>`).join('')}</ol>` : '<span class="none">لا يوجد شاهد بعد</span>'}</td><td class="c"><b>${i.count}</b></td></tr>`;
  }).join('')}</tbody></table>`).join('');
  const basics = [['اسم المدرسة', school.name], ['المرحلة', STAGE[file.stage]], ['الرقم الوزاري', school.ministry_number || ''], ['مكتب / إدارة التعليم', school.office], ['العام الدراسي', school.year], ['قائد/ة المدرسة', school.principal]];
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE} - ${esc(school.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; } body { font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #10201e; margin: 0; background: #eef2f1; font-size: 11px; line-height: 1.55; }
.page { background: #fff; max-width: 210mm; margin: 12px auto; padding: 10mm; position: relative; }
${LH_CSS}
.head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0f766e; padding-bottom: 10px; margin-bottom: 12px; } .head h1 { margin: 0; font-size: 22px; color: #0f766e; }
.top { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; margin-bottom: 10px; }
.qr { text-align: center; border: 1px solid #cfd9d7; border-radius: 8px; padding: 6px; width: 150px; } .qr img { width: 130px; height: 130px; } .qr div { font-size: 10px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 8px; } th { background: #0f766e; color: #fff; font-weight: 600; padding: 6px 4px; }
td { border: 1px solid #cfd9d7; padding: 5px; vertical-align: top; } td.c { text-align: center; }
.basic th { background: #eef6f5; color: #0f4f4a; width: 17%; text-align: right; }
tr.miss td { background: #fdf2f1; } .none { color: #b42318; font-weight: 600; } .std { color: #667; font-size: 10px; font-weight: 400; }
ol { margin: 0; padding-inline-start: 16px; } thead { display: table-header-group; } tr { page-break-inside: avoid; }
.sec { font-size: 14px; color: #0f766e; margin: 14px 0 6px; break-after: avoid; }
.sum td, .sum th { text-align: center; } .bar { height: 8px; background: #edf1f0; border-radius: 99px; } .bar i { display: block; height: 100%; background: #0f766e; border-radius: 99px; }
.sign { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; margin-top: 28px; font-weight: 600; gap: 10px; }
.wm { position: fixed; inset: 0; display: grid; place-items: center; pointer-events: none; font-size: 80px; color: rgba(180, 35, 24, .09); transform: rotate(-20deg); font-weight: 700; }
.bar-print { text-align: center; margin: 10px; } .bar-print button { font: inherit; padding: 8px 18px; border-radius: 8px; border: 0; background: #0f766e; color: #fff; cursor: pointer; }
@media print { body { background: #fff; } .page { margin: 0; padding: 0; max-width: none; } .bar-print { display: none; } }
</style></head><body>
<div class="bar-print"><button onclick="print()">🖨️ طباعة / حفظ PDF</button></div>
${trial ? '<div class="wm">نسخة تجريبية</div>' : ''}
<div class="page">
${letterheadHtml(school, logo)}
<div class="head t"><h1>${TITLE}</h1></div>
<div class="top"><div>
<table class="basic"><tbody>${[0, 2, 4].map((k) => `<tr>${basics.slice(k, k + 2).map(([a, b]) => `<th>${esc(a)}</th><td>${esc(b) || '&nbsp;'}</td>`).join('')}</tr>`).join('')}</tbody></table>
<table class="sum"><thead><tr><th>المعيار</th><th>المؤشرات</th><th>المغطاة</th><th>الشواهد</th><th style="width:28%">التغطية</th></tr></thead><tbody>
${file.standards.map((s) => `<tr><td style="text-align:right">${esc(s.name)}</td><td>${s.total}</td><td>${s.covered}</td><td>${s.evidence}</td><td><div class="bar"><i style="width:${s.pct}%"></i></div>${s.pct}%</td></tr>`).join('')}
<tr><th style="text-align:right">الإجمالي</th><th>${file.total}</th><th>${file.covered}</th><th>${file.evidence}</th><th>${file.pct}%</th></tr></tbody></table>
</div>${code ? `<div class="qr"><img src="${code}" alt="رمز الملف"><div><b>امسح الرمز</b><br>يفتح ملف الشواهد كاملاً بملفاته وروابطه</div></div>` : ''}</div>
${doms}
<div class="sign"><div>رئيس/ة لجنة التميز</div><div>قائد/ة المدرسة<br>${esc(school.principal)}<br>التوقيع</div><div>ختم المدرسة</div></div>
</div></body></html>`;
}

// ---------- Word ----------
const C = docx.AlignmentType.CENTER;
const table = (rows) => new docx.Table({ visuallyRightToLeft: true, width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows });
const headRow = (heads, W) => new docx.TableRow({ tableHeader: true, children: heads.map((h, i) => cell(h, { bold: true, color: 'FFFFFF', fill: '0F766E', w: W[i], align: C })) });

async function evidenceDocx({ school, file, link, uploadsDir }) {
  const kids = [
    ...letterheadDocx(school, uploadsDir),
    para(run(TITLE, { size: 36, bold: true, color: '0F766E' }), { align: C, after: 120 }),
    table([['اسم المدرسة', school.name, 'الرقم الوزاري', school.ministry_number || ''], ['مكتب / إدارة التعليم', school.office, 'العام الدراسي', school.year], ['المرحلة', STAGE[file.stage], 'قائد/ة المدرسة', school.principal]]
      .map((r) => new docx.TableRow({ children: r.map((v, i) => cell(v || ' ', { bold: i % 2 === 0, fill: i % 2 === 0 ? 'EEF6F5' : undefined, w: i % 2 === 0 ? 18 : 32 })) }))),
  ];
  if (link) {
    const png = Buffer.from((await qr(link)).split(',')[1], 'base64');
    kids.push(new docx.Paragraph({ alignment: C, spacing: { before: 120 }, children: [new docx.ImageRun({ type: 'png', data: png, transformation: { width: 120, height: 120 } })] }));
    kids.push(para(run('امسح الرمز لفتح ملف الشواهد كاملاً بملفاته وروابطه', { size: 18, color: '555555' }), { align: C, after: 120 }));
  }
  kids.push(heading('ملخص التغطية'));
  const W0 = [40, 15, 15, 15, 15];
  kids.push(table([headRow(['المعيار', 'المؤشرات', 'المغطاة', 'الشواهد', 'التغطية'], W0),
    ...file.standards.map((s) => new docx.TableRow({ children: [cell(s.name, { w: W0[0] }), cell(String(s.total), { w: W0[1], align: C }), cell(String(s.covered), { w: W0[2], align: C }), cell(String(s.evidence), { w: W0[3], align: C }), cell(`${s.pct}%`, { w: W0[4], align: C, bold: true })] })),
    new docx.TableRow({ children: [cell('الإجمالي', { bold: true, fill: 'EEF6F5' }), cell(String(file.total), { align: C, bold: true, fill: 'EEF6F5' }), cell(String(file.covered), { align: C, bold: true, fill: 'EEF6F5' }), cell(String(file.evidence), { align: C, bold: true, fill: 'EEF6F5' }), cell(`${file.pct}%`, { align: C, bold: true, fill: 'EEF6F5' })] })]));
  let n = 0;
  const W = [5, 11, 34, 42, 8];
  for (const d of file.domains) {
    kids.push(heading(`${d.name} (${d.covered} من ${d.total} مؤشر مغطى)`));
    kids.push(table([headRow(['م', 'رمز المؤشر', 'المؤشر', 'الشواهد', 'العدد'], W),
      ...file.indicators.filter((i) => i.domain === d.code).map((i) => {
        const list = [...i.items, ...i.auto.map(autoAsItem)];
        return new docx.TableRow({ cantSplit: true, children: [
          cell(String(++n), { w: W[0], align: C }), cell(`⁦${i.code}⁩`, { w: W[1], align: C }), cell(i.text, { w: W[2], size: 18 }),
          cell(list.length ? list.map((x, k) => para(run(`${k + 1}. ${evLabel(x)} (${x.kind_name})`, { size: 18 }), { after: 10 })) : [para(run('لا يوجد شاهد بعد', { size: 18, bold: true, color: 'B42318' }))], { w: W[3], fill: list.length ? undefined : 'FDF2F1' }),
          cell(String(i.count), { w: W[4], align: C, bold: true }),
        ] });
      })]));
  }
  kids.push(para(run(''), { after: 300 }));
  kids.push(signDocx(['رئيس/ة لجنة التميز', `قائد/ة المدرسة\n${school.principal || ''}\nالتوقيع`, 'ختم المدرسة']));
  const doc = new docx.Document({
    creator: 'معياري للمدرسة', title: `${TITLE} - ${school.name}`,
    styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
    sections: [{ properties: { page: { margin: { top: 600, bottom: 600, left: 600, right: 600 } } }, children: kids }],
  });
  return docx.Packer.toBuffer(doc);
}

module.exports = { publicHtml, evidenceHtml, evidenceDocx, EVIDENCE_TITLE: TITLE };
