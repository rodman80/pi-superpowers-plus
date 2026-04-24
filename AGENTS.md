# AGENTS

## Workflows discovered

- `.github/workflows/ci.yml`
  - Runs on `push` e `pull_request` para `main`.
  - Executa: `npm ci` → `npx biome check .` → `npx vitest run`.
- `.github/workflows/publish.yml`
  - Runs on tag push (`v*`).
  - Executa: `npm ci` → `npx vitest run` → `npm publish --provenance --access public` com registry npm.
- `CONTRIBUTING.md`
  - Development setup: `npm install` → `npm test`.

## Commands in use

- `npm run lint` (`biome check .`)
- `npm run test` (`vitest run`)
- `npm test` (equivalente a `npm run test`)
- `npm run check` (`biome check . && vitest run`)
- `npx biome check .`
- `npx biome check --write` (local fixups; re-run tests depois)
- `npx vitest run`
- `npm ci`
- `npm install`
