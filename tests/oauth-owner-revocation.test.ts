import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';
import { issueSession, COOKIE_NAME } from '../src/session';

const secret='owner-test-secret-with-at-least-thirty-two-characters';
function fixture(){
 const queries:string[]=[];
 const DB={
  prepare(sql:string){queries.push(sql);return {bind(){return this},run:async()=>({meta:{changes:1}})}},
  async batch(statements:unknown[]){assert.equal(statements.length,2);return []}
 } as unknown as D1Database;
 return {DB,queries};
}
function request(headers:Record<string,string>={},method='POST'){
 return new Request('https://hub.example/oauth/owner/revoke-all',{method,headers});
}
test('owner revocation rejects missing session and cross-origin POST without database writes',async()=>{
 const db=fixture();
 const noSession=await handleOAuth(request({origin:'https://hub.example'}),{DB:db.DB,MEMORY_API_TOKEN:secret});
 assert.equal(noSession?.status,403);
 const session=await issueSession(secret);
 const wrongOrigin=await handleOAuth(request({origin:'https://evil.example',cookie:`${COOKIE_NAME}=${session}`}),{DB:db.DB,MEMORY_API_TOKEN:secret});
 assert.equal(wrongOrigin?.status,403);
 assert.deepEqual(db.queries,[]);
});
test('owner revocation deletes OAuth tokens and pending codes only',async()=>{
 const db=fixture(),session=await issueSession(secret);
 const response=await handleOAuth(request({origin:'https://hub.example',cookie:`${COOKIE_NAME}=${session}`}),{DB:db.DB,MEMORY_API_TOKEN:secret});
 assert.equal(response?.status,200);
 assert.deepEqual(db.queries,['DELETE FROM oauth_tokens','DELETE FROM oauth_codes']);
 assert.deepEqual(await response?.json(),{revoked:true});
});
test('owner revocation rejects GET',async()=>{
 const db=fixture();
 assert.equal((await handleOAuth(request({},'GET'),{DB:db.DB,MEMORY_API_TOKEN:secret}))?.status,405);
 assert.deepEqual(db.queries,[]);
});
