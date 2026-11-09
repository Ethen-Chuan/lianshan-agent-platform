window.HubIconHelp = (() => {
  const navigation={
    'project-assistant':['项目助手设置','为当前项目设置业务范围、成员授权与配置版本，不影响其他项目。'],
    orbit:['Orbit 助手研发','在当前项目配置场景、核对案例并验收，确认后纳入本地团队。'],
    'custom-assistant':['定制业务助手','查看这位助手的执行记录、问题案例、回归与历史版本。'],
    portfolios:['项目集','先选择所属项目，再进入项目内的助手与业务工作区。'],
    portfolio:['项目集','在项目集中查找项目；未选择项目时不显示业务助手导航。'],
    project:['部门项目','查看项目目标、团队和任务；进入项目内开展业务。'],
    group:['项目协作群','在项目群里 @ 助手、分配任务并查看进度；群消息对本项目成员可见。'],
    graph:['业务图谱','按问题、型号、版本与来源案例查证据，审核新问题后回流本体。'],
    reception:['智能接待','优先解决常见售后问题，保留主动求助、风险和知识缺口的人工出口。'],
    forms:['CRM / QMS 填单','提取客户明确提供的信息，核对字段与缺项，保存本地模拟回执。'],
    scoring:['会话评分','按版本化标准复核完整对话，记录分数、扣分证据和整改建议。'],
    manager:['项目助手','交代任务，查看助手分工、执行进度与待确认结果。'],
    workspace:['客服收件箱','查看各渠道会话，接管客户问题并准备回复。'],
    tickets:['工单记录','查看报修工单、处理状态与关联客户会话。'],
    agents:['业务助手','管理助手职责、运行策略和独立模型连接。'],
    quality:['发送风险复核','查看被拦截的回复，核对风险并记录复核意见。'],
    knowledge:['知识中心','维护处理方案与适用版本；草稿须审核后才能使用。'],
    analytics:['运营大盘','查看每日 Top 5 问题、服务指标与问题回流。'],
    channels:['渠道接入','查看消息接收、回复与历史记录的授权范围。'],
    settings:['平台设置','查看演示范围和数据保护说明，或重置本地演示。']
  };
  const actions={
    'assistant-directory':['业务助手','打开负责接待、工单、质检与大盘的助手目录；各自管理业务台账和版本。'],
    'assistant-business':['业务工作区','进入这位助手负责的业务页面，不创建新任务或修改数据。'],
    'reporter-send':['向大盘助手提问','按所选日期和渠道查询本地固定样本，保留依据与执行记录；不调用真实模型。'],
    'reporter-open':['查看大盘分析','打开群里这次分析的原始结果、统计范围及下钻入口。'],
    'reporter-request':['定位慢请求','打开分析中引用的预置请求，查看各阶段耗时和工具尝试。'],
    'portfolio-home':['项目集','查找和选择项目；返回不清空项目内的任务或对话。'],
    'portfolio-return':['返回项目集','离开当前项目工作区，选择其他项目；不删除对话，也不停止已启动的任务。'],
    'portfolio-switch':['切换项目','按项目集选择其他项目，只显示目标项目自己的助手与业务。'],
    'portfolio-open':['按分组查看项目','回到项目列表，并筛选这个分组；不会打开另一层大盘。'],
    'portfolio-enter':['进入项目','直接打开这个项目的工作空间，不复制其他项目的数据。'],
    'portfolio-menu':['管理项目','编辑项目信息、移动分组、归档或恢复项目。'],
    'portfolio-favorite':['收藏项目','将常用项目放进收藏列表；再次点击取消收藏。'],
    'portfolio-groups':['管理项目分组','新建或重命名分组，用来整理项目，不共享业务数据。'],
    'portfolio-library-layout':['切换显示方式','用卡片浏览项目，或用列表快速查找。'],
    'portfolio-archive-ask':['归档或恢复项目','只调整项目在列表中的位置，不删除资料，也不停止任务。'],
    'portfolio-project':['进入项目','打开该项目自己的概览、任务与业务团队。'],
    'portfolio-legacy':['打开项目助手','进入原售后项目的对话工作台，保留原任务与历史记录。'],
    'portfolio-task':['跟进原项目事项','打开事项所属项目，不会复制为另一份任务。'],
    'portfolio-refresh':['刷新台账','重新读取当前页面的本地任务状态，不连接外部系统。'],
    'manager-new':['新对话','另开一段项目助手对话；保留原对话、草稿和运行中的任务。'],
    'manager-help':['指令说明','查看可以交代的任务、输入示例与当前演示限制。'],
    'manager-starter':['试用任务示例','把这条示例填入输入框，修改或确认后再发送。'],
    'manager-send':['发送任务','把输入内容交给项目助手处理。Enter 发送，Shift + Enter 换行；对客发送仍需确认。'],
    'manager-close-drawer':['关闭侧栏','收起任务或助手详情，不取消正在运行的任务。'],
    'manager-thread':['打开历史对话','返回这段对话及其关联任务，保留当前未发送草稿。'],
    'manager-open':['查看任务详情','查看当前任务的分工、步骤、卡点和执行记录。'],
    'manager-traces':['任务执行记录','查看这项任务的工具调用、返回结果与异常。'],
    'ui-navigator':['查找功能','搜索并跳转到工作台功能。快捷键：⌘ K / Ctrl + K。'],
    'notifications':['通知与待办','查看本地工作区中等待处理的通知与事项。'],
    'team-info':['账号与工作空间','查看当前演示身份和权限说明；不会切换真实账号。'],
    'guide':['使用说明','查看演示操作路径与功能边界。'],
    'close-dialog':['关闭窗口','关闭当前窗口，不代替保存或提交操作。'],
    'filter-info':['会话筛选说明','了解全部、我的接待、未读及渠道筛选的含义。'],
    'select-case':['打开客户会话','查看这位客户的聊天、问题摘要和关联工单，不会自动回复。'],
    'back-queue':['返回会话列表','返回客户队列；当前未发送的回复仍保留。'],
    'case-more':['更多会话操作','查看服务结果、重新打开问题等可用操作。'],
    'resolve':['记录服务结果','填写解决状态与证据，不会把停止回复自动算作解决。'],
    'attachment-info':['附件说明','查看附件安全要求；当前演示不接受真实文件上传。'],
    'quick-reply':['常用回复','打开常用语，选择后填入回复框，不会直接发送。'],
    'insert-suggestion':['起草回复','根据当前会话填入回复建议，核对后再发送。'],
    'risk-example':['风险拦截示例','填入一条高风险承诺示例，用于测试拦截；不会直接发送。'],
    'agent-trace':['助手执行记录','查看这段会话的处理步骤、工具返回与判断依据。'],
    'create-draft':['助手自动填单','从当前会话整理工单信息，补齐并确认后再提交。'],
    'simulate-message':['模拟新消息','选择渠道和问题示例，在本地生成一条模拟客户消息。'],
    'takeover':['人工接管','改由客服处理，暂停这段会话的自动回复。'],
    'resume-ai':['恢复助手接待','核对权限和风险后，确认恢复后续模拟消息的自动接待。'],
    'model-open':['模型连接','单独配置这位助手的模型；保存、测试和业务执行相互独立。'],
    'model-test':['测试模型连接','确认授权后发送固定测试问候，可能计费，不携带客户对话。'],
    'trace-open':['查看执行记录','查看处理步骤、工具输入输出及异常，定位问题来源。'],
    'trace-bad-new':['登记问题案例','关联当前执行记录，填写待复核的问题，不自动作为回归金标。'],
    'ticket-detail':['工单详情','查看工单字段、处理状态和关联的客户会话。'],
    'review-detail':['回复复核','查看原回复、风险依据和复核记录；确认后才更新处理结果。'],
    'knowledge-detail':['知识详情','查看处理步骤、适用范围和审核状态；未审核草稿不能用于自动回复。'],
    'channel-detail':['渠道详情','查看接收、回复和历史导入权限；不会直接连接真实账号。'],
    'graph-zoom':['缩放图谱','放大或缩小节点；也可拖动画布空白处移动视野。'],
    'graph-reset':['适应画布','恢复完整图谱视野，不重置筛选条件。'],
    'graph-schema':['本体结构','查看实体类型、关系与使用边界，不展示模型隐式思维。'],
    'graph-run':['关联检索','按选定问题与型号版本遍历本地示例图，结果保留来源及执行记录。'],
    'insight-graph':['在图谱中查看','携带当前日期、渠道与问题，查看关系和来源。'],
    'insight-all':['全部问题','查看当前日期和筛选范围内的问题排名，不只显示前五项。'],
    'insight-topic':['查看问题详情','下钻具体症状、关联案例和待核验线索；相似案例不等于已确认根因。'],
    'insight-ontology':['本体与问题回流','查看问题分类、候选审核和目录版本，跟进待复核案例。'],
    'insight-export':['导出问题统计','确认后下载当前筛选的模拟聚合报表，不包含原始聊天。'],
    'insight-definitions':['统计口径','查看去重、占比、对比周期和新问题候选的定义。'],
    'export-metrics':['导出运营报表','确认当前筛选后下载模拟统计，不包含客户聊天或本地待办。'],
    'analytics-definitions':['指标口径','查看服务量、解决率与人工复核正确率的计算方法。'],
    'test-agent':['测试接待回复','使用本地示例试跑接待逻辑，查看回复与执行记录。'],
    'risk-lab':['测试回复检查','输入示例内容，查看风险提示；不会发给客户。'],
    'add-channel':['添加渠道','查看渠道接入步骤；当前演示不会连接真实账号。'],
    'import-history':['历史样本导入','演示授权历史样本的归集过程，导入后保持只读。'],
    'new-knowledge':['新建知识草稿','填写处理方案及适用产品，审核前不用于自动回复。'],
    'reset-confirm':['重置演示数据','确认后恢复当前版本的初始数据；不会删除旧版演示。']
  };
  let popup;
  let active;
  let hovered;
  let focused;
  let dismissed;
  let overPopup=false;
  let showTimer;
  let hideTimer;
  let syncFrame;
  let observer;
  let listeners;
  const originals=new WeakMap();
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const field=(element,name,value)=>{if(element.getAttribute(name)!==value)element.setAttribute(name,value);};

  function visibleText(element){
    const copy=element.cloneNode(true);
    copy.querySelectorAll('svg,.icon-action-caption,.sr-only,kbd').forEach(child=>child.remove());
    return clean(copy.textContent);
  }

  function describe(element){
    const action=element.dataset.action;
    if(action==='portfolio-library-layout')return [element.dataset.value==='cards'?'卡片视图':'列表视图','切换项目的展示方式，不改变项目内容。'];
    if(action==='portfolio-favorite')return [element.getAttribute('aria-pressed')==='true'?'取消收藏':'收藏项目','调整常用项目收藏，不删除或归档项目。'];
    const projectHelp={
      'media-choose':['添加附件','选择截图、视频或音频，先预览并检查敏感信息；本版不上传服务器。'],
      'media-voice':['语音转文字','单次授权后开始听写。识别结果先核对，不直接发送给助手。'],
      'media-preview':['预览附件','在本地查看图片或播放音视频，不代表已完成内容识别。'],
      'media-remove':['移除附件','从这条草稿移除文件，不删除设备上的原文件。'],
      'project-send':['发送到项目群','项目成员可见；准备、核对与工具调用为本地模拟，不发给客户。'],
      'project-pmo':['查看项目','回到项目列表并筛选当前分组，不显示独立PMO大盘。'],
      'project-view':['切换项目视图','在项目助手单聊和团队协作群之间切换，分别保留草稿。'],
      'project-assistant':['助手工作区','打开这位助手独立的案例、样本、评测和版本记录。'],
      'project-mention':['提及助手','选择本项目的助手并插入 @ 名称；发送后才会安排任务。'],
      'project-task':['群任务进度','查看任务步骤、依赖和异常；不把模拟结果当作真实业务完成。']
    };
    if(projectHelp[action])return projectHelp[action];
    if(action==='navigate')return navigation[element.dataset.page]||null;
    if(action==='mobile-menu')return [document.querySelector('.sidebar.open')?'收起导航':'打开导航','显示或收起功能菜单，不改变当前任务。'];
    if(action==='toggle-context')return [element.getAttribute('aria-label')?.startsWith('关闭')||element.getAttribute('aria-expanded')==='true'?'收起客户资料':'查看客户资料','查看客户信息、问题摘要与关联工单。'];
    if(action==='send-message')return document.querySelector('.composer-tab.active')?.dataset.value==='note'?['保存内部备注','仅团队可见，不会发送给客户。']:['发送回复','将回复框内容模拟发送给当前客户；风险内容会先拦截。'];
    if(action==='manager-drawer')return ({roster:['助手状态','查看每位助手当前任务、运行状态与等待队列。'],tasks:['任务记录','查看本地任务的状态、步骤和历史执行结果。'],conversations:['对话记录','查看并切换项目助手历史对话，不重复创建任务。']})[element.dataset.value]||null;
    if(action==='manager-mode')return element.dataset.value==='cli'?['切换到 CLI','改用模拟命令交代任务，不执行电脑上的系统命令。']:['切换到对话','改用自然语言向项目助手交代任务。'];
    if(element.id==='manager-case'||element.matches('.manager-context-select'))return ['选择关联会话','为当前指令指定客户会话；不是上传附件，不会自动发送客户消息。'];
    if(action==='metric-definition')return [element.dataset.name+'口径','查看这个指标的统计对象、分子分母和计算限制。'];
    if(actions[action]){
      const detail=[...actions[action]];
      if(element.disabled)detail[1]=action==='resolve'?'当前会话为只读，不能修改服务结果。':action==='model-test'?'先保存有效配置并确认授权；便携单文件不支持真实模型测试。':'当前不可用。'+detail[1];
      return detail;
    }
    if(element.matches('.channel-mark')){
      const channel=['wechat','ding','feishu','archive'].find(name=>element.classList.contains(name));
      return ({wechat:['微信客服','消息来源渠道标识，不表示客户身份已认证。'],ding:['钉钉','消息来源渠道标识，不表示客户身份已认证。'],feishu:['飞书','消息来源渠道标识，不表示客户身份已认证。'],archive:['历史存档','历史导入记录，只读，不作为实时消息入口。']})[channel]||null;
    }
    if(element.matches('button')&&(element.querySelector('svg')||element.classList.contains('icon-button'))){
      const label=clean(element.getAttribute('aria-label')||originals.get(element)?.title||visibleText(element));
      return label?[label.slice(0,80),'']:null;
    }
    return null;
  }

  function annotate(element){
    const detail=describe(element);
    if(!detail)return;
    if(!originals.has(element))originals.set(element,{title:element.getAttribute('title')});
    field(element,'data-icon-help',detail[0]);
    field(element,'data-icon-help-description',detail[1]);
    element.removeAttribute('title');
    if(element.matches('button')&&!visibleText(element)){
      if(!element.hasAttribute('aria-label'))field(element,'aria-label',detail[0]);
      element.classList.add('has-icon-caption');
      let caption=element.querySelector('.icon-action-caption');
      if(!caption){caption=document.createElement('span');caption.className='icon-action-caption';caption.setAttribute('aria-hidden','true');element.append(caption);}
      const captionText=({'发送任务':'发送','发送到项目群':'发送','关闭窗口':'关闭','关闭侧栏':'收起','账号与工作空间':'账号','会话筛选说明':'筛选','记录服务结果':'服务结果','风险拦截示例':'风险示例','选择关联会话':'关联会话'})[detail[0]]||detail[0];
      if(caption.textContent!==captionText)caption.textContent=captionText;
    }
    if(element.matches('.channel-mark')&&!element.getAttribute('aria-label')){field(element,'role','img');field(element,'aria-label',detail[0]);}
    if(element.id==='manager-case'){
      field(element,'aria-label','选择关联客户会话');
      const label=element.closest('.manager-context-select');
      if(label&&!label.querySelector('.manager-context-label')){const text=document.createElement('span');text.className='manager-context-label';text.textContent='关联会话';label.querySelector('svg')?.after(text);}
    }
  }

  function sync(){
    if(!popup)return;
    document.querySelectorAll('#app button,#overlay-root button,#manager-case,.manager-context-select,.channel-mark').forEach(annotate);
    if(active&&(!active.isConnected||active.closest('[inert]')))hide();
    if(active&&!popup.hidden){const detail=describe(active);if(detail){popup.querySelector('strong').textContent=detail[0];popup.querySelector('p').textContent=detail[1];popup.querySelector('p').hidden=!detail[1];place();}}
  }

  function removeDescription(element){
    if(!element)return;
    const identifiers=(element.getAttribute('aria-describedby')||'').split(/\s+/).filter(identifier=>identifier&&identifier!=='hub-icon-tooltip');
    if(identifiers.length)element.setAttribute('aria-describedby',identifiers.join(' '));else element.removeAttribute('aria-describedby');
  }

  function hide(){
    clearTimeout(showTimer);clearTimeout(hideTimer);
    removeDescription(active);
    active=null;overPopup=false;
    if(popup)popup.hidden=true;
  }

  function place(){
    if(!active?.isConnected)return hide();
    const anchor=active.getBoundingClientRect();
    if(!anchor.width&&!anchor.height)return hide();
    const bounds=popup.getBoundingClientRect();
    const viewport=window.visualViewport;
    const originLeft=viewport?.offsetLeft||0;
    const originTop=viewport?.offsetTop||0;
    const viewportWidth=viewport?.width||window.innerWidth;
    const viewportHeight=viewport?.height||window.innerHeight;
    const padding=10;
    const gap=8;
    let left=anchor.left+(anchor.width-bounds.width)/2;
    let top=anchor.top-bounds.height-gap;
    if(active.closest('.sidebar')&&anchor.right+bounds.width+gap<originLeft+viewportWidth-padding){left=anchor.right+gap;top=anchor.top+(anchor.height-bounds.height)/2;}
    else if(top<originTop+padding)top=anchor.bottom+gap;
    left=Math.max(originLeft+padding,Math.min(left,originLeft+viewportWidth-bounds.width-padding));
    top=Math.max(originTop+padding,Math.min(top,originTop+viewportHeight-bounds.height-padding));
    popup.style.left=Math.round(left)+'px';popup.style.top=Math.round(top)+'px';
  }

  function show(element){
    clearTimeout(hideTimer);clearTimeout(showTimer);
    if(!element?.isConnected||element===dismissed||element.closest('[inert]'))return;
    const detail=describe(element);
    if(!detail)return;
    if(active!==element)removeDescription(active);
    active=element;
    popup.querySelector('strong').textContent=detail[0];
    popup.querySelector('p').textContent=detail[1];popup.querySelector('p').hidden=!detail[1];
    popup.hidden=false;
    const described=new Set((element.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));described.add('hub-icon-tooltip');element.setAttribute('aria-describedby',[...described].join(' '));
    place();
  }

  function target(node){
    if(!(node instanceof Element)||popup?.contains(node))return null;
    const element=node.closest('button,select,.manager-context-select,.channel-mark');
    if(!element||element.closest('[inert]'))return null;
    annotate(element);
    return element.hasAttribute('data-icon-help')?element:null;
  }

  function leave(){
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{if(overPopup)return;if(focused?.isConnected&&focused===document.activeElement&&focused!==dismissed)show(focused);else if(hovered?.isConnected&&hovered!==dismissed)show(hovered);else hide();},140);
  }

  function init(){
    if(popup||!document.body)return;
    listeners=new AbortController();
    const listen=(element,event,handler,capture=false)=>element.addEventListener(event,handler,{capture,signal:listeners.signal});
    popup=document.createElement('div');popup.id='hub-icon-tooltip';popup.className='hub-icon-tooltip';popup.role='tooltip';popup.hidden=true;
    const title=document.createElement('strong');const description=document.createElement('p');popup.append(title,description);document.body.append(popup);
    listen(popup,'pointerenter',()=>{overPopup=true;clearTimeout(hideTimer);});
    listen(popup,'pointerleave',()=>{overPopup=false;leave();});
    listen(document,'pointerover',event=>{
      if(event.pointerType==='touch'||popup.contains(event.target))return;
      const element=target(event.target);
      if(element===hovered)return;
      hovered=element;if(dismissed!==element)dismissed=null;
      clearTimeout(showTimer);clearTimeout(hideTimer);
      if(element&&element!==dismissed){showTimer=setTimeout(()=>show(element),220);}else leave();
    });
    listen(document,'pointerout',event=>{
      if(event.pointerType==='touch')return;
      const next=target(event.relatedTarget);
      if(hovered&&next===hovered)return;
      if(popup.contains(event.relatedTarget)){overPopup=true;clearTimeout(hideTimer);return;}
      hovered=null;clearTimeout(showTimer);
      if(!next&&dismissed!==focused)dismissed=null;
      leave();
    });
    listen(document,'focusin',event=>{focused=target(event.target);if(focused!==dismissed)dismissed=null;if(focused)show(focused);else leave();});
    listen(document,'focusout',event=>{focused=target(event.relatedTarget);if(!focused)dismissed=null;leave();});
    listen(document,'pointerdown',event=>{if(popup.contains(event.target))return;dismissed=target(event.target);hide();},true);
    listen(document,'click',event=>{if(!popup.contains(event.target)){dismissed=target(event.target);hide();}},true);
    listen(document,'keydown',event=>{if(event.key==='Escape'&&popup&&!popup.hidden){event.preventDefault();event.stopImmediatePropagation();dismissed=active;hide();}},true);
    listen(document,'scroll',event=>{if(active&&!popup.contains(event.target)){dismissed=active;hide();}},true);
    listen(window,'resize',()=>{hide();schedule();});
    listen(window,'blur',hide);
    listen(window,'hashchange',hide);
    listen(document,'visibilitychange',()=>{if(document.hidden)hide();});
    observer=new MutationObserver(records=>{if(popup&&records.some(record=>!popup.contains(record.target)))schedule();});
    for(const identifier of ['app','overlay-root']){const root=document.getElementById(identifier);if(root)observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-label','aria-expanded','data-value']});}
    sync();
  }

  function schedule(){if(!popup)return;cancelAnimationFrame(syncFrame);syncFrame=requestAnimationFrame(sync);}
  function dispose(){hide();observer?.disconnect();listeners?.abort();cancelAnimationFrame(syncFrame);popup?.remove();popup=null;hovered=null;focused=null;dismissed=null;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  return {init,sync,hide,describe,dispose};
})();
