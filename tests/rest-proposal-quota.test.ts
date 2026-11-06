import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index';

const owner='o'.repeat(40),agent='a'.repeat(40);
const proposal={title:'Synthetic project',body:'Synthetic non-personal test evidence',category:'project',source:'test fixture'};
function harness(count:number){
 let inserted=0;
 const db={
  prepare(sql:string){
   if(sql.includes('COUNT(*)'))return {first:async()=>({count})};
   if(sql.startsWith('INSERT INTO memory_proposals'))return {bind:()=>({run:async()=>{inserted++;}})};
   throw new Error('Unexpected SQL: '+sql);
  }
 } as unknown as D1Database;
 return {
  request:(token:string)=>worker.fetch(new Request('https://example.test/v1/proposals',{
   method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(proposal)
  }),{DB:db,MEMORY_API_TOKEN:owner,MEMORY_AGENT_TOKEN:agent}),
  insertions:()=>inserted
 };
}
test('agent REST proposals stop at 100 pending records without writing',async()=>{
 const h=harness(100),response=await h.request(agent);
 assert.equal(response.status,429);
 assert.match((await response.json() as {error:string}).error,/queue is full/);
 assert.equal(h.insertions(),0);
});
test('agent REST proposals below quota remain pending-only',async()=>{
 const h=harness(99),response=await h.request(agent);
 assert.equal(response.status,201);
 assert.equal((await response.json() as {status:string}).status,'pending');
 assert.equal(h.insertions(),1);
});
test('owner REST proposal path obeys the same quota',async()=>{
 const h=harness(100),response=await h.request(owner);
 assert.equal(response.status,429);
 assert.equal(h.insertions(),0);
});
