import { safeLimit, validId, validateMemoryInput } from './domain';
import { rankEvidence, type Evidence } from './relevance';

interface Env {DB:D1Database}
type JsonRpcId=string|number|null;
const reply=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const error=(id:JsonRpcId,code:number,message:string)=>({jsonrpc:'2.0',id,error:{code,message}});
const success=(id:JsonRpcId,result:unknown)=>({jsonrpc:'2.0',id,result});
const tool=(name:string,description:string,properties:Record<string,unknown>,required:string[]=[])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}});
const stringProp=(description:string)=>({type:'string',description});
export const MCP_TOOLS=[
 tool('search_memory','Search approved professional facts by keyword. Returns sources and factual context.',{
  query:stringProp('Search phrase or technology, up to 200 characters'),
  category:{type:'string',enum:['experience','project','skill','education','preference','other']},
  limit:{type:'integer',minimum:1,maximum:50}
 },['query']),
 tool('get_memory','Read a single approved memory record, including its evidence source.',{id:stringProp('Memory UUID')},['id']),
 tool('match_job','Rank approved professional evidence against a job description. The ranking is heuristic, not a validation of the claim.',{
  job_description:stringProp('Target job description (15 to 12000 characters)')
 },['job_description']),
 tool('propose_memory','Suggest a new memory ONLY when the user explicitly requests it. Saves to a pending owner-review queue, NOT approved memory. Do not invent facts or claim the proposal is approved.',{
  title:stringProp('Concise proposed fact title, 1–160 characters'),
  body:stringProp('Specific proposed fact details, 1–12000 characters; distinguish user statements from inference'),
  category:{type:'string',enum:['experience','project','skill','education','preference','other']},
  source:stringProp('Where the proposed fact came from, e.g., user statement in this conversation (1–500 characters)')
 },['title','body','category','source']),
 tool('propose_memory_update','Suggest a correction or replacement for an EXISTING approved memory after explicit user request. Only creates a pending update for owner review; never directly changes approved memory.',{
  memory_id:stringProp('Exact UUID of approved memory to correct; use search_memory first'),
  title:stringProp('Complete corrected title (1–160 characters)'),
  body:stringProp('Complete corrected details (1–12000 characters); preserve still-valid facts'),
  category:{type:'string',enum:['experience','project','skill','education','preference','other']},
  source:stringProp('Evidence for correction or explicit user statement (1–500 characters)')
 },['memory_id','title','body','category','source'])
];
export async function handleMcp(request:Request,env:Env):Promise<Response>{
 if(request.method!=='POST')return new Response(null,{status:405,headers:{allow:'POST','cache-control':'no-store'}});
 let body:unknown;
 try{
   const raw=await request.text();
   if(raw.length>16000)return reply(error(null,-32600,'Request too large'),413);
   body=JSON.parse(raw);
 }catch{return reply(error(null,-32700,'Parse error'),400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return reply(error(null,-32600,'Invalid request'),400);
 const msg=body as Record<string,unknown>;
 const id:JsonRpcId=typeof msg.id==='string'||typeof msg.id==='number'?msg.id:null;
 if(typeof msg.method!=='string'||msg.jsonrpc!=='2.0')return reply(error(id,-32600,'Invalid request'),400);
 if(msg.method==='notifications/initialized')return new Response(null,{status:202});
 if(msg.method==='ping')return reply(success(id,{}));
 if(msg.method==='initialize')return reply(success(id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'personal-ai-memory-hub',version:'0.3.0'},instructions:'Retrieval returns only approved, source-linked memories. propose_memory and propose_memory_update may submit user-requested suggestions for explicit owner approval, never automatically approve or invent experience.'}));
 if(msg.method==='tools/list')return reply(success(id,{tools:MCP_TOOLS}));
 if(msg.method!=='tools/call')return reply(error(id,-32601,'Method not found'),404);
 const params=msg.params;
 if(!params||typeof params!=='object'||Array.isArray(params))return reply(error(id,-32602,'Invalid parameters'),400);
 const {name,arguments:args} = params as Record<string,unknown>;
 const a=args&&typeof args==='object'&&!Array.isArray(args)?args as Record<string,unknown>:{};
 try{
  let result:unknown;
  if(name==='search_memory'){
   const q=a.query;
   if(typeof q!=='string'||q.length>200||!q.trim())return reply(error(id,-32602,'Invalid query'),400);
   const category=a.category;
   if(category!==undefined&&(!['experience','project','skill','education','preference','other'].includes(String(category))))return reply(error(id,-32602,'Invalid category'),400);
   const filters=["state='approved'"],values:unknown[]=[];
   if(category){filters.push('category=?');values.push(category)}
   filters.push('(instr(lower(title),lower(?))>0 OR instr(lower(body),lower(?))>0)');
   values.push(q,q);
   const limit=safeLimit(typeof a.limit==='number'?String(a.limit):null);
   const rows=await env.DB.prepare('SELECT id,title,body,category,source,updated_at FROM memories WHERE '+filters.join(' AND ')+' ORDER BY updated_at DESC LIMIT ?').bind(...values,Math.min(limit,50)).all();
   result={items:rows.results};
  }else if(name==='get_memory'){
   if(typeof a.id!=='string'||!validId(a.id))return reply(error(id,-32602,'Invalid memory id'),400);
   const row=await env.DB.prepare("SELECT id,title,body,category,source,updated_at FROM memories WHERE id=? AND state='approved'").bind(a.id).first();
   result=row||{error:'Memory not found'};
  }else if(name==='match_job'){
   const desc=a.job_description;
   if(typeof desc!=='string'||desc.length<15||desc.length>12000)return reply(error(id,-32602,'Invalid job description'),400);
   const rows=await env.DB.prepare("SELECT id,title,body,category,source,updated_at FROM memories WHERE state='approved' ORDER BY updated_at DESC LIMIT 500").all<Evidence>();
   result={matches:rankEvidence(rows.results,desc),searched:rows.results.length};
  }else if(name==='propose_memory'){
   // Never write to approved memories from an MCP call. The owner must explicitly review.
   const validation=validateMemoryInput(a);
   if(!validation.ok)return reply(error(id,-32602,validation.error),400);
   // Bound pending-queue growth to reduce abuse from compromised/misconfigured clients.
   const pending=await env.DB.prepare("SELECT COUNT(*) AS count FROM memory_proposals WHERE status='pending'").first<{count:number}>();
   if(Number(pending?.count??0)>=100)return reply(error(id,-32000,'Pending review queue is full (100). Ask the owner to review proposals.'),429);
   const input=validation.value,idValue=crypto.randomUUID(),createdAt=new Date().toISOString();
   const source=('AI suggestion via MCP: '+input.source).slice(0,500);
   await env.DB.prepare('INSERT INTO memory_proposals (id,title,body,category,source,created_at) VALUES (?,?,?,?,?,?)')
    .bind(idValue,input.title,input.body,input.category,source,createdAt).run();
   result={id:idValue,status:'pending',requires_owner_approval:true,message:'Proposal submitted for owner review. It is NOT an approved memory.'};
  }else if(name==='propose_memory_update'){
   if(typeof a.memory_id!=='string'||!validId(a.memory_id))return reply(error(id,-32602,'Invalid memory_id'),400);
   const validation=validateMemoryInput(a);
   if(!validation.ok)return reply(error(id,-32602,validation.error),400);
   const current=await env.DB.prepare("SELECT id,updated_at FROM memories WHERE id=? AND state='approved'").bind(a.memory_id).first<{id:string;updated_at:string}>();
   if(!current)return reply(error(id,-32004,'Approved memory not found'),404);
   const pending=await env.DB.prepare("SELECT COUNT(*) AS count FROM memory_update_proposals WHERE status='pending'").first<{count:number}>();
   if(Number(pending?.count??0)>=100)return reply(error(id,-32000,'Pending update review queue is full (100).'),429);
   const input=validation.value,idValue=crypto.randomUUID(),createdAt=new Date().toISOString();
   const source=('AI correction via MCP: '+input.source).slice(0,500);
   await env.DB.prepare('INSERT INTO memory_update_proposals (id,memory_id,target_updated_at,title,body,category,source,created_at) VALUES (?,?,?,?,?,?,?,?)')
     .bind(idValue,current.id,current.updated_at,input.title,input.body,input.category,source,createdAt).run();
   result={id:idValue,memory_id:current.id,status:'pending',requires_owner_approval:true,message:'Correction submitted for owner review; approved memory is unchanged.'};
  }else return reply(error(id,-32602,'Unknown tool'),400);
  return reply(success(id,{content:[{type:'text',text:JSON.stringify(result)}]}));
 }catch{
  console.error('MCP request failed');
  return reply(error(id,-32603,'Internal server error'),500);
 }
}
