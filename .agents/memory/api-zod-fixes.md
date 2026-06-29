---
name: api-zod DOM types + UploadRomBody collision
description: Two required fixes for lib/api-zod typecheck to pass after codegen with the ROM upload multipart endpoint.
---

## Rule 1 — `lib/api-zod` must declare DOM lib types

`lib/api-zod/tsconfig.json` must include `"lib": ["es2022", "dom"]` in `compilerOptions`.

**Why:** The ROM upload Zod schema uses `z.instanceof(File)` and `UploadRomBody` uses `Blob`. Both are DOM globals. The base tsconfig has `"types": []` which strips built-ins, so without the explicit `lib` override these produce `TS2304: Cannot find name 'File'/'Blob'`.

**How to apply:** Whenever codegen is re-run or tsconfig is touched, verify `lib/api-zod/tsconfig.json` still has `"lib": ["es2022", "dom"]`.

## Rule 2 — `lib/api-zod/src/index.ts` must NOT use `export * from "./generated/types"`

Use explicit per-file re-exports for every type file **except** `uploadRomBody.ts`:

```ts
export * from "./generated/api";
export * from "./generated/types/androidVersion";
// ... all types files except uploadRomBody
```

**Why:** Orval emits `UploadRomBody` as a Zod schema in `generated/api.ts` AND as a TS interface in `generated/types/uploadRomBody.ts`. Re-exporting both via `export *` causes `TS2308: Module has already exported a member named 'UploadRomBody'`. The barrel `generated/types/index.ts` includes `uploadRomBody`, so using `export * from "./generated/types"` in the package index triggers the collision.

**How to apply:** After any codegen run, check `lib/api-zod/src/index.ts`. If it reverts to `export * from "./generated/types"`, replace with the explicit per-file list (excluding `uploadRomBody`).
