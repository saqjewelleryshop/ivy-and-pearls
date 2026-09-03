export const STATIC_SITEMAP_PAGES=[
  '/','/shop/','/collections/','/collections/rings/','/collections/necklaces/','/collections/earrings/','/collections/bracelets/',
  '/new-arrivals/','/the-ivy-edit/','/our-story/','/journal/','/contact/','/delivery-returns/','/faqs/',
  '/size-guide/','/jewellery-care/','/materials/','/private-client/','/privacy-policy/','/terms/','/cookies/','/accessibility/','/security/'
];
export const KNOWN_STATIC_ROUTES=new Set([
  '/collections/','/checkout/','/order-confirmed/','/login/','/register/','/forgot-password/','/reset-password/',
  '/account/','/account/addresses/','/our-story/','/contact/','/delivery-returns/','/faqs/','/size-guide/',
  '/jewellery-care/','/materials/','/private-client/','/privacy-policy/','/terms/','/cookies/','/accessibility/',
  '/security/','/admin/','/wishlist/','/search/'
]);
export const LEGACY_REDIRECTS=new Map([
  ['/terms-conditions/','/terms/'],['/terms-and-conditions/','/terms/'],['/shipping-returns/','/delivery-returns/'],
  ['/shipping-and-returns/','/delivery-returns/'],['/returns-refunds/','/delivery-returns/'],['/returns/','/delivery-returns/'],
  ['/about-us/','/our-story/'],['/contact-us/','/contact/'],['/ring-size-guide/','/size-guide/'],['/care-guide/','/jewellery-care/']
]);
export function isKnownDynamicRoute(pathname){return /^\/account\/orders\/[^/]+\/$/.test(pathname)||/^\/admin\/preview\/product\/[^/]+\/$/.test(pathname);}
