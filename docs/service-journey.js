window.ServiceJourney = (() => {
  let host;
  let mode='model';
  const escape = value => host.escape(String(value ?? ''));
  const button = (label, name, attributes='', tone='quiet small') => host.button(label,'journey-'+name,tone,attributes);
  const stamp = () => new Date().toISOString();
  const activeProject = () => window.PortfolioHub.navProject()?.id === 'AFTERSALES';
  const data = () => host.getState().serviceJourney ||= {sessions:[],activeId:''};
  const sessions = () => activeProject() ? data().sessions : [];
  const current = () => sessions().find(session => session.id === data().activeId);
  function modeTabs(){return `<nav class="journey-mode-tabs" aria-label="客户测试方式">${button('模型对话','mode','data-value="model" aria-pressed="'+(mode==='model')+'"')}${button('流程回归','mode','data-value="rules" aria-pressed="'+(mode==='rules')+'"')}</nav>`;}
  function setMode(value){
    if(!['model','rules'].includes(value)||!activeProject())return;
    window.CustomerChat?.stop();mode=value;data().experienceMode=mode;
    if(!!current()&&(current().mode==='model')===(mode==='model')){host.persist();host.render();return;}
    data().activeId=sessions().filter(session=>(session.mode==='model')===(mode==='model')).at(-1)?.id||'';
    host.persist();host.render();
  }
  function selectSession(identifier){
    const session=sessions().find(entry=>entry.id===identifier);if(!session)return;
    window.CustomerChat?.stop();
    data().activeId=identifier;mode=session.mode==='model'?'model':'rules';data().experienceMode=mode;host.persist();host.render();
  }
  function startModel(){
    if(!activeProject())return;
    if(sessions().length>=40)return host.toast('最多保留 40 次测试，请继续已有对话。',true);
    window.CustomerChat?.stop();
    const session={id:crypto.randomUUID(),mode:'model',startedAt:stamp(),scenario:'free',product:'待确认',productSource:'尚未提供',version:'待确认',messages:[],status:'new',resolved:false,caseId:'',taskId:'',draft:'',handoffReason:''};
    sessions().push(session);data().activeId=session.id;mode='model';data().experienceMode=mode;host.persist();host.render();
    document.getElementById('customer-model-input')?.focus();
  }
  const linkedCase = session => activeProject() && session?.caseId ? host.getState().cases.find(item => item.id === session.caseId && item.handoff?.sourceSession === session.id) : null;
  const publicMessages = session => {
    const messages=session?.caseId ? linkedCase(session)?.messages || [] : session?.messages || [];
    return messages.filter(message=>['customer','agent','staff'].includes(message.role)).map(({role,text,source,time})=>({role,text,source,time}));
  };
  function sync() {
    if(!host)return;
    for(const session of host.getState().serviceJourney?.sessions || []) {
      if(!session.caseId||!session.resolved)continue;
      const item=host.getState().cases.find(entry=>entry.id===session.caseId&&entry.handoff?.sourceSession===session.id);
      if(!item||item.status!=='已解决')Object.assign(session,{resolved:false,resolvedAt:null,status:'handed-off'});
    }
  }
  function open(caseId) {
    if(!activeProject())return;
    if(caseId) {
      const session=sessions().find(entry=>entry.caseId===caseId&&linkedCase(entry));
      if(!session)return host.toast('此会话没有关联的客户预览，请从已有演练中继续。',true);
      window.CustomerChat?.stop();data().activeId=session.id;mode=session.mode==='model'?'model':'rules';data().experienceMode=mode;host.persist();
    }
    host.navigate('customer');
  }
  function canConfirm(session) {
    if(!session||session.resolved)return false;
    if(!session.caseId)return session.status==='answered';
    const item=linkedCase(session);
    return !!item&&item.owner!=='readonly'&&publicMessages(session).at(-1)?.role==='staff';
  }
  function confirmResolution() {
    const session=current();if(!canConfirm(session))return;
    if(session.caseId) {
      const item=linkedCase(session);const channel=host.getState().channels.find(entry=>entry.id===item.channel);
      if(!channel?.read||channel.status==='已停用')return host.toast('演示渠道已停用，确认未提交。请恢复渠道后重试。',true);
      item.status='已解决';item.evidence='客户在本地预览中明确确认问题已解决。';item.resultSource='customer-preview';item.resultRecordedAt=stamp();
      host.addMessage(item,'customer','问题已解决，谢谢。');
      host.audit('客户在本地预览中确认解决，非真实渠道回执',item.id);
    }
    Object.assign(session,{resolved:true,status:'resolved',resolvedAt:stamp()});
    host.persist();host.render();
  }
  function start(scenario) {
    if(!activeProject())return;
    mode='rules';data().experienceMode=mode;
    if(sessions().length>=40)return host.toast('本地最多保留 40 次客户演练，请继续已有会话。',true);
    const session={id:crypto.randomUUID(),startedAt:stamp(),scenario,product:'座舱终端 A1',productSource:'场景预设，待客户核实',version:'待确认',messages:[],status:'new',resolved:false,caseId:'',taskId:'',draft:'',handoffReason:''};
    sessions().push(session);data().activeId=session.id;
    const examples={version:'在哪里查看设备的软件版本？',repair:'设备黑屏了，我已经尝试重启，还是没有恢复，需要报修。',risk:'我想直接更换设备，请转人工。',timeout:'请查询我的工单进度。'};
    send(examples[scenario] || examples.version);
  }
  function assess(session, text, knowledge=null) {
    if(/人工|投诉|退款|赔付|更换|换机|冒烟|起火/.test(text))return {status:'needs-human',text:'这项需求需要人工核实。转接时会保留您已提供的信息；是否符合条件、费用和处理时间，以人工核实结果为准。',reason:'客户要求人工或涉及风险 / 授权判断'};
    if(session.product==='待确认')return {status:'needs-human',text:'您提供的型号与本次 A1 演练不一致。请转人工核实后，再按对应型号处理。',reason:'产品不匹配或型号信息存在冲突'};
    if(session.scenario==='timeout')return {status:'tool-failed',text:'模拟查询超时，暂时查不到新的工单状态。您可以重试，或带上当前记录转人工。',reason:'查询工具超时演练，未取得业务回执'};
    if(/黑屏|报修|故障/.test(text)||session.scenario==='repair') {
      if(session.version==='待确认')return {status:'collecting',text:'请补充设备的软件版本。如果屏幕无法操作，可以直接转人工，之前的信息会保留，无需重复描述。'};
      return {status:'ready-handoff',text:'资料已补充，请转人工核对报修。本次演练尚未创建真实工单，是否更换仍需人工确认。',reason:'报修资料待坐席核对与提交'};
    }
    if(/在哪|哪里|怎么|查看/.test(text)&&/版本/.test(text)&&!/升级|更新|最新|降级|刷机/.test(text)&&knowledge?.content)return {status:'answered',text:knowledge.content.trim(),source:[knowledge.id,knowledge.title,knowledge.version].filter(Boolean).join(' · ')};
    return {status:'needs-human',text:'暂时没有找到适用的处理方案，请转人工继续核实。当前演练仅支持预设规则。',reason:'未找到适用知识或超出本地规则范围'};
  }
  function send(text) {
    const session=current();const value=String(text || '').trim();
    if(!session||!value)return;
    if(value.length>800||host.isSensitive(value))return host.toast('请使用 800 字以内的脱敏演练内容，不输入真实客户资料。',true);
    if(session.caseId) {
      const item=linkedCase(session);const channel=host.getState().channels.find(entry=>entry.id===item?.channel);
      if(!item||item.owner==='readonly')return host.toast('关联会话不可用，未发送；原演练记录保留。',true);
      if(!channel?.read||channel.status==='已停用')return host.toast('演示渠道已停用，消息未发送。请恢复渠道后重试。',true);
      const reopened=['已解决','关闭未解决'].includes(item.status);
      Object.assign(session,{resolved:false,resolvedAt:null,status:'handed-off',draft:''});
      item.status=item.owner==='human'?'人工处理中':'待人工接管';item.evidence='';item.resultSource='';item.resultRecordedAt=null;item.unread=true;
      host.addMessage(item,'customer',value);host.audit(reopened?'客户继续反馈，问题重新进入处理':'客户在本地预览补充消息',item.id);
      host.persist();host.render();return;
    }
    session.resolved=false;session.resolvedAt=null;
    session.messages.push({role:'customer',text:value,time:stamp()});
    const products=[...new Set(session.messages.filter(message=>message.role==='customer').flatMap(message=>message.text.match(/\b[A-Z]\d{1,3}\b/gi)||[]).map(product=>product.toUpperCase()))].filter(product=>!/^V\d/.test(product));
    if(products.length){session.product=products.length===1&&products[0]==='A1'?'座舱终端 A1':'待确认';session.productSource='客户表述，尚未验证';}
    const versions=[...new Set(session.messages.filter(message=>message.role==='customer').flatMap(message=>message.text.match(/\bV\d+(?:\.\d+){1,3}\b/gi)||[]).map(version=>version.toUpperCase()))];
    session.version=versions.length===1?versions[0]:'待确认';
    const supported=host.getState().knowledge.find(entry=>entry.id==='KB-0101'&&entry.status==='已发布'&&entry.product===session.product&&typeof entry.content==='string'&&entry.content.trim()&&!host.isSensitive(entry.content)&&!host.checkRisk?.(entry.content));
    const service=host.getState().agents?.find(entry=>entry.id==='service');
    const result=service&&(!service.enabled||service.mode!=='auto')?{status:'needs-human',text:'当前自动接待已暂停，请转人工继续处理。',reason:'自动接待未开启'}:versions.length>1?{status:'needs-human',text:'您提供了多个软件版本，请转人工核对当前版本后继续处理。',reason:'客户版本信息存在冲突'}:assess(session,value,supported);
    Object.assign(session,{status:result.status,handoffReason:result.reason || '',draft:''});
    session.messages.push({role:'agent',text:result.text,source:result.source || '',time:stamp()});
    host.persist();host.render();
  }
  function handoff() {
    const session=current();if(!session)return;
    if(session.mode==='model'&&!session.messages.some(message=>message.role==='customer'))return host.toast('先输入客户问题，再转人工。',true);
    window.CustomerChat?.stop(session);
    if(session.caseId)return linkedCase(session)?host.openCase(session.caseId):host.toast('关联会话不可用，未创建重复会话。',true);
    const state=host.getState();const channel=state.channels.find(channel=>channel.id==='wechat');
    if(!channel?.read||channel.status==='已停用')return host.toast('演示渠道已停用，无法交接。请恢复渠道后重试，客户记录已保留。',true);
    const next=Math.max(200,...state.cases.map(item=>Number(item.id.replace('CS-',''))||0))+1;
    const identifier='CS-'+String(next).padStart(4,'0');
    const risk=session.status==='needs-human';
    const messages=session.messages.map(message=>({...message,time:new Date(message.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}));
    const handoff={sourceSession:session.id,reason:session.handoffReason || '客户主动选择人工',knownFields:{product:session.product,productSource:session.productSource,version:session.version},attempted:session.messages.filter(message=>message.role==='customer'&&/尝试|重启|试过/.test(message.text)).map(message=>message.text),unresolved:session.handoffReason || '客户希望人工继续跟进',time:stamp()};
    const item={id:identifier,name:'自助演练客户',organization:'客户端自助演练 · 示例',initial:'客',entityType:'store',identityTone:'teal',channel:'wechat',channelName:'微信客服',origin:'客户自助演练 · 本地交接',title:messages.find(message=>message.role==='customer')?.text || '自助服务交接',preview:messages.at(-1)?.text || '',time:'刚刚',status:'待人工接管',owner:'ai',priority:risk?'高风险':'普通',product:session.product,version:session.version,model:'待核实',tags:['自助转人工','含交接上下文'],verified:false,unread:true,related:'本次自助演练，未跨客户合并',messages,handoff};
    item.messages.push({role:'system',text:'自助服务已交接。请先阅读前序对话、已尝试操作和待核实项，不重复询问已知信息。',time:'刚刚'});
    state.cases.unshift(item);session.caseId=identifier;session.status='handed-off';session.resolved=false;host.persist();host.render();
    host.toast('已进入本地客服收件箱，完整上下文已保留；未发送到真实渠道。');
  }
  function legacyPage() {
    sync();
    const session=current();const item=linkedCase(session);const records=sessions().filter(entry=>entry.mode!=='model');
    const status=session?.caseId?(item?(session.resolved?'客户已确认解决':'已转人工 · '+item.status):'关联会话不可用'):({new:'尚未开始',answered:'已提供知识解答，等待客户确认',collecting:'信息不足，等待补充','needs-human':'需要人工判断','ready-handoff':'资料待坐席核对','tool-failed':'查询演练失败，未取得结果',resolved:'客户确认解决'}[session?.status]||'尚未开始');
    const form=session&&(!session.caseId||item)?`<form id="journey-message-form"><label for="journey-message">客户补充信息</label><textarea id="journey-message" name="text" rows="2" maxlength="800" required placeholder="例如：软件版本 V2.3.1，重启后仍未恢复">${escape(session.draft)}</textarea><button type="submit" class="button small">发送演练消息</button></form>`:'';
    return `<section class="journey"><header class="journey-heading"><div><span class="aw-eyebrow">客户视角 / 本地模拟</span><h1>客户体验</h1><p>模拟客户咨询与转人工，不连接真实渠道。</p></div>${item?button('切换到客服视角','open','','small'):host.button('切换到客服视角','navigate','small','data-page="workspace"')}</header>${modeTabs()}<div class="journey-layout"><aside class="journey-scenarios"><h3>选择一个场景</h3>${[['version','操作咨询','审核知识 → 客户确认'],['repair','设备报修','收集信息 → 人工处理 → 回告']].map(([value,title,note])=>button(`<strong>${title}</strong><small>${note}</small>`,'start',`data-value="${value}"`,'journey-scenario')).join('')}<section class="journey-boundary-tests" aria-labelledby="journey-boundary-title"><h3 id="journey-boundary-title">异常场景测试</h3><div>${[['risk','人工与风险','转人工与高风险诉求','shield-check'],['timeout','工具失败','查询超时与失败处理','alert-triangle']].map(([value,title,note,art])=>button(`${host.icon(art,'small')}<span><strong>${title}</strong><small>${note}</small></span><span class="journey-scenario-cta">开始测试 ${host.icon('arrow-right','small')}</span>`,'start',`data-value="${value}" aria-label="开始${title}测试"`,'journey-boundary-button')).join('')}</div></section><p>每次选择会新建演练，已有记录保留。</p>${records.length?`<label>继续历史演练<select id="journey-history" aria-label="选择历史客户演练">${records.slice().reverse().map((entry,index)=>`<option value="${escape(entry.id)}" ${entry.id===session?.id?'selected':''}>${records.length-index} · ${escape(entry.messages[0]?.text.slice(0,20)||'新演练')}</option>`).join('')}</select></label>`:''}</aside><div class="journey-phone"><header>${window.HubIdentity.worker('service','sm')}<div><strong>连山服务助手</strong><small>自助服务预览 · 本地规则</small></div></header><div class="journey-messages" aria-label="客户可见消息">${session?publicMessages(session).map(message=>`<article class="${message.role==='customer'?'from-customer':''}"><span>${message.role==='customer'?'客户':message.role==='staff'?'客服':'服务助手'}</span><p>${escape(message.text)}</p>${message.source?`<small>${escape(message.source)}</small>`:''}</article>`).join(''):'<div class="aw-task-empty"><h3>先选择左侧场景</h3></div>'}</div>${session?`<div class="journey-controls"><p role="status">${escape(status)}</p>${session.caseId?button('去客服继续处理','open','','primary small'):''}${canConfirm(session)?button('客户确认：问题已解决','resolve','','primary small'):''}${!session.caseId?`${session.status==='tool-failed'?button('重试本地查询演练','retry'):''}${button('携带记录转人工','handoff')}`:''}${form}</div>`:''}</div><aside class="journey-context"><h3>会话信息</h3><dl><div><dt>客户提供的型号 / 版本</dt><dd>${session?escape(session.product+' / '+session.version+'（尚需核实）'):'等待开始'}</dd></div><div><dt>处理状态</dt><dd>${escape(status)}</dd></div><div><dt>下一步</dt><dd>${session?.caseId?'在客服工作台核对资料、回复或处理工单；客户可在此继续反馈。':'知识未覆盖或资料不齐时，可带着记录转人工。'}</dd></div><div><dt>执行边界</dt><dd>与客服共用本地会话，回告只保存在当前浏览器；不展示内部备注、审批原因或其他客户记录。工单完成不自动视为问题解决。</dd></div></dl>${session?.caseId?button('查看关联客服会话','open'):''}</aside></div></section>`;
  }
  function configure(adapter) {
    host=adapter;
    mode=host.getState().serviceJourney?.experienceMode==='rules'?'rules':'model';
    for(const session of host.getState().serviceJourney?.sessions||[])if(session.mode==='model'&&session.status==='model-pending')Object.assign(session,{status:'model-error',modelError:'页面已重新打开，上次请求未续发。可手动重试，可能再次计费。'});
    window.CustomerChat?.configure({...adapter,current,sessions,modeTabs,startModel,selectSession,handoff,publicMessages,canConfirm,confirmResolution,submitCustomer:send});
    document.addEventListener('click',event=>{
      const element=event.target.closest('[data-action^="journey-"]');if(!element||!activeProject())return;
      event.preventDefault();const name=element.dataset.action.slice(8);const session=current();
      if(name==='mode')return setMode(element.dataset.value);
      if(name==='start')start(element.dataset.value);
      if(name==='handoff')handoff();
      if(name==='open'&&linkedCase(session))host.openCase(session.caseId);
      if(name==='resolve')confirmResolution();
      if(name==='retry'&&session?.status==='tool-failed'&&!session.caseId){session.messages.push({role:'agent',text:'重试结束。工单接口尚未接入，仍无法核实进度，请转人工查询。',time:stamp()});session.status='needs-human';session.handoffReason='工单查询接口尚未接入';host.persist();host.render();}
    });
    document.addEventListener('input',event=>{if(event.target.id==='journey-message'&&current()){current().draft=host.isSensitive(event.target.value)?'':event.target.value;host.persist();}});
    document.addEventListener('change',event=>{if(event.target.id==='journey-history')selectSession(event.target.value);});
    document.addEventListener('submit',event=>{if(event.target.id==='journey-message-form'){event.preventDefault();send(new FormData(event.target).get('text'));}});
  }
  function page(){sync();return mode==='model'&&window.CustomerChat?window.CustomerChat.page():legacyPage();}
  return {configure,page,sessions,assess,start,handoff,open,publicMessages,canConfirm,sync,startModel,setMode,selectSession};
})();
