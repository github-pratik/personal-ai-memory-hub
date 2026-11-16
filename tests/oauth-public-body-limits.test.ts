import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';

const origin='https://hub.example';
const env={DB:{} as D1Database,MEMORY_API_TOKEN:'owner-key-for-test'};

for(const [path,contentType,maxBytes,expectedError] of [
 ['/oauth/register','application/json',5000,'invalid_client_metadata'],
 ['/oauth/token','application/x-www-form-urlencoded',4000,'invalid_request'],
 ['/oauth/revoke','application/x-www-form-urlencoded',4000,'invalid_request']
] as const){
 test(path+' rejects oversized UTF-8 bodies without Content-Length',async()=>{
  const request=new Request(origin+path,{
   method:'POST',headers:{'content-type':contentType},
   body:'é'.repeat(Math.floor(maxBytes/2)+1)
  });
  request.headers.delete('content-length');
  const response=await handleOAuth(request,env);
  assert.equal(response?.status,413);
  assert.equal((await response?.json() as {error:string}).error,expectedError);
 });
 test(path+' rejects oversized streamed bodies before parsing',async()=>{
  let readCount=0;
  const stream=new ReadableStream<Uint8Array>({
   pull(controller){
    readCount++;
    controller.enqueue(new Uint8Array(maxBytes+1));
    controller.close();
   }
  });
  const request=new Request(origin+path,{
   method:'POST',headers:{'content-type':contentType},body:stream,duplex:'half'
  } as RequestInit & {duplex:'half'});
  const response=await handleOAuth(request,env);
  assert.equal(response?.status,413);
  assert.equal(readCount,1);
 });
}
