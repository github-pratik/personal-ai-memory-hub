import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';

const base='https://hub.example';
const params=new URLSearchParams({
  client_id:'https://grok.com/oauth/mcp-client.json',
  redirect_uri:'https://grok.com/connectors-oauth-exchange-code/',
  response_type:'code',
  code_challenge:'A'.repeat(43),
  code_challenge_method:'S256',
  scope:'memory:read',
  resource:base+'/mcp',
  state:'test'
});
function request(origin=base){
  return new Request(base+'/oauth/login',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded',origin},
    body:new URLSearchParams({params:params.toString(),secret:'wrong-key'}).toString()
  });
}
function fakeDb(changes:number){
  let sql='',args:unknown[]=[];
  const DB={prepare(query:string){
    sql=query;
    return {bind(...values:unknown[]){args=values;return {run:async()=>({meta:{changes}})};}};
  }} as unknown as D1Database;
  return {DB,sql:()=>sql,args:()=>args};
}
test('owner login uses atomic D1 limit before checking a wrong key',async()=>{
  const db=fakeDb(1);
  const response=await handleOAuth(request(),{DB:db.DB,MEMORY_API_TOKEN:'a'.repeat(40)});
  assert.equal(response?.status,200);
  assert.match(await response!.text(),/Sign-in failed/);
  assert.match(db.sql(),/ON CONFLICT\(name\) DO UPDATE/);
  assert.match(db.sql(),/attempts < 20/);
  assert.match(db.sql(),/window_start <= excluded.window_start-600/);
  assert.equal(db.args().length,1);
});
test('exhausted owner login limit returns 429 without checking credentials',async()=>{
  const db=fakeDb(0);
  const response=await handleOAuth(request(),{DB:db.DB,MEMORY_API_TOKEN:'a'.repeat(40)});
  assert.equal(response?.status,429);
  assert.deepEqual(await response?.json(),{error:'slow_down',error_description:'Too many sign-in attempts; retry after ten minutes'});
});
test('cross-origin owner login is rejected before touching D1',async()=>{
  const db=fakeDb(1);
  const response=await handleOAuth(request('https://attacker.example'),{DB:db.DB,MEMORY_API_TOKEN:'a'.repeat(40)});
  assert.equal(response?.status,403);
  assert.equal(db.sql(),'');
});
