process.env.DATA_DIR = process.env.DATA_DIR || require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'miyar-logs-'));
const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/logs');
const C = require('../src/coverage');
const F = require('../src/fmt');
const { forRole, ROLES } = require('../src/standards');

test('القياس القبلي والبعدي: الفرق بالنقاط المئوية والفراغ ليس صفراً', () => {
  const a = L.impact({ pre: 52, post: 68.5 });
  assert.equal(a.diff, 16.5); assert.equal(a.rel, 31.7);
  assert.match(a.text, /16.5 نقطة مئوية/); assert.match(a.text, /لا يعني بالضرورة/);
  const b = L.impact({ pre: null, post: 70 });
  assert.equal(b.diff, null);
  assert.equal(L.impact({ pre: 0, post: 40 }).rel, null);
});

test('تنظيف السجل: الحقول الإلزامية والخيارات والأرقام العربية', () => {
  const { d, miss } = L.clean('wait', { period: '٥', cls: '3/2', activity: 'غير موجود' });
  assert.equal(d.period, 5); assert.equal(d.activity, '');
  assert.deepEqual(miss.map((f) => f.key), ['activity']);
  assert.equal(L.clean('initiative', { title: 'x', goal: 'y', pre: 150 }).d.pre, 100);
});

test('نص الشاهد من السجل بعدد ومعدود صحيح وعنصر مناسب', () => {
  const mk = (n, data) => Array.from({ length: n }, (_, i) => ({ kind: 'x', date: '2026-11-0' + ((i % 9) + 1), data, std: 1, status: 'closed' }));
  assert.match(L.evidenceFrom('wait', mk(1, { activity: 'قراءة حرة' })).description, /حصة انتظار واحدة/);
  assert.match(L.evidenceFrom('wait', mk(2, { activity: 'قراءة حرة' })).description, /حصتي انتظار/);
  assert.match(L.evidenceFrom('wait', mk(5, { activity: 'قراءة حرة' })).description, /5 حصص انتظار/);
  assert.match(L.evidenceFrom('wait', mk(12, { activity: 'قراءة حرة' })).description, /12 حصة انتظار/);
  const c = L.evidenceFrom('contact', mk(3, { party: 'ولي أمر', reason: 'السلوك' }));
  assert.equal(c.standard_id, 3); assert.match(c.description, /أُغلق منها 3/);
  assert.equal(L.evidenceFrom('committee', mk(2, { type: 'مجتمع تعلم مهني', title: 'م' }).map((r) => ({ ...r, std: 2 }))).standard_id, 2);
});

test('عبارات المستوى 5: موجودة لكل عنصر في كل الوظائف ومفاتيحها فريدة', () => {
  for (const role of Object.keys(ROLES)) for (const s of forRole(role)) {
    const p = C.partsOf(s.id, role);
    assert.ok(p.length >= 1, role + ' ' + s.id);
    assert.equal(new Set(p.map((x) => x.k)).size, p.length);
    for (const x of p.slice(1)) assert.ok(!/^(مما|مع |و[^يتُ])/.test(x.t), x.t);
  }
  assert.equal(C.partsOf(1, 'teacher').length, 3);
  const cv = C.coverage(C.partsOf(1, 'teacher'), [{ parts: ['a'] }, { parts: ['a', 'c'] }]);
  assert.equal(cv.covered, 2); assert.equal(cv.rows[0].n, 2);
});

test('التاريخ المزدوج وصيغة الجنس', () => {
  assert.match(F.dual('2026-11-06'), /١٤٤٨ هـ الموافق .*٢٠٢٦م/);
  assert.equal(F.dual(''), '');
  assert.equal(F.G({ gender: 'f' }).principal, 'مديرة المدرسة');
  assert.match(F.madeBy({ gender: 'm' }), /ليس نموذجاً رسمياً/);
});
