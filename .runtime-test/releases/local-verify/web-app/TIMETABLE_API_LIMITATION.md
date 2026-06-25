# ⚠️ IMPORTANT: Timetable API Limitation

## ปัญหาที่พบ

**API Timetable ส่งข้อมูลไม่ครบ!**

### ข้อมูลจริง (User: s6701091611290)
- **วิชาที่ลงเรียน**: 6 วิชา
  1. 010913121 - MAINTENANCE ENGINEERING
  2. 010913132 - AUTOMATION SYSTEM
  3. 040203213 - NUMERICAL METHOD
  4. 040433001 - INTRO TO FOOD ENTREPRENEURSHIP
  5. 040503011 - STAT FOR ENGR & SCIENTISTS
  6. 080103002 - ENGLISH II

- **Timetable API**: 1 คาบเท่านั้น
  - 080203908 (วันศุกร์ 16:00-19:00)
  - ⚠️ รหัสวิชานี้ไม่อยู่ในรายการวิชาที่ลงเรียนเทอมปัจจุบัน!

## สาเหตุที่เป็นไปได้

1. **วิชา Online/Asynchronous** - ไม่มีตารางเรียนประจำ
2. **ยังไม่กำหนดเวลา** - อาจารย์ยังไม่ได้จัดตาราง
3. **API Limitation** - reg4 API อาจส่งเฉพาะวิชาที่มี `classid` หรือ `roomname`
4. **Data Inconsistency** - Timetable อาจเป็นข้อมูลเก่า หรือยังไม่ sync กับ Grade

## แนวทางแก้ไข

### Option 1: แสดงทั้ง Timetable + Courses (Recommended)
```
ตารางเรียน:
- วันศุกร์ 16:00-19:00 | 080203908 | ห้อง 78-223

วิชาที่ยังไม่มีเวลาเรียน:
- 010913121 - MAINTENANCE ENGINEERING
- 010913132 - AUTOMATION SYSTEM
- ... (4 วิชาอื่น)
```

### Option 2: แสดงเฉพาะที่มีตาราง
```
ตารางเรียน:
- วันศุกร์ 16:00-19:00 | 080203908 | ห้อง 78-223

หมายเหตุ: วิชาที่ไม่แสดงอาจเป็นวิชา Online หรือยังไม่กำหนดเวลา
```

### Option 3: Hybrid - ผสม Courses กับ Timetable
```javascript
// Merge courses with timetable
const enrichedCourses = courses.map(course => {
  const schedule = timetable.find(t => t.coursecode === course.coursecode);
  return {
    ...course,
    hasSchedule: !!schedule,
    schedule: schedule || null,
    displayTime: schedule 
      ? `${schedule.weekday} ${schedule.timefrom}-${schedule.timeto}`
      : 'ยังไม่กำหนดเวลาเรียน'
  };
});
```

## การ Implement ที่แนะนำ

### UI Design
```
┌─────────────────────────────────────┐
│ ตารางเรียน 2/2568                   │
├─────────────────────────────────────┤
│ ⏰ ตารางที่กำหนดแล้ว (1)           │
│   ศุกร์  16:00-19:00                │
│   080203908 | ห้อง 78-223           │
├─────────────────────────────────────┤
│ 📚 วิชาที่ยังไม่กำหนด (6)          │
│   • 010913121 MAINTENANCE ENGIN...  │
│   • 010913132 AUTOMATION SYSTEM     │
│   • ...                             │
└─────────────────────────────────────┘
```

### API Response Enhancement
```javascript
{
  "success": true,
  "data": {
    "scheduled": [
      {
        "weekday": 5,
        "timefrom": "16:00",
        "subject_id": "080203908",
        ...
      }
    ],
    "unscheduled": [
      {
        "coursecode": "010913121",
        "coursename": "MAINTENANCE ENGINEERING",
        "reason": "ยังไม่กำหนดเวลาเรียน"
      },
      ...
    ]
  },
  "stats": {
    "totalCourses": 6,
    "scheduledCount": 1,
    "unscheduledCount": 5
  }
}
```

## คำเตือน

1. **ไม่ควรคาดหวังว่าจะได้ตารางครบทุกวิชา**
2. **ต้องจัดการกรณี empty schedule**
3. **ควรแสดง message ชัดเจนว่าทำไมวิชาบางวิชาไม่มีในตาราง**
4. **พิจารณาให้ user กรอกตารางเองได้ (manual override)**

## Testing Note

ทดสอบกับ user s6701091611290:
- ✅ API ใช้งานได้
- ✅ ดึงข้อมูลวิชาได้ครบ (6 วิชา)
- ⚠️ ตารางเรียนมีแค่ 1 คาบ (ไม่ใช่ bug แต่เป็นข้อจำกัดของข้อมูล)
