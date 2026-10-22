const assert=require('node:assert/strict');
const gateway=require('../assets/gateway208.js');
(async()=>{
 let legacy=0,uploads=0,configured=false,fail=false;const calls=[];
 const hash='a'.repeat(64),assets=new Map([[hash,'data:image/png;base64,AAAA']]);
 const head={format:22,revision:'11111111-1111-1111-1111-111111111111',pages:1,hash,assets:[hash],imageRefs:{i:hash}};
 global.firebase={firestore:{FieldValue:{serverTimestamp:()=>1}}};
 global.fetch=async(url,opts)=>{calls.push(url);assert.equal(opts.headers.Authorization,'Bearer verified-user-token');if(url.endsWith('/capabilities'))return Response.json({configured});if(fail)return Response.json({error:'Changed revision',code:'cloud/conflict'},{status:409});const body=JSON.parse(opts.body);assert.equal(body.base,'base');return Response.json({head});};
 class Repo{constructor(){this.validImage=()=>true;this.assetDocs={doc:()=>({set:async()=>uploads++})};}async publish(){legacy++;return{legacy:true};}}
 gateway.install({Repository:Repo,pack:async()=>({text:'{}',hash,assets,imageRefs:head.imageRefs}),validHead:x=>x.hash===hash});
 const r=new Repo(),u={uid:'user',getIdToken:async()=> 'verified-user-token'};
 await r.publish({},'base',u);assert.equal(legacy,1);
 configured=true;gateway.reset();const result=await r.publish({},'base',u);assert.equal(result.head.hash,hash);assert.equal(uploads,1);assert.equal(legacy,1);
 fail=true;await assert.rejects(()=>r.publish({},'base',u,new Set([hash])),e=>e.code==='cloud/conflict');assert.equal(uploads,1);assert.equal(legacy,1);
 global.fetch=async()=>{throw Error('offline')};gateway.reset();await assert.rejects(()=>r.publish({},'base',u));assert.equal(legacy,1);
 console.log('PASS optional gateway activation, verified user token, immutable asset upload, conflict propagation, no insecure fallback after server/network error.');
})().catch(e=>{console.error(e);process.exit(1)});
