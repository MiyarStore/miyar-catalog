const test = require('node:test');
const assert = require('node:assert');
const CAL = require('../src/calendar');
process.env.DATA_DIR = process.env.DATA_DIR || require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'cal-'));
const R = require('../src/teacher/record');

test('التقويم العام: البداية والنهاية والأيام الدراسية', () => {
  const t1 = CAL.summary('general', 'الفصل الدراسي الأول');
  assert.equal(t1.start, '2026-08-23');
  assert.equal(t1.end, '2027-01-07');
  const t2 = CAL.summary('general', 'الفصل الدراسي الثاني');
  assert.equal(t2.end, '2027-06-24');
  // الوزارة: حد أدنى 180 يوماً دراسياً
  assert.ok(t1.schoolDays + t2.schoolDays >= 180);
});
test('تقويم مكة والمدينة وجدة والطائف يبدأ بعد أسبوع', () => {
  assert.equal(CAL.summary('west', 'الفصل الدراسي الأول').start, '2026-08-30');
  assert.equal(CAL.holidayOn('west', '2027-05-03').name, 'إجازة عيد الأضحى');
  assert.equal(CAL.holidayOn('general', '2027-05-03'), null);
});
test('الإجازات الإضافية تضاف حسب إدارة التعليم، واليوم الوطني', () => {
  // الإجازات الإضافية: 4 أيام متفرقة لبقية المناطق، ويوم واحد للغربية
  for (const d of ['2026-10-25', '2026-11-29', '2027-01-07', '2027-04-11']) assert.equal(CAL.holidayOn('general', d).name, 'إجازة إضافية');
  assert.equal(CAL.holidayOn('west', '2026-10-25').name, 'إجازة إضافية');
  for (const d of ['2026-11-29', '2027-01-07', '2027-04-11']) assert.equal(CAL.holidayOn('west', d), null);
  // يوم يضيفه المعلم لمنطقته
  assert.equal(CAL.holidayOn('general', '2026-10-26'), null);
  assert.equal(CAL.holidayOn('general', '2026-10-26', undefined, ['2026-10-26']).name, 'إجازة إضافية');
  assert.equal(CAL.summary('west', 'الفصل الدراسي الثاني').schoolDays, 93); // يطابق توزيع أسابيع الفصل الثاني للغربية
  assert.equal(CAL.holidayOn('general', '2026-09-23').name, 'إجازة اليوم الوطني');
  assert.equal(CAL.holidayOn('general', '2026-09-22'), null);
  assert.match(CAL.hijri('2026-08-23'), /10 ربيع الأول 1448/);
});
test('الخطة تتجاوز حصص أيام الإجازة', () => {
  const d = R.clean({ subject: 'رياضيات', term: 'الفصل الدراسي الأول', region: 'general', slots: [{ day: 0, period: 1 }, { day: 3, period: 2 }, { day: 4, period: 3 }],
    lessons: Array.from({ length: 40 }, (_, i) => ({ title: `درس ${i + 1}`, periods: 1 })) });
  const p = R.plan(d);
  assert.equal(p.start, '2026-08-23');
  const nd = p.weeks.find((w) => w.from === '2026-09-20'); // أسبوع اليوم الوطني (الأربعاء والخميس)
  assert.deepEqual(nd.holidays, ['إجازة اليوم الوطني']);
  assert.equal(nd.slots.filter((s) => s.holiday).length, 2);
  assert.equal(nd.items.reduce((a, x) => a + x.periods, 0), 1);
  const autumn = p.weeks.find((w) => w.from === '2026-11-22');
  assert.ok(autumn.off);
});

test('تحضير الدروس: القالب والتنظيف والربط بالخطة', () => {
  const PREP = require('../src/teacher/prep');
  const t = PREP.template({ title: 'الكسور', skill: 'مقارنة الكسور', page: 30 });
  assert.ok(t.objectives[0].startsWith('أن '));
  assert.equal(t.source, 'template');
  const d = R.clean({ subject: 'رياضيات', term: 'الفصل الدراسي الأول', region: 'general', slots: [{ day: 0, period: 1 }],
    lessons: [{ id: 'a1', title: 'الكسور', periods: 1 }], preps: { a1: t, zz: t } });
  assert.deepEqual(Object.keys(d.preps), ['a1']); // تحضير لدرس محذوف ينشال
  const f = R.full(d);
  assert.equal(f.schedule.a1[0].date, '2026-08-30'); // الأسبوع الأول للتهيئة والتشخيصي
  const { build } = require('../src/teacher/record-export');
  const html = build({ u: { full_name: 'م', gender: 'm' }, d, kind: 'prep', lesson: 'a1' });
  assert.match(html, /تحضير درس: الكسور/);
  assert.match(html, /سير الدرس/);
});

test('إجراءات الغياب حسب قواعد السلوك والمواظبة', () => {
  const slots = [{ day: 0, period: 1 }, { day: 1, period: 1 }, { day: 2, period: 1 }, { day: 3, period: 1 }, { day: 4, period: 1 }];
  const days = ['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'];
  const mk = (marks) => R.clean({ subject: 'لغتي', term: 'الفصل الدراسي الأول', region: 'general', slots, students: [{ id: 's1', name: 'أحمد' }, { id: 's2', name: 'سالم' }],
    att: Object.fromEntries(days.map((ds, i) => [ds, marks[i] ? { s1: marks[i] } : {}])) });
  // 3 أيام متصلة: تحويل للموجه
  let A = R.attendance(mk(['a', 'a', 'a', '', '']));
  const r = A.rows.find((x) => x.id === 's1');
  assert.equal(r.streak, 3); assert.equal(r.step.code, 'refer'); assert.ok(A.base > 80);
  assert.equal(A.rows.find((x) => x.id === 's2').step, null);
  // الاستئذان ما يقطع الاتصال ولا ينحسب غياب
  A = R.attendance(mk(['a', 'e', 'a', '', '']));
  assert.equal(A.rows[0].absent, 2); assert.equal(A.rows[0].streak, 2); assert.equal(A.rows[0].step, null);
  // متفرقة أقل من 5: لا إجراء
  A = R.attendance(mk(['a', '', 'a', '', 'a']));
  assert.equal(A.rows[0].step, null);
});
