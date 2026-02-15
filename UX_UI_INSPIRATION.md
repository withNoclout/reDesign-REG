# 🎨 UX/UI Design Instructions: Cherry-Picked from "ProMax"

Based on the analysis of `ndt-draft/ai-practice` (UI/UX ProMax), we have extracted specific design patterns to elevate the `reDesign-REG` project. These patterns are to be integrated with our existing **Glassmorphism** and **KMUTNB Orange** theme.

## 1. Typography & Hierarchy (The "Executive" Look)
**Source**: `resume5.html` Header & Section Titles
**Instruction**:
-   Use **uppercase** text with **increased letter-spacing** (1.2px - 1.5px) for Page Titles and Section Headers.
-   **Application**:
    -   Page headings (e.g., "STUDENT PROFILE", "ACADEMIC TRANSCRIPT").
    -   Card headers (e.g., "CURRENT TERM", "NEWS").
-   **CSS Utility**: `uppercase tracking-wider font-light`

## 2. The "Split-Header" Layout
**Source**: `entry-header` class
**Instruction**:
-   For list items (like courses, schedule items, or history), use a flexbox layout that pushes the primary info to the left and secondary info (dates, grades, status) to the far right.
-   **Application**:
    -   **Grade List**: Course Name (Left) | Grade/Credit (Right).
    -   **Schedule**: Subject Code (Left) | Time/Room (Right).
-   **CSS Pattern**: `flex justify-between items-baseline`

## 3. The "Info Grid"
**Source**: `skills-grid` class
**Instruction**:
-   Display dense information (student attributes, credits) in a clean **3-column grid** (desktop) or **2-column grid** (tablet).
-   **Application**:
    -   Student Info Card (Faculty, Department, Level).
    -   Credit Summary (Earned, Registered, GPA).
-   **CSS Pattern**: `grid grid-cols-2 md:grid-cols-3 gap-4`

## 4. Minimalist List Markers
**Source**: `entry-description li:before` (Custom dash)
**Instruction**:
-   Instead of heavy bullet points, use subtle typographic markers (long em-dashes `—` or small dots) for lists to maintain a clean look.
-   **Application**:
    -   News updates summary.
    -   Prerequisite course lists.

---

## 🛠️ Implementation Status Review

### ✅ Skills Applied to Project
1.  **Modern Component Architecture**:
    -   *Applied*: We are using React Functional Components with `framer-motion` for all new UI (Error Boundary, Login).
2.  **Glassmorphism**:
    -   *Applied*: The `ErrorAlert` and `ErrorBoundary` components use `backdrop-blur`, `bg-white/10`, and subtle white borders, matching the "ProMax" standard of clean, modern UI.
3.  **Responsive Grid**:
    -   *Applied*: The Dashboard (`page.js`) already utilizes responsive grids for the profile and news sections.

### 🚀 Recommended Next Steps (Based on Cherry-Pick)
-   **Refactor Typography**: Update the "Welcome" and "Profile" headers to use the "Executive" uppercase style (`uppercase tracking-wider`).
-   **Enhance Lists**: Update the "Grade" or "Schedule" lists to use the **Split-Header** pattern for better readability.
