// مسارات صانع الاختبارات
const E = require('./exam');
const { write, examAi } = require('./ai');
const { build, examDocx } = require('./export');
const R = require('../teacher/record');
const TPL = require('../teacher/templates');

function mountExam(app, { auth, active, printGuard, uploadsDir }) {
  const out = (x) => ({ exam: x, spec: E.spec(x), total: E.total(x), ai: examAi() });
  const mine = (req, res) => { const x = E.get(req.user.id, req.params.id); if (!x) res.status(404).json({ error: 'الاختبار غير موجود' }); return x; };
  const summary = (x) => ({ id: x.id, title: E.titleOf(x), kind: x.kind, subject: x.subject, grade: x.grade, items: x.items.length, ready: E.ready(x), total: E.total(x), updated_at: x.updated_at });
  const recLessons = (r) => r.lessons.map((l) => ({ id: E.uid(), unit: l.unit, title: l.title, periods: l.periods, skill: l.skill, skill_name: (r.skills.find((s) => s.id === l.skill) || {}).name || '', objectives: [] }));

  app.get('/api/exam', auth, (req, res) => res.json({
    list: E.list(req.user.id).map(summary), ai: examAi(), templates: TPL.list(),
    records: R.list(req.user.id).map((r) => ({ id: r.id, subject: r.subject, grade: r.grade, section: r.section, lessons: r.lessons.length })),
    kinds: E.KINDS, types: Object.fromEntries(Object.entries(E.TYPES).map(([k, v]) => [k, v.name])), levels: E.LEVELS, presets: Object.fromEntries(Object.keys(E.KINDS).map((k) => [k, E.preset(k)])),
  }));

  app.post('/api/exam', auth, active, (req, res) => {
    const b = req.body || {};
    if (E.list(req.user.id).length >= 80) return res.status(400).json({ error: 'وصلت الحد الأعلى للاختبارات المحفوظة (80)، احذف القديم' });
    const d = E.blank(b, req.user);
    for (const k of ['grade', 'title', 'date']) if (b[k]) d[k] = String(b[k]);
    const src = b.source || {};
    if (src.type === 'template') {
      const t = TPL.examLessons(String(src.id), E.uid); if (!t) return res.status(400).json({ error: 'المادة غير موجودة' });
      Object.assign(d, { subject: t.subject, stage: t.stage, term: t.term || d.term, lessons: t.lessons, source: { type: 'template', id: String(src.id) } });
    } else if (src.type === 'record') {
      const r = R.get(req.user.id, src.id); if (!r) return res.status(400).json({ error: 'السجل غير موجود' });
      Object.assign(d, { subject: r.subject, grade: r.grade, stage: r.stage, term: r.term || d.term, year: r.year || d.year, lessons: recLessons(r), source: { type: 'record', id: String(r.id) }, rec_id: r.id });
      if (r.template) { const t = TPL.examLessons(r.template, E.uid); if (t) { const obj = new Map(t.lessons.map((l) => [l.title, l])); d.lessons.forEach((l) => { const m = obj.get(l.title); if (m) { l.objectives = m.objectives; if (!l.skill_name) l.skill_name = m.skill_name; } }); } }
      // افتراضياً: الدروس المنفذة (اختبار على ما درّسه)، وإذا ما فيه منفذ فكل الدروس
      const doneTitles = new Set(r.lessons.filter((l) => l.done).map((l) => l.title));
      d.selected = d.lessons.filter((l) => doneTitles.has(l.title)).map((l) => l.id);
    } else {
      if (b.lessons_text) d.lessons = R.parseLessons(String(b.lessons_text).slice(0, 30000)).map((l) => ({ ...l, objectives: [] }));
      if (b.subject) d.subject = String(b.subject);
    }
    if (!d.subject) return res.status(400).json({ error: 'اكتب اسم المادة' });
    res.json(out(E.save(req.user.id, null, d)));
  });

  app.get('/api/exam/:id', auth, (req, res) => { const x = mine(req, res); if (x) res.json(out(x)); });
  app.put('/api/exam/:id', auth, active, (req, res) => { const x = mine(req, res); if (!x) return; res.json(out(E.save(req.user.id, x.id, { ...x, ...(req.body || {}) }))); });
  app.delete('/api/exam/:id', auth, (req, res) => { E.remove(req.user.id, req.params.id); res.json({ ok: true }); });
  app.post('/api/exam-parse', auth, (req, res) => res.json({ items: R.parseLessons(String((req.body || {}).text || '').slice(0, 30000)) }));

  // حد يومي لتوليد الأسئلة بالذكاء الاصطناعي
  const use = new Map();
  const quota = (req, res, cost = 1) => {
    const k = `${req.user.id}:${new Date().toISOString().slice(0, 10)}`;
    if ((use.get(k) || 0) + cost > 20) { res.status(429).json({ error: 'وصلت حد توليد الأسئلة اليوم (20 مرة)، تقدر تكمل الأسئلة يدوياً أو ترجع بكرة' }); return false; }
    use.set(k, (use.get(k) || 0) + cost); return true;
  };
  const ctxOf = (x) => ({ subject: x.subject, grade: x.grade, stage: x.stage, term: x.term, kind: E.KINDS[x.kind], lessons: x.lessons });

  // بناء الأسئلة من جدول المواصفات: كل الورقة من جديد، أو تعبئة الفقرات الفاضية فقط
  app.post('/api/exam/:id/generate', auth, active, async (req, res) => {
    const x = mine(req, res); if (!x) return;
    const mode = (req.body || {}).mode === 'empty' ? 'empty' : 'all';
    let items;
    if (mode === 'all') {
      const sl = E.slots(x);
      if (!sl.length) return res.status(400).json({ error: 'حدد أقسام الأسئلة وعددها أولاً' });
      items = sl.map((s) => ({ id: E.uid(), ...s, text: '', choices: [], answer: '' }));
    } else items = x.items.map((it) => ({ ...it }));
    const todo = items.map((it, i) => [it, i]).filter(([it]) => !it.text.trim());
    let source = 'template';
    if (todo.length && examAi()) {
      if (!quota(req, res)) return;
      const got = await write(ctxOf(x), todo.map(([it]) => it));
      if (got && got.size) { source = 'ai'; todo.forEach(([it], j) => { const g = got.get(j); if (g) Object.assign(it, g); }); }
    }
    const saved = E.save(req.user.id, x.id, { ...x, items });
    res.json({ ...out(saved), source, missing: saved.items.filter((it) => !it.text.trim()).length });
  });

  // إعادة كتابة فقرة وحدة (نفس النوع والدرس والمستوى) مع ملاحظة اختيارية من المعلم
  app.post('/api/exam/:id/item', auth, active, async (req, res) => {
    const x = mine(req, res); if (!x) return;
    const b = req.body || {};
    const it = x.items.find((i) => i.id === b.item); if (!it) return res.status(400).json({ error: 'الفقرة غير موجودة' });
    if (!examAi()) return res.status(400).json({ error: 'التوليد الآلي غير متاح حالياً، اكتب الفقرة يدوياً' });
    if (!quota(req, res, 0.25)) return;
    const got = await write(ctxOf(x), [{ ...it, hint: String(b.hint || '').slice(0, 300), avoid: it.text.slice(0, 300) }]);
    const g = got && got.get(0);
    if (!g) return res.status(502).json({ error: 'ما قدرنا نكتب الفقرة الحين، جرّب مرة ثانية' });
    Object.assign(it, g);
    res.json(out(E.save(req.user.id, x.id, x)));
  });

  // إرسال الاختبار لسجل المادة: يصير اختبار مربوط بالمهارات جاهز للرصد والتحليل
  app.post('/api/exam/:id/to-record', auth, active, (req, res) => {
    const x = mine(req, res); if (!x) return;
    const r = R.get(req.user.id, (req.body || {}).rec_id || x.rec_id); if (!r) return res.status(400).json({ error: 'اختر سجل المادة' });
    if (!x.items.some((it) => it.text.trim())) return res.status(400).json({ error: 'اكتب الأسئلة أولاً' });
    if (r.tests.length >= 20) return res.status(400).json({ error: 'السجل فيه 20 اختبار، احذف واحد أولاً' });
    const t = E.toRecordTest(x, r);
    R.save(req.user.id, r.id, { ...r, tests: [...r.tests, t] });
    E.save(req.user.id, x.id, { ...x, rec_id: r.id });
    res.json({ rec_id: r.id, test_id: t.id, linked: t.items.filter((i) => i.skill).length, items: t.items.length });
  });

  app.get('/exam/:id/print', (req, res) => {
    const u = printGuard(req, res); if (!u) return;
    const x = E.get(u.id, req.params.id); if (!x) return res.status(404).send('الاختبار غير موجود');
    res.send(build({ u, d: x, k: String(req.query.k || 'all'), back: `/app#/exam/${x.id}`, docxUrl: `/exam/${x.id}/docx` }));
  });
  app.get('/exam/:id/docx', async (req, res) => {
    const u = printGuard(req, res); if (!u) return;
    const x = E.get(u.id, req.params.id); if (!x) return res.status(404).send('الاختبار غير موجود');
    const buf = await examDocx({ u, d: x, uploadsDir });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${E.titleOf(x)}.docx`)}`);
    res.send(buf);
  });
}
module.exports = { mountExam };
