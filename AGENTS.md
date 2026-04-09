# AGENTS

## Workflows discovered

- `.github/workflows/ci.yml`
  - Runs on `push` e `pull_request` para `main`.
  - Executa: `npm ci` → `npx biome check .` → `npx vitest run`.
- `.github/workflows/publish.yml`
  - Runs on tag push (`v*`).
  - Executa: `npm ci` → `npx vitest run` → `npm publish --provenance --access public` com registry npm.

## Commands in use

- `npm run lint` (`biome check .`)
- `npm run test` (`vitest run`)
- `npm run check` (`biome check . && vitest run`)
- `npx biome check .`
- `npx vitest run`
- `npm ci`
