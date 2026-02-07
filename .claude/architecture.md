# DocNotes Architecture Reference

## Tech Stack

| Layer        | Choice                                         |
| ------------ | ---------------------------------------------- |
| Database     | PostgreSQL 17 + Drizzle ORM                    |
| API          | tRPC v11 via Express adapter                   |
| Validation   | Zod (shared schemas)                           |
| Backend      | Express + helmet + rate-limit + Pino           |
| Web          | TanStack Start (React 19, Vite, SSR via Nitro) |
| Web UI       | shadcn/ui + Radix + Tailwind CSS v4            |
| PDF Export   | @react-pdf/renderer (server-side)              |
| File Storage | AWS S3 (presigned URLs)                        |
| Mobile       | React Native (DEFERRED to v2)                  |
| Monorepo     | Turborepo + pnpm workspaces                    |

## Design System

- Primary: Teal #0F766E (hsl 172 85% 26%)
- Destructive/Critical: Red for allergies, drug interactions
- Warning: Amber for abnormal values, pending items
- Success: Green for normal vitals, positive statuses
- Font: Inter (UI), JetBrains Mono (vitals/codes/dosages)
- Min font: 14px base (scales to 16px on sm+)
- WCAG 2.1 AA contrast required

## Database Schema Summary

- **users**: id, email, name, hashed_password, role (gp/nurse/admin), is_active
- **sessions**: id, user_id, token, expires_at, ip_address, user_agent
- **patients**: id, first_name, last_name, dob, gender, contact info, blood_type, allergies (jsonb), active_conditions (jsonb), created_by
- **medical_records**: id, patient_id, type, title, content (jsonb SOAP), vitals (jsonb), diagnoses (jsonb), attachments (jsonb), version, parent_id (versioning), created_by
- **appointments**: id, patient_id, provider_id, type, status, scheduled_at, duration_minutes, reason, notes, created_by
- **audit_logs**: id, user_id, action, resource, resource_id, ip_address, user_agent, created_at
- **documents**: id, patient_id, medical_record_id, name, category, mime_type, size_bytes, s3_key, status, notes, uploaded_by, timestamps
- **share_links**: id, resource_type, resource_id, token (unique), expires_at, password_hash, access_count, max_accesses, is_revoked, created_by, created_at

## tRPC Routers

- **patient**: list, getById, create, update, archive
- **medicalRecord**: listByPatient, getById, create, update (versioned)
- **appointment**: list, getById, create, update, cancel
- **audit**: list (admin only)
- **auth**: register, login, logout, me
- **dashboard**: stats (today's appointments, total patients, records this week, today's schedule)
- **document**: list, getById, requestUpload, confirmUpload, getDownloadUrl, update, archive, delete
- **export**: patientSummary (PDF base64), medicalRecord (PDF base64)
- **share**: create, listByResource, revoke, access (public)

## Web Route Structure

```
routes/
  __root.tsx          # App shell with sidebar + auth guard
  index.tsx           # Dashboard (stat cards + today's schedule)
  auth/
    login.tsx         # Login page
    register.tsx      # Register page
  patients/
    index.tsx         # Patient list with search + pagination
    $patientId.tsx    # Patient profile (Summary/History/Appointments/Documents tabs)
  schedule/
    index.tsx         # Day-view schedule with appointment cards
  share/
    $token.tsx        # Public share page (no auth required)
  tasks/
    index.tsx         # Tasks (placeholder)
  reports/
    index.tsx         # Reports (placeholder)
  settings/
    index.tsx         # Settings (placeholder)
```

## Monorepo Structure

```
DocNotes/
  apps/
    backend/           # Express + tRPC + Pino + Helmet
      src/
        index.ts       # Main server (body limit 10MB, rate limit 500/15min)
        lib/logger.ts  # Pino config with PHI redaction
        lib/audit.ts   # Audit logging helper
        middleware/trpc.ts  # tRPC Express adapter
    web/               # TanStack Start + Tailwind + shadcn/ui
      src/
        components/
          ui/          # shadcn/ui components
          patients/    # Patient-specific components (new-patient-dialog, visit-note, patient-*, share-dialog, upload-document-dialog)
          schedule/    # Schedule components (new-appointment-dialog)
          AppSidebar.tsx  # Responsive sidebar (mobile drawer + desktop)
        lib/
          trpc.ts      # tRPC client config
          auth.ts      # Token management
          auth-context.tsx  # AuthProvider + useAuth hook
          format.ts    # Date, age, gender formatters
          download.ts  # Base64 file download + PDF print utilities
          utils.ts     # cn() helper
        hooks/
          use-debounce.ts  # Debounce hook
        routes/        # TanStack Router file-based routes
        styles.css     # Tailwind v4 + design tokens
    mobile/            # DEFERRED to v2
  packages/
    shared/            # Zod schemas, enums, TS types
      src/
        enums.ts       # UserRole, AppointmentStatus, AppointmentType, RecordType, Gender, etc.
        schemas/       # user, patient, medical-record, appointment, audit, document, share-link, export
    db/                # Drizzle schema + connection
      src/
        schema/        # users, sessions, patients, medical_records, appointments, audit_logs, documents, share_links
        connection.ts
      drizzle.config.ts
    api/               # tRPC routers + context + libs
      src/
        trpc.ts        # Context, procedures, RBAC middleware
        routers/       # patient, medical-record, appointment, audit, auth, dashboard, document, export, share
        lib/
          s3.ts        # S3 client, presigned URLs, key generation
          pdf.ts       # PDF templates (patient summary, medical record)
```

## Package Dependencies

```
@docnotes/shared → (standalone, only zod)
@docnotes/db → @docnotes/shared, drizzle-orm, postgres
@docnotes/api → @docnotes/shared, @docnotes/db, @trpc/server, drizzle-orm, zod, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @react-pdf/renderer, bcryptjs
@docnotes/backend → @docnotes/api, @docnotes/db, @docnotes/shared, express, helmet, etc.
@docnotes/web → @trpc/client, @trpc/tanstack-react-query, @tanstack/react-query, react-hook-form, @hookform/resolvers, zod, @docnotes/shared
```

## Environment Variables

| Variable       | Default                 | Description                             |
| -------------- | ----------------------- | --------------------------------------- |
| `PORT`         | `3001`                  | Backend port                            |
| `DATABASE_URL` | —                       | PostgreSQL connection string            |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins         |
| `AWS_REGION`   | `ap-south-1`            | S3 region (Mumbai for India)            |
| `S3_BUCKET`    | `docnotes-documents`    | S3 bucket name                          |
| `S3_ENDPOINT`  | (none)                  | Optional S3-compatible endpoint (MinIO) |
| `WEB_URL`      | `http://localhost:3000` | Web app URL for share links             |
