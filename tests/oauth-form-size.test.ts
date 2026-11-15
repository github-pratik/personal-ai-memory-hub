import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';

const env={DB:{} as D1Database,MEMORY_API_TOKEN:'owner-key-for-test'};
const origin='https://hub.example';

for(const path of ['/oauth/login','/oauth/authorize']) {
 test(path+' rejects oversized form bodies before authentication or database access',async()=>{
  const response=await handleOAuth(new Request(origin+path,{
   method:'POST',
   headers:{'content-type':'application/x-www-form-urlencoded','origin':origin},
   body:'params='+('a'.repeat(5100))
  }),env);
  assert.equal(response?.status,413);
  assert.deepEqual(await response?.json(),{error:'invalid_request',error_description:'Request too large'});
 });
 test(path+' rejects oversized bodies even when Content-Length is absent',async()=>{
  const request=new Request(origin+path,{
   method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','origin':origin},
   body:'params='+('é'.repeat(2600))
  });
  request.headers.delete('content-length');
  const response=await handleOAuth(request,env);
  assert.equal(response?.status,413);
 });
}
