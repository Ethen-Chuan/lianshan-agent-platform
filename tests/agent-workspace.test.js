const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');

function fixture(){
  let projectId='AFTERSALES';
  const listeners={};const notices=[];const store={AFTERSALES:{tasks:[]},RETAIL:{tasks:[]}};
  const app={cases:[],agents:[{id:'service',enabled:true,mode:'auto'}],channels:[{id:'wechat',read:true,reply:true,status:'正常'}],knowledge:[{id:'KB-0101',title:'版本查询',version:'V2.1',status:'已发布',product:'座舱终端 A1',content:'在设置中打开系统信息，查看软件版本。'}]};
  const tasks=[{id:'PM-0001',kind:'service',status:'已完成',caseId:'CS-0108',updatedAt:'2026-11-10',conversationId:'OLD-DM'}];
  const window={PortfolioHub:{navProject:()=>({id:projectId})},ManagerHub:{getEngine:()=>({get:()=>({tasks}),kinds:{service:'报修准备'}})}};
  const document={addEventListener(name,handler){(listeners[name]||=[]).push(handler);},querySelector(){return null;},createElement(){return {};},head:{append(){}}};
  const context=vm.createContext({window,document,structuredClone,crypto:{randomUUID},console});
  for(const file of ['agent-harness.js','project-hub.js','group-chat.js','agent-workspace.js','service-journey.js'])vm.runInContext(filesystem.readFileSync(path.join(__dirname,'../app',file),'utf8'),context);
  const studio=window.ProjectStudio;
  window.PortfolioHub={navProject:()=>({id:projectId})};
  window.ProjectStudio={data:()=>store[projectId]};
  const host={getState:()=>app,persist(){},render(){},navigate(){},toast(message){notices.push(message);},isSensitive:value=>String(value).includes('SENSITIVE'),escape:value=>String(value),openCase(){},addMessage(item,role,text){item.messages.push({role,text,time:'刚刚'});},audit(){}};
  window.AgentWorkspace.configure(host);window.ServiceJourney.configure(host);
  return {window,studio,app,tasks,store,notices,switchProject(value){projectId=value;},click(action,value){for(const listener of listeners.click||[])listener({preventDefault(){},target:{closest:selector=>selector.includes(action.split('-')[0]+'-')?{dataset:{action,value}}:null}});},submitText(value){context.FormData=class{get(){return value;}};for(const listener of listeners.submit||[])listener({preventDefault(){},target:{id:'journey-message-form'}});}};
}

function withRun(outcomes){
  const {window}=fixture();const harness=window.AgentHarness;
  const entry={projectId:'AFTERSALES',config:{name:'演练助手',tool:'summary',fields:'事项',keywords:'演练'},samples:outcomes.map((expected,index)=>({id:'sample-'+index,input:'输入',expected,approved:true})),runs:[]};
  const fingerprint=JSON.stringify({config:entry.config,samples:entry.samples.map(sample=>({id:sample.id,input:sample.input,expected:sample.expected,approved:sample.approved})),runner:harness.version});
  entry.runs.push({fingerprint,runner:harness.version,contract:harness.compile(entry.config,'AFTERSALES'),results:entry.samples.map(sample=>({sampleId:sample.id,expected:sample.expected,approved:true,pass:true}))});return entry;
}

test('unified task view references old tasks instead of copying them into a new store',()=>{
  const {window,tasks}=fixture();const records=window.AgentWorkspace.tasks();assert.equal(records.length,1);assert.equal(records[0].legacy,tasks[0]);assert.match(records[0].label,/非业务解决/);window.AgentWorkspace.openTask('PM-0001');assert.equal(window.AgentWorkspace.view().selected,'legacy:PM-0001');assert.equal(tasks.length,1);assert.equal(tasks[0].conversationId,'OLD-DM');
});
test('task identities cannot collide between custom and legacy engines',()=>{
  const {window,store}=fixture();store.AFTERSALES.tasks.push({id:'PM-0001',name:'定制任务',status:'待配置'});assert.equal(new Set(window.AgentWorkspace.tasks().map(task=>task.key)).size,2);
});
test('project switches isolate tasks, filters and client sessions',()=>{
  const {window,switchProject}=fixture();window.AgentWorkspace.view().filter='attention';window.ServiceJourney.start('version');switchProject('RETAIL');assert.equal(window.AgentWorkspace.tasks().length,0);assert.equal(window.AgentWorkspace.view().filter,'all');assert.equal(window.ServiceJourney.sessions().length,0);window.ServiceJourney.start('version');switchProject('AFTERSALES');assert.equal(window.ServiceJourney.sessions().length,1);
});
test('release requires all three approved boundary classes, not merely a nonzero pass rate',()=>{
  const {studio}=fixture();assert.equal(studio.readiness(withRun(['prepared'])).localReady,false);const full=withRun(['prepared','missing','handoff']);assert.equal(studio.readiness(full).localReady,true);assert.equal(studio.readiness(full).productionReady,false);full.config.name='已修改';assert.equal(studio.readiness(full).localReady,false);
});
test('unapproved or failing samples prevent release despite category coverage',()=>{
  const {studio}=fixture();const full=withRun(['prepared','missing','handoff']);full.runs[0].results[1].approved=false;assert.equal(studio.readiness(full).localReady,false);full.runs[0].results[1].approved=true;full.runs[0].results.push({expected:'prepared',pass:false,approved:true});assert.equal(studio.readiness(full).localReady,false);
});
test('extra unapproved samples cannot bypass the gate when all three classes are covered',()=>{
  const {studio}=fixture();const full=withRun(['prepared','missing','handoff']);full.runs[0].results.push({expected:'prepared',pass:true,approved:false});assert.equal(studio.readiness(full).localReady,false);
});
test('self-service knowledge response does not count as resolution until the customer confirms',()=>{
  const {window,click}=fixture();window.ServiceJourney.start('version');const session=window.ServiceJourney.sessions()[0];assert.equal(session.status,'answered');assert.equal(session.resolved,false);click('journey-resolve');assert.equal(session.resolved,true);
});
test('new customer input revokes a prior resolution instead of preserving a false success',()=>{
  const {window,click,submitText}=fixture();window.ServiceJourney.start('version');click('journey-resolve');submitText('我仍然找不到，请转人工');assert.equal(window.ServiceJourney.sessions()[0].resolved,false);assert.equal(window.ServiceJourney.sessions()[0].status,'needs-human');
});
test('missing or conflicting versions require clarification and never choose a value silently',()=>{
  const {window,submitText}=fixture();window.ServiceJourney.start('repair');const session=window.ServiceJourney.sessions()[0];assert.equal(session.status,'collecting');submitText('软件版本 V2.3.1');assert.equal(session.status,'ready-handoff');submitText('也提到 V2.4.0');assert.equal(session.version,'待确认');assert.equal(session.status,'needs-human');
});
test('handoff preserves transcript and attempts, is idempotent, and does not create a ticket',()=>{
  const {window,app,submitText}=fixture();window.ServiceJourney.start('repair');submitText('软件版本 V2.3.1');const session=window.ServiceJourney.sessions()[0];const original=session.messages.length;window.ServiceJourney.handoff();assert.equal(app.cases.length,1);assert.equal(app.cases[0].messages.length,original+1);assert.ok(app.cases[0].handoff.attempted.length);assert.equal(app.cases[0].handoff.knownFields.version,'V2.3.1');window.ServiceJourney.handoff();assert.equal(app.cases.length,1);assert.equal(app.tickets,undefined);assert.equal(session.resolved,false);
});
test('disabled channels block handoff without losing customer context',()=>{
  const {window,app,notices}=fixture();window.ServiceJourney.start('repair');app.channels[0].status='已停用';window.ServiceJourney.handoff();assert.equal(app.cases.length,0);assert.ok(window.ServiceJourney.sessions()[0].messages.length);assert.match(notices.at(-1),/渠道已停用/);
});
test('tool failure and retry do not fabricate a successful business response',()=>{
  const {window,click}=fixture();window.ServiceJourney.start('timeout');const session=window.ServiceJourney.sessions()[0];assert.equal(session.status,'tool-failed');click('journey-retry');assert.equal(session.status,'needs-human');assert.match(session.messages.at(-1).text,/工单接口尚未接入，仍无法核实进度，请转人工查询/);click('journey-resolve');assert.equal(session.resolved,false);
});
test('plain-language clarification does not invent actions the customer has tried',()=>{
  const {window}=fixture();const result=window.ServiceJourney.assess({product:'座舱终端 A1',version:'待确认',scenario:'repair'},'设备黑屏，想报修。');assert.equal(result.status,'collecting');assert.match(result.text,/请补充设备的软件版本/);assert.match(result.text,/可以直接转人工/);assert.doesNotMatch(result.text,/您提到|已尝试|重启后/);
});
test('unsupported products and upgrade questions never reuse a version-location answer',()=>{
  const {window,submitText}=fixture();window.ServiceJourney.start('version');submitText('B2 如何查看版本？');assert.equal(window.ServiceJourney.sessions()[0].status,'needs-human');assert.equal(window.ServiceJourney.sessions()[0].product,'待确认');window.ServiceJourney.start('version');submitText('如何升级到最新版本？');assert.equal(window.ServiceJourney.sessions()[1].status,'needs-human');
});
test('unpublished or mismatched knowledge cannot support a self-service answer',()=>{
  const {window,app}=fixture();app.knowledge[0].product='其他产品';window.ServiceJourney.start('version');assert.equal(window.ServiceJourney.sessions()[0].status,'needs-human');app.knowledge[0].product='座舱终端 A1';app.knowledge[0].status='已停用';window.ServiceJourney.start('version');assert.equal(window.ServiceJourney.sessions()[1].status,'needs-human');
});
test('sensitive customer text is rejected rather than persisted or handed to another component',()=>{
  const {window,submitText}=fixture();window.ServiceJourney.start('repair');const before=JSON.stringify(window.ServiceJourney.sessions());submitText('SENSITIVE');assert.equal(JSON.stringify(window.ServiceJourney.sessions()),before);
});

test('self-service reads the approved knowledge body instead of a hardcoded answer',()=>{
  const {window,app}=fixture();app.knowledge[0].content='请打开关于设备页面，再查看版本一栏。';window.ServiceJourney.start('version');
  assert.equal(window.ServiceJourney.sessions()[0].messages.at(-1).text,app.knowledge[0].content);
  app.knowledge[0].content='';window.ServiceJourney.start('version');assert.equal(window.ServiceJourney.sessions()[1].status,'needs-human');
});
test('paused or assist-only service cannot auto-answer in the customer preview',()=>{
  const {window,app}=fixture();app.agents[0].enabled=false;window.ServiceJourney.start('version');assert.equal(window.ServiceJourney.sessions()[0].status,'needs-human');
  app.agents[0].enabled=true;app.agents[0].mode='assist';window.ServiceJourney.start('version');assert.equal(window.ServiceJourney.sessions()[1].status,'needs-human');
});
test('handed-off customer and staff share one transcript without copying internal notes',()=>{
  const {window,app,submitText}=fixture();window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];const original=JSON.stringify(session.messages);const item=app.cases[0];
  item.owner='human';item.messages.push({role:'staff',text:'请补充当前软件版本。'},{role:'internal',text:'内部核对说明'},{role:'system',text:'内部审批说明'});
  const messages=window.ServiceJourney.publicMessages(session);assert.equal(messages.at(-1).text,'请补充当前软件版本。');assert.doesNotMatch(JSON.stringify(messages),/内部/);
  submitText('当前版本 V2.3.1');assert.equal(item.messages.at(-1).text,'当前版本 V2.3.1');assert.equal(item.status,'人工处理中');assert.equal(item.unread,true);assert.equal(app.cases.length,1);assert.equal(JSON.stringify(session.messages),original);
});
test('customer projection rejects mismatched case links and never shows another customer',()=>{
  const {window,app,submitText,notices}=fixture();window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];app.cases[0].handoff.sourceSession='other-session';
  assert.equal(window.ServiceJourney.publicMessages(session).length,0);assert.equal(window.ServiceJourney.canConfirm(session),false);const before=JSON.stringify(app.cases);submitText('客户补充');assert.equal(JSON.stringify(app.cases),before);window.ServiceJourney.handoff();assert.equal(app.cases.length,1);assert.match(notices.at(-1),/关联会话不可用/);
});
test('a completed ticket and a staff-recorded result are not a customer confirmation',()=>{
  const {window,app,click}=fixture();window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];const item=app.cases[0];
  click('journey-resolve');assert.equal(session.resolved,false);app.tickets=[{caseId:item.id,status:'已完成'}];item.status='已解决';item.evidence='客服记录的依据';window.ServiceJourney.sync();assert.equal(session.resolved,false);
  item.messages.push({role:'staff',text:'工单已完成，请确认设备是否恢复。'});click('journey-resolve');assert.equal(session.resolved,true);assert.equal(item.resultSource,'customer-preview');assert.equal(item.messages.at(-1).role,'customer');assert.equal(item.status,'已解决');
  const length=item.messages.length;click('journey-resolve');assert.equal(item.messages.length,length);
});
test('follow-up reopens the same case and revokes the old confirmed outcome',()=>{
  const {window,app,click,submitText}=fixture();window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];const item=app.cases[0];item.owner='human';item.messages.push({role:'staff',text:'请确认是否恢复。'});click('journey-resolve');submitText('又黑屏了，问题还没有解决。');
  assert.equal(session.resolved,false);assert.equal(session.resolvedAt,null);assert.equal(item.status,'人工处理中');assert.equal(item.evidence,'');assert.equal(app.cases.length,1);
  item.messages.push({role:'staff',text:'请再次确认。'});click('journey-resolve');item.status='人工处理中';window.ServiceJourney.sync();assert.equal(session.resolved,false);
});
test('disabled channels and sensitive follow-up input preserve the linked record unchanged',()=>{
  const {window,app,click,submitText}=fixture();window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];const item=app.cases[0];item.messages.push({role:'staff',text:'请确认是否恢复。'});const before=JSON.stringify(app.cases);
  submitText('SENSITIVE');assert.equal(JSON.stringify(app.cases),before);app.channels[0].status='已停用';submitText('继续补充');click('journey-resolve');assert.equal(JSON.stringify(app.cases),before);assert.equal(session.resolved,false);
});
