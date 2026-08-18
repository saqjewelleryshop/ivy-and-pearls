# Ivy & Pearls — React/Vite + Supabase + Stripe + ZQ

A complete headless commerce build for **Ivy & Pearls**. There is no WordPress and no WooCommerce.

## Architecture

```text
Customer
  ↓
React + Vite storefront (SSR)
  ↓
Node/Express API
  ├── Supabase Postgres + Auth
  ├── Stripe payments
  ├── Resend transactional email
  └── ZQ OpenAPI
        ↓
      fulfilment
        ↓
      tracking
```

ZQ is used for supplier catalogue access, inventory, fulfilment and tracking. Ivy & Pearls remains the source of truth for the customer, retail catalogue, retail price, order history and payment state.

## Included pages

Public:
- Homepage with 5-frame GSAP cinematic hero
- Shop
- Collections
- Rings / necklaces / earrings / bracelets
- New Arrivals
- The Ivy Edit
- Product detail
- Secure checkout
- Order confirmation
- Our Story
- Journal + individual editorial articles
- Contact / Client Care
- Delivery & Returns
- FAQs
- Privacy Policy
- Terms & Conditions
- Cookie Policy
- Accessibility
- 404

Customer:
- Register
- Sign in
- Password reset
- Account dashboard
- Order history
- Individual order/tracking page
- Delivery address management

Admin:
- Store overview
- Product management
- ZQ catalogue search
- ZQ product import
- Retail pricing on import
- Draft/publish controls
- New Arrival / Featured / Ivy Edit merchandising
- Variant price/availability controls
- Order and ZQ fulfilment status
- Failed ZQ fulfilment retry

## Commerce flow

1. Customer adds a ZQ-mapped Ivy variant to the bag.
2. Checkout sends variant IDs to the server.
3. The server re-reads authoritative product prices and stock from Supabase.
4. A pending Ivy order and immutable order items are created.
5. Stripe PaymentIntent is created server-side.
6. Stripe Elements handles card entry; card details never pass through Ivy application code.
7. Stripe's `payment_intent.succeeded` webhook marks the order paid.
8. Only after that server-side webhook does Ivy submit the order to ZQ.
9. ZQ `platformOrderId` is stored on the Ivy order.
10. Scheduled ZQ sync checks order detail, tracking and inventory.
11. When tracking first arrives, the Ivy order becomes `shipped` and a dispatch email is sent.
12. Signed-in customers can see order status and tracking from their account.

## ZQ API implemented

Base URL:
`https://system.zqdropshipping.com/api/v2`

Authentication:
`X-API-Key`

Implemented endpoints:
- `POST /openapi/order/create`
- `GET /openapi/order/detail/{platformOrderId}`
- `GET /openapi/order/tracking/{platformOrderId}`
- `GET /openapi/order/inventory/{sku}`
- `POST /openapi/import_product/list`
- `GET /openapi/import_product/{id}`
- `GET /openapi/international_shipping_cost/get`
- `GET /openapi/international_shipping_cost/sea_shipping/countryCodeList`
- `POST /openapi/international_shipping_cost/sea_shipping/calculate`
- `GET /openapi/international_shipping_cost/sea_shipping/surcharges`

The browser never receives the ZQ API key.

## Supabase setup

When your Supabase project is ready:

1. Open **SQL Editor**.
2. Run:
   - `supabase/migrations/001_commerce.sql`
   - `supabase/migrations/002_seed_journal.sql`
3. In Authentication, enable Email/Password.
4. Set Site URL to `https://ivyandpearls.co.uk`.
5. Add redirect URLs:
   - `https://ivyandpearls.co.uk/account/`
   - `https://ivyandpearls.co.uk/reset-password/`
   - your local development URL
6. Create your own customer account.
7. Make yourself admin:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'YOUR-ADMIN-EMAIL'
);
```

The migration enables Row Level Security on all exposed commerce tables. Public access is read-only for active products/published journal content. Orders, addresses and account records are scoped to the signed-in user. Sensitive writes happen through the server service role after validation and rate limiting.

## Environment

Copy `.env.example` to `.env`.

Public values beginning with `VITE_` are compiled into the browser bundle. **Never put the ZQ key, Stripe secret key, Supabase service role key or cron secret in a `VITE_` variable.**

Required for live commerce:

```env
SITE_URL=https://ivyandpearls.co.uk
VITE_SITE_URL=https://ivyandpearls.co.uk

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
VITE_STRIPE_PUBLISHABLE_KEY=...

ZQ_API_KEY=...
ZQ_BASE_URL=https://system.zqdropshipping.com/api/v2

RESEND_API_KEY=...
EMAIL_FROM=Ivy & Pearls <clientcare@ivyandpearls.co.uk>
CLIENT_CARE_EMAIL=clientcare@ivyandpearls.co.uk

CRON_SECRET=...
VITE_ZOCHAT_BOT_ID=cb_63e3369c
```

**Rotate the ZQ token that was pasted into chat before production use.**

## Stripe

Create a Stripe account/business setup and obtain publishable + secret keys.

Create a webhook endpoint:

```text
https://ivyandpearls.co.uk/api/webhooks/stripe
```

Subscribe to:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

Payment totals are always calculated on the server from current Supabase variant prices. The client cannot set the amount charged.

## ZQ product workflow

Admin → **ZQ Import**:

1. Search the ZQ import catalogue.
2. Open a ZQ product.
3. Enter the Ivy & Pearls product title.
4. Choose Rings / Necklaces / Earrings / Bracelets.
5. Enter the **retail price in GBP**.
6. Add a concise Ivy & Pearls description.
7. Add only material information you have verified.
8. Import as draft.
9. Review variants/images in **Products**.
10. Publish when ready.

ZQ's source cost is retained separately from the customer-facing GBP retail price. The import does not silently convert ZQ currencies or invent a retail exchange rate.

## Inventory

The protected sync endpoint updates:
- ZQ available inventory
- locked inventory
- in-transit inventory
- order processing status
- tracking numbers

Route:

```text
GET /api/cron/zq-sync
Authorization: Bearer YOUR_CRON_SECRET
```

Run it hourly from your hosting scheduler. ZQ's supplied documentation exposes polling endpoints rather than webhook registration, so the build intentionally uses a scheduled sync.

## UK delivery

The storefront is configured around the current Ivy & Pearls proposition:

**Complimentary UK delivery · Estimated 7–14 working days**

Checkout currently accepts UK delivery addresses. This avoids charging customers an invented international rate or silently converting ZQ shipping currencies. The ZQ international/sea shipping API methods are already implemented server-side for a future international checkout policy.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

Before Supabase credentials are supplied, the brand/editorial site renders but database commerce calls will report that Supabase is not configured. Once the environment is populated and migrations run, no code changes are required.

## Production build

```bash
npm ci
npm run build
npm start
```

The Node server serves:
- SSR HTML
- Vite static assets
- API endpoints
- robots.txt
- dynamic sitemap.xml
- Stripe webhook
- ZQ sync route

## Oracle Cloud deployment

Files are included in `deploy/oracle/`.

For Ubuntu:

```bash
chmod +x deploy/oracle/install.sh
./deploy/oracle/install.sh
```

Then copy the project into `/srv/ivy-pearls`, add `.env`, build it and enable the included systemd service/Nginx site. The public Node process listens only on localhost behind Nginx.

## SEO architecture

This is **SSR**, not an empty client-only SPA.

Implemented:
- unique title + meta description per route
- canonical tags
- Open Graph
- Twitter cards
- Organization JSON-LD
- Product JSON-LD with offer/availability
- Breadcrumb JSON-LD
- crawlable `<a>` links
- server-generated sitemap with product/article URLs
- robots.txt
- clean product URLs
- semantic H1/H2 structure
- meaningful image alt text
- `noindex` on checkout/account/admin/auth
- server-rendered product content/price/availability
- local hero assets rather than removed WordPress URLs

## Performance / Core Web Vitals design

Targets:
- LCP ≤ 2.5s
- INP ≤ 200ms in field data
- CLS ≤ 0.1
- Lighthouse Performance ≥ 95
- Lighthouse Accessibility = 100
- Lighthouse Best Practices = 100
- Lighthouse SEO = 100

Implemented:
- hero assets compressed to WebP
- first hero frame uses high fetch priority
- below-the-fold imagery is lazy loaded
- fixed image aspect ratios reduce CLS
- GSAP is split into its own build chunk
- Stripe is loaded only on checkout
- chat widget waits for browser idle time
- SSR removes blank SPA-first-render cost
- long-lived immutable caching for hashed `/assets/`
- reduced-motion support
- responsive layouts
- no page builder, WordPress or WooCommerce payload

The project includes `.lighthouserc.json` with scored CI thresholds and `npm run audit:lighthouse`.

A source code build can target these scores, but a literal final Lighthouse score cannot be truthfully guaranteed until the deployed site is tested with its real server latency, DNS/CDN, Supabase region, Stripe scripts, customer product imagery and network conditions.

## Accessibility

Implemented:
- skip link
- landmarks
- semantic headings
- keyboard navigation
- visible focus treatment
- labelled forms
- accessible quantity/cart controls
- reduced-motion handling
- ARIA labels for menu/cart/cinematic region
- accessible cookie preference dialog
- colour choices designed around sufficient text contrast
- account/checkout forms using native controls

## Security

Implemented:
- secrets server-side
- Supabase RLS
- service-role key never exposed to browser
- authoritative server-side price calculation
- Stripe webhook as fulfilment trigger
- ZQ submission idempotency guard
- Helmet security headers/CSP
- API rate limiting
- tighter rate limiting on contact/newsletter/checkout
- Zod validation
- product HTML sanitisation on ZQ import
- HTTPS-ready Nginx/Certbot deployment
- protected cron endpoint
- no customer-controlled fulfilment amount
- no direct browser-to-ZQ calls

## Brand details carried through

- Ivy green `#0b3d2e`
- warm ivory/cream
- muted gold `#c5a15a`
- serif editorial typography
- cinematic 5-frame hero
- rotating utility announcement
- restrained smart header
- The Ivy Edit
- Client Care
- editorial lifestyle sections
- premium newsletter
- `clientcare@ivyandpearls.co.uk`
- Ivy and Pearls Ltd
- Company no. 17387520
- complimentary UK delivery
- estimated 7–14 working days

## Final launch checklist

Before taking payments:
1. Supply Supabase values and run migrations.
2. Rotate and add the new ZQ API token.
3. Supply Stripe live keys and webhook signing secret.
4. Supply email provider API key.
5. Import and review every real product from ZQ.
6. Verify every material claim/product description before publishing.
7. Place a Stripe test order.
8. Confirm it appears in Supabase.
9. Confirm Stripe webhook changes it to paid.
10. Confirm it creates exactly one ZQ order.
11. Confirm ZQ platform order ID is stored.
12. Run ZQ sync and confirm tracking propagation.
13. Verify confirmation + dispatch emails.
14. Test refund/cancellation operating procedure.
15. Run Lighthouse CI.
16. Run Rich Results Test on a live product URL.
17. Validate sitemap/robots in Search Console.
18. Complete a real low-value live order before public launch.

## Product merchandising admin (ZQ-safe)

The admin catalogue deliberately separates **supplier data** from **customer-facing merchandising**.

Workflow:

1. Search ZQ in **Admin → ZQ Import**.
2. Import a supplier product. It defaults to `needs_review` unless explicitly published.
3. Open **Admin → Products** and edit the product in the WooCommerce-style workspace.
4. Control title, slug, short/full description, materials/care, visibility/status, retail/compare-at prices, inventory behaviour, variants, global/custom attributes, media/alt text, categories, collections, tags, The Ivy Edit/New Arrivals/Featured flags, SEO/social metadata, shipping information, reviews, purchase note and custom metadata.
5. The **ZQ** tab retains supplier product/SKU/spec mappings and supports selective synchronization of inventory, supplier cost, weight, supplier status and additional supplier images.
6. ZQ synchronization never overwrites Ivy & Pearls title, copy, retail prices, taxonomy, SEO, gallery order or customer-facing attributes.

Apply `supabase/migrations/003_product_merchandising.sql` after the base commerce migrations. The bundled `scripts/setup-supabase.ps1` now applies it automatically and is safe to re-run.

### Supplier-owned fields

- ZQ product ID / SKU / spec ID
- supplier raw payload/status
- supplier cost (when enabled)
- inventory / locked / in-transit (when enabled)
- weight (when enabled)
- optional newly discovered supplier images

### Ivy & Pearls-owned fields

- title / slug / descriptions
- retail and compare-at pricing
- categories / collections / tags
- visible attributes / variant naming
- imagery order / alt text / primary image
- SEO title / description / canonical / robots / OG content
- merchandising flags and storefront visibility

This split lets products stay fulfilment-safe and syncable while the public presentation remains entirely controlled by Ivy & Pearls.
