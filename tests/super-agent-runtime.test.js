const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createSuperAgentRuntime}=require('../app/super-agent-runtime');
const {createTaskStore}=require('../app/super-agent-store');
const policy=require('../app/super-agent-policy');

const planning={title:'报修资料整理',question:'',steps:[{agent:'ticket',instruction:'整理客户已给资料与缺项',dependsOn:[]}]};
const result={status:'review',summary:'资料草稿已准备',content:'客户报告 A1 黑屏，软件版本待确认。',sources:['M1'],question:''};
const models=()=>['manager','service','ticket','quality'].map(agentId=>({agentId,configured:true,revision:1,provider:'test',model:'test-model'}));
const auth=()=>({consent:true,allowedAgents:['manager','service','ticket','quality'],modelRevisions:{manager:1,service:1,ticket:1,quality:1}});
const input=(text='整理这次报修资料')=>({projectId:'AFTERSALES',eventId:randomUUID(),text,context:{caseId:'CASE-A',messages:[{id:'M1',text:'A1 黑屏，请协助报修。'}],knowledge:[]},...auth()});
async function until(check){for(let index=0;index<100;index++){if(check())return;await new Promise(resolve=>setTimeout(resolve,2));}throw Error('Expected state was not reached');}
function setup(options={}){
  const calls=[];
  const runtime=createSuperAgentRuntime({models,complete:async(agent,payload,options)=>{calls.push({agent,payload,options,input:JSON.parse(payload.messages[0].content)});return JSON.stringify(agent==='manager'?planning:result);},...options});
  return {runtime,calls,get:id=>runtime.snapshot().tasks.find(task=>task.id===id)};
}
const command=(task,action)=>({projectId:'AFTERSALES',eventId:randomUUID(),taskId:task.id,expectedRevision:task.revision,action,...(action==='retry'?auth():{})});

test('intake acknowledges immediately, router only plans and worker returns a reviewable draft',async()=>{
  const {runtime,calls,get}=setup();const receipt=runtime.receive(input());assert.equal(get(receipt.taskId).status,'queued');assert.equal(calls.length,0);
  await until(()=>get(receipt.taskId).status==='review');
  assert.deepEqual(calls.map(call=>call.agent),['manager','ticket']);assert.equal(get(receipt.taskId).mandate.externalWrite,false);
  assert.equal(get(receipt.taskId).steps[0].result.content,result.content);assert.equal(runtime.snapshot().capabilities.businessWrites,false);runtime.dispose();
});
test('event IDs deduplicate exact retries before and after completion',async()=>{
  const {runtime,calls,get}=setup();const body=input();const first=runtime.receive(body);assert.equal(runtime.receive(body).taskId,first.taskId);
  assert.throws(()=>runtime.receive({...body,text:'其他任务'}),/消息标识重复/);
  await until(()=>get(first.taskId).status==='review');assert.equal(runtime.receive(body).duplicate,true);assert.equal(runtime.snapshot().tasks.length,1);assert.equal(calls.length,2);runtime.dispose();
});
test('multiple tasks progress while one worker is blocked, with a configurable slot limit',async()=>{
  const releases=[];const calls=[];
  const {runtime,get}=setup({complete:async(agent,payload)=>{calls.push(agent);if(agent==='manager')return JSON.stringify(planning);return new Promise(resolve=>releases.push(()=>resolve(JSON.stringify(result))));}});
  runtime.configure({projectId:'AFTERSALES',expectedRevision:0,concurrency:2});
  const ids=[runtime.receive(input('任务甲')).taskId,runtime.receive(input('任务乙')).taskId,runtime.receive(input('任务丙')).taskId];
  await until(()=>releases.length===2);assert.equal(get(ids[2]).status,'queued');assert.equal(runtime.snapshot().active,2);
  releases[0]();await until(()=>releases.length===3);assert.equal(get(ids[0]).status,'review');assert.equal(get(ids[1]).status,'working');releases[1]();releases[2]();await until(()=>get(ids[2]).status==='review');runtime.dispose();
});
test('follow-ups replace only the current attempt, preserve history and discard late results',async()=>{
  let release;let workerCalls=0;
  const {runtime,get}=setup({complete:async agent=>{if(agent==='manager')return JSON.stringify(planning);if(++workerCalls===1)return new Promise(resolve=>{release=resolve;});return JSON.stringify({...result,content:'版本已补充，本轮草稿等待核对。'});}});
  const id=runtime.receive(input()).taskId;await until(()=>release);
  runtime.receive({projectId:'AFTERSALES',eventId:randomUUID(),taskId:id,expectedRevision:get(id).revision,text:'补充：软件版本 V2.3',...auth()});
  await until(()=>get(id).status==='review');release(JSON.stringify(result));await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(runtime.snapshot().tasks.length,1);assert.equal(get(id).round,2);assert.equal(get(id).history.length,1);assert.match(get(id).steps[0].result.content,/版本已补充/);runtime.dispose();
});
test('stop aborts active calls, does not resume on new input, and cannot accept late output',async()=>{
  let release;let signal;
  const {runtime,get}=setup({complete:async(agent,payload,options)=>{if(agent==='manager')return JSON.stringify(planning);signal=options.signal;return new Promise(resolve=>{release=resolve;});}});
  const id=runtime.receive(input()).taskId;await until(()=>release);runtime.command(command(get(id),'stop'));assert.equal(signal.aborted,true);
  release(JSON.stringify(result));await new Promise(resolve=>setTimeout(resolve,4));assert.equal(get(id).status,'stopped');assert.equal(get(id).steps[0].result,null);
  assert.throws(()=>runtime.receive({projectId:'AFTERSALES',eventId:randomUUID(),taskId:id,expectedRevision:get(id).revision,text:'继续',...auth()}),/已停止/);runtime.dispose();
});
test('waiting worker blocks dependent steps and its slot is released',async()=>{
  const calls=[];const {runtime,get}=setup({complete:async agent=>{calls.push(agent);return JSON.stringify(agent==='manager'?{...planning,steps:[...planning.steps,{agent:'quality',instruction:'复核草稿',dependsOn:[0]}]}:{...result,status:'waiting',question:'请提供软件版本。'});}});
  const id=runtime.receive(input()).taskId;await until(()=>get(id).status==='waiting');assert.deepEqual(calls,['manager','ticket']);assert.equal(get(id).question,'请提供软件版本。');assert.equal(get(id).steps[1].status,'queued');runtime.dispose();
});
test('persisted work survives restart and recovery requires a fresh explicit authorization',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lianshan-runtime-'));const filename=path.join(directory,'state.sqlite');
  const first=setup({filename,complete:async()=>new Promise(()=>{})});const id=first.runtime.receive(input()).taskId;await until(()=>first.get(id).status==='routing');first.runtime.dispose();
  const second=setup({filename});assert.equal(second.get(id).status,'interrupted');assert.equal(second.calls.length,0);assert.equal(second.get(id).inputs.length,1);
  assert.throws(()=>second.runtime.command({...command(second.get(id),'retry'),consent:false}),/确认模型费用/);
  second.runtime.command(command(second.get(id),'retry'));await until(()=>second.get(id).status==='review');assert.equal(second.get(id).history.length,1);assert.equal(fs.statSync(filename).mode&0o777,0o600);second.runtime.dispose();fs.rmSync(directory,{recursive:true});
});
test('timeout marks a failure without automatic retries, even when the adapter ignores abort',async()=>{
  let calls=0;const {runtime,get}=setup({timeoutMs:8,complete:async()=>{calls++;return new Promise(()=>{});}});
  const id=runtime.receive(input()).taskId;await until(()=>get(id).status==='failed');assert.match(get(id).error,/超时/);assert.equal(calls,1);assert.equal(get(id).steps.length,0);runtime.dispose();
});
test('model errors and invalid citations never create canned output',async()=>{
  for(const raw of ['not-json',JSON.stringify({...result,sources:['OTHER-CASE']}),JSON.stringify({...result,content:'已成功提交工单。'})]){
    const {runtime,get}=setup({complete:async agent=>agent==='manager'?JSON.stringify(planning):raw});const id=runtime.receive(input()).taskId;
    await until(()=>get(id).status==='failed');assert.equal(get(id).steps[0].result,null);runtime.dispose();
  }
});
test('router refuses undeclared workers, invalid dependencies and executable payloads',()=>{
  assert.throws(()=>policy.plan(JSON.stringify(planning),['service']),/未连接助手/);
  assert.throws(()=>policy.plan(JSON.stringify({...planning,steps:[{...planning.steps[0],dependsOn:[0]}]}),['ticket']),/无效依赖/);
  assert.throws(()=>policy.plan(JSON.stringify({...planning,command:'rm files'}),['ticket']),/格式/);
  assert.throws(()=>policy.plan(JSON.stringify({...planning,question:'提供版本'}),['ticket']),/不能同时/);
});
test('each task sees only its own snapshot, and follow-ups cannot change its customer or sources',async()=>{
  const {runtime,calls,get}=setup();const body=input();body.context.messages[0].text='仅甲任务的资料';const first=runtime.receive(body).taskId;
  const other=input('第二项任务');other.context.caseId='CASE-B';other.context.messages[0].text='仅乙任务的资料';const second=runtime.receive(other).taskId;
  await until(()=>get(first).status==='review'&&get(second).status==='review');
  for(const call of calls){const serialized=JSON.stringify(call.input);assert.ok(!(serialized.includes('仅甲')&&serialized.includes('仅乙')));}
  assert.throws(()=>runtime.receive({projectId:'AFTERSALES',eventId:randomUUID(),taskId:first,expectedRevision:get(first).revision,text:'补充',context:other.context,...auth()}),/不能更换客户/);runtime.dispose();
});
test('context schema excludes internal notes, sensitive material, unpublished knowledge and arbitrary permissions',()=>{
  const {runtime}=setup();
  for(const body of [{...input(),consent:false},{...input(),projectId:'RETAIL'},{...input(),modelRevisions:{manager:0}},{...input(),text:'contact@example.com'},{...input(),allowedAgents:['manager','shell']}])assert.throws(()=>runtime.receive(body));
  assert.throws(()=>policy.context({...input().context,internalNotes:'private'}));
  assert.throws(()=>policy.context({...input().context,knowledge:[{id:'K1',title:'草稿',content:'未审核',version:'draft',status:'待审核'}]}));
  assert.equal(runtime.snapshot().tasks.length,0);runtime.dispose();
});
test('approval changes only review status, with optimistic revision protection',async()=>{
  const {runtime,get}=setup();const id=runtime.receive(input()).taskId;await until(()=>get(id).status==='review');
  const body=command(get(id),'accept');assert.throws(()=>runtime.command({...body,expectedRevision:0}),/已更新/);runtime.command(body);assert.equal(get(id).status,'accepted');assert.equal(get(id).mandate.externalWrite,false);assert.equal(runtime.command(body).duplicate,true);runtime.dispose();
});
test('SQLite uses optimistic writes and refuses an incompatible schema',()=>{
  const store=createTaskStore();const state=store.read();store.write({...state,concurrency:4},0);assert.throws(()=>store.write(state,0),/另一个服务/);assert.equal(store.read().concurrency,4);store.write({...store.read(),schema:99},1);assert.throws(()=>store.read(),/版本不兼容/);store.close();
});
test('persistence conflicts visibly pause all processing instead of silently losing progress',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lianshan-conflict-'));const filename=path.join(directory,'state.sqlite');let release;
  const {runtime,get}=setup({filename,complete:async agent=>agent==='manager'?JSON.stringify(planning):new Promise(resolve=>{release=resolve;})});
  const id=runtime.receive(input()).taskId;await until(()=>release);
  const competing=createTaskStore(filename);const current=competing.read();competing.write(current,current.revision);competing.close();
  release(JSON.stringify(result));await until(()=>runtime.snapshot().serviceError);
  assert.match(runtime.snapshot().serviceError,/无法保存/);assert.equal(get(id).steps[0].result,null);assert.throws(()=>runtime.receive(input()),/暂停全部处理/);
  runtime.dispose();const resumed=setup({filename});assert.equal(resumed.get(id).status,'interrupted');assert.equal(resumed.calls.length,0);resumed.runtime.dispose();fs.rmSync(directory,{recursive:true});
});
test('follow-up cannot bypass the total attempt limit after repeated recoveries',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lianshan-limit-'));const filename=path.join(directory,'state.sqlite');
  const first=setup({filename});const id=first.runtime.receive(input()).taskId;first.runtime.dispose();
  const store=createTaskStore(filename);const state=store.read();state.tasks[0].attempts=12;store.write(state,state.revision);store.close();
  const {runtime,get}=setup({filename});assert.throws(()=>runtime.receive({projectId:'AFTERSALES',eventId:randomUUID(),taskId:id,expectedRevision:get(id).revision,text:'补充资料',...auth()}),/12 次/);
  runtime.dispose();fs.rmSync(directory,{recursive:true});
});
test('a follow-up includes the prior question and report rather than losing conversational context',async()=>{
  const calls=[];const {runtime,get}=setup({complete:async(agent,payload)=>{calls.push({agent,input:JSON.parse(payload.messages[0].content)});return JSON.stringify(agent==='manager'?planning:{...result,status:'waiting',question:'软件版本是什么？'});}});
  const id=runtime.receive(input()).taskId;await until(()=>get(id).status==='waiting');
  runtime.receive({projectId:'AFTERSALES',eventId:randomUUID(),taskId:id,expectedRevision:get(id).revision,text:'软件版本 V2.3',...auth()});await until(()=>get(id).status==='waiting');
  assert.equal(calls[2].input.previousRound.question,'软件版本是什么？');assert.equal(calls[3].input.previousRound.reports[0].content,result.content);assert.equal(calls[3].input.goal.length,2);runtime.dispose();
});
