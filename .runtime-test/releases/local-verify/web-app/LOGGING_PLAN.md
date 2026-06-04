# 📡 Background Log Monitoring Service Plan

**Created**: 15 February 2026  
**Status**: Proposal  
**Context**: Parallel work ongoing (Accessibility fixes). Code changes must be non-intrusive.

---

## 🎯 Objective
Create a **background logging service** that:
1.  Captures errors from both Client (Frontend) and Server (API Routes).
2.  Logs them to a persistent file (`web-app/logs/app.log`) for debugging.
3.  Runs independently without blocking the main application.
4.  Can be integrated immediately without disrupting current work.

---

## 🛠️ Proposed Architecture

We will implement a **Centralized Logging API** that receives logs from:
1.  **Client-side**: `app/error.js` and `ErrorBoundary.js` (via `fetch`)
2.  **Server-side**: API routes (direct file write)

### Components:

1.  **Log Handler API (`app/api/log/route.js`)**
    -   Receives POST requests with error details.
    -   Writes to `logs/app.log` with timestamp and severity.
    -   Handles file rotation (simple append for now).

2.  **Client Logger Utility (`app/lib/logger.js`)**
    -   Simple helper function to send logs to the API.
    -   Fire-and-forget (doesn't block UI).

3.  **Integration Points (Minimal Changes)**
    -   `app/error.js`: Add one line to call logger.
    -   `app/components/ErrorBoundary.js`: Add one line to call logger.
    -   `app/api/auth/login/route.js`: Replace `console.error` with logger.

---

## 📋 Implementation Plan (Step-by-Step)

### Phase 1: Infrastructure (Safe to do NOW)

1.  **Create Log Directory**
    ```bash
    mkdir -p web-app/logs
    ```

2.  **Create Logger Utility (`app/lib/logger.js`)**
    ```javascript
    /**
     * Client-side logger that sends errors to the server
     */
    export const logError = async (error, context = 'Client') => {
        try {
            // Fire and forget
            fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: 'ERROR',
                    message: error.message || String(error),
                    stack: error.stack,
                    context,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (e) {
            console.error('Failed to send log:', e);
        }
    };
    ```

3.  **Create Log API Route (`app/api/log/route.js`)**
    ```javascript
    import { NextResponse } from 'next/server';
    import fs from 'fs';
    import path from 'path';

    export async function POST(request) {
        try {
            const data = await request.json();
            const logDir = path.join(process.cwd(), 'logs');
            const logFile = path.join(logDir, 'app.log');

            // Ensure directory exists
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const logEntry = `[${data.timestamp}] [${data.level}] [${data.context}] ${data.message}\n${data.stack ? data.stack + '\n' : ''}`;

            // Append to log file
            fs.appendFileSync(logFile, logEntry);

            return NextResponse.json({ success: true });
        } catch (error) {
            return NextResponse.json({ success: false }, { status: 500 });
        }
    }
    ```

### Phase 2: Integration (Quick & Surgical)

1.  **Update `app/error.js`**
    -   Add `import { logError } from '@/lib/logger';`
    -   In `useEffect`: `logError(error, 'GlobalErrorPage');`

2.  **Update `app/components/ErrorBoundary.js`**
    -   Add `import { logError } from '@/lib/logger';`
    -   In `componentDidCatch`: `logError(error, 'ErrorBoundary');`

3.  **Update API Routes (e.g., Login)**
    -   Import `fs` and write to log file directly (since it's server-side), OR
    -   Create a server-side logger utility in `lib/serverLogger.js`.

---

## 🚀 Execution Strategy

Since there is a parallel agent working on Accessibility (editing `globals.css` and `layout.js`), this plan is **SAFE** because:
1.  We are creating **NEW files** (`app/api/log/route.js`, `app/lib/logger.js`).
2.  We are editing `app/error.js` and `ErrorBoundary.js` which were just created by *us* and are not touched by the accessibility agent.

### Immediate Action Items:
1.  Create `app/lib/logger.js`.
2.  Create `app/api/log/route.js`.
3.  Create `logs/` directory.
4.  Wait for parallel agent to finish before heavy integration (optional, can do now for error.js).

---

## 🛡️ Why this is the "Best Plan"
-   **Zero External Dependencies**: Uses native `fs` and `fetch`. No need to install Sentry/Datadog yet.
-   **Persistent**: Logs are saved to disk (`logs/app.log`), so they survive restarts.
-   **Unified**: Catches both frontend (via API) and backend errors.
-   **Non-Blocking**: Client-side logging is async and doesn't stop the UI.

Ready to implement?
