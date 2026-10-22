import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { handle } from './worker-core.mjs';

// All requests, identities, league data and SQLite databases below are simulated.
// The worker code and schema are copies of the deployed, read-only retrievals.
class LocalD1 {
  constructor() {
    this.sql = new DatabaseSync(':memory:');
    this.sql.exec('PRAGMA foreign_keys=ON; PRAGMA recursive_triggers=ON;');
    this.sql.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  }
  withSession() { return this; }
  prepare(sql) {
    const stmt = this.sql.prepare(sql);
    const bound = (args=[]) => ({
      bind: (...values) => bound(values),
      first: async () => stmt.get(...args) ?? null,
      all: async () => ({ results: stmt.all(...args), success: true }),
      run: async () => ({ success: true, meta: stmt.run(...args) }),
      execute: () => stmt.run(...args)
    });
    return bound();
  }
  async batch(stmts) {
    this.sql.exec('BEGIN');
    try {
      const result = stmts.map(s => ({ success: true, meta: s.execute() }));
      this.sql.exec('COMMIT'); return result;
    } catch(e) { this.sql.exec('ROLLBACK'); throw e; }
  }
}
const now = Date.parse('2026-10-19T12:00:00-03:00');
const owner = { sub: 'owner-audit', name: 'Audit owner' };
const reader = { sub: 'reader-audit', name: 'Audit reader' };
let leagueData, revision=0;
function fixture() {
  const teams=Object.fromEntries(Array.from({length:12},(_,i)=>['t'+i,'Team '+i]));
  return {seasons:[{id:'season-audit',closed:false,activeCompetitions:[true,false,false,false],
    teams,groups:[Object.keys(teams),[],[]],fixtures:[[Array.from({length:6},(_,i)=>({id:'match-'+i,h:'t'+(i*2),w:'t'+(i*2+1),a:null,b:null,scorers:[[],[]]}))],[],[]]}]};
}
function useLeague(data=fixture()) { leagueData=data; revision++; }
globalThis.fetch = async (url) => {
  const path=new URL(url).pathname.split('/documents/')[1];
  const text=JSON.stringify(leagueData), rev='audit-rev-'+revision;
  if(path==='leagues/main/data/head') return Response.json({fields:{revision:{stringValue:rev},pages:{integerValue:'1'},hash:{stringValue:createHash('sha256').update(text).digest('hex')}}});
  if(path==='leagues/main/data/'+rev+'-0') return Response.json({fields:{revision:{stringValue:rev},index:{integerValue:'0'},text:{stringValue:text}}});
  if(path==='roles/'+reader.sub) return Response.json({fields:{role:{stringValue:'viewer'}}});
  throw Error('Unexpected network request blocked: '+path);
};
function api(db) {
  const env={DB:db,OWNER_UID:owner.sub,FIREBASE_PROJECT_ID:'audit-local'};
  return async (path, body, user=reader, at=now) => {
    const req=new Request('https://audit.invalid'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return (await handle(req,env,user,at)).json();
  };
}
const results=[];
async function test(name,fn){ await fn(); results.push(name); console.log('PASS '+name); }

await test('CONTROL: concurrent game starts charge once; wallet is global across seasons',async()=>{
  useLeague(); const db=new LocalD1(), call=api(db);
  assert.equal((await call('/me')).wallet.balance,500);
  const starts=await Promise.all([call('/games/start',{kind:'mines'}),call('/games/start',{kind:'mines'})]);
  assert.equal(starts[0].game.id,starts[1].game.id);
  assert.equal((await call('/me')).wallet.balance,475);
  leagueData.seasons[0].closed=true; leagueData.seasons.push({...fixture().seasons[0],id:'season-next'}); useLeague(leagueData);
  assert.equal((await call('/games/start',{kind:'mines'})).game.id,starts[0].game.id);
  assert.equal((await call('/me')).wallet.balance,475);
});
await test('CONTROL: draft purchase and repeated withdrawal cannot double charge/refund',async()=>{
  useLeague(); const db=new LocalD1(),call=api(db);
  const bought=await Promise.all([call('/posts/buy',{id:randomUUID(),season:'season-audit'}),call('/posts/buy',{id:randomUUID(),season:'season-audit'})]);
  assert.equal(bought[0].post.id,bought[1].post.id);
  assert.equal((await call('/me')).wallet.balance,250);
  await Promise.all([call('/posts/withdraw',{id:bought[0].post.id}),call('/posts/withdraw',{id:bought[0].post.id})]);
  assert.equal((await call('/me')).wallet.balance,500);
  assert.equal(db.sql.prepare("SELECT COUNT(*) n FROM ledger WHERE id LIKE 'news-refund:%'").get().n,1);
});
await test('CONTROL: rejected news refunds once and cannot be withdrawn for another refund',async()=>{
  useLeague(); const db=new LocalD1(),call=api(db);
  const {post}=await call('/posts/buy',{id:randomUUID(),season:'season-audit'});
  const content={title:'Audit',body:'Original text',division:'general',team:'general',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVJkAAAAASUVORK5CYII='};
  await call('/posts/submit',{id:post.id,version:0,content});
  await call('/posts/review',{id:post.id,decision:'rejected',reason:'Audit test'},owner);
  await call('/posts/review',{id:post.id,decision:'rejected',reason:'Audit retry'},owner);
  await assert.rejects(()=>call('/posts/withdraw',{id:post.id}));
  assert.equal((await call('/me')).wallet.balance,500);
});
await test('CONTROL: bet stake limits and repeated settlement preserve correct balance',async()=>{
  useLeague(); const db=new LocalD1(),call=api(db),board=await call('/bets/board');
  await call('/bets/open',{period:board.period.id},owner);
  const body={id:randomUUID(),slot:board.matches[0].id,choice:'home',stake:100};
  await Promise.all([call('/bets/place',body),call('/bets/place',body)]);
  assert.equal((await call('/me')).wallet.balance,400);
  await assert.rejects(()=>call('/bets/place',{id:randomUUID(),slot:board.matches[1].id,choice:'home',stake:75}));
  assert.equal((await call('/me')).wallet.balance,400);
  leagueData.seasons[0].fixtures[0][0][0].a=2;leagueData.seasons[0].fixtures[0][0][0].b=1;useLeague(leagueData);
  await call('/bets/settle',{slot:body.slot,a:2,b:1,confirm:true},owner);
  await call('/bets/settle',{slot:body.slot,a:2,b:1,confirm:true},owner);
  assert.equal((await call('/me')).wallet.balance,600);
});
await test('FIX: unopened expired drafts release all games without refunds or lost bets',async()=>{
  useLeague(); const db=new LocalD1(),call=api(db);
  const first=await call('/bets/board');assert.equal(first.matches.length,6);assert.equal(first.period.status,'draft');
  const next=await call('/bets/board',undefined,reader,now+7*86400000);
  assert.equal(next.disabled,undefined);assert.equal(next.matches.length,6);assert.equal(db.sql.prepare("SELECT COUNT(*) n FROM bet_matches WHERE status='void'").get().n,6);
  assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM bets').get().n,0);
  assert.equal(leagueData.seasons[0].fixtures[0][0].filter(m=>m.a===null).length,6);
});
await test('CONTROL: client hides disabled competitions even when historical slots remain on server',async()=>{
  useLeague();const db=new LocalD1(),call=api(db);await call('/bets/board');
  leagueData.seasons[0].activeCompetitions=[false,true,false,false];useLeague(leagueData);
  const after=await call('/bets/board');
  assert.equal(after.matches.length,6);assert(after.matches.every(m=>m.info.competition===0));
  const source=fs.readFileSync(new URL('./client-bet-visibility.fixture.js',import.meta.url),'utf8');
  const c={betSeason196:()=>leagueData.seasons[0],active21:(s,d)=>s.activeCompetitions[d]!==false};vm.createContext(c);
  vm.runInContext(source.split('\n').find(x=>x.startsWith('function slotEnabled196(')),c);
  assert.equal(after.matches.filter(c.slotEnabled196).length,0);
});
await test('FIX: mine and review queue paginate with equal timestamps and draft priority',async()=>{
 useLeague();const db=new LocalD1(),call=api(db);await call('/me');
 const insert=db.sql.prepare("INSERT INTO news_posts(id,uid,author,season,cost,status,payload,created_at,updated_at) VALUES(?,?,?,?,0,?,?,?,?)");
 const ids=[];for(let i=0;i<25;i++){const id=randomUUID();ids.push(id);insert.run(id,reader.sub,'Audit','season-audit',i===0?'draft':'pending',JSON.stringify({title:'News '+i,division:'0',team:'general'}),now,now);}
 for(const kind of ['mine','queue']){let seen=[],cursor='';do{const q=await call('/posts/'+kind+(cursor?'?before='+encodeURIComponent(cursor):''),undefined,kind==='queue'?owner:reader);if(kind==='mine'&&!cursor)assert.equal(q.posts[0].id,ids[0]);seen.push(...q.posts.map(p=>p.id));cursor=q.next;}while(cursor);assert.equal(new Set(seen).size,kind==='mine'?25:24);assert.equal(seen.length,new Set(seen).size);}
 await assert.rejects(()=>call('/posts/mine?before=garbage'));
});
console.log('PASS '+results.length+' server regression groups');
