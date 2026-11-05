import { authorized } from './domain';
import { COOKIE_NAME, getCookie, issueSession, sessionHeaders, validFormOrigin, verifySession } from './session';

interface Env {DB:D1Database;MEMORY_API_TOKEN:string}
type Client={id:string;name:string;redirect_uris:string};
type Code={code_hash:string;client_id:string;redirect_uri:string;code_challenge:string;resource:string;scopes:string;expires_at:number;used_at:number|null};
const encoder=new TextEncoder();
const json=(v:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const fail=(code:string,description:string,status=400)=>json({error:code,error_description:description},status);
const redirect=(uri:string,extra:Record<string,string>={})=>new Response(null,{status:303,headers:{location:uri,'cache-control':'no-store',...extra}});
const html=(s:string)=>new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Memory Hub authorization</title><style>body{font:16px system-ui;color:#15233b;background:#f5f7fc;margin:5vh auto;max-width:560px;padding:20px}main{background:white;border:1px solid #d6dfea;border-radius:12px;padding:24px}input{display:block;width:100%;padding:10px;margin:12px 0;box-sizing:border-box}button{border:0;background:#174a9a;color:#fff;padding:12px;border-radius:6px;cursor:pointer}p{line-height:1.5}</style></head><body><main>'+s+'</main></body></html>',{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-frame-options':'DENY','referrer-policy':'same-origin','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
async function digest(s:string):Promise<string>{return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))))}
const resourceFor=(request:Request)=>new URL(new URL(request.url).pathname==='/grok/mcp'?'/grok/mcp':'/mcp',request.url).toString();
const approvedResource=(request:Request,resource:string)=>resource===new URL('/mcp',request.url).toString()||resource===new URL('/grok/mcp',request.url).toString();
// Pinned Grok identity and exact callback origins, from Grok's public MCP client
// metadata at https://grok.com/oauth/mcp-client.json (verified 2026-11-05).
// This is a trusted, preconfigured public OAuth client, not an open CIMD fetch.
const GROK_CLIENT_ID='https://grok.com/oauth/mcp-client.json';
const GROK_CALLBACKS=['https://grok.com/connectors-oauth-exchange-code/','https://console.x.ai/connectors-oauth-exchange-code/'];
const issuerFor=(request:Request)=>new URL(request.url).origin;
const scopeSet=['memory:read','memory:propose'];
function allowedScope(s:string){const scopes=s.split(' ').filter(Boolean);return scopes.length>0 && scopes.length<=2 && new Set(scopes).size===scopes.length && scopes.every(v=>scopeSet.includes(v))}
function redirectAllowed(value:string):boolean{
 if(value.length>1000 || /[\s#]/.test(value))return false;
 try{
  const u=new URL(value);
  if(u.username||u.password||u.hash)return false;
  if(u.protocol==='https:')return !!u.hostname && !u.hostname.endsWith('.localhost') && u.hostname!=='localhost';
  return u.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname);
 }catch{return false}
}
function validClientInput(obj:unknown):obj is {client_name?:string;redirect_uris:string[];token_endpoint_auth_method?:string;grant_types?:string[];response_types?:string[]}{
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;
 const p=obj as Record<string,unknown>;
 return Array.isArray(p.redirect_uris)&&p.redirect_uris.length>0&&p.redirect_uris.length<=5 &&
  p.redirect_uris.every(u=>typeof u==='string'&&redirectAllowed(u)) &&
  (p.client_name===undefined||(typeof p.client_name==='string'&&p.client_name.length<=100)) &&
  (p.token_endpoint_auth_method===undefined||p.token_endpoint_auth_method==='none') &&
  (p.grant_types===undefined||(Array.isArray(p.grant_types)&&p.grant_types.length===1&&p.grant_types[0]==='authorization_code')) &&
  (p.response_types===undefined||(Array.isArray(p.response_types)&&p.response_types.length===1&&p.response_types[0]==='code'));
}
const now=()=>Math.floor(Date.now()/1000);
async function clientFor(env:Env,id:string):Promise<Client|null>{
 if(id===GROK_CLIENT_ID)return {id,name:'Grok',redirect_uris:JSON.stringify(GROK_CALLBACKS)};
 if(!/^[0-9a-f-]{36}$/i.test(id))return null;
 return env.DB.prepare('SELECT id,name,redirect_uris FROM oauth_clients WHERE id=?').bind(id).first<Client>();
}
type Auth={client:Client;client_id:string;redirect_uri:string;code_challenge:string;scope:string;state:string;resource:string};
async function authorizeParams(request:Request,env:Env,query:URLSearchParams):Promise<Auth|null>{
 const client_id=query.get('client_id')||'',redirect_uri=query.get('redirect_uri')||'',code_challenge=query.get('code_challenge')||'';
 const state=query.get('state')||'',scope=query.get('scope')||'memory:read memory:propose',resource=query.get('resource')||'';
 if(query.get('response_type')!=='code'||query.get('code_challenge_method')!=='S256'|| !/^[A-Za-z0-9_-]{43}$/.test(code_challenge) ||
   state.length>500 || !allowedScope(scope) || !approvedResource(request,resource))return null;
 const client=await clientFor(env,client_id);
 if(!client||!JSON.parse(client.redirect_uris).includes(redirect_uri))return null;
 return {client,client_id,redirect_uri,code_challenge,state,scope,resource};
}
function appendAuthError(p:Auth,error:string,issuer:string){
 const u=new URL(p.redirect_uri);u.searchParams.set('error',error);if(p.state)u.searchParams.set('state',p.state);u.searchParams.set('iss',issuer);return u.toString()
}
function authorizeView(request:Request,p:Auth,login=false){
 const q=new URLSearchParams({client_id:p.client_id,redirect_uri:p.redirect_uri,response_type:'code',code_challenge:p.code_challenge,code_challenge_method:'S256',scope:p.scope,resource:p.resource,state:p.state});
 const target='/oauth/authorize?'+q.toString();
 const form=login?
  '<h2>Sign in to your private Memory Hub</h2><p>Enter your private owner access key. It stays on this server and is never sent to the assistant.</p><form action="/oauth/login" method="post"><input type="hidden" name="params" value="'+escape(q.toString())+'"><label>Owner access key<input type="password" name="secret" autocomplete="off" required></label><button type="submit">Sign in</button></form>':
  '<h2>Authorize '+escape(p.client.name)+'</h2><p>Allow this client to access your Personal AI Memory Hub?</p><p><strong>Redirect destination:</strong> '+escape(p.redirect_uri)+'</p><p><strong>Permissions:</strong> '+escape(p.scope.replace('memory:read','read approved memories').replace('memory:propose','submit pending proposals'))+'</p><p>Proposals still need your approval in the dashboard. The client cannot approve memories.</p><form action="'+escape(target)+'" method="post"><input type="hidden" name="decision" value="approve"><button type="submit">Authorize this client</button></form><p>Close this window to cancel.</p>';
 return html(form);
}
export async function oauthScopes(request:Request,env:Env):Promise<string[]|null>{
 const header=request.headers.get('authorization')||'';
 const match=/^Bearer ([A-Za-z0-9_-]{35,150})$/.exec(header);
 if(!match)return null;
 const hash=await digest(match[1]);
 const token=await env.DB.prepare('SELECT scopes FROM oauth_tokens WHERE token_hash=? AND resource=? AND expires_at>?')
  .bind(hash,resourceFor(request),now()).first<{scopes:string}>();
 return token?token.scopes.split(' '):null;
}
export const oauthChallenge=(request:Request)=>'Bearer resource_metadata="'+issuerFor(request)+(new URL(request.url).pathname==='/grok/mcp'?'/.well-known/oauth-protected-resource/grok/mcp':'/.well-known/oauth-protected-resource')+'", scope="memory:read memory:propose"';
export async function handleOAuth(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,method=request.method,base=url.origin;
 if(path==='/.well-known/oauth-protected-resource'||path==='/.well-known/oauth-protected-resource/mcp'||path==='/.well-known/oauth-protected-resource/grok/mcp'){
  if(method!=='GET')return fail('invalid_request','Only GET supported',405);
  return json({resource:path.endsWith('/grok/mcp')?new URL('/grok/mcp',base).toString():new URL('/mcp',base).toString(),authorization_servers:[base],scopes_supported:scopeSet});
 }
 if(path==='/.well-known/oauth-authorization-server'){
  if(method!=='GET')return fail('invalid_request','Only GET supported',405);
  return json({issuer:base,authorization_endpoint:base+'/oauth/authorize',token_endpoint:base+'/oauth/token',
   registration_endpoint:base+'/oauth/register',response_types_supported:['code'],
   grant_types_supported:['authorization_code'],code_challenge_methods_supported:['S256'],
   token_endpoint_auth_methods_supported:['none'],scopes_supported:scopeSet,
   authorization_response_iss_parameter_supported:true});
 }
 if(path==='/oauth/register'){
  if(method!=='POST')return fail('invalid_request','Only POST supported',405);
  let data:unknown;
  try{const raw=await request.text();if(raw.length>5000)return fail('invalid_client_metadata','Request too large',413);data=JSON.parse(raw)}
  catch{return fail('invalid_client_metadata','Invalid JSON')}
  if(!validClientInput(data))return fail('invalid_client_metadata','Invalid public client registration');
  const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM oauth_clients').first<{count:number}>();
  if(Number(count?.count??0)>=100)return fail('invalid_client_metadata','Client registration quota reached',429);
  const name=(data.client_name||'Unverified MCP client').trim()||'Unverified MCP client',id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO oauth_clients (id,name,redirect_uris,created_at) VALUES (?,?,?,?)')
   .bind(id,name,JSON.stringify(data.redirect_uris),new Date().toISOString()).run();
  return json({client_id:id,client_name:name,redirect_uris:data.redirect_uris,token_endpoint_auth_method:'none',
   grant_types:['authorization_code'],response_types:['code']},201);
 }
 if(path==='/oauth/authorize'){
  if(method==='GET'){
   const p=await authorizeParams(request,env,url.searchParams);
   if(!p)return html('<h2>Invalid authorization request</h2><p>The client registration, redirect, PKCE, resource, or requested scope is invalid.</p>');
   const signedIn=await verifySession(getCookie(request.headers.get('cookie'),COOKIE_NAME),env.MEMORY_API_TOKEN);
   return authorizeView(request,p,!signedIn);
  }
  if(method==='POST'){
   if(!validFormOrigin(request))return fail('invalid_request','Invalid form origin',403);
   if(!await verifySession(getCookie(request.headers.get('cookie'),COOKIE_NAME),env.MEMORY_API_TOKEN))return fail('access_denied','Owner sign-in required',403);
   const p=await authorizeParams(request,env,url.searchParams);
   if(!p)return fail('invalid_request','Invalid authorization parameters');
   const form=await request.formData();if(form.get('decision')!=='approve')return redirect(appendAuthError(p,'access_denied',base));
   const code=random(),codeHash=await digest(code);
   await env.DB.prepare('INSERT INTO oauth_codes (code_hash,client_id,redirect_uri,code_challenge,resource,scopes,expires_at) VALUES (?,?,?,?,?,?,?)')
    .bind(codeHash,p.client_id,p.redirect_uri,p.code_challenge,p.resource,p.scope,now()+300).run();
   const callback=new URL(p.redirect_uri);callback.searchParams.set('code',code);
   if(p.state)callback.searchParams.set('state',p.state);callback.searchParams.set('iss',base);
   return redirect(callback.toString());
  }
  return fail('invalid_request','Unsupported method',405);
 }
 if(path==='/oauth/login'){
  if(method!=='POST')return fail('invalid_request','Unsupported method',405);
  if(!validFormOrigin(request))return fail('invalid_request','Invalid form origin',403);
  const form=await request.formData(),params=String(form.get('params')||'');
  if(params.length>4000)return fail('invalid_request','Invalid sign-in request');
  const target=new URL('/oauth/authorize?'+params,base);
  const p=await authorizeParams(request,env,target.searchParams);
  if(!p)return fail('invalid_request','Invalid authorization parameters');
  const key=String(form.get('secret')||'');
  if(!authorized('Bearer '+key,env.MEMORY_API_TOKEN))return html('<h2>Sign-in failed</h2><p>Invalid owner access key.</p>');
  return redirect(target.toString(),sessionHeaders(await issueSession(env.MEMORY_API_TOKEN)));
 }
 if(path==='/oauth/token'){
  if(method!=='POST')return fail('invalid_request','Unsupported method',405);
  if(!(request.headers.get('content-type')||'').includes('application/x-www-form-urlencoded'))return fail('invalid_request','Form-encoded request required',415);
  const raw=await request.text();if(raw.length>4000)return fail('invalid_request','Request too large',413);
  const form=new URLSearchParams(raw);
  if(form.get('grant_type')!=='authorization_code')return fail('unsupported_grant_type','Only authorization_code is supported');
  const client_id=form.get('client_id')||'',code=form.get('code')||'',verifier=form.get('code_verifier')||'',redirectUri=form.get('redirect_uri')||'',resource=form.get('resource')||'';
  if(!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)|| !code || !approvedResource(request,resource))return fail('invalid_grant','Invalid PKCE or resource');
  const client=await clientFor(env,client_id);
  if(!client||!JSON.parse(client.redirect_uris).includes(redirectUri))return fail('invalid_client','Unknown client or redirect');
  const hash=await digest(code);
  const pending=await env.DB.prepare('SELECT * FROM oauth_codes WHERE code_hash=?').bind(hash).first<Code>();
  if(!pending||pending.client_id!==client_id||pending.redirect_uri!==redirectUri||pending.resource!==resource||pending.expires_at<=now()||pending.used_at!==null ||
    await digest(verifier)!==pending.code_challenge)return fail('invalid_grant','Expired, reused or mismatched authorization code');
  // Single-use exchange. Only the first simultaneous request may claim the code.
  const claimed=await env.DB.prepare('UPDATE oauth_codes SET used_at=? WHERE code_hash=? AND used_at IS NULL AND expires_at>?').bind(now(),hash,now()).run();
  if(claimed.meta.changes!==1)return fail('invalid_grant','Authorization code already used');
  const token=random();
  await env.DB.prepare('INSERT INTO oauth_tokens (token_hash,client_id,resource,scopes,expires_at,created_at) VALUES (?,?,?,?,?,?)')
   .bind(await digest(token),client_id,resource,pending.scopes,now()+3600,now()).run();
  return json({access_token:token,token_type:'Bearer',expires_in:3600,scope:pending.scopes},200,{'cache-control':'no-store','pragma':'no-cache'});
 }
 return null;
}
