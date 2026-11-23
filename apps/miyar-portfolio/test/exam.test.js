// اختبارات محرك جدول المواصفات في صانع الاختبارات
const test = require('node:test');
const assert = require('node:assert');
const X = require('../src/exam/exam');

function sample(periods = [4, 2, 3, 1]) {
  const d = X.blank({ kind: 'final' });
  d.lessons = periods.map((p, i) => ({ id: 'l' + i, unit: 'و1', title: 'درس ' + (i + 1), periods: p, skill: '', skill_name: '', objectives: '', content: '' }));
  d.selected = d.lessons.map((l) => l.id);
  return X.clean(d);
}

test('مجموع الجدول يساوي عدد الأسئلة صفاً وعموداً', () => {
  const d = sample();
  const s = X.spec(d);
  const n = d.sections.reduce((a, x) => a + x.count, 0);
  assert.strictEqual(s.items, n);
  assert.strictEqual(s.lessons.reduce((a, l) => a + l.items, 0), n);
  for (const l of s.lessons) assert.strictEqual(l.cells.reduce((a, b) => a + b, 0), l.items);
  s.levels.forEach((lv, j) => assert.strictEqual(s.lessons.reduce((a, l) => a + l.cells[j], 0), lv.items));
  assert.deepStrictEqual(s.levels.map((l) => l.pct), [35, 40, 25]);
});

test('الدرس الأكثر حصصاً يأخذ أسئلة أكثر', () => {
  const s = X.spec(sample([6, 1, 1, 1]));
  assert.ok(s.lessons[0].items > s.lessons[1].items);
});

test('الخانات تتوزع على الأنواع بعدد الأقسام', () => {
  const d = sample();
  const sl = X.slots(d);
  for (const sec of d.sections) assert.strictEqual(sl.filter((x) => x.type === sec.type).length, sec.count);
});

test('النموذج (ب) نفس الأسئلة بترتيب مختلف', () => {
  const d = sample();
  d.items = X.slots(d).map((x, i) => ({ id: 'i' + i, type: x.type, lesson: x.lesson, level: x.level, text: 'س' + i, choices: x.type === 'mcq' ? ['أ', 'ب', 'ج', 'د'] : [], answer: 'أ', mark: 1 }));
  const a = X.version(d, 1).flat().map((i) => i.id), b = X.version(d, 2).flat().map((i) => i.id);
  assert.deepStrictEqual([...a].sort(), [...b].sort());
  assert.notDeepStrictEqual(a, b);
});
