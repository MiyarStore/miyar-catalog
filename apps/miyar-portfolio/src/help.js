// «اسأل معياري»: مساعد يجاوب أسئلة الزوار والعملاء عن التطبيق من معلومات ثابتة وموثقة فقط.
const Anthropic = require('@anthropic-ai/sdk');
const { PLANS, SCHOOL_PACKAGES } = require('./plans');
const { ROLES } = require('./standards');

const MODEL = process.env.HELP_MODEL || 'claude-haiku-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const WHATSAPP = String(process.env.WHATSAPP_NUMBER || '966509896261').replace(/\D/g, '');
const waLink = (text = 'السلام عليكم، عندي سؤال عن تطبيق معياري') => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

function facts({ trialDays, storeUrl, base }) {
  return `معلومات تطبيق «معياري» (هذه المعلومات وحدها مصدر إجاباتك):
- معياري تطبيق ويب لملف الإنجاز الوظيفي للمعلم والمعلمة، من متجر معيار للمنتجات التعليمية الرقمية. الرابط: ${base}. يشتغل من الجوال والكمبيوتر بدون تحميل.
- الوظائف المدعومة، كل وظيفة بعناصر تقييمها وأوزانها من نماذج الدليل الإرشادي لإدارة الأداء الوظيفي لشاغلي الوظائف التعليمية (الإصدار الثاني): ${Object.values(ROLES).map((r) => `${r.name} (${r.items.length} عنصر)`).join('، ')}.
- المزايا: توثيق الشواهد على عناصر التقييم؛ مساعد ذكي يصيغ الشاهد (عنوان وأهداف ووصف وآلية تنفيذ وأثر) من فكرة مختصرة ويقترح العنصر؛ رفع صور وملفات PDF؛ ملف إنجاز PDF بغلاف وفهرس بقالبين، وتقرير لعنصر أو لشاهد واحد؛ رمز QR للتحقق على التقارير؛ صفحة عامة باسم المعلم ورابط مشاركة؛ السجلات اليومية (حصص الانتظار، المناوبة والإشراف، التعاميم، اللجان والاجتماعات، التواصل مع أولياء الأمور، المبادرات بقياس قبلي وبعدي) وكل سجل يتحول لشاهد؛ التقييم الذاتي بسلّم التقدير الخماسي الرسمي ومعرفة التقدير المتوقع؛ مساعد المعلم (سجل المادة والخطة الأسبوعية والتحليل والخطط العلاجية ورسائل أولياء الأمور)؛ صانع الاختبارات بجدول المواصفات (نموذجان ومفتاح وورقة تظليل وتصدير Word).
- التجربة: ${trialDays} أيام مجاناً عند التسجيل بدون بطاقة دفع، من ${base}/app#/register.
- باقات المعلم: ${PLANS.map((p) => `${p.name} ${p.price} ريال (${p.days} يوم)`).join('، ')}. السنوي هو الأوفر.
- طريقة الاشتراك: يشتري كود التفعيل من متجر معيار (${storeUrl}) ويوصله الكود فوراً، ثم يدخله في التطبيق من صفحة «الاشتراك». لو عنده اشتراك، المدة الجديدة تنضاف على الباقي.
- إذا انتهى الاشتراك: الشواهد تبقى محفوظة والصفحة ظاهرة، وتتوقف الإضافة والطباعة فقط إلى أن يجدد.
- معياري للمدرسة (${base}/school): خطة التحسين من تقرير التقويم الذاتي في منصة تميز، وخطة نافس العلاجية، وملف شواهد التقويم، ولوحة المدرسة، وإسناد مهام الخطة للمعلمين. الباقات سنوية: ${SCHOOL_PACKAGES.map((p) => `${p.name} ${p.price} ريال`).join('، ')}.
- الخصوصية: البيانات تُستخدم لتقديم الخدمة فقط ولا تُباع. محفوظة حالياً على خوادم خارج المملكة. المستخدم يقدر يحذف حسابه وبياناته بنفسه. لا تُرفع أسماء الطلاب الكاملة أو صور وجوههم أو درجاتهم بأسمائهم. التفاصيل: ${base}/privacy.
- الدعم البشري: واتساب ${waLink()}.`;
}

const SYSTEM = (ctx) => `أنت «اسأل معياري»، مساعد خدمة العملاء في تطبيق معياري. تجاوب المعلمين والمعلمات وقادة المدارس بلهجة سعودية بسيطة ومهذبة.
القواعد:
- جاوب فقط من المعلومات تحت. إذا السؤال عن شي غير موجود فيها (مثل خصم، أو ميزة غير مذكورة، أو مشكلة في حساب أو دفع) قل إنك ما عندك المعلومة ووجّهه لواتساب الدعم.
- لا تخترع أرقام ولا أسعار ولا مواعيد ولا مزايا، ولا تعد بشي.
- لا تطلب كلمة مرور ولا بيانات دفع ولا بيانات طلاب.
- إجابات قصيرة: جملتين إلى أربع، وبدون عناوين أو جداول. تقدر تحط رابط واحد إذا يفيد.
- إذا السؤال عن تقييم الأداء الوظيفي نفسه (العناصر والأوزان)، اذكر أن التطبيق مبني على الدليل الإرشادي، وأن اعتماد التقييم يكون من المدير المباشر.
- إذا السؤال خارج موضوع التطبيق والتعليم، اعتذر بلطف.

${facts(ctx)}`;

// إجابات جاهزة إذا ما فيه مفتاح ذكاء اصطناعي أو تعطلت الخدمة
function fallback(q, ctx) {
  const t = String(q);
  const has = (...ws) => ws.some((w) => t.includes(w));
  if (has('سعر', 'أسعار', 'كم', 'باقة', 'باقات', 'اشتراك')) return `الباقات: ${PLANS.map((p) => `${p.name} ${p.price} ريال`).join('، ')}. وتقدر تجرّب ${ctx.trialDays} أيام مجاناً قبل ما تشترك.`;
  if (has('تجرب', 'تجربة', 'مجان')) return `التجربة ${ctx.trialDays} أيام مجاناً بدون بطاقة دفع. سجّل من ${ctx.base}/app#/register`;
  if (has('كود', 'تفعيل', 'أشتري', 'شراء')) return `تشتري كود التفعيل من متجر معيار (${ctx.storeUrl}) ويوصلك فوراً، وتدخله في التطبيق من صفحة «الاشتراك».`;
  if (has('مدرسة', 'مدير', 'قائد')) return `لقادة المدارس فيه «معياري للمدرسة»: خطة التحسين وخطة نافس وملف شواهد التقويم. تفاصيله في ${ctx.base}/school`;
  return `أقدر أساعدك في أسئلة التطبيق والأسعار والاشتراك. ولو سؤالك يحتاج شخص من الفريق، كلمنا واتساب: ${waLink()}`;
}

async function answer(messages, ctx) {
  const last = messages[messages.length - 1].content;
  if (!client) return { text: fallback(last, ctx), source: 'faq' };
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 700,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM(ctx),
      messages,
    });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (res.stop_reason === 'refusal' || !text) return { text: fallback(last, ctx), source: 'faq' };
    return { text, source: 'ai' };
  } catch (err) {
    console.error('Help AI error:', err.status || '', err.message);
    return { text: fallback(last, ctx), source: 'faq' };
  }
}

// تنظيف المحادثة الواردة من المتصفح: آخر 8 رسائل، بالتناوب، وتبدأ وتنتهي بسؤال المستخدم
function clean(raw) {
  const list = (Array.isArray(raw) ? raw : []).slice(-8)
    .map((m) => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').trim().slice(0, 600) }))
    .filter((m) => m.content);
  const out = [];
  for (const m of list) { if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = m; else out.push(m); }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

// حد بسيط لكل عنوان IP: 20 سؤال كل 10 دقائق
const hits = new Map();
function allowed(ip) {
  const now = Date.now(); const win = 10 * 60 * 1000;
  const h = (hits.get(ip) || []).filter((t) => now - t < win);
  if (h.length >= 20) { hits.set(ip, h); return false; }
  h.push(now); hits.set(ip, h);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < win)) hits.delete(k);
  return true;
}

module.exports = { answer, clean, allowed, waLink, WHATSAPP };
