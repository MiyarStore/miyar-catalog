// توليد أسئلة اختبار (تشخيصي أو قصير) مربوطة بمهارات المعلم، عبر Claude إذا توفر المفتاح.
const Anthropic = require('@anthropic-ai/sdk');
const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['skill', 'text', 'choices', 'answer'],
    properties: { skill: { type: 'integer', description: 'رقم المهارة من القائمة' }, text: { type: 'string' }, choices: { type: 'array', items: { type: 'string' } }, answer: { type: 'string', description: 'نص الخيار الصحيح كما هو' } } } } },
};

async function generateTest({ subject, grade, stage, kind, skills, perSkill = 2 }) {
  if (!client || !skills.length) return null;
  const n = Math.min(Math.max(Number(perSkill) || 2, 1), 4);
  const msg = [
    `المادة: ${subject || '-'}`, `الصف: ${grade || '-'}${stage ? `، ${stage}` : ''}`, `نوع الاختبار: ${kind}`,
    `اكتب ${n} أسئلة اختيار من متعدد لكل مهارة، أربعة خيارات لكل سؤال وخيار واحد صحيح.`,
    'المهارات:', ...skills.map((s, i) => `${i + 1}. ${s}`),
  ].join('\n');
  try {
    const res = await client.beta.messages.create({
      model: MODEL, max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: 'أنت معلم سعودي خبير في بناء الاختبارات وفق مناهج وزارة التعليم. اكتب أسئلة واضحة بلغة سليمة ومناسبة لعمر الطالب، تقيس المهارة المطلوبة مباشرة، بدون أسئلة مكررة أو خيارات ملتبسة.',
      messages: [{ role: 'user', content: msg }],
    });
    if (res.stop_reason === 'refusal') return null;
    const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
    if (!Array.isArray(out.items)) return null;
    return out.items.filter((it) => it && it.text && Number(it.skill) >= 1 && Number(it.skill) <= skills.length).map((it) => ({ skill: Number(it.skill) - 1, text: String(it.text), choices: (it.choices || []).slice(0, 4).map(String), answer: String(it.answer || '') }));
  } catch (err) { console.error('AI test error:', err.status || '', err.message); return null; }
}
module.exports = { generateTest, testAi: () => !!client };
