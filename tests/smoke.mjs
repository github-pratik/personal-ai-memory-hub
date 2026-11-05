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
// Approving a proposed fact must atomically create exactly one trusted memory.
result=await request('/v1/proposals','POST',{title:'Confirmed AI project',body:'Implemented API validation and deployment testing',category:'project',source:'Synthetic approved proposal'},agent);
assert.equal(result.res.status,201);
const acceptedId=result.data.id;
result=await request('/v1/proposals/'+acceptedId+'/approve','POST');
assert.equal(result.res.status,200,JSON.stringify(result.data));
assert.ok(result.data.memory_id);
const acceptedMemoryId=result.data.memory_id;
result=await request('/v1/memories/'+acceptedMemoryId);
assert.equal(result.res.status,200);
assert.equal(result.data.title,'Confirmed AI project');
result=await request('/v1/proposals/'+acceptedId+'/approve','POST');
assert.equal(result.res.status,409);
result=await request('/v1/memories?q=Confirmed AI project');
assert.equal(result.data.items.length,1);
result=await request('/v1/memories/'+memoryId,'PATCH',{title:'IndustrialBriefs Slack',body:'Slack command and alert integration, with Python workflows',category:'project',source:'Synthetic test fixture'});
assert.equal(result.res.status,200);
result=await request('/v1/memories/'+memoryId,'DELETE');
assert.equal(result.res.status,200);
result=await request('/v1/memories/'+memoryId);
assert.equal(result.res.status,404);
// Owner-only bulk import stays idempotent.
const bulk=[
 {title:'Python API ownership',body:'Built Python REST API integrations for a business workflow',category:'experience',source:'Synthetic private fixture'},
 {title:'Cloud deployment',body:'Configured test data storage for a Worker',category:'project',source:'Synthetic private fixture'}
];
result=await request('/v1/import','POST',{items:bulk});
assert.equal(result.res.status,200);
result=await request('/v1/import','POST',{items:bulk});
assert.equal(result.res.status,200);
result=await request('/v1/memories?q=Python API ownership');
assert.equal(result.data.items.length,1);
// MCP interoperability basics: initialize, list tools, search.
const mcp=async (method,params)=>fetch(base+'/mcp',{method:'POST',headers:{...auth(agent),'content-type':'application/json','accept':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
const initialized=await mcp('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'smoke',version:'1'}});
assert.equal(initialized.status,200);
assert.equal((await initialized.json()).result.serverInfo.name,'personal-ai-memory-hub');
const tools=await mcp('tools/list');
assert.equal(tools.status,200);
assert.ok((await tools.json()).result.tools.some(t=>t.name==='match_job'));
const searched=await mcp('tools/call',{name:'search_memory',arguments:{query:'Python'}});
assert.equal(searched.status,200);
assert.match(JSON.stringify(await searched.json()),/Python API ownership/);
const pendingToolList=await mcp('tools/list');
assert.ok((await pendingToolList.json()).result.tools.some(t=>t.name==='propose_memory'));
const suggested=await mcp('tools/call',{name:'propose_memory',arguments:{
 title:'MCP synthetic pending project',body:'A simulated project record requiring explicit user review',category:'project',source:'Synthetic MCP smoke test'
}});
assert.equal(suggested.status,200);
const suggestion=JSON.parse((await suggested.json()).result.content[0].text);
assert.equal(suggestion.status,'pending');
assert.equal(suggestion.requires_owner_approval,true);
const beforeApprove=await request('/v1/memories?q=MCP synthetic pending project');
assert.equal(beforeApprove.data.items.length,0);
const mcpReview=await request('/v1/proposals?status=pending');
assert.ok(mcpReview.data.items.some(item=>item.id===suggestion.id));
const agentCannotApprove=await request('/v1/proposals/'+suggestion.id+'/approve','POST',undefined,agent);
assert.equal(agentCannotApprove.res.status,403);
const ownerApproves=await request('/v1/proposals/'+suggestion.id+'/approve','POST');
assert.equal(ownerApproves.res.status,200);
const afterApprove=await request('/v1/memories?q=MCP synthetic pending project');
assert.equal(afterApprove.data.items.length,1);
const updateProposal=await mcp('tools/call',{name:'propose_memory_update',arguments:{
 memory_id:afterApprove.data.items[0].id,
 title:'MCP synthetic corrected project',
 body:'Corrected project details from the explicit synthetic test request',
 category:'project',
 source:'Synthetic correction requested by owner'
}});
assert.equal(updateProposal.status,200);
const proposedCorrection=JSON.parse((await updateProposal.json()).result.content[0].text);
assert.equal(proposedCorrection.status,'pending');
assert.equal(proposedCorrection.requires_owner_approval,true);
const unchangedBeforeCorrection=await request('/v1/memories/'+afterApprove.data.items[0].id);
assert.equal(unchangedBeforeCorrection.data.title,'MCP synthetic pending project');
const forbiddenUpdateApproval=await request('/v1/memory-updates/'+proposedCorrection.id+'/approve','POST',undefined,agent);
assert.equal(forbiddenUpdateApproval.res.status,403);
const confirmedCorrection=await request('/v1/memory-updates/'+proposedCorrection.id+'/approve','POST');
assert.equal(confirmedCorrection.res.status,200,JSON.stringify(confirmedCorrection.data));
const corrected=await request('/v1/memories/'+afterApprove.data.items[0].id);
assert.equal(corrected.data.title,'MCP synthetic corrected project');
const duplicatedCorrection=await request('/v1/memory-updates/'+proposedCorrection.id+'/approve','POST');
assert.equal(duplicatedCorrection.res.status,200);
assert.equal(duplicatedCorrection.data.already_applied,true);
const staleSuggestion=await mcp('tools/call',{name:'propose_memory_update',arguments:{
 memory_id:afterApprove.data.items[0].id,
 title:'Stale suggestion that must never be applied',
 body:'This proposal is invalidated when the owner changes the record',
 category:'project',
 source:'Synthetic optimistic-concurrency test'
}});
const stale=JSON.parse((await staleSuggestion.json()).result.content[0].text);
const manuallyUpdated=await request('/v1/memories/'+afterApprove.data.items[0].id,'PATCH',{
 title:'Owner corrected project',body:'The owner manually corrected this synthetic project',category:'project',source:'Synthetic owner override'
});
assert.equal(manuallyUpdated.res.status,200);
const staleDecision=await request('/v1/memory-updates/'+stale.id+'/approve','POST');
assert.equal(staleDecision.res.status,409);
const afterConflict=await request('/v1/memories/'+afterApprove.data.items[0].id);
assert.equal(afterConflict.data.title,'Owner corrected project');
const rejectedUpdate=await request('/v1/memory-updates/'+stale.id+'/reject','POST');
assert.equal(rejectedUpdate.res.status,200);
// Regression: a dashboard can display a proposed correction for an archived
// memory; ordinary approval must fail, but explicit owner restore-and-approve works.
const archivedCreate=await request('/v1/memories','POST',{
 title:'Archived correction fixture',body:'Original synthetic data',category:'other',source:'Synthetic test'
});
assert.equal(archivedCreate.res.status,201);
const archivedMemoryId=archivedCreate.data.id;
const archivedCandidate=await mcp('tools/call',{name:'propose_memory_update',arguments:{
 memory_id:archivedMemoryId,title:'Restored and corrected fixture',body:'Corrected synthetic data',
 category:'other',source:'Explicit synthetic recovery test'
}});
assert.equal(archivedCandidate.status,200);
const archivedProposal=JSON.parse((await archivedCandidate.json()).result.content[0].text);
const archival=await request('/v1/memories/'+archivedMemoryId,'DELETE');
assert.equal(archival.res.status,200);
const ordinaryApproval=await request('/v1/memory-updates/'+archivedProposal.id+'/approve','POST');
assert.equal(ordinaryApproval.res.status,409);
assert.match(ordinaryApproval.data.error,/no longer approved/i);
const forbiddenRestore=await request('/v1/memory-updates/'+archivedProposal.id+'/restore-approve','POST',undefined,agent);
assert.equal(forbiddenRestore.res.status,403);
const recovery=await request('/v1/memory-updates/'+archivedProposal.id+'/restore-approve','POST');
assert.equal(recovery.res.status,200,JSON.stringify(recovery.data));
assert.equal(recovery.data.restored,true);
const recoveredRecord=await request('/v1/memories/'+archivedMemoryId);
assert.equal(recoveredRecord.res.status,200);
assert.equal(recoveredRecord.data.title,'Restored and corrected fixture');
assert.equal(recoveredRecord.data.state,'approved');
const recoveryRepeat=await request('/v1/memory-updates/'+archivedProposal.id+'/restore-approve','POST');
assert.equal(recoveryRepeat.res.status,200);
assert.equal(recoveryRepeat.data.already_applied,true);




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
// Owner dashboard supports job matching and private backup restoration.
const jobMatch=await fetch(base+'/ui/job-match',{method:'POST',redirect:'manual',headers:{origin:base,cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({job_description:'Python APIs and database integrations for logistics workflows'})});
assert.equal(jobMatch.status,200);
assert.match(await jobMatch.text(),/Relevant career evidence/);
const backupFixture={version:1,memories:[{title:'Verified test restoration',body:'Restored approved fact from an encrypted personal backup',category:'project',source:'Synthetic backup test',state:'approved'}]};
const upload=new FormData();
upload.set('file',new Blob([JSON.stringify(backupFixture)],{type:'application/json'}),'backup.json');
const restored=await fetch(base+'/ui/import',{method:'POST',redirect:'manual',headers:{origin:base,cookie},body:upload});
assert.equal(restored.status,303);
const foundRestored=await request('/v1/memories?q=Verified test restoration');
assert.equal(foundRestored.data.items.length,1);
const exportRes=await fetch(base+'/export',{headers:{cookie}});
assert.equal(exportRes.status,200);
const backup=await exportRes.json();
assert.ok(Array.isArray(backup.memories)&&Array.isArray(backup.revisions));
console.log('End-to-end smoke test passed: auth, memories, evidence match, approvals, browser, export.');
