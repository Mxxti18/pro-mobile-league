import {GameError,dateAR} from './engine.mjs';
import {league,fixtures,moderator} from './league.mjs';
const START=Date.parse('2026-10-19T00:00:00-03:00');
export function periodTime(now){const day=dateAR(now),d=new Date(day.day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((day.weekday+6)%7));const monday=d.toISOString().slice(0,10);return {week:monday,closes:d.getTime()+4*86400000+4.5*3600000};}
export function selectSix(s,used=[]){const candidates=fixtures(s).filter(m=>m.a===null&&m.b===null&&!used.includes(m.id)),groups=[0,1,2,'cup'].map(d=>candidates.filter(m=>m.competition===d).sort((a,b)=>a.round-b.round||a.id.localeCompare(b.id)));const out=[];while(out.length<6&&groups.some(g=>g.length))for(const g of groups){if(g.length&&out.length<6)out.push(g.shift());}return out;}
const sameFixture=(m,slot)=>{const i=JSON.parse(slot.info);return m.h===i.h&&m.w===i.w;};
const info=m=>JSON.stringify({id:m.id,h:m.h,w:m.w,home:m.home,away:m.away,competition:m.competition,round:m.round});
export async function bets(path,body,user,ctx){const {request,env,db,now}=ctx;const uid=user.sub,trial=path.startsWith('/practice/bets/');path=path.replace('/practice','');if(trial&&uid!==env.OWNER_UID)throw new GameError('Prueba privada del creador.',403);
const rename=sql=>trial?sql.replace(/\b(bet_periods|bet_matches|bet_audit|bets|wallets|ledger)\b/g,x=>({wallets:'trial_wallets',ledger:'trial_ledger'}[x]||'trial_'+x)):sql;
const q=(sql,...args)=>db.prepare(rename(sql)).bind(...args);
const admin=()=>moderator(request,env,uid);
const trackedRows=async()=> (await q('SELECT * FROM bet_matches WHERE active=1 ORDER BY rowid DESC LIMIT 120').all()).results.map(m=>({...m,info:JSON.parse(m.info)}));
if(!trial&&now<START)return {disabled:true,message:'APUESTAS DISPONIBLES DESDE LA PRÓXIMA TEMPORADA.',start:START,period:null,matches:[],myBets:[]};
if(trial)await q('INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)',uid,'PRUEBA DE APUESTAS',now).run();
else await q('INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)',uid,(user.name||'Jugador').slice(0,40),now).run();
const getSlot=async()=>{const s=await q('SELECT * FROM bet_matches WHERE id=?',body.slot).first();if(!s)throw new GameError('Partido de apuestas inexistente.',404);return s;};
if(path==='/bets/reset'&&trial){await db.batch(['DELETE FROM bets','DELETE FROM bet_audit','DELETE FROM bet_matches','DELETE FROM bet_periods','DELETE FROM ledger','DELETE FROM wallets'].map(sql=>q(sql)));return {ok:true};}
if(path==='/bets/board'){
 const data=await league(request,env),s=data.seasons?.filter(s=>!s.closed).at(-1)|| (trial?data.seasons?.at(-1):null);if(!s)return {disabled:true,message:'ESPERANDO LA NUEVA TEMPORADA.',matches:[],myBets:[],tracked:await trackedRows()};
 const t=periodTime(now),id=s.id+':'+t.week;
 let p=await q('SELECT * FROM bet_periods WHERE id=?',id).first();
 if(!p){const used=(await q("SELECT match_id FROM bet_matches WHERE status<>'void'").all()).results.map(m=>m.match_id),six=selectSix(s,used);if(six.length<6)return {disabled:true,message:'SE NECESITAN SEIS PARTIDOS PENDIENTES PARA PREPARAR EL PERÍODO.',matches:[],myBets:[],tracked:await trackedRows()};await db.batch([q('INSERT OR IGNORE INTO bet_periods(id,season,week,closes,status,created_at) VALUES(?,?,?,?,?,?)',id,s.id,t.week,trial?now+7*86400000:t.closes,'draft',now),...six.map((m,i)=>q('INSERT OR IGNORE INTO bet_matches(id,period,match_id,info,updated_at) VALUES(?,?,?,?,?)',id+':'+i,id,m.id,info(m),now))]);p=await q('SELECT * FROM bet_periods WHERE id=?',id).first();}
 if(p.status==='open'&&now>=p.closes){await q("UPDATE bet_periods SET status='closed' WHERE id=? AND status='open'",id).run();p.status='closed';}
 const matches=(await q('SELECT * FROM bet_matches WHERE period=? AND active=1 ORDER BY rowid',id).all()).results.map(m=>({...m,info:JSON.parse(m.info)}));
 const myBets=(await q('SELECT * FROM bets WHERE uid=? AND period=? ORDER BY created_at',uid,id).all()).results;
 const tracked=await trackedRows();
 return {period:p,matches,tracked,myBets,wallet:await q('SELECT balance FROM wallets WHERE uid=?',uid).first(),spent:myBets.filter(b=>b.status!=='void').reduce((n,b)=>n+b.stake,0),trial,canConfirm:trial?true:await admin(),canManage:uid===env.OWNER_UID,serverNow:now};
}
if(path==='/bets/open'){
 if(uid!==env.OWNER_UID)throw new GameError('Solo el creador puede habilitar apuestas.',403);const p=await q('SELECT * FROM bet_periods WHERE id=?',body.period).first();if(!p||now>=p.closes)throw new GameError('El plazo de apuestas terminó.',409);const slots=(await q('SELECT * FROM bet_matches WHERE period=? AND active=1',p.id).all()).results;if(slots.length!==6||slots.some(s=>s.status!=='pending'))throw new GameError('Revisá los seis partidos antes de habilitar.',409);
 const data=await league(request,env),season=data.seasons.find(s=>s.id===p.season);if(!season||(!trial&&season.closed))throw new GameError('La temporada está cerrada.',409);const fs=fixtures(season);if(slots.some(s=>!fs.some(m=>m.id===s.match_id&&sameFixture(m,s)&&m.a===null&&m.b===null)))throw new GameError('Hay partidos ya jugados. Corregí la selección.',409);
 await q("UPDATE bet_periods SET status='open' WHERE id=? AND status='draft'",p.id).run();return {ok:true};
}
if(path==='/bets/place'){
 if(!['home','draw','away'].includes(body.choice)||!Number.isInteger(body.stake)||body.stake<1||body.stake>150||typeof body.id!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(body.id))throw new GameError('Elegí resultado y una cantidad entera de 1 a 150 fichas.');const slot=await getSlot();const old=await q('SELECT * FROM bets WHERE uid=? AND slot=?',uid,slot.id).first();if(old){if(old.choice===body.choice&&old.stake===body.stake)return {bet:old};throw new GameError('Ya hay una apuesta registrada para este partido.',409);}
 const p=await q('SELECT * FROM bet_periods WHERE id=?',slot.period).first();if(p.status!=='open'||now>=p.closes||slot.status!=='pending'||slot.active!==1)throw new GameError('Las apuestas están cerradas.',409);
 const data=await league(request,env),s=data.seasons.find(s=>s.id===p.season),m=s&&fixtures(s).find(m=>m.id===slot.match_id);if(!s||(!trial&&s.closed)||!m||!sameFixture(m,slot)||m.a!==null||m.b!==null)throw new GameError('Este partido ya tiene resultado. Esperá una corrección del administrador.',409);
 try{await q('INSERT INTO bets(id,uid,period,slot,choice,stake,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',body.id,uid,slot.period,slot.id,body.choice,body.stake,now,now).run();}catch(e){const retry=await q('SELECT * FROM bets WHERE id=? AND uid=?',body.id,uid).first();if(retry&&retry.slot===body.slot&&retry.choice===body.choice&&retry.stake===body.stake)return {bet:retry};throw new GameError('No se registró la apuesta. Verificá tu saldo, el máximo de 150 fichas y si el partido sigue disponible.',409);}return {ok:true};
}
if(path==='/bets/replace'){
 if(uid!==env.OWNER_UID)throw new GameError('Solo el creador puede corregir la selección.',403);const slot=await getSlot();if(slot.status!=='pending'||slot.active!==1)throw new GameError('Este partido ya fue liquidado o anulado.',409);const reason=String(body.reason||'').trim().slice(0,200);if(!reason)throw new GameError('Indicá el motivo de la corrección.');const p=await q('SELECT * FROM bet_periods WHERE id=?',slot.period).first();const data=await league(request,env),s=data.seasons.find(s=>s.id===p.season),m=s&&fixtures(s).find(m=>m.id===body.match);if(!m||m.a!==null||m.b!==null)throw new GameError('Elegí un partido pendiente de esa temporada.');if(await q("SELECT id FROM bet_matches WHERE match_id=? AND status<>'void' AND id<>?",m.id,slot.id).first())throw new GameError('Ese partido ya está seleccionado.',409);
 const id=crypto.randomUUID();await db.batch([q("UPDATE bet_matches SET status='void',active=0,reason=?,version=version+1,updated_at=? WHERE id=? AND status='pending' AND version=?",reason,now,slot.id,slot.version),q("INSERT INTO bet_matches(id,period,match_id,info,updated_at,replaced_from) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM bet_matches WHERE id=? AND status='void' AND version=?)",id,p.id,m.id,info(m),now,slot.id,slot.id,slot.version+1),q("INSERT OR IGNORE INTO bet_audit(id,actor,slot,action,reason,at) SELECT ?,?,?,'replace',?,? WHERE EXISTS(SELECT 1 FROM bet_matches WHERE id=?)",id,uid,slot.id,reason,now,id)]);return {ok:true};
}
if(path==='/bets/settle'){
 if(!await admin())throw new GameError('Solo administradores pueden confirmar para apuestas.',403);if(body.confirm!==true)throw new GameError('Falta la confirmación de apuestas.');const slot=await getSlot();if(slot.status==='settled'){if(slot.a!==body.a||slot.b!==body.b)throw new GameError('Las apuestas ya fueron liquidadas con otro marcador.',409);return {ok:true,alreadySettled:true};}if(slot.status!=='pending'||slot.active!==1)throw new GameError('El partido fue anulado.',409);
 let m;
 if(trial){if(!Number.isInteger(body.a)||!Number.isInteger(body.b)||body.a<0||body.b<0||body.a>99||body.b>99)throw new GameError('Marcador de prueba inválido.');m={a:body.a,b:body.b};}
 else{const p=await q('SELECT * FROM bet_periods WHERE id=?',slot.period).first(),data=await league(request,env),s=data.seasons.find(s=>s.id===p.season);m=s&&fixtures(s).find(m=>m.id===slot.match_id);if(!m||!sameFixture(m,slot)||!Number.isInteger(m.a)||!Number.isInteger(m.b)||m.a<0||m.b<0||m.a>99||m.b>99)throw new GameError('Primero guardá el resultado y esperá a que se sincronice.',409);if(m.a!==body.a||m.b!==body.b)throw new GameError('El resultado cambió. Revisalo antes de confirmar.',409);}
 const result=await q("UPDATE bet_matches SET a=?,b=?,status='settled',version=version+1,updated_at=? WHERE id=? AND status='pending' AND version=? RETURNING id",m.a,m.b,now,slot.id,slot.version).first();if(!result)throw new GameError('La confirmación ya cambió. Actualizá.',409);await q("INSERT OR IGNORE INTO bet_audit VALUES(?,?,?,'settle',?,?)",slot.id+':settle',uid,slot.id,'Resultado confirmado: '+m.a+'–'+m.b,now).run();return {ok:true};
}
throw new GameError('Ruta inexistente.',404);
}
