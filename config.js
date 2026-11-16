const path = require('path');
const fs = require('fs');
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
const BLOCKED = new Set(['exe','bat','cmd','com','scr','msi','vbs','vbe','ps1','dll','jar','lnk','pif','hta','cpl','reg']);
(process.env.EXTRA_BLOCKED_EXT || '').split(',').map(s => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean).forEach(e => BLOCKED.add(e));

module.exports = {
  PORT: +process.env.PORT || 3000,
  MAX_FILE_MB: +process.env.MAX_FILE_MB || 100,
  MAX_FILES: +process.env.MAX_FILES || 20,
  MAX_CODE_KB: +process.env.MAX_CODE_KB || 500,
  EXPIRY_DAYS: [1, 7, 30, 0],
  BLOCKED,
  UPLOAD_DIR: path.join(__dirname, '..', 'uploads'),
};
