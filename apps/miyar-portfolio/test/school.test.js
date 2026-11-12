// اختبارات «معياري للمدرسة» على بيانات التقريرين الحقيقيين (بعد إخفاء الاسم والرقم الوزاري)
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

test('مجالات الممارسات الإشرافية ونوع الخطة', () => {
  const { supervisoryOf, planTypeOf } = require('../src/school/indicators');
  assert.strictEqual(supervisoryOf('2-1-1-3'), 'التدريس');
  assert.strictEqual(supervisoryOf('2-2-1-1'), 'التدريس');
  assert.strictEqual(supervisoryOf('3-1-1-1'), 'نواتج التعلم');
  assert.strictEqual(supervisoryOf('1-2-1-6'), 'الأنشطة المدرسية');
  assert.strictEqual(supervisoryOf('1-2-1-3'), 'التوجيه الطلابي');
  assert.strictEqual(supervisoryOf('1-1-1-1'), '');
  assert.strictEqual(planTypeOf(80), 'خطة تحسين من المدرسة');
  assert.strictEqual(planTypeOf(92), 'خطة استدامة من المدرسة');
  assert.strictEqual(planTypeOf(null), '');
});

test('تقرير المتابعة يتبع حقول استمارة تنفيذ خطة التحسين', async () => {
  const { followupHtml, followupDocx, printHtml } = require('../src/school/export');
  const r = normalize(require('../src/school/samples/report-intermediate.json'));
  const p = await buildPlan(r, { ai: false });
  p.rows[0].procedures[0].done = true; p.rows[0].procedures[0].done_at = Date.now();
  // خطة قديمة بدون الحقول الجديدة لازم تطلع سليمة
  delete p.rows[1].methods; delete p.rows[1].committee; delete p.rows[1].supervisory;
  const school = { name: 'مدرسة تجريبية', stage: 'basic', ministry_number: 'S-12345', gender: 'بنين', building: 'حكومي', period: 'صباحي', office: 'مكتب', year: '1448 هـ', principal: 'القائد' };
  const html = followupHtml({ school, report: r, plan: p, uploadsDir: '/tmp' });
  for (const t of ['البيانات الأساسية', 'العنصر / المؤشر المراد تحسينه', 'الإجراءات المنفذة', 'مقدم خدمات دعم التميز المدرسي', 'لجان المدرسة', 'المشرف التربوي', 'التوصيات والمقترحات', 'ختم المدرسة', 'نوع المبنى', 'نواتج التعلم']) assert.ok(html.includes(t), t);
  const plan = printHtml({ school, report: r, plan: p, trial: false, uploadsDir: '/tmp' });
  for (const t of ['وصف الاحتياج', 'إجراءات التحسين', 'أساليب وطرق التحسين', 'مدة الإنجاز', 'التنفيذ والمسؤولية', 'خطة تحسين من المدرسة']) assert.ok(plan.includes(t), t);
  const buf = await followupDocx({ school, report: r, plan: p, uploadsDir: '/tmp' });
  assert.ok(buf.length > 5000);
});

test('ترويسة الوزارة والمنفذ والشاهد في تقرير المتابعة', async () => {
  const { followupHtml, printHtml, followupDocx } = require('../src/school/export');
  const report = normalize(require('../src/school/samples/report-intermediate.json'));
  const plan = await buildPlan(report, { ai: false });
  Object.assign(plan.rows[0].procedures[0], { done: true, done_at: Date.now(), assignee: 't@x.sa', assignee_name: 'أ. سارة', evidence: { title: 'ورشة القراءة', code: 'ABC123' } });
  Object.assign(plan.rows[0].procedures[1], { assignee: 't@x.sa', assignee_name: 'أ. سارة' });
  const school = { name: 'مدرسة تجريبية', ministry_number: 'S-12345', year: '1448 هـ', office: 'إدارة تعليم تجريبية', principal: 'القائد', ministry_logo: 1 };
  const html = followupHtml({ school, report, plan, uploadsDir: '/nonexistent', base: 'https://x.test' });
  assert.match(html, /وزارة التعليم/);
  assert.match(html, /class="lh"/);
  assert.match(html, /المنفذ: أ\. سارة/);
  assert.match(html, /المسند إلى: أ\. سارة/);
  assert.match(html, /https:\/\/x\.test\/v\/ABC123/);
  assert.match(printHtml({ school, report, plan, uploadsDir: '/nonexistent' }), /المنفذون: أ\. سارة/);
  const off = followupHtml({ school: { ...school, ministry_logo: 0 }, report, plan, uploadsDir: '/nonexistent' });
  assert.doesNotMatch(off, /class="lh"/);
  const buf = await followupDocx({ school, report, plan, uploadsDir: '/nonexistent' });
  assert.ok(buf.length > 20000);
});

test('نافس: التصنيف والمستهدف والخطة على بطاقة حقيقية مخفية', () => {
  const n = require('../src/school/nafis');
  assert.strictEqual(n.classify(36, 32), 'strength');
  assert.strictEqual(n.classify(33, 32), 'improve');
  assert.strictEqual(n.classify(20, 26), 'urgent');
  assert.strictEqual(n.targetOf(0, 39), 15);
  assert.strictEqual(n.targetOf(20, 26), 26);
  assert.strictEqual(n.targetOf(40, 30), 45);
  const card = n.normalize(require('../src/school/samples/nafis-intermediate.json'));
  const a = n.analyze(card);
  assert.ok(a.complete);
  assert.deepStrictEqual(a.counts, { urgent: 9, improve: 0, strength: 0, total: 9 });
  const p = n.buildNafisPlan(card);
  assert.strictEqual(p.rows.length, 9);
  assert.strictEqual(p.priorities[0].domain, 'الأعداد والعمليات عليها');
  assert.match(p.summary.decision, /مكثفة/);
  assert.ok(p.rows.every((r) => r.actions.length >= 3));
  assert.strictEqual(n.buildNafisPlan(card, { limit: 3 }).rows.length, 3);
  assert.strictEqual(n.normalize({ grades: [{ grade: 'xx' }] }).grades.length, 0);
});

test('نافس: الطباعة وWord بترويسة الوزارة', async () => {
  const n = require('../src/school/nafis');
  const { nafisHtml, nafisDocx } = require('../src/school/nafis-export');
  const card = n.normalize(require('../src/school/samples/nafis-intermediate.json'));
  const plan = n.buildNafisPlan(card);
  const school = { name: 'مدرسة تجريبية', office: 'مكتب', year: '1448', principal: 'القائد', ministry_number: 'S-12345' };
  const html = nafisHtml({ school, card, plan, trial: false, uploadsDir: '/nonexistent' });
  assert.match(html, /class="lh"/);
  assert.match(html, /الملخص التنفيذي/);
  assert.match(html, /القرار المقترح/);
  assert.doesNotMatch(nafisHtml({ school: { ...school, ministry_logo: 0 }, card, plan, trial: true, uploadsDir: '/x' }), /class="lh"/);
  const buf = await nafisDocx({ school, card, plan, uploadsDir: '/x' });
  assert.ok(buf.length > 20000);
});
