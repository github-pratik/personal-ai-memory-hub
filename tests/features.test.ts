import test from 'node:test';
import assert from 'node:assert/strict';
import { COOKIE_NAME, getCookie, issueSession, validFormOrigin, verifySession } from '../src/session';
import { escapeHtml } from '../src/ui';
import { rankEvidence, keywords } from '../src/relevance';
import worker from '../src/index';

const secret='super_secure_owner_key_at_least_40_chars_12345';
test('signed browser session expires and detects tampering',async()=>{
 const at=Date.parse('2026-11-04T15:00:00Z'),cookie=await issueSession(secret,at);
 assert.equal(await verifySession(cookie,secret,at+1000),true);
 assert.equal(await verifySession(cookie,secret,at+13*60*60*1000),false);
 assert.equal(await verifySession(cookie+'x',secret,at),false);
 assert.equal(await verifySession(cookie,'another_password_that_is_long_enough_333333',at),false);
 assert.equal(getCookie('x=abc; '+COOKIE_NAME+'='+cookie,COOKIE_NAME),cookie);
});
test('blocks forged cross-origin browser forms',()=>{
 const good=new Request('https://private.example/login',{method:'POST',headers:{origin:'https://private.example'}});
 const bad=new Request('https://private.example/login',{method:'POST',headers:{origin:'https://attacker.example'}});
 assert.equal(validFormOrigin(good),true);
 assert.equal(validFormOrigin(bad),false);
});
test('escapes HTML in stored memories to prevent markup injection',()=>{
 assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('job-description matching returns relevant verified facts',()=>{
 const data=[
  {id:'a',title:'Slack command integration',body:'Built Python Slack commands and alerts for autonomous agent workflows',category:'project',source:'project source'},
  {id:'b',title:'Pillow experiment',body:'Compared bedding materials and comfort',category:'other',source:'user'}
 ];
 const matches=rankEvidence(data,'Python Slack agent alerts and integration role');
 assert.equal(matches[0]?.id,'a');
 assert.equal(matches.some(v=>v.id==='b'),false);
 assert.ok(keywords('Python API and Slack').includes('python'));
});
test('browser cannot access private page without session',async()=>{
 const response=await worker.fetch(new Request('https://private.example/'),{DB:{} as D1Database,MEMORY_API_TOKEN:secret});
 assert.equal(response.status,200);
 assert.match(await response.text(),/Private access key/);
});
test('login rejects cross-origin form submission',async()=>{
 const response=await worker.fetch(new Request('https://private.example/login',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/x-www-form-urlencoded'},body:'secret='+secret}),{DB:{} as D1Database,MEMORY_API_TOKEN:secret});
 assert.equal(response.status,403);
});
