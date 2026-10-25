(async()=>{
const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('xier');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const read=store=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
if((await read('conversations')).length) throw new Error('Expected empty isolated profile');
const providers=await read('providers'); const providerId=providers[0]?.id||'offline-fixture';const now=Date.now();
await new Promise((resolve,reject)=>{const tx=db.transaction(['conversations','messages'],'readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
for(let c=1;c<=2;c++){
 const id='smoke-conversation-'+c;tx.objectStore('conversations').put({id,title:'依赖升级离线验收 '+c,selectedModel:providers[0]?.models?.[0]||'offline',providerId,createdAt:now+c,updatedAt:now+c,pinned:false,version:1,idempotentKey:id,dirty:false});
 for(let i=1;i<=80;i++)tx.objectStore('messages').put({id:id+'-'+i,conversationId:id,type:i%2?'question':'answer',content:'离线验收 '+c+' / 消息 '+i+'\n\n'+(i%2?'这是一条隔离测试问题。':'**离线测试回答**：检查 Markdown 和虚拟列表。\n\n- 第一项\n- 第二项'),createdAt:now+i,updatedAt:now+i,status:'success',dirty:false});
}});
db.close();return {fixture:'isolated IndexedDB only',conversations:2,messages:160,modelCalls:0};
})()
