# DocNotes

Medical records app for general practitioners.

- `apps/web` — Next.js 16 App Router (Vercel)
- `apps/backend` — Hono API (Hetzner, Caddy + Docker)
- `apps/mobile` — React Native (deferred to v2)

Auth: Clerk (email magic link).
DB: Neon Postgres (one DB shared between staging and prod backends).

See `CLAUDE.md` for architecture, workflow, and guardrails. See
`.claude/implementation-plan.md` for the roadmap and phase status.
