# API Context: KMUTNB Registration System (reg4)

**Base URLs:** 
- `regapiweb1`: `https://reg4.kmutnb.ac.th/regapiweb1/api/th` (Primary for Enrollment Actions)
- `regapiweb2`: `https://reg4.kmutnb.ac.th/regapiweb2/api/th` (Primary for Student Info & Search)

## Authentication & Session
| Endpoint | Method | Base | Purpose | Notes |
|----------|--------|------|---------|-------|
| `/Validate/tokenservice` | GET | V2 | Token Service | Must be called first to get service token |
| `/Account/LoginAD` | POST | V2 | User Login | Payload must be encrypted in `{"param": "..."}` |

### Authentication Flow (Verified)
1.  **Frontend** calls `V2 /Validate/tokenservice` -> returns `token`.
2.  **Frontend** encrypts `{"username": "...", "password": "...", "ip": "127.0.0.1"}` using AES-256-CBC.
3.  **Frontend** calls `V2 /Account/LoginAD` with `{ "param": "encrypted_base64" }` and `Authorization: Bearer <service_token>`.
4.  **Server** returns user's JWT `token`.
5.  **Subsequent** calls use `Authorization: Bearer <user_token>`.

## Discovery: Registration & Search APIs
| Endpoint | Method | Base | Purpose | Notes |
|----------|--------|------|---------|-------|
| `/Classinfo/Classinfo/...` | GET | V2 | Search Subjects | Complex path params (Year/Sem/Campus/Level) |
| `/Enrollresult/Enrollresult`| GET | V2 | Current Results | Returns result as Base64-Gzipped JSON |
| `/Enroll/GetInitData` | GET | V1 | Enroll Init | Metadata for registration wizard |
| `/Enroll/Getclasslab/{id}` | GET | V1 | Section Info | Detailed section list for a course |
| `/Enroll/Insertstudyplan` | **PUT** | V1 | **Save Plan** | The core registration saving endpoint |
| `/Enroll/Submit` | GET | V1 | **Finalize** | Validates and submits the study plan |

## Data Encoding
**Warning:** Many response bodies are returned in a `result` wrapper that is **Base64 encoded and Gzip compressed**.
- Format: `{"result": "H4sIA..."}`
- Decoding: `Buffer.from(res.result, 'base64')` -> `zlib.gunzipSync()` -> `JSON.parse()`

