// «مساعد المعلم»: سجل المادة لكل شعبة. المعلم يدخل بياناته مرة وحدة (الطلاب، الجدول، الدروس، المهارات)،
// والأداة تبني الخطة الفصلية والأسبوعية، وتحلل الاختبارات، وتصنف الطلاب، وتبني الخطط العلاجية والإثرائية،
// وتقارن القبلي بالبعدي، وتجهز رسائل أولياء الأمور وتقرير سير المادة.
const crypto = require('crypto');
const { db } = require('../db');
const CAL = require('../calendar');
const PREP = require('./prep');

db.exec(`CREATE TABLE IF NOT EXISTS teacher_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL, share_token TEXT UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);

const DAY = 86400000;
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const KINDS = { diag: 'الاختبار التشخيصي (القبلي)', p1: 'اختبار الفترة الأولى', p2: 'اختبار الفترة الثانية', final: 'الاختبار الختامي', quiz: 'اختبار قصير' };
const KIND_ORDER = ['diag', 'quiz', 'p1', 'p2', 'final'];
// فئات الطلاب حسب نسبة الإتقان
const GROUPS = [
  { key: 'mastery', name: 'متقن', min: 80, color: '#15803d', plan: 'إثرائية' },
  { key: 'progress', name: 'في طور الإتقان', min: 50, color: '#b45309', plan: 'علاجية (دعم موجّه)' },
  { key: 'support', name: 'يحتاج دعماً مكثفاً', min: 0, color: '#b91c1c', plan: 'علاجية مكثفة وخطة دعم فردي' },
];
const groupOf = (p) => (p == null ? null : GROUPS.find((g) => p >= g.min));
const SKILL_OK = 70;
const ATT = { a: 'غائب', l: 'متأخر', e: 'مستأذن' };
const ABSENT_ALERT = 3; // 3 غيابات متصلة (أو 5 متفرقة) = تحويل للموجه حسب قواعد السلوك والمواظبة // المهارة متقنة على مستوى الشعبة إذا متوسطها 70% فأكثر

const clip = (v, n) => String(v ?? '').slice(0, n);
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n) ? n : null; };
const r1 = (n) => Math.round(n * 10) / 10;
const uid = () => crypto.randomBytes(4).toString('hex');
const parseDay = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? Date.parse(`${s}T00:00:00Z`) : null);
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const todayKSA = () => Math.floor((Date.now() + 3 * 3600000) / DAY) * DAY;
// بداية الأسبوع الدراسي: الأحد
const sundayOf = (t) => t - ((new Date(t).getUTCDay()) * DAY);

// ---------- تنظيف البيانات ----------
function lines(text) { return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean); }
// الأسماء من كشف نور: ناخذ أطول جزء عربي في السطر (الكشف فيه أرقام وهويات)
function parseStudents(text) {
  return lines(text).slice(0, 60).map((l) => {
    const parts = l.split(/\t|,|،|\|/).map((x) => x.trim()).filter((x) => /[؀-ۿa-zA-Z]/.test(x) && !/^\d+$/.test(x));
    const name = (parts.sort((a, b) => b.length - a.length)[0] || l).replace(/^\d+[\s.)-]*/, '').trim();
    const phone = (l.match(/(?:\+?966|0)5\d{8}/) || [''])[0];
    return { id: uid(), name: clip(name, 80), phone, note: '' };
  }).filter((s) => s.name.length > 1);
}
// الدروس: سطر يبدأ بـ«الوحدة» أو «الفصل» عنوان وحدة، والباقي دروس. «الدرس، 2» يعني حصتين.
function parseLessons(text) {
  let unit = '';
  const out = [];
  for (const l of lines(text).slice(0, 200)) {
    if (/^(الوحدة|وحدة|الفصل|الباب|unit)(?=[\s:：،-]|$)/i.test(l)) { unit = clip(l, 120); continue; }
    const m = l.match(/^(.*?)[\s]*[,،|\t]\s*(\d+)\s*$/);
    const title = clip((m ? m[1] : l).replace(/^\d+[\s.)-]+/, ''), 160);
    out.push({ id: uid(), unit, title, periods: m ? Math.min(Math.max(Number(m[2]), 1), 10) : 1, done: false, done_at: null });
  }
  return out;
}
function parseSkills(text) { return lines(text).slice(0, 40).map((l) => ({ id: uid(), name: clip(l.replace(/^\d+[\s.)-]+/, ''), 160) })); }

function blank(b = {}, user = {}) {
  return {
    subject: clip(b.subject || user.subject, 60), grade: clip(b.grade, 40), section: clip(b.section, 20), stage: clip(b.stage || user.stage, 40),
    term: clip(b.term || 'الفصل الدراسي الأول', 40), year: clip(b.year || user.year || '1448 هـ', 20),
    region: CAL.regionKey(b.region), extra: [], start: parseDay(b.start) != null ? b.start : '', weeks: Math.min(Math.max(Number(b.weeks) || 18, 4), 24), off: [],
    slots: [], students: [], lessons: [], skills: [], tests: [], remedial_done: {}, messages: [], template: '', per_hint: 0, preps: {}, att: {}, beh: [],
  };
}
// تحقق من البيانات اللي ترسلها الواجهة (كل الحفظ يمر من هنا)
function clean(d) {
  const o = blank();
  for (const k of ['subject', 'grade', 'section', 'stage', 'term', 'year']) o[k] = clip(d[k], 60).trim();
  o.region = CAL.regionKey(d.region);
  o.extra = [...new Set((Array.isArray(d.extra) ? d.extra : []).filter((x) => parseDay(x) != null))].sort().slice(0, 30);
  o.start = parseDay(d.start) != null ? d.start : '';
  o.template = clip(d.template, 40); o.per_hint = Math.min(Math.max(Number(d.per_hint) || 0, 0), 12);
  o.weeks = Math.min(Math.max(Number(d.weeks) || 18, 4), 24);
  o.off = [...new Set((Array.isArray(d.off) ? d.off : []).map(Number).filter((w) => w >= 1 && w <= o.weeks))].sort((a, b) => a - b);
  o.slots = (Array.isArray(d.slots) ? d.slots : []).map((s) => ({ day: Number(s.day), period: Number(s.period) })).filter((s) => s.day >= 0 && s.day <= 4 && s.period >= 1 && s.period <= 8)
    .filter((s, i, a) => a.findIndex((x) => x.day === s.day && x.period === s.period) === i).sort((a, b) => a.day - b.day || a.period - b.period).slice(0, 20);
  o.students = (Array.isArray(d.students) ? d.students : []).slice(0, 60).map((s) => ({ id: clip(s.id, 12) || uid(), name: clip(s.name, 80).trim(), phone: clip(s.phone, 16).replace(/[^\d+]/g, ''), note: clip(s.note, 300) })).filter((s) => s.name);
  o.lessons = (Array.isArray(d.lessons) ? d.lessons : []).slice(0, 200).map((l) => ({ id: clip(l.id, 12) || uid(), unit: clip(l.unit, 120), title: clip(l.title, 160).trim(), periods: Math.min(Math.max(Number(l.periods) || 1, 1), 10), skill: clip(l.skill, 12), page: Number(l.page) || null, done: !!l.done, done_at: l.done ? Number(l.done_at) || Date.now() : null })).filter((l) => l.title);
  o.skills = (Array.isArray(d.skills) ? d.skills : []).slice(0, 40).map((s) => ({ id: clip(s.id, 12) || uid(), name: clip(s.name, 160).trim() })).filter((s) => s.name);
  const sids = new Set(o.students.map((s) => s.id));
  const kids = new Set(o.skills.map((s) => s.id));
  o.tests = (Array.isArray(d.tests) ? d.tests : []).slice(0, 20).map((t) => {
    const items = (Array.isArray(t.items) ? t.items : []).slice(0, 60).map((it) => ({
      skill: kids.has(it.skill) ? it.skill : '', max: Math.min(Math.max(num(it.max) || 1, 0.25), 100), text: clip(it.text, 600),
      choices: (Array.isArray(it.choices) ? it.choices : []).slice(0, 5).map((c) => clip(c, 200)), answer: clip(it.answer, 200),
    }));
    const scores = {};
    for (const [sid, arr] of Object.entries(t.scores || {})) {
      if (!sids.has(sid) || !Array.isArray(arr)) continue;
      scores[sid] = items.map((it, i) => { const v = num(arr[i]); return v == null ? null : Math.min(Math.max(v, 0), it.max); });
    }
    return { id: clip(t.id, 12) || uid(), kind: KINDS[t.kind] ? t.kind : 'quiz', title: clip(t.title, 120).trim() || KINDS[t.kind] || 'اختبار', date: parseDay(t.date) != null ? t.date : '', items, scores, absent: (Array.isArray(t.absent) ? t.absent : []).filter((x) => sids.has(x)) };
  });
  o.remedial_done = {};
  for (const [k, v] of Object.entries(d.remedial_done || {})) if (/^[\w:-]{1,60}$/.test(k) && v) o.remedial_done[k] = Number(v) || Date.now();
  o.preps = PREP.cleanPreps(d.preps, new Set(o.lessons.map((l) => l.id)));
  // الحضور: لكل تاريخ، الطلاب غير الحاضرين فقط (a غائب، l متأخر، e مستأذن)
  o.att = {};
  for (const [ds, row] of Object.entries(d.att || {}).slice(-220)) {
    if (parseDay(ds) == null || !row || typeof row !== 'object') continue;
    const r = {}; for (const [sid, c] of Object.entries(row)) if (sids.has(sid) && ATT[c]) r[sid] = c;
    o.att[ds] = r;
  }
  o.beh = (Array.isArray(d.beh) ? d.beh : []).slice(-1500).filter((b) => b && sids.has(b.s) && (b.t === 'p' || b.t === 'n')).map((b) => ({ id: clip(b.id, 12) || uid(), s: b.s, t: b.t, date: parseDay(b.date) != null ? b.date : ymd(todayKSA()), note: clip(b.note, 200).trim() }));
  o.messages = (Array.isArray(d.messages) ? d.messages : []).slice(-200).map((m) => ({ student: clip(m.student, 12), kind: clip(m.kind, 20), at: Number(m.at) || Date.now() }));
  return o;
}

// ---------- الخطة الفصلية والأسبوعية ----------
// نوزع الدروس على الأسابيع حسب عدد حصص الشعبة في الأسبوع. الأسبوع الأول فيه التهيئة والتشخيصي،
// وبعد كل اختبار مرصود نحجز حصة علاجية في الأسبوع اللي بعده (تحديث الخطة حسب نتائج القياس).
// لو المعلم اختار تقويمه (العام أو الغربي) ناخذ البداية والأسابيع والإجازات من التقويم المعتمد مباشرة،
// ونتجاوز الحصص اللي تطيح في يوم إجازة (مثل اليوم الوطني أو الإجازات الإضافية).
function calendarOf(d) {
  if (!d.region) return null;
  const ws = CAL.weeks(d.region, d.term, undefined, d.extra || []);
  return ws.length ? { ws, sum: CAL.summary(d.region, d.term, undefined, d.extra || []) } : null;
}
function plan(d) {
  const cal = calendarOf(d);
  if (cal) d = { ...d, start: cal.sum.start, weeks: cal.ws.length, off: [...new Set([...cal.sum.off, ...d.off.filter((w) => w <= cal.ws.length)])].sort((a, b) => a - b) };
  const per = d.slots.length || 4;
  const start = parseDay(d.start);
  const s0 = start != null ? sundayOf(start) : null;
  const weekOfDate = (ds) => { const t = parseDay(ds); if (t == null || s0 == null) return null; const w = Math.floor((t - s0) / (7 * DAY)) + 1; return w >= 1 && w <= d.weeks ? w : null; };
  const reserve = {};
  const add = (w, item) => { if (!w) return; (reserve[w] = reserve[w] || []).push(item); };
  add(1, { type: 'diag', title: 'التهيئة وتطبيق الاختبار التشخيصي', periods: 1 });
  for (const t of d.tests) {
    const a = analyze(d, t);
    if (!a.n) continue;
    const w = weekOfDate(t.date);
    const next = w ? w + 1 : null;
    const weak = a.skills.filter((s) => s.pct != null && s.pct < SKILL_OK).map((s) => s.name);
    if (next && next <= d.weeks) add(next, { type: 'remedial', title: `حصة علاجية بعد ${t.title}${weak.length ? `: ${weak.slice(0, 3).join('، ')}` : ''}`, periods: 1, test: t.id });
  }
  const weeks = [];
  const queue = d.lessons.map((l) => ({ ...l, left: l.periods }));
  let qi = 0;
  for (let w = 1; w <= d.weeks; w++) {
    const from = s0 != null ? s0 + (w - 1) * 7 * DAY : null;
    const cw = cal ? cal.ws[w - 1] : null;
    const closed = (day) => (cw ? !cw.days[day].school : false);
    const holidays = cw ? [...new Set(cw.days.filter((x) => !x.school && x.holiday && x.holiday !== 'خارج الفصل').map((x) => x.holiday))] : [];
    const open = d.slots.filter((s) => !closed(s.day));
    const wk = { n: w, from: from != null ? ymd(from) : '', to: from != null ? ymd(from + 4 * DAY) : '', off: d.off.includes(w) || (cal && !open.length && d.slots.length > 0), holidays, items: [], slots: [] };
    if (!wk.off) {
      let cap = d.slots.length ? open.length : per;
      for (const r of reserve[w] || []) { if (cap <= 0) break; wk.items.push(r); cap -= r.periods; }
      while (cap > 0 && qi < queue.length) {
        const l = queue[qi]; const take = Math.min(cap, l.left);
        const prev = wk.items.find((x) => x.id === l.id);
        if (prev) prev.periods += take; else wk.items.push({ type: 'lesson', id: l.id, unit: l.unit, title: l.title, page: l.page, periods: take, done: l.done, cont: l.left < l.periods });
        l.left -= take; cap -= take;
        if (l.left <= 0) qi++;
      }
      // توزيع على الحصص: كل بند ياخذ حصصه بالترتيب
      const flat = wk.items.flatMap((it) => Array.from({ length: it.periods }, () => it));
      let fi = 0;
      wk.slots = d.slots.map((s) => {
        const date = from != null ? ymd(from + s.day * DAY) : '';
        if (closed(s.day)) return { ...s, date, holiday: cw.days[s.day].holiday, item: null };
        const it = flat[fi++];
        return { ...s, date, item: it ? { type: it.type, title: it.title, unit: it.unit || '' } : null };
      });
    }
    weeks.push(wk);
  }
  const placed = new Set(weeks.flatMap((w) => w.items.filter((x) => x.type === 'lesson').map((x) => x.id)));
  const overflow = d.lessons.filter((l) => !placed.has(l.id) || queue.find((q) => q.id === l.id).left > 0);
  const now = todayKSA();
  const current = s0 != null ? Math.min(Math.max(Math.floor((now - s0) / (7 * DAY)) + 1, 1), d.weeks) : 1;
  const capacity = weeks.filter((w) => !w.off).reduce((a, w) => a + (w.slots.length ? w.slots.filter((s) => !s.holiday).length : per), 0);
  const need = d.lessons.reduce((a, l) => a + l.periods, 0) + Object.values(reserve).flat().length;
  return { per, weeks, current, overflow, capacity, need, start: d.start, total: d.weeks, calendar: cal ? cal.sum : null };
}

// تقرير سير المادة: المخطط حتى هذا الأسبوع مقابل المنفذ
function progress(d, p = plan(d)) {
  const upto = p.weeks.filter((w) => w.n <= p.current);
  const planned = upto.flatMap((w) => w.items.filter((x) => x.type === 'lesson')).map((x) => x.id);
  const ids = [...new Set(planned)];
  const done = d.lessons.filter((l) => l.done);
  const behind = ids.filter((id) => !(d.lessons.find((l) => l.id === id) || {}).done).map((id) => d.lessons.find((l) => l.id === id)).filter(Boolean);
  return { week: p.current, planned: ids.length, done: done.length, total: d.lessons.length, behind, pct: d.lessons.length ? Math.round((done.length / d.lessons.length) * 100) : 0, onTrack: behind.length === 0 };
}

// ---------- تحليل الاختبار ----------
function analyze(d, t) {
  const max = t.items.reduce((a, it) => a + it.max, 0);
  const skillName = (id) => (d.skills.find((s) => s.id === id) || {}).name || '';
  const rows = d.students.map((s) => {
    const sc = t.scores[s.id];
    const absent = t.absent.includes(s.id);
    if (!sc || absent || sc.every((v) => v == null)) return { id: s.id, name: s.name, absent, total: null, pct: null, group: null, weak: [], skills: {} };
    const total = sc.reduce((a, v) => a + (v || 0), 0);
    const pct = max ? r1((total / max) * 100) : null;
    const per = {};
    t.items.forEach((it, i) => { if (!it.skill) return; const v = per[it.skill] || { got: 0, max: 0 }; v.got += sc[i] || 0; v.max += it.max; per[it.skill] = v; });
    const skills = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.max ? r1((v.got / v.max) * 100) : null]));
    const g = groupOf(pct);
    return { id: s.id, name: s.name, absent: false, total: r1(total), pct, group: g ? g.key : null, weak: Object.entries(skills).filter(([, v]) => v != null && v < SKILL_OK).map(([k]) => skillName(k)), skills };
  });
  const sat = rows.filter((r) => r.pct != null);
  const n = sat.length;
  const avg = n ? r1(sat.reduce((a, r) => a + r.pct, 0) / n) : null;
  const items = t.items.map((it, i) => {
    const vs = sat.map((r) => (t.scores[r.id] || [])[i]).filter((v) => v != null);
    return { i, skill: it.skill, skill_name: skillName(it.skill), max: it.max, pct: vs.length ? r1((vs.reduce((a, v) => a + v, 0) / (vs.length * it.max)) * 100) : null };
  });
  const skillIds = [...new Set(t.items.map((it) => it.skill).filter(Boolean))];
  const skills = skillIds.map((id) => { const vs = sat.map((r) => r.skills[id]).filter((v) => v != null); const pct = vs.length ? r1(vs.reduce((a, v) => a + v, 0) / vs.length) : null; return { id, name: skillName(id), pct, ok: pct != null && pct >= SKILL_OK, weakCount: vs.filter((v) => v < SKILL_OK).length }; });
  const groups = GROUPS.map((g) => ({ ...g, students: sat.filter((r) => r.group === g.key) }));
  const sorted = [...sat].sort((a, b) => b.pct - a.pct);
  const dist = [[90, 100], [80, 89.99], [65, 79.99], [50, 64.99], [0, 49.99]].map(([a, b]) => ({ label: b >= 100 ? `${a} فأكثر` : `${a} - ${Math.floor(b)}`, n: sat.filter((r) => r.pct >= a && r.pct <= b).length }));
  return { id: t.id, title: t.title, kind: t.kind, date: t.date, max, n, total: d.students.length, absent: rows.filter((r) => r.absent).length, avg, high: sorted[0] || null, low: sorted[n - 1] || null, rows, items, skills, groups, dist, passed: sat.filter((r) => r.pct >= 50).length };
}

// ---------- الخطط العلاجية والإثرائية ----------
const STRATEGIES = {
  support: ['إعادة شرح المهارة بأسلوب مختلف وبأمثلة محسوسة', 'التعلم في مجموعات صغيرة مع المعلم', 'أوراق عمل متدرجة من السهل إلى الصعب', 'تعليم الأقران (طالب متقن مع طالب متعثر)', 'تقويم قصير بعد كل حصة علاجية', 'التواصل مع ولي الأمر وإشراكه في المتابعة'],
  progress: ['تدريبات موجّهة على المهارات غير المتقنة', 'التغذية الراجعة الفورية على الأخطاء الشائعة', 'استراتيجية فكّر، زاوج، شارك', 'واجبات إلكترونية قصيرة بتصحيح تلقائي', 'خرائط مفاهيم ومنظمات بصرية'],
  mastery: ['مهام إثرائية وأسئلة تفكير عليا', 'مشروع قصير مرتبط بالمهارة', 'تكليف الطالب بدور القائد في مجموعته', 'مسابقات وتحديات صفية', 'مصادر إثرائية من المنصات التعليمية المعتمدة'],
};
const TOOLS = { support: 'اختبار قصير بعد الخطة، وملاحظة الأداء في الحصة', progress: 'ورقة عمل ختامية واختبار قصير', mastery: 'تقييم المهمة الإثرائية بسلم تقدير' };
function remedial(d, a) {
  if (!a || !a.n) return [];
  return a.groups.filter((g) => g.students.length).map((g) => {
    // المهارات اللي فيها طالب وحد على الأقل من الفئة تحت حد الإتقان، مرتبة بعدد الطلاب
    const weakSkills = a.skills.map((s) => ({ name: s.name, n: g.students.filter((r) => r.skills[s.id] != null && r.skills[s.id] < SKILL_OK).length })).filter((x) => x.n).sort((x, y) => y.n - x.n).map((x) => x.name);
    const target = g.key === 'mastery' ? a.skills.map((s) => s.name) : weakSkills.length ? weakSkills : a.skills.filter((s) => !s.ok).map((s) => s.name);
    return {
      key: `${a.id}:${g.key}`, group: g.key, name: g.name, color: g.color, type: g.plan, count: g.students.length,
      students: g.students.map((r) => r.name),
      goal: g.key === 'mastery' ? 'تعميق الفهم وتنمية مهارات التفكير العليا لدى الطلاب المتقنين' : `رفع مستوى الطلاب في المهارات غير المتقنة إلى ${SKILL_OK}% فأكثر`,
      skills: target, strategies: STRATEGIES[g.key], tool: TOOLS[g.key],
      period: g.key === 'support' ? 'أسبوعان، بواقع حصة علاجية أسبوعياً' : 'أسبوع إلى أسبوعين', done: d.remedial_done[`${a.id}:${g.key}`] || null,
    };
  });
}
// خطة دعم فردي لكل طالب يحتاج دعماً مكثفاً
function individual(d, a) {
  if (!a || !a.n) return [];
  return a.rows.filter((r) => r.group === 'support').map((r) => ({ key: `${a.id}:ind:${r.id}`, id: r.id, name: r.name, pct: r.pct, weak: r.weak.length ? r.weak : a.skills.map((s) => s.name), strategies: STRATEGIES.support.slice(0, 4), done: d.remedial_done[`${a.id}:ind:${r.id}`] || null }));
}

// ---------- المقارنة القبلي والبعدي ----------
function compare(d, preId, postId) {
  const tests = sortedTests(d).filter((t) => analyze(d, t).n);
  // الافتراضي: التشخيصي قبلي، وآخر اختبار غيره بعدي
  const pre = d.tests.find((t) => t.id === preId) || tests.find((t) => t.kind === 'diag') || tests[0];
  const post = d.tests.find((t) => t.id === postId) || [...tests].reverse().find((t) => pre && t.id !== pre.id);
  if (!pre || !post || pre.id === post.id) return null;
  const A = analyze(d, pre), B = analyze(d, post);
  const rows = d.students.map((s) => {
    const a = A.rows.find((r) => r.id === s.id), b = B.rows.find((r) => r.id === s.id);
    const gain = a.pct != null && b.pct != null ? r1(b.pct - a.pct) : null;
    return { id: s.id, name: s.name, pre: a.pct, post: b.pct, gain, preGroup: a.group, postGroup: b.group };
  });
  const both = rows.filter((r) => r.gain != null);
  const skills = d.skills.map((s) => { const a = A.skills.find((x) => x.id === s.id), b = B.skills.find((x) => x.id === s.id); return a && b && a.pct != null && b.pct != null ? { name: s.name, pre: a.pct, post: b.pct, gain: r1(b.pct - a.pct) } : null; }).filter(Boolean);
  const moved = (k) => GROUPS.map((g) => ({ name: g.name, color: g.color, n: rows.filter((r) => r[k] === g.key).length }));
  return {
    pre: { id: pre.id, title: pre.title, avg: A.avg }, post: { id: post.id, title: post.title, avg: B.avg },
    gain: A.avg != null && B.avg != null ? r1(B.avg - A.avg) : null, rows, skills,
    improved: both.filter((r) => r.gain > 0).length, declined: both.filter((r) => r.gain < 0).length, compared: both.length,
    groupsPre: moved('preGroup'), groupsPost: moved('postGroup'),
  };
}
const sortedTests = (d) => [...d.tests].sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

// ---------- سجل متابعة مهارات الطالب ----------
// لكل طالب ومهارة: آخر نتيجة مرصودة في أي اختبار
function followup(d) {
  const tests = sortedTests(d);
  const cell = {};
  for (const t of tests) { const a = analyze(d, t); for (const r of a.rows) for (const [k, v] of Object.entries(r.skills)) if (v != null) (cell[r.id] = cell[r.id] || {})[k] = { v, test: t.title }; }
  return d.students.map((s) => ({ id: s.id, name: s.name, note: s.note, skills: d.skills.map((k) => (cell[s.id] || {})[k.id] || null) }));
}

// ---------- رسائل أولياء الأمور ----------
function parentMessage(d, student, kind, ctx = {}) {
  const subj = d.subject || 'المادة';
  const nm = student.name.split(' ')[0];
  const weak = (ctx.weak || []).slice(0, 3).join('، ');
  const t = {
    weak: `السلام عليكم ورحمة الله، ولي أمر الطالب ${student.name} المحترم.\nنفيدكم بأن مستوى ${nm} في مادة ${subj}${ctx.test ? ` في ${ctx.test}` : ''} يحتاج إلى متابعة${weak ? `، خاصة في: ${weak}` : ''}.\nبدأنا معه خطة علاجية في المدرسة، ونأمل متابعته في البيت ومراجعة الدروس معه. ونسعد بتواصلكم.\nمعلم المادة`,
    excellent: `السلام عليكم ورحمة الله، ولي أمر الطالب ${student.name} المحترم.\nيسعدنا إبلاغكم بتميز ${nm} في مادة ${subj}${ctx.test ? ` في ${ctx.test}` : ''}${ctx.pct != null ? ` بنسبة ${ctx.pct}%` : ''}. نشكر لكم متابعتكم، ونتمنى له دوام التوفيق.\nمعلم المادة`,
    improved: `السلام عليكم ورحمة الله، ولي أمر الطالب ${student.name} المحترم.\nنبشركم بتحسن مستوى ${nm} في مادة ${subj}${ctx.gain ? ` بمقدار ${ctx.gain} درجة مئوية` : ''} مقارنة بالاختبار السابق. شكراً لتعاونكم، ونتطلع لاستمرار هذا التقدم.\nمعلم المادة`,
    absences: `السلام عليكم ورحمة الله، ولي أمر الطالب ${student.name} المحترم.\nنفيدكم بأن ${nm} تغيّب عن حصص مادة ${subj} ${ctx.count || ''} ${ctx.count > 2 && ctx.count < 11 ? 'مرات' : 'مرة'}${ctx.last ? `، آخرها بتاريخ ${ctx.last}` : ''}. الغياب يؤثر على تحصيله، نأمل متابعته والتواصل معنا.\nمعلم المادة`,
    good: `السلام عليكم ورحمة الله، ولي أمر الطالب ${student.name} المحترم.\nيسعدنا إبلاغكم بتميز ${nm} في سلوكه ومشاركته في حصص مادة ${subj}${ctx.note ? ` (${ctx.note})` : ''}. نشكر لكم حسن التربية والمتابعة.\nمعلم المادة`,
    conduct: `السلام عليكم ورحمة الله، ولي أمر الطالب ${student.name} المحترم.\nنود إشعاركم بملاحظة على ${nm} في حصة مادة ${subj}${ctx.note ? `: ${ctx.note}` : ''}. نثق في تعاونكم معنا لما فيه مصلحته، ونسعد بتواصلكم.\nمعلم المادة`,
    absent: `السلام عليكم ورحمة الله، ولي أمر الطالب ${student.name} المحترم.\nنفيدكم بغياب ${nm} عن ${ctx.test || 'اختبار مادة ' + subj}. نأمل التواصل لتحديد موعد التعويض.\nمعلم المادة`,
  };
  return t[kind] || t.weak;
}
const waLink = (phone, text) => { const p = String(phone || '').replace(/\D/g, '').replace(/^0/, '966'); return `https://wa.me/${p}?text=${encodeURIComponent(text)}`; };

// ---------- الشاهد لملف الإنجاز (بدون أسماء الطلاب) ----------
function evidenceFrom(d, kind, opts = {}) {
  const cls = `${d.subject}${d.grade ? `، ${d.grade}` : ''}${d.section ? ` شعبة ${d.section}` : ''}`;
  if (kind === 'analysis' || kind === 'remedial') {
    const t = d.tests.find((x) => x.id === opts.test); if (!t) return null;
    const a = analyze(d, t); if (!a.n) return null;
    const g = Object.fromEntries(a.groups.map((x) => [x.key, x.students.length]));
    const weak = a.skills.filter((s) => !s.ok).map((s) => s.name);
    if (kind === 'analysis') return {
      standard_id: 10, title: `تحليل نتائج ${t.title} في ${cls}`, ev_date: t.date,
      goals: ['تشخيص مستوى الطلاب في مهارات المادة', 'تحديد المهارات غير المتقنة وأسبابها', 'تصنيف الطلاب لبناء الخطط العلاجية والإثرائية'],
      description: `طُبّق ${t.title} على ${a.n} طالباً من ${a.total}، وبلغ متوسط الإتقان ${a.avg}%. صُنّف الطلاب إلى: متقن (${g.mastery})، وفي طور الإتقان (${g.progress})، ويحتاج دعماً مكثفاً (${g.support}).${weak.length ? ` والمهارات التي تحتاج معالجة: ${weak.join('، ')}.` : ' وجميع المهارات متقنة على مستوى الشعبة.'}`,
      steps: ['إعداد الاختبار وربط كل سؤال بمهارة', 'تطبيق الاختبار ورصد الدرجات لكل سؤال', 'حساب نسب الإتقان لكل سؤال ومهارة وطالب', 'تصنيف الطلاب في ثلاث فئات', 'بناء خطة علاجية لكل فئة وخطة إثرائية للمتقنين'].map((x, i) => `${i + 1}. ${x}`).join('\n'),
      impact: `تحديد ${weak.length} مهارة تحتاج معالجة، و${g.support} طالباً يحتاجون خطة دعم فردي، وتوجيه التدريس بناءً على البيانات.`,
    };
    const plans = remedial(d, a);
    return {
      standard_id: 5, title: `الخطط العلاجية والإثرائية بعد ${t.title} في ${cls}`, ev_date: t.date,
      goals: ['معالجة المهارات غير المتقنة لدى الطلاب', 'تقديم دعم فردي للطلاب المتعثرين', 'إثراء تعلم الطلاب المتقنين'],
      description: `بُنيت ${plans.length} خطط حسب فئات الطلاب بعد تحليل ${t.title}: ${plans.map((p) => `خطة ${p.type} لفئة «${p.name}» (${p.count} طالباً)`).join('، ')}.`,
      steps: plans.map((p, i) => `${i + 1}. فئة ${p.name}: ${p.strategies.slice(0, 3).join('، ')}`).join('\n'),
      impact: opts.gain != null ? `تحسن متوسط الشعبة بمقدار ${opts.gain} درجة مئوية بعد تنفيذ الخطط.` : 'يُقاس الأثر بالاختبار البعدي ومقارنته بالقبلي.',
    };
  }
  if (kind === 'compare') {
    const c = compare(d, opts.pre, opts.post); if (!c) return null;
    return {
      standard_id: 5, title: `قياس أثر الخطة العلاجية: ${c.pre.title} مقابل ${c.post.title} في ${cls}`, ev_date: new Date().toISOString().slice(0, 10),
      goals: ['قياس أثر الخطط العلاجية على مستوى الطلاب', 'متابعة تقدم الطلاب بين الاختبارين'],
      description: `${c.gain > 0 ? 'ارتفع' : c.gain < 0 ? 'انخفض' : 'ثبت'} متوسط الشعبة من ${c.pre.avg}% إلى ${c.post.avg}%${c.gain ? ` (${c.gain > 0 ? '+' : ''}${c.gain})` : ''}. تحسّن ${c.improved} طالباً من ${c.compared}.`,
      steps: '1. مقارنة نتيجة كل طالب بين الاختبارين\n2. مقارنة نسب الإتقان لكل مهارة\n3. متابعة انتقال الطلاب بين الفئات',
      impact: c.skills.length ? `أكبر تحسن في: ${[...c.skills].sort((a, b) => b.gain - a.gain).slice(0, 2).map((s) => `${s.name} (${s.gain > 0 ? '+' : ''}${s.gain})`).join('، ')}.` : '',
    };
  }
  if (kind === 'prep') {
    const ids = Object.keys(d.preps);
    if (!ids.length) return null;
    return {
      standard_id: 6, title: `تحضير دروس مادة ${cls}`, ev_date: new Date().toISOString().slice(0, 10),
      goals: ['إعداد خطة تنفيذ لكل درس بأهداف سلوكية قابلة للقياس', 'تنويع استراتيجيات التدريس ومراعاة الفروق الفردية'],
      description: `تحضير ${ids.length} درساً من دروس المقرر مرتبطة بالخطة الأسبوعية، لكل درس: الأهداف والمفردات ومصادر التعلم والاستراتيجيات وسير الدرس والتقويم والتمايز.`,
      steps: '1. تحديد أهداف الدرس من نواتج التعلم\n2. اختيار استراتيجيات التعلم النشط ومصادر التعلم\n3. تصميم سير الدرس والتقويم البنائي\n4. إعداد أنشطة علاجية وإثرائية',
      impact: 'وضوح سير الحصص وارتباطها بالخطة، ومراعاة مستويات الطلاب في كل درس.',
    };
  }
  if (kind === 'plan') {
    const p = plan(d);
    return {
      standard_id: 6, title: `الخطة الفصلية والأسبوعية لمادة ${cls}`, ev_date: d.start || new Date().toISOString().slice(0, 10),
      goals: ['توزيع المنهج على أسابيع الفصل حسب جدول الحصص', 'ربط الخطة بنتائج التشخيص وتحديثها بالحصص العلاجية'],
      description: `خطة لـ${d.lessons.length} درساً على ${d.weeks} أسبوعاً بواقع ${p.per} حصص أسبوعياً، تتضمن التهيئة والاختبار التشخيصي والحصص العلاجية بعد كل اختبار.`,
      steps: '1. حصر دروس المقرر ووحداته\n2. إدخال جدول حصص الشعبة\n3. توزيع الدروس على الأسابيع والحصص\n4. تحديث الخطة بعد كل اختبار بحصة علاجية',
      impact: `نسبة تنفيذ الدروس حتى الآن ${progress(d, p).pct}%.`,
    };
  }
  if (kind === 'tests') {
    const kinds = [...new Set(d.tests.map((t) => KINDS[t.kind]))];
    return {
      standard_id: 11, title: `تنويع أدوات التقويم في ${cls}`, ev_date: new Date().toISOString().slice(0, 10),
      goals: ['تطبيق التقويم القبلي والتكويني والختامي', 'ربط أسئلة الاختبارات بمهارات المادة'],
      description: `طُبّقت ${d.tests.length} أدوات تقويم: ${kinds.join('، ')}، وكل سؤال مربوط بمهارة لقياس الإتقان.`,
      steps: d.tests.map((t, i) => `${i + 1}. ${t.title}${t.date ? ` (${t.date})` : ''}: ${t.items.length} سؤالاً`).join('\n'), impact: 'قياس مستمر لمستوى الطلاب يوجّه الخطط العلاجية.',
    };
  }
  if (kind === 'parents') {
    const n = d.messages.length; if (!n) return null;
    const by = (k) => d.messages.filter((m) => m.kind === k).length;
    return {
      standard_id: 3, title: `التواصل مع أولياء أمور طلاب ${cls}`, ev_date: new Date().toISOString().slice(0, 10),
      goals: ['إشراك أولياء الأمور في متابعة مستوى أبنائهم', 'تعزيز الطلاب المتميزين والمتحسنين'],
      description: `أُرسلت ${n} رسالة لأولياء الأمور: ${by('weak')} لإبلاغ ضعف، و${by('excellent')} تميّز، و${by('improved')} تحسن، و${by('absent')} غياب عن اختبار.`,
      steps: '1. تحديد الطلاب من نتائج الاختبارات\n2. إرسال رسالة مناسبة لكل حالة\n3. متابعة الاستجابة', impact: 'شراكة أوضح مع الأسرة في الخطط العلاجية.',
    };
  }
  return null;
}

// ---------- التخزين ----------
const rowOf = (r) => (r ? { id: r.id, share_token: r.share_token, created_at: r.created_at, updated_at: r.updated_at, ...JSON.parse(r.data) } : null);
const list = (uid) => db.prepare('SELECT * FROM teacher_records WHERE user_id = ? ORDER BY updated_at DESC').all(uid).map(rowOf);
const get = (uid, id) => rowOf(db.prepare('SELECT * FROM teacher_records WHERE id = ? AND user_id = ?').get(Number(id), uid));
const byToken = (t) => (/^[\w-]{12,40}$/.test(String(t || '')) ? rowOf(db.prepare('SELECT * FROM teacher_records WHERE share_token = ?').get(String(t))) : null);
function save(uid, id, data) {
  const now = Date.now();
  const d = clean(data);
  if (id) { db.prepare('UPDATE teacher_records SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(JSON.stringify(d), now, Number(id), uid); return get(uid, id); }
  const info = db.prepare('INSERT INTO teacher_records (user_id, data, share_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(uid, JSON.stringify(d), crypto.randomBytes(12).toString('base64url'), now, now);
  return get(uid, info.lastInsertRowid);
}
const remove = (uid, id) => db.prepare('DELETE FROM teacher_records WHERE id = ? AND user_id = ?').run(Number(id), uid);

// كل المحسوبات اللي تحتاجها الواجهة دفعة وحدة
// ---------- الحضور والسلوك ----------
// إجراءات الغياب حسب «قواعد تنظيم السلوك والمواظبة» (الإجراءات الواجب اتخاذها حيال غياب طلاب المرحلتين المتوسطة والثانوية):
// 3 أيام متصلة أو 5 منفصلة: تحويل للموجه الطلابي. ثم نسب الغياب بدون عذر من الأيام الفعلية للدراسة: 10% و15% و20% و25%.
// في سجل المادة نحسبها على حصص المادة في الفصل، فهي مؤشر مبكر للمعلم، والإجراء الرسمي على غياب اليوم الكامل.
const ABS_STEPS = [
  { code: 'p25', pct: 25, name: 'غياب 25% فأكثر', action: 'الرفع لإدارة التعليم وتحويله لطالب منتسب وفق ضوابط القبول والانتساب' },
  { code: 'p20', pct: 20, name: 'غياب 20%', action: 'استدعاء ولي الأمر والتحويل لإدارة التعليم (التوجيه والإرشاد) وإنذار ولي الأمر' },
  { code: 'p15', pct: 15, name: 'غياب 15%', action: 'إنذار واستدعاء ولي الأمر وتعهد خطي والتحويل لوحدة الخدمات الإرشادية' },
  { code: 'p10', pct: 10, name: 'غياب 10%', action: 'إنذار الطالب واستدعاء ولي الأمر خطياً' },
];
const REFER = { code: 'refer', name: '3 أيام متصلة أو 5 منفصلة', action: 'تحويل الطالب للموجه الطلابي لدراسة حالته' };
function attendance(d, p) {
  const days = Object.keys(d.att).sort();
  // حصص المادة في الفصل (من الخطة) للنسبة، وإذا ما فيه خطة بتواريخ نحسب على الأيام المرصودة
  let classDays = 0;
  try { p = p || plan(d); classDays = new Set(p.weeks.flatMap((w) => (w.slots || []).filter((x) => x.date && !x.holiday).map((x) => x.date))).size; } catch { classDays = 0; }
  const base = Math.max(classDays, days.length);
  const rows = d.students.map((s) => {
    const c = { a: 0, l: 0, e: 0 }; let last = null; let run = 0; let streak = 0;
    for (const ds of days) { const v = d.att[ds][s.id]; if (v) { c[v]++; if (v === 'a') last = ds; } if (v === 'a') { run++; streak = Math.max(streak, run); } else if (v !== 'e') run = 0; }
    const bs = d.beh.filter((b) => b.s === s.id);
    const pct = base ? Math.round((c.a / base) * 1000) / 10 : 0;
    const st = ABS_STEPS.find((x) => c.a && pct >= x.pct) || (streak >= 3 || c.a >= 5 ? REFER : null);
    return { id: s.id, name: s.name, phone: s.phone, absent: c.a, late: c.l, excused: c.e, lastAbsent: last, streak, absPct: pct, step: st, pos: bs.filter((b) => b.t === 'p').length, neg: bs.filter((b) => b.t === 'n').length,
      rate: days.length ? Math.round(((days.length - c.a - c.e) / days.length) * 100) : null };
  });
  return { days, rows, base, alerts: rows.filter((r) => r.step), ABSENT_ALERT, STEPS: [REFER, ...ABS_STEPS.slice().reverse()],
    rate: rows.length && days.length ? Math.round(rows.reduce((a, r) => a + r.rate, 0) / rows.length) : null };
}
// مواعيد كل درس في الخطة: الأسبوع واليوم والحصة والتاريخ (للتحضير)
function schedule(d, p = plan(d)) {
  const out = {};
  for (const w of p.weeks) for (const s of w.slots) {
    if (!s.item || s.item.type !== 'lesson') continue;
    const it = w.items.find((x) => x.type === 'lesson' && x.title === s.item.title);
    if (!it) continue;
    (out[it.id] = out[it.id] || []).push({ week: w.n, day: s.day, period: s.period, date: s.date });
  }
  return out;
}
function full(d) {
  const p = plan(d);
  const tests = sortedTests(d).map((t) => { const a = analyze(d, t); return { ...a, plans: remedial(d, a), individual: individual(d, a) }; });
  return { plan: p, att: attendance(d, p), schedule: schedule(d, p), progress: progress(d, p), tests, compare: d.tests.length >= 2 ? compare(d) : null, followup: followup(d) };
}

module.exports = { ATT, attendance, schedule, DAYS, KINDS, GROUPS, SKILL_OK, parseStudents, parseLessons, parseSkills, blank, clean, plan, progress, analyze, remedial, individual, compare, followup, parentMessage, waLink, evidenceFrom, list, get, byToken, save, remove, full, sortedTests, uid };
