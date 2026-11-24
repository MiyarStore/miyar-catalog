// «تحضير الدروس»: تحضير كل درس مربوط بالخطة الأسبوعية (التاريخ والحصة والشعبة من الخطة)،
// بالعناصر المعتادة في دفتر التحضير: الأهداف، المفردات، مصادر التعلم، الاستراتيجيات، سير الدرس
// (التهيئة، العرض، التقويم البنائي، الغلق)، التقويم الختامي، الواجب، والتمايز (علاجي وإثرائي).
// يكتبه Claude إذا توفر المفتاح، وإلا قالب تربوي جاهز يعدله المعلم.
const Anthropic = require('@anthropic-ai/sdk');
const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const clip = (v, n) => String(v ?? '').slice(0, n).trim();
const arr = (v, n, len) => (Array.isArray(v) ? v : String(v || '').split(/\r?\n/)).map((x) => clip(x, len)).filter(Boolean).slice(0, n);

// تنظيف تحضير واحد (كل الحفظ يمر من هنا)
function cleanPrep(p = {}) {
  const s = p.steps || {};
  return {
    objectives: arr(p.objectives, 8, 240), vocab: arr(p.vocab, 12, 80), resources: arr(p.resources, 8, 160), strategies: arr(p.strategies, 6, 120),
    steps: { intro: clip(s.intro, 700), present: arr(s.present, 8, 600), formative: arr(s.formative, 6, 300), close: clip(s.close, 500) },
    assessment: arr(p.assessment, 6, 300), homework: clip(p.homework, 400),
    support: clip(p.support, 500), enrich: clip(p.enrich, 500), values: clip(p.values, 300), notes: clip(p.notes, 600),
    source: ['ai', 'template', 'manual'].includes(p.source) ? p.source : 'manual', updated_at: Number(p.updated_at) || Date.now(),
  };
}
function cleanPreps(preps, lessonIds) {
  const out = {};
  for (const [id, p] of Object.entries(preps || {})) if (lessonIds.has(id) && p && typeof p === 'object') out[id] = cleanPrep(p);
  return out;
}

// ---------- القالب الجاهز (بدون ذكاء اصطناعي) ----------
const STRATS = ['التعلم التعاوني (مجموعات صغيرة)', 'فكّر، زاوج، شارك', 'العصف الذهني', 'التعلم بالاستقصاء', 'الخرائط الذهنية', 'التعلم باللعب والتحدي', 'المناقشة والحوار'];
function template(ctx) {
  const t = ctx.title;
  // المهارة غالباً مصدر («شرح...»، «توضيح...»)، فنصيغها: أن يتقن الطالب + المهارة
  const sk = String(ctx.skill || '').replace(/^أن\s+/, '').replace(/[.。]$/, '');
  const objs = sk ? [/^(ي|ت)\S+/.test(sk) && !/^(توضيح|تفعيل|تحديد|تطبيق|تمييز|تصميم|تقديم|تنفيذ|التمييز|التعبير)/.test(sk) ? `أن ${sk}.` : `أن يُتقن الطالب ${sk}.`] : [];
  objs.push(`أن يوضّح الطالب المفاهيم الأساسية في درس «${t}».`, `أن يطبّق الطالب ما تعلمه في «${t}» على مثال من واقع حياته.`);
  const k = (ctx.no || 0) % STRATS.length;
  return cleanPrep({
    objectives: objs.slice(0, 5), vocab: [],
    resources: ['الكتاب المدرسي' + (ctx.page ? ` (ص ${ctx.page})` : ''), 'السبورة الذكية / جهاز العرض', 'منصة مدرستي', 'أوراق عمل'],
    strategies: [STRATS[k], STRATS[(k + 2) % STRATS.length], 'التقويم البنائي بالأسئلة الشفهية'],
    steps: {
      intro: `أبدأ بسؤال مثير للتفكير يربط «${t}» بحياة الطالب، وأراجع الخبرات السابقة في دقيقتين.`,
      present: [`عرض المفهوم الرئيس في «${t}» بمثال محسوس.`, 'نشاط في مجموعات: يطبّق الطلاب الفكرة على مثال جديد، مع تجوّل المعلم وتقديم التغذية الراجعة.', 'مناقشة إجابات المجموعات وتصحيح الأخطاء الشائعة.'],
      formative: ['أسئلة شفهية سريعة بعد كل جزء من العرض.', 'بطاقة خروج: سؤال واحد يقيس الهدف الرئيس.'],
      close: 'يلخّص الطلاب أهم ما تعلموه في جملة واحدة، وأربط الدرس بالدرس القادم.',
    },
    assessment: ['ورقة عمل قصيرة أو سؤال تطبيقي يقيس الأهداف.'], homework: ctx.page ? `حل تمرينات الكتاب المرتبطة بالدرس (ص ${ctx.page}).` : 'حل تمرينات الكتاب المرتبطة بالدرس.',
    support: 'إعادة الشرح بمثال أبسط للطلاب المتعثرين، وورقة عمل متدرجة، والتعلم بالأقران.',
    enrich: 'مهمة إثرائية أو سؤال تفكير عليا للطلاب المتقنين.', values: '', source: 'template',
  });
}

// ---------- الذكاء الاصطناعي ----------
const S = { type: 'string' };
const LIST = { type: 'array', items: S };
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['objectives', 'vocab', 'resources', 'strategies', 'steps', 'assessment', 'homework', 'support', 'enrich', 'values'],
  properties: {
    objectives: { ...LIST, description: 'أهداف سلوكية قابلة للقياس تبدأ بـ«أن + فعل + الطالب»' },
    vocab: { ...LIST, description: 'المفردات والمصطلحات الجديدة في الدرس' }, resources: LIST,
    strategies: { ...LIST, description: 'استراتيجيات تعلم نشط مناسبة للدرس' },
    steps: { type: 'object', additionalProperties: false, required: ['intro', 'present', 'formative', 'close'], properties: { intro: S, present: LIST, formative: LIST, close: S } },
    assessment: LIST, homework: S, support: S, enrich: S, values: { ...S, description: 'قيمة أو ربط بالحياة وبرؤية المملكة 2030 إن ناسب، باختصار' },
  },
};
const SYSTEM = `أنت مشرف تربوي ومعلم سعودي خبير في تحضير الدروس وفق مناهج وزارة التعليم في المملكة العربية السعودية.
اكتب تحضير درس واحد عملي وواقعي يناسب حصة مدتها 45 دقيقة، بلغة عربية سليمة ومختصرة.
- الأهداف: من 3 إلى 5، سلوكية وقابلة للقياس، تبدأ بـ«أن» وتغطي مستويات معرفية متدرجة.
- المفردات: المصطلحات الجديدة فقط، ولا تخترع مصطلحات غير موجودة في الدرس.
- مصادر التعلم: واقعية ومتاحة في المدرسة (الكتاب المدرسي بصفحته، منصة مدرستي، عين...).
- الاستراتيجيات: من 2 إلى 3 استراتيجيات تعلم نشط مناسبة لطبيعة الدرس.
- سير الدرس: تهيئة قصيرة، ثم خطوات العرض مرتبة (3 إلى 5) تذكر ما يفعله المعلم والطالب، ثم أسئلة تقويم بنائي محددة، ثم غلق.
- التقويم الختامي: أسئلة محددة تقيس الأهداف نفسها.
- التمايز: نشاط علاجي للمتعثرين ونشاط إثرائي للمتقنين.
لا تذكر أسماء طلاب ولا معلومات غير مؤكدة عن محتوى الكتاب.`;

async function generate(ctx) {
  if (!client) return null;
  const msg = [
    `المادة: ${ctx.subject || '-'}`, `الصف: ${ctx.grade || '-'}${ctx.stage ? `، ${ctx.stage}` : ''}`, `الوحدة: ${ctx.unit || '-'}`,
    `الدرس: ${ctx.title}${ctx.page ? ` (ص ${ctx.page} في الكتاب)` : ''}`, `عدد الحصص المخصصة للدرس: ${ctx.periods || 1}`,
    ctx.skill ? `المهارة المستهدفة: ${ctx.skill}` : '', (ctx.unitObjectives || []).length ? `أهداف الوحدة من الكتاب:\n- ${ctx.unitObjectives.join('\n- ')}` : '',
    ctx.weak && ctx.weak.length ? `مهارات ضعيفة عند الشعبة من آخر اختبار (راعها في التمايز): ${ctx.weak.join('، ')}` : '',
  ].filter(Boolean).join('\n');
  try {
    const res = await client.beta.messages.create({
      model: MODEL, max_tokens: 6000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM, messages: [{ role: 'user', content: msg }],
    });
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return null;
    const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
    const p = cleanPrep({ ...out, source: 'ai' });
    return p.objectives.length && p.steps.present.length ? p : null;
  } catch (err) { console.error('AI prep error:', err.status || '', err.message); return null; }
}

module.exports = { cleanPrep, cleanPreps, template, generate, prepAi: () => !!client };
