import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vercel=JSON.parse(fs.readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
const api=fs.readFileSync(new URL('../../api/index.js',import.meta.url),'utf8');

test('Vercel deploy builds only the client storefront and does not bundle SSR artifacts',()=>{
  assert.equal(vercel.buildCommand,'npm run build:client');
  assert.equal(vercel.outputDirectory,'dist/client');
  assert.ok(!JSON.stringify(vercel).includes('dist/server'));
});

test('storefront catch-all is static and serverless function has no SSR renderer dependency',()=>{
  const rewrites=vercel.rewrites||[];
  assert.ok(rewrites.some(r=>r.source==='/:path*'&&r.destination==='/index.html'));
  assert.doesNotMatch(api,/entry-server\.js|getRenderer\(|renderToString/);
});
