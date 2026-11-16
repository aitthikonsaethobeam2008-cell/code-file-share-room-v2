# Code & File Share

เว็บแชร์โค้ดและไฟล์ผ่านลิงก์ (Node.js + Express + SQLite)

## ติดตั้งและเปิดใช้งาน
ต้องมี Node.js 22.13 ขึ้นไป (Windows: ดับเบิลคลิก start.bat ได้เลย)
```bash
cd code-file-share
npm install
npm start
```
เปิดเบราว์เซอร์ที่ http://localhost:3000  
(ถ้าต้องการให้เครื่องอื่นใน LAN เข้าได้ ใช้ `http://<IP เครื่อง>:3000`)

## ตั้งค่าโดยผู้ดูแลระบบ
คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่า
| ค่า | ความหมาย | ค่าเริ่มต้น |
|---|---|---|
| PORT | พอร์ตเซิร์ฟเวอร์ | 3000 |
| MAX_FILE_MB | ขนาดไฟล์สูงสุดต่อไฟล์ (MB) | 100 |
| MAX_FILES | จำนวนไฟล์สูงสุดต่อห้อง | 20 |
| MAX_CODE_KB | ขนาดโค้ดสูงสุด (KB) | 500 |
| EXTRA_BLOCKED_EXT | นามสกุลที่ห้ามอัปโหลดเพิ่ม | (ว่าง) |

## โครงสร้าง
```
server/index.js   API, อัปโหลด/ดาวน์โหลด, ลบข้อมูลหมดอายุอัตโนมัติ (ทุก 10 นาที)
server/db.js      ฐานข้อมูล SQLite (data/share.db)
server/config.js  ค่าตั้งค่า และรายการนามสกุลที่ห้าม
public/           หน้าเว็บ (index.html, css/style.css, js/app.js)
uploads/          ไฟล์ที่อัปโหลด (เก็บแบบต้นฉบับ ตั้งชื่อสุ่ม)
data/             ฐานข้อมูล
```

## เส้นทางหลัก
- `/share/<รหัส>` ห้องโค้ด · `/file/<รหัส>` ห้องไฟล์
- `POST /api/code`, `GET|PUT /api/code/:id`
- `POST /api/file`, `GET /api/file/:id`, `GET /api/file/:id/download/:fid`

## หมายเหตุด้านความปลอดภัย
- รหัสแชร์สุ่ม 8 ตัวอักษร ใครมีลิงก์ก็เปิดและ **แก้ไขโค้ด** ได้ (เหมือน CodeShare)
- บล็อกไฟล์ปฏิบัติการ เช่น .exe .bat .msi .ps1 .dll (แก้ได้ใน `server/config.js`)
- ไฟล์ถูกส่งแบบ attachment + `nosniff` เพื่อไม่ให้เบราว์เซอร์รันไฟล์
- ถ้านำขึ้นอินเทอร์เน็ตจริง ควรวางหลัง HTTPS (เช่น Nginx/Caddy) และเพิ่ม rate limit
- หน้าเว็บโหลดฟอนต์และ highlight.js จาก CDN จึงต้องออนไลน์ตอนเปิดหน้า
