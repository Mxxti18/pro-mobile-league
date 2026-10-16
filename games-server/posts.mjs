import {GameError} from './engine.mjs';
import {league,moderator} from './league.mjs';
const validID=id=>typeof id==='string'&&/^[-a-zA-Z0-9]{16,64}$/.test(id);
const publicPost=p=>({id:p.id,uid:p.uid,author:p.author,season:p.season,cost:p.cost,status:p.status,version:p.version,content:JSON.parse(p.payload),reason:p.reason,createdAt:p.created_at,updatedAt:p.updated_at});
function validate(s,p,complete=false){
 if(!p||typeof p!=='object'||Array.isArray(p))throw new GameError('Noticia inválida.');
 const title=typeof p.title==='string'?p.title.trim():'',body=typeof p.body==='string'?p.body.trim():'',division=String(p.division??'general'),team=typeof p.team==='string'?p.team:'general',image=typeof p.image==='string'?p.image:'';
 if(title.length>200||body.length>6000)throw new GameError('El título o el texto superan el límite.');
 if(!['general','0','1','2','cup'].includes(division))throw new GameError('División inválida.');
 if(division!=='general'&&s.activeCompetitions?.[division==='cup'?3:Number(division)]===false)throw new GameError('Esa competición está desactivada.',409);
 const groups=(s.groups||[]).filter((_,d)=>s.activeCompetitions?.[d]!==false);
 if(team!=='general'&&(!groups.flat().includes(team)||(division!=='general'&&division!=='cup'&&!s.groups[Number(division)]?.includes(team))))throw new GameError('El equipo no pertenece a una división activa.');
 if(image){const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);if(!m||image.length>1400000)throw new GameError('Elegí una imagen JPG, PNG o WebP de hasta 1 MB.');let bytes;try{bytes=atob(m[2]);}catch{throw new GameError('Imagen inválida.');}const ok=m[1]==='jpeg'?bytes.startsWith('\xff\xd8\xff'):m[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';if(!ok)throw new GameError('Imagen inválida.');}
 if(complete&&!title)throw new GameError('Completá el título.');if(complete&&!image)throw new GameError('Elegí una imagen.');
 return {title,body,division,team,image};
}
export async function posts(path,body,user,{request,env,db,now}){
 const uid=user.sub,q=(sql,...v)=>db.prepare(sql).bind(...v),method=request.method;
 const reading=['/posts/mine','/posts/feed','/posts/queue'].includes(path);if(method!==(reading?'GET':'POST'))throw new GameError('Método no permitido.',405);
 if(path==='/posts/mine'){const rows=await q("SELECT * FROM news_posts WHERE uid=? AND id NOT IN (SELECT post_id FROM news_withdrawals) ORDER BY (status='draft') DESC,created_at DESC LIMIT 10",uid).all();return {posts:rows.results.map(publicPost)};}
 if(path==='/posts/queue'){if(!await moderator(request,env,uid))throw new GameError('Solo los administradores pueden revisar noticias.',403);const rows=await q("SELECT * FROM news_posts WHERE status='pending' ORDER BY created_at LIMIT 10").all();return {posts:rows.results.map(publicPost)};}
 if(path==='/posts/withdraw'){
  if(!validID(body.id))throw new GameError('Noticia inválida.');
  const row=await q('SELECT * FROM news_posts WHERE id=?',body.id).first();if(!row)throw new GameError('Noticia no encontrada.',404);if(row.uid!==uid)throw new GameError('Solo el autor puede retirarla.',403);
  const previous=await q('SELECT post_id FROM news_withdrawals WHERE post_id=? AND uid=?',row.id,uid).first();if(previous)return {ok:true,refunded:row.cost};
  if(!['draft','pending'].includes(row.status))throw new GameError('La noticia ya fue revisada y no puede retirarse con devolución.',409);
  await q("INSERT OR IGNORE INTO news_withdrawals(post_id,uid,previous_status,at) SELECT id,uid,status,? FROM news_posts WHERE id=? AND uid=? AND version=? AND status IN('draft','pending')",now,row.id,uid,row.version).run();
  if(!await q('SELECT post_id FROM news_withdrawals WHERE post_id=? AND uid=?',row.id,uid).first())throw new GameError('La noticia acaba de ser revisada. Actualizá para ver su estado.',409);
  return {ok:true,refunded:row.cost};
 }
 const state=await league(request,env),seasonID=reading?new URL(request.url).searchParams.get('season'):body.season,s=state.seasons?.find(s=>s.id===seasonID);
 if(path==='/posts/feed'){
  if(!s)throw new GameError('Temporada inexistente.',404);
  const raw=new URL(request.url).searchParams.get('before'),parts=raw?.split(':');if(raw&&(!/^\d{1,16}$/.test(parts[0])||!validID(parts[1])))throw new GameError('Página inválida.');const time=parts?Number(parts[0]):Number.MAX_SAFE_INTEGER,id=parts?parts[1]:'\uffff';
  const rows=await q("SELECT * FROM news_posts WHERE status='approved' AND season=? AND (updated_at<? OR (updated_at=? AND id<?)) ORDER BY updated_at DESC,id DESC LIMIT 6",s.id,time,time,id).all();
  return {posts:rows.results.filter(p=>{try{validate(s,JSON.parse(p.payload));return true;}catch{return false;}}).map(publicPost),next:rows.results.length===6?rows.results.at(-1).updated_at+':'+rows.results.at(-1).id:null};
 }
 if(path==='/posts/buy'){
  if(!validID(body.id)||!s||s.closed)throw new GameError('Elegí una temporada abierta.');
  const old=await q('SELECT * FROM news_posts WHERE id=?',body.id).first();if(old){if(old.uid!==uid||old.season!==s.id)throw new GameError('Solicitud ya utilizada.',409);return {post:publicPost(old)};}
  const draft=await q("SELECT * FROM news_posts WHERE uid=? AND status='draft'",uid).first();if(draft)return {post:publicPost(draft)};
  const free=await moderator(request,env,uid);await q('INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)',uid,String(user.name||'Jugador').slice(0,40),now).run();
  const wallet=await q('SELECT name FROM wallets WHERE uid=?',uid).first();
  try{await q('INSERT INTO news_posts(id,uid,author,season,cost,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',body.id,uid,wallet.name,s.id,free?0:250,now,now).run();}
  catch(e){const concurrent=await q("SELECT * FROM news_posts WHERE uid=? AND status='draft'",uid).first();if(concurrent)return {post:publicPost(concurrent)};const w=await q('SELECT balance FROM wallets WHERE uid=?',uid).first();if(w?.balance<250)throw new GameError('Necesitás 250 fichas para crear una noticia.',409);throw e;}
  return {post:publicPost(await q('SELECT * FROM news_posts WHERE id=?',body.id).first())};
 }
 const row=validID(body.id)?await q('SELECT * FROM news_posts WHERE id=?',body.id).first():null;if(!row)throw new GameError('Noticia no encontrada.',404);
 if(path==='/posts/review'){
  if(!await moderator(request,env,uid))throw new GameError('Solo los administradores pueden revisar noticias.',403);
  if(!['approved','rejected'].includes(body.decision))throw new GameError('Decisión inválida.');
  if(row.status===body.decision)return {post:publicPost(row)};
  if(row.status!=='pending')throw new GameError('Esta noticia ya fue revisada.',409);
  const reason=typeof body.reason==='string'?body.reason.trim().slice(0,300):'';
  if(body.decision==='rejected'&&!reason)throw new GameError('Indicá el motivo del rechazo.');
  if(body.decision==='approved'){const target=state.seasons?.find(s=>s.id===row.season);if(!target)throw new GameError('Temporada inexistente.',409);validate(target,JSON.parse(row.payload),true);}
  const changed=await q("UPDATE news_posts SET status=?,reason=?,reviewer=?,version=version+1,updated_at=? WHERE id=? AND status='pending' AND version=? RETURNING id",body.decision,reason,uid,now,row.id,row.version).first();if(!changed)throw new GameError('Otro administrador ya revisó esta noticia. Actualizá.',409);
 }else if(['/posts/save','/posts/submit'].includes(path)){
  if(row.uid!==uid)throw new GameError('Esta noticia pertenece a otra persona.',403);
  if(row.status!=='draft'){if(path==='/posts/submit'&&['pending','approved'].includes(row.status)&&body.version===row.version-1)return {post:publicPost(row)};throw new GameError('La noticia enviada ya no se puede editar.',409);}
  const target=state.seasons?.find(s=>s.id===row.season);if(!target||target.closed)throw new GameError('La temporada está cerrada. Tu borrador se conserva.',409);
  const payload=validate(target,body.content,path==='/posts/submit'),status=path==='/posts/save'?'draft':row.cost===0&&await moderator(request,env,uid)?'approved':'pending';
  if(!Number.isInteger(body.version))throw new GameError('Versión inválida.');
  const changed=await q("UPDATE news_posts SET payload=?,status=?,version=version+1,updated_at=? WHERE id=? AND uid=? AND status='draft' AND version=? RETURNING id",JSON.stringify(payload),status,now,row.id,uid,body.version).first();if(!changed)throw new GameError('El borrador cambió en otro dispositivo. Actualizá antes de seguir.',409);
 }else throw new GameError('Ruta inexistente.',404);
 return {post:publicPost(await q('SELECT * FROM news_posts WHERE id=?',row.id).first())};
}

