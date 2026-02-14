# Security Roadmap & Future Enhancements

**Date**: 2026-02-14
**Status**: Planning Phase

This document outlines the recommended next steps to elevate the security posture of the web application.

---

## 🚀 Phase 1: High Priority (Immediate Focus)

### 1. Persistent Rate Limiting (Redis)
**Current State**: In-memory `Map` (resets on server restart/redeploy).
**Risk**: Distributed attacks or simple server recycles bypass limits.
**Recommendation**:
-   Integrate **Redis** (e.g., Upstash or local instance).
-   Use `ioredis` or `@upstash/redis`.
-   Store rate limit counters with TTL (Time To Live).
-   *Why?* Ensures limits persist across scaling and deployments.

### 2. Strict Input Validation (Zod)
**Current State**: Manual `validateInput` helper.
**Risk**: Human error, missed edge cases, hard to maintain schema.
**Recommendation**:
-   Adopt **Zod** for schema definition.
-   Define strict schemas for all API inputs (Login, Registration, etc.).
-   Example:
    ```javascript
    const loginSchema = z.object({
      username: z.string().min(3).max(100).regex(/^[a-zA-Z0-9]+$/),
      password: z.string().min(6)
    });
    ```

### 3. Advanced CSRF Protection
**Current State**: Relies on `SameSite: Lax` cookies.
**Risk**: Potential for CSRF in older browsers or complex cross-origin scenarios.
**Recommendation**:
-   Implement **Double Submit Cookie** pattern or use `next-csrf`.
-   Ensure all mutation endpoints (POST/PUT/DELETE) verify a custom header or token.

---

## 🛡️ Phase 2: Medium Priority (Hardening)

### 4. Observability & centralized Logging
**Current State**: `console.log` (ephemeral).
**Recommendation**:
-   Integrate a logging service (e.g., Winston -> Datadog/Sentry).
-   Alert on suspicious activities:
    -   Multiple failed logins from same IP.
    -   Rate limit breaches.
    -   500 errors (potential exploits).
-   **Security**: Ensure NO PII or credentials are ever logged (continue using current masking).

### 5. Dependency Scanning (CI/CD)
**Current State**: Manual `npm audit`.
**Recommendation**:
-   Add `npm audit` to the build pipeline.
-   Fail builds if **Critical** or **High** vulnerabilities are found.
-   Use tools like **Snyk** or **Dependabot** for automated PRs.

---

## 🔒 Phase 3: Advanced Features (Long Term)

### 6. Multi-Factor Authentication (MFA)
**Recommendation**:
-   Add TOTP (Time-based One-Time Password) support (Google Authenticator).
-   Or Email/SMS OTP as a second step for sensitive accounts.

### 7. End-to-End Encryption (E2EE)
**Current State**: HTTPS + Payload encryption (AES).
**Recommendation**:
-   If high security is needed, implement client-side public key encryption before sending passwords (though HTTPS + AES is generally sufficient for this use case).

---

## 📋 Action Plan for Next Sprint

1.  **Select a Redis Provider** (local for dev, cloud for prod).
2.  **Refactor `login/route.js`** to use Redis for rate limiting.
3.  **Install `zod`** and replace manual validation logic.

**Would you like to start with Item 1 (Redis Setup) or Item 2 (Zod Validation)?**
