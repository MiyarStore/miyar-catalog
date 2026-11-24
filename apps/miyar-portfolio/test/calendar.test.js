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
test('الإجازات الإضافية واليوم الوطني', () => {
  assert.equal(CAL.holidayOn('general', '2026-10-25').name, 'إجازة إضافية');
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
