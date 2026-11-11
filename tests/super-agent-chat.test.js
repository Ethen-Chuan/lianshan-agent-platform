const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const fixture=require('./helpers/group-chat-fixture');
const source=fs.readFileSync(path.join(__dirname,'../app/super-agent-chat.js'),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));

function setup({publicMode=false,configured=true,respond}={}){
  const calls=[];let disconnected=false;
  const state={mode:'local-super-agent',revision:0,concurrency:3,tasks:[],events:[],models:['manager','ticket'].map(agentId=>({agentId,configured,revision:1,provider:'test',model:'test-model'}))};
  const tools=fixture('AFTERSALES',{customerModel:true,publicMode,fetchImpl:async(url,options={})=>{
    calls.push({url,options});if(disconnected)throw Error('连接已断开');
    if(url==='/api/model-connections')return Response.json({mode:'local-server',csrf:'test-session'});
    if(url==='/api/super-agent')return Response.json(state);
    const body=JSON.parse(options.body);if(respond)return respond(body,options,state);
    const id=body.taskId||'TASK-'+(state.tasks.length+1);let task=state.tasks.find(entry=>entry.id===id);
    if(!task){task={id,projectId:'AFTERSALES',title:body.text,context:body.context,steps:[],history:[],inputs:[],round:1,status:'queued',revision:0};state.tasks.unshift(task);}
    task.inputs.push({text:body.text});task.revision++;state.revision++;return Response.json({taskId:id});
  }});
  tools.run(source);tools.run('window.SuperAgentChat.configure(host)');
  const target=properties=>({id:'',dataset:{},matches:()=>false,classList:{contains:()=>false},closest(selector){return selector==='[data-action^="sa-"]'&&this.dataset.action?this:null;},...properties});
  const change=properties=>tools.emit('change',{target:target(properties)});
  const click=(action,extra={})=>tools.emit('click',{target:target({dataset:{action:'sa-'+action,...extra}})});
  const type=text=>tools.emit('input',{target:target({id:'sa-input',value:text})});
  const allow=()=>change({id:'sa-consent',checked:true});
  return {...tools,api:tools.window.SuperAgentChat,state,calls,change,click,type,allow,requests:()=>calls.filter(call=>call.url.endsWith('/events')),disconnect(){disconnected=true;}};
}

test('model and rules use one group entry without copying historical business data',()=>{
  const {api,run,click}=setup();const before=run('JSON.stringify(state)');assert.equal(api.active(),true);assert.match(api.page(),/连小山与业务团队/);
  click('rules');assert.equal(api.active(),false);assert.match(api.modeBar(),/进入模型协作/);click('enable');assert.equal(api.active(),true);assert.equal(run('JSON.stringify(state)'),before);
});
test('static public mode does not request APIs and disabled connections cannot send',async()=>{
  const publicUI=setup({publicMode:true});await publicUI.api.refresh();assert.equal(publicUI.calls.length,0);assert.match(publicUI.api.page(),/静态演示不能执行模型任务/);
  const localUI=setup({configured:false});await localUI.api.refresh();localUI.type('整理资料');localUI.allow();await localUI.api.send();assert.equal(localUI.requests().length,0);
});
test('sending requires fresh consent and uses only selected customer messages and published knowledge',async()=>{
  const {api,run,change,type,allow,requests}=setup();await api.refresh();
  run('state.cases=[{id:"CASE-T",name:"演示客户",channel:"test",owner:"human",messages:[{role:"customer",text:"设备黑屏"},{role:"note",text:"私有备注"},{role:"assistant",text:"助手猜测"}]}];state.channels=[{id:"test",read:true}];state.knowledge=[{id:"K1",title:"版本",content:"核对版本",version:"V1",status:"已发布",owner:"内部负责人"}]');
  change({id:'sa-case',value:'CASE-T'});change({checked:true,dataset:{saKnowledge:'K1'}});type('请整理报修资料');await api.send();assert.equal(requests().length,0);
  allow();type('请整理报修资料并检查缺项');await api.send();assert.equal(requests().length,0);allow();await api.send();
  const body=JSON.parse(requests()[0].options.body);assert.equal(body.context.messages.length,1);assert.equal(body.context.messages[0].text,'设备黑屏');assert.equal(body.context.knowledge[0].owner,undefined);assert.doesNotMatch(JSON.stringify(body),/私有备注|助手猜测|内部负责人/);
  type('补充软件版本');await api.send();assert.equal(requests().length,1);allow();await api.send();assert.equal(JSON.parse(requests()[1].options.body).taskId,'TASK-1');assert.equal(JSON.parse(requests()[1].options.body).context,undefined);
});
test('readonly sources, unpublished knowledge and paused assistants invalidate the next send',async()=>{
  const {api,run,change,type,allow,requests}=setup();await api.refresh();
  run('state.cases=[{id:"CASE-T",name:"演示客户",channel:"test",owner:"human",messages:[]}];state.channels=[{id:"test",read:true}]');
  change({id:'sa-case',value:'CASE-T'});type('整理资料');allow();run('state.cases[0].owner="readonly"');await api.send();assert.equal(requests().length,0);
  change({id:'sa-case',value:''});allow();run('state.agents.find(entry=>entry.id==="ticket").enabled=false');await api.send();assert.equal(requests().length,0);
});
test('polling failures disable send while retaining the visible task and draft',async()=>{
  const {api,type,allow,requests,disconnect}=setup();await api.refresh();type('暂存草稿');allow();disconnect();await api.refresh(true);await api.send();assert.equal(requests().length,0);
  assert.match(api.page(),/暂存草稿/);assert.match(api.page(),/disabled>发送任务/);
});
test('switching tasks preserves separate in-memory drafts and stops require a new task',async()=>{
  const {api,state,type,click}=setup();state.tasks.push({id:'EXISTING',title:'已有任务',status:'accepted',context:{caseId:'',messages:[],knowledge:[],definition:null},round:1,inputs:[],steps:[],history:[]});
  await api.refresh();type('新任务草稿');click('select',{id:'EXISTING'});type('后续补充');click('new');assert.match(api.page(),/新任务草稿/);click('select',{id:'EXISTING'});assert.match(api.page(),/后续补充/);assert.doesNotMatch(api.page(),/placeholder="[^"]*" disabled/);
  state.tasks[0].status='stopped';state.revision++;await api.refresh();assert.match(api.page(),/placeholder="[^"]*" disabled/);
});
test('definite API refusal unlocks editing while an uncertain retry keeps the exact event ID',async()=>{
  let fail=true;
  const rejected=setup({respond:()=>Response.json({error:'资料已变化'},{status:409})});await rejected.api.refresh();rejected.type('整理资料');rejected.allow();await rejected.api.send();assert.doesNotMatch(rejected.api.page(),/核对并重试同一请求/);assert.match(rejected.api.page(),/整理资料/);
  const uncertain=setup({respond:body=>{if(fail)throw Error('连接中断');return Response.json({taskId:'RECOVERED'});}});
  await uncertain.api.refresh();uncertain.type('另一项资料');uncertain.allow();await uncertain.api.send();assert.match(uncertain.api.page(),/核对并重试同一请求/);
  fail=false;uncertain.click('resend');await turn();await turn();assert.equal(uncertain.requests().length,2);assert.equal(uncertain.requests()[0].options.body,uncertain.requests()[1].options.body);
});
test('changing models prevents uncertain replay and clears per-request authorization',async()=>{
  const {api,state,type,allow,click,requests}=setup({respond:()=>{throw Error('连接中断');}});await api.refresh();type('整理资料');allow();await api.send();
  state.models[0].revision++;await api.refresh();click('resend');await turn();assert.equal(requests().length,1);assert.match(api.page(),/连接或助手范围已变化/);
});
test('random request identifiers are not mistaken for personal identifiers in task content',async()=>{
  const {api,run,type,allow,requests}=setup();await api.refresh();
  run('crypto.randomUUID=()=>["12345678","1234","4000","a000",String(0).repeat(12)].join("-")');type('整理报修资料');allow();await api.send();assert.equal(requests().length,1);
});
test('task results escape HTML and selection never crosses into another project',async()=>{
  const {api,state,switchProject,click}=setup();state.tasks.push({id:'TEST',title:'<img src=x>',status:'review',context:{caseId:'',messages:[],knowledge:[],definition:null},round:1,inputs:[{text:'<script>bad</script>'}],steps:[],history:[]});
  await api.refresh();click('select',{id:'TEST'});assert.match(api.page(),/&lt;script&gt;/);assert.doesNotMatch(api.page(),/<img src=x>/);switchProject('RETAIL');assert.equal(api.active(),false);
});
test('staff handoff prefills the selected case without sending or erasing the task draft',async()=>{
  const {api,run,type,requests}=setup();await api.refresh();type('先核对维修范围');
  run('state.cases=[{id:"CASE-T",name:"演示客户",channel:"test",owner:"human",messages:[{role:"customer",text:"A1 黑屏"}]}];state.channels=[{id:"test",read:true}]');
  assert.equal(api.fromCase('CASE-T'),true);assert.equal(api.context().caseId,'CASE-T');assert.match(api.page(),/先核对维修范围/);assert.equal(requests().length,0);
  api.useRules();assert.equal(api.active(),false);
});
test('Orbit references use the active published version and do not silently use edited drafts',()=>{
  const {api,window,publish,change}=setup();const agent=publish('报修资料助手');
  assert.match(api.page(),new RegExp('value="'+agent.id+'"'));change({id:'sa-definition',value:agent.id});
  const reference=api.context().definition;assert.equal(reference.version,agent.activeVersion);assert.ok(reference.fields.includes('设备编号'));
  window.ProjectStudio.data().scenes[0].config.fields='仅草稿字段';assert.deepEqual(api.context().definition,reference);
  agent.enabled=false;assert.throws(()=>api.context(),/业务版本或授权已变化/);
});
