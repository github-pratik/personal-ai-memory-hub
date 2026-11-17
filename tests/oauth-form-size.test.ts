import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';
import { COOKIE_NAME, issueSession } from '../src/session';

const secret='owner-key-for-test-that-is-at-least-32-characters';
const env={DB:{} as D1Database,MEMORY_API_TOKEN:secret};
const origin='https://hub.example';
const query=new URLSearchParams({
 client_id:'https://grok.com/oauth/mcp-client.json',
 redirect_uri:'https://grok.com/connectors-oauth-exchange-code/',
 response_type:'code',
 code_challenge:'a'.repeat(43),
 code_challenge_method:'S256',
 resource:origin+'/mcp',
 scope:'memory:read'
});

for(const path of ['/oauth/login','/oauth/authorize']) {
 for(const [label,body] of [
  ['ASCII','params='+('a'.repeat(5100))],
  ['UTF-8 without Content-Length','params='+('é'.repeat(2600))]
 ]){
  test(path+' rejects oversized '+label+' form bodies before database access',async()=>{
   const headers:Record<string,string>={
    'content-type':'application/x-www-form-urlencoded',
    origin
   };
   if(path==='/oauth/authorize')headers.cookie=COOKIE_NAME+'='+await issueSession(secret);
   const request=new Request(origin+path+(path==='/oauth/authorize'?'?'+query.toString():''),{
    method:'POST',headers,body
   });
   if(label.includes('without'))request.headers.delete('content-length');
   const response=await handleOAuth(request,env);
   assert.equal(response?.status,413);
   assert.deepEqual(await response?.json(),{error:'invalid_request',error_description:'Request too large'});
  });
 }
}

test('unauthenticated consent rejects before reading the body',async()=>{
 const response=await handleOAuth(new Request(origin+'/oauth/authorize?'+query.toString(),{
  method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},
  body:'params='+('a'.repeat(5100))
 }),env);
 assert.equal(response?.status,403);
 assert.equal((await response?.json() as {error:string}).error,'access_denied');
});
