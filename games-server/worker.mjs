import {posts} from './posts.mjs';
import {bets} from './bets.mjs';
import {practice} from './practice.mjs';
import {authenticate} from './auth.mjs';
import {GameError,dateAR,available,createGame,playGame,publicGame} from './engine.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(body,status=200)=>Response.json(body,{status,headers:cors});
const cleanName=(n)=>typeof n==='string'?n.trim().slice(0,40):'';
export async function handle(request,env,identity=null,now=Date.now()){
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const path=new URL(request.url).pathname;
 if(path==='/health'&&request.method==='GET'){await env.DB.prepare('SELECT uid FROM wallets LIMIT 1').bind().first();return response({service:'pml-games',version:'1.9.9',rules:1,practice:true,bets:true,posts:true});}
 if(!['GET','POST'].includes(request.method))throw new GameError('Método no permitido.',405);
 const user=identity||await authenticate(request,env),uid=user.sub;
 const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 const q=(sql,...v)=>db.prepare(sql).bind(...v);
 const bodyLimit=path.startsWith('/posts/')?1450000:4096;
 if(request.method==='POST'&&Number(request.headers.get('Content-Length')||0)>bodyLimit)throw new GameError('Solicitud demasiado grande.',413);
 let body={};if(request.method==='POST'){const text=await request.text();if(text.length>bodyLimit)throw new GameError('Solicitud demasiado grande.',413);try{body=JSON.parse(text);}catch{throw new GameError('Solicitud inválida.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new GameError('Solicitud inválida.');}
 if(path.startsWith('/posts/'))return response(await posts(path,body,user,{request,env,db,now}));
 if(path.startsWith('/bets/')||path.startsWith('/practice/bets/'))return response(await bets(path,body,user,{request,env,db,now}));
 if(path.startsWith('/practice/')){if(request.method!=='POST')throw new GameError('Método no permitido.',405);return response(await practice(path,body,user,q,now));}
 await q('INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)',uid,cleanName(user.name)||'Jugador '+uid.slice(-5),now).run();
 if(path==='/me'&&request.method==='POST'){
  const name=cleanName(body.name);if(name)await q('UPDATE wallets SET name=? WHERE uid=?',name,uid).run();
 }
 const day=dateAR(now).day;
 // Old active games cannot be replayed on another day; their ticket remains spent.
 if(path==='/me'||path==='/games/start')await q("UPDATE games SET status='expired',updated_at=? WHERE uid=? AND status='active' AND day<>?",now,uid,day).run();
 if(path==='/me'){
  const wallet=await q('SELECT name,balance FROM wallets WHERE uid=?',uid).first();
  const games=await q('SELECT * FROM games WHERE uid=? AND day=?',uid,day).all();
  const movements=await q('SELECT amount,reason,at FROM ledger WHERE uid=? ORDER BY at DESC,rowid DESC LIMIT 30',uid).all();
  return response({wallet,games:games.results.map(publicGame),movements:movements.results,day,available:{mines:available('mines',now),penalties:available('penalties',now)}});
 }
 if(path==='/ranking'&&request.method==='GET'){
  const rows=await q('SELECT name,balance,uid=? AS me FROM wallets ORDER BY balance DESC,created_at ASC LIMIT 50',uid).all();return response({ranking:rows.results});
 }
 if(path==='/games/start'&&request.method==='POST'){
  const kind=body.kind;if(!available(kind,now))throw new GameError(kind==='mines'?'Buscaminas está disponible lunes y martes.':'Penales está disponible miércoles y jueves.',403);
  const old=await q('SELECT * FROM games WHERE uid=? AND kind=? AND day=?',uid,kind,day).first();if(old)return response({game:publicGame(old)});
  const g=createGame(kind),id=crypto.randomUUID();
  try{await q('INSERT INTO games(id,uid,kind,day,status,secret,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',id,uid,kind,day,g.status,JSON.stringify(g.secret),JSON.stringify(g.state),now,now).run();}
  catch(e){const existing=await q('SELECT * FROM games WHERE uid=? AND kind=? AND day=?',uid,kind,day).first();if(existing)return response({game:publicGame(existing)});const w=await q('SELECT balance FROM wallets WHERE uid=?',uid).first();if(w.balance<25)throw new GameError('No tenés fichas suficientes para el ticket.',409);throw e;}
  return response({game:publicGame(await q('SELECT * FROM games WHERE id=?',id).first())});
 }
 if(path==='/games/action'&&request.method==='POST'){
  if(typeof body.id!=='string'||!Number.isInteger(body.version))throw new GameError('Partida inválida.');
  const row=await q('SELECT * FROM games WHERE id=? AND uid=?',body.id,uid).first();if(!row)throw new GameError('Partida no encontrada.',404);
  if(row.day!==day)throw new GameError('La partida venció al finalizar el día.',409);
  if(row.version!==body.version)throw new GameError('La partida cambió. Actualizá para continuar.',409);
  const next=playGame({...row,secret:JSON.parse(row.secret),state:JSON.parse(row.state)},body.action||{});
  const result=await q("UPDATE games SET state=?,status=?,payout=?,version=version+1,updated_at=? WHERE id=? AND uid=? AND version=? AND status='active' RETURNING id",JSON.stringify(next.state),next.status,next.payout,now,row.id,uid,row.version).first();
  if(!result)throw new GameError('La jugada ya fue procesada. Actualizá para continuar.',409);
  return response({game:publicGame(await q('SELECT * FROM games WHERE id=?',row.id).first())});
 }
 if(path==='/admin/grant'&&request.method==='POST'){
  if(uid!==env.OWNER_UID)throw new GameError('Solo el administrador puede entregar fichas.',403);
  if(typeof body.id!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(body.id))throw new GameError('Entrega inválida.');
  if(await q('SELECT id FROM grants WHERE id=?',body.id).first())return response({ok:true});
  // Enroll existing Firebase profiles so the administrator's grant reaches every registered user,
  // including users who have not opened Games yet. Only the verified owner can list profiles.
  let token='',profiles=[];
  do{
   const url=new URL('https://firestore.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents/profiles');url.searchParams.set('pageSize','1000');if(token)url.searchParams.set('pageToken',token);
   const res=await fetch(url,{headers:{Authorization:request.headers.get('Authorization')||''},signal:AbortSignal.timeout(10000)});
   if(!res.ok)throw new GameError('No se pudieron consultar los usuarios registrados. No se realizó la entrega.',503);
   const page=await res.json();
   for(const d of page.documents||[]){const id=d.name?.split('/').pop();if(typeof id==='string'&&id.length>0&&id.length<=128)profiles.push({uid:id,name:cleanName(d.fields?.name?.stringValue)||'Jugador '+id.slice(-5)});}
   token=page.nextPageToken||'';
   if(profiles.length>10000)throw new GameError('La lista de usuarios supera el límite de esta entrega.',503);
  }while(token);
  await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) SELECT json_extract(value,'$.uid'),json_extract(value,'$.name'),? FROM json_each(?)",now,JSON.stringify(profiles)).run();
  await q('INSERT OR IGNORE INTO grants(id,at) VALUES(?,?)',body.id,now).run();return response({ok:true});
 }
 throw new GameError('Ruta inexistente.',404);
}
export default {async fetch(request,env){try{return await handle(request,{...env,FIREBASE_PROJECT_ID:env.FIREBASE_PROJECT_ID||'pro-mobile-league',OWNER_UID:env.OWNER_UID||'iCLoGhjbXNgY3Q7dbxX0456vagI2'});}catch(e){if(e instanceof GameError)return response({error:e.message},e.status);console.error('PML games failure',e?.name);return response({error:'El servidor no pudo completar la operación. Tu partida se conserva.'},503);}}};


