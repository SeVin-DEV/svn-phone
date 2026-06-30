---
name: dockerode esbuild externalize
description: dockerode must be marked external in build.mjs or its optional peer deps crash the server at startup.
---

## Rule

`dockerode` must appear in the `external` array in `artifacts/api-server/build.mjs`.

**Why:** dockerode's `lib/session.js` unconditionally requires `ssh2`, `@grpc/grpc-js`, and `@grpc/proto-loader` at module load time even though they are optional. When esbuild bundles dockerode, it marks those as external but they are not in node_modules, crashing the server with `Cannot find module 'ssh2'`. Externalizing dockerode itself lets Node resolve it from node_modules where all its transitive deps are properly linked.

**How to apply:** If dockerode is added, updated, or the build config is regenerated, verify `"dockerode"` is in the `external: [...]` array in `build.mjs`. Also ensure `ssh2` and `@grpc/grpc-js` are installed as explicit deps of `@workspace/api-server` so they are present in node_modules for dockerode to find at runtime.
