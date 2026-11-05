import test from 'node:test';
import assert from 'node:assert/strict';
import {validFormOrigin} from '../src/session';
import worker from '../src/index';

const base='https://personal-ai-memory-hub.p-pshpatil.workers.dev';
const env={MEMORY_API_TOKEN:'a'.repeat(40),DB:{} as D1Database};

test('same-origin Origin header permits browser POST',()=>{
 assert.equal(validFormOrigin(new Request(base+'/login',{method:'POST',headers:{origin:base}})),true);
});
test('same-origin Referer permits browser POST without Origin',()=>{
 assert.equal(validFormOrigin(new Request(base+'/login',{method:'POST',headers:{referer:base+'/login'}})),true);
});
test('missing Origin and Referer are rejected',()=>{
 assert.equal(validFormOrigin(new Request(base+'/login',{method:'POST'})),false);
});
test('cross-origin and malformed sources are rejected',()=>{
 for(const headers of ([
  {origin:'https://evil.example'},
  {origin:'null',referer:base+'/login'},
  {referer:'https://evil.example/form'},
  {referer:'invalid'},
  {origin:'https://evil.example',referer:base+'/login'}
 ] as Record<string,string>[])){
  assert.equal(validFormOrigin(new Request(base+'/login',{method:'POST',headers})),false);
 }
});
test('login page sends referrer only to same origin',async()=>{
 const response=await worker.fetch(new Request(base+'/login'),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('referrer-policy'),'same-origin');
 assert.match(await response.text(),/Private access key/);
});
test('cross-origin login POST remains blocked',async()=>{
 const form=new FormData();form.set('secret','a'.repeat(40));
 const response=await worker.fetch(new Request(base+'/login',{method:'POST',headers:{origin:'https://evil.example'},body:form}),env);
 assert.equal(response.status,403);
});
