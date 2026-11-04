import type { MemoryInput } from './domain';

async function stableId(canonical:string):Promise<string>{
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical))).slice(0,16);
 bytes[6]=(bytes[6]&0x0f)|0x80; // UUID v8, deterministic from content.
 bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}

export function stableMemoryId(input:MemoryInput):Promise<string>{return stableId([input.category,input.title,input.body,input.source].join('\u0000'));}
export function proposalMemoryId(proposalId:string):Promise<string>{return stableId('approved-proposal\u0000'+proposalId);}
