// المساعد الذكي: يحوّل فكرة الشاهد المختصرة إلى شاهد مكتمل الصياغة ومربوط بالمعيار المناسب.
// يعمل عبر Claude إذا وُجد ANTHROPIC_API_KEY، وإلا يستخدم صياغة جاهزة بالقوالب.
const Anthropic = require('@anthropic-ai/sdk');
const { STANDARDS, guessStandard, byId } = require('./standards');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'standard_id', 'goals', 'description', 'steps', 'impact'],
  properties: {
    title: { type: 'string', description: 'عنوان رسمي مختصر للشاهد' },
    standard_id: { type: 'integer', description: 'رقم عنصر التقييم من 1 إلى 11' },
    goals: { type: 'array', items: { type: 'string' }, description: '3 إلى 4 أهداف تربوية' },
    description: { type: 'string', description: 'وصف الشاهد في فقرة واحدة' },
    steps: { type: 'string', description: 'آلية التنفيذ في خطوات مرقمة، كل خطوة في سطر' },
    impact: { type: 'string', description: 'الأثر المتوقع أو الناتج على الطلاب في جملة أو جملتين' },
  },
};

const SYSTEM = `أنت مساعد تربوي سعودي متخصص في توثيق شواهد الأداء الوظيفي للمعلمين والمعلمات وفق عناصر التقييم المعتمدة في وزارة التعليم.
المعلم يكتب فكرة الشاهد بكلمات قليلة، وأنت تصيغها بلغة عربية فصحى رسمية واضحة تصلح لملف إنجاز يطّلع عليه مدير المدرسة والمشرف.
لا تخترع أرقاماً أو أسماء أو نسباً لم يذكرها المعلم. اجعل الصياغة واقعية ومختصرة.
عناصر التقييم:
${STANDARDS.map((s) => `${s.id}. ${s.name}: ${s.hint}`).join('\n')}`;

function fallback(idea, ctx) {
  const sid = ctx.standard_id ? Number(ctx.standard_id) : guessStandard(idea);
  const s = byId(sid);
  const clean = String(idea).trim().replace(/[.،]+$/, '');
  const subj = ctx.subject ? ` في مادة ${ctx.subject}` : '';
  const f = ctx.gender === 'f';
  const title = clean.length > 70 ? clean.slice(0, 70).replace(/\s+\S*$/, '') : clean;
  return {
    title,
    standard_id: sid,
    goals: s.goals,
    description: `${f ? 'نفّذت المعلمة' : 'نفّذ المعلم'} شاهداً بعنوان «${clean}»${subj}، ضمن ${f ? 'ممارساتها' : 'ممارساته'} المهنية في عنصر «${s.name}»، بما يسهم في تحقيق نواتج التعلم المستهدفة.`,
    steps: ['التخطيط للنشاط وتحديد أهدافه والفئة المستهدفة', 'تجهيز الأدوات والوسائل اللازمة', 'تنفيذ النشاط وفق الخطة المعدّة', 'متابعة استجابة الطلاب وتوثيق الأثر'].map((x, i) => `${i + 1}. ${x}`).join('\n'),
    impact: 'تفاعل إيجابي من الطلاب وتحسّن ملحوظ في الجانب المستهدف.',
    source: 'template',
  };
}

async function draftEvidence(idea, ctx = {}) {
  if (!client) return fallback(idea, ctx);
  const userMsg = [
    `فكرة الشاهد: ${idea}`,
    ctx.subject ? `المادة: ${ctx.subject}` : '',
    ctx.stage ? `المرحلة: ${ctx.stage}` : '',
    ctx.gender === 'f' ? 'الكاتبة معلمة (استخدم صيغة المؤنث).' : 'الكاتب معلم.',
    ctx.standard_id ? `اربطه بالعنصر رقم ${ctx.standard_id}.` : 'اختر العنصر الأنسب.',
  ].filter(Boolean).join('\n');
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    });
    if (res.stop_reason === 'refusal') return fallback(idea, ctx);
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const out = JSON.parse(text);
    if (!byId(out.standard_id)) out.standard_id = guessStandard(idea);
    if (Array.isArray(out.steps)) out.steps = out.steps.join('\n');
    out.source = 'ai';
    return out;
  } catch (err) {
    console.error('AI error:', err.status || '', err.message);
    return fallback(idea, ctx);
  }
}

module.exports = { draftEvidence, aiEnabled: () => !!client };
