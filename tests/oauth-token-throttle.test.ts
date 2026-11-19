import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';

const base='https://hub.example';
function request(body='grant_type=invalid') {
  return new Request(base+'/oauth/token',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body
  });
}
function fakeDb(changes:number) {
  let sql='',calls=0;
  const DB={prepare(query:string){
    sql=query;calls++;
    return {bind(){return {run:async()=>({meta:{changes}})};}};
  }} as unknown as D1Database;
  return {DB,sql:()=>sql,calls:()=>calls};
}
const key='a'.repeat(40);
test('token endpoint counts malformed grants using an atomic global limit',async()=>{
  const db=fakeDb(1);
  const response=await handleOAuth(request(),{DB:db.DB,MEMORY_API_TOKEN:key});
  assert.equal(response?.status,400);
  assert.equal((await response?.json() as {error:string}).error,'unsupported_grant_type');
  assert.match(db.sql(),/VALUES \('token_exchange',\?,1\)/);
  assert.match(db.sql(),/ON CONFLICT\(name\) DO UPDATE/);
  assert.match(db.sql(),/attempts < 100/);
  assert.equal(db.calls(),1);
});
test('exhausted token exchange quota rejects before grant processing',async()=>{
  const db=fakeDb(0);
  const response=await handleOAuth(request(),{DB:db.DB,MEMORY_API_TOKEN:key});
  assert.equal(response?.status,429);
  assert.deepEqual(await response?.json(),{error:'slow_down',error_description:'Too many token requests; retry later'});
  assert.equal(db.calls(),1);
});
test('oversized token body is rejected before touching D1',async()=>{
  const db=fakeDb(1);
  const response=await handleOAuth(request('x'.repeat(4001)),{DB:db.DB,MEMORY_API_TOKEN:key});
  assert.equal(response?.status,413);
  assert.equal(db.calls(),0);
});
