// مسارات «مساعد المعلم»
const R = require('./record');
const { build } = require('./record-export');
const { generateTest, testAi } = require('./ai');
const TPL = require('./templates');

function mountTeacher(app, { auth, active, printGuard, addEvidence, baseUrl }) {
  const summary = (r) => ({ id: r.id, subject: r.subject, grade: r.grade, section: r.section, term: r.term, students: r.students.length, lessons: r.lessons.length, tests: r.tests.length, updated_at: r.updated_at, progress: R.progress(r).pct });
  const out = (r) => ({ rec: r, calc: R.full(r), ai: testAi() });
  const mine = (req, res) => { const r = R.get(req.user.id, req.params.id); if (!r) res.status(404).json({ error: 'السجل غير موجود' }); return r; };

  app.get('/api/rec', auth, (req, res) => res.json({ list: R.list(req.user.id).map(summary), ai: testAi(), templates: TPL.list() }));
  app.post('/api/rec', auth, active, (req, res) => {
    const b = req.body || {};
    if (R.list(req.user.id).length >= 30) return res.status(400).json({ error: 'وصلت الحد الأعلى للسجلات (30)' });
    const tp = b.template ? TPL.apply(String(b.template), R.uid) : null;
    if (tp) for (const k of ['subject', 'stage', 'term']) if (!b[k] || k === 'subject') b[k] = tp[k];
    const d = R.blank(b, req.user);
    if (tp) Object.assign(d, { lessons: tp.lessons, skills: tp.skills, start: b.start || tp.start, weeks: tp.weeks, off: tp.off, template: tp.template, per_hint: tp.per_hint });
    if (!d.subject) return res.status(400).json({ error: 'اكتب اسم المادة' });
    // نسخ الدروس والمهارات وإعدادات الفصل من شعبة ثانية لنفس المادة (بدون الطلاب والدرجات)
    if (b.copy_from) {
      const src = R.get(req.user.id, b.copy_from);
      if (src) Object.assign(d, { lessons: src.lessons.map((l) => ({ ...l, done: false, done_at: null })), skills: src.skills, start: d.start || src.start, weeks: src.weeks, off: src.off, tests: src.tests.map((t) => ({ ...t, scores: {}, absent: [] })) });
    }
    const r = R.save(req.user.id, null, d);
    res.json(out(r));
  });
  app.get('/api/rec/:id', auth, (req, res) => { const r = mine(req, res); if (r) res.json(out(r)); });
  app.put('/api/rec/:id', auth, active, (req, res) => {
    const r = mine(req, res); if (!r) return;
    res.json(out(R.save(req.user.id, r.id, { ...r, ...(req.body || {}) })));
  });
  app.delete('/api/rec/:id', auth, (req, res) => { R.remove(req.user.id, req.params.id); res.json({ ok: true }); });
  app.post('/api/rec-parse', auth, (req, res) => {
    const { what, text } = req.body || {};
    const fn = { students: R.parseStudents, lessons: R.parseLessons, skills: R.parseSkills }[what];
    if (!fn) return res.status(400).json({ error: 'نوع غير معروف' });
    res.json({ items: fn(String(text || '').slice(0, 30000)) });
  });
  // توليد أسئلة الاختبار بالذكاء الاصطناعي
  const aiUse = new Map();
  app.post('/api/rec/:id/ai-test', auth, active, async (req, res) => {
    const r = mine(req, res); if (!r) return;
    const day = new Date().toISOString().slice(0, 10); const k = `${req.user.id}:${day}`;
    if ((aiUse.get(k) || 0) >= 15) return res.status(429).json({ error: 'وصلت حد توليد الاختبارات اليوم، جرّب بكرة' });
    const ids = (Array.isArray(req.body.skills) ? req.body.skills : []).filter((id) => r.skills.some((s) => s.id === id)).slice(0, 15);
    const skills = ids.map((id) => r.skills.find((s) => s.id === id));
    if (!skills.length) return res.status(400).json({ error: 'اختر مهارة وحدة على الأقل' });
    aiUse.set(k, (aiUse.get(k) || 0) + 1);
    const items = await generateTest({ subject: r.subject, grade: r.grade, stage: r.stage, kind: R.KINDS[req.body.kind] || 'اختبار', skills: skills.map((s) => s.name), perSkill: req.body.perSkill });
    // بدون الذكاء الاصطناعي: نجهز أسئلة فاضية مربوطة بالمهارات يكتبها المعلم
    const n = Math.min(Math.max(Number(req.body.perSkill) || 2, 1), 4);
    const list = items && items.length ? items.map((it) => ({ skill: skills[it.skill].id, max: 1, text: it.text, choices: it.choices, answer: it.answer })) : skills.flatMap((s) => Array.from({ length: n }, () => ({ skill: s.id, max: 1, text: '', choices: [], answer: '' })));
    res.json({ items: list, source: items && items.length ? 'ai' : 'template' });
  });
  // رسالة ولي الأمر
  app.post('/api/rec/:id/message', auth, active, (req, res) => {
    const r = mine(req, res); if (!r) return;
    const b = req.body || {};
    const s = r.students.find((x) => x.id === b.student); if (!s) return res.status(400).json({ error: 'اختر الطالب' });
    const t = r.tests.find((x) => x.id === b.test);
    const a = t ? R.analyze(r, t) : null; const row = a ? a.rows.find((x) => x.id === s.id) : null;
    const c = r.tests.length >= 2 ? R.compare(r) : null; const cr = c ? c.rows.find((x) => x.id === s.id) : null;
    const text = R.parentMessage(r, s, b.kind, { test: t && t.title, weak: row ? row.weak : [], pct: row ? row.pct : null, gain: cr && cr.gain > 0 ? cr.gain : null });
    if (b.log) { r.messages.push({ student: s.id, kind: String(b.kind || 'weak'), at: Date.now() }); R.save(req.user.id, r.id, r); }
    res.json({ text, wa: s.phone ? R.waLink(s.phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}` });
  });
  // تحويل أي مخرج لشاهد في ملف الإنجاز، برابط للتقرير بدون أسماء الطلاب
  app.post('/api/rec/:id/evidence', auth, active, (req, res) => {
    const r = mine(req, res); if (!r) return;
    const b = req.body || {};
    const e = R.evidenceFrom(r, b.kind, { test: b.test, pre: b.pre, post: b.post, gain: r.tests.length >= 2 ? (R.compare(r) || {}).gain : null });
    if (!e) return res.status(400).json({ error: 'ما فيه بيانات كافية لهذا الشاهد بعد' });
    const k = { analysis: 'analysis', remedial: 'remedial', compare: 'compare', plan: 'term', tests: 'all', parents: 'followup' }[b.kind];
    const q = new URLSearchParams({ k }); if (b.test) q.set('test', b.test);
    e.links = [`${baseUrl(req)}/rs/${r.share_token}?${q}`];
    const ev = addEvidence(req.user.id, e);
    res.json({ evidence: ev });
  });
  // الطباعة
  app.get('/rec/:id/print', (req, res) => {
    const u = printGuard(req, res); if (!u) return;
    const r = R.get(u.id, req.params.id); if (!r) return res.status(404).send('السجل غير موجود');
    res.send(build({ u, d: r, kind: String(req.query.k || 'all'), test: req.query.test, week: req.query.week, back: `/app#/rec/${r.id}` }));
  });
  // نسخة المقيّم: بدون أسماء الطلاب
  const { db } = require('../db');
  app.get('/rs/:token', (req, res) => {
    const r = R.byToken(req.params.token); if (!r) return res.status(404).send('<meta charset="utf-8"><p style="font-family:sans-serif;text-align:center;margin-top:60px">الرابط غير صالح.</p>');
    const u = db.prepare('SELECT * FROM teacher_records t JOIN users u ON u.id = t.user_id WHERE t.id = ?').get(r.id);
    res.send(build({ u, d: r, kind: String(req.query.k || 'analysis'), test: req.query.test, anon: true }));
  });
}
module.exports = { mountTeacher };
