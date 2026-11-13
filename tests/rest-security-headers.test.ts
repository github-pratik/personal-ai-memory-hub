import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index';

const base = 'https://memory.example';
const env = {MEMORY_API_TOKEN:'a'.repeat(40),DB:{} as D1Database};

test('REST JSON responses do not leak referrers or allow framing',async()=>{
 const response=await worker.fetch(new Request(base+'/health'),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.match(response.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
});

test('REST authentication errors retain security headers',async()=>{
 const response=await worker.fetch(new Request(base+'/v1/memories'),env);
 assert.equal(response.status,401);
 assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 assert.equal(response.headers.get('x-frame-options'),'DENY');
});
