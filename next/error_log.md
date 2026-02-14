# 🐛 Error Log & Bug Tracking

## 2026-02-14: Component Import Error in Landing Page

**Severity**: Critical (Build Break)
**Status**: ✅ Resolved

### Error Message
```
./app/landing/page.js:7:1
Export AcademicInfoCard doesn't exist in target module
Did you mean to import default?
```

### Context
- **File**: `app/landing/page.js`
- **Module**: `app/components/AcademicInfoCard.js`
- **Import Statement**: `import { AcademicInfoCard } from ...`
- **Actual Export**: `export default function AcademicInfoCard ...`

### Root Cause
Mismatch between **export type** (Default) and **import syntax** (Named). The component uses `export default`, but the import was using `{ brace syntax }` which expects a named export.

### Solution Applied
Changed import to default syntax (no braces):
```javascript
// Before (Error)
import { AcademicInfoCard } from '../components/AcademicInfoCard';

// After (Fixed)
import AcademicInfoCard from '../components/AcademicInfoCard';
```
Same fix applied for `UserProfileCard`.

### Prevention Plan
1.  **Standardize Exports**: Use `export default` for main components (Page/Layout/Card).
2.  **Verify Imports**: Check source file export type if auto-import fails.
3.  **Linter Rules**: Enable `import/no-named-as-default` rule in ESLint.
4. **Pre-commit Hooks**: Use Husky + lint-staged to catch import errors before commit.
5. **IDE Configuration**: Enable auto-fix on save to prevent syntax errors.

### 📊 Error Metrics
- **Severity**: Critical (Build Break)
- **Impact**: High (Prevented deployment)
- **Resolution Time**: ~20 minutes
- **Total Affected Files**: 2 (UserProfileCard, AcademicInfoCard)
- **Lines Changed**: 2 (import statements)
- **Error ID**: ERR-2026-02-14-001

### 🔗 Related Documents
- **Resolution Plan**: [error_resolution_plan.md](./error_resolution_plan.md)
- **Implementation Summary**: [web-app/IMPLEMENTATION_SUMMARY.md](../web-app/IMPLEMENTATION_SUMMARY.md)


---

## 2026-02-14: Hydration Mismatch in Skeleton Components

**Severity**: Medium (Console Error)
**Status**: ✅ Resolved

### Error Message
```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. 
... className="jsx-..."
```

### Context
- **Components**: `UserProfileCard.js`, `SkeletonCard.js`
- **Issue**: React's client-side hydration found different DOM attributes than what the server rendered.

### Root Cause
1.  **`styled-jsx`**: Next.js sometimes generates different class names (`jsx-...`) on server vs client for inline styles.
2.  **`Math.random()`**: `SkeletonCard` used `Math.random()` to generate random widths for lines. This value is different on the server (initial render) and the client (hydration), causing a mismatch.

### Solution Applied
1.  **Refactored to Tailwind CSS**: Removed all `<style jsx>` blocks and inline styles, replacing them with standard Tailwind classes (e.g., `animate-pulse`, `backdrop-blur`).
2.  **Removed Non-Deterministic Logic**: Replaced `Math.random()` with deterministic width calculations based on the index (e.g., `width: ${65 + (i * 10) % 30}%`).

### Prevention Plan
1.  **Avoid `Math.random()` in Render**: Never use non-deterministic functions directly in the returned JSX. If randomness is needed, generate it in `useEffect` (client-only) or use a seeded random generator.
2.  **Prefer Tailwind over `styled-jsx`**: Use utility classes for animations and styling to ensure consistency across environments.
3.  **Check Console for Hydration Errors**: React provides specific details about mismatches—always check the console during development.

### 📊 Error Metrics
- **Severity**: Medium
- **Resolution Time**: ~10 minutes
- **Affected Files**: 2


