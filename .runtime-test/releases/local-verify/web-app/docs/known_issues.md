# Known Issues & Troubleshooting

## 1. Turbopack FATAL Panic — Infinite Refresh Loop (Fixed)
**Symptom**: Page refreshes endlessly. Console shows `FATAL: An unexpected Turbopack error occurred`.
**Root Cause**: Parent folder `D:\reDesign-REG\` had its own `package-lock.json` and `node_modules/`. Turbopack detected multiple lockfiles, chose the parent as workspace root, then failed to resolve `app/context/AuthContext.js` relative to it. This crashed HMR on every file change → dev server restart → browser reload → loop.
**Fix**:
1. Added `turbopack: { root: './' }` to `next.config.ts`
2. Deleted orphan `package-lock.json` and `node_modules/` from parent directory
**Prevention**: Never have a `package-lock.json` or `node_modules/` in a parent directory of a Next.js project.

## 2. Context Value Re-renders (Fixed)
**Cause**: The `AuthContext` and `GuestContext` providers were creating a new `value` object on every render. This caused `useAuth` and `useGuest` hooks to return a new object reference, which triggered `useEffect` dependencies (like `[user]` or `[isAuthenticated]`) to fire repeatedly, causing a state update loop.
**Solution**: Wrapped the context value objects in `useMemo` to ensure referential stability.
**Prevention**: Always use `useMemo` for context values that are objects.

## 3. Framer Motion Dependency
**Issue**: Production build might fail or animations break.
**Cause**: `framer-motion` was in `devDependencies`.
**Solution**: Moved to `dependencies`.

## 4. Performance Bottlenecks (Monitoring)
**Symptom**: "Slow login" or slow page transitions.
**Diagnosis**:
- **Encryption**: `pbkdf2Sync` might be CPU intensive.
- **External API**: The University's `Getstudentinfo` endpoint might be slow.
**Action**: 
- Added server-side timing logs (`console.time`).
- **Optimized LCP**: Converted background image to WebP (694KB -> ~90KB).
