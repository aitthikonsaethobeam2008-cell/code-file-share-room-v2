const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');
const cfg = require('./config');

fs.mkdirSync(cfg.UPLOAD_DIR, { recursive: true });
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: cfg.MAX_CODE_KB + 'kb' }));
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- helpers ----------
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const newId = () => {
  for (;;) {
    const id = Array.from(crypto.randomBytes(8), x => ALPHA[x % ALPHA.length]).join('');
    if (!db.prepare('SELECT 1 FROM rooms WHERE id=?').get(id)) return id;
  }
};
const expiryAt = d => { d = +d; return cfg.EXPIRY_DAYS.includes(d) && d > 0 ? Date.now() + d * 864e5 : null; };
const fixName = n => Buffer.from(n, 'latin1').toString('utf8').replace(/[\\/\0]/g, '_').slice(0, 200);
const clean = s => String(s || '').trim().slice(0, 80);
const LANGS = ['plaintext','c','cpp','python','java','javascript','xml','css','php','arduino'];
const GONE = { error: 'ไม่พบห้องแชร์นี้ หรือลิงก์หมดอายุแล้ว' };

function removeRoom(id) {
  for (const f of db.prepare('SELECT stored_name FROM files WHERE room_id=?').all(id))
    fs.rm(path.join(cfg.UPLOAD_DIR, f.stored_name), { force: true }, () => {});
  db.prepare('DELETE FROM rooms WHERE id=?').run(id);
}
function getRoom(id, type) {
  const r = db.prepare('SELECT * FROM rooms WHERE id=? AND type=?').get(id, type);
  if (!r) return null;
  if (r.expires_at && r.expires_at < Date.now()) { removeRoom(id); return null; }
  return r;
}
function purge() {
  for (const r of db.prepare('SELECT id FROM rooms WHERE expires_at IS NOT NULL AND expires_at < ?').all(Date.now())) removeRoom(r.id);
}
purge();
setInterval(purge, 10 * 60 * 1000);

// ---------- config ----------
app.get('/api/config', (req, res) => res.json({
  maxFileMB: cfg.MAX_FILE_MB, maxFiles: cfg.MAX_FILES, maxCodeKB: cfg.MAX_CODE_KB, blocked: [...cfg.BLOCKED],
}));

// ---------- Code Share ----------
app.post('/api/code', (req, res) => {
  const { title, language, content, expiry } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'กรุณาใส่โค้ดก่อนบันทึก' });
  const id = newId();
  db.prepare('INSERT INTO rooms (id,type,title,language,content,created_at,expires_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, 'code', clean(title), LANGS.includes(language) ? language : 'plaintext', content, Date.now(), expiryAt(expiry));
  res.json({ id, url: `/share/${id}` });
});
app.get('/api/code/:id', (req, res) => {
  const r = getRoom(req.params.id, 'code');
  if (!r) return res.status(404).json(GONE);
  res.json({ id: r.id, title: r.title, language: r.language, content: r.content, created_at: r.created_at, expires_at: r.expires_at });
});
app.put('/api/code/:id', (req, res) => {
  const r = getRoom(req.params.id, 'code');
  if (!r) return res.status(404).json(GONE);
  const { title, language, content } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'โค้ดต้องไม่ว่าง' });
  db.prepare('UPDATE rooms SET title=?, language=?, content=? WHERE id=?')
    .run(clean(title), LANGS.includes(language) ? language : r.language, content, r.id);
  res.json({ ok: true });
});

// ---------- File Share ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: cfg.UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
  }),
  limits: { fileSize: cfg.MAX_FILE_MB * 1024 * 1024, files: cfg.MAX_FILES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(fixName(file.originalname)).slice(1).toLowerCase();
    if (cfg.BLOCKED.has(ext)) return cb(new Error(`ไม่อนุญาตให้อัปโหลดไฟล์ .${ext} เพื่อความปลอดภัย`));
    cb(null, true);
  },
});
app.post('/api/file', upload.array('files', cfg.MAX_FILES), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์' });
  const id = newId();
  db.transaction(() => {
    db.prepare('INSERT INTO rooms (id,type,title,created_at,expires_at) VALUES (?,?,?,?,?)')
      .run(id, 'file', clean(req.body.title), Date.now(), expiryAt(req.body.expiry));
    const ins = db.prepare('INSERT INTO files (room_id,original_name,stored_name,mime,size) VALUES (?,?,?,?,?)');
    for (const f of req.files) ins.run(id, fixName(f.originalname), f.filename, f.mimetype, f.size);
  })();
  res.json({ id, url: `/file/${id}` });
});
app.get('/api/file/:id', (req, res) => {
  const r = getRoom(req.params.id, 'file');
  if (!r) return res.status(404).json(GONE);
  const files = db.prepare('SELECT id, original_name AS name, mime, size FROM files WHERE room_id=?').all(r.id);
  res.json({ id: r.id, title: r.title, created_at: r.created_at, expires_at: r.expires_at, files });
});
app.get('/api/file/:id/download/:fid', (req, res) => {
  const r = getRoom(req.params.id, 'file');
  const f = r && db.prepare('SELECT * FROM files WHERE id=? AND room_id=?').get(+req.params.fid, r.id);
  if (!f) return res.status(404).send(GONE.error);
  res.download(path.join(cfg.UPLOAD_DIR, f.stored_name), f.original_name); // ไฟล์ต้นฉบับ ไม่แปลง ไม่บีบอัด
});


// ---------- shared numbered rooms ----------
const roomCode = v => String(v || '').trim().toUpperCase();
const validRoom = v => /^[A-Z0-9_-]{1,24}$/.test(v);
const chatUpload = multer({
  storage: multer.diskStorage({
    destination: cfg.UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
  }),
  limits: { fileSize: cfg.MAX_FILE_MB * 1024 * 1024, files: 1 },
});
app.get('/api/rooms/:code/messages', (req, res) => {
  const code = roomCode(req.params.code);
  if (!validRoom(code)) return res.status(400).json({ error: 'รหัสห้องไม่ถูกต้อง' });
  const after = Math.max(0, Number(req.query.after) || 0);
  const rows = db.prepare('SELECT id,sender,message,original_name,size,created_at FROM chat_messages WHERE room_code=? AND id>? ORDER BY id LIMIT 200').all(code, after);
  // ids = ข้อความที่ยังอยู่ในห้องทั้งหมด ใช้ให้ทุกเครื่องซิงก์เมื่อมีคนลบ
  const ids = db.prepare('SELECT id FROM chat_messages WHERE room_code=? ORDER BY id DESC LIMIT 5000').all(code).map(r => r.id);
  res.json({ messages: rows, ids });
});
app.delete('/api/rooms/:code/messages/:id', (req, res) => {
  const code = roomCode(req.params.code);
  if (!validRoom(code)) return res.status(400).json({ error: 'รหัสห้องไม่ถูกต้อง' });
  const row = db.prepare('SELECT stored_name FROM chat_messages WHERE id=? AND room_code=?').get(+req.params.id, code);
  if (!row) return res.status(404).json({ error: 'ไม่พบข้อความนี้ (อาจถูกลบไปแล้ว)' });
  if (row.stored_name) fs.rm(path.join(cfg.UPLOAD_DIR, row.stored_name), { force: true }, () => {});
  db.prepare('DELETE FROM chat_messages WHERE id=? AND room_code=?').run(+req.params.id, code);
  res.json({ ok: true });
});
app.delete('/api/rooms/:code/messages', (req, res) => {
  const code = roomCode(req.params.code);
  if (!validRoom(code)) return res.status(400).json({ error: 'รหัสห้องไม่ถูกต้อง' });
  for (const f of db.prepare('SELECT stored_name FROM chat_messages WHERE room_code=? AND stored_name IS NOT NULL').all(code))
    fs.rm(path.join(cfg.UPLOAD_DIR, f.stored_name), { force: true }, () => {});
  const info = db.prepare('DELETE FROM chat_messages WHERE room_code=?').run(code);
  res.json({ ok: true, deleted: Number(info.changes) });
});
app.post('/api/rooms/:code/messages', chatUpload.single('file'), (req, res) => {
  const code = roomCode(req.params.code);
  if (!validRoom(code)) return res.status(400).json({ error: 'รหัสห้องต้องเป็น A-Z, 0-9, _ หรือ - ไม่เกิน 24 ตัว' });
  const sender = clean(req.body.sender) || 'ผู้ใช้';
  const message = String(req.body.message || '').trim().slice(0, 5000);
  if (!message && !req.file) return res.status(400).json({ error: 'พิมพ์ข้อความหรือเลือกไฟล์ก่อนส่ง' });
  const f = req.file;
  const info = db.prepare('INSERT INTO chat_messages (room_code,sender,message,stored_name,original_name,mime,size,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(code, sender, message, f ? f.filename : null, f ? fixName(f.originalname) : null, f ? f.mimetype : null, f ? f.size : null, Date.now());
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});
app.get('/api/rooms/:code/download/:id', (req, res) => {
  const code = roomCode(req.params.code);
  const f = db.prepare('SELECT * FROM chat_messages WHERE id=? AND room_code=? AND stored_name IS NOT NULL').get(+req.params.id, code);
  if (!f || !validRoom(code)) return res.status(404).send('ไม่พบไฟล์');
  res.download(path.join(cfg.UPLOAD_DIR, f.stored_name), f.original_name);
});

// ---------- pages ----------
const page = (req, res) => { res.set('X-Robots-Tag', 'noindex, nofollow'); res.sendFile(path.join(__dirname, '..', 'public', 'index.html')); };
['/', '/new/code', '/new/file', '/share/:id', '/file/:id', '/room/:code'].forEach(p => app.get(p, page));

app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API นี้' }));
app.use((err, req, res, next) => {
  let msg = err.message || 'เกิดข้อผิดพลาด';
  if (err.code === 'LIMIT_FILE_SIZE') msg = `ไฟล์ใหญ่เกินกำหนด (สูงสุด ${cfg.MAX_FILE_MB} MB ต่อไฟล์)`;
  if (err.code === 'LIMIT_FILE_COUNT') msg = `อัปโหลดได้สูงสุด ${cfg.MAX_FILES} ไฟล์ต่อครั้ง`;
  if (err.type === 'entity.too.large') msg = `โค้ดยาวเกินกำหนด (สูงสุด ${cfg.MAX_CODE_KB} KB)`;
  res.status(400).json({ error: msg });
});

app.listen(cfg.PORT, () => console.log(`Code & File Share พร้อมใช้งานที่ http://localhost:${cfg.PORT}`));
