// اختبارات «خطط معيار» على بيانات التقريرين الحقيقيين (بعد إخفاء الاسم والرقم الوزاري)
const test = require('node:test');
const assert = require('node:assert');
const { normalize } = require('../src/school/report');
const { buildPlan, targetFor } = require('../src/school/plan');
const { catalog } = require('../src/school/indicators');
const { recFor } = require('../src/school/recs');

test('عدد المؤشرات حسب المرحلة', () => {
  assert.strictEqual(catalog('basic').length, 46);
  assert.strictEqual(catalog('secondary').length, 45);
  for (const s of ['basic', 'secondary']) for (const i of catalog(s)) assert.ok(recFor(i.code, s), i.code);
});

test('تقرير المتوسطة: 9 مؤشرات تحت التميز وأضعفها القراءة', async () => {
  const r = normalize(require('../src/school/samples/report-intermediate.json'));
  assert.ok(r.complete);
  const p = await buildPlan(r, { ai: false });
  assert.strictEqual(p.total, 9);
  assert.strictEqual(p.rows[0].code, '3-1-1-1');
  assert.deepStrictEqual(p.byLevel, { 'التميز': 37, 'التقدم': 6, 'الانطلاق': 0, 'التهيئة': 3 });
});

test('تقرير الثانوية: 42 مؤشراً والتجربة تعرض 3 فقط', async () => {
  const r = normalize(require('../src/school/samples/report-secondary.json'));
  const p = await buildPlan(r, { ai: false, limit: 3 });
  assert.strictEqual(p.total, 42);
  assert.strictEqual(p.rows.length, 3);
  assert.ok(p.limited);
  assert.match(p.rows[0].procedures.map((x) => x.text).join(' '), /التحصيلي/);
});

test('النسبة المستهدفة', () => {
  assert.strictEqual(targetFor(30.38), 50);
  assert.strictEqual(targetFor(60), 75);
  assert.strictEqual(targetFor(89.5), 95);
});

test('التحقق من النسب الناقصة والخاطئة', () => {
  const r = normalize({ stage: 'basic', indicators: [{ code: '1-1-1-1', pct: 120 }, { code: '9-9-9-9', pct: 50 }] });
  assert.ok(!r.complete);
  assert.ok(r.warnings.some((w) => w.includes('خارج النطاق')));
  assert.ok(r.warnings.some((w) => w.includes('9-9-9-9')));
});

test('كل مؤشر له إجراءات خاصة بتوقيت وشواهد', () => {
  const { actionsFor } = require('../src/school/actions');
  for (const s of ['basic', 'secondary']) for (const i of catalog(s)) {
    const a = actionsFor(i.code, s);
    assert.ok(a && a.p.length >= 4 && a.p.every(([t, w]) => t && w) && a.ev.length >= 3, `${s} ${i.code}`);
  }
});
