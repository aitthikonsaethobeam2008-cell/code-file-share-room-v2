/* Code & File Share - frontend (vanilla JS, no build step) */
const $app = document.getElementById('app');
const LANGS = [['plaintext','Plain text'],['c','C'],['cpp','C++'],['python','Python'],['java','Java'],['javascript','JavaScript'],['xml','HTML'],['css','CSS'],['php','PHP'],['arduino','Arduino']];
const EXPIRES = [['7','7 วัน'],['1','1 วัน'],['30','30 วัน'],['0','ไม่หมดอายุ']];
let CFG = { maxFileMB: 100, maxFiles: 20, blocked: [] };

// ---------- utils ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB';
const fmtDate = t => new Date(t).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const ext = n => (n.includes('.') ? n.split('.').pop().toUpperCase().slice(0, 5) : 'FILE');
const fullUrl = p => location.origin + p;
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { // fallback สำหรับ http / เบราว์เซอร์เก่า
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove();
    if (!ok) { toast('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง', 'err'); return false; }
  }
  return true;
}
async function api(url, opts = {}) {
  const r = await fetch(url, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'เกิดข้อผิดพลาด');
  return d;
}
const recent = {
  get: () => { try { return JSON.parse(localStorage.getItem('cfs_recent') || '[]'); } catch { return []; } },
  add(item) { try { localStorage.setItem('cfs_recent', JSON.stringify([item, ...this.get().filter(r => r.url !== item.url)].slice(0, 8))); } catch {} },
  remove(url) { try { localStorage.setItem('cfs_recent', JSON.stringify(this.get().filter(r => r.url !== url))); } catch {} },
};
const expirySelect = id => `<select id="${id}" aria-label="วันหมดอายุของลิงก์">${EXPIRES.map(([v, l]) => `<option value="${v}">หมดอายุ: ${l}</option>`).join('')}</select>`;

function shareModal(url, title) {
  const full = fullUrl(url);
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><h3>สร้างลิงก์แล้ว</h3><div class="meta">ส่งลิงก์นี้ให้ผู้รับ ไม่ต้องสมัครสมาชิก</div>
    <input readonly value="${esc(full)}" id="lk">
    <div class="row"><button class="btn" id="c1">คัดลอกลิงก์</button><a class="btn ghost" target="_blank" rel="noopener" href="https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(full)}">LINE</a>
    <button class="btn ghost" id="c2">แชร์ช่องทางอื่น</button><a class="btn ghost" href="${esc(url)}" data-link>เปิดดู</a><button class="btn ghost" id="c3">ปิด</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#lk').select();
  m.querySelector('#c1').onclick = async () => { if (await copyText(full)) toast('คัดลอกลิงก์แล้ว', 'ok'); };
  m.querySelector('#c2').onclick = () => navigator.share ? navigator.share({ title: title || 'Code & File Share', url: full }).catch(() => {}) : copyText(full).then(() => toast('คัดลอกลิงก์แล้ว (เบราว์เซอร์นี้ไม่รองรับเมนูแชร์)', 'ok'));
  m.querySelector('#c3').onclick = () => m.remove();
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-link]')) m.remove(); });
}

// ---------- router ----------
function go(path) { history.pushState({}, '', path); route(); }
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); go(a.getAttribute('href')); }
});
window.addEventListener('popstate', route);
function route() {
  const p = location.pathname; window.scrollTo(0, 0);
  let m;
  if ((m = p.match(/^\/room\/([A-Za-z0-9_-]+)$/))) return pageRoom(m[1]);
  if (p === '/new/code') return pageNewCode();
  if (p === '/new/file') return pageNewFile();
  if ((m = p.match(/^\/share\/([A-Za-z0-9]+)$/))) return pageViewCode(m[1]);
  if ((m = p.match(/^\/file\/([A-Za-z0-9]+)$/))) return pageViewFile(m[1]);
  pageHome();
}

// ---------- home ----------
function pageHome() {
  document.title = 'Code & File Share';
  $app.innerHTML = `
  <section class="room-home">
    <div class="hero">
      <div class="hero-text">
        <div class="eyebrow">SHARE TOGETHER</div>
        <h1>ส่งข้อความและไฟล์<br>ผ่านห้องเดียวกัน</h1>
        <p class="lead">เลือกหมายเลขห้องเดียวกัน ทั้งคุณและเพื่อนจะเห็นข้อความและไฟล์ที่ส่งไว้ในห้องนั้น</p>
      </div>
      <div class="profile-card" aria-label="โปรไฟล์">
        <div class="orbit"><b></b><b></b></div><div class="orbit o2"><b></b><b></b></div>
        <span class="avatar"><img src="/img/profile.png" alt="โปรไฟล์"></span>
        <span class="spark s1">✦</span><span class="spark s2">✦</span><span class="spark s3">✦</span>
        <div class="badge"><i></i>ออนไลน์</div>
      </div>
    </div>
    <form id="joinRoom" class="join-box">
      <label for="roomCode">หมายเลขห้อง</label>
      <div class="row"><input id="roomCode" class="grow" maxlength="24" placeholder="เช่น 99" required pattern="[A-Za-z0-9_-]+" autocomplete="off"><button class="btn">เข้าห้อง</button></div>
      <small>ใช้รหัสเดียวกันเพื่อเข้าห้องเดียวกัน เช่น 99</small>
    </form>
    <div class="cards">
      <a class="card" href="/new/code" data-link><div class="ic">⌨️</div><h3>สร้างลิงก์ Code Share</h3><p>แชร์โค้ดแบบลิงก์เดิม</p></a>
      <a class="card" href="/new/file" data-link><div class="ic">📁</div><h3>สร้างลิงก์ File Share</h3><p>แชร์ไฟล์แบบลิงก์เดิม</p></a>
    </div>
  </section>`;
  $app.querySelector('#joinRoom').onsubmit = e => {
    e.preventDefault();
    const code = $app.querySelector('#roomCode').value.trim().toUpperCase();
    if (code) go('/room/' + encodeURIComponent(code));
  };
}

async function pageRoom(code) {
  code = decodeURIComponent(code).toUpperCase();
  if (!/^[A-Z0-9_-]{1,24}$/.test(code)) return notFound('รหัสห้องไม่ถูกต้อง');
  document.title = 'ห้อง ' + code + ' · Code & File Share';
  $app.innerHTML = `<a class="back" href="/" data-link>← เลือกห้องอื่น</a>
    <div class="room-head"><div><div class="eyebrow">SHARED ROOM</div><h1>ห้อง ${esc(code)}</h1><p class="meta">ทุกคนที่เข้าห้อง ${esc(code)} จะเห็นข้อความและไฟล์เดียวกัน</p></div><div class="row"><button class="btn ghost" id="copyRoom">คัดลอกลิงก์ห้อง</button><button class="btn ghost danger" id="clearRoom">🗑 เคลียร์ข้อความ</button></div></div>
    <div class="chat-panel"><div id="messages" class="messages"><p class="empty meta">กำลังโหลดข้อความ…</p></div>
    <form id="sendForm" class="send-box">
      <input id="sender" maxlength="40" placeholder="ชื่อผู้ส่ง (เช่น Beam)" aria-label="ชื่อผู้ส่ง">
      <textarea id="message" maxlength="5000" rows="3" placeholder="พิมพ์ข้อความที่ต้องการส่ง..."></textarea>
      <div class="row send-actions"><label class="btn ghost file-pick">📎 เลือกไฟล์<input id="roomFile" type="file" hidden></label><span id="fileName" class="meta grow">ยังไม่ได้เลือกไฟล์</span><button class="btn" id="sendBtn">ส่งเข้าห้อง</button></div>
    </form></div>`;
  const list = $app.querySelector('#messages');
  let lastId = 0, stopped = false;
  const base = '/api/rooms/' + encodeURIComponent(code) + '/messages';
  const showEmpty = () => { if (!list.querySelector('.message-item') && !list.querySelector('.empty.none')) list.innerHTML = '<p class="empty none meta">✦ ยังไม่มีข้อความในห้องนี้</p>'; };
  // เคลียร์ทั้งห้อง: ใครก็ลบได้ ทุกเครื่องในห้องจะเห็นข้อความหายภายใน 2 วินาที
  $app.querySelector('#clearRoom').onclick = async () => {
    if (!confirm('เคลียร์ข้อความและไฟล์ทั้งหมดในห้อง ' + code + '?\nทุกคนในห้องจะไม่เห็นข้อความเหล่านี้อีก และกู้คืนไม่ได้')) return;
    try {
      await api(base, { method: 'DELETE' });
      list.innerHTML = ''; showEmpty(); toast('เคลียร์ข้อความแล้ว', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
  // ลบทีละข้อความ (ปุ่ม ✕ ที่มุมของแต่ละข้อความ)
  list.onclick = async e => {
    const b = e.target.closest('button[data-del]'); if (!b) return;
    if (!confirm('ลบข้อความนี้?')) return;
    try {
      await api(base + '/' + b.dataset.del, { method: 'DELETE' });
      b.closest('.message-item')?.remove(); showEmpty(); toast('ลบข้อความแล้ว', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  };
  $app.querySelector('#copyRoom').onclick = async () => { if (await copyText(fullUrl('/room/' + code))) toast('คัดลอกลิงก์ห้องแล้ว','ok'); };
  $app.querySelector('#roomFile').onchange = e => { $app.querySelector('#fileName').textContent = e.target.files[0]?.name || 'ยังไม่ได้เลือกไฟล์'; };
  const load = async () => {
    if (stopped) return;
    try {
      const d = await api(base + '?after=' + lastId);
      // ซิงก์การลบ: เอาข้อความที่ถูกลบโดยคนอื่นออกจากหน้าจอ
      const alive = new Set(d.ids);
      list.querySelectorAll('.message-item').forEach(el => { if (!alive.has(+el.dataset.id)) el.remove(); });
      if (d.messages.length) {
        const empty = list.querySelector('.empty'); if (empty) empty.remove();
        for (const m of d.messages) {
          lastId = Math.max(lastId, m.id);
          const item = document.createElement('article'); item.className = 'message-item'; item.dataset.id = m.id;
          const when = fmtDate(m.created_at);
          item.innerHTML = `<button class="del" data-del="${m.id}" title="ลบข้อความนี้" aria-label="ลบข้อความนี้">✕</button><div class="message-meta"><b>${esc(m.sender)}</b><time>${esc(when)}</time></div>${m.message ? `<p class="message-text">${esc(m.message).replace(/\n/g,'<br>')}</p>` : ''}${m.original_name ? `<a class="shared-file" href="/api/rooms/${encodeURIComponent(code)}/download/${m.id}">📄 ${esc(m.original_name)} <small>${fmtSize(m.size)}</small> · ดาวน์โหลด</a>` : ''}`;
          list.appendChild(item);
        }
        list.scrollTop = list.scrollHeight;
      }
      showEmpty();
    } catch (e) { toast(e.message, 'err'); stopped = true; }
  };
  $app.querySelector('#sendForm').onsubmit = async e => {
    e.preventDefault();
    const btn = $app.querySelector('#sendBtn'), file = $app.querySelector('#roomFile').files[0];
    const fd = new FormData(); fd.append('sender', $app.querySelector('#sender').value || 'ผู้ใช้'); fd.append('message', $app.querySelector('#message').value);
    if (file) fd.append('file', file);
    btn.disabled = true;
    try {
      await fetch('/api/rooms/' + encodeURIComponent(code) + '/messages', { method:'POST', body:fd }).then(async r => { const d=await r.json(); if(!r.ok) throw new Error(d.error || 'ส่งไม่สำเร็จ'); return d; });
      $app.querySelector('#message').value=''; $app.querySelector('#roomFile').value=''; $app.querySelector('#fileName').textContent='ยังไม่ได้เลือกไฟล์';
      await load();
    } catch (err) { toast(err.message,'err'); }
    finally { btn.disabled=false; }
  };
  await load();
  const timer = setInterval(() => { if (!document.body.contains(list)) { clearInterval(timer); stopped=true; } else load(); }, 2000);
}

// ---------- code editor ----------
function mountEditor(root, { value = '', lang = 'plaintext', readonly = false } = {}) {
  root.innerHTML = '<pre aria-hidden="true"><code></code></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="พื้นที่เขียนโค้ด"></textarea>';
  const ta = root.querySelector('textarea'), code = root.querySelector('code'), pre = root.querySelector('pre');
  ta.value = value; ta.readOnly = readonly; if (readonly) ta.style.cursor = 'text';
  const api = {
    lang, ta,
    render() {
      try { code.innerHTML = hljs.highlight(ta.value, { language: api.lang, ignoreIllegals: true }).value + '\n'; }
      catch { code.textContent = ta.value + '\n'; }
    },
  };
  ta.addEventListener('input', api.render);
  ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('keydown', e => { // Tab = เยื้อง 2 ช่อง
    if (e.key === 'Tab' && !readonly) { e.preventDefault(); document.execCommand('insertText', false, '  '); }
  });
  api.render();
  return api;
}
const langSelect = cur => `<select id="lang" aria-label="ภาษาโปรแกรม">${LANGS.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

function pageNewCode() {
  document.title = 'สร้างห้อง Code Share';
  $app.innerHTML = `<a class="back" href="/" data-link>← หน้าหลัก</a><h1>Code Share</h1>
  <div class="row"><input id="title" class="grow" maxlength="80" placeholder="ชื่อห้องแชร์ (ไม่บังคับ)">${langSelect('plaintext')}${expirySelect('exp')}</div>
  <div class="editor" id="ed"></div>
  <div class="row end"><button class="btn ghost" id="copy">คัดลอกโค้ดทั้งหมด</button><button class="btn ghost danger" id="clear">ล้างข้อมูล</button><button class="btn" id="save">บันทึกและสร้างลิงก์</button></div>`;
  const ed = mountEditor($app.querySelector('#ed'));
  $app.querySelector('#lang').onchange = e => { ed.lang = e.target.value; ed.render(); };
  $app.querySelector('#copy').onclick = async () => { if (!ed.ta.value) return toast('ยังไม่มีโค้ดให้คัดลอก', 'err'); if (await copyText(ed.ta.value)) toast('คัดลอกโค้ดทั้งหมดแล้ว', 'ok'); };
  $app.querySelector('#clear').onclick = () => { if (!ed.ta.value || confirm('ล้างโค้ดทั้งหมด?')) { ed.ta.value = ''; ed.render(); ed.ta.focus(); } };
  const save = $app.querySelector('#save');
  save.onclick = async () => {
    save.disabled = true;
    try {
      const title = $app.querySelector('#title').value;
      const r = await api('/api/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, language: ed.lang, content: ed.ta.value, expiry: $app.querySelector('#exp').value }) });
      recent.add({ type: 'code', id: r.id, url: r.url, title, at: Date.now() });
      toast('บันทึกสำเร็จ', 'ok'); history.replaceState({}, '', r.url); route(); shareModal(r.url, title);
    } catch (e) { toast(e.message, 'err'); save.disabled = false; }
  };
}

async function pageViewCode(id) {
  $app.innerHTML = '<div class="empty meta">กำลังโหลด…</div>';
  try {
    const d = await api('/api/code/' + id);
    document.title = (d.title || 'Code') + ' · Code & File Share';
    recent.add({ type: 'code', id, url: '/share/' + id, title: d.title, at: Date.now() });
    $app.innerHTML = `<a class="back" href="/" data-link>← หน้าหลัก</a><h1>${esc(d.title || 'โค้ดที่แชร์')}</h1>
    <div class="meta">สร้างเมื่อ ${fmtDate(d.created_at)} · ${d.expires_at ? 'หมดอายุ ' + fmtDate(d.expires_at) : 'ไม่หมดอายุ'}</div>
    <div class="row" style="margin-top:14px"><input id="title" class="grow" maxlength="80" placeholder="ชื่อห้อง" value="${esc(d.title)}">${langSelect(d.language)}</div>
    <div class="editor" id="ed"></div>
    <div class="row end"><button class="btn ghost" id="copy">คัดลอกโค้ดทั้งหมด</button><button class="btn ghost" id="link">คัดลอกลิงก์</button><button class="btn ghost" id="share">แชร์</button><button class="btn" id="save">บันทึกการแก้ไข</button></div>`;
    const ed = mountEditor($app.querySelector('#ed'), { value: d.content, lang: d.language });
    $app.querySelector('#lang').onchange = e => { ed.lang = e.target.value; ed.render(); };
    $app.querySelector('#copy').onclick = async () => { if (await copyText(ed.ta.value)) toast('คัดลอกโค้ดทั้งหมดแล้ว', 'ok'); };
    $app.querySelector('#link').onclick = async () => { if (await copyText(fullUrl('/share/' + id))) toast('คัดลอกลิงก์แล้ว', 'ok'); };
    $app.querySelector('#share').onclick = () => shareModal('/share/' + id, d.title);
    $app.querySelector('#save').onclick = async () => {
      try {
        await api('/api/code/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: $app.querySelector('#title').value, language: ed.lang, content: ed.ta.value }) });
        toast('บันทึกการแก้ไขแล้ว', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    };
  } catch (e) { notFound(e.message); }
}

// ---------- file share ----------
function pageNewFile() {
  document.title = 'สร้างห้อง File Share';
  let files = [];
  $app.innerHTML = `<a class="back" href="/" data-link>← หน้าหลัก</a><h1>File Share</h1>
  <div class="row"><input id="title" class="grow" maxlength="80" placeholder="ชื่อห้องแชร์ (ไม่บังคับ)">${expirySelect('exp')}</div>
  <div class="drop" id="drop" tabindex="0" role="button" aria-label="เลือกไฟล์"><div class="ic">⬆️</div><b>ลากไฟล์มาวางที่นี่ หรือกดเพื่อเลือกไฟล์</b><p>รองรับทุกประเภท · สูงสุด ${CFG.maxFileMB} MB ต่อไฟล์ · ไม่เกิน ${CFG.maxFiles} ไฟล์</p></div>
  <input type="file" id="pick" multiple hidden>
  <ul class="flist" id="list"></ul><div class="bar" id="bar" hidden><i></i></div>
  <div class="row end"><button class="btn" id="up" disabled>อัปโหลดและสร้างลิงก์</button></div>`;
  const drop = $app.querySelector('#drop'), pick = $app.querySelector('#pick'), list = $app.querySelector('#list'), up = $app.querySelector('#up');
  const render = () => {
    list.innerHTML = files.map((f, i) => `<li><span class="tag">${esc(ext(f.file.name))}</span><div class="nm">${esc(f.file.name)}<small>${fmtSize(f.file.size)}${f.file.type ? ' · ' + esc(f.file.type) : ''}</small></div><span class="st ${f.cls || ''}">${f.status}</span><button class="btn ghost sm danger" data-i="${i}" aria-label="ลบไฟล์">ลบ</button></li>`).join('');
    up.disabled = !files.length || files.some(f => f.cls === 'err');
  };
  const add = fl => {
    for (const file of fl) {
      const e = file.name.split('.').pop().toLowerCase();
      if (files.length >= CFG.maxFiles) { toast(`เลือกได้สูงสุด ${CFG.maxFiles} ไฟล์`, 'err'); break; }
      let status = 'พร้อมอัปโหลด', cls = '';
      if (file.size > CFG.maxFileMB * 1048576) { status = `เกิน ${CFG.maxFileMB} MB`; cls = 'err'; }
      else if (file.name.includes('.') && CFG.blocked.includes(e)) { status = 'ไม่อนุญาตไฟล์ประเภทนี้'; cls = 'err'; }
      files.push({ file, status, cls });
    }
    render();
  };
  drop.onclick = () => pick.click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick.click(); } };
  pick.onchange = () => { add(pick.files); pick.value = ''; };
  ['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => add(e.dataTransfer.files));
  list.onclick = e => { const b = e.target.closest('button[data-i]'); if (b) { files.splice(+b.dataset.i, 1); render(); } };
  up.onclick = () => {
    const fd = new FormData();
    fd.append('title', $app.querySelector('#title').value); fd.append('expiry', $app.querySelector('#exp').value);
    files.forEach(f => { fd.append('files', f.file); f.status = 'กำลังอัปโหลด…'; f.cls = ''; });
    render(); up.disabled = true;
    const bar = $app.querySelector('#bar'); bar.hidden = false;
    const x = new XMLHttpRequest();
    x.open('POST', '/api/file');
    x.upload.onprogress = e => { if (e.lengthComputable) bar.firstChild.style.width = (e.loaded / e.total * 100) + '%'; };
    x.onload = () => {
      let d = {}; try { d = JSON.parse(x.responseText); } catch {}
      if (x.status === 200) {
        files.forEach(f => { f.status = 'สำเร็จ'; f.cls = 'ok'; }); render();
        const title = $app.querySelector('#title').value;
        recent.add({ type: 'file', id: d.id, url: d.url, title, at: Date.now() });
        toast('อัปโหลดสำเร็จ', 'ok'); history.replaceState({}, '', d.url); route(); shareModal(d.url, title);
      } else {
        files.forEach(f => { f.status = 'ล้มเหลว'; f.cls = 'err'; }); render();
        toast(d.error || 'อัปโหลดล้มเหลว', 'err'); bar.hidden = true; up.disabled = false;
        files.forEach(f => { f.status = 'พร้อมอัปโหลด'; f.cls = ''; }); setTimeout(render, 1500);
      }
    };
    x.onerror = () => { toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'err'); bar.hidden = true; up.disabled = false; files.forEach(f => { f.status = 'พร้อมอัปโหลด'; f.cls = ''; }); render(); };
    x.send(fd);
  };
}

async function pageViewFile(id) {
  $app.innerHTML = '<div class="empty meta">กำลังโหลด…</div>';
  try {
    const d = await api('/api/file/' + id);
    document.title = (d.title || 'ไฟล์') + ' · Code & File Share';
    recent.add({ type: 'file', id, url: '/file/' + id, title: d.title, at: Date.now() });
    const total = d.files.reduce((s, f) => s + f.size, 0);
    $app.innerHTML = `<a class="back" href="/" data-link>← หน้าหลัก</a><h1>${esc(d.title || 'ไฟล์ที่แชร์')}</h1>
    <div class="meta">${d.files.length} ไฟล์ · ${fmtSize(total)} · สร้างเมื่อ ${fmtDate(d.created_at)} · ${d.expires_at ? 'หมดอายุ ' + fmtDate(d.expires_at) : 'ไม่หมดอายุ'}</div>
    <ul class="flist" style="margin-top:18px">${d.files.map(f => `<li><span class="tag">${esc(ext(f.name))}</span><div class="nm">${esc(f.name)}<small>${fmtSize(f.size)}</small></div><a class="btn sm" href="/api/file/${id}/download/${f.id}" download>ดาวน์โหลด</a></li>`).join('')}</ul>
    <div class="row end"><button class="btn ghost" id="link">คัดลอกลิงก์</button><button class="btn ghost" id="share">แชร์</button></div>`;
    $app.querySelector('#link').onclick = async () => { if (await copyText(fullUrl('/file/' + id))) toast('คัดลอกลิงก์แล้ว', 'ok'); };
    $app.querySelector('#share').onclick = () => shareModal('/file/' + id, d.title);
  } catch (e) { notFound(e.message); }
}

function notFound(msg) {
  document.title = 'ไม่พบห้องแชร์';
  $app.innerHTML = `<div class="empty"><h1>ไม่พบห้องแชร์</h1><p class="lead" style="margin:0 auto 24px">${esc(msg)}</p><a class="btn" href="/" data-link>กลับหน้าหลัก</a></div>`;
}

fetch('/api/config').then(r => r.json()).then(c => { CFG = c; }).catch(() => {}).finally(route);

// ---------- decoration: animated neon space background ----------
(function scene() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('stars'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, stars = [], shoot = [];
  const dpr = Math.min(devicePixelRatio || 1, 2);
  function resize() {
    W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
    const n = Math.round(innerWidth * innerHeight / 5500);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.4 + .3) * dpr,
      p: Math.random() * 6.28, s: .4 + Math.random() * 1.6, h: Math.random() < .2 ? 280 : Math.random() < .5 ? 200 : 220,
    }));
  }
  resize(); addEventListener('resize', resize);
  const star = (x, y, r, a, h) => { ctx.fillStyle = `hsla(${h},100%,85%,${a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); };
  let last = 0;
  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const a = reduce ? .6 : .35 + .65 * (.5 + .5 * Math.sin(t / 1000 * s.s + s.p));
      star(s.x, s.y, s.r, a, s.h);
      if (s.r > 1.2 * dpr) { ctx.fillStyle = `hsla(${s.h},100%,80%,${a * .25})`; ctx.fillRect(s.x - s.r * 4, s.y - .5, s.r * 8, 1); ctx.fillRect(s.x - .5, s.y - s.r * 4, 1, s.r * 8); }
    }
    if (!reduce) {
      if (t - last > 2800 && Math.random() < .02) { last = t; shoot.push({ x: Math.random() * W * .8, y: Math.random() * H * .4, vx: 11 * dpr, vy: 5 * dpr, life: 1 }); }
      shoot = shoot.filter(m => m.life > 0);
      for (const m of shoot) {
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
        g.addColorStop(0, `rgba(255,255,255,${m.life})`); g.addColorStop(1, 'rgba(120,160,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12); ctx.stroke();
        m.x += m.vx; m.y += m.vy; m.life -= .018;
      }
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // parallax: layers move with mouse / device tilt
  if (reduce) return;
  const layers = [...document.querySelectorAll('#scene .layer')];
  let tx = 0, ty = 0;
  const move = (x, y) => { tx = x; ty = y; layers.forEach(l => { const d = +l.dataset.depth || 10; l.style.transform = `translate3d(${-tx * d}px,${-ty * d}px,0)`; }); };
  addEventListener('pointermove', e => move(e.clientX / innerWidth - .5, e.clientY / innerHeight - .5));
  addEventListener('scroll', () => { const y = scrollY; layers.forEach(l => { l.style.marginTop = (-y * (+l.dataset.depth || 10) / 400) + 'px'; }); }, { passive: true });
})();
