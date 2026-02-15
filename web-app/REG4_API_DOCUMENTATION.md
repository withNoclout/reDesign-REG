# REG4 API Documentation

## 📋 สรุป API Routes ที่สร้าง

### 1. `/api/student/courses` - วิชาที่ลงเรียน
**วัตถุประสงค์**: ดึงรายการวิชาที่ลงเรียนในเทอมปัจจุบัน

**External APIs ที่ใช้**:
- `GET /Grade/Showgrade` - ดึงประวัติเกรดทั้งหมด (มีชื่อวิชา)
- `GET /Schg/Getacadstd` - ดึงข้อมูลเทอมปัจจุบัน (enrollsemester, enrollacadyear)

**Logic**:
1. เรียก Grade/Showgrade เพื่อดึงวิชาทั้งหมด
2. เรียก Schg/Getacadstd เพื่อหาเทอมปัจจุบัน
3. กรองเฉพาะวิชาที่ semester + acadyear ตรงกับเทอมปัจจุบัน
4. กรองวิชาที่ coursecode ไม่ว่าง และ coursename ไม่มี "TOTAL"

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "coursecode": "010913121",
      "coursename": "MAINTENANCE ENGINEERING",
      "creditattempt": 3,
      "sectioncode": "2",
      "acadyear": 2568,
      "semester": 2,
      "grade": null,
      "courseid": 4898
    }
  ],
  "semester": "2/2568",
  "currentAcadYear": 2568,
  "currentSemester": 2
}
```

### 2. `/api/student/schedule` - ตารางเรียน
**วัตถุประสงค์**: ดึงตารางเรียน (วัน เวลา ห้อง) พร้อมชื่อวิชา

**External APIs ที่ใช้**:
- `GET /Enroll/Timetable` - ตารางเรียน (มีเวลาแต่ไม่มีชื่อวิชา)
- `GET /Grade/Showgrade` - ใช้ lookup ชื่อวิชา
- `GET /Schg/Getacadstd` - ข้อมูลเทอมปัจจุบัน

**Logic**:
1. เรียก Timetable → ได้ weekday, tfrom, mfrom, tto, mto, coursecode, roomname
2. เรียก Grade/Showgrade → สร้าง Map[coursecode] = coursename
3. Merge: เอาชื่อวิชาจาก Map ใส่เข้าไปใน Timetable
4. Format เวลา: tfrom=16, mfrom=0 → "16:00"

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "weekday": 5,
      "timefrom": "16:00",
      "timeto": "19:00",
      "subject_id": "080203908",
      "subject_name_en": "...",
      "section": "5",
      "roomcode": "78-223",
      "teach_name": null
    }
  ],
  "semester": "2/2568"
}
```

## 🔌 External API Endpoints (reg4.kmutnb.ac.th)

Base URL: `https://reg4.kmutnb.ac.th/regapiweb2/api/th`

### ✅ ใช้งานได้

| Endpoint | Method | Purpose | Key Fields |
|----------|--------|---------|------------|
| `/Enroll/Timetable` | GET | ตารางเรียน | weekday, tfrom, mfrom, tto, mto, coursecode, roomname, sectioncode |
| `/Grade/Showgrade` | GET | ประวัติเกรด | coursecode, coursename, creditattempt, grade, acadyear, semester |
| `/Schg/Getacadstd` | GET | ข้อมูลนักศึกษา | enrollsemester, enrollacadyear |

### ❌ ไม่พบ (404)

- `/Enroll/Result`
- `/Enroll/Enrollresult`
- `/Enroll/GetEnroll`
- `/Enroll/ShowEnroll`

**Note**: ไม่มี API โดยตรงสำหรับ "วิชาที่ลงเรียน" จึงใช้ Grade/Showgrade กรองตามเทอมแทน

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

## ✅ ข้อมูลที่ได้

- ✅ ตารางเรียน (วัน เวลา ห้อง)
- ✅ รหัสวิชา
- ✅ ชื่อวิชา (EN)
- ✅ Section
- ✅ หน่วยกิต
- ✅ เกรด (วิชาที่เรียนแล้ว)
- ✅ เทอมปัจจุบัน

## ❌ ข้อมูลที่ไม่มี

- ❌ ชื่ออาจารย์ผู้สอน
- ❌ ชื่อวิชาภาษาไทย (มีแค่ EN)
- ❌ API แยกสำหรับ enrollresult

## 📝 Notes

1. **Authentication**: ใช้ Bearer token จาก `/api/auth/login` (session JWT ใน cookie `reg_token`)
2. **HTTPS Agent**: ต้องใช้ `rejectUnauthorized: false` เพราะ reg4 ใช้ self-signed cert
3. **Filtering**: Grade/Showgrade มี summary rows (coursecode="", coursename="TOTAL") ต้องกรองออก
4. **Time Format**: API ให้ tfrom/mfrom แยกกัน ต้อง format เป็น "HH:MM" เอง
5. **Course Names**: Timetable ไม่มีชื่อวิชา ต้อง lookup จาก Grade/Showgrade
