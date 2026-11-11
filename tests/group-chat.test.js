const test=require('node:test');
const assert=require('node:assert/strict');
const fixture=require('./helpers/group-chat-fixture');
const plain=value=>JSON.parse(JSON.stringify(value));
const complete='报修，设备编号：DEMO-A，故障现象：黑屏';

test('group lists every project assistant with avatars, one composer and a separate sidebar',()=>{
  const {window,publish,switchProject}=fixture();publish('报修甲');publish('报修乙');publish('报修丙');
  const page=window.AgentWorkspace.page();const roster=window.GroupChat.members();assert.equal(roster.length,8);
  for(const member of roster)assert.match(page,new RegExp('data-action="gc-mention" data-id="'+member.id+'"'));
  assert.equal((page.match(/<textarea/g)||[]).length,1);assert.match(page,/class="agent-workspace is-chat"/);assert.match(page,/<aside class="aw-rail"/);assert.doesNotMatch(page,/aw-collaboration/);assert.match(page,/本地演练 · 模型与业务系统未接入/);
  switchProject('RETAIL');const retail=window.AgentWorkspace.page();assert.doesNotMatch(retail,/报修甲|报修乙|CS-0108/);assert.match(retail,/id="studio-prompt"/);assert.match(retail,/仅登记待办/);
});

test('roster mention preserves the selection across repaint and never starts a task',()=>{
  const {window,type,input,engine}=fixture();const before=engine.get().tasks.length;
  type('请先 看工单',3,4);window.GroupChat.mention('ticket');
  assert.equal(input().value,'请先 @工单填写助手 工单');assert.equal(input().selectionStart,'请先 @工单填写助手 '.length);assert.equal(engine.get().tasks.length,before);assert.equal(window.GroupChat.messages().length,0);
  type('@工 后续',2);window.GroupChat.mention('ticket');assert.equal(input().value,'@工单填写助手  后续');
});

test('unavailable mentions and oversized insertions preserve the unsent input',()=>{
  const {window,run,type,input,notices,send,engine}=fixture();const before=engine.get().tasks.length;
  run("state.agents.find(agent=>agent.id==='ticket').enabled=false");type('保留草稿');window.GroupChat.mention('ticket');assert.equal(input().value,'保留草稿');
  assert.match(window.GroupChat.page(),/data-id="ticket" disabled/);send('@工单填写助手 整理工单');assert.equal(engine.get().tasks.length,before);
  window.GroupChat.mention('unknown');assert.match(notices.at(-1),/未加入/);type('字'.repeat(1198));window.GroupChat.mention('manager');assert.equal(input().value.length,1198);assert.match(notices.at(-1),/1200/);
});

test('message markup escapes user text, assistant names and attributes without executing HTML',()=>{
  const {window,publish,send}=fixture();const agent=publish('资料<img>');send('@资料<img> '+complete);
  const page=window.GroupChat.page();assert.match(page,/资料&lt;img&gt;/);assert.doesNotMatch(page,/<img>/);assert.match(page,/class="identity-avatar/);assert.equal(window.ProjectStudio.data().tasks[0].assignee,agent.id);
});

test('one group instruction drives real local steps and surfaces their dependency handoffs',()=>{
  const {window,run,send,engine,flush,records}=fixture();const before=run('JSON.stringify([state.cases,state.tickets])');
  send('@连小山 处理 CS-0108，准备报修资料和回复，先不要发送。');const task=engine.get().tasks[0];
  assert.equal(task.conversationId,'GROUP-AFTERSALES');flush();assert.equal(task.status,'待确认');assert.ok(records.length>=6);
  const messages=window.GroupChat.messages();for(const identifier of ['operator','manager','service','ticket','quality'])assert.ok(messages.some(message=>message.author===identifier),identifier);
  const handoffs=messages.filter(message=>message.handoff);assert.ok(handoffs.length>=3);
  for(const message of handoffs){const event=task.events.find(event=>event.sequence===message.sourceEvent.sequence);assert.equal(event.type,'start');assert.deepEqual(plain(message.handoff.dependencies),plain(event.dependencies));for(const dependency of event.dependencies)assert.ok(task.events.some(previous=>previous.sequence<event.sequence&&previous.type==='finish'&&previous.stepId===dependency));}
  assert.match(window.GroupChat.page(),/找到候选资料|没有匹配的已发布资料/);assert.match(window.GroupChat.page(),/待审核回复/);assert.match(window.GroupChat.page(),/尚未提交/);assert.equal(run('JSON.stringify([state.cases,state.tickets])'),before);
  const snapshot=JSON.stringify(messages);window.ProjectHub.engineChanged();window.ProjectHub.engineChanged();assert.equal(JSON.stringify(window.GroupChat.messages()),snapshot);
});

test('expert fallback retains its simulated speaker and human review is never attributed to the coordinator',()=>{
  const {window,run,send,engine,flush}=fixture();run('state.knowledge=[]');send('处理 CS-0108，准备报修资料');flush();const task=engine.get().tasks[0];
  assert.ok(task.exchanges.some(exchange=>exchange.to==='expert'&&exchange.externalSent===false));assert.ok(window.GroupChat.messages().some(message=>message.author==='expert'&&message.kind==='a2a-result'));
  assert.match(window.GroupChat.page(),/外部专家（模拟）/);assert.match(window.GroupChat.page(),/没有真实专家接单/);
  engine.review(task.id,true,'已核对本地资料，仍不对外发送。',true);const review=window.GroupChat.messages().find(message=>message.kind==='review');assert.equal(review.author,'operator');
});

test('default stream includes all workers and a result filter can be toggled without mutating messages',()=>{
  const {window,send,flush,click}=fixture();send('处理 CS-0108，准备报修资料');flush();const snapshot=JSON.stringify(window.GroupChat.messages());
  const all=window.GroupChat.page();assert.equal(window.GroupChat.view().onlyResults,false);click('gc-filter');const concise=window.GroupChat.page();assert.ok((concise.match(/data-message-id=/g)||[]).length<(all.match(/data-message-id=/g)||[]).length);assert.match(concise,/显示全部消息/);click('gc-filter');assert.equal(JSON.stringify(window.GroupChat.messages()),snapshot);
});

test('chat continuation uses the original task, release and traces, never a second dispatch',()=>{
  const {window,publish,send,input,run}=fixture();const agent=publish();const releases=JSON.stringify(agent.releases);send('@报修资料助手 报修');const task=window.ProjectStudio.data().tasks[0];const originalTrace=JSON.stringify(agent.traces[0]);const before=run('JSON.stringify([state.cases,state.tickets])');
  window.GroupChat.beginFollowup(task.id);assert.equal(input().value,task.input);send('@报修资料助手 '+complete);
  assert.equal(window.ProjectStudio.data().tasks.length,1);assert.equal(task.round,2);assert.equal(task.status,'已准备，待人工核对');assert.equal(task.history.length,2);assert.equal(task.receipt.externalWrite,false);assert.equal(window.GroupChat.view().followup,'');assert.equal(input().value,'');
  const messages=window.GroupChat.messages();assert.equal(messages.filter(message=>message.kind==='followup').length,1);assert.ok(messages.some(message=>message.kind==='result'&&message.taskId===task.id));assert.equal(JSON.stringify(agent.releases),releases);assert.equal(JSON.stringify(agent.traces[0]),originalTrace);assert.equal(run('JSON.stringify([state.cases,state.tickets])'),before);
});

test('trace projection includes only tasks already linked to this group',()=>{
  const {window,publish,send}=fixture();publish();send('@报修资料助手 报修');const visible=window.ProjectStudio.data().tasks[0];window.ProjectStudio.continueTask(visible.id,complete);
  const messages=JSON.stringify(window.GroupChat.messages());window.ProjectStudio.legacyCustom('@报修资料助手 报修，另一个独立任务',()=>{});const privateTask=window.ProjectStudio.data().tasks[1];window.ProjectStudio.continueTask(privateTask.id,complete);
  assert.equal(JSON.stringify(window.GroupChat.messages()),messages);assert.doesNotMatch(messages,new RegExp(privateTask.id));
});

test('continuation rejects attachments, changed assignees and save errors while retaining the draft',()=>{
  const {window,publish,send,input,type,setAttachments,failSaving,notices}=fixture();publish();send('@报修资料助手 报修');let task=window.ProjectStudio.data().tasks[0];window.GroupChat.beginFollowup(task.id);const snapshot=JSON.stringify(task);
  setAttachments(true);send(complete);assert.match(notices.at(-1),/附件/);assert.equal(input().value,complete);assert.equal(JSON.stringify(task),snapshot);setAttachments(false);
  send('@工单填写助手 '+complete);assert.match(notices.at(-1),/原任务/);assert.equal(JSON.stringify(task),snapshot);
  failSaving(true);send(complete);assert.match(notices.at(-1),/未保存/);task=window.ProjectStudio.data().tasks[0];assert.equal(JSON.stringify(task),snapshot);assert.equal(input().value,complete);failSaving(false);
  type('SENSITIVE');send('SENSITIVE');assert.equal(task.round,1);assert.equal(window.GroupChat.view().followup,task.id);
});

test('other drafts, old versions and the three-round limit cannot be silently overwritten or bypassed',()=>{
  const {window,publish,send,type,input,notices}=fixture();const agent=publish();send('@报修资料助手 报修');const task=window.ProjectStudio.data().tasks[0];
  type('另一项未发送的任务');window.GroupChat.beginFollowup(task.id);assert.equal(input().value,'另一项未发送的任务');assert.equal(window.GroupChat.view().followup,'');
  type('');window.GroupChat.beginFollowup(task.id);agent.activeVersion='V-CHANGED';send(complete);assert.equal(task.round,1);assert.match(notices.at(-1),/版本已变化/);agent.activeVersion=task.version;
  send('报修');window.GroupChat.beginFollowup(task.id);send('报修');assert.equal(task.round,3);type('');window.GroupChat.beginFollowup(task.id);assert.equal(window.GroupChat.view().followup,'');assert.match(notices.at(-1),/不能在群里补充/);
});

test('custom multi-mentions respect every member authorization and reject duplicate execution',()=>{
  const {window,publish,send,notices}=fixture();const first=publish('资料甲');const second=publish('资料乙');const workspace=window.ProjectStudio.data();
  workspace.profile.allowed=workspace.profile.allowed.filter(id=>id!==second.id);send('@资料甲 @资料乙 '+complete);assert.equal(workspace.tasks.length,0);assert.equal(first.traces.length,0);
  workspace.profile.allowed.push(second.id);send('@资料甲 @资料乙 '+complete);assert.equal(workspace.tasks.length,2);send('@资料甲 @资料乙 '+complete);assert.equal(workspace.tasks.length,2);assert.match(notices.at(-1),/相同任务/);
});

test('non-aftersales custom tasks also support group continuation without pulling customer data',()=>{
  const {window,publish,send,input,switchProject}=fixture('RETAIL');publish();send('@报修资料助手 报修');const task=window.ProjectStudio.data().tasks[0];window.GroupChat.beginFollowup(task.id);send(complete);assert.equal(task.round,2);assert.equal(input().value,'');assert.match(window.GroupChat.page(),/补充原任务/);assert.doesNotMatch(window.GroupChat.page(),/CS-0108/);
  window.GroupChat.view().panel='tasks';switchProject('AFTERSALES');assert.equal(window.GroupChat.view().panel,'members');assert.equal(window.GroupChat.messages().length,0);switchProject('RETAIL');assert.equal(window.GroupChat.view().panel,'tasks');assert.equal(window.ProjectStudio.data().tasks[0].id,task.id);
});

test('scroll keeps earlier reading position during updates and explicitly follows a new sent message',()=>{
  const {window,nodes,redraw,send,flush}=fixture();let stream=nodes.get('project-group-stream');stream.scrollTop=100;stream.trigger('scroll');redraw();assert.equal(nodes.get('project-group-stream').scrollTop,100);assert.equal(nodes.get('gc-latest').hidden,false);
  send('查询 CS-0106 的工单进度');assert.equal(window.GroupChat.view().atBottom,true);stream=nodes.get('project-group-stream');stream.scrollTop=120;stream.trigger('scroll');flush();assert.equal(nodes.get('project-group-stream').scrollTop,120);assert.match(nodes.get('gc-update-status').textContent,/新的协作消息/);
  window.GroupChat.followLatest();redraw();stream=nodes.get('project-group-stream');assert.equal(stream.scrollTop,stream.scrollHeight);assert.equal(nodes.get('gc-latest').hidden,true);
});

test('Enter sends once, while Shift+Enter and IME composition never send',()=>{
  const {type,emit,engine,flush}=fixture();let input=type('查询 CS-0106 的工单进度');const before=engine.get().tasks.length;
  emit('keydown',{target:input,key:'Enter',shiftKey:true});emit('keydown',{target:input,key:'Enter',shiftKey:false,isComposing:true});assert.equal(engine.get().tasks.length,before);
  assert.equal(emit('keydown',{target:input,key:'Enter',shiftKey:false,isComposing:false}),true);assert.equal(engine.get().tasks.length,before+1);flush();
});

test('mention autocomplete selects without sending and safely closes if authorization is revoked',()=>{
  const {window,type,emit,nodes,input,engine}=fixture();const before=engine.get().tasks.length;
  type('@工');assert.ok(nodes.has('project-mentions'));emit('keydown',{target:input(),key:'Enter'});assert.equal(input().value,'@工单填写助手 ');assert.equal(engine.get().tasks.length,before);assert.equal(nodes.has('project-mentions'),false);
  type('@工');window.ProjectStudio.data().profile.allowed=[];emit('keydown',{target:input(),key:'ArrowDown'});assert.equal(nodes.has('project-mentions'),false);assert.equal(input().value,'@工');assert.equal(engine.get().tasks.length,before);
});
