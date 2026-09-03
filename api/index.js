import 'dotenv/config';
import {validateProductionEnv} from '../server/lib/env.js';
import {requestId,log,requestContext} from '../server/lib/logger.js';
import {STATIC_SITEMAP_PAGES,KNOWN_STATIC_ROUTES,LEGACY_REDIRECTS,isKnownDynamicRoute} from '../server/lib/site-routes.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { securityHeaders, apiLimiter } from '../server/middleware/security.js';
import apiRouter from '../server/routes/api.js';
import webhookRouter from '../server/routes/webhooks.js';
import { listProducts, getProductBySlug, listJournal, getJournalPost, sitemapRecords } from '../server/services/catalog.js';
import { hasSupabase, supabaseAdmin } from '../server/lib/supabase.js';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Cache template and renderer
let cachedTemplate = null;
let cachedRender = null;

async function getRenderer() {
  if (cachedTemplate && cachedRender) {
    return { template: cachedTemplate, render: cachedRender };
  }
  
  const fs = await import('node:fs');
  const template = await fs.promises.readFile(path.join(root, 'dist/client/index.html'), 'utf8');
  // Keep this import statically discoverable by Vercel's function tracer.
  const { render } = await import('../dist/server/entry-server.js');
  
  cachedTemplate = template;
  cachedRender = render;
  
  return { template, render };
}

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
app.get('/api/healthz',(req,res)=>res.status(200).json({status:'ok'}));
app.get('/api/readyz',async(req,res)=>{
  const ready=hasSupabase();
  let ssrArtifacts=false;
  try{
    const fs=await import('node:fs');
    ssrArtifacts=fs.existsSync(path.join(root,'dist/client/index.html'))&&fs.existsSync(path.join(root,'dist/server/entry-server.js'));
  }catch{}
  return res.status(ready&&ssrArtifacts?200:503).json({
    status:ready&&ssrArtifacts?'ready':'configuration_required',
    supabase:ready,
    ssrArtifacts,
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

// SSR handler
async function bootstrapForUrl(url) {
  if (!hasSupabase()) return { configurationPending: true };
  const u = new URL(url, process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.FRONTEND_URL || 'https://ivyandpearls.co.uk');
  const p = u.pathname;
  if (p === '/') {
    const products = await listProducts({ limit: 16 });
    return { homeProducts: products };
  }
  if (p === '/shop/' || p === '/new-arrivals/' || p === '/the-ivy-edit/' || p === '/most-loved/') {
    return { products: await listProducts({ limit: 48, newArrival: p === '/new-arrivals/', ivyEdit: p === '/the-ivy-edit/' || p === '/most-loved/' }) };
  }
  const collection = p.match(/^\/collections\/([^/]+)\/$/);
  if (collection) return { products: await listProducts({ category: collection[1], limit: 48 }), collectionSlug: collection[1] };
  const product = p.match(/^\/product\/([^/]+)\/$/);
  if(product){
    const item=await getProductBySlug(product[1]);
    return item?{product:item}:{notFound:true};
  }
  if (p === '/journal/') return { posts: await listJournal() };
  const post = p.match(/^\/journal\/([^/]+)\/$/);
  if(post){
    const item=await getJournalPost(post[1]);
    if(item)return {post:item};
    if(['the-art-of-everyday-jewellery','how-to-layer-with-restraint','caring-for-the-pieces-you-wear-most'].includes(post[1]))return {};
    return {notFound:true};
  }
  return KNOWN_STATIC_ROUTES.has(p)||isKnownDynamicRoute(p)?{}:{notFound:true};
}

app.use(async (req, res, next) => {
  try {
    const url = req.originalUrl;
    console.log('[SSR] Request:', url);
    
    const data = await bootstrapForUrl(url).catch(e => {
      console.error('[SSR] Bootstrap error', e);
      return { ssrError: true, error: e.message };
    });
    
    let template;
    let render;
    try{
      ({template,render}=await getRenderer());
    }catch(rendererError){
      console.error('[SSR] Renderer artifacts unavailable; serving resilient client shell.',rendererError);
      // dist/client/index.html is explicitly included in the Vercel function. If
      // only the server renderer is unavailable, keep the storefront online by
      // mounting the client app into an empty #root.
      const fs=await import('node:fs');
      template=await fs.promises.readFile(path.join(root,'dist/client/index.html'),'utf8');
      const bootstrap=`<script>window.__IVY_BOOTSTRAP__=${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
      const shell=template
        .replace('<!--app-head-->','')
        .replace('<!--app-html-->','')
        .replace('<!--bootstrap-->',bootstrap);
      return res.status(data?.notFound?404:200).type('html').send(shell);
    }

    try{
      const result=render(url,data);
      const helmet=result.helmet;
      const head=[
        helmet?.title?.toString()||'',
        helmet?.meta?.toString()||'',
        helmet?.link?.toString()||'',
        helmet?.script?.toString()||''
      ].join('');
      const bootstrap=`<script>window.__IVY_BOOTSTRAP__=${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
      const out=template.replace('<!--app-head-->',head).replace('<!--app-html-->',result.html).replace('<!--bootstrap-->',bootstrap);
      console.log('[SSR] Sending response, status:',result.status||200);
      return res.status(result.status||200).type('html').send(out);
    }catch(renderError){
      console.error('[SSR] Render failed; serving resilient client shell.',renderError);
      const bootstrap=`<script>window.__IVY_BOOTSTRAP__=${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
      const shell=template
        .replace('<!--app-head-->','')
        .replace('<!--app-html-->','')
        .replace('<!--bootstrap-->',bootstrap);
      return res.status(data?.notFound?404:200).type('html').send(shell);
    }
  } catch (e) {
    console.error('[SSR] Error:', e);
    next(e);
  }
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
