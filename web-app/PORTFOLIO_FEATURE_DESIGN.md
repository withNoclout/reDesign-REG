# Portfolio & Sharing Feature Design

## 1. Overview
The **Portfolio Feature** allows students to generate a public, read-only link to share their academic achievements (Portfolio). The student owner can granularly control which modules are visible (e.g., Grades, Schedule) via a settings page.

 Guests accessing the link:
- Bypass the login screen.
- Enter "Guest Mode" (Read-Only).
- Can only navigate to allowed modules.
- Restricted modules are visually locked (Grayed out).

## 2. Architecture

### A. Permission Schema
Permissions are managed as a simple mapped object:
```javascript
{
  profile: boolean,
  grade: boolean,
  registration: boolean,
  // ...other menu IDs
}
```

### B. Share Token Strategy (Stateless)
Since there is no backend database to store sessions, we will encode the configuration into the URL hash or query parameters.

**URL Format:**
`https://domain.com/share?p=[EncodedPayload]`

**Payload Structure (JSON -> Base64):**
```json
{
  "u": "Student Name",  // Public Display Name
  "perms": ["grade", "profile"], // List of allowed IDs
  "exp": 1234567890 // Timestamp (Optional)
}
```

### C. Data Access Strategy (Crucial)
**Challenge:** External guests do not have the `reg_token` (HttpOnly Cookie) required to fetch real live data from the university API.
**Data Security Constraints:**
- The student's real authentication cookies (HttpOnly) cannot be shared or transferred.
- A "Guest" cannot proxy requests to the registrar API without a backend that holds the session.

**Solution (Demo/Portfolio Focused):** 
1. **Grades**: Guest Mode automatically utilizes the `SHOW_IDEAL_GRADES` flag (mocked "perfect" data). This aligns with the portfolio use-case of showcasing specific achievements.
2. **Profile**: Basic student info (Name, ID) is encoded in the share link or falls back to a generic "Guest View" placeholder if not provided, ensuring privacy and robust demo functionality.

## 3. Implementation Steps

### Step 1: `GuestContext`
Create a React Context `web-app/app/context/GuestContext.js` to manage:
- `isGuest`: boolean (true if accessing via share link)
- `allowedModules`: string[] (list of permitted menu IDs)
- `guestName`: string (Owner's name for display)

### Step 2: Settings Page (`/app/portfolio/page.js`)
- **Permission Toggles**: Switch (Left/Right) for each item in `MENU_ITEMS`.
- **Link Generator**: Button to encode current state -> Generate Share URL.
- **Copy**: Copy generated link to clipboard.

### Step 3: Navbar Updates (`/app/components/Navbar.js`)
- Consume `GuestContext`.
- Iterate `MENU_ITEMS`:
  - If `!allowedModules.includes(item.id)`:
    - Render as **Locked** (Gray text + Lock Icon).
    - Disable Click/Navigation.
    - Prevent hover interaction for submenus.

### Step 4: Page Adaptations
- **Landing Page**: 
  - If Guest: Hide sensitive/interactive widgets (e.g., "Edit Profile", "Logout").
  - Show "Viewing as Guest" banner.
- **Grade Page**: 
  - Detect `isGuest`.
  - If `isGuest`: Force `setAcademicRecord(IDEAL_ACADEMIC_RECORD)`.
  - Disable "Refresh" or API calls to prevent errors.

## 4. Security
- **Read Only**: The UI removes all "Edit" or "Action" buttons in Guest Mode.
- **No Auth Leak**: The student's real `reg_token` is never shared. Guests see isolated/mocked demo data safe for public viewing.

---

## UI Components
- **Toggle Switch**: iOS-style Left/Right slider for permissions.
- **Locked Menu Item**: Opacity 0.5, Cursor not-allowed, Padlock icon.
