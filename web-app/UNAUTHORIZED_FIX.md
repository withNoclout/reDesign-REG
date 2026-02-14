# แก้ปัญหา "Unauthorized" - เสร็จสมบูรณ์ ✅

## สิ่งที่ทำไป

### 1. เปิด Mock Auth ✅
แก้ไข `web-app/.env.local`:
```bash
MOCK_AUTH=true
```
**หมายเหตุ:** ตอนนี้ระบบจะ bypass University API และใช้ mock user ID แทน

### 2. ตรวจสอบ temp folder ✅
Folder `web-app/public/temp/` มีอยู่แล้วพร้อมใช้งาน

## สิ่งที่ต้องทำถัดไป

### 1. Restart Dev Server (สำคัญ!)
ต้อง restart dev server เพื่อให้ environment variable ใหม่มีผล:

**วิธีที่ 1: ใน terminal**
- กด `Ctrl+C` เพื่อ stop server
- พิมพ์ `npm run dev` ใหม่อีกครั้ง

**วิธีที่ 2: ใน VS Code**
- ปิด terminal ที่รัน `npm run dev`
- เปิด terminal ใหม่แล้วรัน `npm run dev`

### 2. เปิด Portfolio Page
หลังจาก restart server แล้ว:
1. เปิด browser ไปที่ `http://localhost:3000/portfolio`
2. ควรจะไม่เห็น "unauthorized" แล้ว

### 3. ทดสอบ Upload
1. กด "Add Content"
2. เลือกภาพ
3. ใส่ description
4. กด "Post Content"
5. ดู notification มุมซ้ายล่าง "กำลังอัพโหลดภาพ..."
6. เมื่อ upload เสร็จ หน้าจะ refresh อัตโนมัติ

## สิ่งที่คาดหวัง

### หลังจากกด "Post Content":
1. ✅ Modal จะปิดลง
2. ✅ Notification จะปรากฏขึ้น "กำลังอัพโหลดภาพ..."
3. ✅ มี spinner หมุนอยู่ใน notification
4. ✅ หลังจาก 2-5 วินาที หน้าจะ refresh
5. ✅ รูปภาพจะปรากฏขึ้นใน portfolio grid

### หากยังเจอปัญหา:

**ถ้าเจอ "unauthorized" อีก:**
- ตรวจสอบว่า restart dev server แล้วจริงๆ
- เปิด Browser Console (F12) ดู error อะไร

**ถ้าไม่เห็น notification:**
- เปิด Browser Console (F12) ดูว่ามี error อะไร
- ดูใน terminal ว่ามี log ปรากฏบ้างไหม

**ถ้า upload ไม่สำเร็จ:**
- เปิด Browser Console (F12)
- ดูใน terminal สำหรับ log `[Portfolio API]` และ `[Upload Script]`

## เช็คลิสต์

- [ ] Restart dev server
- [ ] เปิด portfolio page
- [ ] ทดสอบ upload ภาพ
- [ ] ตรวจสอบว่าภาพปรากฏขึ้น
- [ ] ตรวจสอบว่า temp file ถูกลบ

## หมายเหตุ

**Mock Auth Mode:**
- ระบบจะใช้ `mock_student_67` เป็น user ID
- ไม่ต้อง login กับ University API
- ง่ายสำหรับการทดสอบและ develop

**เมื่อ deploy จริง:**
- ต้องแก้กลับ `# MOCK_AUTH=true` (comment ออก)
- หรือลบบรรทัดนั้นทิ้ง
- ผู้ใช้ต้อง login กับ University API