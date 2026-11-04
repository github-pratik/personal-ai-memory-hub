import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index';

const token='a'.repeat(40);
const env={MEMORY_API_TOKEN:token,DB:{} as D1Database};

test('health check reveals no personal data', async()=>{
 const response=await worker.fetch(new Request('https://example.test/health'),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{status:'ok',service:'personal-ai-memory-hub',version:'0.2.0'});
});
test('anonymous memory requests fail closed',async()=>{
 for(const path of ['/v1/memories','/v1/proposals','/v1/memories/530bbc97-9769-4d4e-8e35-091817cbff45']){
   const response=await worker.fetch(new Request('https://example.test'+path),env);
   assert.equal(response.status,401);
 }
});
test('wrong token cannot access memory',async()=>{
 const response=await worker.fetch(new Request('https://example.test/v1/memories',{headers:{authorization:'Bearer wrong'}}),env);
 assert.equal(response.status,401);
});
test('protected routes reject absent secret configuration',async()=>{
 const response=await worker.fetch(new Request('https://example.test/v1/memories',{headers:{authorization:'Bearer '+token}}),{...env,MEMORY_API_TOKEN:''});
 assert.equal(response.status,401);
});
test('rejects malformed IDs before database access',async()=>{
 const response=await worker.fetch(new Request('https://example.test/v1/memories/not-a-uuid',{headers:{authorization:'Bearer '+token}}),env);
 assert.equal(response.status,400);
});
test('rejects overly long search queries before database access',async()=>{
 const response=await worker.fetch(new Request('https://example.test/v1/memories?q='+('x'.repeat(201)),{headers:{authorization:'Bearer '+token}}),env);
 assert.equal(response.status,400);
});
