// التنبيهات: مركز تنبيهات داخل التطبيق + إشعارات الجوال (Web Push).
// كل تنبيه له مفتاح فريد لكل مستخدم، فما يتكرر نفس التذكير مرتين.
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { db, DATA_DIR } = require('./db');
const J = require('./journey');

db.exec(`CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  read_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, key)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at)');

// مفاتيح VAPID: من متغيرات البيئة إن وجدت، وإلا تتولد مرة وحدة وتنحفظ في مجلد البيانات (المساحة الدائمة).
function vapid() {
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) return { publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE };
  const f = path.join(DATA_DIR, 'vapid.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const k = webpush.generateVAPIDKeys();
  try { fs.writeFileSync(f, JSON.stringify(k), { mode: 0o600 }); } catch {}
  return k;
}
const KEYS = vapid();
webpush.setVapidDetails(process.env.PUBLIC_URL || 'https://miyariapp.com', KEYS.publicKey, KEYS.privateKey);

async function push(userId, msg) {
  const subs = db.prepare('SELECT * FROM push_subs WHERE user_id = ?').all(userId);
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url || '/app' });
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 }); }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) db.prepare('DELETE FROM push_subs WHERE id = ?').run(s.id); }
  }));
}

// يضيف تنبيه (لو ما انضاف قبل بنفس المفتاح) ويرسله للجوال. يرجع true لو انضاف.
function add(userId, key, msg) {
  const r = db.prepare('INSERT OR IGNORE INTO notifications (user_id, key, title, body, url, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, key, msg.title, msg.body || '', msg.url || '', Date.now());
  if (r.changes) push(userId, msg).catch(() => {});
  return !!r.changes;
}

const counts = (userId) => Object.fromEntries(db.prepare('SELECT standard_id, COUNT(*) n FROM evidences WHERE user_id = ? GROUP BY standard_id').all(userId).map((r) => [r.standard_id, r.n]));
const journeyOf = (u) => J.plan({ role: u.role, region: u.region, counts: counts(u.id), since: u.created_at });

// رقم الأسبوع (يبدأ الأحد) بتوقيت السعودية: مفتاح التذكير الأسبوعي
const KSA = 3 * 3600000;
function weekKey(t = Date.now()) { const d = new Date(t + KSA); const sun = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - d.getUTCDay() * 86400000; return new Date(sun).toISOString().slice(0, 10); }

// يفحص مستخدم واحد: تهنئة الاكتمال، والتذكير الأسبوعي (مرة في الأسبوع، من الساعة 7 صباحاً يوم الأحد أو بعده).
function check(u, now = Date.now()) {
  const p = journeyOf(u);
  if (p.complete) { add(u.id, 'complete', J.completeMessage(u.gender)); return p; }
  const local = new Date(now + KSA);
  const ready = local.getUTCDay() > 0 || local.getUTCHours() >= 7;
  if (p.started && ready && now - u.created_at > 2 * 86400000) {
    const m = J.weeklyMessage(p, u.gender);
    if (m) add(u.id, `week:${weekKey(now)}`, m);
  }
  return p;
}

// يمر على كل المشتركين النشطين (تجربة أو اشتراك). نتجاهل أيام الجمعة والسبت.
function tick(now = Date.now()) {
  const day = new Date(now + KSA).getUTCDay();
  if (day === 5 || day === 6) return 0;
  const users = db.prepare('SELECT id, role, region, gender, created_at FROM users WHERE plan_ends > ? OR trial_ends > ?').all(now, now);
  for (const u of users) { try { check(u, now); } catch {} }
  return users.length;
}
function start() {
  setTimeout(() => tick(), 60 * 1000).unref();
  setInterval(() => tick(), 60 * 60 * 1000).unref();
}

function routes(app, auth) {
  app.get('/api/journey', auth, (req, res) => {
    const p = journeyOf(req.user);
    if (p.complete) add(req.user.id, 'complete', J.completeMessage(req.user.gender));
    res.json({ journey: p });
  });
  app.get('/api/notifications', auth, (req, res) => {
    const items = db.prepare('SELECT id, title, body, url, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user.id);
    const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at = 0').get(req.user.id).n;
    const subs = db.prepare('SELECT COUNT(*) n FROM push_subs WHERE user_id = ?').get(req.user.id).n;
    res.json({ items, unread, push: { key: KEYS.publicKey, subs } });
  });
  app.post('/api/notifications/read', auth, (req, res) => {
    db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at = 0').run(Date.now(), req.user.id);
    res.json({ ok: true });
  });
  app.post('/api/push/subscribe', auth, (req, res) => {
    const s = req.body || {};
    const k = s.keys || {};
    if (!/^https:\/\//.test(String(s.endpoint || '')) || !k.p256dh || !k.auth) return res.status(400).json({ error: 'اشتراك غير صالح' });
    db.prepare('INSERT INTO push_subs (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth')
      .run(req.user.id, String(s.endpoint), String(k.p256dh), String(k.auth), Date.now());
    add(req.user.id, 'push-on', { title: 'تم تفعيل التذكيرات على جهازك', body: 'معياري بيذكّرك كل أسبوع بالشاهد اللي حان وقته، لين يكتمل ملفك.', url: '/app#/alerts' });
    res.json({ ok: true });
  });
  app.post('/api/push/unsubscribe', auth, (req, res) => {
    db.prepare('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?').run(req.user.id, String((req.body || {}).endpoint || ''));
    res.json({ ok: true });
  });
}

module.exports = { add, check, tick, start, routes, weekKey, journeyOf };
