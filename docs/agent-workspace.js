window.AgentWorkspace = (() => {
  let host;
  const views = new Map();
  const current = () => window.PortfolioHub.navProject();
  const workspace = () => window.ProjectStudio.data();
  const engine = () => window.ManagerHub.getEngine();
  const escape = value => host.escape(String(value ?? ''));
  const button = (label, action, attributes = '', tone = 'quiet small') => host.button(label, 'aw-' + action, tone, attributes);
  const attention = status => /待确认|待人工|需修正|失败|暂停|不足|待配置|转人工/.test(status);
  const done = status => ['已完成', '已取消'].includes(status);
  const workspaceTabs = [['collaboration','群聊','messages'],['tasks','任务','list-check'],['shared','业务资料','book-2'],['outcomes','验收记录','chart-bar']];
  function view() {
    if (!views.has(current().id)) views.set(current().id, {tab:'collaboration', selected:'', filter:'all', query:'', detail:false});
    return views.get(current().id);
  }
  function tasks() {
    const legacy = current().id === 'AFTERSALES' ? engine().get().tasks.map(task => ({key:'legacy:' + task.id, id:task.id, title:engine().kinds[task.kind], status:task.status, label:task.status === '已完成' ? '准备完成 · 非业务解决' : task.status, caseId:task.caseId, updatedAt:task.updatedAt, legacy:task})) : [];
    const custom = workspace().tasks.map(task => ({key:'custom:' + task.id, id:task.id, title:task.name, status:task.status, label:task.status, caseId:task.caseId || '', updatedAt:task.time, custom:task}));
    return [...legacy, ...custom].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }
  function openTask(key) {
    const task = tasks().find(task => task.key === key || task.id === key);
    if (!task) return host.toast('当前项目中没有这个任务。', true);
    window.SuperAgentChat?.useRules();
    Object.assign(view(), {tab:'tasks', selected:task.key, filter:'all', query:''});
    host.navigate('group');
  }
  function taskLink(task) {
    return button(`<span><strong>${escape(task.title)}</strong><small>${escape(task.id)}${task.caseId ? ' · ' + escape(task.caseId) : ''}</small></span><span class="aw-status ${attention(task.status) ? 'needs-attention' : ''}">${escape(task.label)}</span>`, 'task', `data-id="${escape(task.key)}"`, 'aw-task-link');
  }
  function header() {
    const pending = tasks().filter(task => attention(task.status)).length;
    const tabs=workspaceTabs.map(([value,label,symbol])=>{
      const selected=view().tab===value;
      const count=value==='tasks'&&pending?`<span class="aw-tab-count" aria-label="${pending} 项待确认">${pending}</span>`:'';
      return button(host.icon(symbol,'small')+'<span>'+label+'</span>'+count,'tab',`id="aw-tab-${value}" data-value="${value}" role="tab" aria-selected="${selected}" aria-controls="aw-surface" tabindex="${selected?0:-1}"`,'aw-tab'+(selected?' active':''));
    }).join('');
    return `<header class="aw-header"><div class="aw-header-copy"><h1 class="aw-super-title">${window.HubIdentity.worker('manager','md')}${escape(window.ProjectStudio.groupName())}</h1><p>内部协作群 · 客户不可见</p></div><div class="aw-header-actions" role="group" aria-label="协作设置"><div class="aw-settings-actions">${host.button(host.icon('adjustments-horizontal','small')+'<span>职责与授权</span>','studio-profile','aw-tool-button')}${button(host.icon('shield-check','small')+'<span>接入状态</span>','readiness','','aw-tool-button')}</div></div></header><div class="aw-navigation"><nav class="aw-tabs" role="tablist" aria-label="业务协作工作区">${tabs}</nav><p class="aw-environment">${host.icon('shield-check','small')}<span>本地演练 · 模型与业务系统未接入</span></p></div>`;
  }
  function selectTab(value){
    if(!workspaceTabs.some(([key])=>key===value))return;
    view().tab=value;host.render();
    document.querySelector(`#aw-tab-${value}`)?.focus({preventScroll:true});
  }
  function contractDetails(contract) {
    if(!contract)return '<p class="aw-note">旧记录未包含运行规则，保留原样；回到 Orbit 重新验收后，新任务才使用执行检查。</p>';
    return `<details class="aw-contract"><summary>本次执行规则 · ${escape(contract.runner)}</summary><dl><div><dt>定义来源</dt><dd>${contract.sources.ontology?'业务本体 O'+escape(contract.sources.ontology.revision)+' · '+escape(contract.sources.ontology.actionName):contract.sources.flow?'流程定义 F'+escape(contract.sources.flow.revision):'独立业务配置'} · 使用验收快照，不随最新草稿变化</dd></div><div><dt>动作边界</dt><dd>${escape(contract.toolName)} · 仅本地准备，不发送、不建单</dd></div><div><dt>必须提供</dt><dd>${contract.fields.map(escape).join('、')}</dd></div></dl><h3>仍需人工核对的业务规则</h3>${contract.manualChecks.length?'<ul>'+contract.manualChecks.map(rule=>'<li><strong>'+escape(rule.name)+'</strong>：'+escape(rule.description)+'</li>').join(''):'<p>字段内容的真实性、来源与适用范围。</p>'}<p class="aw-empty-note">结构化字段与风险词会实际拦截；文字规则、任意流程分支和外部能力不作为自动验证通过。</p></details>`;
  }
  function previewPlan() {
    try{
      const preview=current().id==='AFTERSALES'?window.ProjectHub.previewGoal():{custom:window.ProjectStudio.previewAssignment(workspace().drafts.group)};
      if(!preview.custom&&!preview.steps)throw new Error('没有匹配到可执行的助手，请 @ 指定本项目助手或先在 Orbit 研发。');
      const body=preview.custom?preview.custom.map(plan=>`<section class="aw-plan-section"><header>${window.HubIdentity.worker(plan.member.id,'sm')}<div><h2>${escape(plan.member.name)}</h2><small>${escape(plan.version)} · ${plan.outcome==='prepared'?'可准备草稿':plan.outcome==='missing'?'先补充信息':'需交回人工'}</small></div></header><p>${escape(plan.output)}</p><ol>${plan.steps.map(step=>'<li><strong>'+escape(step.name)+'</strong><p>'+escape(step.result)+'</p></li>').join('')}</ol>${contractDetails(plan.contract)}</section>`).join(''):`<section class="aw-plan-section"><h2>${escape(preview.title)}</h2><p>仅关联 ${preview.identifiers.map(escape).join('、')} · 预设售后流程，尚未绑定 Orbit 版本。</p><ol>${preview.steps.map(step=>`<li><strong>${escape(step.label)}</strong><span>${escape(engine().names[step.worker])}</span><p>${step.dependencies.length?'等待：'+step.dependencies.map(id=>escape(preview.steps.find(entry=>entry.id===id).label)).join('、'):'开始后执行'}</p></li>`).join('')}</ol></section>`;
      host.showDialog('预览分工','仅检查规则与展示步骤，不创建任务、不调用动作。','<div class="agent-workspace aw-plan">'+body+'<p class="aw-note">返回后可继续修改目标。发起任务时会重新检查授权、字段与版本；预览不构成执行许可。</p></div>',host.button('返回编辑','close-dialog','primary small'));
    }catch(error){host.toast(error.message,true);}
  }
  function customResult(task) {
    const agent=workspace().agents.find(agent=>agent.id===task.assignee);
    const traces=(task.history||[]).map(id=>agent?.traces.find(trace=>trace.id===id&&trace.taskId===task.id)).filter(Boolean);
    const runtime=task.runner===window.AgentHarness.version;
    return `<section class="aw-custom-result"><span class="aw-eyebrow">${escape(task.id)}</span><h2>${escape(task.name)}</h2><span class="aw-status">${task.status==='已完成'?'已核对本地结果 · 未对外执行':escape(task.status)}</span><p>${escape(task.summary)}</p><p>处理助手：${escape(task.assigneeName)} · ${escape(task.version||'尚无验收版本')}${runtime?' · 第 '+task.round+' / 3 轮':''}</p>${contractDetails(task.contract)}${traces.length?`<details class="aw-contract" open><summary>执行记录与本地回执 · ${traces.length} 轮</summary>${traces.map((trace,index)=>`<section class="aw-trace-round"><h3>第 ${index+1} 轮 · ${escape(trace.outcome==='prepared'?'草稿已准备':trace.outcome==='missing'?'信息不足':'转人工核实')}</h3><ol>${trace.steps.map(step=>'<li><strong>'+escape(step.name)+'</strong> · '+escape(step.result)+'</li>').join('')}</ol><p>${trace.receipt?'本地回执：'+escape(trace.receipt.id)+' · 无外部写入':'未调用动作，没有业务回执。'}</p></section>`).join('')}</details>`:''}${runtime&&task.status==='信息不足，需补充'?`<form id="aw-continue-form" class="aw-task-form" data-id="${escape(task.id)}"><label for="aw-task-input">补齐或修正完整任务描述</label><textarea id="aw-task-input" name="input" rows="4" maxlength="1200" required>${escape(task.input)}</textarea><p>保留已有字段并补齐缺项，以“字段：内容”填写；继续原任务，历史轮次不覆盖。</p><button class="button primary" type="submit" ${task.round>=3?'disabled':''}>${task.round>=3?'已达轮次上限，请转人工':'补充后重新检查'}</button></form>`:''}${runtime&&task.status==='已准备，待人工核对'?`<form id="aw-review-form" class="aw-task-form" data-id="${escape(task.id)}"><label for="aw-review-note">结果核对说明</label><textarea id="aw-review-note" name="note" rows="2" maxlength="400" required placeholder="说明核对了哪些来源、字段与业务规则"></textarea><label class="aw-confirm"><input type="checkbox" name="confirmed" required>我已核对字段来源与上方业务规则；本次确认不发送消息、不提交业务系统。</label><button class="button primary" type="submit">确认本地准备结果</button></form>`:''}${task.review?'<p class="aw-note">核对记录：'+escape(task.review.note)+'。确认只作用于这份本地结果。</p>':''}<p id="aw-task-error" role="alert"></p><footer>${task.traceId?host.button('查看版本与问题案例','studio-agent','small',`data-id="${escape(task.assignee)}" data-tab="traces"`):''}${host.button('回 Orbit 研发','studio-orbit','quiet small')}</footer><p class="aw-note">当前结果仅保存在浏览器，不代表已向客户发送、创建真实工单或解决问题。</p></section>`;
  }
  function taskDetail(record) {
    if (!record) return '<div class="aw-task-empty"><h2>选择一个任务</h2><p>查看进度和待确认结果。</p></div>';
    if (record.custom) {
      return customResult(record.custom);
    }
    const task = record.legacy;
    const resultReady = task.steps.some(step => step.id === 'result' && step.output);
    return `<div class="aw-task-result"><div class="aw-result-intro"><span class="aw-eyebrow">${escape(record.id)} · 任务详情</span><h2>${resultReady ? '处理结果与下一步' : '执行进度与下一步'}</h2><p role="status">${escape(record.label)} · 已完成 ${task.steps.filter(step => step.status === '已完成').length} / ${task.steps.length} 步</p><p>草稿需人工确认，准备完成不等于问题解决。</p>${button('查看本任务共享事实','facts','data-id="'+escape(record.key)+'"')}</div>${window.ManagerHub.resultPanel(task)}<details class="aw-execution" id="aw-execution-${escape(task.id)}" ${resultReady ? '' : 'open'}><summary>执行分工、来源与重试操作</summary>${window.ManagerHub.taskDetail(task)}</details></div>`;
  }
  function taskPage() {
    const records = tasks();
    const filtered = records.filter(task => (view().filter === 'all' || view().filter === 'attention' && attention(task.status) || view().filter === 'running' && ['执行中','排队中'].includes(task.status) || view().filter === 'finished' && done(task.status)) && (task.title + task.id + task.caseId).toLowerCase().includes(view().query.toLowerCase()));
    const selected = filtered.find(task => task.key === view().selected) || filtered[0];
    return `<div class="aw-task-toolbar"><label class="search-field">${host.icon('search','small')}<input id="aw-search" aria-label="搜索任务" placeholder="搜索任务、会话或编号" value="${escape(view().query)}"></label><label><span class="sr-only">任务状态</span><select id="aw-filter" aria-label="任务状态">${[['all','全部任务'],['attention','待确认与异常'],['running','进行中'],['finished','准备完成 / 已取消']].map(([value,label]) => `<option value="${value}" ${view().filter === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>${filtered.length} 项任务</span></div><div class="aw-task-layout"><div class="aw-task-list" aria-label="项目任务">${filtered.map(task => `<div class="${selected?.key === task.key ? 'selected' : ''}">${taskLink(task)}</div>`).join('') || '<p class="aw-empty-note">没有符合条件的任务。可调整筛选，或从协作区发起。</p>'}</div>${taskDetail(selected)}</div>`;
  }
  function facts(task) {
    const item = task.snapshot.item;
    return `<div class="aw-facts"><p class="aw-note">快照来自 ${escape(task.caseId)}，仅属于这次任务；客户表述不等于已核实结论。${engine().changed(task) ? '<strong>来源已变化，请刷新任务后再使用。</strong>' : '当前来源与任务快照一致。'}</p><dl><div><dt>客户原始诉求 · 客户表述</dt><dd>${escape(item.messages.find(message => message.role === 'customer')?.text || '未提供')}</dd></div><div><dt>已尝试操作 · 客户表述</dt><dd>${escape(item.messages.filter(message => message.role === 'customer' && /尝试|重启|试过|复现/.test(message.text)).map(message => message.text).join('；') || '未明确提供，不推断')}</dd></div><div><dt>本地关联工单 · 非实时查询</dt><dd>${escape(task.snapshot.ticket ? task.snapshot.ticket.id + ' / ' + task.snapshot.ticket.status : '尚无关联工单')}</dd></div><div><dt>必要字段与未知信息</dt><dd>${escape(task.steps.find(step => step.id === 'draft')?.output?.missing?.join('、') || '请结合步骤输出核对，字段存在不代表已验证')}</dd></div></dl><h3>按职责取用，不广播其他客户记录</h3><ul><li>协调助手：目标、进度、异常与结果。</li><li>知识助手：现象、型号、适用版本与知识依据。</li><li>填单助手：本次客户资料、字段来源与工单草稿。</li><li>复核助手：拟发送内容、来源与操作边界。</li></ul><p class="aw-note">当前为任务级本地快照。生产环境的按角色数据授权仍待服务端接入；群内共享不会授予退款、删除或业务写入权限。</p></div>`;
  }
  function shared() {
    return window.WorkspaceReview.shared();
  }
  function readiness() {
    const rows = [['业务规则与案例','已接入本地执行检查','Orbit 新验收版本共用同一套字段、风险与动作检查；旧版本需重新验收。'],['语义模型与工具','未接入任务链路','客户体验支持独立模型对话；群聊仍不执行任意 Prompt、画布分支或外部工具。'],['客户渠道与系统回执','本地模拟','消息、工单和客户自助演练仅保存在当前浏览器。'],['服务端权限与凭证','上线前必须完成','需接入身份认证、最小权限、凭证管理和租户数据隔离。'],['写入保护与运行治理','上线前必须完成','真实写入需确认、幂等回执、审计、失败恢复、发布及回滚验证。']];
    host.showDialog('能力与上线检查','可以完成原型验收，不具备生产发布条件。',`<div class="aw-readiness">${rows.map(([name,status,note]) => `<article><div><strong>${name}</strong><span class="aw-status">${status}</span></div><p>${note}</p></article>`).join('')}<p>共享信息不授予执行权限。完成真实服务接入与验收后，才能用于生产。</p></div>`,host.button('知道了','close-dialog','primary small'));
  }
  function outcomes() {
    return window.WorkspaceReview.outcomes();
  }
  function showFacts(key){
    const record=tasks().find(task=>task.key===key&&task.legacy);
    if(record)host.showDialog('任务共享事实 · '+record.id,'基于当前任务快照；不包含其他客户或其他项目。',facts(record.legacy),host.button('关闭','close-dialog'));
  }
  function history() {
    if (current().id !== 'AFTERSALES') return host.showDialog('历史独立对话','仅查看旧记录，不自动转发或复制任务。',workspace().messages.manager.map(entry => `<article><strong>${escape(entry.name)}</strong><p>${escape(entry.text)}</p></article>`).join('') || '<p>暂无历史独立对话。</p>',host.button('关闭','close-dialog'));
    const messages = engine().get().messages.filter(entry => entry.conversationId !== 'GROUP-AFTERSALES');
    host.showDialog('历史独立对话','旧记录原样保留。关联任务已在统一任务列表中，不需要重新发起。',`<div class="aw-history">${messages.map(entry => `<article><small>${escape(entry.conversationId || '早期记录')} · ${escape(entry.role === 'operator' ? '你' : '项目助手')}</small><p>${escape(entry.text)}</p>${(entry.taskIds || []).map(id => button('打开 '+escape(id),'task',`data-id="${escape(id)}"`)).join('')}</article>`).join('') || '<p>暂无历史独立对话。</p>'}</div>`,host.button('关闭','close-dialog'));
  }
  function page() {
    if(window.SuperAgentChat?.active())return window.SuperAgentChat.page();
    const tab = view().tab;
    const panel=workspaceTabs.some(([value])=>value===tab)?`role="tabpanel" aria-labelledby="aw-tab-${tab}" tabindex="0"`:'';
    return `<div class="agent-workspace ${tab==='collaboration'?'is-chat':['shared','outcomes'].includes(tab)?'is-review':''}">${window.SuperAgentChat?.modeBar()||''}${header()}<div class="aw-surface" id="aw-surface" ${panel}>${tab === 'tasks' ? taskPage() : tab === 'shared' ? shared() : tab === 'outcomes' ? outcomes() : window.GroupChat.page()}</div></div>`;
  }
  function configure(adapter) {
    host = adapter;
    window.SuperAgentChat?.configure(adapter);
    window.GroupChat?.configure(adapter);
    window.WorkspaceReview?.configure(adapter);
    document.addEventListener('click', event => {
      const element = event.target.closest('[data-action^="aw-"]');
      if (!element || !current()) return;
      event.preventDefault();
      const name = element.dataset.action.slice(3);
      if (name === 'task') return openTask(element.dataset.id);
      if (name === 'plan') return previewPlan();
      if (name === 'from-case' && window.SuperAgentChat?.active() && window.SuperAgentChat.fromCase(host.getView().caseId)) return;
      if (name === 'from-case' && current().id === 'AFTERSALES') {if(!window.ProjectHub.setCase(host.getView().caseId))return host.toast('这条会话只读或不可用。',true);if(!window.ProjectHub.composerContext().draft)window.ProjectHub.setDraft('处理 '+host.getView().caseId+'，准备资料和回复，先不要发送。');else host.toast('已带入会话选择；保留了原任务草稿，请核对其中是否另有会话编号。');view().tab='collaboration';return host.navigate('group');}
      if (name === 'tab' && element.dataset.value === 'experience' && current().id === 'AFTERSALES') return window.ServiceJourney.open();
      if (name === 'tab') selectTab(element.dataset.value);
      if (name === 'detail') {view().detail=!view().detail;window.ManagerHub.repaint();}
      if (name === 'readiness') readiness();
      if (name === 'history') history();
      if (name === 'schedule') host.showDialog('本地任务调度','并发只控制准备任务，不代表模型吞吐或外部系统容量。',current().id === 'AFTERSALES' ? window.ManagerHub.rosterPanel() : '<p>当前项目尚未接入异步执行调度。</p>',host.button('关闭','close-dialog'));
      if (name === 'starter') {window.ProjectHub.setDraft(element.dataset.value === 'lookup' ? '查询 CS-0106 的工单进度。' : '处理 CS-0108，准备报修资料和回复，先不要发送。');host.render();document.getElementById('project-group-prompt')?.focus();}
      if (name === 'fault' && current().id === 'AFTERSALES') {try {const created=engine().submit(['CS-0106'],'lookup','查询工单进度（单次超时演练）',{fault:'timeout',origin:'协作工作台 · 失败演练',conversationId:'GROUP-AFTERSALES'});openTask(created[0].id);} catch (error) {host.toast(error.message,true);}}
      if (name === 'facts') showFacts(element.dataset.id);
      if (name === 'orbit-section') {window.OrbitWorkbench.view().section=element.dataset.value;window.ProjectStudio.dispatch('tab',{dataset:{value:'workbench'}});}
    });
    document.addEventListener('keydown',event=>{
      const tab=event.target.closest('.aw-tabs [role="tab"]');
      if(!tab||!current()||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const index=workspaceTabs.findIndex(([value])=>value===tab.dataset.value);
      if(index<0)return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?workspaceTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+workspaceTabs.length)%workspaceTabs.length;
      selectTab(workspaceTabs[next][0]);
    });
    document.addEventListener('input', event => {if(event.target.id === 'aw-search'){const caret=event.target.selectionStart;view().query=event.target.value;window.ManagerHub.repaint();if(current().id !== 'AFTERSALES')host.render();const input=document.getElementById('aw-search');input?.focus();input?.setSelectionRange(caret,caret);}});
    document.addEventListener('change', event => {if(event.target.id === 'aw-filter'){view().filter=event.target.value;host.render();document.getElementById('aw-filter')?.focus();}});
    document.addEventListener('submit',event=>{
      if(!['aw-continue-form','aw-review-form'].includes(event.target.id))return;
      event.preventDefault();const input=new FormData(event.target);
      try{if(event.target.id==='aw-continue-form')window.ProjectStudio.continueTask(event.target.dataset.id,String(input.get('input')||'').trim());else window.ProjectStudio.approveTask(event.target.dataset.id,{note:input.get('note'),confirmed:input.has('confirmed')});host.render();host.toast('已更新原任务，历史记录保留；没有对外执行。');}
      catch(error){const target=document.getElementById('aw-task-error');if(target)target.textContent=error.message;else host.toast(error.message,true);}
    });
  }
  return {configure,page,view,tasks,openTask,showFacts,readiness,contractDetails,reset(){views.clear();window.GroupChat?.reset();window.WorkspaceReview?.reset();}};
})();
