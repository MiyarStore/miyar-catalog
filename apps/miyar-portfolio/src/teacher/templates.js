// قوالب المواد الجاهزة: الدروس والمهارات والتقويم من الكتاب، فيختار المعلم المادة وتتعبى خطته ومهاراته بدون لصق.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'templates');
const DAY = 86400000;
const load = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ id: f.replace(/\.json$/, ''), ...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }));
let cache = null;
const all = () => (cache = cache || load());
const list = () => all().map((t) => ({ id: t.id, name: t.course, stage: t.stage, term: t.term, per: t.periods_per_week, lessons: t.units.reduce((a, u) => a + u.lessons.length, 0) }));

// نحول القالب لبيانات السجل. الأسابيع عندنا متتالية من بداية الدراسة، فأسابيع الإجازة في التقويم تصير أسابيع إجازة،
// وأسبوع اختبارات نهاية الفصل كذلك.
function apply(id, uid) {
  const t = all().find((x) => x.id === id); if (!t) return null;
  const start = Date.parse(`${t.calendar.students_start}T00:00:00Z`);
  const weekNo = (d) => Math.floor((Date.parse(`${d}T00:00:00Z`) - start) / (7 * DAY)) + 1;
  const last = t.weeks[t.weeks.length - 1];
  const total = weekNo(last.start);
  const used = new Set(t.weeks.map((w) => weekNo(w.start)));
  const off = [];
  for (let w = 1; w <= total; w++) if (!used.has(w)) off.push(w);
  const examWeek = Object.entries(t.special_weeks || {}).find(([, v]) => /اختبارات نهاية/.test(v));
  if (examWeek) { const w = t.weeks.find((x) => x.week === Number(examWeek[0])); if (w) off.push(weekNo(w.start)); }
  const skills = []; const lessons = [];
  for (const u of t.units) {
    const ids = u.skills.map((name) => { const s = { id: uid(), name }; skills.push(s); return s.id; });
    const unit = `الوحدة ${u.unit}: ${u.title}`;
    for (const l of u.lessons) lessons.push({ id: uid(), unit, title: l.project ? `${l.title} (${u.title})` : l.title, periods: l.periods, skill: ids[(l.skills || [])[0] - 1] || '', page: l.page, done: false, done_at: null });
  }
  if (t.end_of_part) lessons.push({ id: uid(), unit: lessons.length ? lessons[lessons.length - 1].unit : '', title: t.end_of_part.title, periods: t.end_of_part.periods || 1, skill: '', done: false, done_at: null });
  return { subject: t.course, stage: t.stage, term: (t.term || '').replace(/\s*\d{4}هـ?$/, ''), start: t.calendar.students_start, weeks: Math.min(total, 24), off: [...new Set(off)].sort((a, b) => a - b), skills, lessons, template: t.id, per_hint: t.periods_per_week };
}
// دروس القالب لصانع الاختبارات: مع أهداف الوحدة ونص المهارة لكل درس
function examLessons(id, uid) {
  const t = all().find((x) => x.id === id); if (!t) return null;
  const lessons = [];
  for (const u of t.units) {
    const unit = `الوحدة ${u.unit}: ${u.title}`;
    for (const l of u.lessons) {
      if (l.project) continue;
      const sk = (l.skills || []).map((n) => u.skills[n - 1]).filter(Boolean);
      lessons.push({ id: uid(), unit, title: l.title, periods: l.periods, skill: '', skill_name: sk.join('، '), objectives: (u.objectives || []).slice(0, 10), page: l.page });
    }
  }
  return { subject: t.course, stage: t.stage, term: (t.term || '').replace(/\s*\d{4}هـ?$/, ''), lessons };
}
// أهداف الوحدة من الكتاب لدرس معين (للتحضير)
function unitObjectives(id, unitLabel) {
  const t = all().find((x) => x.id === id); if (!t) return [];
  const u = t.units.find((x) => `الوحدة ${x.unit}: ${x.title}` === unitLabel);
  return u ? (u.objectives || []).slice(0, 10) : [];
}
module.exports = { list, apply, examLessons, unitObjectives };
