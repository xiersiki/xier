import {readFileSync, writeFileSync} from 'node:fs';
const tabs=await fetch(`http://127.0.0.1:${process.env.XIER_SMOKE_PORT || 9337}/json/list`).then(r=>r.json());
const tab=tabs.find(t=>t.url.includes('/html/index.html'));
if(!tab) throw new Error('Packaged main window not found');
const ws=new WebSocket(tab.webSocketDebuggerUrl); let id=0;const pending=new Map();
ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}});
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
const timeout=setTimeout(()=>{console.error('CDP timeout');process.exit(1);},20000);
try {
const result=await call('Runtime.evaluate',{expression:readFileSync(process.argv[2],'utf8'),awaitPromise:true,returnByValue:true});
if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
console.log(JSON.stringify(result.result.value,null,2));
if(process.argv[3]){const shot=await call('Page.captureScreenshot',{format:'png'});writeFileSync(process.argv[3],Buffer.from(shot.data,'base64'));}
} finally {clearTimeout(timeout);ws.close();}
