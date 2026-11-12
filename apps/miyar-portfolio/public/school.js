/* خطط معيار - واجهة المدرسة */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const S = { data: null, draft: null };
const LEVELS = [
  { key: 'tamayuz', name: 'التميز', min: 90, color: '#0b8f55' },
  { key: 'taqaddum', name: 'التقدم', min: 75, color: '#1a6fe0' },
  { key: 'intilaq', name: 'الانطلاق', min: 50, color: '#d9690a' },
  { key: 'tahyia', name: 'التهيئة', min: 0, color: '#d33a2c' },
];
const levelOf = (p) => LEVELS.find((l) => Number(p) >= l.min);
const chip = (p) => { if (p === '' || p == null || isNaN(p)) return '<span class="muted">-</span>'; const l = levelOf(p); return `<span class="lv" style="background:${l.color}">${l.name}</span>`; };
const fmt = (n) => (n == null ? '-' : `${Math.round(n * 100) / 100}%`);
const DOMAINS = { 1: 'الإدارة المدرسية', 2: 'التعليم والتعلم', 3: 'نواتج التعلم', 4: 'البيئة المدرسية' };
const STANDARDS = { '1-1': 'التخطيط', '1-2': 'قيادة العملية التعليمية', '1-3': 'المجتمع المدرسي', '1-4': 'التطوير المؤسسي', '1-5': 'حقوق المتعلم وحمايته', '2-1': 'بناء خبرات التعلم', '2-2': 'تقويم التعلم', '3-1': 'التحصيل التعليمي', '3-2': 'التطور الشخصي والصحي والاجتماعي', '4-1': 'المبنى المدرسي', '4-2': 'الأمن والسلامة' };

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2800); }
async function api(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: {} };
  if (opts.body instanceof FormData) o.body = opts.body;
  else if (opts.body) { o.body = JSON.stringify(opts.body); o.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(path, o);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) { sessionStorage.setItem('miyar-next', '/school' + location.hash); location.href = '/app#/login'; }
    const err = new Error(data.error || 'حدث خطأ، حاول مرة ثانية'); err.status = r.status; err.code = data.code; throw err;
  }
  return data;
}
const load = async () => { S.data = await api('/api/school'); };
const busy = (btn, on, label) => { btn.disabled = on; if (on) { btn._t = btn.innerHTML; btn.innerHTML = `<span class="spin"></span> ${label || 'لحظات...'}`; } else if (btn._t) btn.innerHTML = btn._t; };
function toggleDark() {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('miyar-theme', r.dataset.theme); } catch {}
}

function topbar(route) {
  const l = (h, ic, t) => `<a href="#/${h}" class="${route === h ? 'on' : ''}">${ic} <span class="lbl">${t}</span></a>`;
  $('#top').innerHTML = `<div class="topbar"><div class="wrap"><a class="logo" href="#/"><b>خ</b><span class="lbl">خطط معيار</span></a>
  <nav class="nav">${l('', '🏠', 'الرئيسية')}${l('profile', '🏫', 'المدرسة')}${l('report', '📊', 'التقرير')}${l('plan', '📋', 'الخطة')}${l('license', '⭐', 'الباقة')}<button onclick="toggleDark()" title="الوضع الليلي">🌙</button></nav></div></div>`;
}
const lic = () => S.data.school.license;

function banner() {
  if (lic().active) return '';
  return `<div class="banner trial"><span>أنت في وضع التجربة: تقدر تحلل تقريرك وتشوف أول ${S.data.usage.trialRows} مؤشرات من خطتك مجاناً.</span><a class="btn sm" href="#/license">فعّل باقة المدرسة</a></div>`;
}

// ---------- الرئيسية ----------
function home() {
  const { school, report, plan } = S.data;
  const s1 = !!(school.name && school.ministry_number), s2 = !!(report && report.complete), s3 = !!plan;
  const step = (n, done, href, t, d) => `<a class="card step ${done ? 'done' : ''}" href="#/${href}"><span class="n">${done ? '✓' : n}</span><h3>${t}</h3><p class="muted" style="margin:0">${d}</p></a>`;
  const dist = report ? LEVELS.map((l) => `<span class="lv" style="background:${l.color}">${l.name}: ${report.indicators.filter((i) => i.pct != null && levelOf(i.pct).key === l.key).length}</span>`).join('') : '';
  view.innerHTML = `${banner()}
  <div class="head"><div><h1 style="margin:0">${esc(school.name || 'مرحباً بك في خطط معيار')}</h1><p class="muted" style="margin:0">ارفع تقرير التقويم المدرسي، ونطلع لك خطة التحسين جاهزة للطباعة وWord.</p></div></div>
  <div class="steps">
    ${step(1, s1, 'profile', 'بيانات المدرسة', 'الاسم والرقم الوزاري والشعار واسم القائد')}
    ${step(2, s2, 'report', 'تقرير التقويم', 'ارفع ملف التقرير أو أدخل النسب، وراجعها')}
    ${step(3, s3, 'plan', 'خطة التحسين', 'تتولد تلقائياً للمؤشرات اللي تحت التميز')}
    ${step(4, s3 && lic().active, 'plan', 'الطباعة وWord', 'PDF جاهز للطباعة وملف Word تعدّل عليه')}
  </div>
  ${report ? `<div class="card"><h2 style="font-size:18px">ملخص التقرير</h2>
    <div class="stats"><div class="card stat">الأداء العام<b>${fmt(report.overall)}</b></div><div class="card stat">المؤشرات<b>${report.indicators.length}</b></div><div class="card stat">تحت التميز<b>${report.indicators.filter((i) => i.pct != null && i.pct < 90).length}</b></div></div>
    <div class="dist">${dist}</div></div>` : ''}`;
}

// ---------- ملف المدرسة ----------
function profile() {
  const s = S.data.school;
  view.innerHTML = `<div class="card" style="max-width:720px;margin:auto">
  <h2>بيانات المدرسة</h2><p class="muted">تظهر في رأس الخطة. الرقم الوزاري يرتبط بترخيص الباقة.</p>
  <form id="f">
    <div class="grid g2">
      <div class="field"><label>اسم المدرسة</label><input name="name" value="${esc(s.name)}" required></div>
      <div class="field"><label>الرقم الوزاري</label><input name="ministry_number" value="${esc(s.ministry_number || '')}" placeholder="S-12345" dir="ltr" ${s.license.active && s.ministry_number ? 'readonly' : ''}></div>
      <div class="field"><label>المرحلة</label><select name="stage"><option value="basic" ${s.stage !== 'secondary' ? 'selected' : ''}>ابتدائي / متوسط</option><option value="secondary" ${s.stage === 'secondary' ? 'selected' : ''}>ثانوي</option></select></div>
      <div class="field"><label>بنين / بنات</label><select name="gender"><option ${s.gender === 'بنين' ? 'selected' : ''}>بنين</option><option ${s.gender === 'بنات' ? 'selected' : ''}>بنات</option></select></div>
      <div class="field"><label>إدارة التعليم</label><input name="office" value="${esc(s.office)}"></div>
      <div class="field"><label>اسم قائد/ة المدرسة</label><input name="principal" value="${esc(s.principal)}"></div>
      <div class="field"><label>العام الدراسي</label><input name="year" value="${esc(s.year)}"></div>
    </div>
    <button class="btn">حفظ</button>
  </form>
  <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
  <h3>شعار المدرسة</h3><p class="muted" style="margin-top:0">شعار مدرستك فقط (PNG أو JPG). لا نضع شعارات رسمية للوزارة أو الهيئة.</p>
  <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${s.logo_url ? `<img src="${s.logo_url}" alt="" style="width:80px;height:80px;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff">` : ''}
  <label class="btn ghost" style="margin:0">رفع الشعار<input type="file" id="logo" accept="image/png,image/jpeg" hidden></label></div></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    try { const r = await api('/api/school', { method: 'PUT', body: b }); S.data.school = r.school; toast('تم الحفظ'); location.hash = '#/'; } catch (err) { toast(err.message); }
  };
  $('#logo').onchange = async (e) => {
    const fd = new FormData(); fd.append('logo', e.target.files[0]);
    try { const r = await api('/api/school/logo', { method: 'POST', body: fd }); S.data.school = r.school; toast('تم رفع الشعار'); profile(); } catch (err) { toast(err.message); }
  };
}

// ---------- التقرير: رفع + مراجعة ----------
function emptyDraft(stage) {
  return { stage, cycle: '', school_name: S.data.school.name, ministry_number: S.data.school.ministry_number || '', office: S.data.school.office, gender: S.data.school.gender, authority: '', students: '', overall: '', indicators: S.data.catalog[stage].map((c) => ({ code: c.code, text: c.text, pct: null })) };
}
function report() {
  const r = S.data.report;
  if (!S.draft) S.draft = r ? JSON.parse(JSON.stringify(r)) : null;
  if (!S.draft) {
    view.innerHTML = `${banner()}<div class="card" style="max-width:760px;margin:auto">
      <h2>تقرير التقويم المدرسي</h2>
      <p class="muted">التقرير اللي تحمّله من منصة تميز (تقرير التقويم المدرسي الذاتي). نقرأ منه نسبة كل مؤشر، وأنت تراجعها قبل بناء الخطة.</p>
      ${S.data.reader ? `<label class="drop" style="display:block;margin-bottom:14px">📄 اسحب ملف التقرير PDF هنا أو اضغط للاختيار<input type="file" id="pdf" accept="application/pdf" hidden></label>
        <p class="muted" style="font-size:13px">ملف التقرير يُقرأ ولا يُحفظ عندنا. نحفظ النسب فقط.</p>` : `<p class="banner trial" style="font-weight:500">القراءة التلقائية للملف غير مفعّلة حالياً. أدخل النسب من التقرير يدوياً، تاخذ تقريباً 5 دقائق.</p>`}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="man" data-s="basic">إدخال يدوي (ابتدائي / متوسط، 46 مؤشر)</button><button class="btn ghost" id="man2" data-s="secondary">إدخال يدوي (ثانوي، 45 مؤشر)</button></div>
    </div>`;
    const manual = (e) => { S.draft = emptyDraft(e.target.dataset.s); report(); };
    $('#man').onclick = manual; $('#man2').onclick = manual;
    const pdf = $('#pdf');
    if (pdf) pdf.onchange = async (e) => {
      const lbl = pdf.parentElement; lbl.innerHTML = '<span class="spin"></span> نقرأ التقرير... (قرابة دقيقة)';
      const fd = new FormData(); fd.append('report', e.target.files[0]);
      try { const res = await api('/api/school/report/pdf', { method: 'POST', body: fd }); S.draft = { ...res.report, source: 'ai' }; toast('تمت القراءة، راجع النسب'); report(); }
      catch (err) { toast(err.message); report(); }
    };
    return;
  }
  const d = S.draft;
  let html = '', dom = '', std = '';
  d.indicators.forEach((i, k) => {
    const dm = i.code.split('-')[0], st = i.code.split('-').slice(0, 2).join('-');
    if (dm !== dom) { dom = dm; html += `<h2 class="dom-h">${DOMAINS[dm]}</h2>`; }
    if (st !== std) { std = st; html += `<h3 class="std-h">${STANDARDS[st]}</h3>`; }
    html += `<div class="ind ${i.pct == null ? 'miss' : ''}"><code><bdi dir="ltr">${esc(i.code)}</bdi></code><span>${esc(i.text)}</span><input type="number" step="0.0001" min="0" max="100" inputmode="decimal" data-k="${k}" value="${i.pct ?? ''}" aria-label="نسبة ${esc(i.code)}"><span class="lvc" id="lv${k}">${chip(i.pct)}</span></div>`;
  });
  const miss = d.indicators.filter((i) => i.pct == null).length;
  view.innerHTML = `${banner()}<div class="card">
    <div class="head"><div><h2 style="margin:0">مراجعة نسب التقرير</h2><p class="muted" style="margin:0">${d.source === 'ai' ? 'قرأناها من ملفك، طابقها مع التقرير قبل الحفظ.' : 'انسخ نسبة كل مؤشر من التقرير كما هي.'} <b id="miss">${miss ? `باقي ${miss} مؤشر بدون نسبة` : 'كل المؤشرات مكتملة ✓'}</b></p></div>
    <div style="display:flex;gap:8px"><button class="btn ghost sm" id="reset">ملف آخر</button></div></div>
    ${(d.warnings || []).length ? `<div class="banner expired" style="font-weight:500">${d.warnings.map(esc).join('<br>')}</div>` : ''}
    <div class="hdr-grid">
      <div class="field"><label>اسم المدرسة</label><input id="h_school_name" value="${esc(d.school_name)}"></div>
      <div class="field"><label>الرقم الوزاري</label><input id="h_ministry_number" value="${esc(d.ministry_number)}" dir="ltr"></div>
      <div class="field"><label>دورة التقويم</label><input id="h_cycle" value="${esc(d.cycle)}" placeholder="دورة التقويم الثانية - 2026"></div>
      <div class="field"><label>الأداء العام %</label><input id="h_overall" type="number" step="0.01" value="${d.overall ?? ''}"></div>
      <div class="field"><label>عدد الطلبة</label><input id="h_students" type="number" value="${d.students ?? ''}"></div>
      <div class="field"><label>المرحلة</label><input value="${d.stage === 'secondary' ? 'ثانوي (45 مؤشر)' : 'ابتدائي / متوسط (46 مؤشر)'}" readonly></div>
    </div>
    ${html}
    <div style="position:sticky;bottom:0;background:var(--card);padding:12px 0;margin-top:10px;border-top:1px solid var(--line)"><button class="btn" id="save">حفظ التقرير والانتقال للخطة</button></div>
  </div>`;
  view.querySelectorAll('.ind input').forEach((inp) => inp.oninput = () => {
    const k = Number(inp.dataset.k); const v = inp.value === '' ? null : Number(inp.value);
    d.indicators[k].pct = v != null && v >= 0 && v <= 100 ? v : null;
    $(`#lv${k}`).innerHTML = chip(d.indicators[k].pct);
    inp.parentElement.classList.toggle('miss', d.indicators[k].pct == null);
    const m = d.indicators.filter((i) => i.pct == null).length;
    $('#miss').textContent = m ? `باقي ${m} مؤشر بدون نسبة` : 'كل المؤشرات مكتملة ✓';
  });
  $('#reset').onclick = () => { S.draft = null; S.data.report = null; report(); };
  $('#save').onclick = async (e) => {
    for (const f of ['school_name', 'ministry_number', 'cycle', 'overall', 'students']) d[f] = $(`#h_${f}`).value;
    busy(e.target, true, 'نحفظ...');
    try { const r = await api('/api/school/report', { method: 'PUT', body: d }); S.data.report = r.report; S.data.school = r.school; S.draft = null; toast('تم حفظ التقرير'); location.hash = '#/plan'; }
    catch (err) { toast(err.message); busy(e.target, false); }
  };
}

// ---------- الخطة ----------
function rowCard(r, i, editable) {
  return `<div class="card row-card" id="row${i}">
    <div class="top"><div><code><bdi dir="ltr">${esc(r.code)}</bdi></code> <span class="muted" style="font-size:13px">${esc(r.domain)} / ${esc(r.standard)}</span><h3>${esc(r.indicator)}</h3></div>
    <div style="text-align:left"><div class="pct">${fmt(r.pct)}</div>${chip(r.pct)} <span class="pill">أولوية ${esc(r.priority)}</span></div></div>
    <p class="need">${esc(r.need)}</p>
    <dl>
      <dt>الهدف</dt><dd>${esc(r.goal)}</dd>
      <dt>الإجراءات</dt><dd><ol>${r.procedures.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></dd>
      <dt>المسؤول</dt><dd>${esc(r.responsible)}</dd>
      <dt>الزمن</dt><dd>${esc(r.from)} إلى ${esc(r.to)}</dd>
      <dt>مؤشر التحقق</dt><dd>${esc(r.measure)}</dd>
      <dt>الشواهد</dt><dd><ul>${r.evidence.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></dd>
    </dl>
    ${editable ? `<button class="btn ghost sm" style="margin-top:10px" onclick="editRow(${i})">✏️ تعديل</button>` : ''}
  </div>`;
}
function plan() {
  const { report, plan: p, usage } = S.data;
  if (!report || !report.complete) { view.innerHTML = `${banner()}<div class="card" style="text-align:center"><h2>ارفع تقرير التقويم أولاً</h2><p class="muted">الخطة تنبني على نسب المؤشرات.</p><a class="btn" href="#/report">التقرير</a></div>`; return; }
  const full = lic().active && lic().grants.includes('improvement');
  const stale = p && p.trial && full;
  view.innerHTML = `${banner()}
  <div class="head"><div><h1 style="margin:0">خطة التحسين</h1><p class="muted" style="margin:0">${p ? `${p.total} مؤشر تحت مستوى التميز، مرتبة من الأضعف.` : 'جاهز نبنيها من تقريرك.'}</p></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    ${p ? `<a class="btn ghost" href="/school/print/plan" target="_blank">🖨️ PDF للطباعة</a>${full && !p.trial ? '<a class="btn ghost" href="/school/export/plan.docx">📝 Word</a>' : ''}` : ''}
    <button class="btn" id="gen">${p ? (stale ? 'ابنِ الخطة كاملة' : 'إعادة بناء الخطة') : 'ابنِ الخطة'}</button></div></div>
  ${full ? `<p class="muted" style="font-size:13px">المستخدم هذا العام: ${usage.plans} من ${usage.planLimit} عملية بناء.</p>` : ''}
  <div id="rows">${p ? p.rows.map((r, i) => rowCard(r, i, full && !p.trial)).join('') : ''}</div>
  ${p && p.limited ? `<div class="card" style="text-align:center;border-style:dashed"><h3>باقي ${p.total - p.rows.length} مؤشر في خطتك</h3><p class="muted">فعّل باقة المدرسة وتطلع لك الخطة كاملة بملف Word قابل للتعديل وPDF بدون علامة مائية.</p><a class="btn" href="#/license">فعّل الباقة</a></div>` : ''}`;
  $('#gen').onclick = async (e) => {
    busy(e.target, true, 'نبني الخطة...');
    try { const r = await api('/api/school/plan', { method: 'POST' }); S.data.plan = r.plan; await load(); toast('تم بناء الخطة'); plan(); }
    catch (err) { toast(err.message); busy(e.target, false); if (err.code === 'license') location.hash = '#/license'; }
  };
}
window.editRow = (i) => {
  const r = S.data.plan.rows[i];
  const box = $(`#row${i}`);
  box.innerHTML = `<h3><code><bdi dir="ltr">${esc(r.code)}</bdi></code> ${esc(r.indicator)}</h3>
  <form id="ef${i}">
    <div class="field"><label>الهدف</label><textarea name="goal" style="min-height:60px">${esc(r.goal)}</textarea></div>
    <div class="field"><label>الإجراءات (كل إجراء في سطر)</label><textarea name="procedures">${esc(r.procedures.join('\n'))}</textarea></div>
    <div class="grid g2"><div class="field"><label>المسؤول</label><input name="responsible" value="${esc(r.responsible)}"></div>
    <div class="field"><label>من</label><input name="from" value="${esc(r.from)}"></div>
    <div class="field"><label>إلى</label><input name="to" value="${esc(r.to)}"></div></div>
    <div class="field"><label>مؤشر التحقق</label><textarea name="measure" style="min-height:60px">${esc(r.measure)}</textarea></div>
    <div class="field"><label>الشواهد (كل شاهد في سطر)</label><textarea name="evidence">${esc(r.evidence.join('\n'))}</textarea></div>
    <button class="btn">حفظ</button> <button type="button" class="btn ghost" onclick="plan()">إلغاء</button>
  </form>`;
  $(`#ef${i}`).onsubmit = async (e) => {
    e.preventDefault();
    try { const res = await api(`/api/school/plan/rows/${i}`, { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); S.data.plan = res.plan; toast('تم الحفظ'); box.outerHTML = rowCard(res.plan.rows[i], i, true); }
    catch (err) { toast(err.message); }
  };
};

// ---------- الباقة ----------
function license() {
  const L = lic();
  const pk = S.data.packages.map((p) => `<div class="card pkg ${p.best ? 'best' : ''}">
    ${p.best ? '<span class="pill">الأوفر</span>' : ''}<h3 style="margin:0">${esc(p.name)}</h3><div class="price">${p.price} <small style="font-size:14px">ريال / سنة</small></div>
    <p class="muted" style="margin:0">${p.id === 'school_improve' ? 'خطة التحسين كاملة من تقرير التقويم، Word وPDF، وتعديل وإعادة بناء طوال السنة.' : p.id === 'school_nafis' ? 'خطة علاجية لنافس من بطاقة الأداء ونواتج التعلم.' : p.id === 'school_bundle' ? 'خطة التحسين + خطة نافس + الخطة التشغيلية لمدرسة واحدة.' : 'نجهز لك الخطط ونراجعها معك، وتستلمها جاهزة.'}</p>
    ${p.soon ? '<span class="muted" style="font-size:13px">قريباً</span>' : ''}</div>`).join('');
  view.innerHTML = `<div class="card" style="margin-bottom:16px">
    <h2>باقة المدرسة</h2>
    ${L.active ? `<p>✅ الباقة مفعّلة للرقم الوزاري <b dir="ltr">${esc(S.data.school.ministry_number)}</b>، باقي ${L.daysLeft} يوم.</p>` : '<p class="muted">الترخيص سنوي لمدرسة واحدة ويرتبط برقمها الوزاري. اشترِ الكود من المتجر وفعّله هنا.</p>'}
    <form id="rf" style="display:flex;gap:8px;flex-wrap:wrap;max-width:520px"><input name="code" placeholder="SCH-XXXX-XXXX" dir="ltr" required style="flex:1;min-width:200px"><button class="btn">تفعيل</button></form>
    ${!S.data.school.ministry_number ? '<p class="muted" style="font-size:13px">أدخل الرقم الوزاري في <a href="#/profile">بيانات المدرسة</a> قبل التفعيل.</p>' : ''}
    <p style="margin-bottom:0"><a class="btn ghost" href="${esc(S.data.store)}" target="_blank" rel="noopener">اشترِ من متجر معيار</a></p>
  </div>
  <div class="grid g2">${pk}</div>`;
  $('#rf').onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api('/api/school/redeem', { method: 'POST', body: { code: e.target.code.value } }); S.data.school = r.school; toast(`تم تفعيل ${r.package.name}`); location.hash = '#/plan'; }
    catch (err) { toast(err.message); }
  };
}

async function route() {
  const p = (location.hash.slice(2) || '').split('?')[0];
  if (!S.data) { try { await load(); } catch { return; } }
  topbar(p);
  window.scrollTo(0, 0);
  ({ '': home, profile, report, plan, license }[p] || home)();
}
window.addEventListener('hashchange', route);
route();
