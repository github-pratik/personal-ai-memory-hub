import { authorized, safeLimit, validateMemoryInput, validId } from './domain';

interface Env { DB: D1Database; MEMORY_API_TOKEN: string }
const json = (data:unknown, status=200) => new Response(JSON.stringify(data), {
  status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
});
const err=(message:string,status:number)=>json({error:message},status);
const stamp=()=>new Date().toISOString();
const corsSafeHeaders={'cache-control':'no-store','x-content-type-options':'nosniff'};

async function parseJson(request:Request):Promise<unknown>{
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new Error('Content-Type must be application/json');
  if(Number(request.headers.get('content-length')||0)>16000)throw new Error('Request too large');
  const text=await request.text();
  if(text.length>16000)throw new Error('Request too large');
  return JSON.parse(text);
}
async function snapshot(env:Env,id:string,action:'create'|'update'|'archive',record:{title:string;body:string;category:string;source:string},now:string){
  await env.DB.prepare('INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) VALUES (?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),id,record.title,record.body,record.category,record.source,now,action).run();
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);const path=url.pathname;const method=request.method;
    if(path==='/health' && method==='GET')return json({status:'ok',service:'personal-ai-memory-hub',version:'0.1.0'});
    if(!authorized(request.headers.get('authorization'),env.MEMORY_API_TOKEN))return err('Unauthorized',401);
    if(!env.DB)return err('Database binding missing',503);
    try {
      if(path==='/v1/memories' && method==='GET'){
        const limit=safeLimit(url.searchParams.get('limit')),q=(url.searchParams.get('q')||'').trim(),category=url.searchParams.get('category');
        if(q.length>200)return err('Query too long',400);
        if(category && !['experience','project','skill','education','preference','other'].includes(category))return err('Invalid category',400);
        const where=["state='approved'"],args:unknown[]=[];
        if(category){where.push('category=?');args.push(category)}
        if(q){where.push('(title LIKE ? ESCAPE \'\\\' OR body LIKE ? ESCAPE \'\\\')');const escaped=q.replace(/[\\%_]/g,'\\$&');args.push('%'+escaped+'%','%'+escaped+'%')}
        const statement='SELECT id,title,body,category,source,state,created_at,updated_at FROM memories WHERE '+where.join(' AND ')+' ORDER BY updated_at DESC LIMIT ?';
        const result=await env.DB.prepare(statement).bind(...args,limit).all();
        return json({items:result.results});
      }
      if(path==='/v1/memories' && method==='POST'){
        const data=validateMemoryInput(await parseJson(request));
        if(!data.ok)return err(data.error,400);
        const id=crypto.randomUUID(),now=stamp(),v=data.value;
        // Save memory + initial revision atomically.
        await env.DB.batch([
          env.DB.prepare('INSERT INTO memories (id,title,body,category,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,v.title,v.body,v.category,v.source,now,now),
          env.DB.prepare('INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,v.title,v.body,v.category,v.source,now,'create')
        ]);
        return json({id,...v,state:'approved',created_at:now},201);
      }
      const match=path.match(/^\/v1\/memories\/([^/]+)$/);
      if(match){
        const id=match[1];if(!validId(id))return err('Invalid ID',400);
        if(method==='GET'){
          const row=await env.DB.prepare('SELECT * FROM memories WHERE id=?').bind(id).first();
          return row?json(row):err('Not found',404);
        }
        if(method==='PATCH'){
          const data=validateMemoryInput(await parseJson(request));if(!data.ok)return err(data.error,400);
          const old=await env.DB.prepare("SELECT id,state FROM memories WHERE id=?").bind(id).first();
          if(!old || old.state!=='approved')return err('Not found',404);
          const v=data.value,now=stamp();
          await env.DB.batch([
            env.DB.prepare('UPDATE memories SET title=?,body=?,category=?,source=?,updated_at=? WHERE id=?').bind(v.title,v.body,v.category,v.source,now,id),
            env.DB.prepare('INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,v.title,v.body,v.category,v.source,now,'update')
          ]);
          return json({id,...v,updated_at:now});
        }
        if(method==='DELETE'){
          const row=await env.DB.prepare("SELECT * FROM memories WHERE id=? AND state='approved'").bind(id).first<{title:string;body:string;category:string;source:string}>();
          if(!row)return err('Not found',404);
          const now=stamp();
          await env.DB.batch([
            env.DB.prepare("UPDATE memories SET state='archived',updated_at=? WHERE id=?").bind(now,id),
            env.DB.prepare('INSERT INTO memory_revisions (id,memory_id,title,body,category,source,changed_at,action) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,row.title,row.body,row.category,row.source,now,'archive')
          ]);
          return json({id,state:'archived'});
        }
      }
      if(path==='/v1/proposals' && method==='POST'){
        const data=validateMemoryInput(await parseJson(request));if(!data.ok)return err(data.error,400);
        const id=crypto.randomUUID(),now=stamp(),v=data.value;
        await env.DB.prepare('INSERT INTO memory_proposals (id,title,body,category,source,created_at) VALUES (?,?,?,?,?,?)').bind(id,v.title,v.body,v.category,v.source,now).run();
        return json({id,status:'pending'},201);
      }
      if(path==='/v1/proposals' && method==='GET'){
        const result=await env.DB.prepare("SELECT * FROM memory_proposals ORDER BY created_at DESC LIMIT ?").bind(safeLimit(url.searchParams.get('limit'))).all();
        return json({items:result.results});
      }
      return err('Not found',404);
    }catch(e){
      if(e instanceof SyntaxError)return err('Invalid JSON',400);
      if(e instanceof Error && (e.message==='Request too large'||e.message.startsWith('Content-Type')))return err(e.message,e.message==='Request too large'?413:415);
      console.error('Request processing failed');return err('Internal server error',500);
    }
  }
};
