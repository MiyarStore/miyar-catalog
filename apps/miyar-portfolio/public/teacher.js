/* مساعد المعلم: سجل المادة لكل شعبة */
const RC = { rec: null, calc: null, ai: false, dirty: false };
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const KIND_AR = { diag: 'تشخيصي (قبلي)', quiz: 'اختبار قصير', p1: 'الفترة الأولى', p2: 'الفترة الثانية', final: 'ختامي' };
const GRP = { mastery: ['متقن', '#15803d'], progress: ['في طور الإتقان', '#b45309'], support: ['يحتاج دعماً مكثفاً', '#b91c1c'] };
const pcs = (v) => (v == null ? '-' : `${v}%`);
const sgn = (v) => (v == null ? '-' : `<bdi dir="ltr">${v > 0 ? '+' : ''}${v}</bdi>`);
const clr = (v) => (v == null ? '#9aa8a6' : v >= 80 ? '#15803d' : v >= 50 ? '#b45309' : '#b91c1c');
const hbar = (label, v, color) => `<div class="hb"><span class="hb-l">${esc(label)}</span><span class="hb-t"><i style="width:${Math.max(0, Math.min(100, v || 0))}%;background:${color || clr(v)}"></i></span><b style="color:${color || clr(v)}">${pcs(v)}</b></div>`;
const rid = () => Math.random().toString(16).slice(2, 10);
const fdate = (s) => { if (!s) return ''; try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'short' }).format(new Date(s + 'T12:00:00')); } catch { return s; } };

if (!document.getElementById('rec-css')) {
  const st = document.createElement('style'); st.id = 'rec-css';
  st.textContent = `.rtabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin:10px 0 14px}.rtabs a{white-space:nowrap;padding:7px 12px;border-radius:99px;background:var(--brand-soft);color:var(--brand-text);text-decoration:none;font-size:14px}.rtabs a.on{background:var(--brand);color:#fff}
  .hb{display:grid;grid-template-columns:minmax(90px,38%) 1fr 54px;gap:8px;align-items:center;font-size:13.5px;margin:5px 0}.hb-l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hb-t{height:12px;background:var(--line);border-radius:99px;overflow:hidden}.hb-t i{display:block;height:100%;border-radius:99px}.hb b{text-align:left}
  .tt{border-collapse:collapse}.tt td,.tt th{border:1px solid var(--line);padding:4px;text-align:center}.tt label{display:block;cursor:pointer}
  .grid-sc{overflow:auto;max-height:70vh}.grid-sc table{border-collapse:collapse;font-size:13px}.grid-sc th,.grid-sc td{border:1px solid var(--line);padding:2px}.grid-sc th{position:sticky;top:0;background:var(--card);z-index:1}.grid-sc td:first-child,.grid-sc th:first-child{position:sticky;right:0;background:var(--card);text-align:right;padding:4px 6px;min-width:130px}
  .grid-sc input{width:46px;text-align:center;padding:4px;border:1px solid transparent;border-radius:6px;background:transparent;font:inherit;color:inherit}.grid-sc input:focus{border-color:var(--brand);outline:0;background:var(--brand-soft)}
  .etable{width:100%;border-collapse:collapse;font-size:13.5px}.etable td,.etable th{border-bottom:1px solid var(--line);padding:5px 4px;text-align:right;vertical-align:top}.etable input,.etable select,.etable textarea{width:100%;box-sizing:border-box}
  .gtag{display:inline-block;white-space:nowrap;color:#fff;border-radius:99px;padding:1px 9px;font-size:12px}.wkc{border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:8px}.wkc.cur{border:2px solid var(--brand)}.wkc .it{font-size:13.5px;margin:3px 0}.done-l{text-decoration:line-through;opacity:.6}
  .steps-rec{counter-reset:s;display:grid;gap:8px;margin:0;padding:0;list-style:none}.steps-rec li{display:flex;gap:10px;align-items:center}.steps-rec li b.n{display:inline-grid;place-items:center;min-width:26px;height:26px;border-radius:50%;background:var(--line)}.steps-rec li.ok b.n{background:var(--brand);color:#fff}`;
  document.head.appendChild(st);
}

async function recLoad(id) { const d = await api(`/api/rec/${id}`); Object.assign(RC, d); RC.dirty = false; }
async function recSave(patch, quiet) {
  Object.assign(RC.rec, patch || {});
  const d = await api(`/api/rec/${RC.rec.id}`, { method: 'PUT', body: RC.rec });
  Object.assign(RC, d); RC.dirty = false;
  if (!quiet) toast('تم الحفظ ✅');
}

// ---------- قائمة السجلات ----------
async function recList() {
  view.innerHTML = '<p class="muted">جاري التحميل...</p>';
  let list = [];
  try { ({ list } = await api('/api/rec')); } catch (e) { view.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  view.innerHTML = `${banner()}<div class="head"><div><h1 style="margin:0">📚 مساعد المعلم</h1><p class="muted" style="margin:4px 0 0">أدخل طلابك وجدولك ودروسك مرة وحدة، والباقي يتجهز لحاله: الخطة الأسبوعية والفصلية، والاختبارات، والتحليل، والخطط العلاجية والإثرائية، ومتابعة الطلاب، ورسائل أولياء الأمور، وشواهد ملف الإنجاز.</p></div></div>
  <div class="grid g2" style="margin-bottom:16px">${list.map((r) => `<a class="card" href="#/rec/${r.id}" style="text-decoration:none;color:inherit">
    <div class="head" style="margin:0"><h3 style="margin:0">${esc(r.subject)}${r.grade ? ` · ${esc(r.grade)}` : ''}${r.section ? ` (${esc(r.section)})` : ''}</h3><span class="pill">${r.progress}% منفذ</span></div>
    <div class="muted" style="font-size:13px;margin-top:6px">${esc(r.term)} · ${r.students} طالب · ${r.lessons} درس · ${r.tests} اختبار</div></a>`).join('')}</div>
  <form id="nr" class="card"><h3 style="margin-top:0">➕ سجل جديد لشعبة</h3>
    <div class="grid g3"><div class="field"><label>المادة</label><input name="subject" required value="${esc(S.me.subject)}" placeholder="رياضيات"></div>
    <div class="field"><label>الصف</label><input name="grade" placeholder="الثالث المتوسط"></div><div class="field"><label>الشعبة / الفصل</label><input name="section" placeholder="3/1"></div>
    <div class="field"><label>الفصل الدراسي</label><input name="term" value="الفصل الدراسي الأول"></div><div class="field"><label>بداية الدراسة</label><input type="date" name="start"></div><div class="field"><label>عدد الأسابيع</label><input type="number" name="weeks" value="18" min="4" max="24"></div></div>
    ${list.length ? `<div class="field"><label>انسخ الدروس والمهارات والاختبارات من سجل ثاني <span class="muted">(اختياري، لنفس المادة في شعبة ثانية)</span></label><select name="copy_from"><option value="">بدون نسخ</option>${list.map((r) => `<option value="${r.id}">${esc(r.subject)} ${esc(r.grade)} ${esc(r.section)}</option>`).join('')}</select></div>` : ''}
    <button class="btn">إنشاء السجل</button></form>`;
  $('#nr').onsubmit = async (e) => { e.preventDefault(); try { const d = await api('/api/rec', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); Object.assign(RC, d); location.hash = `#/rec/${d.rec.id}`; } catch (err) { toast(err.message); } };
}

// ---------- السجل ----------
const TABS = [['setup', '⚙️ البيانات'], ['plan', '🗓️ الخطة'], ['tests', '📝 الاختبارات'], ['analysis', '📊 التحليل والعلاج'], ['compare', '📈 القبلي والبعدي'], ['follow', '👥 المتابعة'], ['parents', '💬 أولياء الأمور'], ['export', '🖨️ التصدير والشواهد']];
async function recView(id, tab = 'setup', q) {
  if (!id) return recList();
  if (!RC.rec || RC.rec.id !== Number(id)) { view.innerHTML = '<p class="muted">جاري التحميل...</p>'; try { await recLoad(id); } catch (e) { toast(e.message); location.hash = '#/rec'; return; } }
  const r = RC.rec;
  const steps = [['الطلاب', r.students.length], ['الجدول', r.slots.length], ['الدروس', r.lessons.length], ['المهارات', r.skills.length], ['اختبار مرصود', RC.calc.tests.some((t) => t.n)]];
  view.innerHTML = `${banner()}<div class="head"><div><a href="#/rec" class="muted" style="text-decoration:none">→ سجلاتي</a><h1 style="margin:4px 0 0">${esc(r.subject)}${r.grade ? ` · ${esc(r.grade)}` : ''}${r.section ? ` (${esc(r.section)})` : ''}</h1><div class="muted">${esc(r.term)} · ${r.students.length} طالب · الأسبوع ${RC.calc.plan.current} من ${r.weeks}</div></div>
    <a class="btn" target="_blank" href="/rec/${r.id}/print">🖨️ السجل كامل</a></div>
    ${steps.some((s) => !s[1]) ? `<div class="card" style="margin-bottom:10px"><b>خطوات البداية</b><ul class="steps-rec" style="margin-top:8px">${steps.map((s, i) => `<li class="${s[1] ? 'ok' : ''}"><b class="n">${s[1] ? '✓' : i + 1}</b>${s[0]}${typeof s[1] === 'number' && s[1] ? ` <span class="muted">(${s[1]})</span>` : ''}</li>`).join('')}</ul></div>` : ''}
    <nav class="rtabs">${TABS.map(([k, t]) => `<a href="#/rec/${r.id}/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</nav><div id="rt"></div>`;
  document.querySelector('.rtabs a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  const fn = { setup: tSetup, plan: tPlan, tests: tTests, analysis: tAnalysis, compare: tCompare, follow: tFollow, parents: tParents, export: tExport }[tab] || tSetup;
  fn($('#rt'), q || new URLSearchParams());
}
const rerender = () => route();

// ---- البيانات ----
function tSetup(el) {
  const r = RC.rec;
  el.innerHTML = `<form id="sf" class="card" style="margin-bottom:14px"><h3 style="margin-top:0">بيانات الشعبة</h3><div class="grid g3">
    ${[['subject', 'المادة'], ['grade', 'الصف'], ['section', 'الشعبة'], ['stage', 'المرحلة'], ['term', 'الفصل الدراسي'], ['year', 'العام الدراسي']].map(([k, l]) => `<div class="field"><label>${l}</label><input name="${k}" value="${esc(r[k])}"></div>`).join('')}
    <div class="field"><label>بداية الدراسة (أول يوم)</label><input type="date" name="start" value="${esc(r.start)}"></div><div class="field"><label>عدد الأسابيع</label><input type="number" name="weeks" min="4" max="24" value="${r.weeks}"></div>
    <div class="field"><label>أسابيع الإجازات والاختبارات <span class="muted">(أرقام، مثل 9، 18)</span></label><input name="off" value="${esc(r.off.join('، '))}"></div></div>
    <h3>جدول حصص الشعبة</h3><p class="muted" style="margin-top:0;font-size:13px">علّم حصص هذي الشعبة في الأسبوع، والخطة تتوزع عليها.</p>
    <div style="overflow:auto"><table class="tt"><tr><th></th>${[1, 2, 3, 4, 5, 6, 7, 8].map((p) => `<th>${p}</th>`).join('')}</tr>${DAYS_AR.map((d, i) => `<tr><th>${d}</th>${[1, 2, 3, 4, 5, 6, 7, 8].map((p) => `<td><label><input type="checkbox" name="slot" value="${i}:${p}" ${r.slots.some((s) => s.day === i && s.period === p) ? 'checked' : ''}></label></td>`).join('')}</tr>`).join('')}</table></div>
    <div style="margin-top:12px"><button class="btn">💾 حفظ البيانات والجدول</button></div></form>

  <div class="card" style="margin-bottom:14px"><div class="head" style="margin:0"><h3 style="margin:0">👥 الطلاب (${r.students.length})</h3></div>
    <p class="muted" style="font-size:13px">انسخ الأسماء من كشف نور أو Excel والصقها هنا، كل طالب في سطر. ولو فيه رقم جوال ولي الأمر في نفس السطر ناخذه.</p>
    <textarea id="stx" placeholder="محمد أحمد العتيبي&#10;خالد سعد القحطاني	0551234567"></textarea><button class="btn soft sm" id="stb" style="margin-top:6px">➕ أضف الطلاب</button>
    ${r.students.length ? `<div style="overflow:auto;margin-top:10px"><table class="etable"><tr><th>م</th><th>الاسم</th><th>جوال ولي الأمر</th><th>ملاحظات</th><th></th></tr>${r.students.map((s, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input data-k="name" value="${esc(s.name)}"></td><td><input data-k="phone" dir="ltr" value="${esc(s.phone)}" placeholder="05xxxxxxxx"></td><td><input data-k="note" value="${esc(s.note)}"></td><td><button class="btn ghost sm" data-del="${i}" title="حذف">×</button></td></tr>`).join('')}</table></div><button class="btn sm" id="sts" style="margin-top:8px">💾 حفظ التعديلات</button>` : ''}
    <p class="privacy-note">🔒 أسماء الطلاب تظهر لك أنت فقط وفي تقاريرك. الروابط اللي تنضاف لملف الإنجاز تعرض الطلاب بأرقام بدون أسماء.</p></div>

  <div class="card" style="margin-bottom:14px"><h3 style="margin-top:0">📖 دروس المقرر (${r.lessons.length})</h3>
    <p class="muted" style="font-size:13px">الصق فهرس الكتاب: سطر يبدأ بـ«الوحدة» يصير عنوان وحدة، والباقي دروس. لو الدرس ياخذ أكثر من حصة اكتب بعده فاصلة والعدد، مثل: «جمع الكسور، 2».</p>
    <textarea id="ltx" placeholder="الوحدة الأولى: الأعداد النسبية&#10;الأعداد النسبية، 2&#10;مقارنة الأعداد النسبية وترتيبها&#10;الوحدة الثانية: المعادلات"></textarea><button class="btn soft sm" id="ltb" style="margin-top:6px">➕ أضف الدروس</button>
    ${r.lessons.length ? `<div style="overflow:auto;margin-top:10px"><table class="etable"><tr><th>الوحدة</th><th>الدرس</th><th style="width:70px">الحصص</th><th></th></tr>${r.lessons.map((l, i) => `<tr data-i="${i}"><td><input data-k="unit" value="${esc(l.unit)}"></td><td><input data-k="title" value="${esc(l.title)}"></td><td><input data-k="periods" type="number" min="1" max="10" value="${l.periods}"></td><td><button class="btn ghost sm" data-del="${i}">×</button></td></tr>`).join('')}</table></div><button class="btn sm" id="lts" style="margin-top:8px">💾 حفظ الدروس</button>` : ''}</div>

  <div class="card"><h3 style="margin-top:0">🎯 المهارات (${r.skills.length})</h3>
    <p class="muted" style="font-size:13px">المهارات اللي تقيسها الاختبارات (نواتج التعلم). كل سؤال ينربط بمهارة، ومنها يطلع التحليل والخطط العلاجية.</p>
    <textarea id="ktx" placeholder="يقارن بين الأعداد النسبية&#10;يحل معادلة من خطوة واحدة"></textarea>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn soft sm" id="ktb">➕ أضف المهارات</button>${r.lessons.length ? '<button class="btn ghost sm" id="kfl">✨ مهارة لكل درس من الدروس</button>' : ''}</div>
    ${r.skills.length ? `<div style="margin-top:10px"><table class="etable">${r.skills.map((s, i) => `<tr data-i="${i}"><td style="width:30px">${i + 1}</td><td><input data-k="name" value="${esc(s.name)}"></td><td style="width:40px"><button class="btn ghost sm" data-del="${i}">×</button></td></tr>`).join('')}</table></div><button class="btn sm" id="kts" style="margin-top:8px">💾 حفظ المهارات</button>` : ''}</div>
  <details class="card" style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">حذف السجل</summary><p class="muted">يحذف السجل وكل درجاته. الشواهد اللي أضفتها لملف الإنجاز تبقى.</p><button class="btn danger" id="rdel">حذف السجل نهائياً</button></details>`;

  $('#sf').onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target); const b = Object.fromEntries(f);
    b.off = String(b.off || '').split(/[^0-9٠-٩]+/).map((x) => Number(x.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)))).filter(Boolean);
    b.slots = f.getAll('slot').map((v) => { const [day, period] = v.split(':').map(Number); return { day, period }; });
    delete b.slot;
    try { await recSave(b); rerender(); } catch (err) { toast(err.message); }
  };
  const parseAdd = async (what, ta, key) => {
    const text = $(ta).value; if (!text.trim()) return toast('الصق النص أول');
    try { const { items } = await api('/api/rec-parse', { method: 'POST', body: { what, text } }); await recSave({ [key]: [...RC.rec[key], ...items] }, true); toast(`تمت إضافة ${items.length} ✅`); rerender(); } catch (err) { toast(err.message); }
  };
  $('#stb').onclick = () => parseAdd('students', '#stx', 'students');
  $('#ltb').onclick = () => parseAdd('lessons', '#ltx', 'lessons');
  $('#ktb').onclick = () => parseAdd('skills', '#ktx', 'skills');
  if ($('#kfl')) $('#kfl').onclick = async () => { const have = new Set(RC.rec.skills.map((s) => s.name)); const add = RC.rec.lessons.filter((l) => !have.has(l.title)).map((l) => ({ id: rid(), name: l.title })); await recSave({ skills: [...RC.rec.skills, ...add] }, true); toast(`انضافت ${add.length} مهارة`); rerender(); };
  // تعديل وحذف الصفوف
  const table = (btn, key) => { const b = $(btn); if (!b) return; const tbl = b.previousElementSibling.querySelector('table');
    tbl.onclick = async (e) => { const i = e.target.dataset.del; if (i === undefined) return; if (key === 'students' && !confirm('حذف الطالب ودرجاته؟')) return; const arr = [...RC.rec[key]]; arr.splice(Number(i), 1); await recSave({ [key]: arr }, true); rerender(); };
    b.onclick = async () => { const arr = RC.rec[key].map((x, i) => { const tr = tbl.querySelector(`tr[data-i="${i}"]`); const o = { ...x }; tr.querySelectorAll('[data-k]').forEach((inp) => { o[inp.dataset.k] = inp.type === 'number' ? Number(inp.value) : inp.value; }); return o; }); try { await recSave({ [key]: arr }); rerender(); } catch (err) { toast(err.message); } };
  };
  table('#sts', 'students'); table('#lts', 'lessons'); table('#kts', 'skills');
  $('#rdel').onclick = async () => { if (!confirm('متأكد من حذف السجل؟')) return; await api(`/api/rec/${RC.rec.id}`, { method: 'DELETE' }); RC.rec = null; location.hash = '#/rec'; };
}

// ---- الخطة ----
function tPlan(el) {
  const r = RC.rec, p = RC.calc.plan, pr = RC.calc.progress;
  if (!r.lessons.length) { el.innerHTML = `<div class="card center"><p>أضف دروس المقرر وجدول الحصص من «البيانات»، وتنبني الخطة تلقائياً.</p><a class="btn" href="#/rec/${r.id}/setup">إضافة الدروس</a></div>`; return; }
  el.innerHTML = `<div class="stats"><div class="card stat"><b>${pr.done}/${pr.total}</b>دروس منفذة</div><div class="card stat"><b>${pr.pct}%</b>نسبة التنفيذ</div><div class="card stat"><b>${pr.behind.length}</b>متأخرة عن الخطة</div><div class="card stat"><b>${p.per}</b>حصص في الأسبوع</div></div>
  ${!r.start ? '<div class="banner trial"><span>حدد تاريخ بداية الدراسة من «البيانات» عشان تطلع التواريخ في الخطة.</span></div>' : ''}
  ${p.need > p.capacity ? `<div class="banner expired"><span>الدروس تحتاج ${p.need} حصة، والمتاح ${p.capacity}. ${p.overflow.length} دروس ما دخلت الخطة، زِد الحصص أو قلل حصص بعض الدروس.</span></div>` : ''}
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><a class="btn sm" target="_blank" href="/rec/${r.id}/print?k=week&week=${p.current}">🖨️ خطة هذا الأسبوع</a><a class="btn soft sm" target="_blank" href="/rec/${r.id}/print?k=weeks">🖨️ كل الخطط الأسبوعية</a><a class="btn soft sm" target="_blank" href="/rec/${r.id}/print?k=term">🖨️ الخطة الفصلية</a><a class="btn ghost sm" target="_blank" href="/rec/${r.id}/print?k=progress">🖨️ تقرير سير المادة</a></div>
  <p class="muted" style="font-size:13px;margin-top:0">علّم الدرس لما تنفذه، ويتحدث تقرير سير المادة. ★ تعني إجراء تلقائي (التشخيصي، أو حصة علاجية بعد اختبار مرصود).</p>
  ${p.weeks.map((w) => `<div class="wkc ${w.n === p.current ? 'cur' : ''}" id="w${w.n}"><div class="head" style="margin:0 0 4px"><b>الأسبوع ${w.n}${w.n === p.current ? ' (الحالي)' : ''}</b><span class="muted" style="font-size:12.5px">${w.from ? `${fdate(w.from)} - ${fdate(w.to)}` : ''} ${w.off ? '· إجازة / اختبارات' : ''}</span></div>
    ${w.items.map((x) => x.type === 'lesson' ? `<label class="it ${x.done ? 'done-l' : ''}"><input type="checkbox" data-l="${x.id}" ${x.done ? 'checked' : ''}> ${esc(x.title)} <span class="muted">(${x.periods} ${x.periods > 1 ? 'حصص' : 'حصة'}${x.cont ? '، تكملة' : ''})</span></label>` : `<div class="it" style="color:var(--brand-text)">★ ${esc(x.title)}</div>`).join('') || (w.off ? '' : '<div class="muted it">-</div>')}
    ${w.off ? '' : `<a class="muted" style="font-size:12px" target="_blank" href="/rec/${r.id}/print?k=week&week=${w.n}">طباعة الأسبوع</a>`}</div>`).join('')}`;
  el.onchange = async (e) => { const id = e.target.dataset.l; if (!id) return; const lessons = RC.rec.lessons.map((l) => (l.id === id ? { ...l, done: e.target.checked, done_at: e.target.checked ? Date.now() : null } : l)); try { await recSave({ lessons }, true); tPlan(el); toast(e.target.checked ? 'تم ✅' : 'تم التراجع'); } catch (err) { toast(err.message); } };
  setTimeout(() => document.getElementById(`w${p.current}`)?.scrollIntoView({ block: 'center' }), 50);
}

// ---- الاختبارات ----
function tTests(el, q) {
  const r = RC.rec;
  const tid = q.get('t');
  const t = tid ? r.tests.find((x) => x.id === tid) : null;
  if (t) return testEditor(el, t, q.get('m') || 'scores');
  el.innerHTML = `${r.tests.length ? `<div class="grid g2" style="margin-bottom:14px">${RC.calc.tests.map((a) => { const T = r.tests.find((x) => x.id === a.id); return `<div class="card"><div class="head" style="margin:0"><h3 style="margin:0">${esc(a.title)}</h3><span class="pill">${KIND_AR[a.kind]}</span></div>
    <div class="muted" style="font-size:13px;margin:4px 0 8px">${a.date ? fdate(a.date) + ' · ' : ''}${T.items.length} سؤال · ${a.n ? `مرصود لـ${a.n} طالب، المتوسط ${pcs(a.avg)}` : 'ما انرصد بعد'}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn sm" href="#/rec/${r.id}/tests?t=${a.id}&m=scores">✍️ رصد الدرجات</a><a class="btn soft sm" href="#/rec/${r.id}/tests?t=${a.id}&m=items">الأسئلة</a><a class="btn ghost sm" target="_blank" href="/rec/${r.id}/print?k=paper&test=${a.id}">🖨️ ورقة الاختبار</a>${a.n ? `<a class="btn ghost sm" href="#/rec/${r.id}/analysis?t=${a.id}">📊 التحليل</a>` : ''}</div></div>`; }).join('')}</div>` : ''}
  <form id="tf" class="card"><h3 style="margin-top:0">➕ اختبار جديد</h3>
    ${!r.skills.length ? `<div class="banner trial"><span>أضف المهارات أول من «البيانات» عشان تربط كل سؤال بمهارة.</span><a class="btn sm" href="#/rec/${r.id}/setup">المهارات</a></div>` : ''}
    <div class="grid g3"><div class="field"><label>النوع</label><select name="kind">${Object.entries(KIND_AR).map(([k, v]) => `<option value="${k}" ${!r.tests.length && k === 'diag' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label>العنوان</label><input name="title" placeholder="يتعبى تلقائياً من النوع"></div><div class="field"><label>التاريخ</label><input type="date" name="date" value="${today()}"></div></div>
    ${r.skills.length ? `<div class="field"><label>المهارات اللي يقيسها</label><div style="display:grid;gap:4px;max-height:220px;overflow:auto">${r.skills.map((s) => `<label class="switch" style="font-size:14px"><input type="checkbox" name="sk" value="${s.id}" checked> ${esc(s.name)}</label>`).join('')}</div></div>
    <div class="grid g3"><div class="field"><label>أسئلة لكل مهارة</label><select name="per"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div></div>` : ''}
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" name="go" value="ai">${RC.ai ? '✨ ولّد الأسئلة بالذكاء الاصطناعي' : '📝 جهّز الأسئلة مربوطة بالمهارات'}</button><button class="btn ghost" name="go" value="empty">اختبار بدون أسئلة (أدخل الدرجات بس)</button></div>
    <p class="muted" style="font-size:12.5px">${RC.ai ? 'الأسئلة تطلع اختيار من متعدد مع مفتاح الإجابة، وتقدر تعدلها كلها قبل الطباعة.' : 'تكتب نص الأسئلة بنفسك، أو تكتفي بربط كل سؤال بمهارته ودرجته.'}</p></form>`;
  $('#tf').onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target); const go = e.submitter ? e.submitter.value : 'ai';
    const kind = f.get('kind'); const skills = f.getAll('sk');
    const btn = e.submitter; btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = '<span class="spin"></span> جاري التجهيز';
    try {
      let items = [];
      if (go === 'ai' && skills.length) ({ items } = await api(`/api/rec/${r.id}/ai-test`, { method: 'POST', body: { kind, skills, perSkill: f.get('per') } }));
      if (go === 'empty') items = (skills.length ? skills : ['']).map((sk) => ({ skill: sk, max: 10, text: '', choices: [], answer: '' }));
      const nt = { id: rid(), kind, title: f.get('title') || ({ diag: 'الاختبار التشخيصي', quiz: 'اختبار قصير', p1: 'اختبار الفترة الأولى', p2: 'اختبار الفترة الثانية', final: 'الاختبار الختامي' })[kind], date: f.get('date'), items, scores: {}, absent: [] };
      await recSave({ tests: [...r.tests, nt] }, true); toast('تم إنشاء الاختبار ✅');
      location.hash = `#/rec/${r.id}/tests?t=${nt.id}&m=${go === 'empty' ? 'scores' : 'items'}`;
    } catch (err) { toast(err.message); btn.disabled = false; btn.innerHTML = old; }
  };
}

function testEditor(el, t, mode) {
  const r = RC.rec;
  const sk = (id) => (r.skills.find((s) => s.id === id) || {}).name || '';
  const head = `<div class="head"><div><a class="muted" href="#/rec/${r.id}/tests" style="text-decoration:none">→ الاختبارات</a><h2 style="margin:4px 0 0">${esc(t.title)}</h2></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn sm ${mode === 'scores' ? '' : 'soft'}" href="#/rec/${r.id}/tests?t=${t.id}&m=scores">✍️ الدرجات</a><a class="btn sm ${mode === 'items' ? '' : 'soft'}" href="#/rec/${r.id}/tests?t=${t.id}&m=items">الأسئلة</a><a class="btn ghost sm" target="_blank" href="/rec/${r.id}/print?k=paper&test=${t.id}">🖨️ الورقة</a></div></div>`;
  if (mode === 'items') {
    el.innerHTML = `${head}<form id="itf" class="card"><div class="grid g3"><div class="field"><label>العنوان</label><input name="title" value="${esc(t.title)}"></div><div class="field"><label>النوع</label><select name="kind">${Object.entries(KIND_AR).map(([k, v]) => `<option value="${k}" ${t.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div class="field"><label>التاريخ</label><input type="date" name="date" value="${esc(t.date)}"></div></div>
      <div id="its">${t.items.map((it, i) => itemRow(it, i)).join('')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;margin-top:10px"><div style="display:flex;gap:6px"><button type="button" class="btn soft sm" id="addq">➕ سؤال</button></div><div style="display:flex;gap:6px"><button class="btn" id="itsave">💾 حفظ الأسئلة</button><button type="button" class="btn danger sm" id="tdel">حذف الاختبار</button></div></div>
      ${Object.keys(t.scores).length ? '<p class="muted" style="font-size:12.5px">تنبيه: حذف سؤال بعد الرصد يمسح درجاته.</p>' : ''}</form>`;
    function itemRow(it, i) { return `<div class="card" style="padding:10px;margin-bottom:8px;background:var(--bg)" data-q="${i}"><div class="grid g3"><div class="field" style="grid-column:span 2"><label>س${i + 1}: المهارة</label><select data-k="skill"><option value="">بدون مهارة</option>${r.skills.map((s) => `<option value="${s.id}" ${it.skill === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>الدرجة</label><input data-k="max" type="number" step="0.25" min="0.25" value="${it.max}"></div></div>
      <div class="field"><label>نص السؤال <span class="muted">(اختياري)</span></label><textarea data-k="text" style="min-height:50px">${esc(it.text)}</textarea></div>
      <div class="field"><label>الخيارات <span class="muted">(كل خيار في سطر، اختياري)</span></label><textarea data-k="choices" style="min-height:50px">${esc((it.choices || []).join('\n'))}</textarea></div>
      <div class="grid g2"><div class="field"><label>الإجابة الصحيحة</label><input data-k="answer" value="${esc(it.answer)}"></div><div class="field"><label>&nbsp;</label><button type="button" class="btn ghost sm" data-rmq="${i}">حذف السؤال</button></div></div></div>`; }
    const collect = () => [...el.querySelectorAll('[data-q]')].map((box) => { const g = (k) => box.querySelector(`[data-k="${k}"]`).value; return { skill: g('skill'), max: Number(g('max')) || 1, text: g('text'), choices: g('choices').split('\n').map((x) => x.trim()).filter(Boolean), answer: g('answer') }; });
    $('#addq').onclick = () => { const items = collect(); items.push({ skill: '', max: 1, text: '', choices: [], answer: '' }); $('#its').innerHTML = items.map(itemRow).join(''); };
    $('#its').onclick = (e) => { const i = e.target.dataset.rmq; if (i === undefined) return; const items = collect(); items.splice(Number(i), 1); $('#its').innerHTML = items.map(itemRow).join(''); };
    $('#itf').onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const items = collect();
      const removed = t.items.length - items.length;
      const scores = Object.fromEntries(Object.entries(t.scores).map(([k, v]) => [k, items.map((_, i) => (removed > 0 ? null : v[i] ?? null))]));
      const tests = r.tests.map((x) => (x.id === t.id ? { ...x, ...f, items, scores: removed > 0 ? {} : scores } : x));
      try { await recSave({ tests }); location.hash = `#/rec/${r.id}/tests?t=${t.id}&m=scores`; } catch (err) { toast(err.message); }
    };
    $('#tdel').onclick = async () => { if (!confirm('حذف الاختبار ودرجاته؟')) return; await recSave({ tests: r.tests.filter((x) => x.id !== t.id) }, true); location.hash = `#/rec/${r.id}/tests`; };
    return;
  }
  // رصد الدرجات
  if (!r.students.length) { el.innerHTML = `${head}<div class="card center"><p>أضف الطلاب أول.</p><a class="btn" href="#/rec/${r.id}/setup">الطلاب</a></div>`; return; }
  if (!t.items.length) { el.innerHTML = `${head}<div class="card center"><p>الاختبار ما فيه أسئلة. أضف سؤال وحد على الأقل (ولو الدرجة الكلية بس).</p><a class="btn" href="#/rec/${r.id}/tests?t=${t.id}&m=items">الأسئلة</a></div>`; return; }
  const total = t.items.reduce((a, x) => a + x.max, 0);
  el.innerHTML = `${head}<div class="card"><p class="muted" style="margin-top:0;font-size:13px">اكتب درجة كل طالب في كل سؤال. Enter ينزلك للطالب اللي بعده. تقدر تلصق عمود أو جدول من Excel مباشرة. يتحفظ تلقائياً.</p>
    <div class="grid-sc"><table><tr><th>الطالب</th>${t.items.map((it, i) => `<th title="${esc(sk(it.skill))}">س${i + 1}<br><small class="muted">${it.max}</small></th>`).join('')}<th>المجموع<br><small class="muted">${total}</small></th><th>غائب</th></tr>
    ${r.students.map((s, si) => { const sc = t.scores[s.id] || []; const ab = t.absent.includes(s.id); const sum = sc.reduce((a, v) => a + (Number(v) || 0), 0);
      return `<tr data-s="${s.id}"><td>${si + 1}. ${esc(s.name)}</td>${t.items.map((it, i) => `<td><input inputmode="decimal" data-r="${si}" data-c="${i}" value="${sc[i] ?? ''}" ${ab ? 'disabled' : ''}></td>`).join('')}<td class="center"><b data-sum>${sc.some((v) => v != null) ? Math.round(sum * 100) / 100 : ''}</b></td><td class="center"><input type="checkbox" data-ab ${ab ? 'checked' : ''} style="width:auto"></td></tr>`; }).join('')}</table></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;justify-content:space-between"><span class="muted" id="svst" style="font-size:13px"></span><a class="btn" href="#/rec/${r.id}/analysis?t=${t.id}">📊 شوف التحليل</a></div></div>`;
  let timer;
  const grid = el.querySelector('.grid-sc');
  const pull = () => { const scores = {}; const absent = []; grid.querySelectorAll('tr[data-s]').forEach((tr) => { const id = tr.dataset.s; if (tr.querySelector('[data-ab]').checked) absent.push(id); const vals = [...tr.querySelectorAll('input[data-c]')].map((i) => { const v = i.value.trim().replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)); return v === '' ? null : Number(v); }); if (vals.some((v) => v != null)) scores[id] = vals; const sum = vals.reduce((a, v) => a + (v || 0), 0); tr.querySelector('[data-sum]').textContent = vals.some((v) => v != null) ? Math.round(sum * 100) / 100 : ''; }); return { scores, absent }; };
  const queue = () => { $('#svst').textContent = '...'; clearTimeout(timer); timer = setTimeout(async () => { const { scores, absent } = pull(); const tests = RC.rec.tests.map((x) => (x.id === t.id ? { ...x, scores, absent } : x)); try { await recSave({ tests }, true); $('#svst').textContent = 'تم الحفظ ✓'; } catch (err) { $('#svst').textContent = err.message; } }, 700); };
  grid.addEventListener('input', (e) => { const i = e.target; if (i.dataset.c !== undefined) { const max = t.items[Number(i.dataset.c)].max; const v = Number(i.value); i.style.color = i.value !== '' && (Number.isNaN(v) || v > max || v < 0) ? '#b91c1c' : ''; } queue(); });
  grid.addEventListener('change', (e) => { if (e.target.dataset.ab !== undefined) { e.target.closest('tr').querySelectorAll('input[data-c]').forEach((x) => { x.disabled = e.target.checked; }); queue(); } });
  grid.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || e.target.dataset.r === undefined) return; e.preventDefault(); const nx = grid.querySelector(`input[data-r="${Number(e.target.dataset.r) + 1}"][data-c="${e.target.dataset.c}"]`); if (nx) nx.focus(); });
  grid.addEventListener('paste', (e) => { const i = e.target; if (i.dataset.r === undefined) return; const txt = (e.clipboardData || window.clipboardData).getData('text'); if (!/[\t\n]/.test(txt.trim())) return; e.preventDefault(); txt.replace(/\r/g, '').split('\n').filter((l, k, a) => l !== '' || k < a.length - 1).forEach((line, dr) => line.split('\t').forEach((v, dc) => { const c = grid.querySelector(`input[data-r="${Number(i.dataset.r) + dr}"][data-c="${Number(i.dataset.c) + dc}"]`); if (c && !c.disabled) c.value = v.trim(); })); queue(); });
}

// ---- التحليل والعلاج ----
function tAnalysis(el, q) {
  const r = RC.rec; const list = RC.calc.tests.filter((t) => t.n);
  if (!list.length) { el.innerHTML = `<div class="card center"><p>ارصد درجات أي اختبار، ويطلع لك التحليل وتصنيف الطلاب والخطط العلاجية والإثرائية تلقائياً.</p><a class="btn" href="#/rec/${r.id}/tests">الاختبارات</a></div>`; return; }
  const a = list.find((t) => t.id === q.get('t')) || list[list.length - 1];
  const nm = (id) => (r.students.find((s) => s.id === id) || {}).name || '';
  el.innerHTML = `${list.length > 1 ? `<div class="field" style="max-width:340px"><select id="tsel">${list.map((t) => `<option value="${t.id}" ${t.id === a.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></div>` : ''}
  <div class="stats"><div class="card stat"><b>${pcs(a.avg)}</b>متوسط الإتقان</div><div class="card stat"><b>${a.n}/${a.total}</b>مختبر</div>${a.groups.map((g) => `<div class="card stat"><b style="color:${g.color}">${g.students.length}</b>${g.name}</div>`).join('')}</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><a class="btn sm" target="_blank" href="/rec/${r.id}/print?k=analysis&test=${a.id}">🖨️ تقرير التحليل</a><a class="btn soft sm" target="_blank" href="/rec/${r.id}/print?k=remedial&test=${a.id}">🖨️ الخطط العلاجية والإثرائية</a><button class="btn ghost sm" data-ev="analysis">📁 أضف التحليل لملف إنجازي</button><button class="btn ghost sm" data-ev="remedial">📁 أضف الخطط لملف إنجازي</button></div>
  <div class="grid g2"><div class="card"><h3 style="margin-top:0">إتقان المهارات</h3>${a.skills.length ? a.skills.map((s) => hbar(s.name, s.pct)).join('') : '<p class="muted">الأسئلة ما هي مربوطة بمهارات.</p>'}</div>
  <div class="card"><h3 style="margin-top:0">الأسئلة</h3>${a.items.map((x) => hbar(`س${x.i + 1}${x.skill_name ? ': ' + x.skill_name : ''}`, x.pct)).join('')}</div></div>
  <h2>الخطط حسب الفئات</h2>
  ${a.plans.map((p) => `<div class="card" style="margin-bottom:10px;border-inline-start:5px solid ${p.color}"><div class="head" style="margin:0"><h3 style="margin:0"><span class="gtag" style="background:${p.color}">${p.name}</span> خطة ${esc(p.type)} (${p.count})</h3>
    <label class="switch"><input type="checkbox" data-rd="${p.key}" ${p.done ? 'checked' : ''}> نُفّذت</label></div>
    <p style="margin:8px 0 4px"><b>الهدف:</b> ${esc(p.goal)}</p><p style="margin:4px 0"><b>المهارات:</b> ${esc(p.skills.join('، ') || '-')}</p><p style="margin:4px 0"><b>الطلاب:</b> ${esc(p.students.join('، '))}</p>
    <p style="margin:4px 0"><b>الإجراءات:</b></p><ul style="margin:0">${p.strategies.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="muted" style="margin:6px 0 0;font-size:13px">المدة: ${esc(p.period)} · القياس: ${esc(p.tool)}</p></div>`).join('')}
  ${a.individual.length ? `<h2>خطط الدعم الفردي</h2><div class="card"><table class="etable"><tr><th>الطالب</th><th>نسبته</th><th>مهارات يحتاجها</th><th>نُفذت</th></tr>${a.individual.map((x) => `<tr><td>${esc(x.name)}</td><td style="color:${clr(x.pct)};font-weight:700">${pcs(x.pct)}</td><td>${esc(x.weak.join('، '))}</td><td><input type="checkbox" data-rd="${x.key}" ${x.done ? 'checked' : ''}></td></tr>`).join('')}</table></div>` : ''}
  <h2>نتائج الطلاب</h2><div class="card" style="overflow:auto"><table class="etable"><tr><th>الطالب</th><th>الدرجة</th><th>النسبة</th><th>الفئة</th><th>مهارات تحتاج دعم</th></tr>${a.rows.map((x) => `<tr><td>${esc(nm(x.id))}</td><td>${x.absent ? 'غائب' : x.total == null ? '-' : `${x.total}/${a.max}`}</td><td style="color:${clr(x.pct)};font-weight:700">${pcs(x.pct)}</td><td>${x.group ? `<span class="gtag" style="background:${GRP[x.group][1]}">${GRP[x.group][0]}</span>` : '-'}</td><td style="font-size:12.5px">${esc(x.weak.join('، '))}</td></tr>`).join('')}</table></div>`;
  if ($('#tsel')) $('#tsel').onchange = (e) => { location.hash = `#/rec/${r.id}/analysis?t=${e.target.value}`; };
  el.onchange = async (e) => { const k = e.target.dataset.rd; if (!k) return; const rd = { ...RC.rec.remedial_done }; if (e.target.checked) rd[k] = Date.now(); else delete rd[k]; try { await recSave({ remedial_done: rd }, true); toast(e.target.checked ? 'تم تسجيل التنفيذ ✅' : 'تم التراجع'); } catch (err) { toast(err.message); } };
  el.onclick = (e) => { const k = e.target.dataset.ev; if (k) addEv(k, { test: a.id }, e.target); };
}
async function addEv(kind, extra, btn) {
  if (btn) btn.disabled = true;
  try { await api(`/api/rec/${RC.rec.id}/evidence`, { method: 'POST', body: { kind, ...extra } }); await loadEvs(); toast('انضاف الشاهد لملف إنجازك ✅'); if (btn) btn.textContent = '✅ انضاف لملف الإنجاز'; }
  catch (err) { toast(err.message); if (btn) btn.disabled = false; }
}

// ---- المقارنة ----
function tCompare(el, q) {
  const r = RC.rec; const list = RC.calc.tests.filter((t) => t.n);
  if (list.length < 2) { el.innerHTML = '<div class="card center"><p>ارصد اختبارين (مثل التشخيصي ثم الفترة الأولى)، وتطلع لك المقارنة وقياس أثر الخطة العلاجية.</p></div>'; return; }
  const pre = q.get('pre') || (list.find((t) => t.kind === 'diag') || list[0]).id;
  const post = q.get('post') || [...list].reverse().find((t) => t.id !== pre).id;
  el.innerHTML = '<p class="muted">جاري الحساب...</p>';
  const opt = (sel) => list.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.title)}</option>`).join('');
  // الحساب على الخادم موجود في الطباعة؛ هنا نحسبه بسرعة من نتائج التحليل
  const A = list.find((t) => t.id === pre), B = list.find((t) => t.id === post);
  const rows = r.students.map((s) => { const a = A.rows.find((x) => x.id === s.id), b = B.rows.find((x) => x.id === s.id); return { name: s.name, pre: a.pct, post: b.pct, gain: a.pct != null && b.pct != null ? Math.round((b.pct - a.pct) * 10) / 10 : null }; });
  const both = rows.filter((x) => x.gain != null);
  const gain = A.avg != null && B.avg != null ? Math.round((B.avg - A.avg) * 10) / 10 : null;
  const skills = r.skills.map((s) => { const a = A.skills.find((x) => x.id === s.id), b = B.skills.find((x) => x.id === s.id); return a && b ? { name: s.name, pre: a.pct, post: b.pct } : null; }).filter(Boolean);
  el.innerHTML = `<div class="grid g2" style="max-width:600px"><div class="field"><label>القبلي</label><select id="cpre">${opt(pre)}</select></div><div class="field"><label>البعدي</label><select id="cpost">${opt(post)}</select></div></div>
  ${pre === post ? '<p class="muted">اختر اختبارين مختلفين.</p>' : `<div class="stats"><div class="card stat"><b>${pcs(A.avg)}</b>القبلي</div><div class="card stat"><b>${pcs(B.avg)}</b>البعدي</div><div class="card stat"><b style="color:${gain >= 0 ? '#15803d' : '#b91c1c'}">${sgn(gain)}</b>التحسن</div><div class="card stat"><b>${both.filter((x) => x.gain > 0).length}/${both.length}</b>تحسنوا</div></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><a class="btn sm" target="_blank" href="/rec/${r.id}/print?k=compare&test=${pre}&week=${post}">🖨️ تقرير المقارنة</a><button class="btn ghost sm" id="cev">📁 أضف قياس الأثر لملف إنجازي</button></div>
  ${skills.length ? `<div class="card" style="margin-bottom:12px"><h3 style="margin-top:0">المهارات قبل وبعد</h3>${skills.map((s) => `<div style="margin-bottom:6px"><b style="font-size:13.5px">${esc(s.name)}</b>${hbar('قبل', s.pre, '#94a3b8')}${hbar('بعد', s.post)}</div>`).join('')}</div>` : ''}
  <div class="card" style="overflow:auto"><table class="etable"><tr><th>الطالب</th><th>القبلي</th><th>البعدي</th><th>الفرق</th></tr>${rows.map((x) => `<tr><td>${esc(x.name)}</td><td>${pcs(x.pre)}</td><td>${pcs(x.post)}</td><td style="font-weight:700;color:${x.gain == null ? '' : x.gain >= 0 ? '#15803d' : '#b91c1c'}">${sgn(x.gain)}</td></tr>`).join('')}</table></div>`}`;
  const go = () => { location.hash = `#/rec/${r.id}/compare?pre=${$('#cpre').value}&post=${$('#cpost').value}`; };
  $('#cpre').onchange = go; $('#cpost').onchange = go;
  if ($('#cev')) $('#cev').onclick = (e) => addEv('compare', { pre, post }, e.target);
}

// ---- المتابعة ----
function tFollow(el) {
  const r = RC.rec; const fu = RC.calc.followup;
  el.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><a class="btn sm" target="_blank" href="/rec/${r.id}/print?k=followup">🖨️ سجل متابعة مهارات الطالب</a><a class="btn soft sm" target="_blank" href="/rec/${r.id}/print?k=progress">🖨️ تقرير سير المادة</a></div>
  ${!r.skills.length || !RC.calc.tests.some((t) => t.n) ? '<div class="card center"><p class="muted">السجل يتعبى تلقائياً من نتائج الاختبارات المربوطة بالمهارات.</p></div>' : `<div class="card grid-sc"><table><tr><th>الطالب</th>${r.skills.map((s, i) => `<th title="${esc(s.name)}">${i + 1}</th>`).join('')}</tr>${fu.map((x) => `<tr><td>${esc(x.name)}</td>${x.skills.map((c) => `<td class="center" title="${c ? esc(c.test) + ': ' + c.v + '%' : ''}" style="color:${c ? (c.v >= 70 ? '#15803d' : c.v >= 50 ? '#b45309' : '#b91c1c') : ''};font-weight:700">${c ? (c.v >= 70 ? '✔' : c.v >= 50 ? '◐' : '✖') : ''}</td>`).join('')}</tr>`).join('')}</table></div>
  <div class="card" style="margin-top:10px"><b>المهارات:</b><ol style="margin:6px 0 0">${r.skills.map((s) => `<li>${esc(s.name)}</li>`).join('')}</ol><p class="muted" style="font-size:12.5px">✔ متقن (70% فأكثر) · ◐ قريب (50-69) · ✖ غير متقن. آخر نتيجة مرصودة لكل مهارة.</p></div>`}`;
}

// ---- أولياء الأمور ----
function tParents(el) {
  const r = RC.rec; const list = RC.calc.tests.filter((t) => t.n); const last = list[list.length - 1];
  const cmp = RC.calc.compare;
  const sugg = (s) => { if (!last) return null; const row = last.rows.find((x) => x.id === s.id); if (row.absent) return 'absent'; const c = cmp && cmp.rows.find((x) => x.id === s.id); if (c && c.gain >= 10) return 'improved'; if (row.group === 'support') return 'weak'; if (row.pct >= 90) return 'excellent'; return null; };
  const KM = { weak: ['⚠️ ضعف', 'btn danger'], excellent: ['🌟 تميز', 'btn'], improved: ['📈 تحسن', 'btn soft'], absent: ['🚫 غياب', 'btn ghost'] };
  const sent = (sid) => r.messages.filter((m) => m.student === sid).length;
  el.innerHTML = `<div class="card" style="margin-bottom:10px"><p style="margin:0">رسائل جاهزة باسم الطالب ونتيجته، تنفتح في واتساب. ${last ? `الاقتراح مبني على ${esc(last.title)}.` : 'ارصد اختبار عشان تطلع الاقتراحات.'} ${r.students.some((s) => s.phone) ? '' : 'أضف جوال ولي الأمر من «البيانات» عشان تنفتح المحادثة مباشرة.'}</p>
    ${r.messages.length ? `<p class="muted" style="margin:6px 0 0">أرسلت ${r.messages.length} رسالة. <button class="btn ghost sm" id="pev">📁 أضف التواصل لملف إنجازي</button></p>` : ''}</div>
  <div class="card" style="overflow:auto"><table class="etable"><tr><th>الطالب</th><th>المقترح</th><th>أرسل</th></tr>${r.students.map((s) => { const sg = sugg(s); return `<tr><td>${esc(s.name)}${sent(s.id) ? ` <span class="pill">${sent(s.id)} ✓</span>` : ''}</td><td>${sg ? `<span class="gtag" style="background:${sg === 'weak' ? '#b91c1c' : sg === 'absent' ? '#64748b' : '#15803d'}">${KM[sg][0]}</span>` : ''}</td>
    <td style="white-space:nowrap">${Object.entries(KM).map(([k, [t]]) => `<button class="btn ${k === sg ? '' : 'ghost'} sm" data-m="${s.id}:${k}" title="${t}">${t.split(' ')[0]}</button>`).join(' ')}</td></tr>`; }).join('')}</table></div>`;
  el.onclick = async (e) => {
    if (e.target.id === 'pev') return addEv('parents', {}, e.target);
    const m = e.target.dataset.m; if (!m) return;
    const [student, kind] = m.split(':');
    const w = window.open('', '_blank');
    try { const d = await api(`/api/rec/${r.id}/message`, { method: 'POST', body: { student, kind, test: last && last.id, log: true } }); RC.rec.messages.push({ student, kind, at: Date.now() }); if (w) w.location = d.wa; else location.href = d.wa; tParents(el); }
    catch (err) { if (w) w.close(); toast(err.message); }
  };
}

// ---- التصدير والشواهد ----
function tExport(el) {
  const r = RC.rec; const list = RC.calc.tests.filter((t) => t.n); const last = list[list.length - 1];
  const P = (k, t, extra = '') => `<a class="btn soft sm" target="_blank" href="/rec/${r.id}/print?k=${k}${extra}">${t}</a>`;
  el.innerHTML = `<div class="card" style="margin-bottom:12px"><h3 style="margin-top:0">🖨️ السجل كامل</h3><p class="muted" style="margin-top:0">غلاف وفهرس، والطلاب والجدول، والخطة الفصلية، وكل الخطط الأسبوعية، وكل اختبار بورقته ومفتاحه وتحليله وخططه العلاجية، والمقارنة، وسجل المتابعة، وتقرير سير المادة. كله بترويسة الوزارة وجاهز لزيارة المشرف.</p>
    <a class="btn" target="_blank" href="/rec/${r.id}/print">🖨️ افتح السجل كامل (PDF)</a></div>
  <div class="card" style="margin-bottom:12px"><h3 style="margin-top:0">أجزاء منفصلة</h3><div style="display:flex;gap:6px;flex-wrap:wrap">${P('students', 'الطلاب والجدول')}${P('term', 'الخطة الفصلية')}${P('week', 'خطة هذا الأسبوع', `&week=${RC.calc.plan.current}`)}${P('weeks', 'كل الخطط الأسبوعية')}${last ? P('analysis', 'آخر تحليل', `&test=${last.id}`) + P('remedial', 'آخر خطط علاجية', `&test=${last.id}`) : ''}${P('followup', 'سجل المتابعة')}${P('progress', 'سير المادة')}</div></div>
  <div class="card"><h3 style="margin-top:0">📁 شواهد ملف الإنجاز بضغطة</h3><p class="muted" style="margin-top:0">كل شاهد ينكتب تلقائياً ويتصنف على عنصره، ومعه رابط للتقرير يعرض الطلاب بأرقام بدون أسماء.</p>
    <table class="etable"><tr><th>الشاهد</th><th>العنصر</th><th></th></tr>
    ${[['plan', 'الخطة الفصلية والأسبوعية', 'إعداد وتنفيذ خطة التعلم', r.lessons.length], ['tests', 'تنويع أدوات التقويم', 'تنوع أساليب التقويم', r.tests.length], ['analysis', `تحليل ${last ? esc(last.title) : 'الاختبار'}`, 'تحليل نتائج المتعلمين وتشخيص مستوياتهم', !!last], ['remedial', 'الخطط العلاجية والإثرائية', 'تحسين نتائج المتعلمين', !!last], ['compare', 'قياس أثر الخطة (قبلي وبعدي)', 'تحسين نتائج المتعلمين', list.length >= 2], ['parents', 'التواصل مع أولياء الأمور', 'التفاعل مع أولياء الأمور', r.messages.length]]
      .map(([k, t, s, ok]) => `<tr><td>${t}</td><td class="muted" style="font-size:13px">${s}</td><td>${ok ? `<button class="btn sm" data-ev="${k}">أضف</button>` : '<span class="muted" style="font-size:12px">يحتاج بيانات</span>'}</td></tr>`).join('')}</table></div>`;
  el.onclick = (e) => { const k = e.target.dataset.ev; if (!k) return; const ex = k === 'analysis' || k === 'remedial' ? { test: last.id } : {}; addEv(k, ex, e.target); };
}
window.recView = recView;
