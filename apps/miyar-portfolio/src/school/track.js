// متابعة تنفيذ الخطط: مواعيد الاستحقاق، أيام التأخير، التوزيع التلقائي للمواعيد، وتقرير الإنجاز الأسبوعي والشهري.
// الإجراء يُعرف بمرجع {k, i, j}: k = plan (خطة التحسين، rows[i].procedures[j]) أو nafis (خطة نافس، rows[i].actions[j]).
const DAY = 86400000;
const KSA = 3 * 3600000;
const todayKSA = () => Math.floor((Date.now() + KSA) / DAY) * DAY;
const parseDay = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? Date.parse(`${s}T00:00:00Z`) : null);
const ymd = (t) => new Date(t).toISOString().slice(0, 10);

function lateDays(p, now = todayKSA()) {
  if (!p || p.done) return 0;
  const d = parseDay(p.due);
  if (d == null) return 0;
  const n = Math.round((now - d) / DAY);
  return n > 0 ? n : 0;
}
// حالة الإجراء: منجز، متأخر، قريب (خلال 7 أيام)، بدون موعد، في الموعد
function stateOf(p, now = todayKSA()) {
  if (p.done) return 'done';
  const d = parseDay(p.due);
  if (d == null) return 'nodate';
  if (d < now) return 'late';
  if (d - now <= 7 * DAY) return 'soon';
  return 'ontrack';
}

// الوصول للإجراء من المرجع، مع تحويل النص القديم لكائن
function resolve({ plan, nafis }, ref) {
  if (!ref || typeof ref !== 'object') return null;
  const i = Number(ref.i), j = Number(ref.j);
  if (ref.k === 'plan' && plan) {
    const row = plan.rows[i]; if (!row || !row.procedures || j >= row.procedures.length || j < 0) return null;
    if (typeof row.procedures[j] === 'string') row.procedures[j] = { text: row.procedures[j], when: '', done: false };
    return row.procedures[j];
  }
  if (ref.k === 'nafis' && nafis) {
    const row = nafis.rows[i]; if (!row || !row.actions || j >= row.actions.length || j < 0) return null;
    return row.actions[j];
  }
  return null;
}

// توزيع المواعيد بالتساوي على مدة التنفيذ حسب ترتيب الإجراءات في كل صف.
// الإجراءات اللي توقيتها «الأسبوعان الأول والثاني» أو «طوال الفصل» تاخذ موعداً مناسباً لها.
function schedule({ plan, nafis }, start, end, force = false) {
  const a = parseDay(start), b = parseDay(end);
  if (a == null || b == null || b <= a) return 0;
  const span = b - a;
  let n = 0;
  const put = (list) => list.forEach((p, j) => {
    if (!p || typeof p !== 'object' || (p.due && !force)) return;
    const w = String(p.when || '');
    let t;
    if (/الأسبوعان الأول|الأسبوع الأول|بداية/.test(w)) t = a + Math.min(14 * DAY, span / 4);
    else if (/الشهر الأول/.test(w)) t = a + Math.min(30 * DAY, span / 3);
    else if (/طوال|كل فصل|نهاية|شهري|أسبوعي/.test(w)) t = b;
    else t = a + (span * (j + 1)) / (list.length + 1);
    p.due = ymd(Math.round(t / DAY) * DAY); n++;
  });
  if (plan) for (const r of plan.rows) { r.procedures = (r.procedures || []).map((p) => (typeof p === 'string' ? { text: p, when: '', done: false } : p)); put(r.procedures); }
  if (nafis) for (const r of nafis.rows) put(r.actions || []);
  return n;
}

// كل الإجراءات المتابعة في قائمة واحدة، مجمعة حسب برامج الخطة التشغيلية
function items(ops, now = todayKSA()) {
  const out = [];
  for (const pg of ops.programs) {
    for (const x of pg.procedures) {
      if (!x.refs || !x.refs.length) continue;
      out.push({ program: pg.name, key: pg.key, text: x.text, when: x.when, due: x.due || '', done: !!x.done, done_at: x.done_at || null, done_name: x.done_name || x.assignee_name || '', assignee_name: x.assignee_name || '', note: x.note || '', late: lateDays(x, now), state: stateOf(x, now), refs: x.refs });
    }
  }
  return out;
}

// تقرير الإنجاز لفترة (أسبوع أو شهر) حتى اليوم
function periodReport(ops, period = 'week', now = todayKSA()) {
  const days = period === 'month' ? 30 : 7;
  const from = now - (days - 1) * DAY;
  const all = items(ops, now);
  const done = all.filter((x) => x.done);
  const inPeriod = done.filter((x) => x.done_at && x.done_at + KSA >= from);
  const late = all.filter((x) => x.state === 'late').sort((a, b) => b.late - a.late);
  const soon = all.filter((x) => x.state === 'soon').sort((a, b) => parseDay(a.due) - parseDay(b.due));
  const programs = ops.programs.map((pg) => {
    const xs = all.filter((x) => x.key === pg.key);
    const d = xs.filter((x) => x.done).length;
    return { name: pg.name, type: pg.type, total: xs.length, done: d, pct: xs.length ? Math.round((d / xs.length) * 100) : 0, late: xs.filter((x) => x.state === 'late').length };
  }).filter((p) => p.total);
  // الإنجاز يوماً بيوم في الفترة
  const daily = [];
  for (let t = from; t <= now; t += DAY) daily.push({ day: ymd(t), n: inPeriod.filter((x) => Math.floor((x.done_at + KSA) / DAY) * DAY === t).length });
  const people = {};
  for (const x of inPeriod) { const k = x.done_name || 'بدون اسم'; people[k] = (people[k] || 0) + 1; }
  return {
    period, days, from: ymd(from), to: ymd(now),
    total: all.length, done: done.length, pct: all.length ? Math.round((done.length / all.length) * 100) : 0,
    inPeriod: inPeriod.length, lateCount: late.length, nodate: all.filter((x) => x.state === 'nodate').length,
    late: late.slice(0, 30), soon: soon.slice(0, 20), programs, daily,
    people: Object.entries(people).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    recent: inPeriod.sort((a, b) => b.done_at - a.done_at).slice(0, 30),
  };
}

module.exports = { DAY, todayKSA, parseDay, ymd, lateDays, stateOf, resolve, schedule, items, periodReport };
