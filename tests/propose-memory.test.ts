import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index';

const master='m'.repeat(40),agent='a'.repeat(40),endpoint='https://example.test/mcp';
type Row={id:string;title:string;body:string;category:string;source:string;created_at:string;status:string};
function fixture(){
 const proposals:Row[]=[];
 let approvedWrites=0;
 const db={
   prepare(sql:string){
     let values:unknown[]=[];
     const stmt={
       bind(...args:unknown[]){values=args;return stmt},
       async first(){
         if(sql.startsWith('SELECT COUNT(*)'))return {count:proposals.filter(x=>x.status==='pending').length};
         throw Error('Unexpected query '+sql);
       },
       async run(){
         if(sql.startsWith('INSERT INTO memory_proposals')){
           const [id,title,body,category,source,created_at]=values as string[];
           proposals.push({id,title,body,category,source,created_at,status:'pending'});
           return {meta:{changes:1}};
         }
         if(sql.includes('memories'))approvedWrites++;
         throw Error('Unexpected query '+sql);
       }
     };
     return stmt;
   }
 };
 return {env:{DB:db as unknown as D1Database,MEMORY_API_TOKEN:master,MEMORY_AGENT_TOKEN:agent},proposals,get approvedWrites(){return approvedWrites}};
}
const call=async(env:Parameters<typeof worker.fetch>[1],name:string,args:unknown,token=agent)=>{
 const req=new Request(endpoint,{method:'POST',headers:{'authorization':'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:7,method:'tools/call',params:{name,arguments:args}})});
 return worker.fetch(req,env);
};
const valid={title:'Synthetic test fact',body:'Sample project details for a test only',category:'project',source:'Explicit test user statement'};

test('tool discovery advertises propose_memory as pending-only',async()=>{
 const {env}=fixture();
 const res=await worker.fetch(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer '+agent,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),env);
 assert.equal(res.status,200);
 const tools=(await res.json() as any).result.tools;
 const proposal=tools.find((t:any)=>t.name==='propose_memory');
 assert.ok(proposal);
 assert.deepEqual(proposal.inputSchema.required,['title','body','category','source']);
 assert.match(proposal.description,/pending owner-review/i);
});
test('agent proposal is persisted only to pending review and preserves source',async()=>{
 const f=fixture();
 const res=await call(f.env,'propose_memory',valid);
 assert.equal(res.status,200);
 const data=(await res.json() as any).result.content[0].text;
 const result=JSON.parse(data);
 assert.equal(result.status,'pending');
 assert.equal(result.requires_owner_approval,true);
 assert.equal(f.proposals.length,1);
 assert.equal(f.proposals[0].status,'pending');
 assert.equal(f.proposals[0].title,valid.title);
 assert.match(f.proposals[0].source,/^AI suggestion via MCP: Explicit test user statement$/);
 assert.equal(f.approvedWrites,0);
});
test('unauthenticated requests cannot propose',async()=>{
 const {env,proposals}=fixture();
 const res=await call(env,'propose_memory',valid,'invalid');
 assert.equal(res.status,401);
 assert.equal(proposals.length,0);
});
test('invalid or oversized proposals never reach database',async()=>{
 for(const bad of [
   {...valid,category:'secret'},
   {...valid,title:' '},
   {...valid,body:'x'.repeat(12001)},
   {...valid,source:''}
 ]){
   const f=fixture(),res=await call(f.env,'propose_memory',bad);
   assert.equal(res.status,400);
   assert.equal(f.proposals.length,0);
 }
});
test('pending queue refuses additional requests after 100 proposals',async()=>{
 const f=fixture();
 for(let n=0;n<100;n++)f.proposals.push({id:String(n),title:'fixture',body:'fixture',category:'project',source:'fixture',created_at:'',status:'pending'});
 const res=await call(f.env,'propose_memory',valid);
 assert.equal(res.status,429);
 assert.equal(f.proposals.length,100);
 assert.equal(f.approvedWrites,0);
});
test('MCP proposal tools never expose owner approval or direct edit operations',async()=>{
 const {env}=fixture();
 const res=await worker.fetch(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer '+agent,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),env);
 const names=(await res.json() as any).result.tools.map((t:any)=>t.name);
 assert.ok(names.includes('propose_memory_update'));
 assert.ok(!names.some((name:string)=>/approve|reject|delete|archive|^update_memory$/i.test(name)));
});
