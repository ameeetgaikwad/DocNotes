# DocNotes

Medical records app for general practitioners.

- `apps/web` — Next.js 16 App Router (Vercel)
- `apps/backend` — Hono API (Hetzner, Caddy + Docker)
- `apps/mobile` — React Native (deferred to v2)

Auth: Clerk.
DB: Neon Postgres (one DB shared between staging and prod backends).

## Deployments

| Env        | Web                                 | Backend                                    |
| ---------- | ----------------------------------- | ------------------------------------------ |
| Production | https://docnotes.ameeet.com         | https://api-49-12-187-121.sslip.io         |
| Staging    | https://staging.docnotes.ameeet.com | https://staging-api-49-12-187-121.sslip.io |

See `CLAUDE.md` for architecture, workflow, and guardrails. See
`.claude/implementation-plan.md` for the roadmap and phase status.
