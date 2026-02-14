# แผนการพัฒนา Phase 5 & 6 (Detailed Roadmap)

เอกสารนี้รวบรวมแผนการพัฒนาส่วนที่เหลืออย่างละเอียด รวมถึงการปรับปรุง UI/UX (Menu Bar) และฟีเจอร์ในอนาคต (Grades, Schedules)

---

## 📅 Phase 5: Dashboard & Menu Refinement (Current)

เป้าหมาย: นำข้อมูลจริงมาแสดงผลบนหน้า Landing Page และปรับปรุงเมนูให้สวยงาม

### 1. Menu Bar Renaming (English)
เปลี่ยนชื่อเมนูจากภาษาไทยเป็นภาษาอังกฤษ เพื่อแก้ปัญหาตกบรรทัดและให้ดูทันสมัย

| เดิม (ไทย) | ใหม่ (อังกฤษ) | Endpoint ที่เกี่ยวข้อง |
|------------|-------------|----------------------|
| หน้าหลัก | **Home** | `/` (Landing) |
| ระเบียนประวัติ | **Profile** | (Future) |
| ตารางเรียน/สอบ | **Schedule** | `/Schg/Getclassschedule` |
| โครงสร้างหลักสูตร | **Curriculum** | (Static/PDF) |
| ค้นหาห้องว่าง | **Room Search** | (Future) |
| ข่าวสาร | **News** | (Mock) |
| ถาม-ตอบ | **FAQ** | (Static) |

### 2. Dashboard Integration
นำ `Shared Components` ที่เตรียมไว้มาประกอบร่างใน `app/landing/page.js`

- **Step 2.1: Connect AuthContext**
  - ใช้ `useAuth()` เพื่อดึงข้อมูล `user` (ชื่อ, รูปภาพ, สถานะ)
  - แสดงผลใน `<UserProfileCard />`

- **Step 2.2: Fetch Student Details**
  - สร้าง `useEffect` เพื่อเรียก `/api/student/info`
  - ทำงานเมื่อ component mount
  - แสดงผลใน `<AcademicInfoCard />` พร้อม Loading Skeleton

- **Step 2.3: Layout Adjustment**
  - จัดวาง Layout ใหม่:
    - **Left Column:** Profile Card
    - **Right Column:** News Grid
    - **Top (insert):** Academic Info Card (แนวนอน) หรือวางคู่กับ Profile

---

## 🚀 Phase 6: Extended Features (Future)

เป้าหมาย: เพิ่มฟีเจอร์หลักที่นักศึกษาต้องใช้งานจริง (ดูเกรด, ดูตารางเรียน)

### 1. Grade Report (ผลการเรียน)
แสดงผลการเรียนปัจจุบันและ GPAX

- **API Endpoint:** `/Schg/Getgrade` (ต้องการ Proxy ใหม่)
- **Component:** `<GradeSummaryCard />`
  - แสดง GPA ภาคเรียนล่าสุด
  - แสดง GPAX รวม
  - กราฟแนวโน้มเกรด (Chart.js / Recharts) - *Optional*

### 2. Class Schedule (ตารางเรียน)
แสดงตารางเรียนในรูปแบบปฏิทินรายสัปดาห์

- **API Endpoint:** `/Schg/Getclassschedule` (ต้องการ Proxy ใหม่)
- **Component:** `<WeeklySchedule />`
  - ตาราง Grid (จันทร์-อาทิตย์)
  - Slot วิชาเรียน (Time-based rendering)
  - คลิกเพื่อดูรายละเอียดรายวิชา

### 3. Exam Schedule (ตารางสอบ)
แสดงตารางสอบไล่/สอบกลางภาค

- **API Endpoint:** `/Schg/Getexamschedule` (ต้องการ Proxy ใหม่)
- **Component:** `<ExamList />`
  - รายการวิชาที่สอบ (Sorted by date)
  - Countdown ถึงวันสอบวิชาถัดไป

---

## 🎨 UI & UX Refinement (Immediate)

### 1. Menu Bar Polish
- **Problem**: Background overlap looks messy when scrolling.
- **Solution**: Increase `backdrop-filter: blur` constant and add a stronger gradient overlay.
- **Animation**: Add micro-animation to "REG KMUTNB" text (e.g., precise letter spacing transition or glow).

### 2. New Logo Design
- **Concept**: "ENG" text inside a red box (`#EE3F46`) with transparent fill.
- **Style**: Modern, clean, geometric.
- **Animation**: Subtle hover effect or entrance animation.

---

## 📜 Transcript Feature Planning (Phase 6.1)

### Requirement Analysis
ต้องการแสดงผลใบแสดงผลการเรียน (Transcript) แบบ Online

### Data Requirements vs. API Status
| Required Data | Status | Endpoint / Source |
|---------------|--------|-------------------|
| Student Info | ✅ Ready | `Getacadstd` |
| GPA per Semester | ❓ Check | `Getgrade` (Needs Verification) |
| Cumulative GPA (GPAX) | ❓ Check | `Getgrade` |
| Course List per Term | ❓ Check | `Getgrade` return detail? |
| Grade Symbols (A, B+) | ❓ Check | `Getgrade` |
| Credits Earned/Attempted | ❓ Check | `Getgrade` |

### Missing Information Analysis (Gap List)
1.  **Detailed Course list**: Does `Getgrade` return *all* courses for *all* semesters, or just summary?
    - If just summary, we might need a scraping strategy or find another endpoint (e.g., `Gettranscripts`).
2.  **Credit Summary**: Total credits required vs. earned (Curriculum progress).
3.  **Advisor Name**: Often needed on transcript header.

### Plan
1.  **Exploration**: Create `test-grade-api.js` to inspect `Getgrade` response full structure.
2.  **Mockup**: Design Transcript UI based on real data structure.
---

## 📅 Enrollment Result (Enrollment Confirmation) Feature (Phase 6.2)
*Ref: https://reg4.kmutnb.ac.th/registrar/enrollresult*

### Requirement Analysis
หน้านี้คือ "ผลการลงทะเบียนเรียน" (Enrollment Result) ซึ่งจะแสดงรายวิชาที่ลงทะเบียนในเทอมปัจจุบันพร้อมสถานะ

**Key Data Points Required:**
1.  **Course Code & Name**: e.g., `010123101 Computer Programming`
2.  **Section**: e.g., `1`, `2`
3.  **Credits**: e.g., `3 (2-2-5)`
4.  **Schedule**: Day, Time, Room (e.g., `Mo 09:00-12:00`, `Room 78-601`)
5.  **Status**: `Enrolled`, `Paid`, `Withdrawn` (CRITICAL)

### API Gap Analysis
| Required Data | Likely Endpoint | Status |
|---------------|-----------------|--------|
| Course List | `Getclassschedule` | ❓ To Verify |
| Section / Room | `Getclassschedule` | ❓ To Verify |
| Enrollment Status | `Getclassschedule` | ❓ Check if it returns "Status" |

### UI/UX Design Plan (Best Practices)
*Utilizing `framer-motion` & Glassmorphism*
1.  **Header Stats**: Card showing "Total Credits", "Total Courses", "Payment Status".
2.  **Course List**:
    -   **Desktop**: Clean Table with glass background. Hover effects on rows.
    -   **Mobile**: Stacked Cards (Course Name as header, Time/Room as detail).
3.  **Visual Feedback**:
    -   Status Tags: Green (Enrolled), Yellow (Pending), Red (Withdrawn).
    -   Animation: `staggerContainer` for list entry (using `lib/animations.js`).

### Implementation Steps
1.  **API Proxy**: Create `app/api/student/schedule/route.js`.
2.  **Service**: Create `services/studentService.js` to fetch and format data.
3.  **Component**: Create `EnrollmentTable.js` using generic `Table` or `Card` components.

---

## 🎨 Phase 2: UX/UI Improvements (Current)

เป้าหมาย: ปรับปรุงประสบการณ์ผู้ใช้และการเข้าถึงตามมาตรฐาน WCAG 2.1

### 1. Touch Target Size Fixes (WCAG 2.1 AA)
**Problem**: ปุ่มและอินพุตบางอันมีขนาดเล็กเกินไป ทำให้กดยากบนมือถือ

**Requirement**: องค์ประกอบที่กดได้ต้องมีขนาดอย่างน้อย 44x44px

**Files to Modify**:
- `app/page.js` (หน้า Login)
- `app/landing/page.js` (หน้า Landing)
- `app/components/*.js` (ทุก Components)

**Changes**:
- เพิ่ม `min-h-[44px]` หรือ `h-11` ให้ทุกปุ่ม
- เพิ่ม `min-h-[44px]` หรือ `h-11` ให้ทุก input
- เพิ่ม `min-h-[44px]` หรือ `h-11` ให้ทุก link ที่กดได้
- ตรวจสอบ hamburger menu touch area

**Testing**: ทดสอบบนอุปกรณ์มือถือจริง

---

### 2. Color Contrast Audit (WCAG AA)
**Problem**: สีบางส่วนอาจมีความคมชัดไม่เพียงพอ

**Requirement**: 
- ข้อความปกติ: อัตราส่วน 4.5:1
- ข้อความขนาดใหญ่: อัตราส่วน 3:1
- องค์ประกอบ UI: อัตราส่วน 3:1

**Files to Review**:
- `app/globals.css`
- `app/page.js` styles
- `app/landing/page.js` styles

**High-Risk Areas**:
1. **Glass background with white text** → เพิ่ม text shadow หรือ background เข้มขึ้น
2. **Error messages (red text)** → ตรวจสอบ contrast บนพื้นหลังขาว
3. **Status indicators** → ตรวจสอบทุก color combinations
4. **Link hover states** → ตรวจสอบว่าอ่านง่าย

**Testing**: ใช้ WebAIM Contrast Checker

---

### 3. Loading Skeletons for Data Fetching
**Problem**: ไม่มีสถานะ loading ที่ชัดเจนเมื่อดึงข้อมูล

**Files to Create**:
- `app/components/LoadingSkeletonCard.js`

**Files to Modify**:
- `app/components/AcademicInfoCard.js`
- `app/components/UserProfileCard.js`
- `app/landing/page.js` (News section)

**Changes**:
- สร้าง Skeleton component ใช้ร่วม
- แสดง skeleton เมื่อ `loading === true`
- Fade in เมื่อโหลดเสร็จ
- ใช้ `staggerContainer` animation สำหรับ list

---

### 4. Consistent Error Component
**Problem**: Error display ไม่สอดคล้อยกันทุกหน้า

**Files to Create**:
- `app/components/ErrorAlert.js`

**Features**:
- Glass background พร้อมขอบสีแดง
- Icon + message layout
- ปิดได้ (dismissible)
- ARIA labels สำหรับ accessibility
- Animation สำหรับ entry/exit

**Usage**:
```jsx
<ErrorAlert 
  message="เกิดข้อผิดพลาดในการเชื่อมต่อ"
  type="error"
  onDismiss={() => setError(null)}
/>
```

**Files to Integrate**:
- `app/landing/page.js` (แทนที่ error display ปัจจุบัน)

---

### 5. Mobile Menu Animation
**Problem**: Mobile menu เปิด-ปิดทันทีไม่ลื่นไหล

**Files to Modify**:
- `app/landing/page.js`

**Changes**:
- Import `AnimatePresence` จาก framer-motion
- Wrap menu ใน `AnimatePresence`
- Apply `mobileMenuSlide` variant
- Add exit animation

**Expected Result**: เมนูเลื่อนลง/ขึ้นอย่างลื่นไหล

