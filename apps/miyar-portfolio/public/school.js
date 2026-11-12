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
    if (r.status === 401) { sessionStorage.setItem('miyar-next', '/school' + location.hash); location.href = '/app#/login'; }
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
  $('#top').innerHTML = `<div class="topbar"><div class="wrap"><a class="logo" href="#/"><b>م</b><span class="lbl">معياري للمدرسة</span></a>
  <nav class="nav">${l('', '🏠', 'الرئيسية')}${l('profile', '🏫', 'المدرسة')}${l('report', '📊', 'التقرير')}${l('plan', '📋', 'خطة التحسين')}${l('nafis', '🎯', 'نافس')}${l('team', '👥', 'الفريق')}${l('license', '⭐', 'الباقة')}<button onclick="toggleDark()" title="الوضع الليلي">🌙</button></nav></div></div>`;
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
  <a class="card" href="#/nafis" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;margin-bottom:14px"><span style="font-size:28px">🎯</span><div><b>الخطة العلاجية لنافس</b><p class="muted" style="margin:0;font-size:14px">${S.data.nafis && S.data.nafis.plan ? `خطتك جاهزة: ${S.data.nafis.plan.total} مجال في الخطة` : 'أدخل أرقام بطاقة نافس، وتطلع لك خطة علاجية لكل مادة ومجال'}</p></div></a>
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
    <div class="field"><label>دعم المشرف التربوي (إن وجد)</label><input name="supervisor" value="${esc(r.supervisor || '')}" placeholder="مثال: زيارة إشرافية وورشة للمعلمين"></div></div>
    <div class="field"><label>ملاحظة المتابعة أو سبب التأخر</label><input name="note" value="${esc(r.note || '')}"></div>
    <button class="btn">حفظ</button> <button type="button" class="btn ghost" onclick="plan()">إلغاء</button>
  </form>`;
  $(`#ef${i}`).onsubmit = async (e) => {
    e.preventDefault();
    try { const res = await api(`/api/school/plan/rows/${i}`, { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); S.data.plan = res.plan; toast('تم الحفظ'); box.outerHTML = rowCard(res.plan.rows[i], i, true); }
    catch (err) { toast(err.message); }
  };
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
  return old || { grade: key, students: '', tested: '', index: '', index_last: '', subjects: g.subjects.map((s) => ({ subject: s, mastery: '', office: '', ksa: '', last: '', mean: '', domains: NM().domains[s].map((name) => ({ name, school: '', office: '', ksa: '' })) })) };
}
function nfDraftFrom(card) {
  const c = JSON.parse(JSON.stringify(card || { year: '', grades: [] }));
  delete c.sample;
  c.grades = c.grades.map((g) => nfGrade(g.grade, { ...g, subjects: nfGrade(g.grade).subjects.map((d) => { const s = g.subjects.find((x) => x.subject === d.subject); return s ? { ...d, ...s, domains: s.domains.length ? s.domains : d.domains } : d; }) }));
  if (!c.grades.length) c.grades = [nfGrade('g3m')];
  return c;
}
const nfIn = (path, v, ph = '') => `<input data-p="${path}" value="${esc(v ?? '')}" inputmode="decimal" placeholder="${ph}" dir="ltr">`;
function nafisEntry() {
  const d = S.nf;
  const sub = (s, gi, si) => `<div class="nf-sub">
    <h4>${esc(NM().subjects[s.subject].name)}</h4>
    <div class="nf-grid"><label>إتقان المدرسة %${nfIn(`${gi}.${si}.mastery`, s.mastery)}</label><label>الإدارة %${nfIn(`${gi}.${si}.office`, s.office)}</label><label>المملكة %${nfIn(`${gi}.${si}.ksa`, s.ksa)}</label><label>العام الماضي % <small class="muted">اختياري</small>${nfIn(`${gi}.${si}.last`, s.last)}</label></div>
    <table class="tbl nf-dom"><thead><tr><th>المجال الفرعي (كما في البطاقة)</th><th>المدرسة %</th><th>الإدارة %</th><th>المملكة %</th><th></th></tr></thead><tbody>
    ${s.domains.map((x, di) => `<tr><td><input data-p="${gi}.${si}.d.${di}.name" value="${esc(x.name)}"></td><td>${nfIn(`${gi}.${si}.d.${di}.school`, x.school)}</td><td>${nfIn(`${gi}.${si}.d.${di}.office`, x.office)}</td><td>${nfIn(`${gi}.${si}.d.${di}.ksa`, x.ksa)}</td><td><button type="button" class="btn ghost sm" onclick="nfDelDom(${gi},${si},${di})" title="حذف">✕</button></td></tr>`).join('')}
    </tbody></table>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button type="button" class="btn ghost sm" onclick="nfAddDom(${gi},${si})">+ مجال</button><button type="button" class="btn ghost sm" onclick="nfPaste(${gi},${si})">📋 لصق من Excel</button></div>
  </div>`;
  view.innerHTML = `<div class="head"><div><h1 style="margin:0">بطاقة نافس</h1><p class="muted" style="margin:0">انقل الأرقام من «بطاقة الأداء المدرسي» في منصة تميز. نحفظ ما تكتبه في جهازك أولاً بأول.</p></div>
    <div style="display:flex;gap:8px">${S.data.nafis.card ? '<button class="btn ghost" onclick="nfCancel()">إلغاء</button>' : ''}<button class="btn" id="nfsave">حفظ وبناء الخطة</button></div></div>
  <div class="card"><div class="nf-grid"><label>عام النتائج (هـ)<input data-p="year" value="${esc(d.year)}" placeholder="1447" dir="ltr"></label></div>
    <p style="margin:12px 0 6px"><b>الصفوف المختبرة في مدرستك</b></p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${Object.entries(NM().grades).map(([k, g]) => `<label class="pill nf-chip"><input type="checkbox" ${d.grades.some((x) => x.grade === k) ? 'checked' : ''} onchange="nfToggle('${k}', this.checked)"> ${esc(g.name)}</label>`).join('')}</div></div>
  ${d.grades.map((g, gi) => `<div class="card nf-grade"><h2 style="font-size:18px;margin-top:0">${esc(NM().grades[g.grade].name)}</h2>
    <div class="nf-grid"><label>عدد طلاب الصف (من نور)${nfIn(`${gi}.students`, g.students)}</label><label>عدد المختبرين${nfIn(`${gi}.tested`, g.tested)}</label><label>المؤشر الجامع${nfIn(`${gi}.index`, g.index)}</label><label>المؤشر الجامع العام الماضي <small class="muted">اختياري</small>${nfIn(`${gi}.index_last`, g.index_last)}</label></div>
    ${g.subjects.map((s, si) => sub(s, gi, si)).join('')}</div>`).join('')}
  <p class="muted" style="font-size:13px">أسماء المجالات جاهزة من بطاقة حقيقية للثالث المتوسط. لو اختلفت في بطاقتك عدّلها أو احذفها. ولو عندك الأرقام في Excel، انسخ الأعمدة (المجال، المدرسة، الإدارة، المملكة) والصقها.</p>`;
  view.querySelectorAll('input[data-p]').forEach((el) => { el.oninput = () => { nfSet(el.dataset.p, el.value); nfSave(); }; });
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
    <dt>المسؤول</dt><dd>${esc(r.owner)}</dd><dt>مؤشر المتابعة</dt><dd>${esc(r.measure)}</dd></dl>
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
    <p class="muted">أدخل أرقام «بطاقة الأداء المدرسي» من منصة تميز، ونطلع لك تحليل كل مادة ومجال فرعي مقارنة بالإدارة والمملكة، وخطة علاجية جاهزة للطباعة وWord، وملخصاً تنفيذياً للقائد.</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn" onclick="nfStart()">أدخل بطاقة مدرستك</button><button class="btn soft" onclick="nfSample(this)">شوف نموذجاً جاهزاً</button></div>
    <p class="muted" style="font-size:13px;margin-bottom:0">النموذج مبني على بطاقة مدرسة متوسطة حقيقية بعد إخفاء بياناتها.</p></div>`;
    return;
  }
  const stale = p && p.trial && !p.sample && full;
  const grades = a.grades.map((g) => `<div class="card"><h2 style="font-size:18px;margin-top:0">${esc(g.name)}</h2>
    <p class="muted" style="margin-top:0">المختبرون ${g.tested ?? '-'} من ${g.students ?? '-'} (المشاركة ${pc(g.participation)})${g.index != null ? ` · المؤشر الجامع ${g.index}${g.change != null ? ` (${sgn(g.change)})` : ''}` : ''}</p>
    <div class="stats">${g.subjects.map((s) => `<div class="card stat">${esc(s.name)}<b>${pc(s.mastery)}</b><span class="muted" style="font-size:12px">المملكة ${pc(s.ksa)} · ${sgn(s.gap)}</span><div>${nfTag(s.cls)}</div></div>`).join('')}</div>
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

async function route() {
  const p = (location.hash.slice(2) || '').split('?')[0];
  if (!S.data) { try { await load(); } catch { return; } }
  topbar(p);
  window.scrollTo(0, 0);
  ({ '': home, profile, report, plan, nafis, team, license }[p] || home)();
}
window.addEventListener('hashchange', route);
route();
