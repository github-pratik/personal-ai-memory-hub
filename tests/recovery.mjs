// Synthetic-only recovery test; run against two fresh, separately persisted local Workers.
import assert from 'node:assert/strict';
const source='http://127.0.0.1:8788', target='http://127.0.0.1:8789';
const owner='ci_owner_access_key_minimum_40_random_chars_123456';
const agent='ci_agent_access_key_minimum_40_random_chars_abcdef';
const auth=key=>({authorization:'Bearer '+key});
async function ready(base){
 for(let i=0;i<80;i++){
  try{if((await fetch(base+'/health')).ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw new Error('Local recovery Worker did not start');
}
async function api(base,path,method='GET',body,key=owner){
 const res=await fetch(base+path,{method,headers:{...auth(key),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 assert.ok(res.ok,method+' '+path+' returned '+res.status);
 return res.json();
}
async function login(base){
 const res=await fetch(base+'/login',{method:'POST',redirect:'manual',headers:{origin:base},body:new URLSearchParams({secret:owner})});
 assert.equal(res.status,303);
 const cookie=res.headers.get('set-cookie')?.split(';')[0];
 assert.ok(cookie?.startsWith('pamh_session='));
 return cookie;
}
await Promise.all([ready(source),ready(target)]);
const list=base=>api(base,'/v1/memories');
assert.equal((await list(source)).items.length,0);
assert.equal((await list(target)).items.length,0);
const fact={title:'Synthetic recovery approved',body:'Synthetic original evidence',category:'project',source:'Synthetic recovery provenance'};
const created=await api(source,'/v1/memories','POST',fact);
const updated={...fact,body:'Synthetic revised evidence'};
await api(source,'/v1/memories/'+created.id,'PATCH',updated);
const archived=await api(source,'/v1/memories','POST',{...fact,title:'Synthetic recovery archived'});
await api(source,'/v1/memories/'+archived.id,'DELETE');
await api(source,'/v1/proposals','POST',{...fact,title:'Synthetic recovery pending'},agent);
assert.equal((await list(target)).items.length,0,'Target must not share source storage');
const exported=await fetch(source+'/export',{headers:{cookie:await login(source)}});
assert.equal(exported.status,200);
const backup=await exported.json();
assert.ok(backup.memories.some(m=>m.id===archived.id&&m.state==='archived'));
assert.ok(backup.proposals.some(p=>p.title==='Synthetic recovery pending'));
assert.ok(backup.revisions.filter(r=>r.memory_id===created.id).length>=2);
const cookie=await login(target);
for(let i=0;i<2;i++){
 const form=new FormData();
 form.set('file',new Blob([JSON.stringify(backup)],{type:'application/json'}),'synthetic.json');
 const res=await fetch(target+'/ui/import',{method:'POST',redirect:'manual',headers:{origin:target,cookie},body:form});
 assert.equal(res.status,303);
 const {items}=await list(target);
 assert.equal(items.length,1);
 for(const key of ['title','body','category','source'])assert.equal(items[0][key],updated[key]);
 assert.equal(items[0].state,'approved');
}
assert.equal((await api(target,'/v1/proposals?status=pending')).items.length,0);
console.log('Isolated approved-memory recovery passed (content only, not full history).');
