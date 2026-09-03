import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('serverless entry does not use strict/fatal production env validation at import time',()=>{
  const source=fs.readFileSync(new URL('../../api/index.js',import.meta.url),'utf8');
  assert.match(source,/const envStatus=validateProductionEnv\(\)/);
  assert.doesNotMatch(source,/validateProductionEnv\(\{?[^)]*strict\s*:\s*true/);
});

test('production env validator supports deployed site URL aliases',()=>{
  const source=fs.readFileSync(new URL('../../server/lib/env.js',import.meta.url),'utf8');
  assert.match(source,/VITE_SITE_URL/);
  assert.match(source,/FRONTEND_URL/);
  assert.match(source,/strict=false/);
});
