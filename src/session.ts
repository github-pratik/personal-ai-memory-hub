export const COOKIE_NAME='pamh_session';
const encoder=new TextEncoder();
function bytesToHex(bytes:Uint8Array):string{return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function signature(payload:string,secret:string):Promise<string>{
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload))));
}
function safeEqual(a:string,b:string):boolean{
 if(a.length!==b.length)return false;
 let different=0;
 for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);
 return different===0;
}
export async function issueSession(secret:string,at=Date.now()):Promise<string>{
 const nonce=crypto.randomUUID();
 const payload=`${Math.floor((at+12*60*60*1000)/1000)}.${nonce}`;
 return payload+'.'+await signature(payload,secret);
}
export async function verifySession(cookie:string|null,secret:string|undefined,at=Date.now()):Promise<boolean>{
 if(!cookie||!secret||secret.startsWith('REPLACE_')||secret.length<32)return false;
 const parts=cookie.split('.');
 if(parts.length!==3||!/^[0-9]{9,12}$/.test(parts[0])||!/^[0-9a-f-]{36}$/.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[2]))return false;
 const expiry=Number(parts[0]),now=Math.floor(at/1000);
 if(expiry<now||expiry>now+12*60*60+60)return false;
 const payload=parts[0]+'.'+parts[1];
 return safeEqual(parts[2],await signature(payload,secret));
}
export function getCookie(header:string|null,name:string):string|null{
 const found=(header||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));
 return found?found.slice(name.length+1):null;
}
export const sessionHeaders=(session:string)=>({
 'set-cookie':`${COOKIE_NAME}=${session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200`
});
export const removeSessionHeaders={
 'set-cookie':`${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`
};
export function validFormOrigin(request:Request):boolean{
 const origin=request.headers.get('origin');
 return origin!==null && origin===new URL(request.url).origin;
}
