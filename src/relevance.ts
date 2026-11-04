export type Evidence={id:string;title:string;body:string;category:string;source:string;created_at?:string;updated_at?:string};
const STOPWORDS=new Set('the and for with from your our they them that this those there their about what when where into onto will have has had are was were been being you can should must would could also using used some very each per via plus role work need looking build builds building developed developing development experience developer software engineering engineer junior senior technical good strong skills familiarity knowledge ability ability requirements preferred responsibilities company year years operations systems system team teams use users services service'.split(' '));
export function keywords(text:string):string[]{
 const matches=text.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,35}/g)||[];
 return [...new Set(matches.filter(w=>w.length>2&&!STOPWORDS.has(w)))].slice(0,250);
}
export function rankEvidence(items:Evidence[],jobDescription:string,max=12){
 const target=new Set(keywords(jobDescription));
 const ranked=items.map(item=>{
   const head=new Set(keywords(item.title+' '+item.category));
   const body=new Set(keywords(item.body+' '+item.source));
   const matched=[...target].filter(word=>head.has(word)||body.has(word));
   const score=matched.reduce((sum,word)=>sum+(head.has(word)?3:1),0);
   return {id:item.id,title:item.title,body:item.body,category:item.category,source:item.source,score,matched_keywords:matched.slice(0,25),updated_at:item.updated_at};
 }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
 return ranked.slice(0,max);
}
