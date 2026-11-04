export const CATEGORIES = ['experience','project','skill','education','preference','other'] as const;
export type Category = typeof CATEGORIES[number];
export type MemoryInput = {title: string; body: string; category: Category; source: string};
export type Result = {ok: true; value: MemoryInput} | {ok: false; error: string};

export function validateMemoryInput(data: unknown): Result {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {ok:false,error:'Expected JSON object'};
  const d = data as Record<string,unknown>;
  for (const [key,max] of [['title',160],['body',12000],['source',500]] as const) {
    if (typeof d[key] !== 'string' || !d[key].trim() || d[key].length > max) return {ok:false,error:`Invalid ${key}`};
  }
  if (typeof d.category !== 'string' || !CATEGORIES.includes(d.category as Category)) return {ok:false,error:'Invalid category'};
  return {ok:true,value:{title:(d.title as string).trim(),body:(d.body as string).trim(),source:(d.source as string).trim(),category:d.category as Category}};
}
export function validId(v:string):boolean {return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);}
export function safeLimit(v:string|null):number {const n=Number(v??25);return Number.isInteger(n)?Math.min(100,Math.max(1,n)):25;}
export function authorized(header:string|null,secret:string|undefined):boolean {
  if(!secret || secret.startsWith('REPLACE_') || secret.length<32 || !header?.startsWith('Bearer '))return false;
  const token=header.slice(7);if(token.length!==secret.length)return false;
  let mismatch=0;for(let i=0;i<token.length;i++)mismatch|=token.charCodeAt(i)^secret.charCodeAt(i);
  return mismatch===0;
}
