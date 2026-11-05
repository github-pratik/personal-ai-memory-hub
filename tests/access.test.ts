import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index';

const env={
  DB:{} as D1Database,
  MEMORY_API_TOKEN:'random_very_long_master_token_for_test_1234567',
  ACCESS_REQUIRED:'true',
  ACCESS_ALLOWED_EMAIL:'owner@example.com'
};
const fakeContext=(email:string)=>({access:{getIdentity:async()=>({email})}}) as unknown as ExecutionContext;

test('Access mode fails closed when Access is not enabled upstream',async()=>{
 const res=await worker.fetch(new Request('https://example.test/'),env);
 assert.equal(res.status,403);
});
test('Access mode rejects forged identity headers',async()=>{
 const res=await worker.fetch(new Request('https://example.test/',{headers:{'Cf-Access-Jwt-Assertion':'fake','Cf-Access-Authenticated-User-Email':'owner@example.com'}}),env);
 assert.equal(res.status,403);
});
test('Access mode enforces exact authorized email',async()=>{
 const res=await worker.fetch(new Request('https://example.test/'),env,fakeContext('attacker@example.com'));
 assert.equal(res.status,403);
});
test('Access mode does not accept a configured Access identity without an allowlisted email',async()=>{
 const res=await worker.fetch(new Request('https://example.test/'),{...env,ACCESS_ALLOWED_EMAIL:''},fakeContext('owner@example.com'));
 assert.equal(res.status,403);
});
test('Access mode lets allowlisted user bypass password login form',async()=>{
 const res=await worker.fetch(new Request('https://example.test/login'),env,fakeContext('OWNER@example.com'));
 assert.equal(res.status,303);
 assert.equal(res.headers.get('location'),'/');
});
test('Access mode respects Cloudflare identity failures',async()=>{
 const ctx={access:{getIdentity:async()=>{throw Error('Unauthorized')}}} as unknown as ExecutionContext;
 const res=await worker.fetch(new Request('https://example.test/'),env,ctx);
 assert.equal(res.status,403);
});
test('API tokens remain required for direct private JSON requests',async()=>{
 const res=await worker.fetch(new Request('https://example.test/v1/memories'),env,fakeContext('owner@example.com'));
 assert.equal(res.status,401);
});
