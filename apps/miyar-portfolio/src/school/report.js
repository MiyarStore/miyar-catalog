// قراءة تقرير التقويم المدرسي (منصة تميز) والتحقق منه.
// بدون مفتاح API: المستخدم يدخل النسب يدوياً (النموذج معبأ مسبقاً بالمؤشرات الرسمية).
const Anthropic = require('@anthropic-ai/sdk');
const { catalog, levelOf } = require('./indicators');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['school_name', 'ministry_number', 'office', 'authority', 'gender', 'students', 'overall', 'cycle', 'stage', 'indicators'],
  properties: {
    school_name: { type: 'string' },
    ministry_number: { type: 'string', description: 'الرقم الوزاري كما يظهر مثل S-12345' },
    office: { type: 'string', description: 'إدارة التعليم' },
    authority: { type: 'string', description: 'السلطة: حكومي أو أهلي' },
    gender: { type: 'string', description: 'بنين أو بنات' },
    students: { type: 'integer', description: 'عدد الطلبة الإجمالي' },
    overall: { type: 'number', description: 'نسبة الأداء العام للمدرسة' },
    cycle: { type: 'string', description: 'مثل: دورة التقويم الثانية - 2026' },
    stage: { type: 'string', enum: ['basic', 'secondary'], description: 'secondary إذا كان مؤشرا التحصيل عن الاختبارات التحصيلية والقدرات، وإلا basic' },
    indicators: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['code', 'pct'],
        properties: { code: { type: 'string', description: 'رمز المؤشر مثل 1-1-1-1' }, pct: { type: 'number', description: 'النسبة بدون علامة %' } },
      },
    },
  },
};

const PROMPT = `هذا تقرير التقويم المدرسي الذاتي من منصة تميز. استخرج البيانات الأساسية للمدرسة ونسبة كل مؤشر بالضبط كما هي مكتوبة (بكل الكسور العشرية).
رمز المؤشر يُكتب في التقرير مثل 1-1-1-1. استخرج كل المؤشرات بلا استثناء (45 أو 46 مؤشراً). لا تقدّر ولا تكمل أي رقم غير مكتوب.`;

async function readPdf(buffer) {
  if (!client) { const e = new Error('القراءة التلقائية غير مفعّلة حالياً، أدخل النسب يدوياً'); e.code = 'no_ai'; throw e; }
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } },
      { type: 'text', text: PROMPT },
    ] }],
  });
  if (res.stop_reason === 'refusal') throw new Error('تعذرت قراءة الملف');
  const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  return { ...normalize(out), source: 'ai', usage: res.usage };
}

// يوحّد البيانات ويرجع قائمة تنبيهات للمراجعة
function normalize(r = {}) {
  const stage = r.stage === 'secondary' ? 'secondary' : 'basic';
  const cat = catalog(stage);
  const got = new Map((r.indicators || []).map((i) => [String(i.code).trim().replace(/[–—]/g, '-'), i]));
  const warnings = [];
  const indicators = cat.map((c) => {
    const g = got.get(c.code);
    let pct = g && g.pct !== '' && g.pct != null ? Number(g.pct) : null;
    if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) { warnings.push(`نسبة المؤشر ${c.code} خارج النطاق`); pct = null; }
    if (pct == null) warnings.push(`المؤشر ${c.code} بدون نسبة`);
    return { code: c.code, text: c.text, standard: c.standard, domain: c.domain, pct, level: pct == null ? null : levelOf(pct).key };
  });
  const extra = [...got.keys()].filter((k) => !cat.some((c) => c.code === k));
  if (extra.length) warnings.push(`رموز غير معروفة تم تجاهلها: ${extra.join('، ')}`);
  const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    cycle: String(r.cycle || '').slice(0, 60),
    school_name: String(r.school_name || '').slice(0, 120),
    ministry_number: String(r.ministry_number || '').trim().toUpperCase().slice(0, 20),
    office: String(r.office || '').slice(0, 120),
    authority: String(r.authority || '').slice(0, 20),
    gender: String(r.gender || '').slice(0, 10),
    students: num(r.students),
    overall: num(r.overall),
    stage,
    indicators,
    warnings,
    complete: indicators.every((i) => i.pct != null),
  };
}

module.exports = { readPdf, normalize, readerEnabled: () => !!client };
