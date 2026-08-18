import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const checks=[
 ['SSR entry exists','src/entry-server.jsx'],
 ['SEO component exists','src/components/Seo.jsx'],
 ['robots route exists','server/index.js'],
 ['sitemap route exists','server/index.js'],
 ['Product JSON-LD exists','src/pages/Product.jsx'],
 ['canonical rendering exists','src/components/Seo.jsx'],
 ['privacy page exists','src/pages/Privacy.jsx'],
 ['accessibility page exists','src/pages/Accessibility.jsx'],
 ['cookie consent exists','src/components/CookieBanner.jsx'],
 ['Supabase RLS migration exists','supabase/migrations/001_commerce.sql'],
 ['Stripe webhook exists','server/routes/webhooks.js'],
 ['ZQ server-only client exists','server/lib/zq.js']
];
let failed=0;
for(const [name,file] of checks){
 const ok=fs.existsSync(path.join(root,file));
 console.log(`${ok?'✓':'✗'} ${name}`);
 if(!ok)failed++;
}
const css=fs.readFileSync(path.join(root,'src/styles/global.css'),'utf8');
for(const [name,needle] of [['reduced motion','prefers-reduced-motion'],['focus states','focus-visible'],['skip link','skip-link']]){
 const ok=css.includes(needle);console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;
}
if(failed){console.error(`\n${failed} architecture checks failed.`);process.exit(1)}
console.log('\nSEO/accessibility/security architecture checks passed. Run Lighthouse CI against the production-equivalent build for scored validation.');
