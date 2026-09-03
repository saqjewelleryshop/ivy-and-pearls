# Ivy & Pearls — Production Audit Changes

Updated 3 September 2026.

## Storefront and UX
- Added reliable route scroll-to-top behaviour.
- Added a working Search page and connected the header search icon.
- Added wishlist count in the header and a direct product-by-ID wishlist API.
- Variable products now use **View options** instead of adding the first variant blindly.
- Variant images switch the main PDP image without appearing as extra thumbnails.
- Normal gallery thumbnails remain selectable after a variant image is shown.
- Variant controls expose selection state with `aria-pressed`.
- Cart drawer now uses the selected variant image where available, supports Escape-to-close, improves labels and restores focus.
- Added restrained reveal, image-scale and button motion with full `prefers-reduced-motion` support.

## Media
- Admin → Media remains the upload source of truth.
- Media records use portable branded `/media/...` paths.
- Product media accepts both branded `/media/...` paths and external HTTPS image URLs.
- Customer/admin-facing source labels use **international partner** terminology.

## Brand language
- Removed customer/admin-facing references to provider brand names and country-of-origin sourcing language.
- Reframed sourcing and fulfilment copy around selected **international partners**.
- Internal legacy integration/database identifiers remain unchanged where renaming them would break existing Supabase records, orders or fulfilment mappings.

## SEO and migration
- Added noindex response headers for `*.vercel.app` preview deployments.
- Expanded robots exclusions for admin/account/checkout/wishlist/search/auth/order-confirmed paths.
- Added collection URLs and curated fallback journal URLs to the sitemap.
- Added 301 redirects for common legacy terms, about, contact, returns and product-category URLs.
- Fixed 404 response status handling for genuinely unknown SSR routes and missing products/articles.
- Added variant images to Product structured-data image arrays.
- Added presentation cleanup for two known supplier-style product titles.
- Updated Vercel routing so filesystem assets are served directly and application routes reach the SSR function.

## Legal / trust copy
- Reworked Privacy, Terms, Delivery & Returns and Our Story wording for the current React/Supabase/Stripe/international-partner architecture.
- Removed obsolete fulfilment-provider naming from customer-facing legal copy.
- Added clearer international-transfer, cancellation, returns and faulty-goods wording.
- Footer now states registration in England & Wales and company number.

## Validation
- `npm run check` passes for server-side JavaScript syntax.
- A full Vite production build could not be executed in the artifact environment because project dependencies were not available locally and package installation timed out. Run `npm ci && npm run build` in CI/Vercel before deployment.

## Live-data review still required
The ZIP cannot safely mutate catalogue records that live only in your Supabase project. Before launch, review any high-value or placeholder products in Admin and verify material, stone, hallmark/certification, pricing and fulfilment claims before publishing.
