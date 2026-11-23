// كتابة أسئلة الاختبار بالذكاء الاصطناعي: كل خانة في جدول المواصفات (نوع + درس + مستوى) تطلع سؤال واحد.
const Anthropic = require('@anthropic-ai/sdk');
const { LEVELS, TYPES } = require('./exam');
const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['slot', 'text', 'choices', 'answer'],
    properties: {
      slot: { type: 'integer', description: 'رقم الخانة كما في الطلب' },
      text: { type: 'string', description: 'نص السؤال أو العبارة' },
      choices: { type: 'array', items: { type: 'string' }, description: 'أربعة خيارات للاختيار من متعدد فقط، وإلا قائمة فاضية' },
      answer: { type: 'string', description: 'الإجابة الصحيحة' },
    } } } },
};

const RULES = {
  mcq: 'اختيار من متعدد: نص السؤال (جذر واضح كامل المعنى) وأربعة خيارات متقاربة الطول، واحد صحيح فقط والبقية مموهات معقولة من أخطاء الطلاب الشائعة، بدون «كل ما سبق» أو «لا شيء مما سبق». answer = نص الخيار الصحيح حرفياً.',
  tf: 'صح وخطأ: عبارة خبرية واحدة واضحة الحكم، بدون نفي مزدوج أو كلمات مطلقة مثل «دائماً» و«أبداً» إلا لو كانت جزءاً من المفهوم. answer = «صح» أو «خطأ». نوّع بين الصحيح والخاطئ.',
  fill: 'أكمل الفراغ: جملة فيها فراغ واحد يُكتب هكذا: ............ ، والكلمة الناقصة مفهوم أساسي لا كلمة ثانوية. answer = الكلمة أو العبارة الناقصة.',
  match: 'المزاوجة: text = المصطلح أو المفهوم (عمود أ) قصير، answer = تعريفه أو وصفه أو مثاله (عمود ب) في سطر قصير. لا تكرر نفس المصطلح في خانات المزاوجة.',
  short: 'إجابة قصيرة: سؤال يُجاب عنه في سطر أو سطرين (عرّف، اذكر، علّل، قارن، مثّل). answer = الإجابة النموذجية مختصرة مع نقاط التصحيح.',
  essay: 'مقالي: سؤال مفتوح يقيس الفهم العميق أو التطبيق في موقف جديد أو حل مشكلة. answer = الإجابة النموذجية بنقاط واضحة مع توزيع الدرجة على النقاط.',
};

function prompt(ctx, list) {
  const lv = Object.fromEntries(LEVELS.map((l) => [l.key, `${l.name} (${l.desc})`]));
  const byLesson = new Map(ctx.lessons.map((l) => [l.id, l]));
  const used = [...new Set(list.map((s) => s.lesson))].map((id) => byLesson.get(id)).filter(Boolean);
  return [
    `المادة: ${ctx.subject || '-'}`, `الصف والمرحلة: ${[ctx.grade, ctx.stage].filter(Boolean).join('، ') || '-'}`, `الفصل الدراسي: ${ctx.term || '-'}`, `نوع الاختبار: ${ctx.kind}`,
    '', 'الدروس المشمولة:',
    ...used.map((l) => [`- ${l.title}${l.unit ? ` (${l.unit})` : ''}`, l.skill_name ? `  المهارة: ${l.skill_name}` : '', l.objectives.length ? `  أهداف الوحدة: ${l.objectives.join('؛ ')}` : '', l.content ? `  محتوى الدرس من المعلم (اعتمد عليه): ${l.content.slice(0, 2500)}` : ''].filter(Boolean).join('\n')),
    '', 'قواعد الأنواع:', ...[...new Set(list.map((s) => s.type))].map((t) => `- ${RULES[t]}`),
    '', `اكتب سؤالاً واحداً لكل خانة (${list.length} خانة):`,
    ...list.map((s, i) => `${i + 1}. النوع: ${TYPES[s.type].name} | الدرس: ${(byLesson.get(s.lesson) || {}).title || '-'} | المستوى: ${lv[s.level]}${s.hint ? ` | ملاحظة المعلم: ${s.hint}` : ''}${s.avoid ? ` | لا تكرر هذا السؤال: ${s.avoid}` : ''}`),
  ].join('\n');
}

async function write(ctx, list) {
  if (!client || !list.length) return null;
  try {
    const res = await client.beta.messages.create({
      model: MODEL, max_tokens: Math.min(1200 + list.length * 420, 20000), betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: [
        'أنت خبير قياس وتقويم تربوي سعودي تبني اختبارات تحريرية لمدارس وزارة التعليم وفق جدول المواصفات.',
        'التزم بمحتوى المنهج السعودي للمادة والصف المذكورين، وبمستوى كل خانة: المعرفة تذكّر مباشر، والتطبيق استخدام في موقف مألوف، والاستدلال تحليل أو تعليل أو حل مشكلة جديدة.',
        'اكتب بلغة عربية فصيحة سليمة إملائياً ونحوياً ومناسبة لعمر الطالب، وسؤال واحد واضح في كل خانة، بدون تلميح للإجابة في نص السؤال، وبدون تكرار بين الأسئلة.',
        'لا تذكر أرقام صفحات ولا اسم الكتاب، ولا تضف رموزاً أو ترقيماً داخل نص السؤال.',
      ].join('\n'),
      messages: [{ role: 'user', content: prompt(ctx, list) }],
    });
    if (res.stop_reason === 'refusal') return null;
    const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
    if (!Array.isArray(out.items)) return null;
    const got = new Map();
    for (const it of out.items) {
      const i = Number(it.slot) - 1; const s = list[i];
      if (!s || got.has(i) || !String(it.text || '').trim()) continue;
      let choices = s.type === 'mcq' ? (it.choices || []).map((c) => String(c).trim()).filter(Boolean).slice(0, 4) : [];
      let answer = String(it.answer || '').trim();
      if (s.type === 'mcq') { if (choices.length < 2) continue; if (!choices.includes(answer)) { const m = choices.find((c) => c.replace(/\s/g, '') === answer.replace(/\s/g, '')); answer = m || choices[0]; } }
      if (s.type === 'tf') answer = /خطأ|خاطئ|false/i.test(answer) ? 'خطأ' : 'صح';
      got.set(i, { text: String(it.text).trim(), choices, answer });
    }
    return got;
  } catch (err) { console.error('AI exam error:', err.status || '', err.message); return null; }
}

module.exports = { write, examAi: () => !!client };
