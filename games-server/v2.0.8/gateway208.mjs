import { SignJWT, importPKCS8 } from 'jose';
const LIMIT=16*1024*1024, HEX=/^[a-f0-9]{64}$/, ID=/^[-a-zA-Z0-9]{1,100}$/;
const fail=(message,status=400,code)=>{const e=new Error(message);e.status=status;e.code=code;e.expose208=true;throw e;};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const stable=x=>JSON.stringify(x,(_,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const equal=(a,b)=>stable(a)===stable(b);
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
const matches=s=>(s.fixtures||[]).flat(2).concat(s.cup?.rounds?.flat()||[],s.cup?.thirdPlace26?[s.cup.thirdPlace26]:[],s.playoffs||[]);
export function validateLeague208(data,head){
 if(!object(data)||data.schema!==2||!object(data.images)||Object.keys(data.images).length||!Array.isArray(data.seasons)||!data.seasons.length||data.seasons.length>200)fail('Formato del torneo inválido.');
 if(!Array.isArray(head.assets)||head.assets.length>1000||new Set(head.assets).size!==head.assets.length||head.assets.some(x=>!HEX.test(x))||!object(head.imageRefs)||Object.keys(head.imageRefs).length>1000||Object.entries(head.imageRefs).some(([id,hash])=>!ID.test(id)||!head.assets.includes(hash)))fail('Referencias de imágenes inválidas.');
 const ids=new Set(),image=id=>id==null||typeof id==='string'&&Object.hasOwn(head.imageRefs,id);
 for(const s of data.seasons){
  if(!object(s)||!ID.test(s.id)||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||typeof s.closed!=='boolean'||!object(s.teams)||!object(s.teamMeta)||!Array.isArray(s.groups)||s.groups.length!==3||s.groups.some(g=>!Array.isArray(g)||g.length!==12))fail('Temporada o equipos inválidos.');ids.add(s.id);
  if(['drafts','mediaDraft','matchConflicts23'].some(k=>Object.hasOwn(s,k)))fail('Los borradores privados no se publican.');
  const teams=s.groups.flat(),teamSet=new Set(teams);if(teamSet.size!==36||teams.some(t=>!ID.test(t)||typeof s.teams[t]!=='string'||!s.teams[t].trim()||s.teams[t].length>100))fail('Equipos inválidos.');
  if(!object(s.penalties)||Object.entries(s.penalties).some(([id,n])=>!teamSet.has(id)||!Number.isInteger(n)||n<0))fail('Sanciones inválidas.');
  if(s.activeCompetitions!==undefined&&(!Array.isArray(s.activeCompetitions)||s.activeCompetitions.length!==4||s.activeCompetitions.some(x=>typeof x!=='boolean')))fail('Competiciones inválidas.');
  if(!Array.isArray(s.fixtures)||s.fixtures.length!==3||s.fixtures.some(d=>!Array.isArray(d)||d.length!==22||d.some(r=>!Array.isArray(r)||r.length!==6)))fail('Calendario inválido.');
  for(let d=0;d<3;d++)for(let r=0;r<22;r++)for(const m of s.fixtures[d][r])if((m.h!==null&&!s.groups[d].includes(m.h))||(m.w!==null&&!s.groups[d].includes(m.w)))fail('El encuentro contiene equipos de otra división.');
  if(s.cup&&(!Array.isArray(s.cup.rounds)||s.cup.rounds.length<1||s.cup.rounds.length>4||s.cup.rounds.some((r,i)=>!Array.isArray(r)||r.length!==8/2**i)))fail('Copa inválida.');
  if(s.playoffs&&(!Array.isArray(s.playoffs)||s.playoffs.length>2))fail('Repechajes inválidos.');
  const mids=new Set();for(const m of matches(s)){
   if(!object(m)||!ID.test(m.id)||mids.has(m.id)||m.h!==null&&!teamSet.has(m.h)||m.w!==null&&!teamSet.has(m.w)||m.h!==null&&m.h===m.w)fail('Partido inválido.');mids.add(m.id);
   if((m.a===null)!==(m.b===null)||[m.a,m.b].some(n=>n!==null&&(!Number.isInteger(n)||n<0||n>99))||(m.h===null||m.w===null)&&m.a!==null)fail('Resultado inválido.');
   if(m.winner&&(![m.h,m.w].includes(m.winner)||m.a===null))fail('Ganador inválido.');
   for(const field of ['scorers','assists']){const lists=m[field]||[[],[]];if(!Array.isArray(lists)||lists.length!==2||lists.some((l,i)=>!Array.isArray(l)||l.some(p=>typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!Number.isInteger(p.goals)||p.goals<1)||l.reduce((n,p)=>n+p.goals,0)>(i?m.b:m.a)))fail('Goles o asistencias inválidos.');}
  }
  const players=new Set();for(const t of teams){const meta=s.teamMeta[t];if(!object(meta)||!image(meta.image)||!Array.isArray(meta.players)||meta.players.length>200)fail('Plantel inválido.');for(const p of meta.players){if(!object(p)||!ID.test(p.id)||players.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!image(p.image)||typeof p.active!=='boolean'||!(p.number===null||Number.isInteger(p.number)&&p.number>=0&&p.number<=99)||!['','PT','DFC','LI','LD','MCD','MC','MI','MD','MO','SD','EI','ED','DC'].includes(p.position))fail('Jugador inválido.');players.add(p.id);}}
  for(const n of s.reports||[])if(n.media&&(!object(n.media)||n.media.kind!=='image'||!head.assets.includes(n.media.asset22)||Object.hasOwn(n.media,'data')))fail('Noticia inválida.');
  if(s.closed&&(!s.summary||!Array.isArray(s.summary.champions)||s.summary.champions.length!==3||!Array.isArray(s.summary.movements)))fail('Historial inválido.');
 }
 return data;
}
export function validateEditor208(previous,next,oldHead,newHead,isOwner){
 validateLeague208(next,newHead);if(isOwner)return;
 if(!previous)fail('El dueño debe publicar primero el torneo.',403);
 for(const key of new Set([...Object.keys(previous),...Object.keys(next)]))if(!['seasons','images'].includes(key)&&!equal(previous[key],next[key]))fail('Este ajuste está reservado al dueño.',403);
 if(!equal(previous.seasons.map(s=>s.id),next.seasons.map(s=>s.id)))fail('Solo el dueño puede crear, eliminar o reordenar temporadas.',403);
 const protectedFields=['id','name','closed','groups','activeCompetitions','summary','medalRecords25','cupQualification23','cupCutoffPML'];
 for(let i=0;i<previous.seasons.length;i++){
  const old=previous.seasons[i],s=next.seasons[i];if(old.closed){if(!equal(old,s))fail('No se puede modificar una temporada archivada.',403);continue;}
  for(const k of protectedFields)if(!equal(old[k],s[k]))fail('La configuración y el cierre de temporadas corresponden al dueño.',403);
  for(let d=0;d<3;d++)if(old.activeCompetitions?.[d]===false&&!equal(old.fixtures[d],s.fixtures[d]))fail('La competición está desactivada.',403);
  if(old.activeCompetitions?.[3]===false&&!equal(old.cup,s.cup))fail('La copa está desactivada.',403);
  // Image publications in the shared tournament belong to the owner. Moderators use /posts.
  const oldMedia=(old.reports||[]).filter(n=>n.media),newMedia=(s.reports||[]).filter(n=>n.media);
  if(!equal(oldMedia,newMedia))fail('Usá Publicar imagen para publicar una noticia.',403);
 }
 const archived=JSON.stringify(previous.seasons.filter(s=>s.closed));
 for(const [id,hash]of Object.entries(oldHead.imageRefs||{}))if(archived.includes(JSON.stringify(id))&&newHead.imageRefs[id]!==hash)fail('No se pueden reemplazar imágenes del historial archivado.',403);
}
function decode(v){if(v.stringValue!==undefined)return v.stringValue;if(v.integerValue!==undefined)return Number(v.integerValue);if(v.doubleValue!==undefined)return v.doubleValue;if(v.booleanValue!==undefined)return v.booleanValue;if(v.nullValue!==undefined)return null;if(v.timestampValue!==undefined)return v.timestampValue;if(v.arrayValue)return(v.arrayValue.values||[]).map(decode);if(v.mapValue)return fields(v.mapValue.fields||{});return null;}
const fields=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,decode(v)]));
function value(v){if(v===null)return{nullValue:null};if(typeof v==='string')return{stringValue:v};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(value)}};return{mapValue:{fields:encode(v)}};}
const encode=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,value(v)]));
let tokenCache=null;
async function serviceToken(env){
 let sa;try{sa=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT||'');}catch{fail('Falta activar la protección de Firebase en el servidor.',503);}
 if(sa.project_id!==env.FIREBASE_PROJECT_ID||!sa.client_email||!sa.private_key)fail('La credencial del servidor no corresponde a este proyecto.',503);
 if(tokenCache?.email===sa.client_email&&tokenCache.expires>Date.now()+60000)return tokenCache.token;
 const key=await importPKCS8(sa.private_key,'RS256');
 const jwt=await new SignJWT({scope:'https://www.googleapis.com/auth/datastore'}).setProtectedHeader({alg:'RS256',typ:'JWT'}).setIssuer(sa.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
 const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(15000)});
 const d=await res.json();if(!res.ok||!d.access_token)fail('No se pudo autorizar el guardado protegido. Revisá la credencial del servidor.',503);
 tokenCache={email:sa.client_email,token:d.access_token,expires:Date.now()+Math.min(Number(d.expires_in)||3600,3600)*1000};return tokenCache.token;
}
async function callFS(env,token,path,body){const root='https://firestore.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents';const r=await fetch(root+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});if(!r.ok){if(r.status===409||r.status===412)fail('Otro editor publicó cambios. Se integrarán antes de reintentar.',409,'cloud/conflict');fail('Firebase no pudo completar el guardado protegido.',503);}return r.json();}
async function currentLeague(env,token){const doc=await callFS(env,token,'/leagues/main/data/head'),h=fields(doc.fields);if(!Number.isInteger(h.pages)||h.pages<1||h.pages>256)fail('Formato de nube incompatible.',503);const chunks=[];for(let start=0;start<h.pages;start+=4){const list=await Promise.all(Array.from({length:Math.min(4,h.pages-start)},async(_,j)=>{const i=start+j,p=fields((await callFS(env,token,'/leagues/main/data/'+encodeURIComponent(h.revision+'-'+i))).fields);if(p.revision!==h.revision||p.index!==i||typeof p.text!=='string')fail('La versión compartida está incompleta.',409);return p.text;}));chunks.push(...list);}const text=chunks.join('');if(await sha(text)!==h.hash)fail('No se pudo verificar el torneo compartido.',503);return{doc,head:h,data:JSON.parse(text)};}
export async function gateway208(path,body,user,{env,request,moderator}){
 if(path==='/league/capabilities'&&request.method==='GET')return{version:'2.0.8',configured:!!env.FIREBASE_SERVICE_ACCOUNT};
 if(request.method!=='POST'||!['/league/check','/league/publish'].includes(path))fail('Ruta inexistente.',404);
 const owner=user.sub===env.OWNER_UID;if(!owner&&!await moderator(request,env,user.sub))fail('No tenés permiso para publicar cambios del torneo.',403);
 const token=await serviceToken(env);
 if(path==='/league/check'){if(!owner)fail('Solo el dueño puede comprobar la configuración.',403);await callFS(env,token,'/leagues/main/data/head');return{ready:true,version:'2.0.8'};}
 if(typeof body.text!=='string'||new TextEncoder().encode(body.text).length>LIMIT||!object(body.head)||typeof body.base!=='string')fail('Publicación inválida o demasiado grande.');
 if(await sha(body.text)!==body.head.hash)fail('La publicación está incompleta.');
 const current=await currentLeague(env,token);if(current.head.revision!==body.base)fail('Otro editor publicó cambios.',409,'cloud/conflict');
 let data;try{data=JSON.parse(body.text);}catch{fail('El torneo no es válido.');}
 validateEditor208(current.data,data,current.head,body.head,owner);
 // Assets are immutable; verify new references before exposing a new head.
 const previous=new Set(current.head.assets||[]),missing=body.head.assets.filter(h=>!previous.has(h));
 for(let i=0;i<missing.length;i+=4)await Promise.all(missing.slice(i,i+4).map(async key=>{const a=fields((await callFS(env,token,'/leagues/main/assets/'+key)).fields);if(typeof a.data!=='string'||a.data.length>400000||!/^data:image\/(png|jpeg|webp);base64,/.test(a.data)||await sha(a.data)!==key)fail('No se pudo verificar una imagen del torneo.');}));
 const revision=crypto.randomUUID(),pages=[];for(let i=0;i<body.text.length;){let end=Math.min(i+180000,body.text.length);if(end<body.text.length&&/[\uD800-\uDBFF]/.test(body.text[end-1]))end--;pages.push(body.text.slice(i,end));i=end;}
 const prefix='projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents/leagues/main/data/';
 for(let i=0;i<pages.length;i+=4)await callFS(env,token,':commit',{writes:pages.slice(i,i+4).map((text,j)=>({update:{name:prefix+revision+'-'+(i+j),fields:encode({revision,index:i+j,text})},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}))});
 const head={format:22,revision,pages:pages.length,hash:body.head.hash,assets:body.head.assets,imageRefs:body.head.imageRefs,author:user.sub};
 await callFS(env,token,':commit',{writes:[{update:{name:prefix+'head',fields:encode(head)},currentDocument:{updateTime:current.doc.updateTime},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]});
 return{head};
}
