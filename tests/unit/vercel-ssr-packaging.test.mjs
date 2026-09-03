import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vercel=JSON.parse(fs.readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
const api=fs.readFileSync(new URL('../../api/index.js',import.meta.url),'utf8');

test('Vercel function explicitly includes built SSR artifacts',()=>{
  const cfg=vercel.functions?.['api/index.js'];
  assert.ok(cfg,'api/index.js function configuration must exist');
  const include=Array.isArray(cfg.includeFiles)?cfg.includeFiles:[cfg.includeFiles].filter(Boolean);
  assert.ok(include.some(x=>String(x).includes('dist/client/index.html')));
  assert.ok(include.some(x=>String(x).includes('dist/server')));
});

test('serverless SSR uses traceable renderer import and resilient client-shell fallback',()=>{
  assert.match(api,/import\('\.\.\/dist\/server\/entry-server\.js'\)/);
  assert.match(api,/serving resilient client shell/i);
  assert.match(api,/replace\('\<\!--app-html--\>',''\)/);
});
