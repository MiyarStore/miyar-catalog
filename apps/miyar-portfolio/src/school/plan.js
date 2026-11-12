// محرك خطة التحسين: يبني صفوف الخطة للمؤشرات التي لم تبلغ التميز، مرتبة من الأضعف.
const Anthropic = require('@anthropic-ai/sdk');
const { LEVELS, levelOf, standardName, domainName, supervisoryOf } = require('./indicators');
const { recFor } = require('./recs');
const { bankFor, methodsFor } = require('./bank');
const { actionsFor } = require('./actions');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const ceil5 = (n) => Math.ceil(n / 5) * 5;
function targetFor(pct) {
  const next = [...LEVELS].reverse().find((l) => l.min > pct);
  return Math.min(100, Math.max(next ? next.min : 95, ceil5(pct + 5)));
}
const fmt = (n) => (Math.round(n * 100) / 100).toString();
const priority = (pct) => (pct < 50 ? 'عالية جداً' : pct < 75 ? 'عالية' : 'متوسطة');

// الفترات الزمنية حسب الأولوية (العام الدراسي بفصلين)
const timing = (pct) => (pct < 75 ? { from: 'بداية الفصل الدراسي الأول', to: 'نهاية العام الدراسي' } : { from: 'الفصل الدراسي الأول', to: 'نهاية الفصل الدراسي الثاني' });

function templateRow(ind, stage, rx = {}) {
  const b = bankFor(ind.standard, stage);
  const rec = recFor(ind.code, stage);
  const target = targetFor(ind.pct);
  const act = actionsFor(ind.code, stage);
  const procedures = (act ? act.p : b.procedures.slice(0, 4).map((t) => [t, 'طوال العام'])).map(([text, when]) => ({ text, when, done: false }));
  return {
    code: ind.code,
    indicator: ind.text,
    standard: standardName(ind.standard),
    domain: domainName(ind.domain),
    supervisory: supervisoryOf(ind.code),
    pct: ind.pct,
    level: levelOf(ind.pct).name,
    priority: priority(ind.pct),
    need: `تحقق المؤشر بنسبة ${fmt(ind.pct)}% (مستوى ${levelOf(ind.pct).name})، ويتوقع من المدرسة ${rec}`,
    goal: `رفع نسبة تحقق المؤشر من ${fmt(ind.pct)}% إلى ${target}% في دورة التقويم القادمة.`,
    target,
    procedures,
    rec,
    responsible: b.responsible,
    methods: methodsFor(ind.standard),
    committee: b.responsible,
    supervisor: '',
    note: '',
    ...timing(ind.pct),
    measure: `نسبة تحقق المؤشر في التقويم الذاتي القادم لا تقل عن ${target}%، وتنفيذ جميع الإجراءات المخطط لها في وقتها.`,
    evidence: act ? act.ev : b.evidence,
    source: 'template',
    ...rx,
  };
}

const ROW_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['rows'],
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['code', 'goal', 'procedures', 'responsible', 'measure', 'evidence'],
        properties: {
          code: { type: 'string' },
          goal: { type: 'string', description: 'هدف ذكي محدد بالنسبة المستهدفة' },
          procedures: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'when'], properties: { text: { type: 'string' }, when: { type: 'string', description: 'التوقيت مثل: الشهر الأول، شهرياً، كل فصل دراسي' } } }, description: '4 إلى 5 إجراءات تنفيذية خاصة بهذا المؤشر' },
          responsible: { type: 'string' },
          measure: { type: 'string', description: 'مؤشر قياس التحقق' },
          evidence: { type: 'array', items: { type: 'string' }, description: '3 شواهد' },
        },
      },
    },
  },
};

const SYSTEM = `أنت خبير سعودي في التخطيط المدرسي والتقويم المدرسي وفق معايير هيئة تقويم التعليم والتدريب.
تكتب خطة تحسين واقعية بلغة عربية رسمية مختصرة، كل إجراء جملة واحدة قابلة للتنفيذ داخل مدرسة حكومية.
اربط الإجراءات بنص التوصية الرسمية وبحالة المدرسة. لا تخترع أرقاماً أو أسماء أو جهات بعينها غير مذكورة، ولا تذكر أرقام قرارات أو أدلة.
اكتب المسؤول بالمسميات الوظيفية فقط (قائد المدرسة، الوكيل، الموجه الطلابي...).`;

async function aiRows(rows, ctx) {
  const payload = rows.map((r) => ({ code: r.code, indicator: r.indicator, standard: r.standard, pct: r.pct, level: r.level, target: r.target, recommendation: r.need, reference_procedures: r.procedures.map((p) => p.text) }));
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ROW_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `المدرسة: ${ctx.stageLabel}، ${ctx.gender || ''}، عدد الطلاب ${ctx.students ?? 'غير محدد'}، الأداء العام ${ctx.overall ?? '-'}%.\nاكتب صفاً لكل مؤشر بنفس الرمز:\n${JSON.stringify(payload)}` }],
  });
  if (res.stop_reason === 'refusal') throw new Error('refusal');
  const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  const byCode = new Map(out.rows.map((r) => [r.code, r]));
  return { rows: rows.map((r) => { const a = byCode.get(r.code); return a ? { ...r, goal: a.goal, procedures: a.procedures.map((p) => ({ text: p.text, when: p.when, done: false })), responsible: a.responsible, measure: a.measure, evidence: a.evidence, source: 'ai' } : r; }), usage: res.usage };
}

// report: ناتج normalize. opts.limit يحدد عدد الصفوف (للتجربة المجانية).
async function buildPlan(report, opts = {}) {
  const weak = report.indicators.filter((i) => i.pct != null && i.pct < 90).sort((a, b) => a.pct - b.pct);
  let rows = weak.map((i) => templateRow(i, report.stage));
  const total = rows.length;
  if (opts.limit) rows = rows.slice(0, opts.limit);
  let usage = null;
  if (client && opts.ai !== false && rows.length) {
    try {
      const r = await aiRows(rows, { stage: report.stage, stageLabel: report.stage === 'secondary' ? 'ثانوية' : 'متوسطة/ابتدائية', gender: report.gender, students: report.students, overall: report.overall });
      rows = r.rows; usage = r.usage;
    } catch (e) { console.error('plan AI error:', e.status || '', e.message); }
  }
  const strengths = report.indicators.filter((i) => i.pct != null && i.pct >= 90).sort((a, b) => b.pct - a.pct).map((i) => ({ code: i.code, indicator: i.text, pct: i.pct }));
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l.name, report.indicators.filter((i) => i.pct != null && levelOf(i.pct).key === l.key).length]));
  return { rows, total, limited: !!opts.limit && total > rows.length, strengths, byLevel, recommendations: '', usage, generated_at: Date.now() };
}

module.exports = { buildPlan, targetFor, planAiEnabled: () => !!client };
