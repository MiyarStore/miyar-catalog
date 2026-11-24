// صفحات الطباعة لسجل المادة: السجل كامل أو أي جزء منه، بترويسة الوزارة. الصفحة العامة للمقيّم تخفي أسماء الطلاب.
const { letterheadHtml, LH_CSS, esc } = require('../school/export');
const R = require('./record');

const pc = (v) => (v == null ? '-' : `${v}%`);
const sg = (v) => (v == null ? '-' : `<bdi dir="ltr">${v > 0 ? '+' : ''}${v}</bdi>`);
const dAr = (s) => { if (!s) return ''; try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${s}T12:00:00Z`)); } catch { return s; } };
const dShort = (s) => { if (!s) return ''; try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'short' }).format(new Date(`${s}T12:00:00Z`)); } catch { return s; } };
const colorOf = (v) => (v == null ? '#9aa8a6' : v >= 80 ? '#15803d' : v >= 50 ? '#b45309' : '#b91c1c');

// أعمدة أفقية بسيطة
function bars(list, { max = 100, unit = '%' } = {}) {
  if (!list.length) return '';
  const h = 26, w = 640, lw = 230;
  return `<svg viewBox="0 0 ${w} ${list.length * h + 6}" class="chart" role="img">${list.map((x, i) => {
    const bw = x.v == null ? 0 : Math.max(2, ((w - lw - 60) * x.v) / max);
    return `<text x="${w - 4}" y="${i * h + 18}" text-anchor="end" font-size="12.5">${esc(String(x.label).slice(0, 38))}</text>
    <rect x="${w - lw - 8 - bw}" y="${i * h + 5}" width="${bw}" height="16" rx="4" fill="${x.color || colorOf(x.v)}"/>
    <text x="${w - lw - 14 - bw}" y="${i * h + 18}" text-anchor="end" font-size="12" font-weight="700">${x.v == null ? '-' : x.v + unit}</text>`;
  }).join('')}</svg>`;
}
// أعمدة رأسية للمقارنة
function pairBars(list) {
  if (!list.length) return '';
  const w = 640, h = 200, n = list.length, bw = Math.min(28, (w - 40) / n / 2.6);
  const step = (w - 40) / n;
  return `<svg viewBox="0 0 ${w} ${h + 40}" class="chart">${[0, 50, 100].map((g) => `<line x1="20" x2="${w - 10}" y1="${h - (h * g) / 100 + 6}" y2="${h - (h * g) / 100 + 6}" stroke="#e2e8e7"/><text x="16" y="${h - (h * g) / 100 + 10}" font-size="10" text-anchor="end">${g}</text>`).join('')}
  ${list.map((x, i) => { const cx = 20 + step * i + step / 2; const a = (h * (x.pre || 0)) / 100, b = (h * (x.post || 0)) / 100;
    return `<rect x="${cx - bw - 1}" y="${h - a + 6}" width="${bw}" height="${a}" fill="#94a3b8" rx="3"/><rect x="${cx + 1}" y="${h - b + 6}" width="${bw}" height="${b}" fill="#0f766e" rx="3"/>
    <text x="${cx}" y="${h + 24}" font-size="10.5" text-anchor="middle">${esc(String(x.label).slice(0, 16))}</text>`; }).join('')}</svg>
  <div class="legend"><span><i style="background:#94a3b8"></i>القبلي</span><span><i style="background:#0f766e"></i>البعدي</span></div>`;
}

const CSS = `@page { size: A4; margin: 12mm; }
body { background: #e9eeed; color: #10201e; font-size: 13px; margin: 0; font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif; }
.toolbar { position: sticky; top: 0; z-index: 5; background: #fff; border-bottom: 1px solid #dfe6e5; padding: 10px 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.page { background: #fff; width: 210mm; max-width: 100%; box-sizing: border-box; margin: 14px auto; padding: 12mm 13mm; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
h1 { font-size: 22px; margin: 4px 0; color: #0f766e; text-align: center; } h2.sec { color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 5px; font-size: 17px; margin: 18px 0 10px; }
h3 { font-size: 14.5px; margin: 12px 0 6px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; } th, td { border: 1px solid #b9c7c5; padding: 5px 6px; text-align: right; vertical-align: top; }
th { background: #0f766e; color: #fff; font-weight: 600; } tr:nth-child(even) td { background: #f6faf9; }
.info td { border: 0; border-bottom: 1px solid #e2e8e7; background: none !important; } .info th { background: none; color: #5b6b69; border: 0; border-bottom: 1px solid #e2e8e7; width: 26%; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0; } .kpi { border: 1px solid #cfe1de; border-radius: 10px; padding: 8px; text-align: center; } .kpi b { display: block; font-size: 20px; color: #0f766e; }
.chart { width: 100%; height: auto; margin: 4px 0 8px; font-family: inherit; } .legend { display: flex; gap: 14px; justify-content: center; font-size: 12px; } .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-inline-end: 4px; vertical-align: -2px; }
.tag { display: inline-block; padding: 1px 8px; border-radius: 99px; color: #fff; font-size: 11.5px; }
.cover { text-align: center; min-height: 250mm; display: flex; flex-direction: column; justify-content: center; } .cover h1 { font-size: 34px; } .cover .sub { font-size: 18px; margin: 6px 0 24px; }
.muted { color: #5b6b69; } .center { text-align: center; } .wk { break-inside: avoid; margin-bottom: 10px; } .off td { color: #9aa8a6; }
.q { break-inside: avoid; margin: 0 0 10px; } .q ol { margin: 4px 0; padding-inline-start: 22px; list-style: arabic-indic; } .q ol { list-style-type: arabic-indic; }
.sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 26px; text-align: center; } .sign div { border-top: 1px dashed #9aa8a6; padding-top: 6px; }
.btn { display: inline-flex; gap: 6px; align-items: center; background: #0f766e; color: #fff; border: 0; padding: 7px 14px; border-radius: 9px; font: inherit; cursor: pointer; text-decoration: none; font-size: 13px; } .btn.ghost { background: #eef5f4; color: #0f766e; }
.brk { page-break-before: always; }
${LH_CSS}
@media print { body { background: #fff; } .toolbar { display: none; } .page { margin: 0; box-shadow: none; width: auto; padding: 0; page-break-after: always; } }`;

function shell(title, body) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`;
}

function build({ u, d, kind = 'all', test, week, anon = false, back = '/app#/rec' }) {
  const f = R.full(d);
  const names = anon ? Object.fromEntries(d.students.map((s, i) => [s.id, `طالب ${i + 1}`])) : Object.fromEntries(d.students.map((s) => [s.id, s.name]));
  const nm = (id, fallback) => names[id] || fallback;
  const school = { office: u.office, name: u.school, year: d.year || u.year, ministry_number: '' };
  const lh = letterheadHtml(school, null);
  const cls = `${d.subject}${d.grade ? ` - ${d.grade}` : ''}${d.section ? ` (${d.section})` : ''}`;
  const head = (title, sub = '') => `${lh}<h1>${esc(title)}</h1><div class="center muted">${esc(cls)}${d.term ? ` · ${esc(d.term)}` : ''}${sub ? ` · ${sub}` : ''}</div>`;
  const sign = `<div class="sign"><div>${u.gender === 'f' ? 'المعلمة' : 'المعلم'}: ${esc(u.full_name)}</div><div>${u.gender === 'f' ? 'المشرفة' : 'المشرف'} / الوكيل</div><div>مدير المدرسة${u.principal ? `: ${esc(u.principal)}` : ''}</div></div>`;
  const page = (inner) => `<div class="page">${inner}</div>`;
  const parts = [];
  const tests = f.tests;
  const pickTest = (id) => tests.find((t) => t.id === id) || tests[tests.length - 1];

  const cover = () => page(`<div class="cover">${lh}<div style="margin-top:30mm"><h1>سجل إعداد الدروس ومتابعة الطلاب</h1><div class="sub">${esc(cls)}</div>
    <table class="info" style="max-width:120mm;margin:0 auto">${[['المعلم', u.full_name], ['المدرسة', u.school], ['المرحلة', d.stage], ['الفصل الدراسي', d.term], ['العام الدراسي', d.year], ['عدد الطلاب', d.students.length], ['الحصص الأسبوعية', f.plan.per]].filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    <h2 class="sec" style="margin-top:20mm">المحتويات</h2><ol style="text-align:right;max-width:120mm;margin:0 auto;line-height:2">${['بيانات الطلاب', 'جدول الحصص', 'الخطة الفصلية (توزيع المنهج)', 'الخطط الأسبوعية', 'الاختبارات وتحليل النتائج', 'الخطط العلاجية والإثرائية', 'خطط الدعم الفردي', 'مقارنة القبلي بالبعدي', 'سجل متابعة مهارات الطالب', 'تقرير سير المادة'].map((x) => `<li>${x}</li>`).join('')}</ol></div></div>`);

  const students = () => page(`${head('بيانات الطلاب')}<table><thead><tr><th>م</th><th>اسم الطالب</th><th>ملاحظات</th></tr></thead><tbody>${d.students.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(nm(s.id, s.name))}</td><td>${anon ? '' : esc(s.note)}</td></tr>`).join('')}</tbody></table>
    <h2 class="sec">جدول الحصص</h2><table><thead><tr><th>اليوم</th><th>الحصص</th></tr></thead><tbody>${R.DAYS.map((dn, i) => { const ps = d.slots.filter((s) => s.day === i).map((s) => s.period); return ps.length ? `<tr><td>${dn}</td><td>${ps.map((p) => `الحصة ${p}`).join('، ')}</td></tr>` : ''; }).join('')}</tbody></table>`);

  const termPlan = () => page(`${head('الخطة الفصلية (توزيع المنهج)', `${f.plan.total} أسبوعاً${f.plan.calendar ? ` · ${esc(f.plan.calendar.regionName)}` : ''}`)}<table><thead><tr><th>الأسبوع</th><th>من - إلى</th><th>الدروس والإجراءات</th><th>الحصص</th></tr></thead><tbody>${f.plan.weeks.map((w) => `<tr class="${w.off ? 'off' : ''}"><td>${w.n}</td><td>${w.from ? `${dShort(w.from)} - ${dShort(w.to)}` : '-'}</td><td>${w.off ? esc((w.holidays || []).join('، ') || 'إجازة / اختبارات') : ((w.holidays || []).length ? `<i>${esc(w.holidays.join('، '))}</i><br>` : '') + w.items.map((x) => `${x.type === 'lesson' ? '' : '★ '}${esc(x.title)}${x.cont ? ' (تكملة)' : ''}`).join('<br>') || '-'}</td><td>${w.off ? '' : w.items.reduce((a, x) => a + x.periods, 0)}</td></tr>`).join('')}</tbody></table>
    ${f.plan.overflow.length ? `<p class="muted">دروس ما دخلت في الخطة لعدم كفاية الحصص: ${f.plan.overflow.map((l) => esc(l.title)).join('، ')}</p>` : ''}${sign}`);

  const weekPage = (w) => `<div class="wk">${head(`الخطة الأسبوعية: الأسبوع ${w.n}`, w.from ? `${dAr(w.from)} - ${dAr(w.to)}` : '')}<table><thead><tr><th>اليوم</th><th>التاريخ</th><th>الحصة</th><th>الوحدة</th><th>الدرس / الإجراء</th><th>الواجب / التقويم</th><th>ملاحظات</th></tr></thead><tbody>${w.off ? `<tr class="off"><td colspan="7" class="center">${esc((w.holidays || []).join('، ') || 'إجازة / أسبوع اختبارات')}</td></tr>` : w.slots.map((s) => s.holiday ? `<tr class="off"><td>${R.DAYS[s.day]}</td><td>${dShort(s.date)}</td><td>${s.period}</td><td colspan="4" class="center">${esc(s.holiday)}</td></tr>` : `<tr><td>${R.DAYS[s.day]}</td><td>${dShort(s.date)}</td><td>${s.period}</td><td>${esc(s.item ? s.item.unit : '')}</td><td>${s.item ? esc(s.item.title) : '-'}</td><td></td><td></td></tr>`).join('')}</tbody></table>${sign}</div>`;
  const weeks = (only) => (only ? [f.plan.weeks.find((w) => w.n === only) || f.plan.weeks[0]] : f.plan.weeks.filter((w) => !w.off && w.items.length)).map((w) => page(weekPage(w))).join('');

  const paper = (t) => { const T = d.tests.find((x) => x.id === t.id); return page(`${head(T.title, T.date ? dAr(T.date) : '')}<table class="info"><tr><th>اسم الطالب</th><td></td><th>الدرجة</th><td>&nbsp;&nbsp;&nbsp; / ${t.max}</td></tr></table>
    ${T.items.map((it, i) => `<div class="q"><b>س${i + 1}) ${esc(it.text || '....................................................')}</b> <span class="muted">(${it.max} ${it.max === 1 ? 'درجة' : 'درجات'})</span>${it.choices.length ? `<ol>${it.choices.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>` : ''}</div>`).join('')}
    <div class="brk"></div><h2 class="sec">مفتاح الإجابة وربط الأسئلة بالمهارات</h2><table><thead><tr><th>السؤال</th><th>المهارة</th><th>الإجابة</th><th>الدرجة</th></tr></thead><tbody>${T.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc((d.skills.find((s) => s.id === it.skill) || {}).name || '-')}</td><td>${esc(it.answer || '-')}</td><td>${it.max}</td></tr>`).join('')}</tbody></table>`); };

  const analysis = (a) => page(`${head(`تحليل نتائج ${a.title}`, a.date ? dAr(a.date) : '')}
    <div class="kpis"><div class="kpi"><b>${pc(a.avg)}</b>متوسط الإتقان</div><div class="kpi"><b>${a.n} / ${a.total}</b>المختبرون</div><div class="kpi"><b>${a.passed}</b>حققوا 50% فأكثر</div><div class="kpi"><b>${a.skills.filter((s) => !s.ok).length}</b>مهارات تحتاج معالجة</div></div>
    <h3>إتقان المهارات على مستوى الشعبة</h3>${bars(a.skills.map((s) => ({ label: s.name, v: s.pct })))}
    <h3>تصنيف الطلاب</h3>${bars(a.groups.map((g) => ({ label: `${g.name} (${g.students.length})`, v: a.n ? Math.round((g.students.length / a.n) * 100) : 0, color: g.color })))}
    <h3>توزيع الدرجات</h3><table><thead><tr>${a.dist.map((x) => `<th>${x.label}</th>`).join('')}</tr></thead><tbody><tr>${a.dist.map((x) => `<td class="center">${x.n}</td>`).join('')}</tr></tbody></table>
    <h3>تحليل الأسئلة</h3><table><thead><tr><th>السؤال</th><th>المهارة</th><th>الدرجة</th><th>نسبة الإتقان</th></tr></thead><tbody>${a.items.map((x) => `<tr><td>${x.i + 1}</td><td>${esc(x.skill_name || '-')}</td><td>${x.max}</td><td style="color:${colorOf(x.pct)};font-weight:700">${pc(x.pct)}</td></tr>`).join('')}</tbody></table>
    <h3>نتائج الطلاب</h3><table><thead><tr><th>م</th><th>الطالب</th><th>الدرجة</th><th>النسبة</th><th>الفئة</th><th>مهارات تحتاج دعم</th></tr></thead><tbody>${a.rows.map((r, i) => { const g = R.GROUPS.find((x) => x.key === r.group); return `<tr><td>${i + 1}</td><td>${esc(nm(r.id, r.name))}</td><td>${r.absent ? 'غائب' : r.total == null ? '-' : `${r.total} / ${a.max}`}</td><td>${pc(r.pct)}</td><td>${g ? `<span class="tag" style="background:${g.color}">${g.name}</span>` : '-'}</td><td>${esc(r.weak.join('، '))}</td></tr>`; }).join('')}</tbody></table>${sign}`);

  const plans = (a) => page(`${head(`الخطط العلاجية والإثرائية بعد ${a.title}`)}${a.plans.map((p) => `<h3><span class="tag" style="background:${p.color}">${p.name}</span> خطة ${p.type} (${p.count} طالباً)</h3>
    <table><tbody><tr><th style="width:24%">الهدف</th><td>${esc(p.goal)}</td></tr><tr><th>المهارات المستهدفة</th><td>${esc(p.skills.join('، ') || '-')}</td></tr><tr><th>الطلاب</th><td>${p.students.map((x, i) => esc(anon ? `طالب ${i + 1}` : x)).join('، ')}</td></tr>
    <tr><th>الاستراتيجيات والإجراءات</th><td>${p.strategies.map((s) => `• ${esc(s)}`).join('<br>')}</td></tr><tr><th>المدة</th><td>${esc(p.period)}</td></tr><tr><th>أداة القياس</th><td>${esc(p.tool)}</td></tr><tr><th>التنفيذ</th><td>${p.done ? `✅ نُفّذت (${dAr(new Date(p.done).toISOString().slice(0, 10))})` : '☐ لم تُنفذ بعد'}</td></tr></tbody></table>`).join('') || '<p class="muted">ما فيه نتائج مرصودة.</p>'}
    ${a.individual.length ? `<h2 class="sec">خطط الدعم الفردي</h2><table><thead><tr><th>الطالب</th><th>نسبته</th><th>المهارات غير المتقنة</th><th>الإجراءات</th><th>التنفيذ</th></tr></thead><tbody>${a.individual.map((x) => `<tr><td>${esc(nm(x.id, x.name))}</td><td>${pc(x.pct)}</td><td>${esc(x.weak.join('، '))}</td><td>${x.strategies.map(esc).join('<br>')}</td><td>${x.done ? '✅' : '☐'}</td></tr>`).join('')}</tbody></table>` : ''}${sign}`);

  const comp = (c) => page(`${head(`مقارنة ${c.pre.title} و${c.post.title}`)}<div class="kpis"><div class="kpi"><b>${pc(c.pre.avg)}</b>متوسط القبلي</div><div class="kpi"><b>${pc(c.post.avg)}</b>متوسط البعدي</div><div class="kpi"><b>${sg(c.gain)}</b>التحسن</div><div class="kpi"><b>${c.improved} / ${c.compared}</b>طلاب تحسنوا</div></div>
    ${c.skills.length ? `<h3>المهارات قبل وبعد</h3>${pairBars(c.skills.map((s) => ({ label: s.name, pre: s.pre, post: s.post })))}` : ''}
    <h3>انتقال الطلاب بين الفئات</h3><table><thead><tr><th>الفئة</th><th>قبل</th><th>بعد</th></tr></thead><tbody>${c.groupsPre.map((g, i) => `<tr><td><span class="tag" style="background:${g.color}">${g.name}</span></td><td>${g.n}</td><td>${c.groupsPost[i].n}</td></tr>`).join('')}</tbody></table>
    <h3>نتائج الطلاب</h3><table><thead><tr><th>الطالب</th><th>القبلي</th><th>البعدي</th><th>الفرق</th></tr></thead><tbody>${c.rows.map((r) => `<tr><td>${esc(nm(r.id, r.name))}</td><td>${pc(r.pre)}</td><td>${pc(r.post)}</td><td style="color:${r.gain == null ? '' : r.gain >= 0 ? '#15803d' : '#b91c1c'};font-weight:700">${sg(r.gain)}</td></tr>`).join('')}</tbody></table>${sign}`);

  const follow = () => page(`${head('سجل متابعة مهارات الطالب')}<p class="muted">آخر نتيجة مرصودة لكل مهارة: ✔ متقن (${R.SKILL_OK}% فأكثر)، ◐ قريب (50 إلى أقل من ${R.SKILL_OK})، ✖ غير متقن.</p>
    <table style="font-size:11.5px"><thead><tr><th>الطالب</th>${d.skills.map((s, i) => `<th title="${esc(s.name)}">${i + 1}</th>`).join('')}</tr></thead><tbody>${f.followup.map((r) => `<tr><td>${esc(nm(r.id, r.name))}</td>${r.skills.map((c) => `<td class="center" style="color:${c ? colorOf(c.v >= R.SKILL_OK ? 80 : c.v) : ''}">${c ? (c.v >= R.SKILL_OK ? '✔' : c.v >= 50 ? '◐' : '✖') : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <h3>المهارات</h3><ol>${d.skills.map((s) => `<li>${esc(s.name)}</li>`).join('')}</ol>${sign}`);

  const prog = () => { const p = f.progress; return page(`${head('تقرير سير المادة', `حتى الأسبوع ${p.week}`)}<div class="kpis"><div class="kpi"><b>${p.done} / ${p.total}</b>دروس منفذة</div><div class="kpi"><b>${p.pct}%</b>نسبة التنفيذ</div><div class="kpi"><b>${p.planned}</b>المخطط حتى الآن</div><div class="kpi"><b>${p.behind.length}</b>دروس متأخرة</div></div>
    <p>${p.onTrack ? 'سير المادة مطابق للخطة.' : `يوجد ${p.behind.length} دروس متأخرة عن الخطة، ويُقترح تعويضها في الحصص القادمة.`}</p>
    ${p.behind.length ? `<table><thead><tr><th>الدرس المتأخر</th><th>الوحدة</th></tr></thead><tbody>${p.behind.map((l) => `<tr><td>${esc(l.title)}</td><td>${esc(l.unit)}</td></tr>`).join('')}</tbody></table>` : ''}
    <h3>الإجراءات العلاجية المنفذة</h3><ul>${tests.flatMap((t) => t.plans.filter((x) => x.done).map((x) => `<li>خطة ${esc(x.type)} لفئة «${esc(x.name)}» بعد ${esc(t.title)}</li>`)).join('') || '<li class="muted">لا يوجد بعد</li>'}</ul>${sign}`); };

  if (kind === 'all') {
    parts.push(cover(), students(), termPlan(), weeks());
    for (const t of tests) { parts.push(paper(t)); if (t.n) parts.push(analysis(t), plans(t)); }
    if (f.compare) parts.push(comp(f.compare));
    parts.push(follow(), prog());
  } else if (kind === 'students') parts.push(students());
  else if (kind === 'term') parts.push(termPlan());
  else if (kind === 'week') parts.push(weeks(Number(week) || f.plan.current));
  else if (kind === 'weeks') parts.push(weeks());
  else if (kind === 'paper') { const t = pickTest(test); if (t) parts.push(paper(t)); }
  else if (kind === 'analysis') { const t = pickTest(test); if (t && t.n) parts.push(analysis(t)); }
  else if (kind === 'remedial') { const t = pickTest(test); if (t && t.n) parts.push(plans(t)); }
  else if (kind === 'compare') { const c = R.compare(d, test, week); if (c) parts.push(comp(c)); }
  else if (kind === 'followup') parts.push(follow());
  else if (kind === 'progress') parts.push(prog());
  if (!parts.length) parts.push(page('<p class="center muted" style="padding:40mm 0">ما فيه بيانات كافية لهذا التقرير بعد.</p>'));
  const bar = anon ? '' : `<div class="toolbar"><a class="btn ghost" href="${esc(back)}">→ رجوع</a><button class="btn" onclick="print()">🖨️ طباعة / حفظ PDF</button><span class="muted" style="font-size:12px">اختر «حفظ كـ PDF» من نافذة الطباعة</span></div>`;
  return shell(`سجل ${cls}`, bar + parts.join(''));
}
module.exports = { build };
