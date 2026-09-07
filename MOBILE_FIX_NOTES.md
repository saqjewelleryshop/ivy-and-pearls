# Ivy & Pearls mobile repair

This pass restores the compact mobile/app-like storefront experience without changing the desktop visual direction.

## Fixed
- Restored the missing responsive navigation behaviour and added a proper full-height mobile menu.
- Kept the mobile header compact, sticky and touch-friendly.
- Prevented route changes/menu state from leaving the mobile menu open; Escape closes it and body scroll is locked while open.
- Restored phone/tablet grid collapse for products, collections, editorial pages, checkout, account and admin views.
- Fixed the newsletter mobile layout that had incorrectly remained two-column.
- Fixed editorial/contact pages that were retaining desktop columns on mobile.
- Reworked mobile editorial gallery into a swipeable scroll-snap row.
- Normalised mobile spacing, type scale, touch targets, product cards, footer, legal pages, FAQ, journal, wishlist and authentication views.
- Preserved the variant-image behaviour: selecting a variant changes the main image without adding the variant image to the thumbnail strip; tapping a normal thumbnail still works.
- Added a working `/search/` route and mobile Search menu entry.
- Renamed `Wshlist.jsx` to `Wishlist.jsx` and corrected the import.
- Removed the unnecessary Vite `/media` proxy because Express already serves `/media/:filename` on the app server.
- Added a tablet bridge for 821–1000px so iPad-sized layouts no longer remain squeezed desktop layouts.

## Verification performed
- CSS parsed with zero stylesheet parse errors.
- Server-side JavaScript syntax checks passed for the main server, API routes, webhooks, catalogue and order services.
- All relative `src/` imports were checked; no missing local imports were found.
- Responsive layout smoke tests were run at 320px, 390px, 430px and 768px using representative storefront, PDP, editorial, auth, checkout, account, FAQ and wishlist structures.
- All tested responsive views reported `scrollWidth === clientWidth` (no horizontal page overflow).

The project should still be run through its normal `npm install` / `npm run build` pipeline in the deployment environment because this workspace could not complete a full dependency install from npm.
