# DocNotes Project Memory

## Project Status

- See [implementation-plan.md](./implementation-plan.md) for the full plan and progress
- See [architecture.md](./architecture.md) for key architecture decisions
- **Phase 1 (Foundation): COMPLETE**
- **Phase 2 (Core CRUD): COMPLETE**
- **Auth + Database Setup: COMPLETE**
- **Phase 4 (Documents & Export): COMPLETE**
- **Responsive Web: COMPLETE**
- Next: Phase 3 (Security Hardening)

## Key Facts

- Monorepo: Turborepo + pnpm, 3 apps (backend, web, mobile)
- Mobile is DEFERRED to v2 — focus on backend + responsive web
- Target market: India first, then AU/UK, then US
- Medical records app for GPs (small practice EHR)

## Gotchas Encountered

- packages use `"moduleResolution": "bundler"`, backend uses `"NodeNext"` — works because packages export from `dist/`
- `@types/express-rate-limit` and `@types/pino-http` are deprecated (bundled types now)
- Need `@types/node` in `packages/db` for `process.env`
- Need `drizzle-orm` as direct dep in `packages/api` (not just via `@docnotes/db`)
- Tailwind v4 uses `@tailwindcss/vite` plugin and `@import "tailwindcss"` in CSS
- Need `zod` as direct dep in web app for form validation schemas
- JSONB columns return `unknown` type — use `!= null` check (not `&&`) for JSX rendering
- Zod `.default()` causes type mismatch with react-hook-form resolver — use `defaultValues` instead
- `react/prop-types` rule is noisy with TypeScript forwardRef components — disable for web app
- tRPC v11 cache invalidation key format: `[["routerName"]]` for broad invalidation
- `pnpm run format` (not `pnpm format`) for root-level scripts
- drizzle-kit can't resolve `.js` extensions from TypeScript ESM — point to compiled `dist/` with glob
- @react-pdf/renderer uses React 18 types; need `as any` casts for components when @types/react is v19
- Need @types/react as devDep in api package for @react-pdf/renderer
- shadcn/ui Select component is native `<select>`, not Radix Select — use `<option>` elements
- TanStack Router route tree must be manually updated (or use Vite dev to auto-regenerate) when adding new routes
- useMutation expects variable arg — pass `undefined` explicitly when mutationFn has optional param
