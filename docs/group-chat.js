window.GroupChat=(()=>{
  let host;
  let mounted;
  const views=new Map();
  const current=()=>window.PortfolioHub.navProject();
  const workspace=()=>window.ProjectStudio.data();
  const escape=value=>host.escape(String(value??''));
  const control=(text,action,attributes='',tone='quiet small')=>host.button(text,action,tone,attributes).replace('<button ','<button type="button" ');
  const button=(text,action,attributes='',tone='quiet small')=>control(text,'gc-'+action,attributes,tone);
  const attention=status=>/待确认|待人工|需修正|失败|暂停|不足|待配置|转人工/.test(status);
  const inputId=()=>current().id==='AFTERSALES'?'project-group-prompt':'studio-prompt';
  const streamId=()=>current().id==='AFTERSALES'?'project-group-stream':'studio-chat-stream';
  function view(){
    if(!views.has(current().id))views.set(current().id,{panel:'members',expanded:false,onlyResults:false,followup:'',scrollTop:0,atBottom:true,seen:0,unread:0});
    return views.get(current().id);
  }
  function draft(value){
    if(value===undefined)return current().id==='AFTERSALES'?window.ProjectHub.composerContext().draft:workspace().drafts.group;
    if(current().id==='AFTERSALES')window.ProjectHub.setDraft(value);
    else workspace().drafts.group=value;
  }
  function members(){
    const tasks=window.AgentWorkspace.tasks();
    return window.ProjectStudio.members().map(member=>{
      const authorized=member.id==='manager'||workspace().profile.allowed.includes(member.id);
      const active=tasks.filter(task=>task.legacy?.steps.some(step=>(step.worker==='knowledge'?'service':step.worker)===member.id&&step.status==='执行中')).length;
      const awaiting=tasks.filter(task=>task.custom?.assignee===member.id&&attention(task.status)).length;
      const release=member.custom?workspace().agents.find(agent=>agent.id===member.id)?.releases.find(release=>release.version===member.version):null;
      const status=!member.enabled?'已暂停':!authorized?'未授权':active?'处理中 · '+active:awaiting?'待核对 · '+awaiting:member.id==='manager'?'分派与汇总':member.custom?release?.runner===window.AgentHarness.version?'本地规则 · '+member.version:'需重新验收':current().id!=='AFTERSALES'?'仅登记待办':member.id==='analytics'?'固定样本分析':'本地协作';
      return {...member,available:member.enabled&&authorized,status,active};
    });
  }
  function messages(){
    const original=current().id==='AFTERSALES'?host.getState().projectCollab?.messages||[]:workspace().messages.group;
    const linked=new Set(original.map(entry=>entry.taskId).filter(Boolean));
    const continuations=workspace().tasks.filter(task=>linked.has(task.id)).flatMap(task=>{
      const agent=workspace().agents.find(agent=>agent.id===task.assignee);
      return (task.history||[]).slice(1).flatMap(identifier=>{
        const trace=agent?.traces.find(trace=>trace.id===identifier&&trace.taskId===task.id&&trace.projectId===current().id);
        return trace?[{id:identifier+'-input',author:'operator',text:trace.input,taskId:task.id,time:trace.time,kind:'followup'},{id:identifier+'-result',author:task.assignee,text:trace.output,taskId:task.id,time:trace.time,traceId:trace.id,kind:'result'}]:[];
      });
    });
    return [...original,...continuations].sort((left,right)=>String(left.time||'').localeCompare(String(right.time||'')));
  }
  function highlight(text){
    return String(text??'').split(/(@[^\s，,。；;]+)/g).map(part=>part.startsWith('@')?'<mark>'+escape(part)+'</mark>':escape(part)).join('');
  }
  function speaker(identifier,name){
    if(identifier==='operator')return '你';
    return window.ProjectStudio.members().find(member=>member.id===identifier)?.name||name||(identifier==='expert'?'外部专家（模拟）':'历史助手');
  }
  function taskCard(record){
    if(!record)return '';
    const steps=record.legacy?.steps||[];
    const workers=[...new Set(steps.map(step=>step.worker==='knowledge'?'service':step.worker))];
    const followup=record.custom?.runner===window.AgentHarness.version&&record.status==='信息不足，需补充'&&record.custom.round<3;
    return `<div class="gc-task-card"><div><strong>${escape(record.legacy?record.title:record.custom.assigneeName+'的任务')}</strong><span class="aw-status ${attention(record.status)?'needs-attention':''}">${escape(record.label)}</span></div><small>${escape(record.id)}${record.caseId?' · '+escape(record.caseId):''}${steps.length?' · '+steps.filter(step=>step.status==='已完成').length+'/'+steps.length+' 步':''}</small>${workers.length?'<div class="gc-task-people" aria-label="参与助手">'+workers.map(worker=>window.HubIdentity.worker(worker,'sm')).join('')+'</div>':''}<footer>${control('查看任务','aw-task','data-id="'+escape(record.key)+'"')}${followup?button('在群里补充信息','followup','data-id="'+escape(record.id)+'"','small'):''}${record.legacy?.status==='失败'?control('重试失败步骤','manager-retry','data-id="'+escape(record.id)+'"'):''}</footer></div>`;
  }
  function message(entry,record){
    const user=entry.author==='operator';const time=new Date(entry.time);
    const clock=Number.isNaN(time.getTime())?'':time.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
    const handoff=entry.handoff;
    return `<article class="aw-message ${user?'from-user':''}" data-message-id="${escape(entry.id)}">${user?window.HubIdentity.avatar({entityType:'staff',identityTone:'blue'},{size:'sm'}):window.HubIdentity.worker(entry.author,'sm')}<div><header><strong>${escape(speaker(entry.author,entry.name))}</strong><small>${entry.kind==='followup'?'补充原任务':user?'':entry.author==='expert'?'模拟端点':'本地协作'}</small><time datetime="${escape(entry.time||'')}">${escape(clock)}</time></header>${handoff?.from?.length?'<div class="gc-handoff">'+escape(handoff.from.map(identifier=>speaker(identifier)).join('、'))+' <span aria-label="交给">→</span> '+escape(speaker(handoff.to))+'<small>任务步骤交接</small></div>':''}<div class="gc-bubble"><p>${highlight(entry.text)}</p>${window.HubMedia.messages(entry.attachmentIds)}</div>${taskCard(record)}${!record&&(entry.customTraceId||entry.traceId)?control('查看执行依据','studio-agent','data-id="'+escape(entry.author)+'" data-tab="traces"'):''}${entry.reportId?control('查看分析依据','reporter-open','data-id="'+escape(entry.reportId)+'"'):''}</div></article>`;
  }
  function welcome(){
    return `<div class="aw-welcome">${window.HubIdentity.worker('manager','lg')}<h2>开始一项任务</h2><p>@ 助手，或交给${escape(window.ProjectStudio.coordinatorName())}分派。</p><div class="aw-starters">${current().id==='AFTERSALES'?control('准备一份报修资料','aw-starter','data-value="repair"')+control('查一笔工单进度','aw-starter','data-value="lookup"'):button('@'+escape(window.ProjectStudio.coordinatorName()),'mention','data-id="manager"')}${control('从业务规则创建助手','studio-harness-example')}</div></div>`;
  }
  function composer(){
    const aftersales=current().id==='AFTERSALES';const context=aftersales?window.ProjectHub.composerContext():null;
    const task=workspace().tasks.find(task=>task.id===view().followup);
    const tools=aftersales?window.HubMedia.tools('group:GROUP-AFTERSALES').replaceAll('<button ','<button type="button" '):'';
    return `<div class="aw-composer"><form id="${aftersales?'gc-chat-form':'studio-chat-form'}" class="manager-compose group-compose gc-compose" data-channel="group" ${aftersales?'data-media-scope="group:GROUP-AFTERSALES"':''} aria-label="向业务协作群发起任务">${task?'<div class="gc-followup"><span>补充给 <strong>'+escape(task.assigneeName)+'</strong> · 原任务第 '+(task.round+1)+' 轮</span>'+button('退出补充','cancel-followup')+'</div>':''}${aftersales?window.HubMedia.tray('group:GROUP-AFTERSALES'):''}<label class="sr-only" for="${inputId()}">群消息，可用 @ 指定助手${task?'；当前补充原任务':''}</label><textarea id="${inputId()}" rows="2" maxlength="1200" aria-describedby="gc-input-hint" placeholder="${task?'保留已有信息，补齐缺少的字段…':'发消息，或 @助手 分派任务…'}">${escape(draft())}</textarea><div class="gc-compose-footer"><div class="gc-compose-tools">${tools}${button('@ 指定助手','at')}${control('预览分工','aw-plan')}</div><div class="gc-send-row">${aftersales?'<label class="group-case">关联会话<select id="project-group-case" aria-label="任务关联客户会话">'+host.getState().cases.filter(item=>item.owner!=='readonly').map(item=>'<option value="'+escape(item.id)+'" '+(context.caseId===item.id?'selected':'')+'>'+escape(item.id+' · '+item.name)+'</option>').join('')+'</select></label>':''}${aftersales?control(host.icon('arrow-up','small')+'<span>'+ (task?'补充':'发送')+'</span>','project-send','aria-label="'+(task?'补充原任务':'发送群消息并分派任务')+'"','gc-send'): '<button type="submit" class="button gc-send">'+host.icon('arrow-up','small')+'<span>'+(task?'补充':'发送')+'</span></button>'}</div></div></form><p id="gc-input-hint">${task?'继续同一个任务，不会重新分派。':'Enter 发送 · Shift + Enter 换行'} · 对客发送、建单需另行确认</p></div>`;
  }
  function roster(){
    return `<div class="aw-roster">${members().map(member=>`<button type="button" class="gc-member ${member.active?'is-busy':''}" data-action="gc-mention" data-id="${escape(member.id)}" ${member.available?'':'disabled'} title="${escape(member.available?'@'+member.name+' · '+member.role:member.status+'，请先在职责与授权中调整')}" aria-label="${escape('@'+member.name+'，'+member.status)}">${window.HubIdentity.worker(member.id,'sm')}<span><strong>${escape(member.name)}</strong><small>${escape(member.status)}</small></span><span class="gc-mention-sign" aria-hidden="true">@</span></button>`).join('')}</div>`;
  }
  function sidebar(){
    const pending=window.AgentWorkspace.tasks().filter(task=>attention(task.status));
    const running=window.AgentWorkspace.tasks().filter(task=>['排队中','执行中'].includes(task.status));
    const state=view();
    return `<aside class="aw-rail" id="gc-sidebar" aria-label="群成员与待办"><header class="gc-side-head"><div role="group" aria-label="群侧栏内容">${button('群成员 '+members().length,'panel','data-value="members" aria-pressed="'+(state.panel==='members')+'"',state.panel==='members'?'active':'quiet')}${button('待办 '+pending.length,'panel','data-value="tasks" aria-pressed="'+(state.panel==='tasks')+'"',state.panel==='tasks'?'active':'quiet')}</div>${button(host.icon('x','small'),'close','aria-label="收起群侧栏"','gc-close')}</header><div class="gc-side-scroll" id="gc-side-scroll" data-manager-scroll>${state.panel==='tasks'?'<section><h2>待确认事项</h2>'+pending.map(task=>taskCard(task)).join('')+(pending.length?'':'<p class="aw-empty-note">暂无待确认事项</p>')+'</section><section><h2>进行中的任务</h2>'+running.map(task=>taskCard(task)).join('')+(running.length?'':'<p class="aw-empty-note">没有正在执行的本地任务。</p>')+'</section>':'<p class="gc-roster-note">点击成员可 @，不会直接发起任务。</p>'+roster()}<details class="gc-group-options" id="gc-group-options"><summary>群设置与历史记录</summary>${control('管理职责与助手','studio-roster')}${control('在 Orbit 研发助手','studio-orbit')}${control('体验规则检查示例','studio-harness-example')}${current().id==='AFTERSALES'?control('演练查询超时与重试','aw-fault'):''}${control('调度设置','aw-schedule')}${control('历史独立对话','aw-history')}</details></div><footer><span>操作权限单独设置</span>${control('查看全部任务','aw-tab','data-value="tasks"')}</footer></aside>`;
  }
  function page(){
    const state=view();const entries=messages();const records=window.AgentWorkspace.tasks();const latest=new Map();
    entries.forEach(entry=>{if(entry.taskId)latest.set(entry.taskId,entry.id);});
    const shown=state.onlyResults?entries.filter(entry=>entry.author==='operator'||entry.author==='manager'||entry.kind==='result'||!['start','finish'].includes(entry.kind)||latest.get(entry.taskId)===entry.id):entries;
    return `<div class="aw-chat ${state.expanded?'is-expanded':''}" data-panel="${escape(state.panel||'none')}"><section class="aw-conversation" aria-label="${escape(window.ProjectStudio.groupName())}消息"><div class="aw-stream-tools"><span>群消息 <small>你与 ${members().length} 位助手</small></span><div>${button(state.onlyResults?'显示全部消息':'只看关键结果','filter','aria-pressed="'+state.onlyResults+'"')}${button(host.icon('users','small')+'<span>群成员 '+members().length+'</span>','panel','data-value="members" aria-controls="gc-sidebar"','gc-members-button')}${button('待办','panel','data-value="tasks" aria-controls="gc-sidebar"')}</div></div><div class="gc-stream-wrap"><div class="aw-stream" id="${streamId()}" data-manager-scroll tabindex="0" role="region" aria-label="群消息记录">${shown.length?shown.map(entry=>message(entry,latest.get(entry.taskId)===entry.id?records.find(record=>record.id===entry.taskId):null)).join(''):welcome()}</div>${button('回到最新消息 ↓','latest','id="gc-latest" hidden','gc-latest')}</div>${composer()}<span class="sr-only" role="status" id="gc-update-status"></span></section>${sidebar()}</div>`;
  }
  function refresh(){
    if(current().id==='AFTERSALES')window.ManagerHub.repaint();else host.render();
  }
  function resizeInput(){
    const input=document.getElementById(inputId());if(!input)return;
    input.style.height='0px';input.style.height=Math.min(120,Math.max(52,input.scrollHeight))+'px';
  }
  function insert(text,replacePartial=false){
    if(view().followup)return host.toast('正在补充原任务，退出补充后再选择其他助手。',true);
    const input=document.getElementById(inputId());if(!input)return;
    const start=input.selectionStart??input.value.length;const end=input.selectionEnd??start;
    const before=input.value.slice(0,start);const prefix=replacePartial?before.replace(/@[^\s@]*$/,''):before;
    const content=prefix+text+input.value.slice(end);if(content.length>1200)return host.toast('输入最多 1200 字，请先缩短内容。',true);
    input.value=content;draft(content);input.focus({preventScroll:true});input.setSelectionRange(prefix.length+text.length,prefix.length+text.length);input.dispatchEvent(new Event('input',{bubbles:true}));resizeInput();
  }
  function mention(identifier){
    const member=members().find(member=>member.id===identifier);
    if(!member?.available)return host.toast('这位助手未加入当前项目、已暂停或未获授权。',true);
    if(view().followup)return host.toast('正在补充原任务，退出补充后再选择其他助手。',true);
    const previous=document.getElementById(inputId());
    const start=previous?.selectionStart??draft().length;const end=previous?.selectionEnd??start;
    view().expanded=false;view().panel='members';refresh();
    document.getElementById(inputId())?.setSelectionRange(start,end);insert('@'+member.name+' ',true);
  }
  function beginFollowup(identifier){
    const task=workspace().tasks.find(task=>task.id===identifier&&task.projectId===current().id);
    if(!task||task.runner!==window.AgentHarness.version||task.status!=='信息不足，需补充'||task.round>=3)return host.toast('当前任务不能在群里补充，请查看任务详情。',true);
    if(draft().trim()&&view().followup!==identifier)return host.toast('请先发送或清空当前输入，再补充这项任务。',true);
    view().followup=identifier;view().expanded=false;draft(task.input);refresh();const input=document.getElementById(inputId());input?.focus({preventScroll:true});input?.setSelectionRange(input.value.length,input.value.length);
  }
  function submitFollowup(value){
    if(!current()||host.getView().page!=='group')return false;
    const identifier=view().followup;if(!identifier)return false;
    try{
      if(current().id==='AFTERSALES'&&window.HubMedia.has('group:GROUP-AFTERSALES'))throw new Error('补充任务只接收文字，附件尚未解析，请先移除。');
      const task=workspace().tasks.find(task=>task.id===identifier);
      if(window.ProjectStudio.resolveMentions(value).some(member=>!['manager',task?.assignee].includes(member.id)))throw new Error('补充消息只能交给原任务的助手；新分工请退出补充后发起。');
      window.ProjectStudio.continueTask(identifier,value);view().followup='';draft('');followLatest();refresh();host.toast('已继续原任务，处理结果已回到群里。');
    }catch(error){host.toast(error.message,true);}
    return true;
  }
  function updateViewport(){
    if(typeof window.visualViewport?.height==='number')document.documentElement.style.setProperty('--gc-viewport-height',window.visualViewport.height+'px');
  }
  function capture(){
    if(!mounted)return;
    if(mounted.stream.isConnected===false){mounted=null;return;}
    const {state,stream}=mounted;
    state.scrollTop=stream.scrollTop;state.atBottom=stream.scrollHeight-stream.clientHeight-stream.scrollTop<32;
  }
  function followLatest(){
    if(!current())return;
    view().atBottom=true;view().unread=0;
    if(mounted?.state===view()&&mounted.stream.isConnected!==false)mounted.stream.scrollTop=mounted.stream.scrollHeight;
  }
  function mount(){
    if(!current()||!document.querySelector('.aw-chat'))return;
    const state=view();const stream=document.getElementById(streamId());if(!stream)return;
    mounted={state,stream};
    const count=messages().length;const jump=document.getElementById('gc-latest');
    stream.scrollTop=state.atBottom?stream.scrollHeight:state.scrollTop;
    state.unread=state.atBottom?0:state.unread+Math.max(0,count-state.seen);
    if(jump){jump.hidden=state.atBottom;jump.textContent=state.unread?state.unread+' 条新消息 ↓':'回到最新消息 ↓';}
    if(state.unread){const status=document.getElementById('gc-update-status');if(status)status.textContent='有新的协作消息，可回到最新消息查看。';}
    state.seen=count;
    stream.addEventListener('scroll',()=>{state.scrollTop=stream.scrollTop;state.atBottom=stream.scrollHeight-stream.clientHeight-stream.scrollTop<32;if(state.atBottom)state.unread=0;if(jump)jump.hidden=state.atBottom;},{passive:true});
    resizeInput();updateViewport();
  }
  function configure(adapter){
    host=adapter;
    document.addEventListener('click',event=>{
      const element=event.target.closest('[data-action^="gc-"]');if(!element||!current())return;event.preventDefault();
      const action=element.dataset.action.slice(3);const state=view();
      if(action==='mention')return mention(element.dataset.id);
      if(action==='at')return insert('@');
      if(action==='followup')return beginFollowup(element.dataset.id);
      if(action==='panel'&&['members','tasks'].includes(element.dataset.value)){state.panel=element.dataset.value;state.expanded=true;refresh();document.querySelector('#gc-sidebar button')?.focus({preventScroll:true});}
      if(action==='close'){state.panel='';state.expanded=false;refresh();document.getElementById(inputId())?.focus({preventScroll:true});}
      if(action==='filter'){state.onlyResults=!state.onlyResults;refresh();document.querySelector('[data-action="gc-filter"]')?.focus({preventScroll:true});}
      if(action==='cancel-followup'){state.followup='';refresh();document.getElementById(inputId())?.focus({preventScroll:true});}
      if(action==='latest'){followLatest();element.hidden=true;}
    });
    document.addEventListener('input',event=>{if(current()&&event.target.id===inputId())resizeInput();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&current()&&view().expanded&&!document.getElementById('project-mentions')&&event.target.closest('.aw-chat')){view().expanded=false;view().panel='';refresh();document.getElementById(inputId())?.focus({preventScroll:true});}});
    window.visualViewport?.addEventListener('resize',updateViewport);
  }
  return {configure,page,mount,capture,followLatest,members,messages,view,mention,beginFollowup,submitFollowup,reset(){views.clear();mounted=null;}};
})();
