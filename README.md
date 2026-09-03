# Ivy & Pearls — Production Storefront

A headless React/Vite SSR jewellery storefront for **Ivy & Pearls**, backed by Supabase, Stripe and server-side international partner integrations.

## Architecture

- React + Vite SSR storefront
- Node/Express API
- Supabase database, authentication and media storage
- Stripe payments and webhook verification
- International partner catalogue, inventory, fulfilment and tracking integration
- Server-rendered SEO metadata, sitemap and legacy URL redirects

Ivy & Pearls remains the source of truth for customer-facing titles, descriptions, retail prices, merchandising, SEO and order history. External partner data is kept separate and never allowed to overwrite curated storefront content without an explicit sync action.

## Production principles

- Secrets remain server-side.
- Payment success is authoritative only after a verified Stripe webhook.
- Fulfilment is submitted server-side after payment verification.
- Product material claims should be published only when verified.
- Preview deployments are sent `X-Robots-Tag: noindex, nofollow`.
- Canonicals point to `https://ivyandpearls.co.uk`.
- Legacy catalogue URLs redirect to the current React routes.
- Customer-facing copy refers to selected **international partners**, not internal provider names.

## Local development

```bash
npm install
npm run dev
```

The Express server runs Vite in middleware mode during development, so `/api/*`, `/media/*` and the storefront share the same local origin.

## Build

```bash
npm run check
npm run build
npm start
```

## Environment

Copy `.env.example` to `.env` and provide the required Supabase, Stripe, email and international partner credentials. Never place server secrets in variables prefixed with `VITE_`.

## Admin workflow

1. Import a product from **Admin → Partner Import**.
2. Review the product in **Admin → Products**.
3. Curate title, copy, pricing, variants, attributes, media, organisation and SEO.
4. Upload owned imagery through **Admin → Media** and copy the branded `/media/...` URL where needed.
5. Verify material and product claims.
6. Publish only after the product is customer-ready.

## Media

Uploaded media is stored in Supabase Storage while the storefront uses branded relative URLs such as:

```text
/media/stone-set-bangle-white-gold-a1b2c3d4.webp
```

This keeps media references portable across local development, previews and production.

## SEO / migration

The server includes:

- `/robots.txt`
- `/sitemap.xml`
- canonical metadata
- structured product data
- noindex rules for account, checkout, wishlist, search and admin areas
- 301 redirects for common legacy WordPress-style URLs

Before production DNS cutover, verify every legacy URL that previously received organic traffic and add any missing 301 mapping.

## Release checklist

- Confirm all live product claims and prices.
- Remove placeholder/demo catalogue entries.
- Complete all variant imagery.
- Test successful, failed and duplicate Stripe webhook flows.
- Test fulfilment submission and tracking propagation.
- Test mobile layouts and keyboard navigation.
- Run the SEO and Lighthouse audits.
- Confirm production canonicals and preview noindex headers.
