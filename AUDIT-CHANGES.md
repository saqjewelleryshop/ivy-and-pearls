# Ivy & Pearls storefront audit changes

Updated 7 September 2026.

## Mobile UX
- Chat widget is desktop-only and is not loaded at <=800px.
- Added a functioning mobile navigation drawer with body scroll lock and Escape-to-close.
- Added Search to the mobile menu and a real `/search/` page.
- Tightened mobile typography, spacing, product cards, shop filters, PDP purchase controls, footer and cookie sheet.
- Changed the editorial gallery to a touch-friendly horizontal snap gallery on mobile.
- Kept account and bag in the mobile header; Search and Saved remain available in the menu.

## Product UX
- Variant image remains the main image when an option is selected but is not added to the thumbnail strip.
- Added `aria-pressed` to variant buttons.
- Removed temporary Product.jsx debug logging.
- Variable products now show “View options” instead of incorrectly quick-adding the first variant.

## Search / navigation
- Added `/search/` with debounced catalogue search and noindex metadata.
- Fixed the Wishlist filename typo (`Wshlist.jsx` -> `Wishlist.jsx`).
- Route navigation already uses ScrollToTop.

## SEO / legacy migration
- Added permanent redirects for legacy WordPress category URLs and `/terms-conditions/`.
- Added collection landing pages to the sitemap.
- Expanded robots exclusions for account/auth/checkout/search/wishlist/order confirmation routes.
- Vercel now routes media, robots, sitemap and dynamic product/collection/journal pages through the serverless app where required.

## Legal/content hygiene
- Privacy, Terms and Cookie pages already describe the current Stripe/Supabase/ZQ architecture rather than WooCommerce.
- Updated legal-page review date to 7 September 2026.

## Media
- Retained relative `/media/...` URLs for environment-independent product/variant imagery.
