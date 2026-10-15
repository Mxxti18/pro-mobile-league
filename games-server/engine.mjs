export class GameError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function dateAR(now=Date.now()){
 const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(new Date(now));
 const x=Object.fromEntries(f.map(p=>[p.type,p.value]));return {day:`${x.year}-${x.month}-${x.day}`,weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(x.weekday)};
}
export function available(kind,now=Date.now()){const d=dateAR(now).weekday;return kind==='mines'?[1,2].includes(d):kind==='penalties'?[3,4].includes(d):false;}
export function randomInt(n){const range=4294967296,limit=range-range%n;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0];}while(x>=limit);return x%n;}
export function createGame(kind,rng=randomInt){
 if(kind==='mines'){
  const board=[...Array(15).fill(1),...Array(10).fill(2),...Array(5).fill(5),'x2','x4','x6','mine','mine','mine'];
  for(let i=board.length-1;i>0;i--){const j=rng(i+1);[board[i],board[j]]=[board[j],board[i]];}
  return {secret:board,state:{revealed:[],total:0,mines:0},status:'active',payout:0};
 }
 if(kind==='penalties')return {secret:Array.from({length:5},()=>rng(3)),state:{shots:[],goals:0},status:'active',payout:0};
 throw new GameError('Juego inexistente.');
}
export function playGame(g,action){
 if(g.status!=='active')throw new GameError('La partida ya terminó.',409);
 const next=structuredClone(g),s=next.state;
 if(g.kind==='mines'){
  if(action.type==='cashout'){next.status='won';next.payout=s.total;return next;}
  const i=action.cell;
  if(action.type!=='reveal'||!Number.isInteger(i)||i<0||i>=36)throw new GameError('Elegí una casilla válida.');
  if(s.revealed.includes(i))throw new GameError('Esa casilla ya está descubierta.',409);
  s.revealed.push(i);const cell=g.secret[i];
  if(cell==='mine'){s.mines++;if(s.mines===3){s.total=0;next.status='lost';}}
  else if(typeof cell==='string')s.total*=Number(cell.slice(1));else s.total+=cell;
  if(next.status==='active'&&s.revealed.length===36){next.status='won';next.payout=s.total;}
 }else{
  if(action.type!=='shoot'||!Number.isInteger(action.direction)||action.direction<0||action.direction>2)throw new GameError('Elegí izquierda, centro o derecha.');
  const keeper=g.secret[s.shots.length],goal=action.direction!==keeper;
  s.shots.push({direction:action.direction,keeper,goal});if(goal)s.goals++;
  if(s.shots.length===5){next.payout=[0,0,10,25,50,100][s.goals];next.status=next.payout?'won':'lost';}
 }
 return next;
}
export function publicGame(row){
 if(!row)return null;
 const secret=typeof row.secret==='string'?JSON.parse(row.secret):row.secret;
 const state=typeof row.state==='string'?JSON.parse(row.state):row.state;
 const out={id:row.id,kind:row.kind,day:row.day,status:row.status,version:row.version,state,payout:row.payout};
 if(row.kind==='mines')out.cells=secret.map((v,i)=>state.revealed.includes(i)||row.status!=='active'?v:null);
 // Never return hidden mines or future keeper directions while a game is active.
 return out;
}
