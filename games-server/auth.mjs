import {createRemoteJWKSet,jwtVerify} from 'jose';
import {GameError} from './engine.mjs';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export async function verifyToken(token,project,keyset=keys){
 try{
  const {payload}=await jwtVerify(token,keyset,{algorithms:['RS256'],issuer:`https://securetoken.google.com/${project}`,audience:project,requiredClaims:['exp','iat','sub','auth_time']});
  const now=Math.floor(Date.now()/1000);
  if(typeof payload.sub!=='string'||!payload.sub.length||payload.sub.length>128||payload.iat>now||!Number.isFinite(payload.auth_time)||payload.auth_time>now)throw new Error('claims');
  return payload;
 }catch{throw new GameError('Tu sesión venció. Volvé a iniciar sesión.',401);}
}
export async function authenticate(request,env){
 const value=request.headers.get('Authorization')||'';
 if(!value.startsWith('Bearer ')||value.length>8192)throw new GameError('Iniciá sesión para jugar.',401);
 return verifyToken(value.slice(7),env.FIREBASE_PROJECT_ID);
}
