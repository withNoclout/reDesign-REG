# API Context: KMUTNB Registration System (reg4)

**Base URL:** `https://reg4.kmutnb.ac.th/regapiweb2/api/th`

## Authentication & Session
| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/Validate/tokenservice` | GET/POST | Token Validation / CSRF? | Called before LoginAD in trace |
| `/Account/LoginAD` | POST | User Login (Active Directory) | **Primary Auth Endpoint** |
| `https://api.ipify.org/?format=json` | GET | Client IP Check | Used for audit logging |

## Student Data (Protected)
| Endpoint | Method | Purpose | Likely Request/Response |
|----------|--------|---------|------------------------|
| `/Schg/Getacadstd` | GET | Get Academic Status | Student info, GPA, Faculty |
| `/Student/Getenrollcontrol` | GET | Enrollment Control | Registration periods, limits |
| `/Student/Getenrollstage` | GET | Enrollment Stage | Current registration step |
| `/Debt/Enrollfee` | GET | Tuition/Fee Status | Outstanding balances |
| `/Student/Msg/` | GET | Student Messages | Notifications from registrar |
| `/Suggestion/Feedbackcount` | GET | Feedback Status | Unread feedback count |

## Integration Strategy

### Authentication Flow (Deduced)
1.  **Frontend** calls `api.ipify.org` to get Client IP.
2.  **Frontend** calls `/Validate/tokenservice` (likely to get a session challenge or verify connectivity).
3.  **Frontend** calls `/Account/LoginAD` with:
    -   `username`
    -   `password`
    -   `ip` (from ipify)
    -   *Headers:* Cookie from `tokenservice`?
4.  **Server** returns Auth Token / Cookie.
5.  **Frontend** attaches Token/Cookie to subsequent calls (`Getacadstd`, etc.).

### Required Data for Proxy Implementation
To fully implement the backend proxy, we need to inspect the **Payload** (Request Body) of the `LoginAD` request to see exact field names (e.g., `username` vs `user`, `password` vs `pass`).

> **Working Assumption:**
> We will try standard JSON body:
> ```json
> {
>   "username": "...",
>   "password": "..."
> }
> ```
