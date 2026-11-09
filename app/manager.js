window.ManagerHub = (() => {
  let host;
  let engine;
  const ui = {selected:'',mode:'prompt',prompt:'',cli:'',caseId:'CS-0108',filter:'all',worker:'all',error:'',notes:{},confirmed:{},from:'manager',to:'expert',drawer:'',drafts:{}};
  const examples = [
    '处理 CS-0108 和 CS-0107，核对方案，准备回复和报修草稿，先不要发送。',
    '查询 CS-0106 的工单进度',
    '只重查方案，保留工单草稿'
  ];
  const escape = value => host.escape(value);
  const action = (label,name,identifier='',tone='',extra='') => host.button(label,'manager-'+name,tone,`data-id="${escape(identifier)}" ${extra}`);
  const statusTone = value => /失败|修正/.test(value)?'red':/执行|完成|返回/.test(value)?'green':/等待|待|排队|暂停/.test(value)?'amber':'';
  const pill = value => host.badge(value,statusTone(value));
  const option = (value,current,label=value) => `<option value="${escape(value)}" ${value===current?'selected':''}>${escape(label)}</option>`;
  const time = value => new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const completed = task => task.steps.filter(entry=>entry.status==='已完成').length;
  const outputOf = (task,identifier) => task.steps.find(entry=>entry.id===identifier)?.output;
  const selected = () => engine.find(ui.selected) || engine.get().tasks.find(task=>task.conversationId===engine.get().activeConversationId);

  function threads() {
    const data=engine.get();
    if (!Array.isArray(data.conversations)) data.conversations=[];
    if (!data.conversations.some(thread=>thread.id===data.activeConversationId)) {
      const thread={id:'CHAT-'+String(data.conversations.length+1).padStart(4,'0'),title:'新对话',caseId:'CS-0108',createdAt:new Date().toISOString()};
      data.conversations.unshift(thread);data.activeConversationId=thread.id;
    }
    return data.conversations;
  }
  const activeThread = () => threads().find(thread=>thread.id===engine.get().activeConversationId);
  const threadTasks = () => engine.get().tasks.filter(task=>task.conversationId===activeThread().id);

  function sidebarHistory() {
    const history=threads().filter(thread=>engine.get().messages.some(message=>message.conversationId===thread.id)||ui.drafts[thread.id]?.prompt||ui.drafts[thread.id]?.cli);
    return `<div class="thread-history-label">最近对话</div>${history.slice(0,8).map(thread=>`<button class="thread-history-item ${host.getView().page==='manager'&&thread.id===activeThread().id?'selected':''}" data-action="manager-thread" data-id="${thread.id}" title="${escape(thread.title)}" aria-current="${thread.id===activeThread().id?'true':'false'}">${host.icon('message-circle','small')}<span>${escape(thread.title==='新对话'?'未发送的对话':thread.title)}</span>${engine.get().tasks.some(task=>task.conversationId===thread.id&&['执行中','排队中'].includes(task.status))?'<i class="thread-running" aria-label="有任务执行中"></i>':''}</button>`).join('')||'<p class="thread-history-empty">暂无最近对话</p>'}`;
  }

  function switchThread(identifier) {
    const current=activeThread();
    ui.drafts[current.id]={prompt:ui.prompt,cli:ui.cli};
    const thread=threads().find(entry=>entry.id===identifier);
    if(!thread)throw new Error('没有找到这段对话。');
    engine.get().activeConversationId=thread.id;
    Object.assign(ui,{prompt:'',cli:'',...ui.drafts[thread.id],caseId:thread.caseId||'CS-0108',selected:'',drawer:'',error:''});
    ui.selected=thread.selectedTaskId||threadTasks()[0]?.id||'';
    host.persist();
    if(host.getView().page!=='manager')host.navigate('manager');else host.render();
    document.getElementById('manager-'+ui.mode)?.focus();
  }

  function newThread() {
    const blank=threads().find(thread=>!engine.get().messages.some(message=>message.conversationId===thread.id)&&!engine.get().tasks.some(task=>task.conversationId===thread.id)&&(thread.id!==activeThread().id||!ui.prompt&&!ui.cli)&&!ui.drafts[thread.id]?.prompt&&!ui.drafts[thread.id]?.cli&&!window.HubMedia?.has('dm:'+thread.id));
    if(blank)return switchThread(blank.id);
    if(threads().length>=40)throw new Error('演示最多保留 40 段对话，请先在平台设置中重置。');
    const thread={id:'CHAT-'+String(threads().length+1).padStart(4,'0'),title:'新对话',caseId:'CS-0108',createdAt:new Date().toISOString()};
    threads().unshift(thread);switchThread(thread.id);
  }

  function repaint() {
    window.ProjectHub?.engineChanged();
    if (!host || !['manager','group'].includes(host.getView().page)||window.PortfolioHub.navProject()?.id!=='AFTERSALES') return;
    const main = document.getElementById('main-content');
    if (!main) return;
    const active = document.activeElement;
    const focus = main.contains(active) && active.id ? {id:active.id,start:active.selectionStart,end:active.selectionEnd} : null;
    const scrolls = [...main.querySelectorAll('[data-manager-scroll]')].map(element=>({id:element.id,top:element.scrollTop,bottom:element.scrollHeight-element.clientHeight-element.scrollTop<8}));
    const details = [...main.querySelectorAll('details[id]')].map(element=>({id:element.id,open:element.open}));
    const scrollTop = main.scrollTop;
    main.innerHTML = window.ProjectHub?(host.getView().page==='group'?window.ProjectHub.groupWorkspace():window.ProjectHub.managerPage()):page();
    window.HubMedia?.sync();
    const history=document.getElementById('manager-thread-list');
    if(history)history.innerHTML=sidebarHistory();
    for (const saved of details) {const element=document.getElementById(saved.id);if(element)element.open=saved.open;}
    for (const scroll of scrolls) {const element=document.getElementById(scroll.id);if(element)element.scrollTop=scroll.bottom?element.scrollHeight:scroll.top;}
    main.scrollTop = scrollTop;
    if (focus) {
      const fresh=document.getElementById(focus.id);fresh?.focus({preventScroll:true});
      if (typeof focus.start==='number' && fresh?.setSelectionRange) fresh.setSelectionRange(focus.start,focus.end);
    }
  }

  function promptPanel() {
    const cases=host.getState().cases.filter(item=>item.owner!=='readonly');
    return `<div class="manager-compose-wrap"><form class="manager-compose" data-media-scope="dm:${activeThread().id}" aria-label="给项目助手发消息">${window.HubMedia?.tray('dm:'+activeThread().id)||''}<label class="sr-only" for="manager-${ui.mode}">${ui.mode==='prompt'?'任务目标':'模拟 CLI 命令'}</label><textarea id="manager-${ui.mode}" rows="2" maxlength="1200" placeholder="${ui.mode==='prompt'?'输入任务，例如：查询 CS-0106 的工单进度…':'run CS-0108,CS-0107 service'}" aria-describedby="manager-input-hint manager-error">${escape(ui[ui.mode])}</textarea><div class="manager-compose-toolbar">${window.HubMedia?.tools('dm:'+activeThread().id)||''}<label class="manager-context-select">${host.icon('link','small')}<select id="manager-case" aria-label="指令默认会话">${cases.map(item=>option(item.id,ui.caseId,item.id+' · '+item.name)).join('')}</select></label><div class="manager-compose-tools">${action(ui.mode==='prompt'?'对话':'CLI · 模拟','mode','','quiet small',`data-value="${ui.mode==='prompt'?'cli':'prompt'}" aria-label="${ui.mode==='prompt'?'切换到模拟 CLI':'切换到对话输入'}"`)}${action(host.icon('arrow-up','small'),'send','','manager-send',`aria-label="发送给项目助手" title="发送 · Enter"`)}</div></div></form><div id="manager-error" class="manager-error" role="alert">${escape(ui.error)}</div><div class="manager-input-hint" id="manager-input-hint"><span>${ui.mode==='prompt'?'Enter 发送 · Shift + Enter 换行':'本地命令解析，不运行系统程序'}</span><span>仅准备草稿，发送与建单需确认</span></div></div>`;
  }

  function welcome() {
    const open=host.getState().cases.filter(item=>!['已解决','关闭未解决','历史资料'].includes(item.status));
    return `<section class="manager-welcome"><h2>客户咨询处理</h2><p class="welcome-description">输入会话编号和要处理的事项，或选择一项常用任务。</p><div class="welcome-queue"><span class="live-dot"><i class="dot"></i>当前服务队列</span><span><strong>${open.length}</strong> 个待处理</span><span><strong>${open.filter(item=>item.status==='待人工接管').length}</strong> 个等待接管</span>${host.button('查看收件箱 '+host.icon('arrow-up-right','small'),'navigate','quiet small','data-page="workspace"')}</div><div class="manager-starters">${['处理 CS-0108，准备回复和报修草稿，先不要发送。',examples[1],examples[0]].map((text,index)=>action(host.icon(['clipboard-list','search','users'][index],'small')+['准备黑屏报修回复','查一笔工单进度','同时跟进两个客户'][index],'starter','','',`data-value="${escape(text)}"`)).join('')}</div></section>`;
  }

  function inlineTask(task) {
    const active=['执行中','排队中'].includes(task.status);
    const running=task.steps.filter(entry=>entry.status==='执行中');
    const waiting=task.steps.find(entry=>entry.status==='待执行');
    return `<article class="inline-task" data-task="${task.id}"><div class="inline-task-title">${window.HubIdentity.avatar(host.getState().cases.find(item=>item.id===task.caseId)||task.snapshot.item,{size:'sm',channel:true})}<div><strong>${escape(task.snapshot.item.name)} · ${escape(engine.kinds[task.kind])}</strong><small>${task.caseId} / ${task.id}</small></div>${pill(task.status)}</div><div class="inline-task-progress" role="progressbar" aria-label="${task.id} 步骤进度" aria-valuemin="0" aria-valuemax="${task.steps.length}" aria-valuenow="${completed(task)}">${task.steps.map(entry=>`<span class="${entry.status==='已完成'?'done':entry.status==='执行中'?'running':entry.status==='失败'?'failed':''}" title="${escape(entry.label+' · '+entry.status)}"></span>`).join('')}</div><div class="inline-task-caption"><span>${active?running.length?running.map(entry=>escape(engine.names[entry.worker]+'：'+entry.label)).join('；'):'等待助手空闲'+(waiting?' · '+escape(waiting.label):''):task.status==='待确认'?'草稿待核对，尚未发送或提交。':task.status==='已暂停'?'已暂停，已完成的结果会保留。':task.status==='失败'?'有一步没有完成，可以保留已有结果并重试。':task.status==='已取消'?'任务已取消，历史记录保留。':task.status==='需修正'?'已退回，请补充核实后重新执行。':task.status==='已完成'?'准备任务已确认完成；客户会话未自动结案。':'尚未执行'}</span><small>${completed(task)}/${task.steps.length}</small></div>${engine.changed(task)?'<p class="inline-task-warning">来源资料已变化。刷新资料后再使用结果。</p>':''}${outputOf(task,'result')?resultPanel(task):''}<div class="inline-task-footer">${action('分工与执行记录 '+host.icon('chevron-right','small'),'open',task.id,'quiet small')}${active?action('暂停','pause',task.id,'quiet small'):task.status==='已暂停'?action('继续执行','start',task.id,'small'):task.status==='失败'?action('重试失败步骤','retry',task.id,'small'):task.status==='需修正'?action('刷新资料并重跑','refresh',task.id,'small'):''}</div></article>`;
  }

  function transcript() {
    const messages=engine.get().messages.filter(message=>message.conversationId===activeThread().id);
    if(!messages.length)return welcome();
    const lastTaskMessage=new Map();
    messages.forEach((message,index)=>message.taskIds.forEach(identifier=>lastTaskMessage.set(identifier,index)));
    return `<div class="manager-transcript">${messages.map((message,index)=>`<article class="manager-chat-message ${message.role==='operator'?'operator':'assistant'}"><div class="manager-chat-author">${message.role==='operator'?window.HubIdentity.avatar({entityType:'staff',identityTone:'blue'},{size:'sm'}):window.HubIdentity.worker('manager','sm')}<strong>${message.role==='operator'?'你':'项目助手'}</strong><time>${time(message.time)}</time></div><div class="manager-chat-body"><p>${escape(message.text)}</p>${window.HubMedia?.messages(message.attachmentIds)||''}${message.taskIds.filter(identifier=>lastTaskMessage.get(identifier)===index).map(identifier=>engine.find(identifier)?inlineTask(engine.find(identifier)):'').join('')}</div></article>`).join('')}</div>`;
  }
  

  function rosterPanel() {
    return `<section class="manager-roster panel"><div class="manager-panel-head"><div><h2>助手状态</h2><p>按依赖分派，独立任务可以并行。</p></div></div><div class="manager-concurrency"><label>任务并行上限<select id="manager-task-capacity" aria-label="任务并行上限">${Array.from({length:12},(_,index)=>index+1).map(value=>`<option value="${value}" ${value===engine.limits.tasks?'selected':''}>${value} 个任务</option>`).join('')}</select></label><label>单助手并行步骤<select id="manager-step-capacity" aria-label="单助手并行步骤">${[1,2,3,4].map(value=>`<option value="${value}" ${value===engine.limits.workerSteps?'selected':''}>${value} 个步骤</option>`).join('')}</select></label><p>当前策略：最多 ${engine.limits.tasks} 个任务并行，每位助手最多 ${engine.limits.workerSteps} 步。同一会话的不同任务串行；降低上限不打断已开始步骤。</p></div>${engine.stats().map(worker=>`<div class="manager-worker"><div class="manager-worker-head"><strong>${window.HubIdentity.worker(worker.id,'sm')}${escape(worker.name)}</strong>${pill(!worker.enabled?'已暂停':worker.running.length?'执行中 '+worker.running.length+'/'+worker.capacity:'空闲')}</div>${worker.running.length?`<div class="manager-worker-work">${worker.running.map(job=>`${action(job.taskId,'open',job.taskId,'small')}<span>${escape(engine.find(job.taskId)?.steps.find(entry=>entry.id===job.stepId)?.label)}</span>`).join('')}</div>`:''}${worker.waiting.length?`<div class="manager-worker-wait">待执行 ${worker.waiting.length} 步${[...new Set(worker.waiting.map(job=>job.taskId))].slice(0,4).map(identifier=>action(identifier,'open',identifier,'small')).join('')}</div>`:''}</div>`).join('')}<p class="manager-caption manager-roster-note">仅控制本地准备任务，不代表模型吞吐量。外部专家为模拟端点，不会外发请求。</p></section>`;
  }
  

  function taskList() {
    const tasks=engine.get().tasks.filter(task=>(ui.filter==='all'||task.status===ui.filter)&&(ui.worker==='all'||task.steps.some(entry=>entry.worker===ui.worker)));
    return `<section class="manager-task-list"><div class="manager-list-heading"><h2>任务 <span>${tasks.length}</span></h2><div class="manager-task-filters"><select id="manager-filter" aria-label="筛选任务状态">${option('all',ui.filter,'全部状态')}${['待开始','执行中','排队中','待确认','已暂停','失败','需修正','已完成','已取消'].map(value=>option(value,ui.filter)).join('')}</select><select id="manager-worker" aria-label="筛选参与助手">${option('all',ui.worker,'全部助手')}${Object.entries(engine.names).map(([value,label])=>option(value,ui.worker,label)).join('')}</select></div></div><div class="manager-task-items" id="manager-task-items" data-manager-scroll>${tasks.map(task=>`<button class="manager-task-item ${task.id===selected()?.id?'selected':''}" data-action="manager-open" data-id="${task.id}" aria-pressed="${task.id===selected()?.id}"><span class="between"><strong>${task.id}</strong>${pill(task.status)}</span><span>${escape(engine.kinds[task.kind])}</span><small>${task.caseId} · 第 ${task.round} 轮 · 完成 ${completed(task)}/${task.steps.length} 步</small></button>`).join('')||'<div class="empty">没有符合筛选条件的任务。</div>'}</div></section>`;
  }
  

  function resultPanel(task) {
    const result=outputOf(task,'result');
    if (!result) return `<div class="manager-pending">${task.status==='待开始'?'这是预置计划，点击“开始任务”后才会执行。':task.status==='失败'?'部分步骤失败；已完成结果保留，可查看下方记录后重试。':'结果尚未汇总。已完成步骤的输出可在下方展开查看。'}</div>`;
    const stale=engine.changed(task);
    const blocked=result.quality?.blocking;
    const reply=result.reply;
    const draft=result.draft;
    return `<section class="manager-result"><div class="manager-result-grid">${reply?`<div class="result-reply"><h4>回复草稿</h4><p>${escape(reply.text)}</p><small>依据：${escape(reply.source)}</small>${action('在坐席中核对回复 '+host.icon('arrow-up-right','small'),'reply',task.id,'small',stale||blocked||!['待确认','已完成'].includes(task.status)?'disabled':'')}</div>`:''}${draft?`<div><h4>${draft.existing?'已有工单':'工单草稿'}</h4><p>${draft.existing?escape(draft.ticketId+' · '+draft.status):escape(draft.product+' / '+draft.softwareVersion)}</p><small>${draft.existing?'不重复创建':escape(draft.missing.length?'待补充：'+draft.missing.join('、'):'字段已填写，待人工核对')}</small>${action(draft.existing?'查看已有工单':'核对助手填单','draft',task.id,'quiet small',stale||!['待确认','已完成'].includes(task.status)?'disabled':'')}</div>`:''}${result.lookup?`<div><h4>工单查询</h4><p>${escape(result.lookup.found?result.lookup.ticket.id+' · '+result.lookup.ticket.status:'没有关联工单')}</p><small>本地记录，非实时查询</small></div>`:''}${result.knowledge?`<div><h4>知识核对</h4><p>${escape(result.knowledge.reason)}</p>${result.knowledge.documents.map(entry=>`<small>${escape(entry.id+' · '+entry.title+' / '+entry.version)}</small>`).join('')}</div>`:''}${result.quality?`<div class="result-quality"><h4>${host.icon(blocked?'alert-triangle':'shield-check','small')} 对话检查</h4><p>${escape(blocked?'需修正：'+result.quality.risk:'规则未拦截，内容仍需人工核对')}</p><small>${escape(result.quality.notes.join(' '))}</small></div>`:''}</div>${result.assistance.length?`<p class="manager-caption">已收到 ${result.assistance.length} 条模拟协作返回，尚无真实专家结论。</p>`:''}${task.status==='待确认'?`<details class="manager-review" id="manager-review-${task.id}"><summary>审核这份结果</summary><label for="manager-note-${task.id}">审核说明</label><textarea id="manager-note-${task.id}" rows="2" maxlength="600" placeholder="哪些内容可以使用，哪些还需核实？">${escape(ui.notes[task.id]||'')}</textarea><label class="manager-consent"><input id="manager-confirm-${task.id}" type="checkbox" ${ui.confirmed[task.id]?'checked':''}>已核对。确认仅结束准备任务，不发送消息、不提交工单。</label><div class="row">${action('退回修正','reject',task.id,'small')}${action('确认准备完成','approve',task.id,'primary small',stale||blocked?'disabled':'')}</div></details>`:''}${task.reviews.length?`<details id="manager-reviews-${task.id}"><summary>人工审核记录 · ${task.reviews.length}</summary>${task.reviews.map(review=>`<p>第 ${review.round} 轮 · ${review.approved?'确认':'退回'} · ${escape(review.note)}</p>`).join('')}</details>`:''}</section>`;
  }

  function stepPanel(task) {
    return `<section class="manager-steps"><div class="manager-panel-head"><h3>分工与步骤</h3><span>已完成 ${completed(task)} / ${task.steps.length}</span></div><ol>${task.steps.map((entry,index)=>`<li class="manager-step"><span class="manager-step-number ${entry.status==='已完成'?'done':''}">${entry.status==='已完成'?'✓':index+1}</span><div class="manager-step-body"><div class="between"><strong>${escape(entry.label)}</strong>${pill(entry.status)}</div><div class="manager-caption">${escape(engine.names[entry.worker])} · ${entry.dependencies.length?'等待：'+entry.dependencies.map(identifier=>escape(task.steps.find(step=>step.id===identifier)?.label||identifier)).join('、'):'无前置步骤'} · 已调用 ${entry.attempts} 次</div>${entry.error?`<p class="manager-error">${escape(entry.error)}</p>`:''}${entry.output!==null?`<details id="manager-output-${task.id}-${entry.id}"><summary>本步输出${entry.durationMs!==undefined?' · 本地函数 '+entry.durationMs.toFixed(2)+' ms':''}</summary><pre>${escape(JSON.stringify(entry.output,null,2))}</pre></details>`:''}<div class="manager-step-links">${entry.traceId?host.button('查看 Trace','trace-open','small',`data-id="${entry.traceId}"`)+host.button('登记问题案例','trace-bad-new','small',`data-id="${entry.traceId}" data-span="SP-01"`):''}</div>${entry.history.length?`<details id="manager-history-${task.id}-${entry.id}"><summary>历史执行 · ${entry.history.length}</summary>${entry.history.map(history=>`<div class="manager-history">第 ${history.round} 轮 · ${escape(history.reason)} · ${escape(history.status)}${history.traceId?host.button('查看原始 Trace','trace-open','small',`data-id="${history.traceId}"`):''}</div>`).join('')}</details>`:''}</div></li>`).join('')}</ol></section>`;
  }

  function contextPanel(task) {
    const summary=outputOf(task,'context')?.summary;
    if(!summary)return '';
    return `<details class="manager-context" id="manager-context-${task.id}"><summary>已整理的上下文 · ${summary.count} 条记录</summary><dl>${summary.rows.filter(row=>['最初诉求','最近诉求','已回复'].includes(row.label)).map(row=>`<div><dt>${escape(row.label)}</dt><dd>${escape(row.text)}</dd></div>`).join('')}<div><dt>待跟进</dt><dd>${escape(summary.next)}</dd></div></dl></details>`;
  }

  function exchangesPanel(task) {
    const canAssist=['执行中','排队中','已暂停','待确认','需修正'].includes(task.status);
    const workers=[...new Set(['manager',...task.steps.map(entry=>entry.worker)])];
    if (!workers.includes(ui.from)) ui.from='manager';
    return `<section class="manager-exchanges"><div class="manager-panel-head"><div><h3>助手间协作 · A2A</h3><p>本地消息流模拟，未连接真实外部 Agent。</p></div></div>${task.exchanges.map(exchange=>`<div class="manager-exchange"><div class="between"><strong>${escape(engine.names[exchange.from])} → ${escape(engine.names[exchange.to])}</strong>${pill(exchange.status)}</div><p>${escape(exchange.id)} · 仅 ${task.caseId} 的任务上下文</p>${exchange.to==='expert'?'<small>模拟接收，未派出真实专家、未获得验证结论。</small>':'<small>在当前任务知识快照中追加核对。</small>'}${exchange.traceId?host.button('查看请求与返回','trace-open','small',`data-id="${exchange.traceId}"`):''}</div>`).join('')||'<p class="manager-caption">暂未安排额外协助。</p>'}${canAssist?`<div class="manager-assist-form"><label>发起助手<select id="manager-from">${workers.map(value=>option(value,ui.from,engine.names[value])).join('')}</select></label><span>请求</span><label>协作助手<select id="manager-to">${['knowledge','expert'].map(value=>option(value,ui.to,engine.names[value])).join('')}</select></label>${action('安排协助','assist',task.id,'small')}</div>`:''}</section>`;
  }

  function taskDetail(task) {
    if(!task)return '<section class="manager-task-detail empty">输入目标，项目助手会在这里拆分任务。</section>';
    const stale=engine.changed(task);
    const active=['执行中','排队中'].includes(task.status);
    const secondary=`${!['已完成','已取消','待开始'].includes(task.status)&&task.steps.some(entry=>entry.id==='knowledge')?action('只重查方案','rerun',task.id,'small'):''}${!active&&task.status!=='待开始'?action('刷新资料并重跑','refresh',task.id,'small'):''}${['待开始','执行中','排队中','已暂停'].includes(task.status)?action(task.priority==='优先'?'改为普通':'优先处理','priority',task.id,'small'):''}${!['已完成','已取消'].includes(task.status)?action('取消任务','cancel',task.id,'small'):''}`;
    return `<section class="manager-task-detail"><div class="manager-panel-head manager-detail-head"><div><span class="manager-eyebrow">${task.id} / ${task.caseId}</span><h2>${escape(engine.kinds[task.kind])}</h2><p>${escape(task.goal)}</p></div>${pill(task.status)}</div><div class="manager-task-actions">${['待开始','已暂停'].includes(task.status)?action(task.status==='待开始'?host.icon('player-play','small')+' 开始任务':'继续执行','start',task.id,'primary small'):''}${active?action('暂停任务','pause',task.id,'small'):''}${task.status==='失败'?action('重试失败步骤','retry',task.id,'primary small'):''}${action('任务 Trace','traces',task.id,'small')}${host.button('原会话 '+host.icon('arrow-up-right','small'),'open-case','small',`data-id="${task.caseId}"`)}${secondary?`<details class="manager-more" id="manager-more-${task.id}"><summary>更多操作</summary><div>${secondary}</div></details>`:''}</div>${stale?'<div class="notice amber">来源资料已经变化。先暂停并刷新资料，再核对或使用结果。</div>':''}<div class="manager-detail-meta"><span>${escape(task.origin)}</span><span>第 ${task.round} 轮</span><span>${task.priority}</span><span>快照 ${time(task.snapshot.capturedAt)}</span></div>${contextPanel(task)}${stepPanel(task)}${exchangesPanel(task)}<details class="manager-events" id="manager-events-${task.id}"><summary>任务动态 <span>${task.events.length} 条</span></summary><ol>${task.events.slice().reverse().map(event=>`<li><time>${time(event.time)}</time><span>${escape(engine.names[event.actor]||'人工操作')} · ${escape(event.text)}</span></li>`).join('')}</ol></details></section>`;
  }
  

  function page() {
    const tasks=engine.get().tasks;
    const active=tasks.filter(task=>['执行中','排队中'].includes(task.status)).length;
    const messages=engine.get().messages.filter(message=>message.conversationId===activeThread().id);
    return `<div class="manager-page ${ui.drawer?'has-inspector':''}"><header class="manager-header"><div class="manager-heading"><h1>项目助手</h1>${messages.length?`<p>${escape(activeThread().title)}</p>`:''}</div><div class="manager-header-actions">${action('新对话','new','','quiet small manager-new-text','aria-label="发起新对话"')}${action(host.icon('users','small')+' 助手'+(active?' · '+active+' 个任务执行中':''),'drawer','','quiet small','data-value="roster" aria-label="查看助手状态"')}${action(host.icon('clipboard-list','small')+' 任务记录','drawer','','quiet small','data-value="tasks"')}${action(host.icon('message-circle','small')+' 对话记录','drawer','','quiet small','data-value="conversations"')}${action(host.icon('help','small'),'help','','quiet small','aria-label="查看支持的指令与能力边界"')}</div></header><div class="manager-chat-layout"><section class="manager-chat ${messages.length?'has-messages':'is-new'}" aria-label="项目助手对话"><div class="manager-chat-scroll" id="manager-messages" data-manager-scroll>${transcript()}</div>${promptPanel()}<div class="manager-boundary">本地交互演示 · 未接入真实模型、渠道或外部 Agent</div></section>${ui.drawer?`<aside class="manager-inspector" aria-label="${ui.drawer==='task'?'任务执行详情':ui.drawer==='roster'?'助手状态':ui.drawer==='conversations'?'对话记录':'任务记录'}"><div class="manager-inspector-head"><h2>${ui.drawer==='task'?'执行详情':ui.drawer==='roster'?'助手状态':ui.drawer==='conversations'?'对话记录':'任务记录'}</h2>${action(host.icon('x','small'),'close-drawer','','quiet small','aria-label="关闭侧栏"')}</div><div class="manager-inspector-scroll" id="manager-inspector-scroll" data-manager-scroll>${ui.drawer==='task'?taskDetail(selected()):ui.drawer==='roster'?rosterPanel():ui.drawer==='conversations'?`<div class="manager-history-list">${sidebarHistory()}</div>`:taskList()+`<div class="manager-tools-note">${action('模拟一次查询失败','fault','','quiet small')}<p>测试失败重试与执行记录。</p></div>`}</div></aside>`:''}</div><span class="sr-only" role="status" aria-live="polite">${threadTasks().map(task=>task.id+' '+task.status+'，完成 '+completed(task)+' 步').join('；')}</span></div>`;
  }

  function help() {
    host.showDialog('项目助手支持的指令','当前按本地规则识别，不是通用模型对话。',`<div class="manager-help"><h3>对话示例</h3><ul>${examples.map(text=>`<li>${escape(text)}</li>`).join('')}<li>只复核 CS-0104 的已有对话</li><li>暂停 PM-0001 / 继续 PM-0001 / 取消 PM-0001</li></ul><h3>命令窗口</h3><pre>help
run CS-0108 service
run CS-0108,CS-0107 service
run CS-0106 lookup
status [PM-0001]
pause PM-0001
resume PM-0001
retry PM-0001
cancel PM-0001
assist PM-0001 expert
rerun PM-0001 knowledge</pre><p>run 的任务类型：service 接待与报修准备；ticket 仅整理工单；lookup 工单查询；review 复核对话；knowledge 仅查方案。</p><p>命令不会运行系统程序。A2A 只模拟助手之间的请求、返回和依赖等待。Trace 记录调用输入、输出和依据，不展示隐式思考。</p></div>`);
  }

  function runInput(text,mode=ui.mode) {
    const thread=activeThread();
    const value=text.trim();
    if (!value || value.length>1200) throw new Error('请输入 1200 字以内的任务目标或命令。');
    if (host.isSensitive(value)) throw new Error('指令含疑似敏感信息，请移除后重试；原内容不会写入记录。');
    let operation;
    let taskId;
    let response;
    let created=[];
    if (mode==='cli') {
      const tokens=value.split(/\s+/);
      const command=tokens[0].toLowerCase();
      if (command==='help'&&tokens.length===1) {help();return [];}
      if (command==='run' && tokens.length===3 && /^CS-\d+(?:,CS-\d+)*$/i.test(tokens[1]) && engine.kinds[tokens[2]]) created=engine.submit(tokens[1].toUpperCase().split(','),tokens[2],engine.kinds[tokens[2]]);
      else if (['status','pause','resume','retry','cancel'].includes(command) && (tokens.length===2&&/^PM-\d+$/i.test(tokens[1])||command==='status'&&tokens.length===1)) {operation=command;taskId=tokens[1]?.toUpperCase();}
      else if (command==='assist'&&tokens.length===3&&/^PM-\d+$/i.test(tokens[1])&&['knowledge','expert'].includes(tokens[2])) {engine.assist(tokens[1].toUpperCase(),'manager',tokens[2]);taskId=tokens[1].toUpperCase();response=taskId+' 已安排协助。';}
      else if (command==='rerun'&&tokens.length===3&&/^PM-\d+$/i.test(tokens[1])&&tokens[2]==='knowledge') {operation='rerun';taskId=tokens[1].toUpperCase();}
      else throw new Error('不支持这条命令。输入 help 查看格式；这里不会执行系统命令。');
    } else {
      const ids=[...new Set((value.match(/CS-\d+/gi)||[]).map(identifier=>identifier.toUpperCase()))];
      taskId=value.match(/PM-\d+/i)?.[0].toUpperCase() || selected()?.id;
      if (/^(帮助|支持哪些指令|help)[？?。!！]?$/.test(value)) {help();return [];}
      const controls=[['暂停','pause'],['继续','resume'],['重试','retry'],['取消','cancel'],['查看任务|任务状态|进展怎么样|现在怎么样','status']];
      const control=controls.find(([pattern])=>new RegExp('^(请)?('+pattern+')').test(value));
      if (control) operation=control[1];
      else if (/只重查.*(方案|知识)/.test(value)) operation='rerun';
      else if (/(请|安排|让).*(专家|知识).*(协助|核对)/.test(value)) {engine.assist(taskId,'manager',/专家/.test(value)?'expert':'knowledge');response=taskId+' 已安排协助。';}
      else {
        if (/删除|退款|赔付|执行命令|导出|发布|绕过|忽略规则|自动发送|立即发送/.test(value)) throw new Error('这项操作不在授权范围。可以准备回复、整理工单、查询记录或复核对话，不执行退款、删除和自动发送。');
        const kind=/工单.*进度|查询.*工单/.test(value)?'lookup':/复核|质检|检查.*对话/.test(value)?'review':/仅|只/.test(value)&&/工单|填单/.test(value)?'ticket':/仅|只/.test(value)&&/知识|方案/.test(value)?'knowledge':/处理|接待|准备.*回复|报修|填单/.test(value)?'service':null;
        if (!kind) throw new Error('没识别出处理目标。请写明“处理会话”“查询工单”“只整理工单”或“复核对话”。');
        created=engine.submit(ids.length?ids:[ui.caseId],kind,value);
      }
    }
    if (operation) {
      if(!taskId&&operation!=='status')throw new Error('当前对话还没有可操作的任务，请写明任务编号。');
      if (operation==='status') {
        const tasks=taskId?[engine.find(taskId)]:threadTasks();
        if(!tasks.length)throw new Error('当前对话还没有任务。先告诉我需要处理哪个会话。');
        if (tasks.some(task=>!task)) throw new Error('没有找到这个任务。');
        response=tasks.map(task=>task.id+' / '+task.caseId+'：'+task.status+'，完成 '+completed(task)+'/'+task.steps.length+' 步').join('\n');
      } else {
        const methods={pause:'pause',resume:'start',retry:'retry',cancel:'cancel',rerun:'rerunKnowledge'};
        engine[methods[operation]](taskId);
        response=taskId+'：'+engine.find(taskId).status+'。';
      }
    }
    const taskIds=created.length?created.map(task=>task.id):taskId?[taskId]:[];
    engine.message('operator',value,[],thread.id);
    engine.message('manager',response||'我会先核对已有记录，再安排'+(created.length>1?'各个客户的':'')+'处理步骤。结果会直接放在这段对话里。',taskIds,thread.id);
    if(thread.title==='新对话')thread.title=value.replace(/[。！]$/,'').slice(0,28);
    if (taskIds.length){ui.selected=taskIds[0];thread.selectedTaskId=ui.selected;}
    if(created.length){ui.caseId=created[0].caseId;thread.caseId=ui.caseId;}
    ui[mode]='';ui.error='';engine.save();
    const stream=document.getElementById('manager-messages');if(stream)stream.scrollTop=stream.scrollHeight;
    return taskIds;
  }

  function dispatch(name,element) {
    const identifier=element.dataset.id;
    ui.error='';
    try {
      if (name==='open') {const task=engine.find(identifier);if(!task)throw new Error('没有找到这个任务。');if(task.conversationId==='GROUP-AFTERSALES')return window.ProjectHub.openGroupTask(identifier);if(task.conversationId&&task.conversationId!==activeThread().id)switchThread(task.conversationId);if(!task.conversationId){task.conversationId=activeThread().id;engine.message('manager','这是保留的预置计划，尚未执行。',[task.id]);}ui.selected=identifier;ui.caseId=task.caseId;activeThread().selectedTaskId=identifier;activeThread().caseId=task.caseId;ui.drawer='task';host.closeDialog();host.persist();if(host.getView().page!=='manager')host.navigate('manager');else repaint();return;}
      if (name==='new') return newThread();
      if (name==='thread') return switchThread(identifier);
      if (name==='drawer') {ui.drawer=ui.drawer===element.dataset.value?'':element.dataset.value;return repaint();}
      if (name==='close-drawer') {ui.drawer='';repaint();document.getElementById('manager-'+ui.mode)?.focus();return;}
      if (name==='help') return help();
      if (name==='mode') {ui.mode=element.dataset.value;return repaint();}
      if (name==='example') {ui.mode='prompt';ui.prompt=examples[Number(element.dataset.value)]||'';repaint();document.getElementById('manager-prompt')?.focus();return;}
      if (name==='starter') {ui.mode='prompt';ui.prompt=element.dataset.value;repaint();document.getElementById('manager-prompt')?.focus();return;}
      if (name==='send') {const scope='dm:'+activeThread().id;if(window.HubMedia?.has(scope)){if(host.isSensitive(ui[ui.mode]))throw new Error('请先移除敏感信息。');const attachmentIds=window.HubMedia.commit(scope);const thread=activeThread();engine.message('operator',ui[ui.mode].trim()||'补充了附件',[],thread.id);engine.get().messages.at(-1).attachmentIds=attachmentIds;engine.message('manager','已加入本地对话。本版只预览附件，尚未解析画面、视频或音频。请补充文字说明，再安排处理。',[],thread.id);ui[ui.mode]='';engine.save();return;}return runInput(ui[ui.mode]);}
      if (name==='fault') {activeThread();const tasks=engine.submit(['CS-0106'],'lookup','查询工单进度（单次超时演示）',{fault:'timeout'});ui.selected=tasks[0].id;ui.drawer='task';engine.message('manager',tasks[0].id+' 将模拟一次查询失败，失败后可重试并保留原 Trace。',[tasks[0].id]);engine.save();return;}
      if (name==='traces') return host.openTraces(identifier);
      const task=engine.find(identifier);
      if (!task) throw new Error('没有找到这个任务。');
      if (['reply','draft'].includes(name)) {
        engine.allowed(task.caseId,task.kind);
        if (engine.changed(task)) throw new Error('资料已变化，请刷新任务，不使用旧草稿。');
        if (!['待确认','已完成'].includes(task.status)) throw new Error('请先取得可核对的完整结果。');
        if (name==='reply') {if(outputOf(task,'quality')?.blocking)throw new Error('风险内容不能带入回复框。');const reply=outputOf(task,'reply');if(reply)host.openReply(task.caseId,reply.text,task.id);}
        else {const draft=outputOf(task,'draft');if(draft)host.openDraft(task.caseId,draft);}
        return;
      }
      if (['start','pause','cancel','retry','refresh'].includes(name)) engine[name](identifier);
      else if (name==='rerun') engine.rerunKnowledge(identifier);
      else if (name==='priority') engine.priority(identifier,task.priority==='普通'?'优先':'普通');
      else if (name==='assist') engine.assist(identifier,ui.from,ui.to);
      else if (['approve','reject'].includes(name)) engine.review(identifier,name==='approve',ui.notes[identifier]||'',ui.confirmed[identifier]);
      repaint();
    } catch (error) {ui.error=error.message;repaint();host.toast(error.message,true);}
  }

  function input(identifier,value) {
    if (identifier==='manager-prompt'||identifier==='manager-cli') ui[identifier.slice(8)]=value;
    if (identifier.startsWith('manager-note-')) ui.notes[identifier.slice(13)]=value;
  }
  function change(identifier,value,checked) {
    if(['manager-task-capacity','manager-step-capacity'].includes(identifier)){
      try{engine.setConcurrency(identifier==='manager-task-capacity'?Number(value):engine.limits.tasks,identifier==='manager-step-capacity'?Number(value):engine.limits.workerSteps);host.toast('调度策略已保存；对外发送与建单仍须人工确认。');}catch(error){host.toast(error.message,true);}return;
    }
    const fields={'manager-case':'caseId','manager-filter':'filter','manager-worker':'worker','manager-from':'from','manager-to':'to'};
    if(!fields[identifier]&&!identifier.startsWith('manager-confirm-'))return;
    if (fields[identifier]) ui[fields[identifier]]=value;
    if (identifier==='manager-case'){activeThread().caseId=value;host.persist();}
    if (identifier.startsWith('manager-confirm-')) ui.confirmed[identifier.slice(16)]=checked;
    repaint();
  }
  function configure(api) {host=api;engine=window.ManagerEngine.create({...api,onChange:repaint});ui.caseId=activeThread().caseId;ui.selected=activeThread().selectedTaskId||'';host.persist();}
  function reset() {ui.selected='';ui.mode='prompt';ui.caseId='CS-0108';ui.prompt='';ui.cli='';ui.notes={};ui.confirmed={};ui.error='';ui.filter='all';ui.worker='all';ui.drawer='';ui.drafts={};engine.reset();}
  return {configure,page,dispatch,input,change,runInput,repaint,reset,sidebarHistory,getEngine:()=>engine,currentThread:()=>activeThread().id};
})();
