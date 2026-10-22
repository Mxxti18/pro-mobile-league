/* A draft is removable only when all editable data equals the saved match. */
(function(root){
 'use strict';
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function unchanged(d,m,rawText){
  if(!d||!m||m.a===null||m.b===null)return false;
  if(Object.keys(d).some(k=>!['a','b','scorers','assists','reds','rawGoals','rawAssists','definition19','penaltiesPML'].includes(k)))return false;
  if(d.a===''||d.b===''||Number(d.a)!==m.a||Number(d.b)!==m.b)return false;
  if(!equal(d.scorers,m.scorers)||!equal(d.assists,m.assists||[[],[]])||!equal(d.reds||m.reds||[[],[]],m.reds||[[],[]]))return false;
  if(d.rawGoals!==null&&d.rawGoals!==undefined&&(!rawText||!equal(d.rawGoals,rawText(m.scorers))))return false;
  if(d.rawAssists!==null&&d.rawAssists!==undefined&&(!rawText||!equal(d.rawAssists,rawText(m.assists||[[],[]]))))return false;
  if(d.definition19&&!(m.a===m.b&&m.winner===(d.definition19==='1'?m.h:d.definition19==='2'?m.w:null)))return false;
  if(d.penaltiesPML&&!equal(d.penaltiesPML,m.penaltiesPML))return false;
  return true;
 }
 const api={unchanged};root.Drafts208=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
