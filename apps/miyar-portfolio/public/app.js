/* معياري للمعلم - واجهة التطبيق */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const S = { me: null, standards: [], evs: [], ai: false, base: '', storeUrl: '', plans: [] };
const COLORS = { miyar: '#0f766e', navy: '#1e3a8a', violet: '#5b21b6', rose: '#9f1239', gold: '#8a5a00', slate: '#334155' };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
async function api(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: {} };
  if (opts.body instanceof FormData) o.body = opts.body;
  else if (opts.body) { o.body = JSON.stringify(opts.body); o.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(path, o);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith('/api/login')) { S.me = null; location.hash = '#/login'; }
    const err = new Error(data.error || 'حدث خطأ، حاول مرة ثانية');
    err.status = r.status;
    throw err;
  }
  return data;
}
const stdName = (id) => (S.standards.find((s) => s.id === Number(id)) || {}).name || '';
const hijri = (d) => { if (!d) return ''; try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00')); } catch { return d; } };
const today = () => new Date().toISOString().slice(0, 10);
const fem = () => S.me && S.me.gender === 'f';

function applyColor() { document.documentElement.dataset.color = (S.me && S.me.theme) || 'miyar'; }
function toggleDark() {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('miyar-theme', r.dataset.theme); } catch {}
}

function topbar(route) {
  if (!S.me) { $('#top').innerHTML = `<div class="topbar"><div class="wrap"><a class="logo" href="/"><b>م</b>معياري للمعلم</a><div class="nav"><button onclick="toggleDark()" title="الوضع الليلي">🌙</button></div></div></div>`; return; }
  const l = (h, ic, t) => `<a href="#/${h}" class="${route === h ? 'on' : ''}">${ic} <span class="lbl">${t}</span></a>`;
  $('#top').innerHTML = `<div class="topbar"><div class="wrap"><a class="logo" href="#/"><b>م</b><span class="lbl">معياري للمعلم</span></a>
    <nav class="nav">${l('', '🏠', 'الرئيسية')}${l('new', '➕', 'شاهد جديد')}${l('profile', '👤', 'ملفي')}${l('subscription', '⭐', 'الاشتراك')}${S.me.is_admin ? l('admin', '🛠️', 'الإدارة') : ''}<button onclick="toggleDark()" title="الوضع الليلي">🌙</button></nav></div></div>`;
}

function banner() {
  const st = S.me.status;
  if (st.plan === 'trial') return `<div class="banner trial"><span>⏳ أنت في الفترة التجريبية، باقي ${st.daysLeft} ${st.daysLeft > 10 ? 'يوم' : 'أيام'}</span><a class="btn sm" href="#/subscription">فعّل حسابك</a></div>`;
  if (st.plan === 'expired') return `<div class="banner expired"><span>انتهى اشتراكك. شواهدك محفوظة وصفحتك ظاهرة، جدّد لإكمال التوثيق والطباعة.</span><a class="btn sm" href="#/subscription">أدخل كود التفعيل</a></div>`;
  return '';
}

// ---------- الدخول والتسجيل ----------
function authView(mode) {
  view.innerHTML = `<div class="auth card">
    <div style="text-align:center;margin-bottom:12px"><a class="logo" href="/" style="font-size:22px"><b>م</b>معياري للمعلم</a><p class="muted" style="margin:6px 0 0">ملف الإنجاز والشواهد الإلكتروني</p></div>
    <div class="tabs"><a href="#/login" class="${mode === 'login' ? 'on' : ''}">تسجيل الدخول</a><a href="#/register" class="${mode === 'register' ? 'on' : ''}">حساب جديد</a></div>
    <form id="f">
      ${mode === 'register' ? `<div class="field"><label>الاسم الكامل</label><input name="full_name" required placeholder="مثال: أحمد محمد العتيبي"></div>
      <div class="field"><label>أنا</label><select name="gender"><option value="m">معلم</option><option value="f">معلمة</option></select></div>` : ''}
      <div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="email" dir="ltr"></div>
      <div class="field"><label>كلمة المرور</label><input name="password" type="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" dir="ltr"></div>
      <button class="btn" style="width:100%;justify-content:center">${mode === 'login' ? 'دخول' : 'ابدأ التجربة المجانية'}</button>
    </form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    const btn = $('button', e.target); btn.disabled = true;
    try { await api(mode === 'login' ? '/api/login' : '/api/register', { method: 'POST', body: b }); await load(); const nx = sessionStorage.getItem('miyar-next'); if (nx) { sessionStorage.removeItem('miyar-next'); location.href = nx; return; } location.hash = '#/'; }
    catch (err) { toast(err.message); btn.disabled = false; }
  };
}

// ---------- الرئيسية ----------
function dashboard() {
  const counts = Object.fromEntries(S.standards.map((s) => [s.id, S.evs.filter((e) => e.standard_id === s.id).length]));
  const covered = Object.values(counts).filter(Boolean).length;
  const score = S.standards.reduce((a, s) => a + (counts[s.id] ? s.weight : 0), 0);
  const pub = `${S.base}/p/${S.me.slug}`;
  view.innerHTML = `${banner()}
  <div class="ai-box">
    <h2>✨ وثّق شاهد جديد في دقيقة</h2>
    <p style="margin:0 0 10px;opacity:.9">اكتب فكرة الشاهد بكلمتين، والمساعد يجهّز لك العنوان والأهداف والوصف ويربطه بالعنصر المناسب.</p>
    <form class="row" id="aiq"><input name="idea" placeholder="مثال: درس عن الكسور باستخدام لعبة البطاقات" required><button class="btn">صِغها لي</button></form>
  </div>
  ${tasksCard()}
  <div class="stats">
    <div class="card stat"><b>${S.evs.length}</b>شاهد موثّق</div>
    <div class="card stat"><b>${covered}/11</b>عنصر مغطّى</div>
    <div class="card stat"><b>${score}%</b>من أوزان التقييم فيها شواهد<div class="bar" style="margin-top:6px"><i style="width:${score}%"></i></div></div>
  </div>
  <div class="card" style="margin-bottom:18px">
    <div class="head" style="margin-bottom:8px"><h3 style="margin:0">🔗 صفحتك ورابط المشاركة</h3><span class="pill">${S.me.is_public ? 'منشورة' : 'مخفية'}</span></div>
    <div class="share"><code>${esc(pub)}</code><button class="btn soft sm" id="copy">نسخ الرابط</button><a class="btn soft sm" href="${esc(pub)}" target="_blank">فتح الصفحة</a>
    <a class="btn sm" href="/print/portfolio?t=classic" target="_blank">🖨️ ملف الإنجاز PDF</a></div>
  </div>
  <div class="head"><h2 style="margin:0">عناصر تقييم الأداء الوظيفي</h2></div>
  <div class="stds">${S.standards.map((s) => `<a class="card std-card ${counts[s.id] ? 'done' : ''}" href="#/std/${s.id}">
    <div class="ic">${s.icon}</div><h3>${s.id}. ${esc(s.name)}</h3><div class="muted" style="font-size:12.5px">${esc(s.hint)}</div>
    <div class="meta"><span>الوزن ${s.weight}%</span><span>${counts[s.id] ? `✅ ${counts[s.id]} شاهد` : 'لا يوجد شاهد'}</span></div></a>`).join('')}</div>`;
  $('#aiq').onsubmit = (e) => { e.preventDefault(); sessionStorage.setItem('miyar-idea', e.target.idea.value); location.hash = '#/new'; };
  $('#copy').onclick = () => navigator.clipboard.writeText(pub).then(() => toast('تم نسخ الرابط'));
}

// ---------- عرض عنصر ----------
function standardView(id) {
  const s = S.standards.find((x) => x.id === Number(id));
  if (!s) return (location.hash = '#/');
  const items = S.evs.filter((e) => e.standard_id === s.id);
  view.innerHTML = `${banner()}<div class="head"><div><a href="#/" class="muted" style="text-decoration:none">→ العناصر</a><h1 style="margin:4px 0 0">${s.icon} ${esc(s.name)}</h1><div class="muted">الوزن ${s.weight}% · ${esc(s.hint)}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn" href="#/new?std=${s.id}">➕ إضافة شاهد</a>${items.length ? `<a class="btn ghost" target="_blank" href="/print/standard/${s.id}">🖨️ تقرير العنصر</a>` : ''}</div></div>
    <div class="ev-list">${items.map(evItem).join('') || `<div class="card" style="text-align:center"><p class="muted">ما فيه شواهد في هذا العنصر بعد.</p><a class="btn" href="#/new?std=${s.id}">أضف أول شاهد</a></div>`}</div>`;
}
function evItem(e) {
  const img = e.files.find((f) => f.mime.startsWith('image/'));
  return `<div class="card ev-item">${img ? `<img src="/files/${img.id}" alt="">` : '<div class="ph">📄</div>'}
    <div style="flex:1;min-width:0"><h3>${esc(e.title)}</h3><div class="muted" style="font-size:13px">${hijri(e.ev_date)}${e.files.length ? ` · ${e.files.length} مرفق` : ''}</div>
    ${e.description ? `<div style="font-size:14px;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(e.description)}</div>` : ''}
    <div class="acts"><a class="btn soft sm" href="#/edit/${e.id}">✏️ تعديل</a><a class="btn ghost sm" target="_blank" href="/print/evidence/${e.id}">🖨️ تقرير</a></div></div></div>`;
}

// ---------- محرر الشاهد ----------
// مهام المعلم في خطة تحسين المدرسة (يسندها قائد المدرسة من «معياري للمدرسة»)
const taskKey = (t) => `${t.school_id}:${t.i}:${t.j}`;
function tasksCard() {
  const ts = S.tasks || [];
  if (!ts.length) return '';
  const d = ts.filter((t) => t.done).length;
  const sorted = [...ts].sort((a, b) => a.done - b.done);
  return `<div class="card tasks" style="margin-bottom:18px">
    <div class="head" style="margin-bottom:6px"><h3 style="margin:0">📌 مهامي في خطة تحسين المدرسة</h3><span class="pill">${d} من ${ts.length} منجزة</span></div>
    <p class="muted" style="margin:0 0 10px;font-size:13px">أسندها لك قائد المدرسة. نفّذ الإجراء ووثّقه بشاهد، ويظهر تلقائياً في تقرير متابعة الخطة وفي ملف إنجازك.</p>
    <ul class="task-list">${sorted.map((t) => `<li class="${t.done ? 'done' : ''}">
      <div><b>${t.done ? '✅' : '○'} ${esc(t.text)}</b>${t.when ? ` <span class="pill">${esc(t.when)}</span>` : ''}
      <div class="muted" style="font-size:12.5px">${esc(t.school)}، المؤشر <bdi dir="ltr">${esc(t.indicator)}</bdi> ${esc(t.indicator_text || '')}</div>
      ${t.evidence ? `<div style="font-size:13px">📎 <a href="#/edit/${t.evidence.id}">${esc(t.evidence.title)}</a></div>` : ''}</div>
      <div class="task-act">${t.evidence ? (t.done ? '' : `<button class="btn soft sm" onclick="taskDone('${taskKey(t)}', true)">تم التنفيذ</button>`) : `<a class="btn sm" href="#/new?task=${taskKey(t)}">وثّق التنفيذ</a>${S.evs.length ? `<select class="sm" onchange="linkTask('${taskKey(t)}', this.value)" aria-label="ربط شاهد موجود"><option value="">أو اربط شاهد موجود</option>${S.evs.map((e) => `<option value="${e.id}">${esc(e.title)}</option>`).join('')}</select>` : ''}`}</div>
    </li>`).join('')}</ul></div>`;
}
async function putTask(key, body) {
  const [sid, i, j] = key.split(':');
  S.tasks = (await api(`/api/my-tasks/${sid}/${i}/${j}`, { method: 'PUT', body })).tasks;
}
window.linkTask = async (key, id) => { if (!id) return; try { await putTask(key, { evidence_id: Number(id), done: true }); toast('تم ربط الشاهد بالمهمة ✅'); dashboard(); } catch (e) { toast(e.message); } };
window.taskDone = async (key, done) => { try { await putTask(key, { done }); toast('تم ✅'); dashboard(); } catch (e) { toast(e.message); } };

function editor(id, query) {
  const e = id ? S.evs.find((x) => x.id === Number(id)) : null;
  if (id && !e) return (location.hash = '#/');
  const task = !e && query.get('task') ? (S.tasks || []).find((t) => taskKey(t) === query.get('task')) : null;
  const stdQ = Number(query.get('std')) || (e && e.standard_id) || (task && task.suggest) || '';
  const pending = [];
  view.innerHTML = `${banner()}<div class="head"><h1 style="margin:0">${e ? 'تعديل الشاهد' : task ? 'توثيق مهمة من خطة المدرسة' : 'شاهد جديد'}</h1>${e ? `<a class="btn ghost sm" target="_blank" href="/print/evidence/${e.id}">🖨️ طباعة الشاهد</a>` : ''}</div>
  <div class="ai-box">
    <h2 style="margin-bottom:6px">✨ المساعد الذكي</h2>
    <form class="row" id="aif"><input name="idea" placeholder="اكتب فكرة الشاهد بكلمتين، مثال: تواصلت مع أولياء أمور الطلاب المتأخرين" required><button class="btn" id="aib">صِغها لي</button></form>
    <div class="ai-note">${S.ai ? 'يكتب لك صياغة رسمية ويمكنك تعديلها قبل الحفظ.' : 'يعمل الآن بالقوالب الجاهزة. الصياغة بالذكاء الاصطناعي تتفعل بعد ربط مفتاح الخدمة.'}</div>
  </div>
  ${task ? `<div class="banner trial"><span>📌 ${esc(task.text)} (${esc(task.school)}، المؤشر <bdi dir="ltr">${esc(task.indicator)}</bdi>). بعد الحفظ تنحسب المهمة منجزة ويظهر الشاهد في متابعة الخطة.</span></div>` : ''}
  <form id="ef" class="card">
    <div class="grid g2">
      <div class="field"><label>عنصر التقييم</label><select name="standard_id" required><option value="">اختر العنصر</option>${S.standards.map((s) => `<option value="${s.id}" ${Number(stdQ) === s.id ? 'selected' : ''}>${s.id}. ${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>تاريخ التنفيذ</label><input type="date" name="ev_date" value="${esc(e ? e.ev_date : today())}"></div>
    </div>
    <div class="field"><label>عنوان الشاهد</label><input name="title" required value="${esc(e ? e.title : task ? task.text : '')}" placeholder="عنوان رسمي مختصر"></div>
    <div class="field"><label>الأهداف التربوية <span class="muted">(كل هدف في سطر)</span></label><textarea name="goals">${esc(e ? e.goals.join('\n') : '')}</textarea></div>
    <div class="field"><label>الوصف</label><textarea name="description">${esc(e ? e.description : task ? `تنفيذ إجراء من خطة تحسين ${task.school} للمؤشر ${task.indicator}: ${task.indicator_text || ''}` : '')}</textarea></div>
    <div class="field"><label>آلية التنفيذ</label><textarea name="steps">${esc(e && e.steps)}</textarea></div>
    <div class="field"><label>الأثر والنتائج</label><textarea name="impact" style="min-height:70px">${esc(e && e.impact)}</textarea></div>
    <div class="field"><label>روابط <span class="muted">(اختياري، كل رابط في سطر)</span></label><textarea name="links" dir="ltr" style="min-height:60px">${esc(e ? e.links.join('\n') : '')}</textarea></div>
    <div class="field"><label>الصور والملفات <span class="muted">(صور أو PDF، حتى 10 ميجا للملف)</span></label>
      <div class="drop" id="drop">📎 اضغط لاختيار صور أو ملفات PDF<input type="file" id="fi" multiple accept="image/*,application/pdf" hidden></div>
      <div class="files" id="files"></div></div>
    <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
      <button class="btn" id="save">💾 حفظ الشاهد</button>
      ${e ? '<button type="button" class="btn danger" id="del">حذف الشاهد</button>' : ''}
    </div>
  </form>`;
  const f = $('#ef');
  const renderFiles = () => {
    $('#files').innerHTML = (e ? e.files : []).map((x) => `<div class="file">${x.mime.startsWith('image/') ? `<img src="/files/${x.id}">` : '<div class="pdf">📄</div>'}<button type="button" data-del="${x.id}" title="حذف">×</button><small>${esc(x.original)}</small></div>`).join('')
      + pending.map((x, i) => `<div class="file">${x.type.startsWith('image/') ? `<img src="${URL.createObjectURL(x)}">` : '<div class="pdf">📄</div>'}<button type="button" data-rm="${i}">×</button><small>${esc(x.name)} (جديد)</small></div>`).join('');
  };
  renderFiles();
  $('#drop').onclick = () => $('#fi').click();
  $('#fi').onchange = (ev) => { pending.push(...ev.target.files); ev.target.value = ''; renderFiles(); };
  $('#files').onclick = async (ev) => {
    const d = ev.target.dataset;
    if (d.rm !== undefined) { pending.splice(Number(d.rm), 1); renderFiles(); }
    if (d.del && confirm('حذف المرفق؟')) { await api('/api/files/' + d.del, { method: 'DELETE' }); e.files = e.files.filter((x) => x.id !== Number(d.del)); renderFiles(); }
  };

  async function runAI(idea) {
    const btn = $('#aib'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> جاري الصياغة';
    try {
      const { draft } = await api('/api/ai/draft', { method: 'POST', body: { idea, standard_id: f.standard_id.value || undefined } });
      f.standard_id.value = draft.standard_id; f.title.value = draft.title; f.goals.value = (draft.goals || []).join('\n');
      f.description.value = draft.description || ''; f.steps.value = draft.steps || ''; f.impact.value = draft.impact || '';
      f.querySelectorAll('textarea').forEach(grow);
      toast(`تمت الصياغة وربطها بعنصر: ${stdName(draft.standard_id)}`);
    } catch (err) { toast(err.message); }
    btn.disabled = false; btn.textContent = 'صِغها لي';
  }
  $('#aif').onsubmit = (ev) => { ev.preventDefault(); runAI(ev.target.idea.value); };
  const idea = sessionStorage.getItem('miyar-idea');
  if (idea && !e) { sessionStorage.removeItem('miyar-idea'); $('#aif').idea.value = idea; runAI(idea); }

  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $('#save'); btn.disabled = true;
    const body = Object.fromEntries(new FormData(f));
    try {
      let { evidence } = await api(e ? `/api/evidences/${e.id}` : '/api/evidences', { method: e ? 'PUT' : 'POST', body });
      if (pending.length) {
        const fd = new FormData(); pending.forEach((x) => fd.append('files', x));
        ({ evidence } = await api(`/api/evidences/${evidence.id}/files`, { method: 'POST', body: fd }));
      }
      await loadEvs();
      if (task) {
        try { await putTask(taskKey(task), { evidence_id: evidence.id, done: true }); toast('تم حفظ الشاهد وتسجيل المهمة منجزة ✅'); }
        catch (err) { toast(`تم حفظ الشاهد، بس ما انربط بالمهمة: ${err.message}`); }
        location.hash = '#/'; return;
      }
      toast('تم حفظ الشاهد ✅');
      location.hash = `#/std/${evidence.standard_id}`;
    } catch (err) { toast(err.message); btn.disabled = false; }
  };
  if (e) $('#del').onclick = async () => {
    if (!confirm('متأكد من حذف الشاهد ومرفقاته؟')) return;
    await api(`/api/evidences/${e.id}`, { method: 'DELETE' }); await loadEvs(); toast('تم الحذف'); location.hash = `#/std/${e.standard_id}`;
  };
}

// ---------- الملف الشخصي ----------
function profile() {
  const u = S.me;
  const inp = (n, l, ph = '') => `<div class="field"><label>${l}</label><input name="${n}" value="${esc(u[n])}" placeholder="${ph}"></div>`;
  view.innerHTML = `<h1>ملفي الشخصي</h1><p class="muted" style="margin-top:0">هذه البيانات تظهر في صفحتك وفي غلاف ملف الإنجاز.</p>
  <form id="pf" class="card" style="margin-bottom:16px">
    <div class="grid g2">${inp('full_name', 'الاسم الكامل')}
      <div class="field"><label>الجنس</label><select name="gender"><option value="m" ${u.gender === 'm' ? 'selected' : ''}>معلم</option><option value="f" ${u.gender === 'f' ? 'selected' : ''}>معلمة</option></select></div>
      ${inp('job_title', 'المسمى الوظيفي', 'معلم / معلمة / وكيل / موجه طلابي')}${inp('subject', 'المادة', 'رياضيات')}
      ${inp('stage', 'المرحلة', 'المرحلة المتوسطة')}${inp('school', 'المدرسة')}
      ${inp('office', 'إدارة التعليم', 'الإدارة العامة للتعليم بمنطقة ...')}${inp('principal', 'اسم مدير المدرسة')}
      ${inp('year', 'العام الدراسي', '1448 هـ')}</div>
    <div class="field"><label>نبذة مختصرة</label><textarea name="bio" placeholder="خبرتك، مؤهلك، اهتماماتك">${esc(u.bio)}</textarea></div>
    <h3>الصفحة العامة</h3>
    <div class="grid g2"><div class="field"><label>رابط صفحتك</label><div style="display:flex;gap:6px;align-items:center;direction:ltr"><span class="muted" style="font-size:13px;white-space:nowrap">${esc(S.base)}/p/</span><input name="slug" value="${esc(u.slug)}" dir="ltr"></div></div>
      <div class="field"><label>&nbsp;</label><label class="switch"><input type="checkbox" name="is_public" ${u.is_public ? 'checked' : ''}> الصفحة منشورة ويقدر أي أحد معه الرابط يشوفها</label></div></div>
    <h3>لون الملف</h3>
    <div class="colors" id="colors">${Object.entries(COLORS).map(([k, c]) => `<button type="button" data-c="${k}" class="${u.theme === k ? 'on' : ''}" style="background:${c}" title="${k}"></button>`).join('')}</div>
    <input type="hidden" name="theme" value="${esc(u.theme)}">
    <div style="margin-top:18px"><button class="btn">💾 حفظ</button></div>
  </form>
  <form id="pw" class="card"><h3>تغيير كلمة المرور</h3><div class="grid g2"><div class="field"><label>الحالية</label><input type="password" name="current" dir="ltr"></div><div class="field"><label>الجديدة</label><input type="password" name="next" minlength="6" dir="ltr"></div></div>
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><button class="btn ghost">تغيير</button><button type="button" class="btn danger" id="out">تسجيل الخروج</button></div></form>`;
  const f = $('#pf');
  $('#colors').onclick = (e) => { const c = e.target.dataset.c; if (!c) return; f.theme.value = c; document.documentElement.dataset.color = c; [...$('#colors').children].forEach((b) => b.classList.toggle('on', b.dataset.c === c)); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(f)); b.is_public = f.is_public.checked;
    try { ({ user: S.me } = await api('/api/me', { method: 'PUT', body: b })); applyColor(); toast('تم الحفظ ✅'); } catch (err) { toast(err.message); }
  };
  $('#pw').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('تم تغيير كلمة المرور'); } catch (err) { toast(err.message); } };
  $('#out').onclick = async () => { await api('/api/logout', { method: 'POST' }); S.me = null; location.hash = '#/login'; };
}

// ---------- الاشتراك ----------
function subscription() {
  const st = S.me.status;
  const ends = new Date(st.ends).toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
  view.innerHTML = `<h1>الاشتراك</h1>
  <div class="card" style="margin-bottom:16px">
    <div class="head" style="margin-bottom:6px"><h3 style="margin:0">حالة حسابك</h3><span class="pill">${st.plan === 'paid' ? '⭐ مفعّل' : st.plan === 'trial' ? '⏳ تجريبي' : '⛔ منتهي'}</span></div>
    <p style="margin:0">${st.plan === 'expired' ? 'انتهى اشتراكك أو فترتك التجريبية. شواهدك محفوظة وصفحتك ظاهرة، لكن الإضافة والطباعة تحتاج تفعيل.' : `ينتهي في ${ends} (باقي ${st.daysLeft} يوم)`}</p>
  </div>
  <form id="rf" class="card" style="margin-bottom:16px"><h3>عندك كود تفعيل؟</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input name="code" placeholder="MYR-XXXX-XXXX" dir="ltr" style="flex:1;min-width:200px;text-transform:uppercase" required><button class="btn">تفعيل</button></div></form>
  <h3>ما عندك كود؟ اختر باقتك</h3><p class="muted" style="margin-top:0">اشترِ كود التفعيل من متجر معيار ويوصلك فوراً على جوالك وإيميلك. ولو عندك اشتراك، المدة الجديدة تنضاف على الباقي.</p>
  <div class="grid g3">${S.plans.map((p) => `<div class="card" style="text-align:center;${p.best ? 'border:2px solid var(--brand-2)' : ''}">
    ${p.best ? `<span class="pill">⭐ الأوفر${p.saving ? `، توفّر ${p.saving}%` : ''}</span>` : ''}
    <h3 style="margin:8px 0 2px">${esc(p.name)}</h3>
    <div style="font-size:28px;font-weight:800;color:var(--brand-text)">${p.price} <small style="font-size:14px">ريال / ${esc(p.per)}</small></div>
    <p class="muted" style="margin:4px 0 12px;font-size:13px">${esc(p.note)}</p>
    <a class="btn ${p.best ? '' : 'ghost'}" href="${esc(S.storeUrl)}" target="_blank">🛒 اشترِ</a></div>`).join('')}</div>`;
  $('#rf').onsubmit = async (e) => {
    e.preventDefault();
    try { ({ user: S.me } = await api('/api/redeem', { method: 'POST', body: { code: e.target.code.value } })); toast('تم تفعيل حسابك ⭐'); subscription(); } catch (err) { toast(err.message); }
  };
}

// ---------- الإدارة ----------
async function adminView() {
  if (!S.me.is_admin) return (location.hash = '#/');
  view.innerHTML = '<p class="muted">جاري التحميل...</p>';
  const s = await api('/api/admin/stats');
  const d = (t) => new Date(t).toLocaleDateString('ar-SA');
  view.innerHTML = `<h1>لوحة الإدارة</h1>
  <div class="stats"><div class="card stat"><b>${s.users}</b>مستخدم</div><div class="card stat"><b>${s.paid}</b>مفعّل</div><div class="card stat"><b>${s.trial}</b>تجريبي</div><div class="card stat"><b>${s.evidences}</b>شاهد</div><div class="card stat"><b>${s.codesFree}</b>كود متاح</div><div class="card stat"><b>${s.codesUsed}</b>كود مستخدم</div></div>
  <form id="cf" class="card" style="margin-bottom:16px"><h3>توليد أكواد تفعيل</h3><p class="muted" style="margin-top:0">ولّد الأكواد ونزّلها CSV، وارفعها في سلة كمنتج "بطاقات رقمية" عشان تنرسل للعميل تلقائياً بعد الدفع.</p>
    <div class="grid g3"><div class="field"><label>العدد</label><input name="count" type="number" value="50" min="1" max="500"></div><div class="field"><label>المدة بالأيام</label><select name="days">${[...S.plans].reverse().map((p) => `<option value="${p.days}">${esc(p.name)}: ${p.days} يوم (${p.price} ريال)</option>`).join('')}</select></div><div class="field"><label>ملاحظة</label><input name="note" placeholder="دفعة سلة نوفمبر"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">توليد</button><a class="btn ghost" href="/api/admin/codes.csv">⬇️ تنزيل كل الأكواد CSV</a></div>
    <pre id="out" style="direction:ltr;white-space:pre-wrap;font-size:13px"></pre></form>
  <div class="card"><h3>آخر المسجلين</h3><div style="overflow:auto"><table class="t"><tr><th>الاسم</th><th>البريد</th><th>المدرسة</th><th>التسجيل</th><th>الحالة</th></tr>
  ${s.recent.map((u) => `<tr><td>${esc(u.full_name)}</td><td dir="ltr">${esc(u.email)}</td><td>${esc(u.school)}</td><td>${d(u.created_at)}</td><td>${u.plan_ends > Date.now() ? '⭐ مفعّل' : u.trial_ends > Date.now() ? 'تجريبي' : 'منتهي'}</td></tr>`).join('')}</table></div></div>`;
  $('#cf').onsubmit = async (e) => { e.preventDefault(); try { const { codes } = await api('/api/admin/codes', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); $('#out').textContent = codes.join('\n'); toast(`تم توليد ${codes.length} كود`); } catch (err) { toast(err.message); } };
}

// ---------- التوجيه ----------
async function loadEvs() { S.evs = (await api('/api/evidences')).evidences; }
async function load() {
  const d = await api('/api/me');
  Object.assign(S, { me: d.user, standards: d.standards, ai: d.ai, base: d.base, storeUrl: d.storeUrl, plans: d.plans || [] });
  applyColor();
  await loadEvs();
  await loadTasks();
}
async function loadTasks() { try { S.tasks = (await api('/api/my-tasks')).tasks; } catch { S.tasks = []; } }
async function route() {
  const [p, qs] = (location.hash.slice(2) || '').split('?');
  const parts = p.split('/');
  const q = new URLSearchParams(qs || '');
  if (!S.me && !['login', 'register'].includes(parts[0])) {
    try { await load(); } catch { location.hash = '#/login'; return; }
  }
  topbar(parts[0]);
  window.scrollTo(0, 0);
  switch (parts[0]) {
    case 'login': case 'register': if (S.me) { location.hash = '#/'; return; } return authView(parts[0]);
    case 'std': return standardView(parts[1]);
    case 'new': return editor(null, q);
    case 'edit': return editor(parts[1], q);
    case 'profile': return profile();
    case 'subscription': return subscription();
    case 'admin': return adminView();
    default: return dashboard();
  }
}
// تكبير مربعات النص تلقائياً حسب المحتوى
const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 4 + 'px'; };
document.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') grow(e.target); });
new MutationObserver(() => document.querySelectorAll('textarea').forEach((t) => { if (t.value && !t._g) { t._g = 1; grow(t); } })).observe(view, { childList: true, subtree: true });
window.addEventListener('hashchange', route);
route();
