# UI/UX Context & Best Practices: KMUTNB Registration System

Based on [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), this document defines the design standards for the ongoing modernization of the Registration System.

## 1. Domain & Strategy
**Category:** Government/Education Service (Hybrid with SaaS Dashboard)
**Core Value:** Trust, Clarity, Accessibility, and Modern Aesthetic.

### Target Design Profile
*   **Pattern:** Hero-Centric (Login) + Data-Dense Dashboard (Internal)
*   **Style:** **Soft UI Evolution** mixed with **Glassmorphism** (for visually rich pages) and **Accessible Minimalism** (for functional pages).
*   **Mood:** Trustworthy but Modern (Not boring/legacy).

## 2. Design Tokens

### Colors
*   **Primary:** `#ff5722` (KMUTNB Orange) - Use for CTA, Highlights.
*   **Secondary:** `#1a1a2e` (Dark Navy) - Use for Backgrounds, Text.
*   **Surface:** Glass Effect (`rgba(255, 255, 255, 0.1)` + Blur 10px).
*   **Status:**
    *   Success: `#2ec4b6` (Teal/Green)
    *   Error: `#e71d36` (Red)
    *   Warning: `#ff9f1c` (Yellow/Orange)

### Typography
*   **Thai:** `Prompt` (Google Fonts) - Modern, Loopless, Readable.
*   **English:** `Montserrat` (Google Fonts) - Geometric, clean.
*   **Scale:**
    *   Body: 16px (Minimum for readability)
    *   H1: 32px-48px (Bold)
    *   H2: 24px-32px (SemiBold)
    *   Input/Button: 16px

## 3. "Slop" Check & Anti-Patterns (To Avoid)
*   **Tiny Touch Targets:** Buttons/Inputs must be at least **44px (h-11)** height for mobile touch.
    *   *Current Code Check:* Inputs/Buttons should verify `h-11` or `p-3`.
*   **Missing Labels:** Do not rely on Placeholders alone. Use visible labels or `aria-label`.
*   **Low Contrast:** Ensure white text on glass background has sufficient opacity shadow or background blur.
*   **Cluttered Tables:** Avoid dense grids on mobile. Use Card layout for mobile view (`hidden md:table`).
*   **Slow Interactions:** Loading states must be shown for any generic wait time > 300ms.

## 4. Components & Positioning Rules
*   **Layout:**
    *   **Container:** `max-w-7xl mx-auto px-4` (Standard constraint).
    *   **Grid:** Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for dashboards.
    *   **Spacing:** Use consistent scale (`gap-4`, `p-6`, `m-4`). using arbitrary pixels (e.g., `margin-top: 27px`) is "Slop".
*   **Authentication Page:**
    *   Center alignment on desktop.
    *   Full width on mobile.
    *   Glass card must have 1px solid border (white/20%) for definition.

## 5. UI/UX Refinement Plan (Next Steps)
1.  **Enforce 44px Targets:** Update all buttons/inputs to `min-h-[44px]`.
2.  **Add Loading Skeletons:** For "Getenrollstage" data fetching.
3.  **Responsive Check:** Ensure Navbar collapses correctly on mobile (Hamburger menu).
4.  **Error Feedback:** Display API errors in Red Toast/Alerts, not just console logs.
