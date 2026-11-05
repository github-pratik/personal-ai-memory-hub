import { stableMemoryId, proposalMemoryId } from './import';
import { handleMcp } from './mcp';
import { handleOAuth, oauthScopes, oauthChallenge } from './oauth';
import { rankEvidence, type Evidence } from './relevance';
import { handleUi } from './ui';
import { authorized, safeLimit, validateMemoryInput, validId } from './domain';

interface Env { DB: D1Database; MEMORY_API_TOKEN: string; MEMORY_AGENT_TOKEN?: string; ACCESS_REQUIRED?: string; ACCESS_ALLOWED_EMAIL?: string }
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
  if(method==='POST' && (path==='/v1/proposals'||path==='/v1/resume-context'||path==='/mcp'))return true;
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
  async fetch(request:Request,env:Env,ctx?:ExecutionContext):Promise<Response>{
    const url=new URL(request.url),path=url.pathname,method=request.method;
    if(path==='/'||path==='/login'||path==='/logout'||path==='/export'||path.startsWith('/ui/')){
      let accessAuthorized=false;
      if(env.ACCESS_REQUIRED==='true'){
        const access=(ctx as (ExecutionContext & {access?:{getIdentity:()=>Promise<{email?:string}|null>}}) | undefined)?.access;
        if(!access||!env.ACCESS_ALLOWED_EMAIL?.includes('@'))return err('Cloudflare Access authentication required',403);
        try{
          const identity=await access.getIdentity();
          accessAuthorized=!!identity?.email && identity.email.toLowerCase()===env.ACCESS_ALLOWED_EMAIL.trim().toLowerCase();
        }catch{return err('Cloudflare Access authentication failed',403)}
        if(!accessAuthorized)return err('Forbidden',403);
      }
      const result=await handleUi(request,env,(target,action,body)=>worker.fetch(new Request(new URL(target,url),{
        method:action,
        headers:{authorization:'Bearer '+env.MEMORY_API_TOKEN,...(body?{'content-type':'application/json'}:{})},
        body:body?JSON.stringify(body):undefined
      }),env),accessAuthorized);
      if(result)return result;
    }
    if(path==='/health' && method==='GET')return json({status:'ok',service:'personal-ai-memory-hub',version:'0.2.0'});
    // OAuth discovery/registration/auth endpoints do not use the MCP Bearer gate.
    // Authorization and consent themselves still require the signed owner session.
    if(path.startsWith('/oauth/')||path.startsWith('/.well-known/oauth-')){
      if(!env.DB)return err('Database binding missing',503);
      const oauth=await handleOAuth(request,env);
      if(oauth)return oauth;
    }
    // A scoped, short-lived OAuth token authorizes MCP only, never REST owner routes.
    if(path==='/mcp'){
      if(!env.DB)return err('Database binding missing',503);
      const staticRole=roleOf(request.headers.get('authorization'),env);
      const scopes=staticRole?null:await oauthScopes(request,env);
      if(!staticRole&&!scopes){
        // Public MCP discovery exposes schemas only, never memory content. ChatGPT
        // needs to inspect these OAuth-protected tools before the login flow.
        // No authenticated tools/call may execute through this path.
        if(method==='POST'){
          let message:Record<string,unknown>|null=null;
          try{
            const raw=await request.clone().text();
            if(raw.length<=16000){
              const parsed:unknown=JSON.parse(raw);
              if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))message=parsed as Record<string,unknown>;
            }
          }catch{}
          const discovery=new Set(['initialize','ping','tools/list','notifications/initialized']);
          if(message?.jsonrpc==='2.0'&&typeof message.method==='string'&&discovery.has(message.method)){
            return handleMcp(request,env);
          }
          if(message?.jsonrpc==='2.0'&&message.method==='tools/call'){
            // Tool-level OAuth error gives ChatGPT an actionable link prompt.
            // Returning tool metadata does not grant permission to execute it.
            const id=typeof message.id==='string'||typeof message.id==='number'?message.id:null;
            const challenge=oauthChallenge(request)+', error="invalid_token", error_description="Sign in to Personal AI Memory Hub to use this tool"';
            return json({jsonrpc:'2.0',id,result:{
              content:[{type:'text',text:'Authentication required. Connect your Personal AI Memory Hub account first.'}],
              isError:true,_meta:{'mcp/www_authenticate':[challenge]}
            }});
          }
        }
        return new Response(JSON.stringify({error:'Unauthorized'}),{
          status:401,headers:{'content-type':'application/json','cache-control':'no-store','www-authenticate':oauthChallenge(request)}
        });
      }
      return handleMcp(request,env,scopes||undefined);
    }
    const role=roleOf(request.headers.get('authorization'),env);
    if(!role)return err('Unauthorized',401);
    if(!allowed(role,method,path))return err('Forbidden',403);
    if(!env.DB)return err('Database binding missing',503);
    try{
      if(path==='/v1/import' && method==='POST'){
        const raw=await request.text();
        if(raw.length>150000)return err('Import too large',413);
        let payload:unknown;
        try{payload=JSON.parse(raw)}catch{return err('Invalid JSON',400)}
        if(!payload||typeof payload!=='object'||Array.isArray(payload))return err('Expected items array',400);
        const items=(payload as Record<string,unknown>).items;
        if(!Array.isArray(items)||items.length<1||items.length>25)return err('Import must have 1–25 records',400);
        const validated=[];
        for(const item of items){
          const v=validateMemoryInput(item);
          if(!v.ok)return err('Invalid record: '+v.error,400);
          validated.push(v.value);
        }
        const date=now(),statements:D1PreparedStatement[]=[];
        for(const item of validated){
          const id=await stableMemoryId(item);
          statements.push(env.DB.prepare("INSERT OR IGNORE INTO memories (id,title,body,category,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id,item.title,item.body,item.category,item.source,date,date));
          statements.push(env.DB.prepare("INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) SELECT ?,id,title,body,category,source,?,'create' FROM memories WHERE id=? AND NOT EXISTS (SELECT 1 FROM memory_revisions WHERE memory_id=?)").bind(crypto.randomUUID(),date,id,id));
        }
        await env.DB.batch(statements);
        return json({received:validated.length,status:'imported_or_already_present'});
      }
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
      // Explicit recovery only: an archived record must never be silently reactivated
      // by the ordinary approve-correction action.
      const restoreDecision=path.match(/^\/v1\/memory-updates\/([^/]+)\/restore-approve$/);
      if(restoreDecision && method==='POST'){
        const proposalId=restoreDecision[1];
        if(!validId(proposalId))return err('Invalid ID',400);
        const p=await env.DB.prepare('SELECT * FROM memory_update_proposals WHERE id=?').bind(proposalId).first<{
          id:string;memory_id:string;title:string;body:string;category:string;source:string;status:string
        }>();
        if(!p)return err('Not found',404);
        if(p.status==='approved')return json({id:proposalId,status:'approved',memory_id:p.memory_id,already_applied:true});
        if(p.status!=='pending')return err('Already decided',409);
        const current=await env.DB.prepare('SELECT state,updated_at FROM memories WHERE id=?').bind(p.memory_id).first<{state:string;updated_at:string}>();
        if(!current)return err('Original memory was not found',404);
        if(current.state!=='archived')return err('Memory is not archived. Use normal approval if it is still approved.',409);
        const date=now();
        // D1 batches are atomic: restoring and applying the explicitly reviewed
        // correction must succeed together or neither becomes authoritative.
        const batch=await env.DB.batch([
          env.DB.prepare(`UPDATE memories SET title=?,body=?,category=?,source=?,state='approved',updated_at=?
            WHERE id=? AND state='archived' AND updated_at=?
            AND EXISTS (SELECT 1 FROM memory_update_proposals WHERE id=? AND status='pending')`)
            .bind(p.title,p.body,p.category,p.source,date,p.memory_id,current.updated_at,proposalId),
          env.DB.prepare(`UPDATE memory_update_proposals SET status='approved',decided_at=?
            WHERE id=? AND status='pending'
            AND EXISTS (SELECT 1 FROM memories WHERE id=? AND state='approved' AND updated_at=?)`)
            .bind(date,proposalId,p.memory_id,date),
          env.DB.prepare(`INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action)
            SELECT ?,id,title,body,category,source,?,'update' FROM memories
            WHERE id=? AND state='approved' AND updated_at=?
            AND EXISTS (SELECT 1 FROM memory_update_proposals WHERE id=? AND status='approved')`)
            .bind(crypto.randomUUID(),date,p.memory_id,date,proposalId)
        ]);
        if(batch[0].meta.changes!==1||batch[1].meta.changes!==1)return err('Restoration conflicted with another update; refresh before retrying.',409);
        return json({id:proposalId,status:'approved',memory_id:p.memory_id,restored:true});
      }
      const updateDecision=path.match(/^\/v1\/memory-updates\/([^/]+)\/(approve|reject)$/);
      if(updateDecision && method==='POST'){
        const [,proposalId,action]=updateDecision;
        if(!validId(proposalId))return err('Invalid ID',400);
        const p=await env.DB.prepare('SELECT * FROM memory_update_proposals WHERE id=?').bind(proposalId).first<{
          id:string;memory_id:string;target_updated_at:string;title:string;body:string;category:string;source:string;status:string
        }>();
        if(!p)return err('Not found',404);
        // Repeated approval can arrive after the first request was committed.
        if(p.status==='approved' && action==='approve')return json({id:proposalId,status:'approved',memory_id:p.memory_id,already_applied:true});
        if(p.status!=='pending')return err('Already decided',409);
        const timestamp=now();
        if(action==='reject'){
          const result=await env.DB.prepare("UPDATE memory_update_proposals SET status='rejected',decided_at=? WHERE id=? AND status='pending'")
             .bind(timestamp,proposalId).run();
          return result.meta.changes===1?json({id:proposalId,status:'rejected'}):err('Already decided',409);
        }
        const current=await env.DB.prepare("SELECT updated_at,state FROM memories WHERE id=?").bind(p.memory_id).first<{updated_at:string;state:string}>();
        if(!current||current.state!=='approved')return err('Target memory is no longer approved',409);
        if(current.updated_at!==p.target_updated_at)return err('Target memory was changed after this correction was proposed. Please submit a new correction.',409);
        // Concurrency guard: only apply if the approved record is still at the reviewed version.
        // The following D1 batch is transactional. If the target was modified, no mutation happens.
        const batch=await env.DB.batch([
          env.DB.prepare(`UPDATE memories SET title=?,body=?,category=?,source=?,updated_at=? WHERE id=? AND state='approved'
            AND updated_at=? AND EXISTS (SELECT 1 FROM memory_update_proposals WHERE id=? AND status='pending')`)
             .bind(p.title,p.body,p.category,p.source,timestamp,p.memory_id,p.target_updated_at,proposalId),
          env.DB.prepare(`UPDATE memory_update_proposals SET status='approved',decided_at=? WHERE id=? AND status='pending'
            AND EXISTS (SELECT 1 FROM memories WHERE id=? AND updated_at=?)`)
             .bind(timestamp,proposalId,p.memory_id,timestamp),
          env.DB.prepare(`INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action)
            SELECT ?,id,title,body,category,source,?,'update' FROM memories
            WHERE id=? AND updated_at=? AND EXISTS (SELECT 1 FROM memory_update_proposals WHERE id=? AND status='approved')`)
             .bind(crypto.randomUUID(),timestamp,p.memory_id,timestamp,proposalId)
        ]);
        // D1's metadata can differ across execution contexts; verify actual
        // committed status rather than falsely telling the owner an update failed.
        if(batch[0].meta.changes!==1||batch[1].meta.changes!==1){
          const outcome=await env.DB.prepare("SELECT status FROM memory_update_proposals WHERE id=?").bind(proposalId).first<{status:string}>();
          if(outcome?.status==='approved')return json({id:proposalId,status:'approved',memory_id:p.memory_id,already_applied:true});
          console.warn('Correction approval unexpected row counts',{memory_updated:batch[0].meta.changes,proposal_updated:batch[1].meta.changes});
          return err('Correction not approved. The memory or proposal changed while applying it. Please refresh and retry.',409);
        }
        return json({id:proposalId,status:'approved',memory_id:p.memory_id});
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
        // Insert the memory BEFORE linking the proposal to it, preserving the foreign key.
        // A deterministic ID makes concurrent approval attempts idempotent.
        const id=await proposalMemoryId(proposalId);
        const batch=await env.DB.batch([
          env.DB.prepare("INSERT OR IGNORE INTO memories (id,title,body,category,source,created_at,updated_at) SELECT ?,title,body,category,source,?,? FROM memory_proposals WHERE id=? AND status='pending'").bind(id,date,date,proposalId),
          env.DB.prepare("UPDATE memory_proposals SET status='approved',decided_at=?,accepted_memory_id=? WHERE id=? AND status='pending' AND EXISTS (SELECT 1 FROM memories WHERE id=?)").bind(date,id,proposalId,id),
          env.DB.prepare("INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) SELECT ?,id,title,body,category,source,?,'create' FROM memories WHERE id=? AND NOT EXISTS (SELECT 1 FROM memory_revisions WHERE memory_id=?)").bind(crypto.randomUUID(),date,id,id)
        ]);
        return batch[1].meta.changes===1?json({id:proposalId,status:'approved',memory_id:id}):err('Already decided',409);
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
