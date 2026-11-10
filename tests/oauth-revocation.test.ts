import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';

const owner='owner-key-not-used-for-public-client-revocation';
function fixture() {
 let sql='',bindings:unknown[]=[];
 const DB={
  prepare(query:string) {
   sql=query;
   return {
    bind(...values:unknown[]) {
     bindings=values;
     if(query.includes('SELECT id,name,redirect_uris FROM oauth_clients'))
      return {first:async()=>({id:values[0],name:'Test',redirect_uris:'["https://client.example/callback"]'})};
     return {run:async()=>({meta:{changes:1}})};
    }
   };
  }
 } as unknown as D1Database;
 return {DB,sql:()=>sql,bindings:()=>bindings};
}
const clientId='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(43);
function revoke(DB:D1Database,body:string,contentType='application/x-www-form-urlencoded') {
 return handleOAuth(new Request('https://hub.example/oauth/revoke',{
  method:'POST',headers:{'content-type':contentType},body
 }),{DB,MEMORY_API_TOKEN:owner});
}
test('OAuth metadata advertises the revocation endpoint',async()=>{
 const db=fixture();
 const response=await handleOAuth(new Request('https://hub.example/.well-known/oauth-authorization-server'),{DB:db.DB,MEMORY_API_TOKEN:owner});
 assert.equal((await response?.json() as {revocation_endpoint:string}).revocation_endpoint,'https://hub.example/oauth/revoke');
});
test('revoke hashes the supplied token and scopes deletion to its public client',async()=>{
 const db=fixture();
 const response=await revoke(db.DB,new URLSearchParams({client_id:clientId,token}).toString());
 assert.equal(response?.status,200);
 assert.match(db.sql(),/^DELETE FROM oauth_tokens WHERE token_hash=\? AND client_id=\?$/);
 assert.equal(db.bindings()[1],clientId);
 assert.notEqual(db.bindings()[0],token);
 assert.equal(typeof db.bindings()[0],'string');
 assert.equal((db.bindings()[0] as string).length,43);
});
test('malformed or absent tokens are indistinguishable from already revoked tokens',async()=>{
 const db=fixture();
 const response=await revoke(db.DB,new URLSearchParams({client_id:clientId,token:'invalid'}).toString());
 assert.equal(response?.status,200);
 assert.equal(db.sql().startsWith('DELETE'),false);
});
test('revocation rejects missing client identity and unsupported content type',async()=>{
 const db=fixture();
 assert.equal((await revoke(db.DB,new URLSearchParams({token}).toString()))?.status,401);
 assert.equal((await revoke(db.DB,'{}','application/json'))?.status,415);
});
