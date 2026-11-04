import { handleMcp } from './mcp';
import { rankEvidence, type Evidence } from './relevance';
import { handleUi } from './ui';
import { authorized, safeLimit, validateMemoryInput, validId } from './domain';

interface Env { DB: D1Database; MEMORY_API_TOKEN: string; MEMORY_AGENT_TOKEN?: string }
type Role = 'owner' | 'agent';
const json = (data:unknown, status=200) => new Response(JSON.stringify(data), {
  status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
});
const err=(message:string,status:number)=>json({error:message},status);
const now=()=>new Date().toISOString();
const categories=['experience','project','skill','education','preference','other'];

function roleOf(header:string|null,env:Env):Role|null{
  if(authorized(header,env.MEMORY_API_TOKEN))return 'owner';
  if(env.MEMORY_AGENT_TOKEN && env.MEMORY_AGENT_TOKEN!==env.MEMORY_API_TOKEN && authorized(header,env.MEMORY_AGENT_TOKEN))return 'agent';
  return null;
}
function allowed(role:Role,method:string,path:string):boolean{
  if(role==='owner')return true;
  if(method==='POST' && (path==='/v1/proposals'||path==='/v1/resume-context'))return true;
  if(method==='GET' && (path==='/v1/memories'||/^\/v1\/memories\/[^/]+$/.test(path)))return true;
  return false;
}
async function parseJson(request:Request):Promise<unknown>{
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new Error('Content-Type must be application/json');
  if(Number(request.headers.get('content-length')||0)>16000)throw new Error('Request too large');
  const text=await request.text();
  if(text.length>16000)throw new Error('Request too large');
  return JSON.parse(text);
}
const worker = {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url),path=url.pathname,method=request.method;
    if(path==='/'||path==='/login'||path==='/logout'||path==='/export'||path.startsWith('/ui/')){
      const result=await handleUi(request,env,(target,action,body)=>worker.fetch(new Request(new URL(target,url),{
        method:action,
        headers:{authorization:'Bearer '+env.MEMORY_API_TOKEN,...(body?{'content-type':'application/json'}:{})},
        body:body?JSON.stringify(body):undefined
      }),env));
      if(result)return result;
    }
    if(path==='/health' && method==='GET')return json({status:'ok',service:'personal-ai-memory-hub',version:'0.2.0'});
    const role=roleOf(request.headers.get('authorization'),env);
    if(!role)return err('Unauthorized',401);
    if(!allowed(role,method,path))return err('Forbidden',403);
    if(!env.DB)return err('Database binding missing',503);
    if(path==='/mcp')return handleMcp(request,env);
    try{
      if(path==='/v1/resume-context' && method==='POST'){
        const payload=await parseJson(request);
        if(!payload||typeof payload!=='object'||Array.isArray(payload))return err('Expected job description',400);
        const job=(payload as Record<string,unknown>).job_description;
        if(typeof job!=='string'||job.trim().length<15||job.length>12000)return err('Job description must be 15–12000 characters',400);
        const results=await env.DB.prepare("SELECT id,title,body,category,source,updated_at FROM memories WHERE state='approved' ORDER BY updated_at DESC LIMIT 500").all<Evidence>();
        return json({matches:rankEvidence(results.results,job),searched:results.results.length,method:'keyword-overlap',notice:'Evidence relevance is heuristic; verify claims before adding to a resume.'});
      }
      if(path==='/v1/memories' && method==='GET'){
        const limit=safeLimit(url.searchParams.get('limit')),q=(url.searchParams.get('q')||'').trim(),category=url.searchParams.get('category');
        if(q.length>200)return err('Query too long',400);
        if(category && !categories.includes(category))return err('Invalid category',400);
        const filters=["state='approved'"],args:unknown[]=[];
        if(category){filters.push('category=?');args.push(category)}
        if(q){filters.push('(instr(lower(title),lower(?))>0 OR instr(lower(body),lower(?))>0)');args.push(q,q)}
        const sql='SELECT id,title,body,category,source,state,created_at,updated_at FROM memories WHERE '+filters.join(' AND ')+' ORDER BY updated_at DESC LIMIT ?';
        const result=await env.DB.prepare(sql).bind(...args,limit).all();
        return json({items:result.results});
      }
      if(path==='/v1/memories' && method==='POST'){
        const data=validateMemoryInput(await parseJson(request));if(!data.ok)return err(data.error,400);
        const id=crypto.randomUUID(),date=now(),v=data.value;
        await env.DB.batch([
          env.DB.prepare('INSERT INTO memories (id,title,body,category,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,v.title,v.body,v.category,v.source,date,date),
          env.DB.prepare('INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,v.title,v.body,v.category,v.source,date,'create')
        ]);
        return json({id,...v,state:'approved',created_at:date},201);
      }
      const match=path.match(/^\/v1\/memories\/([^/]+)$/);
      if(match){
        const id=match[1];if(!validId(id))return err('Invalid ID',400);
        if(method==='GET'){
          const row=await env.DB.prepare("SELECT * FROM memories WHERE id=? AND state='approved'").bind(id).first();
          return row?json(row):err('Not found',404);
        }
        if(method==='PATCH'){
          const data=validateMemoryInput(await parseJson(request));if(!data.ok)return err(data.error,400);
          const previous=await env.DB.prepare("SELECT id FROM memories WHERE id=? AND state='approved'").bind(id).first();
          if(!previous)return err('Not found',404);
          const date=now(),v=data.value;
          await env.DB.batch([
            env.DB.prepare("UPDATE memories SET title=?,body=?,category=?,source=?,updated_at=? WHERE id=? AND state='approved'").bind(v.title,v.body,v.category,v.source,date,id),
            env.DB.prepare("INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) SELECT ?,id,title,body,category,source,?,'update' FROM memories WHERE id=? AND state='approved'").bind(crypto.randomUUID(),date,id)
          ]);
          return json({id,...v,updated_at:date});
        }
        if(method==='DELETE'){
          const previous=await env.DB.prepare("SELECT id FROM memories WHERE id=? AND state='approved'").bind(id).first();
          if(!previous)return err('Not found',404);
          const date=now();
          await env.DB.batch([
            env.DB.prepare("UPDATE memories SET state='archived',updated_at=? WHERE id=? AND state='approved'").bind(date,id),
            env.DB.prepare("INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) SELECT ?,id,title,body,category,source,?,'archive' FROM memories WHERE id=? AND state='archived'").bind(crypto.randomUUID(),date,id)
          ]);
          return json({id,state:'archived'});
        }
      }
      if(path==='/v1/proposals' && method==='POST'){
        const data=validateMemoryInput(await parseJson(request));if(!data.ok)return err(data.error,400);
        const id=crypto.randomUUID(),date=now(),v=data.value;
        await env.DB.prepare('INSERT INTO memory_proposals (id,title,body,category,source,created_at) VALUES (?,?,?,?,?,?)').bind(id,v.title,v.body,v.category,v.source,date).run();
        return json({id,status:'pending'},201);
      }
      if(path==='/v1/proposals' && method==='GET'){
        const status=url.searchParams.get('status')||'pending';
        if(!['pending','approved','rejected'].includes(status))return err('Invalid status',400);
        const result=await env.DB.prepare('SELECT * FROM memory_proposals WHERE status=? ORDER BY created_at DESC LIMIT ?').bind(status,safeLimit(url.searchParams.get('limit'))).all();
        return json({items:result.results});
      }
      const decision=path.match(/^\/v1\/proposals\/([^/]+)\/(approve|reject)$/);
      if(decision && method==='POST'){
        const [,proposalId,action]=decision;
        if(!validId(proposalId))return err('Invalid ID',400);
        const previous=await env.DB.prepare('SELECT status FROM memory_proposals WHERE id=?').bind(proposalId).first<{status:string}>();
        if(!previous)return err('Not found',404);
        if(previous.status!=='pending')return err('Already decided',409);
        const date=now();
        if(action==='reject'){
          const result=await env.DB.prepare("UPDATE memory_proposals SET status='rejected',decided_at=? WHERE id=? AND status='pending'").bind(date,proposalId).run();
          return result.meta.changes===1?json({id:proposalId,status:'rejected'}):err('Already decided',409);
        }
        const id=crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare("UPDATE memory_proposals SET status='approved',decided_at=?,accepted_memory_id=? WHERE id=? AND status='pending'").bind(date,id,proposalId),
          env.DB.prepare("INSERT INTO memories (id,title,body,category,source,created_at,updated_at) SELECT ?,title,body,category,source,?,? FROM memory_proposals WHERE id=? AND status='approved' AND accepted_memory_id=?").bind(id,date,date,proposalId,id),
          env.DB.prepare("INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) SELECT ?,id,title,body,category,source,?,'create' FROM memories WHERE id=?").bind(crypto.randomUUID(),date,id)
        ]);
        const saved=await env.DB.prepare('SELECT accepted_memory_id FROM memory_proposals WHERE id=?').bind(proposalId).first<{accepted_memory_id:string|null}>();
        return saved?.accepted_memory_id===id?json({id:proposalId,status:'approved',memory_id:id}):err('Already decided',409);
      }
      return err('Not found',404);
    }catch(e){
      if(e instanceof SyntaxError)return err('Invalid JSON',400);
      if(e instanceof Error && (e.message==='Request too large'||e.message.startsWith('Content-Type')))return err(e.message,e.message==='Request too large'?413:415);
      console.error('Request processing failed');return err('Internal server error',500);
    }
  }
};

export default worker;
