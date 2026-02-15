# REG4 API Documentation

## 📋 สรุป API Routes ที่สร้าง

### 1. `/api/student/schedule` - ตารางเรียน ✅ UPDATED
**วัตถุประสงค์**: ดึงตารางเรียนครบถ้วนพร้อมข้อมูลอาจารย์และวันสอบ

**External APIs ที่ใช้** (⚡ ใช้ regapiweb1 แล้ว):
- `GET /Timetable/Timetable/{acadyear}/{semester}` (regapiweb1) - ตารางครบถ้วน ✅
  - Response: gzip-compressed base64 JSON
  - Data: coursecode, coursename (TH+EN), time (HTML), roomtime, classofficer, exam dates
- `GET /Schg/Getacadstd` (regapiweb2) - เทอมปัจจุบัน

**Data Processing**:
1. Decode: base64 → gunzip → JSON
2. Parse HTML: Extract วัน-เวลา จาก `<FONT>พ.</FONT>13:00-16:00`
3. Strip HTML tags จาก classofficer, roomtime
4. Separate scheduled (มีเวลา) vs unscheduled (ไม่มีเวลา)

**Coverage**: 66.7% (4/6 วิชามีตาราง, 2 วิชาไม่มี)

**Response**:
```json
{
  "success": true,
  "data": [...],           // All courses
  "scheduled": [...],      // Courses with time (4 items)
  "unscheduled": [...],    // Courses without time (2 items)
  "semester": "2/2568",
  "stats": {
    "total": 6,
    "withSchedule": 4,
    "withoutSchedule": 2
  }
}
```

**Sample Item** (scheduled):
```json
{
  "weekday": 4,
  "timefrom": "13:00",
  "timeto": "16:00",
  "subject_id": "010913121",
  "subject_name_en": "Maintenance Engineering",
  "subject_name_th": "วิศวกรรมการบำรุงรักษา",
  "section": "S.2",
  "roomcode": "81-IE-รัตติฯ",
  "teach_name": "รองศาสตราจารย์สมเกียรติ จงประสิทธิ์พร",
  "credit": 3,
  "exam_midterm": null,
  "exam_final": "27 มี.ค. 2569 เวลา 09:00-12:00"
}
```

## 🔌 External API Endpoints

### ⚡ regapiweb1 (reg3.kmutnb.ac.th) - RECOMMENDED

Base URL: `https://reg3.kmutnb.ac.th/regapiweb1/api/th`

| Endpoint | Method | Purpose | Response Format | Coverage |
|----------|--------|---------|----------------|----------|
| `/Timetable/Timetable/{year}/{sem}` | GET | ตารางเรียนครบถ้วน | gzip-compressed base64 | 66.7% ✅ |

**Response Decoding**:
```javascript
// 1. Decode base64
const compressed = Buffer.from(response.data.result, 'base64');
// 2. Decompress gzip
const decompressed = zlib.gunzipSync(compressed);
// 3. Parse JSON
const data = JSON.parse(decompressed.toString('utf-8'));
```

**Fields**:
- `coursecode`, `coursename` (TH), `coursenameeng` (EN)
- `time` (HTML): `<FONT COLOR=#5080E0>พ.</FONT>13:00-16:00`
- `roomtime`: ห้องเรียน
- `classofficer` (HTML): ชื่ออาจารย์
- `m_exam`, `f_exam`: วันสอบ
- `sectioncode`, `creditattempt`

### 🔧 regapiweb2 (reg4.kmutnb.ac.th) - For Metadata Only

Base URL: `https://reg4.kmutnb.ac.th/regapiweb2/api/th`

| Endpoint | Method | Purpose | Key Fields |
|----------|--------|---------|------------|
| `/Schg/Getacadstd` | GET | ข้อมูลนักศึกษา | enrollsemester, enrollacadyear |
| `/Grade/Showgrade` | GET | ประวัติเกรด | coursecode, coursename, grade |

### ❌ Deprecated (ไม่แนะนำ)

| Endpoint | Reason |
|----------|--------|
| `/Enroll/Timetable` (regapiweb2) | Coverage 16.7% เท่านั้น, ไม่มีชื่อวิชา/อาจารย์ |
| `/Enroll/Result` | ไม่พบ (404) |

## 📊 Data Mapping

### Timetable Response → Schedule Schema
```javascript
{
  weekday: item.weekday,              // 1-7 (จันทร์-อาทิตย์)
  timefrom: formatTime(tfrom, mfrom), // "16:00"
  timeto: formatTime(tto, mto),       // "19:00"
  subject_id: item.coursecode,
  subject_name_en: courseNames[coursecode], // lookup จาก Grade
  section: item.sectioncode,
  roomcode: item.roomname,
  teach_name: null                    // ไม่มีใน API
}
```

### Grade/Showgrade → Enrolled Courses
```javascript
{
  coursecode: "010913121",
  coursename: "MAINTENANCE ENGINEERING",
  creditattempt: 3,
  sectioncode: "2",
  acadyear: 2568,
  semester: 2,
  grade: null,  // null = กำลังเรียนอยู่
  courseid: 4898
}
```

## 🧪 Testing

Test script: `web-app/scripts/test-reg3-apis.js`

Test ด้วย real authentication:
```bash
cd web-app
node -e "
const axios = require('axios');
async function test() {
  const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
    username: 's6701091611290',
    password: '035037603za'
  });
  const cookies = loginRes.headers['set-cookie'].join('; ');
  
  const coursesRes = await axios.get('http://localhost:3000/api/student/courses', {
    headers: { Cookie: cookies }
  });
  console.log(JSON.stringify(coursesRes.data, null, 2));
}
test();
"
```

## ✅ ข้อมูลที่ได้ (Updated with regapiweb1)

- ✅ ตารางเรียน (วัน เวลา ห้อง) - **66.7% coverage**
- ✅ รหัสวิชา
- ✅ ชื่อวิชา (TH + EN) ⭐ NEW
- ✅ Section
- ✅ หน่วยกิต
- ✅ **ชื่ออาจารย์ผู้สอน** ⭐ NEW
- ✅ **วันสอบกลางเทอม/ปลายเทอม** ⭐ NEW
- ✅ เกรด (วิชาที่เรียนแล้ว)
- ✅ เทอมปัจจุบัน

## ⚠️ ข้อจำกัด

- ⚠️ 2/6 วิชา (33.3%) ไม่มีเวลาเรียนกำหนด (อาจเป็นวิชา Online/Async)
- ⚠️ Response เป็น gzip-compressed (ต้อง decode)
- ⚠️ เวลาเรียนและชื่ออาจารย์อยู่ในรูป HTML (ต้อง parse)

## 📝 Notes

1. **Authentication**: ใช้ Bearer token จาก `/api/auth/login` (session JWT ใน cookie `reg_token`)
2. **HTTPS Agent**: ต้องใช้ `rejectUnauthorized: false` เพราะ reg4 ใช้ self-signed cert
3. **Filtering**: Grade/Showgrade มี summary rows (coursecode="", coursename="TOTAL") ต้องกรองออก
4. **Time Format**: API ให้ tfrom/mfrom แยกกัน ต้อง format เป็น "HH:MM" เอง
5. **Course Names**: Timetable ไม่มีชื่อวิชา ต้อง lookup จาก Grade/Showgrade
