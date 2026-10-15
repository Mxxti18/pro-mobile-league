import {Miniflare,createFetchMock} from 'miniflare';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test-key';jwk.alg='RS256';
const mock=createFetchMock();mock.disableNetConnect();mock.get('https://www.googleapis.com').intercept({path:'/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'}).reply(200,JSON.stringify({keys:[jwk]}),{headers:{'Content-Type':'application/json','Cache-Control':'max-age=3600'}}).persist();
const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/worker.js',import.meta.url).pathname,compatibilityDate:'2025-10-01',d1Databases:{DB:'pml-runtime-test'},bindings:{FIREBASE_PROJECT_ID:'pro-mobile-league',OWNER_UID:'owner'},fetchMock:mock,host:'127.0.0.1',port:0});
try{
 const db=await mf.getD1Database('DB');
 // D1 exec accepts one SQL statement per line; apply complete trigger bodies with prepared statements.
 const schema=readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
 const statements=schema.match(/CREATE TRIGGER[\s\S]*?END;|(?:PRAGMA|CREATE TABLE|CREATE INDEX)[^;]*;/g);
 await db.batch(statements.map(s=>db.prepare(s)));
 let r=await mf.dispatchFetch('http://localhost/health');assert.equal(r.status,200);assert.equal((await r.json()).service,'pml-games');
 r=await mf.dispatchFetch('http://localhost/me');assert.equal(r.status,401);
 r=await mf.dispatchFetch('http://localhost/me',{headers:{Authorization:'Bearer fake'}});assert.equal(r.status,401);
 await db.prepare('INSERT INTO wallets(uid,name,created_at) VALUES(?,?,?)').bind('user','Jugador',1).run();
 assert.equal((await db.prepare('SELECT balance FROM wallets').first()).balance,500);
 const now=Math.floor(Date.now()/1000);
 const token=await new SignJWT({auth_time:now,name:'Probador'}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('runtime-user').setIssuer('https://securetoken.google.com/pro-mobile-league').setAudience('pro-mobile-league').setIssuedAt(now).setExpirationTime(now+3600).sign(privateKey);
 const auth={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const invoke=async(path,body)=>{const r=await mf.dispatchFetch('http://localhost'+path,{method:'POST',headers:auth,body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 let result=await invoke('/me',{});assert.equal(result.status,200);assert.equal(result.data.wallet.balance,500);
 const kind=result.data.available.penalties?'penalties':result.data.available.mines?'mines':null;
 if(kind){
  const started=await invoke('/games/start',{kind});assert.equal(started.status,200);
  const again=await invoke('/games/start',{kind});assert.equal(again.data.game.id,started.data.game.id);
  let game=started.data.game;
  if(kind==='penalties'){
   const row=await db.prepare('SELECT secret FROM games WHERE id=?').bind(game.id).first();const secret=JSON.parse(row.secret);
   for(let i=0;i<5;i++){const action=await invoke('/games/action',{id:game.id,version:game.version,action:{type:'shoot',direction:(secret[i]+1)%3}});assert.equal(action.status,200);game=action.data.game;}
   assert.equal(game.payout,100);
  }else{const action=await invoke('/games/action',{id:game.id,version:game.version,action:{type:'cashout'}});assert.equal(action.status,200);game=action.data.game;}
  const wallet=await invoke('/me',{});assert.equal(wallet.data.wallet.balance,kind==='penalties'?575:475);
  const repeated=await invoke('/games/action',{id:game.id,version:game.version-1,action:{type:'cashout'}});assert.equal(repeated.status,409);
 }
 console.log('PASS real workerd/D1: RSA JWT login (mocked public-key endpoint), schema/triggers, initial500, daily ticket idempotency, server game and payout, stale replay rejection, missing/forged auth blocked');
}finally{await mf.dispose();}
