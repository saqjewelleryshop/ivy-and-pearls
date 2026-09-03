# Ivy & Pearls — Production / Enterprise Readiness Audit

Audit date: 3 September 2026

## Executive verdict

Current static-code assessment: **7.6/10 overall**. The project is materially beyond prototype quality and already contains several production-grade foundations, but it is **not yet defensible as 10/10 enterprise-ready** until the release pipeline, automated testing, observability, performance validation, security verification, and maintainability gaps below are closed.

This score is a codebase audit, not a live-site Lighthouse/RUM score. A production build could not be completed in this environment because dependencies were not available locally and `npm ci` timed out before installing Vite.

## Change completed in this audit

The live product detail page now has a real carousel control on the large product image:

- Previous and next arrow buttons overlaid on the main image.
- Wraparound navigation from first ↔ last.
- Works with the existing variant-specific hero-image behaviour.
- Image position indicator (`2 / 5`).
- Accessible `aria-label` controls and visible keyboard focus.
- Responsive mobile control sizing.
- Reduced-motion support.
- Existing thumbnails remain usable.

Files changed:
- `src/pages/Product.jsx`
- `src/styles/global.css`

Validation completed:
- `npm run check` — PASS.
- `npm run audit:seo` — PASS (all architecture checks).
- `npm run build` — NOT VERIFIED because `vite` was not locally installed.

## Scorecard

| Area | Score | Assessment |
|---|---:|---|
| Visual design / brand | 8.8/10 | Strong luxury direction, cohesive typography/spacing and bespoke PDP. Needs live responsive QA and design-system consolidation. |
| Product UX / conversion | 8.4/10 | Variant handling, stock, cart, wishlist, checkout and gallery are strong. Add richer gallery gestures/zoom and conversion instrumentation. |
| SEO architecture | 8.8/10 | SSR, canonicals, robots, sitemap, Product + Breadcrumb JSON-LD, 404 handling and redirects are present. Needs live crawl/indexation and schema validation. |
| Accessibility architecture | 8.0/10 | Skip link, semantic main, focus-visible, reduced motion, ARIA controls are present. No automated axe/Pa11y or manual WCAG audit. |
| Performance architecture | 7.2/10 | Image formats and chunk strategy are sensible, but no verified Lighthouse/CWV result, no RUM and large CSS/admin/API files remain. |
| Security | 8.0/10 | Helmet/CSP, rate limits, server-side secrets, RLS, admin role checks, input validation and webhook verification exist. CSP still permits unsafe-inline and no verified SAST/dependency scan is present. |
| Reliability | 6.5/10 | Server error handling exists, webhook dedupe exists, Stripe idempotency exists. No automated integration/E2E suite, no monitoring/alerting/SLOs. |
| Maintainability | 6.4/10 | Clear domain split exists, but `server/routes/api.js` ~1,973 lines, `Admin.jsx` ~1,673 lines and global CSS ~4,791 lines create regression risk. |
| DevOps / release | 5.8/10 | Vercel config exists and build scripts exist. No repository CI workflow, test gate, dependency gate, preview smoke tests, migration gate or automated rollback verification found. |
| Observability | 4.5/10 | Console logging exists but no structured logger, tracing, error tracking, RUM, uptime monitoring or alert policy found. |
| Data / commerce integrity | 8.2/10 | Supabase RLS, server-side service role, Stripe server calculations and webhook flow are solid foundations. Live catalogue/payment/fulfilment reconciliation still needs operational tests. |
| Legal / trust | 8.0/10 | Privacy, cookie, terms, delivery/returns and accessibility pages exist. Legal accuracy and live consent behaviour still require owner/legal verification. |
| Enterprise readiness | 6.8/10 | Good application foundation; missing engineering controls prevent a genuine enterprise claim. |

## P0 — blockers before calling it enterprise-ready

### 1. No automated application tests
No unit, integration, component or end-to-end test files were found. This is the single largest engineering-quality gap. Critical flows that must be automated include sign-up/login, product/variant selection, cart persistence, payment-intent creation, Stripe payment completion, webhook idempotency, order creation, account order access control, admin authorization, media upload validation and 404/redirect behaviour.

**Target:** Vitest/React Testing Library + Playwright. Require all critical-path tests on every pull request.

### 2. No CI/CD quality gate found
No `.github/workflows` or equivalent repository CI pipeline was found. A production project should not depend on a developer remembering to run commands locally.

**Required gate:** clean install → syntax/lint/type checks → unit tests → integration tests → production build → SEO checks → vulnerability scan → Playwright smoke/E2E → deploy preview → Lighthouse budget.

### 3. Production build is not currently proven by this artifact
`npm run build` could not execute because Vite was unavailable in the extracted environment. `npm ci` did not complete within the tool environment. The code may build correctly in Vercel, but that must be proven by CI on a clean checkout.

**Release rule:** no deploy if a clean `npm ci && npm run build` fails.

### 4. No observability/error tracking
The project primarily uses `console.log/error/warn`. This is insufficient for production commerce incidents.

**Required:** Sentry (or equivalent) for browser + server errors, structured JSON server logs, request/correlation IDs, payment/order context that excludes sensitive data, uptime checks, alerting, and dashboards for error rate, latency, checkout failures and webhook failures.

### 5. No verified performance/Core Web Vitals result
A Lighthouse config/script exists, but no current measured result is included. Performance cannot be scored 10/10 from source architecture alone.

**Target budgets:** LCP ≤2.5s p75, INP ≤200ms p75, CLS ≤0.1 p75, Lighthouse Performance ≥90 on representative mobile pages; Accessibility/SEO/Best Practices ≥95–100 where realistic.

### 6. CSP still permits `unsafe-inline`
The production Content Security Policy allows inline scripts/styles. The inline bootstrap script explains part of this choice, but a hardened enterprise deployment should use nonces/hashes and remove broad `unsafe-inline` allowances where practical.

### 7. Monolithic high-risk files
`server/routes/api.js` (~1,973 lines), `src/pages/Admin.jsx` (~1,673 lines), and `src/styles/global.css` (~4,791 lines) are too large for low-regression-risk enterprise maintenance.

**Refactor:** split API by domains (`catalog`, `checkout`, `accounts`, `admin-products`, `media`, `payments`, `partner-sync`); split Admin into route-level modules/components/hooks; split CSS by tokens/base/components/pages/admin.

## P1 — high-value production gaps

### Security and abuse resistance
- Add automated dependency vulnerability scanning and update automation.
- Add security-focused tests for authorization boundaries, malformed UUIDs, oversized input and upload content sniffing.
- Validate uploaded image bytes/magic numbers, not only MIME supplied by the client.
- Consider malware/image-decompression safeguards for uploads.
- Add stricter rate limits per sensitive operation, especially authentication-adjacent/contact/checkout/admin sync endpoints.
- Add explicit allowed-origin/CORS policy if the API is exposed on a separate domain.
- Review whether session/auth actions require CSRF controls based on the final auth transport model.
- Add security.txt and documented vulnerability reporting process for mature production operation.

### SEO
- Validate generated Product JSON-LD against Google's Rich Results Test using live product URLs.
- Add `priceValidUntil` only when truthful; add shipping/returns structured data where data is authoritative and maintained.
- Consider Organization/WebSite schema and SearchAction only if the site search supports a stable indexable URL contract.
- Sitemap static pages currently receive the current timestamp on each request. Use meaningful last-modified dates instead of making every static page appear freshly changed on every crawl.
- Add sitemap caching and potentially sitemap indexes if catalogue size grows substantially.
- Verify trailing-slash policy across every route and redirect noncanonical variants consistently.
- Live-test canonical host redirection (www/non-www/http/preview domains).
- Add automated crawl tests for orphan pages, duplicate titles/descriptions, broken internal links and accidental noindex.

### Accessibility
- Run axe-core automatically on key pages.
- Manual keyboard-only audit of header, cart drawer, filters, checkout, cookie dialog, account and admin.
- Confirm focus trapping/restoration for every modal/drawer, not only Escape handling.
- Test at 200%/400% zoom and 320 CSS px width.
- Verify colour contrast of gold/muted text on ivory/white and disabled controls.
- Ensure product gallery can also be operated naturally with swipe on touch devices if implemented later without removing keyboard controls.
- Test screen-reader announcements for cart updates, validation errors, loading states and checkout failures.

### UX / conversion
- Add swipe gestures and optional zoom/lightbox to PDP gallery while retaining the new arrows.
- Add disabled/loading feedback on Add to Bag to prevent repeat intent confusion.
- Ensure price/stock/variant selection never shifts layout unexpectedly.
- Add skeletons instead of text-only loading states for catalogue/PDP on client transitions.
- Add robust empty/error states for API degradation.
- Add checkout progress/confirmation instrumentation and abandoned-checkout measurement only with appropriate consent.
- Add product review/social-proof capability only if moderation and authenticity processes are defined.

### Performance
- Reduce global CSS by removing superseded/duplicated PDP rule generations after visual regression tests.
- Route-level lazy-load heavy admin/account/checkout code where suitable.
- Confirm Stripe code loads only when checkout needs it.
- Confirm GSAP only loads on pages using cinematic motion.
- Generate multiple responsive image widths and use `srcset`/`sizes`; WebP alone is not sufficient optimisation.
- Prefer AVIF where supported as an additional source when the media pipeline can generate it.
- Add immutable caching for fingerprinted assets and intentional caching for `/media/` redirects/images.
- Add CDN image transformation or pre-generated thumbnails so product cards do not download PDP-size images.
- Monitor JS/CSS bundle budgets in CI.

### Reliability / commerce operations
- Add retry/dead-letter operational process for failed fulfilment partner submission.
- Add reconciliation job/dashboard: Stripe payment ↔ internal order ↔ fulfilment submission ↔ tracking.
- Add webhook replay tooling and alert on repeated handler failures.
- Make order/payment state transitions explicit and auditable.
- Test concurrent checkout/payment requests and duplicate client submissions.
- Add database backup/restore drill documentation and RPO/RTO targets.

## P2 — enterprise maturity

- TypeScript (or comprehensive runtime schemas plus typed JSDoc) across client/server to reduce contract drift.
- ESLint + Prettier/formatter enforced in CI.
- Architecture decision records (ADRs) for auth, payment, fulfilment, content, media and deployment.
- OpenAPI contract for server APIs and generated/validated clients.
- Feature flags for risky launches.
- Environment validation at startup with Zod, failing fast on missing production secrets.
- Secret rotation runbook.
- Separate dev/staging/prod Supabase and Stripe environments with promotion rules.
- Database migration CI and migration rollback/forward-fix procedure.
- SLOs/SLIs and incident response runbook.
- Data retention/deletion process for contacts, accounts, newsletter and order data.
- Admin audit log for destructive catalogue/payment/settings actions.
- RBAC beyond a single `admin` role if multiple operational teams will use the admin console.
- Automated visual-regression screenshots for luxury design consistency across breakpoints.

## Specific code findings

### Strong foundations already present
- React SSR entry and server bootstrap are implemented.
- Canonical meta, robots, OG/Twitter tags and JSON-LD are centralized in `Seo.jsx`.
- Product pages include Product and Breadcrumb structured data.
- Preview `.vercel.app` deployments receive `X-Robots-Tag: noindex, nofollow`.
- Genuine unknown SSR URLs can return 404 state.
- Legacy route redirects exist.
- Helmet security headers and API rate limiting are configured.
- Supabase service-role key is server-side and admin requests verify the authenticated user plus `profiles.role`.
- Supabase RLS is enabled across core commerce and merchandising tables with owner/admin policies.
- Stripe webhook signatures are verified and webhook event IDs are deduplicated.
- Stripe product/payment calls include idempotency keys in critical flows.
- Admin-controlled product description HTML is sanitized before persistence in identified write paths.
- Uploads have an 8 MB limit and MIME allowlist.
- Skip link, `main` landmark, `focus-visible` styles and reduced-motion handling exist.

### Maintainability / duplication
The application has both `server/index.js` and `api/index.js` with substantial duplicated routing/SSR logic. These can drift: fixes made in one entry may not reach the other. Extract one shared `createApp()` / SSR bootstrap module and have local Node and Vercel adapters import it.

### Sitemap freshness bug/quality issue
Static pages use `new Date().toISOString()` as `lastmod` every time `/sitemap.xml` is requested. Search engines can interpret this as every static page changing continuously. Store real content modification dates or omit `lastmod` for pages where it is unknown.

### Upload validation limitation
Multer trusts `file.mimetype`; an attacker can label arbitrary bytes as `image/webp/jpeg/png`. Decode/inspect the file or check signatures before storing.

### HTML rendering
The storefront renders stored product/journal HTML with `dangerouslySetInnerHTML`. Product descriptions are sanitized in the identified admin write paths, which is good; ensure **every** ingestion/import/migration path for both products and journal posts applies the same sanitizer and URL protocol restrictions before persistence.

### Logging hygiene
Vercel SSR logs every request and multiple integration actions via console. Move to structured logs and ensure no customer addresses, tokens, partner secrets or payment-sensitive data can be emitted by object/error logging.

## Definition of “10/10” for this project

Do not declare 10/10 based on code review alone. Use this release bar:

1. Clean production build from a fresh checkout succeeds.
2. Zero high/critical dependency findings, or documented accepted exceptions.
3. Unit/integration/E2E critical commerce suite passes.
4. Automated authorization/security regression suite passes.
5. Lighthouse/CWV budgets pass on Home, Collection, PDP and Checkout.
6. axe accessibility automation plus manual keyboard/screen-reader audit passes agreed WCAG 2.2 AA scope.
7. Rich Results/schema validation passes product pages.
8. Full crawl finds no broken internal links, canonical/noindex errors or duplicate metadata outside intentional cases.
9. Sentry/observability and alerts proven with a test incident.
10. Stripe test-mode purchase, webhook replay, duplicate webhook and refund/failure paths verified.
11. Fulfilment submission/retry/reconciliation tested.
12. Backup restore and production rollback procedure tested.
13. CI blocks merge/deploy when any mandatory gate fails.
14. Visual regression suite passes desktop/tablet/mobile representative routes.
15. Legal/content/catalogue claims manually signed off for real live data.

Once those are evidenced, the project can credibly be described as production/enterprise ready rather than simply appearing polished.
