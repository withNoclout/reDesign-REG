# 🛡️ Prevention Plan: Dependency Management

## 🎯 Goal
Prevent build errors caused by major version mismatches, specifically for `tailwindcss` and `postcss`.

## 📦 Critical Dependency Rules

### 1. Tailwind CSS Version Locking
- **Rule**: Explicitly install version 3 (`npm install tailwindcss@3`) if using `tailwind.config.js` (CommonJS/module.exports format).
- **Why**: Version 4 (`tailwindcss@latest`) uses a different configuration strategy (CSS-first) and requires `@tailwindcss/postcss`.
- **Action**: Check `package.json` before `npm install`.

### 2. Lockfile Importance
- **Rule**: Always commit `package-lock.json`.
- **Command**: Use `npm ci` (Clean Install) in CI/CD pipelines to respect the lockfile.

## 🛠️ Validation Steps (Pre-Push)
Add this to your mental checklist or automation:
1.  **Check `package.json`**:
    ```json
    "devDependencies": {
      "tailwindcss": "^3.4.1",  // GOOD
      // "tailwindcss": "^4.0.0" // BAD (unless config is updated)
    }
    ```
2.  **Test Build**: Always run `npm run build` locally after adding new packages.

## 🔄 Migration Path (Future)
To upgrade to Tailwind v4 in the future:
1.  Install `@tailwindcss/postcss`.
2.  Update `postcss.config.js` to use `@tailwindcss/postcss`.
3.  Migrate `tailwind.config.js` to CSS variables or the new config format.
3.  Example: [Tailwind Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide).

## 💧 Hydration Anti-Patterns (React/Next.js)

### 1. No Randomness in Render
- **Rule**: Do not use `Math.random()`, `Date.now()`, or `new Date()` directly in JSX or functional component bodies.
- **Why**: Server render ≠ Client hydration render. React will throw a hydration mismatch error.
- **Solution**:
    - Use deterministic values (e.g., `index % 5`).
    - Generate random values in `useEffect` (client-only).
    - Use a seeded random generator if consistency is needed.

### 2. Avoid `styled-jsx` in Components
- **Rule**: Avoid `<style jsx>` blocks. Use Tailwind CSS utility classes instead.
- **Why**: `styled-jsx` can generate dynamic class names that differ between server and client, causing mismatches.
- **Action**: Refactor styles to Tailwind classes (e.g., `animate-pulse`, `backdrop-blur`).

