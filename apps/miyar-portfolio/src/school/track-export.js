// صفحات متابعة التنفيذ: تقرير الإنجاز الأسبوعي/الشهري (للطباعة)، صفحة الفريق برابط بدون دخول، وبطاقة QR للفريق.
const QRCode = require('qrcode');
const { esc, LH_CSS, letterheadHtml, logoData, useMoe, dateAr } = require('./export');
const { TYPES } = require('./operational');

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">';
const BASE = `* { box-sizing: border-box; } body { font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #10201e; margin: 0; background: #eef2f1; line-height: 1.6; }`;
const dayAr = (s) => (s ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long' }).format(new Date(`${s}T12:00:00Z`)) : '-');
const dayFull = (s) => (s ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${s}T12:00:00Z`)) : '-');
const wk = (s) => new Intl.DateTimeFormat('ar-SA', { weekday: 'short' }).format(new Date(`${s}T12:00:00Z`));

// رسم أعمدة أفقية SVG لنسب إنجاز البرامج
function barsSvg(programs) {
  const rows = programs.slice(0, 18);
  const H = 26, W = 700, L = 300;
  const body = rows.map((p, i) => {
    const y = i * H + 4;
    const w = Math.max(2, ((W - L - 60) * p.pct) / 100);
    const color = p.late ? '#d33a2c' : p.pct === 100 ? '#0b8f55' : '#0f766e';
    const name = p.name.length > 42 ? `${p.name.slice(0, 42)}…` : p.name;
    return `<text x="${W - 4}" y="${y + 15}" text-anchor="end" font-size="11">${esc(name)}</text>
<rect x="60" y="${y + 4}" width="${W - L - 60}" height="14" rx="7" fill="#e6ecea"/><rect x="${60 + (W - L - 60) - w}" y="${y + 4}" width="${w}" height="14" rx="7" fill="${color}"/>
<text x="54" y="${y + 15}" text-anchor="end" font-size="11" font-weight="700">${p.pct}%</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${rows.length * H + 8}" width="100%" role="img" aria-label="نسبة إنجاز البرامج" style="direction:ltr">${body}</svg>`;
}
// أعمدة رأسية للإنجاز اليومي
function dailySvg(daily) {
  const W = 700, H = 150, n = daily.length, max = Math.max(1, ...daily.map((d) => d.n));
  const bw = Math.min(60, (W - 20) / n - 6);
  const step = (W - 20) / n;
  const body = daily.map((d, i) => {
    const x = W - 10 - (i + 1) * step + (step - bw) / 2;
    const h = (d.n / max) * (H - 50);
    const lbl = n <= 10 ? wk(d.day) : (i % 5 === 0 ? dayAr(d.day) : '');
    return `<rect x="${x}" y="${H - 30 - h}" width="${bw}" height="${Math.max(h, 1)}" rx="3" fill="${d.n ? '#0f766e' : '#dfe6e4'}"/>${d.n ? `<text x="${x + bw / 2}" y="${H - 34 - h}" text-anchor="middle" font-size="11" font-weight="700">${d.n}</text>` : ''}<text x="${x + bw / 2}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#556">${esc(lbl)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="الإجراءات المنجزة يومياً" style="direction:ltr">${body}</svg>`;
}
// حلقة نسبة الإنجاز
const ring = (pct, color = '#0f766e') => { const r = 34, c = 2 * Math.PI * r; return `<svg viewBox="0 0 90 90" width="90" height="90"><circle cx="45" cy="45" r="${r}" fill="none" stroke="#e6ecea" stroke-width="10"/><circle cx="45" cy="45" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 45 45)"/><text x="45" y="51" text-anchor="middle" font-size="18" font-weight="700" fill="#10201e">${pct}%</text></svg>`; };

function progressHtml({ school, rep, uploadsDir }) {
  const logo = logoData(school, uploadsDir);
  const title = rep.period === 'month' ? 'تقرير الإنجاز الشهري للخطة' : 'تقرير الإنجاز الأسبوعي للخطة';
  const CSS = `${BASE} @page { size: A4; margin: 10mm; }
.page { background: #fff; max-width: 210mm; margin: 12px auto; padding: 12mm; font-size: 12px; }
${LH_CSS}
.head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0f766e; padding-bottom: 8px; margin-bottom: 10px; } .head h1 { margin: 0; font-size: 20px; color: #0f766e; } .head.t { justify-content: center; text-align: center; border-bottom: 0; }
.kpis { display: grid; grid-template-columns: auto repeat(4, 1fr); gap: 8px; align-items: center; margin: 8px 0 4px; }
.kpi { border: 1px solid #dde5e4; border-radius: 10px; padding: 8px; text-align: center; } .kpi b { display: block; font-size: 22px; color: #0f766e; } .kpi.red b { color: #d33a2c; } .kpi span { font-size: 11px; color: #556; }
.sec { font-size: 14px; color: #0f766e; margin: 14px 0 6px; break-after: avoid; }
table { width: 100%; border-collapse: collapse; font-size: 11px; } th { background: #0f766e; color: #fff; padding: 5px; font-weight: 600; } td { border: 1px solid #cfd9d7; padding: 4px 6px; vertical-align: top; } td.c { text-align: center; }
.late { color: #d33a2c; font-weight: 700; } .std { color: #667; font-size: 10px; } .tp { color: #fff; border-radius: 99px; padding: 0 7px; font-size: 10px; }
.sign { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 22px; text-align: center; } .sign div { border-top: 1px dashed #999; padding-top: 6px; }
.tools { text-align: center; padding: 10px; } .tools a, .tools button { font: inherit; padding: 7px 16px; border-radius: 8px; border: 0; background: #0f766e; color: #fff; cursor: pointer; text-decoration: none; margin: 0 3px; } .tools a.o { background: #fff; color: #0f766e; border: 1px solid #0f766e; }
thead { display: table-header-group; } tr { page-break-inside: avoid; }
@media print { body { background: #fff; } .page { margin: 0; padding: 0; } .tools { display: none; } }`;
  const late = rep.late.length ? `<table><thead><tr><th style="width:4%">م</th><th>الإجراء</th><th style="width:24%">البرنامج</th><th style="width:13%">الموعد</th><th style="width:11%">التأخير</th></tr></thead><tbody>${rep.late.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.text)}${x.assignee_name ? `<div class="std">المنفذ: ${esc(x.assignee_name)}</div>` : ''}</td><td>${esc(x.program)}</td><td class="c">${dayAr(x.due)}</td><td class="c late">${x.late} يوم</td></tr>`).join('')}</tbody></table>` : '<p>ما فيه إجراءات متأخرة. 👏</p>';
  const recent = rep.recent.length ? `<table><thead><tr><th style="width:4%">م</th><th>الإجراء</th><th style="width:24%">البرنامج</th><th style="width:16%">نفّذه</th><th style="width:13%">التاريخ</th></tr></thead><tbody>${rep.recent.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.text)}${x.note ? `<div class="std">ملاحظة: ${esc(x.note)}</div>` : ''}</td><td>${esc(x.program)}</td><td>${esc(x.done_name || '-')}</td><td class="c">${dayAr(new Date(x.done_at + 3 * 3600000).toISOString().slice(0, 10))}</td></tr>`).join('')}</tbody></table>` : '<p class="std">ما تم تأشير إجراءات خلال الفترة.</p>';
  const soon = rep.soon.length ? `<table><thead><tr><th style="width:4%">م</th><th>الإجراء</th><th style="width:24%">البرنامج</th><th style="width:13%">الموعد</th></tr></thead><tbody>${rep.soon.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.text)}</td><td>${esc(x.program)}</td><td class="c">${dayAr(x.due)}</td></tr>`).join('')}</tbody></table>` : '';
  const progs = `<table><thead><tr><th style="width:4%">م</th><th>البرنامج</th><th style="width:10%">النوع</th><th style="width:12%">المنجز</th><th style="width:10%">المتأخر</th><th style="width:10%">النسبة</th></tr></thead><tbody>${rep.programs.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${esc(p.name)}</td><td class="c"><span class="tp" style="background:${TYPES[p.type].color}">${TYPES[p.type].name}</span></td><td class="c">${p.done} من ${p.total}</td><td class="c ${p.late ? 'late' : ''}">${p.late || '-'}</td><td class="c"><b>${p.pct}%</b></td></tr>`).join('')}</tbody></table>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} - ${esc(school.name)}</title>${FONTS}<style>${CSS}</style></head><body>
<div class="tools"><a class="${rep.period === 'week' ? '' : 'o'}" href="?p=week">أسبوعي</a><a class="${rep.period === 'month' ? '' : 'o'}" href="?p=month">شهري</a><button onclick="print()">طباعة / حفظ PDF</button></div><div class="page">
${letterheadHtml(school, logo)}<div class="head${useMoe(school) ? ' t' : ''}"><div><h1>${title}</h1><div>الفترة من ${dayFull(rep.from)} إلى ${dayFull(rep.to)}${useMoe(school) ? '' : ` · ${esc(school.name)}`}</div></div></div>
<div class="kpis"><div>${ring(rep.pct, rep.lateCount ? '#d9690a' : '#0f766e')}<div class="std" style="text-align:center">الإنجاز الكلي</div></div>
<div class="kpi"><b>${rep.done}</b><span>منجز من ${rep.total}</span></div><div class="kpi"><b>${rep.inPeriod}</b><span>أُنجز خلال ${rep.period === 'month' ? 'الشهر' : 'الأسبوع'}</span></div><div class="kpi red"><b>${rep.lateCount}</b><span>إجراء متأخر</span></div><div class="kpi"><b>${rep.soon.length}</b><span>مستحق خلال 7 أيام</span></div></div>
${rep.nodate ? `<p class="std">${rep.nodate} إجراء بدون موعد. حدد مواعيدها من صفحة الخطة التشغيلية عشان تدخل في حساب التأخير.</p>` : ''}
<h2 class="sec">الإنجاز اليومي خلال الفترة</h2>${dailySvg(rep.daily)}
<h2 class="sec">نسبة إنجاز البرامج</h2>${barsSvg(rep.programs)}<p class="std">الأحمر: برنامج فيه إجراءات متأخرة، والأخضر: مكتمل.</p>
<h2 class="sec">الإجراءات المتأخرة</h2>${late}
${soon ? `<h2 class="sec">مستحق خلال الأيام السبعة القادمة</h2>${soon}` : ''}
<h2 class="sec">ما تم إنجازه خلال الفترة</h2>${recent}
${rep.people.length ? `<h2 class="sec">مساهمة الفريق خلال الفترة</h2><table><thead><tr><th>الاسم</th><th style="width:20%">الإجراءات المنجزة</th></tr></thead><tbody>${rep.people.map((p) => `<tr><td>${esc(p.name)}</td><td class="c">${p.n}</td></tr>`).join('')}</tbody></table>` : ''}
<h2 class="sec">ملخص البرامج</h2>${progs}
<div class="sign"><div>رئيس لجنة التميز</div><div>مدير/ة المدرسة<br>${esc(school.principal || '')}</div></div>
</div></body></html>`;
}

// صفحة الفريق: تأشير الإجراءات برابط بدون تسجيل دخول
function teamHtml({ school, token }) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>تنفيذ الخطة - ${esc(school.name || 'المدرسة')}</title>${FONTS}<style>${BASE}
:root { --b: #0f766e; } body { background: #f3f6f5; font-size: 15px; } .wrap { max-width: 720px; margin: 0 auto; padding: 14px 16px 60px; }
h1 { font-size: 20px; margin: 6px 0 2px; color: var(--b); } .muted { color: #5b6b69; font-size: 13px; }
.card { background: #fff; border-radius: 14px; padding: 12px 14px; margin: 10px 0; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.card h2 { font-size: 16px; margin: 0 0 6px; } .p { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-top: 1px solid #edf1f0; } .p:first-of-type { border-top: 0; }
.p input[type=checkbox] { width: 22px; height: 22px; margin-top: 2px; accent-color: var(--b); flex: none; } .p.done .t { color: #6b7a78; text-decoration: line-through; }
.tag { display: inline-block; font-size: 12px; border-radius: 99px; padding: 0 8px; margin-inline-start: 4px; } .late { background: #fdecea; color: #b4271b; } .soon { background: #fff4e5; color: #9a4a00; } .ok { background: #e7f5ee; color: #0b6b40; }
.who { background: #fff; border-radius: 14px; padding: 12px 14px; display: flex; gap: 8px; align-items: center; position: sticky; top: 0; z-index: 2; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.who input { flex: 1; font: inherit; padding: 8px 10px; border: 1px solid #cfd9d7; border-radius: 10px; min-width: 0; }
.f { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0 0; } .f button { font: inherit; font-size: 13px; border: 1px solid #cfd9d7; background: #fff; border-radius: 99px; padding: 3px 12px; cursor: pointer; } .f button.on { background: var(--b); color: #fff; border-color: var(--b); }
#toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #10201e; color: #fff; padding: 8px 16px; border-radius: 10px; opacity: 0; transition: .2s; } #toast.show { opacity: 1; }
</style></head><body><div class="wrap">
<h1>تنفيذ خطة ${esc(school.name || 'المدرسة')}</h1><p class="muted" style="margin:0 0 10px">أشّر على الإجراء بعد ما تنفذه، ويوصل لقائد المدرسة في تقرير المتابعة مباشرة.</p>
<div class="who"><label for="nm" style="white-space:nowrap">اسمك:</label><input id="nm" placeholder="مثال: أ. سارة العتيبي" autocomplete="name"></div>
<div class="f" id="f"><button data-f="all" class="on">الكل</button><button data-f="open">غير منجز</button><button data-f="late">المتأخر</button><button data-f="mine">اللي أنجزته</button></div>
<div id="list"><p class="muted">نحمّل الإجراءات...</p></div></div><div id="toast"></div>
<script>
const T = ${JSON.stringify(token)}; let D = null, F = 'all';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); };
const nm = $('#nm'); try { nm.value = localStorage.getItem('team_name') || ''; } catch {}
nm.onchange = () => { try { localStorage.setItem('team_name', nm.value.trim()); } catch {} };
const fd = (s) => s ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long' }).format(new Date(s + 'T12:00:00Z')) : '';
function tag(x) { if (x.done) return x.done_name ? '<span class="tag ok">نفّذه ' + esc(x.done_name) + '</span>' : '<span class="tag ok">منجز</span>'; if (x.state === 'late') return '<span class="tag late">متأخر ' + x.late + ' يوم</span>'; if (x.state === 'soon') return '<span class="tag soon">موعده ' + fd(x.due) + '</span>'; return x.due ? '<span class="muted"> · ' + fd(x.due) + '</span>' : ''; }
function show(x) { if (F === 'open') return !x.done; if (F === 'late') return x.state === 'late'; if (F === 'mine') return x.done && x.done_name && x.done_name === nm.value.trim(); return true; }
function render() {
  const ps = D.programs.map((p, pi) => { const xs = p.procedures.map((x, xi) => [x, xi]).filter(([x]) => show(x)); if (!xs.length) return ''; const d = p.procedures.filter((x) => x.done).length;
    return '<div class="card"><h2>' + esc(p.name) + '</h2><div class="muted">' + esc(p.responsible || '') + ' · منجز ' + d + ' من ' + p.procedures.length + '</div>' + xs.map(([x, xi]) => '<label class="p' + (x.done ? ' done' : '') + '"><input type="checkbox" ' + (x.done ? 'checked' : '') + ' onchange="tick(' + pi + ',' + xi + ',this)"><div><span class="t">' + esc(x.text) + '</span> ' + tag(x) + '</div></label>').join('') + '</div>'; }).join('');
  $('#list').innerHTML = ps || '<div class="card muted">ما فيه إجراءات هنا.</div>';
}
async function load() { const r = await fetch('/api/t/' + T); D = await r.json(); if (!r.ok) { $('#list').innerHTML = '<div class="card">' + esc(D.error || 'تعذر التحميل') + '</div>'; return; } render(); }
window.tick = async (pi, xi, el) => {
  const x = D.programs[pi].procedures[xi]; const name = nm.value.trim();
  if (el.checked && name.length < 2) { el.checked = false; nm.focus(); toast('اكتب اسمك أول'); return; }
  const r = await fetch('/api/t/' + T + '/track', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refs: x.refs, done: el.checked, name }) });
  const j = await r.json(); if (!r.ok) { el.checked = !el.checked; toast(j.error || 'تعذر الحفظ'); return; }
  toast(el.checked ? 'تم التأشير ✓' : 'تم إلغاء التأشير'); await load();
};
$('#f').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; F = b.dataset.f; document.querySelectorAll('#f button').forEach((x) => x.classList.toggle('on', x === b)); render(); };
load();
</script></body></html>`;
}

// بطاقة QR تُطبع وتُعلّق في غرفة المعلمين
async function teamCardHtml({ school, url, uploadsDir }) {
  const logo = logoData(school, uploadsDir);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 520, color: { dark: '#10201e', light: '#ffffff' } });
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>رابط فريق التنفيذ - ${esc(school.name)}</title>${FONTS}<style>${BASE} @page { size: A4; margin: 12mm; }
.page { background: #fff; max-width: 210mm; margin: 12px auto; padding: 14mm; text-align: center; } ${LH_CSS}
h1 { color: #0f766e; font-size: 30px; margin: 18px 0 6px; } .qr { width: 300px; height: 300px; margin: 18px auto; display: block; border: 8px solid #0f766e; border-radius: 18px; padding: 8px; }
.steps { text-align: right; max-width: 460px; margin: 10px auto; font-size: 16px; } .url { direction: ltr; font-size: 13px; color: #556; word-break: break-all; }
.tools { text-align: center; padding: 10px; } .tools button { font: inherit; padding: 8px 18px; border-radius: 8px; border: 0; background: #0f766e; color: #fff; cursor: pointer; }
@media print { body { background: #fff; } .page { margin: 0; } .tools { display: none; } }</style></head><body>
<div class="tools"><button onclick="print()">طباعة</button></div><div class="page">${letterheadHtml(school, logo)}
<h1>فريق تنفيذ الخطة</h1><p style="font-size:17px;margin:0">${esc(school.name || '')}</p>
<img class="qr" src="${qr}" alt="رمز QR لصفحة الفريق">
<ol class="steps"><li>امسح الرمز بكاميرا الجوال.</li><li>اكتب اسمك مرة وحدة.</li><li>أشّر على الإجراء بعد ما تنفذه، ويوصل لقائد المدرسة مباشرة.</li></ol>
<p class="url">${esc(url)}</p><p style="color:#667;font-size:12px">بتاريخ ${esc(dateAr())}</p></div></body></html>`;
}

module.exports = { progressHtml, teamHtml, teamCardHtml };
