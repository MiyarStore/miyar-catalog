// صانع الاختبارات: يبني جدول المواصفات من الدروس (وزن الدرس بعدد حصصه) ومستويات المعرفة والتطبيق والاستدلال،
// ويوزع أسئلة كل قسم (اختيار من متعدد، صح وخطأ، أكمل، صل، قصير، مقالي) على خلايا الجدول، ثم يحفظ الاختبار.
const crypto = require('crypto');
const { db } = require('../db');

db.exec(`CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);

const uid = () => crypto.randomBytes(4).toString('hex');
const clip = (v, n) => String(v ?? '').slice(0, n);
const int = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : def; };
const numf = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(Math.max(Math.round(n * 4) / 4, lo), hi) : def; };

// مستويات الأسئلة (نفس مستويات نافس والاختبارات الدولية)
const LEVELS = [
  { key: 'know', name: 'المعرفة', desc: 'تذكّر الحقائق والمفاهيم والمصطلحات والتعرف عليها' },
  { key: 'apply', name: 'التطبيق', desc: 'استخدام المعرفة في مواقف مألوفة وحل مسائل وأسئلة مباشرة' },
  { key: 'reason', name: 'الاستدلال', desc: 'التحليل والتفسير والتعليل والاستنتاج وحل مشكلات غير مألوفة' },
];
// أنواع الأسئلة بالترتيب المعتاد في ورقة الاختبار
const TYPES = {
  mcq: { name: 'اختيار من متعدد', head: 'اختر الإجابة الصحيحة فيما يلي', obj: true },
  tf: { name: 'صح وخطأ', head: 'ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة', obj: true },
  fill: { name: 'أكمل الفراغ', head: 'أكمل الفراغات التالية بما يناسبها', obj: true },
  match: { name: 'المزاوجة (صل)', head: 'اختر من العمود (ب) ما يناسب العمود (أ) واكتب رقمه في المكان المخصص', obj: true },
  short: { name: 'إجابة قصيرة', head: 'أجب عما يلي بإجابة مختصرة', obj: false },
  essay: { name: 'مقالي', head: 'أجب عن الأسئلة التالية', obj: false },
};
const TYPE_ORDER = ['mcq', 'tf', 'fill', 'match', 'short', 'essay'];
// أي نوع يناسب أي مستوى (الأول أنسب)
const PREF = {
  know: ['tf', 'match', 'fill', 'mcq', 'short', 'essay'],
  apply: ['mcq', 'fill', 'short', 'match', 'tf', 'essay'],
  reason: ['essay', 'short', 'mcq', 'fill', 'tf', 'match'],
};
const KINDS = { quiz: 'اختبار قصير', diag: 'اختبار تشخيصي (قبلي)', p1: 'اختبار الفترة الأولى', p2: 'اختبار الفترة الثانية', final: 'اختبار نهاية الفصل الدراسي', hw: 'ورقة عمل' };
// إعدادات افتراضية حسب نوع الاختبار (يعدلها المعلم)
const PRESETS = {
  quiz: { duration: 20, levels: { know: 40, apply: 40, reason: 20 }, sections: { mcq: [5, 1], tf: [5, 1] } },
  diag: { duration: 30, levels: { know: 50, apply: 35, reason: 15 }, sections: { mcq: [10, 1], tf: [5, 1], fill: [5, 1] } },
  p1: { duration: 45, levels: { know: 40, apply: 40, reason: 20 }, sections: { mcq: [8, 1], tf: [6, 1], match: [4, 1], short: [2, 2] } },
  p2: { duration: 45, levels: { know: 40, apply: 40, reason: 20 }, sections: { mcq: [8, 1], tf: [6, 1], match: [4, 1], short: [2, 2] } },
  final: { duration: 120, levels: { know: 35, apply: 40, reason: 25 }, sections: { mcq: [15, 1], tf: [10, 1], match: [5, 1], short: [4, 2], essay: [2, 3] } },
  hw: { duration: 0, levels: { know: 30, apply: 50, reason: 20 }, sections: { mcq: [4, 1], fill: [4, 1], short: [3, 2] } },
};
const MAX_ITEMS = 60;

function preset(kind) {
  const p = PRESETS[kind] || PRESETS.quiz;
  return { duration: p.duration, levels: { ...p.levels }, sections: TYPE_ORDER.filter((t) => p.sections[t]).map((t) => ({ type: t, count: p.sections[t][0], mark: p.sections[t][1] })) };
}

function blank(b = {}, u = {}) {
  const kind = KINDS[b.kind] ? b.kind : 'quiz';
  const p = preset(kind);
  return {
    kind, title: '', subject: clip(b.subject || u.subject, 60), grade: clip(b.grade, 60), stage: clip(b.stage || u.stage, 120), term: clip(b.term || 'الفصل الدراسي الأول', 40), year: clip(b.year || u.year, 20),
    duration: p.duration, date: '', pages: '', source: { type: 'manual', id: '' }, lessons: [], selected: [], levels: p.levels, sections: p.sections, items: [],
    options: { versions: 1, key: true, spec: true, bubble: false, names: true }, rec_id: null, notes: '',
  };
}

function cleanLesson(l) {
  return { id: clip(l.id, 12) || uid(), unit: clip(l.unit, 120), title: clip(l.title, 160).trim(), periods: int(l.periods, 1, 10, 1), skill: clip(l.skill, 12), skill_name: clip(l.skill_name, 160), objectives: (Array.isArray(l.objectives) ? l.objectives : []).slice(0, 12).map((x) => clip(x, 200)), content: clip(l.content, 6000) };
}
function cleanItem(it, lessonIds) {
  const type = TYPES[it.type] ? it.type : 'mcq';
  return {
    id: clip(it.id, 12) || uid(), type, lesson: lessonIds.has(it.lesson) ? it.lesson : '', level: LEVELS.some((l) => l.key === it.level) ? it.level : 'know',
    text: clip(it.text, 800), choices: type === 'mcq' ? (Array.isArray(it.choices) ? it.choices : []).slice(0, 5).map((c) => clip(c, 240)) : [],
    answer: clip(it.answer, 1200), mark: numf(it.mark, 0.25, 20, 1),
  };
}
function clean(d) {
  const o = blank({ kind: d.kind });
  for (const k of ['title', 'subject', 'grade', 'stage', 'term', 'year', 'date', 'pages', 'notes']) o[k] = clip(d[k], k === 'notes' ? 600 : k === 'stage' ? 120 : 80).trim();
  o.duration = int(d.duration, 0, 300, o.duration);
  o.source = { type: ['manual', 'template', 'record'].includes(d.source && d.source.type) ? d.source.type : 'manual', id: clip(d.source && d.source.id, 40) };
  o.lessons = (Array.isArray(d.lessons) ? d.lessons : []).slice(0, 120).map(cleanLesson).filter((l) => l.title);
  const ids = new Set(o.lessons.map((l) => l.id));
  o.selected = (Array.isArray(d.selected) ? d.selected : []).filter((x) => ids.has(x));
  const lv = d.levels || {};
  o.levels = Object.fromEntries(LEVELS.map((l) => [l.key, int(lv[l.key], 0, 100, 0)]));
  if (!Object.values(o.levels).some(Boolean)) o.levels = { know: 40, apply: 40, reason: 20 };
  const seen = new Set();
  o.sections = (Array.isArray(d.sections) ? d.sections : []).filter((s) => TYPES[s.type] && !seen.has(s.type) && seen.add(s.type))
    .map((s) => ({ type: s.type, count: int(s.count, 0, 40, 0), mark: numf(s.mark, 0.25, 20, 1) })).sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  o.items = (Array.isArray(d.items) ? d.items : []).slice(0, MAX_ITEMS).map((it) => cleanItem(it, ids));
  const op = d.options || {};
  o.options = { versions: op.versions === 2 || op.versions === '2' ? 2 : 1, key: op.key !== false, spec: op.spec !== false, bubble: !!op.bubble, names: op.names !== false };
  o.rec_id = Number(d.rec_id) || null;
  return o;
}

// ---------- جدول المواصفات ----------
// توزيع عدد صحيح على أوزان بطريقة أكبر الباقي (المجموع يطلع مضبوط)
function apportion(total, weights) {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (!sum || !total) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return out;
}
const chosen = (d) => { const s = new Set(d.selected); const l = d.lessons.filter((x) => s.has(x.id)); return l.length ? l : d.lessons; };

function spec(d) {
  const lessons = chosen(d);
  const totalP = lessons.reduce((a, l) => a + l.periods, 0) || 1;
  const nItems = Math.min(d.sections.reduce((a, s) => a + s.count, 0), MAX_ITEMS);
  const marks = d.sections.reduce((a, s) => a + s.count * s.mark, 0);
  const lvW = LEVELS.map((l) => d.levels[l.key] || 0);
  const lvSum = lvW.reduce((a, b) => a + b, 0) || 1;
  // عدد الأسئلة لكل درس، ثم لكل مستوى داخل الدرس، مع ضبط مجموع كل مستوى على مستوى الاختبار
  const perLesson = apportion(nItems, lessons.map((l) => l.periods));
  const perLevel = apportion(nItems, lvW);
  const cells = lessons.map((l, i) => apportion(perLesson[i], lvW));
  // تصحيح المجاميع العمودية لتطابق نسب المستويات: ننقل من الصف الأبعد عن نصيبه المثالي
  const ideal = lessons.map((_, i) => lvW.map((w) => (perLesson[i] * w) / lvSum));
  for (let guard = 0; guard < 400; guard++) {
    const col = LEVELS.map((_, j) => cells.reduce((a, r) => a + r[j], 0));
    const over = col.findIndex((c, j) => c > perLevel[j]); const under = col.findIndex((c, j) => c < perLevel[j]);
    if (over < 0 || under < 0) break;
    let best = -1, score = -Infinity;
    cells.forEach((r, i) => { if (r[over] <= 0) return; const sc = (r[over] - ideal[i][over]) - (r[under] - ideal[i][under]); if (sc > score) { score = sc; best = i; } });
    if (best < 0) break;
    cells[best][over]--; cells[best][under]++;
  }
  return {
    lessons: lessons.map((l, i) => ({ id: l.id, unit: l.unit, title: l.title, periods: l.periods, weight: Math.round((l.periods / totalP) * 1000) / 10, items: perLesson[i], cells: cells[i] })),
    levels: LEVELS.map((l, j) => ({ ...l, pct: Math.round(((lvW[j] || 0) / lvSum) * 100), items: cells.reduce((a, r) => a + r[j], 0) })),
    items: nItems, marks, periods: totalP,
  };
}

// خانات الأسئلة: كل خانة فيها نوع ودرس ومستوى، والأنواع تتوزع على المستويات الأنسب لها
function slots(d) {
  const sp = spec(d);
  const pool = [];
  sp.lessons.forEach((l) => l.cells.forEach((n, j) => { for (let k = 0; k < n; k++) pool.push({ lesson: l.id, level: LEVELS[j].key }); }));
  // ترتيب الأنواع: الأصعب تخصيصاً أولاً (المقالي والقصير يحتاجون استدلال وتطبيق)
  const order = ['essay', 'short', 'match', 'tf', 'fill', 'mcq'];
  const out = [];
  let budget = MAX_ITEMS;
  for (const type of order) {
    const sec = d.sections.find((s) => s.type === type); if (!sec || !sec.count) continue;
    for (let k = 0; k < sec.count && pool.length && budget > 0; k++) {
      // أفضل خانة: المستوى الأنسب للنوع، ومن درس ما أخذ من هذا النوع كثير
      const used = {}; out.filter((o) => o.type === type).forEach((o) => { used[o.lesson] = (used[o.lesson] || 0) + 1; });
      let best = 0, bestScore = Infinity;
      pool.forEach((p, i) => { const s = PREF[p.level].indexOf(type) * 10 + (used[p.lesson] || 0); if (s < bestScore) { bestScore = s; best = i; } });
      const [p] = pool.splice(best, 1);
      out.push({ type, lesson: p.lesson, level: p.level, mark: sec.mark });
      budget--;
    }
  }
  // ترتيب الورقة: حسب النوع ثم حسب ترتيب الدروس ثم المستوى (من السهل للصعب)
  const lo = new Map(sp.lessons.map((l, i) => [l.id, i]));
  const lvo = { know: 0, apply: 1, reason: 2 };
  out.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || lvo[a.level] - lvo[b.level] || lo.get(a.lesson) - lo.get(b.lesson));
  return out;
}

// ---------- النموذج (ب) ----------
// خلط ثابت (نفس الترتيب كل مرة) لترتيب الفقرات داخل كل سؤال وترتيب الخيارات
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function version(d, v, seed = 7) {
  const groups = TYPE_ORDER.map((t) => d.items.filter((it) => it.type === t)).filter((g) => g.length);
  if (v === 1) return groups;
  const rnd = seeded(seed * 31 + d.items.length);
  return groups.map((g) => shuffle(g, rnd).map((it) => (it.type === 'mcq' && it.choices.length > 1 ? { ...it, choices: shuffle(it.choices, rnd) } : it)));
}
// العمود (ب) في المزاوجة يتخلط دائماً، ونضيف بديل زائد إذا كتب المعلم
function matchColumn(items, seed = 3) { return shuffle(items.map((it, i) => ({ i, text: it.answer })), seeded(seed + items.length)); }

const total = (d) => d.items.reduce((a, it) => a + it.mark, 0);
const titleOf = (d) => d.title || `${KINDS[d.kind]}${d.subject ? ` - ${d.subject}` : ''}`;
const ready = (d) => d.items.filter((it) => it.text.trim()).length;

// ---------- التخزين ----------
const row = (r) => (r ? { id: r.id, ...JSON.parse(r.data), created_at: r.created_at, updated_at: r.updated_at } : null);
const list = (userId) => db.prepare('SELECT * FROM exams WHERE user_id = ? ORDER BY updated_at DESC').all(userId).map(row);
const get = (userId, id) => row(db.prepare('SELECT * FROM exams WHERE id = ? AND user_id = ?').get(Number(id), userId));
function save(userId, id, d) {
  const data = JSON.stringify(clean(d)); const now = Date.now();
  if (id) { db.prepare('UPDATE exams SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(data, now, id, userId); return get(userId, id); }
  const info = db.prepare('INSERT INTO exams (user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?)').run(userId, data, now, now);
  return get(userId, info.lastInsertRowid);
}
const remove = (userId, id) => db.prepare('DELETE FROM exams WHERE id = ? AND user_id = ?').run(Number(id), userId);

// تحويل الاختبار لاختبار داخل سجل المادة (عشان يترصد ويتحلل بالمهارات)
function toRecordTest(d, rec) {
  const skillOf = new Map(d.lessons.map((l) => [l.id, l.skill]));
  const recSkills = new Set(rec.skills.map((s) => s.id));
  const recLessons = new Map(rec.lessons.map((l) => [l.title.trim(), l.skill]));
  const lessonTitle = new Map(d.lessons.map((l) => [l.id, l.title.trim()]));
  const kind = { quiz: 'quiz', diag: 'diag', p1: 'p1', p2: 'p2', final: 'final', hw: 'quiz' }[d.kind] || 'quiz';
  const ordered = version(d, 1).flat();
  return {
    id: uid(), kind, title: titleOf(d), date: d.date || '',
    items: ordered.slice(0, 60).map((it) => {
      let skill = skillOf.get(it.lesson) || '';
      if (!recSkills.has(skill)) skill = recLessons.get(lessonTitle.get(it.lesson)) || '';
      return { skill: recSkills.has(skill) ? skill : '', max: it.mark, text: it.text, choices: it.type === 'mcq' ? it.choices : it.type === 'tf' ? ['صح', 'خطأ'] : [], answer: it.answer.slice(0, 200) };
    }),
    scores: {}, absent: [],
  };
}

module.exports = { LEVELS, TYPES, TYPE_ORDER, KINDS, PRESETS, MAX_ITEMS, preset, blank, clean, spec, slots, version, matchColumn, total, titleOf, ready, list, get, save, remove, toRecordTest, apportion, uid };
