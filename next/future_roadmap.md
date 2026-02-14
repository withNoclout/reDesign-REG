# 🚀 Future Roadmap & Website Review

**Date**: 14 February 2026
**Status**: Planning Phase for Post-MVP

---

## 📊 Overall Website Review (Current Status)

### Strengths
1.  **Modern Tech Stack**: Next.js 14 + React Server Components provides a solid, performant foundation.
2.  **Secure Authentication**: Real API integration with HttpOnly cookies and server-side JWT decoding is excellent for security.
3.  **Clean UI Architecture**: Separation of `globals.css` from logic and component-based design (`UserProfileCard`, `AcademicInfoCard`) makes the codebase maintainable.
4.  **User Experience**: "Glassmorphism" design and English menu items (planned) will significantly improve usability over the legacy system.

### Weaknesses / Areas for Improvement
1.  **Error Resilience**: Currently handles basic API errors, but complex scenarios (API timeout, malformed data) might break the UI.
2.  **Mobile Optimization**: While responsive, complex tables (Transcript, Schedule) will be challenging on small screens.
3.  **Data Caching**: No aggressive caching strategy yet; every page load might hit the API, which could be slow.

---

## 🗺️ Strategic Plan: Post-Implementation Focus (Phase 7+)

After completing the current plan (UI Polish & Transcript), focus on these key pillars:

### 1. ⚡ Performance & Caching (PWA)
*Goal: Instant load times and offline capabilities.*

-   **Implement PWA (Progressive Web App)**: Allow students to "install" the app on their phones.
-   **SWR / React Query**: Use for data fetching instead of `useEffect`. It handles caching, revalidation, and offline fallback automatically.
-   **Image Optimization**: Use Next.js `<Image>` component for all assets to serve WebP format automatically.

### 2. 📄 Advanced Features (PDF & Export)
*Goal: Replace the need for the old system entirely.*

-   **PDF Generation**: Allow students to download their **Unofficial Transcript** and **Class Schedule** as PDF.
    -   *Tech*: `react-pdf/renderer` allow generating PDFs directly in the browser/server.
-   **Calendar Export**: "Add to Calendar" button for Class Schedule (export `.ics` file).

### 3. 🛡️ Robust Error Handling & Monitoring
*Goal: Zero crash experience.*

-   **Global Error Boundary**: Create `app/error.js` to catch crashes and show a "Try Again" button instead of a blank screen.
-   **Zod Schema Validation**: Validate API responses before using them. If the API changes format, we catch it early.

### 4. 📱 Mobile-First Complex Tables
*Goal: Readable constraints on mobile.*

-   **Card View for Mobile**: Instead of shrinking tables (Transcript/Schedule), transform each row into a "Card" on mobile screens.
-   **Horizontal Scroll Containers**: For wide tables, use hinted scroll indicators.

### 5. 🔍 Analytics & Feedback
*Goal: Understand user behavior.*

-   **Usage Tracking**: Track which features are used most (Schedule vs. Grades).
-   **Feedback Widget**: Add a small button for users to report bugs or suggest features directly.

---

## 🏆 Recommendation for Immediate Next Step

**Prioritize #1 (Performance/SWR)** and **#4 (Mobile Tables)**.
Students use mobile devices 80% of the time. Ensuring the Transcript and Schedule are readable on phones is critical for success.
