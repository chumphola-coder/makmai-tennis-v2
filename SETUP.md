# makmai-tennis-v2 — คู่มือสมัครบัญชี & ตั้งค่า (สำหรับเจ้าของโปรเจกต์)

> โปรเจกต์ทดสอบ แยกจากของจริงทั้งหมด ของจริงไม่ถูกแตะ
> **ผู้ช่วยเขียนโค้ดให้ / คุณทำตามขั้นตอนสมัครบัญชีด้านล่าง แล้วเอาค่ามากรอกใน `config.js` และ `worker/wrangler.toml`**

ค่าที่ต้องเก็บระหว่างทำ (จดไว้):
- Firebase Web config (6 ค่า)
- Firebase service account: `client_email`, `private_key`
- LINE Login: Channel ID, Channel Secret
- Cloudflare Worker URL
- GitHub Pages URL

---

## 1) GitHub repo + GitHub Pages (โฮสต์เว็บ ฟรี)

> ผู้ช่วยได้เตรียม git repo ในเครื่องไว้ให้แล้ว (commit แรกพร้อม push) — ติดตั้ง `gh` (GitHub CLI) ให้ด้วย
> เหลือแค่ล็อกอินบัญชี GitHub ของคุณเอง (ต้องทำเองเพราะเป็นการยืนยันตัวตนผ่านเบราว์เซอร์)

**วิธี A — ใช้ GitHub CLI (เร็วสุด):**
```bash
cd "/Users/camornpi/Documents/ซ่อมสนามเทนนิส/makmai-tennis-v2"
gh auth login   # เลือก GitHub.com > HTTPS > Login with a web browser แล้วทำตามที่หน้าจอบอก
gh repo create makmai-tennis-v2 --public --source=. --remote=origin --push
```
- คำสั่งสุดท้ายจะสร้าง repo ชื่อ `makmai-tennis-v2` แบบ public ให้อัตโนมัติ และ push commit ที่เตรียมไว้ขึ้นไปเลย
- ต้องเป็น **public** เพราะ GitHub Pages ฟรีใช้ได้กับ repo public เท่านั้น (บัญชี Free)

**วิธี B — สร้างเองผ่านเว็บ (ถ้าไม่อยากใช้ CLI):**
1. https://github.com/new > ตั้งชื่อ `makmai-tennis-v2` > Public > Create repository
2. รันคำสั่งนี้ในโฟลเดอร์ `makmai-tennis-v2`:
   ```bash
   git remote add origin https://github.com/<your-username>/makmai-tennis-v2.git
   git push -u origin main
   ```

**หลังจาก push สำเร็จ (ทั้ง 2 วิธี):**
3. บนหน้า repo > Settings > Pages > Build and deployment > Source = `Deploy from a branch` > เลือก `main` / root > Save
4. รอสักครู่ จะได้ URL เช่น `https://<user>.github.io/makmai-tennis-v2/`
   - **จด URL นี้ไว้** = `GitHub Pages URL` (ใช้เป็น LINE callback + Worker CORS)

## 2) Firebase project ใหม่ (Spark ฟรี ไม่ผูกบัตร)
1. https://console.firebase.google.com > Add project (ปิด Google Analytics ก็ได้)
2. Build > Firestore Database > Create database > โหมด production > เลือก region `asia-southeast1`
3. Project settings (เฟือง) > General > Your apps > Web (`</>`) > ตั้งชื่อ > Register
   - คัดลอก 6 ค่าใน `firebaseConfig` ไปใส่ `config.js` (ส่วน `firebase`)
4. Project settings > **Service accounts** > Generate new private key > จะได้ไฟล์ JSON
   - เปิดไฟล์ เก็บ `client_email` และ `private_key` ไว้ (ใช้ในขั้น Worker)
5. Authentication > Get started > (ไม่ต้องเปิด provider ใด เพราะเราใช้ custom token)

## 3) LINE Login channel ใหม่
1. https://developers.line.biz/console > สร้าง Provider (ถ้ายังไม่มี)
2. Create a new channel > **LINE Login**
3. ตั้งค่า > เก็บ **Channel ID** และ **Channel secret**
4. LINE Login tab > Callback URL = ใส่ `GitHub Pages URL` (จากข้อ 1) ให้ตรงเป๊ะ
5. Scopes: เปิด `profile` และ `openid`

## 4) Cloudflare Worker (backend ฟรี ไม่ผูกบัตร)
> ต้องมี Node.js ในเครื่อง แล้วรันในโฟลเดอร์ `worker/`
1. สมัคร Cloudflare (ฟรี) ที่ https://dash.cloudflare.com
2. เปิดเทอร์มินัลที่โฟลเดอร์ `worker/` แล้ว:
   ```bash
   npm install
   npx wrangler login
   ```
3. แก้ `worker/wrangler.toml`:
   - `LINE_CHANNEL_ID` = Channel ID (จากข้อ 3)
   - `FIREBASE_SA_EMAIL` = `client_email` (จากข้อ 2.4)
   - `ALLOWED_ORIGIN` = `GitHub Pages URL` แบบ origin เท่านั้น (เช่น `https://<user>.github.io`)
4. ใส่ค่าลับ (secrets):
   ```bash
   npx wrangler secret put LINE_CHANNEL_SECRET
   npx wrangler secret put FIREBASE_SA_PRIVATE_KEY
   ```
   - `FIREBASE_SA_PRIVATE_KEY` = วางค่า `private_key` ทั้งก้อน (รวม `-----BEGIN PRIVATE KEY-----` ... และ `\n` ตามในไฟล์ JSON)
5. Deploy:
   ```bash
   npx wrangler deploy
   ```
   - จะได้ URL เช่น `https://makmai-line-auth.<subdomain>.workers.dev`
   - **จด URL นี้** ไปใส่ `config.js` ช่อง `authWorkerUrl`

## 5) กรอก config.js ให้ครบ
เปิด `config.js` แล้วแทนที่ทุก `REPLACE_...`:
- `firebase` = 6 ค่าจากข้อ 2.3
- `lineChannelId` = ข้อ 3
- `authWorkerUrl` = ข้อ 4.5
- `lineRedirectUri` = ปล่อยว่างได้ (ระบบจะใช้ URL หน้าปัจจุบันเอง) หรือใส่ `GitHub Pages URL` ให้ตรงกับ callback ในข้อ 3.4

## 6) Deploy Firestore Security Rules
- Firebase console > Firestore Database > Rules > วางเนื้อหาจากไฟล์ `firestore.rules` > Publish

## 7) ตั้ง admin คนแรก (bootstrap)
> ต้องทำหลังจาก admin ล็อกอินด้วย LINE ครั้งแรก (เพื่อให้ระบบรู้ uid)
1. ให้ผู้ที่จะเป็น admin กด Login ด้วย LINE ในเว็บ 1 ครั้ง
2. Firestore จะมีเอกสารใน `residents/<line:xxxx>` — คัดลอก document id (`line:...`)
3. สร้าง collection `admins` > Add document > Document ID = `line:...` (uid เดียวกัน) > ใส่ฟิลด์ `role: "admin"` > Save
4. ทำซ้ำสำหรับ admin 2–3 คน
5. ให้ admin refresh เว็บ จะเห็นสิทธิ์ admin

---

เมื่อทำครบ 1–7 แล้ว แจ้งกลับได้เลย เดี๋ยวเราทดสอบ flow ทั้งหมดร่วมกัน
