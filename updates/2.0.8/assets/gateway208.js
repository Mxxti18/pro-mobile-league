/* Optional protected publishing. Never downgrade after the server is enabled. */
(function(root){
 'use strict';
 const URL208='https://pml-juegos.matifc-cai.workers.dev';
 let capability=null;
 async function request208(user,path,body){
  const token=await user.getIdToken(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  try{
   const res=await fetch(URL208+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
   const result=await res.json();
   if(!res.ok){const e=Error(result.error||'No se pudo completar el guardado protegido.');e.code=result.code||(res.status===403?'permission-denied':'unavailable');throw e;}
   return result;
  }catch(e){if(e.name==='AbortError'){const timeout=Error('La sincronización está tardando. Los cambios se conservan; volvé a comprobar la conexión.');timeout.code='unavailable';throw timeout;}throw e;}finally{clearTimeout(timer);}
 }
 async function enabled208(user){
  if(capability?.uid===user.uid&&capability.until>Date.now())return capability.enabled;
  const result=await request208(user,'/league/capabilities');
  if(typeof result.configured!=='boolean')throw Error('El servidor debe actualizarse antes de sincronizar.');
  capability={uid:user.uid,enabled:result.configured,until:Date.now()+30000};return result.configured;
 }
 function install208(Cloud){
  const legacy=Cloud.Repository.prototype.publish;
  Cloud.Repository.prototype.publish=async function(input,base,user,knownAssets=new Set()){
   if(user.uid===this.owner||!await enabled208(user))return legacy.call(this,input,base,user,knownAssets);
   const packed=await Cloud.pack(input);
   for(const [key,data]of packed.assets){if(!this.validImage(data))throw Error('Imagen inválida.');if(!knownAssets.has(key))await this.assetDocs.doc(key).set({data,createdAt:firebase.firestore.FieldValue.serverTimestamp()});}
   const result=await request208(user,'/league/publish',{base,text:packed.text,head:{hash:packed.hash,assets:Array.from(packed.assets.keys()),imageRefs:packed.imageRefs}});
   if(!Cloud.validHead(result.head)||result.head.hash!==packed.hash)throw Error('No se pudo verificar la publicación. Tus cambios se conservan.');
   return{head:result.head,assets:packed.assets};
  };
 }
 root.Gateway208={install:install208,request:request208,enabled:enabled208,reset:()=>{capability=null;}};
 if(typeof module!=='undefined')module.exports=root.Gateway208;
 else install208(root.CloudState22);
})(globalThis);
