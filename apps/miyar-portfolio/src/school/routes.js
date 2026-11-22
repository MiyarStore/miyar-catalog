const fs = require('fs');
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
const { readNafis, ACCEPT: NAFIS_ACCEPT } = require('./nafis-read');
const { nafisHtml, nafisDocx } = require('./nafis-export');
const { mountEvidence } = require('./evidence');
const { publicHtml, evidenceHtml, evidenceDocx } = require('./evidence-export');
const operational = require('./operational');
const { opsHtml, opsDocx, deckHtml } = require('./ops-export');
const track = require('./track');
const { mountBoard } = require('./board-routes');
const { progressHtml, teamHtml, teamCardHtml } = require('./track-export');

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
const opsOver = (sid) => { const r = db.prepare('SELECT data FROM school_ops WHERE school_id = ?').get(sid); return r ? JSON.parse(r.data) : {}; };
function opsOf(s, plan) {
  const report = latestReport(s.id);
  const n = nafisOf(s.id);
  return operational.build({ report, plan: plan === undefined ? withPeople(latestPlan(s.id), s.id) : plan, nafis: n.plan, nafisA: n.card ? nafis.analyze(n.card) : null, over: opsOver(s.id) });
}
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
    const plan = withPeople(latestPlan(s.id), s.id);
    res.json({
      school: publicSchool(s),
      report: latestReport(s.id),
      plan,
      ops: opsOf(s, plan),
      opTypes: operational.TYPES,
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
  // قراءة بطاقة نافس (PDF أو صور، حتى 3 ملفات لكل الصفوف): ترجع مسودة للمراجعة ولا تحفظ
  const nafisUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 3 }, fileFilter: (req, f, cb) => cb(null, NAFIS_ACCEPT.includes(f.mimetype)) });
  app.post('/api/school/nafis/pdf', auth, (req, res) => {
    nafisUpload.array('cards', 3)(req, res, async (err) => {
      if (err || !req.files || !req.files.length) return res.status(400).json({ error: 'ارفع بطاقة نافس بصيغة PDF أو صورة (حتى 3 ملفات، أقل من 20MB للملف)' });
      const s = schoolOf(req.user.id);
      if (used(s.id, 'read') >= YEAR_READ_LIMIT) return res.status(429).json({ error: 'وصلت لحد قراءة الملفات لهذا العام. أدخل الأرقام يدوياً أو تواصل معنا.' });
      try {
        const r = await readNafis(req.files);
        bump(s.id, 'read');
        res.json({ card: r.card, warnings: r.warnings });
      } catch (e) {
        if (e.code === 'no_ai') return res.status(503).json({ error: e.message, code: 'no_ai' });
        console.error('nafis read error:', e.status || '', e.message);
        res.status(502).json({ error: 'ما قدرنا نقرأ الملف. تأكد أنه بطاقة نافس من منصة تميز، أو أدخل الأرقام يدوياً.' });
      }
    });
  });

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

  // ---------- الخطة التشغيلية ----------
  app.put('/api/school/ops', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canPlan(s, 'operational')) return res.status(402).json({ error: 'تعديل الخطة التشغيلية متاح في باقة المدرسة الشاملة', code: 'license' });
    const b = req.body || {};
    const o = opsOver(s.id);
    for (const k of ['vision', 'mission', 'values']) if (b[k] !== undefined) o[k] = clip(b[k], 600).trim();
    if (b.swot !== undefined) {
      if (b.swot === null) delete o.swot;
      else o.swot = Object.fromEntries(['s', 'w', 'o', 't'].map((k) => [k, (Array.isArray(b.swot[k]) ? b.swot[k] : String(b.swot[k] || '').split('\n')).map((x) => clip(x, 240).trim()).filter(Boolean).slice(0, 10)]));
    }
    if (b.program && typeof b.program === 'object') {
      const key = clip(b.program.key, 40);
      if (!/^(p\d+|n[a-z0-9_]+|keep)$/.test(key)) return res.status(400).json({ error: 'برنامج غير معروف' });
      const cur = (o.programs = o.programs || {})[key] || {};
      for (const [k, n] of [['name', 160], ['kpi', 400], ['budget', 80]]) if (b.program[k] !== undefined) cur[k] = clip(b.program[k], n).trim();
      if (b.program.type !== undefined) cur.type = operational.TYPES[b.program.type] ? b.program.type : undefined;
      o.programs[key] = cur;
    }
    db.prepare('INSERT INTO school_ops (school_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(school_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(s.id, JSON.stringify(o), Date.now());
    res.json({ ops: opsOf(s) });
  });

  // ---------- متابعة التنفيذ: المواعيد والتأخير ورابط الفريق ----------
  const canTrack = (s) => ['improvement', 'nafis', 'operational', 'dashboard'].some((g) => license(s).grants.includes(g));
  const cleanRefs = (refs) => (Array.isArray(refs) ? refs : []).slice(0, 20).map((r) => ({ k: r && r.k === 'nafis' ? 'nafis' : 'plan', i: Number(r && r.i), j: Number(r && r.j) })).filter((r) => Number.isInteger(r.i) && Number.isInteger(r.j));
  // يطبق التعديل على كل الإجراءات في المراجع ويحفظ الخطتين
  function mutate(sid, refs, fn) {
    const plan = latestPlan(sid); const n = nafisOf(sid);
    const ctx = { plan, nafis: n.plan };
    let hit = 0;
    for (const r of refs) { const x = track.resolve(ctx, r); if (x) { fn(x); hit++; } }
    if (!hit) return 0;
    if (plan && refs.some((r) => r.k === 'plan')) savePlan(plan);
    if (n.plan && refs.some((r) => r.k === 'nafis')) saveNafis(sid, { card: n.card, plan: n.plan });
    return hit;
  }
  const setDone = (x, done, who, note) => {
    x.done = !!done; x.done_at = x.done ? Date.now() : null;
    x.done_by = x.done ? who.by : null; x.done_name = x.done ? clip(who.name, 80).trim() : '';
    if (note !== undefined) x.note = clip(note, 300).trim();
  };
  app.put('/api/school/track', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canTrack(s)) return res.status(402).json({ error: 'متابعة التنفيذ متاحة بعد تفعيل الباقة', code: 'license' });
    const b = req.body || {}; const refs = cleanRefs(b.refs);
    if (b.due !== undefined && b.due !== '' && track.parseDay(b.due) == null) return res.status(400).json({ error: 'تاريخ غير صحيح' });
    const ok = mutate(s.id, refs, (x) => {
      if (b.due !== undefined) x.due = b.due || '';
      if (b.done !== undefined) setDone(x, b.done, { by: 'principal', name: req.user.full_name || 'قائد المدرسة' }, b.note);
    });
    if (!ok) return res.status(404).json({ error: 'الإجراء غير موجود' });
    res.json({ ops: opsOf(s), plan: withPeople(latestPlan(s.id), s.id), nafis: nafisView(s.id) });
  });
  app.post('/api/school/schedule', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canTrack(s)) return res.status(402).json({ error: 'متابعة التنفيذ متاحة بعد تفعيل الباقة', code: 'license' });
    const b = req.body || {};
    const plan = latestPlan(s.id); const n = nafisOf(s.id);
    const count = track.schedule({ plan, nafis: n.plan }, b.start, b.end, !!b.force);
    if (!count && (track.parseDay(b.start) == null || track.parseDay(b.end) == null || track.parseDay(b.end) <= track.parseDay(b.start))) return res.status(400).json({ error: 'حدد تاريخ البداية والنهاية، والنهاية بعد البداية' });
    if (plan) savePlan(plan);
    if (n.plan) saveNafis(s.id, { card: n.card, plan: n.plan });
    res.json({ count, ops: opsOf(s), plan: withPeople(latestPlan(s.id), s.id) });
  });
  app.post('/api/school/team-link', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!canTrack(s)) return res.status(402).json({ error: 'رابط الفريق متاح بعد تفعيل الباقة', code: 'license' });
    const token = crypto.randomBytes(12).toString('base64url');
    db.prepare('UPDATE schools SET team_token = ? WHERE id = ?').run(token, s.id);
    res.json({ token });
  });
  const byToken = (t) => (/^[\w-]{12,40}$/.test(String(t || '')) ? db.prepare('SELECT * FROM schools WHERE team_token = ?').get(String(t)) : null);
  app.get('/t/:token', (req, res) => {
    const s = byToken(req.params.token);
    if (!s || !canTrack(s)) return res.status(404).type('html').send('<meta charset="utf-8"><p style="font-family:sans-serif;text-align:center;margin-top:60px">الرابط غير صالح أو تم تغييره. اطلب الرابط الجديد من قائد المدرسة.</p>');
    res.type('html').send(teamHtml({ school: s, token: req.params.token }));
  });
  app.get('/api/t/:token', (req, res) => {
    const s = byToken(req.params.token);
    if (!s || !canTrack(s)) return res.status(404).json({ error: 'الرابط غير صالح' });
    const ops = opsOf(s);
    if (!ops) return res.json({ school: s.name || '', programs: [] });
    res.json({ school: s.name || '', programs: ops.programs.map((p) => ({ key: p.key, name: p.name, type: p.type, responsible: p.responsible, procedures: p.procedures.filter((x) => x.refs).map((x) => ({ text: x.text, when: x.when, due: x.due || '', done: !!x.done, done_name: x.done_name || '', note: x.note || '', late: x.late, state: x.state, refs: x.refs })) })).filter((p) => p.procedures.length) });
  });
  app.put('/api/t/:token/track', (req, res) => {
    const s = byToken(req.params.token);
    if (!s || !canTrack(s)) return res.status(404).json({ error: 'الرابط غير صالح' });
    const b = req.body || {};
    const name = clip(b.name, 80).trim();
    if (b.done && name.length < 2) return res.status(400).json({ error: 'اكتب اسمك عشان يظهر من نفّذ' });
    const ok = mutate(s.id, cleanRefs(b.refs), (x) => setDone(x, b.done, { by: 'team', name }, b.note));
    if (!ok) return res.status(404).json({ error: 'الإجراء غير موجود' });
    res.json({ ok: true });
  });
  // تقرير الإنجاز الأسبوعي أو الشهري، وبطاقة QR للفريق
  app.get('/school/print/progress', (req, res) => {
    const u = currentUser(req);
    if (!u) return res.redirect('/school');
    const s = schoolOf(u.id);
    const ops = opsOf(s);
    if (!ops) return res.redirect('/school#/report');
    const period = req.query.p === 'month' ? 'month' : 'week';
    res.send(progressHtml({ school: s, rep: track.periodReport(ops, period), uploadsDir: UPLOADS }));
  });
  app.get('/school/print/team-card', async (req, res) => {
    const u = currentUser(req);
    if (!u) return res.redirect('/school');
    const s = schoolOf(u.id);
    if (!s.team_token) return res.redirect('/school#/ops');
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    res.send(await teamCardHtml({ school: s, url: `${base}/t/${s.team_token}`, uploadsDir: UPLOADS }));
  });

  mountBoard(app, { auth, currentUser, schoolOf, license, opsOf, uploadsDir: UPLOADS });

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
        out.push({ school_id: s.id, school: s.name || 'المدرسة', i, j, text: x.text, when: x.when, done: !!x.done, indicator: r.code, indicator_text: r.indicator, evidence: ev ? { id: ev.id, title: ev.title, code: ev.verify_code } : null, suggest: guessStandard(`${x.text} ${r.indicator || ''}`) || null, opinion: (r.opinions || {})[email] || null });
      }));
    }
    return out;
  }
  app.get('/api/my-tasks', auth, (req, res) => res.json({ tasks: myTasks(req.user) }));
  app.put('/api/my-tasks/:sid/:i/:j(\\d+)', auth, (req, res) => {
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

  // رأي المعلم في البرنامج (صف خطة التحسين) اللي هو مسند له فيه إجراء
  app.put('/api/my-tasks/:sid/:i/opinion', auth, (req, res) => {
    const email = String(req.user.email).toLowerCase();
    const sid = Number(req.params.sid);
    const p = latestPlan(sid);
    const row = p && p.rows[Number(req.params.i)];
    if (!row || !(row.procedures || []).some((x) => x && x.assignee === email)) return res.status(404).json({ error: 'ما عندك مهام في هذا البرنامج' });
    const b = req.body || {};
    const rating = Math.round(Number(b.rating));
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'اختر تقييم من 1 إلى 5' });
    row.opinions = row.opinions || {};
    row.opinions[email] = { rating, comment: clip(b.comment, 400).trim(), name: req.user.full_name || email, at: Date.now() };
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

  // ملف شواهد التقويم
  const ev = mountEvidence(app, { auth, currentUser, schoolOf, canPlan, members, latestPlan, uploads: UPLOADS });
  const base = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  app.get('/e/:token', (req, res) => {
    const s = ev.byToken(req.params.token);
    if (!s) return res.status(404).send('<!doctype html><meta charset="utf-8"><p dir="rtl" style="font-family:Tahoma;text-align:center;margin-top:20vh">الرابط غير صالح أو أوقفته المدرسة.</p>');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.send(publicHtml({ school: s, file: ev.build(s, latestPlan(s.id)), token: s.ev_token, base: base(req), uploadsDir: UPLOADS }));
  });
  function evGuard(req, res) {
    const u = currentUser(req);
    if (!u) { res.redirect('/school'); return null; }
    const s = schoolOf(u.id);
    const v = ev.view(s);
    return { s, file: v.file, link: v.link ? base(req) + v.link : null };
  }
  app.get('/school/print/evidence', async (req, res) => {
    const g = evGuard(req, res); if (!g) return;
    res.send(await evidenceHtml({ school: g.s, file: g.file, link: g.link, trial: !canPlan(g.s, 'evidence'), uploadsDir: UPLOADS }));
  });
  app.get('/school/export/evidence.docx', async (req, res) => {
    const g = evGuard(req, res); if (!g) return;
    if (!canPlan(g.s, 'evidence')) return res.redirect('/school#/license');
    const buf = await evidenceDocx({ school: g.s, file: g.file, link: g.link, uploadsDir: UPLOADS });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`ملف-شواهد-التقويم-${g.s.name || 'المدرسة'}.docx`)}`);
    res.send(buf);
  });

  // الخطة التشغيلية والعرض التقديمي
  function opsGuard(req, res) {
    const u = currentUser(req);
    if (!u) { res.redirect('/school'); return null; }
    const s = schoolOf(u.id);
    const report = latestReport(s.id);
    if (!report || !report.complete) { res.redirect('/school#/report'); return null; }
    return { s, report, ops: opsOf(s), full: canPlan(s, 'operational') };
  }
  app.get('/school/print/ops', (req, res) => {
    const g = opsGuard(req, res); if (!g) return;
    res.send(opsHtml({ school: g.s, report: g.report, ops: g.ops, trial: !g.full || g.ops.trial, uploadsDir: UPLOADS }));
  });
  app.get('/school/export/ops.docx', async (req, res) => {
    const g = opsGuard(req, res); if (!g) return;
    if (!g.full || g.ops.trial) return res.redirect('/school#/license');
    const buf = await opsDocx({ school: g.s, report: g.report, ops: g.ops, uploadsDir: UPLOADS });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`الخطة-التشغيلية-${g.s.name || 'المدرسة'}.docx`)}`);
    res.send(buf);
  });
  app.get('/school/print/deck', (req, res) => {
    const g = opsGuard(req, res); if (!g) return;
    const n = nafisOf(g.s.id);
    const file = ev.build(g.s, latestPlan(g.s.id));
    res.send(deckHtml({ school: g.s, report: g.report, ops: g.ops, nafisA: n.card ? nafis.analyze(n.card) : null, evidence: file.evidence ? file : null, trial: !g.full || g.ops.trial, uploadsDir: UPLOADS }));
  });

  // صفحة المدرسة مع وسوم المشاركة (رابط مطلق للصورة عشان واتساب)
  const schoolHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'school.html'), 'utf8');
  app.get('/school', (req, res) => {
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const t = 'معياري للمدرسة | خطة التحسين من تقرير التقويم المدرسي';
    const d = 'ارفع تقرير التقويم الذاتي، وتطلع لك خطة التحسين مرتبة من المؤشر الأضعف بصيغة Word وPDF، مع خطة نافس وملف شواهد التقويم.';
    const meta = `<meta name="description" content="${d}"><meta property="og:type" content="website"><meta property="og:locale" content="ar_SA"><meta property="og:site_name" content="معياري"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${base}/school"><meta property="og:image" content="${base}/assets/og-school.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">`;
    res.type('html').send(schoolHtml.replace('</title>', '</title>\n' + meta));
  });
}

module.exports = { mountSchool };
