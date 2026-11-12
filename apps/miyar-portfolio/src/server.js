const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { db, DATA_DIR } = require('./db');
const { STANDARDS, byId } = require('./standards');
const { draftEvidence, aiEnabled } = require('./ai');
const views = require('./views');
const { mountSchool } = require('./school/routes');
const { SCHOOL_PACKAGES } = require('./plans');

const PORT = Number(process.env.PORT || 3000);
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const { PLANS } = require('./plans');
const STORE_URL = process.env.STORE_URL || 'https://miyar.store';
const DAY = 86400000;
const UPLOADS = path.join(DATA_DIR, 'uploads');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

// ---------- أدوات ----------
const rand = (n = 8) => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(n);
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
};
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=').map(decodeURIComponent)).filter((p) => p[0]));
const baseUrl = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

function status(u) {
  const now = Date.now();
  const planActive = u.plan_ends > now;
  const trialActive = u.trial_ends > now;
  return {
    active: planActive || trialActive,
    plan: planActive ? 'paid' : trialActive ? 'trial' : 'expired',
    ends: planActive ? u.plan_ends : u.trial_ends,
    daysLeft: Math.max(0, Math.ceil(((planActive ? u.plan_ends : u.trial_ends) - now) / DAY)),
  };
}
const isAdmin = (u) => u && ADMIN_EMAILS.includes(u.email.toLowerCase());
const publicUser = (u) => {
  const { pass_hash, salt, ...rest } = u;
  return { ...rest, status: status(u), is_admin: isAdmin(u) };
};

function currentUser(req) {
  const sid = cookies(req).sid;
  if (!sid) return null;
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(sid) || null;
}
function auth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'سجّل الدخول أولاً' });
  req.user = u;
  next();
}
function active(req, res, next) {
  if (!status(req.user).active) return res.status(402).json({ error: 'انتهى اشتراكك. شواهدك محفوظة، جدّد بكود التفعيل لإكمال التوثيق.', code: 'expired' });
  next();
}
function admin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'غير مصرح' });
  next();
}
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, Date.now());
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 180}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
function evidenceRow(e) {
  return {
    ...e,
    goals: JSON.parse(e.goals || '[]'),
    links: JSON.parse(e.links || '[]'),
    files: db.prepare('SELECT id, original, mime, size FROM attachments WHERE evidence_id = ? ORDER BY id').all(e.id),
  };
}
const userEvidences = (uid) => db.prepare('SELECT * FROM evidences WHERE user_id = ? ORDER BY standard_id, ev_date DESC, id DESC').all(uid).map(evidenceRow);
const clip = (v, n) => String(v ?? '').slice(0, n);

// ---------- الحسابات ----------
app.post('/api/register', (req, res) => {
  const email = clip(req.body.email, 120).trim().toLowerCase();
  const password = String(req.body.password || '');
  const full_name = clip(req.body.full_name, 80).trim();
  const gender = req.body.gender === 'f' ? 'f' : 'm';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'البريد الإلكتروني غير صحيح' });
  if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور لازم تكون 6 أحرف على الأقل' });
  if (!full_name) return res.status(400).json({ error: 'اكتب اسمك' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'هذا البريد مسجّل مسبقاً، سجّل دخولك' });
  const salt = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const info = db.prepare(`INSERT INTO users (email, pass_hash, salt, full_name, gender, job_title, slug, verify_code, trial_ends, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(email, hash(password, salt), salt, full_name, gender, gender === 'f' ? 'معلمة' : 'معلم',
    'm' + rand(6).toLowerCase(), rand(10), now + TRIAL_DAYS * DAY, now);
  startSession(res, info.lastInsertRowid);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const email = clip(req.body.email, 120).trim().toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!u || hash(String(req.body.password || ''), u.salt) !== u.pass_hash) return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  startSession(res, u.id);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const sid = cookies(req).sid;
  if (sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user), standards: STANDARDS.map(({ keywords, ...s }) => s), ai: aiEnabled(), storeUrl: STORE_URL, plans: PLANS, base: baseUrl(req) });
});

const PROFILE_FIELDS = { full_name: 80, gender: 1, job_title: 40, subject: 60, school: 100, stage: 40, office: 80, principal: 80, bio: 400, year: 20, theme: 20 };
app.put('/api/me', auth, (req, res) => {
  const b = req.body;
  const sets = [];
  const vals = [];
  for (const [k, n] of Object.entries(PROFILE_FIELDS)) {
    if (b[k] !== undefined) { sets.push(`${k} = ?`); vals.push(clip(b[k], n).trim()); }
  }
  if (b.is_public !== undefined) { sets.push('is_public = ?'); vals.push(b.is_public ? 1 : 0); }
  if (b.slug !== undefined) {
    const slug = String(b.slug).trim().toLowerCase();
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) return res.status(400).json({ error: 'الرابط لازم يكون حروف إنجليزية صغيرة أو أرقام (3 إلى 30)' });
    const taken = db.prepare('SELECT id FROM users WHERE slug = ? AND id != ?').get(slug, req.user.id);
    if (taken) return res.status(409).json({ error: 'هذا الرابط مستخدم، اختر غيره' });
    sets.push('slug = ?'); vals.push(slug);
  }
  if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

app.post('/api/password', auth, (req, res) => {
  const { current, next: nw } = req.body;
  if (hash(String(current || ''), req.user.salt) !== req.user.pass_hash) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  if (String(nw || '').length < 6) return res.status(400).json({ error: 'كلمة المرور الجديدة قصيرة' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').run(hash(nw, salt), salt, req.user.id);
  res.json({ ok: true });
});

// ---------- التفعيل ----------
app.post('/api/redeem', auth, (req, res) => {
  const code = clip(req.body.code, 40).trim().toUpperCase().replace(/\s/g, '');
  const row = db.prepare('SELECT * FROM codes WHERE code = ?').get(code);
  if (!row) return res.status(404).json({ error: 'الكود غير صحيح' });
  if (row.product && row.product !== 'portfolio') return res.status(400).json({ error: 'هذا كود باقة مدرسة، فعّله من صفحة معياري للمدرسة' });
  if (row.redeemed_by) return res.status(409).json({ error: 'هذا الكود مستخدم مسبقاً' });
  const startFrom = Math.max(Date.now(), req.user.plan_ends);
  const ends = startFrom + row.days * DAY;
  db.prepare('UPDATE codes SET redeemed_by = ?, redeemed_at = ? WHERE code = ?').run(req.user.id, Date.now(), code);
  db.prepare('UPDATE users SET plan_ends = ? WHERE id = ?').run(ends, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

// ---------- الشواهد ----------
function readEvidence(b) {
  const sid = Number(b.standard_id);
  if (!byId(sid)) throw new Error('اختر عنصر التقييم');
  const title = clip(b.title, 160).trim();
  if (!title) throw new Error('اكتب عنوان الشاهد');
  const goals = (Array.isArray(b.goals) ? b.goals : String(b.goals || '').split('\n')).map((g) => clip(g, 200).trim()).filter(Boolean).slice(0, 8);
  const links = (Array.isArray(b.links) ? b.links : String(b.links || '').split('\n')).map((l) => clip(l, 500).trim()).filter((l) => /^https?:\/\//.test(l)).slice(0, 8);
  return {
    standard_id: sid, title, goals: JSON.stringify(goals), links: JSON.stringify(links),
    description: clip(b.description, 3000), steps: clip(b.steps, 3000), impact: clip(b.impact, 1500), ev_date: clip(b.ev_date, 20),
  };
}

app.get('/api/evidences', auth, (req, res) => res.json({ evidences: userEvidences(req.user.id) }));

app.post('/api/evidences', auth, active, (req, res) => {
  let e;
  try { e = readEvidence(req.body); } catch (err) { return res.status(400).json({ error: err.message }); }
  const now = Date.now();
  const info = db.prepare(`INSERT INTO evidences (user_id, standard_id, title, goals, description, steps, impact, ev_date, links, verify_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, e.standard_id, e.title, e.goals, e.description, e.steps, e.impact, e.ev_date, e.links, rand(10), now, now);
  res.json({ evidence: evidenceRow(db.prepare('SELECT * FROM evidences WHERE id = ?').get(info.lastInsertRowid)) });
});

app.put('/api/evidences/:id', auth, active, (req, res) => {
  const own = db.prepare('SELECT id FROM evidences WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!own) return res.status(404).json({ error: 'الشاهد غير موجود' });
  let e;
  try { e = readEvidence(req.body); } catch (err) { return res.status(400).json({ error: err.message }); }
  db.prepare(`UPDATE evidences SET standard_id=?, title=?, goals=?, description=?, steps=?, impact=?, ev_date=?, links=?, updated_at=? WHERE id=?`)
    .run(e.standard_id, e.title, e.goals, e.description, e.steps, e.impact, e.ev_date, e.links, Date.now(), own.id);
  res.json({ evidence: evidenceRow(db.prepare('SELECT * FROM evidences WHERE id = ?').get(own.id)) });
});

app.delete('/api/evidences/:id', auth, (req, res) => {
  const own = db.prepare('SELECT id FROM evidences WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!own) return res.status(404).json({ error: 'الشاهد غير موجود' });
  for (const f of db.prepare('SELECT stored FROM attachments WHERE evidence_id = ?').all(own.id)) fs.rm(path.join(UPLOADS, f.stored), () => {});
  db.prepare('DELETE FROM evidences WHERE id = ?').run(own.id);
  res.json({ ok: true });
});

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
});

app.post('/api/evidences/:id/files', auth, active, (req, res, next) => {
  const own = db.prepare('SELECT id FROM evidences WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!own) return res.status(404).json({ error: 'الشاهد غير موجود' });
  req.evidenceId = own.id;
  next();
}, upload.array('files', 8), (req, res) => {
  const ins = db.prepare('INSERT INTO attachments (evidence_id, user_id, stored, original, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const f of req.files || []) ins.run(req.evidenceId, req.user.id, f.filename, Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 120), f.mimetype, f.size, Date.now());
  res.json({ evidence: evidenceRow(db.prepare('SELECT * FROM evidences WHERE id = ?').get(req.evidenceId)) });
});

app.delete('/api/files/:id', auth, (req, res) => {
  const f = db.prepare('SELECT * FROM attachments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!f) return res.status(404).json({ error: 'الملف غير موجود' });
  fs.rm(path.join(UPLOADS, f.stored), () => {});
  db.prepare('DELETE FROM attachments WHERE id = ?').run(f.id);
  res.json({ ok: true });
});

app.get('/files/:id', (req, res) => {
  const f = db.prepare('SELECT a.*, u.is_public FROM attachments a JOIN users u ON u.id = a.user_id WHERE a.id = ?').get(req.params.id);
  if (!f) return res.status(404).end();
  const u = currentUser(req);
  if (!f.is_public && (!u || u.id !== f.user_id)) return res.status(403).end();
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(path.join(UPLOADS, f.stored));
});

// ---------- المساعد الذكي ----------
app.post('/api/ai/draft', auth, active, async (req, res) => {
  const idea = clip(req.body.idea, 500).trim();
  if (idea.length < 3) return res.status(400).json({ error: 'اكتب فكرة الشاهد بكلمتين على الأقل' });
  const day = new Date().toISOString().slice(0, 10);
  const used = db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?').get(req.user.id, day)?.count || 0;
  if (used >= AI_DAILY_LIMIT) return res.status(429).json({ error: 'وصلت للحد اليومي للمساعد الذكي، جرّب بكرة' });
  db.prepare('INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1').run(req.user.id, day);
  const draft = await draftEvidence(idea, { subject: req.user.subject, stage: req.user.stage, gender: req.user.gender, standard_id: req.body.standard_id });
  res.json({ draft });
});

// ---------- الإدارة ----------
app.get('/api/admin/stats', auth, admin, (req, res) => {
  const q = (s) => db.prepare(s).get().n;
  const now = Date.now();
  res.json({
    users: q('SELECT COUNT(*) n FROM users'),
    paid: db.prepare('SELECT COUNT(*) n FROM users WHERE plan_ends > ?').get(now).n,
    trial: db.prepare('SELECT COUNT(*) n FROM users WHERE plan_ends <= ? AND trial_ends > ?').get(now, now).n,
    evidences: q('SELECT COUNT(*) n FROM evidences'),
    codesFree: q('SELECT COUNT(*) n FROM codes WHERE redeemed_by IS NULL'),
    codesUsed: q('SELECT COUNT(*) n FROM codes WHERE redeemed_by IS NOT NULL'),
    recent: db.prepare('SELECT id, full_name, email, school, created_at, trial_ends, plan_ends FROM users ORDER BY id DESC LIMIT 20').all(),
  });
});
app.post('/api/admin/codes', auth, admin, (req, res) => {
  const count = Math.min(500, Math.max(1, Number(req.body.count) || 10));
  const days = Math.min(1100, Math.max(1, Number(req.body.days) || 365));
  const note = clip(req.body.note, 60);
  const product = SCHOOL_PACKAGES.some((p) => p.id === req.body.product) ? req.body.product : 'portfolio';
  const prefix = product === 'portfolio' ? 'MYR' : 'SCH';
  const ins = db.prepare('INSERT INTO codes (code, days, note, product, created_at) VALUES (?, ?, ?, ?, ?)');
  const out = [];
  for (let i = 0; i < count; i++) { const c = `${prefix}-${rand(4)}-${rand(4)}`; ins.run(c, days, note, product, Date.now()); out.push(c); }
  res.json({ codes: out });
});
app.get('/api/admin/codes.csv', auth, admin, (req, res) => {
  const rows = db.prepare('SELECT c.*, u.email FROM codes c LEFT JOIN users u ON u.id = c.redeemed_by ORDER BY c.created_at DESC').all();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="miyar-codes.csv"');
  res.send('﻿code,product,days,note,status,redeemed_by\n' + rows.map((r) => [r.code, r.product, r.days, r.note, r.redeemed_by ? 'used' : 'free', r.email || ''].join(',')).join('\n'));
});

// ---------- الصفحات العامة والتقارير ----------
app.get('/p/:slug', async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE slug = ?').get(String(req.params.slug).toLowerCase());
  const viewer = currentUser(req);
  if (!u || (!u.is_public && (!viewer || viewer.id !== u.id))) return res.status(404).send(views.notFound());
  res.send(await views.publicPage(u, userEvidences(u.id), baseUrl(req), viewer && viewer.id === u.id));
});

app.get('/v/:code/:std?', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const ev = db.prepare('SELECT e.*, u.full_name, u.job_title, u.school, u.slug, u.is_public FROM evidences e JOIN users u ON u.id = e.user_id WHERE e.verify_code = ?').get(code);
  if (ev) return res.send(views.verifyPage({ kind: 'evidence', ev, std: byId(ev.standard_id), base: baseUrl(req) }));
  const u = db.prepare('SELECT * FROM users WHERE verify_code = ?').get(code);
  if (!u) return res.status(404).send(views.verifyPage({ kind: 'invalid' }));
  const std = req.params.std ? byId(req.params.std) : null;
  const evs = userEvidences(u.id).filter((e) => !std || e.standard_id === std.id);
  res.send(views.verifyPage({ kind: std ? 'standard' : 'portfolio', u, std, count: evs.length, stdCount: new Set(evs.map((e) => e.standard_id)).size, base: baseUrl(req) }));
});

function printGuard(req, res) {
  const u = currentUser(req);
  if (!u) { res.redirect('/app'); return null; }
  if (!status(u).active) { res.status(402).send(views.message('انتهى اشتراكك', 'شواهدك محفوظة. جدّد بكود التفعيل حتى تقدر تطبع التقارير.', '/app#/subscription')); return null; }
  return u;
}
app.get('/print/portfolio', async (req, res) => {
  const u = printGuard(req, res); if (!u) return;
  res.send(await views.printReport({ u, evs: userEvidences(u.id), template: req.query.t === 'modern' ? 'modern' : 'classic', base: baseUrl(req), scope: 'portfolio' }));
});
app.get('/print/standard/:std', async (req, res) => {
  const u = printGuard(req, res); if (!u) return;
  const std = byId(req.params.std); if (!std) return res.status(404).send(views.notFound());
  res.send(await views.printReport({ u, evs: userEvidences(u.id).filter((e) => e.standard_id === std.id), template: req.query.t === 'modern' ? 'modern' : 'classic', base: baseUrl(req), scope: 'standard', std }));
});
app.get('/print/evidence/:id', async (req, res) => {
  const u = printGuard(req, res); if (!u) return;
  const e = userEvidences(u.id).find((x) => x.id === Number(req.params.id));
  if (!e) return res.status(404).send(views.notFound());
  res.send(await views.printReport({ u, evs: [e], template: req.query.t === 'modern' ? 'modern' : 'classic', base: baseUrl(req), scope: 'evidence' }));
});

mountSchool(app, { auth, currentUser });

app.get('/', (req, res) => res.send(views.landing(STORE_URL, TRIAL_DAYS, PLANS)));
app.use('/assets', express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'app.html')));
app.use((req, res) => res.status(404).send(views.notFound()));

app.listen(PORT, () => console.log(`معياري للمعلم يعمل على http://localhost:${PORT} (AI: ${aiEnabled() ? 'Claude' : 'قوالب'})`));
