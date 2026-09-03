# Ivy & Pearls — Production Operations Runbook

## Release gate
A production release must pass `npm ci`, `npm run quality`, a high/critical dependency audit, representative checkout/payment tests, accessibility checks and a production-equivalent Lighthouse run. Deploy through preview/staging first and verify canonical/noindex behaviour before promotion.

## Environments and secrets
Keep development, staging and production data/payment environments separate. Never expose service-role, Stripe secret/webhook, email or fulfilment credentials with a `VITE_` prefix. Rotate secrets after staff/provider changes and immediately after suspected disclosure. Production startup validates core Supabase/site settings.

## Incident response
1. Confirm impact and affected route/integration.
2. Stop risky deploys and preserve request IDs/log evidence without copying customer data into tickets.
3. Roll back the last release when it is the likely cause.
4. For payment/fulfilment incidents, pause automatic downstream actions if duplicate execution is possible and reconcile by provider IDs/idempotency keys.
5. Communicate customer-impacting incidents through Client Care with verified facts only.
6. Document cause, timeline, remediation and a regression test after resolution.

## Monitoring baseline
Probe `/healthz` and `/readyz`, track 5xx rate, latency, checkout/payment failures, webhook errors and fulfilment submission failures. Alert on sustained error-rate increases and repeated webhook/partner failures. Logs use request IDs and redact fields likely to contain credentials or personal data.

## Backup and recovery
Enable managed Supabase backups appropriate to the commercial recovery target. At least quarterly, restore a non-production backup into an isolated environment and verify products, profiles, carts/orders and critical relationships. Record the achieved recovery time and restore point.

## Commerce reconciliation
Regularly reconcile payment provider transaction ID → internal order → fulfilment submission → tracking state. Investigate duplicates, paid orders lacking fulfilment, fulfilment records lacking a paid order, and stale paid/processing states.

## Security
Review dependency advisories on every merge. Keep `.well-known/security.txt` live. Verify admin authorization boundaries after auth/RLS changes. Media upload accepts only JPG/PNG/WebP and verifies file signatures before storage. Review CSP whenever third-party scripts are added.

## SEO and accessibility
Crawl the canonical production host after major route/content changes. Validate representative Product structured data, canonical URLs, sitemap, robots, 404s and redirects. Run automated accessibility checks and manual keyboard/zoom testing on Home, collection, PDP, cart, checkout, account and admin flows.
