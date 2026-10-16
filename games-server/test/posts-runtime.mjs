import {Miniflare} from 'miniflare';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import {handle} from '../worker.mjs';
globalThis.crypto??=webcrypto;
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2025-10-01',d1Databases:{DB:'news-test'},host:'127.0.0.1',port:0});
const owner='iCLoGhjbXNgY3Q7dbxX0456vagI2',now=Date.now(),season={id:'s1',closed:false,teams:{a:'Equipo A',b:'Equipo B',c:'Equipo C'},groups:[['a'],['b'],['c']],activeCompetitions:[true,true,false,true]},state={seasons:[season]};
let revision=0;const original=globalThis.fetch;
globalThis.fetch=async url=>{if(String(url).includes('/roles/'))return Response.json({fields:{role:{stringValue:String(url).endsWith('/mod')?'moderator':'viewer'}}});const text=JSON.stringify(state),rev='r'+revision,hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');return Response.json({fields:String(url).endsWith('/head')?{revision:{stringValue:rev},pages:{integerValue:'1'},hash:{stringValue:hash}}:{revision:{stringValue:rev},index:{integerValue:'0'},text:{stringValue:text}}});};
try{
 const db=await mf.getD1Database('DB');for(const file of ['schema.sql','practice-schema.sql','bets-schema.sql','posts-schema.sql','news-withdrawals-schema.sql'])await db.batch(readFileSync(new URL('../'+file,import.meta.url),'utf8').split(/(?=^CREATE |^PRAGMA )/m).map(x=>x.trim()).filter(Boolean).map(s=>db.prepare(s)));
 const env={DB:db,OWNER_UID:owner,FIREBASE_PROJECT_ID:'pro-mobile-league'},call=async(uid,path,body)=>{const r=await handle(new Request('https://example.test/posts/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env,{sub:uid,name:'Nombre '+uid},now);return r.json();},fails=(fn,status)=>assert.rejects(fn,e=>e.status===status),balance=async uid=>(await db.prepare('SELECT balance FROM wallets WHERE uid=?').bind(uid).first()).balance;
 const body={id:'news-request-00000001',season:'s1'},content={title:'Mi noticia',body:'Texto',division:'0',team:'a',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='};
 let p=(await call('user','buy',body)).post;assert.equal(p.cost,250);assert.equal(await balance('user'),250);
 await call('user','buy',body);await call('user','buy',{...body,id:'news-request-00000002'});assert.equal(await balance('user'),250);
 await fails(()=>call('stranger','save',{id:p.id,version:0,content}),403);
 await fails(()=>call('user','save',{id:p.id,version:0,content:{...content,division:'2',team:'c'}}),409);
 p=(await call('user','save',{id:p.id,version:0,content})).post;assert.equal(p.version,1);
 await fails(()=>call('user','submit',{id:p.id,version:0,content}),409);
 p=(await call('user','submit',{id:p.id,version:1,content})).post;assert.equal(p.status,'pending');await call('user','submit',{id:p.id,version:1,content});
 assert.equal((await call('stranger','feed?season=s1')).posts.length,0);assert.equal((await call('stranger','mine')).posts.length,0);await fails(()=>call('user','queue'),403);await fails(()=>call('user','review',{id:p.id,decision:'approved'}),403);
 assert.equal((await call('mod','queue')).posts.length,1);await fails(()=>call('mod','review',{id:p.id,decision:'rejected'}),400);
 await call('mod','review',{id:p.id,decision:'rejected',reason:'Corregir imagen'});await call('mod','review',{id:p.id,decision:'rejected',reason:'Corregir imagen'});assert.equal(await balance('user'),500);
 assert.equal((await db.prepare("SELECT count(*) n FROM ledger WHERE id LIKE 'news-refund:%'").first()).n,1);
 p=(await call('user','buy',{...body,id:'news-request-00000003'})).post;p=(await call('user','submit',{id:p.id,version:0,content})).post;
 const race=await Promise.allSettled([call('mod','review',{id:p.id,decision:'approved'}),call(owner,'review',{id:p.id,decision:'rejected',reason:'No'})]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
 const row=(await call('user','mine')).posts.find(n=>n.id===p.id);assert.equal(await balance('user'),row.status==='approved'?250:500);
 p=(await call('mod','buy',{...body,id:'news-request-00000004'})).post;assert.equal(p.cost,0);assert.equal(await balance('mod'),500);p=(await call('mod','submit',{id:p.id,version:0,content})).post;assert.equal(p.status,'approved');
 assert.ok((await call('user','feed?season=s1')).posts.some(n=>n.id===p.id));season.activeCompetitions[0]=false;revision++;assert.equal((await call('user','feed?season=s1')).posts.length,0);season.activeCompetitions[0]=true;revision++;
 // Insufficient funds rolls the news insertion back; never creates a free draft.
 await db.prepare('INSERT INTO wallets(uid,name,created_at) VALUES(?,?,?)').bind('poor','Pobre',now).run();await db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?)').bind('spend-poor','poor',-400,'Test',now).run();await fails(()=>call('poor','buy',{...body,id:'news-request-00000005'}),409);assert.equal(await balance('poor'),100);assert.equal((await call('poor','mine')).posts.length,0);
 // Concurrent purchases create only one paid draft.
 await Promise.all([6,7].map(n=>call('racer','buy',{...body,id:'news-request-0000000'+n})));assert.equal(await balance('racer'),250);assert.equal((await call('racer','mine')).posts.length,1);
 await fails(async()=>call('racer','save',{id:(await call('racer','mine')).posts[0].id,version:0,content:{...content,image:'data:image/png;base64,PHNjcmlwdD4='}}),400);
 // Withdrawal refunds draft/pending exactly once, hides it, and cannot race an approval into a double credit.
 let w=(await call('withdrawer','buy',{...body,id:'withdraw-draft-000001'})).post;
 await fails(()=>call('stranger','withdraw',{id:w.id}),403);
 await call('withdrawer','withdraw',{id:w.id});await call('withdrawer','withdraw',{id:w.id});assert.equal(await balance('withdrawer'),500);assert.equal((await call('withdrawer','mine')).posts.length,0);
 w=(await call('withdrawer','buy',{...body,id:'withdraw-pending-0001'})).post;await call('withdrawer','submit',{id:w.id,version:0,content});await call('withdrawer','withdraw',{id:w.id});assert.equal(await balance('withdrawer'),500);await fails(()=>call('mod','review',{id:w.id,decision:'approved'}),409);
 w=(await call('withdrawer','buy',{...body,id:'withdraw-racing-00001'})).post;await call('withdrawer','submit',{id:w.id,version:0,content});
 await Promise.allSettled([call('withdrawer','withdraw',{id:w.id}),call('mod','review',{id:w.id,decision:'approved'})]);
 const wr=await db.prepare('SELECT * FROM news_posts WHERE id=?').bind(w.id).first();assert.equal(await balance('withdrawer'),wr.status==='approved'?250:500);
 if(wr.status==='approved')await fails(()=>call('withdrawer','withdraw',{id:w.id}),409);
 const free=(await call('mod','buy',{...body,id:'withdraw-free-0000001'})).post;await call('mod','withdraw',{id:free.id});assert.equal(await balance('mod'),500);
 console.log('PASS withdrawals: own draft and pending, repeat request, hidden entries, no free-admin refund, approval race and approved withdrawal blocked');
 console.log('PASS D1 publications: charge once, paid draft resume, owner-only edit, version conflict, immutable pending, admin verification, no public pending leak, refund once, review race, free admin, active competition filtering, insufficient balance rollback and concurrent purchase');
}finally{globalThis.fetch=original;await mf.dispose();}

