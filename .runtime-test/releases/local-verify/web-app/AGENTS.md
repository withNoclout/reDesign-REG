# AGENTS.md — REG KMUTNB Web Application

> **This file is the living contract for how this project is built.**  
> It must be read and followed by AI Agents (GitHub Copilot, Antigravity, etc.) and Human Developers.
> When in doubt about how to name a variable or structure a function — check here first.

---

## 📐 Boundary Rules (Most Important)

```
Database (Supabase)  ──[lib/ Adapter]──>  API Response  ──>  React Components
    snake_case                                camelCase          camelCase
   student_id                                studentId          studentId
   current_year                              currentYear        currentYear
```

**Rule: The `lib/` directory is the ONLY place that translates between `snake_case` ↔ `camelCase`.**
- Code **inside** `lib/` accesses Supabase columns by snake_case.  
- Everything **outside** `lib/` uses camelCase exclusively.

**Rule: NO MOCK DATA. All APIs and test scripts MUST use real authentication.**
- Do not use `MOCK_AUTH` fallback logic.
- Do not use hardcoded test student IDs like `6301011610279` anywhere. Test scripts must read credentials from `.env.local` to perform real logins.

---

## 📋 Data Contracts (Shapes)

All shared data shapes are defined in `lib/types.js` as JSDoc `@typedef`.  
**Before creating a new data structure**, check if it already exists there.  
**After creating a new structure**, add it to `lib/types.js`.

Key types:
| Type | Defined in | Use case |
|---|---|---|
| `StudentProfile` | `lib/types.js` | Profile data returned by `/api/student/profile` |
| `AuthUser` | `lib/types.js` | User stored in AuthContext after login |
| `PortfolioItem` | `lib/types.js` | Portfolio entries from Supabase |
| `ApiSuccessResponse<T>` | `lib/types.js` | Standard success API wrapper |
| `ApiErrorResponse` | `lib/types.js` | Standard error API wrapper |

---

## 🔧 API Route Standards

### Always use `lib/apiResponse.js` helpers:
```js
// ✅ Correct
import { success, unauthorized, error } from '@/lib/apiResponse';
return success(data);
return unauthorized();

// ❌ Wrong — don't use NextResponse.json() directly in route handlers
return NextResponse.json({ success: true, data });
```

### Cookie reading pattern:
```js
const cookieStore = await cookies();
const token = cookieStore.get('reg_token')?.value;
if (!token) return unauthorized();
```

---

## 🧱 New Feature Checklist

When adding a new feature, ask:
1. Does the data shape already exist in `lib/types.js`? If not, add it.
2. Does my API route use `lib/apiResponse.js` helpers? If not, use them.
3. Does my component only receive `camelCase` props? If it reads `snake_case` directly, fix it.
4. Did I add input sanitization (see `lib/sanitize.js`)?
5. Is there a rate limiter needed? (see `lib/rateLimit.js`)

---

## 📁 Key Files Quick Reference

| File | Purpose |
|---|---|
| `lib/types.js` | Single Source of Truth for all data shapes |
| `lib/apiResponse.js` | Standard HTTP response helpers |
| `lib/supabaseProfile.js` | DB reads/writes for `student_profiles` table |
| `lib/profileParser.js` | Converts University API response → `StudentProfile` |
| `lib/universityApi.js` | HTTP client for University API calls |
| `lib/sanitize.js` | Input sanitization (XSS prevention) |
| `lib/auth.js` | Session/token validation |
| `lib/rateLimit.js` | Request rate limiting |

---

## 🔒 Security Checklist (for new API routes)

- [ ] All user input is sanitized via `lib/sanitize.js`
- [ ] Session token is validated from HttpOnly cookie (`reg_token`), never from request body
- [ ] User identity is always read from the **server-side token**, never from body params
- [ ] File uploads enforce size limits (max 2MB) and type checking (jpg/png/webp only)
- [ ] Supabase queries use Row Level Security (RLS) or the service role with explicit `.eq()` filters

---

## 📝 Boy Scout Rule

> **"When you open a file to fix a bug or add a feature, normalize the naming conventions of that file to camelCase before closing it."**

This is how we reduce Technical Debt incrementally without requiring a big-bang refactor.

---

## 🤝 Completion Promise (Zero Error Policy)

> **"Never conclude an implementation or mark a task as completed if there are any lingering errors (backend HTTP errors, frontend React errors, unhandled rejections, etc.) in the console or logs."**

1. After making an implementation or refactoring, you **MUST** run tests or verify the logs.
2. If tests fail or the backend logs throw an error, **you must fix it** before returning success to the user.
3. Your work is only considered "done" when the feature works flawlessly end-to-end.

---

## 🗄️ Database Context & Static Files

> **"Explicit data sourcing paths for local and external assets."**

- **Exam Seat Maps Dataset**: The full complement of KMUTNB and Engineering exam seating is **NOT** located in `/tmp/exam-seat`. It was permanently duplicated into the project workspace. AI Agents should query and parse data from:
  - `web-app/data/exam_seats_kmutnb.csv`: Primary dataset containing 27,000+ student exam coordinates.
  - `web-app/scripts/ExamSeatData/`: Location of the Python scraping utilities responsible for updating these files (cloned from `withNoclout/ExamSeatData`).
  - Keep this in mind during implementation: Always source exam location data from the permanent `/data/` directory.
