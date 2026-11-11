const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {EventEmitter}=require('node:events');
const {createServer}=require('../app/server');
const plan={title:'整理报修',question:'',steps:[{agent:'ticket',instruction:'整理缺项',dependsOn:[]}]};
const report={status:'review',summary:'请核对资料',content:'软件版本待补充。',sources:[],question:''};
const credential='unit-test-only-not-a-real-credential';
async function until(check){for(let index=0;index<100;index++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,3));}throw Error('Expected API state was not reached');}

function fixture(context,options={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lianshan-api-'));const runtimeFile=path.join(directory,'tasks.sqlite');const calls=[];
  const server=createServer({runtimeFile,fetchImpl:async(url,request)=>{const payload=JSON.parse(request.body);calls.push({url,payload});return Response.json({choices:[{message:{content:JSON.stringify(payload.model==='router-test'?plan:report)}}]});},...options});
  context.after(()=>{server.emit('close');fs.rmSync(directory,{recursive:true,force:true});});
  let csrf='';
  async function request(url,body,headers={}){
    const incoming=new EventEmitter();Object.assign(incoming,{url,method:body?'POST':'GET',socket:{localPort:4333},headers:{host:'127.0.0.1:4333',origin:'http://127.0.0.1:4333','content-type':'application/json','x-hub-session':csrf,...headers}});
    incoming[Symbol.asyncIterator]=async function*(){yield Buffer.from(JSON.stringify(body||{}));};
    let status;let content;const response=new EventEmitter();response.writeHead=value=>{status=value;};response.end=value=>{content=JSON.parse(value);};
    await server.listeners('request')[0](incoming,response);return {status,data:content};
  }
  async function connect(){
    csrf=(await request('/api/model-connections')).data.csrf;
    for(const agentId of ['manager','ticket'])assert.equal((await request('/api/model-connections/save',{agentId,provider:'deepseek',model:agentId==='manager'?'router-test':'worker-test',key:credential,expectedRevision:0})).status,200);
  }
  const body=()=>({projectId:'AFTERSALES',eventId:randomUUID(),text:'准备报修资料',consent:true,allowedAgents:['manager','ticket'],modelRevisions:{manager:1,ticket:1},context:{caseId:'',messages:[],knowledge:[]}});
  return {request,connect,body,calls,runtimeFile};
}

test('task API requires a local nonce even for reads and unauthorized access never creates storage',async context=>{
  const {request,runtimeFile}=fixture(context);
  assert.equal((await request('/api/super-agent')).status,403);assert.equal(fs.existsSync(runtimeFile),false);
  const csrf=(await request('/api/model-connections')).data.csrf;
  for(const headers of [{origin:'https://untrusted.example'},{host:'untrusted.example'},{'sec-fetch-site':'cross-site'}])assert.equal((await request('/api/super-agent',null,{'x-hub-session':csrf,...headers})).status,403);
  assert.equal(fs.existsSync(runtimeFile),false);
});
test('authenticated intake executes router and worker through saved model connections without leaking keys',async context=>{
  const {request,connect,body,calls,runtimeFile}=fixture(context);await connect();const input=body();
  const receipt=await request('/api/super-agent/events',input);assert.equal(receipt.status,202);
  await until(async()=>(await request('/api/super-agent')).data.tasks[0]?.status==='review');
  const snapshot=(await request('/api/super-agent')).data;
  assert.equal(snapshot.tasks[0].id,receipt.data.taskId);assert.equal(snapshot.tasks[0].steps[0].result.content,report.content);assert.equal(snapshot.capabilities.businessWrites,false);
  assert.deepEqual(calls.map(call=>call.payload.model),['router-test','worker-test']);assert.ok(calls.every(call=>call.payload.tools===undefined));
  assert.ok(!JSON.stringify(snapshot).includes(credential));assert.ok(fs.existsSync(runtimeFile));assert.equal(fs.readFileSync(runtimeFile).includes(Buffer.from(credential)),false);
  assert.equal((await request('/api/super-agent/events',input)).data.duplicate,true);assert.equal(calls.length,2);
});
test('task writes reject missing consent, stale connection, private context and cross-origin requests',async context=>{
  const {request,connect,body,calls}=fixture(context);await connect();
  for(const change of [{consent:false},{modelRevisions:{manager:0,ticket:1}},{context:{...body().context,internalNotes:'private'}},{allowedAgents:['manager','shell']}])assert.ok((await request('/api/super-agent/events',{...body(),...change})).status>=400);
  assert.equal((await request('/api/super-agent/events',body(),{origin:undefined})).status,403);assert.equal(calls.length,0);
});
test('removing a worker connection cancels the running model request and preserves a visible failure',async context=>{
  let workerStarted=false;let cancelled=false;
  const {request,connect,body}=fixture(context,{fetchImpl:async(url,options)=>{
    if(JSON.parse(options.body).model==='router-test')return Response.json({choices:[{message:{content:JSON.stringify(plan)}}]});
    workerStarted=true;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{cancelled=true;reject(Error('stopped'));},{once:true}));
  }});
  await connect();await request('/api/super-agent/events',body());await until(()=>workerStarted);
  assert.equal((await request('/api/model-connections/remove',{agentId:'ticket',expectedRevision:1})).status,200);
  await until(async()=>(await request('/api/super-agent')).data.tasks[0]?.status==='failed');assert.equal(cancelled,true);
  const state=(await request('/api/super-agent')).data;assert.equal(state.tasks[0].steps[0].result,null);assert.equal(state.models.find(entry=>entry.agentId==='ticket').configured,false);
});
