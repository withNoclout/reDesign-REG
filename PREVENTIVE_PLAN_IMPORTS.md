# Preventive Plan: Import Path Standardization

## Issue
A build error `Module not found: Can't resolve '@/lib/logger'` occurred because `logger.js` was placed in `app/lib/` but the project alias `@/` maps to the root directory, expecting files in `lib/`. Additionally, a duplicate `app/lib/animations.js` existed, creating potential for confusion.

## Root Cause
-   Inconsistent placement of utility files (`app/lib` vs `lib`).
-   Assumption that `@/` mapped to `app/` (common in some Next.js setups) vs root (common in others).

## Preventive Measures

1.  **Strict Directory Structure**:
    -   **ALL** shared utilities must go in `web-app/lib/` (root level).
    -   **NO** utility files should be created in `web-app/app/lib/`.

2.  **Verification Step**:
    -   Before creating a new file, check `jsconfig.json` or `tsconfig.json` to confirm where `@/*` points.
    -   Check if a similar file already exists in `lib/` or `app/lib/` to avoid duplicates.

3.  **Action Taken**:
    -   Moved `logger.js` to `web-app/lib/`.
    -   Removed `web-app/app/lib/` and its duplicate contents.
    -   Verified that `@/lib/logger` now resolves correctly.

## automated Check (for future agents)
If you are about to create a file in `app/lib/`, **STOP**. Create it in `lib/` instead.
