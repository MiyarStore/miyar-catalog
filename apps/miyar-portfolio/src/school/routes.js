// مسارات «خطط معيار»: ملف المدرسة، التقرير، خطة التحسين، الترخيص، التصدير.
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db, DATA_DIR } = require('../db');
const { SCHOOL_PACKAGES } = require('../plans');
const { catalog } = require('./indicators');
const { readPdf, normalize, readerEnabled } = require('./report');
const { buildPlan } = require('./plan');
const { printHtml, planDocx } = require('./export');

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
      plan: latestPlan(s.id),
      reader: readerEnabled(),
      packages: SCHOOL_PACKAGES,
      catalog: { basic: catalog('basic'), secondary: catalog('secondary') },
      usage: { plans: used(s.id, 'plan'), planLimit: YEAR_PLAN_LIMIT, trialRows: TRIAL_ROWS },
      store: process.env.STORE_URL || 'https://miyar.store',
    });
  });

  const FIELDS = { name: 120, stage: 10, gender: 10, office: 120, principal: 80, year: 20 };
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

  // حفظ التقرير بعد المراجعة
  app.put('/api/school/report', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const r = normalize(req.body || {});
    const filled = r.indicators.filter((i) => i.pct != null).length;
    if (filled < 1) return res.status(400).json({ error: 'أدخل نسبة مؤشر واحد على الأقل' });
    const data = JSON.stringify(r);
    const src = req.body.source === 'ai' ? 'ai' : 'manual';
    const last = db.prepare('SELECT id FROM school_reports WHERE school_id = ? ORDER BY id DESC LIMIT 1').get(s.id);
    if (last) db.prepare('UPDATE school_reports SET data = ?, source = ?, updated_at = ? WHERE id = ?').run(data, src, Date.now(), last.id);
    else db.prepare('INSERT INTO school_reports (school_id, data, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(s.id, data, src, Date.now(), Date.now());
    // نعبّي ملف المدرسة من التقرير إذا كانت الحقول فاضية
    const fill = { name: r.school_name, office: r.office, gender: r.gender, stage: r.stage };
    for (const [k, v] of Object.entries(fill)) if (v && (!s[k] || k === 'stage')) db.prepare(`UPDATE schools SET ${k} = ? WHERE id = ?`).run(v, s.id);
    if (r.ministry_number && !s.ministry_number && /^S-[A-Z]?\d{3,10}$/.test(r.ministry_number) && !db.prepare('SELECT id FROM schools WHERE ministry_number = ?').get(r.ministry_number)) db.prepare('UPDATE schools SET ministry_number = ? WHERE id = ?').run(r.ministry_number, s.id);
    res.json({ report: latestReport(s.id), school: publicSchool(db.prepare('SELECT * FROM schools WHERE id = ?').get(s.id)) });
  });

  // توليد خطة التحسين
  app.post('/api/school/plan', auth, async (req, res) => {
    const s = schoolOf(req.user.id);
    const report = latestReport(s.id);
    if (!report) return res.status(400).json({ error: 'ارفع تقرير التقويم أولاً' });
    if (!report.complete) return res.status(400).json({ error: 'أكمل نسب كل المؤشرات قبل بناء الخطة' });
    const full = canPlan(s);
    if (full && used(s.id, 'plan') >= YEAR_PLAN_LIMIT) return res.status(429).json({ error: 'وصلت للحد السنوي لتوليد الخطط. عدّل على خطتك الحالية أو تواصل معنا.' });
    if (!full && used(s.id, 'trial') >= 3) return res.status(402).json({ error: 'انتهت محاولات التجربة. فعّل باقة المدرسة لتحصل على الخطة كاملة.', code: 'license' });
    const plan = await buildPlan(report, { limit: full ? 0 : TRIAL_ROWS });
    plan.trial = !full;
    bump(s.id, full ? 'plan' : 'trial');
    const { usage, ...data } = plan;
    db.prepare('INSERT INTO school_plans (school_id, report_id, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(s.id, report.id, 'improvement', JSON.stringify(data), Date.now(), Date.now());
    res.json({ plan: latestPlan(s.id) });
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
    if (b.procedures !== undefined) row.procedures = list(b.procedures, 10);
    if (b.responsible !== undefined) row.responsible = clip(b.responsible, 200);
    if (b.from !== undefined) row.from = clip(b.from, 60);
    if (b.to !== undefined) row.to = clip(b.to, 60);
    if (b.measure !== undefined) row.measure = clip(b.measure, 400);
    if (b.evidence !== undefined) row.evidence = list(b.evidence, 8);
    const { id, report_id, updated_at, ...data } = p;
    db.prepare('UPDATE school_plans SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data), Date.now(), id);
    res.json({ plan: latestPlan(s.id) });
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
    const plan = latestPlan(s.id);
    if (!report || !plan) { res.redirect('/school#/plan'); return null; }
    return { s, report, plan };
  }
  app.get('/school/print/plan', (req, res) => {
    const g = exportGuard(req, res); if (!g) return;
    res.send(printHtml({ school: g.s, report: g.report, plan: g.plan, trial: !canPlan(g.s) || g.plan.trial, uploadsDir: UPLOADS }));
  });
  app.get('/school/export/plan.docx', async (req, res) => {
    const g = exportGuard(req, res); if (!g) return;
    if (!canPlan(g.s) || g.plan.trial) return res.redirect('/school#/license');
    const buf = await planDocx({ school: g.s, report: g.report, plan: g.plan, uploadsDir: UPLOADS });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`خطة-التحسين-${g.s.name || 'المدرسة'}.docx`)}`);
    res.send(buf);
  });

  app.get('/school', (req, res) => res.sendFile(path.join(__dirname, '..', '..', 'public', 'school.html')));
}

module.exports = { mountSchool };
