import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { securityHeaders, apiLimiter } from './middleware/security.js';
import apiRouter from './routes/api.js';
import webhookRouter from './routes/webhooks.js';
import { listProducts, getProductBySlug, listJournal, getJournalPost, sitemapRecords } from './services/catalog.js';
import { hasSupabase, supabaseAdmin } from './lib/supabase.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const isProd=process.env.NODE_ENV==='production';
const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(securityHeaders);
app.use(compression());
app.use(cookieParser());

app.use('/api/webhooks',express.raw({type:'application/json',limit:'1mb'}),webhookRouter);

// Short branded media URLs: /media/:filename → Supabase public URL
app.get('/media/:filename',async(req,res,next)=>{
  try{
    const filename=String(req.params.filename||'');
    if(!filename||filename.includes('/')||filename.includes('\\')||filename.includes('..')){
      return res.status(400).send('Invalid media filename.');
    }
    const db=supabaseAdmin();
    const storagePath=`media-library/${filename}`;
    const {data}=db.storage.from('product-media').getPublicUrl(storagePath);
    const publicUrl=data?.publicUrl;
    if(!publicUrl){
      return res.status(404).send('Media not found.');
    }
    return res.redirect(302,publicUrl);
  }catch(error){
    next(error);
  }
});

app.use('/api',apiLimiter,express.json({limit:'500kb'}),apiRouter);

app.get('/robots.txt',(req,res)=>{
  const site=(process.env.SITE_URL||'https://ivyandpearls.co.uk').replace(/\/$/,'');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /account/\nDisallow: /checkout/\nDisallow: /api/\nSitemap: ${site}/sitemap.xml\n`);
});

app.get('/sitemap.xml',async(req,res,next)=>{
  try{
    const site=(process.env.SITE_URL||'https://ivyandpearls.co.uk').replace(/\/$/,'');
    const staticPages=['/','/shop/','/collections/','/new-arrivals/','/the-ivy-edit/','/our-story/','/journal/','/contact/','/delivery-returns/','/faqs/','/privacy-policy/','/terms/','/cookies/','/accessibility/'];
    let records={products:[],posts:[]};
    if(hasSupabase()) records=await sitemapRecords();
    const urls=[
      ...staticPages.map(loc=>({loc,lastmod:new Date().toISOString()})),
      ...records.products.map(p=>({loc:`/product/${p.slug}/`,lastmod:p.updated_at})),
      ...records.posts.map(p=>({loc:`/journal/${p.slug}/`,lastmod:p.updated_at}))
    ];
    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${site}${u.loc}</loc><lastmod>${new Date(u.lastmod).toISOString()}</lastmod></url>`).join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  }catch(e){next(e);}
});

async function bootstrapForUrl(url){
  if(!hasSupabase()) return {configurationPending:true};
  const u=new URL(url,'https://ivyandpearls.co.uk');
  const p=u.pathname;
  if(p==='/'){
    const products=await listProducts({limit:16});
    return {homeProducts:products};
  }
  if(p==='/shop/'||p==='/new-arrivals/'||p==='/the-ivy-edit/'||p==='/most-loved/'){
    return {products:await listProducts({limit:48,newArrival:p==='/new-arrivals/',ivyEdit:p==='/the-ivy-edit/'||p==='/most-loved/'})};
  }
  const collection=p.match(/^\/collections\/([^/]+)\/$/);
  if(collection)return {products:await listProducts({category:collection[1],limit:48}),collectionSlug:collection[1]};
  const product=p.match(/^\/product\/([^/]+)\/$/);
  if(product)return {product:await getProductBySlug(product[1])};
  if(p==='/journal/')return {posts:await listJournal()};
  const post=p.match(/^\/journal\/([^/]+)\/$/);
  if(post)return {post:await getJournalPost(post[1])};
  return {};
}

let vite;
let template;
let render;
if(!isProd){
  const {createServer}=await import('vite');
  vite=await createServer({server:{middlewareMode:true},appType:'custom'});
  app.use(vite.middlewares);
}else{
  app.use('/assets',express.static(path.join(root,'dist/client/assets'),{immutable:true,maxAge:'1y'}));
  app.use(express.static(path.join(root,'dist/client'),{maxAge:'1h',index:false}));
  template=await fs.readFile(path.join(root,'dist/client/index.html'),'utf8');
  ({render}=await import(path.join(root,'dist/server/entry-server.js')));
}

app.use(async(req,res,next)=>{
  try{
    const url=req.originalUrl;
    const data=await bootstrapForUrl(url).catch(e=>{
      console.error('SSR bootstrap error',e);
      return {ssrError:true};
    });
    let htmlTemplate,renderer;
    if(!isProd){
      htmlTemplate=await fs.readFile(path.join(root,'index.html'),'utf8');
      htmlTemplate=await vite.transformIndexHtml(url,htmlTemplate);
      ({render:renderer}=await vite.ssrLoadModule('/src/entry-server.jsx'));
    }else{
      htmlTemplate=template;renderer=render;
    }
    const result=renderer(url,data);
    const helmet=result.helmet;
    const head=[
      helmet?.title?.toString()||'',
      helmet?.meta?.toString()||'',
      helmet?.link?.toString()||'',
      helmet?.script?.toString()||''
    ].join('');
    const bootstrap=`<script>window.__IVY_BOOTSTRAP__=${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
    const out=htmlTemplate.replace('<!--app-head-->',head).replace('<!--app-html-->',result.html).replace('<!--bootstrap-->',bootstrap);
    res.status(result.status||200).type('html').send(out);
  }catch(e){
    if(vite)vite.ssrFixStacktrace(e);
    next(e);
  }
});

app.use((err,req,res,next)=>{
  console.error(err);
  if(res.headersSent)return next(err);
  const status=err.status||(['ZodError'].includes(err.name)?400:500);
  const message=status>=500?'Something went wrong. Please try again.':err.message;
  if(req.path.startsWith('/api/'))res.status(status).json({error:message});
  else res.status(status).send(message);
});

const port=Number(process.env.PORT||5173);
app.listen(port,()=>console.log(`Ivy & Pearls running on http://localhost:${port}`));
