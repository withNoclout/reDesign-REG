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

## 2026-02-14: Tailwind CSS Version Conflict (v4 vs v3)

**Severity**: High (Build Failure)
**Status**: 🔄 In Progress

### Error Message
```
Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin. 
The PostCSS plugin has moved to a separate package...
```

### Context
- **Action**: User installed `tailwindcss` manually (`npm install -D tailwindcss`).
- **Config**: Created `tailwind.config.js` with v3 syntax (`module.exports = { content: ... }`).
- **Conflict**: `npm install tailwindcss` installs **v4.0+** by default, which is not backward compatible with v3 config/postcss usage.

### Root Cause
**Version Mismatch**: Tailwind v4 was released recently (2024/2025) and changes how it integrates with PostCSS. The project configuration (`tailwind.config.js`) was written for v3.

### Solution Applied
Downgraded to the latest stable v3 version:
```bash
npm install -D tailwindcss@3.4.1 postcss autoprefixer
```

### Prevention Plan
1.  **Strict Versioning**: Always specify version when installing core libraries (e.g., `npm install tailwindcss@3`).
2.  **Package.json Review**: Check `package.json` to ensure `tailwindcss` is `^3.x.x` not `^4.x.x`.
3.  **Migration Guide**: If upgrading to v4, follow the [official migration guide](https://tailwindcss.com/docs/upgrade-guide) (requires `@tailwindcss/postcss`).

### 📊 Error Metrics
- **Severity**: High
- **Resolution Time**: ~5 minutes
- **Affected Files**: `package.json`, `node_modules`

