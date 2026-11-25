/* معياري للمدرسة - واجهة المدرسة */
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
    if (r.status === 401) { sessionStorage.setItem('miyar-next', '/school' + location.hash); location.href = location.hash.length > 2 ? '/app#/register' : '/app#/login'; }
    const err = new Error(data.error || 'حدث خطأ، حاول مرة ثانية'); err.status = r.status; err.code = data.code; throw err;
  }
  return data;
}
const procs = (r) => (r.procedures || []).map((p) => (typeof p === 'string' ? { text: p, when: '', done: false } : p));
const progress = (rows) => { const a = rows.flatMap(procs); const d = a.filter((p) => p.done).length; return { d, t: a.length, pct: a.length ? Math.round((d / a.length) * 100) : 0 }; };
const DRAFT_KEY = 'miyar-school-draft';
const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(S.draft)); } catch {} };
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };
async function runSample(stage) {
  const { report: r } = await api(`/api/school/sample/${stage}`);
  const saved = await api('/api/school/report', { method: 'PUT', body: { ...r, sample: true } });
  S.data.report = saved.report;
  const res = await api('/api/school/plan', { method: 'POST' });
  S.data.plan = res.plan; S.draft = null;
  location.hash = '#/plan';
}
window.trySample = async (stage, btn) => { if (btn) busy(btn, true, 'نجهز النموذج...'); try { await runSample(stage); } catch (e) { toast(e.message); if (btn) busy(btn, false); } };
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
  $('#top').innerHTML = `<div class="topbar"><div class="wrap"><a class="logo" href="#/">${MI.wordmark(30)}<span class="lbl sfx">للمدرسة</span></a>
  <nav class="nav">${l('', '🏠', 'الرئيسية')}${l('profile', '🏫', 'المدرسة')}${l('report', '📊', 'التقرير')}${l('plan', '📋', 'خطة التحسين')}${l('ops', '🗓️', 'التشغيلية')}${l('nafis', '🎯', 'نافس')}${l('evidence', '🗂️', 'الشواهد')}${l('board', '📺', 'لوحة المدرسة')}${l('team', '👥', 'الفريق')}${l('license', '⭐', 'الباقة')}<button onclick="toggleDark()" title="الوضع الليلي">🌙 <span class="lbl">ليلي</span></button></nav></div></div>`;
  document.querySelector('.nav a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
const lic = () => S.data.school.license;

function banner() {
  if (lic().active) return '';
  return `<div class="banner trial"><span>أنت في وضع التجربة: تقدر تحلل تقريرك وتشوف أول ${S.data.usage.trialRows} مؤشرات من خطتك مجاناً.</span><a class="btn sm" href="#/license">فعّل باقة المدرسة</a></div>`;
}

// ---------- الرئيسية ----------
function home() {
  const { school, report, plan } = S.data;
  const s1 = !!(school.name && school.ministry_number), s2 = !!(report && report.complete && !report.sample), s3 = !!plan;
  const step = (n, done, href, t, d) => `<a class="card step ${done ? 'done' : ''}" href="#/${href}"><span class="n">${done ? '✓' : n}</span><h3>${t}</h3><p class="muted" style="margin:0">${d}</p></a>`;
  const dist = report ? LEVELS.map((l) => `<span class="lv" style="background:${l.color}">${l.name}: ${report.indicators.filter((i) => i.pct != null && levelOf(i.pct).key === l.key).length}</span>`).join('') : '';
  view.innerHTML = `${banner()}
  <div class="head"><div><h1 style="margin:0">${esc(school.name || 'مرحباً بك في معياري للمدرسة')}</h1><p class="muted" style="margin:0">ارفع تقرير التقويم المدرسي، ونطلع لك خطة التحسين جاهزة للطباعة وWord.</p></div></div>
  <div class="steps">
    ${step(1, s1, 'profile', 'بيانات المدرسة', 'الاسم والرقم الوزاري والشعار واسم القائد')}
    ${step(2, s2, 'report', 'تقرير التقويم', 'ارفع ملف التقرير أو أدخل النسب، وراجعها')}
    ${step(3, s3, 'plan', 'خطة التحسين', 'تتولد تلقائياً للمؤشرات اللي تحت التميز')}
    ${step(4, s3 && lic().active, 'plan', 'الطباعة وWord', 'PDF جاهز للطباعة وملف Word تعدّل عليه')}
  </div>
  ${!report ? `<div class="card" style="text-align:center;border-style:dashed"><h2 style="font-size:18px;margin-bottom:4px">تبغى تشوف النتيجة قبل ما تدخل بياناتك؟</h2><p class="muted" style="margin-top:0">جرّب الأداة على تقرير مدرسة حقيقية (مخفية البيانات) وشوف الخطة كاملة في ثواني.</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn soft" onclick="trySample('basic', this)">نموذج متوسطة</button><button class="btn soft" onclick="trySample('secondary', this)">نموذج ثانوية</button></div></div>` : ''}
  ${plan && !plan.trial ? (() => { const g = progress(plan.rows); return `<a class="card" href="#/plan" style="display:block;text-decoration:none;color:inherit;margin-bottom:14px"><div style="display:flex;justify-content:space-between"><b>متابعة تنفيذ الخطة</b><b style="color:var(--brand-text)">${g.pct}%</b></div><div class="bar" style="margin-top:8px"><i style="width:${g.pct}%"></i></div><p class="muted" style="margin:6px 0 0;font-size:13px">${g.d} من ${g.t} إجراء منجز. أشّر على الإجراء أول ما يتنفذ، ويطلع لك تقرير متابعة جاهز.</p></a>`; })() : ''}
  ${report && report.complete ? `<div class="grid g2" style="margin-bottom:14px"><a class="card" href="#/ops" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;margin:0"><span style="font-size:28px">🗓️</span><div><b>الخطة التشغيلية</b><p class="muted" style="margin:0;font-size:14px">${S.data.ops ? `${S.data.ops.programs.length} برنامج علاجي ووقائي وتطويري، مع تحليل SWOT وأهداف المجالات` : 'تنبني تلقائياً من تقريرك وخطة التحسين ونافس'}</p></div></a>
  <a class="card" href="/school/print/deck" target="_blank" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;margin:0"><span style="font-size:28px">🎞️</span><div><b>عرض المدرسة بضغطة</b><p class="muted" style="margin:0;font-size:14px">شرائح جاهزة لاجتماع المعلمين: الأداء والأولويات والخطة ونافس والشواهد، وتطبعها PDF</p></div></a></div>` : ''}
  <a class="card" href="#/nafis" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;margin-bottom:14px"><span style="font-size:28px">🎯</span><div><b>الخطة العلاجية لنافس</b><p class="muted" style="margin:0;font-size:14px">${S.data.nafis && S.data.nafis.plan ? `خطتك جاهزة: ${S.data.nafis.plan.total} مجال في الخطة` : 'أدخل أرقام بطاقة نافس، وتطلع لك خطة علاجية لكل مادة ومجال'}</p></div></a>
  <a class="card" href="#/evidence" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;margin-bottom:14px"><span style="font-size:28px">🗂️</span><div><b>ملف شواهد التقويم</b><p class="muted" style="margin:0;font-size:14px">رتّب شواهد مدرستك تحت كل مؤشر، واعرف النواقص قبل زيارة التقويم، وسلّم المقيّم الملف كامل بباركود واحد.</p></div></a>
  ${report ? `<div class="card"><h2 style="font-size:18px">ملخص التقرير ${report.sample ? '<span class="pill">نموذج</span>' : ''}</h2>
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
      <div class="field"><label>نوع المبنى</label><select name="building"><option value="">-</option>${['حكومي','مستأجر'].map((v) => `<option ${s.building === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>الفترة</label><select name="period"><option value="">-</option>${['صباحي','مسائي'].map((v) => `<option ${s.period === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <p class="muted" style="font-size:13px">نوع المبنى والفترة تظهر في البيانات الأساسية لاستمارتي بناء الخطة ومتابعة تنفيذها.</p>
    <button class="btn">حفظ</button>
  </form>
  <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
  <h3>الشعارات في الملفات</h3>
  <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" id="mlogo" ${s.ministry_logo !== 0 ? 'checked' : ''} style="width:18px;height:18px"> أضف شعار وزارة التعليم في رأس ملفات PDF وWord</label>
  <p class="muted" style="margin-top:0">وشعار مدرستك (PNG أو JPG) يطلع جنبه.</p>
  <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${s.logo_url ? `<img src="${s.logo_url}" alt="" style="width:80px;height:80px;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff">` : ''}
  <label class="btn ghost" style="margin:0">رفع الشعار<input type="file" id="logo" accept="image/png,image/jpeg" hidden></label></div></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    try { const r = await api('/api/school', { method: 'PUT', body: b }); S.data.school = r.school; toast('تم الحفظ'); location.hash = '#/'; } catch (err) { toast(err.message); }
  };
  $('#mlogo').onchange = async (e) => {
    try { const r = await api('/api/school', { method: 'PUT', body: { ministry_logo: e.target.checked } }); S.data.school = r.school; toast(e.target.checked ? 'بيطلع شعار الوزارة في الملفات' : 'تم إخفاء شعار الوزارة من الملفات'); } catch (err) { toast(err.message); }
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
  if (!S.draft) { const dr = loadDraft(); S.draft = dr && (!r || r.sample) ? dr : r && !r.sample ? JSON.parse(JSON.stringify(r)) : null; }
  if (!S.draft) {
    view.innerHTML = `${banner()}<div class="card" style="max-width:760px;margin:auto">
      <h2>تقرير التقويم المدرسي</h2>
      <p class="muted">التقرير اللي تحمّله من منصة تميز (تقرير التقويم المدرسي الذاتي). نقرأ منه نسبة كل مؤشر، وأنت تراجعها قبل بناء الخطة.</p>
      ${S.data.reader ? `<label class="drop" style="display:block;margin-bottom:14px">📄 اسحب ملف التقرير PDF هنا أو اضغط للاختيار<input type="file" id="pdf" accept="application/pdf" hidden></label>
        <p class="muted" style="font-size:13px">ملف التقرير يُقرأ ولا يُحفظ عندنا. نحفظ النسب فقط.</p>` : `<p class="banner trial" style="font-weight:500">القراءة التلقائية للملف غير مفعّلة حالياً. أدخل النسب من التقرير يدوياً، تاخذ تقريباً 5 دقائق.</p>`}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="man" data-s="basic">إدخال يدوي (ابتدائي / متوسط، 46 مؤشر)</button><button class="btn ghost" id="man2" data-s="secondary">إدخال يدوي (ثانوي، 45 مؤشر)</button></div>
      <p class="muted" style="font-size:13px;margin-bottom:0">ما عندك التقرير الحين؟ <a href="#" onclick="trySample('basic');return false">جرّب على تقرير نموذجي</a> وشوف شكل الخطة.</p>
    </div>`;
    const manual = (e) => { S.draft = emptyDraft(e.target.dataset.s); saveDraft(); report(); };
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
    <details class="card" style="margin:14px 0;background:var(--bg)" ${miss === d.indicators.length ? 'open' : ''}><summary style="cursor:pointer;font-weight:700">⚡ إدخال سريع: الصق كل النسب دفعة وحدة</summary>
      <p class="muted" style="font-size:13px">اكتب أو الصق النسب بنفس ترتيب التقرير (من 1-1-1-1 إلى آخر مؤشر)، يفصل بينها مسافة أو سطر. علامة % اختيارية.</p>
      <textarea id="bulk" dir="ltr" placeholder="91.5 92.25 92 89.5 ..." style="min-height:70px"></textarea>
      <button class="btn sm" id="bulkgo" style="margin-top:8px">عبّي النسب</button> <span class="muted" id="bulkmsg" style="font-size:13px"></span></details>
    <p class="muted" style="font-size:13px">💡 اضغط Enter بعد كل نسبة وينتقل المؤشر للي بعده. إدخالك يُحفظ تلقائياً على جهازك لو قفلت الصفحة.</p>
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
    saveDraft();
  });
  const inputs = [...view.querySelectorAll('.ind input')];
  inputs.forEach((inp, k) => inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); (inputs[k + 1] || $('#save')).focus(); } });
  $('#bulkgo').onclick = () => {
    const nums = ($('#bulk').value.match(/\d+(?:[.,٫]\d+)?/g) || []).map((x) => Number(x.replace(/[,٫]/, '.'))).filter((x) => x >= 0 && x <= 100);
    if (!nums.length) return toast('ما لقيت أرقام');
    nums.slice(0, inputs.length).forEach((v, k) => { inputs[k].value = v; inputs[k].dispatchEvent(new Event('input')); });
    $('#bulkmsg').textContent = nums.length === inputs.length ? `تم تعبئة ${nums.length} نسبة ✓ راجعها مع التقرير` : `تم تعبئة ${Math.min(nums.length, inputs.length)} من ${inputs.length}، تأكد من الترتيب`;
  };
  $('#reset').onclick = () => { S.draft = null; clearDraft(); S.data.report = null; report(); };
  $('#save').onclick = async (e) => {
    for (const f of ['school_name', 'ministry_number', 'cycle', 'overall', 'students']) d[f] = $(`#h_${f}`).value;
    d.sample = false;
    busy(e.target, true, 'نحفظ...');
    try { const r = await api('/api/school/report', { method: 'PUT', body: d }); S.data.report = r.report; S.data.school = r.school; S.draft = null; clearDraft(); toast('تم حفظ التقرير'); location.hash = '#/plan'; }
    catch (err) { toast(err.message); busy(e.target, false); }
  };
}

// ---------- الخطة ----------
function rowCard(r, i, editable) {
  return `<div class="card row-card" id="row${i}">
    <div class="top"><div><code><bdi dir="ltr">${esc(r.code)}</bdi></code> <span class="muted" style="font-size:13px">${esc(r.domain)} / ${esc(r.standard)}</span><h3>${esc(r.indicator)}</h3></div>
    <div style="text-align:left"><div class="pct">${fmt(r.pct)} <small class="muted" style="font-size:13px">← ${r.target}%</small></div>${chip(r.pct)} <span class="pill">أولوية ${esc(r.priority)}</span>${editable ? `<div class="bar" style="margin-top:8px;width:140px"><i style="width:${progress([r]).pct}%"></i></div>` : ''}</div></div>
    <details class="need"><summary>توصية التقرير لهذا المؤشر</summary>${esc(r.rec || r.need)}</details>
    <dl>
      <dt>الهدف</dt><dd>${esc(r.goal)}</dd>
      <dt>الإجراءات</dt><dd><ul class="procs">${procs(r).map((p, j) => `<li class="${p.done ? 'done' : ''}">${editable ? `<input type="checkbox" ${p.done ? 'checked' : ''} onchange="toggleProc(${i}, ${j}, this)" aria-label="تم التنفيذ">` : '<span class="dot">•</span>'}<div class="pbody"><span class="ptext">${esc(p.text)}${p.when ? ` <span class="when">${esc(p.when)}</span>` : ''}</span>${editable ? procMeta(p, i, j) : ''}</div></li>`).join('')}</ul></dd>
      <dt>أساليب التحسين</dt><dd>${esc(r.methods || '')}</dd>
      <dt>المسؤول</dt><dd>${esc(r.responsible)}</dd>
      <dt>الزمن</dt><dd>${esc(r.from)} إلى ${esc(r.to)}</dd>
      <dt>مؤشر التحقق</dt><dd>${esc(r.measure)}</dd>
      <dt>الشواهد</dt><dd><ul>${r.evidence.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></dd>
      ${editable ? `<dt>دعم التميز</dt><dd>لجان المدرسة: ${esc(r.committee || r.responsible)}${r.supervisor ? `<br>المشرف التربوي: ${esc(r.supervisor)}` : ''}${r.note ? `<br><span class="muted">ملاحظة: ${esc(r.note)}</span>` : ''}</dd>` : ''}
    </dl>
    ${editable ? `<button class="btn ghost sm" style="margin-top:10px" onclick="editRow(${i})">✏️ تعديل</button>` : ''}
  </div>`;
}
// المنفذ والشاهد لكل إجراء
function procMeta(p, i, j) {
  const ms = S.data.members || [];
  const sel = ms.length ? `<select class="assign" onchange="assignProc(${i}, ${j}, this)" aria-label="المنفذ"><option value="">بدون معلم محدد</option>${ms.map((m) => `<option value="${esc(m.email)}" ${p.assignee === m.email ? 'selected' : ''}>${esc(m.name || m.email)}</option>`).join('')}</select>` : '';
  const ev = p.evidence ? `<a class="evlink" href="/v/${esc(p.evidence.code)}" target="_blank" rel="noopener">📎 ${esc(p.evidence.title)}</a>` : (p.assignee && !p.done ? '<span class="muted">بانتظار شاهد المعلم</span>' : '');
  return sel || ev ? `<div class="pmeta">${sel}${ev}</div>` : '';
}
window.assignProc = async (i, j, el) => {
  try { const res = await api(`/api/school/plan/rows/${i}/procs/${j}`, { method: 'PUT', body: { assignee: el.value } }); S.data.plan = res.plan; toast(el.value ? 'تم إسناد الإجراء، ويظهر في «مهامي» عند المعلم' : 'تم إلغاء الإسناد'); }
  catch (e) { toast(e.message); }
};
function plan() {
  const { report, plan: p, usage } = S.data;
  if (!report || !report.complete) { view.innerHTML = `${banner()}<div class="card" style="text-align:center"><h2>ارفع تقرير التقويم أولاً</h2><p class="muted">الخطة تنبني على نسب المؤشرات.</p><a class="btn" href="#/report">التقرير</a></div>`; return; }
  const full = lic().active && lic().grants.includes('improvement');
  const stale = p && p.trial && full;
  view.innerHTML = `${banner()}
  <div class="head"><div><h1 style="margin:0">خطة التحسين</h1><p class="muted" style="margin:0">${p ? `${p.total} مؤشر تحت مستوى التميز، مرتبة من الأضعف.` : 'جاهز نبنيها من تقريرك.'}</p></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    ${p ? `<a class="btn ghost" href="/school/print/plan" target="_blank">🖨️ PDF للطباعة</a>${full && !p.trial ? '<a class="btn ghost" href="/school/export/plan.docx">📝 Word</a><a class="btn ghost" href="/school/print/followup" target="_blank">📈 تقرير المتابعة</a><a class="btn ghost" href="/school/export/followup.docx">📝 المتابعة Word</a>' : ''}` : ''}
    ${p && (p.sample || !stale) ? '' : `<button class="btn" id="gen">${p ? 'ابنِ الخطة كاملة' : 'ابنِ الخطة'}</button>`}${p && !p.sample && !stale ? '<button class="btn ghost" id="gen" title="يمسح التعديلات والمتابعة">↻ إعادة البناء</button>' : ''}</div></div>
  ${resultsBoard()}
  ${p && p.sample ? `<div class="banner trial"><span>هذا نموذج على تقرير مدرسة حقيقية (مخفية البيانات). جاهز تسويها لمدرستك؟</span><a class="btn sm" href="#/report" onclick="S.data.report=null;S.draft=null">ارفع تقرير مدرستك</a></div>` : ''}
  ${p && full && !p.trial ? (() => { const g = progress(p.rows); return `<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>متابعة التنفيذ: ${g.d} من ${g.t} إجراء منجز</b><b style="color:var(--brand-text)">${g.pct}%</b></div><div class="bar" style="margin-top:8px"><i style="width:${g.pct}%"></i></div></div>`; })() : ''}
  ${full ? `<p class="muted" style="font-size:13px">المستخدم هذا العام: ${usage.plans} من ${usage.planLimit} عملية بناء.</p>` : ''}
  ${p && full && !p.trial && !(S.data.members || []).length ? '<div class="banner trial"><span>وزّع الإجراءات على المعلمين: أضفهم في «الفريق»، وكل معلم يشوف مهامه في ملف إنجازه ويرفع الشاهد، ويطلع في تقرير المتابعة.</span><a class="btn sm" href="#/team">أضف الفريق</a></div>' : ''}
  <div id="rows">${p ? p.rows.map((r, i) => rowCard(r, i, full && !p.trial)).join('') : ''}</div>
  ${p && full && !p.trial ? `<div class="card"><h3 style="margin-top:0">التوصيات والمقترحات</h3><p class="muted" style="margin-top:0;font-size:13px">تظهر في القسم الثالث من الخطة وتقرير المتابعة. كل توصية في سطر، ولو تركتها فاضية نقترح لك توصيات من حالة التنفيذ.</p>
  <form id="recf"><textarea name="recommendations" style="min-height:90px">${esc(p.recommendations || '')}</textarea><button class="btn sm" style="margin-top:8px">حفظ التوصيات</button></form></div>` : ''}
  ${p && p.limited ? `<div class="card" style="text-align:center;border-style:dashed"><h3>باقي ${p.total - p.rows.length} مؤشر في خطتك</h3><p class="muted">فعّل باقة المدرسة وتطلع لك الخطة كاملة بملف Word قابل للتعديل وPDF بدون علامة مائية.</p><a class="btn" href="#/license">فعّل الباقة</a></div>` : ''}`;
  if ($('#recf')) $('#recf').onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api('/api/school/plan/recommendations', { method: 'PUT', body: { recommendations: e.target.recommendations.value } }); S.data.plan = r.plan; toast('تم حفظ التوصيات'); }
    catch (err) { toast(err.message); }
  };
  if ($('#gen')) $('#gen').onclick = async (e) => {
    if (p && !p.sample && !p.trial && !confirm('إعادة البناء تمسح تعديلاتك وحالة المتابعة. متأكد؟')) return;
    busy(e.target, true, 'نبني الخطة...');
    try { const r = await api('/api/school/plan', { method: 'POST' }); S.data.plan = r.plan; await load(); toast('تم بناء الخطة'); plan(); }
    catch (err) { toast(err.message); busy(e.target, false); if (err.code === 'license') location.hash = '#/license'; }
  };
}
// لوحة نتائج التقويم الذاتي: توزيع المستويات، المجالات والمعايير مقابل مستهدف التميز، وأكبر الفجوات
function resultsBoard() {
  const r = S.data.report, o = S.data.ops;
  if (!r || !r.complete || !o) return '';
  const inds = r.indicators.filter((i) => i.pct != null && i.pct !== '');
  if (!inds.length) return '';
  const T = 90;
  const cnt = LEVELS.map((l) => ({ ...l, n: inds.filter((i) => levelOf(i.pct) === l).length }));
  const stack = `<div style="display:flex;height:16px;border-radius:99px;overflow:hidden;margin:6px 0">${cnt.filter((l) => l.n).map((l) => `<i title="${l.name}" style="flex:${l.n};background:${l.color}"></i>`).join('')}</div><div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px">${cnt.map((l) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${l.color}"></i> ${l.name}: <b>${l.n}</b></span>`).join('')}</div>`;
  const bar = (x) => { const c = levelOf(x.pct).color; const gap = Math.max(0, Math.round((T - x.pct) * 10) / 10); return `<div style="display:grid;grid-template-columns:minmax(120px,38%) 1fr 92px;gap:8px;align-items:center;margin:5px 0;font-size:13.5px"><span>${esc(x.name)}</span><div style="position:relative;height:12px;background:var(--line, #e6ecea);border-radius:99px"><i style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${Math.min(100, x.pct)}%;background:${c};border-radius:99px"></i><i title="مستهدف التميز ${T}%" style="position:absolute;inset-inline-start:${T}%;top:-3px;bottom:-3px;width:2px;background:#10201e"></i></div><span style="text-align:left"><b>${fmt(x.pct)}</b>${gap ? ` <small style="color:#d33a2c"><bdi dir="ltr">-${gap}</bdi></small>` : ' ✓'}</span></div>`; };
  const gaps = [...inds].sort((a, b) => a.pct - b.pct).slice(0, 5);
  return `<details class="card" style="margin-bottom:14px" open><summary style="cursor:pointer"><b style="font-size:17px">لوحة النتائج</b> <span class="muted" style="font-size:13px">الأداء العام ${fmt(r.overall)} · الخط الأسود مستهدف التميز ${T}%، والرقم الأحمر الفجوة عنه</span></summary>
  <div class="grid g2" style="gap:18px;margin-top:10px"><div><b>توزيع ${inds.length} مؤشر على المستويات</b>${stack}
  <b style="display:block;margin-top:14px">المجالات</b>${o.domains.map(bar).join('')}</div>
  <div><b>أكبر 5 فجوات عن التميز</b><ol style="margin:6px 0;padding-inline-start:18px;font-size:13.5px">${gaps.map((i) => `<li>${esc(i.text.length > 80 ? `${i.text.slice(0, 80)}…` : i.text)} <b style="color:${levelOf(i.pct).color}">${fmt(i.pct)}</b></li>`).join('')}</ol></div></div>
  <b style="display:block;margin-top:10px">المعايير من الأضعف</b>${[...o.standards].sort((a, b) => a.pct - b.pct).map(bar).join('')}</details>`;
}
window.toggleProc = async (i, j, el) => {
  try { const res = await api(`/api/school/plan/rows/${i}/procs/${j}`, { method: 'PUT', body: { done: el.checked } }); S.data.plan = res.plan; toast(el.checked ? 'تم ✓' : 'تم إلغاء التأشير'); const y = window.scrollY; plan(); window.scrollTo(0, y); }
  catch (e) { el.checked = !el.checked; toast(e.message); }
};
window.editRow = (i) => {
  const r = S.data.plan.rows[i];
  const box = $(`#row${i}`);
  box.innerHTML = `<h3><code><bdi dir="ltr">${esc(r.code)}</bdi></code> ${esc(r.indicator)}</h3>
  <form id="ef${i}">
    <div class="field"><label>الهدف</label><textarea name="goal" style="min-height:60px">${esc(r.goal)}</textarea></div>
    <div class="field"><label>الإجراءات (كل إجراء في سطر، والتوقيت بعد علامة |)</label><textarea name="procedures" style="min-height:130px">${esc(procs(r).map((p) => `${p.text} | ${p.when}`).join('\n'))}</textarea></div>
    <div class="grid g2"><div class="field"><label>المسؤول</label><input name="responsible" value="${esc(r.responsible)}"></div>
    <div class="field"><label>من</label><input name="from" value="${esc(r.from)}"></div>
    <div class="field"><label>إلى</label><input name="to" value="${esc(r.to)}"></div></div>
    <div class="field"><label>مؤشر التحقق</label><textarea name="measure" style="min-height:60px">${esc(r.measure)}</textarea></div>
    <div class="field"><label>الشواهد (كل شاهد في سطر)</label><textarea name="evidence">${esc(r.evidence.join('\n'))}</textarea></div>
    <div class="field"><label>أساليب وطرق التحسين</label><input name="methods" value="${esc(r.methods || '')}"></div>
    <div class="grid g2"><div class="field"><label>لجان المدرسة المنفذة (لتقرير المتابعة)</label><input name="committee" value="${esc(r.committee || r.responsible)}"></div>
    <div class="field"><label>عمود «المشرف التربوي» في الاستمارة (2) (إن وجد)</label><input name="supervisor" value="${esc(r.supervisor || '')}" placeholder="مثال: ورشة من مكتب التعليم أو مدرسة شريكة"></div></div>
    <div class="field"><label>ملاحظة المتابعة أو سبب التأخر</label><input name="note" value="${esc(r.note || '')}"></div>
    <button class="btn">حفظ</button> <button type="button" class="btn ghost" onclick="plan()">إلغاء</button>
  </form>`;
  $(`#ef${i}`).onsubmit = async (e) => {
    e.preventDefault();
    try { const res = await api(`/api/school/plan/rows/${i}`, { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); S.data.plan = res.plan; toast('تم الحفظ'); box.outerHTML = rowCard(res.plan.rows[i], i, true); }
    catch (err) { toast(err.message); }
  };
};

// ---------- الخطة التشغيلية ----------
const SWN = [['s', 'نقاط القوة', '#0b8f55'], ['w', 'نقاط الضعف', '#d33a2c'], ['o', 'الفرص', '#1a6fe0'], ['t', 'التحديات', '#d9690a']];
const tpTag = (t) => { const x = S.data.opTypes[t]; return `<span class="lv" style="background:${x.color}">${x.name}</span>`; };
async function ops() {
  const { report } = S.data;
  if (!report || !report.complete) { view.innerHTML = `${banner()}<div class="card" style="text-align:center"><h2>ارفع تقرير التقويم أولاً</h2><p class="muted">الخطة التشغيلية تنبني من نسب المؤشرات وخطة التحسين.</p><a class="btn" href="#/report">التقرير</a></div>`; return; }
  try { await load(); } catch {}
  const o = S.data.ops;
  const full = lic().active && lic().grants.includes('operational');
  const ed = full && !o.trial;
  const tps = Object.entries(o.byType).filter(([, n]) => n).map(([t, n]) => `${tpTag(t)} ${n}`).join(' ');
  view.innerHTML = `${banner()}
  <div class="head"><div><h1 style="margin:0">الخطة التشغيلية</h1><p class="muted" style="margin:0">مبنية من تقرير التقويم وخطة التحسين${S.data.nafis && S.data.nafis.plan ? ' وخطة نافس' : ''}. المتابعة مشتركة مع خطة التحسين.</p></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn ghost" href="/school/print/ops" target="_blank">🖨️ PDF للطباعة</a>${ed ? '<a class="btn ghost" href="/school/export/ops.docx">📝 Word</a>' : ''}<a class="btn" href="/school/print/deck" target="_blank">🎞️ عرض المدرسة</a></div></div>
  ${!o.has_plan ? '<div class="banner trial"><span>ابنِ خطة التحسين أولاً، وتطلع برامجها هنا تلقائياً مع إجراءاتها ومسؤوليها.</span><a class="btn sm" href="#/plan">خطة التحسين</a></div>' : ''}
  ${!full ? `<div class="banner trial"><span>تشوف الحين معاينة. التعديل وملف Word والطباعة بدون علامة مائية متاحة في باقة المدرسة الشاملة.</span><a class="btn sm" href="#/license">الباقة الشاملة</a></div>` : ''}
  <div class="stats"><div class="card stat">البرامج<b>${o.programs.length}</b></div><div class="card stat">الأهداف العامة<b>${o.goals.length}</b></div><div class="card stat">الإنجاز<b>${o.progress.pct}%</b></div><div class="card stat">إجراءات متأخرة<b style="color:${o.late ? '#d33a2c' : 'inherit'}">${o.late}</b></div></div>
  ${trackCard(o)}
  <p style="margin:6px 0 14px">${tps}</p>
  <div class="card"><div class="head" style="margin-bottom:6px"><h2 style="font-size:18px;margin:0">التوجهات</h2>${ed ? '<button class="btn ghost sm" onclick="opsVM()">✏️ تعديل</button>' : ''}</div>
  <div id="vm"><div class="grid g2" style="gap:6px"><div><b>الرؤية:</b> ${esc(o.vision) || '<span class="muted">اكتب رؤية المدرسة</span>'}</div><div><b>الرسالة:</b> ${esc(o.mission) || '<span class="muted">اكتب رسالة المدرسة</span>'}</div><div><b>القيم:</b> ${esc(o.values) || '<span class="muted">-</span>'}</div></div></div></div>
  <div class="card"><div class="head" style="margin-bottom:6px"><div><h2 style="font-size:18px;margin:0">تحليل الواقع (SWOT)</h2><p class="muted" style="margin:0;font-size:13px">${o.swot_edited ? 'معدّل منك.' : 'مقترح من أرقام تقريرك ونافس، وتقدر تعدّله.'}</p></div>${ed ? '<button class="btn ghost sm" onclick="opsSwot()">✏️ تعديل</button>' : ''}</div>
  <div id="swot" class="grid g2">${SWN.map(([k, t, c]) => `<div style="border:1.5px solid ${c};border-radius:10px;padding:8px 12px"><b style="color:${c}">${t}</b><ul style="margin:4px 0 0;padding-inline-start:18px;font-size:14px">${(o.swot[k] || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">-</li>'}</ul></div>`).join('')}</div></div>
  <div class="card"><h2 style="font-size:18px;margin-top:0">الأهداف العامة</h2><ul class="procs">${o.goals.map((g) => `<li><span class="dot">•</span><div class="pbody"><b>${esc(g.text)}</b> <span class="muted" style="font-size:13px">(${g.programs.length} برنامج)</span></div></li>`).join('')}</ul></div>
  <h2 style="font-size:18px">البرامج والمبادرات</h2>
  <div id="progs">${o.programs.map((p) => progCard(p, ed, canTrack() && !o.trial)).join('')}</div>`;
  if ($('#schf')) $('#schf').onsubmit = async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.force = !!b.force;
    try { const r = await api('/api/school/schedule', { method: 'POST', body: b }); S.data.ops = r.ops; S.data.plan = r.plan; toast(`تم تحديد ${r.count} موعد`); ops(); } catch (err) { toast(err.message); }
  };
}
const canTrack = () => lic().active && ['improvement', 'nafis', 'operational'].some((g) => lic().grants.includes(g));
const teamUrl = () => (S.data.school.team_token ? `${location.origin}/t/${S.data.school.team_token}` : '');
const fdAr = (d) => (d ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long' }).format(new Date(`${d}T12:00:00Z`)) : '');
function trackCard(o) {
  if (!canTrack() || o.trial) return '';
  const all = o.programs.flatMap((p) => p.procedures.filter((x) => x.refs));
  const nodate = all.filter((x) => !x.due).length;
  const today = new Date().toISOString().slice(0, 10);
  const url = teamUrl();
  return `<div class="card" style="margin-bottom:14px"><h2 style="font-size:18px;margin-top:0">متابعة التنفيذ</h2>
  <div class="grid g2" style="gap:14px">
  <div><b>رابط الفريق</b><p class="muted" style="margin:2px 0 8px;font-size:13px">أي عضو في الفريق يفتح الرابط أو يمسح الـQR، يكتب اسمه ويأشّر على اللي نفّذه. بدون تسجيل دخول.</p>
  ${url ? `<input readonly dir="ltr" value="${esc(url)}" onclick="this.select()" style="margin-bottom:8px"><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" onclick="navigator.clipboard.writeText('${esc(url)}').then(()=>toast('تم نسخ الرابط'))">نسخ الرابط</button><a class="btn ghost sm" href="/school/print/team-card" target="_blank">🔳 بطاقة QR للطباعة</a><button class="btn ghost sm" onclick="teamLink(true)">↻ رابط جديد</button></div>` : '<button class="btn sm" onclick="teamLink()">أنشئ رابط الفريق</button>'}</div>
  <div><b>التقارير</b><p class="muted" style="margin:2px 0 8px;font-size:13px">المتأخر بعدد أيامه، والمنجز خلال الفترة، ونسبة كل برنامج برسوم، بهوية الوزارة.</p>
  <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn sm" href="/school/print/progress?p=week" target="_blank">📊 التقرير الأسبوعي</a><a class="btn ghost sm" href="/school/print/progress?p=month" target="_blank">📊 التقرير الشهري</a></div></div></div>
  <details style="margin-top:12px" ${nodate === all.length && all.length ? 'open' : ''}><summary><b>مواعيد الإجراءات</b> <span class="muted" style="font-size:13px">(${nodate ? `${nodate} إجراء بدون موعد` : 'كل الإجراءات لها مواعيد'})</span></summary>
  <p class="muted" style="font-size:13px">حدد مدة التنفيذ، ونوزّع المواعيد على الإجراءات حسب توقيت كل واحد. وتقدر تعدّل أي موعد من بطاقة البرنامج.</p>
  <form id="schf" class="grid g3"><div class="field"><label>بداية التنفيذ</label><input type="date" name="start" value="${today}" required></div><div class="field"><label>نهاية التنفيذ</label><input type="date" name="end" required></div><div class="field"><label style="display:flex;gap:6px;align-items:center;margin-top:26px"><input type="checkbox" name="force" style="width:auto"> استبدل المواعيد الحالية</label></div><div><button class="btn sm">وزّع المواعيد</button></div></form></details></div>`;
}
window.teamLink = async (again) => {
  if (again && !confirm('الرابط القديم يتوقف، وتحتاج ترسل الجديد للفريق. متأكد؟')) return;
  try { const r = await api('/api/school/team-link', { method: 'POST' }); S.data.school.team_token = r.token; toast('جاهز الرابط'); ops(); } catch (e) { toast(e.message); }
};
const trackPut = async (refs, body) => { const r = await api('/api/school/track', { method: 'PUT', body: { refs, ...body } }); S.data.ops = r.ops; S.data.plan = r.plan; if (r.nafis) S.data.nafis = r.nafis; };
window.opTick = async (key, j, el) => {
  const x = S.data.ops.programs.find((p) => p.key === key).procedures[j];
  try { await trackPut(x.refs, { done: el.checked }); toast(el.checked ? 'تم ✓' : 'تم إلغاء التأشير'); const y = window.scrollY; await ops(); window.scrollTo(0, y); } catch (e) { el.checked = !el.checked; toast(e.message); }
};
window.opDue = async (key, j, el) => {
  const x = S.data.ops.programs.find((p) => p.key === key).procedures[j];
  try { await trackPut(x.refs, { due: el.value }); toast('تم حفظ الموعد'); const y = window.scrollY; await ops(); window.scrollTo(0, y); } catch (e) { toast(e.message); }
};
const lateTag = (x) => (x.done ? (x.done_name ? `<span class="pill">نفّذه ${esc(x.done_name)}</span>` : '') : x.state === 'late' ? `<span class="lv" style="background:#d33a2c">متأخر ${x.late} يوم</span>` : x.state === 'soon' ? `<span class="lv" style="background:#d9690a">موعده ${fdAr(x.due)}</span>` : '');
function progCard(p, ed, tr) {
  return `<div class="card row-card" id="pg-${p.key}">
    <div class="top"><div>${tpTag(p.type)} <span class="muted" style="font-size:13px">${esc(p.domain)} / ${esc(p.standard)}</span><h3>${esc(p.name)}</h3></div>
    <div style="text-align:left">${p.late ? `<div><span class="lv" style="background:#d33a2c">${p.late} متأخر · حتى ${p.maxLate} يوم</span></div>` : ''}${p.progress ? `<div class="pct">${p.progress.pct}%</div><div class="bar" style="margin-top:6px;width:120px"><i style="width:${p.progress.pct}%"></i></div>` : ''}${p.opinions.n ? `<div class="muted" style="font-size:13px;margin-top:6px">رأي المعلمين: ⭐ ${p.opinions.avg ?? '-'} (${p.opinions.n})</div>` : ''}</div></div>
    <dl>
      <dt>المؤشر</dt><dd>${p.code ? `<code><bdi dir="ltr">${esc(p.code)}</bdi></code> ` : ''}${esc(p.indicator)}${p.pct != null ? ` <span class="muted">(${fmt(p.pct)} ← ${p.target}%)</span>` : ''}</dd>
      <dt>الهدف</dt><dd>${esc(p.goal)}</dd>
      <dt>الإجراءات</dt><dd><ul class="procs">${p.procedures.map((x, j) => `<li class="${x.done ? 'done' : ''}">${tr && x.refs ? `<input type="checkbox" ${x.done ? 'checked' : ''} onchange="opTick('${p.key}', ${j}, this)" aria-label="تم التنفيذ">` : `<span class="dot">${x.done ? '✓' : '•'}</span>`}<div class="pbody"><span class="ptext">${esc(x.text)}${x.when ? ` <span class="when">${esc(x.when)}</span>` : ''} ${lateTag(x)}</span>${x.assignee_name ? `<div class="muted" style="font-size:12.5px">المنفذ: ${esc(x.assignee_name)}</div>` : ''}${tr && x.refs ? `<div class="pmeta"><label class="muted" style="font-size:12.5px">الموعد: <input type="date" value="${esc(x.due || '')}" onchange="opDue('${p.key}', ${j}, this)" style="width:auto;padding:2px 6px;font-size:13px"></label></div>` : ''}</div></li>`).join('')}</ul>${p.source === 'improvement' ? `<a class="muted" style="font-size:13px" href="#/plan">إسناد الإجراءات للمعلمين من خطة التحسين ←</a>` : ''}</dd>
      <dt>المسؤول</dt><dd>${esc(p.responsible)}</dd>
      <dt>الزمن</dt><dd>${esc(p.from)} إلى ${esc(p.to)}</dd>
      <dt>مؤشر القياس</dt><dd>${esc(p.kpi)}</dd>
      ${p.budget ? `<dt>الميزانية</dt><dd>${esc(p.budget)}</dd>` : ''}
      ${p.opinions.comments.length ? `<dt>آراء المعلمين</dt><dd><ul>${p.opinions.comments.map((c) => `<li>⭐${c.rating} ${esc(c.comment)} <span class="muted">(${esc(c.name)})</span></li>`).join('')}</ul></dd>` : ''}
    </dl>
    ${ed ? `<button class="btn ghost sm" style="margin-top:10px" onclick="opsProg('${p.key}')">✏️ تعديل البرنامج</button>` : ''}
  </div>`;
}
const opsPut = async (body) => { const r = await api('/api/school/ops', { method: 'PUT', body }); S.data.ops = r.ops; };
window.opsVM = () => {
  const o = S.data.ops;
  $('#vm').innerHTML = `<form id="vmf"><div class="field"><label>الرؤية</label><input name="vision" value="${esc(o.vision)}" placeholder="مثال: متعلم متميز في بيئة محفزة"></div><div class="field"><label>الرسالة</label><textarea name="mission" style="min-height:60px">${esc(o.mission)}</textarea></div><div class="field"><label>القيم</label><input name="values" value="${esc(o.values)}" placeholder="مثال: الإتقان، الانتماء، المسؤولية"></div><button class="btn sm">حفظ</button> <button type="button" class="btn ghost sm" onclick="ops()">إلغاء</button></form>`;
  $('#vmf').onsubmit = async (e) => { e.preventDefault(); try { await opsPut(Object.fromEntries(new FormData(e.target))); toast('تم الحفظ'); ops(); } catch (err) { toast(err.message); } };
};
window.opsSwot = () => {
  const o = S.data.ops;
  $('#swot').outerHTML = `<form id="swf">${SWN.map(([k, t]) => `<div class="field"><label>${t} (كل نقطة في سطر)</label><textarea name="${k}" style="min-height:90px">${esc((o.swot[k] || []).join('\n'))}</textarea></div>`).join('')}<button class="btn sm">حفظ</button> <button type="button" class="btn ghost sm" onclick="ops()">إلغاء</button>${o.swot_edited ? ' <button type="button" class="btn ghost sm" onclick="opsSwotReset()">↻ رجّع المقترح</button>' : ''}</form>`;
  $('#swf').onsubmit = async (e) => { e.preventDefault(); try { await opsPut({ swot: Object.fromEntries(new FormData(e.target)) }); toast('تم الحفظ'); ops(); } catch (err) { toast(err.message); } };
};
window.opsSwotReset = async () => { try { await opsPut({ swot: null }); ops(); } catch (e) { toast(e.message); } };
window.opsProg = (key) => {
  const p = S.data.ops.programs.find((x) => x.key === key);
  const T = S.data.opTypes;
  $(`#pg-${key}`).innerHTML = `<form id="pgf"><div class="field"><label>اسم البرنامج</label><input name="name" value="${esc(p.name)}"></div>
  <div class="grid g2"><div class="field"><label>نوع البرنامج</label><select name="type">${Object.entries(T).map(([k, v]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
  <div class="field"><label>الميزانية التقديرية (اختياري)</label><input name="budget" value="${esc(p.budget)}" placeholder="مثال: 1500 ريال، أو بدون تكلفة"></div></div>
  <div class="field"><label>مؤشر القياس</label><textarea name="kpi" style="min-height:60px">${esc(p.kpi)}</textarea></div>
  <p class="muted" style="font-size:13px">الإجراءات والمسؤول والزمن تتعدّل من خطة التحسين، وتنعكس هنا تلقائياً.</p>
  <button class="btn sm">حفظ</button> <button type="button" class="btn ghost sm" onclick="ops()">إلغاء</button></form>`;
  $('#pgf').onsubmit = async (e) => { e.preventDefault(); try { await opsPut({ program: { key, ...Object.fromEntries(new FormData(e.target)) } }); toast('تم الحفظ'); ops(); } catch (err) { toast(err.message); } };
};

// ---------- لوحة المدرسة الذكية ----------
const BD = { day: '' };
const BC = { good: '#0b8f55', watch: '#d9690a', alert: '#d33a2c', none: '#8a9896' };
async function board() {
  let d;
  try { d = await api(`/api/school/board${BD.day ? `?day=${BD.day}` : ''}`); } catch (e) { view.innerHTML = `<div class="card">${esc(e.message)}</div>`; return; }
  S.board = d;
  const ind = d.ind;
  const ok = d.licensed;
  const rec = d.team_token ? `${location.origin}/r/${d.team_token}` : '';
  const tv = d.tv_token ? `${location.origin}/tv/${d.tv_token}` : '';
  const setup = !d.classes.length || !d.staff.length;
  const copy = (u) => `navigator.clipboard.writeText('${esc(u)}').then(()=>toast('تم النسخ'))`;
  view.innerHTML = `<div class="head"><div><h1 style="margin:0">لوحة المدرسة الذكية</h1><p class="muted" style="margin:0">الحضور والغياب وحصص الانتظار وتنفيذ الخطة في لوحة وحدة. المعلم يرصد من جواله، والمؤشرات تنحسب لحالها.</p></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input type="date" value="${ind.day}" onchange="BD.day=this.value;board()" style="width:auto">${ok ? '<a class="btn ghost" href="/school/print/board?r=daily" target="_blank">🖨️ التقارير</a>' : ''}</div></div>
  ${!ok ? '<div class="banner trial"><span>تشوف الحين معاينة. الرصد من جوال المعلم وشاشة التلفاز والتقارير متاحة بعد تفعيل لوحة المدرسة أو الباقة الشاملة.</span><a class="btn sm" href="#/license">فعّل</a></div>' : ''}
  <div class="grid g4" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-bottom:14px">${ind.list.map((x) => `<div class="card" style="border-top:5px solid ${BC[x.state]};margin:0"><div class="muted" style="font-size:13px">${esc(x.name)}</div><div style="font-size:30px;font-weight:700;color:${BC[x.state]}">${x.value == null ? '-' : x.value}<small style="font-size:15px">${x.value == null ? '' : esc(x.unit)}</small></div><div class="muted" style="font-size:12.5px">${esc(x.note)}</div></div>`).join('')}</div>
  ${ok ? `<div class="card" style="margin-bottom:14px"><div class="grid g2" style="gap:14px">
    <div><b>رابط رصد الحضور للمعلمين</b><p class="muted" style="margin:2px 0 8px;font-size:13px">المعلم يفتحه من جواله، يختار الفصل ويرصد الغياب والتأخر. نفس رابط فريق الخطة.</p>${rec ? `<input readonly dir="ltr" value="${esc(rec)}" onclick="this.select()" style="margin-bottom:6px"><button class="btn sm" onclick="${copy(rec)}">نسخ الرابط</button> <a class="btn ghost sm" href="/school/print/team-card" target="_blank">🔳 بطاقة QR</a>` : '<button class="btn sm" onclick="bdTeam()">أنشئ الرابط</button>'}</div>
    <div><b>شاشة العرض لتلفاز المدرسة</b><p class="muted" style="margin:2px 0 8px;font-size:13px">افتحها على تلفاز غرفة المعلمين أو المدخل، تتحدث كل دقيقة. للعرض فقط.</p>${tv ? `<input readonly dir="ltr" value="${esc(tv)}" onclick="this.select()" style="margin-bottom:6px"><button class="btn sm" onclick="${copy(tv)}">نسخ</button> <a class="btn ghost sm" href="${esc(tv)}" target="_blank">📺 افتح الشاشة</a>` : '<button class="btn sm" onclick="bdTv()">أنشئ رابط الشاشة</button>'}</div></div></div>` : ''}
  ${setup ? '<div class="banner trial"><span>ابدأ بإضافة الفصول والمنسوبين تحت، مرة وحدة في بداية العام.</span></div>' : ''}
  <div class="grid g2" style="gap:14px">
  <div class="card" style="margin:0"><h3 style="margin-top:0">حضور الفصول ${ind.missing.length && d.classes.length ? `<span class="lv" style="background:#d33a2c">${ind.missing.length} ما رُصد</span>` : ''}</h3>
  ${d.classes.length ? `<table class="tbl"><thead><tr><th>الفصل</th><th>الغياب</th><th>التأخر</th><th>رصده</th></tr></thead><tbody>${ind.classes.map((c) => `<tr><td><b>${esc(c.name)}</b> <span class="muted" style="font-size:12px">${c.students || ''}</span></td>${c.rec ? `<td>${c.absent}${c.names ? `<div class="muted" style="font-size:12px">${esc(c.names)}</div>` : ''}</td><td>${c.late}</td><td class="muted" style="font-size:12.5px">${esc(c.by)}</td>` : `<td colspan="3"><span style="color:#d33a2c">لم يُرصد</span>${ok ? ` <button class="btn ghost sm" onclick="bdAtt(${c.id})">رصد</button>` : ''}</td>`}</tr>`).join('')}</tbody></table>` : '<p class="muted">ما فيه فصول.</p>'}
  ${ok ? `<details style="margin-top:10px"><summary>الفصول (${d.classes.length})</summary><p class="muted" style="font-size:13px">كل فصل في سطر: اسم الفصل، عدد طلابه. مثال: 1/أ، 28</p><form id="bcf"><textarea name="text" style="min-height:90px" placeholder="1/أ، 28&#10;1/ب، 27"></textarea><button class="btn sm">إضافة</button></form>
  <ul class="procs">${d.classes.map((c) => `<li><span class="dot">•</span><div class="pbody">${esc(c.name)} · ${c.students} طالب <button class="btn ghost sm" onclick="bdDel('classes', ${c.id})">حذف</button></div></li>`).join('')}</ul></details>` : ''}</div>
  <div class="card" style="margin:0"><h3 style="margin-top:0">غياب المنسوبين وحصص الانتظار</h3>
  ${ok && d.staff.length ? `<form id="saf" class="grid g3" style="align-items:end"><div class="field"><label>المعلم</label><select name="staff_id">${d.staff.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>الحالة</label><select name="kind"><option>غياب</option><option>إجازة</option><option>مهمة رسمية</option><option>تأخر</option></select></div><div class="field"><label>حصصه (مثال: 1،3،5)</label><input name="periods" inputmode="numeric"></div><div><button class="btn sm">تسجيل</button></div></form>` : ''}
  ${ind.staffAbs.length ? ind.staffAbs.map((x) => `<div style="border-top:1px solid var(--line,#e6ecea);padding:8px 0"><b>${esc(x.name)}</b> <span class="pill">${esc(x.kind)}</span>${ok ? ` <button class="btn ghost sm" onclick="bdAbsDel(${x.staff_id})">إلغاء</button>` : ''}
    ${ind.subs.filter((s) => s.absent_id === x.staff_id).map((s) => `<div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap"><span>الحصة ${s.period}</span>${ok ? `<select onchange="bdSub(${s.period}, ${s.absent_id}, this.value, this.parentElement.querySelector('input').value)" style="width:auto"><option value="">بدون بديل</option>${d.staff.filter((p) => !ind.staffAbs.some((a) => a.staff_id === p.id)).map((p) => `<option value="${p.id}" ${s.sub_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><input placeholder="الفصل" value="${esc(s.class_name)}" style="width:90px" onchange="bdSub(${s.period}, ${s.absent_id}, this.parentElement.querySelector('select').value, this.value)">` : esc(s.sub_name || '-')}</div>`).join('')}</div>`).join('') : '<p class="muted">ما فيه غياب منسوبين في هذا اليوم.</p>'}
  <p class="muted" style="font-size:12.5px">البديل المقترح: الحاضر اللي أخذ أقل حصص انتظار هذا الأسبوع وغير مكلّف في نفس الحصة، وتقدر تغيّره.</p>
  ${ok ? `<details style="margin-top:6px"><summary>المنسوبون (${d.staff.length})</summary><p class="muted" style="font-size:13px">كل شخص في سطر: الاسم، الدور أو التخصص.</p><form id="bsf"><textarea name="text" style="min-height:90px" placeholder="أحمد الزهراني، رياضيات&#10;سعد الحربي، لغتي"></textarea><button class="btn sm">إضافة</button></form>
  <ul class="procs">${d.staff.map((p) => `<li><span class="dot">•</span><div class="pbody">${esc(p.name)}${p.role ? ` · ${esc(p.role)}` : ''} <button class="btn ghost sm" onclick="bdDel('staff', ${p.id})">حذف</button></div></li>`).join('')}</ul></details>` : ''}</div></div>
  ${ok ? `<div class="card" style="margin-top:14px"><h3 style="margin-top:0">التقارير (بهوية الوزارة)</h3><div style="display:flex;gap:6px;flex-wrap:wrap">${[['daily', 'اليومي'], ['weekly', 'الحضور الأسبوعي'], ['monthly', 'الحضور الشهري'], ['top', 'الأعلى غياباً وتأخراً'], ['missing', 'الفصول غير المرصودة'], ['subs', 'حصص الانتظار']].map(([k, t]) => `<a class="btn ghost sm" target="_blank" href="/school/print/board?r=${k}&day=${ind.day}">${t}</a>`).join('')}</div></div>` : ''}`;
  const bulk = (id, what) => { const f = $(id); if (f) f.onsubmit = async (e) => { e.preventDefault(); try { await api(`/api/school/board/${what}`, { method: 'POST', body: { text: e.target.text.value } }); toast('تمت الإضافة'); board(); } catch (err) { toast(err.message); } }; };
  bulk('#bcf', 'classes'); bulk('#bsf', 'staff');
  if ($('#saf')) $('#saf').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/school/board/staff-abs', { method: 'PUT', body: { ...Object.fromEntries(new FormData(e.target)), day: ind.day } }); toast('تم التسجيل، واقترحنا البدلاء'); board(); } catch (err) { toast(err.message); } };
}
window.bdTeam = async () => { try { const r = await api('/api/school/team-link', { method: 'POST' }); S.data.school.team_token = r.token; board(); } catch (e) { toast(e.message); } };
window.bdTv = async () => { try { await api('/api/school/tv-link', { method: 'POST' }); board(); } catch (e) { toast(e.message); } };
window.bdDel = async (what, id) => { if (!confirm('نحذفه؟')) return; try { await api(`/api/school/board/${what}/${id}`, { method: 'DELETE' }); board(); } catch (e) { toast(e.message); } };
window.bdAbsDel = async (sid) => { try { await api('/api/school/board/staff-abs', { method: 'PUT', body: { staff_id: sid, remove: true, day: S.board.ind.day } }); board(); } catch (e) { toast(e.message); } };
window.bdSub = async (period, absent_id, sub_id, class_name) => { try { await api('/api/school/board/subs', { method: 'PUT', body: { period, absent_id, sub_id, class_name, day: S.board.ind.day } }); toast('تم الحفظ'); } catch (e) { toast(e.message); } };
window.bdAtt = async (cid) => {
  const c = S.board.ind.classes.find((x) => x.id === cid);
  const a = prompt(`عدد الغياب في ${c.name}`, '0'); if (a == null) return;
  const l = prompt(`عدد المتأخرين في ${c.name}`, '0'); if (l == null) return;
  try { await api('/api/school/board/att', { method: 'PUT', body: { class_id: cid, absent: a, late: l, day: S.board.ind.day } }); board(); } catch (e) { toast(e.message); }
};

// ---------- فريق المدرسة ----------
function team() {
  const ms = S.data.members || [];
  const p = S.data.plan;
  const all = p ? p.rows.flatMap(procs) : [];
  const stat = (em) => { const a = all.filter((x) => x.assignee === em); const d = a.filter((x) => x.done).length; return { t: a.length, d, ev: a.filter((x) => x.evidence).length }; };
  const free = all.filter((x) => !x.assignee).length;
  const invite = `السلام عليكم، أضفتك في فريق تنفيذ خطة تحسين ${S.data.school.name || 'المدرسة'}. سجّل في «معياري للمعلم» بنفس بريدك: ${location.origin}/app#/register ، وتلقى مهامك في الرئيسية، ووثّق كل إجراء تنفذه بشاهد.`;
  view.innerHTML = `<div class="head"><div><h1 style="margin:0">فريق تنفيذ الخطة</h1><p class="muted" style="margin:0">أضف المعلمين بإيميلاتهم، ووزّع عليهم الإجراءات من صفحة الخطة. كل معلم يشوف مهامه في ملف إنجازه ويرفع الشاهد.</p></div></div>
  <div class="card" style="margin-bottom:14px"><h3 style="margin-top:0">إضافة معلم</h3>
  <form id="mf" class="grid g3"><div class="field"><label>الاسم</label><input name="name" required></div><div class="field"><label>البريد (نفس بريد حسابه في ملف الإنجاز)</label><input name="email" type="email" dir="ltr" required></div><div class="field"><label>الدور أو اللجنة</label><input name="role" placeholder="مثال: معلم رياضيات، لجنة التحصيل"></div><div><button class="btn">إضافة</button></div></form></div>
  <div class="card" style="margin-bottom:14px">
    ${ms.length ? `<table class="tbl"><thead><tr><th>المعلم</th><th>الدور</th><th>الحساب</th><th>الإجراءات</th><th>المنجز</th><th>بشاهد</th><th></th></tr></thead><tbody>${ms.map((m) => { const st = stat(m.email); return `<tr><td><b>${esc(m.name || '-')}</b><br><span class="muted" dir="ltr" style="font-size:12px">${esc(m.email)}</span></td><td>${esc(m.role || '-')}</td><td>${m.joined ? '<span class="pill">مسجّل</span>' : '<span class="muted">لم يسجّل بعد</span>'}</td><td>${st.t}</td><td>${st.d}</td><td>${st.ev}</td><td><button class="btn ghost sm" onclick="delMember(${m.id})">حذف</button></td></tr>`; }).join('')}</tbody></table>
    <p class="muted" style="font-size:13px;margin-bottom:0">${p ? `${free} إجراء بدون معلم محدد. وزّعها من <a href="#/plan">صفحة الخطة</a>.` : 'ابنِ الخطة أولاً عشان توزع إجراءاتها.'}</p>` : '<p class="muted" style="margin:0">ما أضفت أحد للحين.</p>'}
  </div>
  <div class="card"><h3 style="margin-top:0">رسالة الدعوة</h3><p class="muted" style="margin-top:0;font-size:13px">انسخها وأرسلها للمعلمين في قروب المدرسة.</p><textarea id="inv" readonly style="min-height:80px">${esc(invite)}</textarea><button class="btn ghost sm" style="margin-top:8px" onclick="navigator.clipboard.writeText($('#inv').value).then(()=>toast('تم النسخ'))">نسخ الرسالة</button></div>`;
  $('#mf').onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api('/api/school/members', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); S.data.members = r.members; toast('تمت الإضافة'); team(); } catch (err) { toast(err.message); }
  };
}
window.delMember = async (id) => {
  if (!confirm('نحذفه من الفريق؟ إجراءاته تبقى بدون معلم محدد.')) return;
  try { const r = await api(`/api/school/members/${id}`, { method: 'DELETE' }); S.data.members = r.members; S.data.plan = r.plan; team(); } catch (err) { toast(err.message); }
};

// ---------- الباقة ----------
function license() {
  const L = lic();
  const pk = S.data.packages.map((p) => `<div class="card pkg ${p.best ? 'best' : ''}">
    ${p.best ? '<span class="pill">الأوفر</span>' : ''}<h3 style="margin:0">${esc(p.name)}</h3><div class="price">${p.price} <small style="font-size:14px">ريال / سنة</small></div>
    <p class="muted" style="margin:0">${p.id === 'school_improve' ? 'خطة التحسين كاملة من تقرير التقويم، Word وPDF، وتعديل وإعادة بناء طوال السنة.' : p.id === 'school_nafis' ? 'خطة علاجية لنافس من بطاقة الأداء ونواتج التعلم.' : p.id === 'school_evidence' ? 'ملف شواهد التقويم لكل المؤشرات، بدون حد للشواهد، ورابط المقيّم بباركود، وفهرس PDF وWord.' : p.id === 'school_bundle' ? 'خطة التحسين + خطة نافس + ملف الشواهد + الخطة التشغيلية لمدرسة واحدة.' : 'نجهز لك الخطط ونراجعها معك، وتستلمها جاهزة.'}</p>
    ${p.soon ? '<span class="muted" style="font-size:13px">قريباً</span>' : `<p style="margin:12px 0 0"><a class="btn ${p.best ? '' : 'ghost'}" href="${esc(p.url || S.data.store)}" target="_blank" rel="noopener">اشترك في ${esc(p.name)}</a></p>`}</div>`).join('');
  view.innerHTML = `<div class="card" style="margin-bottom:16px">
    <h2>باقة المدرسة</h2>
    ${L.active ? `<p>✅ الباقة مفعّلة للرقم الوزاري <b dir="ltr">${esc(S.data.school.ministry_number)}</b>، باقي ${L.daysLeft} يوم.</p>` : '<p class="muted">الترخيص سنوي لمدرسة واحدة ويرتبط برقمها الوزاري. اختر الباقة تحت وادفع في متجر معيار، ويوصلك كود التفعيل فوراً، الصقه هنا.</p>'}
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

// ---------- الخطة العلاجية لنافس ----------
const NF_KEY = 'miyar-nafis-draft';
const nfSave = () => { try { localStorage.setItem(NF_KEY, JSON.stringify(S.nf)); } catch {} };
const nfLoad = () => { try { return JSON.parse(localStorage.getItem(NF_KEY) || 'null'); } catch { return null; } };
const nfClear = () => { try { localStorage.removeItem(NF_KEY); } catch {} };
const NM = () => S.data.nafisMeta;
const nfTag = (c) => (c ? `<span class="lv" style="background:${NM().cls[c].color}">${NM().cls[c].name}</span>` : '<span class="muted">-</span>');
const sgn = (n) => (n == null ? '-' : `<bdi dir="ltr">${n > 0 ? '+' : ''}${n}</bdi>`);
const pc = (n) => (n == null ? '-' : `${n}%`);
const nfOk = () => lic().active && lic().grants.includes('nafis');
function nfGrade(key, old) {
  const g = NM().grades[key];
  return old || { grade: key, students: '', tested: '', index: '', index_last: '', subjects: g.subjects.map((s) => ({ subject: s, mastery: '', office: '', ksa: '', last: '', goal: '', mean: '', domains: NM().domains[s].map((name) => ({ name, school: '', office: '', ksa: '' })) })) };
}
function nfDraftFrom(card) {
  const c = JSON.parse(JSON.stringify(card || { year: '', grades: [] }));
  delete c.sample;
  c.grades = c.grades.map((g) => nfGrade(g.grade, { ...g, subjects: nfGrade(g.grade).subjects.map((d) => { const s = g.subjects.find((x) => x.subject === d.subject); return s ? { ...d, ...s, domains: s.domains.length ? s.domains : d.domains } : d; }) }));
  if (!c.grades.length) c.grades = [nfGrade('g3m')];
  return c;
}
const nfIn = (path, v, ph = '') => `<input data-p="${path}" value="${esc(v ?? '')}" inputmode="decimal" placeholder="${ph}" dir="ltr">`;
// رفع بطاقة نافس (PDF أو صورة، بطاقة لكل صف) وقراءتها تلقائياً
const nfDrop = () => (S.data.reader ? `<label class="drop" style="display:block;margin-bottom:10px">📄 ارفع بطاقة نافس PDF أو صورة (بطاقة لكل صف، حتى 3 ملفات)<input type="file" id="nfpdf" accept="application/pdf,image/png,image/jpeg,image/webp" multiple hidden></label>
  <p class="muted" style="font-size:13px;margin-top:0">نقرأ الأرقام ونعرضها لك للمراجعة. الملف نفسه ما ينحفظ عندنا.</p>` : '');
function nfDropBind() {
  const el = $('#nfpdf'); if (!el) return;
  el.onchange = async (e) => {
    const files = [...e.target.files].slice(0, 3); if (!files.length) return;
    el.parentElement.innerHTML = `<span class="spin"></span> نقرأ ${files.length > 1 ? `${files.length} بطاقات` : 'البطاقة'}... (قرابة دقيقة)`;
    const fd = new FormData(); files.forEach((f) => fd.append('cards', f));
    try {
      const r = await api('/api/school/nafis/pdf', { method: 'POST', body: fd });
      if (!r.card.grades.length) { toast(r.warnings[0] || 'ما قدرنا نقرأ البطاقة'); return nafis(); }
      S.nf = { ...nfDraftFrom(r.card), read: true, warnings: r.warnings }; nfSave(); toast('تمت القراءة، راجع الأرقام'); nafisEntry(); window.scrollTo(0, 0);
    } catch (err) { toast(err.message); S.nf ? nafisEntry() : nafis(); }
  };
}
function nafisEntry() {
  const d = S.nf;
  const sub = (s, gi, si) => `<div class="nf-sub">
    <h4>${esc(NM().subjects[s.subject].name)}</h4>
    <div class="nf-grid"><label>إتقان المدرسة %${nfIn(`${gi}.${si}.mastery`, s.mastery)}</label><label>الإدارة %${nfIn(`${gi}.${si}.office`, s.office)}</label><label>المملكة %${nfIn(`${gi}.${si}.ksa`, s.ksa)}</label><label>العام الماضي % <small class="muted">اختياري</small>${nfIn(`${gi}.${si}.last`, s.last)}</label><label>المستهدف % <small class="muted">اختياري، مثل مستهدف 2030</small>${nfIn(`${gi}.${si}.goal`, s.goal)}</label></div>
    <table class="tbl nf-dom"><thead><tr><th>المجال الفرعي (كما في البطاقة)</th><th>المدرسة %</th><th>الإدارة %</th><th>المملكة %</th><th></th></tr></thead><tbody>
    ${s.domains.map((x, di) => `<tr><td><input data-p="${gi}.${si}.d.${di}.name" value="${esc(x.name)}"></td><td>${nfIn(`${gi}.${si}.d.${di}.school`, x.school)}</td><td>${nfIn(`${gi}.${si}.d.${di}.office`, x.office)}</td><td>${nfIn(`${gi}.${si}.d.${di}.ksa`, x.ksa)}</td><td><button type="button" class="btn ghost sm" onclick="nfDelDom(${gi},${si},${di})" title="حذف">✕</button></td></tr>`).join('')}
    </tbody></table>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button type="button" class="btn ghost sm" onclick="nfAddDom(${gi},${si})">+ مجال</button><button type="button" class="btn ghost sm" onclick="nfPaste(${gi},${si})">📋 لصق من Excel</button></div>
  </div>`;
  view.innerHTML = `<div class="head"><div><h1 style="margin:0">بطاقة نافس</h1><p class="muted" style="margin:0">${d.read ? 'هذي الأرقام اللي قرأناها من البطاقة. عدّل أي رقم مختلف ثم احفظ.' : 'ارفع البطاقة، أو انقل الأرقام من «بطاقة الأداء المدرسي» في منصة تميز. نحفظ ما تكتبه في جهازك أولاً بأول.'}</p></div>
    <div style="display:flex;gap:8px">${S.data.nafis.card ? '<button class="btn ghost" onclick="nfCancel()">إلغاء</button>' : ''}<button class="btn" id="nfsave">حفظ وبناء الخطة</button></div></div>
  ${d.read ? `<div class="banner trial" style="display:block"><b>قرأنا البطاقة. راجع الأرقام وقارنها بالبطاقة قبل الحفظ.</b>${(d.warnings || []).length ? `<ul style="margin:6px 0 0;padding-inline-start:18px">${d.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}</div>` : `<div class="card">${nfDrop()}</div>`}
  <div class="card"><div class="nf-grid"><label>عام النتائج (هـ)<input data-p="year" value="${esc(d.year)}" placeholder="1447" dir="ltr"></label></div>
    <p style="margin:12px 0 6px"><b>الصفوف المختبرة في مدرستك</b></p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${Object.entries(NM().grades).map(([k, g]) => `<label class="pill nf-chip"><input type="checkbox" ${d.grades.some((x) => x.grade === k) ? 'checked' : ''} onchange="nfToggle('${k}', this.checked)"> ${esc(g.name)}</label>`).join('')}</div></div>
  ${d.grades.map((g, gi) => `<div class="card nf-grade"><h2 style="font-size:18px;margin-top:0">${esc(NM().grades[g.grade].name)}</h2>
    <div class="nf-grid"><label>عدد طلاب الصف (من نور)${nfIn(`${gi}.students`, g.students)}</label><label>عدد المختبرين${nfIn(`${gi}.tested`, g.tested)}</label><label>المؤشر الجامع${nfIn(`${gi}.index`, g.index)}</label><label>المؤشر الجامع العام الماضي <small class="muted">اختياري</small>${nfIn(`${gi}.index_last`, g.index_last)}</label></div>
    ${g.subjects.map((s, si) => sub(s, gi, si)).join('')}</div>`).join('')}
  <p class="muted" style="font-size:13px">أسماء المجالات جاهزة من بطاقة حقيقية للثالث المتوسط. لو اختلفت في بطاقتك عدّلها أو احذفها. ولو عندك الأرقام في Excel، انسخ الأعمدة (المجال، المدرسة، الإدارة، المملكة) والصقها.</p>`;
  view.querySelectorAll('input[data-p]').forEach((el) => { el.oninput = () => { nfSet(el.dataset.p, el.value); nfSave(); }; });
  nfDropBind();
  $('#nfsave').onclick = async (e) => {
    busy(e.target, true, 'نحلل البطاقة...');
    try {
      const r = await api('/api/school/nafis', { method: 'PUT', body: S.nf });
      const p = await api('/api/school/nafis/plan', { method: 'POST' });
      S.data.nafis = p.nafis; S.nf = null; nfClear(); toast('تم بناء الخطة العلاجية'); nafis();
    } catch (err) { toast(err.message); busy(e.target, false); if (err.code === 'license') { await load(); nafis(); } }
  };
}
function nfSet(path, v) {
  if (path === 'year') { S.nf.year = v; return; }
  const p = path.split('.');
  const g = S.nf.grades[p[0]];
  if (p.length === 2) { g[p[1]] = v; return; }
  const s = g.subjects[p[1]];
  if (p[2] === 'd') s.domains[p[3]][p[4]] = v; else s[p[2]] = v;
}
window.nfToggle = (k, on) => { S.nf.grades = on ? [...S.nf.grades, nfGrade(k)].sort((a, b) => Object.keys(NM().grades).indexOf(a.grade) - Object.keys(NM().grades).indexOf(b.grade)) : S.nf.grades.filter((g) => g.grade !== k); nfSave(); nafisEntry(); };
window.nfAddDom = (gi, si) => { S.nf.grades[gi].subjects[si].domains.push({ name: '', school: '', office: '', ksa: '' }); nfSave(); nafisEntry(); };
window.nfDelDom = (gi, si, di) => { S.nf.grades[gi].subjects[si].domains.splice(di, 1); nfSave(); nafisEntry(); };
window.nfCancel = () => { S.nf = null; nfClear(); nafis(); };
// لصق صفوف من Excel: المجال ثم الأرقام. رقمان = المدرسة والمملكة، ثلاثة = المدرسة والإدارة والمملكة
window.nfPaste = (gi, si) => {
  const t = prompt('الصق الصفوف هنا (كل مجال في سطر: الاسم ثم نسبة المدرسة والإدارة والمملكة)');
  if (!t) return;
  const rows = t.split(/\r?\n/).map((l) => l.split(/\t|,|؛|;/).map((x) => x.trim()).filter(Boolean)).filter((c) => c.length >= 3);
  if (!rows.length) return toast('ما لقينا صفوفاً بالشكل المطلوب');
  S.nf.grades[gi].subjects[si].domains = rows.slice(0, 8).map((c) => { const n = c.slice(1).map((x) => x.replace('%', '')); return n.length >= 3 ? { name: c[0], school: n[0], office: n[1], ksa: n[2] } : { name: c[0], school: n[0], office: '', ksa: n[1] }; });
  nfSave(); nafisEntry(); toast(`تم لصق ${rows.length} مجال`);
};
window.nfStart = (fromCard) => { S.nf = nfDraftFrom(fromCard ? S.data.nafis.card : null); nfSave(); nafisEntry(); };
window.nfSample = async (btn) => {
  busy(btn, true, 'نجهز النموذج...');
  try { const { card } = await api('/api/school/nafis/sample'); await api('/api/school/nafis', { method: 'PUT', body: card }); const p = await api('/api/school/nafis/plan', { method: 'POST' }); S.data.nafis = p.nafis; nafis(); }
  catch (e) { toast(e.message); busy(btn, false); }
};
function nfRow(r, i, editable) {
  return `<div class="card row-card" id="nrow${i}"><div class="top"><div><span class="muted" style="font-size:13px">${esc(r.subject_name)} · ${esc(r.grade_name)}</span><h3>${esc(r.domain)}</h3></div>
    <div style="text-align:left"><div class="pct">${pc(r.school)} <small class="muted" style="font-size:13px">← ${pc(r.target)}</small></div>${nfTag(r.cls)} <span class="pill">المملكة ${pc(r.ksa)}</span></div></div>
    <dl><dt>الإجراءات العلاجية</dt><dd><ol>${r.actions.map((x) => `<li>${esc(x.text)}${x.when ? ` <span class="when">${esc(x.when)}</span>` : ''}</li>`).join('')}</ol></dd>
    <dt>المسؤول</dt><dd>${esc(r.owner)}</dd><dt>مؤشر المتابعة</dt><dd>${esc(r.measure)}</dd>
    ${r.pack ? `<dt>محتوى علاجي جاهز</dt><dd>${r.pack.sheets.map((w) => `<span class="pill">ورقة ${w.n}: ${esc(w.t)}</span>`).join(' ')}<div style="margin-top:6px;font-size:13px">من <a href="${esc(r.pack.url)}" target="_blank" rel="noopener">${esc(r.pack.name)}</a>، ومعها الواجب الإلكتروني لكل مهارة</div></dd>` : ''}</dl>
    ${editable ? `<button class="btn ghost sm" style="margin-top:10px" onclick="nfEdit(${i})">✏️ تعديل</button>` : ''}</div>`;
}
window.nfEdit = (i) => {
  const r = S.data.nafis.plan.rows[i];
  const box = $(`#nrow${i}`);
  box.innerHTML = `<h3>${esc(r.domain)} <span class="muted" style="font-size:13px">${esc(r.subject_name)}</span></h3><form id="nef">
    <div class="field"><label>الإجراءات (كل إجراء في سطر، والتوقيت بعد علامة |)</label><textarea name="actions" style="min-height:130px">${esc(r.actions.map((x) => `${x.text}${x.when ? ` | ${x.when}` : ''}`).join('\n'))}</textarea></div>
    <div class="grid g2"><div class="field"><label>المسؤول</label><input name="owner" value="${esc(r.owner)}"></div><div class="field"><label>المستهدف %</label><input name="target" value="${esc(r.target)}" dir="ltr"></div></div>
    <div class="field"><label>مؤشر المتابعة</label><input name="measure" value="${esc(r.measure)}"></div>
    <button class="btn">حفظ</button> <button type="button" class="btn ghost" onclick="nafis()">إلغاء</button></form>`;
  $('#nef').onsubmit = async (e) => {
    e.preventDefault();
    try { const res = await api(`/api/school/nafis/plan/rows/${i}`, { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); S.data.nafis = res.nafis; toast('تم الحفظ'); box.outerHTML = nfRow(res.nafis.plan.rows[i], i, true); }
    catch (err) { toast(err.message); }
  };
};
function nafis() {
  if (!S.nf) S.nf = nfLoad();
  if (S.nf) return nafisEntry();
  const { card, plan: p, analysis: a } = S.data.nafis;
  const full = nfOk();
  if (!card) {
    view.innerHTML = `<div class="card" style="max-width:760px;margin:auto;text-align:center"><h1 style="font-size:24px">🎯 الخطة العلاجية لنافس</h1>
    <p class="muted">ارفع «بطاقة الأداء المدرسي» لنافس من منصة تميز، ونطلع لك تحليل كل مادة ومجال فرعي مقارنة بالإدارة والمملكة، وخطة علاجية جاهزة للطباعة وWord، وملخصاً تنفيذياً للقائد.</p>
    ${nfDrop()}
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn ${S.data.reader ? 'ghost' : ''}" onclick="nfStart()">أدخل الأرقام يدوياً</button><button class="btn soft" onclick="nfSample(this)">شوف نموذجاً جاهزاً</button></div>
    <p class="muted" style="font-size:13px;margin-bottom:0">النموذج مبني على بطاقة مدرسة متوسطة حقيقية بعد إخفاء بياناتها.</p></div>`;
    nfDropBind();
    return;
  }
  const stale = p && p.trial && !p.sample && full;
  const grades = a.grades.map((g) => `<div class="card"><h2 style="font-size:18px;margin-top:0">${esc(g.name)}</h2>
    <p class="muted" style="margin-top:0">المختبرون ${g.tested ?? '-'} من ${g.students ?? '-'} (المشاركة ${pc(g.participation)})${g.index != null ? ` · المؤشر الجامع ${g.index}${g.change != null ? ` (${sgn(g.change)})` : ''}` : ''}</p>
    <div class="stats">${g.subjects.map((s) => `<div class="card stat">${esc(s.name)}<b>${pc(s.mastery)}</b><span class="muted" style="font-size:12px">المملكة ${pc(s.ksa)} · ${sgn(s.gap)}</span><span class="muted" style="font-size:12px;display:block">المستهدف ${pc(s.target)}${s.target_gap != null ? ` · باقي ${s.target_gap} نقطة` : ''}</span><div>${nfTag(s.cls)}</div></div>`).join('')}</div>
    <table class="tbl" style="margin-top:10px"><thead><tr><th>المجال</th><th>المادة</th><th>المدرسة</th><th>المملكة</th><th>الفرق</th><th>التصنيف</th></tr></thead><tbody>
    ${g.subjects.flatMap((s) => s.domains.map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(s.name)}</td><td><b>${pc(d.school)}</b></td><td>${pc(d.ksa)}</td><td>${sgn(d.gap)}</td><td>${nfTag(d.cls)}</td></tr>`)).join('')}</tbody></table></div>`).join('');
  view.innerHTML = `${full ? '' : `<div class="banner trial"><span>${p && p.sample ? 'هذا نموذج للعرض.' : 'أنت في وضع التجربة: تشوف التحليل كامل وأول 3 مجالات من الخطة.'} فعّل باقة نافس للخطة كاملة وWord.</span><a class="btn sm" href="#/license">فعّل الباقة</a></div>`}
  <div class="head"><div><h1 style="margin:0">الخطة العلاجية لنافس</h1><p class="muted" style="margin:0">${card.year ? `نتائج ${esc(card.year)}هـ · ` : ''}${a.counts.urgent} أولوية عاجلة · ${a.counts.improve} يحتاج تحسيناً · ${a.counts.strength} نقطة قوة</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${p ? `<a class="btn ghost" href="/school/print/nafis" target="_blank">🖨️ PDF للطباعة</a>${full && !p.trial ? '<a class="btn ghost" href="/school/export/nafis.docx">📝 Word</a>' : ''}` : ''}
    <button class="btn ghost" onclick="nfStart(${card.sample ? '' : 'true'})">${card.sample ? 'أدخل بطاقة مدرستك' : '✏️ تعديل الأرقام'}</button>${!p || stale ? `<button class="btn" id="nfgen">${p ? 'ابنِ الخطة كاملة' : 'ابنِ الخطة'}</button>` : ''}</div></div>
  ${card.sample ? '<div class="banner trial"><span>هذا نموذج على بطاقة مدرسة حقيقية (مخفية البيانات). جاهز تسويها لمدرستك؟</span><button class="btn sm" onclick="nfStart()">أدخل بطاقة مدرستك</button></div>' : ''}
  ${grades}
  ${p ? `<div class="card"><h2 style="font-size:18px;margin-top:0">الملخص التنفيذي</h2><ul>${p.summary.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    ${p.summary.decision ? `<p><b>القرار المقترح:</b> ${esc(p.summary.decision)}</p>` : ''}<ol>${p.summary.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
  <h2 style="font-size:20px">الخطة العلاجية (${p.total} مجال)</h2>
  ${p.rows.map((r, i) => nfRow(r, i, full && !p.trial)).join('') || '<div class="card">كل المجالات أعلى من متوسط المملكة. الخطة إثرائية.</div>'}
  ${p.limited ? `<div class="card" style="text-align:center;border-style:dashed"><h3>باقي ${p.total - p.rows.length} مجال في خطتك</h3><p class="muted">فعّل باقة نافس وتطلع لك الخطة كاملة بملف Word وPDF بدون علامة مائية.</p><a class="btn" href="#/license">فعّل الباقة</a></div>` : ''}
  <div class="card"><h3 style="margin-top:0">إجراءات على مستوى المدرسة</h3><ol>${p.school_actions.map((x) => `<li>${esc(x.text)} <span class="muted" style="font-size:13px">(${esc(x.owner)})</span></li>`).join('')}</ol></div>
  ${full && !p.trial ? `<div class="card"><h3 style="margin-top:0">التوصيات</h3><p class="muted" style="margin-top:0;font-size:13px">اختياري، تظهر في آخر الخطة. كل توصية في سطر.</p><form id="nrecf"><textarea name="recommendations" style="min-height:90px">${esc(p.recommendations || '')}</textarea><button class="btn sm" style="margin-top:8px">حفظ التوصيات</button></form></div>` : ''}` : ''}`;
  if ($('#nrecf')) $('#nrecf').onsubmit = async (e) => { e.preventDefault(); try { const r = await api('/api/school/nafis/plan/recommendations', { method: 'PUT', body: { recommendations: e.target.recommendations.value } }); S.data.nafis = r.nafis; toast('تم حفظ التوصيات'); } catch (err) { toast(err.message); } };
  if ($('#nfgen')) $('#nfgen').onclick = async (e) => {
    busy(e.target, true, 'نبني الخطة...');
    try { const r = await api('/api/school/nafis/plan', { method: 'POST' }); S.data.nafis = r.nafis; toast('تم بناء الخطة'); nafis(); }
    catch (err) { toast(err.message); busy(e.target, false); if (err.code === 'license') location.hash = '#/license'; }
  };
}

// ---------- ملف شواهد التقويم ----------
const EV = { data: null, open: new Set(), filter: 'all', form: null, teachers: null };
const evSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`);
function evItem(x) {
  const links = [];
  if (x.file) links.push(`<a class="evlink" href="/school/evidence/file/${x.id}" target="_blank">📄 ${esc(x.file.name)} <span class="muted">(${evSize(x.file.size)})</span></a>`);
  if (x.url) links.push(`<a class="evlink" href="${esc(x.url)}" target="_blank" rel="noopener">🔗 الرابط</a>`);
  if (x.teacher && x.teacher.verify) links.push(`<a class="evlink" href="/v/${esc(x.teacher.verify)}" target="_blank">✔ ${esc(x.teacher.name)} · <bdi dir="ltr">${esc(x.teacher.verify)}</bdi></a>`);
  return `<li class="ev-it"><div><b>${esc(x.title)}</b> <span class="pill">${esc(x.kind_name)}</span>${x.note ? `<div class="muted" style="font-size:13px">${esc(x.note)}</div>` : ''}<div class="pmeta">${links.join('')}</div></div><button class="btn ghost sm" onclick="evDel(${x.id})" title="حذف">🗑️</button></li>`;
}
function evForm(code, item) {
  const ind = EV.data.file.indicators.find((i) => i.code === code);
  const sg = item >= 0 ? ind.suggestions[item] : null;
  const kinds = Object.entries(EV.data.kinds).map(([k, v]) => `<option value="${k}" ${(sg ? sg.kind : 'doc') === k ? 'selected' : ''}>${v}</option>`).join('');
  const tl = EV.teachers;
  return `<form class="ev-form card" id="evf" onsubmit="evSubmit(event, '${code}', ${item})">
    <div class="grid g2"><div class="field"><label>عنوان الشاهد</label><input name="title" value="${esc(sg ? sg.title : '')}" required maxlength="200"></div><div class="field"><label>النوع</label><select name="kind">${kinds}</select></div></div>
    <div class="grid g2"><div class="field"><label>الملف (PDF أو صورة أو Word أو Excel أو عرض، حتى 10MB)</label><input type="file" name="file" accept=".pdf,image/*,.docx,.xlsx,.pptx"></div><div class="field"><label>أو رابط (Drive، يوتيوب، موقع المدرسة)</label><input name="url" dir="ltr" placeholder="https://"></div></div>
    <div class="field"><label>أو اربطه بشاهد من ملف معلم في الفريق</label>${tl ? (tl.length ? `<select name="evidence_id"><option value="">بدون</option>${tl.map((e) => `<option value="${e.id}">${esc(e.full_name)}: ${esc(e.title)}</option>`).join('')}</select>` : '<p class="muted" style="margin:0;font-size:13px">ما فيه شواهد لمعلمين مسجلين في <a href="#/team">الفريق</a> للحين.</p>') : '<button type="button" class="btn ghost sm" onclick="evTeachers()">اعرض شواهد المعلمين</button>'}</div>
    <div class="field"><label>وصف مختصر (اختياري)</label><textarea name="note" maxlength="1000" style="min-height:60px"></textarea></div>
    <p class="privacy-note">🔒 قبل الرفع: اخفِ أسماء الطلاب الكاملة وأرقام هوياتهم ودرجاتهم الفردية، وغطّ وجوه الطلاب في الصور. ملف الشواهد ممكن يوصل لفريق التقويم برابط. <a href="/privacy#privacy" target="_blank">التفاصيل</a></p>
    <button class="btn">حفظ الشاهد</button> <button type="button" class="btn ghost" onclick="evCancel()">إلغاء</button></form>`;
}
function evInd(i) {
  const open = EV.open.has(i.code) || (EV.form && EV.form.code === i.code);
  const f = EV.form && EV.form.code === i.code ? evForm(i.code, EV.form.item) : '';
  return `<details class="card ev-ind ${i.covered ? 'ok' : 'miss'}" data-code="${i.code}" ${open ? 'open' : ''} ontoggle="evToggle(this)">
  <summary><bdi dir="ltr" class="ev-code">${esc(i.code)}</bdi><span class="ev-t">${esc(i.text)}</span><span class="ev-n">${i.count}</span></summary>
  <div class="ev-body">
    <h4>الشواهد المقترحة <span class="muted" style="font-weight:400;font-size:13px">(${i.sugg_done} من ${i.suggestions.length})</span></h4>
    <ul class="ev-sugg">${i.suggestions.map((s) => `<li class="${s.done ? 'done' : ''}"><span>${s.done ? '✅' : '⬜'}</span><span class="st">${esc(s.title)} <span class="muted" style="font-size:12px">(${esc(s.kind_name)})</span></span>${s.done ? '' : `<button class="btn soft sm" onclick="evAdd('${i.code}', ${s.i})">+ أضف</button>`}</li>`).join('')}</ul>
    ${i.items.length || i.auto.length ? `<h4>المرفوع (${i.count})</h4><ul class="ev-list">${i.items.map(evItem).join('')}${i.auto.map((a) => `<li class="ev-it"><div><b>${esc(a.title)}</b> <span class="pill">من خطة التحسين</span><div class="muted" style="font-size:13px">${esc(a.teacher || '')} · ${esc(a.proc)}</div><div class="pmeta"><a class="evlink" href="/v/${esc(a.verify)}" target="_blank">✔ <bdi dir="ltr">${esc(a.verify)}</bdi></a></div></div></li>`).join('')}</ul>` : ''}
    ${f || `<button class="btn ghost sm" onclick="evAdd('${i.code}', -1)">+ شاهد آخر</button>`}
  </div></details>`;
}
function evidenceView() {
  const { file: F, licensed, trial_limit: lim, link } = EV.data;
  const q = EV.filter;
  const doms = F.domains.map((d) => `<button class="card ev-dom ${q === d.code ? 'on' : ''}" onclick="evFilter('${d.code}')"><b>${esc(d.name)}</b><span class="muted" style="font-size:13px">${d.covered} من ${d.total} مؤشر · ${d.evidence} شاهد</span><div class="bar"><i style="width:${d.pct}%"></i></div></button>`).join('');
  const show = F.indicators.filter((i) => q === 'all' || (q === 'miss' ? !i.covered : i.domain === q));
  const body = F.standards.map((s) => { const xs = show.filter((i) => i.standard === s.code); return xs.length ? `<h3 class="std-h">معيار ${esc(s.name)} <span class="muted" style="font-weight:400;font-size:13px">${s.covered} من ${s.total}</span></h3>${xs.map(evInd).join('')}` : ''; }).join('') || '<div class="card" style="text-align:center">🎉 كل المؤشرات تحتها شواهد.</div>';
  const full = link ? location.origin + link : '';
  view.innerHTML = `${licensed ? '' : `<div class="banner trial"><span>وضع التجربة: تقدر تضيف ${lim} شواهد وتشوف الفهرس بعلامة مائية. فعّل باقة ملف الشواهد لعدد مفتوح ورابط المقيّم وWord.</span><a class="btn sm" href="#/license">فعّل الباقة</a></div>`}
  <div class="head"><div><h1 style="margin:0">ملف شواهد التقويم</h1><p class="muted" style="margin:0">كل مؤشر من مؤشرات التقويم المدرسي (${F.total} مؤشر) وتحته شواهده. الشواهد المقترحة اجتهاد منا يساعدك ترتب، وأضف أي شاهد عندك.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn ghost" href="/school/print/evidence" target="_blank">🖨️ فهرس PDF</a>${licensed ? '<a class="btn ghost" href="/school/export/evidence.docx">📝 Word</a>' : ''}</div></div>
  <div class="stats"><div class="card stat">نسبة التغطية<b>${F.pct}%</b></div><div class="card stat">المؤشرات المغطاة<b>${F.covered} / ${F.total}</b></div><div class="card stat">الشواهد<b>${F.evidence}</b></div><div class="card stat">بدون شاهد<b style="color:${F.missing.length ? 'var(--danger)' : 'inherit'}">${F.missing.length}</b></div></div>
  <div class="card ev-link" style="margin-bottom:14px"><h3 style="margin:0 0 4px">🔗 رابط المقيّم</h3>
    ${licensed ? (link ? `<p class="muted" style="margin:0 0 8px;font-size:13px">رابط واحد يفتح الملف كامل للقراءة فقط. الباركود مطبوع في أول صفحة من الفهرس.</p><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input readonly value="${esc(full)}" dir="ltr" style="flex:1;min-width:220px" id="evurl"><button class="btn ghost sm" onclick="navigator.clipboard.writeText($('#evurl').value).then(()=>toast('تم النسخ'))">نسخ</button><a class="btn ghost sm" href="${esc(link)}" target="_blank">فتح</a><button class="btn ghost sm" onclick="evLink('reset')">رابط جديد</button><button class="btn ghost sm" onclick="evLink('off')">إيقاف</button></div>`
      : '<p class="muted" style="margin:0 0 8px;font-size:13px">فعّل الرابط عشان يطلع الباركود في الفهرس ويقدر المقيّم يفتح الشواهد من جواله.</p><button class="btn sm" onclick="evLink(\'on\')">فعّل رابط المقيّم</button>')
      : '<p class="muted" style="margin:0;font-size:13px">الرابط والباركود يتفعلون مع باقة ملف الشواهد.</p>'}</div>
  <div class="ev-doms">${doms}</div>
  <div class="ev-tabs"><button class="btn sm ${q === 'all' ? '' : 'ghost'}" onclick="evFilter('all')">كل المؤشرات</button><button class="btn sm ${q === 'miss' ? '' : 'ghost'}" onclick="evFilter('miss')">النواقص فقط (${F.missing.length})</button></div>
  ${body}`;
}
async function evidence() {
  view.innerHTML = '<div class="card" style="text-align:center"><span class="spin"></span> نجهز الملف...</div>';
  try { EV.data = await api('/api/school/evidence'); evidenceView(); } catch (e) { toast(e.message); }
}
window.evToggle = (el) => { if (el.open) EV.open.add(el.dataset.code); else EV.open.delete(el.dataset.code); };
window.evFilter = (q) => { EV.filter = EV.filter === q && q !== 'all' ? 'all' : q; evidenceView(); };
window.evAdd = (code, item) => { EV.form = { code, item }; EV.open.add(code); evidenceView(); const f = $('#evf'); if (f) f.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
window.evCancel = () => { EV.form = null; evidenceView(); };
window.evTeachers = async () => { try { EV.teachers = (await api('/api/school/evidence/teachers')).evidences; evidenceView(); } catch (e) { toast(e.message); } };
window.evSubmit = async (e, code, item) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  fd.append('code', code); fd.append('item', item);
  if (fd.get('file') && !fd.get('file').size) fd.delete('file');
  const btn = e.target.querySelector('button'); busy(btn, true, 'نحفظ...');
  try { EV.data = await api('/api/school/evidence', { method: 'POST', body: fd }); EV.form = null; toast('تمت إضافة الشاهد'); evidenceView(); }
  catch (err) { toast(err.message); busy(btn, false); if (err.code === 'license') location.hash = '#/license'; }
};
window.evDel = async (id) => {
  if (!confirm('نحذف الشاهد؟ الملف المرفق ينحذف معه.')) return;
  try { EV.data = await api(`/api/school/evidence/${id}`, { method: 'DELETE' }); evidenceView(); } catch (e) { toast(e.message); }
};
window.evLink = async (action) => {
  if (action === 'reset' && !confirm('الرابط القديم والباركود المطبوع يتوقفون. نكمل؟')) return;
  try { EV.data = await api('/api/school/evidence/link', { method: 'POST', body: { action } }); evidenceView(); toast(action === 'off' ? 'تم إيقاف الرابط' : 'الرابط جاهز'); } catch (e) { toast(e.message); }
};

async function route() {
  const p = (location.hash.slice(2) || '').split('?')[0];
  if (!S.data) { try { await load(); } catch { return; } }
  topbar(p);
  window.scrollTo(0, 0);
  ({ '': home, profile, report, plan, ops, nafis, evidence, board, team, license }[p] || home)();
}
window.addEventListener('hashchange', route);
route();
