// Public, credential-free OAuth/MCP diagnostics. Never print secrets or memory contents.
const base='https://personal-ai-memory-hub.p-pshpatil.workers.dev';
const results=[];
async function check(label,path,init={},expected=200){
 try{
  const response=await fetch(base+path,{...init,signal:AbortSignal.timeout(12000)});
  const body=await response.text();
  let data;try{data=JSON.parse(body)}catch{}
  const record={label,status:response.status,content_type:response.headers.get('content-type')};
  if(label==='resource')record.resource=data?.resource,record.authorization_servers=data?.authorization_servers;
  if(label==='issuer')record.issuer=data?.issuer,record.registration_endpoint=data?.registration_endpoint,record.scopes_supported=data?.scopes_supported;
  if(label==='initialize')record.name=data?.result?.serverInfo?.name,record.error=data?.error?.message;
  if(label==='tools')record.tool_count=data?.result?.tools?.length,record.names=data?.result?.tools?.map(x=>x.name),record.security=data?.result?.tools?.map(x=>x.securitySchemes);
  if(label==='challenge')record.www_authenticate=!!response.headers.get('www-authenticate'),record.resource_metadata=(response.headers.get('www-authenticate')||'').includes('resource_metadata=');
  results.push(record);console.log(JSON.stringify(record));
  if(response.status!==expected)process.exitCode=1;
 }catch(e){console.log(JSON.stringify({label,error:String(e).slice(0,180)}));process.exitCode=1}
}
const rpc=(method,params)=>({method:'POST',headers:{'content-type':'application/json','accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:14,method,params})});
await check('health','/health');
await check('resource','/.well-known/oauth-protected-resource');
await check('resource_mcp','/.well-known/oauth-protected-resource/mcp');
await check('issuer','/.well-known/oauth-authorization-server');
await check('initialize','/mcp',rpc('initialize',{protocolVersion:'2025-06-18',clientInfo:{name:'remote-probe',version:'1'},capabilities:{}}));
await check('tools','/mcp',rpc('tools/list'));
await check('challenge','/mcp',rpc('tools/call',{name:'search_memory',arguments:{query:'does-not-read'}}),401);
