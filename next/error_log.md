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
- **Error ID**: ERR-2026-02-14-002

---

## 2026-02-14: Missing Dependency - jsonwebtoken

**Severity**: Critical (Build Break)
**Status**: ✅ Resolved

### Error Message
```
Module not found: Can't resolve 'jsonwebtoken'

./utils/jwt.js:1:1
> 1 | import jwt from 'jsonwebtoken';
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

### Context
- **File**: `web-app/utils/jwt.js`
- **Import Statement**: `import jwt from 'jsonwebtoken';`
- **Issue**: The `jsonwebtoken` package was imported but never installed

### Root Cause
The portfolio feature implementation created a new file `utils/jwt.js` that imports the `jsonwebtoken` package for JWT token generation and verification. However, the package was not installed in `node_modules` via `npm install`, causing the build to fail.

### Solution Applied
Installed the missing dependency:
```bash
npm install jsonwebtoken --prefix web-app
```

This added the package to `package.json` dependencies and downloaded it to `node_modules`.

### Prevention Plan
1. **Checklist Before Importing**: Always verify package is installed before using it:
   - Run `npm list [package-name]` to check if installed
   - If not found, run `npm install [package-name]`
   
2. **Document Dependencies**: Create a dependencies checklist when planning features:
   - List all required npm packages
   - Mark installation status
   - Install all at once: `npm install pkg1 pkg2 pkg3`

3. **Pre-Commit Hook**: Add script to check for missing dependencies:
   ```json
   {
     "scripts": {
       "precommit": "node scripts/check-deps.js"
     }
   }
   ```

4. **Build Verification**: Always run `npm run build` after adding new imports
   - This catches missing dependencies immediately
   - Prevents deployment with broken code

5. **Dependency Documentation**: Created `MISSING_DEPENDENCY_PREVENTION_GUIDE.md` with:
   - Common dependency scenarios
   - Installation commands
   - Troubleshooting steps
   - Best practices for team members

### 📊 Error Metrics
- **Severity**: Critical (Build Break)
- **Impact**: High (Prevented development/preview)
- **Resolution Time**: ~5 minutes (after identification)
- **Total Affected Files**: 1 (utils/jwt.js)
- **Root Cause**: Forgot to install npm package after importing
- **Error ID**: ERR-2026-02-14-003

### 🔗 Related Documents
- **Prevention Guide**: [web-app/MISSING_DEPENDENCY_PREVENTION_GUIDE.md](../web-app/MISSING_DEPENDENCY_PREVENTION_GUIDE.md)
- **Implementation Summary**: [web-app/PORTFOLIO_IMPLEMENTATION_SUMMARY.md](../web-app/PORTFOLIO_IMPLEMENTATION_SUMMARY.md)
- **npm Documentation**: https://docs.npmjs.com/

### Lessons Learned
1. **Always install dependencies immediately after importing** in code
2. **Use package.json as source of truth** - if imported, must be listed
3. **Run `npm install` first thing** when cloning repository
4. **Check build output** for module resolution errors
5. **Document external dependencies** in project documentation

---

## Error Prevention Workflow (New Standard)

### Before Adding New Imports
1. [ ] Search for correct package name on npmjs.com
2. [ ] Run `npm list [package-name]` to check if already installed
3. [ ] If not installed: `npm install [package-name]`
4. [ ] Verify in `package.json` dependencies section
5. [ ] Test import in code
6. [ ] Run `npm run build` to verify no errors

### When Implementing New Features
1. [ ] Identify all required packages upfront
2. [ ] Create dependency checklist
3. [ ] Install all dependencies at once: `npm install pkg1 pkg2 pkg3`
4. [ ] Verify all appear in `package.json`
5. [ ] Run `npm list --depth=0` to confirm installation
6. [ ] Run `npm run build` before committing

### Before Code Review
1. [ ] Check `package.json` for new dependencies
2. [ ] Verify all are necessary and no unused packages
3. [ ] Run `npm audit` for security vulnerabilities
4. [ ] Ensure version constraints are appropriate

---

## Summary of All Errors (2026-02-14)

| Error ID | Type | Severity | Status | Resolution Time |
|-----------|------|----------|---------|----------------|
| ERR-2026-02-14-001 | Import/Export Mismatch | Critical | ✅ Resolved | ~20 min |
| ERR-2026-02-14-002 | Hydration Mismatch | Medium | ✅ Resolved | ~10 min |
| ERR-2026-02-14-003 | Missing Dependency | Critical | ✅ Resolved | ~5 min |

**Total Errors**: 3
**Total Resolution Time**: ~35 minutes
**Prevention Documents Created**: 3


