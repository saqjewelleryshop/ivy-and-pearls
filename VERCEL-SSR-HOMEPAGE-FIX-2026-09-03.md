# Vercel SSR Homepage Fix — 3 September 2026

## Symptom
`/readyz` could respond while `/` returned HTTP 500 with `Something went wrong. Please try again.`

## Root cause
The serverless entry reads `dist/client/index.html` and imports `dist/server/entry-server.js` at runtime. The renderer import previously used a computed filesystem path and `vercel.json` did not explicitly include either generated artifact in the `api/index.js` function bundle. Vercel's file tracer therefore had no reliable static reference to those build outputs.

## Fix
- `vercel.json` now explicitly includes `dist/client/index.html` and `dist/server/**` in the serverless function bundle.
- The SSR renderer uses a statically discoverable relative dynamic import.
- `/readyz` now reports `ssrArtifacts` and non-secret `configurationIssues`.
- If server rendering fails, the function serves a client-renderable HTML shell with HTTP 200 rather than taking the storefront offline.
- Regression tests protect the packaging/fallback configuration.

## Post-deploy checks
1. `/healthz` -> 200.
2. `/readyz` -> `ssrArtifacts: true`; configuration issues are listed by variable name/validation only, never values.
3. `/api/products?limit=1` -> JSON.
4. `/` -> 200 HTML and renders normally.
