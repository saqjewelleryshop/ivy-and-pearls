# Production hotfix — 3 September 2026

This hotfix addresses the production console failures reported after the enterprise upgrade.

## Fixed

- React #418 / #423 hydration failures: Vercel's filesystem route could serve Vite's empty static `index.html` while the client always called `hydrateRoot`. Vercel routing now sends application pages to the SSR function, and the client safely hydrates only when SSR markup exists; otherwise it mounts normally.
- `/api/products` 500 compatibility: production env validation now accepts the project's existing `VITE_SUPABASE_URL` convention as well as `SUPABASE_URL`.
- Product catalogue schema rollout safety: public catalogue reads fall back to the legacy commerce schema if the richer merchandising relation/columns are not yet available, preventing a staged Supabase migration from taking the storefront offline.
- `/favicon.ico` 500: real ICO and SVG favicons are included and routed as static assets.
- Chat widget 404 noise: the third-party widget is opt-in (`VITE_ZOCHAT_ENABLED=true`) and loads only with a syntactically valid configured bot ID. Leave disabled until the bot configuration endpoint is confirmed to exist.
- Cart SSR/client path is unified; browser storage is loaded after mount without an SSR-only provider prop.

## Deployment configuration

Required server variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- either `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SITE_URL` should be set to the canonical production domain

Optional chat:
- `VITE_ZOCHAT_ENABLED=true`
- `VITE_ZOCHAT_BOT_ID=<confirmed-valid-bot-id>`

## Validation performed

- `npm run check` — pass
- `npm test` — pass
- `npm run audit:source` — pass
- `npm run audit:seo` — pass

A full local Vite build was attempted but the analysis environment did not contain the project's complete dependency installation (`vite` executable absent). The clean deployment pipeline must run `npm ci && npm run build`.
