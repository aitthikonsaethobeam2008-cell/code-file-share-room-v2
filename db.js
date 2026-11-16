// ใช้ SQLite ที่มากับ Node.js (node:sqlite) จึงไม่ต้องติดตั้งตัวคอมไพล์ C++
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });
const raw = new DatabaseSync(path.join(dir, 'share.db'));
raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
raw.exec(`
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('code','file')),
  title TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'plaintext',
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rooms_exp ON rooms(expires_at);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT 'ผู้ใช้',
  message TEXT NOT NULL DEFAULT '',
  stored_name TEXT,
  original_name TEXT,
  mime TEXT,
  size INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_code,id);
`);

module.exports = {
  prepare: sql => raw.prepare(sql),
  transaction: fn => () => {
    raw.exec('BEGIN');
    try { const r = fn(); raw.exec('COMMIT'); return r; }
    catch (e) { raw.exec('ROLLBACK'); throw e; }
  },
};
