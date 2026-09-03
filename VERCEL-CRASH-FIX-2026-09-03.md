# Vercel FUNCTION_INVOCATION_FAILED fix — 3 September 2026

## Root cause fixed
The serverless entry called `validateProductionEnv()` at module import time. The validator required `SITE_URL`, even though the project historically used `VITE_SITE_URL` / `FRONTEND_URL`, and also required server Supabase credentials. Any missing or differently named variable threw before Express was created. Vercel reports top-level module exceptions as `FUNCTION_INVOCATION_FAILED`.

## Changes
- Production environment validation is now non-fatal by default.
- `SITE_URL`, `VITE_SITE_URL`, and `FRONTEND_URL` are accepted URL aliases.
- Supabase configuration problems produce controlled readiness/configuration states rather than crashing the function.
- `/readyz` returns 503 with a non-sensitive diagnostic when database credentials are unavailable.
- Server URL generation consistently uses the same URL fallback chain.
- Added regression tests preventing fatal import-time validation from returning.

## Required Vercel variables
Set these in Production (and Preview if needed):
- `SUPABASE_URL` OR `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL=https://www.ivyandpearls.co.uk` (recommended)
- `FRONTEND_URL=https://www.ivyandpearls.co.uk`

After changing environment variables, redeploy so the function gets the new environment.

## Safe checks after deployment
1. `/healthz` → HTTP 200
2. `/readyz` → HTTP 200 when Supabase server credentials are configured; HTTP 503 diagnostic otherwise
3. `/api/products?limit=1` → JSON response rather than platform crash page
4. `/` → HTML storefront rather than FUNCTION_INVOCATION_FAILED
