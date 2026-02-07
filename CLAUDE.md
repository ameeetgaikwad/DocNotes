# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DocNotes is a monorepo using **Turborepo + pnpm workspaces** containing three apps:

- **`apps/backend`** — Express.js API server (TypeScript, port 3001)
- **`apps/web`** — TanStack Start web app (React 19, Vite, SSR via Nitro, port 3000)
- **`apps/mobile`** — React Native app (React 18, Metro bundler)

## Commands

### Root-level (runs across all apps via Turborepo)

```bash
pnpm install            # Install all dependencies
pnpm dev                # Run all apps in parallel
pnpm build              # Build all apps
pnpm lint               # Lint all apps
pnpm lint:fix           # Lint with auto-fix
pnpm format             # Format all files with Prettier
pnpm format:check       # Check formatting (no changes)
pnpm check-types        # TypeScript type checking
```

### Per-app development

```bash
# Backend
pnpm --filter @docnotes/backend dev       # tsx watch, port 3001
pnpm --filter @docnotes/backend build     # tsc → dist/

# Web
pnpm --filter @docnotes/web dev           # Vite dev server, port 3000
pnpm --filter @docnotes/web build         # Vite + Nitro build → .output/
pnpm --filter @docnotes/web test          # Vitest (run once)

# Mobile
pnpm --filter @docnotes/mobile dev        # Metro bundler
pnpm --filter @docnotes/mobile ios        # Run on iOS
pnpm --filter @docnotes/mobile android    # Run on Android
```

## Architecture

- **No shared packages yet** — all three apps are independent under `apps/`. There is no `packages/` directory.
- **Web routing** uses TanStack Router file-based conventions (`apps/web/src/routes/`). The root layout is in `__root.tsx`.
- **Web path alias**: `@/` maps to `apps/web/src/`.
- **Backend** is a minimal Express server with CORS enabled and JSON body parsing. Two routes exist: `GET /` and `GET /health`.
- **Mobile** entry point is `index.js` which registers the app; main component is `App.tsx`.

## Code Style

- ESLint v9 flat config at repo root (`eslint.config.mjs`) with per-app overrides
- Prettier: double quotes, semicolons, trailing commas, 2-space indent, 80 char width
- Pre-commit hook (Husky + lint-staged) auto-runs ESLint fix and Prettier on staged files
- TypeScript strict mode enabled in all apps

## TypeScript

- Backend: `NodeNext` module resolution, compiles to `dist/`
- Web: `Bundler` module resolution, `react-jsx` transform
- Mobile: `ESNext` module, `react-native` JSX, `noEmit` (type-check only)

## Guardrails - Ask Before Doing

**ALWAYS ask the user before performing these operations:**

### Git Operations

- Do not commit changes without user confirmation
- Do not push to any remote branch without asking
- Do not force push (`--force`) ever
- Do not delete branches (local or remote)
- Do not rebase or reset branches
- Do not merge branches
- Do not amend commits

### Dependencies

- **Only use pnpm** - Never use npm, yarn, or bun for package management

### Database & Data

- Do not run database migrations
- Do not delete or drop collections/documents
- Do not modify production data or seeds
- Do not connect to production databases
