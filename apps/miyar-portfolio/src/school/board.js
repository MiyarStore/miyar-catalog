// لوحة المدرسة الذكية: الفصول والمنسوبون، رصد الحضور اليومي من جوال المعلم، غياب المعلمين وحصص الانتظار،
// و8 مؤشرات تنحسب تلقائياً (منها إنجاز الخطة التشغيلية وتأخرها من أدواتنا الأخرى).
const { db } = require('../db');
const { todayKSA, ymd, DAY } = require('./track');

db.exec(`CREATE TABLE IF NOT EXISTS school_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, students INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS school_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS school_att (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, day TEXT NOT NULL, class_id INTEGER NOT NULL,
  absent INTEGER NOT NULL DEFAULT 0, late INTEGER NOT NULL DEFAULT 0, names TEXT NOT NULL DEFAULT '', by TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL,
  PRIMARY KEY (school_id, day, class_id))`);
db.exec(`CREATE TABLE IF NOT EXISTS school_staff_abs (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, day TEXT NOT NULL, staff_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'غياب', periods TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL, PRIMARY KEY (school_id, day, staff_id))`);
db.exec(`CREATE TABLE IF NOT EXISTS school_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, day TEXT NOT NULL,
  period INTEGER NOT NULL, absent_id INTEGER NOT NULL, sub_id INTEGER, class_name TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL,
  UNIQUE (school_id, day, period, absent_id))`);
try { db.exec('ALTER TABLE schools ADD COLUMN tv_token TEXT'); } catch {}

const today = () => ymd(todayKSA());
const r1 = (n) => Math.round(n * 10) / 10;
const pct = (a, b) => (b ? r1((a / b) * 100) : null);

const classes = (sid) => db.prepare('SELECT id, name, students FROM school_classes WHERE school_id = ? ORDER BY id').all(sid);
const staff = (sid) => db.prepare('SELECT id, name, role FROM school_staff WHERE school_id = ? ORDER BY id').all(sid);
const attOf = (sid, day) => db.prepare('SELECT * FROM school_att WHERE school_id = ? AND day = ?').all(sid, day);
const attRange = (sid, from, to) => db.prepare('SELECT * FROM school_att WHERE school_id = ? AND day >= ? AND day <= ? ORDER BY day').all(sid, from, to);
const staffAbs = (sid, day) => db.prepare('SELECT * FROM school_staff_abs WHERE school_id = ? AND day = ?').all(sid, day);
const subsOf = (sid, day) => db.prepare('SELECT * FROM school_subs WHERE school_id = ? AND day = ? ORDER BY period').all(sid, day);
const subsRange = (sid, from, to) => db.prepare('SELECT * FROM school_subs WHERE school_id = ? AND day >= ? AND day <= ?').all(sid, from, to);
const periodsOf = (s) => [...new Set(String(s || '').split(/[^0-9٠-٩]+/).map((x) => Number(x.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))).filter((n) => n >= 1 && n <= 8))].sort((a, b) => a - b);

// السبت والجمعة إجازة
const schoolDay = (t) => { const w = new Date(t).getUTCDay(); return w !== 5 && w !== 6; };
const lastSchoolDays = (n, end = todayKSA()) => { const out = []; for (let t = end; out.length < n && t > end - 40 * DAY; t -= DAY) if (schoolDay(t)) out.push(ymd(t)); return out.reverse(); };

function rateOf(rows, cls) {
  const by = new Map(cls.map((c) => [c.id, c]));
  let students = 0, absent = 0, late = 0;
  for (const r of rows) { const c = by.get(r.class_id); if (!c || !c.students) continue; students += c.students; absent += Math.min(r.absent, c.students); late += r.late; }
  return { students, absent, late, rate: students ? r1(100 - (absent / students) * 100) : null, lateRate: students ? pct(late, students) : null };
}

// اقتراح البديل: الحاضر اللي أقل انتظار هذا الأسبوع، وغير مكلّف في نفس الحصة
function suggest(sid, day, period) {
  const absent = new Set(staffAbs(sid, day).map((x) => x.staff_id));
  const week = lastSchoolDays(5, Date.parse(`${day}T00:00:00Z`));
  const load = new Map();
  for (const s of subsRange(sid, week[0], day)) if (s.sub_id) load.set(s.sub_id, (load.get(s.sub_id) || 0) + 1);
  const busy = new Set(subsOf(sid, day).filter((s) => s.period === period && s.sub_id).map((s) => s.sub_id));
  return staff(sid).filter((p) => !absent.has(p.id) && !busy.has(p.id)).map((p) => ({ ...p, load: load.get(p.id) || 0 })).sort((a, b) => a.load - b.load || a.id - b.id).slice(0, 3);
}

// المؤشرات الثمانية لليوم
function indicators(sid, ops, day = today()) {
  const cls = classes(sid); const st = staff(sid);
  const rows = attOf(sid, day);
  const t = rateOf(rows, cls);
  const days = lastSchoolDays(5, Date.parse(`${day}T00:00:00Z`));
  const w = rateOf(attRange(sid, days[0], day), cls);
  const recorded = new Set(rows.map((r) => r.class_id));
  const missing = cls.filter((c) => !recorded.has(c.id));
  const sabs = staffAbs(sid, day);
  const subs = subsOf(sid, day);
  const needed = sabs.reduce((a, x) => a + periodsOf(x.periods).length, 0);
  const covered = subs.filter((s) => s.sub_id).length;
  const st3 = (v, good, watch, lowerBetter = false) => (v == null ? 'none' : lowerBetter ? (v <= good ? 'good' : v <= watch ? 'watch' : 'alert') : (v >= good ? 'good' : v >= watch ? 'watch' : 'alert'));
  const list = [
    { key: 'att', name: 'حضور الطلاب اليوم', value: t.rate, unit: '%', state: st3(t.rate, 95, 90), note: t.students ? `${t.absent} غائب من ${t.students}` : 'ما رُصد أي فصل' },
    { key: 'late', name: 'نسبة التأخر الصباحي', value: t.lateRate, unit: '%', state: st3(t.lateRate, 3, 7, true), note: t.students ? `${t.late} متأخر` : '-' },
    { key: 'rec', name: 'الفصول المرصودة اليوم', value: cls.length ? recorded.size : null, unit: ` من ${cls.length}`, state: !cls.length ? 'none' : missing.length === 0 ? 'good' : missing.length <= 2 ? 'watch' : 'alert', note: missing.length ? `باقي ${missing.length} فصل` : 'كل الفصول' },
    { key: 'week', name: 'حضور الطلاب هذا الأسبوع', value: w.rate, unit: '%', state: st3(w.rate, 95, 90), note: `آخر ${days.length} أيام دراسية` },
    { key: 'staff', name: 'حضور المنسوبين اليوم', value: st.length ? r1(100 - (sabs.length / st.length) * 100) : null, unit: '%', state: st.length ? st3(100 - (sabs.length / st.length) * 100, 95, 90) : 'none', note: `${sabs.length} غائب من ${st.length}` },
    { key: 'subs', name: 'تغطية حصص الانتظار', value: needed ? pct(covered, needed) : (sabs.length ? null : 100), unit: '%', state: !needed ? (sabs.length ? 'watch' : 'good') : covered >= needed ? 'good' : covered / needed >= 0.7 ? 'watch' : 'alert', note: needed ? `${covered} من ${needed} حصة` : (sabs.length ? 'حدد حصص الغائبين' : 'ما فيه انتظار') },
    { key: 'plan', name: 'إنجاز الخطة التشغيلية', value: ops ? ops.progress.pct : null, unit: '%', state: ops ? (ops.late ? 'watch' : 'good') : 'none', note: ops ? `${ops.progress.done} من ${ops.progress.total} إجراء` : 'ابنِ الخطة أولاً' },
    { key: 'lateplan', name: 'إجراءات الخطة المتأخرة', value: ops ? ops.late : null, unit: '', state: ops ? (ops.late === 0 ? 'good' : ops.late <= 5 ? 'watch' : 'alert') : 'none', note: ops ? 'من الخطة التشغيلية' : '-' },
  ];
  return { day, list, missing, classes: cls.map((c) => { const r = rows.find((x) => x.class_id === c.id); return { ...c, rec: !!r, absent: r ? r.absent : null, late: r ? r.late : null, names: r ? r.names : '', by: r ? r.by : '' }; }), staffAbs: sabs.map((x) => ({ ...x, name: (st.find((p) => p.id === x.staff_id) || {}).name || '-', list: periodsOf(x.periods) })), subs: subs.map((s) => ({ ...s, absent_name: (st.find((p) => p.id === s.absent_id) || {}).name || '-', sub_name: (st.find((p) => p.id === s.sub_id) || {}).name || '' })) };
}

// بيانات التقارير
function rangeData(sid, days) {
  const cls = classes(sid);
  const rows = attRange(sid, days[0], days[days.length - 1]);
  const daily = days.map((d) => ({ day: d, ...rateOf(rows.filter((r) => r.day === d), cls), recorded: new Set(rows.filter((r) => r.day === d).map((r) => r.class_id)).size }));
  const perClass = cls.map((c) => {
    const rs = rows.filter((r) => r.class_id === c.id);
    const absent = rs.reduce((a, r) => a + r.absent, 0), late = rs.reduce((a, r) => a + r.late, 0);
    return { ...c, days: rs.length, absent, late, rate: rs.length && c.students ? r1(100 - (absent / (c.students * rs.length)) * 100) : null, missing: days.filter((d) => !rs.some((r) => r.day === d)) };
  });
  const st = staff(sid);
  const subs = subsRange(sid, days[0], days[days.length - 1]);
  const perStaff = st.map((p) => ({ ...p, subs: subs.filter((s) => s.sub_id === p.id).length, absent: db.prepare('SELECT COUNT(*) n FROM school_staff_abs WHERE school_id = ? AND staff_id = ? AND day >= ? AND day <= ?').get(sid, p.id, days[0], days[days.length - 1]).n }));
  return { days, daily, perClass, perStaff, subsTotal: subs.length, subsCovered: subs.filter((s) => s.sub_id).length, total: rateOf(rows, cls) };
}

module.exports = { today, classes, staff, attOf, staffAbs, subsOf, periodsOf, suggest, indicators, rangeData, lastSchoolDays, schoolDay };
