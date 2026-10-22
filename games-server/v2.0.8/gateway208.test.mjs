import assert from 'node:assert/strict';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { gateway208,validateLeague208,validateEditor208 } from './gateway208.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const teams=Object.fromEntries(Array.from({length:36},(_,i)=>['t'+i,'Team '+i])),groups=[0,1,2].map(d=>Object.keys(teams).slice(d*12,d*12+12));
const season={id:'s',name:'Season',closed:false,teams,groups,teamMeta:Object.fromEntries(Object.keys(teams).map(t=>[t,{image:null,players:[]}])) ,penalties:{},activeCompetitions:[true,true,false,true],fixtures:groups.map((g,d)=>Array.from({length:22},(_,r)=>Array.from({length:6},(_,i)=>({id:`m-${d}-${r}-${i}`,h:g[2*i],w:g[2*i+1],a:null,b:null,scorers:[[],[]],assists:[[],[]]})))),cup:null,playoffs:null,summary:null};
const original={schema:2,images:{},seasons:[season]},head={format:22,revision:crypto.randomUUID(),pages:1,hash:hash(JSON.stringify(original)),assets:[],imageRefs:{}};
validateLeague208(original,head);
const next=structuredClone(original);next.seasons[0].fixtures[0][0][0].a=2;next.seasons[0].fixtures[0][0][0].b=0;next.seasons[0].teamMeta.t0.players.push({id:'p',name:'Player',image:null,active:true,number:9,position:'DC'});next.seasons[0].teams.t0='Renamed';validateEditor208(original,next,head,head,false);
for(const change of [s=>s.seasons[0].groups[0].reverse(),s=>s.seasons[0].activeCompetitions[2]=true,s=>s.seasons[0].fixtures[2][0][0].a=s.seasons[0].fixtures[2][0][0].b=1,s=>s.seasons.push({...structuredClone(season),id:'new'})]){const s=structuredClone(original);change(s);assert.throws(()=>validateEditor208(original,s,head,head,false));}
const closed=structuredClone(original);closed.seasons[0].closed=true;closed.seasons[0].summary={champions:['t0','t12',null],movements:[],cupChampion:'t0'};const modified=structuredClone(closed);modified.seasons[0].teams.t0='Changed history';assert.throws(()=>validateEditor208(closed,modified,head,head,false));
// Validate the downloaded public snapshot if available, without sending any write.
if(fs.existsSync('audit208/live-league.json'))validateLeague208(JSON.parse(fs.readFileSync('audit208/live-league.json')),JSON.parse(fs.readFileSync('audit208/live-head.json')));
const encode=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,typeof v==='string'?{stringValue:v}:typeof v==='number'?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(s=>({stringValue:s}))}}:{mapValue:{fields:encode(v)}}]));
const decode=f=>Object.fromEntries(Object.entries(f).map(([k,v])=>[k,v.stringValue??(v.integerValue!==undefined?Number(v.integerValue):v.arrayValue?v.arrayValue.values.map(x=>x.stringValue):decode(v.mapValue.fields))]));
const {privateKey}=await generateKeyPair('RS256',{extractable:true});const env={OWNER_UID:'owner',FIREBASE_PROJECT_ID:'test',FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'test',client_email:'test@test.iam.gserviceaccount.com',private_key:await exportPKCS8(privateKey)})};
let update=1,liveHead=head;const pages=new Map([[head.revision+'-0',{revision:head.revision,index:0,text:JSON.stringify(original)}]]);let commits=0;
globalThis.fetch=async (url,opts)=>{
 if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'test-token',expires_in:3600});
 const path=url.split('/documents')[1];
 if(path==='/leagues/main/data/head')return Response.json({fields:encode(liveHead),updateTime:'2026-10-20T00:00:0'+update+'Z'});
 if(path.startsWith('/leagues/main/data/')){const p=pages.get(path.split('/').at(-1));assert(p);return Response.json({fields:encode(p)});}
 if(path===':commit'){
  const {writes}=JSON.parse(opts.body);commits++;
  for(const w of writes){const key=w.update.name.split('/').at(-1);if(key==='head'){if(w.currentDocument.updateTime!=='2026-10-20T00:00:0'+update+'Z')return Response.json({error:'conflict'},{status:409});liveHead=decode(w.update.fields);update++;}else{assert.equal(w.currentDocument.exists,false);assert(!pages.has(key));pages.set(key,decode(w.update.fields));}}
  return Response.json({commitTime:'ok'});
 }
 throw Error('Unexpected network request: '+url);
};
const user={sub:'moderator'},ctx={env,request:new Request('https://test/league/publish',{method:'POST'}),moderator:async()=>true};
const text=JSON.stringify(next),body={base:head.revision,text,head:{...head,hash:hash(text)}};
const cap=await gateway208('/league/capabilities',{},user,{...ctx,request:new Request('https://test/league/capabilities')});assert(cap.configured);
const ready=await gateway208('/league/check',{}, {sub:'owner'},ctx);assert(ready.ready);
const published=await gateway208('/league/publish',body,user,ctx);assert.notEqual(published.head.revision,head.revision);assert.equal(published.head.hash,hash(text));assert.equal(commits,2);
await assert.rejects(()=>gateway208('/league/publish',body,user,ctx),e=>e.code==='cloud/conflict');assert.equal(commits,2);
await assert.rejects(()=>gateway208('/league/publish',body,{sub:'reader'},{...ctx,moderator:async()=>false}),e=>e.status===403);
await assert.rejects(()=>gateway208('/league/publish',{...body,base:liveHead.revision,text:text+'x'},user,ctx));assert.equal(commits,2);
console.log('PASS gateway schema, live snapshot compatibility, moderator team edits, protected settings/history, OAuth, immutable pages, CAS publication, stale revision and reader rejection.');
