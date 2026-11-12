const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'miyar.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT 'm',
  job_title TEXT NOT NULL DEFAULT 'معلم',
  subject TEXT NOT NULL DEFAULT '',
  school TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  office TEXT NOT NULL DEFAULT '',
  principal TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '1448 هـ',
  slug TEXT UNIQUE NOT NULL,
  verify_code TEXT UNIQUE NOT NULL,
  theme TEXT NOT NULL DEFAULT 'miyar',
  is_public INTEGER NOT NULL DEFAULT 1,
  trial_ends INTEGER NOT NULL,
  plan_ends INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS evidences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  standard_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  goals TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT '',
  ev_date TEXT NOT NULL DEFAULT '',
  links TEXT NOT NULL DEFAULT '[]',
  verify_code TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id INTEGER NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  stored TEXT NOT NULL,
  original TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  days INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  redeemed_by INTEGER,
  redeemed_at INTEGER
);
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_ev_user ON evidences(user_id, standard_id);
-- «معياري للمدرسة»: ملف المدرسة وتقاريرها وخططها
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  ministry_number TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'basic',
  gender TEXT NOT NULL DEFAULT '',
  office TEXT NOT NULL DEFAULT '',
  principal TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '1448 هـ',
  logo TEXT,
  package TEXT NOT NULL DEFAULT '',
  plan_ends INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS school_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS school_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  report_id INTEGER NOT NULL REFERENCES school_reports(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'improvement',
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS school_usage (
  school_id INTEGER NOT NULL,
  year TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (school_id, year, kind)
);
`);

// ترقية: نوع المنتج لكل كود (ملف المعلم أو باقات المدرسة)
try { db.exec("ALTER TABLE codes ADD COLUMN product TEXT NOT NULL DEFAULT 'portfolio'"); } catch {}
// ترقية: حقول البيانات الأساسية في استمارات الوزارة (نوع المبنى والفترة)
// فريق المدرسة: المعلمون اللي تتوزع عليهم إجراءات الخطة (يرتبطون بحساباتهم في معياري للمعلم بالبريد)
db.exec(`CREATE TABLE IF NOT EXISTS school_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE (school_id, email)
)`);
try { db.exec('ALTER TABLE schools ADD COLUMN ministry_logo INTEGER NOT NULL DEFAULT 1'); } catch {}
for (const col of ['building', 'period']) { try { db.exec(`ALTER TABLE schools ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`); } catch {} }

module.exports = { db, DATA_DIR };
