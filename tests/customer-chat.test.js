const test=require('node:test');
const assert=require('node:assert/strict');
const fixture=require('./helpers/group-chat-fixture');

function setup({configured=true,publicMode=false,respond,serviceJourney}={}){
  const calls=[];let revision=1;
  const tools=fixture('AFTERSALES',{customerModel:true,publicMode,serviceJourney,fetchImpl:async(url,options={})=>{
    calls.push({url,options});
    if(url==='/api/model-connections')return Response.json({mode:'local-server',capabilities:['customer-chat-v1'],csrf:'test-session',connections:[{agentId:'service',provider:'openai',model:'test-model',revision,configured}]});
    const body=JSON.parse(options.body);
    if(respond)return respond(body,options);
    return Response.json({origin:'model',reply:'请在设置中打开系统信息。',status:'answered',sources:body.knowledge.slice(0,1),provider:'openai',model:'test-model',revision,latencyMs:80,externalActions:0});
  }});
  const {window,emit}=tools;
  function allow(){emit('change',{target:{id:'customer-model-consent',checked:true,dataset:{},matches:()=>false,closest:()=>null}});}
  function session(){return window.ServiceJourney.sessions().find(entry=>entry.mode==='model'&&entry.id===tools.run('state.serviceJourney.activeId'));}
  return {...tools,calls,allow,session,changeRevision(){revision++;},requests:()=>calls.filter(call=>call.url.endsWith('/chat'))};
}

test('customer entry defaults to free model chat, with no pre-filled answer or request',()=>{
  const {window,calls}=setup();const page=window.ServiceJourney.page();
  assert.match(page,/客户视角 \/ 模型对话/);assert.match(page,/模型回复，无预设答案/);assert.doesNotMatch(page,/选择一个场景/);
  assert.equal(window.ServiceJourney.sessions().length,0);assert.equal(calls.length,0);
  window.ServiceJourney.startModel();assert.equal(window.ServiceJourney.sessions()[0].messages.length,0);assert.equal(calls.length,0);
});

test('missing connection or session consent never triggers a model call',async()=>{
  for(const configured of [false,true]){
    const {window,requests}=setup({configured});window.ServiceJourney.startModel();await window.CustomerChat.refresh();
    await window.CustomerChat.send('A1 查看软件版本');assert.equal(requests().length,0);assert.equal(window.ServiceJourney.sessions()[0].messages.length,0);
  }
});

test('a real chat request uses published knowledge and continues the same conversation',async()=>{
  const {window,run,allow,session,requests}=setup();window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();
  run('state.knowledge.push({...state.knowledge[0],id:"NEW-PUBLISHED",title:"A1 版本信息补充",owner:"test"});state.knowledge.push({...state.knowledge[0],id:"DRAFT",status:"待审核"})');
  await window.CustomerChat.send('A1 在哪里查看软件版本？');
  assert.equal(session().messages.length,2);assert.equal(session().messages[1].origin,'model');assert.equal(session().status,'answered');
  const first=JSON.parse(requests()[0].options.body);assert.ok(first.knowledge.some(entry=>entry.id==='NEW-PUBLISHED'));assert.ok(!first.knowledge.some(entry=>entry.id==='DRAFT'));
  assert.ok(first.knowledge.every(entry=>!('owner' in entry)));assert.equal(first.messages.length,1);
  await window.CustomerChat.send('我已经打开了，接下来呢？');
  const second=JSON.parse(requests()[1].options.body);assert.equal(second.messages.length,3);assert.equal(second.messages[1].role,'assistant');assert.match(second.messages[2].content,/接下来/);
  assert.equal(window.ServiceJourney.sessions().length,1);assert.equal(session().resolved,false);assert.equal(session().caseId,'');
});

test('sensitive input does not enter storage or model context',async()=>{
  const {window,allow,session,requests,emit}=setup();window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();
  emit('input',{target:{id:'customer-model-input',value:'contact@example.com',dataset:{},matches:()=>false,closest:()=>null}});
  assert.equal(session().draft,'');await window.CustomerChat.send('contact@example.com');assert.equal(session().messages.length,0);assert.equal(requests().length,0);
});

test('model failure is visible without fallback, and explicit retry does not duplicate the customer message',async()=>{
  let failed=true;
  const {window,allow,session,requests}=setup({respond:body=>failed?Response.json({error:'模型额度不足'},{status:502}):Response.json({origin:'model',reply:'请确认具体型号。',status:'collecting',sources:[],provider:'openai',model:'test-model',revision:1,latencyMs:50})});
  window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();await window.CustomerChat.send('我的设备怎么查看版本？');
  assert.equal(session().messages.length,1);assert.match(session().modelError,/额度不足/);assert.match(window.ServiceJourney.page(),/重试本条/);
  failed=false;await window.CustomerChat.send('',true);assert.equal(requests().length,2);assert.equal(session().messages.length,2);assert.equal(session().modelError,'');assert.equal(session().status,'collecting');
});

test('consent is per session and connection revision, and is never persisted',async()=>{
  const {window,allow,run,session,changeRevision,requests}=setup();window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();
  const original=session().id;assert.ok(!run('JSON.stringify(state.serviceJourney)').includes('consent'));
  window.ServiceJourney.startModel();await window.CustomerChat.send('A1 查看版本');assert.equal(requests().length,0);
  window.ServiceJourney.selectSession(original);changeRevision();await window.CustomerChat.refresh();await window.CustomerChat.send('A1 查看版本');assert.equal(requests().length,0);
});

test('handoff stops model output and preserves the same transcript for the local staff workspace',async()=>{
  let complete;let signal;
  const {window,allow,session,run}=setup({respond:(body,options)=>{signal=options.signal;return new Promise(resolve=>{complete=()=>resolve(Response.json({origin:'model',reply:'请补充型号。',status:'collecting',sources:[],provider:'openai',model:'test-model',revision:1}));});}});
  window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();const sending=window.CustomerChat.send('请问怎么处理？');
  assert.equal(session().status,'model-pending');window.ServiceJourney.handoff();const identifier=session().caseId;
  assert.ok(identifier);assert.equal(signal.aborted,true);complete();await sending;
  assert.equal(session().messages.length,1);assert.equal(session().status,'handed-off');
  assert.equal(run('state.cases.find(item=>item.id==='+JSON.stringify(identifier)+').messages[0].text'),'请问怎么处理？');
  assert.equal(window.ServiceJourney.publicMessages(session()).some(message=>message.role==='system'),false);
});

test('a late response after knowledge is unpublished is discarded rather than displayed',async()=>{
  let complete;
  const {window,allow,session,run}=setup({respond:body=>new Promise(resolve=>{complete=()=>resolve(Response.json({origin:'model',reply:'请查看系统信息。',status:'answered',sources:body.knowledge,provider:'openai',model:'test-model',revision:1}));})});
  window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();const sending=window.CustomerChat.send('A1 查看软件版本');
  run('state.knowledge.forEach(entry=>entry.status="已停用")');complete();await sending;
  assert.equal(session().messages.length,1);assert.match(session().modelError,/知识已变化/);
});

test('switching projects while waiting cannot insert a model result into the other project',async()=>{
  let complete;
  const {window,allow,session,switchProject,run}=setup({respond:()=>new Promise(resolve=>{complete=()=>resolve(Response.json({origin:'model',reply:'请说明具体问题。',status:'collecting',sources:[],provider:'openai',model:'test-model',revision:1}));})});
  window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();const original=session();const sending=window.CustomerChat.send('请问怎么处理？');
  switchProject('RETAIL');complete();await sending;assert.equal(window.ServiceJourney.sessions().length,0);assert.equal(original.messages.length,1);assert.equal(run('window.ProjectStudio.data().tasks.length'),0);
});

test('old regression sessions remain available and do not call a model',async()=>{
  const {window,calls}=setup();window.ServiceJourney.start('version');const old=JSON.stringify(window.ServiceJourney.sessions()[0]);
  assert.match(window.ServiceJourney.page(),/客户视角 \/ 本地模拟/);assert.equal(calls.length,0);
  window.ServiceJourney.setMode('model');assert.match(window.ServiceJourney.page(),/客户视角 \/ 模型对话/);
  window.ServiceJourney.startModel();window.ServiceJourney.setMode('rules');assert.match(window.ServiceJourney.page(),/继续历史演练/);assert.equal(JSON.stringify(window.ServiceJourney.sessions()[0]),old);
});

test('the public static build never attempts model requests and offers an honest limitation',async()=>{
  const {window,calls}=setup({publicMode:true});await window.CustomerChat.refresh();window.ServiceJourney.startModel();
  assert.equal(calls.length,0);assert.match(window.ServiceJourney.page(),/静态演示，不能保存密钥或调用模型/);
});

test('a paused reception policy prevents sending even with a configured and authorized connection',async()=>{
  const {window,allow,run,requests,session}=setup();window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();
  run('state.agents.find(entry=>entry.id==="service").mode="assist"');
  await window.CustomerChat.send('A1 查看软件版本');assert.equal(requests().length,0);assert.equal(session().messages.length,0);
});

test('starting another conversation cancels pending output and requires a new consent',async()=>{
  let complete;let signal;
  const {window,allow,session,requests}=setup({respond:(body,options)=>{signal=options.signal;return new Promise(resolve=>{complete=()=>resolve(Response.json({origin:'model',reply:'请补充型号。',status:'collecting',sources:[],provider:'openai',model:'test-model',revision:1}));});}});
  window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();const original=session();const sending=window.CustomerChat.send('在哪里查看版本？');
  window.ServiceJourney.startModel();assert.equal(signal.aborted,true);complete();await sending;
  assert.equal(original.messages.length,1);assert.equal(original.status,'model-error');assert.equal(session().messages.length,0);
  await window.CustomerChat.send('A1 查看版本');assert.equal(requests().length,1);
});

test('the fifteenth round is allowed but the next question is not sent',async()=>{
  const {window,allow,session,requests}=setup();window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();
  for(let turn=0;turn<15;turn++)await window.CustomerChat.send('A1 查看版本');
  assert.equal(session().messages.length,30);assert.equal(requests().length,15);
  await window.CustomerChat.send('A1 再查看版本');assert.equal(requests().length,15);assert.equal(session().messages.length,30);
});

test('opening a saved model handoff keeps its mode after refresh without resending requests',async()=>{
  const {window,allow,run,session}=setup();window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();
  await window.CustomerChat.send('A1 查看版本');window.ServiceJourney.handoff();const caseId=session().caseId;
  window.ServiceJourney.setMode('rules');window.ServiceJourney.open(caseId);
  assert.equal(run('state.serviceJourney.experienceMode'),'model');assert.match(window.ServiceJourney.page(),/已交接客服/);
});

test('reopening a pending model session offers a manual retry and does not restore consent',async()=>{
  const serviceJourney={activeId:'saved-test',experienceMode:'model',sessions:[{id:'saved-test',mode:'model',status:'model-pending',messages:[{role:'customer',text:'A1 查看版本'}],product:'A1',version:'待确认',caseId:''}]};
  const {window,requests,session}=setup({serviceJourney});
  assert.equal(session().status,'model-error');assert.match(session().modelError,/未续发/);assert.equal(requests().length,0);
  await window.CustomerChat.refresh();await window.CustomerChat.send('',true);assert.equal(requests().length,0);
  assert.match(window.ServiceJourney.page(),/重试本条/);
});

test('an empty model conversation cannot create a local handoff case',()=>{
  const {window,run}=setup();window.ServiceJourney.startModel();const count=run('state.cases.length');
  window.ServiceJourney.handoff();assert.equal(run('state.cases.length'),count);
});

test('model and knowledge markup is escaped instead of rendered as HTML',async()=>{
  const {window,allow}=setup({respond:()=>Response.json({origin:'model',reply:'请说明 <img src=x onerror=alert(1)> 的含义。',status:'collecting',sources:[],provider:'openai',model:'test-model',revision:1,latencyMs:10})});
  window.ServiceJourney.startModel();await window.CustomerChat.refresh();allow();await window.CustomerChat.send('请帮我核对信息');
  const html=window.ServiceJourney.page();assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
});

test('conversation repaint keeps reading position and input focus, following new messages only at the bottom',()=>{
  const {window,document,nodes}=setup();window.ServiceJourney.startModel();
  const stream={scrollTop:100,scrollHeight:1000,clientHeight:300};
  const input={disabled:false,selectionStart:3,selectionEnd:5,focus(){document.activeElement=this;},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}};
  nodes.set('customer-model-messages',stream);nodes.set('customer-model-input',input);document.activeElement=input;
  window.CustomerChat.capture();stream.scrollTop=0;stream.scrollHeight=1200;document.activeElement=null;window.CustomerChat.mount();
  assert.equal(stream.scrollTop,100);assert.equal(document.activeElement,input);assert.equal(input.selectionStart,3);assert.equal(input.selectionEnd,5);
  stream.scrollTop=900;window.CustomerChat.capture();stream.scrollTop=0;stream.scrollHeight=1400;window.CustomerChat.mount();assert.equal(stream.scrollTop,1400);
});
