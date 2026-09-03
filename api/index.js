import 'dotenv/config';
import {validateProductionEnv} from '../server/lib/env.js';
import {requestId,log,requestContext} from '../server/lib/logger.js';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { securityHeaders, apiLimiter } from '../server/middleware/security.js';
import apiRouter from '../server/routes/api.js';
import webhookRouter from '../server/routes/webhooks.js';
import { hasSupabase, supabaseAdmin } from '../server/lib/supabase.js';
import {STATIC_SITEMAP_PAGES,LEGACY_REDIRECTS} from '../server/lib/site-routes.js';
import { sitemapRecords } from '../server/services/catalog.js';

// Create Express app for function
const envStatus=validateProductionEnv();
if(!envStatus.ok){
  console.warn('[config] Production configuration issues:', envStatus.issues.join('; '));
}
const app = express();
app.use(requestId);
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(compression());
app.use(cookieParser());
app.use((req,res,next)=>{const started=Date.now();res.on('finish',()=>log('info','request.completed',{...requestContext(req),status:res.statusCode,durationMs:Date.now()-started}));next();});
app.use((req,res,next)=>{
  if(String(req.hostname||'').endsWith('.vercel.app')){
    res.setHeader('X-Robots-Tag','noindex, nofollow');
  }
  next();
});

const legacyRedirects=LEGACY_REDIRECTS;
app.use((req,res,next)=>{
  const direct=legacyRedirects.get(req.path);
  if(direct)return res.redirect(301,direct);
  const legacyCategory=req.path.match(/^\/product-category\/(rings|necklaces|earrings|bracelets)\/?$/i);
  if(legacyCategory)return res.redirect(301,`/collections/${legacyCategory[1].toLowerCase()}/`);
  next();
});

// Webhook route (must be before json parser)
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '1mb' }), webhookRouter);

// Media redirect route
app.get('/media/:filename', async (req, res, next) => {
  try {
    const filename = String(req.params.filename || '');
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return res.status(400).send('Invalid media filename.');
    }
    const db = supabaseAdmin();
    const storagePath = `media-library/${filename}`;
    const { data } = db.storage.from('product-media').getPublicUrl(storagePath);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      return res.status(404).send('Media not found.');
    }
    return res.redirect(302, publicUrl);
  } catch (error) {
    next(error);
  }
});

// API routes
app.use('/api', apiLimiter, express.json({ limit: '500kb' }), apiRouter);

// Static files (robots.txt, sitemap.xml)
app.get('/healthz',(req,res)=>res.status(200).json({status:'ok'}));
app.get('/readyz',(req,res)=>{
  const ready=hasSupabase();
  return res.status(ready?200:503).json({
    status:ready?'ready':'configuration_required',
    supabase:ready,
    configuration:envStatus.ok?'ok':'incomplete',
    configurationIssues:envStatus.issues
  });
});

app.get('/robots.txt', (req, res) => {
  const site = (process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.FRONTEND_URL || 'https://ivyandpearls.co.uk').replace(/\/$/, '');
  res.set('Cache-Control','public, max-age=3600').type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /account/\nDisallow: /checkout/\nDisallow: /wishlist/\nDisallow: /search/\nDisallow: /login/\nDisallow: /register/\nDisallow: /forgot-password/\nDisallow: /reset-password/\nDisallow: /order-confirmed/\nDisallow: /api/\nSitemap: ${site}/sitemap.xml\n`);
});

app.get('/.well-known/security.txt',(req,res)=>{
  const site=(process.env.SITE_URL||process.env.VITE_SITE_URL||process.env.FRONTEND_URL||'https://ivyandpearls.co.uk').replace(/\/$/,'');
  res.type('text/plain').set('Cache-Control','public, max-age=86400').send(`Contact: mailto:clientcare@ivyandpearls.co.uk\nPreferred-Languages: en\nCanonical: ${site}/.well-known/security.txt\nPolicy: ${site}/security/\n`);
});

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const site = (process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.FRONTEND_URL || 'https://ivyandpearls.co.uk').replace(/\/$/, '');
    const staticPages=STATIC_SITEMAP_PAGES;
    let records = { products: [], posts: [] };
    if (hasSupabase()) records = await sitemapRecords();
    const urls = [
      ...staticPages.map(loc => ({ loc })),
      ...records.products.map(p => ({ loc: `/product/${p.slug}/`, lastmod: p.updated_at })),
      ...records.posts.map(p => ({ loc: `/journal/${p.slug}/`, lastmod: p.updated_at })),
      ...['the-art-of-everyday-jewellery','how-to-layer-with-restraint','caring-for-the-pieces-you-wear-most'].filter(slug=>!records.posts.some(p=>p.slug===slug)).map(slug=>({loc:`/journal/${slug}/`,lastmod:'2026-09-03T00:00:00Z'}))
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${site}${u.loc}</loc>${u.lastmod?`<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>`:''}</url>`).join('\n')}\n</urlset>`;
    res.set('Cache-Control','public, max-age=3600, stale-while-revalidate=86400').type('application/xml').send(xml);
  } catch (e) {
    next(e);
  }
});

// Client-side config endpoint — exposes only frontend-safe env vars
app.get('/api/config', (req, res) => {
  const config = {
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    siteUrl: process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.FRONTEND_URL,
  };
  // Reject if critical client config is missing
  if (!config.supabaseUrl || !config.supabaseKey) {
    return res.status(503).json({ error: 'Client configuration incomplete', issues: envStatus.issues });
  }
  return res.status(200).json(config);
});

// Storefront pages are served by Vercel's static Vite output.
// This function intentionally handles APIs and machine-readable endpoints only.
app.use((req,res,next)=>{
  if(req.path.startsWith('/api/')) return next();
  return res.status(404).json({error:'Not found'});
});

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  if (res.headersSent) return next(err);
  const status = err.status || (['ZodError'].includes(err.name) ? 400 : 500);
  const message = status >= 500 ? 'Something went wrong. Please try again.' : err.message;
  if (req.path.startsWith('/api/')) {
    res.status(status).json({ error: message });
  } else {
    res.status(status).send(message);
  }
});

// Vercel serverless handler
export default async (req, res) => {
  console.log('[Vercel] Incoming request:', req.method, req.url);
  
  // Handle the request using Express
  app(req, res);
};
