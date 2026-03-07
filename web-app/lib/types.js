/**
 * @fileoverview Shared JSDoc type definitions for the REG KMUTNB web application.
 * 
 * ══════════════════════════════════════════════════════════════════════
 * BOUNDARY RULE:
 *   - Database (Supabase)  → snake_case  (student_id, current_year)
 *   - lib/ layer           → Adapter (translates between the two)
 *   - API Responses        → camelCase  (studentId, currentYear)
 *   - React Components     → camelCase  (studentId, currentYear)
 * ══════════════════════════════════════════════════════════════════════
 * 
 * This file contains NO runtime code. It is only for type-checking and
 * IntelliSense/autocomplete in editors like VS Code.
 */

// ─────────────────────────────────────────────────────────────
//  PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * A student's academic profile, as used across the JavaScript layer.
 * All fields are camelCase. DB stores these as snake_case.
 * 
 * @typedef {Object} StudentProfile
 * @property {string} studentId         - Unique student code e.g. "s6701091611290"
 * @property {string|null} faculty      - Faculty name in Thai
 * @property {string|null} department   - Department or ภาควิชา
 * @property {string|null} major        - Curriculum / หลักสูตร
 * @property {string|null} advisor1     - Primary advisor name
 * @property {string|null} advisor2     - Secondary advisor name (if any)
 * @property {string|null} advisor3     - Third advisor name (if any)
 * @property {number|null} admitYear    - BE year student was admitted
 * @property {number|null} currentYear  - Current academic year (BE)
 * @property {number|null} currentSemester - Current semester (1, 2, or 3)
 * @property {number|null} enrollYear   - Enrollment academic year
 * @property {number|null} enrollSemester - Enrollment semester
 * @property {string|null} avatarUrl    - Public URL from Supabase Storage bucket 'avatars'
 */

// ─────────────────────────────────────────────────────────────
//  API RESPONSES
// ─────────────────────────────────────────────────────────────

/**
 * Standard API success response wrapper.
 * @template T
 * @typedef {Object} ApiSuccessResponse
 * @property {true}  success
 * @property {T}     data
 */

/**
 * Standard API error response wrapper.
 * @typedef {Object} ApiErrorResponse
 * @property {false} success
 * @property {{ message: string, code?: string }} error
 */

// ─────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────

/**
 * The user object stored in React AuthContext after login.
 * 
 * @typedef {Object} AuthUser
 * @property {string} usercode       - Student code e.g. "s6701091611290"
 * @property {string} username       - Full name in Thai
 * @property {string} usernameeng    - Full name in English
 * @property {string} name           - Display name (Thai)
 * @property {string} nameeng        - Display name (English)
 * @property {string} email          - University email
 * @property {string} userstatus     - 'Y' = active, else inactive
 * @property {string} userstatusdes  - Thai description of status
 * @property {string[]} role         - Array of roles, e.g. ['student']
 * @property {string} img            - Profile image URL (custom or from university)
 * @property {string} originalImg    - Original university profile image URL
 * @property {string} reportdate     - Date of registration record
 */

// ─────────────────────────────────────────────────────────────
//  PORTFOLIO
// ─────────────────────────────────────────────────────────────

/**
 * A portfolio item stored in Supabase.
 * 
 * @typedef {Object} PortfolioItem
 * @property {string}   id           - UUID from Supabase
 * @property {string}   studentId    - Owner's student code
 * @property {string}   title        - Project title
 * @property {string}   description  - Description text
 * @property {string|null} imageUrl  - Public URL from Supabase Storage bucket 'portfolios'
 * @property {string}   createdAt    - ISO timestamp
 * @property {string}   updatedAt    - ISO timestamp
 */

export { }; // Make this a module (required for JSDoc to work correctly in some configs)
