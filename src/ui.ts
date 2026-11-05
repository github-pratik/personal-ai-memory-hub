import { authorized, validateMemoryInput } from './domain';
import { COOKIE_NAME, getCookie, issueSession, removeSessionHeaders, sessionHeaders, validFormOrigin, verifySession } from './session';

interface Env {DB:D1Database;MEMORY_API_TOKEN:string; ACCESS_REQUIRED?:string; ACCESS_ALLOWED_EMAIL?:string}
type InternalApi=(path:string,method:string,body?:unknown)=>Promise<Response>;
type Row={id:string;title:string;body:string;category:string;source:string;status?:string;created_at:string;updated_at?:string};

export function escapeHtml(value:unknown):string {
 return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
}
const css=`
*{box-sizing:border-box}body{margin:0;background:#f7f8fb;color:#16233d;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5}
main{max-width:1120px;margin:0 auto;padding:28px 24px 80px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}
h1{font-size:26px;letter-spacing:-.6px;margin:0}h2{font-size:18px;margin:0 0 12px}h3{font-size:16px;margin:0}
small,.muted{color:#59677d}p{margin:7px 0 14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.card{background:white;border:1px solid #dbe1ea;border-radius:12px;padding:20px;box-shadow:0 3px 12px rgba(30,50,90,.035)}
.item{padding:14px 0;border-bottom:1px solid #e7eaf0}.item:last-child{border-bottom:none}.tag{font-size:11px;border-radius:12px;background:#ebf2fc;padding:4px 8px;color:#254d85}
label{display:block;font-weight:600;font-size:13px;margin:10px 0 5px}
input,select,textarea{width:100%;border:1px solid #b9c5d6;background:#fff;border-radius:7px;padding:10px;color:#16233d;font:inherit}
textarea{min-height:88px;resize:vertical}button,.button{background:#174a9a;border:0;color:white;border-radius:7px;padding:10px 13px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
button.secondary,.button.secondary{background:#edf2f9;color:#1b437d}.row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.row form{display:inline}.spaced{justify-content:space-between}.body{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}
.login{max-width:430px;margin:12vh auto}.error{color:#9a2626}.search{margin-bottom:18px}.search .row input{flex:1}
@media(max-width:760px){.grid{grid-template-columns:1fr}main{padding:20px 14px}h1{font-size:22px}header{align-items:flex-start}}
`;
const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const page=(body:string)=>new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Personal AI Memory Hub</title><style>${css}</style></head><body><main>${body}</main></body></html>`,{headers});
const redirect=(to:string,extra:Record<string,string>={})=>new Response(null,{status:303,headers:{location:to,'cache-control':'no-store',...extra}});
const e=(v:unknown)=>escapeHtml(v);
const simpleError=(message:string,status:number)=>new Response(`Error: ${message}`,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
const loginPage=(error=false)=>page(`<div class="login card"><h1>Personal AI Memory Hub</h1><p class="muted">Private memory and career evidence, available across your devices.</p>${error?'<p class="error">Invalid access key.</p>':''}<form method="post" action="/login"><label for="secret">Private access key</label><input id="secret" name="secret" type="password" autocomplete="off" required><p><button type="submit">Sign in</button></p></form><small>Never share your access key. Your facts are not stored in this public source repository.</small></div>`);
function card(r:Row,proposal=false):string{
 const actions=proposal?`<div class="row"><form action="/ui/proposals/${e(r.id)}/approve" method="post"><button type="submit">Approve</button></form><form action="/ui/proposals/${e(r.id)}/reject" method="post"><button class="secondary" type="submit">Reject</button></form></div>`:`<form action="/ui/memories/${e(r.id)}/archive" method="post"><button class="secondary" type="submit">Archive</button></form>`;
 return `<article class="item"><div class="row spaced"><h3>${e(r.title)}</h3><span class="tag">${e(r.category)}</span></div><p class="body">${e(r.body)}</p><p class="muted"><small>Source: ${e(r.source)}</small></p>${actions}</article>`;
}
function dashboard(memories:Row[],proposals:Row[],q:string,accessMode=false):Response{
 const memoryList=memories.map(r=>card(r)).join('')||'<p class="muted">No matching memories yet. Add verified evidence below.</p>';
 const proposalList=proposals.map(r=>card(r,true)).join('')||'<p class="muted">No pending proposals.</p>';
 return page(`<header><div><h1>Personal AI Memory Hub</h1><small>Career evidence and project history · private workspace</small></div><div class="row"><a class="button secondary" href="/export">Export backup</a>${accessMode?'<a class="button secondary" href="/cdn-cgi/access/logout">Sign out</a>':'<form action="/logout" method="post"><button class="secondary">Sign out</button></form>'}</div></header>
 <section class="card" style="margin-bottom:20px"><h2>Match experience to a job description</h2><p class="muted">Paste a job description to rank verified experience and projects without paid AI calls. Nothing is saved.</p><form method="post" action="/ui/job-match"><label>Job description</label><textarea name="job_description" required minlength="15" maxlength="12000" placeholder="Paste the role requirements here"></textarea><p><button>Find matching experience</button></p></form></section>
 <section class="search card"><h2>Search verified memories</h2><form action="/" method="get" class="row"><input name="q" placeholder="Try Python, Slack, PostgreSQL or a job requirement" value="${e(q)}" maxlength="200"><button>Search</button></form></section>
 <div class="grid"><section class="card"><div class="row spaced"><h2>Verified memories (${memories.length})</h2><span class="tag">Approved</span></div>${memoryList}</section>
 <section><div class="card"><h2>Add verified experience</h2><p class="muted">Only enter facts you can support. AI agents should submit proposals instead.</p><form action="/ui/memories" method="post"><label>Title</label><input name="title" maxlength="160" required placeholder="IndustrialBriefs Slack integration"><label>Category</label><select name="category"><option value="project">Project</option><option value="experience">Experience</option><option value="skill">Skill</option><option value="education">Education</option><option value="preference">Preference</option><option value="other">Other</option></select><label>Details</label><textarea name="body" maxlength="12000" required placeholder="What you built, why, how, and what it achieved"></textarea><label>Evidence source</label><input name="source" maxlength="500" required placeholder="Personal confirmation / GitHub commit / reference"><p><button>Add memory</button></p></form></div>
 <div class="card" style="margin-top:20px"><h2>Bulk import career records</h2><p class="muted">Paste a JSON array of verified facts. This stays in your private database and is not published to GitHub. Maximum 25 at a time.</p><form action="/ui/import" method="post" enctype="multipart/form-data"><label>Optional backup JSON file</label><input type="file" name="file" accept=".json,application/json"><label>Or paste JSON memory records</label><textarea name="records" maxlength="150000" placeholder='[{"title":"Example project","body":"What you built","category":"project","source":"Personal confirmation"}]'></textarea><p><button class="secondary" type="submit">Import memories</button></p></form></div>
 <div class="card" style="margin-top:20px"><h2>Proposed memories (${proposals.length})</h2><p class="muted">Review facts before AI suggestions become trusted memory.</p>${proposalList}</div></section></div>`);
}
async function records(db:D1Database,table:string):Promise<unknown[]>{
 const all:unknown[]=[];
 for(let offset=0;offset<100000;offset+=500){
   const result=await db.prepare(`SELECT * FROM ${table} LIMIT 500 OFFSET ?`).bind(offset).all();
   all.push(...result.results);
   if(result.results.length<500)return all;
 }
 throw new Error('Export exceeds supported record limit');
}
export async function handleUi(request:Request,env:Env,internal:InternalApi,accessAuthorized=false):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(!['/','/login','/logout','/export'].includes(path)&&!path.startsWith('/ui/'))return null;
 if(env.ACCESS_REQUIRED==='true'&&!accessAuthorized)return simpleError('Cloudflare Access authentication required',403);
 if(env.ACCESS_REQUIRED==='true'&&path==='/login')return redirect('/');
 if(env.ACCESS_REQUIRED!=='true'&&path==='/login'&&method==='POST'){
   if(!validFormOrigin(request))return simpleError('Origin validation failed',403);
   const form=await request.formData(),key=String(form.get('secret')||'');
   if(!authorized('Bearer '+key,env.MEMORY_API_TOKEN))return loginPage(true);
   return redirect('/',sessionHeaders(await issueSession(env.MEMORY_API_TOKEN)));
 }
 const session=env.ACCESS_REQUIRED==='true'&&accessAuthorized || await verifySession(getCookie(request.headers.get('cookie'),COOKIE_NAME),env.MEMORY_API_TOKEN);
 if(!session){
   if(method==='GET'&&(path==='/'||path==='/login'))return loginPage();
   return redirect('/');
 }
 if(method==='POST'&&!validFormOrigin(request))return simpleError('Origin validation failed',403);
 if(path==='/logout'&&method==='POST')return env.ACCESS_REQUIRED==='true'?redirect('/cdn-cgi/access/logout'):redirect('/',removeSessionHeaders);
 if(path==='/export'&&method==='GET'){
   try{
     const [memories,revisions,proposals]=await Promise.all([
       records(env.DB,'memories'),records(env.DB,'memory_revisions'),records(env.DB,'memory_proposals')
     ]);
     const data=JSON.stringify({version:1,exported_at:new Date().toISOString(),memories,revisions,proposals},null,2);
     return new Response(data,{headers:{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="personal-ai-memory-backup.json"','cache-control':'no-store','x-content-type-options':'nosniff'}});
   }catch{return simpleError('Export failed',500)}
 }
 if(path==='/ui/import'&&method==='POST'){
   const form=await request.formData();
   const file=form.get('file');
   let raw=String(form.get('records')||'');
   if(file&&typeof file!=='string'&&file.size>0){
     if(file.size>1000000)return simpleError('Backup too large',413);
     raw=await file.text();
   }
   if(raw.length>1000000)return simpleError('Import too large',413);
   let data:unknown;
   try{data=JSON.parse(raw)}catch{return simpleError('Invalid JSON import',400)}
   let records:unknown;
   if(Array.isArray(data))records=data;
   else if(data&&typeof data==='object'&&!Array.isArray(data)&&Array.isArray((data as Record<string,unknown>).memories)){
     records=((data as {memories:Array<Record<string,unknown>>}).memories).filter(m=>m&&m.state==='approved');
   }
   if(!Array.isArray(records)||records.length<1||records.length>500)return simpleError('Expected 1–500 approved memory records',400);
   for(let i=0;i<records.length;i+=25){
     const response=await internal('/v1/import','POST',{items:records.slice(i,i+25)});
     if(!response.ok)return simpleError('Import interrupted. Existing records are not duplicated; retry after checking the source.',response.status);
   }
   return redirect('/');
 }
 if(path==='/ui/job-match'&&method==='POST'){
   const form=await request.formData(),job=String(form.get('job_description')||'');
   const response=await internal('/v1/resume-context','POST',{job_description:job});
   if(!response.ok)return simpleError('Could not match job description',response.status);
   const result=await response.json() as {matches:Array<Row & {score:number;matched_keywords:string[]}>;searched:number};
   const cards=result.matches.map(r=>'<article class="item"><div class="row spaced"><h3>'+e(r.title)+'</h3><span class="tag">'+e(r.category)+'</span></div><p class="body">'+e(r.body)+'</p><p><small>Evidence source: '+e(r.source)+'</small></p><small>Matched terms: '+e(r.matched_keywords.join(', '))+'</small></article>').join('');
   return page('<header><h1>Relevant career evidence</h1><a class="button secondary" href="/">Back to dashboard</a></header><section class="card"><h2>Best matches ('+result.matches.length+')</h2><p class="muted">Ranked from '+result.searched+' approved memories. Matching does not verify a claim; always check the source before using it in a resume.</p>'+(cards||'<p>No matching approved evidence. Add more verified experience first.</p>')+'</section>');
 }
 if(path==='/ui/memories'&&method==='POST'){
   const form=await request.formData();
   const input=Object.fromEntries(['title','body','category','source'].map(k=>[k,String(form.get(k)||'')]));
   if(!validateMemoryInput(input).ok)return simpleError('Invalid memory data',400);
   const response=await internal('/v1/memories','POST',input);
   return response.ok?redirect('/'):simpleError('Memory could not be saved',response.status);
 }
 const decision=path.match(/^\/ui\/proposals\/([^/]+)\/(approve|reject)$/);
 if(decision&&method==='POST'){
   const response=await internal('/v1/proposals/'+decision[1]+'/'+decision[2],'POST');
   return response.ok?redirect('/'):simpleError('Proposal action failed',response.status);
 }
 const archive=path.match(/^\/ui\/memories\/([^/]+)\/archive$/);
 if(archive&&method==='POST'){
   const response=await internal('/v1/memories/'+archive[1],'DELETE');
   return response.ok?redirect('/'):simpleError('Archive failed',response.status);
 }
 if(method==='GET'&&(path==='/'||path==='/login')){
   if(!env.DB)return simpleError('Database not configured',503);
   const q=(url.searchParams.get('q')||'').slice(0,200);
   try{
     const sql="SELECT id,title,body,category,source,created_at,updated_at FROM memories WHERE state='approved'"+(q?' AND (instr(lower(title),lower(?))>0 OR instr(lower(body),lower(?))>0)':'')+" ORDER BY updated_at DESC LIMIT 100";
     const mem=await env.DB.prepare(sql).bind(...(q?[q,q]:[])).all<Row>();
     const prop=await env.DB.prepare("SELECT id,title,body,category,source,created_at FROM memory_proposals WHERE status='pending' ORDER BY created_at DESC LIMIT 100").all<Row>();
     return dashboard(mem.results,prop.results,q,env.ACCESS_REQUIRED==='true');
   }catch{return simpleError('Dashboard unavailable',500)}
 }
 return simpleError('Not found',404);
}
