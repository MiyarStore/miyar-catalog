const test = require('node:test');
const assert = require('node:assert');
const RUB = require('../src/rubric');
const { forRole } = require('../src/standards');

test('سلّم التقدير: خمسة أوصاف لكل عنصر من عناصر المعلم', () => {
  for (const s of forRole('teacher')) { const l = RUB.levelsOf(s.id); assert.ok(l, s.name); assert.equal(l.length, 5); for (const t of l) assert.ok(t.length > 20); }
});
test('آلية الاحتساب الرسمية: التقدير × الوزن ومستويات التقدير العام', () => {
  const all = (n) => Object.fromEntries(forRole('teacher').map((s) => [s.id, n]));
  assert.equal(RUB.calc('teacher', all(5)).value, 5);
  assert.equal(RUB.calc('teacher', all(5)).band.name, 'مثالي');
  assert.equal(RUB.calc('teacher', all(4)).value, 4);
  assert.equal(RUB.calc('teacher', all(4)).band.score, 4);
  assert.equal(RUB.calc('teacher', all(3)).band.name, 'وافق التوقعات');
  assert.equal(RUB.calc('teacher', all(1)).band.score, 1);
  // عنصر وزنه 5% بتقدير 3 والباقي 5: 0.95×5 + 0.05×3 = 4.9
  const r = all(5); r[8] = 3;
  assert.equal(RUB.calc('teacher', r).value, 4.9);
  // 4.4 يقرب لـ 4، و4.5 لـ 5
  const m = all(4); for (const id of [1, 2, 3, 4]) m[id] = 5; // 40% بخمسة
  assert.equal(RUB.calc('teacher', m).value, 4.4); assert.equal(RUB.calc('teacher', m).band.score, 4);
  m[5] = 5; assert.equal(RUB.calc('teacher', m).value, 4.5); assert.equal(RUB.calc('teacher', m).band.score, 5);
  // قيم غير صالحة تنحذف
  assert.deepEqual(RUB.clean({ 1: 7, 2: 0, 999: 4, 3: '4' }, 'teacher'), { 3: 4 });
  assert.equal(RUB.calc('teacher', {}).band, null);
});
