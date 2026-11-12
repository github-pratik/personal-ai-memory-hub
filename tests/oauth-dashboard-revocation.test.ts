import test from 'node:test';
import assert from 'node:assert/strict';
import { handleUi } from '../src/ui';
import { COOKIE_NAME, issueSession } from '../src/session';

const secret='owner-dashboard-revocation-secret-at-least-32-chars';
function fixture(){
 const queries:string[]=[];
 const DB={
  prepare(sql:string){queries.push(sql);return {bind(){return this},run:async()=>({meta:{changes:1}})}},
  async batch(statements:unknown[]){assert.equal(statements.length,2);return []}
 } as unknown as D1Database;
 return {DB,queries};
}
const request=(cookie:string,origin='https://hub.example')=>new Request('https://hub.example/ui/oauth/revoke-all',{
 method:'POST',headers:{origin,cookie}
});
test('dashboard OAuth disconnect requires a valid owner session',async()=>{
 const db=fixture();
 const result=await handleUi(request(''),{DB:db.DB,MEMORY_API_TOKEN:secret},async()=>new Response());
 assert.equal(result?.status,303);
 assert.deepEqual(db.queries,[]);
});
test('dashboard OAuth disconnect rejects cross-origin requests',async()=>{
 const db=fixture(),session=await issueSession(secret);
 const result=await handleUi(request(`${COOKIE_NAME}=${session}`,'https://evil.example'),{DB:db.DB,MEMORY_API_TOKEN:secret},async()=>new Response());
 assert.equal(result?.status,403);
 assert.deepEqual(db.queries,[]);
});
test('dashboard OAuth disconnect delegates to owner revocation and redirects',async()=>{
 const db=fixture(),session=await issueSession(secret);
 const result=await handleUi(request(`${COOKIE_NAME}=${session}`),{DB:db.DB,MEMORY_API_TOKEN:secret},async()=>new Response());
 assert.equal(result?.status,303);
 assert.equal(result?.headers.get('location'),'/');
 assert.deepEqual(db.queries,['DELETE FROM oauth_tokens','DELETE FROM oauth_codes']);
});
test('Cloudflare Access identity alone cannot revoke OAuth tokens',async()=>{
 const db=fixture();
 const result=await handleUi(request(''),{DB:db.DB,MEMORY_API_TOKEN:secret,ACCESS_REQUIRED:'true'},async()=>new Response(),true);
 assert.equal(result?.status,403);
 assert.deepEqual(db.queries,[]);
});
