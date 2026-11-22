// قراءة بطاقة نافس (بطاقة الأداء المدرسي من منصة تميز) من ملف PDF أو صورة.
// البطاقة لكل صف، فالمدير يقدر يرفع حتى 3 ملفات. القراءة ترجع مسودة للمراجعة ولا تُحفظ.
const Anthropic = require('@anthropic-ai/sdk');
const { normalize } = require('./nafis');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const pctN = { type: ['number', 'null'], description: 'نسبة مئوية بدون علامة %، أو null إذا غير مكتوبة' };
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['year', 'grades'],
  properties: {
    year: { type: 'string', description: 'عام النتائج كما في البطاقة، هجري إن وُجد مثل 1447، وإلا الميلادي' },
    grades: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['grade', 'students', 'tested', 'index', 'index_last', 'subjects'],
        properties: {
          grade: { type: 'string', enum: ['g3p', 'g6p', 'g3m'], description: 'g3p الثالث الابتدائي، g6p السادس الابتدائي، g3m الثالث المتوسط' },
          students: { type: ['integer', 'null'], description: 'عدد طلبة الصف' },
          tested: { type: ['integer', 'null'], description: 'عدد المختبرين' },
          index: { ...pctN, description: 'المؤشر العام أو الجامع للمدرسة في هذا الصف' },
          index_last: { ...pctN, description: 'المؤشر العام للسنة السابقة إن ظهر' },
          subjects: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              required: ['subject', 'mastery', 'office', 'ksa', 'last', 'mean', 'levels', 'domains'],
              properties: {
                subject: { type: 'string', enum: ['reading', 'math', 'science'], description: 'reading القراءة، math الرياضيات، science العلوم' },
                mastery: { ...pctN, description: 'نسبة الطلبة المتجاوزين الحد الأدنى للإتقان في المدرسة' },
                office: { ...pctN, description: 'نفس النسبة لإدارة التعليم' },
                ksa: { ...pctN, description: 'نفس النسبة للمملكة' },
                last: { ...pctN, description: 'نسبة إتقان المدرسة في السنة السابقة إن ظهرت' },
                mean: { ...pctN, description: 'متوسط درجات المدرسة إن ظهر' },
                levels: {
                  type: 'object', additionalProperties: false,
                  required: ['high', 'mid', 'low', 'vlow'],
                  properties: { high: pctN, mid: pctN, low: pctN, vlow: pctN },
                  description: 'توزيع طلبة المدرسة على مستويات الأداء إن ظهر',
                },
                domains: {
                  type: 'array',
                  items: {
                    type: 'object', additionalProperties: false,
                    required: ['name', 'school', 'office', 'ksa'],
                    properties: { name: { type: 'string' }, school: pctN, office: pctN, ksa: pctN },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const PROMPT = `هذه بطاقة (أو بطاقات) الأداء المدرسي في الاختبارات الوطنية «نافس» من منصة تميز، وكل بطاقة لصف واحد.
استخرج لكل صف: عدد الطلبة والمختبرين والمؤشر العام، ولكل مادة: نسبة الإتقان للمدرسة والإدارة والمملكة، ونتيجة السنة السابقة إن ظهرت، وتوزيع المستويات، ثم المجالات الفرعية بأسمائها كما هي مكتوبة مع قيمة المدرسة والإدارة والمملكة.
انقل الأرقام كما هي مكتوبة بالضبط. أي رقم غير مكتوب اجعله null. لا تقدّر ولا تحسب ولا تكمل أرقاماً ناقصة. لا تكرر الصف نفسه.`;

const MEDIA = { 'application/pdf': 'document', 'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image' };

async function readNafis(files) {
  if (!client) { const e = new Error('القراءة التلقائية غير مفعّلة حالياً، أدخل الأرقام يدوياً'); e.code = 'no_ai'; throw e; }
  const content = files.map((f) => ({ type: MEDIA[f.mimetype], source: { type: 'base64', media_type: f.mimetype, data: f.buffer.toString('base64') } }));
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [...content, { type: 'text', text: PROMPT }] }],
  });
  if (res.stop_reason === 'refusal') throw new Error('تعذرت قراءة الملف');
  const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  const card = normalize(out);
  return { card, warnings: check(card), usage: res.usage };
}

// تنبيهات للمراجعة: أرقام ناقصة أو غير متسقة
function check(card) {
  const w = [];
  const NAMES = { g3p: 'الثالث الابتدائي', g6p: 'السادس الابتدائي', g3m: 'الثالث المتوسط' };
  const SUB = { reading: 'القراءة', math: 'الرياضيات', science: 'العلوم' };
  if (!card.grades.length) w.push('ما لقينا أي صف في الملف. تأكد أنه بطاقة نافس من منصة تميز.');
  for (const g of card.grades) {
    if (g.students != null && g.tested != null && g.tested > g.students) w.push(`${NAMES[g.grade]}: عدد المختبرين أكبر من عدد الطلبة`);
    for (const s of g.subjects) {
      const at = `${NAMES[g.grade]} · ${SUB[s.subject]}`;
      if (s.mastery == null || s.ksa == null) w.push(`${at}: نسبة الإتقان للمدرسة أو المملكة ناقصة`);
      if (!s.domains.length) w.push(`${at}: ما ظهرت المجالات الفرعية`);
      const lv = Object.values(s.levels).filter((v) => v != null);
      if (lv.length === 4) { const sum = lv.reduce((a, b) => a + b, 0); if (Math.abs(sum - 100) > 2) w.push(`${at}: مجموع مستويات الأداء ${Math.round(sum)}% وليس 100%`); }
    }
  }
  return w;
}

module.exports = { readNafis, check, ACCEPT: Object.keys(MEDIA) };
