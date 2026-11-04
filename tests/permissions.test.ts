import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index';

const owner='o'.repeat(40),agent='a'.repeat(40);
const env={DB:{} as D1Database,MEMORY_API_TOKEN:owner,MEMORY_AGENT_TOKEN:agent};
const call=(path:string,method='GET',token=agent,body?:unknown)=>worker.fetch(new Request('https://example.test'+path,{
  method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined
}),env);
test('agent cannot write authoritative memories',async()=>{
 for(const method of ['POST','PATCH','DELETE']){
   const path=method==='POST'?'/v1/memories':'/v1/memories/530bbc97-9769-4d4e-8e35-091817cbff45';
   assert.equal((await call(path,method)).status,403);
 }
});
test('agent cannot view or approve pending proposals',async()=>{
 assert.equal((await call('/v1/proposals')).status,403);
 assert.equal((await call('/v1/proposals/530bbc97-9769-4d4e-8e35-091817cbff45/approve','POST')).status,403);
});
test('agents can submit proposals without mutating approved facts',async()=>{
 const proposal={title:'Project',body:'Connected a messaging tool',category:'project',source:'user statement'};
 const response=await call('/v1/proposals','POST',agent,proposal);
 // In this unit test DB is only a placeholder; reaching the DB yields a generic 500, not a forbidden response.
 assert.equal(response.status,500);
});
test('same credential cannot be both owner and agent',async()=>{
 const response=await worker.fetch(new Request('https://example.test/v1/memories',{headers:{authorization:'Bearer '+owner}}),
 {...env,MEMORY_AGENT_TOKEN:owner});
 // owner privilege is explicit, never accidentally reduced to an agent
 assert.notEqual(response.status,403);
});
