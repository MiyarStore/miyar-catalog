const QRCode = require('qrcode');
const { ROLES, forRole, roleKey, anyById } = require('./standards');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = (s) => esc(s).replace(/\n/g, '<br>');
const qr = (text, size = 180) => QRCode.toDataURL(text, { margin: 1, width: size, color: { dark: '#10201e', light: '#ffffff' } });
const F = require('./fmt');
const MI = require('../public/icons.js');
function hijri(d) {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return esc(F.dual(d));
  const dt = new Date(d + 'T12:00:00');
  if (isNaN(dt)) return esc(d);
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt); } catch { return esc(d); }
}
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=Amiri:wght@700&display=swap" rel="stylesheet">';

function shell({ title, body, color = 'miyar', extraHead = '', bodyClass = '', raw = false, help = !raw }) {
  return `<!doctype html><html lang="ar" dir="rtl" data-color="${esc(color)}"><head><meta charset="utf-8"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${FONTS}<link rel="stylesheet" href="/assets/theme.css">${extraHead}
<script>try{var t=localStorage.getItem('miyar-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script></head>
<body class="${bodyClass}">${raw ? body : MI.iconizeHtml(body)}${help ? '<script src="/assets/help.js" defer></script>' : ''}</body></html>`;
}

const notFound = () => shell({ title: 'غير موجود', body: `<div class="wrap" style="padding:80px 16px;text-align:center"><h1>الصفحة غير موجودة</h1><p class="muted">تأكد من الرابط.</p><a class="btn" href="/">الرئيسية</a></div>` });
const message = (t, m, href) => shell({ title: t, body: `<div class="wrap" style="padding:80px 16px;text-align:center"><h1>${esc(t)}</h1><p class="muted">${esc(m)}</p><a class="btn" href="${esc(href)}">متابعة</a></div>` });

// وسوم المشاركة (واتساب وتويتر) ووصف محركات البحث
function shareMeta({ title, desc, url, base }) {
  const img = `${base}/assets/og.png`;
  return `<meta name="description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:locale" content="ar_SA">
<meta property="og:site_name" content="معياري"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0B1B2B">`;
}

// التقارير المطبوعة تبقى بهويتها الرسمية السابقة (الخط والألوان) بعد تغيير تصميم الواجهة
const PRINT_KEEP = `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
:root[data-color] { --brand: #0f766e; --brand-2: #14b8a6; --brand-soft: #e6f6f4; --brand-text: var(--brand); --on-brand: #fff; --bg: #f6f8f8; --card: #ffffff; --text: #10201e; --muted: #5b6b69; --line: #e2e8e7; --radius: 14px; font-family: 'IBM Plex Sans Arabic', 'Tajawal', system-ui, sans-serif; color-scheme: light; }
:root[data-color="navy"] { --brand: #1e3a8a; --brand-2: #3b82f6; --brand-soft: #e8eefc; } :root[data-color="violet"] { --brand: #5b21b6; --brand-2: #8b5cf6; --brand-soft: #f0eafd; }
:root[data-color="rose"] { --brand: #9f1239; --brand-2: #f43f5e; --brand-soft: #fdecef; } :root[data-color="gold"] { --brand: #8a5a00; --brand-2: #d99a1e; --brand-soft: #fbf3e2; } :root[data-color="slate"] { --brand: #334155; --brand-2: #64748b; --brand-soft: #eef1f5; }
.toolbar .btn { border-radius: 10px; min-height: 0; padding: 10px 16px; } .toolbar .btn.sm { padding: 6px 10px; }
h1, h2, h3, b, strong { font-weight: 700; } body { -webkit-font-smoothing: auto; }
.card { box-shadow: 0 1px 2px rgba(16,32,30,.06), 0 4px 16px rgba(16,32,30,.06); }
.pill { padding: 2px 10px; border-radius: 99px; }
.bar { height: 8px; border-radius: 99px; } .bar > i { background: linear-gradient(90deg, var(--brand), var(--brand-2)); border-radius: 99px; }
</style>`;

// ---------- الصفحة التعريفية ----------
const LANDING_CSS = `<style>
.lp{background:#fff;color:#0B1B2B}.lp-dark{background:#0B1B2B;color:#fff}
.lp-w{max-width:1200px;margin:0 auto;padding:0 24px}
.lp-hd{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0}
.lp-hd .logo{color:#fff;font-size:22px}.lp-nav{display:flex;gap:26px;font-size:15px}.lp-nav a{color:#B7C4D1;text-decoration:none}.lp-nav a:hover{color:#fff}
.lp-out{padding:10px 20px;font-weight:500;color:#fff;border:1px solid #2C4157;border-radius:999px;text-decoration:none}.lp-out:hover{border-color:#3DDBB0;color:#fff}
.lp-hero{text-align:center;padding:60px 0 0;display:flex;flex-direction:column;align-items:center;gap:22px}
.lp-kick{font-size:14px;color:#3DDBB0;font-weight:500}
.lp-hero h1{margin:0;font-size:clamp(38px,7vw,68px);line-height:1.18;font-weight:700;max-width:900px}.lp-hero h1 em{font-style:normal;color:#3DDBB0}
.lp-hero p{margin:0;font-size:clamp(17px,2.2vw,20px);line-height:1.75;color:#B7C4D1;max-width:640px;font-weight:300}
.lp-cta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.lp-b1{padding:15px 32px;font-size:17px;font-weight:600;color:#0B1B2B;background:#3DDBB0;border-radius:999px;text-decoration:none}.lp-b1:hover{background:#7BEBCB;color:#0B1B2B}
.lp-b2{padding:15px 28px;font-size:17px;font-weight:500;color:#fff;border:1px solid #2C4157;border-radius:999px;text-decoration:none}.lp-b2:hover{border-color:#3DDBB0;color:#fff}
.lp-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;width:100%;max-width:1000px;margin-top:26px;transform:translateY(48px)}
.lp-step{background:#132A40;border:1px solid #22405C;border-radius:24px;padding:22px;text-align:right;display:flex;flex-direction:column;gap:8px}
.lp-step:nth-child(2){background:#fff;color:#0B1B2B;border-color:#fff;box-shadow:0 20px 50px rgba(0,0,0,.25)}.lp-step:nth-child(3){background:#3DDBB0;color:#0B1B2B;border-color:#3DDBB0}
.lp-step span{font-size:13px;font-weight:600;color:#8FA3B6}.lp-step:nth-child(2) span{color:#0A7B67}.lp-step:nth-child(3) span{color:#0B4A3D}
.lp-step b{font-size:17px;font-weight:600;line-height:1.55}.lp-step small{font-size:13.5px;color:#5B6B7C;line-height:1.6}.lp-step:nth-child(3) small{color:#0B4A3D}.lp-step:first-child b{font-weight:400;color:#E8EEF4}
.lp-sec{padding:100px 0 30px}.lp-sec h2{font-size:clamp(28px,4vw,40px);font-weight:700;line-height:1.3;margin:0 0 30px;max-width:720px}
.bento{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.bx{border-radius:24px;padding:26px;display:flex;flex-direction:column;gap:12px;background:#F3F5F8;min-height:220px}.bx h3{margin:0;font-size:20px;font-weight:600}.bx p{margin:0;color:#42566A;line-height:1.75}
.bx.big{grid-column:span 2;background:#EFFBF7}.bx.big .ico{color:#0A7B67}.bx.dk{grid-column:span 2;background:#0B1B2B;color:#fff}.bx.dk p{color:#B7C4D1}.bx.dk .ico{color:#3DDBB0}
.lp-roles{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:26px 0;border-top:1px solid #E2E8EF;border-bottom:1px solid #E2E8EF}
.lp-roles b{font-weight:600;margin-inline-end:6px}.lp-roles span{padding:8px 16px;border-radius:999px;background:#F3F5F8;font-size:14.5px}
.promo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.pr{border:1px solid #E2E8EF;border-radius:24px;padding:26px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}.pr .tag{font-size:13px;color:#0A7B67;font-weight:600}.pr h3{margin:0;font-size:21px;font-weight:600}.pr p{margin:0 0 6px;color:#42566A;line-height:1.75}
.pr a{color:#0B1B2B;font-weight:600;text-decoration:none;border-bottom:2px solid #3DDBB0;padding-bottom:2px}
.plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;max-width:1000px}
.pl{border:1px solid #E2E8EF;border-radius:24px;padding:28px;display:flex;flex-direction:column;gap:14px}.pl .nm{font-size:17px;font-weight:600}.pl .pc{font-size:52px;font-weight:700;line-height:1}.pl .pc small{font-size:16px;font-weight:400;color:#5B6B7C}.pl p{margin:0;color:#5B6B7C;font-size:14px}
.pl a{margin-top:auto;text-align:center;padding:13px;border-radius:999px;border:1px solid #C9D3DE;color:#0B1B2B;text-decoration:none;font-weight:600}.pl a:hover{border-color:#0B1B2B}
.pl.best{background:#0B1B2B;color:#fff;border-color:#0B1B2B}.pl.best .pc small,.pl.best p{color:#B7C4D1}.pl.best a{background:#3DDBB0;border-color:#3DDBB0}.pl.best a:hover{background:#7BEBCB}
.pl .bdg{font-size:12.5px;font-weight:600;background:#3DDBB0;color:#0B1B2B;border-radius:999px;padding:3px 12px}
.lp-ft{padding:30px 0;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;color:#B7C4D1;font-size:14px}.lp-ft a{color:#B7C4D1;margin-inline-start:18px}.lp-ft a:hover{color:#3DDBB0}
.svc{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%;max-width:1100px;margin:30px 0 0;text-align:right;transform:translateY(60px)}
.sv{border-radius:28px;padding:26px;display:flex;flex-direction:column;gap:16px}.sv.t{background:#fff;color:#0B1B2B;box-shadow:0 20px 50px rgba(0,0,0,.25)}.sv.s{background:#3DDBB0;color:#0B1B2B}
.sv-h{display:flex;gap:12px;align-items:center}.sv-h b{display:block;font-size:22px;font-weight:700}.sv-h small{display:block;font-size:13.5px;color:#42566A}.sv.s .sv-h small{color:#0B4A3D}
.sv-ic{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#EFFBF7;color:#0A7B67;flex:none}.sv.s .sv-ic{background:#0B1B2B;color:#3DDBB0}
.sv ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}.sv li{display:flex;gap:10px;align-items:flex-start;font-size:15.5px;line-height:1.65}.sv li svg{flex:none;margin-top:4px;color:#0A7B67}.sv.s li svg{color:#0B1B2B}
.sv .lp-b1{align-self:flex-start;margin-top:auto}.sv .lp-b1.dk{background:#0B1B2B;color:#fff}.sv .lp-b1.dk:hover{background:#132A40}
.how{background:#0B1B2B;border-radius:28px;padding:30px;margin-bottom:60px;color:#fff}.how h2{color:#fff;margin-bottom:6px !important;font-size:24px !important}.lp-flow.in{transform:none;margin-top:16px;max-width:none}
@media(max-width:900px){.svc{grid-template-columns:1fr;transform:translateY(40px)}.lp-nav{display:none}.lp-flow{grid-template-columns:1fr;transform:translateY(40px)}.bento{grid-template-columns:1fr 1fr}.bx.big,.bx.dk{grid-column:span 2}.plans,.promo{grid-template-columns:1fr}}
@media(max-width:560px){.lp-w{padding:0 18px}.lp-hero{padding-top:36px}.bento{grid-template-columns:1fr}.bx.big,.bx.dk{grid-column:auto}.bx{min-height:0}.lp-sec{padding-top:80px}.lp-b1,.lp-b2{width:100%;text-align:center}.lp-cta{width:100%}}
</style>`;
function landing(storeUrl, trialDays, plans = [], base = '') {
  const ic = (n) => MI.ico(n, 34);
  const btn = { month: 'اشترك شهرياً', term: 'اشترك للفصل', year: 'اشترك سنوياً' };
  return shell({
    title: 'معياري | ملف الإنجاز الوظيفي للمعلم والمعلمة',
    bodyClass: 'lp',
    extraHead: shareMeta({ base, url: `${base}/`, title: 'معياري | ملف الإنجاز الوظيفي للمعلم والمعلمة', desc: `وثّق شواهدك على عناصر تقييم الأداء الوظيفي لوظيفتك من جوالك، والمساعد الذكي يصيغها بلغة رسمية، وملفك الكامل يتجهّز تلقائياً. جرّبه ${trialDays} أيام مجاناً.` }) + LANDING_CSS,
    body: `
<div class="lp-dark"><div class="lp-w">
  <header class="lp-hd"><a class="logo" href="/">${MI.logo(34)}معياري</a>
    <nav class="lp-nav" aria-label="القائمة الرئيسية"><a href="#features">المزايا</a><a href="#pricing">الباقات</a><a href="/school">للمدارس</a><a href="/exam-maker">صانع الاختبارات</a></nav>
    <a class="lp-out" href="/app">تسجيل الدخول</a></header>
  <section class="lp-hero">
    <span class="lp-kick">أدوات المعلم وقائد المدرسة في مكان واحد</span>
    <h1>ملف إنجازك <em>يكتب نفسه</em> وأنت تدرّس</h1>
    <p>صوّر الشاهد واكتب عنه كلمتين. معياري يصيغه بلغة رسمية، ويرتبه على عناصر تقييم وظيفتك، ويجهّز ملفك للطباعة.</p>
    <div class="lp-cta"><a class="lp-b1" href="/app#/register">ابدأ مجاناً ${trialDays} أيام</a><a class="lp-b2" href="#services">وش يقدم لك معياري؟</a></div>
    <div class="svc" id="services">
      <div class="sv t"><div class="sv-h"><span class="sv-ic">${MI.ico('user', 24)}</span><div><b>للمعلم والمعلمة</b><small>وكل الوظائف التعليمية</small></div></div>
        <ul>${['ملف الإنجاز الوظيفي على عناصر تقييم وظيفتك وأوزانها، PDF جاهز للطباعة', 'صياغة الشواهد بالذكاء الاصطناعي من كلمتين', 'التقييم الذاتي بسلّم التقدير الرسمي ومعرفة تقديرك المتوقع', 'السجلات اليومية: الانتظار والمناوبة والتعاميم واللجان والتواصل مع أولياء الأمور والمبادرات', 'صانع الاختبارات بجدول المواصفات', 'مساعد المعلم: سجل المادة والخطة الأسبوعية وتحليل النتائج والخطط العلاجية'].map((x) => `<li>${MI.ico('check', 18)}<span>${x}</span></li>`).join('')}</ul>
        <a class="lp-b1" href="/app#/register">ابدأ مجاناً ${trialDays} أيام</a></div>
      <div class="sv s"><div class="sv-h"><span class="sv-ic">${MI.ico('school', 24)}</span><div><b>لقائد المدرسة</b><small>معياري للمدرسة</small></div></div>
        <ul>${['قراءة تقرير التقويم الذاتي من منصة تميز وإعداد خطة التحسين من المؤشر الأضعف', 'قراءة تقرير نافس وإعداد الخطة العلاجية لكل مادة وصف', 'الخطة التشغيلية: التوجهات وتحليل الواقع والأهداف والبرامج ومتابعة التنفيذ', 'ملف شواهد التقويم المدرسي', 'لوحة المدرسة: حضور الفصول وغياب المنسوبين وحصص الانتظار', 'إسناد مهام الخطة للمعلمين ومتابعة تنفيذها'].map((x) => `<li>${MI.ico('check', 18)}<span>${x}</span></li>`).join('')}</ul>
        <a class="lp-b1 dk" href="/school">جرّبها لمدرستك</a></div>
    </div>
  </section>
</div></div>
<main class="lp-w">
  <section class="lp-sec" id="features" style="padding-top:110px">
    <div class="how"><h2>كيف يصيغ معياري شاهدك؟</h2>
    <div class="lp-flow in" aria-label="مثال على طريقة العمل">
      <div class="lp-step"><span>تكتب</span><b>طبّقت التعلم التعاوني في درس الكسور</b></div>
      <div class="lp-step"><span>يطلع لك</span><b>توظيف استراتيجية التعلم التعاوني في تدريس الكسور</b><small>الأهداف والوصف وآلية التنفيذ مصاغة بلغة رسمية، وتقدر تعدّلها.</small></div>
      <div class="lp-step"><span>ويُربط بـ</span><b>التنويع في استراتيجيات التدريس</b><small>العنصر المناسب من عناصر تقييم وظيفتك، ويدخل ملفك مباشرة.</small></div>
    </div>
    </div>
    <h2>كل شي يطلبه منك التقييم، جاهز قبل ما يُطلب</h2>
    <div class="bento">
      <div class="bx big">${ic('doc')}<h3>ملف PDF بترويسة الوزارة</h3><p>غلاف وفهرس وكل عنصر بشواهده، أو تقرير لعنصر واحد أو لشاهد واحد إذا طلبه المدير.</p></div>
      <div class="bx">${ic('qr')}<h3>رمز تحقق QR</h3><p>على كل تقرير وكل شاهد، يثبت إنه موثّق في معياري.</p></div>
      <div class="bx">${ic('calendar')}<h3>سجلاتك اليومية</h3><p>الانتظار والمناوبة والتعاميم واللجان والتواصل مع الأسر، وكل سجل يتحول لشاهد بضغطة.</p></div>
      <div class="bx">${ic('sparkle')}<h3>مساعد يصيغ الشاهد</h3><p>اكتب الفكرة بكلمتين، ويجهّز العنوان والأهداف والوصف ويقترح العنصر المناسب.</p></div>
      <div class="bx">${ic('target')}<h3>تقييم ذاتي بسلّم التقدير</h3><p>قيّم نفسك بأوصاف المستويات الرسمية، واعرف وش ينقصك للمستوى الأعلى.</p></div>
      <div class="bx dk">${ic('link')}<h3>صفحة باسمك</h3><p>رابط واحد ترسله لفريق التقويم بدل الملفات والمجلدات، أو تحطه QR على باب الفصل.</p></div>
    </div>
  </section>
  <section class="lp-roles" aria-label="الوظائف المدعومة"><b>لكل وظيفة تعليمية:</b>${Object.values(ROLES).map((r) => `<span>${esc(r.name)}</span>`).join('')}</section>
  <p style="color:#5B6B7C;font-size:13.5px;margin:12px 0 0">عناصر التقييم وأوزانها لكل وظيفة من نماذج الدليل الإرشادي لإدارة الأداء الوظيفي لشاغلي الوظائف التعليمية (الإصدار الثاني).</p>
  <section class="lp-sec" style="padding-top:70px">
    <div class="promo">
      <div class="pr"><span class="tag">للمدارس</span><h3>معياري للمدرسة</h3><p>ارفع تقرير التقويم الذاتي من منصة تميز، وتطلع لك خطة التحسين مرتبة من المؤشر الأضعف، جاهزة Word وPDF.</p><a href="/school">جرّبها لمدرستك</a></div>
      <div class="pr"><span class="tag">للمعلم</span><h3>صانع الاختبارات بجدول المواصفات</h3><p>الجدول على المعرفة والتطبيق والاستدلال، والأسئلة تُكتب حسبه، ونموذجان ومفتاح وورقة تظليل.</p><a href="/exam-maker">اعرف أكثر</a></div>
    </div>
  </section>
  <section class="lp-sec" id="pricing" style="padding-bottom:90px">
    <h2 style="margin-bottom:8px">سعر كوب قهوة</h2>
    <p style="color:#5B6B7C;margin:0 0 28px;font-size:17px">جرّب ${trialDays} أيام مجاناً، وبعدها اختر الباقة اللي تناسبك.</p>
    <div class="plans">${plans.map((p) => `<div class="pl${p.best ? ' best' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="nm">${esc(p.name)}</span>${p.best ? `<span class="bdg">الأوفر${p.saving ? ` · وفّر ${p.saving}%` : ''}</span>` : ''}</div>
      <div class="pc">${p.price} <small>ريال / ${esc(p.per)}</small></div><p>${esc(p.note)}</p>
      <a href="${esc(storeUrl)}">${btn[p.id] || 'اشترك'}</a></div>`).join('')}</div>
    <p style="color:#5B6B7C;font-size:13.5px;margin-top:16px">إذا انتهى اشتراكك، تبقى شواهدك محفوظة وصفحتك ظاهرة، وتتوقف الإضافة والطباعة فقط إلى أن تجدد.</p>
  </section>
</main>
<footer class="lp-dark"><div class="lp-w lp-ft"><span>معياري · من متجر معيار للمنتجات التعليمية الرقمية</span><span><a href="/privacy">الخصوصية والشروط</a><a href="${esc(storeUrl)}">المتجر</a></span></div></footer>`,
  });
}

// ---------- صفحة المعلم العامة ----------
async function publicPage(u, evs, base, isOwner) {
  const url = `${base}/p/${u.slug}`;
  const code = await qr(url, 220);
  const list = forRole(u.role);
  const byStd = list.map((s) => ({ s, items: evs.filter((e) => e.standard_id === s.id) }));
  const covered = byStd.filter((x) => x.items.length).length;
  const card = (e) => {
    const imgs = e.files.filter((f) => f.mime.startsWith('image/'));
    const pdfs = e.files.filter((f) => f.mime === 'application/pdf');
    return `<article class="card ev">
      ${imgs.length ? `<div class="ev-imgs">${imgs.slice(0, 4).map((f) => `<a href="/files/${f.id}" target="_blank"><img loading="lazy" src="/files/${f.id}" alt=""></a>`).join('')}</div>` : ''}
      <h3>${esc(e.title)}</h3>
      <div class="muted" style="font-size:13px">${hijri(e.ev_date)}</div>
      ${e.description ? `<p>${nl(e.description)}</p>` : ''}
      ${e.goals.length ? `<details><summary>الأهداف وآلية التنفيذ</summary><ul>${e.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>${e.steps ? `<p>${nl(e.steps)}</p>` : ''}${e.impact ? `<p><b>الأثر:</b> ${nl(e.impact)}</p>` : ''}</details>` : ''}
      ${pdfs.length || e.links.length ? `<div class="ev-links">${pdfs.map((f) => `<a class="btn soft sm" href="/files/${f.id}" target="_blank">${MI.ico('doc', 16)} ${esc(f.original)}</a>`).join('')}${e.links.map((l) => `<a class="btn soft sm" href="${esc(l)}" target="_blank" rel="noopener">${MI.ico('link', 16)} رابط</a>`).join('')}</div>` : ''}
    </article>`;
  };
  return shell({
    title: `ملف إنجاز ${u.full_name}`,
    color: u.theme,
    help: false,
    extraHead: `${shareMeta({ base, url: `${base}/p/${u.slug}`, title: `ملف إنجاز ${u.full_name}`, desc: `ملف الإنجاز الوظيفي لـ${u.full_name}: ${evs.length} شاهد موثّق على عناصر تقييم الأداء الوظيفي.` })}<style>
      .hero{background:var(--navy);color:#fff;padding:36px 0 70px;border-radius:0 0 32px 32px}.hero .btn{background:rgba(255,255,255,.12);color:#fff}
      .hero h1{font-size:clamp(24px,5vw,36px)} .hero .muted{color:rgba(255,255,255,.85)}
      .prof{margin-top:-50px;display:grid;gap:16px} @media(min-width:760px){.prof{grid-template-columns:1fr 240px}}
      .std{margin:26px 0 10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap} .std h2{margin:0;font-size:20px}
      .evs{display:grid;gap:14px} @media(min-width:760px){.evs{grid-template-columns:1fr 1fr}}
      .ev h3{margin:6px 0 0;font-size:17px} .ev p{margin:8px 0} .ev ul{margin:6px 0;padding-inline-start:20px}
      .ev-imgs{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin:-4px -4px 8px}
      .ev-imgs img{width:100%;height:130px;object-fit:cover;border-radius:10px;display:block}
      .ev-links{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px} summary{cursor:pointer;color:var(--brand);font-weight:600}
      .chips{display:flex;flex-wrap:wrap;gap:6px}
    </style>`,
    body: `
<div class="hero"><div class="wrap">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
    <span style="opacity:.9;font-weight:700">ملف الإنجاز الوظيفي</span>
    <div style="display:flex;gap:6px">${isOwner ? `<a class="btn sm" href="/app">${MI.ico('edit', 16)} تعديل</a>` : ''}<button class="btn sm" onclick="var r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('miyar-theme',r.dataset.theme)}catch(e){}" aria-label="الوضع الليلي">${MI.ico('moon', 16)}</button></div>
  </div>
  <h1 style="margin-top:18px">${esc(u.full_name)}</h1>
  <div class="muted">${esc([u.job_title, u.subject && 'مادة ' + u.subject, u.school].filter(Boolean).join(' · '))}</div>
</div></div>
<main class="wrap" style="padding-bottom:50px">
  <div class="prof">
    <div class="card">
      ${u.bio ? `<p style="margin-top:0">${nl(u.bio)}</p>` : ''}
      <div class="chips">${[u.stage, u.office, u.year].filter(Boolean).map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>
      <div style="display:flex;gap:18px;margin-top:14px;flex-wrap:wrap">
        <div><b style="font-size:24px;color:var(--brand)">${evs.length}</b> <span class="muted">شاهد</span></div>
        <div><b style="font-size:24px;color:var(--brand)">${covered}/${list.length}</b> <span class="muted">عنصر مغطّى</span></div>
      </div>
      <div class="bar" style="margin-top:8px"><i style="width:${Math.round((covered / list.length) * 100)}%"></i></div>
    </div>
    <div class="card" style="text-align:center"><img src="${code}" alt="QR" style="width:150px;height:150px"><div class="muted" style="font-size:12px">امسح الرمز لفتح الملف</div></div>
  </div>
  ${byStd.filter((x) => x.items.length).map(({ s, items }) => `
    <div class="std"><span style="color:var(--brand-text)">${MI.icoFor(s.icon, 26)}</span><h2>${s.id}. ${s.name}</h2><span class="pill">${items.length} شاهد</span></div>
    <div class="evs">${items.map(card).join('')}</div>`).join('') || '<div class="card" style="margin-top:20px;text-align:center" class="muted">لا توجد شواهد منشورة بعد.</div>'}
  <p class="muted" style="text-align:center;margin-top:40px;font-size:13px">موثّق عبر <a href="/">معياري</a></p>
</main>`,
  });
}

// ---------- صفحة التحقق ----------
function verifyPage({ kind, ev, std, u, count, stdCount, base }) {
  if (kind === 'invalid') {
    return shell({ title: 'رمز غير صحيح', body: `<div class="wrap" style="padding:70px 16px;max-width:520px"><div class="card" style="text-align:center"><div style="font-size:50px">⚠️</div><h1>رمز التحقق غير صحيح</h1><p class="muted">هذا الرمز غير مسجّل في معياري.</p></div></div>` });
  }
  const owner = kind === 'evidence' ? ev : u;
  const rows = kind === 'evidence'
    ? [['الشاهد', ev.title], ['العنصر', std.name], ['التاريخ', hijri(ev.ev_date) || '—'], ['صاحب الملف', ev.full_name], ['المدرسة', ev.school || '—'], ['رمز التحقق', ev.verify_code]]
    : [['صاحب الملف', u.full_name], ['الوظيفة', u.job_title], ['المدرسة', u.school || '—'], kind === 'standard' ? ['العنصر', std.name] : ['العناصر المغطّاة', `${stdCount} من ${forRole(u.role).length}`], ['عدد الشواهد', String(count)], ['رمز التحقق', u.verify_code]];
  const link = owner.is_public ? `<a class="btn" href="${base}/p/${owner.slug}">عرض الملف كاملاً</a>` : '';
  return shell({
    title: 'تحقق من التقرير',
    body: `<div class="wrap" style="padding:50px 16px;max-width:560px"><div class="card">
      <div style="text-align:center"><div style="width:64px;height:64px;margin:0 auto 8px;border-radius:50%;background:#e7f6ee;color:var(--ok);display:grid;place-items:center;font-size:32px">✓</div>
      <h1 style="font-size:22px">${kind === 'evidence' ? 'شاهد موثّق' : kind === 'standard' ? 'تقرير عنصر موثّق' : 'ملف إنجاز موثّق'}</h1>
      <p class="muted" style="margin-top:0">هذا التقرير صادر من منصة معياري وبياناته مطابقة لما هو مسجّل.</p></div>
      <table style="width:100%;border-collapse:collapse;margin:10px 0 16px">${rows.map(([k, v]) => `<tr><td class="muted" style="padding:8px 0;border-bottom:1px solid var(--line);width:120px">${k}</td><td style="padding:8px 0;border-bottom:1px solid var(--line);font-weight:600">${esc(v)}</td></tr>`).join('')}</table>
      <div style="text-align:center">${link}</div>
    </div></div>`,
  });
}

// ---------- التقارير القابلة للطباعة ----------
async function printReport({ u, evs, template, base, scope, std }) {
  const modern = template === 'modern';
  const vUrl = (code, s) => `${base}/v/${code}${s ? '/' + s : ''}`;
  const list = forRole(u.role);
  const inRole = new Set(list.map((s) => s.id));
  const groups = list.map((s) => ({ s, items: evs.filter((e) => e.standard_id === s.id) })).filter((g) => g.items.length);
  // شواهد على عناصر من وظيفة سابقة (بعد تغيير الوظيفة) تظهر في آخر الملف ولا تضيع
  const others = evs.filter((e) => !inRole.has(e.standard_id));
  if (others.length) groups.push({ s: { id: 0, no: '•', name: 'شواهد أخرى', weight: 0 }, items: others, other: true });
  const qrMain = await qr(scope === 'standard' ? vUrl(u.verify_code, std.id) : vUrl(u.verify_code), 240);
  const stdQr = {};
  for (const g of groups) if (!g.other) stdQr[g.s.id] = await qr(vUrl(u.verify_code, g.s.id), 160);
  const evQr = {};
  for (const e of evs) evQr[e.id] = await qr(vUrl(e.verify_code), 140);

  const info = [['الاسم', u.full_name], ['الوظيفة', u.job_title], ['المادة', u.subject], ['المرحلة', u.stage], ['المدرسة', u.school], ['إدارة التعليم', u.office], ['مدير المدرسة', u.principal], ['العام الدراسي', u.year]].filter(([, v]) => v);

  const evidenceBlock = (e) => {
    const imgs = e.files.filter((f) => f.mime.startsWith('image/')).slice(0, 4);
    return `<section class="ev">
      <div class="ev-head"><div><div class="ev-std">${esc((anyById(e.standard_id, u.role) || {}).name || '')}</div><h3>${esc(e.title)}</h3>${e.ev_date ? `<div class="ev-date">${hijri(e.ev_date)}</div>` : ''}</div>
      <div class="qr-sm"><img src="${evQr[e.id]}"><span>${e.verify_code}</span></div></div>
      ${e.goals.length ? `<h4>الأهداف</h4><ul>${e.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
      ${e.description ? `<h4>الوصف</h4><p>${nl(e.description)}</p>` : ''}
      ${e.steps ? `<h4>آلية التنفيذ</h4><p>${nl(e.steps)}</p>` : ''}
      ${e.impact ? `<h4>الأثر</h4><p>${nl(e.impact)}</p>` : ''}
      ${(() => { const ps = require('./coverage').partsOf(e.standard_id, u.role).filter((p) => (e.parts || []).includes(p.k)); return ps.length ? `<h4>ما يثبته من وصف المستوى 5 (مثالي)</h4><ul>${ps.map((p) => `<li>${esc(p.t)}</li>`).join('')}</ul>` : ''; })()}
      ${imgs.length ? `<div class="imgs n${imgs.length}">${imgs.map((f) => `<img src="/files/${f.id}">`).join('')}</div>` : ''}
      ${e.links.length ? `<p class="links">${e.links.map((l) => `🔗 ${esc(l)}`).join('<br>')}</p>` : ''}
    </section>`;
  };

  const cover = scope === 'evidence' ? '' : `<div class="page cover">
    ${modern ? '<div class="band">' : ''}<div class="cover-top">${scope === 'standard' ? 'تقرير عنصر' : 'ملف الإنجاز الوظيفي'}</div>
    <h1>${scope === 'standard' ? esc(std.name) : 'ملف الإنجاز والشواهد'}</h1>${modern ? '</div>' : ''}
    <div class="cover-name">${esc(u.full_name)}</div>
    <table class="info">${info.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    <div class="cover-qr"><img src="${qrMain}"><div>امسح الرمز للتحقق من صحة الملف<br><b>${u.verify_code}</b></div></div>
  </div>`;

  const index = scope !== 'portfolio' ? '' : `<div class="page"><h2 class="sec">فهرس عناصر التقييم</h2><p class="muted" style="margin-top:-6px">حسب ${ROLES[roleKey(u.role)].model} في الدليل الإرشادي لإدارة الأداء الوظيفي</p>
    <table class="idx"><thead><tr><th>م</th><th>العنصر</th><th>الوزن</th><th>عدد الشواهد</th></tr></thead><tbody>
    ${list.map((s) => { const n = evs.filter((e) => e.standard_id === s.id).length; return `<tr class="${n ? '' : 'empty'}"><td>${s.no}</td><td>${s.name}</td><td>${s.weight}%</td><td>${n || '—'}</td></tr>`; }).join('')}
    </tbody></table>
    ${u.bio ? `<h2 class="sec" style="margin-top:28px">نبذة</h2><p>${nl(u.bio)}</p>` : ''}
  </div>`;

  const body = groups.map((g) => `<div class="page">
    ${scope !== 'evidence' ? `<div class="std-head"><div><span class="std-no">${g.s.no}</span><h2>${g.s.name}</h2><div class="muted">${g.other ? 'عناصر من وظيفة سابقة' : `الوزن ${g.s.weight}%`} · ${g.items.length} شاهد</div></div>${g.other ? '' : `<div class="qr-sm"><img src="${stdQr[g.s.id]}"><span>تحقق العنصر</span></div>`}</div>` : ''}
    ${g.items.map(evidenceBlock).join('')}
  </div>`).join('');

  const css = `
  @page { size: A4; margin: 14mm; }
  body { background: #e9eeed; color: #10201e; font-size: 13.5px; }
  .toolbar { position: sticky; top: 0; z-index: 5; background: var(--card); border-bottom: 1px solid var(--line); padding: 10px 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .page { background: #fff; color: #10201e; width: 210mm; max-width: 100%; min-height: 297mm; margin: 16px auto; padding: 16mm; box-shadow: 0 2px 12px rgba(0,0,0,.08); position: relative; }
  h1, h2, h3 { font-family: ${modern ? "'IBM Plex Sans Arabic'" : "'Amiri', serif"}; }
  .cover { display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: center; ${modern ? 'justify-content: flex-start; padding-top: 0;' : 'border: 3px double var(--brand); outline: 1px solid var(--brand); outline-offset: -10mm;'} }
  .band { background: linear-gradient(135deg, var(--brand), var(--brand-2)); margin: 0 -16mm; width: calc(100% + 32mm); padding: 48mm 16mm 22mm; border-radius: 0 0 40px 40px; }
  .cover-top { font-weight: 700; letter-spacing: 1px; ${modern ? 'color:#fff;' : 'color: var(--brand);'} }
  .cover h1 { font-size: 40px; margin: 10px 0 4px; ${modern ? 'color:#fff;' : 'color: var(--brand);'} }
  .cover-name { font-size: 24px; font-weight: 700; margin: ${modern ? '26mm' : '18px'} 0 18px; }
  .info { border-collapse: collapse; min-width: 70%; margin: 0 auto; }
  .info th, .info td { padding: 8px 12px; border-bottom: 1px solid #e2e8e7; text-align: right; }
  .info th { color: #5b6b69; font-weight: 600; width: 140px; }
  .cover-qr { margin-top: 28px; display: flex; gap: 14px; align-items: center; font-size: 12px; color: #5b6b69; }
  .cover-qr img { width: 110px; height: 110px; }
  .sec { color: var(--brand); border-bottom: 2px solid var(--brand); padding-bottom: 6px; }
  .idx { width: 100%; border-collapse: collapse; }
  .idx th { background: var(--brand); color: #fff; padding: 8px; }
  .idx td { padding: 8px; border-bottom: 1px solid #e2e8e7; }
  .idx tr.empty td { color: #9aa8a6; }
  .std-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; border-radius: ${modern ? '14px' : '0'}; ${modern ? 'background: var(--brand); color: #fff;' : 'border-top: 3px solid var(--brand); border-bottom: 1px solid var(--brand);'} margin-bottom: 14px; }
  .std-head h2 { margin: 0; font-size: 22px; display: inline; } .std-head .muted { ${modern ? 'color: rgba(255,255,255,.85);' : ''} font-size: 12px; }
  .std-no { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; margin-inline-end: 8px; font-weight: 700; ${modern ? 'background:#fff;color:var(--brand);' : 'background:var(--brand);color:#fff;'} }
  .qr-sm { text-align: center; font-size: 10px; color: inherit; background: #fff; padding: 4px; border-radius: 8px; }
  .qr-sm img { width: 72px; height: 72px; display: block; } .qr-sm span { color: #5b6b69; }
  .ev { break-inside: avoid; margin-bottom: 18px; padding: 14px 16px; ${modern ? 'border-radius: 14px; background: var(--brand-soft);' : 'border: 1px solid #cfd8d6;'} }
  .ev-head { display: flex; justify-content: space-between; gap: 12px; }
  .ev h3 { font-size: 19px; margin: 2px 0; } .ev-std { color: var(--brand); font-size: 12px; font-weight: 700; } .ev-date { color: #5b6b69; font-size: 12px; }
  .ev h4 { margin: 10px 0 2px; color: var(--brand); font-size: 13.5px; } .ev p { margin: 0; } .ev ul { margin: 0; padding-inline-start: 20px; }
  .imgs { display: grid; gap: 6px; margin-top: 10px; grid-template-columns: repeat(2, 1fr); } .imgs.n1 { grid-template-columns: 1fr; }
  .imgs img { width: 100%; height: 60mm; object-fit: cover; border-radius: ${modern ? '10px' : '2px'}; } .imgs.n1 img { height: 85mm; }
  .links { font-size: 11px; color: #5b6b69; word-break: break-all; margin-top: 8px !important; }
  .foot { position: absolute; bottom: 7mm; left: 16mm; right: 16mm; font-size: 10px; color: #9aa8a6; display: flex; justify-content: space-between; }
  @media print { .band { margin: 0; width: 100%; } body { background: #fff; } .toolbar { display: none; } .page { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 0; page-break-after: always; } .cover { min-height: 265mm; } .foot { display: none; } }`;

  const q = (t) => `?t=${t}`;
  const empty = !groups.length ? '<div class="page" style="text-align:center;padding-top:60mm"><h2>لا توجد شواهد بعد</h2><p>أضف شواهدك من التطبيق ثم ارجع للطباعة.</p></div>' : '';
  return shell({
    title: `تقرير - ${u.full_name}`,
    color: u.theme,
    raw: true,
    extraHead: `${PRINT_KEEP}<style>${css}</style>`,
    body: `<div class="toolbar"><a class="btn ghost sm" href="/app">→ رجوع</a>
      <a class="btn sm ${modern ? 'ghost' : ''}" href="${q('classic')}">القالب الرسمي</a><a class="btn sm ${modern ? '' : 'ghost'}" href="${q('modern')}">القالب العصري</a>
      <button class="btn sm" onclick="window.print()">🖨️ طباعة / حفظ PDF</button><span class="muted" style="font-size:12px">اختر "حفظ كـ PDF" من نافذة الطباعة</span></div>
      ${cover}${index}${body}${empty}<p class="madeby" style="text-align:center;font-size:10px;color:#8a9896">${esc(F.madeBy(u))}</p>`,
  });
}


// ---------- سياسة الخصوصية وشروط الاستخدام ----------
const PRIVACY_UPDATED = '18 نوفمبر 2026';
function privacyPage(storeUrl, base = '') {
  const h = (id, t) => `<h2 id="${id}" style="margin-top:28px">${t}</h2>`;
  const ul = (xs) => `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  return shell({
    title: 'سياسة الخصوصية وشروط الاستخدام | معياري',
    extraHead: `<meta name="description" content="كيف يحفظ معياري بياناتك ويستخدمها، وحقوقك عليها، وشروط استخدام المنصة.">`,
    body: `<header class="wrap" style="display:flex;justify-content:space-between;align-items:center;padding-top:18px;padding-bottom:18px"><a class="logo" href="/"><b>م</b>معياري</a><a class="btn ghost" href="/app">التطبيق</a></header>
<article class="wrap card" style="max-width:820px;margin:0 auto 40px;line-height:1.95">
<h1 style="margin-top:0">سياسة الخصوصية وشروط الاستخدام</h1>
<p class="muted">آخر تحديث: ${PRIVACY_UPDATED}. تنطبق على «معياري للمعلم» و«معياري للمدرسة»، ويقدمهما متجر معيار للمنتجات التعليمية الرقمية.</p>
<div class="card" style="background:var(--soft,#eef6f5);border:0"><b>باختصار:</b> نحفظ بياناتك عشان نقدم لك الخدمة فقط، ما نبيعها ولا نستخدمها في إعلانات، وتقدر تحذف حسابك وكل بياناتك بنفسك من «ملفي» في أي وقت. <b>لا ترفع بيانات شخصية للطلاب</b> (أسماء كاملة، صور وجوه واضحة، أرقام هويات، درجات باسم الطالب).</div>
${h('privacy', 'أولاً: سياسة الخصوصية')}
<h3>1. البيانات اللي نجمعها</h3>
${ul([
  '<b>بيانات الحساب:</b> الاسم، والبريد الإلكتروني، وكلمة المرور (تُحفظ مشفّرة ولا نقدر نطّلع عليها).',
  '<b>بيانات الملف الوظيفي</b> اللي تدخلها اختيارياً: الصفة، والتخصص، والمدرسة، والمرحلة، ومكتب التعليم، واسم القائد، والنبذة.',
  '<b>الشواهد</b>: النصوص والروابط والصور والملفات اللي ترفعها.',
  '<b>بيانات المدرسة</b> (معياري للمدرسة): اسم المدرسة ورقمها الوزاري وشعارها، ونسب مؤشرات تقرير التقويم، وأرقام بطاقة نافس، والخطط، وأسماء أعضاء الفريق وبريدهم، وملف الشواهد.',
  '<b>بيانات تشغيلية</b>: ملف تعريف ارتباط (كوكي) واحد ضروري لتسجيل الدخول، وعدد مرات استخدام المساعد الذكي يومياً. ما نستخدم أدوات تتبّع إعلانية.',
])}
<h3>2. ليش نستخدمها</h3>
${ul(['تشغيل حسابك وعرض ملفك وطباعته وتصديره.', 'صياغة الشواهد والخطط بالمساعد الذكي لما تطلب ذلك.', 'التحقق من الشواهد والتقارير برمز التحقق وQR.', 'تفعيل الاشتراك والدعم الفني.'])}
<h3>3. من يشوف بياناتك</h3>
${ul([
  '<b>أنت.</b> وصفحتك العامة يشوفها من معه رابطها فقط إذا خليتها «منشورة»، وتقدر تخفيها من «ملفي».',
  '<b>قائد مدرستك</b>: يشوف الشواهد اللي تربطها أنت بمهام خطة المدرسة فقط.',
  '<b>من معه رابط ملف شواهد المدرسة</b>: إذا فعّله قائد المدرسة، ويقدر يوقفه أو يغيّره أي وقت.',
  '<b>مزودو الخدمة التقنية</b> اللي نحتاجهم لتشغيل المنصة: مزود الاستضافة السحابية، ومزود نموذج الذكاء الاصطناعي (يستلم نص الطلب اللي تكتبه للمساعد فقط لمعالجته). ما نبيع بياناتك لأي جهة.',
])}
<h3>4. مكان حفظ البيانات</h3>
<p>البيانات محفوظة حالياً على خوادم سحابية <b>خارج المملكة العربية السعودية</b> (الولايات المتحدة)، وكذلك معالجة طلبات المساعد الذكي. باستخدامك المنصة توافق على ذلك. نعمل على نقل الاستضافة إلى خوادم داخل المملكة، وسنحدّث هذه الصفحة عند الانتقال.</p>
<h3>5. بيانات الطلاب</h3>
<p>المنصة مصممة لتوثيق عمل المعلم والمدرسة، <b>ومو لحفظ بيانات الطلاب</b>. قبل ما ترفع أي شاهد:</p>
${ul(['اخفِ أسماء الطلاب الكاملة وأرقام هوياتهم ودرجاتهم الفردية، أو استخدم أرقاماً بدل الأسماء.', 'لا ترفع صور وجوه الطلاب الواضحة، أو غطّ الوجوه، أو صوّر من الخلف.', 'إذا لزم رفع بيانات طالب، تأكد من موافقة ولي أمره وسياسة مدرستك.'])}
<p>أنت مسؤول عن محتوى ما ترفعه. وإذا وصلنا بلاغ عن محتوى فيه بيانات طالب، نقدر نحذفه.</p>
<h3>6. مدة الحفظ والحذف</h3>
<p>نحفظ بياناتك طول ما حسابك موجود. إذا انتهى اشتراكك تبقى بياناتك محفوظة إلى أن تجدد أو تحذفها. <b>حذف الحساب</b> من «ملفي ← حذف الحساب» يمسح حسابك وشواهدك وملفاتك المرفوعة وبيانات مدرستك نهائياً، وما نقدر نرجعها بعده.</p>
<h3>7. حقوقك</h3>
${ul(['الاطلاع على بياناتك وتصحيحها من التطبيق مباشرة.', 'تصدير ملفك (PDF وWord).', 'حذف حسابك وبياناتك.', 'سحب موافقتك بحذف الحساب، أو التواصل معنا لأي طلب يخص بياناتك.'])}
<h3>8. الأمان</h3>
<p>الاتصال مشفّر (HTTPS)، وكلمات المرور مشفّرة، وملفاتك ما تنفتح إلا لك أو لمن تشاركه الرابط. ومع ذلك ما فيه نظام على الإنترنت آمن 100%، فاختر كلمة مرور قوية ولا تشاركها.</p>
${h('terms', 'ثانياً: شروط الاستخدام')}
${ul([
  '<b>معياري منصة مستقلة</b> من متجر معيار، وليست تابعة لوزارة التعليم ولا لهيئة تقويم التعليم والتدريب. أسماء المعايير والمؤشرات والاستمارات مذكورة للمواءمة معها فقط.',
  '<b>رمز التحقق</b> يثبت أن الشاهد أو التقرير مسجّل في معياري بهذا المحتوى، ولا يعني اعتماده من أي جهة رسمية.',
  '<b>المحتوى مسؤوليتك:</b> أنت مسؤول عن صحة الشواهد والبيانات اللي تدخلها، وعن مراجعة ما يقترحه المساعد الذكي قبل اعتماده.',
  '<b>الاشتراك</b> بأكواد تفعيل من متجر معيار، والتجربة المجانية لمدة محددة. سياسة الاسترجاع حسب سياسة المتجر.',
  '<b>الاستخدام المقبول:</b> ممنوع رفع محتوى مخالف للأنظمة أو منتهك لحقوق الغير أو بيانات أشخاص بدون إذنهم، ونقدر نوقف الحساب المخالف.',
  'نقدر نحدّث هذه الشروط والسياسة، ونعلن عن التغييرات المهمة داخل التطبيق.',
])}
<h2 style="margin-top:28px">التواصل</h2>
<p>لأي استفسار أو طلب يخص بياناتك: تواصل معنا عبر <a href="${esc(storeUrl)}">متجر معيار</a>.</p>
</article>`,
  });
}

// ---------- صفحة صانع الاختبارات ----------
function examLanding(trialDays, base = '') {
  const feats = [
    ['📊', 'جدول مواصفات حقيقي', 'وزن كل درس من عدد حصصه، وتوزيع الأسئلة على مستويات المعرفة والتطبيق والاستدلال بنسب تحددها أنت، والجدول يتحدث مباشرة.'],
    ['🤖', 'أسئلة تُكتب حسب الجدول', 'كل خانة في الجدول تتحول إلى سؤال من درسها ومستواها، مكتوب من أهداف الدرس ومهاراته، وتقدر تعيد كتابة أي سؤال بضغطة.'],
    ['🧩', 'ستة أنواع أسئلة', 'اختيار من متعدد، صح وخطأ، أكمل الفراغ، المزاوجة، الإجابة القصيرة، والمقالي، بالدرجات والتعليمات الرسمية.'],
    ['🔀', 'نموذجان (أ) و(ب)', 'نفس الأسئلة بترتيب مختلف للحد من الغش، مع مفتاح إجابة لكل نموذج.'],
    ['🖨️', 'ورقة جاهزة للطباعة', 'ترويسة الوزارة، بيانات الطالب، جدول الدرجات، ورقة الإجابة الإلكترونية (تظليل)، وجدول المواصفات موقّع، بصيغة PDF وWord.'],
    ['📈', 'مربوط بسجل المادة', 'أرسل الاختبار لسجل الفصل، وأدخل الدرجات، ويطلع لك تحليل المهارات وأضعف نواتج التعلم.'],
  ];
  const steps = [
    ['اختر المصدر', 'من سجل المادة، أو قالب المقرر، أو اكتب الدروس بنفسك.'],
    ['حدد الدروس والحصص', 'الجدول يحسب الأوزان ويوزع الأسئلة على الدروس والمستويات.'],
    ['اكتب الأسئلة', 'آلياً حسب الجدول، أو يدوياً، وراجع وعدّل كل سؤال.'],
    ['اطبع أو صدّر', 'الورقة، النموذج (ب)، المفتاح، ورقة التظليل، وجدول المواصفات.'],
  ];
  const faq = [
    ['هل جدول المواصفات مطابق للمطلوب في المدارس؟', 'يُبنى على الطريقة المعتمدة: الوزن النسبي لكل درس من عدد الحصص، وتوزيع الأسئلة على المستويات المعرفية الثلاثة، مع إمكانية تعديل النسب حسب توجيه مشرفك.'],
    ['هل أقدر أعدّل الأسئلة؟', 'نعم، كل سؤال قابل للتعديل والحذف وإعادة الكتابة، وتضيف أسئلتك الخاصة متى ما تبي.'],
    ['هل الأسئلة دقيقة علمياً؟', 'تُكتب من أهداف الدرس ومحتواه، وإذا لصقت نص الدرس تكون أدق. ومع ذلك راجعها قبل الطباعة، فالمعلم هو المسؤول عن ورقته.'],
    ['هل هو ضمن اشتراك معياري؟', 'نعم، صانع الاختبارات جزء من معياري للمعلم، مع ملف الإنجاز وسجل المادة، باشتراك واحد.'],
  ];
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return shell({
    title: 'صانع الاختبارات بجدول المواصفات | معياري',
    extraHead: `${shareMeta({ base, url: `${base}/exam-maker`, title: 'صانع الاختبارات بجدول المواصفات للمعلم والمعلمة', desc: 'اختبار كامل بجدول مواصفات على مستويات المعرفة والتطبيق والاستدلال، وأسئلة تُكتب حسب الجدول، ونموذجان ومفتاح وورقة تظليل، بترويسة الوزارة وPDF وWord.' })}
<link rel="canonical" href="${esc(base)}/exam-maker"><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>.stp{display:flex;gap:12px;align-items:flex-start}.stp b{flex:0 0 34px;height:34px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center}
details.card summary{cursor:pointer;font-weight:600}details.card p{margin:10px 0 0}</style>`,
    body: `
<header class="wrap" style="display:flex;justify-content:space-between;align-items:center;padding-top:18px;padding-bottom:18px">
  <a class="logo" href="/"><b>م</b>معياري</a>
  <a class="btn ghost" href="/app#/exam">تسجيل الدخول</a>
</header>
<section class="wrap" style="padding:40px 16px 30px;text-align:center">
  <span class="pill">صانع الاختبارات للمعلم والمعلمة</span>
  <h1 style="font-size:clamp(28px,6vw,44px);margin:16px 0 10px">اختبارك بجدول مواصفاته<br><span style="color:var(--brand)">جاهز للطباعة في دقائق.</span></h1>
  <p class="muted" style="max-width:660px;margin:0 auto 22px;font-size:17px">حدد الدروس وعدد الحصص، ومعياري يبني جدول المواصفات على المعرفة والتطبيق والاستدلال، ويكتب الأسئلة حسب الجدول، ويطلع لك الورقة والنموذج (ب) والمفتاح وورقة التظليل بترويسة الوزارة.</p>
  <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <a class="btn" href="/app#/register" style="font-size:17px;padding:12px 22px">جرّبه ${trialDays} أيام مجاناً</a>
    <a class="btn ghost" href="/" style="font-size:17px;padding:12px 22px">تعرّف على معياري</a>
  </div>
</section>
<section class="wrap grid g3" style="padding-bottom:40px">
  ${feats.map(([i, t, d]) => `<div class="card"><div style="font-size:28px">${i}</div><h3>${t}</h3><p class="muted" style="margin:0">${d}</p></div>`).join('')}
</section>
<section class="wrap" style="padding-bottom:40px">
  <h2 style="text-align:center">كيف يشتغل؟</h2>
  <div class="grid g2">${steps.map(([t, d], i) => `<div class="card stp"><b>${i + 1}</b><div><h3 style="margin:0 0 4px">${t}</h3><p class="muted" style="margin:0">${d}</p></div></div>`).join('')}</div>
</section>
<section class="wrap" style="padding-bottom:40px">
  <h2 style="text-align:center">أسئلة شائعة</h2>
  <div style="display:grid;gap:10px">${faq.map(([q, a]) => `<details class="card"><summary>${q}</summary><p class="muted">${a}</p></details>`).join('')}</div>
</section>
<section class="wrap" style="padding-bottom:50px">
  <div class="card" style="text-align:center;border-color:var(--brand-2)">
    <h2 style="margin-top:0">اختبارك القادم خلّه أسهل</h2>
    <a class="btn" href="/app#/register">ابدأ مجاناً</a>
  </div>
</section>
<footer class="wrap muted" style="padding:20px 16px 40px;text-align:center;font-size:13px">معياري من متجر معيار للمنتجات التعليمية الرقمية · <a href="/privacy">الخصوصية وشروط الاستخدام</a></footer>`,
  });
}

module.exports = { examLanding, privacyPage, PRIVACY_UPDATED, landing, publicPage, verifyPage, printReport, notFound, message, esc };
