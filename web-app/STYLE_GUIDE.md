# Frontend Layout & Style Guidelines
This document strictly defines layout rules and style standards for the web application's frontend.

## 1. Grade View Hierarchy (หน้าผลการเรียน `app/grade`)
- **Strictly Grades Only:** The `/grade` page must exclusively render the Academic Record (GPA, Credits, Semester listings).
- **Separation of Concerns:** Functional items like "Teacher Evaluation" (`/evaluation`), "Schedule" etc., MUST be placed entirely within their respective sub-menus via `GradeSubNav`.
- **DO NOT** clutter the `/grade` page with external interactive cards, evaluation panels, or unrelated alerts unless it specifically concerns the student's grades viewing.

## 2. Security Boundary for Proxy-Like Features
- Features that would require background replay of a student's upstream credentials MUST be disabled until they can operate from a validated session token alone. The frontend MUST NOT assume the backend stores or can recover user passwords.

## 3. UI/UX Tone
- Use Modern minimalist styles (Glassmorphism, Dark Mode defaults).
- Avoid generic and out-of-place emojis (e.g., 🤖). Emphasize SVG-based UI icons (`lucide-react` or similar custom SVGs via `components/Icons`).
- Make actions seamless (one-click) wherever possible, utilizing background state synchronizations.
