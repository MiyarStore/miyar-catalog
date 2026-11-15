// «ملف شواهد التقويم»: شواهد المدرسة مرتبة تحت مؤشرات التقويم المدرسي، مع نسبة التغطية،
// ورابط واحد للمقيّم (باركود) يفتح الملف كامل للقراءة فقط.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db } = require('../db');
const { catalog, DOMAINS, STANDARDS } = require('./indicators');
const { KINDS, suggestionsFor } = require('./evidence-bank');

const TRIAL_EVIDENCE = Number(process.env.SCHOOL_TRIAL_EVIDENCE || 5);
const MAX_EVIDENCE = Number(process.env.SCHOOL_MAX_EVIDENCE || 800);
const MIMES = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};
const clip = (v, n) => String(v ?? '').slice(0, n).trim();
// اسم الملف: بعض المتصفحات ترسله UTF-8 وبعضها يوصل مقروءاً كـ latin1
const fixName = (n) => (/[^\u0000-\u00ff]/.test(n) ? n : Buffer.from(n, 'latin1').toString('utf8'));
const URL_RE = /^https?:\/\/[^\s]+$/i;

db.exec(`CREATE TABLE IF NOT EXISTS school_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  item INTEGER NOT NULL DEFAULT -1,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'doc',
  note TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  stored TEXT, original TEXT, mime TEXT, size INTEGER,
  evidence_id INTEGER,
  created_at INTEGER NOT NULL
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_sev_school ON school_evidence(school_id, code)');
try { db.exec('ALTER TABLE schools ADD COLUMN ev_token TEXT'); } catch {}

const rows = (sid) => db.prepare('SELECT * FROM school_evidence WHERE school_id = ? ORDER BY id').all(sid);
// شواهد المعلمين المرتبطة بإجراءات خطة التحسين تنضاف تلقائياً تحت مؤشرها
function planLinks(plan) {
  const out = [];
  for (const r of (plan && plan.rows) || []) for (const p of r.procedures || []) {
    if (typeof p !== 'object' || !p.evidence_id) continue;
    const e = db.prepare('SELECT e.id, e.title, e.verify_code, u.full_name FROM evidences e JOIN users u ON u.id = e.user_id WHERE e.id = ?').get(p.evidence_id);
    if (e) out.push({ code: r.code, title: e.title, teacher: e.full_name, verify: e.verify_code, proc: p.text, source: 'plan' });
  }
  return out;
}
const pub = (x) => {
  let teacher = null;
  if (x.evidence_id) {
    const e = db.prepare('SELECT e.title, e.verify_code, u.full_name FROM evidences e JOIN users u ON u.id = e.user_id WHERE e.id = ?').get(x.evidence_id);
    teacher = e ? { title: e.title, verify: e.verify_code, name: e.full_name } : { title: 'شاهد محذوف من ملف المعلم', verify: null, name: '' };
  }
  return { id: x.id, code: x.code, item: x.item, title: x.title, kind: x.kind, kind_name: KINDS[x.kind] || KINDS.doc, note: x.note, url: x.url, file: x.stored ? { name: x.original, mime: x.mime, size: x.size } : null, teacher, created_at: x.created_at };
};

// التغطية: المؤشر مغطى إذا تحته شاهد واحد على الأقل
function build(school, plan) {
  const stage = school.stage === 'secondary' ? 'secondary' : 'basic';
  const all = rows(school.id).map(pub);
  const links = planLinks(plan);
  const inds = catalog(stage).map((ind) => {
    const items = all.filter((x) => x.code === ind.code);
    const auto = links.filter((x) => x.code === ind.code);
    const sugg = suggestionsFor(ind.code, stage).map((s) => ({ ...s, kind_name: KINDS[s.kind], done: items.some((x) => x.item === s.i) }));
    const n = items.length + auto.length;
    return { ...ind, suggestions: sugg, items, auto, count: n, covered: n > 0, sugg_done: sugg.filter((s) => s.done).length };
  });
  const group = (key, list) => list.map((g) => {
    const xs = inds.filter((i) => i[key] === g.code);
    const c = xs.filter((i) => i.covered).length;
    return { code: g.code, name: g.name, total: xs.length, covered: c, pct: xs.length ? Math.round((c / xs.length) * 100) : 0, evidence: xs.reduce((a, i) => a + i.count, 0) };
  }).filter((g) => g.total);
  const covered = inds.filter((i) => i.covered).length;
  const types = {};
  for (const x of all) types[x.kind] = (types[x.kind] || 0) + 1;
  return {
    stage, indicators: inds,
    domains: group('domain', DOMAINS), standards: group('standard', STANDARDS),
    total: inds.length, covered, pct: inds.length ? Math.round((covered / inds.length) * 100) : 0,
    evidence: all.length + links.length, uploaded: all.length, from_plan: links.length, types,
    missing: inds.filter((i) => !i.covered).map((i) => i.code),
  };
}

function mountEvidence(app, { auth, currentUser, schoolOf, canPlan, members, latestPlan, uploads }) {
  const ok = (s) => canPlan(s, 'evidence');
  const view = (s) => ({ file: build(s, latestPlan(s.id)), kinds: KINDS, licensed: ok(s), trial_limit: TRIAL_EVIDENCE, link: s.ev_token && ok(s) ? `/e/${s.ev_token}` : null });
  const fileUpload = multer({
    storage: multer.diskStorage({ destination: uploads, filename: (req, f, cb) => cb(null, `sev-${crypto.randomBytes(10).toString('hex')}${MIMES[f.mimetype] || ''}`) }),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (req, f, cb) => cb(null, !!MIMES[f.mimetype]),
  });
  const rm = (stored) => { if (stored) fs.rm(path.join(uploads, stored), () => {}); };

  app.get('/api/school/evidence', auth, (req, res) => res.json(view(schoolOf(req.user.id))));

  app.post('/api/school/evidence', auth, (req, res) => {
    fileUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'الملف لازم يكون PDF أو صورة أو Word أو Excel أو PowerPoint، وحجمه أقل من 10MB' });
      const s = schoolOf(req.user.id);
      const b = req.body || {};
      const fail = (status, error, code) => { rm(req.file && req.file.filename); res.status(status).json({ error, code }); };
      const stage = s.stage === 'secondary' ? 'secondary' : 'basic';
      const code = clip(b.code, 12);
      if (!catalog(stage).some((i) => i.code === code)) return fail(400, 'المؤشر غير معروف');
      const n = db.prepare('SELECT COUNT(*) n FROM school_evidence WHERE school_id = ?').get(s.id).n;
      if (!ok(s) && n >= TRIAL_EVIDENCE) return fail(402, `التجربة المجانية تسمح بـ ${TRIAL_EVIDENCE} شواهد. فعّل باقة ملف الشواهد وأضف بدون حد.`, 'license');
      if (n >= MAX_EVIDENCE) return fail(400, 'وصلت الحد الأعلى لعدد الشواهد. احذف المكرر أو تواصل معنا.');
      const url = clip(b.url, 500);
      if (url && !URL_RE.test(url)) return fail(400, 'الرابط لازم يبدأ بـ https://');
      let evidenceId = null;
      if (b.evidence_id) {
        // شاهد من ملف معلم في فريق المدرسة
        const e = db.prepare('SELECT e.id, u.email FROM evidences e JOIN users u ON u.id = e.user_id WHERE e.id = ?').get(Number(b.evidence_id));
        const team = new Set(members(s.id).map((m) => m.email));
        if (!e || !team.has(String(e.email).toLowerCase())) return fail(400, 'الشاهد مو من ملفات فريق المدرسة');
        evidenceId = e.id;
      }
      if (!req.file && !url && !evidenceId && !clip(b.note, 10)) return fail(400, 'أرفق ملفاً أو رابطاً أو اكتب وصفاً للشاهد');
      const item = Number.isInteger(Number(b.item)) && suggestionsFor(code, stage)[Number(b.item)] ? Number(b.item) : -1;
      const sugg = item >= 0 ? suggestionsFor(code, stage)[item] : null;
      const title = clip(b.title, 200) || (sugg && sugg.title) || (req.file && fixName(req.file.originalname)) || 'شاهد';
      const kind = KINDS[b.kind] ? b.kind : (sugg ? sugg.kind : 'doc');
      const f = req.file;
      db.prepare('INSERT INTO school_evidence (school_id, code, item, title, kind, note, url, stored, original, mime, size, evidence_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(s.id, code, item, title, kind, clip(b.note, 1000), url, f ? f.filename : null, f ? clip(fixName(f.originalname), 200) : null, f ? f.mimetype : null, f ? f.size : null, evidenceId, Date.now());
      res.json(view(s));
    });
  });

  app.delete('/api/school/evidence/:id', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const x = db.prepare('SELECT * FROM school_evidence WHERE id = ? AND school_id = ?').get(Number(req.params.id), s.id);
    if (!x) return res.status(404).json({ error: 'الشاهد غير موجود' });
    db.prepare('DELETE FROM school_evidence WHERE id = ?').run(x.id);
    rm(x.stored);
    res.json(view(s));
  });

  // شواهد المعلمين المسجلين في فريق المدرسة (للربط بدل الرفع مرة ثانية)
  app.get('/api/school/evidence/teachers', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    const emails = members(s.id).filter((m) => m.joined).map((m) => m.email);
    if (!emails.length) return res.json({ evidences: [] });
    const list = db.prepare(`SELECT e.id, e.title, e.ev_date, e.verify_code, u.full_name FROM evidences e JOIN users u ON u.id = e.user_id WHERE lower(u.email) IN (${emails.map(() => '?').join(',')}) ORDER BY e.id DESC LIMIT 300`).all(...emails);
    res.json({ evidences: list });
  });

  // رابط المقيّم: يتفعل مع الباقة، وتقدر المدرسة توقفه أو تغيّره
  app.post('/api/school/evidence/link', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    if (!ok(s)) return res.status(402).json({ error: 'رابط المقيّم يتفعل مع باقة ملف الشواهد', code: 'license' });
    const act = req.body && req.body.action;
    const token = act === 'off' ? null : act === 'reset' || !s.ev_token ? crypto.randomBytes(12).toString('base64url') : s.ev_token;
    db.prepare('UPDATE schools SET ev_token = ? WHERE id = ?').run(token, s.id);
    res.json(view(db.prepare('SELECT * FROM schools WHERE id = ?').get(s.id)));
  });

  const sendFile = (res, x) => {
    if (!x || !x.stored) return res.status(404).send('الملف غير موجود');
    res.setHeader('Content-Type', x.mime);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(x.original || 'file')}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.join(uploads, x.stored));
  };
  app.get('/school/evidence/file/:id', (req, res) => {
    const u = currentUser(req);
    if (!u) return res.status(401).send('سجّل دخولك');
    const s = schoolOf(u.id);
    sendFile(res, db.prepare('SELECT * FROM school_evidence WHERE id = ? AND school_id = ?').get(Number(req.params.id), s.id));
  });
  const byToken = (t) => {
    const s = t && db.prepare('SELECT * FROM schools WHERE ev_token = ?').get(String(t));
    return s && ok(s) ? s : null;
  };
  app.get('/e/:token/f/:id', (req, res) => {
    const s = byToken(req.params.token);
    if (!s) return res.status(404).send('الرابط غير صالح');
    sendFile(res, db.prepare('SELECT * FROM school_evidence WHERE id = ? AND school_id = ?').get(Number(req.params.id), s.id));
  });
  return { build, byToken, view };
}

module.exports = { mountEvidence, build, KINDS, TRIAL_EVIDENCE };
