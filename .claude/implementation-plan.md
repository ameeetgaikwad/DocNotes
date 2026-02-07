# DocNotes Implementation Plan

## Overview

DocNotes is a medical records app for GPs (small practice EHR). Target market: India first, then AU/UK, then US. Mobile is deferred to v2.

---

## Phase 1: Foundation — COMPLETE

### Tasks Completed

1. **Shared packages** (`packages/shared`, `packages/db`, `packages/api`) set up in monorepo
2. **Drizzle schema** with 6 core tables: users, sessions, patients, medical_records, appointments, audit_logs
3. **Shared Zod validation schemas** for all entities with enums (UserRole, AppointmentStatus, RecordType, Gender, etc.)
4. **tRPC v11 routers** with Express adapter: patient, medicalRecord, appointment, audit — with auth/RBAC middleware
5. **Backend security**: Express + helmet + CORS whitelist + rate limiting + Pino logger with PHI redaction
6. **Tailwind CSS v4 + shadcn/ui** on web app with teal design system
7. **App shell**: Sidebar nav, route structure (dashboard, patients, schedule, tasks, reports, settings)
8. **tRPC client + TanStack Query** wired to web app
9. **Verified**: all packages build, type-check, lint, and format clean

---

## Phase 2: Core CRUD — COMPLETE

### Tasks Completed

1. **shadcn/ui components**: input, label, textarea, badge, card, dialog, tabs, select, table, avatar, dropdown-menu
2. **Patient list page**: tRPC query, search with debounce, table display, pagination
3. **New Patient dialog**: react-hook-form + Zod validation, tRPC mutation, cache invalidation
4. **Patient profile page** ($patientId): avatar, header, allergy badges, conditions, tabs (Summary/History/Appointments)
5. **Patient Summary tab**: demographics, contact, emergency, allergies, conditions, notes cards
6. **Patient History tab**: medical records timeline, type badges, pagination
7. **Visit Note SOAP editor**: title, S/O/A/P textareas, vitals grid (8 fields), diagnoses input
8. **Schedule page**: day navigation, appointment cards with time/type/status, sorted chronologically
9. **New Appointment dialog**: patient ID, date/time, type, duration, reason, notes

---

## Auth + Database Setup — COMPLETE

### Tasks Completed

1. **docker-compose.yml** with PostgreSQL 17 + .env.example files
2. **Drizzle migration** generated (6 tables, all FKs, all indexes)
3. **Auth tRPC router**: register, login, logout, me (bcryptjs hashing, session tokens)
4. **resolveSession()**: Bearer token → session lookup → tRPC context
5. **tRPC client** sends Authorization header from localStorage token
6. **AuthProvider context**: user state, login/register/logout methods, loading state
7. **Login + Register pages** (/auth/login, /auth/register)
8. **Auth guard** in root layout: redirect to /auth/login if unauthenticated
9. **Sidebar**: user avatar, name, role, logout button

---

## Phase 3: Security Hardening — NOT STARTED

### Planned Tasks

1. Input sanitization (DOMPurify for rich text, strip HTML from all inputs)
2. CSRF protection
3. Session management improvements (refresh tokens, sliding expiry, device tracking)
4. Rate limiting per-route (stricter on auth endpoints)
5. Audit log improvements (capture IP, user-agent on all mutations)
6. Content Security Policy headers
7. SQL injection prevention audit
8. File upload validation (magic bytes, not just MIME type)
9. Password strength requirements
10. Account lockout after failed attempts

---

## Phase 4: Documents & Export — COMPLETE

### Tasks Completed

1. **Shared schemas**: DocumentCategory, DocumentStatus, ShareResourceType, ExportFormat enums + document/share-link/export schemas
2. **DB tables**: `documents` (with S3 key, category, status) + `share_links` (token, expiry, password, access count)
3. **S3 lib**: presigned upload/download URLs, key generation, delete
4. **PDF lib**: @react-pdf/renderer with React.createElement (no JSX in api package), patient summary + medical record templates
5. **Document router**: list, getById, requestUpload (2-step), confirmUpload, getDownloadUrl, update, archive, delete
6. **Export router**: patientSummary + medicalRecord -> PDF base64
7. **Share router**: create (64-char token, optional bcrypt password, expiry), listByResource, revoke, access (public)
8. **Backend**: body limit 10MB, rate limit 500 req/15min
9. **Web download utils**: downloadBase64File, printBase64Pdf
10. **Patient detail**: Export Records, Print Summary, Share Records wired; Documents tab added
11. **Upload document dialog**: file input, category select, 3-step upload flow
12. **Share dialog**: create link form, copy URL, list existing links, revoke
13. **Public share page** (/share/$token): password prompt, PDF download, error states
14. **Root layout**: /share routes bypass auth guard

---

## Responsive Web — COMPLETE

### Tasks Completed

1. **Sidebar**: mobile hamburger menu with slide-out drawer, overlay backdrop, close on nav
2. **Mobile top bar**: sticky header with menu button + DocNotes logo
3. **Root layout**: flex-col on mobile, flex-row on md+
4. **Patient list**: hidden Gender/Phone/Conditions columns on small screens, stacking pagination
5. **Patient detail**: stacking header, smaller avatar, responsive tabs
6. **Schedule**: stacking header, responsive date picker, stacking appointment cards
7. **Dashboard**: already had responsive grid
8. **All pages**: p-4 on mobile, sm:p-6 on larger screens

---

## Future Phases (Not Started)

### Phase 5: Advanced Features

- Full-text search across patient records
- Drug interaction checking
- ICD-10 code lookup and autocomplete
- Prescription management
- Lab results integration
- Referral letter templates

### Phase 6: Mobile App (v2)

- React Native app
- Offline-first with sync
- Push notifications for appointments
- Camera integration for document scanning

### Phase 7: Multi-Tenancy & Compliance

- Multi-practice support
- India DISHA compliance
- Australia My Health Record integration
- UK NHS Digital compliance
- Data encryption at rest
- Backup and disaster recovery
