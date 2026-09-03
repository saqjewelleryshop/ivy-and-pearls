# Vercel Deployment Recovery — 3 September 2026

## Why this version exists
The previous SSR deployment architecture coupled every storefront page to a serverless Express function and runtime `dist/server` artifacts. A failed deployment or missing/tracing SSR artifact could therefore make `/` return HTTP 500.

## Recovery architecture
- Vercel builds only the Vite client: `npm run build:client`.
- `dist/client` is the deployment output.
- Storefront routes fall back to `/index.html` and boot with React `createRoot` when no SSR markup is present.
- `/api/*`, `/media/*`, `/healthz`, `/readyz`, `/robots.txt`, `/sitemap.xml`, and `/.well-known/security.txt` are the only routes sent to the serverless Express function.
- The Vercel function has no dependency on `dist/server`, `entry-server.js`, or an SSR HTML template.

## Verification after deployment
1. `/` must return HTTP 200 and render the storefront.
2. `/healthz` must return `{\"status\":\"ok\"}`.
3. `/readyz` should show `supabase:true`; configuration issues are reported without crashing the site.
4. `/api/products?limit=1` should return JSON.
5. Product and service routes should load directly on refresh because Vercel rewrites unknown storefront paths to `/index.html`.

## Important
This recovery intentionally prioritises a reliably deployable storefront over runtime SSR. The source SSR implementation is retained for future reintroduction behind a deployment architecture that can be validated end-to-end, but it is not in the Vercel request path in this release.
