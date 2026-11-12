const QRCode = require('qrcode');
const { STANDARDS, byId } = require('./standards');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = (s) => esc(s).replace(/\n/g, '<br>');
const qr = (text, size = 180) => QRCode.toDataURL(text, { margin: 1, width: size, color: { dark: '#10201e', light: '#ffffff' } });
function hijri(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  if (isNaN(dt)) return esc(d);
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt); } catch { return esc(d); }
}
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@700&display=swap" rel="stylesheet">';

function shell({ title, body, color = 'miyar', extraHead = '', bodyClass = '' }) {
  return `<!doctype html><html lang="ar" dir="rtl" data-color="${esc(color)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${FONTS}<link rel="stylesheet" href="/assets/theme.css">${extraHead}
<script>try{var t=localStorage.getItem('miyar-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script></head>
<body class="${bodyClass}">${body}</body></html>`;
}

const notFound = () => shell({ title: 'غير موجود', body: `<div class="wrap" style="padding:80px 16px;text-align:center"><h1>الصفحة غير موجودة</h1><p class="muted">تأكد من الرابط.</p><a class="btn" href="/">الرئيسية</a></div>` });
const message = (t, m, href) => shell({ title: t, body: `<div class="wrap" style="padding:80px 16px;text-align:center"><h1>${esc(t)}</h1><p class="muted">${esc(m)}</p><a class="btn" href="${esc(href)}">متابعة</a></div>` });

// ---------- الصفحة التعريفية ----------
function landing(storeUrl, trialDays, plans = []) {
  const feats = [
    ['🤖', 'مساعد ذكي يصيغ الشاهد', 'اكتب فكرة الشاهد بكلمتين، ويجهّز لك العنوان الرسمي والأهداف والوصف وآلية التنفيذ ويربطه بالعنصر المناسب.'],
    ['🗂️', 'مرتّب على العناصر الـ11', 'كل شاهد في مكانه الصحيح حسب عناصر تقييم الأداء الوظيفي، مع نسبة إنجاز لكل عنصر.'],
    ['🔗', 'صفحة باسمك ورابط مشاركة', 'صفحة أنيقة فيها كل شواهدك، ترسل رابطها للمدير أو المشرف أو تحطها QR على باب الفصل.'],
    ['🖨️', 'تقرير PDF بقالبين', 'ملف إنجاز كامل بغلاف وفهرس، أو تقرير لعنصر واحد، أو لشاهد واحد، جاهز للطباعة.'],
    ['✅', 'رمز تحقق على كل تقرير', 'كل تقرير وكل عنصر وكل شاهد عليه رمز QR يثبت أنه موثّق في ملف معيار.'],
    ['🌙', 'ثيمات ووضع ليلي', 'ست ألوان تختار منها، ووضع ليلي مريح، ويشتغل من الجوال بدون تحميل.'],
  ];
  return shell({
    title: 'ملف معيار | ملف الإنجاز والشواهد الإلكتروني',
    body: `
<header class="wrap" style="display:flex;justify-content:space-between;align-items:center;padding-top:18px;padding-bottom:18px">
  <a class="logo" href="/"><b>م</b>ملف معيار</a>
  <a class="btn ghost" href="/app">تسجيل الدخول</a>
</header>
<section class="wrap" style="padding:40px 16px 30px;text-align:center">
  <span class="pill">ملف الإنجاز الوظيفي للمعلم والمعلمة</span>
  <h1 style="font-size:clamp(28px,6vw,46px);margin:16px 0 10px">المدير يسألك: وين ملف إنجازك؟<br><span style="color:var(--brand)">خلّه جاهز من جوالك.</span></h1>
  <p class="muted" style="max-width:640px;margin:0 auto 22px;font-size:17px">وثّق شواهدك على عناصر تقييم الأداء الوظيفي الـ11 في دقيقة، والمساعد الذكي يصيغها لك بلغة رسمية، وملفك الكامل يتجهّز تلقائياً.</p>
  <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <a class="btn" href="/app#/register" style="font-size:17px;padding:12px 22px">جرّبه ${trialDays} أيام مجاناً</a>
    <a class="btn ghost" href="${esc(storeUrl)}" style="font-size:17px;padding:12px 22px">اشترِ كود التفعيل</a>
  </div>
</section>
<section class="wrap grid g3" style="padding-bottom:40px">
  ${feats.map(([i, t, d]) => `<div class="card"><div style="font-size:28px">${i}</div><h3>${t}</h3><p class="muted" style="margin:0">${d}</p></div>`).join('')}
</section>
<section class="wrap" style="padding-bottom:50px">
  <div class="card" style="text-align:center">
    <h2>عناصر التقييم الـ11 كلها في مكان واحد</h2>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px">${STANDARDS.map((s) => `<span class="pill">${s.icon} ${s.name}</span>`).join('')}</div>
  </div>
</section>
<section class="wrap" style="padding-bottom:40px">
  <div class="card" style="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-color:var(--brand-2)">
    <div><span class="pill">جديد للمدارس</span><h2 style="margin:8px 0 4px">خطط معيار: خطة التحسين من تقرير التقويم المدرسي</h2><p class="muted" style="margin:0">ارفع تقرير التقويم الذاتي من منصة تميز، وتطلع لك خطة التحسين مرتبة من المؤشر الأضعف، جاهزة بصيغة Word وPDF.</p></div>
    <a class="btn" href="/school">جرّبها لمدرستك</a>
  </div>
</section>
<section class="wrap" style="padding-bottom:50px" id="pricing">
  <h2 style="text-align:center">الباقات</h2>
  <p class="muted" style="text-align:center;margin-top:0">ابدأ بتجربة مجانية ${trialDays} أيام، وبعدها اختر الباقة اللي تناسبك.</p>
  <div class="grid g3">${plans.map((p) => `<div class="card" style="text-align:center;${p.best ? 'border:2px solid var(--brand-2)' : ''}">
    ${p.best ? `<span class="pill">⭐ الأوفر${p.saving ? `، توفّر ${p.saving}%` : ''}</span>` : '<span class="pill" style="visibility:hidden">.</span>'}
    <h3 style="margin-top:10px">${p.name}</h3>
    <div style="font-size:34px;font-weight:800;color:var(--brand-text)">${p.price} <small style="font-size:15px">ريال / ${p.per}</small></div>
    <p class="muted" style="margin:6px 0 14px">${p.note}</p>
    <a class="btn ${p.best ? '' : 'ghost'}" href="${esc(storeUrl)}">اشترِ الكود</a></div>`).join('')}</div>
  <p class="muted" style="text-align:center;font-size:13px;margin-top:12px">إذا انتهى اشتراكك، تبقى شواهدك محفوظة وصفحتك ظاهرة، وتتوقف الإضافة والطباعة فقط إلى أن تجدد.</p>
</section>
<footer class="wrap muted" style="padding:20px 16px 40px;text-align:center;font-size:13px">ملف معيار من متجر معيار للمنتجات التعليمية الرقمية</footer>`,
  });
}

// ---------- صفحة المعلم العامة ----------
async function publicPage(u, evs, base, isOwner) {
  const url = `${base}/p/${u.slug}`;
  const code = await qr(url, 220);
  const byStd = STANDARDS.map((s) => ({ s, items: evs.filter((e) => e.standard_id === s.id) }));
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
      ${pdfs.length || e.links.length ? `<div class="ev-links">${pdfs.map((f) => `<a class="btn soft sm" href="/files/${f.id}" target="_blank">📄 ${esc(f.original)}</a>`).join('')}${e.links.map((l) => `<a class="btn soft sm" href="${esc(l)}" target="_blank" rel="noopener">🔗 رابط</a>`).join('')}</div>` : ''}
    </article>`;
  };
  return shell({
    title: `ملف إنجاز ${u.full_name}`,
    color: u.theme,
    extraHead: `<meta property="og:title" content="ملف إنجاز ${esc(u.full_name)}"><style>
      .hero{background:linear-gradient(135deg,var(--brand),var(--brand-2));color:#fff;padding:36px 0 70px}
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
    <div style="display:flex;gap:6px">${isOwner ? '<a class="btn sm" style="background:rgba(255,255,255,.18)" href="/app">✏️ تعديل</a>' : ''}<button class="btn sm" style="background:rgba(255,255,255,.18)" onclick="var r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('miyar-theme',r.dataset.theme)}catch(e){}">🌙</button></div>
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
        <div><b style="font-size:24px;color:var(--brand)">${covered}/11</b> <span class="muted">عنصر مغطّى</span></div>
      </div>
      <div class="bar" style="margin-top:8px"><i style="width:${Math.round((covered / 11) * 100)}%"></i></div>
    </div>
    <div class="card" style="text-align:center"><img src="${code}" alt="QR" style="width:150px;height:150px"><div class="muted" style="font-size:12px">امسح الرمز لفتح الملف</div></div>
  </div>
  ${byStd.filter((x) => x.items.length).map(({ s, items }) => `
    <div class="std"><span style="font-size:24px">${s.icon}</span><h2>${s.id}. ${s.name}</h2><span class="pill">${items.length} شاهد</span></div>
    <div class="evs">${items.map(card).join('')}</div>`).join('') || '<div class="card" style="margin-top:20px;text-align:center" class="muted">لا توجد شواهد منشورة بعد.</div>'}
  <p class="muted" style="text-align:center;margin-top:40px;font-size:13px">موثّق عبر <a href="/">ملف معيار</a></p>
</main>`,
  });
}

// ---------- صفحة التحقق ----------
function verifyPage({ kind, ev, std, u, count, stdCount, base }) {
  if (kind === 'invalid') {
    return shell({ title: 'رمز غير صحيح', body: `<div class="wrap" style="padding:70px 16px;max-width:520px"><div class="card" style="text-align:center"><div style="font-size:50px">⚠️</div><h1>رمز التحقق غير صحيح</h1><p class="muted">هذا الرمز غير مسجّل في ملف معيار.</p></div></div>` });
  }
  const owner = kind === 'evidence' ? ev : u;
  const rows = kind === 'evidence'
    ? [['الشاهد', ev.title], ['العنصر', `${std.id}. ${std.name}`], ['التاريخ', hijri(ev.ev_date) || '—'], ['صاحب الملف', ev.full_name], ['المدرسة', ev.school || '—'], ['رمز التحقق', ev.verify_code]]
    : [['صاحب الملف', u.full_name], ['الوظيفة', u.job_title], ['المدرسة', u.school || '—'], kind === 'standard' ? ['العنصر', `${std.id}. ${std.name}`] : ['العناصر المغطّاة', `${stdCount} من 11`], ['عدد الشواهد', String(count)], ['رمز التحقق', u.verify_code]];
  const link = owner.is_public ? `<a class="btn" href="${base}/p/${owner.slug}">عرض الملف كاملاً</a>` : '';
  return shell({
    title: 'تحقق من التقرير',
    body: `<div class="wrap" style="padding:50px 16px;max-width:560px"><div class="card">
      <div style="text-align:center"><div style="width:64px;height:64px;margin:0 auto 8px;border-radius:50%;background:#e7f6ee;color:var(--ok);display:grid;place-items:center;font-size:32px">✓</div>
      <h1 style="font-size:22px">${kind === 'evidence' ? 'شاهد موثّق' : kind === 'standard' ? 'تقرير عنصر موثّق' : 'ملف إنجاز موثّق'}</h1>
      <p class="muted" style="margin-top:0">هذا التقرير صادر من منصة ملف معيار وبياناته مطابقة لما هو مسجّل.</p></div>
      <table style="width:100%;border-collapse:collapse;margin:10px 0 16px">${rows.map(([k, v]) => `<tr><td class="muted" style="padding:8px 0;border-bottom:1px solid var(--line);width:120px">${k}</td><td style="padding:8px 0;border-bottom:1px solid var(--line);font-weight:600">${esc(v)}</td></tr>`).join('')}</table>
      <div style="text-align:center">${link}</div>
    </div></div>`,
  });
}

// ---------- التقارير القابلة للطباعة ----------
async function printReport({ u, evs, template, base, scope, std }) {
  const modern = template === 'modern';
  const vUrl = (code, s) => `${base}/v/${code}${s ? '/' + s : ''}`;
  const groups = STANDARDS.map((s) => ({ s, items: evs.filter((e) => e.standard_id === s.id) })).filter((g) => g.items.length);
  const qrMain = await qr(scope === 'standard' ? vUrl(u.verify_code, std.id) : vUrl(u.verify_code), 240);
  const stdQr = {};
  for (const g of groups) stdQr[g.s.id] = await qr(vUrl(u.verify_code, g.s.id), 160);
  const evQr = {};
  for (const e of evs) evQr[e.id] = await qr(vUrl(e.verify_code), 140);

  const info = [['الاسم', u.full_name], ['الوظيفة', u.job_title], ['المادة', u.subject], ['المرحلة', u.stage], ['المدرسة', u.school], ['إدارة التعليم', u.office], ['مدير المدرسة', u.principal], ['العام الدراسي', u.year]].filter(([, v]) => v);

  const evidenceBlock = (e) => {
    const imgs = e.files.filter((f) => f.mime.startsWith('image/')).slice(0, 4);
    return `<section class="ev">
      <div class="ev-head"><div><div class="ev-std">${byId(e.standard_id).name}</div><h3>${esc(e.title)}</h3>${e.ev_date ? `<div class="ev-date">${hijri(e.ev_date)}</div>` : ''}</div>
      <div class="qr-sm"><img src="${evQr[e.id]}"><span>${e.verify_code}</span></div></div>
      ${e.goals.length ? `<h4>الأهداف</h4><ul>${e.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
      ${e.description ? `<h4>الوصف</h4><p>${nl(e.description)}</p>` : ''}
      ${e.steps ? `<h4>آلية التنفيذ</h4><p>${nl(e.steps)}</p>` : ''}
      ${e.impact ? `<h4>الأثر</h4><p>${nl(e.impact)}</p>` : ''}
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

  const index = scope !== 'portfolio' ? '' : `<div class="page"><h2 class="sec">فهرس عناصر التقييم</h2>
    <table class="idx"><thead><tr><th>م</th><th>العنصر</th><th>الوزن</th><th>عدد الشواهد</th></tr></thead><tbody>
    ${STANDARDS.map((s) => { const n = evs.filter((e) => e.standard_id === s.id).length; return `<tr class="${n ? '' : 'empty'}"><td>${s.id}</td><td>${s.name}</td><td>${s.weight}%</td><td>${n || '—'}</td></tr>`; }).join('')}
    </tbody></table>
    ${u.bio ? `<h2 class="sec" style="margin-top:28px">نبذة</h2><p>${nl(u.bio)}</p>` : ''}
  </div>`;

  const body = groups.map((g) => `<div class="page">
    ${scope !== 'evidence' ? `<div class="std-head"><div><span class="std-no">${g.s.id}</span><h2>${g.s.name}</h2><div class="muted">الوزن ${g.s.weight}% · ${g.items.length} شاهد</div></div><div class="qr-sm"><img src="${stdQr[g.s.id]}"><span>تحقق العنصر</span></div></div>` : ''}
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
    extraHead: `<style>${css}</style>`,
    body: `<div class="toolbar"><a class="btn ghost sm" href="/app">→ رجوع</a>
      <a class="btn sm ${modern ? 'ghost' : ''}" href="${q('classic')}">القالب الرسمي</a><a class="btn sm ${modern ? '' : 'ghost'}" href="${q('modern')}">القالب العصري</a>
      <button class="btn sm" onclick="window.print()">🖨️ طباعة / حفظ PDF</button><span class="muted" style="font-size:12px">اختر "حفظ كـ PDF" من نافذة الطباعة</span></div>
      ${cover}${index}${body}${empty}`,
  });
}

module.exports = { landing, publicPage, verifyPage, printReport, notFound, message, esc };
