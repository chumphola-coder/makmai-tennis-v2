   # ขั้นตอนตั้งค่า LINE OA (Official Account) + Messaging API — สำหรับส่งข้อความแจ้งเตือน

   > **สถานะปัจจุบัน (อัปเดต 2026-09-12):** เปลี่ยน OA ใหม่อีกรอบ (ตัวเก่า `@932cycnq` ถูกลบแล้วจริง ไม่ใช่แค่เลิกใช้) — ยืนยันทำงานจริงแล้วแบบ end-to-end:
   > - Provider: `นิติบุคคลหมู่บ้านแมกไม้`
   > - LINE Login channel: **`Makmai Tennis Login`** — Channel ID `2011484812` (ไม่เปลี่ยนแปลง ตั้งค่าไว้ใน `config.js` → `lineChannelId` และ `worker/wrangler.toml` → `LINE_CHANNEL_ID` แล้ว)
   > - Messaging API channel (OA): **`แมกไม้ - แจ้งจองสนาม`** — Basic ID **`@194zuzqi`** (เปลี่ยนจาก `@932cycnq` เดิม เนื่องจากลบแล้วสร้างใหม่เพื่อทดสอบ) — token ตั้งค่าใน Worker secret `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` แล้ว, ทดสอบส่งจริงสำเร็จแล้ว
   > - เป็น OA ที่สร้างผ่าน **LINE Official Account Manager** (manager.line.biz → "สร้างใหม่") ไม่ใช่ Developers Console โดยตรง — ต้องเปิด **Messaging API** แยกต่างหากใน OA Manager (Settings → Messaging API → Enable Messaging API → เลือก Provider เดิม) จึงจะเชื่อมกับ Developers Console ได้
   >
   > ห้ามสับสนกับ channel เก่า (`Makmai tennis login` ตัวเดิม Channel ID `2011217015`, OA เก่าชื่อ "tennis booking test") — ตัวเก่าไม่ได้ใช้แล้ว ทิ้งไว้เฉยๆ ได้ ไม่ต้องลบ แต่**ห้ามเอา ID/secret ของตัวเก่ามาใส่โค้ดอีก**

   > สรุปสั้นๆ: **ใช่ ต้องมี 2 อย่าง** อยู่ใต้ Provider เดียวกัน และต้อง**ลิงก์กัน**:
   > 1. **LINE Login channel** (สถานะ Published) — ใช้ให้ลูกบ้าน "ล็อกอิน" เข้าเว็บเท่านั้น ส่งข้อความไม่ได้
   > 2. **Messaging API channel** (คือตัว OA) — ใช้ "ส่งข้อความ" แจ้งเตือนเท่านั้น ล็อกอินไม่ได้
   >
   > ทั้งสองตัวอยู่ใต้ Provider **"นิติบุคคลหมู่บ้านแมกไม้"** แล้ว (ดูสถานะปัจจุบันด้านบน)

   ---

   ## 📌 ชื่อที่ใช้ (ตั้งไว้แล้ว พิมพ์ตามนี้ทุกจุด กันสับสน)

   ใช้ชื่อเดียวกันนี้ทุกครั้งที่ระบบขอ "Channel name" — ถ้าติดปัญหาตรงไหน บอกผมว่า "channel Login" หรือ
   "channel Messaging API" ได้เลย จะตรวจสอบง่าย ไม่ต้องเดา:

   | อะไร | ชื่อที่ใช้ |
   |---|---|
   | Provider (ถ้าต้องสร้างใหม่) | `นิติบุคคลหมู่บ้านแมกไม้` |
   | LINE Login channel | `แมกไม้ จองสนามเทนนิส` |
   | Messaging API channel (คือ OA ใหม่) | `แมกไม้ จองสนามเทนนิส` |

   (ตั้งชื่อ Login กับ Messaging API เหมือนกันได้ปกติ เพราะเป็นคนละ channel type อยู่คนละแท็บกัน — ทำให้ลูกบ้าน
   เห็นชื่อเดียวกันทั้งตอน login และตอนแอดเพื่อน OA ดูเป็นมืออาชีพและไม่งง)

   ---

   ## ทำไมต้องมี 2 channel แยกกัน

   | | LINE Login channel | Messaging API channel (OA) |
   |---|---|---|
   | ใช้ทำอะไร | ให้ผู้ใช้กดปุ่ม "เข้าสู่ระบบด้วย LINE" | ส่งข้อความแจ้งเตือนอัตโนมัติ (เช่น ยืนยันชำระเงินแล้ว) |
   | ในโค้ดใช้ที่ไหน | `config.js` → `lineChannelId` | Cloudflare Worker secret → `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` |
   | ผู้ใช้ต้องทำอะไรก่อน | กด "ยินยอม" ตอนล็อกอิน | ต้อง "เพิ่มเพื่อน" (Add friend) กับ OA นี้ก่อน ไม่งั้นส่งข้อความไม่ถึง |

   ถ้าใช้ channel เดียวกันจะไม่ได้ เพราะ LINE Login ไม่มีสิทธิ์ยิง Messaging API และ Messaging API เพียวๆ ก็ไม่มีปุ่ม login ให้ผู้ใช้กด

   ---

   ## ขั้นตอนที่ 1 — สร้าง Provider (ถ้ายังไม่มี)

   ข้ามได้ถ้ามีอยู่แล้ว (กรณีนี้คือ Provider ชื่อ **"Makmai Tennis test"**)

   1. ไปที่ https://developers.line.biz/console
   2. ถ้ายังไม่มี Provider ให้กด **Create a new provider** → ตั้งชื่อ เช่น `Makmai Tennis test`

   ## ขั้นตอนที่ 2 — สร้าง LINE Login channel (สำหรับ "ล็อกอิน")

   ข้ามได้ถ้ามีอยู่แล้ว (กรณีนี้คือ **"Makmai tennis login"**)

   1. ในหน้า Provider → **Create a new channel** → เลือก **"LINE Login"**
   2. ตั้งชื่อ channel เช่น `Makmai tennis login`
   3. กรอกข้อมูลที่จำเป็น (App type: Web app, ชื่อบริษัท/แอป ฯลฯ) แล้ว Create
   4. แท็บ **LINE Login** ของ channel นี้:
      - **Callback URL** → ใส่ GitHub Pages URL ของเว็บ (เช่น `https://<user>.github.io/makmai-tennis-v2/`) ให้ตรงเป๊ะ
      - **Scopes** → เปิด `profile` และ `openid`
   5. เก็บค่า **Channel ID** และ **Channel secret** (แท็บ Basic settings) → เอาไปใส่ `config.js` (`lineChannelId`) และ Worker (`LINE_CHANNEL_ID` / secret `LINE_CHANNEL_SECRET`)
   6. ต้องให้สถานะเป็น **Published** (ไม่ใช่ Developing) ผู้ใช้จริงถึงจะล็อกอินได้ทุกคน (ถ้ายังเป็น Developing จะจำกัดเฉพาะคนที่ถูกเพิ่มเป็น tester)

   ## ขั้นตอนที่ 3 — สร้าง Messaging API channel (คือตัว OA สำหรับส่งข้อความ)

   ข้ามได้ถ้ามีอยู่แล้ว

   1. ใน**หน้า Provider เดียวกัน** (ห้ามสร้างคนละ Provider) → **Create a new channel** → เลือก **"Messaging API"**
   2. ตั้งชื่อว่า `หมู่บ้านแมกไม้ - แจ้งเตือนจองสนาม`
   3. กรอกข้อมูลที่จำเป็น (หมวดหมู่ธุรกิจ, คำอธิบาย ฯลฯ) แล้ว Create
   4. แท็บ **Messaging API** → เลื่อนลงหา **Channel access token** → กด **Issue** (แบบ long-lived) → คัดลอกเก็บไว้ (ใช้ครั้งเดียว เห็นค่าเต็มตอน issue เท่านั้น)

   ## ขั้นตอนที่ 4 — ลิงก์ 2 channel เข้าด้วยกัน (สำคัญที่สุด ห้ามลืม)

   ถ้าไม่ทำขั้นนี้ user ID ตอน login จะคนละอันกับตอนส่งข้อความ ระบบแจ้งเตือนจะหาไม่เจอว่าจะส่งหาใคร

   1. เปิด channel **LINE Login** (`Makmai tennis login`)
   2. ไปแท็บ **LINE Login**
   3. หาช่อง **"Linked OA"** (หรือ "OA to be linked")
   4. เลือก Official Account ที่สร้างในขั้นตอนที่ 3 → **Update**
   5. ตรวจว่าสถานะขึ้นว่าลิงก์แล้ว (linked/ผูกสำเร็จ)

   ## ขั้นตอนที่ 5 — เปิดให้ลูกบ้าน "เพิ่มเพื่อน" กับ OA

   LINE จะส่งข้อความหาได้เฉพาะคนที่เป็นเพื่อนกับ OA แล้วเท่านั้น

   1. ใน channel Messaging API ของ OA → แท็บ **Messaging API**
   2. คัดลอก **QR Code** ของ OA (อยู่ในหน้าเดียวกัน) → เอาไปแปะประกาศ/กลุ่มไลน์หมู่บ้าน ให้ลูกบ้านสแกนเพิ่มเพื่อนก่อนใช้งานระบบ
   3. (ไม่บังคับ) ตั้งค่า **Greeting message** / **Auto-reply message** — ไปที่ https://manager.line.biz
      เลือก OA นี้ → แท็บ **Home** → **Greeting message** (ข้อความต้อนรับ ส่งอัตโนมัติทันทีที่มีคนเพิ่มเพื่อน)
      และแท็บ **Chat** → **Response settings** → เปิด **Auto-reply messages** ถ้าต้องการให้ตอบอัตโนมัติเวลามีคนพิมพ์คุยมา
      ตัวอย่างข้อความที่ใช้ได้เลย (แก้ชื่อ/ลิงก์ให้ตรงของจริง):

      **Greeting message:**
      ```
      สวัสดีค่ะ 🎾 ยินดีต้อนรับสู่ LINE OA ระบบแจ้งเตือนการจองสนามเทนนิส หมู่บ้านแมกไม้

      OA นี้ใช้ส่งแจ้งเตือนสถานะการจอง/การชำระเงินเท่านั้นค่ะ (ไม่มีเจ้าหน้าที่คอยตอบแชท)

      📌 จองสนามได้ที่: https://chumphola-coder.github.io/makmai-tennis-v2/
      📌 สอบถามเพิ่มเติม ติดต่อนิติบุคคลหมู่บ้านแมกไม้ได้ตามช่องทางปกติค่ะ
      ```

      **Auto-reply message:**
      ```
      ขอบคุณที่ทักมานะคะ 🙏 OA นี้เป็นระบบส่งแจ้งเตือนอัตโนมัติ ไม่มีเจ้าหน้าที่คอยตอบแชทค่ะ

      หากต้องการจองสนามเทนนิส กรุณาเข้าเว็บไซต์: https://chumphola-coder.github.io/makmai-tennis-v2/
      หากมีข้อสงสัยอื่น ติดต่อนิติบุคคลหมู่บ้านแมกไม้โดยตรงได้เลยค่ะ
      ```

   ## ขั้นตอนที่ 6 — เอา Channel Access Token ใส่ Cloudflare Worker

   ```bash
   cd worker
   npx wrangler secret put LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
   ```
   วาง token จากขั้นตอนที่ 3.4 แล้ว Enter จากนั้น deploy ใหม่:
   ```bash
   npx wrangler deploy
   ```

   ## ขั้นตอนที่ 7 — ทดสอบ

   - ให้ผู้ทดสอบล็อกอินเว็บด้วย LINE (ผ่าน `Makmai Tennis Login` channel) และเพิ่มเพื่อน OA ตามขั้นตอนที่ 5
   - ทำการจองสนาม + อัปโหลดสลิป แล้วให้ admin กด "✅ ยืนยันการชำระ"
   - ถ้าตั้งค่าครบและลิงก์ถูกต้อง ผู้ทดสอบควรได้รับข้อความแจ้งเตือนจาก OA ทาง LINE
   - ✅ **ยืนยันแล้ว (2026-09-12):** ทดสอบ end-to-end จริง — ลงทะเบียนด้วยบัญชี LINE จริง → admin ได้รับแจ้งเตือนคำขอลงทะเบียน → admin กดอนุมัติ → ผู้ใช้ได้รับข้อความต้อนรับทาง LINE → จองสนาม + อัปโหลดสลิป → admin กดยืนยันการชำระ → ผู้ใช้ได้รับแจ้งเตือนยืนยันการชำระจริง

   ---

   **เช็คลิสต์สรุป (อัปเดต 2026-09-12):**
   - [x] Provider: `นิติบุคคลหมู่บ้านแมกไม้`
   - [x] LINE Login channel: `Makmai Tennis Login` (Channel ID `2011484812`, Published) — ใส่ใน `config.js`/`wrangler.toml` แล้ว
   - [x] Messaging API channel (OA): `แมกไม้ - แจ้งจองสนาม` (@194zuzqi) สร้างใหม่แล้ว (ตัวเก่า @932cycnq ถูกลบไปแล้ว)
   - [x] Linked OA ในแท็บ Basic settings ของ Login channel ชี้ไปที่ OA นี้แล้ว
   - [x] Channel access token ใส่ใน `wrangler secret put LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` แล้ว deploy แล้ว
   - [x] ทดสอบส่งข้อความจริงสำเร็จ end-to-end — **ผ่านแล้ว (2026-09-12)** ครบทุกขั้นตอน (ลงทะเบียน → อนุมัติ → ต้อนรับ → จอง+อัปโหลดสลิป → ยืนยันการชำระ) ได้รับข้อความจริงทาง LINE ทุกจุด
