# Frontend Layout & Style Guidelines
This document strictly defines layout rules and style standards for the web application's frontend.

## 1. Grade View Hierarchy (หน้าผลการเรียน `app/grade`)
- **Strictly Grades Only:** The `/grade` page must exclusively render the Academic Record (GPA, Credits, Semester listings).
- **Separation of Concerns:** Functional items like "Teacher Evaluation" (`/evaluation`), "Schedule" etc., MUST be placed entirely within their respective sub-menus via `GradeSubNav`.
- **DO NOT** clutter the `/grade` page with external interactive cards, evaluation panels, or unrelated alerts unless it specifically concerns the student's grades viewing.

## 2. Shared Credentials for Proxy Functionality
- Operations that require background simulation on `reg2.kmutnb.ac.th` (such as Automatic Evaluations or Manual Scraped Questionnaires) utilize a shared backend-encrypted `password` stored securely in the Supabase database.

## 3. UI/UX Tone
- Use Modern minimalist styles (Glassmorphism, Dark Mode defaults).
- Avoid generic and out-of-place emojis (e.g., 🤖). Emphasize SVG-based UI icons (`lucide-react` or similar custom SVGs via `components/Icons`).
- Make actions seamless (one-click) wherever possible, utilizing background state synchronizations.
