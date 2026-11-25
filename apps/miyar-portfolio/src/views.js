const QRCode = require('qrcode');
const { ROLES, forRole, roleKey, anyById } = require('./standards');
const { SCHOOL_PACKAGES } = require('./plans');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = (s) => esc(s).replace(/\n/g, '<br>');
const qr = (text, size = 180) => QRCode.toDataURL(text, { margin: 1, width: size, color: { dark: '#10201e', light: '#ffffff' } });
const F = require('./fmt');
const MI = require('../public/icons.js');
const { V: ASSET_V } = require('./assetv');
function hijri(d) {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return esc(F.dual(d));
  const dt = new Date(d + 'T12:00:00');
  if (isNaN(dt)) return esc(d);
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt); } catch { return esc(d); }
}
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=Amiri:wght@700&display=swap" rel="stylesheet">';

function shell({ title, body, color = 'miyar', extraHead = '', bodyClass = '', raw = false, help = !raw }) {
  return `<!doctype html><html lang="ar" dir="rtl" data-color="${esc(color)}"><head><meta charset="utf-8"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#0E7C66"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="معياري"><meta name="apple-mobile-web-app-status-bar-style" content="default"><script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))</script><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${FONTS}<link rel="stylesheet" href="/assets/theme.css?v=${ASSET_V}">${extraHead}
<script>try{var t=localStorage.getItem('miyar-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script></head>
<body class="${bodyClass}">${raw ? body : MI.iconizeHtml(body)}${help ? `<script src="/assets/help.js?v=${ASSET_V}" defer></script>` : ''}</body></html>`;
}

const notFound = () => shell({ title: 'غير موجود', body: `<div class="wrap" style="padding:80px 16px;text-align:center"><h1>الصفحة غير موجودة</h1><p class="muted">تأكد من الرابط.</p><a class="btn" href="/">الرئيسية</a></div>` });
const message = (t, m, href) => shell({ title: t, body: `<div class="wrap" style="padding:80px 16px;text-align:center"><h1>${esc(t)}</h1><p class="muted">${esc(m)}</p><a class="btn" href="${esc(href)}">متابعة</a></div>` });

// وسوم المشاركة (واتساب وتويتر) ووصف محركات البحث
function shareMeta({ title, desc, url, base }) {
  const img = `${base}/assets/og.png`;
  return `<meta name="description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:locale" content="ar_SA">
<meta property="og:site_name" content="معياري"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#F7F4EE">`;
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
const LANDING_CSS = `<link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&display=swap" rel="stylesheet"><style>
.lp{background:#fff;color:#1B2226;overflow-x:hidden}
.lp-w{max-width:1160px;margin:0 auto;padding:0 24px}
.lp-top{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid #ECEDEE}
.lp-hd{display:flex;align-items:center;justify-content:space-between;gap:16px;height:72px}
.lp-hd .logo{color:#1B2226;font-size:21px;font-weight:600}.lp-nav{display:flex;gap:26px;font-size:15px}.lp-nav a{color:#5C6569;text-decoration:none}.lp-nav a:hover{color:#1B2226}
.lp-hd-a{display:flex;gap:10px;align-items:center}
.lp-out{padding:8px 16px;font-weight:600;font-size:15px;color:#1B2226;text-decoration:none;border:1.5px solid #1B2226;border-radius:10px}.lp-out:hover{background:#1B2226;color:#fff}
.lp-in{padding:9.5px 18px;font-weight:600;font-size:15px;color:#fff;background:#0E7C66;border-radius:10px;text-decoration:none;box-shadow:0 3px 0 #0A5C4C}.lp-in:hover{background:#0B6A57;color:#fff}
.hand{font-family:'Aref Ruqaa',serif;color:#0E7C66;font-size:24px;line-height:1.4;font-weight:400}
.lp-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:56px;align-items:center;padding:64px 0 56px}
.lp-txt{display:flex;flex-direction:column;align-items:flex-start}
.lp-hero h1{margin:6px 0 0;font-size:clamp(38px,5.2vw,64px);line-height:1.2;font-weight:700}
.hl{position:relative;white-space:nowrap;z-index:0}.hl:before{content:'';position:absolute;inset:52% -6px 4% -6px;background:#F4DE9C;z-index:-1;border-radius:3px 8px 4px 10px;transform:rotate(-1.5deg)}
.lp-hero p{margin:20px 0 0;font-size:clamp(17px,1.9vw,19px);line-height:1.85;color:#5C6569;max-width:520px}
.lp-cta{display:flex;gap:16px 20px;align-items:center;flex-wrap:wrap;margin-top:30px}
.lp-b1{display:inline-flex;align-items:center;gap:8px;padding:15px 28px;font-size:17px;font-weight:600;color:#fff;background:#1B2226;border-radius:12px;text-decoration:none;box-shadow:0 3px 0 #000;transition:transform .1s}
.lp-b1:active{transform:translateY(2px);box-shadow:0 1px 0 #000}
.lp-b1.g{background:#0E7C66;box-shadow:0 3px 0 #0A5C4C}.lp-b1.g:hover{background:#0B6A57;color:#fff}
.lp-b2{display:inline-flex;align-items:center;gap:6px;font-size:16.5px;font-weight:600;color:#1B2226;text-decoration:none;border-bottom:1.5px solid #1B2226;padding-bottom:2px}
.free{display:inline-flex;align-items:center;gap:8px;font-family:'Aref Ruqaa',serif;font-size:21px;color:#1B2226}
.desk{position:relative;height:520px}
.desk .pg{position:absolute;width:62%;top:10px;left:4%;transform:rotate(-5deg);box-shadow:0 18px 40px rgba(0,0,0,.14);background:#fff}
.desk img{width:100%;height:auto;display:block}
.desk .tape{position:absolute;width:110px;height:30px;background:rgba(230,207,154,.75);top:-12px;left:38%;transform:rotate(4deg)}
.desk .ph{position:absolute;width:44%;right:2%;top:56px;transform:rotate(4deg);border:8px solid #1B2226;border-radius:34px;overflow:hidden;background:#fff;box-shadow:0 24px 50px rgba(0,0,0,.25)}
.desk .stk{position:absolute;left:0;bottom:18px;width:210px;background:#FFF3B8;padding:18px 18px 22px;transform:rotate(-3deg);box-shadow:0 10px 20px rgba(0,0,0,.12);font-family:'Aref Ruqaa',serif;font-size:21px;line-height:1.5;color:#1B2226}
.desk .stk small{display:block;font-family:'Readex Pro',sans-serif;font-size:12px;color:#7A6A2A;margin-bottom:4px}
.lp-roles{padding:26px 0;border-top:1px solid #ECEDEE;color:#5C6569;font-size:15.5px;line-height:2}
.lp-roles b{color:#1B2226;font-weight:600}
.lp-sec{padding:84px 0;border-top:1px solid #ECEDEE}.lp-eb{font-family:'Aref Ruqaa',serif;color:#0E7C66;font-size:24px;margin-bottom:4px}
.lp-sec h2{font-size:clamp(30px,4vw,46px);font-weight:700;line-height:1.28;margin:0 0 14px;max-width:780px}
.lp-lead{color:#5C6569;font-size:17px;line-height:1.8;max-width:640px;margin:0 0 36px}
.blob{position:relative;width:58px;height:58px;display:grid;place-items:center;color:#1B2226;flex:none;z-index:0}
.blob:before{content:'';position:absolute;inset:6px 2px 2px 8px;background:#F4DE9C;border-radius:46% 54% 40% 60%/55% 45% 55% 45%;z-index:-1}
.blob.b2:before{background:#CDEBDF;border-radius:58% 42% 55% 45%/45% 58% 42% 55%}.blob.b3:before{background:#F7D9C7;border-radius:40% 60% 52% 48%/60% 40% 60% 40%}
.blob svg{stroke-width:2.1}
.tg-h{display:flex;gap:14px;align-items:center;margin-bottom:18px}.tg-h b{display:block;font-size:21px;font-weight:600}.tg-h small{display:block;font-size:14px;color:#5C6569;line-height:1.7}
.tools-big{display:grid;gap:16px;margin-bottom:16px}
.tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.tl{background:#fff;border:1.5px solid #DADDDE;border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:8px;text-decoration:none;color:#1B2226;transition:border-color .15s}
.tl:hover{border-color:#1B2226;color:#1B2226}
.tl h3{margin:6px 0 0;font-size:19px;font-weight:700;line-height:1.5}.tl p{margin:0;color:#5C6569;line-height:1.8;font-size:15px}
.tl-m{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13.5px;color:#5C6569}.tl-m span:first-child{color:#0B6A57;font-weight:600}
.tl-go{margin-top:auto;padding-top:8px;display:inline-flex;gap:6px;align-items:center;font-weight:600;color:#0E7C66}
.tl.big{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px;padding:30px;border-color:#1B2226}
.tl-a{display:flex;flex-direction:column;gap:10px;align-items:flex-start}.tl.big h3{font-size:24px}.tl.big p{font-size:16px}
.tl-steps{margin:6px 0 4px;padding:0;list-style:none;counter-reset:st;display:grid;gap:4px;width:100%}
.tl-steps li{counter-increment:st;display:flex;gap:12px;align-items:center;font-size:15px;color:#2C3438;padding:8px 0;border-bottom:1.5px dashed #DADDDE}
.tl-steps li:before{content:counter(st);flex:none;font-weight:700;font-size:18px;line-height:1;color:#0E7C66;width:20px;text-align:center}
.tl-b{background:#FBF6E6;border-radius:4px;padding:24px;position:relative;transform:rotate(1deg);box-shadow:0 8px 18px rgba(0,0,0,.06)}
.tl-b b{display:block;font-family:'Aref Ruqaa',serif;font-weight:400;font-size:22px;margin-bottom:10px;color:#1B2226}
.tl-b ul,.chk{list-style:none;margin:0;padding:0;display:grid;gap:10px}.tl-b li,.chk li{display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:1.7;color:#2C3438}
.ck{flex:none;width:22px;height:22px;margin-top:2px}
.feat{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px 40px}
.f h3{margin:12px 0 6px;font-size:19px;font-weight:700}.f p{margin:0;color:#5C6569;line-height:1.8;font-size:15.5px}
.promo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.pr{border:1.5px solid #1B2226;border-radius:16px;padding:30px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.pr .tag{font-family:'Aref Ruqaa',serif;font-size:22px;color:#0E7C66}.pr h3{margin:0;font-size:22px;font-weight:700}.pr p{margin:0 0 8px;color:#5C6569;line-height:1.8}
.pr a{color:#1B2226;font-weight:600;text-decoration:none;display:inline-flex;gap:6px;align-items:center;border-bottom:1.5px solid #1B2226;padding-bottom:2px}.pr a:hover{color:#0E7C66;border-color:#0E7C66}
.plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;max-width:1020px;margin-top:10px}
.pl{position:relative;border:1.5px solid #1B2226;border-radius:16px;padding:30px 26px 26px;display:flex;flex-direction:column;gap:12px;background:#fff}
.pl .nm{font-size:16px;font-weight:600;color:#5C6569}.pl .pc{font-size:52px;font-weight:700;line-height:1}.pl .pc small{font-size:15px;color:#5C6569;font-weight:400}.pl p{margin:0;color:#5C6569;font-size:14.5px;line-height:1.7}
.pl a{margin-top:auto;text-align:center;padding:13px;border-radius:12px;border:1.5px solid #1B2226;color:#1B2226;text-decoration:none;font-weight:600}.pl a:hover{background:#1B2226;color:#fff}
.pl.best{background:#FBF6E6}.pl.best a{background:#0E7C66;border-color:#0E7C66;color:#fff;box-shadow:0 3px 0 #0A5C4C}.pl.best a:hover{background:#0B6A57}
.pl .bdg{position:absolute;top:-17px;left:18px;font-family:'Aref Ruqaa',serif;font-size:21px;background:#fff;padding:0 8px;color:#0E7C66;line-height:1.5}
.lp-end{padding:84px 0 90px;border-top:1px solid #ECEDEE;text-align:center;display:flex;flex-direction:column;gap:16px;align-items:center}
.lp-end h2{margin:0;font-size:clamp(28px,3.8vw,42px);font-weight:700}.lp-end p{margin:0;color:#5C6569;font-size:17px}
.lp-ft{border-top:1px solid #ECEDEE}.lp-ft .lp-w{padding-top:26px;padding-bottom:30px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;color:#5C6569;font-size:14px}.lp-ft a{color:#5C6569;margin-inline-start:18px;text-decoration:none}.lp-ft a:hover{color:#1B2226}
.lp .note{color:#5C6569;font-size:14px;margin:18px 0 0;line-height:1.8}
@media(max-width:960px){.tools{grid-template-columns:1fr 1fr}.tl.big{grid-template-columns:1fr}.lp-hero{grid-template-columns:1fr;gap:30px;padding:40px 0 28px}.lp-nav{display:none}.promo,.plans{grid-template-columns:1fr}.feat{grid-template-columns:1fr 1fr}.plans{gap:30px}}
@media(max-width:560px){.lp-w{padding:0 18px}.tools,.feat{grid-template-columns:1fr}.feat{gap:30px}.tl,.tl.big,.pr{padding:22px}.lp-out{display:none}.lp-sec{padding:64px 0}.lp-end{padding:64px 0 70px}
.desk{height:440px}.desk .pg{width:70%;left:0}.desk .ph{width:52%;right:0;top:40px}.desk .stk{width:178px;font-size:19px;bottom:0;padding:14px 14px 18px}.lp-cta .lp-b1{flex:none}.tl.big .lp-b1{width:100%;justify-content:center}}
</style>`;
const TEACHER_TOOLS = [
  { ic: 'doc', t: 'ملف الإنجاز الوظيفي', d: 'شواهدك مرتبة على عناصر تقييم وظيفتك وأوزانها، وملف PDF بغلاف وفهرس جاهز للطباعة.', href: '/app#/', go: 'افتح ملفك' },
  { ic: 'sparkle', t: 'صياغة الشاهد بالذكاء الاصطناعي', d: 'اكتب الفكرة بكلمتين، ويطلع لك العنوان والأهداف والوصف وآلية التنفيذ والعنصر المناسب.', href: '/app#/new', go: 'صُغ أول شاهد' },
  { ic: 'target', t: 'التقييم الذاتي للمعلم', d: 'قيّم نفسك بسلّم التقدير الرسمي، واعرف تقديرك المتوقع ووش ينقصك للمستوى الأعلى.', href: '/app#/self', go: 'قيّم نفسك' },
  { ic: 'calendar', t: 'السجلات اليومية', d: 'حصص الانتظار والمناوبة والتعاميم واللجان والتواصل مع أولياء الأمور والمبادرات، وكل سجل يتحول لشاهد.', href: '/app#/logs', go: 'افتح السجلات' },
  { ic: 'book', t: 'مساعد المعلم', d: 'سجل المادة والخطة الأسبوعية وتحليل نتائج الطلاب والخطط العلاجية ورسائل أولياء الأمور.', href: '/app#/rec', go: 'افتح المساعد' },
  { ic: 'edit', t: 'صانع الاختبارات', d: 'جدول المواصفات على المعرفة والتطبيق والاستدلال، ونموذجان ومفتاح وورقة تظليل وتصدير Word.', href: '/app#/exam', go: 'اصنع اختبار' },
];
function schoolTools() {
  const pr = (id) => { const p = SCHOOL_PACKAGES.find((x) => x.id === id); return p ? `${p.price} ريال سنوياً` : ''; };
  return [
    { big: true, ic: 'trend', t: 'تحليل تقرير التقويم الذاتي وخطة التحسين', d: 'ترفع تقرير التقويم المدرسي من منصة تميز، ومعياري يحلله مؤشر مؤشر، ويطلع لك وش تسوي بالضبط عشان ترفع كل مؤشر ضعيف.',
      steps: ['ترفع تقرير التقويم الذاتي (PDF) أو تدخل النسب', 'معياري يقرأ نسبة كل مؤشر من مؤشرات التقويم ومستواه', 'تطلع لك خطة التحسين مرتبة من المؤشر الأضعف'],
      gets: ['تحليل لكل مؤشر: نسبته ومستواه والمستهدف له', 'هدف لكل مؤشر، وتوصية التقرير الرسمية نفسها', '4 إجراءات تنفيذية لكل مؤشر مع توقيتها خلال العام', 'المسؤول عن التنفيذ، ومؤشر قياس، والشواهد المطلوبة', 'متابعة التنفيذ وتوزيع الإجراءات على المعلمين، وتقرير إنجاز', 'الخطة Word قابلة للتعديل وPDF'],
      free: 'مجاناً: تحليل تقريرك وأول مؤشرات خطتك', price: pr('school_improve'), href: '/school#/report', go: 'ارفع تقرير التقويم الذاتي' },
    { big: true, ic: 'target', t: 'تحليل تقرير نافس والخطة العلاجية', d: 'ترفع بطاقة الأداء المدرسي (نتائج نافس) من منصة تميز، ومعياري يحلل كل مادة ومجال، ويعطيك الإجراءات اللي تحسّن نتائج طلابك.',
      steps: ['ترفع بطاقة نافس (PDF أو صورة) لكل صف، أو تدخل الأرقام', 'معياري يقارن إتقان مدرستك بالإدارة والمملكة في كل مجال', 'تطلع لك خطة علاجية لكل مادة ومجال وصف'],
      gets: ['تصنيف كل مجال: أولوية عاجلة، أو يحتاج تحسيناً، أو نقطة قوة', 'الفجوة بين مدرستك ومتوسط المملكة، ومستهدف مرحلي واقعي', 'إجراءات علاجية لكل مجال مع توقيتها', 'المعلم المسؤول عن كل مجال، وطريقة قياس التحسن', 'ملخص تنفيذي للقائد وإجراءات على مستوى المدرسة', 'الخطة Word وPDF، ومتابعة تنفيذها'],
      free: 'مجاناً: التحليل كامل وأول 3 مجالات من الخطة', price: pr('school_nafis'), href: '/school#/nafis', go: 'ارفع بطاقة نافس' },
    { ic: 'folder', t: 'ملف شواهد التقويم المدرسي', d: 'رتّب شواهد مدرستك تحت كل مؤشر، واعرف النواقص قبل الزيارة، وسلّم المقيّم الملف برابط وباركود.', free: 'مجاناً: أول شواهد ومعاينة الفهرس', price: pr('school_evidence'), href: '/school#/evidence', go: 'رتّب شواهدك' },
    { ic: 'screen', t: 'لوحة المدرسة الذكية', d: 'حضور الفصول وغياب المنسوبين وحصص الانتظار، رصد من جوال المعلم وعرض على شاشة المدرسة.', free: 'مجاناً: معاينة اللوحة', price: pr('school_dashboard'), href: '/school#/board', go: 'شوف اللوحة' },
    { ic: 'flag', t: 'الخطة التشغيلية', d: 'التوجهات وتحليل الواقع والأهداف والبرامج والإجراءات، تنبني من تقريرك وخطة التحسين ونافس.', free: 'مجاناً: معاينة', price: 'ضمن الباقة الشاملة', href: '/school#/ops', go: 'افتح الخطة التشغيلية' },
    { ic: 'users', t: 'إسناد المهام للمعلمين', d: 'وزّع إجراءات الخطة على المعلمين، وكل معلم يشوف مهامه ويرفع شاهده، ويطلع في تقرير المتابعة.', free: 'مع خطة التحسين', price: '', href: '/school#/team', go: 'أضف فريقك' },
  ];
}
function landing(storeUrl, trialDays, plans = [], base = '') {
  const SCHOOL_TOOLS = schoolTools();
  const bundle = SCHOOL_PACKAGES.find((x) => x.id === 'school_bundle');
  const minPlan = plans.length ? Math.min(...plans.map((p) => p.price)) : '';
  const meta = (x) => (x.free || x.price ? `<div class="tl-m">${x.free ? `<span>${x.free}</span>` : ''}${x.price ? `<span>${x.price}</span>` : ''}</div>` : '');
  const CK = '<svg class="ck" viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="5" width="30" height="30" rx="5" fill="none" stroke="#1B2226" stroke-width="2.4"/><path d="M10 20l7 8L37 4" fill="none" stroke="#0E7C66" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const blob = (n, i = 0, s = 28) => `<span class="blob${i % 3 ? ` b${(i % 3) + 1}` : ''}">${MI.ico(n, s)}</span>`;
  const tool = (x, i = 0) => (x.big
    ? `<div class="tl big"><div class="tl-a">${blob(x.ic, i, 30)}<h3>${x.t}</h3><p>${x.d}</p>
        <ol class="tl-steps">${x.steps.map((t) => `<li>${t}</li>`).join('')}</ol>${meta(x)}<a class="lp-b1 g" href="${x.href}">${x.go} ${MI.ico('arrow', 16)}</a></div>
        <div class="tl-b"><b>وش يطلع لك؟</b><ul>${x.gets.map((t) => `<li>${CK}<span>${t}</span></li>`).join('')}</ul></div></div>`
    : `<a class="tl" href="${x.href}">${blob(x.ic, i)}<h3>${x.t}</h3><p>${x.d}</p>${meta(x)}<span class="tl-go">${x.go} ${MI.ico('arrow', 16)}</span></a>`);
  const btn = { term: 'اشترك للفصل', year: 'اشترك سنوياً' };
  return shell({
    title: 'معياري | ملف الإنجاز الوظيفي للمعلم والمعلمة',
    bodyClass: 'lp',
    extraHead: shareMeta({ base, url: `${base}/`, title: 'معياري | ملف الإنجاز الوظيفي للمعلم والمعلمة', desc: `وثّق شواهدك على عناصر تقييم الأداء الوظيفي لوظيفتك من جوالك، والمساعد الذكي يصيغها بلغة رسمية، وملفك الكامل يتجهّز تلقائياً. جرّبه ${trialDays} أيام مجاناً.` }) + LANDING_CSS,
    body: `
<div class="lp-top"><div class="lp-w lp-hd"><a class="logo" href="/">${MI.brand(40, true)}</a>
  <nav class="lp-nav" aria-label="القائمة الرئيسية"><a href="#tools">الأدوات</a><a href="#features">المزايا</a><a href="#pricing">الباقات</a><a href="/school">للمدارس</a><a href="/exam-maker">صانع الاختبارات</a></nav>
  <span class="lp-hd-a"><a class="lp-out" href="/app">تسجيل الدخول</a><a class="lp-in" href="/app#/register">ابدأ مجاناً</a></span></div></div>
<main>
<div class="lp-w">
  <section class="lp-hero">
    <div class="lp-txt">
      <div class="hand">رفيقك في رحلتك التعليمية</div>
      <h1>ركّز على طلابك،<br>وملف إنجازك <span class="hl">علينا</span></h1>
      <p>اكتب عن الشاهد كلمتين وأرفق صورته، ومعياري يصيغه بلغة رسمية ويربطه بعنصر التقييم المناسب لوظيفتك. وكل أسبوع يذكّرك بالشاهد اللي حان وقته، لين يكتمل ملفك.</p>
      <div class="lp-cta"><a class="lp-b1 g" href="/app#/register">ابدأ مجاناً</a><span class="free"><svg width="40" height="24" viewBox="0 0 40 24" aria-hidden="true"><path d="M38 4C26 2 12 6 4 18M4 18l2-9M4 18l9-2" fill="none" stroke="#1B2226" stroke-width="2" stroke-linecap="round"/></svg>${trialDays} أيام بدون بطاقة دفع</span></div>
    </div>
    <div class="desk" role="img" aria-label="ملف الإنجاز المطبوع بجانب شاشة معياري على الجوال">
      <div class="pg"><div class="tape"></div><img src="/assets/lp/print.webp" width="820" height="1106" alt="" loading="eager"></div>
      <div class="ph"><img src="/assets/lp/app.webp" width="600" height="1116" alt="" loading="eager"></div>
      <div class="stk"><small>تذكير الأحد · ٧ص</small>حان وقت توثيق «الإدارة الصفية»</div>
    </div>
  </section>
  <section class="lp-roles" aria-label="الوظائف المدعومة"><b>لكل وظيفة تعليمية:</b> ${Object.values(ROLES).map((r) => esc(r.name)).join('، ')}.</section>

  <section class="lp-sec" id="tools">
    <div class="lp-eb">الأدوات</div>
    <h2>اختر الأداة اللي تحتاجها، <b>وابدأ فيها مباشرة</b></h2>
    <p class="lp-lead">كل أداة باسمها ووش تسوي لك. اضغط عليها، وتدخل عليها على طول بعد إنشاء حسابك.</p>
    <div class="tg-h">${blob('user', 1, 26)}<div><b>أدوات المعلم والمعلمة</b><small>وكل الوظائف التعليمية · كل الأدوات مجاناً ${trialDays} أيام، وبعدها اشتراك واحد من ${minPlan} ريال</small></div></div>
    <div class="tools">${TEACHER_TOOLS.map(tool).join('')}</div>
    <div class="tg-h" style="margin-top:48px">${blob('school', 0, 26)}<div><b>أدوات قائد المدرسة</b><small>تحليل تقرير التقويم الذاتي وتقرير نافس، وخطط التحسين والعلاج الجاهزة · كل أداة لها باقة سنوية، أو الباقة الشاملة ${bundle ? `${bundle.price} ريال` : ''}</small></div></div>
    <div class="tools-big">${SCHOOL_TOOLS.filter((x) => x.big).map(tool).join('')}</div>
    <div class="tools">${SCHOOL_TOOLS.filter((x) => !x.big).map(tool).join('')}</div>
    <p class="note">تقدر تجرّب أي أداة قبل ما تشترك. الاشتراك بكود تفعيل من <a href="${esc(storeUrl)}" style="color:inherit">متجر معيار</a> يوصلك فوراً.</p>
  </section>

  <section class="lp-sec" id="features">
    <div class="lp-eb">المزايا</div>
    <h2>كل شي يطلبه منك التقييم، <b>جاهز قبل ما يُطلب</b></h2>
    <p class="lp-lead">عناصر التقييم وأوزانها لكل وظيفة من نماذج الدليل الإرشادي لإدارة الأداء الوظيفي لشاغلي الوظائف التعليمية (الإصدار الثاني).</p>
    <div class="feat">
      <div class="f">${blob('doc', 0)}<h3>ملف PDF بترويسة الوزارة</h3><p>غلاف وفهرس وكل عنصر بشواهده، أو تقرير لعنصر واحد أو لشاهد واحد إذا طلبه المدير.</p></div>
      <div class="f">${blob('sparkle', 1)}<h3>مساعد يصيغ الشاهد</h3><p>اكتب الفكرة بكلمتين، ويجهّز العنوان والأهداف والوصف ويقترح العنصر المناسب.</p></div>
      <div class="f">${blob('calendar', 2)}<h3>سجلاتك اليومية</h3><p>الانتظار والمناوبة والتعاميم واللجان والتواصل مع الأسر، وكل سجل يتحول لشاهد بضغطة.</p></div>
      <div class="f">${blob('target', 3)}<h3>تقييم ذاتي بسلّم التقدير</h3><p>قيّم نفسك بأوصاف المستويات الرسمية، واعرف وش ينقصك للمستوى الأعلى.</p></div>
      <div class="f">${blob('compass', 4)}<h3>رفيق رحلتك طول السنة</h3><p>خطة توثيق تمشي مع التقويم الدراسي، وتذكير كل أسبوع على جوالك بالشاهد اللي حان وقته، وتهنئة لما يكتمل ملفك.</p></div>
      <div class="f">${blob('qr', 5)}<h3>رمز تحقق QR</h3><p>على كل تقرير وكل شاهد، يثبت إنه موثّق في معياري.</p></div>
      <div class="f">${blob('link', 6)}<h3>صفحة باسمك</h3><p>رابط واحد ترسله لفريق التقويم بدل الملفات والمجلدات، أو تحطه QR على باب الفصل.</p></div>
    </div>
  </section>

  <section class="lp-sec">
    <div class="promo">
      <div class="pr"><span class="tag">للمدارس</span><h3>معياري للمدرسة</h3><p>ارفع تقرير التقويم الذاتي من منصة تميز، وتطلع لك خطة التحسين مرتبة من المؤشر الأضعف، جاهزة Word وPDF.</p><a href="/school">جرّبها لمدرستك ${MI.ico('arrow', 16)}</a></div>
      <div class="pr"><span class="tag">للمعلم</span><h3>صانع الاختبارات بجدول المواصفات</h3><p>الجدول على المعرفة والتطبيق والاستدلال، والأسئلة تُكتب حسبه، ونموذجان ومفتاح وورقة تظليل.</p><a href="/exam-maker">اعرف أكثر ${MI.ico('arrow', 16)}</a></div>
    </div>
  </section>

  <section class="lp-sec" id="pricing">
    <div class="lp-eb">الباقات</div>
    <h2>سنة كاملة بـ<b>${(plans.find((p) => p.id === 'year') || {}).price || ''} ريال</b></h2>
    <p class="lp-lead">جرّب ${trialDays} أيام مجاناً، وبعدها اختر الباقة اللي تناسبك.</p>
    <div class="plans">${plans.map((p) => `<div class="pl${p.best ? ' best' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="nm">${esc(p.name)}</span>${p.best ? `<span class="bdg">الأوفر${p.saving ? `، وفّر ${p.saving}%` : ''}</span>` : ''}</div>
      <div class="pc">${p.price} <small>ريال / ${esc(p.per)}</small></div><p>${esc(p.note)}</p>
      <a href="${esc(p.url || storeUrl)}" target="_blank" rel="noopener">${btn[p.id] || 'اشترك'}</a></div>`).join('')}</div>
    <p class="note">إذا انتهى اشتراكك، تبقى شواهدك محفوظة وصفحتك ظاهرة، وتتوقف الإضافة والطباعة فقط إلى أن تجدد.</p>
  </section>

  <section class="lp-end"><h2>ابدأ ملف إنجازك اليوم</h2><p>${trialDays} أيام مجاناً، بدون بطاقة دفع.</p><a class="lp-b1 g" href="/app#/register">أنشئ حسابك</a></section>
</div>
</main>
<footer class="lp-ft"><div class="lp-w"><span>معياري · من متجر معيار للمنتجات التعليمية الرقمية</span><span><a href="/privacy">الخصوصية والشروط</a><a href="${esc(storeUrl)}">المتجر</a></span></div></footer>`,
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
      .hero{background:#17232E;color:#fff;padding:36px 0 70px;border-radius:0 0 32px 32px}.hero .btn{background:rgba(255,255,255,.16);color:#fff}
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
    body: `<header class="wrap" style="display:flex;justify-content:space-between;align-items:center;padding-top:18px;padding-bottom:18px"><a class="logo" href="/">${MI.brand(38, true)}</a><a class="btn ghost" href="/app">التطبيق</a></header>
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
  <a class="logo" href="/">${MI.brand(38, true)}</a>
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
