# Portfolio Collaboration & Student Tagging — Full Implementation Plan

> **Version**: 3.0 (Implemented — Phase 0-3)  
> **Last Updated**: 2026-02-15  
> **Status**: IMPLEMENTED (Phase 0-3 complete, Phase 4 pending manual testing)

---

## 1. Problem Statement

When a student creates a portfolio item (e.g., a group project), only they can see it.
Other students who participated have no record of it on their profiles.
We need a **"Related Students"** feature that:
- Allows the portfolio creator to **tag classmates** by name/ID.
- Lets tagged students **discover** these portfolio items on their own feed.
- Is **secure** against abuse (fake tagging, data enumeration, injection).
- Is **extensible** for future modules (e.g., group assignments, event attendance).

---

## 2. Current Architecture Analysis

### 2.1 Database Tables (Supabase PostgreSQL)
| Table | Primary Key | Key Columns | Notes |
|---|---|---|---|
| `news_items` | `id` (UUID) | `title`, `description`, `image_url`, `created_by` (TEXT = std_code), `is_visible`, `uploaded_to_supabase` | Portfolio content. `created_by` is student code string like `s6701091611290`. |
| `student_profiles` | `student_id` (TEXT) | `faculty`, `department`, `major`, `advisor1-3` | Cached from external REG API. **No name column.** |
| `user_settings` | `user_id` (UUID/TEXT) | `portfolio_config` (JSONB) | Portfolio display preferences. |
| `user_verifications` | `user_code` (TEXT) | `is_verified`, `drive_connected`, `profile_image_url` | Verification status. |

### 2.2 Authentication Flow
- Login via **External REG API** (`reg4.kmutnb.ac.th`).
- JWT token stored in `reg_token` HttpOnly cookie.
- Student code stored in `std_code` HttpOnly cookie.
- `getAuthUser()` validates token with external API, returns `std_code`.
- **User profile data** (name, email, faculty) comes from JWT payload, stored in `sessionStorage` on frontend only.

### 2.3 Critical Discovery: No User Directory Table
⚠️ **There is NO local `users` table** with names/emails.
- Names come from the external REG API JWT (`tokenuser` payload).
- `student_profiles` only caches academic info (faculty, department), **NOT names**.
- This means we **cannot search students by name** without either:
  - (A) Creating a local `users` directory table populated at login, OR
  - (B) Searching the external REG API (unlikely to be permitted).

---

## 3. Potential Vulnerabilities Identified

### 🔴 Critical
| # | Vulnerability | Risk | Mitigation |
|---|---|---|---|
| V1 | **User Enumeration via Search API** | Attacker can enumerate all student IDs/names by brute-forcing the search endpoint. | Rate limit (5 req/min per user), minimum 3 chars, max 20 results, require authentication. |
| V2 | **Unauthorized Tagging (Spam/Harassment)** | Malicious user tags random students in inappropriate content. | Add `status` field to collaborator record (`pending`/`accepted`/`rejected`). Tagged student must **accept** to appear on their feed. |
| V3 | **SQL Injection in Search** | If search query is concatenated into raw SQL. | Use Supabase parameterized queries (`.ilike()`, `.or()`). Never use raw string interpolation. |
| V4 | **Service Role Key Exposure** | All API routes use `getServiceSupabase()` (admin access), bypassing RLS. | ✅ This is the existing pattern. Acceptable because API routes run server-side only. Add input validation layer. |

### 🟡 Medium
| # | Vulnerability | Risk | Mitigation |
|---|---|---|---|
| V5 | **No Consent Model** | Student gets tagged without permission = privacy concern. | Implement `pending` → `accepted` consent flow. |
| V6 | **Unbounded Collaborator Count** | User adds 1000 collaborators to one item → DB bloat. | Enforce max 20 collaborators per portfolio item. |
| V7 | **Cross-User Data Leakage** | Tagged student sees portfolio marked `is_visible: false` by owner. | Respect `is_visible` flag — don't show hidden items to collaborators. |

### 🟢 Low
| # | Vulnerability | Risk | Mitigation |
|---|---|---|---|
| V8 | **Stale Name Cache** | Student changes their name but local cache shows old name. | Add `updated_at` and refresh names periodically or on login. |

---

## 4. Missing Steps Identified (vs. Original Plan v1.0)

| # | Missing Step | Why It Matters |
|---|---|---|
| M1 | **No local users table** — Original plan assumed we could search a `users` table. It doesn't exist. | Must create `user_directory` table populated at login time. |
| M2 | **No consent/acceptance flow** — Original plan had no approval step. | Privacy requirement: tagged students should accept/reject. |
| M3 | **No max collaborator limit** — No bounds on how many students can be tagged. | Prevent abuse and DB bloat. |
| M4 | **No RLS policies designed** — Original plan didn't define Row Level Security. | Essential for Supabase security. |
| M5 | **No migration/rollback script** — Original plan had no schema migration. | Need versioned, reversible migration. |
| M6 | **No notification system** — Tagged student has no way to know they were tagged. | Need at least a visual indicator on login. |
| M7 | **`is_visible` handling for collaborators** — Not addressed. | Hidden items must not leak to collaborators. |
| M8 | **Search debounce & rate limiting** — Not specified on frontend or backend. | Prevent API abuse and excessive DB queries. |

---

## 5. Revised Database Schema (Future-Proof)

### 5.1 New Table: `user_directory` (Populated at Login)
```sql
CREATE TABLE IF NOT EXISTS user_directory (
    user_code    TEXT PRIMARY KEY,          -- Student code (e.g., "s6701091611290")
    name_th      TEXT,                       -- Thai name from JWT
    name_en      TEXT,                       -- English name from JWT
    email        TEXT,                       -- Email from JWT
    faculty      TEXT,                       -- Faculty (from student_profiles or JWT)
    avatar_url   TEXT,                       -- Profile image URL
    last_login   TIMESTAMPTZ DEFAULT NOW(), -- Last login timestamp
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for search performance (trigram for partial matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_user_directory_name_th ON user_directory USING gin (name_th gin_trgm_ops);
CREATE INDEX idx_user_directory_name_en ON user_directory USING gin (name_en gin_trgm_ops);
CREATE INDEX idx_user_directory_user_code ON user_directory USING btree (user_code);
```

**Why this table?**
- Currently, user names only exist in `sessionStorage` on the frontend.
- We need a server-side searchable directory.
- Populated via **upsert on every login** (zero extra API calls).
- **Future-proof**: Any module needing user lookup (chat, groups, assignments) can use this.

### 5.2 New Table: `portfolio_collaborators` (Join Table)
```sql
CREATE TABLE IF NOT EXISTS portfolio_collaborators (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portfolio_id    UUID NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    student_code    TEXT NOT NULL,           -- References user_directory.user_code
    added_by        TEXT NOT NULL,           -- Who tagged this student (creator's user_code)
    status          TEXT DEFAULT 'pending'   -- 'pending' | 'accepted' | 'rejected'
                    CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    responded_at    TIMESTAMPTZ,            -- When student accepted/rejected
    
    UNIQUE(portfolio_id, student_code)      -- Prevent duplicate tags
);

-- Performance indexes for RLS and queries
CREATE INDEX idx_collab_portfolio ON portfolio_collaborators (portfolio_id);
CREATE INDEX idx_collab_student ON portfolio_collaborators (student_code);
CREATE INDEX idx_collab_status ON portfolio_collaborators (status);
CREATE INDEX idx_collab_added_by ON portfolio_collaborators (added_by);
```

**Design Decisions:**
- `ON DELETE CASCADE`: If a portfolio item is deleted, all collaborator records are auto-cleaned.
- `UNIQUE(portfolio_id, student_code)`: Prevents tagging the same person twice.
- `status` with CHECK constraint: Enforces valid states at DB level.
- `added_by`: Audit trail — who tagged whom.

### 5.3 Row Level Security (RLS) Policies
```sql
-- Enable RLS
ALTER TABLE portfolio_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_directory ENABLE ROW LEVEL SECURITY;

-- Policy: User can see collaborations involving them
CREATE POLICY "Users see own collaborations"
    ON portfolio_collaborators FOR SELECT
    USING (student_code = current_setting('request.jwt.claim.sub', true)
           OR added_by = current_setting('request.jwt.claim.sub', true));

-- Policy: Only portfolio owner can INSERT collaborators
CREATE POLICY "Owner can add collaborators"
    ON portfolio_collaborators FOR INSERT
    WITH CHECK (added_by = current_setting('request.jwt.claim.sub', true));

-- Policy: Tagged student can UPDATE their own status (accept/reject)
CREATE POLICY "Student can respond to tag"
    ON portfolio_collaborators FOR UPDATE
    USING (student_code = current_setting('request.jwt.claim.sub', true))
    WITH CHECK (student_code = current_setting('request.jwt.claim.sub', true));

-- Note: Since we use getServiceSupabase() (service role), RLS is bypassed.
-- These policies serve as defense-in-depth if client-side Supabase is ever used.
```

---

## 6. API Design (Secure & Validated)

### 6.1 `POST /api/auth/login` — Update (Populate User Directory)
**Change**: After successful login, upsert into `user_directory`.
```
// After JWT decode, add:
await supabase.from('user_directory').upsert({
    user_code: userData.usercode,
    name_th: userData.username,
    name_en: userData.usernameeng,
    email: userData.email,
    avatar_url: userData.img,
    last_login: new Date()
}, { onConflict: 'user_code' });
```
**Security**: No extra external calls. Data comes from already-decoded JWT.

### 6.2 `GET /api/student/search?q=...` — New Endpoint
**Purpose**: Autocomplete for student search.
```
Input:  ?q=สมชาย (minimum 3 characters)
Output: { success: true, results: [
    { user_code: "s670109...", name_th: "สมชาย ...", name_en: "Somchai ...", avatar_url: "..." }
] }
```
**Security Layers:**
1. ✅ Authentication required (`getAuthUser()`)
2. ✅ Input validation: min 3 chars, max 50 chars, sanitize `<>"'&`
3. ✅ Rate limiting: 10 requests per minute per user
4. ✅ Result limit: max 10 results
5. ✅ Parameterized query: `.ilike('name_th', '%query%')` (no raw SQL)
6. ✅ Exclude self from results (don't show the searching user)

### 6.3 `POST /api/portfolio/content` — Update
**Change**: Accept `collaborators` array in FormData.
```
FormData fields:
  - title, description, image (existing)
  - collaborators: JSON string of ["s670109...", "s670210..."]
```
**Validation:**
- Max 20 collaborators per item.
- Each collaborator must exist in `user_directory`.
- Creator cannot tag themselves.
- Duplicate student codes are silently deduplicated.

### 6.4 `GET /api/portfolio/content` — Update
**Change**: Include items where current user is an **accepted** collaborator.
```sql
-- Pseudo-query:
SELECT * FROM news_items
WHERE created_by = $userId
   OR id IN (
       SELECT portfolio_id FROM portfolio_collaborators
       WHERE student_code = $userId AND status = 'accepted'
   )
ORDER BY created_at DESC;
```
**Important**: Filter out `is_visible = false` items for collaborators (only owner sees hidden items).

### 6.5 `PATCH /api/portfolio/collaborator` — New Endpoint
**Purpose**: Accept/Reject a collaboration tag.
```
Input:  { portfolio_id: "uuid", action: "accepted" | "rejected" }
Output: { success: true }
```
**Security**: Only the tagged student can accept/reject their own tag.

### 6.6 `GET /api/portfolio/collaborators?portfolio_id=...` — New Endpoint
**Purpose**: List collaborators for a specific portfolio item.
**Security**: Only the portfolio owner or accepted collaborators can view the list.

---

## 7. Frontend Design (UX/UI ProMax Alignment)

### 7.1 New Component: `StudentSearchInput`
**ProMax Patterns Applied:**
- **Executive Typography**: Label "RELATED STUDENTS" in `uppercase tracking-wider font-light`
- **Glassmorphism**: Dropdown uses `bg-black/80 backdrop-blur-md border border-white/10`
- **Split-Header**: Each result row: `Name (Left) → Student Code (Right)`

**Behavior:**
```
┌─────────────────────────────────────────────┐
│ 🔍 Search students...                      │
│ ┌─────────────────────────────────────────┐ │
│ │ [Avatar] สมชาย ใจดี        s670109...  │ │  ← Hover highlight
│ │ [Avatar] สมหญิง รักเรียน    s670210...  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Tagged: [🏷️ สมชาย ✕] [🏷️ สมหญิง ✕]       │  ← Removable chips
└─────────────────────────────────────────────┘
```

**Interaction:**
- Debounce: 300ms after typing stops.
- Keyboard: ↑↓ to navigate, Enter to select, Backspace to remove last chip.
- Max display: 10 results.
- Self-exclusion: Current user is not shown in results.

### 7.2 Update: `PortfolioEditorModal`
- Add `StudentSearchInput` as a new row in the table after "Content".
- Label: "Related Students" / "นักศึกษาที่เกี่ยวข้อง"
- State: `selectedStudents: [{ user_code, name_th, avatar_url }]`

### 7.3 Update: `PortfolioGrid` — Collaboration Badge
For items where `is_collaborator === true`:
```
┌──────────────────────────┐
│  [Image]                 │
│                          │
│  🤝 Shared with you     │  ← Badge (top-left, glassmorphism)
│                          │
│  Project Title           │
│  Description...          │
│  Added by: สมชาย ใจดี    │  ← Shows who tagged you
│  2026-02-15              │
└──────────────────────────┘
```

### 7.4 New: Notification Indicator (Future Phase)
- On login, check for `pending` collaborations.
- Show a subtle badge/dot on the Portfolio section.
- User can accept/reject from a mini-panel.

---

## 8. Work Plan (Ordered by Dependency)

### Phase 0: Shared Infrastructure ✅ COMPLETE
- [x] **0.1** Extracted reusable rate limiter → `lib/rateLimit.js` (sliding window, configurable namespace/maxAttempts/windowMs)
- [x] **0.2** Created `lib/sanitize.js` — input sanitization (escapeHtml, sanitizeSearchQuery, sanitizeStudentCodes, isValidStudentCode)
- [x] **0.3** Created `lib/apiResponse.js` — standardized response helpers (success, error, unauthorized, forbidden, rateLimited, notFound, validationError)
- [x] **0.4** Resolved `user_code` format: **NO 's' prefix** (e.g., "6701091611290"), consistent with `news_items.created_by` and `getAuthUser()`

### Phase 1: Foundation ✅ COMPLETE
- [x] **1.1** Create migration script: `scripts/create-user-directory-table.js`
- [x] **1.2** Create migration script: `scripts/create-portfolio-collaborators-table.js`
- [x] **1.3** ⏳ Run migrations against Supabase (SQL provided, needs manual execution)
- [x] **1.4** Updated `POST /api/auth/login` — refactored to use shared rate limiter + upserts `user_directory` on login

### Phase 2: Backend APIs ✅ COMPLETE
- [x] **2.1** Created `GET /api/student/search` — rate limited (10/min), sanitized, searches name_th/name_en/user_code
- [x] **2.2** Updated `POST /api/portfolio/content` — accepts `collaborators` JSON array, validates max 20, no self-tag, verifies user_directory
- [x] **2.3** Updated `GET /api/portfolio/content` — returns `collaborations` (accepted items) + `pending_count`, respects `is_visible`
- [x] **2.4** Created `PATCH /api/portfolio/collaborator` — accept/reject with ownership validation
- [x] **2.5** Created `GET /api/portfolio/collaborators` — paginated list with user_directory join + access control

### Phase 3: Frontend ✅ COMPLETE
- [x] **3.1** Created `StudentSearchInput` component — debounce 300ms, keyboard nav (↑↓Enter/Esc), removable chips, max 20
- [x] **3.2** Integrated `StudentSearchInput` into `PortfolioEditorModal` — "Related Students" row
- [x] **3.3** Updated `PortfolioGrid` — collaboration badge ("🤝 Shared with you"), "added by" label
- [x] **3.4** Created `PendingTagsBanner` — shows pending collaboration count with expand toggle
- [x] **3.5** Loading states — spinner in search input, disabled state when max reached

### Phase 4: Testing & Security (PENDING — Manual)
- [ ] **4.1** Test: Search with special characters (`<script>`, SQL keywords)
- [ ] **4.2** Test: Rate limiting (exceed 10 req/min)
- [ ] **4.3** Test: Max collaborator limit (try adding 21)
- [ ] **4.4** Test: Self-tagging prevention
- [ ] **4.5** Test: Hidden item visibility for collaborators
- [ ] **4.6** Test: Cascade delete (delete portfolio → collaborators removed)
- [ ] **4.7** Code review: Security audit of all new endpoints

---

## 9. Future Module Extensibility

The `user_directory` table is designed as a **shared foundation**:

| Future Module | How It Uses `user_directory` |
|---|---|
| **Group Assignments** | Search students to form groups → `group_members` join table |
| **Chat/Messaging** | Search recipients by name |
| **Event Attendance** | Tag attendees at events |
| **Peer Review** | Assign reviewers to submissions |
| **Activity Log** | Track who did what with user context |

The `portfolio_collaborators` pattern (join table + status) can be **replicated** for any module:
```
[module]_participants (
    id, [module]_id, student_code, added_by, status, created_at
)
```

---

## 10. Rollback Plan

If issues arise after deployment:
1. **Drop tables**: `DROP TABLE portfolio_collaborators; DROP TABLE user_directory;`
2. **Revert login route**: Remove the upsert line from `POST /api/auth/login`.
3. **Revert portfolio API**: Remove collaborator query from `GET /api/portfolio/content`.
4. **Remove new components**: Delete `StudentSearchInput.js`.
5. All changes are **additive** — no existing data is modified or deleted.

---

## 11. v3.0 Improvements (Best Practices Applied)

### Files Created
| File | Purpose |
|------|---------|
| `lib/rateLimit.js` | Reusable rate limiter with sliding window (replaces inline Map in login) |
| `lib/sanitize.js` | Input sanitization utilities (escapeHtml, sanitizeSearchQuery, etc.) |
| `lib/apiResponse.js` | Standardized API response helpers (success/error/unauthorized/etc.) |
| `scripts/create-user-directory-table.js` | Migration script for user_directory |
| `scripts/create-portfolio-collaborators-table.js` | Migration script for portfolio_collaborators |
| `app/api/student/search/route.js` | Student search endpoint with rate limiting |
| `app/api/portfolio/collaborator/route.js` | Accept/reject collaboration tags |
| `app/api/portfolio/collaborators/route.js` | List collaborators with pagination |
| `app/components/StudentSearchInput.js` | Autocomplete student search with chips UI |

### Files Modified
| File | Changes |
|------|---------|
| `app/api/auth/login/route.js` | Refactored to use shared rate limiter + upserts user_directory on login |
| `app/api/portfolio/content/route.js` | GET returns collaborations + pending_count; POST accepts collaborators array |
| `app/components/PortfolioEditorModal.js` | Added "Related Students" row with StudentSearchInput |
| `app/components/PortfolioGrid.js` | Added collaboration badges, "added by" label, PendingTagsBanner |

### Critical Issues Resolved (from v2.0 audit)
| Issue | Resolution |
|-------|-----------|
| C1: In-memory rate limiter not reusable | Extracted to `lib/rateLimit.js` with namespace support |
| C2: user_code format inconsistency | Resolved: **no 's' prefix** everywhere (matches existing `news_items.created_by`) |
| C3: No error handling strategy | Created `lib/apiResponse.js` with standardized format `{ success, data/error }` |
| C4: No sanitization library | Created `lib/sanitize.js` (zero external deps, supports Thai text) |
