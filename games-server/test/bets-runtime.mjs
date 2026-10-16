import {Miniflare} from 'miniflare';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import {handle} from '../worker.mjs';
import {periodTime,selectSix} from '../bets.mjs';
globalThis.crypto??=webcrypto;
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2025-10-01',d1Databases:{DB:'bets-test'},host:'127.0.0.1',port:0});
const owner='iCLoGhjbXNgY3Q7dbxX0456vagI2',now=Date.parse('2026-10-19T12:00:00-03:00');
const season={id:'season2',closed:false,teams:{},fixtures:[[],[],[]]};for(let d=0;d<3;d++){const round=[];for(let i=0;i<5;i++){const h=`h${d}${i}`,w=`w${d}${i}`;season.teams[h]='LOCAL '+h;season.teams[w]='VISITA '+w;round.push({id:`m${d}${i}`,h,w,a:null,b:null});}season.fixtures[d]=[round];}
const all=()=>season.fixtures.flat(2),state={seasons:[season]};
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{const u=String(url);if(u.includes('/roles/'))return Response.json({fields:{role:{stringValue:u.endsWith('/mod')?'moderator':'viewer'}}});const text=JSON.stringify(state),revision='rev-'+text.length+'-'+all().filter(m=>m.a!==null).length,hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');return Response.json({fields:u.endsWith('/head')?{revision:{stringValue:revision},pages:{integerValue:'1'},hash:{stringValue:hash}}:{revision:{stringValue:revision},index:{integerValue:'0'},text:{stringValue:text}}});};
try{
 const db=await mf.getD1Database('DB');for(const file of ['schema.sql','practice-schema.sql','bets-schema.sql']){const s=readFileSync(new URL('../'+file,import.meta.url),'utf8');await db.batch(s.split(/(?=^CREATE |^PRAGMA )/m).map(x=>x.trim()).filter(Boolean).map(s=>db.prepare(s)));}
 const env={DB:db,OWNER_UID:owner,FIREBASE_PROJECT_ID:'pro-mobile-league'};
 const call=async(uid,path,body,time=now)=>{const r=await handle(new Request('https://example.test'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env,{sub:uid,name:uid},time);return r.json();};
 const fails=async(fn,status)=>{await assert.rejects(fn,e=>e.status===status);};
 assert.equal(new Date(periodTime(now).closes).toISOString(),'2026-10-23T04:30:00.000Z');
 assert.equal(selectSix(season).length,6);assert.deepEqual(selectSix(season).map(m=>m.competition),[0,1,2,0,1,2]);
 const disabled=await call('user','/bets/board',undefined,Date.parse('2026-10-16T02:00:00Z'));assert.equal(disabled.disabled,true);assert.equal((await db.prepare('SELECT count(*) n FROM bets').first()).n,0);
 const board=await call(owner,'/bets/board');assert.equal(board.matches.length,6);assert.equal(board.period.status,'draft');
 await fails(()=>call('reader','/bets/open',{period:board.period.id}),403);
 await call(owner,'/bets/open',{period:board.period.id});const slot=board.matches[0],place={id:'request-1234567890',slot:slot.id,choice:'home',stake:25};
 await call('user','/bets/place',place);await call('user','/bets/place',place);assert.equal((await db.prepare('SELECT balance FROM wallets WHERE uid=?').bind('user').first()).balance,475);
 await fails(()=>call('user','/bets/place',{...place,choice:'away'}),409);
 await fails(()=>call('reader','/bets/settle',{slot:slot.id,confirm:true,a:1,b:0}),403);
 await fails(()=>call('mod','/bets/settle',{slot:slot.id,confirm:true,a:1,b:0}),409);
 Object.assign(all().find(m=>m.id===slot.match_id),{a:1,b:0});await call('mod','/bets/settle',{slot:slot.id,confirm:true,a:1,b:0});await call('mod','/bets/settle',{slot:slot.id,confirm:true,a:1,b:0});
 assert.equal((await db.prepare('SELECT balance FROM wallets WHERE uid=?').bind('user').first()).balance,525);
 const actions=await Promise.allSettled([1,2].map((x)=>call('user','/bets/place',{...place,id:'concurrent-123456789'+x,slot:board.matches[x].id,stake:100})));assert.equal(actions.filter(x=>x.status==='fulfilled').length,1);
 const b=(await db.prepare("SELECT * FROM bets WHERE uid='user' AND status='pending'").all()).results[0];const unused=all().find(m=>!board.matches.some(s=>s.match_id===m.id));const before=(await db.prepare("SELECT balance FROM wallets WHERE uid='user'").first()).balance;
 await call(owner,'/bets/replace',{slot:b.slot,match:unused.id,reason:'Partido elegido por error'});assert.equal((await db.prepare("SELECT balance FROM wallets WHERE uid='user'").first()).balance,before+100);assert.equal((await db.prepare('SELECT status FROM bets WHERE id=?').bind(b.id).first()).status,'void');
 await fails(()=>call('user','/bets/place',{...place,id:'after-close-12345678',slot:board.matches[3].id},periodTime(now).closes),409);
 const trial=await call(owner,'/practice/bets/board');await fails(()=>call('mod','/practice/bets/board'),403);await call(owner,'/practice/bets/open',{period:trial.period.id});
 const tslot=trial.matches[0];await call(owner,'/practice/bets/place',{...place,id:'trial-123456789012',slot:tslot.id});await call(owner,'/practice/bets/settle',{slot:tslot.id,confirm:true,a:1,b:0});assert.equal((await db.prepare('SELECT balance FROM trial_wallets WHERE uid=?').bind(owner).first()).balance,525);
 assert.equal((await db.prepare("SELECT balance FROM wallets WHERE uid='user'").first()).balance,before+100);
 await call(owner,'/practice/bets/reset',{});const reset=await call(owner,'/practice/bets/board');assert.equal(reset.wallet.balance,500);
 console.log('PASS real D1 SQL: UTC-3 cutoff, six automatic choices, opening permissions, debit once, stake cap concurrency, explicit result confirmation, moderator authentication, payout once, correction refund, deadline, private practice isolation and reset');
}finally{globalThis.fetch=originalFetch;await mf.dispose();}
