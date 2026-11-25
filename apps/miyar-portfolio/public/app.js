/* معياري للمعلم - واجهة التطبيق */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const S = { me: null, standards: [], roles: [], evs: [], ai: false, base: '', storeUrl: '', plans: [] };
// الوظائف التعليمية حسب نماذج الدليل الإرشادي لإدارة الأداء الوظيفي (الإصدار الثاني)
const ROLE_OPTS = [['teacher', 'معلم / معلمة'], ['activity', 'رائد/ة نشاط (معلم مسند له نشاط طلابي)'], ['health', 'موجه/ة صحي (معلم مسند له توجيه صحي)'], ['kg', 'معلمة رياض أطفال'], ['lab', 'محضر/ة مختبر'], ['counselor', 'موجه/ة طلابي'], ['deputy', 'وكيل/ة مدرسة'], ['principal', 'مدير/ة مدرسة']];
const TEACHES = ['teacher', 'activity', 'health', 'kg'];
const roleSel = (cur = 'teacher') => `<select name="role">${ROLE_OPTS.map(([k, n]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
const IDEAS = { teacher: 'درس عن الكسور باستخدام لعبة البطاقات', activity: 'مسابقة ثقافية بمناسبة اليوم الوطني', health: 'حملة توعية عن التغذية الصحية', kg: 'ركن الرمل والماء لتنمية المهارات الحسية', lab: 'تجهيز تجربة التحليل الكهربائي للصف الثالث', counselor: 'جلسة إرشاد جمعي عن إدارة الوقت', deputy: 'متابعة الغياب والتأخر الصباحي هذا الأسبوع', principal: 'لقاء مجتمع تعلم عن تحليل نتائج نافس' };
const COLORS = { miyar: '#0f766e', navy: '#1e3a8a', violet: '#5b21b6', rose: '#9f1239', gold: '#8a5a00', slate: '#334155' };

function toast(msg) {
  const t = $('#toast');
  t.textContent = MI.strip(msg);
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

// واجهة التطبيق بهوية معياري دائماً، ولون المعلم يظهر في صفحته العامة وتقاريره
function applyColor() { document.documentElement.dataset.color = 'miyar'; }
function toggleDark() {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('miyar-theme', r.dataset.theme); } catch {}
}

function topbar(route) {
  const dk = `<button class="tb-btn" onclick="toggleDark()" title="الوضع الليلي" aria-label="الوضع الليلي">${MI.ico('moon', 20)}</button>`;
  if (!S.me) { $('#top').innerHTML = `<div class="topbar"><div class="wrap"><a class="logo" href="${forSchool() ? '/school' : '/'}">${MI.brand(38)}${forSchool() ? '<span class="sfx">للمدرسة</span>' : ''}</a><div style="display:flex">${dk}</div></div></div>`; return; }
  const T = TEACHES.includes(S.me.role);
  const on = (h) => route === h || (h === '' && route === 'std') || (h === 'new' && route === 'edit');
  const l = (h, ic, t, cls = '') => `<a href="#/${h}" class="${on(h) ? 'on' : ''} ${cls}">${cls ? `<i>${MI.ico(ic, 20)}</i>` : MI.ico(ic, 19)}<span>${t}</span></a>`;
  $('#top').innerHTML = `<div class="topbar"><div class="wrap"><a class="logo" href="#/">${MI.brand(38)}</a>
    <nav class="nav" aria-label="التنقل">${l('', 'home', 'الرئيسية')}${l('new', 'plus', 'شاهد جديد')}${T ? l('rec', 'book', 'مساعد المعلم') + l('exam', 'edit', 'صانع الاختبارات') : l('self', 'target', 'التقييم الذاتي')}${l('logs', 'folder', 'السجلات')}${l('profile', 'user', 'حسابي')}${S.me.is_admin ? l('admin', 'tool', 'الإدارة') : ''}${dk}</nav>
    <div class="tb-side"><a class="tb-btn" href="#/subscription" title="الاشتراك" aria-label="الاشتراك">${MI.ico('star', 20)}</a>${dk}</div></div></div>
    <nav class="bnav" aria-label="التنقل">${l('', 'home', 'الرئيسية')}${l('logs', 'folder', 'السجلات')}${l('new', 'plus', 'شاهد', 'add')}${T ? l('rec', 'book', 'المساعد') : l('self', 'target', 'التقييم')}${l('profile', 'user', 'حسابي')}</nav>`;
}

function banner() {
  const st = S.me.status;
  if (st.plan === 'trial') return `<div class="banner trial"><span>⏳ أنت في الفترة التجريبية، باقي ${st.daysLeft} ${st.daysLeft > 10 ? 'يوم' : 'أيام'}</span><a class="btn sm" href="#/subscription">فعّل حسابك</a></div>`;
  if (st.plan === 'expired') return `<div class="banner expired"><span>انتهى اشتراكك. شواهدك محفوظة وصفحتك ظاهرة، جدّد لإكمال التوثيق والطباعة.</span><a class="btn sm" href="#/subscription">أدخل كود التفعيل</a></div>`;
  return '';
}

// ---------- الدخول والتسجيل ----------
// هل جاء المستخدم من «معياري للمدرسة»؟ (نعرض هوية المدرسة في شاشة الدخول)
const forSchool = () => { try { return (sessionStorage.getItem('miyar-next') || '').startsWith('/school'); } catch { return false; } };

const TOOL_NAMES = { new: 'صياغة الشاهد بالذكاء الاصطناعي', self: 'التقييم الذاتي', logs: 'السجلات اليومية', rec: 'مساعد المعلم', exam: 'صانع الاختبارات', report: 'خطة التحسين من تقرير التقويم الذاتي', plan: 'خطة التحسين', nafis: 'الخطة العلاجية لنافس', evidence: 'ملف شواهد التقويم المدرسي', board: 'لوحة المدرسة الذكية', ops: 'الخطة التشغيلية', team: 'إسناد المهام للمعلمين' };
const goingTo = () => { try { const n = sessionStorage.getItem('miyar-next') || ''; const k = (n.split('#/')[1] || '').split(/[/?]/)[0]; return TOOL_NAMES[k] || ''; } catch { return ''; } };
function authView(mode) {
  const sch = forSchool();
  view.innerHTML = `<div class="auth card">
    <div style="text-align:center;margin-bottom:12px"><a class="logo" href="${sch ? '/school' : '/'}" style="font-size:22px">${MI.brand(48)}<span class="sfx">${sch ? 'للمدرسة' : 'للمعلم'}</span></a><p class="muted" style="margin:6px 0 0">${sch ? 'خطة التحسين وخطة نافس وملف شواهد التقويم' : 'ملف الإنجاز والشواهد الإلكتروني'}</p>${sch ? '<p class="muted" style="margin:8px 0 0;font-size:13px">سجّل دخولك أو أنشئ حساباً جديداً للمدرسة. الحساب نفسه يشتغل في معياري للمعلم.</p>' : ''}${goingTo() ? `<p class="next-tool">بعد ما تنشئ حسابك أو تدخل، تفتح لك مباشرة: <b>${esc(goingTo())}</b></p>` : ''}</div>
    <div class="tabs"><a href="#/login" class="${mode === 'login' ? 'on' : ''}">تسجيل الدخول</a><a href="#/register" class="${mode === 'register' ? 'on' : ''}">حساب جديد</a></div>
    <form id="f">
      ${mode === 'register' ? `<div class="field"><label>الاسم الكامل</label><input name="full_name" required placeholder="مثال: أحمد محمد العتيبي"></div>
      <div class="grid g2"><div class="field"><label>الجنس</label><select name="gender"><option value="m">ذكر</option><option value="f">أنثى</option></select></div>
      <div class="field"><label>الوظيفة</label>${roleSel()}</div></div>` : ''}
      <div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="email" dir="ltr"></div>
      <div class="field"><label>كلمة المرور</label><input name="password" type="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" dir="ltr"></div>
      ${mode === 'register' ? '<label class="consent"><input type="checkbox" name="accept" value="1" required><span>قرأت وأوافق على <a href="/privacy" target="_blank">سياسة الخصوصية وشروط الاستخدام</a>، بما فيها حفظ البيانات على خوادم خارج المملكة.</span></label>' : ''}
      <button class="btn" style="width:100%;justify-content:center">${mode === 'login' ? 'دخول' : 'ابدأ التجربة المجانية'}</button>
    </form><p class="muted" style="text-align:center;font-size:12.5px;margin:12px 0 0"><a href="/privacy" target="_blank">الخصوصية وشروط الاستخدام</a></p></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    const btn = $('button', e.target); btn.disabled = true;
    try { await api(mode === 'login' ? '/api/login' : '/api/register', { method: 'POST', body: b }); await load(); const nx = sessionStorage.getItem('miyar-next'); if (nx) { sessionStorage.removeItem('miyar-next'); location.href = nx; return; } location.hash = '#/'; }
    catch (err) { toast(err.message); btn.disabled = false; }
  };
}

// ---------- التقييم الذاتي بسلّم التقدير الرسمي ----------
const RT = () => { try { return JSON.parse(S.me.self_rating || '{}'); } catch { return {}; } };
function selfCalc() {
  const r = RT(); const rated = S.standards.filter((s) => r[s.id]);
  const w = rated.reduce((a, s) => a + s.weight, 0);
  const value = w ? Math.round((rated.reduce((a, s) => a + r[s.id] * s.weight, 0) / w) * 100) / 100 : 0;
  const band = rated.length ? (S.bands || []).find((b) => b.score === Math.min(5, Math.max(1, Math.round(value)))) : null;
  return { r, rated: rated.length, total: S.standards.length, value, band };
}
async function rate(id, score) {
  const d = await api('/api/self-rating', { method: 'PUT', body: { id, score } });
  S.me.self_rating = d.self_rating;
}
// مربعات المستويات الخمسة لعنصر واحد
function rubricBox(s, compact) {
  if (!s.levels) return '';
  const cur = RT()[s.id] || 0;
  return `<div class="card rub" data-id="${s.id}" style="margin-bottom:14px">${compact ? '' : `<div class="head" style="margin-bottom:6px"><h3 style="margin:0">🎯 قيّم نفسك في هذا العنصر</h3><a class="muted" style="font-size:12px" href="#/self">التقييم الذاتي كامل ←</a></div>`}
    <div class="lv-grid ${compact && cur ? 'collapsed' : ''}">${s.levels.map((t, i) => `<button type="button" class="lv ${cur === i + 1 ? 'on' : ''}" data-s="${i + 1}"><b>${i + 1}</b><span>${esc(t)}</span></button>`).join('')}</div>${compact && cur ? '<button type="button" class="btn ghost sm lv-more" style="margin-top:8px">تغيير التقدير</button>' : ''}
    ${cur && cur < 5 ? `<p class="next-lv">⬆️ للوصول للمستوى ${cur + 1}: ${esc(s.levels[cur])}</p>` : cur === 5 ? '<p class="next-lv">🌟 أعلى مستوى. تأكد إن شواهدك تثبته.</p>' : ''}</div>`;
}
function bindRubric(after) {
  view.querySelectorAll('.lv-more').forEach((b) => { b.onclick = () => { b.previousElementSibling.classList.remove('collapsed'); b.remove(); }; });
  view.querySelectorAll('.rub .lv').forEach((b) => { b.onclick = async () => {
    const box = b.closest('.rub'); const id = Number(box.dataset.id); const sc = Number(b.dataset.s);
    try { await rate(id, (RT()[id] || 0) === sc ? 0 : sc); after(); } catch (err) { toast(err.message); }
  }; });
}

// ---------- الرئيسية ----------
const IC = (n, s = 20) => MI.ico(n, s);
const nEv = (n) => (n === 1 ? 'شاهد واحد' : n === 2 ? 'شاهدان' : n > 2 && n < 11 ? `${n} شواهد` : `${n} شاهد`);
const nEl = (n) => (n === 1 ? 'عنصر واحد' : n === 2 ? 'عنصران' : n > 2 && n < 11 ? `${n} عناصر` : `${n} عنصراً`);
function ring(pct) {
  const C = 2 * Math.PI * 48;
  const d = Math.max(0, Math.min(C, (pct / 100) * C)).toFixed(1);
  return `<svg class="ring" width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="جاهزية الملف ${pct}% من أوزان التقييم"><circle cx="56" cy="56" r="48" fill="none" stroke="rgba(14,124,102,.14)" stroke-width="10"/>${pct > 0 ? `<circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-dasharray="${d} 302" transform="rotate(-90 56 56)"/>` : ''}<text x="56" y="64" text-anchor="middle" font-family="Readex Pro, sans-serif" font-size="25" font-weight="500" fill="currentColor">${pct}%</text></svg>`;
}
function dashboard() {
  const counts = Object.fromEntries(S.standards.map((s) => [s.id, S.evs.filter((e) => e.standard_id === s.id).length]));
  const covered = Object.values(counts).filter(Boolean).length;
  const missing = S.standards.length - covered;
  const score = S.standards.reduce((a, s) => a + (counts[s.id] ? s.weight : 0), 0);
  const pub = `${S.base}/p/${S.me.slug}`;
  const st = S.me.status;
  const name = String(S.me.full_name || '').trim();
  const short = name.split(/\s+/).slice(0, 2).join(' ');
  const T = TEACHES.includes(S.me.role);
  const L = S.logs; const nLogs = Object.values(L.counts).reduce((a, b) => a + b, 0);
  const c = selfCalc(); const hasRub = S.standards.some((s) => s.levels);
  const gap = S.standards.filter((s) => !counts[s.id]).sort((a, b) => b.weight - a.weight)[0];
  const next = gap ? { href: `#/new?std=${gap.id}`, k: 'alert', warn: true, t: `أضف شاهد لـ «${esc(gap.name)}»`, s: `الخطوة الجاية · وزنه ${gap.weight}% من التقييم` }
    : hasRub && c.rated < c.total ? { href: '#/self', k: 'target', t: 'قيّم نفسك بسلّم التقدير الرسمي', s: 'الخطوة الجاية · كل العناصر عليها شواهد' }
    : { href: '/print/portfolio?t=classic', k: 'printer', t: 'اطبع ملف إنجازك كامل', s: 'الخطوة الجاية · ملفك مغطّى', blank: true };
  const head = score >= 100 ? 'ملفك مغطّى بالكامل' : score >= 60 ? 'ملفك قرّب يكتمل' : covered ? 'بداية موفّقة، كمّل' : 'ابدأ ملفك بأول شاهد';
  const sum = S.evs.length ? `${nEv(S.evs.length)} على ${nEl(covered)}. ${missing ? `باقي ${nEl(missing)} بدون شواهد.` : 'كل العناصر عليها شواهد.'}` : 'اكتب فكرة الشاهد تحت بكلمتين، والمساعد يصيغه ويربطه بالعنصر المناسب.';
  const pill = st.plan === 'trial' ? `<a class="dh-pill" href="#/subscription">باقي ${st.daysLeft} ${st.daysLeft > 10 ? 'يوم' : 'أيام'} · فعّل</a>` : st.plan === 'expired' ? '<a class="dh-pill exp" href="#/subscription">انتهى الاشتراك · جدّد</a>' : '';
  const row = (href, k, t, s, blank) => `<a class="lrow" href="${href}"${blank ? ' target="_blank"' : ''}><span class="tile-ic">${IC(k, 22)}</span><span class="t"><b>${t}</b><small>${s}</small></span>${IC('arrow', 18)}</a>`;
  view.innerHTML = `
  <section class="dash-hero">
    <div class="dh-top"><div class="dh-me"><span class="dh-av">${esc(name.charAt(0) || 'م')}</span><div style="min-width:0"><div class="dh-hi">أهلاً</div><div class="dh-name">${esc(short ? `أ. ${short}` : 'بك')}</div></div></div>${pill}</div>
    <div class="dh-body">${ring(score)}<div class="dh-sum"><b>${head}</b><span>${sum}</span></div></div>
    <form id="aiq"><div class="dh-ai-l">${IC('sparkle', 18)} وثّق شاهد في دقيقة</div><div class="dh-ai"><input name="idea" aria-label="فكرة الشاهد" placeholder="مثال: ${esc(IDEAS[S.me.role] || IDEAS.teacher)}" required><button class="btn">صِغها لي</button></div></form>
  </section>
  <div class="dash-cols">
    <div class="dash-col">
      ${L.due.length ? `<a class="card due" href="#/logs/contact"><span class="tile-ic warn">${IC('bell', 24)}</span><span style="flex:1"><b style="display:block;font-weight:600">عندك ${L.due.length} ${L.due.length > 2 && L.due.length < 11 ? 'متابعات مستحقة' : 'متابعة مستحقة'}</b><small class="muted">في سجل التواصل مع أولياء الأمور</small></span>${IC('arrow', 18)}</a>` : ''}
      <a class="card next" href="${next.href}"${next.blank ? ' target="_blank"' : ''}><span class="tile-ic${next.warn ? ' warn' : ''}">${IC(next.k, 24)}</span><span class="t"><small>${next.s}</small><b>${next.t}</b></span>${IC('arrow', 20)}</a>
      <div class="qa">
        <a class="pri" href="#/new">${IC('plus', 26)}<span>شاهد جديد</span></a>
        <a href="#/logs/wait">${IC('clock', 26)}<span>حصة انتظار</span></a>
        <a href="#/logs/contact">${IC('phone', 26)}<span>تواصل مع ولي أمر</span></a>
        <a href="/print/portfolio?t=classic" target="_blank">${IC('printer', 26)}<span>اطبع ملفي</span></a>
      </div>
      ${tasksCard()}
      <div class="card links" style="padding:4px 0">
        ${row('#/logs', 'folder', 'السجلات اليومية', nLogs ? `${nLogs} سجل موثّق · الانتظار، المناوبة، التعاميم، اللجان، التواصل، المبادرات` : 'الانتظار والمناوبة والتعاميم واللجان والتواصل والمبادرات، وكل سجل يتحول لشاهد')}
        ${T ? row('#/rec', 'book', 'مساعد المعلم', 'سجل المادة والخطة الأسبوعية والتحليل والخطط العلاجية') + row('#/exam', 'edit', 'صانع الاختبارات', 'جدول المواصفات ونموذجان ومفتاح وورقة تظليل') : ''}
        ${hasRub ? row('#/self', 'target', 'التقييم الذاتي', c.rated ? `قدّرت ${c.rated} من ${c.total} · تقديرك المتوقع ${c.value} من 5${c.band ? ` (${esc(c.band.name)})` : ''}` : 'قيّم نفسك بأوصاف الوزارة واعرف وش ينقصك للمستوى الأعلى') : ''}
      </div>
      <div class="card share-card">
        <div class="sec-h" style="margin:0"><h3 style="margin:0;display:flex;gap:8px;align-items:center">${IC('link', 20)} صفحتك ورابط المشاركة</h3><span class="pill">${S.me.is_public ? 'منشورة' : 'مخفية'}</span></div>
        <div class="share"><code>${esc(pub)}</code><button class="btn soft sm" id="copy">${IC('copy', 16)} نسخ</button><a class="btn ghost sm" href="${esc(pub)}" target="_blank">فتح الصفحة</a></div>
      </div>
    </div>
    <section class="dash-col" aria-label="عناصر التقييم">
      <div><div class="sec-h"><h2>عناصر التقييم</h2><button type="button" class="chip-btn${S.onlyMissing ? ' on' : ''}" id="miss">${S.onlyMissing ? 'عرض الكل' : 'الناقصة فقط'}</button></div>
      <div class="muted" style="font-size:12.5px;margin:-6px 0 10px">${esc(((S.roles.find((r) => r.key === S.me.role) || {}).model) || '')}، حسب الدليل الإرشادي لإدارة الأداء الوظيفي · <a href="#/profile">تغيير الوظيفة</a></div></div>
      <div class="card els" id="els"></div>
    </section>
  </div>`;
  const drawEls = () => {
    const list = S.standards.filter((s) => !S.onlyMissing || !counts[s.id]);
    $('#els').innerHTML = list.map((s) => {
      const n = counts[s.id]; const cv = (s.parts || []).length ? covOf(s) : null; const r = RT()[s.id];
      const w = n ? (cv && cv.total ? Math.max(12, Math.round((cv.covered / cv.total) * 100)) : Math.min(100, n * 34)) : 6;
      const meta = [`الوزن ${s.weight}%`, r ? `تقديرك ${r}/5` : '', cv && n ? `وصف «مثالي» ${cv.covered}/${cv.total}` : ''].filter(Boolean).join(' · ');
      return `<a class="el" href="#/std/${s.id}"><div class="el-top"><span><span class="n">${s.no}.</span> ${esc(s.name)}</span><span class="el-st${n ? '' : ' none'}">${n ? nEv(n) : 'بدون شاهد'}</span></div><div class="bar${n ? '' : ' warn'}"><i style="width:${w}%"></i></div><div class="el-meta">${meta}</div></a>`;
    }).join('') || '<p class="muted" style="text-align:center;margin:14px 0">كل العناصر عليها شواهد.</p>';
  };
  drawEls();
  $('#miss').onclick = (e) => { S.onlyMissing = !S.onlyMissing; e.target.classList.toggle('on', S.onlyMissing); e.target.textContent = S.onlyMissing ? 'عرض الكل' : 'الناقصة فقط'; drawEls(); };
  $('#aiq').onsubmit = (e) => { e.preventDefault(); sessionStorage.setItem('miyar-idea', e.target.idea.value); location.hash = '#/new'; };
  $('#copy').onclick = () => navigator.clipboard.writeText(pub).then(() => toast('تم نسخ الرابط'));
}

// ---------- صفحة التقييم الذاتي ----------
function selfView() {
  const c = selfCalc();
  const counts = Object.fromEntries(S.standards.map((s) => [s.id, S.evs.filter((e) => e.standard_id === s.id).length]));
  // الأولوية: أقل تقدير ثم أعلى وزن (أكبر أثر على التقدير العام)
  const weak = S.standards.filter((s) => c.r[s.id] && c.r[s.id] <= 3).sort((a, b) => c.r[a.id] - c.r[b.id] || b.weight - a.weight).slice(0, 3);
  const noEvAll = S.standards.filter((s) => c.r[s.id] >= 4 && !counts[s.id]);
  const noEv = noEvAll.slice(0, 3);
  view.innerHTML = `<div class="head"><div><a href="#/" class="muted" style="text-decoration:none">→ الرئيسية</a><h1 style="margin:4px 0 0">🎯 التقييم الذاتي</h1><div class="muted" style="font-size:13px">${esc(((S.roles.find((r) => r.key === S.me.role) || {}).model) || '')} · سلّم التقدير الخماسي وآلية الاحتساب من نماذج تقييم أداء شاغلي الوظائف التعليمية</div></div>
    <a class="btn ghost" target="_blank" href="/print/self">🖨️ طباعة التقييم</a></div>
  <div class="stats">
    <div class="card stat"><b>${c.rated ? c.value : '-'}</b>التقدير العام المتوقع من 5<div class="bar" style="margin-top:6px"><i style="width:${c.value * 20}%"></i></div></div>
    <div class="card stat"><b>${c.band ? esc(c.band.name) : '-'}</b>مستوى الأداء${c.band ? ` (${c.band.score})` : ''}</div>
    <div class="card stat"><b>${c.rated}/${c.total}</b>عنصر مقدّر</div>
  </div>
  ${weak.length || noEv.length ? `<div class="card" style="margin-bottom:14px;border:2px solid var(--brand-2)"><h3 style="margin-top:0">💡 وين تركّز؟</h3><ul style="margin:0;padding-inline-start:20px;line-height:1.9">
    ${weak.map((s) => `<li><b>${esc(s.name)}</b> (الوزن ${s.weight}%): أنت في المستوى ${c.r[s.id]}. للمستوى ${c.r[s.id] + 1}: ${esc(s.levels[c.r[s.id]])}</li>`).join('')}
    ${noEv.map((s) => `<li>قدّرت نفسك ${c.r[s.id]} في <b>${esc(s.name)}</b> وما عندك شاهد يثبته. <a href="#/new?std=${s.id}">أضف شاهد</a></li>`).join('')}${noEvAll.length > 3 ? `<li class="muted">و${noEvAll.length - 3} عناصر ثانية قدّرتها 4 أو 5 بدون شواهد.</li>` : ''}</ul></div>` : ''}
  <p class="muted" style="font-size:13px">اضغط المستوى اللي يوصف أداءك فعلاً في كل عنصر. الحفظ تلقائي، والضغط على نفس المستوى مرة ثانية يمسحه.</p>
  ${S.standards.map((s) => `<div class="std-rub"><div class="head" style="margin:14px 0 6px"><h3 style="margin:0">${s.no}. ${esc(s.name)} <span class="muted" style="font-size:12px;font-weight:400">الوزن ${s.weight}% · ${counts[s.id] ? `${counts[s.id]} شاهد` : 'لا يوجد شاهد'}</span></h3><a class="muted" style="font-size:12px" href="#/std/${s.id}">الشواهد ←</a></div>${s.levels ? rubricBox(s, true) : `<div class="card muted" style="font-size:13px">سلّم التقدير لهذا العنصر يُضاف قريباً.</div>`}</div>`).join('')}
  <p class="muted" style="font-size:12px">هذا تقدير ذاتي استرشادي يساعدك تجهّز شواهدك وتعرف وضعك قبل التقييم. التقييم المعتمد يجريه المدير المباشر.</p>`;
  bindRubric(() => { const y = scrollY; selfView(); scrollTo(0, y); });
}

// تغطية عبارات وصف المستوى 5 بالشواهد
function covOf(s) {
  const parts = s.parts || [];
  const evs = S.evs.filter((e) => e.standard_id === s.id);
  const rows = parts.map((p) => ({ ...p, n: evs.filter((e) => (e.parts || []).includes(p.k)).length }));
  return { rows, covered: rows.filter((r) => r.n).length, total: rows.length };
}
function coverageCard(s) {
  const c = covOf(s);
  if (!c.total) return '';
  return `<div class="card cov" style="margin-bottom:14px"><div class="head" style="margin:0 0 6px"><h3 style="margin:0">🧩 وش تثبت شواهدك من وصف «مثالي»؟</h3><span class="pill">${c.covered} من ${c.total}</span></div>
    <div class="muted" style="font-size:12.5px;margin-bottom:6px">عبارات المستوى 5 في سلّم التقدير الرسمي لهذا العنصر. اربط كل شاهد بالعبارات اللي يثبتها من صفحة تعديله.</div>
    ${c.rows.map((r) => `<div class="cov-row ${r.n ? 'ok' : ''}"><span class="cov-i">${r.n ? '✓' : '○'}</span><div style="flex:1"><div>${esc(r.t)}</div>${r.n ? `<div class="muted" style="font-size:12px">${r.n} شاهد</div>` : (r.ev && r.ev.length ? `<div class="muted" style="font-size:12px">شواهد مقترحة: ${r.ev.map(esc).join('، ')}</div>` : '')}</div>${r.n ? '' : `<a class="btn soft sm" href="#/new?std=${s.id}&part=${r.k}">➕ شاهد</a>`}</div>`).join('')}
    ${s.parts.some((p) => p.ev && p.ev.length) ? '<div class="muted" style="font-size:11.5px;margin-top:6px">الشواهد المقترحة أمثلة إرشادية من معياري، وليست قائمة رسمية.</div>' : ''}</div>`;
}

// ---------- عرض عنصر ----------
function standardView(id) {
  const s = S.standards.find((x) => x.id === Number(id));
  if (!s) return (location.hash = '#/');
  const items = S.evs.filter((e) => e.standard_id === s.id);
  view.innerHTML = `${banner()}<div class="head"><div><a href="#/" class="muted" style="text-decoration:none">→ العناصر</a><h1 style="margin:4px 0 0">${s.icon} ${esc(s.name)}</h1><div class="muted">الوزن ${s.weight}% · ${esc(s.hint)}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn" href="#/new?std=${s.id}">➕ إضافة شاهد</a>${items.length ? `<a class="btn ghost" target="_blank" href="/print/standard/${s.id}">🖨️ تقرير العنصر</a>` : ''}</div></div>
    ${rubricBox(s)}
    ${coverageCard(s)}
    <div class="ev-list">${items.map(evItem).join('') || `<div class="card" style="text-align:center"><p class="muted">ما فيه شواهد في هذا العنصر بعد.</p><a class="btn" href="#/new?std=${s.id}">أضف أول شاهد</a></div>`}</div>`;
  bindRubric(() => standardView(id));
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
      ${t.evidence ? `<div style="font-size:13px">📎 <a href="#/edit/${t.evidence.id}">${esc(t.evidence.title)}</a></div>` : ''}
      ${t.done ? `<div class="rate" style="font-size:13px;margin-top:4px">${t.opinion ? 'تقييمك للبرنامج:' : 'وش رأيك في البرنامج؟'} ${[1, 2, 3, 4, 5].map((n) => `<button class="star${t.opinion && t.opinion.rating >= n ? ' on' : ''}" onclick="rateTask('${taskKey(t)}', ${n})" aria-label="${n} من 5">★</button>`).join('')}</div>` : ''}</div>
      <div class="task-act">${t.evidence ? (t.done ? '' : `<button class="btn soft sm" onclick="taskDone('${taskKey(t)}', true)">تم التنفيذ</button>`) : `<a class="btn sm" href="#/new?task=${taskKey(t)}">وثّق التنفيذ</a>${S.evs.length ? `<select class="sm" onchange="linkTask('${taskKey(t)}', this.value)" aria-label="ربط شاهد موجود"><option value="">أو اربط شاهد موجود</option>${S.evs.map((e) => `<option value="${e.id}">${esc(e.title)}</option>`).join('')}</select>` : ''}`}</div>
    </li>`).join('')}</ul></div>`;
}
async function putTask(key, body) {
  const [sid, i, j] = key.split(':');
  S.tasks = (await api(`/api/my-tasks/${sid}/${i}/${j}`, { method: 'PUT', body })).tasks;
}
window.linkTask = async (key, id) => { if (!id) return; try { await putTask(key, { evidence_id: Number(id), done: true }); toast('تم ربط الشاهد بالمهمة ✅'); dashboard(); } catch (e) { toast(e.message); } };
window.rateTask = async (key, rating) => {
  const [sid, i] = key.split(':');
  const comment = prompt('ملاحظتك على البرنامج لقائد المدرسة (اختياري):') || '';
  try { S.tasks = (await api(`/api/my-tasks/${sid}/${i}/opinion`, { method: 'PUT', body: { rating, comment } })).tasks; toast('وصل رأيك لقائد المدرسة، شكراً'); dashboard(); } catch (e) { toast(e.message); }
};
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
      <div class="field"><label>عنصر التقييم</label><select name="standard_id" required><option value="">اختر العنصر</option>${S.standards.map((s) => `<option value="${s.id}" ${Number(stdQ) === s.id ? 'selected' : ''}>${s.no}. ${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>تاريخ التنفيذ</label><input type="date" name="ev_date" value="${esc(e ? e.ev_date : today())}"></div>
    </div>
    <div class="field" id="partsf"></div>
    <div class="field"><label>عنوان الشاهد</label><input name="title" required value="${esc(e ? e.title : task ? task.text : '')}" placeholder="عنوان رسمي مختصر"></div>
    <div class="field"><label>الأهداف التربوية <span class="muted">(كل هدف في سطر)</span></label><textarea name="goals">${esc(e ? e.goals.join('\n') : '')}</textarea></div>
    <div class="field"><label>الوصف</label><textarea name="description">${esc(e ? e.description : task ? `تنفيذ إجراء من خطة تحسين ${task.school} للمؤشر ${task.indicator}: ${task.indicator_text || ''}` : '')}</textarea></div>
    <div class="field"><label>آلية التنفيذ</label><textarea name="steps">${esc(e && e.steps)}</textarea></div>
    <div class="field"><label>الأثر والنتائج</label><textarea name="impact" style="min-height:70px">${esc(e && e.impact)}</textarea></div>
    <div class="field"><label>روابط <span class="muted">(اختياري، كل رابط في سطر)</span></label><textarea name="links" dir="ltr" style="min-height:60px">${esc(e ? e.links.join('\n') : '')}</textarea></div>
    <div class="field"><label>الصور والملفات <span class="muted">(صور أو PDF، حتى 10 ميجا للملف)</span></label>
      <div class="drop" id="drop">📎 اضغط لاختيار صور أو ملفات PDF<input type="file" id="fi" multiple accept="image/*,application/pdf" hidden></div>
      <p class="privacy-note">🔒 لا ترفع أسماء الطلاب الكاملة أو صور وجوههم الواضحة أو درجاتهم بأسمائهم. غطّ الوجوه أو استخدم أرقاماً. <a href="/privacy#privacy" target="_blank">ليش؟</a></p>
      <div class="files" id="files"></div></div>
    <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
      <button class="btn" id="save">💾 حفظ الشاهد</button>
      ${e ? '<button type="button" class="btn danger" id="del">حذف الشاهد</button>' : ''}
    </div>
  </form>`;
  const f = $('#ef');
  const partQ = query.get('part');
  const renderParts = (keep) => {
    const s = S.standards.find((x) => x.id === Number(f.standard_id.value));
    const parts = (s && s.parts) || [];
    const on = keep || (e && Number(e.standard_id) === (s && s.id) ? e.parts || [] : partQ ? [partQ] : []);
    $('#partsf').innerHTML = parts.length ? `<label>وش يثبت هذا الشاهد من وصف المستوى 5؟ <span class="muted">(اختياري، يوضح لك العبارات الناقصة)</span></label><div class="parts-pick">${parts.map((p) => `<label class="chk"><input type="checkbox" name="parts" value="${p.k}" ${on.includes(p.k) ? 'checked' : ''}> ${esc(p.t)}</label>`).join('')}</div>` : '';
  };
  renderParts();
  f.standard_id.addEventListener('change', () => renderParts([]));
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
      const prevStd = f.standard_id.value; f.standard_id.value = draft.standard_id; if (String(prevStd) !== String(draft.standard_id)) renderParts([]);
      f.title.value = draft.title; f.goals.value = (draft.goals || []).join('\n');
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
    const fdx = new FormData(f);
    const body = Object.fromEntries(fdx);
    body.parts = fdx.getAll('parts');
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
      <div class="field"><label>الجنس</label><select name="gender"><option value="m" ${u.gender === 'm' ? 'selected' : ''}>ذكر</option><option value="f" ${u.gender === 'f' ? 'selected' : ''}>أنثى</option></select></div>
      <div class="field"><label>الوظيفة (تحدد عناصر التقييم وأوزانها)</label>${roleSel(u.role)}</div>
      ${inp('job_title', 'المسمى الوظيفي كما يظهر في الملف', 'معلم / وكيل شؤون الطلاب / موجه طلابي')}${inp('subject', 'المادة', 'رياضيات')}
      ${inp('stage', 'المرحلة', 'المرحلة المتوسطة')}${inp('school', 'المدرسة')}
      ${inp('office', 'إدارة التعليم', 'الإدارة العامة للتعليم بمنطقة ...')}${inp('principal', 'اسم مدير المدرسة')}
      ${inp('year', 'العام الدراسي', '1448 هـ')}
      <div class="field"><label>التقويم الدراسي لمدرستك</label><select name="region"><option value="">اختر</option>${(S.calendars || []).map((c) => `<option value="${c.key}" ${u.region === c.key ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
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
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><button class="btn ghost">تغيير</button><button type="button" class="btn danger" id="out">تسجيل الخروج</button></div></form>
  <details class="card" style="margin-top:16px"><summary style="cursor:pointer;font-weight:700">🔒 بياناتي وحذف الحساب</summary>
    <p class="muted" style="font-size:14px">تقدر تعرف كيف نحفظ بياناتك في <a href="/privacy" target="_blank">سياسة الخصوصية</a>. حذف الحساب يمسح حسابك وكل شواهدك وملفاتك، وبيانات المدرسة إذا كنت قائدها، <b>نهائياً وبدون رجعة</b>. صدّر ملفك PDF قبل الحذف إذا تحتاجه.</p>
    <form id="del"><div class="field"><label>اكتب كلمة المرور للتأكيد</label><input type="password" name="password" required dir="ltr"></div><button class="btn danger">حذف حسابي نهائياً</button></form>
  </details>`;
  const f = $('#pf');
  // المسمى يتبع الوظيفة إذا كان المسمى الافتراضي
  f.role.onchange = () => { const r = S.roles.find((x) => x.key === f.role.value); const old = S.roles.find((x) => x.key === u.role); const g = f.gender.value === 'f';
    if (r && (!f.job_title.value || (old && [old.name, old.f].includes(f.job_title.value)))) f.job_title.value = g ? r.f : r.name; };
  $('#colors').onclick = (e) => { const c = e.target.dataset.c; if (!c) return; f.theme.value = c; [...$('#colors').children].forEach((b) => b.classList.toggle('on', b.dataset.c === c)); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(f)); b.is_public = f.is_public.checked;
    const changed = b.role !== S.me.role;
    if (changed && S.evs.length && !confirm('تغيير الوظيفة يغيّر عناصر التقييم وأوزانها. شواهدك الحالية تبقى محفوظة، واللي على عناصر غير موجودة في الوظيفة الجديدة تظهر في آخر الملف تحت «شواهد أخرى». نكمل؟')) return;
    try { ({ user: S.me } = await api('/api/me', { method: 'PUT', body: b })); if (changed) await load(); applyColor(); toast('تم الحفظ ✅'); } catch (err) { toast(err.message); }
  };
  $('#pw').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('تم تغيير كلمة المرور'); } catch (err) { toast(err.message); } };
  $('#out').onclick = async () => { await api('/api/logout', { method: 'POST' }); S.me = null; location.hash = '#/login'; };
  $('#del').onsubmit = async (e) => {
    e.preventDefault();
    if (!confirm('متأكد؟ ما نقدر نرجع حسابك ولا شواهدك بعد الحذف.')) return;
    try { await api('/api/me', { method: 'DELETE', body: Object.fromEntries(new FormData(e.target)) }); S.me = null; toast('تم حذف حسابك وبياناتك'); location.hash = '#/login'; } catch (err) { toast(err.message); }
  };
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
  <h3>ما عندك كود؟ اختر باقتك</h3><p class="muted" style="margin-top:0">اضغط على الباقة وتفتح لك صفحة الدفع في متجر معيار. بعد الدفع يوصلك كود التفعيل فوراً على جوالك وإيميلك، ارجع هنا والصقه فوق. ولو عندك اشتراك، المدة الجديدة تنضاف على الباقي.</p>
  <div class="grid g2">${S.plans.map((p) => `<div class="card" style="text-align:center;${p.best ? 'border:2px solid var(--brand-2)' : ''}">
    ${p.best ? `<span class="pill">⭐ الأوفر${p.saving ? `، توفّر ${p.saving}%` : ''}</span>` : ''}
    <h3 style="margin:8px 0 2px">${esc(p.name)}</h3>
    <div style="font-size:28px;font-weight:800;color:var(--brand-text)">${p.price} <small style="font-size:14px">ريال / ${esc(p.per)}</small></div>
    <p class="muted" style="margin:4px 0 12px;font-size:13px">${esc(p.note)}</p>
    <a class="btn ${p.best ? '' : 'ghost'}" href="${esc(p.url || S.storeUrl)}" target="_blank" rel="noopener">اشترك ${esc(p.name)}</a></div>`).join('')}</div>`;
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
    <div class="field"><label>المنتج</label><select name="product" id="cprod"><option value="portfolio">معياري للمعلم (أكواد MYR)</option>${(s.packages || []).map((p) => `<option value="${p.id}">معياري للمدرسة: ${esc(p.name)} (${p.price} ريال، سنة، أكواد SCH)</option>`).join('')}</select></div>
    <div class="grid g3"><div class="field"><label>العدد</label><input name="count" type="number" value="50" min="1" max="500"></div><div class="field" id="cdays"><label>المدة بالأيام</label><select name="days">${[...S.plans].reverse().map((p) => `<option value="${p.days}">${esc(p.name)}: ${p.days} يوم (${p.price} ريال)</option>`).join('')}</select></div><div class="field"><label>ملاحظة</label><input name="note" placeholder="دفعة سلة نوفمبر"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">توليد</button><a class="btn ghost" id="batch" hidden>تنزيل هذه الدفعة CSV (لسلة)</a><a class="btn ghost" href="/api/admin/codes.csv">تنزيل سجل كل الأكواد</a></div>
    <pre id="out" style="direction:ltr;white-space:pre-wrap;font-size:13px"></pre></form>
  <div class="card"><h3>آخر المسجلين</h3><div style="overflow:auto"><table class="t"><tr><th>الاسم</th><th>البريد</th><th>المدرسة</th><th>التسجيل</th><th>الحالة</th></tr>
  ${s.recent.map((u) => `<tr><td>${esc(u.full_name)}</td><td dir="ltr">${esc(u.email)}</td><td>${esc(u.school)}</td><td>${d(u.created_at)}</td><td>${u.plan_ends > Date.now() ? '⭐ مفعّل' : u.trial_ends > Date.now() ? 'تجريبي' : 'منتهي'}</td></tr>`).join('')}</table></div></div>`;
  $('#cprod').onchange = (e) => { const sch = e.target.value !== 'portfolio'; $('#cdays select').disabled = sch; $('#cdays label').textContent = sch ? 'المدة: سنة كاملة' : 'المدة بالأيام'; };
  $('#cf').onsubmit = async (e) => { e.preventDefault(); try { const b = Object.fromEntries(new FormData(e.target)); if (b.product !== 'portfolio') b.days = 365; const { codes } = await api('/api/admin/codes', { method: 'POST', body: b }); $('#out').textContent = codes.join('\n'); const a = $('#batch'); if (a.href) URL.revokeObjectURL(a.href); a.href = URL.createObjectURL(new Blob(['\ufeff' + codes.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' })); a.download = `miyar-${b.product}-${b.days}d-${codes.length}.csv`; a.hidden = false; toast(`تم توليد ${codes.length} كود`); } catch (err) { toast(err.message); } };
}

// ---------- التوجيه ----------
async function loadEvs() { S.evs = (await api('/api/evidences')).evidences; }
async function load() {
  const d = await api('/api/me');
  Object.assign(S, { logs: d.logs || { counts: {}, due: [], open: 0 }, me: d.user, standards: d.standards, bands: d.bands || [], roles: d.roles || [], calendars: d.calendars || [], extras: d.extras || [], ai: d.ai, base: d.base, storeUrl: d.storeUrl, plans: d.plans || [] });
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
    const want = location.hash.slice(2);
    try { await load(); } catch {
      // زائر جاي لأداة محددة: نحفظ وجهته، ونفتح له إنشاء الحساب، وبعدها يدخل الأداة مباشرة
      if (parts[0]) { try { sessionStorage.setItem('miyar-next', '/app#/' + want); } catch {} location.hash = '#/register'; return; }
      location.hash = '#/login'; return;
    }
  }
  topbar(parts[0]);
  window.scrollTo(0, 0);
  switch (parts[0]) {
    case 'login': case 'register': if (S.me) { location.hash = '#/'; return; } return authView(parts[0]);
    case 'std': return standardView(parts[1]);
    case 'self': return selfView();
    case 'new': return editor(null, q);
    case 'edit': return editor(parts[1], q);
    case 'rec': return window.recView(parts[1], parts[2], q);
    case 'exam': return window.examView(parts[1], parts[2]);
    case 'logs': return window.logsView(parts[1], parts[2]);
    case 'profile': return profile();
    case 'subscription': return subscription();
    case 'admin': return adminView();
    default: return dashboard();
  }
}
// تكبير مربعات النص تلقائياً حسب المحتوى
const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 4 + 'px'; };
document.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') grow(e.target); });
// الإيموجي في الشاشات تتحول لأيقونات خطية موحدة
const iconObs = new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach((n) => { if (n.nodeType === 1) MI.iconize(n); else if (n.nodeType === 3 && n.parentNode) MI.iconize(n.parentNode); }); });
iconObs.observe(view, { childList: true, subtree: true });
new MutationObserver(() => document.querySelectorAll('textarea').forEach((t) => { if (t.value && !t._g) { t._g = 1; grow(t); } })).observe(view, { childList: true, subtree: true });
window.addEventListener('hashchange', route);
route();
