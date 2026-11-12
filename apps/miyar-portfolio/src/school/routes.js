// مسارات «معياري للمدرسة»: ملف المدرسة، التقرير، خطة التحسين، الترخيص، التصدير.
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db, DATA_DIR } = require('../db');
const { SCHOOL_PACKAGES } = require('../plans');
const { catalog } = require('./indicators');
const { readPdf, normalize, readerEnabled } = require('./report');
const { buildPlan } = require('./plan');
const { printHtml, planDocx, followupHtml, followupDocx } = require('./export');
const { guessStandard } = require('../standards');
const nafis = require('./nafis');
const { nafisHtml, nafisDocx } = require('./nafis-export');

const DAY = 86400000;
const UPLOADS = path.join(DATA_DIR, 'uploads');
const TRIAL_ROWS = Number(process.env.SCHOOL_TRIAL_ROWS || 3);
const YEAR_PLAN_LIMIT = Number(process.env.SCHOOL_PLAN_LIMIT || 20);
const YEAR_READ_LIMIT = Number(process.env.SCHOOL_READ_LIMIT || 10);
const yearKey = () => String(new Date().getFullYear());

const clip = (v, n) => String(v ?? '').slice(0, n);
const grantsOf = (s) => (s.package || '').split(',').filter(Boolean);
function license(s) {
  const active = s.plan_ends > Date.now();
  const grants = active ? grantsOf(s) : [];
  return { active, grants, ends: s.plan_ends, daysLeft: Math.max(0, Math.ceil((s.plan_ends - Date.now()) / DAY)), packages: SCHOOL_PACKAGES.filter((p) => grants.length && p.grants.every((g) => grants.includes(g))).map((p) => p.id) };
}
const canPlan = (s, kind = 'improvement') => license(s).grants.includes(kind);

function schoolOf(userId) {
  let s = db.prepare('SELECT * FROM schools WHERE owner_id = ?').get(userId);
  if (!s) {
    db.prepare('INSERT INTO schools (owner_id, created_at) VALUES (?, ?)').run(userId, Date.now());
    s = db.prepare('SELECT * FROM schools WHERE owner_id = ?').get(userId);
  }
  return s;
}
const latestReport = (sid) => { const r = db.prepare('SELECT * FROM school_reports WHERE school_id = ? ORDER BY id DESC LIMIT 1').get(sid); return r ? { id: r.id, source: r.source, updated_at: r.updated_at, ...JSON.parse(r.data) } : null; };
const latestPlan = (sid, kind = 'improvement') => { const p = db.prepare('SELECT * FROM school_plans WHERE school_id = ? AND kind = ? ORDER BY id DESC LIMIT 1').get(sid, kind); return p ? { id: p.id, report_id: p.report_id, updated_at: p.updated_at, ...JSON.parse(p.data) } : null; };
function bump(sid, kind) {
  db.prepare('INSERT INTO school_usage (school_id, year, kind, count) VALUES (?, ?, ?, 1) ON CONFLICT(school_id, year, kind) DO UPDATE SET count = count + 1').run(sid, yearKey(), kind);
}
const used = (sid, kind) => db.prepare('SELECT count FROM school_usage WHERE school_id = ? AND year = ? AND kind = ?').get(sid, yearKey(), kind)?.count || 0;
const members = (sid) => db.prepare('SELECT id, email, name, role FROM school_members WHERE school_id = ? ORDER BY id').all(sid).map((m) => ({ ...m, joined: !!db.prepare('SELECT 1 FROM users WHERE lower(email) = ?').get(m.email) }));
const savePlan = (p) => { const { id, report_id, updated_at, ...data } = p; db.prepare('UPDATE school_plans SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data), Date.now(), id); };
// نضيف اسم المنفذ ورمز التحقق من الشاهد وقت العرض (الشاهد ممكن ينحذف من ملف المعلم)
function withPeople(plan, sid) {
  if (!plan) return plan;
  const names = new Map(members(sid).map((m) => [m.email, m.name || m.email]));
  for (const r of plan.rows) for (const p of r.procedures || []) {
    if (typeof p !== 'object') continue;
    if (p.assignee) p.assignee_name = names.get(p.assignee) || p.assignee;
    if (p.evidence_id) {
      const e = db.prepare('SELECT id, title, verify_code FROM evidences WHERE id = ?').get(p.evidence_id);
      p.evidence = e ? { title: e.title, code: e.verify_code } : null;
    }
  }
  return plan;
}
const nafisOf = (sid) => { const r = db.prepare('SELECT * FROM school_nafis WHERE school_id = ?').get(sid); return r ? { card: JSON.parse(r.data), plan: r.plan ? JSON.parse(r.plan) : null, updated_at: r.updated_at } : { card: null, plan: null }; };
const saveNafis = (sid, { card, plan }) => {
  const now = Date.now();
  db.prepare('INSERT INTO school_nafis (school_id, data, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(school_id) DO UPDATE SET data = excluded.data, plan = excluded.plan, updated_at = excluded.updated_at')
    .run(sid, JSON.stringify(card), plan ? JSON.stringify(plan) : null, now, now);
};
const nafisView = (sid) => { const n = nafisOf(sid); return { ...n, analysis: n.card ? nafis.analyze(n.card) : null }; };
const publicSchool = (s) => ({ ...s, license: license(s), logo_url: s.logo ? `/school-logo/${s.id}?v=${s.logo.slice(-6)}` : null });

const logoUpload = multer({
  storage: multer.diskStorage({ destination: UPLOADS, filename: (req, f, cb) => cb(null, `logo-${crypto.randomBytes(8).toString('hex')}${f.mimetype === 'image/png' ? '.png' : '.jpg'}`) }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(null, ['image/png', 'image/jpeg'].includes(f.mimetype)),
});
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, f.mimetype === 'application/pdf') });

function mountSchool(app, { auth, currentUser }) {
  app.get('/api/school', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    res.json({
      school: publicSchool(s),
      report: latestReport(s.id),
      plan: withPeople(latestPlan(s.id), s.id),
      members: members(s.id),
      nafis: nafisView(s.id),
      nafisMeta: { grades: nafis.GRADES, subjects: nafis.SUBJECTS, domains: nafis.DOMAINS, cls: nafis.CLS },
      reader: readerEnabled(),
      packages: SCHOOL_PACKAGES,
      catalog: { basic: catalog('basic'), secondary: catalog('secondary') },
      usage: { plans: used(s.id, 'plan'), planLimit: YEAR_PLAN_LIMIT, trialRows: TRIAL_ROWS },
      store: process.env.STORE_URL || 'https://miyar.store',
    });
  });

  const FIELDS = { name: 120, stage: 10, gender: 10, office: 120, principal: 80, year: 20, building: 10, period: 10 };
  const FLAGS = ['ministry_logo'];
  app.put('/api/school', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const b = req.body || {};
    const set = {};
    for (const [k, n] of Object.entries(FIELDS)) if (b[k] !== undefined) set[k] = clip(b[k], n).trim();
    if (set.stage && !['basic', 'secondary'].includes(set.stage)) set.stage = 'basic';
    if (b.ministry_number !== undefined) {
      const mn = clip(b.ministry_number, 20).trim().toUpperCase();
      if (license(s).active && s.ministry_number && mn !== s.ministry_number) return res.status(409).json({ error: 'الرقم الوزاري مرتبط بالترخيص ولا يمكن تغييره. تواصل معنا لو فيه خطأ.' });
      if (mn && !/^S-[A-Z]?\d{3,10}$/.test(mn)) return res.status(400).json({ error: 'الرقم الوزاري يكون بالشكل S-12345 كما في تقرير التقويم' });
      const other = mn && db.prepare('SELECT id FROM schools WHERE ministry_number = ? AND id != ?').get(mn, s.id);
      if (other) return res.status(409).json({ error: 'هذا الرقم الوزاري مسجل بحساب آخر. تواصل معنا لنقله.' });
      set.ministry_number = mn || null;
    }
    for (const k of FLAGS) if (b[k] !== undefined) set[k] = b[k] ? 1 : 0;
    const keys = Object.keys(set);
    if (keys.length) db.prepare(`UPDATE schools SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => set[k]), s.id);
    res.json({ school: publicSchool(db.prepare('SELECT * FROM schools WHERE id = ?').get(s.id)) });
  });

  app.post('/api/school/logo', auth, (req, res) => {
    logoUpload.single('logo')(req, res, (err) => {
      if (err || !req.file) return res.status(400).json({ error: 'ارفع صورة PNG أو JPG حجمها أقل من 2MB' });
      const s = schoolOf(req.user.id);
      db.prepare('UPDATE schools SET logo = ? WHERE id = ?').run(req.file.filename, s.id);
      res.json({ school: publicSchool(db.prepare('SELECT * FROM schools WHERE id = ?').get(s.id)) });
    });
  });
  app.get('/school-logo/:id', (req, res) => {
    const s = db.prepare('SELECT logo FROM schools WHERE id = ?').get(Number(req.params.id));
    if (!s || !s.logo) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(UPLOADS, s.logo));
  });

  // قراءة ملف التقرير: يرجع البيانات للمراجعة ولا يحفظها
  app.post('/api/school/report/pdf', auth, (req, res) => {
    pdfUpload.single('report')(req, res, async (err) => {
      if (err || !req.file) return res.status(400).json({ error: 'ارفع تقرير التقويم بصيغة PDF (أقل من 20MB)' });
      const s = schoolOf(req.user.id);
      if (used(s.id, 'read') >= YEAR_READ_LIMIT) return res.status(429).json({ error: 'وصلت لحد قراءة التقارير لهذا العام. أدخل النسب يدوياً أو تواصل معنا.' });
      try {
        const r = await readPdf(req.file.buffer);
        bump(s.id, 'read');
        res.json({ report: r });
      } catch (e) {
        if (e.code === 'no_ai') return res.status(503).json({ error: e.message, code: 'no_ai' });
        console.error('report read error:', e.status || '', e.message);
        res.status(502).json({ error: 'ما قدرنا نقرأ الملف. تأكد أنه تقرير التقويم المدرسي من منصة تميز، أو أدخل النسب يدوياً.' });
      }
    });
  });

  // تقرير نموذجي (بيانات حقيقية مخفية الهوية) حتى يشوف المستخدم النتيجة قبل ما يدخل بياناته
  app.get('/api/school/sample/:stage', auth, (req, res) => {
    const f = req.params.stage === 'secondary' ? 'report-secondary.json' : 'report-intermediate.json';
    const r = normalize(require(path.join(__dirname, 'samples', f)));
    res.json({ report: { ...r, ministry_number: '', school_name: '', sample: true } });
  });

  // حفظ التقرير بعد المراجعة
  app.put('/api/school/report', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const r = normalize(req.body || {});
    r.sample = !!req.body.sample;
    const filled = r.indicators.filter((i) => i.pct != null).length;
    if (filled < 1) return res.status(400).json({ error: 'أدخل نسبة مؤشر واحد على الأقل' });
    const data = JSON.stringify(r);
    const src = req.body.source === 'ai' ? 'ai' : 'manual';
    const last = db.prepare('SELECT id FROM school_reports WHERE school_id = ? ORDER BY id DESC LIMIT 1').get(s.id);
    if (last) db.prepare('UPDATE school_reports SET data = ?, source = ?, updated_at = ? WHERE id = ?').run(data, src, Date.now(), last.id);
    else db.prepare('INSERT INTO school_reports (school_id, data, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(s.id, data, src, Date.now(), Date.now());
    // نعبّي ملف المدرسة من التقرير إذا كانت الحقول فاضية
    const fill = { name: r.school_name, office: r.office, gender: r.gender, stage: r.stage };
    if (r.sample) Object.keys(fill).forEach((k) => delete fill[k]);
    for (const [k, v] of Object.entries(fill)) if (v && (!s[k] || k === 'stage')) db.prepare(`UPDATE schools SET ${k} = ? WHERE id = ?`).run(v, s.id);
    if (!r.sample && r.ministry_number && !s.ministry_number && /^S-[A-Z]?\d{3,10}$/.test(r.ministry_number) && !db.prepare('SELECT id FROM schools WHERE ministry_number = ?').get(r.ministry_number)) db.prepare('UPDATE schools SET ministry_number = ? WHERE id = ?').run(r.ministry_number, s.id);
    res.json({ report: latestReport(s.id), school: publicSchool(db.prepare('SELECT * FROM schools WHERE id = ?').get(s.id)) });
  });

  // توليد خطة التحسين
  app.post('/api/school/plan', auth, async (req, res) => {
    const s = schoolOf(req.user.id);
    const report = latestReport(s.id);
    if (!report) return res.status(400).json({ error: 'ارفع تقرير التقويم أولاً' });
    if (!report.complete) return res.status(400).json({ error: 'أكمل نسب كل المؤشرات قبل بناء الخطة' });
    // التقرير النموذجي: الخطة كاملة للعرض فقط (علامة مائية وبدون Word) ولا تُحسب من المحاولات
    if (report.sample) {
      const plan = await buildPlan(report, { ai: false });
      plan.trial = true; plan.sample = true;
      const { usage, ...data } = plan;
      db.prepare('INSERT INTO school_plans (school_id, report_id, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(s.id, report.id, 'improvement', JSON.stringify(data), Date.now(), Date.now());
      return res.json({ plan: withPeople(latestPlan(s.id), s.id) });
    }
    const full = canPlan(s);
    if (full && used(s.id, 'plan') >= YEAR_PLAN_LIMIT) return res.status(429).json({ error: 'وصلت للحد السنوي لتوليد الخطط. عدّل على خطتك الحالية أو تواصل معنا.' });
    if (!full && used(s.id, 'trial') >= 3) return res.status(402).json({ error: 'انتهت محاولات التجربة. فعّل باقة المدرسة لتحصل على الخطة كاملة.', code: 'license' });
    const plan = await buildPlan(report, { limit: full ? 0 : TRIAL_ROWS });
    plan.trial = !full;
    bump(s.id, full ? 'plan' : 'trial');
    const { usage, ...data } = plan;
    db.prepare('INSERT INTO school_plans (school_id, report_id, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(s.id, report.id, 'improvement', JSON.stringify(data), Date.now(), Date.now());
    res.json({ plan: withPeople(latestPlan(s.id), s.id) });
  });

  // تعديل صف من الخطة
  app.put('/api/school/plan/rows/:i', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canPlan(s)) return res.status(402).json({ error: 'التعديل متاح بعد تفعيل الباقة', code: 'license' });
    const p = latestPlan(s.id);
    const i = Number(req.params.i);
    if (!p || !p.rows[i]) return res.status(404).json({ error: 'الصف غير موجود' });
    const b = req.body || {};
    const list = (v, n) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => clip(x, 300).trim()).filter(Boolean).slice(0, n);
    const row = p.rows[i];
    if (b.goal !== undefined) row.goal = clip(b.goal, 400);
    if (b.procedures !== undefined) {
      // كل سطر: الإجراء | التوقيت ، ونحافظ على حالة الإنجاز للإجراءات اللي ما تغيرت
      const old = new Map((row.procedures || []).map((x) => (typeof x === 'string' ? [x, false] : [x.text, x.done])));
      row.procedures = list(b.procedures, 10).map((line) => { const [text, when] = line.split('|').map((x) => x.trim()); return { text, when: when || 'طوال العام', done: !!old.get(text) }; });
    }
    if (b.responsible !== undefined) row.responsible = clip(b.responsible, 200);
    if (b.from !== undefined) row.from = clip(b.from, 60);
    if (b.to !== undefined) row.to = clip(b.to, 60);
    if (b.measure !== undefined) row.measure = clip(b.measure, 400);
    if (b.evidence !== undefined) row.evidence = list(b.evidence, 8);
    for (const [k, n] of [['methods', 300], ['committee', 200], ['supervisor', 300], ['note', 400]]) if (b[k] !== undefined) row[k] = clip(b[k], n).trim();
    const { id, report_id, updated_at, ...data } = p;
    db.prepare('UPDATE school_plans SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data), Date.now(), id);
    res.json({ plan: withPeople(latestPlan(s.id), s.id) });
  });

  // التوصيات والمقترحات (قسم ثالث في استمارتي البناء والتنفيذ)
  app.put('/api/school/plan/recommendations', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canPlan(s)) return res.status(402).json({ error: 'التعديل متاح بعد تفعيل الباقة', code: 'license' });
    const p = latestPlan(s.id);
    if (!p) return res.status(404).json({ error: 'ابنِ الخطة أولاً' });
    p.recommendations = clip((req.body || {}).recommendations, 3000).trim();
    const { id, report_id, updated_at, ...data } = p;
    db.prepare('UPDATE school_plans SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data), Date.now(), id);
    res.json({ plan: withPeople(latestPlan(s.id), s.id) });
  });

  // متابعة التنفيذ: تأشير إنجاز إجراء
  app.put('/api/school/plan/rows/:i/procs/:j', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canPlan(s)) return res.status(402).json({ error: 'متابعة التنفيذ متاحة بعد تفعيل الباقة', code: 'license' });
    const p = latestPlan(s.id);
    const row = p && p.rows[Number(req.params.i)];
    const pr = row && row.procedures[Number(req.params.j)];
    if (!pr || typeof pr !== 'object') return res.status(404).json({ error: 'الإجراء غير موجود' });
    const b = req.body || {};
    if (b.assignee !== undefined) {
      const em = clip(b.assignee, 120).trim().toLowerCase();
      if (em && !members(s.id).some((m) => m.email === em)) return res.status(400).json({ error: 'أضف المعلم لفريق المدرسة أولاً' });
      pr.assignee = em || null;
    }
    if (b.done !== undefined) {
      pr.done = !!b.done;
      pr.done_at = pr.done ? Date.now() : null;
      if (pr.done) pr.done_by = 'principal';
    }
    const { id, report_id, updated_at, ...data } = p;
    db.prepare('UPDATE school_plans SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data), Date.now(), id);
    res.json({ plan: withPeople(latestPlan(s.id), s.id) });
  });

  // ---------- الخطة العلاجية لنافس ----------
  app.get('/api/school/nafis/sample', auth, (req, res) => res.json({ card: nafis.normalize({ ...require(path.join(__dirname, 'samples', 'nafis-intermediate.json')), sample: true }) }));
  // حفظ أرقام البطاقة (الخطة القديمة تبقى حتى يعيد البناء)
  app.put('/api/school/nafis', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const card = nafis.normalize(req.body || {});
    if (!card.grades.length) return res.status(400).json({ error: 'اختر صفاً واحداً على الأقل' });
    if (!nafis.analyze(card).subjects.length) return res.status(400).json({ error: 'أدخل نسبة إتقان المدرسة ومتوسط المملكة لمادة واحدة على الأقل' });
    saveNafis(s.id, { card, plan: nafisOf(s.id).plan });
    res.json({ nafis: nafisView(s.id) });
  });
  app.post('/api/school/nafis/plan', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const { card } = nafisOf(s.id);
    if (!card) return res.status(400).json({ error: 'أدخل أرقام بطاقة نافس أولاً' });
    let trial = false;
    if (!card.sample) {
      const full = canPlan(s, 'nafis');
      if (full && used(s.id, 'nafis') >= YEAR_PLAN_LIMIT) return res.status(429).json({ error: 'وصلت للحد السنوي لبناء الخطط. عدّل على خطتك الحالية أو تواصل معنا.' });
      if (!full && used(s.id, 'nafis_trial') >= 3) return res.status(402).json({ error: 'انتهت محاولات التجربة. فعّل باقة نافس لتحصل على الخطة كاملة.', code: 'license' });
      trial = !full;
      bump(s.id, full ? 'nafis' : 'nafis_trial');
    }
    const plan = nafis.buildNafisPlan(card, { limit: trial ? TRIAL_ROWS : 0 });
    plan.trial = trial || card.sample;
    plan.sample = card.sample;
    saveNafis(s.id, { card, plan });
    res.json({ nafis: nafisView(s.id) });
  });
  // تعديل صف من الخطة العلاجية
  app.put('/api/school/nafis/plan/rows/:i', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canPlan(s, 'nafis')) return res.status(402).json({ error: 'التعديل متاح بعد تفعيل باقة نافس', code: 'license' });
    const n = nafisOf(s.id);
    const row = n.plan && !n.plan.trial && n.plan.rows[Number(req.params.i)];
    if (!row) return res.status(404).json({ error: 'الصف غير موجود' });
    const b = req.body || {};
    if (b.actions !== undefined) row.actions = String(b.actions).split('\n').map((l) => clip(l, 300).trim()).filter(Boolean).slice(0, 8).map((l) => { const [text, when] = l.split('|').map((x) => x.trim()); return { text, when: when || '' }; });
    if (b.owner !== undefined) row.owner = clip(b.owner, 200).trim();
    if (b.measure !== undefined) row.measure = clip(b.measure, 300).trim();
    if (b.target !== undefined) { const t = Number(b.target); if (Number.isFinite(t) && t >= 0 && t <= 100) row.target = Math.round(t * 10) / 10; }
    saveNafis(s.id, n);
    res.json({ nafis: nafisView(s.id) });
  });
  app.put('/api/school/nafis/plan/recommendations', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canPlan(s, 'nafis')) return res.status(402).json({ error: 'التعديل متاح بعد تفعيل باقة نافس', code: 'license' });
    const n = nafisOf(s.id);
    if (!n.plan || n.plan.trial) return res.status(404).json({ error: 'ابنِ الخطة أولاً' });
    n.plan.recommendations = clip((req.body || {}).recommendations, 3000).trim();
    saveNafis(s.id, n);
    res.json({ nafis: nafisView(s.id) });
  });
  function nafisGuard(req, res) {
    const u = currentUser(req);
    if (!u) { res.redirect('/school'); return null; }
    const s = schoolOf(u.id);
    const n = nafisOf(s.id);
    if (!n.card || !n.plan) { res.redirect('/school#/nafis'); return null; }
    return { s, ...n };
  }
  app.get('/school/print/nafis', (req, res) => {
    const g = nafisGuard(req, res); if (!g) return;
    res.send(nafisHtml({ school: g.s, card: g.card, plan: g.plan, trial: g.plan.trial || !canPlan(g.s, 'nafis'), uploadsDir: UPLOADS }));
  });
  app.get('/school/export/nafis.docx', async (req, res) => {
    const g = nafisGuard(req, res); if (!g) return;
    if (g.plan.trial || !canPlan(g.s, 'nafis')) return res.redirect('/school#/license');
    const buf = await nafisDocx({ school: g.s, card: g.card, plan: g.plan, uploadsDir: UPLOADS });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`الخطة-العلاجية-لنافس-${g.s.name || 'المدرسة'}.docx`)}`);
    res.send(buf);
  });

  // فريق المدرسة
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  app.get('/api/school/members', auth, (req, res) => res.json({ members: members(schoolOf(req.user.id).id) }));
  app.post('/api/school/members', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const b = req.body || {};
    const email = clip(b.email, 120).trim().toLowerCase();
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'اكتب بريد المعلم صحيح' });
    if (members(s.id).length >= 150) return res.status(400).json({ error: 'وصلت للحد الأعلى لأعضاء الفريق' });
    db.prepare('INSERT INTO school_members (school_id, email, name, role, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(school_id, email) DO UPDATE SET name = excluded.name, role = excluded.role')
      .run(s.id, email, clip(b.name, 80).trim(), clip(b.role, 80).trim(), Date.now());
    res.json({ members: members(s.id) });
  });
  app.delete('/api/school/members/:id', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const m = db.prepare('SELECT * FROM school_members WHERE id = ? AND school_id = ?').get(Number(req.params.id), s.id);
    if (!m) return res.status(404).json({ error: 'العضو غير موجود' });
    db.prepare('DELETE FROM school_members WHERE id = ?').run(m.id);
    // نفك إسناد إجراءاته (حالة الإنجاز والشاهد تبقى)
    const p = latestPlan(s.id);
    if (p) { for (const r of p.rows) for (const x of r.procedures || []) if (x && x.assignee === m.email) x.assignee = null; savePlan(p); }
    res.json({ members: members(s.id), plan: withPeople(latestPlan(s.id), s.id) });
  });

  // «مهامي» عند المعلم: الإجراءات المسندة له في خطط المدارس اللي هو عضو فيها
  function myTasks(user) {
    const email = String(user.email).toLowerCase();
    const out = [];
    for (const m of db.prepare('SELECT * FROM school_members WHERE email = ?').all(email)) {
      const s = db.prepare('SELECT * FROM schools WHERE id = ?').get(m.school_id);
      const p = s && latestPlan(s.id);
      if (!p || p.trial) continue;
      p.rows.forEach((r, i) => (r.procedures || []).forEach((x, j) => {
        if (!x || typeof x !== 'object' || x.assignee !== email) return;
        const ev = x.evidence_id && db.prepare('SELECT id, title, verify_code FROM evidences WHERE id = ? AND user_id = ?').get(x.evidence_id, user.id);
        out.push({ school_id: s.id, school: s.name || 'المدرسة', i, j, text: x.text, when: x.when, done: !!x.done, indicator: r.code, indicator_text: r.indicator, evidence: ev ? { id: ev.id, title: ev.title, code: ev.verify_code } : null, suggest: guessStandard(`${x.text} ${r.indicator || ''}`) || null });
      }));
    }
    return out;
  }
  app.get('/api/my-tasks', auth, (req, res) => res.json({ tasks: myTasks(req.user) }));
  app.put('/api/my-tasks/:sid/:i/:j', auth, (req, res) => {
    const email = String(req.user.email).toLowerCase();
    const sid = Number(req.params.sid);
    if (!db.prepare('SELECT 1 FROM school_members WHERE school_id = ? AND email = ?').get(sid, email)) return res.status(403).json({ error: 'ما أنت ضمن فريق هذه المدرسة' });
    const p = latestPlan(sid);
    const x = p && p.rows[Number(req.params.i)] && p.rows[Number(req.params.i)].procedures[Number(req.params.j)];
    if (!x || typeof x !== 'object' || x.assignee !== email) return res.status(404).json({ error: 'الإجراء غير مسند لك' });
    const b = req.body || {};
    if (b.evidence_id !== undefined) {
      if (b.evidence_id === null) x.evidence_id = null;
      else {
        const ev = db.prepare('SELECT id FROM evidences WHERE id = ? AND user_id = ?').get(Number(b.evidence_id), req.user.id);
        if (!ev) return res.status(400).json({ error: 'الشاهد غير موجود في ملفك' });
        x.evidence_id = ev.id;
      }
    }
    if (b.done !== undefined) { x.done = !!b.done; x.done_at = x.done ? Date.now() : null; if (x.done) x.done_by = 'teacher'; }
    savePlan(p);
    res.json({ tasks: myTasks(req.user) });
  });

  // تفعيل باقة بكود من المتجر
  app.post('/api/school/redeem', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!s.ministry_number) return res.status(400).json({ error: 'أدخل الرقم الوزاري للمدرسة أولاً، الترخيص يرتبط به' });
    const code = clip(req.body.code, 40).trim().toUpperCase().replace(/\s/g, '');
    const row = db.prepare('SELECT * FROM codes WHERE code = ?').get(code);
    if (!row || !String(row.product).startsWith('school_')) return res.status(404).json({ error: 'الكود غير صحيح أو ليس كود باقة مدرسة' });
    if (row.redeemed_by) return res.status(409).json({ error: 'هذا الكود مستخدم مسبقاً' });
    const pkg = SCHOOL_PACKAGES.find((p) => p.id === row.product);
    if (!pkg) return res.status(400).json({ error: 'باقة غير معروفة' });
    const grants = [...new Set([...(s.plan_ends > Date.now() ? grantsOf(s) : []), ...pkg.grants])];
    const ends = Math.max(Date.now(), s.plan_ends) + row.days * DAY;
    db.prepare('UPDATE codes SET redeemed_by = ?, redeemed_at = ?, note = ? WHERE code = ?').run(req.user.id, Date.now(), `${row.note} | ${s.ministry_number}`.slice(0, 120), code);
    db.prepare('UPDATE schools SET package = ?, plan_ends = ? WHERE id = ?').run(grants.join(','), ends, s.id);
    res.json({ school: publicSchool(db.prepare('SELECT * FROM schools WHERE id = ?').get(s.id)), package: pkg });
  });

  // الطباعة والتصدير
  function exportGuard(req, res) {
    const u = currentUser(req);
    if (!u) { res.redirect('/school'); return null; }
    const s = schoolOf(u.id);
    const report = latestReport(s.id);
    const plan = withPeople(latestPlan(s.id), s.id);
    if (!report || !plan) { res.redirect('/school#/plan'); return null; }
    return { s, report, plan };
  }
  app.get('/school/print/plan', (req, res) => {
    const g = exportGuard(req, res); if (!g) return;
    res.send(printHtml({ school: g.s, report: g.report, plan: g.plan, trial: !canPlan(g.s) || g.plan.trial, uploadsDir: UPLOADS }));
  });
  app.get('/school/print/followup', (req, res) => {
    const g = exportGuard(req, res); if (!g) return;
    if (!canPlan(g.s) || g.plan.trial) return res.redirect('/school#/license');
    res.send(followupHtml({ school: g.s, report: g.report, plan: g.plan, uploadsDir: UPLOADS, base: `${req.protocol}://${req.get('host')}` }));
  });
  app.get('/school/export/plan.docx', async (req, res) => {
    const g = exportGuard(req, res); if (!g) return;
    if (!canPlan(g.s) || g.plan.trial) return res.redirect('/school#/license');
    const buf = await planDocx({ school: g.s, report: g.report, plan: g.plan, uploadsDir: UPLOADS });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`خطة-التحسين-${g.s.name || 'المدرسة'}.docx`)}`);
    res.send(buf);
  });

  app.get('/school/export/followup.docx', async (req, res) => {
    const g = exportGuard(req, res); if (!g) return;
    if (!canPlan(g.s) || g.plan.trial) return res.redirect('/school#/license');
    const buf = await followupDocx({ school: g.s, report: g.report, plan: g.plan, uploadsDir: UPLOADS });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`متابعة-تنفيذ-خطة-التحسين-${g.s.name || 'المدرسة'}.docx`)}`);
    res.send(buf);
  });

  app.get('/school', (req, res) => res.sendFile(path.join(__dirname, '..', '..', 'public', 'school.html')));
}

module.exports = { mountSchool };
