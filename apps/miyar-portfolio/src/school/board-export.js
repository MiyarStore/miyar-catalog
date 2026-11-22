// صفحات لوحة المدرسة: رصد الحضور من الجوال، شاشة التلفاز، والتقارير الست بهوية الوزارة.
const { esc, LH_CSS, letterheadHtml, logoData, useMoe, dateAr } = require('./export');

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">';
const BASE = `* { box-sizing: border-box; } body { font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #10201e; margin: 0; line-height: 1.6; }`;
const COLORS = { good: '#0b8f55', watch: '#d9690a', alert: '#d33a2c', none: '#8a9896' };
const dayAr = (s) => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${s}T12:00:00Z`));
const dShort = (s) => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(`${s}T12:00:00Z`));
const f = (v) => (v == null ? '-' : v);

const REPORTS = {
  daily: 'التقرير اليومي للمدرسة',
  weekly: 'تقرير الحضور الأسبوعي',
  monthly: 'تقرير الحضور الشهري',
  top: 'الفصول الأعلى غياباً وتأخراً',
  missing: 'الفصول غير المرصودة',
  subs: 'سجل حصص الانتظار وتوزيعها',
};

// رصد الحضور من جوال المعلم
function recordHtml({ school, token }) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>رصد الحضور - ${esc(school.name || 'المدرسة')}</title>${FONTS}<style>${BASE}
body { background: #f3f6f5; font-size: 15px; } .wrap { max-width: 640px; margin: 0 auto; padding: 14px 16px 60px; } h1 { font-size: 20px; margin: 6px 0 2px; color: #0f766e; } .muted { color: #5b6b69; font-size: 13px; }
.card { background: #fff; border-radius: 14px; padding: 12px 14px; margin: 10px 0; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.row { display: flex; gap: 8px; align-items: center; } input, select { font: inherit; padding: 8px 10px; border: 1px solid #cfd9d7; border-radius: 10px; min-width: 0; background: #fff; }
.cls { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; } .cls h2 { font-size: 17px; margin: 0; } .ok { color: #0b6b40; font-size: 13px; }
.num { display: flex; align-items: center; gap: 4px; } .num button { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #cfd9d7; background: #fff; font-size: 20px; cursor: pointer; } .num input { width: 54px; text-align: center; }
.btn { font: inherit; border: 0; border-radius: 10px; padding: 9px 16px; background: #0f766e; color: #fff; cursor: pointer; } .btn.g { background: #fff; color: #0f766e; border: 1px solid #0f766e; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; } label.l { font-size: 13px; color: #445; display: block; margin-bottom: 2px; }
#toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #10201e; color: #fff; padding: 8px 16px; border-radius: 10px; opacity: 0; transition: .2s; } #toast.show { opacity: 1; }
</style></head><body><div class="wrap">
<h1>رصد الحضور · ${esc(school.name || 'المدرسة')}</h1><p class="muted" style="margin:0 0 8px" id="dl"></p>
<div class="card row"><label for="nm">اسمك:</label><input id="nm" style="flex:1" placeholder="مثال: أ. فهد القحطاني"></div>
<div id="list"><p class="muted">نحمّل الفصول...</p></div></div><div id="toast"></div>
<script>
const T = ${JSON.stringify(token)}; let D = null;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); };
const nm = $('#nm'); try { nm.value = localStorage.getItem('team_name') || ''; } catch {} nm.onchange = () => { try { localStorage.setItem('team_name', nm.value.trim()); } catch {} };
function render() {
  $('#dl').textContent = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(D.day + 'T12:00:00Z')) + ' · المرصود ' + D.classes.filter((c) => c.rec).length + ' من ' + D.classes.length;
  $('#list').innerHTML = D.classes.length ? D.classes.map((c, i) => '<div class="card"><div class="cls"><div><h2>' + esc(c.name) + '</h2><span class="muted">' + (c.students || '-') + ' طالب</span> ' + (c.rec ? '<span class="ok">✓ مرصود' + (c.by ? ' (' + esc(c.by) + ')' : '') + '</span>' : '') + '</div><button class="btn g" onclick="allIn(' + i + ')">الكل حاضر</button></div>' +
    '<div class="grid2"><div><span class="l">الغياب</span><div class="num"><button onclick="step(' + i + ',\\'a\\',-1)">−</button><input id="a' + i + '" inputmode="numeric" value="' + esc(c.absent) + '"><button onclick="step(' + i + ',\\'a\\',1)">+</button></div></div><div><span class="l">التأخر</span><div class="num"><button onclick="step(' + i + ',\\'l\\',-1)">−</button><input id="l' + i + '" inputmode="numeric" value="' + esc(c.late) + '"><button onclick="step(' + i + ',\\'l\\',1)">+</button></div></div></div>' +
    '<input id="n' + i + '" placeholder="أسماء الغائبين (اختياري)" value="' + esc(c.names) + '" style="width:100%;margin-top:8px"><button class="btn" style="margin-top:8px;width:100%" onclick="save(' + i + ')">حفظ</button></div>').join('') : '<div class="card muted">ما أضاف قائد المدرسة الفصول للحين.</div>';
}
window.step = (i, k, d) => { const el = $('#' + k + i); el.value = Math.max(0, (parseInt(el.value, 10) || 0) + d); };
window.allIn = (i) => { $('#a' + i).value = 0; $('#l' + i).value = 0; $('#n' + i).value = ''; save(i); };
window.save = async (i) => {
  const c = D.classes[i]; const by = nm.value.trim();
  if (by.length < 2) { nm.focus(); toast('اكتب اسمك أول'); return; }
  const r = await fetch('/api/r/' + T, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: D.day, class_id: c.id, absent: $('#a' + i).value, late: $('#l' + i).value, names: $('#n' + i).value, by }) });
  const j = await r.json(); if (!r.ok) { toast(j.error || 'تعذر الحفظ'); return; } toast('تم رصد ' + c.name + ' ✓'); load();
};
async function load() { const r = await fetch('/api/r/' + T); D = await r.json(); if (!r.ok) { $('#list').innerHTML = '<div class="card">' + esc(D.error) + '</div>'; return; } render(); }
load();
</script></body></html>`;
}

// شاشة التلفاز: تتحدث كل دقيقة
function tvHtml({ school, token }) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>لوحة ${esc(school.name || 'المدرسة')}</title>${FONTS}<style>${BASE}
body { background: #0c1f1d; color: #fff; min-height: 100vh; padding: 2.2vw; } h1 { margin: 0; font-size: 2.6vw; } .top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.6vw; } .clock { font-size: 2.4vw; font-weight: 700; } .sub { color: #9fbdb8; font-size: 1.3vw; }
.g { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2vw; } .t { background: #14302d; border-radius: 1.2vw; padding: 1.2vw 1.4vw; border-top: .5vw solid; } .t .n { font-size: 1.3vw; color: #cfe3e0; } .t b { display: block; font-size: 3.6vw; line-height: 1.3; } .t small { font-size: 1.1vw; color: #9fbdb8; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2vw; margin-top: 1.2vw; } .box { background: #14302d; border-radius: 1.2vw; padding: 1.2vw 1.4vw; font-size: 1.4vw; } .box h2 { margin: 0 0 .6vw; font-size: 1.6vw; color: #8fe0cf; } .chip { display: inline-block; background: #2a4643; border-radius: 99px; padding: .2vw 1vw; margin: .2vw; }
</style></head><body><div class="top"><div><h1>${esc(school.name || 'المدرسة')}</h1><div class="sub" id="d"></div></div><div class="clock" id="c"></div></div>
<div class="g" id="g"></div><div class="row2"><div class="box"><h2>فصول ما رُصدت</h2><div id="m"></div></div><div class="box"><h2>حصص الانتظار اليوم</h2><div id="s"></div></div></div>
<script>
const T = ${JSON.stringify(token)}; const C = ${JSON.stringify(COLORS)};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tick = () => { document.getElementById('c').textContent = new Intl.DateTimeFormat('ar-SA', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date()); }; tick(); setInterval(tick, 10000);
async function load() {
  try { const r = await fetch('/api/tv/' + T); const d = await r.json(); if (!r.ok) return;
    document.getElementById('d').textContent = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d.ind.day + 'T12:00:00Z'));
    document.getElementById('g').innerHTML = d.ind.list.map((x) => '<div class="t" style="border-color:' + C[x.state] + '"><div class="n">' + esc(x.name) + '</div><b>' + (x.value == null ? '-' : x.value) + '<span style="font-size:1.6vw">' + esc(x.value == null ? '' : x.unit) + '</span></b><small>' + esc(x.note) + '</small></div>').join('');
    document.getElementById('m').innerHTML = d.ind.missing.length ? d.ind.missing.map((n) => '<span class="chip">' + esc(n) + '</span>').join('') : '✓ كل الفصول مرصودة';
    document.getElementById('s').innerHTML = d.ind.subs.length ? d.ind.subs.map((x) => '<div>الحصة ' + x.period + ': ' + esc(x.sub_name || 'بدون بديل') + ' <span style="color:#9fbdb8">بدل ' + esc(x.absent_name) + (x.class_name ? ' · ' + esc(x.class_name) : '') + '</span></div>').join('') : 'ما فيه حصص انتظار';
  } catch {}
}
load(); setInterval(load, 60000);
</script></body></html>`;
}

// رسم أعمدة بسيط
function colsSvg(items, max = 100, suffix = '%') {
  const W = 700, H = 170, n = Math.max(items.length, 1), step = (W - 20) / n, bw = Math.min(46, step - 6);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="direction:ltr" role="img">${items.map((x, i) => {
    const xx = W - 10 - (i + 1) * step + (step - bw) / 2; const v = x.v == null ? 0 : x.v; const h = (v / max) * (H - 50);
    return `<rect x="${xx}" y="${H - 30 - h}" width="${bw}" height="${Math.max(h, 1)}" rx="3" fill="${x.c || '#0f766e'}"/><text x="${xx + bw / 2}" y="${H - 34 - h}" text-anchor="middle" font-size="10" font-weight="700">${x.v == null ? '-' : `${x.v}${suffix}`}</text><text x="${xx + bw / 2}" y="${H - 12}" text-anchor="middle" font-size="9.5" fill="#556">${esc(x.l)}</text>`;
  }).join('')}</svg>`;
}
const rc = (r) => (r == null ? '#c9d3d1' : r >= 95 ? '#0b8f55' : r >= 90 ? '#d9690a' : '#d33a2c');

function boardReportHtml({ school, kind, data, ind, uploadsDir }) {
  const logo = logoData(school, uploadsDir);
  const title = REPORTS[kind];
  const d = data;
  const range = d.days.length > 1 ? `من ${dayAr(d.days[0])} إلى ${dayAr(d.days[d.days.length - 1])}` : dayAr(d.days[0]);
  let body = '';
  if (kind === 'daily') {
    body = `<div class="tiles">${ind.list.map((x) => `<div class="tile" style="border-color:${COLORS[x.state]}"><span>${esc(x.name)}</span><b>${f(x.value)}${x.value == null ? '' : esc(x.unit)}</b><small>${esc(x.note)}</small></div>`).join('')}</div>
<h2 class="sec">حضور الفصول</h2><table><thead><tr><th>الفصل</th><th>الطلاب</th><th>الغياب</th><th>التأخر</th><th>نسبة الحضور</th><th>أسماء الغائبين</th><th>رصده</th></tr></thead><tbody>${ind.classes.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td class="c">${c.students || '-'}</td><td class="c">${c.rec ? c.absent : '<span class="red">لم يُرصد</span>'}</td><td class="c">${c.rec ? c.late : '-'}</td><td class="c">${c.rec && c.students ? `${Math.round((1 - c.absent / c.students) * 1000) / 10}%` : '-'}</td><td>${esc(c.names)}</td><td>${esc(c.by)}</td></tr>`).join('')}</tbody></table>
<h2 class="sec">غياب المنسوبين وحصص الانتظار</h2>${ind.staffAbs.length ? `<table><thead><tr><th>الاسم</th><th>الحالة</th><th>الحصص</th></tr></thead><tbody>${ind.staffAbs.map((x) => `<tr><td>${esc(x.name)}</td><td class="c">${esc(x.kind)}</td><td class="c">${x.list.join('، ') || '-'}</td></tr>`).join('')}</tbody></table>
<table style="margin-top:6px"><thead><tr><th>الحصة</th><th>الغائب</th><th>الفصل</th><th>البديل</th></tr></thead><tbody>${ind.subs.map((x) => `<tr><td class="c">${x.period}</td><td>${esc(x.absent_name)}</td><td>${esc(x.class_name)}</td><td>${x.sub_name ? esc(x.sub_name) : '<span class="red">بدون بديل</span>'}</td></tr>`).join('')}</tbody></table>` : '<p>ما فيه غياب منسوبين.</p>'}`;
  } else if (kind === 'weekly' || kind === 'monthly') {
    body = `<div class="tiles"><div class="tile"><span>نسبة الحضور للفترة</span><b>${f(d.total.rate)}%</b><small>${d.total.absent} غياب من ${d.total.students} طالب/يوم</small></div><div class="tile"><span>نسبة التأخر</span><b>${f(d.total.lateRate)}%</b><small>${d.total.late} حالة تأخر</small></div><div class="tile"><span>أيام الرصد</span><b>${d.daily.filter((x) => x.recorded).length}</b><small>من ${d.days.length} يوم دراسي</small></div><div class="tile"><span>حصص الانتظار</span><b>${d.subsCovered}</b><small>مغطاة من ${d.subsTotal}</small></div></div>
<h2 class="sec">نسبة الحضور يوماً بيوم</h2>${colsSvg(d.daily.map((x) => ({ v: x.rate, l: dShort(x.day), c: rc(x.rate) })))}
<h2 class="sec">نسبة حضور الفصول</h2>${colsSvg(d.perClass.map((c) => ({ v: c.rate, l: c.name, c: rc(c.rate) })))}
<table><thead><tr><th>الفصل</th><th>الطلاب</th><th>أيام الرصد</th><th>مجموع الغياب</th><th>مجموع التأخر</th><th>نسبة الحضور</th></tr></thead><tbody>${d.perClass.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td class="c">${c.students || '-'}</td><td class="c">${c.days} من ${d.days.length}</td><td class="c">${c.absent}</td><td class="c">${c.late}</td><td class="c"><b style="color:${rc(c.rate)}">${f(c.rate)}${c.rate == null ? '' : '%'}</b></td></tr>`).join('')}</tbody></table>`;
  } else if (kind === 'top') {
    const ab = d.perClass.filter((c) => c.rate != null).sort((a, b) => a.rate - b.rate).slice(0, 10);
    const lt = d.perClass.filter((c) => c.days).sort((a, b) => b.late - a.late).slice(0, 10);
    body = `<h2 class="sec">الأعلى غياباً (الأقل حضوراً)</h2><table><thead><tr><th>م</th><th>الفصل</th><th>مجموع الغياب</th><th>نسبة الحضور</th></tr></thead><tbody>${ab.map((c, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(c.name)}</b></td><td class="c">${c.absent}</td><td class="c"><b style="color:${rc(c.rate)}">${c.rate}%</b></td></tr>`).join('')}</tbody></table>
<h2 class="sec">الأعلى تأخراً</h2><table><thead><tr><th>م</th><th>الفصل</th><th>مجموع التأخر</th><th>أيام الرصد</th></tr></thead><tbody>${lt.map((c, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(c.name)}</b></td><td class="c">${c.late}</td><td class="c">${c.days}</td></tr>`).join('')}</tbody></table>
<p class="std">مقترح: متابعة الفصول الثلاثة الأولى مع الموجه الطلابي والتواصل مع أسر الطلاب المتكرر غيابهم.</p>`;
  } else if (kind === 'missing') {
    const ms = d.perClass.filter((c) => c.missing.length).sort((a, b) => b.missing.length - a.missing.length);
    body = `<p>${ms.length ? `${ms.length} فصل فيه أيام ما رُصدت خلال آخر ${d.days.length} أيام دراسية.` : '✓ كل الفصول مرصودة في كل الأيام.'}</p>${ms.length ? `<table><thead><tr><th>الفصل</th><th>عدد الأيام</th><th>الأيام غير المرصودة</th></tr></thead><tbody>${ms.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td class="c red">${c.missing.length}</td><td>${c.missing.map(dShort).join('، ')}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (kind === 'subs') {
    const ps = [...d.perStaff].sort((a, b) => b.subs - a.subs);
    body = `<div class="tiles"><div class="tile"><span>حصص الانتظار</span><b>${d.subsTotal}</b><small>خلال الفترة</small></div><div class="tile"><span>المغطاة ببديل</span><b>${d.subsCovered}</b><small>${d.subsTotal ? Math.round((d.subsCovered / d.subsTotal) * 100) : 0}%</small></div></div>
<h2 class="sec">توزيع الانتظار على المنسوبين</h2>${colsSvg(ps.slice(0, 16).map((p) => ({ v: p.subs, l: p.name.split(' ').slice(0, 2).join(' '), c: '#1a6fe0' })), Math.max(1, ...ps.map((p) => p.subs)), '')}
<table><thead><tr><th>الاسم</th><th>الدور</th><th>حصص انتظار أخذها</th><th>أيام غيابه</th></tr></thead><tbody>${ps.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.role)}</td><td class="c">${p.subs}</td><td class="c">${p.absent}</td></tr>`).join('')}</tbody></table>`;
  }
  const CSS = `${BASE} @page { size: A4; margin: 10mm; } body { background: #eef2f1; } .page { background: #fff; max-width: 210mm; margin: 12px auto; padding: 12mm; font-size: 12px; } ${LH_CSS}
.head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0f766e; padding-bottom: 8px; margin-bottom: 10px; } .head h1 { margin: 0; font-size: 20px; color: #0f766e; } .head.t { justify-content: center; text-align: center; border-bottom: 0; }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; } .tile { border: 1px solid #dde5e4; border-top: 4px solid #0f766e; border-radius: 10px; padding: 8px; text-align: center; } .tile span { font-size: 11px; color: #445; display: block; } .tile b { font-size: 20px; display: block; } .tile small { font-size: 10px; color: #667; }
.sec { font-size: 14px; color: #0f766e; margin: 14px 0 6px; } table { width: 100%; border-collapse: collapse; font-size: 11px; } th { background: #0f766e; color: #fff; padding: 5px; font-weight: 600; } td { border: 1px solid #cfd9d7; padding: 4px 6px; } td.c { text-align: center; } .red { color: #d33a2c; font-weight: 700; } .std { color: #667; font-size: 11px; }
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 22px; text-align: center; } .sign div { border-top: 1px dashed #999; padding-top: 6px; }
.tools { text-align: center; padding: 10px; } .tools a, .tools button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 8px; border: 1px solid #0f766e; background: #fff; color: #0f766e; cursor: pointer; text-decoration: none; margin: 2px; display: inline-block; } .tools .on, .tools button { background: #0f766e; color: #fff; }
@media print { body { background: #fff; } .page { margin: 0; padding: 0; } .tools { display: none; } }`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} - ${esc(school.name)}</title>${FONTS}<style>${CSS}</style></head><body>
<div class="tools">${Object.entries(REPORTS).map(([k, t]) => `<a class="${k === kind ? 'on' : ''}" href="?r=${k}">${t}</a>`).join('')}<button onclick="print()">طباعة / PDF</button></div><div class="page">
${letterheadHtml(school, logo)}<div class="head${useMoe(school) ? ' t' : ''}"><div><h1>${title}</h1><div>${range}${useMoe(school) ? '' : ` · ${esc(school.name)}`}</div></div></div>
${body}
<div class="sign"><div>وكيل/ة شؤون الطلاب</div><div>مدير/ة المدرسة<br>${esc(school.principal || '')}</div></div>
<p class="std" style="text-align:center">صدر بتاريخ ${esc(dateAr())}</p></div></body></html>`;
}

module.exports = { recordHtml, tvHtml, boardReportHtml, REPORTS };
