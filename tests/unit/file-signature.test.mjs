import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedImage} from '../../server/lib/file-signature.js';
test('accepts valid image signatures',()=>{
  assert.equal(isAllowedImage(Buffer.from([0xff,0xd8,0xff,0x00]),'image/jpeg'),true);
  assert.equal(isAllowedImage(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),'image/png'),true);
  assert.equal(isAllowedImage(Buffer.from('RIFF0000WEBP'),'image/webp'),true);
});
test('rejects disguised files',()=>assert.equal(isAllowedImage(Buffer.from('<script>'),'image/jpeg'),false));
