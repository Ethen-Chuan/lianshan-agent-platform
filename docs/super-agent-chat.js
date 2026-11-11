window.SuperAgentChat=(()=>{
  let host;let mode='model';let snapshot=null;let csrf='';let checked=false;let loading=false;let sending=false;let timer=null;let error='';let selected='';let filter='all';let draft='';let caseId='';let definitionId='';let knowledgeIds=new Set();let consent=false;let consentScope='';let viewState=null;let unknownRequest=null;let online=false;let requestSignature='';
  const drafts=new Map();const detailState=new Map();
  const names={manager:'连小山',service:'接待助手',ticket:'填单助手',quality:'复核助手'};
  const statuses={queued:'排队中',routing:'安排分工',working:'处理中',waiting:'待补充',review:'待核对',failed:'未完成',interrupted:'已中断',stopped:'已停止',accepted:'已核对草稿'};
  const attention=task=>['waiting','review','failed','interrupted'].includes(task.status);
  const local=()=>!window.LIANSHAN_PUBLIC_DEMO&&location.protocol==='http:'&&location.hostname==='127.0.0.1';
  const project=()=>window.PortfolioHub.navProject()?.id;
  const active=()=>project()==='AFTERSALES'&&mode==='model';
  const visible=()=>active()&&host.getView().page==='group';
  const escape=value=>host.escape(String(value??''));
  const button=(label,name,extra='',tone='quiet small')=>host.button(label,'sa-'+name,tone,extra).replace('<button ','<button type="button" ');
  const task=()=>snapshot?.tasks.find(entry=>entry.id===selected);
  const allowed=()=>['manager',...host.getState().agents.filter(entry=>entry.enabled&&['service','ticket','quality'].includes(entry.id)&&window.ProjectStudio.allowed(entry.id)).map(entry=>entry.id)];
  const revisions=()=>Object.fromEntries((snapshot?.models||[]).filter(entry=>entry.configured&&allowed().includes(entry.agentId)).map(entry=>[entry.agentId,entry.revision]));
  const ready=()=>online&&!snapshot?.serviceError&&revisions().manager!==undefined&&Object.keys(revisions()).some(id=>id!=='manager');
  const modelsSignature=()=>csrf+JSON.stringify(revisions());
  const liveTask=()=>task()&&task().status!=='stopped';
  function useRules(){mode='rules';resetConsent();clearTimeout(timer);}
  function fromCase(id){
    if(project()!=='AFTERSALES')return false;
    if(sending||unknownRequest){host.toast('请先确认上一条请求是否已接收。',true);return true;}
    const item=host.getState().cases.find(entry=>entry.id===id);
    if(!item||item.owner==='readonly'||!host.getState().channels.some(channel=>channel.id===item.channel&&channel.read&&channel.status!=='已停用')){host.toast('这条会话只读或不可用。',true);return true;}
    select('');mode='model';caseId=id;resetConsent();if(!draft)draft='请整理这次咨询的资料，准备答复并检查缺项，先不要发送或建单。';
    host.navigate('group');return true;
  }
  function select(id){drafts.set(selected,draft);selected=id;draft=drafts.get(id)||'';}
  function received(receipt){const remaining=draft.trim()===unknownRequest.text?'':draft;drafts.delete(unknownRequest.taskId||'');selected=receipt.taskId;draft=remaining||drafts.get(selected)||'';unknownRequest=null;requestSignature='';}
  function definitions(){
    return window.ProjectStudio.data().agents.flatMap(agent=>{
      const release=agent.releases?.find(entry=>entry.version===agent.activeVersion);
      if(!release||!agent.enabled||!window.ProjectStudio.allowed(agent.id))return [];
      try{const contract=window.AgentHarness.policy(release,'AFTERSALES');return [{id:agent.id,name:agent.name,version:release.version,fields:contract.fields,rules:contract.manualChecks.map(rule=>rule.name+'：'+rule.description)}];}catch{return [];}
    });
  }
  function context(){
    const item=host.getState().cases.find(entry=>entry.id===caseId);
    if(caseId&&(!item||item.owner==='readonly'||!host.getState().channels.some(channel=>channel.id===item.channel&&channel.read&&channel.status!=='已停用')))throw Error('关联会话已只读或停用，请重新选择。');
    const knowledge=[...knowledgeIds].map(id=>host.getState().knowledge.find(entry=>entry.id===id&&entry.status==='已发布'));
    if(knowledge.some(entry=>!entry))throw Error('所选知识已变更，请重新选择。');
    const definition=definitions().find(entry=>entry.id===definitionId);
    if(definitionId&&!definition)throw Error('业务版本或授权已变化，请重新选择。');
    return {caseId,messages:item?item.messages.map((message,index)=>({id:'M'+(index+1),role:message.role,text:message.text})).filter(entry=>entry.role==='customer').slice(-8).map(({id,text})=>({id,text})):[],knowledge:knowledge.map(({id,title,version,status,content})=>({id,title,version,status,content})),definition:definition?{name:definition.name,version:definition.version,fields:definition.fields,rules:definition.rules}:null};
  }
  function scope(){return JSON.stringify({selected,draft,models:modelsSignature(),context:selected?task()?.context:context()});}
  function repaint(){if(visible())host.render();}
  function resetConsent(){consent=false;consentScope='';}
  async function request(route,body){
    const response=await fetch('/api/super-agent'+route,{method:body?'POST':'GET',headers:{'X-Hub-Session':csrf,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(8000)});
    let value;try{value=await response.json();}catch{throw Error('当前服务尚未提供任务接口，请使用更新后的本机服务。');}
    if(!response.ok)throw Object.assign(Error(value.error||'任务请求未完成。'),{status:response.status});
    return value;
  }
  async function refresh(quiet=false){
    if(loading||!active())return;
    checked=true;
    if(!local()){error='静态演示不能执行模型任务。请使用本机服务版；旧记录仍在规则演练中。';repaint();return;}
    loading=true;
    try{
      const previous=modelsSignature();const wasOnline=online;
      const response=await fetch('/api/model-connections',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      const metadata=await response.json();
      if(!response.ok||metadata.mode!=='local-server'||typeof metadata.csrf!=='string')throw Error('本机模型服务尚未启动。');
      csrf=metadata.csrf;
      const next=await request('');
      if(next.mode!=='local-super-agent'||!Array.isArray(next.tasks))throw Error('任务服务版本不匹配，请更新服务。');
      const changed=!wasOnline||next.revision!==snapshot?.revision||next.serviceError!==snapshot?.serviceError||JSON.stringify(next.models)!==JSON.stringify(snapshot?.models);
      snapshot=next;online=true;
      if(modelsSignature()!==previous)resetConsent();
      if((!quiet||changed)&&!unknownRequest)error=next.serviceError||'';
      if(changed||!quiet)repaint();
    }catch(failure){online=false;error=failure.message||'无法读取任务服务。';resetConsent();repaint();}
    finally{loading=false;}
  }
  async function send(){
    if(!visible()||sending||unknownRequest)return;
    try{
      if(!ready())throw Error('请连接连小山和至少一位已授权业务助手。');
      if(selected&&!liveTask())throw Error('已结束的任务请先新建，不能继续发送。');
      if(!draft.trim()||draft.length>1200||window.CustomerChatPolicy.sensitive(draft))throw Error('请填写 1200 字以内的脱敏任务。');
      if(!consent||consentScope!==scope())throw Error('消息、资料或连接已变更，请重新确认本轮发送范围。');
      const body={projectId:'AFTERSALES',eventId:crypto.randomUUID(),text:draft.trim(),consent:true,modelRevisions:revisions(),allowedAgents:allowed(),...(selected?{taskId:selected,expectedRevision:task().revision}:{context:context()})};
      if(body.context&&window.CustomerChatPolicy.sensitive(JSON.stringify(body.context)))throw Error('任务资料含疑似敏感信息，请先脱敏。');
      sending=true;resetConsent();error='';
      unknownRequest=body;requestSignature=modelsSignature();repaint();
      const receipt=await request('/events',body);
      received(receipt);
      await refresh();
    }catch(failure){if(failure.status>=400&&failure.status<500&&failure.status!==408)unknownRequest=null;error=failure.message||'未确认服务是否收到请求，请核对任务列表。';}
    finally{sending=false;repaint();}
  }
  async function resend(){
    if(!visible()||!unknownRequest||sending)return;
    if(!ready()||requestSignature!==modelsSignature()){error='连接或助手范围已变化，请先核对任务列表；不要重新发送同一任务。';repaint();return;}
    sending=true;repaint();
    try{const receipt=await request('/events',unknownRequest);received(receipt);error='';await refresh();}
    catch(failure){if(failure.status>=400&&failure.status<500&&failure.status!==408)unknownRequest=null;error=failure.message;}
    finally{sending=false;repaint();}
  }
  function askCommand(action){
    const current=task();if(!current||!snapshot)return;
    const label={stop:'停止任务',retry:'重新处理本轮',accept:'确认草稿'}[action];
    const notice={stop:'将停止后续处理；已发出的模型请求仍可能计费。',retry:'按当前模型重新处理本轮，最多四次请求，可能产生费用；原记录保留。',accept:'仅记录你已核对草稿，不发送客户、不建单，也不标记问题已解决。'}[action];
    const signature=modelsSignature();
    host.showDialog(label,notice,`<p>${escape(current.title)}</p><p>仅影响这一项任务。</p>`,host.button('取消','close-dialog')+button(label,'confirm',`data-operation="${action}" data-id="${escape(current.id)}" data-revision="${current.revision}" data-signature="${escape(signature)}"`,'primary'));
  }
  async function command(element){
    if(sending)return;
    const current=snapshot?.tasks.find(entry=>entry.id===element.dataset.id);
    if(!current||current.revision!==Number(element.dataset.revision)||element.dataset.signature!==modelsSignature()){host.closeDialog();error='任务或模型有新进展，请刷新后重新确认。';repaint();return;}
    sending=true;
    try{await request('/command',{projectId:'AFTERSALES',eventId:crypto.randomUUID(),taskId:current.id,expectedRevision:current.revision,action:element.dataset.operation,...(element.dataset.operation==='retry'?{consent:true,modelRevisions:revisions(),allowedAgents:allowed()}:{} )});host.closeDialog();await refresh();}
    catch(failure){error=failure.message;host.closeDialog();}
    finally{sending=false;repaint();}
  }
  function sourcePanel(){
    const current=task();
    if(current)return `<details class="sa-context"><summary>本任务资料 · ${escape(current.context.caseId||'未关联客户')}</summary><p>本轮固定快照，不读取其他任务。</p>${contextView(current.context)}<p>资料已过期或客户不同，请新建任务；新知识不会自动覆盖本次依据。</p></details>`;
    const available=host.getState().cases.filter(entry=>entry.owner!=='readonly'&&host.getState().channels.some(channel=>channel.id===entry.channel&&channel.read&&channel.status!=='已停用'));
    const knowledge=host.getState().knowledge.filter(entry=>entry.status==='已发布');
    return `<details class="sa-context"><summary>本轮资料 · ${caseId?'已关联会话':'未关联客户'} · ${knowledgeIds.size} 篇知识</summary><label for="sa-case">关联会话<select id="sa-case"><option value="">不携带客户对话</option>${available.map(entry=>`<option value="${escape(entry.id)}" ${caseId===entry.id?'selected':''}>${escape(entry.id+' · '+entry.name)}</option>`).join('')}</select></label><fieldset><legend>选取已发布知识（最多 6 篇）</legend>${knowledge.map(entry=>`<label class="sa-check"><input type="checkbox" data-sa-knowledge="${escape(entry.id)}" ${knowledgeIds.has(entry.id)?'checked':''}>${escape(entry.title)} · ${escape(entry.version)}</label>`).join('')||'<p>暂无已发布知识</p>'}</fieldset><label for="sa-definition">Orbit 已验收定义<select id="sa-definition"><option value="">不引用业务定义</option>${definitions().map(entry=>`<option value="${escape(entry.id)}" ${definitionId===entry.id?'selected':''}>${escape(entry.name+' · '+entry.version)}</option>`).join('')}</select></label><p>仅传所选会话最近 8 条客户消息、选中知识和定义。不传内部备注；规则作为模型参考，不执行任意画布分支。</p>${button('核对将发送的资料','preview')}</details>`;
  }
  function contextView(value){
    return `<div class="sa-source-list">${value.messages.map(entry=>`<p><b>${escape(entry.id)}</b> ${escape(entry.text)}</p>`).join('')}${value.knowledge.map(entry=>`<details><summary>${escape(entry.id+' · '+entry.title+' · '+entry.version)}</summary><p>${escape(entry.content)}</p></details>`).join('')}${value.definition?`<p><b>${escape(value.definition.name)} · ${escape(value.definition.version)}</b></p><p>必填：${value.definition.fields.map(escape).join('、')}</p>${value.definition.rules.map(rule=>`<p>${escape(rule)}</p>`).join('')}`:''}${!value.messages.length&&!value.knowledge.length&&!value.definition?'<p>只有你输入的任务消息，不携带其他资料。</p>':''}</div>`;
  }
  function renderTask(){
    const current=task();
    if(!current)return `<div class="sa-welcome">${window.HubIdentity.worker('manager','lg')}<span class="sa-eyebrow">连小山 · 业务协作</span><h2>这次需要团队<br>处理什么？</h2><p>说明目标，选择资料，再发起任务。</p><div class="sa-examples">${button('整理报修资料','example','data-value="请帮我整理报修资料，缺少的信息列出来，先不要建单。"')}${button('准备答复并复核','example','data-value="请按我选的知识准备答复，并检查其中的依据和承诺，先不要发送。"')}</div><p class="sa-limit">需要连接模型 · 仅准备草稿 · 不自动执行外部操作</p></div>`;
    const events=snapshot.events.filter(entry=>entry.taskId===current.id&&!['step','routing','result'].includes(entry.type));
    return `<header class="sa-thread-head"><div><span>${escape(current.context.caseId||'独立任务')} · 第 ${current.round} 轮</span><h2>${escape(current.title)}</h2></div><span class="sa-state" data-status="${current.status}">${statuses[current.status]}</span></header><div class="sa-transcript">${current.inputs.map(entry=>`<article class="sa-message from-user"><strong>你</strong><p>${escape(entry.text)}</p></article>`).join('')}${current.steps.length?`<section class="sa-plan"><strong>本轮分工</strong><ol>${current.steps.map(step=>`<li>${window.HubIdentity.worker(step.agent,'sm')}<span><b>${names[step.agent]}</b><small>${escape(step.instruction)}</small></span><span>${statuses[step.status]||'排队中'}</span></li>`).join('')}</ol></section>`:''}${current.steps.filter(step=>step.result).map(step=>`<article class="sa-message"><header>${window.HubIdentity.worker(step.agent,'sm')}<strong>${names[step.agent]}</strong><span>模型结果 · 待核对</span></header><h3>${escape(step.result.summary)}</h3><p>${escape(step.result.content)}</p><small>引用：${step.result.sources.map(escape).join('、')||'未引用知识，请核对来源'}</small></article>`).join('')}${current.question?`<div class="sa-attention"><strong>需要补充</strong><p>${escape(current.question)}</p></div>`:''}${current.error?`<div class="sa-attention" role="alert"><strong>本轮未完成</strong><p>${escape(current.error)}</p></div>`:''}<div class="sa-task-actions">${current.status==='review'?button('核对并确认草稿','accept','','primary'):''}${['failed','interrupted'].includes(current.status)?button('重新处理本轮','retry','','primary'):''}${!['stopped','accepted'].includes(current.status)?button('停止任务','stop'):''}${current.steps.some(step=>step.agent==='ticket')?host.button('进入填单助手','assistant-business','small','data-page="tickets"'):''}</div>${sourcePanel()}<details class="sa-log"><summary>处理记录 · ${events.length} 条</summary>${events.map(entry=>`<p><time>${escape(new Date(entry.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}))}</time>${escape(entry.text)}</p>`).join('')}${current.history.map(entry=>`<details><summary>历史第 ${entry.round} 轮</summary>${entry.steps.filter(step=>step.result).map(step=>`<p>${escape(names[step.agent]+': '+step.result.content)}</p>`).join('')}</details>`).join('')}</details></div>`;
  }
  function page(){
    const current=task();const all=snapshot?.tasks||[];const shown=filter==='attention'?all.filter(attention):all;
    const members=Object.entries(names).map(([id,name])=>{const connected=snapshot?.models.find(entry=>entry.agentId===id);const enabled=allowed().includes(id);return `<div class="sa-member">${window.HubIdentity.worker(id,'sm')}<span><strong>${name}</strong><small>${!enabled?'已暂停或未授权':connected?.configured?escape(connected.provider+' · '+connected.model):'未连接模型'}</small></span>${button('配置','model',`data-id="${id}"`)}</div>`;}).join('');
    return `<div class="agent-workspace sa-workspace"><header class="sa-header"><div>${window.HubIdentity.worker('manager','md')}<span><h1>连小山与业务团队</h1><small>内部协作 · 客户不可见</small></span></div><div>${button('规则演练与旧记录','rules')}${button('刷新状态','refresh')}${button('新任务','new','','primary')}</div></header><div class="sa-layout"><aside class="sa-rail" aria-label="任务与团队"><div class="sa-rail-tabs" role="group" aria-label="筛选任务">${button('全部 '+all.length,'filter','data-value="all" aria-pressed="'+(filter==='all')+'"',filter==='all'?'active':'quiet')}${button('需要我 '+all.filter(attention).length,'filter','data-value="attention" aria-pressed="'+(filter==='attention')+'"',filter==='attention'?'active':'quiet')}</div><div class="sa-task-list">${shown.map(entry=>button(`<span><strong>${escape(entry.title)}</strong><small>${escape(entry.context.caseId||'独立任务')} · ${statuses[entry.status]}</small></span>`,'select',`data-id="${escape(entry.id)}" aria-current="${selected===entry.id?'true':'false'}"`,'sa-task')).join('')||'<p class="sa-empty">'+(filter==='attention'?'暂无待确认事项':'还没有任务')+'</p>'}</div><details class="sa-team" ${!ready()?'open':''}><summary>团队与模型</summary>${members}</details><details class="sa-runtime"><summary>运行设置</summary><label for="sa-concurrency">同时处理<select id="sa-concurrency" ${snapshot?'':'disabled'}>${[1,2,3,4,5,6].map(value=>`<option ${value===(snapshot?.concurrency||3)?'selected':''}>${value}</option>`).join('')}</select>项任务</label><p>资料保存在本机服务；浏览器可关闭，电脑或服务停止则不能继续。主动监听、飞书和 CRM 未接入。</p></details></aside><section class="sa-conversation" aria-label="连小山任务对话">${error?`<div class="sa-error" role="alert">${escape(error)}${unknownRequest?button('核对并重试同一请求','resend')+button('保留草稿，放弃重试','discard-request'):''}</div>`:''}${!ready()?'<div class="sa-setup">'+host.icon('plug-connected','small')+'<span>先连接连小山和一位业务助手，才能开始模型协作。</span>'+button('配置连小山','model','data-id="manager"','small')+'</div>':''}<div id="sa-stream" class="sa-stream" tabindex="0" role="region" aria-label="任务内容">${renderTask()}</div><form id="sa-form" class="sa-composer"><div class="sa-compose-label"><strong>${current?'补充当前任务':'新任务'}</strong><small>${current?'继续这一件事，不重新建任务':'其他任务可同时在后台处理'}</small></div>${!current?sourcePanel():''}<label class="sr-only" for="sa-input">${current?'补充任务信息':'描述新任务'}</label><textarea id="sa-input" name="text" rows="2" maxlength="1200" placeholder="描述目标、背景和需要交付的结果…" ${current&&!liveTask()?'disabled':''}>${escape(draft)}</textarea><div class="sa-compose-actions"><label class="sa-check"><input id="sa-consent" type="checkbox" ${consent?'checked':''} ${ready()?'':'disabled'}><span>同意本轮将上述消息与所选资料发给已连接的模型，最多四次请求，可能计费。</span></label><button type="submit" class="button primary" ${!ready()||sending||!consent||unknownRequest||current&&!liveTask()?'disabled':''}>${sending?'正在接收…':current?'补充':'发送任务'}</button></div><small class="sa-compose-note">Ctrl / ⌘ + Enter 发送 · 不自动发送客户、建单或批准赔付</small></form></section></div></div>`;
  }
  function capture(){
    const stream=document.getElementById('sa-stream');const input=document.getElementById('sa-input');
    viewState=stream?{selected,scrollTop:stream.scrollTop,bottom:stream.scrollHeight-stream.clientHeight-stream.scrollTop<64,focus:document.activeElement===input,start:input?.selectionStart,end:input?.selectionEnd}:null;
    document.querySelectorAll('.sa-workspace details').forEach((element,index)=>detailState.set((element.closest('.sa-rail')?'rail':selected)+':'+index,element.open));
  }
  function mount(){
    clearTimeout(timer);timer=null;
    if(!visible())return;
    const stream=document.getElementById('sa-stream');const input=document.getElementById('sa-input');
    const previous=viewState?.selected===selected?viewState:null;
    document.querySelectorAll('.sa-workspace details').forEach((element,index)=>{const key=(element.closest('.sa-rail')?'rail':selected)+':'+index;if(detailState.has(key))element.open=detailState.get(key);});
    if(stream)stream.scrollTop=!previous||previous.bottom?stream.scrollHeight:previous.scrollTop;
    if(previous?.focus&&input&&!input.disabled){input.focus({preventScroll:true});input.setSelectionRange(previous.start,previous.end);}
    if(!checked){checked=true;queueMicrotask(()=>void refresh());}
    if(local())timer=setTimeout(async()=>{if(!visible())return;await refresh(true);if(visible())mount();},2500);
  }
  function configure(adapter){
    host=adapter;
    document.addEventListener('click',event=>{
      const element=event.target.closest('[data-action^="sa-"]');if(!element||project()!=='AFTERSALES')return;
      const name=element.dataset.action.slice(3);event.preventDefault();
      if(name==='model'){window.HubModels.open(element.dataset.id,'model');return;}
      if(name==='rules'){useRules();host.render();return;}
      if(name==='enable'){mode='model';checked=false;host.render();return;}
      if(name==='refresh'){void refresh();return;}
      if(name==='confirm'){void command(element);return;}
      if(['stop','retry','accept'].includes(name)){askCommand(name);return;}
      if(name==='resend'){void resend();return;}
      if(name==='discard-request'){unknownRequest=null;error='请先核对任务列表，避免重复提交。';repaint();return;}
      if(name==='preview'){try{host.showDialog('本轮发送资料','只发送下列内容与任务消息，不包含内部备注。',contextView(context()),host.button('返回','close-dialog'));}catch(failure){error=failure.message;repaint();}return;}
      if(sending||unknownRequest)return;
      if(name==='new')select('');
      if(name==='select')select(element.dataset.id);
      if(name==='example')draft=element.dataset.value;
      if(name==='filter')filter=element.dataset.value;
      resetConsent();repaint();
    });
    document.addEventListener('input',event=>{
      if(event.target.id!=='sa-input')return;
      draft=event.target.value;resetConsent();
      const checkbox=document.getElementById('sa-consent');if(checkbox)checkbox.checked=false;
      const submit=document.querySelector('#sa-form [type="submit"]');if(submit)submit.disabled=true;
    });
    document.addEventListener('change',event=>{
      if(!visible())return;
      const element=event.target;
      if(element.id==='sa-consent'){try{consent=element.checked;consentScope=consent?scope():'';}catch(failure){resetConsent();error=failure.message;}repaint();return;}
      if(element.id==='sa-case')caseId=element.value;
      else if(element.id==='sa-definition')definitionId=element.value;
      else if(element.dataset.saKnowledge){if(element.checked&&knowledgeIds.size<6)knowledgeIds.add(element.dataset.saKnowledge);else knowledgeIds.delete(element.dataset.saKnowledge);}
      else if(element.id==='sa-concurrency'){void request('/settings',{projectId:'AFTERSALES',expectedRevision:snapshot.revision,concurrency:Number(element.value)}).then(()=>refresh()).catch(failure=>{error=failure.message;repaint();});return;}
      else return;
      resetConsent();repaint();
    });
    document.addEventListener('submit',event=>{if(event.target.id==='sa-form'){event.preventDefault();void send();}});
    document.addEventListener('keydown',event=>{if(event.target.id==='sa-input'&&!event.isComposing&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();void send();}});
  }
  return {active,page,configure,capture,mount,refresh,send,context,useRules,fromCase,modeBar:()=>project()==='AFTERSALES'?'<div class="sa-mode-return"><span>规则演练 · 原任务与历史记录</span>'+button('进入模型协作','enable','','small')+'</div>':'',snapshot:()=>snapshot};
})();
