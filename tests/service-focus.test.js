const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');

function fixture() {
  const nodes=new Map();const stored=new Map();const listeners={};
  const document={addEventListener(name,handler){(listeners[name]||=[]).push(handler);},getElementById(id){return nodes.get(id)||null;},querySelector(){return null;},createElement(){return {};},head:{append(){}},activeElement:null};
  const window={addEventListener(){},HUB_ICONS:{circle:'<svg class="icon"></svg>'},HubIdentity:{worker:()=>'<span></span>',avatar:()=>'<span></span>'},HubBrand:{header:()=>''}};
  const context=vm.createContext({window,document,localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},location:{hash:'#workspace',search:'?project=AFTERSALES'},URLSearchParams,structuredClone,crypto:{randomUUID},performance,console,setTimeout,clearTimeout,requestAnimationFrame:callback=>callback(),FormData:class{constructor(form){this.values=form.values||{};}get(name){return this.values[name];}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}}});
  const read=filename=>filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8');
  vm.runInContext(read('project-hub.js'),context);
  window.PortfolioHub={navProject:()=>({id:'AFTERSALES',name:'售后服务',department:'客户服务'}),isCollection:()=>false,route:value=>value,syncLocation(){},libraryNav:()=>''};
  window.TraceHub={currentScope:()=>null,workspaceData:()=>({active:{version:'TEST-V1'}}),record(){return 'TEST-TRACE';}};
  const app=read('app.js');vm.runInContext(app.slice(0,app.indexOf('window.HubModels.configure(')),context);
  vm.runInContext(read('service-journey.js'),context);
  vm.runInContext(`
    render=()=>{};closeDialog=()=>{};scrollChat=()=>{};toast=(text)=>{window.lastNotice=text;};
    showDialog=(title,subtitle,body)=>{window.lastDialog={title,subtitle,body};};
    const host={getState:()=>state,getView:()=>view,persist,render,navigate,addMessage,audit,checkRisk:detectRisk,escape:escapeHtml,button,icon,badge,toast,showDialog,closeDialog,isSensitive:text=>!!detectRisk(text)?.sensitive,openCase(identifier){view.caseId=identifier;navigate('workspace');}};
    window.AssistantHub.configure(host);window.ServiceJourney.configure(host);window.TicketAssistant.configure({...host,openTicket(identifier){window.openedTicket=identifier;}});
  `,context);
  return {window,nodes,stored,run:script=>vm.runInContext(script,context),click(action){for(const listener of listeners.click||[])listener({preventDefault(){},target:{closest:selector=>selector.includes('journey-')?{dataset:{action}}:null,classList:{contains:()=>false}}});},submit(value){for(const listener of listeners.submit||[])listener({preventDefault(){},target:{id:'journey-message-form',values:{text:value},matches:()=>false}});}};
}

test('default sidebar keeps customer work first and one business collaboration entry with no duplicate manager',()=>{
  const {run}=fixture();
  for(const page of ['workspace','group','project-assistant','tickets','knowledge','agents','orbit','customer']){
    const html=run(`view.page=${JSON.stringify(page)};sidebar()`);
    assert.deepEqual([...html.matchAll(/data-page="([^"]+)"/g)].map(match=>match[1]),['workspace','group','agents','orbit','knowledge','customer','settings']);
    assert.equal((html.match(/aria-current="page"/g)||[]).length,1,page);
    assert.doesNotMatch(html,/data-page="manager"|data-page="tickets"/);
  }
});
test('search restores coordination while unrelated experiments remain in settings',()=>{
  const {run,window}=fixture();run('openNavigator()');const search=window.lastDialog.body;
  assert.match(search,/客服工作台/);assert.match(search,/业务设计/);assert.match(search,/data-page="group"/);assert.match(search,/业务协作/);assert.doesNotMatch(search,/data-page="ontology"/);assert.match(search,/业务设计/);assert.doesNotMatch(search,/Super Agent/);assert.doesNotMatch(search,/data-page="(?:analytics|graph|forms|scoring|reception|dashboard)"/);
  const settings=run('settingsPage()');assert.match(settings,/<details[^>]+scope-archive/);assert.doesNotMatch(settings,/<details[^>]+scope-archive[^>]+open/);
  for(const page of ['analytics','graph','forms','scoring','reception','dashboard'])assert.ok(settings.includes('data-page="'+page+'"'));
  for(const page of ['group','project-assistant'])assert.equal(run(`view.page='${page}';deferredNotice()`),'');
  assert.match(run("view.page='analytics';deferredNotice()"),/固定样本/);assert.equal(run("view.page='workspace';deferredNotice()"),'');
});
test('assistant directory connects coordination, execution assistants and one Orbit entrance',()=>{
  const {run,window}=fixture();const before=run('JSON.stringify(state.agents)');const html=window.AssistantHub.directory();
  assert.deepEqual([...html.matchAll(/data-assistant="([^"]+)"/g)].map(match=>match[1]),['service','ticket','quality']);assert.equal((html.match(/data-action="studio-orbit"/g)||[]).length,1);
  assert.match(html,/发送前风险检查/);assert.match(html,/真实业务工具尚未接入/);assert.match(html,/data-page="group"/);assert.doesNotMatch(html,/data-page="(?:analytics|forms|reception)"/);assert.equal(run('JSON.stringify(state.agents)'),before);
});
test('ticket records belong to the filling assistant without a separate navigation entry or copied data',()=>{
  const {run,window}=fixture();run("navigate('tickets')");const before=run('JSON.stringify({tickets:state.tickets,cases:state.cases})');
  const page=run("window.AssistantHub.managed('tickets',ticketsPage())");const sidebar=run('sidebar()');
  assert.match(page,/<section class="owned-assistant-page" data-owner="ticket">/);assert.match(page,/<h1>工单填写助手<\/h1>/);assert.match(page,/<h2>工单记录<\/h2>/);
  assert.match(page,/data-business="tickets"/);assert.match(page,/data-page="tickets" aria-current="page"/);assert.match(page,/data-action="ticket-detail"/);
  assert.doesNotMatch(sidebar,/data-page="tickets"/);assert.match(sidebar,/data-page="agents" aria-current="page"/);
  assert.equal((sidebar.match(/aria-current="page"/g)||[]).length,1);assert.match(window.AssistantHub.directory(),/进入填单助手/);
  assert.equal(run('JSON.stringify({tickets:state.tickets,cases:state.cases})'),before);
});
test('ticket picker lists eligible conversations without creating drafts or reusing the selected case',()=>{
  const {run,window}=fixture();
  run('state.channels=[{id:"active",read:true},{id:"disabled",read:true,status:"已停用"}];state.cases=[{id:"OPEN",name:"演示客户",channel:"active",owner:"human",status:"人工处理中"},{id:"READONLY",channel:"active",owner:"readonly"},{id:"CLOSED",channel:"active",status:"已解决"},{id:"DISABLED",channel:"disabled"}];state.tickets=[{id:"EXISTING",caseId:"OPEN"}]');
  const before=run('JSON.stringify({cases:state.cases,tickets:state.tickets,drafts:state.ticketAssistant,selected:view.caseId})');
  window.TicketAssistant.chooseCase();assert.match(window.lastDialog.body,/data-id="OPEN"/);assert.match(window.lastDialog.body,/查看已有工单/);assert.doesNotMatch(window.lastDialog.body,/data-id="(?:READONLY|CLOSED|DISABLED)"/);
  assert.equal(run('JSON.stringify({cases:state.cases,tickets:state.tickets,drafts:state.ticketAssistant,selected:view.caseId})'),before);
  assert.match(run('ticketsPage()'),/data-action="ticket-choose-case"/);run('openNavigator()');assert.match(window.lastDialog.body,/data-action="assistant-business"[^>]*data-page="tickets"/);
});
test('choosing an existing ticket reopens it and never creates another business record',()=>{
  const {run,window}=fixture();window.ProjectStudio.authorizeLegacy=()=>{};
  run('state.channels=[{id:"active",read:true}];state.cases=[{id:"OPEN",name:"演示客户",channel:"active",owner:"human",messages:[]}];state.tickets=[{id:"EXISTING",caseId:"OPEN"}]');
  const before=run('JSON.stringify({cases:state.cases,tickets:state.tickets,drafts:state.ticketAssistant})');window.TicketAssistant.open('OPEN');
  assert.equal(window.openedTicket,'EXISTING');assert.equal(run('JSON.stringify({cases:state.cases,tickets:state.tickets,drafts:state.ticketAssistant})'),before);
});
test('customer experience is reachable directly and selects only a valid associated session',()=>{
  const {run,window}=fixture();window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];
  window.ServiceJourney.open(session.caseId);assert.equal(run('view.page'),'customer');assert.match(window.ServiceJourney.page(),/切换到客服视角/);assert.doesNotMatch(window.ServiceJourney.page(),/返回团队协作/);
  run("view.page='workspace'");window.ServiceJourney.open('CS-0106');assert.equal(run('view.page'),'workspace');
});
test('customer experience has one dedicated simulation entry and never highlights the staff workspace',()=>{
  const {run,window}=fixture();run("navigate('customer')");const html=run('sidebar()');
  const section=html.match(/<nav class="nav-section nav-experience-section"[\s\S]*?<\/nav>/)[0];
  assert.match(section,/aria-label="体验与验证"/);assert.match(section,/aria-label="客户体验（模拟）"/);assert.match(section,/<small class="nav-mode-tag">模拟<\/small>/);
  assert.equal((html.match(/data-page="customer"/g)||[]).length,1);assert.match(section,/aria-current="page"/);
  assert.match(html,/data-page="workspace" aria-current="false"/);assert.equal(run('pageNames.customer'),'客户体验');
  assert.match(window.ServiceJourney.page(),/<h1>客户体验<\/h1>/);assert.match(window.ServiceJourney.page(),/客户视角 \/ 本地模拟/);assert.match(window.ServiceJourney.page(),/不连接真实渠道/);
});
test('entering and leaving customer experience never starts a simulation or resets the selected session and draft',()=>{
  const {window,run,stored}=fixture();const original=run('JSON.stringify({cases:state.cases,tickets:state.tickets})');
  run("dispatch('navigate',{dataset:{page:'customer'}})");assert.equal(window.ServiceJourney.sessions().length,0);
  assert.equal(run('JSON.stringify({cases:state.cases,tickets:state.tickets})'),original);
  window.ServiceJourney.start('repair');const session=window.ServiceJourney.sessions()[0];session.draft='还没有发出的补充信息';run('persist()');
  const before=run('JSON.stringify(state.serviceJourney)');const persisted=[...stored.entries()];
  for(const page of ['group','workspace','knowledge','customer'])run('navigate('+JSON.stringify(page)+')');
  assert.equal(run('JSON.stringify(state.serviceJourney)'),before);assert.deepEqual([...stored.entries()],persisted);
  assert.match(window.ServiceJourney.page(),/还没有发出的补充信息/);assert.equal(session.resolved,false);
});
test('only a linked staff conversation offers the contextual customer-view shortcut',()=>{
  const {run,window}=fixture();run("queuePanel=()=>'';conversationPanel=()=>'';contextPanel=()=>'';");assert.doesNotMatch(run('workspacePage()'),/data-action="customer-preview"/);
  window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];run('view.caseId='+JSON.stringify(session.caseId));
  const workspace=run('workspacePage()');assert.match(workspace,/查看客户视角/);assert.match(workspace,new RegExp('data-action="customer-preview"[^>]*data-id="'+session.caseId+'"'));
  window.ServiceJourney.start('version');run("dispatch('customer-preview',{dataset:{id:"+JSON.stringify(session.caseId)+"}})");
  assert.equal(run('state.serviceJourney.activeId'),session.id);assert.equal(window.ServiceJourney.sessions().length,2);
});
test('switching to the staff perspective opens the active simulation’s own conversation',()=>{
  const {run,window,click}=fixture();window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const first=window.ServiceJourney.sessions()[0];
  window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const second=window.ServiceJourney.sessions()[1];run('view.caseId='+JSON.stringify(first.caseId));
  assert.match(window.ServiceJourney.page(),/data-action="journey-open"[^>]*>切换到客服视角/);const before=run('JSON.stringify({cases:state.cases,journey:state.serviceJourney})');
  click('journey-open');assert.equal(run('view.page'),'workspace');assert.equal(run('view.caseId'),second.caseId);
  assert.equal(run('JSON.stringify({cases:state.cases,journey:state.serviceJourney})'),before);
});
test('feature search and assistant links use the same customer-experience label',()=>{
  const {run,window}=fixture();run('openNavigator()');assert.match(window.lastDialog.body,/data-page="customer"[^>]*><span>客户体验<\/span>/);
  assert.doesNotMatch(window.lastDialog.body,/客户自助预览|体验客户自助/);assert.match(window.AssistantHub.directory(),/打开客户体验/);
});
test('staff reply and explicit ticket notification reach the same customer preview exactly once',()=>{
  const {run,window,nodes,submit}=fixture();window.ServiceJourney.start('repair');submit('软件版本 V2.3.1');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];run(`view.caseId=${JSON.stringify(session.caseId)};selectedCase().owner='human'`);
  nodes.set('reply-input',{value:'资料已核对，接下来安排检测。'});run('sendMessage()');assert.equal(window.ServiceJourney.publicMessages(session).at(-1).text,'资料已核对，接下来安排检测。');assert.equal(run('selectedCase().status'),'等待客户');
  run("view.composer='note'");nodes.get('reply-input').value='仅内部核对的审批依据';run('sendMessage()');assert.doesNotMatch(JSON.stringify(window.ServiceJourney.publicMessages(session)),/内部核对/);
  run("state.tickets.push({id:'TEST-001',caseId:view.caseId,status:'技术检测中'});openTicket=()=>{};dispatch('notify-ticket',{dataset:{id:'TEST-001'}})");
  assert.match(window.ServiceJourney.publicMessages(session).at(-1).text,/TEST-001.*技术检测中/);const length=window.ServiceJourney.publicMessages(session).length;
  run("dispatch('notify-ticket',{dataset:{id:'TEST-001'}})");assert.equal(window.ServiceJourney.publicMessages(session).length,length);
  submit('检测后还是黑屏。');assert.equal(run('selectedCase().messages.at(-1).text'),'检测后还是黑屏。');assert.equal(session.resolved,false);
});
test('actual customer confirmation persists across reload and new input reopens the existing case',()=>{
  const {run,window,nodes,stored,click,submit}=fixture();window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];run(`view.caseId=${JSON.stringify(session.caseId)};selectedCase().owner='human'`);
  nodes.set('reply-input',{value:'请确认当前是否恢复正常。'});run('sendMessage()');click('journey-resolve');assert.equal(run('selectedCase().status'),'已解决');assert.equal(session.resolved,true);
  const state=JSON.parse(stored.values().next().value);assert.equal(state.serviceJourney.sessions[0].resolved,true);assert.equal(state.cases.find(entry=>entry.id===session.caseId).resultSource,'customer-preview');
  run('state=JSON.parse(localStorage.getItem(STORAGE_KEY))');assert.equal(window.ServiceJourney.publicMessages(window.ServiceJourney.sessions()[0]).at(-1).text,'问题已解决，谢谢。');submit('仍未恢复。');assert.equal(run('selectedCase().status'),'人工处理中');assert.equal(window.ServiceJourney.sessions()[0].resolved,false);
});
test('unknown, disabled or receive-only channels cannot send staff messages',()=>{
  const {run,nodes}=fixture();run("selectedCase().owner='human'");nodes.set('reply-input',{value:'请确认设备型号。'});const before=run('selectedCase().messages.length');
  run("state.channels.find(channel=>channel.id===selectedCase().channel).reply=false;sendMessage()");assert.equal(run('selectedCase().messages.length'),before);
  run("selectedCase().channel='missing-channel';sendMessage()");assert.equal(run('selectedCase().messages.length'),before);
});

test('local repair preparation, explicit submission and status notification use the original conversation',()=>{
  const {window,run,nodes,submit,click}=fixture();window.ProjectStudio.authorizeLegacy=()=>{};
  window.ServiceJourney.start('repair');submit('A1 软件版本 V2.3.1');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];run(`view.caseId=${JSON.stringify(session.caseId)}`);
  const count=run('state.tickets.length');window.TicketAssistant.open(session.caseId);const draft=run('state.ticketAssistant.drafts[view.caseId]');assert.equal(draft.missing.length,0);
  nodes.set('ticket-form',{values:{...draft.values}});nodes.set('ticket-confirm',{checked:false});nodes.set('form-error',{textContent:''});window.TicketAssistant.submit();assert.equal(run('state.tickets.length'),count);assert.match(nodes.get('form-error').textContent,/勾选确认/);
  nodes.get('ticket-confirm').checked=true;window.TicketAssistant.submit();assert.equal(run('state.tickets.length'),count+1);assert.equal(run('state.tickets[0].caseId'),session.caseId);assert.equal(window.ServiceJourney.publicMessages(session).some(message=>message.text.includes('由工单填写助手整理')),false);
  window.TicketAssistant.submit();assert.equal(run('state.tickets.length'),count+1);
  run("openTicket=()=>{};state.tickets[0].status='已完成';dispatch('notify-ticket',{dataset:{id:state.tickets[0].id}})");assert.match(window.ServiceJourney.publicMessages(session).at(-1).text,/当前是“已完成”/);assert.equal(session.resolved,false);click('journey-resolve');assert.equal(session.resolved,true);
});

test('staff and self-service version answers use the same approved content',()=>{
  const {window,run}=fixture();run("state.knowledge.find(entry=>entry.id==='KB-0101').content='请在设置的设备信息页查看软件版本。'");window.ServiceJourney.start('version');
  assert.equal(run("serviceReply('在哪里查看软件版本？').text"),window.ServiceJourney.sessions()[0].messages.at(-1).text);
  run("state.knowledge.find(entry=>entry.id==='KB-0101').status='待审核'");assert.equal(run("serviceReply('在哪里查看软件版本？').handoff"),true);
});
