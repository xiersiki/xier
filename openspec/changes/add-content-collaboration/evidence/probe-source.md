# 隔离接入探针源代码

需显式授权真实模型调用并设置 XIER_LIVE_PROVIDER_CONFIG。将代码保存为隔离 npm 工程中的 probe.mjs；依赖和边界见 integration.md。不得在项目默认 CI 自动运行。

```js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {HttpAgent} from '@ag-ui/client';
import {EventEncoder} from '@ag-ui/encoder';
import {createOpencodeClient} from '@opencode-ai/sdk/v2';
const root=path.dirname(new URL(import.meta.url).pathname);
const evidence={versions:{opencode:'1.19.4',sdk:'1.19.4'},startedAt:new Date().toISOString(),checks:[],requests:[],events:{}};
const add=(name,result)=>{evidence.checks.push({name,...result});console.log(JSON.stringify({name,...result}));};
const decode=x=>{try{return JSON.parse(x)}catch{return JSON.parse(Buffer.from(x,'base64').toString())}};
const cfg=JSON.parse(fs.readFileSync(process.env.XIER_LIVE_PROVIDER_CONFIG,'utf8'));
const providers=decode(cfg.provider);const ds=providers.find(p=>p.name?.toLowerCase().includes('deepseek')||p.id?.toLowerCase().includes('deepseek')||JSON.stringify(p).includes('api.deepseek.com'));
const settings=decode(ds.openAISetting);
if(new URL(settings.baseURL).hostname!=='api.deepseek.com'||!settings.apiKey)throw Error('Expected authorized DeepSeek configuration');
let mode='live',pendingMock,child,streamAbort=new AbortController();
const proxy=http.createServer(async(req,res)=>{
 let bytes='';for await(const c of req)bytes+=c;
 let body;try{body=JSON.parse(bytes)}catch{res.writeHead(400).end();return}
 const meta={mode,model:body.model,stream:body.stream,thinking:body.thinking,tools:(body.tools??[]).map(t=>t.function?.name),roles:body.messages?.map(x=>x.role),messageCount:body.messages?.length};
 evidence.requests.push(meta);console.log(JSON.stringify({request:meta}));
 if(evidence.requests.length>6){res.writeHead(429).end();return}
 if(mode==='hold'){
   res.writeHead(200,{'content-type':'text/event-stream'});res.flushHeaders();
   let closed=false;res.on('close',()=>{closed=true;meta.connectionClosed=true;pendingMock?.();});
   setTimeout(()=>{if(!closed)res.end('data: [DONE]\n\n')},20000).unref();return;
 }
 try {
  const abort=new AbortController();res.on('close',()=>abort.abort());
  const upstream=await fetch(settings.baseURL.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+settings.apiKey},body:bytes,signal:abort.signal});
  meta.status=upstream.status;if(!upstream.ok){const bad=await upstream.clone().json().catch(()=>({}));meta.errorMessage=String(bad.error?.message??bad.message??'').replaceAll(settings.apiKey,'[REDACTED]').slice(0,500);console.log(JSON.stringify({upstreamError:meta.errorMessage}));}res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')??'application/json'});
  for await(const chunk of upstream.body)res.write(chunk);res.end();
 }catch(e){meta.errorType=e.name;if(!res.headersSent)res.writeHead(502);res.end();}
});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const proxyPort=proxy.address().port;const port=42000+Math.floor(Math.random()*1000);const password=randomUUID();
const dirs={};for(const d of ['work','config','data','cache','state','test-home']){dirs[d]=path.join(root,'isolated',d);fs.mkdirSync(dirs[d],{recursive:true});}
const config={model:'xier-test/deepseek-flash',small_model:'xier-test/deepseek-flash',default_agent:'content',share:'disabled',autoupdate:false,permission:{'*':'deny',StructuredOutput:'allow'},agent:{title:{disable:true},summary:{disable:true},content:{mode:'primary',prompt:'You edit only the supplied text. Do not inspect files, use the shell, or access the network. Return the requested structured rewrite.',permission:{'*':'deny',StructuredOutput:'allow'}}},provider:{'xier-test':{npm:'@ai-sdk/openai-compatible',name:'Xier authorized DeepSeek test',options:{baseURL:`http://127.0.0.1:${proxyPort}/v1`,apiKey:'local-proxy-placeholder'},models:{'deepseek-flash':{name:'DeepSeek Chat',options:{thinking:{type:'disabled'}},limit:{context:64000,output:2048}}}}}};
try {
 child=spawn(path.join(root,'node_modules/.bin/opencode'),['serve','--hostname','127.0.0.1','--port',String(port)],{cwd:dirs.work,env:{...process.env,XDG_CONFIG_HOME:dirs.config,XDG_DATA_HOME:dirs.data,XDG_CACHE_HOME:dirs.cache,XDG_STATE_HOME:dirs.state,OPENCODE_TEST_HOME:dirs['test-home'],OPENCODE_DISABLE_PROJECT_CONFIG:'true',OPENCODE_DISABLE_CLAUDE_CODE:'true',OPENCODE_DISABLE_EXTERNAL_SKILLS:'true',OPENCODE_DISABLE_DEFAULT_PLUGINS:'true',OPENCODE_DISABLE_AUTOUPDATE:'true',OPENCODE_DISABLE_MODELS_FETCH:'true',OPENCODE_PURE:'true',OPENCODE_SERVER_PASSWORD:password,OPENCODE_CONFIG_CONTENT:JSON.stringify(config)},stdio:['ignore','pipe','pipe']});
 let diagnostic='';child.stdout.on('data',c=>diagnostic+=c);child.stderr.on('data',c=>diagnostic+=c);
 const baseUrl=`http://127.0.0.1:${port}`;const headers={authorization:'Basic '+Buffer.from('opencode:'+password).toString('base64')};
 let health;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Server exited: '+diagnostic.slice(-1200));try{const r=await fetch(baseUrl+'/global/health',{headers});if(r.ok){health=await r.json();break}}catch{}await new Promise(r=>setTimeout(r,300));}
 if(!health)throw Error('Server startup timeout');add('health',{passed:true,response:health});
 add('authentication',{passed:(await fetch(baseUrl+'/global/health')).status===401});
 const doc=await (await fetch(baseUrl+'/doc',{headers})).json();add('openapi',{passed:!!doc.paths?.['/session/{sessionID}/abort'],pathCount:Object.keys(doc.paths??{}).length});
 const client=createOpencodeClient({baseUrl,headers,directory:dirs.work});
 const subscription=await client.event.subscribe({directory:dirs.work},{signal:streamAbort.signal});
 const streamTask=(async()=>{try{for await(const e of subscription.stream){evidence.events[e.type]=(evidence.events[e.type]??0)+1;}}catch(e){if(!streamAbort.signal.aborted)evidence.streamError=e.name}})();
 for(const input of ['本功能可以让用户快速地完成文本的修改操作。']) {
  const session=(await client.session.create({title:'Synthetic content probe'},{throwOnError:true})).data;
  const start=Date.now();const result=(await client.session.prompt({sessionID:session.id,agent:'content',model:{providerID:'xier-test',modelID:'deepseek-flash'},format:{type:'json_schema',schema:{type:'object',properties:{replacement:{type:'string'},explanation:{type:'string'}},required:['replacement','explanation'],additionalProperties:false}},parts:[{type:'text',text:'请精简以下文字，保留原意。只处理这段测试文字：'+input}]},{throwOnError:true,signal:AbortSignal.timeout(120000)})).data;
  const structured=result.info?.structured;add('live-structured-rewrite',{passed:typeof structured?.replacement==='string'&&structured.replacement.length>0,elapsedMs:Date.now()-start,syntheticInput:input,structured:structured??null,errorName:result.info?.error?.name??null,partTypes:result.parts?.map(p=>p.type)});

  try{const single=(await client.session.message({sessionID:session.id,messageID:result.info.id},{throwOnError:true})).data;add('single-message-readback',{passed:JSON.stringify(single.info.structured)===JSON.stringify(structured)});}catch(e){add('single-message-readback',{passed:false,error:String(e.message).slice(0,500)});}
  try{const recent=(await client.session.messages({sessionID:session.id,limit:1},{throwOnError:true})).data;add('latest-message-readback',{passed:recent.length===1&&!!recent[0].info.structured});}catch(e){add('latest-message-readback',{passed:false,error:String(e.message).slice(0,500)});}
  const encoder=new EventEncoder();const bridge=http.createServer(async(req,res)=>{let b='';for await(const c of req)b+=c;const input=JSON.parse(b);res.writeHead(200,{'content-type':encoder.getContentType()});for(const e of [{type:'RUN_STARTED',threadId:input.threadId,runId:input.runId},{type:'STATE_SNAPSHOT',snapshot:{proposal:{replacement:structured?.replacement,explanation:structured?.explanation},status:'reviewable'}},{type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId}])res.write(encoder.encode(e));res.end();});
  await new Promise(r=>bridge.listen(0,'127.0.0.1',r));const agent=new HttpAgent({url:`http://127.0.0.1:${bridge.address().port}`,threadId:'synthetic-thread'});const mapped=[];try{await agent.runAgent({runId:'synthetic-run'},{onEvent:({event})=>{mapped.push(event.type)}});add('ag-ui-http-client',{passed:agent.state.proposal?.replacement===structured?.replacement&&mapped.join(',')==='RUN_STARTED,STATE_SNAPSHOT,RUN_FINISHED',events:mapped,scope:'real OpenCode result replayed through minimal local SSE bridge; not production UI'});}finally{bridge.closeAllConnections();bridge.close();}
  try{const restored=(await client.session.messages({sessionID:session.id},{throwOnError:true})).data;add('session-readback',{passed:Array.isArray(restored)&&restored.some(m=>m.info?.structured),messageCount:restored?.length});}catch(e){add('session-readback',{passed:false,error:String(e.message).slice(0,600)});}
 }
 mode='hold';const session=(await client.session.create({title:'Synthetic cancellation probe'},{throwOnError:true})).data;
 const pending=client.session.prompt({sessionID:session.id,agent:'content',parts:[{type:'text',text:'请精简测试文字：这是一段用于取消测试的示例。'}]},{throwOnError:true,signal:AbortSignal.timeout(30000)}).catch(e=>({errorName:e.name}));
 for(let i=0;i<100&&!evidence.requests.some(r=>r.mode==='hold');i++)await new Promise(r=>setTimeout(r,100));
 const start=Date.now();const aborted=await client.session.abort({sessionID:session.id},{throwOnError:true});await pending;
 const statuses=(await client.session.status({},{throwOnError:true})).data;add('server-abort',{passed:aborted.data===true&&(!statuses?.[session.id]||statuses[session.id].type==='idle'),abortAcknowledged:aborted.data,elapsedMs:Date.now()-start,status:statuses?.[session.id]??'absent-idle',scope:'deterministic held upstream; not live model billing proof'});
 add('exposed-tools',{passed:evidence.requests.filter(r=>r.mode==='live').every(r=>r.tools.every(t=>t==='StructuredOutput')),tools:[...new Set(evidence.requests.flatMap(r=>r.tools))]});
 streamAbort.abort();await streamTask;
}catch(e){add('probe-fatal',{passed:false,errorType:e.name,message:String(e.message).replaceAll(password,'[REDACTED]').replaceAll(settings.apiKey,'[REDACTED]').slice(0,1800)});process.exitCode=1}
finally{streamAbort.abort();if(child){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,2000))]);if(child.exitCode===null)child.kill('SIGKILL')}proxy.closeAllConnections();proxy.close();evidence.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'evidence.json'),JSON.stringify(evidence,null,2));}

```
