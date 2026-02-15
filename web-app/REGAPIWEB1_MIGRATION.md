# Migration to regapiweb1 API

## Overview

ระบบได้ย้ายจาก `regapiweb2/Enroll/Timetable` (coverage 16.7%) ไปใช้ `regapiweb1/Timetable/Timetable` (coverage 66.7%) แล้ว

## What Changed

### Before (regapiweb2)
```javascript
// regapiweb2/api/th/Enroll/Timetable
{
  weekday: 5,
  tfrom: 16,
  mfrom: 0,
  tto: 19,
  mto: 0,
  coursecode: "080203908",
  roomname: "78-223",
  sectioncode: "5"
  // ❌ No course name
  // ❌ No teacher name
  // ❌ No exam dates
}
```

**Problems**:
- มีข้อมูลแค่ 1/6 วิชา (16.7%)
- ต้อง lookup ชื่อวิชาจาก Grade/Showgrade
- ไม่มีชื่ออาจารย์
- ไม่มีวันสอบ

### After (regapiweb1)
```javascript
// regapiweb1/api/th/Timetable/Timetable/2568/2
{
  coursecode: "010913121",
  coursename: "วิศวกรรมการบำรุงรักษา",
  coursenameeng: "Maintenance Engineering",
  time: "<B><FONT COLOR=#5080E0>พ.</FONT></B>13:00-16:00",
  roomtime: "81-IE-รัตติฯ",
  sectioncode: "S.2",
  classofficer: "<LI>รองศาสตราจารย์สมเกียรติ จงประสิทธิ์พร",
  creditattempt: 3,
  f_exam: "27 มี.ค. 2569<BR>เวลา 09:00-12:00"
  // ✅ Has course names (TH+EN)
  // ✅ Has teacher name
  // ✅ Has exam dates
  // ✅ 4/6 courses (66.7%)
}
```

**Benefits**:
- ✅ Coverage เพิ่มจาก 16.7% → 66.7%
- ✅ ชื่อวิชาภาษาไทย + อังกฤษ
- ✅ ชื่ออาจารย์ผู้สอน
- ✅ วันสอบกลางเทอม/ปลายเทอม
- ✅ ไม่ต้อง lookup ข้ามหลาย API

## Data Processing

### 1. Decode Gzip Response
```javascript
const zlib = require('zlib');

function decodeGzipResponse(base64String) {
    const compressedBuffer = Buffer.from(base64String, 'base64');
    const decompressed = zlib.gunzipSync(compressedBuffer);
    return JSON.parse(decompressed.toString('utf-8'));
}

// Usage
const data = decodeGzipResponse(response.data.result);
```

### 2. Parse HTML Time
```javascript
function parseTimeHtml(timeHtml) {
    // Input: "<B><FONT COLOR=#5080E0>พ.</FONT></B>13:00-16:00"
    // Output: { weekday: 4, timefrom: "13:00", timeto: "16:00" }
    
    const dayMap = { 'จ': 2, 'อ': 3, 'พ': 4, 'พฤ': 5, 'ศ': 6, 'ส': 7 };
    const dayMatch = timeHtml.match(/>([จอพพฤศส])\.?</);
    const timeMatch = timeHtml.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
    
    return {
        weekday: dayMatch ? dayMap[dayMatch[1]] : null,
        timefrom: timeMatch ? timeMatch[1] : null,
        timeto: timeMatch ? timeMatch[2] : null
    };
}
```

### 3. Strip HTML Tags
```javascript
function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').trim();
}

// Example
stripHtml("<LI>รองศาสตราจารย์สมเกียรติ จงประสิทธิ์พร")
// → "รองศาสตราจารย์สมเกียรติ จงประสิทธิ์พร"
```

## API Response Structure

### New Response Format
```json
{
  "success": true,
  "data": [...],          // All courses (scheduled + unscheduled)
  "scheduled": [...],     // Courses with time (4 items)
  "unscheduled": [...],   // Courses without time (2 items)
  "semester": "2/2568",
  "stats": {
    "total": 6,
    "withSchedule": 4,
    "withoutSchedule": 2
  }
}
```

### Item Schema
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

## Frontend Migration Guide

### Old Code (ใช้ data เท่านั้น)
```jsx
const { data } = await fetch('/api/student/schedule').then(r => r.json());
data.forEach(item => {
  console.log(item.subject_name_en); // ❌ May be null
});
```

### New Code (แยก scheduled/unscheduled)
```jsx
const { scheduled, unscheduled, stats } = await fetch('/api/student/schedule').then(r => r.json());

// Courses with time
scheduled.forEach(item => {
  console.log(`${item.subject_name_th} (${item.subject_name_en})`);
  console.log(`วัน ${item.weekday} เวลา ${item.timefrom}-${item.timeto}`);
  console.log(`ห้อง ${item.roomcode}`);
  console.log(`อาจารย์: ${item.teach_name}`);
});

// Courses without time
unscheduled.forEach(item => {
  console.log(`${item.subject_name_th} - ยังไม่กำหนดเวลา`);
});

console.log(`Coverage: ${stats.withSchedule}/${stats.total} courses`);
```

## Testing

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
  const res = await axios.get('http://localhost:3000/api/student/schedule', {
    headers: { Cookie: cookies }
  });
  console.log(JSON.stringify(res.data, null, 2));
}
test();
"
```

## Notes

1. **Backward Compatible**: Response ยังมี `data` field อยู่ (รวม scheduled + unscheduled)
2. **Extra Fields**: `teach_name`, `exam_final`, `credit` เพิ่มใหม่
3. **HTML Parsing**: ระบบจัดการ HTML tags อัตโนมัติแล้ว
4. **Compression**: Backend decode gzip ให้แล้ว frontend ไม่ต้องทำ
