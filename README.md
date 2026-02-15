# 🎓 reDesign-REG — KMUTNB Registration System Redesign

A modern, redesigned web interface for the KMUTNB (King Mongkut's University of Technology North Bangkok) student registration system. This project fetches data from the existing REG API and presents it through a premium, accessible UI.

---

## 🛠️ Tech Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | [Next.js](https://nextjs.org/) | 16.1.6 | React framework with SSR, API routes, Turbopack |
| **UI Library** | [React](https://react.dev/) | 19.2.3 | Component-based UI |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | 3.4.1 | Utility-first CSS framework |
| **CSS Processing** | [PostCSS](https://postcss.org/) + [Autoprefixer](https://github.com/postcss/autoprefixer) | 8.x / 10.x | CSS transforms & vendor prefixing |
| **Animation** | [Framer Motion](https://www.framer.com/motion/) | 12.34.0 | Declarative micro-animations |
| **HTTP Client** | [Axios](https://axios-http.com/) | 1.13.5 | API requests with cancellation support |
| **Language** | JavaScript (ES2022+) | — | Primary language |
| **Build Tool** | [Turbopack](https://turbo.build/pack) | Built-in | Next.js bundler (dev mode) |

---

## 📁 Project Structure

```
reDesign-REG/
├── web-app/                    # Main Next.js application
│   ├── app/
│   │   ├── api/                # API proxy routes
│   │   │   ├── auth/login/     # POST /api/auth/login
│   │   │   ├── auth/logout/    # POST /api/auth/logout
│   │   │   └── student/info/   # GET /api/student/info
│   │   ├── components/         # Reusable React components
│   │   │   ├── UserProfileCard.js
│   │   │   ├── AcademicInfoCard.js
│   │   │   ├── ErrorAlert.js
│   │   │   └── SkeletonCard.js
│   │   ├── context/
│   │   │   └── AuthContext.js  # Authentication state management
│   │   ├── landing/
│   │   │   └── page.js         # Dashboard (post-login)
│   │   ├── lib/
│   │   │   └── animations.js   # Framer Motion animation variants
│   │   ├── globals.css         # Global styles + Tailwind
│   │   ├── layout.js           # Root layout with AuthProvider
│   │   └── page.js             # Login page
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   ├── postcss.config.js       # PostCSS configuration
│   ├── next.config.ts          # Next.js configuration
│   └── package.json
├── next/                       # Planning & documentation
│   ├── implementation_plan.md
│   ├── error_log.md
│   ├── error_resolution_plan.md
│   ├── future_roadmap.md
│   └── prevention_plan_dependencies.md
├── BG_image/                   # Background assets
└── legacy_prototype/           # Original prototype code
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ 
- **npm** 9+

### Installation
```bash
cd web-app
npm install
```

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Production Build
```bash
npm run build
npm start
```

---

## 🏭 Production Implementation Plan

> Target: **Supabase (DB/Backend services) + External Hosting** สำหรับ Next.js runtime

### Phase 1 — Readiness & Environment
- [ ] แยก environment ชัดเจน: `dev / staging / production`
- [ ] เตรียม production secret manager และย้าย env สำคัญทั้งหมดออกจากเครื่อง local
- [ ] ยืนยันค่า production เช่น `NODE_ENV=production`, `MOCK_AUTH=false`, base URLs ถูกต้อง

### Phase 2 — Database & Security Hardening
- [ ] ทำ schema baseline + migration order ให้ deterministic
- [ ] ทดสอบ backup/restore บน staging ก่อนขึ้นจริง
- [ ] ตรวจ RLS/policies และสิทธิ์ service role ให้ถูก scope
- [ ] เปลี่ยน rate limit login จาก in-memory เป็น shared store (เช่น Redis/Upstash)

### Phase 3 — CI/CD & Release Gates
- [ ] วาง pipeline: install → lint → build → smoke tests
- [ ] ตั้ง staging deploy อัตโนมัติ และกำหนด merge/deploy gates
- [ ] เตรียม production deploy strategy (blue/green หรือ canary) พร้อม rollback trigger

### Phase 4 — Monitoring, Rollback, Go-live
- [ ] รวม logs/metrics/alerts (error rate, latency, 401/429 spikes)
- [ ] เตรียม incident runbook และ communication template
- [ ] ทำ post-deploy verification checklist และเฝ้าระวังช่วง 24–48 ชม.แรก

> Detailed working plan: `~/.copilot/session-state/ad6e61b3-5e99-4452-b0b8-1ca0fb0e0558/plan.md`

---

## 🎨 Design System

- **Theme**: Glassmorphism (frosted glass effect)
- **Colors**: KMUTNB Orange (`#ff5722`) primary palette
- **Typography**: Prompt (Thai) + Montserrat (English) via Google Fonts
- **Animations**: Centralized variants in `lib/animations.js` with `TIMING` constants
- **Accessibility**: WCAG 2.1 AA — 44px touch targets, ARIA labels, reduced-motion support

---

## 🔐 Authentication

- Login via KMUTNB REG API proxy (`/api/auth/login`)
- JWT token stored in HttpOnly cookie (`reg_token`)
- Session data persisted in `sessionStorage` via `AuthContext`
- Server-side token validation on API routes

---

## 📋 Current Status

| Feature | Status |
|---------|--------|
| Login Page | ✅ Complete |
| Dashboard (Landing) | ✅ Complete |
| User Profile Card | ✅ Complete |
| Academic Info Card | ✅ Complete |
| Error Handling (ErrorAlert) | ✅ Complete |
| Animations (Framer Motion) | ✅ Complete |
| Tailwind CSS Integration | ✅ Complete |
| Grades Page | 🔲 Planned |
| Schedule Page | 🔲 Planned |
| Transcript View | 🔲 Planned |

---

## 📄 License

This project is for educational purposes at KMUTNB.
