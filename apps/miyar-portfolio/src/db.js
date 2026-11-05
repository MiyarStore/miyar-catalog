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
`);

module.exports = { db, DATA_DIR };
