
insert into public.journal_posts
(slug,title,excerpt,body_html,seo_title,seo_description,published_at,status)
values
(
 'the-art-of-everyday-jewellery',
 'The art of everyday jewellery',
 'Why the pieces you reach for most often are usually the ones that ask the least of you.',
 '<p>Everyday jewellery should settle into the rhythm of getting dressed rather than compete with it. The most successful pieces are often the ones that bring balance, light and a small point of distinction without requiring an occasion.</p><h2>Start with proportion</h2><p>Think about how a piece sits against the neckline, hand or ear. A considered proportion can do more than excessive detail. The aim is ease: something that works with a white shirt, knitwear, tailoring and the pieces already in your wardrobe.</p><h2>Build a personal uniform</h2><p>There is value in repetition. Wearing the same ring, pendant or pair of earrings often is not a lack of imagination; it is how a signature begins.</p>',
 'The Art of Everyday Jewellery | Ivy & Pearls',
 'A considered guide to choosing jewellery that works naturally as part of everyday dressing.',
 '2026-08-01T09:00:00Z','published'
),
(
 'how-to-layer-with-restraint',
 'How to layer with restraint',
 'A simple approach to necklaces, bracelets and rings that keeps the result intentional.',
 '<p>Layering works best when there is a clear hierarchy. Choose one piece to lead, then let the others support it.</p><h2>Vary scale before quantity</h2><p>A fine chain beside a slightly stronger pendant creates more interest than several pieces of equal weight. The same principle applies to rings and bracelets.</p><h2>Leave space</h2><p>Negative space is part of the styling. A gap between pieces allows each detail to register and keeps the overall effect calm.</p>',
 'How to Layer Jewellery With Restraint | Ivy & Pearls',
 'How to layer necklaces, rings and bracelets while keeping the result balanced and intentional.',
 '2026-07-18T09:00:00Z','published'
),
(
 'caring-for-the-pieces-you-wear-most',
 'Caring for the pieces you wear most',
 'Small habits that help jewellery stay considered in everyday use.',
 '<p>Jewellery is exposed to skin, fragrance, moisture and the surfaces of everyday life. A few simple habits can help preserve its appearance.</p><h2>Last on, first off</h2><p>Put jewellery on after perfume and cosmetics have settled, and remove it before showering, sleeping or exercising unless the product instructions specifically say otherwise.</p><h2>Store pieces separately</h2><p>Soft individual storage reduces scratching and tangling. Wipe pieces gently after wear with a clean soft cloth.</p>',
 'Jewellery Care for Everyday Pieces | Ivy & Pearls',
 'Simple jewellery care habits for the rings, earrings, necklaces and bracelets you wear most often.',
 '2026-06-30T09:00:00Z','published'
)
on conflict (slug) do update set
 title=excluded.title,excerpt=excluded.excerpt,body_html=excluded.body_html,
 seo_title=excluded.seo_title,seo_description=excluded.seo_description,
 published_at=excluded.published_at,status=excluded.status;
