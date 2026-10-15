import {GameError,createGame,playGame,publicGame,dateAR} from './engine.mjs';
// Reserved for the project creator's account, independently of any administrator roles.
export const PRACTICE_OWNER='iCLoGhjbXNgY3Q7dbxX0456vagI2';
export async function practice(path,body,user,q,now){
 if(user.sub!==PRACTICE_OWNER)throw new GameError('Este modo está reservado para el creador.',403);
 const uid=user.sub,initial={wallet:{name:'PRUEBA',balance:500},games:[],movements:[]};
 await q('INSERT OR IGNORE INTO practice_sessions(uid,state,updated_at) VALUES(?,?,?)',uid,JSON.stringify(initial),now).run();
 const row=await q('SELECT * FROM practice_sessions WHERE uid=?',uid).first();let data=JSON.parse(row.state),changed=false;
 if(path==='/practice/reset'){data=initial;changed=true;}
 else if(path==='/practice/me'){}
 else if(path==='/practice/games/start'){
  if(!['mines','penalties'].includes(body.kind))throw new GameError('Juego inválido.');
  let g=data.games.find(x=>x.kind===body.kind);
  if(!g||g.status!=='active'){
   if(data.wallet.balance<25)throw new GameError('Reiniciá la prueba para recuperar fichas de prueba.',409);
   g={...createGame(body.kind),id:crypto.randomUUID(),kind:body.kind,day:dateAR(now).day,version:0};
   data.games=data.games.filter(x=>x.kind!==body.kind);data.games.push(g);data.wallet.balance-=25;data.movements.unshift({amount:-25,reason:'TICKET DE PRUEBA',at:now});changed=true;
  }
 }else if(path==='/practice/games/action'){
  const g=data.games.find(x=>x.id===body.id);if(!g)throw new GameError('Partida de prueba inexistente.',404);
  if(g.version!==body.version)throw new GameError('La prueba cambió. Actualizá para continuar.',409);
  const next=playGame(g,body.action||{});next.version=g.version+1;
  data.games=data.games.map(x=>x.id===g.id?next:x);
  if(next.status==='won'&&next.payout){data.wallet.balance+=next.payout;data.movements.unshift({amount:next.payout,reason:'PREMIO DE PRUEBA',at:now});}
  changed=true;
 }else throw new GameError('Ruta de prueba inexistente.',404);
 data.movements=data.movements.slice(0,30);
 if(changed){const updated=await q('UPDATE practice_sessions SET state=?,version=version+1,updated_at=? WHERE uid=? AND version=? RETURNING uid',JSON.stringify(data),now,uid,row.version).first();if(!updated)throw new GameError('Otra acción actualizó la prueba. Volvé a cargarla.',409);}
 return {...data,games:data.games.map(publicGame),day:dateAR(now).day,available:{mines:true,penalties:true},practice:true};
}
