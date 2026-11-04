import assert from 'node:assert/strict';

const base='http://127.0.0.1:8787';
const owner='ci_owner_access_key_minimum_40_random_chars_123456';
const agent='ci_agent_access_key_minimum_40_random_chars_abcdef';
const auth=(key=owner)=>({'authorization':'Bearer '+key});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(path,method='GET',body,token=owner){
 const res=await fetch(base+path,{method,headers:{...auth(token),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {res,data:await res.json()};
}
for(let attempt=0;attempt<40;attempt++){
 try{const r=await fetch(base+'/health');if(r.ok)break;}catch{}
 if(attempt===39)throw new Error('Worker failed to start');
 await sleep(500);
}
const anonymous=await fetch(base+'/v1/memories');
assert.equal(anonymous.status,401);
let result=await request('/v1/memories','POST',{title:'IndustrialBriefs Slack',body:'Built Slack alerts and commands for an AI publishing agent in Python',category:'project',source:'Synthetic test fixture'});
assert.equal(result.res.status,201,JSON.stringify(result.data));const memoryId=result.data.id;
result=await request('/v1/memories/'+memoryId);
assert.equal(result.res.status,200);
assert.equal(result.data.title,'IndustrialBriefs Slack');
result=await request('/v1/memories?q=Slack');
assert.equal(result.data.items.length,1);
result=await request('/v1/resume-context','POST',{job_description:'Python developer building Slack agent integrations and alerting'});
assert.equal(result.res.status,200);
assert.equal(result.data.matches[0]?.id,memoryId);
result=await request('/v1/proposals','POST',{title:'Odoo development',body:'Built custom ERP warehouse modules',category:'experience',source:'Unverified synthetic agent proposal'},agent);
assert.equal(result.res.status,201);const proposalId=result.data.id;
result=await request('/v1/proposals/'+proposalId+'/approve','POST',undefined,agent);
assert.equal(result.res.status,403);
result=await request('/v1/proposals/'+proposalId+'/reject','POST');
assert.equal(result.res.status,200);
result=await request('/v1/proposals/'+proposalId+'/approve','POST');
assert.equal(result.res.status,409);
result=await request('/v1/memories/'+memoryId,'PATCH',{title:'IndustrialBriefs Slack',body:'Slack command and alert integration, with Python workflows',category:'project',source:'Synthetic test fixture'});
assert.equal(result.res.status,200);
result=await request('/v1/memories/'+memoryId,'DELETE');
assert.equal(result.res.status,200);
result=await request('/v1/memories/'+memoryId);
assert.equal(result.res.status,404);
const homepage=await fetch(base+'/');
assert.equal(homepage.status,200);
assert.match(await homepage.text(),/Private access key/);
const form=new URLSearchParams({secret:owner});
const login=await fetch(base+'/login',{method:'POST',redirect:'manual',headers:{origin:base,'content-type':'application/x-www-form-urlencoded'},body:form});
assert.equal(login.status,303);
const cookie=login.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie?.startsWith('pamh_session='));
const dashboard=await fetch(base+'/',{headers:{cookie}});
assert.equal(dashboard.status,200);
assert.match(await dashboard.text(),/Match experience to a job description/);
const exportRes=await fetch(base+'/export',{headers:{cookie}});
assert.equal(exportRes.status,200);
const backup=await exportRes.json();
assert.ok(Array.isArray(backup.memories)&&Array.isArray(backup.revisions));
console.log('End-to-end smoke test passed: auth, memories, evidence match, approvals, browser, export.');
