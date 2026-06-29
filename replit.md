# Cloud Phone Manager

A web dashboard for managing Android emulator instances on a self-hosted Linux server — spin up, configure, and connect to virtual Android devices from your browser.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/cloud-phone run dev` — run the frontend (port 23054)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — build composite lib declarations
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + TailwindCSS + shadcn/ui + Wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (emulators, device_profiles, roms, snapshots tables)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Emulator backends: Redroid (Docker), QEMU, AVD

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — Drizzle DB schema (emulators, device_profiles, roms, snapshots)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not hand-edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not hand-edit)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/` — docker-manager, port-manager, qemu-manager utilities
- `artifacts/cloud-phone/src/pages/` — frontend pages (dashboard, emulators, profiles, system)

## Architecture decisions

- Contract-first: OpenAPI spec → Orval codegen → typed hooks + Zod schemas. Never hand-write duplicated types.
- `lib/api-zod` must have `"lib": ["es2022", "dom"]` in tsconfig to resolve `File`/`Blob` types from the ROM upload schema.
- `lib/api-zod/src/index.ts` explicitly re-exports individual type files (not the barrel) to avoid `UploadRomBody` TS2308 collision between `generated/api.ts` Zod schema and `generated/types/uploadRomBody.ts` TS interface.
- Three emulator backends supported: Redroid (Docker), QEMU (full-system), AVD (Android SDK).
- Frontend served at `/` (port 23054); API at `/api` (port 8080) via shared proxy.

## Product

- List, create, start/stop, and delete Android emulator instances
- Device profile templates (built-in + custom hardware specs)
- ROM image library (upload, manage)
- System resource monitoring (CPU, RAM, storage)
- Snapshot management per emulator

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` then `pnpm run typecheck:libs` before touching leaf packages.
- Do NOT add `export * from "./generated/types"` to `lib/api-zod/src/index.ts` — use explicit per-file re-exports to avoid the `UploadRomBody` TS2308 collision.
- `lib/api-zod` needs `"lib": ["es2022", "dom"]` — the ROM upload schema uses `z.instanceof(File)` which requires DOM types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
