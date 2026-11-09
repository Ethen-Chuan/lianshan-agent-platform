window.HubBrand=(()=>{
  const mark='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><path d="M6 46 23 17l17 29" stroke="#d4a17d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="m26 46 15-25 17 25" stroke="#f0ddc6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 54h48" stroke="#8eaa8e" stroke-width="4" stroke-linecap="round"/></svg>';
  const favicon=document.createElement('link');favicon.rel='icon';favicon.href='data:image/svg+xml,'+encodeURIComponent(mark);document.head.append(favicon);
  return {mark,header(){return `<div class="brand lianshan-brand"><span class="lianshan-mark" role="img" aria-label="连山标识：彼此相接的山峰">${mark}</span><div class="brand-text"><div class="brand-name">连山</div><div class="brand-sub">LIANSHAN</div></div></div>`;}};
})();

window.TicketAssistant=(()=>{
  let host;
  let activeCase='';
  let editing=new Set();
  const ruleVersion='TICKET-FILL-1';
  const labels={customer:'客户 / 服务对象',product:'产品型号',version:'软件版本',type:'工单类型',description:'问题描述',priority:'优先级',department:'受理部门'};
  const choices={type:['报修单','咨询单','专家支持单'],priority:['普通','优先'],department:['技术支持组','软件专家组','服务运营组']};
  const limits={product:100,version:80,type:20,description:6000,priority:10,department:40};
  const routing=[{id:'ROUTE-01',name:'服务政策',pattern:/更换|换机|退款|赔付|投诉|收费|保修政策/,department:'服务运营组',note:'换机、退款、投诉等政策诉求交服务运营组核实，不代表审批通过。'},{id:'ROUTE-02',name:'软件问题',pattern:/蓝牙|断连|软件升级|系统升级|升级后|地图|投屏/,department:'软件专家组',note:'蓝牙、升级、地图和投屏问题分派软件专家组。'},{id:'ROUTE-03',name:'设备故障',pattern:/黑屏|无法开机|开不了机|供电|屏幕没有反应|硬件|花屏/,department:'技术支持组',note:'黑屏、开机、供电和硬件故障分派技术支持组。'}];
  const escape=value=>host.escape(value);
  const action=(label,name,extra='',tone='quiet small')=>host.button(label,'ticket-assistant-'+name,tone,extra);
  const store=()=>host.getState().ticketAssistant||(host.getState().ticketAssistant={schema:1,drafts:{},history:[]});
  const current=()=>store().drafts[activeCase];
  const customerMessages=item=>item.messages.map((message,index)=>({id:'M'+String(index+1).padStart(2,'0'),role:message.role,text:String(message.text||'')})).filter(message=>message.role==='customer');
  const fingerprint=item=>JSON.stringify({id:item.id,customer:item.name,channel:item.channel,messages:customerMessages(item)});
  function allowed(caseId){
    if(window.PortfolioHub.navProject()?.id!=='AFTERSALES')throw new Error('请在售后服务项目使用填单助手。');
    const item=host.getState().cases.find(entry=>entry.id===caseId);
    if(!item||item.owner==='readonly')throw new Error('历史资料只读，不能生成服务工单。');
    const channel=host.getState().channels.find(entry=>entry.id===item.channel);
    if(!channel?.read||channel.status==='已停用')throw new Error('渠道已停用或没有读取权限，不能继续填单。');
    if(!host.getState().agents.find(agent=>agent.id==='ticket')?.enabled)throw new Error('工单填写助手已暂停，请在职责与配置中启用。');
    window.ProjectStudio.authorizeLegacy(['ticket']);
    return item;
  }
  function analyze(item){
    const started=performance.now();
    const messages=customerMessages(item);
    if(!messages.length)throw new Error('当前没有客户消息，无法自动填写。');
    if(messages.some(message=>host.isSensitive(message.text))||host.isSensitive(item.name))throw new Error('客户消息含疑似敏感信息，请脱敏后再填单。');
    const text=messages.map(message=>message.text).join('\n');
    if(text.length>6000)throw new Error('客户消息超过本地填单上限，请分段核对后处理，不会截断内容自动提交。');
    const sources={customer:{kind:'identity',note:'当前授权会话的服务对象，不根据昵称跨渠道合并。',ids:[]}};
    const unique=pattern=>[...new Set(messages.flatMap(message=>message.text.match(pattern)||[]).map(value=>value.toUpperCase()))];
    const products=unique(/\b(?:A1|B2|C2|C3)\b/gi);
    const versions=unique(/\bV\d+(?:\.\d+)+\b/gi);
    const productNames={A1:'座舱终端 A1',B2:'座舱终端 B2',C2:'影像模块 C2',C3:'C3'};
    const values={customer:item.name,product:products.length===1?productNames[products[0]]:'',version:versions.length===1?versions[0]:'',type:'',description:text,priority:'普通',department:''};
    const source=(key,pattern,missingNote,options)=>{
      sources[key]={kind:options.length>1?'conflict':options.length?'customer':'missing',note:options.length>1?'出现多个值：'+options.join('、')+'，需确认本次报修对象。':options.length?'客户明确提供。':missingNote,ids:messages.filter(message=>pattern.test(message.text)).map(message=>message.id)};
    };
    source('product',/\b(?:A1|B2|C2|C3)\b/i,'未识别到明确型号，不能沿用档案或助手猜测。',products);
    source('version',/\bV\d+(?:\.\d+)+\b/i,'客户未提供软件版本。',versions);
    sources.description={kind:'customer',note:'保留当前客户原话，不写入助手推测、内部备注或已确认根因。',ids:messages.map(message=>message.id)};
    if(/报修|维修|黑屏|故障|断连|没有反应|无法开机|花屏/.test(text))values.type='报修单';
    else if(/专家|技术支持|协助排查/.test(text))values.type='专家支持单';
    else if(/咨询|怎么|哪里|在哪|是否|能不能|更换|换机|退款|赔付/.test(text))values.type='咨询单';
    sources.type={kind:values.type?'rule':'missing',note:values.type?'TYPE-01 · 根据本次客户诉求匹配的单据类型（演示规则），可人工调整。':'尚无匹配的工单类型，请选择。',ids:[]};
    const matched=routing.filter(rule=>rule.pattern.test(text));
    if(matched.length===1)values.department=matched[0].department;
    sources.department={kind:matched.length===1?'rule':matched.length>1?'conflict':'missing',note:matched.length===1?matched[0].id+' · '+matched[0].note:matched.length>1?'命中多个分派方向：'+matched.map(rule=>rule.department).join('、')+'，请确认。':'没有匹配的分派规则，请指定受理部门。',ids:[]};
    if(/加急|紧急|尽快|起火|冒烟|人身安全/.test(text))values.priority='优先';
    sources.priority={kind:'rule',note:values.priority==='优先'?'PRIORITY-01 · 客户提及紧急处理或安全风险，标记优先。':'PRIORITY-01 · 未识别到加急条件，按普通优先级填写。',ids:[]};
    const missing=Object.keys(labels).filter(key=>!values[key]);
    const steps=[{name:'读取客户消息',result:messages.length+' 条客户消息；排除助手回复、内部备注和其他会话。'},{name:'提取型号、版本和描述',result:'型号 '+(values.product||'待确认')+'；软件版本 '+(values.version||'待确认')+'。'},{name:'匹配单据与分派规则',result:ruleVersion+' · '+(values.type||'类型待确认')+' / '+(values.department||'部门待确认')},{name:'检查必填项',result:missing.length?'待补充：'+missing.map(key=>labels[key]).join('、'):'7 项字段已填写，等待人工核对。'}];
    return {caseId:item.id,values,sources,messages,missing,steps,ruleVersion,sourceFingerprint:fingerprint(item),durationMs:performance.now()-started,modelCalled:false,externalWrite:false};
  }
  function prepare(item){
    const previous=store().drafts[item.id];
    const draft={...analyze(item),revision:(previous?.revision||0)+1,manual:{},created:new Date().toISOString(),submitted:false};
    draft.traceId=window.TraceHub.record({agent:'ticket',caseId:item.id,title:'工单填写助手自动填单',tool:'local.ticket.autofill',input:{messages:draft.messages,ruleVersion},output:{values:draft.values,sources:draft.sources,missing:draft.missing,steps:draft.steps,modelCalled:false,externalWrite:false},durationMs:draft.durationMs,status:draft.missing.length?'待人工':'按预期完成',summary:'读取客户消息并按本地演示规则填写工单；缺项或冲突保留待确认，未调用模型，未创建或提交工单。'});
    if(previous)store().history.push(structuredClone(previous));
    store().drafts[item.id]=draft;host.persist();return draft;
  }
  function open(caseId){
    try{
      const item=allowed(caseId);
      const ticket=host.getState().tickets.find(entry=>entry.caseId===caseId);
      if(ticket)return host.openTicket(ticket.id);
      activeCase=caseId;
      const draft=store().drafts[caseId]||prepare(item);
      editing=new Set(Object.keys(labels).filter(key=>!draft.values[key]));
      show();
    }catch(error){host.toast(error.message,true);}
  }
  function evidence(key,draft){
    const origin=draft.sources[key];
    const manual=draft.manual[key];
    const title=manual?'人工已调整':origin.kind==='rule'?'演示规则':origin.kind==='identity'?'会话信息':origin.kind==='conflict'?'存在冲突':origin.ids.length?'客户原话 '+origin.ids.join('、'):'待补充';
    return `<details class="ticket-fill-source"><summary>${escape(title)}</summary><p>${escape(manual?'人工补充或更正；原始提取来源保留。':origin.note)}</p>${manual?'<p>原提取值：'+escape(manual.before||'空')+'</p>':''}${origin.ids.map(id=>`<blockquote><b>${id}</b> ${escape(draft.messages.find(message=>message.id===id)?.text||'')}</blockquote>`).join('')}</details>`;
  }
  function control(key,value){
    const attributes=`id="ticket-${key}" name="${key}" aria-label="${labels[key]}"`;
    if(choices[key])return `<select ${attributes}><option value="">请选择${labels[key]}</option>${choices[key].map(option=>`<option ${option===value?'selected':''}>${option}</option>`).join('')}</select>`;
    if(key==='description')return `<textarea ${attributes} maxlength="6000" rows="5">${escape(value)}</textarea>`;
    return `<input ${attributes} maxlength="${limits[key]||100}" value="${escape(value)}" placeholder="请核对后填写">`;
  }
  function show(){
    const draft=current();if(!draft)return;
    const item=host.getState().cases.find(entry=>entry.id===draft.caseId);
    const missing=Object.keys(labels).filter(key=>!draft.values[key]);
    const stale=fingerprint(item)!==draft.sourceFingerprint;
    const body=`<div class="ticket-fill-status">${window.HubIdentity.worker('ticket','md')}<div><strong>${missing.length?'还有 '+missing.length+' 项需要确认':'工单草稿已填好'}</strong><p>${7-missing.length} / 7 项已填写 · ${escape(draft.ruleVersion)} · 本地规则，未调用模型</p></div>${host.badge(stale?'来源已更新':missing.length?'待补充':'待核对',stale||missing.length?'amber':'green')}</div><div class="ticket-fill-context"><span>${escape(item.id)} · ${escape(item.name)} · ${escape(item.channelName)}</span>${action('重新读取对话','refresh')}</div>${stale?'<p class="ticket-fill-warning" role="alert">客户对话已更新。请重新读取并核对，旧草稿暂不能提交。</p>':''}${missing.length?`<section class="ticket-fill-missing"><strong>需要确认：${missing.map(key=>labels[key]).join('、')}</strong><p>未提供或存在冲突的字段不会猜填。</p>${missing.some(key=>['product','version'].includes(key))?action('把补充问题填入回复框','ask'):''}</section>`:''}<form id="ticket-form" novalidate><div class="ticket-fill-fields">${Object.entries(labels).map(([key,label])=>`<section class="ticket-fill-field ${key==='description'?'full':''} ${!draft.values[key]?'is-missing':''}" data-ticket-field="${key}"><header><label for="ticket-${key}">${label}</label>${key!=='customer'?action(editing.has(key)?'完成修改':'修改','edit',`data-key="${key}" aria-label="${editing.has(key)?'完成修改':'修改'}${label}"`):''}</header>${editing.has(key)&&key!=='customer'?control(key,draft.values[key]):`<div class="ticket-fill-value">${escape(draft.values[key]||'待确认')}</div><input type="hidden" id="ticket-${key}" name="${key}" value="${escape(draft.values[key])}">`}${evidence(key,draft)}</section>`).join('')}</div><label class="ticket-fill-consent"><input id="ticket-confirm" type="checkbox"><span>我已核对草稿，同意创建本地模拟工单。不写入真实 CRM / QMS，不代表退换件或赔付获批。</span></label><div id="form-error" class="inline-error" role="alert"></div></form><details class="ticket-fill-steps"><summary>自动填写记录 · ${draft.steps.length} 步</summary><ol>${draft.steps.map(step=>`<li><strong>${escape(step.name)}</strong><p>${escape(step.result)}</p></li>`).join('')}</ol><div>${host.button('查看执行追踪','trace-open','quiet small',`data-id="${draft.traceId}" data-owner="ticket"`)}${action('查看填单规则','rules')}</div></details>`;
    host.getView().modal={kind:'assistant-draft',id:draft.caseId};
    host.showDialog('工单填写助手','已读取客户对话并自动填写；有疑问的字段可修改。',body,`<span class="hint">草稿已保存在本机 · 尚未提交</span><div class="row">${host.button('暂存关闭','close-dialog')}${host.button('核对并创建工单','submit-ticket','primary',stale?'disabled':'')}</div>`,'wide ticket-fill-dialog');
  }
  function capture(form=document.getElementById('ticket-form')){
    const draft=current();if(!draft||!form||host.getView().modal?.id!==draft.caseId)return;
    for(const [key,value] of new FormData(form)){
      if(key==='customer'||!Object.hasOwn(limits,key))continue;
      const next=String(value).trim();
      if(host.isSensitive(next))throw new Error('字段中有疑似敏感信息，未保存修改，请先移除。');
      if(next.length>limits[key])throw new Error(labels[key]+'超过允许长度。');
      if(choices[key]&&next&&!choices[key].includes(next))throw new Error('请选择有效的'+labels[key]+'。');
    }
    for(const [key,value] of new FormData(form)){
      if(key==='customer'||!Object.hasOwn(limits,key))continue;
      const next=String(value).trim();
      if(draft.values[key]!==next){draft.manual[key]={before:draft.manual[key]?.before??draft.values[key],time:new Date().toISOString()};draft.values[key]=next;const confirm=document.getElementById('ticket-confirm');if(confirm)confirm.checked=false;}
    }
    draft.missing=Object.keys(labels).filter(key=>!draft.values[key]);host.persist();
  }
  function error(message){const box=document.getElementById('form-error');if(box)box.textContent=message;else host.toast(message,true);}
  function submit(){
    try{
      const form=document.getElementById('ticket-form');if(!form||host.getView().modal?.kind!=='assistant-draft')return;
      const draft=current();if(!draft)return;
      const item=allowed(draft.caseId);
      const existing=host.getState().tickets.find(entry=>entry.caseId===item.id);if(existing)return host.openTicket(existing.id);
      capture(form);
      if(fingerprint(item)!==draft.sourceFingerprint)return error('客户对话已更新，请重新读取并核对后提交。');
      if(draft.missing.length){draft.missing.forEach(key=>editing.add(key));show();return error('请补充或确认：'+draft.missing.map(key=>labels[key]).join('、')+'。');}
      if(!document.getElementById('ticket-confirm').checked)return error('请勾选确认，核对后才创建工单。');
      const identifier='DEMO-'+String(Math.max(22,...host.getState().tickets.map(ticket=>Number(ticket.id.replace('DEMO-',''))||0))+1).padStart(4,'0');
      const ticket={...draft.values,id:identifier,caseId:item.id,title:draft.values.product+' '+draft.values.type,status:'已创建',created:new Date().toLocaleString('zh-CN',{hour12:false}),notified:false,preparedBy:'ticket',fillRuleVersion:ruleVersion,prepareTraceId:draft.traceId};
      ticket.traceId=window.TraceHub.record({agent:'ticket',caseId:item.id,title:'确认助手填写的工单',tool:'local.ticket.create',input:{values:draft.values,sources:draft.sources,manualChanges:draft.manual,prepareTraceId:draft.traceId,ruleVersion},output:{id:identifier,status:ticket.status,confirmed:true,externalWrite:false,modelCalled:false},summary:'坐席核对自动填写内容及人工修改后创建本地模拟工单。保留填单来源与执行记录，不写入真实业务系统，不自动回告或结案。'});
      host.getState().tickets.unshift(ticket);draft.submitted=true;draft.ticketId=identifier;draft.submitTraceId=ticket.traceId;
      item.owner='human';item.status='等待业务系统';
      host.addMessage(item,'system','工单 '+identifier+' 由工单填写助手整理，客服确认创建 · 本地模拟');
      host.audit('确认助手填单并创建工单 '+identifier,item.id);host.persist();host.render();host.openTicket(identifier);host.toast('模拟工单已创建，未写入外部系统。');
    }catch(failure){error(failure.message);}
  }
  function rules(){
    host.showDialog('填单规则 · '+ruleVersion,'当前为本地演示规则，并非企业正式分派制度。',`<div class="ticket-fill-rules"><h3>信息来源</h3><p>只从本次客户消息提取已识别的型号、版本和问题原话。多个型号或版本并存时交由坐席确认，助手回复和内部备注不参与提取。</p><h3>受理部门</h3>${routing.map(rule=>`<p><strong>${rule.id} · ${rule.department}</strong><br>${rule.note}</p>`).join('')}<p>未命中或同时命中多个方向时，不自动选部门。</p><h3>提交边界</h3><p>这里只自动准备草稿。必填项完整且坐席确认后才创建模拟工单；真实 CRM / QMS 接口、生产路由和模型业务调用尚未接入。</p></div>`,action('返回草稿','back','','primary'));
  }
  function dispatch(name,element){
    try{
      if(name==='back')return show();
      if(name==='edit'){capture();const key=element.dataset.key;if(!Object.hasOwn(limits,key))return;if(editing.has(key))editing.delete(key);else editing.add(key);show();document.getElementById('ticket-'+key)?.focus();return;}
      if(name==='rules'){capture();return rules();}
      if(name==='refresh'){
        capture();
        return host.showDialog('重新读取客户对话','会重新提取并替换当前草稿，原稿与人工修改仍保留在历史记录中。','<p class="ticket-fill-refresh-note">重新填写后需要再次核对，之前的提交确认不会沿用。</p>',action('保留当前草稿','back')+action('确认重新填写','refresh-confirm','','primary'));
      }
      if(name==='refresh-confirm'){const item=allowed(activeCase);prepare(item);editing=new Set(current().missing);return show();}
      if(name==='ask'){
        capture();const item=allowed(activeCase);const draft=current();const requested=draft.missing.filter(key=>['product','version'].includes(key)).map(key=>labels[key]);
        if(!requested.length)return error('目前没有需要向客户补充的型号或版本。');
        host.getView().caseId=item.id;host.getView().composer='reply';host.navigate('workspace');
        window.SeatAssist.externalInsert('麻烦确认一下本次报修设备的'+requested.join('和')+'，方便补齐工单。','工单填写助手 · 补充信息草稿，未发送');
      }
    }catch(failure){error(failure.message);}
  }
  function configure(adapter){
    host=adapter;
    document.addEventListener('click',event=>{const button=event.target.closest('[data-action^="ticket-assistant-"]');if(button)dispatch(button.dataset.action.slice(17),button);});
    document.addEventListener('input',event=>{if(event.target.closest('#ticket-form')&&event.target.name){try{capture();error('');}catch(failure){error(failure.message);}}});
    document.addEventListener('change',event=>{if(event.target.closest('#ticket-form')&&event.target.name){try{capture();error('');}catch(failure){error(failure.message);}}});
    document.addEventListener('submit',event=>{if(event.target.id==='ticket-form'){event.preventDefault();submit();}});
  }
  return {configure,open,submit,analyze,fingerprint};
})();

window.BusinessDesk=(()=>{
  let host;
  let preview=null;
  let formCase='CS-0108';
  let system='CRM';
  let mapping=null;
  let scoreCase='CS-0104';
  let speaker='all';
  let scoreResult=null;
  const rubric=[['accuracy','事实与知识依据',30,'说法有来源，型号版本适用；不编造进度和结果。'],['compliance','承诺与操作规范',25,'无未审批承诺、危险操作或不必要的信息收集。'],['completeness','需求理解与信息完整',20,'识别客户问题，核对必要字段，不反复询问已提供的信息。'],['communication','表达与服务态度',15,'清楚、尊重、可执行，无推诿或生硬重复。'],['closure','交接与服务闭环',10,'说明下一步；需人工时及时交接，不把未回复当作解决。']];
  const escape=value=>host.escape(value);
  const action=(label,name,attributes='',tone='quiet small')=>host.button(label,'desk-'+name,tone,attributes);
  const get=()=>host.getState().businessDesk||(host.getState().businessDesk={reception:[],forms:[],scores:[],rubrics:[{version:'QC-1',weights:rubric.map(entry=>entry[2])}]});
  const currentRubric=()=>get().rubrics.at(-1);
  const cases=()=>host.getState().cases.filter(item=>item.owner!=='readonly');
  const caseOptions=selected=>cases().map(item=>`<option value="${item.id}" ${selected===item.id?'selected':''}>${escape(item.id+' · '+item.title)}</option>`).join('');
  const intro=(title,description,actions='')=>`<header class="desk-intro"><div><h2>${title}</h2><p>${description}</p></div><div>${actions}</div></header>`;
  function reception(){
    const records=get().reception;const handed=records.filter(record=>record.handoff).length;
    return `<div class="business-desk">${intro('接待测试','测试常见问题的回复和转人工规则，不向客户发送。',host.button('打开客服收件箱','navigate','primary small','data-page="workspace"'))}<div class="desk-summary"><div><span>本地试接待</span><strong>${records.length}<small>次</small></strong></div><div><span>建议继续自助</span><strong>${records.length-handed}<small>次</small></strong></div><div><span>建议转人工</span><strong>${handed}<small>次</small></strong></div><div><span>试接待转人工占比</span><strong>${records.length?(handed/records.length*100).toFixed(1)+'%':'—'}</strong></div></div><p class="desk-note">仅统计本页测试，不计入线上转人工率。解决结果仍需客户确认，并核对重复咨询。</p><div class="desk-columns"><section class="desk-panel"><h3>客户问题</h3><div class="desk-examples">${[['在哪里查看设备的软件版本？','查询版本'],['我想找人工客服','主动找人工'],['能保证免费更换吗？','承诺风险']].map(([value,label])=>action(label,'service-example',`data-value="${escape(value)}"`)).join('')}</div><label>产品范围<select id="desk-product"><option>座舱终端 A1</option><option>座舱终端 B2</option></select></label><label>客户消息<textarea id="desk-question" rows="3" maxlength="800" placeholder="例如：在哪里查看设备的软件版本？"></textarea></label>${action('试接待，不发送','service-run','','primary')}${preview?`<div class="desk-result"><strong>${preview.handoff?'建议转人工':'可继续由接待助手处理'}</strong><p>${escape(preview.text)}</p><small>依据：${escape(preview.source||preview.reason)}</small><p>${preview.handoff?'交接资料：问题摘要、已尝试的步骤和待补充信息。':'仅为回复建议；本次试接待没有客户后续确认，不能算作已解决。'}</p>${host.button('查看执行记录','trace-open','small',`data-id="${preview.traceId}" data-owner="service"`)}</div>`:''}</section><aside class="desk-panel"><h3>接待边界</h3><ul class="desk-rules"><li><strong>自动接待范围</strong><p>知识已发布且适用，才提供处理步骤；缺字段先追问。</p></li><li><strong>转人工条件</strong><p>主动要求人工、反复处理无效、投诉升级、风险承诺或未知问题，应及时转人工。</p></li><li><strong>未解决问题</strong><p>从未解决咨询登记缺口，审核后再更新接待知识。</p></li></ul><h3>上线后需跟踪的指标</h3><p>转人工率、人工承接成功率、确认解决率、重复进线率、客户满意度。下降的转人工率不一定代表体验变好。</p>${host.button('维护接待知识','navigate','small','data-page="knowledge"')}${host.button('查看运营指标','navigate','quiet small','data-page="analytics"')}</aside></div></div>`;
  }
  function sourceFields(item){
    const messages=item.messages.map((message,index)=>({...message,id:'M'+String(index+1).padStart(2,'0')})).filter(message=>message.role==='customer');
    const product=messages.find(message=>message.text.includes('A1')||message.text.includes('B2')||message.text.includes('C3'));
    const version=messages.find(message=>/V\d+\.\d+\.\d+/i.test(message.text));
    return [{key:'source_case_id',label:'来源会话',value:item.id,source:'当前授权会话标识',required:true},{key:'product_model',label:'产品型号',value:product?.text.match(/A1|B2|C3/)?.[0]||'',source:product?.id||'客户未明确提供',required:true},{key:'software_version',label:'软件版本',value:version?.text.match(/V\d+\.\d+\.\d+/i)?.[0]||'',source:version?.id||'客户未明确提供',required:true},{key:system==='CRM'?'service_description':'defect_description',label:system==='CRM'?'服务请求描述':'缺陷现象',value:messages.map(message=>message.text).join('\n'),source:messages.map(message=>message.id).join('、'),required:true},{key:system==='CRM'?'service_team':'quality_owner',label:system==='CRM'?'受理团队':'质量责任组',value:'',source:'由操作人选择，不猜测部门',required:true},...(system==='QMS'?[{key:'batch_number',label:'批次号',value:'',source:'客户未提供，不使用型号代替',required:true}]:[])];
  }
  function forms(){
    const item=cases().find(entry=>entry.id===formCase)||cases()[0];formCase=item.id;
    return `<div class="business-desk">${intro('系统填单','从客户消息提取字段，核对来源和缺项后模拟提交。')}<div class="desk-system-tabs">${['CRM','QMS'].map(name=>action(`<strong>${name}</strong><span>${name==='CRM'?'客户服务请求单':'质量问题记录单'}</span>`,'system',`data-value="${name}" aria-pressed="${system===name}"`,system===name?'selected':'')).join('')}<span>接口未接入 · 本地填写演示</span></div><div class="desk-columns"><section class="desk-panel"><label>来源客户会话<select id="desk-form-case">${caseOptions(formCase)}</select></label><div class="desk-transcript">${item.messages.map((message,index)=>`<article><small>M${String(index+1).padStart(2,'0')} · ${message.role==='customer'?'客户':message.role==='human'?'坐席':message.role==='agent'?'接待助手':'系统'}</small><p>${escape(message.text)}</p></article>`).join('')}</div>${action('从客户消息提取字段','extract','','primary')}</section><section class="desk-panel"><h3>${system} / ${system==='CRM'?'服务请求单':'质量问题记录单'}</h3>${mapping?`<form id="desk-system-form"><div class="desk-mapping">${mapping.fields.map(field=>`<label><span>${field.label} <b>*</b><code>${field.key}</code></span>${field.key.endsWith('description')?`<textarea name="${field.key}" required maxlength="1200">${escape(field.value)}</textarea>`:`<input name="${field.key}" ${field.key==='source_case_id'?'readonly':''} required maxlength="180" value="${escape(field.value)}" placeholder="待确认">`}<small>来源：${escape(field.source)}</small></label>`).join('')}</div><label class="desk-consent"><input id="desk-form-consent" type="checkbox" required>我已核对字段。本次仅保存本地提交演示，不写入真实 CRM / QMS。</label><div class="desk-form-error" id="desk-form-error" role="alert"></div><button type="submit" class="button primary">确认并模拟提交</button></form>`:'<div class="desk-unfilled"><h3>尚未提取字段</h3><p>选择左侧会话，点击“从客户消息提取字段”。未提供的版本、批次和责任组会留空。</p></div>'}</section></div><section class="desk-panel desk-records"><h3>提交记录与回执</h3>${get().forms.map(record=>`<article><div><strong>${record.system} · ${record.id}</strong><p>${record.caseId} · ${record.version} · ${record.status}</p><small>幂等标识 ${record.system}:${record.caseId}；同一系统与会话不重复创建。</small></div>${host.button('查看字段与回执','trace-open','small',`data-id="${record.traceId}" data-owner="ticket"`)}</article>`).join('')||'<p>暂无提交记录。真实提交需接入授权接口，配置字段映射、权限和回执校验。</p>'}</section></div>`;
  }
  function conversation(){
    const item=cases().find(entry=>entry.id===scoreCase)||cases()[0];scoreCase=item.id;
    return {item,messages:item.messages.map((message,index)=>({...message,id:'M'+String(index+1).padStart(2,'0')}))};
  }
  function scoring(){
    const {item,messages}=conversation();const standard=currentRubric();
    const evaluated=messages.filter(message=>speaker==='all'?['agent','human'].includes(message.role):message.role===speaker);
    const flags=evaluated.map(message=>({message,risk:host.checkRisk(message.text)})).filter(entry=>entry.risk);
    return `<div class="business-desk">${intro('会话评分','核对客户与坐席的完整对话，按评分标准人工确认。规则提示仅供参考。',action('评分标准 · '+standard.version,'rubric','','small'))}<div class="desk-score-filters"><label>会话<select id="desk-score-case">${caseOptions(scoreCase)}</select></label><label>被评服务方<select id="desk-speaker"><option value="all" ${speaker==='all'?'selected':''}>所有服务方（含 AI）</option><option value="human" ${speaker==='human'?'selected':''}>仅人工坐席</option><option value="agent" ${speaker==='agent'?'selected':''}>仅接待助手</option></select></label><span>待评分 ${evaluated.length} 条服务消息</span></div><div class="desk-columns"><section class="desk-panel"><h3>完整上下文 · ${item.id}</h3><div class="desk-transcript">${messages.map(message=>`<article class="${evaluated.includes(message)?'is-evaluated':''}"><small>${message.id} · ${message.role==='customer'?'客户':message.role==='human'?'人工坐席':message.role==='agent'?'接待助手':'系统'} ${message.time||''}</small><p>${escape(message.text)}</p>${message.source?'<small>引用：'+escape(message.source)+'</small>':''}</article>`).join('')}</div><div class="desk-rule-flags"><strong>自动规则预检</strong>${flags.length?flags.map(entry=>`<p>${entry.message.id} · ${escape(entry.risk.type)}：${escape(entry.risk.reason)}</p>`).join(''):'<p>未命中规则风险，仍需逐项人工评分。</p>'}</div></section><section class="desk-panel"><h3>人工复核评分 · ${standard.version}</h3>${evaluated.length?`<form id="desk-score-form"><div class="desk-score-items">${rubric.map(([key,label,,description],index)=>`<div><label><strong>${label}</strong><span>${standard.weights[index]} 分</span><select name="${key}" required><option value="">待复核</option><option value="1">符合 · 全分</option><option value="0.5">部分符合 · 半分</option><option value="0">不符合 · 0分</option></select></label><p>${description}</p></div>`).join('')}</div><label>证据消息（至少选一条）<select name="evidence" multiple required size="3">${evaluated.map(message=>`<option value="${message.id}">${message.id} · ${escape(message.text.slice(0,32))}</option>`).join('')}</select></label><label>评分依据 / 扣分与整改建议<textarea name="note" required minlength="8" maxlength="800" rows="3" placeholder="引用具体话语说明扣分原因；全符合也需要说明核对依据。"></textarea></label><label class="desk-consent"><input type="checkbox" required>我已核对完整上下文、证据和服务方身份。</label><div id="desk-score-error" class="desk-form-error" role="alert"></div><button type="submit" class="button primary">确认评分并保存</button></form>`:'<div class="desk-unfilled"><h3>没有该服务方的消息</h3><p>当前没有可评分的消息。AI 回复不能计为人工坐席消息；可切换服务方，或在坐席回复后评分。</p></div>'}</section></div>${scoreResult?`<section class="desk-saved-score"><span>人工已复核 · ${escape(scoreResult.version)}</span><strong>${scoreResult.total}<small>/ 100</small></strong><p>${escape(scoreResult.note)}</p>${host.button('查看评分记录 / 登记问题案例','trace-open','small',`data-id="${scoreResult.traceId}" data-owner="quality"`)}</section>`:''}<section class="desk-panel desk-records"><h3>历史评分（含标准与对话快照）</h3>${get().scores.map(record=>`<article><div><strong>${record.caseId} · ${record.total} / 100</strong><p>${record.version} · ${record.speaker==='human'?'人工坐席':record.speaker==='agent'?'接待助手':'所有服务方'} · 证据 ${record.evidence.join('、')}</p></div>${host.button('查看本次评分','trace-open','small',`data-id="${record.traceId}" data-owner="quality"`)}</article>`).join('')||'<p>还没有已确认的会话评分。</p>'}</section></div>`;
  }
  function runService(){
    const input=document.getElementById('desk-question')?.value.trim();const product=document.getElementById('desk-product')?.value;
    if(!input)return host.toast('请先填写客户问题。',true);
    if(!host.getState().agents.find(agent=>agent.id==='service')?.enabled)return host.toast('售后接待助手已暂停。',true);
    if(host.checkRisk(input)?.sensitive)return host.toast('请移除敏感信息。',true);
    const result=host.serviceReply(input,{product});
    const reason=/人工|投诉/.test(input)?'客户主动求助 / 投诉升级':/更换|退款|赔付/.test(input)?'需要授权人员核实':'没有适用的已发布知识';
    const traceId=window.TraceHub.record({agent:'service',title:'售后接待试运行',tool:'local.serviceReply',input:{text:input,product},output:result,source:result.source||'',summary:'本地接待规则试运行；没有对外回复，也没有客户确认结果。'});
    preview={...result,handoff:!!result.handoff,reason,traceId};get().reception.unshift({...preview,time:new Date().toISOString()});get().reception=get().reception.slice(0,100);host.persist();host.render();
  }
  function extract(){
    if(!host.getState().agents.find(agent=>agent.id==='ticket')?.enabled)return host.toast('工单填写助手已暂停。',true);
    const item=cases().find(entry=>entry.id===formCase);if(!item)return;
    mapping={caseId:item.id,system,fields:sourceFields(item),version:system+'-FORM-1'};host.render();
  }
  function submitForm(form){
    if(!mapping||mapping.caseId!==formCase||mapping.system!==system||!form.reportValidity())return;
    if(!host.getState().agents.find(agent=>agent.id==='ticket')?.enabled)return host.toast('工单填写助手已暂停，不能提交。',true);
    const fields=Object.fromEntries(new FormData(form));
    if(fields.source_case_id!==formCase)return host.toast('来源会话不能被替换。',true);
    if(Object.values(fields).some(value=>!value.trim()||host.checkRisk(value)?.sensitive))return document.getElementById('desk-form-error').textContent='必填字段不能为空或包含敏感信息。';
    if(!document.getElementById('desk-form-consent').checked)return;
    if(get().forms.some(record=>record.caseId===formCase&&record.system===system))return document.getElementById('desk-form-error').textContent='本会话已在该系统创建演示记录，已阻止重复提交。';
    const record={id:system+'-DEMO-'+String(get().forms.length+1).padStart(3,'0'),caseId:formCase,system,version:mapping.version,fields,status:'模拟回执已确认 · 未写入外部系统',time:new Date().toISOString()};
    record.traceId=window.TraceHub.record({agent:'ticket',caseId:formCase,title:system+' 表单确认与模拟回执',tool:'local.form.submit',input:{fields,mappingVersion:mapping.version,sources:mapping.fields.map(field=>({key:field.key,source:field.source,extracted:field.value})),idempotencyKey:system+':'+formCase},output:{id:record.id,acknowledged:true,simulated:true,externalWrite:false},summary:'人工核对后的字段与提取来源分别保留；未调用真实 CRM / QMS 接口。'});
    get().forms.unshift(record);mapping=null;host.persist();host.render();host.toast('已保存本地表单与模拟回执，没有写入外部系统。');
  }
  function saveScore(form){
    if(!form.reportValidity())return;
    if(!host.getState().agents.find(agent=>agent.id==='quality')?.enabled)return host.toast('对话质检助手已暂停。',true);
    const input=new FormData(form);const note=String(input.get('note')).trim();
    if(note.length<8||host.checkRisk(note)?.sensitive)return document.getElementById('desk-score-error').textContent='请填写至少8字、不含敏感信息的复核依据。';
    const standard=currentRubric();const {item,messages}=conversation();const evidence=input.getAll('evidence');
    if(!evidence.length||evidence.some(identifier=>!messages.some(message=>message.id===identifier&&['agent','human'].includes(message.role)&&(speaker==='all'||message.role===speaker))))return host.toast('证据不属于当前被评服务方。',true);
    const scores=rubric.map(([key,label],index)=>({key,label,weight:standard.weights[index],value:Number(input.get(key))*standard.weights[index]}));
    const record={id:'SCORE-'+String(get().scores.length+1).padStart(3,'0'),caseId:item.id,speaker,version:standard.version,scores,total:scores.reduce((sum,entry)=>sum+entry.value,0),evidence,note,messages:structuredClone(messages),time:new Date().toISOString()};
    record.traceId=window.TraceHub.record({agent:'quality',caseId:item.id,title:'会话评分：'+record.total+' / 100',tool:'local.quality.score',input:{speaker,standard:structuredClone(standard),messages:record.messages},output:{scores,total:record.total,evidence,note,reviewedBy:'演示复核人',automatedScore:false},status:record.total<100?'待人工':'按预期完成',summary:'分数由人工逐项确认，按所选版本权重计算；保留对话、证据和扣分说明，不以规则未命中直接给满分。'});
    get().scores.unshift(record);scoreResult=record;host.persist();host.render();
  }
  function rubricDialog(){
    host.showDialog('对话评分标准','权重合计100分；修改生成新版本，不改写旧评分。',`<form id="desk-rubric-form" class="desk-rubric-form">${rubric.map(([key,label,,description],index)=>`<label><strong>${label}</strong><span>${description}</span><input type="number" name="${key}" min="1" max="100" step="1" required value="${currentRubric().weights[index]}"></label>`).join('')}<p>未命中自动规则不等于合规。涉及严重风险，应单独登记、复核，不能仅以总分抵消。</p><button type="submit" class="button primary">保存新标准版本</button></form>`,host.button('关闭','close-dialog'));
  }
  function configure(adapter){
    host=adapter;get();
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="desk-"]');if(!element)return;const name=element.dataset.action.slice(5);if(name==='service-example')document.getElementById('desk-question').value=element.dataset.value;else if(name==='service-run')runService();else if(name==='system'){system=element.dataset.value;mapping=null;host.render();}else if(name==='extract')extract();else if(name==='rubric')rubricDialog();});
    document.addEventListener('change',event=>{if(event.target.id==='desk-form-case'){formCase=event.target.value;mapping=null;host.render();}if(event.target.id==='desk-score-case'){scoreCase=event.target.value;scoreResult=null;host.render();}if(event.target.id==='desk-speaker'){speaker=event.target.value;scoreResult=null;host.render();}});
    document.addEventListener('submit',event=>{if(event.target.id==='desk-system-form'){event.preventDefault();submitForm(event.target);}if(event.target.id==='desk-score-form'){event.preventDefault();saveScore(event.target);}if(event.target.id==='desk-rubric-form'){event.preventDefault();const weights=rubric.map(([key])=>Number(new FormData(event.target).get(key)));if(weights.some(value=>!Number.isInteger(value)||value<1)||weights.reduce((sum,value)=>sum+value,0)!==100)return host.toast('各项必须为正整数，权重合计100分。',true);get().rubrics.push({version:'QC-'+(get().rubrics.length+1),weights});host.persist();host.closeDialog();host.render();host.toast('已保存新评分标准，旧评分与快照保持不变。');}});
  }
  return {configure,reception,forms,scoring,reset(){preview=null;mapping=null;scoreResult=null;}};
})();

window.ProjectHub=(()=>{
  let host;
  let groupDraft='';
  let caseId='CS-0108';
  let submitting=false;
  let mentionInput=null;
  let mentionIndex=0;
  let pendingMention=null;
  const groupId='GROUP-AFTERSALES';
  const names={manager:'项目助手',service:'售后接待助手',ticket:'工单填写助手',quality:'对话质检助手',analytics:'大盘助手'};
  const mentionAliases=new Map([['项目经理','manager'],['项目助手','manager']]);
  function syncMembers(){const roster=window.ProjectStudio.members();for(const key of Object.keys(names))delete names[key];for(const member of roster){names[member.id]=member.name;descriptions[member.id]=member.role;}}
  const descriptions={manager:'拆分目标、调度团队、汇总反馈',service:'核对方案，准备待审核回复',ticket:'整理工单字段，标出缺项',quality:'核对依据、承诺和风险',analytics:'查看项目指标、核对口径与异常'};
  const escape=value=>host.escape(value);
  const action=(text,name,extra='',tone='quiet small')=>host.button(text,'project-'+name,tone,extra);
  const get=()=>host.getState().projectCollab||(host.getState().projectCollab={projectId:'AFTERSALES',portfolioId:'CUSTOMER-SERVICE',sequence:0,messages:[],seen:{}});
  const engine=()=>window.ManagerHub.getEngine();
  const groupTasks=()=>engine().get().tasks.filter(task=>task.conversationId===groupId);
  const time=value=>new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  function message(author,text,taskId='',attachmentIds=[]){const entry={id:'group-'+(++get().sequence),author,text,taskId,attachmentIds,time:new Date().toISOString()};get().messages.push(entry);return entry;}
  function banner(){return window.PortfolioHub.legacyBanner();}
  function managerPage(){if(window.PortfolioHub.navProject()?.id!=='AFTERSALES')return window.ProjectStudio.chatPage('manager');return `<div class="project-shell">${window.ProjectStudio.contextBar()}${window.ManagerHub.page()}</div>`;}
  function groupWorkspace(){if(window.PortfolioHub.navProject()?.id!=='AFTERSALES')return window.ProjectStudio.chatPage('group');return `<div class="project-shell project-group-shell">${window.ProjectStudio.contextBar()}${groupPage()}</div>`;}
  function openGroup(){closeMention();if(host.getView().page==='group')repaint();else host.navigate('group');}
  function groupPage(){
    syncMembers();const tasks=groupTasks();
    return `<div class="group-layout"><section class="group-main"><header class="group-header"><div><h1>售后服务项目群</h1><p>你、${escape(names.manager)}与 ${Object.keys(names).length-1} 位业务助手 · 本地编排演示</p></div>${action('成员与分工','members')}</header><div class="group-stream" id="project-group-stream" data-manager-scroll>${get().messages.length?get().messages.map(entry=>`<article class="group-message ${entry.author==='operator'?'is-operator':''}">${entry.author==='operator'?window.HubIdentity.avatar({entityType:'staff',identityTone:'blue'},{size:'sm'}):window.HubIdentity.worker(entry.author,'sm')}<div><header><strong>${entry.author==='operator'?'你':escape(names[entry.author]||engine().names[entry.author]||entry.author)}</strong>${entry.author==='operator'?'':'<span>助手 · 模拟执行</span>'}<time>${time(entry.time)}</time></header><p>${highlight(entry.text)}</p>${window.HubMedia.messages(entry.attachmentIds)}${entry.taskId?action('查看 '+entry.taskId+' 进度','task',`data-id="${entry.taskId}"`):''}${entry.customTraceId?host.button('查看定制助手执行记录','studio-agent','quiet small',`data-id="${entry.author}" data-tab="traces"`):''}${entry.reportId?host.button('查看大盘分析','reporter-open','quiet small',`data-id="${entry.reportId}"`):''}</div></article>`).join(''):`<div class="group-empty">${window.HubIdentity.worker('manager','lg')}<h2>还没有群消息</h2><p>输入 @ 分配任务，或让项目助手安排。<br>接单、进度和待确认事项会在群内回复。</p>${action('@团队 处理一条报修','example','','primary small')}</div>`}</div><div class="group-compose-area"><form class="manager-compose group-compose" data-media-scope="group:${groupId}" aria-label="给项目群发消息">${window.HubMedia.tray('group:'+groupId)}<label class="sr-only" for="project-group-prompt">项目群指令，输入 @ 选择助手</label><textarea id="project-group-prompt" rows="3" maxlength="1200" placeholder="@助手名称，说明需要处理的事项…">${escape(groupDraft)}</textarea><div class="manager-compose-toolbar">${window.HubMedia.tools('group:'+groupId)}${action('@ 提及','mention','','quiet small')}<label class="group-case">关联会话<select id="project-group-case" aria-label="群任务关联客户会话">${host.getState().cases.filter(item=>item.owner!=='readonly').map(item=>`<option value="${item.id}" ${item.id===caseId?'selected':''}>${escape(item.id+' · '+item.name)}</option>`).join('')}</select></label>${action(host.icon('arrow-up','small'),'send','aria-label="发送到项目群" title="发送指令到本地项目群；不会发送给客户"','manager-send')}</div></form><p class="group-footnote">Enter 发送 · Shift + Enter 换行　｜　团队可见 · 对客回复与建单仍需确认</p></div></section><aside class="group-side"><div class="group-side-heading"><h2>团队任务</h2><span>${tasks.length} 项</span></div>${Object.entries(names).map(([identifier,name])=>{const current=tasks.flatMap(task=>task.steps.filter(step=>step.worker===identifier&&step.status==='执行中').map(step=>({task,step})));const waiting=tasks.flatMap(task=>task.steps.filter(step=>step.worker===identifier&&step.status==='待执行'&&['排队中','执行中'].includes(task.status)));return `<div class="group-worker">${window.HubIdentity.worker(identifier,'sm')}<div><strong>${name}</strong><small>${current.length?current[0].task.id+' · '+current[0].step.label:waiting.length?'等待前置步骤 · '+waiting.length+' 项':identifier==='analytics'&&window.DashboardAssistant.latestGroup()?'最近完成：'+escape(window.DashboardAssistant.latestGroup().title):'暂无执行中的步骤'}</small></div><i class="${current.length?'running':''}"></i></div>`;}).join('')}<h3>当前项目任务</h3>${tasks.slice(0,12).map(task=>`<button class="group-task" data-action="project-task" data-id="${task.id}"><span><b>${task.id}</b>${host.badge(task.status,/失败|暂停/.test(task.status)?'amber':'')}</span><strong>${escape(engine().kinds[task.kind])}</strong><small>${task.caseId} · ${task.steps.filter(step=>step.status==='已完成').length}/${task.steps.length} 步</small><progress value="${task.steps.filter(step=>step.status==='已完成').length}" max="${task.steps.length}" aria-label="${task.id}完成步骤"></progress></button>`).join('')||'<p class="group-side-empty">暂无群任务。发送指令后可查看进度。</p>'}<p class="group-side-note">案例、样本和版本在各助手的工作区管理。</p>${action('管理业务助手','assistants')}${window.ProjectStudio.data().tasks.length?'<h3>定制助手任务</h3>'+window.ProjectStudio.data().tasks.slice(-5).map(task=>`<div class="studio-task"><strong>${escape(task.assigneeName)}</strong><p>${escape(task.summary)}</p><small>${escape(task.status)}</small></div>`).join(''):''}</aside></div>`;
  }
  function highlight(value){let text=escape(value);for(const name of [...Object.values(names),...mentionAliases.keys()])text=text.replaceAll('@'+name,`<mark>@${name}</mark>`);return text;}
  function repaint(){if(!host||!['manager','group'].includes(host.getView().page))return;window.ManagerHub.repaint();}
  function engineChanged(){
    if(!host||submitting)return;
    let changed=false;
    for(const task of groupTasks()){
      const seen=get().seen[task.id]||0;
      for(const event of task.events.filter(entry=>entry.sequence>seen)){
        const speaker=names[event.actor]?event.actor:event.actor==='knowledge'?'service':'manager';
        if(event.type==='start')message(speaker,'收到，正在'+(event.text.match(/“([^”]+)”/)?.[1]||'执行当前步骤')+'。',task.id);
        if(['finish','failure','a2a-result','review'].includes(event.type))message(speaker,event.text,task.id);
        if(event.type==='finish'&&event.actor==='manager'){
          const result=task.steps.find(step=>step.id==='result')?.output;
          if(result)message('manager',(result.reply?'回复草稿：'+result.reply.text+'\n':'')+(result.draft?'工单草稿：'+(result.draft.existing?'已有工单 '+result.draft.ticketId:'待补齐 '+result.draft.missing.join('、'))+'\n':'')+'请人工核对，尚未对客户发送或建单。',task.id);
        }
        if(event.type==='state'&&/暂停|取消|等待人工核对/.test(event.text))message('manager',event.text,task.id);
        get().seen[task.id]=event.sequence;changed=true;
      }
    }
    if(changed)host.persist();
  }
  function sendGroup(text=groupDraft,scope='group:'+groupId){
    syncMembers();const value=text.trim();
    if(!value&&!window.HubMedia.has(scope))return host.toast('请填写指令或添加附件。',true);
    if(value.length>1200||host.isSensitive(value))return host.toast('请使用 1200 字以内、不含敏感信息的指令。',true);
    try{if(!window.HubMedia.has(scope)&&window.ProjectStudio.legacyCustom(value,(author,text,traceId)=>{const entry=message(author,text);if(traceId)entry.customTraceId=traceId;})){groupDraft='';host.persist();openGroup();return true;}}catch(error){host.toast(error.message,true);return;}
    const mentions=[...value.matchAll(/@([^\s，。；,;]+)/g)].map(match=>match[1]);
    const selected=[...new Set(mentions.map(name=>Object.keys(names).find(identifier=>names[identifier]===name)||mentionAliases.get(name)))];
    if(selected.some(identifier=>!identifier))return host.toast('有未加入本项目的助手，请从 @ 列表选择。',true);
    if(selected.some(identifier=>identifier!=='manager'&&(!window.ProjectStudio.allowed(identifier)||!host.getState().agents.find(agent=>agent.id===identifier)?.enabled)))return host.toast('被提及的助手已暂停，请启用后再分派。',true);
    if(/删除|退款|赔付|自动发送|立即发送|绕过/.test(value))return host.toast('本群只能准备和核对，不执行删除、退款或自动发送。',true);
    let attachmentIds=[];
    let created=[];
    try{
      if(selected.includes('analytics')||selected.every(identifier=>identifier==='manager')&&/P95|大盘|指标|统计|Top\s*5/i.test(value)){
        if(!window.ProjectStudio.allowed('analytics'))throw new Error('当前项目助手未获得大盘助手的调度授权。');
        if(selected.some(identifier=>!['manager','analytics'].includes(identifier)))throw new Error('大盘分析和业务处理需分开发送，请分别 @ 对应助手。');
        if(window.HubMedia.has(scope))throw new Error('大盘问数只读取项目固定样本，不解析附件；请先移除附件或另发一条说明。');
        const report=window.DashboardAssistant.analyze(value,{source:'项目协作群',period:'today',channel:'all'});
        message('operator',value);message('manager','@大盘助手 请核对本项目的统计范围与样本，给出依据，不修改业务记录。');message('analytics','收到，按所选历史样本核对；本次不使用关联客户会话。');
        const result=message('analytics',report.title+'\n'+report.entries.join('\n')+'\n'+report.disclaimer);result.reportId=report.id;
        groupDraft='';host.persist();openGroup();document.getElementById('project-group-stream')?.scrollTo({top:document.getElementById('project-group-stream').scrollHeight});return true;
      }
      if(window.HubMedia.has(scope))attachmentIds=window.HubMedia.commit(scope);
      if(!attachmentIds.length){
        const kind=selected.length===1&&selected[0]==='quality'?'review':selected.length===1&&selected[0]==='ticket'?'ticket':/查询.*工单|工单.*进度/.test(value)?'lookup':/处理|准备|报修|工单|质检|复核|核对|检查|接待/.test(value)?'service':null;
        if(!kind)throw new Error('请写明需要处理的目标，例如“@工单填写助手 整理报修资料”。');
        const identifiers=[...new Set(value.match(/CS-\d+/g)||[caseId])];
        submitting=true;created=engine().submit(identifiers,kind,value,{origin:'项目协作群',conversationId:groupId});submitting=false;
      }
      message('operator',value||'补充了附件','',attachmentIds);
      if(attachmentIds.length)message('manager','附件已加入本地项目群，尚未解析内容。请先补充文字描述，再安排助手处理。');
      for(const task of created){const workers=[...new Set(task.steps.map(step=>step.worker))].filter(identifier=>names[identifier]&&identifier!=='manager');message('manager',workers.map(identifier=>'@'+names[identifier]).join(' ')+' 请按分工处理 '+task.caseId+'。先准备结果，发送和建单留给人工确认。',task.id);}
      groupDraft='';engineChanged();host.persist();openGroup();const stream=document.getElementById('project-group-stream');if(stream)stream.scrollTop=stream.scrollHeight;return true;
    }catch(error){submitting=false;host.toast(error.message,true);}
  }
  function mentionOptions(){syncMembers();const match=mentionInput?.value.slice(0,mentionInput.selectionStart).match(/@([^\s@]*)$/);return match?Object.entries(names).filter(([identifier,name])=>name.includes(match[1])||[...mentionAliases].some(([alias,target])=>target===identifier&&alias.includes(match[1]))):[];}
  function closeMention(){document.getElementById('project-mentions')?.remove();mentionInput?.removeAttribute('aria-controls');mentionInput?.removeAttribute('aria-activedescendant');mentionInput?.setAttribute('aria-expanded','false');mentionInput=null;}
  function showMention(input){
    closeMention();mentionInput=input;mentionIndex=0;const options=mentionOptions();if(!options.length)return closeMention();
    const panel=document.createElement('div');panel.id='project-mentions';panel.className='project-mentions';panel.setAttribute('role','listbox');panel.setAttribute('aria-label','选择要提及的助手');panel.innerHTML=`<small>${input.id==='manager-prompt'?'提及后发送将转到项目群，需确认':'选择项目成员'}</small>${options.map(([identifier,name],index)=>`<button role="option" aria-selected="${index===0}" id="mention-${identifier}" data-action="project-mention-choice" data-id="${identifier}">${window.HubIdentity.worker(identifier,'sm')}<span><b>${name}</b><small>${descriptions[identifier]}</small></span></button>`).join('')}`;document.body.append(panel);
    input.setAttribute('aria-controls',panel.id);input.setAttribute('aria-expanded','true');input.setAttribute('aria-activedescendant','mention-'+options[0][0]);const bounds=input.getBoundingClientRect();const height=panel.getBoundingClientRect().height;panel.style.left=Math.max(10,Math.min(bounds.left,innerWidth-310))+'px';panel.style.top=Math.max(10,bounds.top-height-8)+'px';
  }
  function chooseMention(identifier){const input=mentionInput;if(!input||!names[identifier])return;const before=input.value.slice(0,input.selectionStart);const after=input.value.slice(input.selectionEnd);const value=before.replace(/@([^\s@]*)$/,'@'+names[identifier]+' ');input.value=value+after;input.dispatchEvent(new Event('input',{bubbles:true}));closeMention();input.focus();input.setSelectionRange(value.length,value.length);}
  function taskDialog(identifier){const task=engine().find(identifier);if(!task||task.conversationId!==groupId)return;host.showDialog(task.id+' · '+engine().kinds[task.kind],'项目群任务 · 本地执行步骤，不显示隐式思维。',`<p>${escape(task.goal)}</p><ol class="project-task-steps">${task.steps.map(step=>`<li><div><strong>${escape(step.label)}</strong>${host.badge(step.status)}</div><p>${escape(engine().names[step.worker])}${step.error?' · '+escape(step.error):''}</p>${step.traceId?host.button('查看执行记录','trace-open','small',`data-id="${step.traceId}"`):''}</li>`).join('')}</ol><p>预计完成时间：尚无稳定历史样本，暂不估算。依赖未完成、助手暂停或执行失败会保留为卡点。</p>`,action('关闭','close')+(['执行中','排队中'].includes(task.status)?action('暂停任务','pause',`data-id="${task.id}"`):task.status==='已暂停'?action('继续任务','resume',`data-id="${task.id}"`):task.status==='失败'?action('重试失败步骤','retry',`data-id="${task.id}"`):''));}
  function pmo(){window.PortfolioHub.openParent();}
  function assistantsPage(){if(window.PortfolioHub.navProject()?.id!=='AFTERSALES')return window.ProjectStudio.directory();return window.AssistantHub.directory()+window.ProjectStudio.directoryExtra();}
  function assistantHeader(identifier){return window.AssistantHub.header(identifier);}
  function assistantOverview(identifier){if(identifier==='manager')return '<section class="panel assistant-profile"><h2>项目协调职责</h2><p>负责拆分目标、依赖安排、风险汇总与结果整理，提交项目负责人（人工）确认。这里单独保留协调步骤产生的问题，不把问题归给业务助手。</p><p>项目助手的生产 Prompt 和模型版本尚未接入，本版只管理离线评测规则。</p></section>';const agent=host.getState().agents.find(entry=>entry.id===identifier);return `<section class="panel assistant-profile"><h2>职责与配置</h2><p>${agent.desc}</p><p>${identifier==='analytics'?'大盘助手负责运营问数和口径核对；不会修改原始指标、自动告警或替代工单与质检处理。':'业务台账与执行记录归本助手维护；对外发送和提交仍需要人工确认。'}</p><div>${host.button('配置运行策略','configure-agent','small',`data-id="${identifier}"`)}${host.button('独立模型连接','model-open','small',`data-id="${identifier}"`)}${host.button('试运行','test-agent','primary small',`data-id="${identifier}"`)}${host.button(agent.enabled?'暂停助手':'启用助手','toggle-agent','small',`data-id="${identifier}"`)}</div><h3>本助手的版本迭代</h3><p>从执行步骤登记问题，确认根因与预期，加入回归样本，对比候选规则，人工审核后发布到本助手的离线评测环境。历史版本和回退依据保留。</p><p>模型配置保存不代表业务版本已发布。本版未部署新的生产 Prompt、工具或模型。</p></section>`;}
  function configure(api){
    host=api;if(!get())host.getState().projectCollab={projectId:'AFTERSALES',portfolioId:'CUSTOMER-SERVICE',sequence:0,messages:[],seen:{}};
    document.addEventListener('click',event=>{
      const element=event.target.closest('[data-action^="project-"]');if(!element)return;event.preventDefault();const name=element.dataset.action.slice(8);const identifier=element.dataset.id;
      if(name==='view'){closeMention();host.navigate(element.dataset.value==='group'?'group':'manager');}
      if(name==='pmo')pmo();
      if(name==='close')host.closeDialog();
      if(name==='enter'){host.closeDialog();openGroup();}
      if(name==='members')host.showDialog('项目群成员','只显示本项目的成员，不自动加入其他部门助手。',Object.entries(names).map(([key,label])=>`<div class="group-member">${window.HubIdentity.worker(key,'md')}<div><h3>${label}</h3><p>${descriptions[key]}</p></div></div>`).join(''),action('关闭','close'));
      if(name==='example'){groupDraft='@项目助手 处理 CS-0108，准备报修资料和回复，先不要发送。';repaint();}
      if(name==='send')sendGroup();
      if(name==='mention'){const input=document.getElementById('project-group-prompt');input.value+='@';groupDraft=input.value;input.focus();showMention(input);}
      if(name==='mention-choice')chooseMention(identifier);
      if(name==='task')taskDialog(identifier);
      if(['pause','resume','retry'].includes(name)){try{engine()[name==='resume'?'start':name](identifier);taskDialog(identifier);}catch(error){host.toast(error.message,true);}}
      if(name==='assistants')window.TraceHub.setScope(null);
      if(name==='assistant')window.TraceHub.setScope(identifier,element.dataset.tab);
      if(name==='assistant-back')window.TraceHub.setScope(null);
      if(name==='confirm-mention'&&pendingMention){const pending=pendingMention;pendingMention=null;host.closeDialog();caseId=document.getElementById('manager-case')?.value||caseId;if(sendGroup(pending.text,pending.scope))window.ManagerHub.input('manager-prompt','');}
    });
    document.addEventListener('input',event=>{if(event.target.id==='project-group-prompt')groupDraft=event.target.value;if(['project-group-prompt','manager-prompt'].includes(event.target.id))showMention(event.target);});
    document.addEventListener('change',event=>{if(event.target.id==='project-group-case')caseId=event.target.value;});
    const requestGroup=()=>{const input=document.getElementById('manager-prompt');if(!input?.value.includes('@'))return false;if(host.isSensitive(input.value)){host.toast('请移除敏感信息。',true);return true;}pendingMention={text:input.value,scope:'dm:'+window.ManagerHub.currentThread()};host.showDialog('转到项目群协作','当前是与项目助手的单独对话。',`<p>这条指令提到了其他助手。确认后将发送到本项目群，所有项目成员可见，不会发送给客户。</p><p class="trace-evidence">${escape(input.value)}</p>`,action('保留在草稿','close')+action('确认发到项目群','confirm-mention','','primary small'));return true;};
    document.addEventListener('click',event=>{if(event.target.closest('[data-action="manager-send"]')&&requestGroup()){event.preventDefault();event.stopImmediatePropagation();}},true);
    document.addEventListener('keydown',event=>{
      if(mentionInput&&['ArrowDown','ArrowUp','Enter','Escape'].includes(event.key)&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')return closeMention();const options=mentionOptions();if(event.key==='Enter')return chooseMention(options[mentionIndex]?.[0]);mentionIndex=(mentionIndex+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;document.querySelectorAll('#project-mentions [role=option]').forEach((element,index)=>element.setAttribute('aria-selected',String(index===mentionIndex)));mentionInput.setAttribute('aria-activedescendant','mention-'+options[mentionIndex][0]);return;}
      if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){if(event.target.id==='project-group-prompt'){event.preventDefault();event.stopImmediatePropagation();sendGroup();}else if(event.target.id==='manager-prompt'&&requestGroup()){event.preventDefault();event.stopImmediatePropagation();}}
    },true);
    document.addEventListener('pointerdown',event=>{if(!event.target.closest('#project-mentions')&&!['project-group-prompt','manager-prompt'].includes(event.target.id))closeMention();});
    window.addEventListener('resize',closeMention);window.addEventListener('hashchange',closeMention);
    host.persist();
  }
  return {configure,setDraft(value){groupDraft=value;},closeMention,managerPage,groupWorkspace,repaint,engineChanged,openGroup,assistantsPage,assistantHeader,assistantOverview,reset(){groupDraft='';caseId='CS-0108';pendingMention=null;closeMention();delete host.getState().projectCollab;get();},openGroupTask(identifier){openGroup();taskDialog(identifier);}};
})();

window.AssistantHub=(()=>{
  let host;
  const ownership={reception:{agent:'service',label:'智能接待'},forms:{agent:'ticket',label:'系统填单'},scoring:{agent:'quality',label:'会话评分'},tickets:{agent:'ticket',label:'工单管理'},quality:{agent:'quality',label:'质检工作台'},knowledge:{agent:'service',label:'知识维护'},analytics:{agent:'analytics',label:'运营大盘'},dashboard:{agent:'analytics',label:'问数与简报'},graph:{agent:'analytics',label:'业务图谱'}};
  const business={service:[['reception','智能接待'],['workspace','客服收件箱'],['knowledge','知识维护']],ticket:[['forms','CRM / QMS 填单'],['tickets','工单记录']],quality:[['scoring','会话评分'],['quality','发送风险复核']],analytics:[['dashboard','问数与简报'],['analytics','运营大盘'],['graph','业务图谱']]};
  const lifecycle=[['overview','职责与配置'],['traces','执行追踪'],['badcases','问题案例'],['datasets','回归样本'],['releases','评测与版本']];
  const escape=value=>host.escape(value);
  const action=(label,name,attributes='',tone='')=>host.button(label,'assistant-'+name,tone,attributes);
  const agent=identifier=>host.getState().agents.find(entry=>entry.id===identifier)||{id:'manager',name:'项目助手',version:'DEMO-PM1',enabled:true,desc:'协调目标、分工与结果；审批由项目负责人完成。'};
  const ownerFor=page=>ownership[page]?.agent||null;
  function breadcrumb(page){const owner=ownerFor(page)||(page==='agents'?window.TraceHub.currentScope():null);return owner&&owner!=='project'?agent(owner).name+' / '+(ownership[page]?.label||lifecycle.find(([key])=>key===window.TraceHub.currentTab())?.[1]||'工作区'):'';}
  function header(identifier){const entry=agent(identifier);const workspace=window.TraceHub.workspaceData(identifier);return `<header class="assistant-workspace-head owned-assistant-head"><div class="owned-assistant-crumb">${action('全部业务助手','directory','','quiet small')}<span>／ ${escape(entry.name)}</span></div><div class="owned-assistant-identity">${window.HubIdentity.worker(identifier,'lg')}<span><small>售后服务项目 · 责任助手</small><h1>${escape(entry.name)}</h1></span><span class="owned-assistant-status">${host.badge(entry.enabled?'已启用':'已暂停',entry.enabled?'green':'amber')}<small>执行逻辑 ${escape(entry.version)}</small><small>离线评测 ${escape(workspace.active.version)}</small></span></div><details class="owned-role-details"><summary>职责说明</summary><p>${escape(entry.desc)}${identifier==='analytics'?' 当前读取固定模拟样本，尚未调用真实模型。':''}</p></details></header>`;}
  function tabs(identifier,selected){return `<nav class="trace-tabs owned-assistant-tabs" aria-label="${escape(agent(identifier).name)}工作区">${(business[identifier]||[['manager','项目对话']]).map(([page,label])=>action(label,'business',`data-page="${page}" aria-current="${selected===page?'page':'false'}"`,selected===page?'active':'')).join('')}<span class="owned-tabs-divider" aria-hidden="true"></span>${lifecycle.map(([key,label])=>host.button(label,'trace-tab',selected===key?'active':'',`data-value="${key}" data-owner="${identifier}" aria-current="${selected===key?'page':'false'}"`)).join('')}</nav>`;}
  function managed(page,content){const identifier=ownerFor(page);return `<section class="owned-assistant-page" data-owner="${identifier}">${header(identifier)}${tabs(identifier,page)}<div class="owned-assistant-business" data-business="${page}">${content.replaceAll('<h1>','<h2>').replaceAll('</h1>','</h2>')}</div></section>`;}
  function tally(identifier){const state=host.getState();if(identifier==='ticket')return [state.tickets.filter(item=>item.status!=='已完成').length,'张工单处理中'];if(identifier==='quality')return [state.reviews.filter(item=>item.status==='待复核').length,'条发送风险待复核'];if(identifier==='service')return [state.cases.filter(item=>item.owner==='ai'&&!['已解决','历史资料'].includes(item.status)).length,'条会话由助手接待'];return [state.dashboardAssistant?.records?.length||0,'份本地分析记录'];}
  function directory(){
    return `<section class="project-assistants owned-directory"><div class="assistant-directory-head"><div><span>客户服务部 ／ 售后服务项目</span><h1>业务助手</h1><p>从业务规则定义助手，在这里管理它们的工作与版本。</p></div>${host.button('进入项目群','project-enter','small')}</div>${window.ProjectStudio.orbitEntry()}<div class="owned-directory-section"><h2>已加入团队</h2><span>各自负责业务，统一协作</span></div><div class="owned-directory-grid">${host.getState().agents.map(entry=>{
      const workspace=window.TraceHub.workspaceData(entry.id);const pending=tally(entry.id);const pages=business[entry.id]||[];
      return `<article class="project-assistant-card owned-directory-card" data-assistant="${entry.id}"><div class="owned-directory-main"><div class="project-assistant-id">${window.HubIdentity.worker(entry.id,'md')}<div><h2>${escape(entry.name)}</h2><span>${host.badge(entry.enabled?'已启用':'已暂停',entry.enabled?'green':'amber')} ${escape(entry.version)}</span></div></div><p class="owned-card-description">${escape(entry.desc)}</p></div><div class="owned-directory-workspace"><div class="owned-business-links">${pages.map(([page,label],index)=>action(label+' '+host.icon('arrow-up-right','small'),'business',`data-page="${page}"`,index===0?'primary':'')).join('')}</div><div class="owned-card-work"><strong>${pending[0]}</strong><span>${pending[1]}</span></div></div><div class="owned-directory-controls"><div class="assistant-lifecycle-links">${[['traces','执行追踪',workspace.traces.length],['badcases','问题案例',workspace.badcases.length],['datasets','回归样本',workspace.samples.length],['releases','评测与版本',workspace.releases.length]].map(([tab,label,count])=>host.button(label+' <b>'+count+'</b>','project-assistant','small',`data-id="${entry.id}" data-tab="${tab}"`)).join('')}</div><footer>${host.button('模型连接','model-open','quiet small',`data-id="${entry.id}"`)}${host.button('职责与配置','project-assistant','quiet small',`data-id="${entry.id}" data-tab="overview"`)}</footer></div></article>`;
    }).join('')}</div><div class="owned-directory-note"><span>跨助手任务记录</span>${host.button('项目助手的执行记录','project-assistant','quiet small','data-id="manager" data-tab="traces"')}</div></section>`;
  }
  function dispatch(name,element){if(name==='directory')return window.TraceHub.setScope(null);if(name==='business'){const page=element.dataset.page;if(ownership[page]||['workspace','manager'].includes(page))host.navigate(page);}}
  return {ownerFor,header,tabs,managed,directory,breadcrumb,dispatch,configure(adapter){host=adapter;window.DashboardAssistant.configure(adapter);}};
})();

window.DashboardAssistant=(()=>{
  let host;let draft='';let ui={period:'today',channel:'all',record:null,error:''};
  const get=()=>host.getState().dashboardAssistant||(host.getState().dashboardAssistant={schema:1,records:[]});
  const escape=value=>host.escape(value);
  const action=(label,name,attributes='',tone='')=>host.button(label,'reporter-'+name,tone,attributes);
  const pct=value=>value===null?'—':value.toFixed(1)+'%';
  const ms=value=>value===null?'—':value>=60000?(value/60000).toFixed(1)+' 分钟':(value/1000).toFixed(2)+' 秒';
  const channels=()=>[{id:'all',name:'全部渠道'},...window.HubAnalyticsData.channels,{id:'archive',name:'授权历史存档 · 无统计样本'}];
  const capabilities=[['top','客户最常问的 Top 5 是什么？','问题数量与占比'],['latency','首 token P95 多少，哪里需要排查？','首响、超时与慢请求'],['service','首响达标率和满意度怎么样？','客服效率与服务质量'],['quality','回复复核正确率和样本量是多少？','正确数、样本量与区间']];
  function queryScope(text,options={}){
    const period=/最近.*7天|近.*七天|本周|一周|7\s*天|七天/.test(text)?'week':options.period||ui.period;
    if(/今天|今日|实时|昨天|上月|上周|本周|明天|最近|近\s*[一二三四五六七八九十\d]/.test(text))throw Error('当前没有实时或这些日期的数据。请用统计范围选择 11 月 7 日或 11 月 1—7 日的固定样本。');
    if(/\d{4}[-/.]\d|\d+\s*月|\d+\s*日|\d+\s*\/\s*\d+/.test(text))throw Error('请在统计范围中选择日期，避免把其他日期套进固定样本。');
    if(/退款|删除|赔付|发给客户|发给所有|自动发送|发布|改.*阈值|修改.*目标/.test(text))throw Error('大盘助手只读分析。修改目标请进入运营大盘，客户操作与版本发布仍由对应工作区确认。');
    const selected=channels().filter(channel=>channel.id!=='all'&&text.includes(channel.id==='wechat'?'微信':channel.name));
    if(selected.length>1)throw Error('当前一次分析一个渠道或全部渠道，请在筛选框选择范围后再提问。');
    return {period,channel:selected[0]?.id||options.channel||ui.channel};
  }
  function analyze(text,options={}){
    if(!host.getState().agents.find(entry=>entry.id==='analytics')?.enabled)throw Error('大盘助手已暂停。请在职责与配置中启用后再分析，历史报表仍可查看。');
    const query=String(text||'').replace(/@大盘助手/g,'').trim();
    if(!query||query.length>800||host.isSensitive(query))throw Error('请输入 800 字以内、不含客户隐私或凭证的问题。');
    if(get().records.length>=40)throw Error('本地最多保留 40 份分析，现有记录可继续查看；重置售后演示后可重新开始。');
    const scope=queryScope(query,options);const started=window.performance.now();
    const kind=/top\s*5|前五|最.*问|热门|高频|最多|排行/i.test(query)?'top':/p\s*\d+|token|延迟|慢|超时|耗时/i.test(query)?'latency':/正确率|准确率|复核|抽检|质检/.test(query)?'quality':/首响|满意|解决|转人工|aht|fcr|csat|sla/i.test(query)?'service':/简报|日报|概览|汇总|运营情况/.test(query)?'summary':null;
    if(!kind)throw Error('目前可查 Top 5、延迟与超时、客服效率、人工复核和运营简报。请明确要看的指标；这里尚未接入开放式模型问答。');
    const performance=window.HubPerformanceData.snapshot(scope,window.PerformanceHub.targets());
    const service=window.HubAnalyticsData.snapshot(scope.period,scope.channel);
    const topics=window.HubProblemData.snapshot({day:scope.period==='today'?'2026-11-07':'week',channel:scope.channel,domain:'all'});
    const entries=[];const facts=[];let destination='performance';let requestId=null;
    if(kind==='top'||kind==='summary'){
      entries.push(...topics.top.map((topic,index)=>`${index+1}. ${topic.title}：${topic.count} 件，占 ${pct(topic.share)}；${topic.pending} 件未确认解决。`));
      if(!topics.count)entries.push('这个范围没有有效问题样本，不能生成 Top 5。请调整统计范围或渠道。');
      facts.push({label:'有效服务问题',value:topics.count+' 件'},{label:'Top 5 覆盖',value:pct(topics.count?topics.topCount/topics.count*100:null)});destination='problems';
    }
    if(kind==='latency'||kind==='summary'){
      const total=performance.total;const threshold=window.PerformanceHub.targets();
      entries.push(`首 token P95 为 ${ms(total.metrics.ttftMs.p95)}，P50 ${ms(total.metrics.ttftMs.p50)}，P99 ${ms(total.metrics.ttftMs.p99)}；已返回首 token 样本 n=${total.metrics.ttftMs.n}。`, `端到端 P95 为 ${ms(total.metrics.endToEndMs.p95)}，仅统计成功请求 n=${total.metrics.endToEndMs.n}。超时 ${total.timeout} / ${total.terminal} 个有效终态请求（${pct(total.timeoutRate)}）；取消 ${total.cancelled} 个、处理中 ${total.running} 个单列。`, total.metrics.ttftMs.p95===null?'没有有效首 token 样本，无法判断是否达到目标。':`示例首 token 目标 ${ms(threshold.ttftMs)}，当前 P95 ${total.metrics.ttftMs.p95>threshold.ttftMs?'超过':'未超过'}该目标。这不是生产告警或行业标准。`);
      const slowest=performance.rows.filter(row=>row.endToEndMs!==null).sort((left,right)=>right.endToEndMs-left.endToEndMs)[0];
      if(slowest){const stage=slowest.stages.reduce((current,item)=>item.duration>current.duration?item:current,slowest.stages[0]);requestId=slowest.id;entries.push(`可先核对 ${slowest.id}：该成功样本端到端 ${ms(slowest.endToEndMs)}，最长阶段是“${stage.name}”（${ms(stage.duration)}）。这是单条排查线索，不代表已经找到整体根因。`);}
      facts.push({label:'首 token · P95',value:ms(total.metrics.ttftMs.p95)},{label:'请求超时率',value:pct(total.timeoutRate)});if(kind==='latency')destination='performance';
    }
    if(kind==='service'){
      const current=performance.service;const ratio=window.HubPerformanceData.rate;
      facts.push({label:'客户首响达标',value:pct(current.slaRate)},{label:'客户满意度',value:pct(ratio(current.satisfied,current.scored))});
      entries.push(`客户首响达标 ${current.met} / ${current.matured} 件（${pct(current.slaRate)}），仍未回复 ${current.unanswered} 件；未回复且已过目标的请求仍在分母里。`,`AI 首响 P95 ${ms(current.aiFrt.p95)}，人工首响 P95 ${ms(current.humanFrt.p95)}。首响包含排队、审核与回传，不能用模型 TTFT 替代。`,`满意度 ${current.satisfied} / ${current.scored} 份有效评价（${pct(ratio(current.satisfied,current.scored))}）；问卷响应率 ${current.scored} / ${current.invited} 次邀请（${pct(ratio(current.scored,current.invited))}）。`,`首次联系解决率（24h）${pct(ratio(current.fcr,current.observed))}，完整观察样本 ${current.observed} 件。${current.observed?'按问题去重，仍需核对解决证据。':'本日样本观察窗未成熟，不能报成 0% 或 100%。'}`);
    }
    if(kind==='quality'){
      facts.push({label:'人工复核正确率',value:pct(service.total.accuracy)},{label:'已复核适用答案',value:service.total.reviewed+' 条'});
      entries.push(`人工复核判为正确 ${service.total.correct} / ${service.total.reviewed} 条（${pct(service.total.accuracy)}）。未抽检答案不计入分母，也没有用点赞或模型自评代替。`,`95% Wilson 区间：${service.interval?service.interval.map(pct).join('—'):'无样本'}。`,`主要错误：${service.errors.map(item=>item.name+' '+item.count+' 条').join('；')}。先核对来源和版本，再交给质检助手复核。`);destination='quality';
    }
    const titles={top:'客户最关心的五个问题',latency:'延迟与异常排查',service:'客服效率与体验',quality:'人工复核结果',summary:'运营简报'};
    const record={id:'REPORT-'+crypto.randomUUID(),query,kind,title:titles[kind],scope,source:options.source||'大盘助手工作区',created:new Date().toISOString(),facts,entries,destination,requestId,disclaimer:'固定模拟样本 · 本地统计查询，未调用模型；不等于实际客户业绩。'};
    record.traceId=window.TraceHub.record({agent:'analytics',title:'大盘问数 · '+record.title,tool:'local.dashboard.query',input:{question:query,scope,snapshot:'2026-11-07',source:record.source},output:{facts,entries,destination,requestId},durationMs:window.performance.now()-started,summary:'按明确范围查询固定模拟样本并生成规则化说明。只读查询，不发送客户消息、不修改原始指标；不展示隐式思维。'});
    get().records.unshift(record);host.persist();return record;
  }
  function scopeFields(){return `<div class="reporter-scope"><label>统计范围<select id="reporter-period"><option value="today" ${ui.period==='today'?'selected':''}>2026.11.07 · 单日样本</option><option value="week" ${ui.period==='week'?'selected':''}>11.01—11.07 · 七天样本</option></select></label><label>渠道<select id="reporter-channel">${channels().map(channel=>`<option value="${channel.id}" ${ui.channel===channel.id?'selected':''}>${channel.name}</option>`).join('')}</select></label><span>售后服务项目<br>历史固定样本 · 非实时</span></div>`;}
  function reportView(record){return `<article class="reporter-answer"><div class="reporter-question"><span>你</span><p>${escape(record.query)}</p></div><div class="reporter-answer-heading">${window.HubIdentity.worker('analytics','sm')}<div><h3>${escape(record.title)}</h3><span>${record.scope.period==='today'?'2026.11.07':'2026.11.01—11.07'} · ${channels().find(channel=>channel.id===record.scope.channel)?.name||'全部渠道'} · ${escape(record.source)}</span></div></div><div class="reporter-facts">${record.facts.map(item=>`<div><span>${escape(item.label)}</span><strong>${escape(item.value)}</strong></div>`).join('')}</div><ol class="reporter-evidence">${record.entries.map(text=>`<li>${escape(text)}</li>`).join('')}</ol><div class="reporter-answer-actions">${action('查看同范围大盘','open-report',`data-id="${record.id}"`,'primary small')}${record.requestId?action('查看慢请求步骤','request',`data-id="${record.id}"`,'small'):''}${host.button('本次执行记录','trace-open','quiet small',`data-id="${record.traceId}" data-owner="analytics"`)}</div><p class="reporter-disclaimer">${record.disclaimer} 每次分析保留当时结果，不因后续目标或样本变化改写历史。</p></article>`;}
  function page(){const records=get().records;const selected=records.find(record=>record.id===ui.record)||(!ui.record?records[0]:null);return `<div class="reporter-page"><div class="reporter-layout"><section class="reporter-main"><div class="reporter-intro"><h2>指标查询</h2><p>查询问题排行、客服效率和延迟，结果附统计口径与来源。</p></div>${scopeFields()}<div class="reporter-examples">${capabilities.map(([key,label,note])=>action(`<strong>${label}</strong><span>${note}</span>`,'example',`data-value="${key}"`,'quiet')).join('')}</div><form id="reporter-form" class="reporter-composer"><label class="sr-only" for="reporter-prompt">向大盘助手提问</label><textarea id="reporter-prompt" rows="3" maxlength="800" placeholder="例如：首 token P95 多少，慢在哪里？">${escape(draft)}</textarea><div><span>只读分析 · 不自动改指标或发消息</span>${action('分析 '+host.icon('arrow-up','small'),'send','','primary')}</div></form><p id="reporter-error" role="alert" class="reporter-error">${escape(ui.error)}</p>${selected?reportView(selected):'<div class="reporter-empty">暂无查询结果。可点击常用问题，或在输入框提问。</div>'}</section><aside class="reporter-side"><div class="reporter-side-title"><h3>分析记录</h3><span>${records.length} / 40</span></div>${action('新查询','new','','quiet small')}${records.length?records.map(record=>`<button class="reporter-history ${record.id===selected?.id?'selected':''}" data-action="reporter-history" data-id="${record.id}"><strong>${escape(record.title)}</strong><span>${record.scope.period==='today'?'11.07':'11.01—11.07'} · ${channels().find(channel=>channel.id===record.scope.channel)?.name||'全部渠道'}</span><small>${escape(record.source)}</small></button>`).join(''):'<p>暂无分析记录。</p>'}<section class="reporter-boundary"><h3>查询说明</h3><p>统计异常可从执行记录登记问题；工单和回复风险分别由填写助手、质检助手处理。</p><p>当前按本地规则查询。模型连接可独立测试，测试通过不会切换分析方式。</p></section></aside></div></div>`;}
  function refresh(){const main=document.getElementById('main-content');const position=main?.scrollTop||0;host.render();const fresh=document.getElementById('main-content');if(fresh)fresh.scrollTop=position;}
  function selectRecord(record){Object.assign(ui,{record:record.id,period:record.scope.period,channel:record.scope.channel,error:''});}
  function run(text=draft){try{const record=analyze(text);draft='';selectRecord(record);refresh();document.querySelector('.reporter-answer')?.scrollIntoView({block:'start'});}catch(error){ui.error=error.message;const field=document.getElementById('reporter-error');if(field)field.textContent=ui.error;else host.toast(ui.error,true);}}
  function openReport(record,request=false){window.PerformanceHub.openScope(record.scope,request?record.requestId:null);window.ProblemInsights.openScope(record.scope);window.AnalyticsHub.openView(request?'performance':record.destination,record.scope);}
  function dispatch(name,element){if(name==='send')return run();if(name==='example'){const entry=capabilities.find(([key])=>key===element.dataset.value);if(entry)return run(entry[1]);}if(name==='new'){draft='';ui.record='new';ui.error='';refresh();return document.getElementById('reporter-prompt')?.focus();}const record=get().records.find(entry=>entry.id===element.dataset.id);if(!record)return;if(name==='open'){selectRecord(record);return host.navigate('dashboard');}if(name==='history'){selectRecord(record);return refresh();}if(name==='open-report'||name==='request')return openReport(record,name==='request');}
  return {configure(adapter){host=adapter;const record=get().records[0];if(record)selectRecord(record);},analyze,page,dispatch,input(value){draft=value;},change(identifier,value){if(identifier==='reporter-period'&&['today','week'].includes(value))ui.period=value;if(identifier==='reporter-channel'&&channels().some(channel=>channel.id===value))ui.channel=value;},reset(){draft='';ui={period:'today',channel:'all',record:null,error:''};},latestGroup(){return get().records.find(record=>record.source==='项目协作群');}};
})();

window.PortfolioHub=(()=>{
  const storageKey='servicehub_portfolios_v1';
  const routes=['portfolios','portfolio','project','portfolio-form'];
  const phases=['筹备中','试运行','日常运营'];
  const taskStates=['待办','处理中','待确认','阻塞','已完成'];
  const ui={section:'projects',query:'',department:'all',health:'all',projectTab:'overview',form:null,libraryTab:'all',group:'all',layout:'cards',sort:'updated'};
  let host;
  let data;
  let activeProjectId=null;
  const escape=value=>host.escape(value);
  const icon=name=>host.icon(name,'small');
  const action=(text,name,extra='',tone='')=>host.button(text,'portfolio-'+name,tone,extra);
  const isScope=page=>routes.includes(page);
  const isCollection=page=>['portfolios','portfolio'].includes(page)||page==='portfolio-form'&&!activeProjectId;
  const currentPortfolio=()=>data.portfolios.find(entry=>entry.id===data.selection.portfolio)||data.portfolios[0];
  const currentProject=()=>data.projects.find(entry=>entry.id===data.selection.project)||data.projects[0];
  const stamp=()=>new Date().toISOString();
  const dateLabel=value=>value?value.slice(5).replace('-',' / '):'未设置';
  const projectOf=identifier=>data.projects.find(entry=>entry.id===identifier);
  const portfolioOf=identifier=>data.portfolios.find(entry=>entry.id===identifier);
  const projectMembers=project=>window.ProjectStudio.members(project).map(member=>({...member,id:member.id==='manager'&&project.id!=='AFTERSALES'?'coordinator':member.id}));
  function seed(){
    const task=(id,title,assignee,status,due,detail='')=>({id,title,assignee,status,due,detail,updatedAt:'2026-11-08T02:00:00.000Z'});
    return {version:1,selection:{portfolio:'CUSTOMER-SERVICE',project:'AFTERSALES'},portfolios:[
      {id:'CUSTOMER-SERVICE',name:'客户服务项目集',owner:'客户体验负责人（示例）',goal:'贯通售前咨询、门店运营与售后服务，分别跟进各团队的交付与风险。',tone:'clay'},
      {id:'ENTERPRISE-OPS',name:'企业运营项目集',owner:'运营负责人（示例）',goal:'将内部服务需求按部门组织，先确认业务边界，再配置各项目的助手。',tone:'sage'}
    ],projects:[
      {id:'AFTERSALES',portfolioId:'CUSTOMER-SERVICE',name:'售后服务项目',department:'客户服务部',owner:'客服负责人（示例）',goal:'归集授权咨询，准备售后回复与工单，跟进对话质检和问题案例。',phase:'日常运营',due:'2026-11-12',milestone:'复核接待与质检规则',tone:'clay',assistants:[],tasks:[]},
      {id:'RETAIL',portfolioId:'CUSTOMER-SERVICE',name:'门店运营项目',department:'零售运营部',owner:'门店运营负责人（示例）',goal:'整理门店巡检反馈，跟进整改，维护门店常见问题。',phase:'试运行',due:'2026-11-10',milestone:'确认巡检字段与整改标准',tone:'sage',assistants:[{id:'retail-check',name:'巡检整理助手',role:'整理巡检记录并标出缺失字段。'},{id:'retail-follow',name:'整改跟进助手',role:'汇总整改待办，提醒负责人核对结果。'}],tasks:[task('RETAIL-01','确认门店巡检必填字段','retail-check','阻塞','2026-11-09','巡检表的新旧字段不一致，需运营负责人确认统一口径。'),task('RETAIL-02','整理本周整改清单','retail-follow','处理中','2026-11-10','按门店和负责人拆分待办，尚未接入自动执行。'),task('RETAIL-03','梳理巡检场景边界','coordinator','已完成','2026-11-07','已记录场景与人工审批范围；示例人工完成记录。')]},
      {id:'PRESALES',portfolioId:'CUSTOMER-SERVICE',name:'售前支持项目',department:'销售支持部',owner:'售前负责人（示例）',goal:'整理客户咨询与方案资料，在审核后提供业务回复。',phase:'筹备中',due:'2026-11-13',milestone:'完成首批问答审核',tone:'blue',assistants:[{id:'sales-knowledge',name:'方案资料助手',role:'整理资料适用范围与版本，回答前交由人工审核。'}],tasks:[task('SALES-01','审核方案资料的适用范围','sales-knowledge','待确认','2026-11-11','资料已整理，等待售前负责人审核。'),task('SALES-02','确认售前咨询接入范围','coordinator','待办','2026-11-13')]},
      {id:'PEOPLE',portfolioId:'ENTERPRISE-OPS',name:'员工服务项目',department:'人力资源部',owner:'人事服务负责人（示例）',goal:'梳理员工常见咨询和制度查找流程，不使用真实员工档案。',phase:'筹备中',due:'2026-11-16',milestone:'确认制度问答范围',tone:'blue',assistants:[{id:'people-policy',name:'制度查询助手',role:'检索经审核的制度资料；敏感个案转人工。'}],tasks:[task('PEOPLE-01','整理制度问答的授权边界','people-policy','待办','2026-11-12')]},
      {id:'IT-SERVICE',portfolioId:'ENTERPRISE-OPS',name:'IT 服务项目',department:'信息技术部',owner:'IT 服务负责人（示例）',goal:'分类内部报障，明确工单字段与人工处理流程。',phase:'试运行',due:'2026-11-14',milestone:'核对报障分类与优先级',tone:'amber',assistants:[{id:'it-triage',name:'报障分类助手',role:'分类报障并标记需要人工核实的信息。'}],tasks:[task('IT-01','核对报障分类规则','it-triage','处理中','2026-11-11'),task('IT-02','确认权限申请审批人','coordinator','已完成','2026-11-07','已整理审批职责；示例人工完成记录。')]}
    ],activity:[]};
  }
  function persist(){
    try{localStorage.setItem(storageKey,JSON.stringify(data));return true;}
    catch{host.toast('浏览器存储不可用，当前修改仅保留在本页。',true);return false;}
  }
  function record(text,projectId=''){const project=projectOf(projectId);if(project)project.updatedAt=stamp();data.activity.unshift({text,projectId,time:stamp()});data.activity=data.activity.slice(0,60);persist();}
  function projects(){return host.getView().page==='portfolios'?data.projects:data.projects.filter(project=>project.portfolioId===currentPortfolio().id);}
  function tasks(project){
    if(project.id!=='AFTERSALES')return [...project.tasks.map(task=>({...task,projectId:project.id,source:'管理台账 · 人工更新'})),...(project.workspace?.tasks||[]).map(task=>({...task,title:task.name,detail:task.summary,status:task.status==='待配置'?'待办':'待确认',projectId:project.id,source:'项目群本地协作',studio:true}))];
    return window.ManagerHub.getEngine().get().tasks.filter(task=>task.status!=='已取消').map(task=>({id:task.id,projectId:project.id,title:window.ManagerHub.getEngine().kinds[task.kind],status:['执行中','排队中'].includes(task.status)?'处理中':['失败','已暂停','需修正'].includes(task.status)?'阻塞':task.status==='待开始'?'待办':task.status,assignee:task.steps.find(step=>step.status==='执行中')?.worker||'manager',due:'',detail:task.steps.find(step=>step.error)?.error||task.status,source:'售后本地执行记录',live:true}));
  }
  function attention(project){
    const entries=tasks(project).filter(task=>['阻塞','待确认'].includes(task.status));
    if(project.id==='AFTERSALES')entries.push(...host.getState().reviews.filter(review=>review.status==='待复核').map(review=>({id:review.id,projectId:project.id,title:review.type,status:'待复核',assignee:'quality',detail:'请在售后项目核对原始对话与质检依据。',review:true,source:'售后质检记录'})));
    return entries;
  }
  function stats(entries){
    const all=entries.flatMap(tasks);
    return {projects:entries.length,departments:new Set(entries.map(entry=>entry.department)).size,active:all.filter(task=>['待办','处理中'].includes(task.status)).length,attention:entries.flatMap(attention).length,done:all.filter(task=>task.status==='已完成').length,total:all.length,assistants:entries.reduce((total,entry)=>total+projectMembers(entry).length,0)};
  }
  function badge(text){return `<span class="pmo-badge ${['阻塞','待复核','需关注'].includes(text)?'risk':['待确认','筹备中'].includes(text)?'pending':text==='已完成'?'done':''}"><i></i>${escape(text)}</span>`;}
  function symbol(project,small=false){return `<span class="pmo-project-symbol ${escape(project.tone||'sage')} ${small?'small':''}" aria-hidden="true">${icon(project.id==='AFTERSALES'?'headset':project.id==='RETAIL'?'building-store':project.id==='PEOPLE'?'users':project.id==='IT-SERVICE'?'device-desktop':'briefcase')}</span>`;}
  function scopeCrumb(project){const portfolio=portfolioOf(project.portfolioId);return `<div class="pmo-crumb">${action('项目集','return')}${icon('chevron-right')}${action(escape(portfolio.name),'open',`data-id="${portfolio.id}"`)}${icon('chevron-right')}<span>${escape(project.name)}</span></div>`;}
  function title(titleText,description,buttons='',eyebrow='项目工作空间'){return `<header class="pmo-page-head"><div><span class="pmo-eyebrow">${escape(eyebrow)}</span><h1>${escape(titleText)}</h1><p>${escape(description)}</p></div><div class="pmo-head-actions">${buttons}</div></header>`;}
  function metricStrip(entries){const values=stats(entries);return `<dl class="pmo-metrics">${[['部门项目',values.projects,values.departments+' 个部门'],['进行中与待办',values.active,'按项目台账汇总'],['待确认与风险',values.attention,'需要负责人跟进'],['项目与业务助手',values.assistants,'含未接入的职责草稿']].map(([label,value,note])=>`<div><dt>${label}</dt><dd>${value}</dd><small>${note}</small></div>`).join('')}</dl>`;}
  function navigation(){return `<div class="pmo-section-nav" role="tablist" aria-label="项目集管理视图">${[['projects','项目总览'],['attention','待办与风险'],['resources','团队与资源']].map(([value,label])=>`<button role="tab" aria-selected="${ui.section===value}" data-action="portfolio-section" data-value="${value}">${label}</button>`).join('')}<span>台账与本地执行记录 · 非生产业绩</span></div>`;}
  function filtered(entries){const query=ui.query.trim().toLowerCase();return entries.filter(project=>(ui.department==='all'||project.department===ui.department)&&(ui.health==='all'||(ui.health==='risk'?attention(project).length>0:project.phase==='筹备中'))&&(!query||[project.name,project.department,project.owner,project.goal].join(' ').toLowerCase().includes(query)));}
  function filterbar(entries){return `<div class="pmo-filterbar"><label class="pmo-search">${icon('search')}<input id="portfolio-search" aria-label="搜索项目、部门或负责人" placeholder="搜索项目、部门或负责人" value="${escape(ui.query)}"></label><label><span class="sr-only">筛选部门</span><select id="portfolio-department"><option value="all">全部部门</option>${[...new Set(entries.map(entry=>entry.department))].map(department=>`<option ${ui.department===department?'selected':''}>${escape(department)}</option>`).join('')}</select></label><label><span class="sr-only">筛选项目状态</span><select id="portfolio-health">${[['all','全部状态'],['risk','需要关注'],['planning','筹备中']].map(([value,label])=>`<option value="${value}" ${ui.health===value?'selected':''}>${label}</option>`).join('')}</select></label>${action(icon('refresh')+' 刷新','refresh','','quiet small')}</div>`;}
  function empty(text,button=''){return `<div class="pmo-empty">${icon('inbox')}<h3>${escape(text)}</h3>${button}</div>`;}
  function programCards(){return `<div class="pmo-program-list">${data.portfolios.map(portfolio=>{const entries=data.projects.filter(project=>project.portfolioId===portfolio.id);const count=stats(entries);return `<article class="pmo-program-card ${portfolio.tone}"><div class="pmo-program-top"><span class="pmo-folder-art" aria-hidden="true"><i></i><i></i><i></i></span><div><span>项目集</span><h2>${action(escape(portfolio.name),'open',`data-id="${portfolio.id}"`)}</h2></div>${badge(count.attention?count.attention+' 项待跟进':'暂无待跟进')}</div><p>${escape(portfolio.goal)}</p><div class="pmo-departments">${[...new Set(entries.map(entry=>entry.department))].map(department=>`<span>${escape(department)}</span>`).join('')||'<span>尚未添加部门项目</span>'}</div><footer><span>${icon('user')} ${escape(portfolio.owner)}<small>${count.projects} 个项目 · ${count.assistants} 位助手</small></span>${action('进入项目集 '+icon('arrow-right'),'open',`data-id="${portfolio.id}"`,'small')}</footer></article>`;}).join('')}</div>`;}
  function attentionList(entries,compact=false){const items=entries.flatMap(attention);return `<div class="pmo-attention-list">${(compact?items.slice(0,4):items).map(item=>{const project=projectOf(item.projectId);return `<article class="pmo-attention-item"><div class="pmo-attention-title">${badge(item.status)}<small>${escape(project.department)}</small></div><h3>${escape(item.title)}</h3><p>${escape(item.detail||'请进入项目确认处理情况。')}</p><footer><span>${escape(project.name)}${item.due?' · '+dateLabel(item.due):''}</span>${action('跟进 '+icon('arrow-up-right'),'task',`data-project="${project.id}" data-id="${item.id}"`,'quiet small')}</footer></article>`;}).join('')||empty('当前范围没有待确认或阻塞事项')}${compact&&items.length>4?action('查看全部 '+items.length+' 项','section','data-value="attention"','quiet small'):''}</div>`;}
  function projectTable(entries){return `<div class="pmo-project-table-wrap"><table class="pmo-project-table"><thead><tr><th>项目 / 部门</th><th>项目负责人</th><th>阶段与关注项</th><th>任务状态</th><th>下一里程碑</th><th><span class="sr-only">操作</span></th></tr></thead><tbody>${entries.map(project=>{const count=stats([project]);return `<tr data-project-row="${project.id}"><td><div class="pmo-project-name">${symbol(project,true)}<div>${action(escape(project.name),'project',`data-id="${project.id}"`,'quiet')}<small>${escape(project.department)} · ${project.id==='AFTERSALES'?'执行演示已接入':'独立管理空间'}</small></div></div></td><td>${escape(project.owner)}<small>人工负责人</small></td><td>${badge(project.phase)}${count.attention?`<small class="pmo-risk-text">${count.attention} 项需要关注</small>`:'<small>暂无待确认或阻塞</small>'}</td><td><strong>${count.done}<span> / ${count.total}</span></strong><progress aria-label="${escape(project.name)}已完成任务" value="${count.done}" max="${Math.max(1,count.total)}"></progress><small>${count.total?'已完成 / 台账任务':'尚未创建任务'}</small></td><td>${escape(project.milestone||'待设置')}<small>计划 ${dateLabel(project.due)}</small></td><td>${action('进入项目 '+icon('arrow-right'),'project',`data-id="${project.id}"`,'quiet small')}</td></tr>`;}).join('')}</tbody></table>${!entries.length?empty('没有符合条件的项目',action('清除筛选','clear','','small')):''}</div>`;}
  function resourceTable(entries){return `<section class="pmo-resource-list">${entries.map(project=>`<article><header>${symbol(project,true)}<div><h2>${escape(project.name)}</h2><p>${escape(project.department)} · ${escape(project.owner)}</p></div>${action('查看团队','team',`data-id="${project.id}"`,'quiet small')}</header><div>${projectMembers(project).map(member=>{const assigned=tasks(project).filter(task=>task.assignee===member.id&&task.status!=='已完成');return `<div class="pmo-resource-row"><span>${icon(member.id==='manager'||member.id==='coordinator'?'adjustments-horizontal':'users')}<strong>${escape(member.name)}</strong></span><span>${assigned.length} 项未完成任务</span><small>${project.id==='AFTERSALES'?(member.enabled===false?'助手已暂停':'本地执行演示'):'职责草稿 · 未接入模型'}</small></div>`;}).join('')}</div></article>`).join('')||empty('先创建一个部门项目')}</section>`;}
  function libraryProjectEntries(){
    const query=ui.query.trim().toLowerCase();
    return data.projects.filter(project=>(ui.libraryTab==='archived'?!!project.archivedAt:!project.archivedAt)&&(ui.libraryTab!=='favorites'||project.favorite)&&(ui.group==='all'||project.portfolioId===ui.group)&&(!query||[project.name,project.department,project.owner,project.goal].join(' ').toLowerCase().includes(query))).sort((left,right)=>ui.sort==='name'?left.name.localeCompare(right.name,'zh-CN'):String(right[ui.sort==='recent'?'lastOpenedAt':'updatedAt']||'').localeCompare(String(left[ui.sort==='recent'?'lastOpenedAt':'updatedAt']||'')));
  }
  function projectDate(project){const value=ui.sort==='recent'?project.lastOpenedAt:project.updatedAt;return value?(ui.sort==='recent'?'上次打开 ':'更新于 ')+new Date(value).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}):ui.sort==='recent'?'尚未打开':'尚无修改记录';}
  function favoriteButton(project){return action(icon('star'),'favorite',`data-id="${project.id}" aria-label="${project.favorite?'取消收藏':'收藏'}${escape(project.name)}" aria-pressed="${!!project.favorite}" title="${project.favorite?'取消收藏':'收藏项目，方便下次找到'}"`,'library-icon-button '+(project.favorite?'is-favorite':''));}
  function libraryCard(project){
    const members=projectMembers(project);const openTasks=tasks(project).filter(task=>task.status!=='已完成').length;
    return `<article class="library-card" data-project-card="${project.id}"><div class="library-card-top">${symbol(project)}<div class="library-card-actions">${favoriteButton(project)}${action(icon('dots'),'menu',`data-id="${project.id}" aria-label="管理${escape(project.name)}" title="重命名、移动分组或归档项目"`,'library-icon-button')}</div></div><button class="library-card-open" data-action="portfolio-enter" data-id="${project.id}"><span class="library-group-label">${escape(portfolioOf(project.portfolioId)?.name||'未分组')}</span><h2>${escape(project.name)}</h2><p>${escape(project.goal||'还没有项目说明，进入后补充业务范围。')}</p></button><div class="library-card-status">${badge(project.archivedAt?'已归档':project.phase)}<span>${project.id==='AFTERSALES'?'售后协作演示':'独立项目助手与团队'}</span></div><footer><span class="library-team">${icon('users')}${members.length} 位助手${openTasks?' · '+openTasks+' 项待办':''}</span><span>${escape(projectDate(project))}</span></footer></article>`;
  }
  function libraryList(entries){return `<div class="library-list" role="list"><div class="library-list-labels"><span>项目</span><span>分组 / 团队</span><span>状态</span><span>最近操作</span><span></span></div>${entries.map(project=>`<article role="listitem" class="library-list-row" data-project-card="${project.id}"><button class="library-list-open" data-action="portfolio-enter" data-id="${project.id}">${symbol(project,true)}<span><strong>${escape(project.name)}</strong><small>${escape(project.goal||'暂无项目说明')}</small></span></button><div class="library-list-group">${escape(portfolioOf(project.portfolioId)?.name||'未分组')}<small>${escape(project.department)}</small></div><div>${badge(project.archivedAt?'已归档':project.phase)}</div><small>${escape(projectDate(project))}</small><div class="library-list-actions">${favoriteButton(project)}${action(icon('dots'),'menu',`data-id="${project.id}" aria-label="管理${escape(project.name)}"`,'library-icon-button')}</div></article>`).join('')}</div>`;}
  function overview(){
    const shown=libraryProjectEntries();const active=data.projects.filter(project=>!project.archivedAt);const archived=data.projects.filter(project=>project.archivedAt);
    return `<section class="project-library"><header class="library-heading"><div><span class="library-eyebrow">连山工作空间 ／ 选择项目</span><h1>项目集</h1><p>先选择业务项目，再进入它的助手、协作群与工作区。</p></div>${action('新建项目','new','data-kind="project"','primary')}</header><div class="library-toolbar"><div class="library-tabs" role="tablist" aria-label="选择项目范围">${[['all','全部项目',active.length],['favorites','已收藏',active.filter(project=>project.favorite).length],['archived','已归档',archived.length]].map(([key,label,count])=>`<button role="tab" aria-selected="${ui.libraryTab===key}" data-action="portfolio-library-tab" data-value="${key}">${label}<span>${count}</span></button>`).join('')}</div><label class="library-search">${icon('search')}<input id="portfolio-search" aria-label="搜索项目" placeholder="搜索项目名称或说明" value="${escape(ui.query)}"></label></div><div class="library-filter-row"><div class="library-groups" aria-label="按项目集查找">${action('全部项目集','library-group','data-value="all" aria-pressed="'+(ui.group==='all')+'"',ui.group==='all'?'selected':'')}${data.portfolios.map(group=>action(escape(group.name),'library-group',`data-value="${group.id}" aria-pressed="${ui.group===group.id}"`,ui.group===group.id?'selected':'')).join('')}${action(icon('adjustments-horizontal'),'groups','aria-label="管理项目集" title="整理项目所属的项目集，不改变项目内的数据"','library-icon-button')}</div><div class="library-view-tools"><label><span class="sr-only">项目排序</span><select id="library-sort">${[['updated','最近更新'],['recent','最近打开'],['name','名称排序']].map(([key,label])=>`<option value="${key}" ${ui.sort===key?'selected':''}>${label}</option>`).join('')}</select></label><div role="group" aria-label="项目显示方式">${[['cards','layout-grid','卡片视图'],['list','list','列表视图']].map(([key,symbol,label])=>action(icon(symbol),'library-layout',`data-value="${key}" aria-label="${label}" aria-pressed="${ui.layout===key}" title="${label}"`,'library-icon-button '+(ui.layout===key?'selected':''))).join('')}</div></div></div>${shown.length?ui.layout==='cards'?`<div class="library-grid">${shown.map(libraryCard).join('')}</div>`:libraryList(shown):`<div class="library-empty">${icon(ui.libraryTab==='favorites'?'star':ui.libraryTab==='archived'?'archive':'folder')}<h2>${ui.query||ui.group!=='all'?'没有找到匹配的项目':ui.libraryTab==='favorites'?'把常用项目收藏在这里':ui.libraryTab==='archived'?'还没有归档项目':'创建你的第一个项目'}</h2><p>${ui.query||ui.group!=='all'?'换个关键词，或清除分组筛选。':ui.libraryTab==='favorites'?'点击项目上的星标，下次就能快速找到。':ui.libraryTab==='archived'?'暂时不需要的项目可以归档，资料会继续保留。':'可以按售后业务、客户或团队分别建立项目。'}</p>${ui.query||ui.group!=='all'?action('清除筛选','library-clear','','small'):ui.libraryTab==='all'?action('新建项目','new','data-kind="project"','primary'):action('查看全部项目','library-tab','data-value="all"','small')}</div>`}<footer class="library-footnote">${icon('lock')}项目分别保存任务与助手职责；原售后会话、知识和版本不会复制到新项目。</footer></section>`;
  }
  function projectMenu(identifier){const project=projectOf(identifier);if(!project)return;host.showDialog(project.name,'项目管理',`<div class="library-project-menu"><p>${escape(project.goal)}</p><dl><dt>所属分组</dt><dd>${escape(portfolioOf(project.portfolioId)?.name||'未分组')}</dd><dt>负责人</dt><dd>${escape(project.owner)}</dd><dt>当前状态</dt><dd>${escape(project.archivedAt?'已归档':project.phase)}</dd></dl>${action(icon('arrow-right')+' 进入项目','enter',`data-id="${project.id}"`,'primary')}${action(icon('settings')+' 编辑信息 / 移动分组','edit',`data-kind="project" data-id="${project.id}"`)}${action(icon(project.archivedAt?'folder':'archive')+(project.archivedAt?' 恢复项目':' 归档项目'),'archive-ask',`data-id="${project.id}"`,'quiet')}</div>`,host.button('关闭','close-dialog'),'compact');}
  function groupsDialog(){host.showDialog('项目分组','分组只用来归类和筛选，点击项目即可进入，不再经过另一层大盘。',`<div class="library-group-editor">${data.portfolios.map(group=>`<div><span><strong>${escape(group.name)}</strong><small>${data.projects.filter(project=>project.portfolioId===group.id&&!project.archivedAt).length} 个未归档项目</small></span>${action('重命名','edit',`data-kind="portfolio" data-id="${group.id}"`,'quiet small')}</div>`).join('')}</div>`,host.button('关闭','close-dialog')+action('新建分组','new','data-kind="portfolio"','primary'),'compact');}
  function archiveAsk(identifier){const project=projectOf(identifier);if(!project)return;host.showDialog(project.archivedAt?'恢复项目':'归档项目',project.name,`<p class="library-archive-note">${project.archivedAt?'恢复后会回到全部项目中，原有任务与配置保持不变。':'归档只将项目从常用列表移到「已归档」，不删除对话、任务或助手版本，也不会停止正在执行的任务。原链接仍可打开项目。'}</p>`,host.button('取消','close-dialog')+action(project.archivedAt?'确认恢复':'确认归档','archive-confirm',`data-id="${project.id}"`,'primary'),'compact');}
  function enterProject(identifier){const project=projectOf(identifier);if(!project)return;activeProjectId=identifier;project.lastOpenedAt=stamp();data.selection.project=identifier;data.selection.portfolio=project.portfolioId;persist();host.closeDialog();host.navigate('manager');}
  function route(page){
    if(['portfolios','portfolio'].includes(page)){activeProjectId=null;return page;}
    if(page==='portfolio-form')return page;
    if(!projectOf(activeProjectId)){activeProjectId=null;return 'portfolios';}
    if(activeProjectId!=='AFTERSALES'&&!isScope(page)&&!['manager','group','agents','project-assistant','orbit','custom-assistant'].includes(page)){
      ui.projectTab=page==='agents'?'team':page==='settings'?'overview':ui.projectTab;
      return 'project';
    }
    return page;
  }
  function restoreLocation(){
    const identifier=new URLSearchParams(location.search).get('project');
    const project=projectOf(identifier);
    activeProjectId=project?.id||null;
    if(project){data.selection.project=project.id;data.selection.portfolio=project.portfolioId;persist();}
  }
  function syncLocation(page){
    const destination=new URL(location.href);
    if(activeProjectId&&!isCollection(page))destination.searchParams.set('project',activeProjectId);
    else destination.searchParams.delete('project');
    destination.hash=page;
    if(destination.href!==location.href)history.replaceState(null,'',destination.href);
  }
  function switchProject(){
    host.showDialog('切换项目','选择后进入对应项目；对话、任务和版本继续保留在原项目。',`<div class="project-switch-list">${data.portfolios.map(collection=>{const projects=data.projects.filter(project=>project.portfolioId===collection.id&&(!project.archivedAt||project.id===activeProjectId));return projects.length?`<section><h3>${escape(collection.name)}</h3>${projects.map(project=>`<button data-action="portfolio-enter" data-id="${project.id}" aria-current="${project.id===activeProjectId?'true':'false'}"><span><strong>${escape(project.name)}</strong><small>${escape(project.department)} · ${project.id==='AFTERSALES'?'售后协作演示':'独立项目台账'}</small></span><span>${project.id===activeProjectId?'当前项目':project.archivedAt?'已归档':'进入项目'}</span></button>`).join('')}</section>`:'';}).join('')}</div>`,action('返回项目集','return','','quiet small')+host.button('取消','close-dialog'),'compact');
  }
  function libraryNav(){return `<div class="project-return-area"><button class="project-return" data-action="portfolio-return" aria-label="返回项目集选择项目">${icon('arrow-left')}<span>返回项目集</span></button></div>`;}
  function libraryActions(name,element){const identifier=element.dataset.id;const value=element.dataset.value;const project=projectOf(identifier);
    if(name==='enter'){enterProject(identifier);return true;}
    if(name==='menu'){projectMenu(identifier);return true;}
    if(name==='groups'){groupsDialog();return true;}
    if(name==='archive-ask'){archiveAsk(identifier);return true;}
    if(name==='archive-confirm'&&project){project.archivedAt=project.archivedAt?null:stamp();project.updatedAt=stamp();record((project.archivedAt?'归档':'恢复')+'项目：'+project.name,project.id);host.closeDialog();refresh();host.toast(project.archivedAt?'项目已归档，资料仍保留。':'项目已恢复。');return true;}
    if(name==='favorite'&&project){project.favorite=!project.favorite;persist();refresh();return true;}
    if(name==='library-tab'&&['all','favorites','archived'].includes(value)){ui.libraryTab=value;refresh();return true;}
    if(name==='library-group'&&(value==='all'||portfolioOf(value))){ui.group=value;refresh();return true;}
    if(name==='library-layout'&&['cards','list'].includes(value)){ui.layout=value;data.library.layout=value;persist();refresh();return true;}
    if(name==='library-clear'){ui.query='';ui.group='all';refresh();return true;}
    return false;
  }
  function footnote(){return `<footer class="pmo-footnote">${icon('shield-lock')}<span>本地演示台账。跨项目仅汇总管理信息，不复制客户对话、模型密钥或助手版本；未实现生产租户权限与跨项目自动调度。</span></footer>`;}
  function taskBoard(project){const entries=tasks(project);return `<div class="pmo-task-board">${taskStates.map(status=>`<section><header><h3>${status}</h3><span>${entries.filter(task=>task.status===status).length}</span></header>${entries.filter(task=>task.status===status).map(task=>`<button class="pmo-task-card" data-action="portfolio-task" data-project="${project.id}" data-id="${task.id}"><small>${escape(task.id)}</small><strong>${escape(task.title)}</strong>${task.detail?`<p>${escape(task.detail)}</p>`:''}<span>${escape(projectMembers(project).find(member=>member.id===task.assignee)?.name||'项目助手')}</span><footer>${task.due?'计划 '+dateLabel(task.due):'完成时间未估算'}<i>${icon('arrow-up-right')}</i></footer></button>`).join('')||'<p class="pmo-column-empty">暂无任务</p>'}</section>`).join('')}</div>`;}
  function projectTeam(project){return '<div class="pmo-team-list">'+projectMembers(project).map(member=>'<article>'+window.HubIdentity.worker(member.id==='coordinator'?'manager':member.id,'md')+'<div><h3>'+escape(member.name)+'</h3><p>'+escape(member.role)+'</p><small>'+(member.custom?'Orbit 本地验收版本 '+escape(member.version):member.legacy?'独立业务工作区与版本':member.id==='coordinator'?'当前项目协调配置':'职责草稿 · 待接入')+'</small></div>'+(['manager','coordinator'].includes(member.id)?host.button('项目助手设置','studio-profile','small'):member.custom?host.button('工作区与版本','studio-agent','small','data-id="'+member.id+'"'):member.legacy?action('打开工作区','legacy-assistant','data-id="'+member.id+'"','small'):host.button('按此职责研发','studio-from-role','small','data-id="'+member.id+'"'))+'</article>').join('')+host.button('在 Orbit 研发业务助手','studio-orbit','primary small')+'</div>';}

  function projectPage(){
    const project=currentProject();const count=stats([project]);
    return `<div class="pmo-page pmo-project-page">${scopeCrumb(project)}${title(project.name,project.goal,action('项目设置','edit',`data-kind="project" data-id="${project.id}"`,'quiet')+(project.id==='AFTERSALES'?action('打开项目助手 '+icon('arrow-right'),'legacy','','primary'):action(icon('plus')+' 分配任务','new','data-kind="task"','primary')),project.department+' / 项目')}<div class="pmo-project-meta">${symbol(project,true)}<span>负责人 <strong>${escape(project.owner)}</strong></span>${badge(project.phase)}<span>${projectMembers(project).length} 位助手</span><span>归属 ${escape(portfolioOf(project.portfolioId).name)}</span></div><div class="pmo-project-tabs" role="tablist" aria-label="项目工作区">${[['overview','项目概览'],['tasks','任务看板'],['team','业务团队']].map(([value,label])=>`<button role="tab" aria-selected="${ui.projectTab===value}" data-action="portfolio-project-tab" data-value="${value}">${label}</button>`).join('')}</div>${ui.projectTab==='tasks'?`<div class="pmo-section-heading"><h2>当前项目任务 <span>${count.total}</span></h2>${project.id==='AFTERSALES'?action('在项目助手中分派','legacy','','small'):action('分配任务','new','data-kind="task"','small')}</div>${taskBoard(project)}`:ui.projectTab==='team'?projectTeam(project):`<div class="pmo-project-overview"><section><div class="pmo-workspace-entry"><span class="pmo-eyebrow">项目工作空间</span><h2>${project.id==='AFTERSALES'?'从这里继续售后团队的工作':'先把这个团队的业务配置好'}</h2><p>${project.id==='AFTERSALES'?'项目助手、协作群、客服坐席与业务助手都属于这个项目。原来的对话、任务和版本继续保留。':'本项目有自己的项目助手、群聊与研发场景。已验收的定制助手可做本地规则演练；真实模型和业务系统仍待接入。'}</p><div>${project.id==='AFTERSALES'?action('与项目助手对话','legacy','','primary')+action('进入项目协作群','legacy-group','','small')+action('客服收件箱','legacy-page','data-value="workspace"','small'):host.button('与项目助手对话','navigate','primary','data-page="manager"')+host.button('进入项目协作群','navigate','small','data-page="group"')+host.button('在 Orbit 研发助手','studio-orbit','small')}</div></div><div class="pmo-section-heading"><h2>本项目待跟进</h2><span>${count.attention} 项</span></div>${attentionList([project])}</section><aside><section class="pmo-project-facts"><h2>项目计划</h2><dl><dt>下一里程碑</dt><dd>${escape(project.milestone||'待设置')}</dd><dt>计划日期</dt><dd>${project.due?escape(project.due):'尚未设置'}</dd><dt>任务完成情况</dt><dd>${count.done} / ${count.total}<progress value="${count.done}" max="${Math.max(1,count.total)}" aria-label="本项目已完成任务"></progress></dd><dt>数据范围</dt><dd>${project.id==='AFTERSALES'?'原售后工作区 · 本地演示':'独立管理台账 · 人工更新'}</dd></dl></section><section class="pmo-project-facts"><h2>职责边界</h2><p>项目负责人审批与决策；项目助手协调团队；业务助手分别管理自己的职责与版本。</p><p>新项目不会自动获得其他项目的渠道权限、知识或模型连接。</p></section></aside></div>`}${footnote()}</div>`;
  }
  function field(label,name,value='',extra='',kind='input'){return `<label class="pmo-form-field"><span>${label}</span>${kind==='textarea'?`<textarea name="${name}" ${extra}>${escape(value)}</textarea>`:`<input name="${name}" value="${escape(value)}" ${extra}>`}</label>`;}
  function select(label,name,entries,value){return `<label class="pmo-form-field"><span>${label}</span><select name="${name}">${entries.map(([identifier,title])=>`<option value="${escape(identifier)}" ${identifier===value?'selected':''}>${escape(title)}</option>`).join('')}</select></label>`;}
  function formPage(){
    const form=ui.form;if(!form)return `<div class="pmo-page">${title('草稿未保存','刷新后未保存的草稿不保留。',action('返回项目','home','','primary'))}</div>`;
    const project=currentProject();const entry=form.kind==='portfolio'?portfolioOf(form.id):form.kind==='project'?projectOf(form.id):form.kind==='task'?project.tasks.find(task=>task.id===form.id):project.assistants.find(member=>member.id===form.id);const item=entry||{};const labels={portfolio:'分组',project:'项目',task:'任务',assistant:'业务助手'};
    let fields='';
    if(form.kind==='portfolio')fields=field('分组名称','name',item.name,'required maxlength="32" placeholder="例如：售后运营、设备维修、重点客户"');
    if(form.kind==='project')fields=field('项目名称','name',item.name,`required maxlength="32" placeholder="例如：维修进度跟进、重点客户售后" ${item.id==='AFTERSALES'?'readonly':''}`)+field('这个项目负责什么','goal',item.goal,'required maxlength="240" rows="3" placeholder="写清业务范围，方便团队知道在这里处理什么事情。"','textarea')+select('放入分组','portfolioId',data.portfolios.map(portfolio=>[portfolio.id,portfolio.name]),item.portfolioId||(ui.group!=='all'?ui.group:currentPortfolio().id))+field('项目负责人（人工）','owner',item.owner||'待指定','required maxlength="32"')+'<details class="library-form-more"><summary>团队、阶段与计划日期</summary><div class="pmo-form-fields">'+field('所属团队','department',item.department||'售后团队',`required maxlength="32" ${item.id==='AFTERSALES'?'readonly':''}`)+select('项目阶段','phase',phases.map(phase=>[phase,phase]),item.phase||'筹备中')+field('下一里程碑计划日期','due',item.due,'type="date" min="2020-01-01" max="2100-12-31"')+field('下一里程碑','milestone',item.milestone,'maxlength="80"')+'</div></details>';
    if(form.kind==='task')fields=field('任务名称','title',item.title,'required maxlength="80"')+select('分配给本项目助手','assignee',projectMembers(project).map(member=>[member.id,member.name]),item.assignee||'coordinator')+select('任务状态（人工记录）','status',taskStates.map(status=>[status,status]),item.status||'待办')+field('计划完成日期','due',item.due,'type="date" min="2020-01-01" max="2100-12-31"')+field('任务说明 / 卡点 / 完成依据','detail',item.detail,'maxlength="500" rows="5" placeholder="阻塞或已完成时，请记录卡点或完成依据。"','textarea');
    if(form.kind==='assistant')fields=field('业务助手名称','name',item.name,'required maxlength="32" placeholder="例如：巡检整理助手"')+field('职责与处理边界','role',item.role,'required maxlength="240" rows="5" placeholder="处理什么问题？什么情况交回人工？"','textarea');
    return `<div class="pmo-page pmo-form-page"><div class="pmo-crumb">${action('返回，不保存','cancel')}${icon('chevron-right')}<span>${form.id?'编辑':'新建'}${labels[form.kind]}</span></div>${title((form.id?'编辑':'新建')+labels[form.kind],form.kind==='portfolio'?'分组用来整理项目，不创建额外的业务层级。':'每个项目单独保存任务、团队与业务范围。')}<div class="pmo-form-layout"><form id="portfolio-editor"><div class="pmo-form-fields">${fields}</div><p class="pmo-form-error" role="alert" id="portfolio-form-error"></p><footer><span>仅本地保存 · 请勿填写真实客户或敏感信息</span>${action('取消','cancel')}<button type="submit" class="button primary">${form.id?'保存修改':'创建'+labels[form.kind]}</button></footer></form><aside><h2>${form.kind==='portfolio'?'分组说明':'项目范围'}</h2><p>${form.kind==='portfolio'?'例如按客户、产品或售后业务分类。分组不共享对话、助手配置或模型密钥。':form.kind==='assistant'?'这里只保存本项目的助手职责草稿，不创建模型连接，不部署生产助手，也不自动接收任务。':form.kind==='task'?'任务分配与状态是本地管理记录，不代表助手已经执行。卡点、完成结果请由负责人核实。':'新项目拥有独立管理台账。不会复制售后的对话、密钥、知识或版本，也不会自动接入外部渠道。'}</p><div>${icon('shield-lock')}<span>审批和决策由人工负责；项目阶段变更不会暂停已有执行任务。</span></div></aside></div></div>`;
  }
  function resetFilters(){ui.query='';ui.department='all';ui.health='all';}
  function refresh(){const input=document.activeElement;const scrollTop=document.getElementById('main-content')?.scrollTop||0;const focus=input?.id==='portfolio-search'?{start:input.selectionStart,end:input.selectionEnd}:null;host.render();document.getElementById('main-content').scrollTop=scrollTop;if(focus){const search=document.getElementById('portfolio-search');search?.focus({preventScroll:true});search?.setSelectionRange(focus.start,focus.end);}}
  function openPortfolio(identifier){if(!portfolioOf(identifier))return;data.selection.portfolio=identifier;ui.group=identifier;ui.libraryTab='all';resetFilters();persist();host.navigate('portfolios');}
  function openProject(identifier,tab='overview'){const project=projectOf(identifier);if(!project)return;activeProjectId=identifier;data.selection.project=identifier;data.selection.portfolio=project.portfolioId;project.lastOpenedAt=stamp();ui.projectTab=tab;persist();host.navigate('project');}
  function openForm(kind,identifier){if(!['portfolio','project','task','assistant'].includes(kind))return;if(['task','assistant'].includes(kind)&&currentProject().id==='AFTERSALES')return legacy(kind==='task'?'manager':'agents');host.closeDialog();ui.form={kind,id:identifier||'',returnTo:host.getView().page};host.navigate('portfolio-form');}
  function legacy(page='manager'){if(activeProjectId!=='AFTERSALES')return;data.selection.project='AFTERSALES';data.selection.portfolio=projectOf('AFTERSALES').portfolioId;persist();host.navigate(page);}
  function save(formElement){
    if(!ui.form)return;const form=ui.form;const values=Object.fromEntries(new FormData(formElement));for(const key of Object.keys(values))values[key]=String(values[key]).trim();
    const fail=text=>{document.getElementById('portfolio-form-error').textContent=text;return false;};
    if(Object.values(values).some(value=>host.isSensitive(value)))return fail('请移除疑似敏感信息，只使用示例资料。');
    if(['name','owner','department','goal','title','role'].some(key=>Object.hasOwn(values,key)&&!values[key]))return fail('请补齐必填信息，不能只填写空格。');
    if(Object.entries({name:32,owner:32,department:32,goal:240,title:80,role:240,milestone:80,detail:500}).some(([key,limit])=>(values[key]||'').length>limit))return fail('内容过长，请按字段提示缩短。');
    if(values.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(values.due)||values.due<'2020-01-01'||values.due>'2100-12-31'||Number.isNaN(Date.parse(values.due))))return fail('请填写有效的计划日期。');
    const identifier=form.id||form.kind.toUpperCase()+'-'+crypto.randomUUID();const project=currentProject();
    if(form.kind==='portfolio'){
      if(data.portfolios.some(entry=>entry.id!==form.id&&entry.name===values.name))return fail('已有同名分组，请换一个名称。');
      const previous=portfolioOf(form.id);if(previous)Object.assign(previous,values);else data.portfolios.push({id:identifier,tone:'sage',owner:'项目管理员（示例）',goal:'按业务归类项目',...values});data.selection.portfolio=identifier;
    }
    if(form.kind==='project'){
      if(!portfolioOf(values.portfolioId)||!phases.includes(values.phase))return fail('请从现有分组和阶段中选择。');
      if(data.projects.some(entry=>entry.id!==form.id&&entry.portfolioId===values.portfolioId&&entry.name===values.name))return fail('这个分组内已有同名项目。');
      const previous=projectOf(form.id);if(previous){if(previous.id==='AFTERSALES'){values.name=previous.name;values.department=previous.department;if(host.getState().projectCollab)host.getState().projectCollab.portfolioId=values.portfolioId;host.persist();}Object.assign(previous,values,{updatedAt:stamp()});}else data.projects.push({id:identifier,tone:'sage',assistants:[],tasks:[],createdAt:stamp(),updatedAt:stamp(),favorite:false,archivedAt:null,...values});activeProjectId=identifier;data.selection.project=identifier;data.selection.portfolio=values.portfolioId;ui.projectTab='overview';
    }
    if(form.kind==='task'){
      if(project.id==='AFTERSALES'||!projectMembers(project).some(member=>member.id===values.assignee)||!taskStates.includes(values.status))return fail('只能分配给当前项目成员，请重新选择。');
      if(['阻塞','已完成'].includes(values.status)&&!values.detail)return fail('请补充卡点或完成依据，再保存这个状态。');
      const previous=project.tasks.find(task=>task.id===form.id);if(previous)Object.assign(previous,values,{updatedAt:stamp()});else project.tasks.push({id:identifier,...values,updatedAt:stamp()});ui.projectTab='tasks';
    }
    if(form.kind==='assistant'){
      if(project.id==='AFTERSALES')return fail('请在售后助手工作区内配置。');
      if(projectMembers(project).some(member=>member.id!==form.id&&member.name===values.name))return fail('本项目已有同名助手。');
      const previous=project.assistants.find(member=>member.id===form.id);if(previous)Object.assign(previous,values);else project.assistants.push({id:identifier,...values});ui.projectTab='team';
    }
    record((form.id?'更新':'创建')+({portfolio:'分组',project:'项目',task:'任务',assistant:'助手职责'}[form.kind])+'：'+(values.name||values.title),form.kind==='portfolio'?'':data.selection.project);ui.form=null;resetFilters();if(form.kind==='portfolio'){ui.section='projects';ui.group=identifier;ui.libraryTab='all';}host.navigate(form.kind==='portfolio'?'portfolios':'project');host.toast(form.kind==='assistant'?'已保存职责草稿，尚未接入模型或运行引擎。':'已保存到本地管理台账。');
  }
  function dispatch(name,element){
    const identifier=element.dataset.id;const value=element.dataset.value;
    if(libraryActions(name,element))return;
    if(name==='switch')return switchProject();
    if(name==='return'){const project=projectOf(activeProjectId);if(project)return openPortfolio(project.portfolioId);host.navigate('portfolios');return;}
    if(name==='home'){ui.section='projects';ui.libraryTab='all';ui.group='all';resetFilters();host.closeDialog();host.navigate('portfolios');}
    if(name==='open')openPortfolio(identifier);
    if(name==='project')openProject(identifier);
    if(name==='team')openProject(identifier,'team');
    if(name==='section'){ui.section=value;refresh();}
    if(name==='project-tab'){ui.projectTab=value;if(host.getView().page!=='project')host.navigate('project');else refresh();}
    if(name==='refresh')refresh();
    if(name==='clear'){resetFilters();refresh();}
    if(name==='new'&&element.dataset.kind==='project'&&ui.group!=='all')data.selection.portfolio=ui.group;
    if(name==='new'||name==='edit')openForm(element.dataset.kind,name==='edit'?identifier:'');
    if(name==='cancel'){const destination=ui.form?.returnTo||'portfolios';ui.form=null;host.navigate(destination);}
    if(name==='legacy')legacy();
    if(name==='legacy-page'&&['workspace','agents','analytics','quality','knowledge','tickets'].includes(value))legacy(value);
    if(name==='legacy-group'){legacy();window.ProjectHub.openGroup();}
    if(name==='legacy-assistant'){legacy('agents');window.TraceHub.setScope(identifier,'overview');}
    if(name==='task'){
      const project=projectOf(element.dataset.project);if(!project)return;const task=[...tasks(project),...attention(project)].find(entry=>entry.id===identifier);if(!task)return;
      if(task.studio){if(task.traceId)return window.ProjectStudio.dispatch('agent',{dataset:{id:task.assignee,tab:'traces'}});return host.showDialog(task.title,'已接收待办，尚未执行。',`<p>${escape(task.detail)}</p>`,host.button('关闭','close-dialog'));}
      if(task.review)return legacy('quality');
      if(task.live){legacy();const actual=window.ManagerHub.getEngine().find(identifier);if(actual?.conversationId==='GROUP-AFTERSALES')window.ProjectHub.openGroupTask(identifier);else window.ManagerHub.dispatch('open',{dataset:{id:identifier}});return;}
      openProject(project.id,'tasks');openForm('task',identifier);
    }
  }
  function sidebar(){const project=currentProject();return `<aside class="sidebar pmo-sidebar" aria-label="当前项目导航">${window.HubBrand.header()}${libraryNav()}<button class="workspace-switch" data-action="portfolio-switch" aria-label="切换项目，当前${escape(project.name)}">${symbol(project,true)}<span class="grow"><strong>${escape(project.name)}</strong><small>${escape(project.department)}</small></span>${icon('chevron-down')}</button><nav class="nav-section" aria-label="本项目工作区">${[['overview','项目概览','briefcase'],['tasks','任务看板','list'],['team','业务助手','users']].map(([key,label,symbolName])=>`<button class="nav-item ${ui.projectTab===key?'active':''}" data-action="portfolio-project-tab" data-value="${key}" aria-label="${label}" aria-current="${ui.projectTab===key?'page':'false'}">${icon(symbolName)}<span class="nav-label">${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-environment">${icon('shield-check')}<span>独立项目台账<small>本项目执行引擎尚未接入</small></span></div><div class="profile">${window.HubIdentity.avatar({entityType:'staff',identityTone:'blue'},{size:'sm'})}<span class="grow"><strong>演示管理员</strong><small>当前项目管理</small></span></div></div></aside>`;}
  function topbar(){const outer=isCollection(host.getView().page);const project=currentProject();return `<header class="topbar pmo-topbar ${outer?'collection-topbar':''}"><div class="row">${outer?window.HubBrand.header():`<button class="icon-button mobile-menu" data-action="mobile-menu" aria-label="打开导航">${icon('menu-2')}</button>`}<div class="breadcrumb">${outer?'<span>工作空间</span>':action('项目集','return','','quiet small')}${icon('chevron-right')}<strong>${outer?'选择项目':escape(project.name)}</strong></div></div><div class="topbar-right"><span class="demo-pill">交互演示 · 模拟数据</span>${action(icon('refresh')+' 刷新','refresh','','quiet small')}</div></header>`;}
  function legacyBanner(){const project=projectOf('AFTERSALES');return `<div class="project-context"><div class="pmo-crumb">${action('项目集','return')}${icon('chevron-right')}${action(escape(portfolioOf(project.portfolioId).name),'open',`data-id="${project.portfolioId}"`)}${icon('chevron-right')}${action(escape(project.name),'project','data-id="AFTERSALES"')}</div><span class="project-scope">${escape(project.department)} · 项目空间</span></div>`;}
  function configure(api){
    host=api;try{const stored=JSON.parse(localStorage.getItem(storageKey));data=stored?.version===1&&Array.isArray(stored.portfolios)&&stored.portfolios.length&&Array.isArray(stored.projects)&&stored.projects.some(project=>project.id==='AFTERSALES')?stored:seed();}catch{data=seed();}
    data.library||={layout:'cards',sort:'updated'};ui.layout=['cards','list'].includes(data.library.layout)?data.library.layout:'cards';ui.sort=['updated','recent','name'].includes(data.library.sort)?data.library.sort:'updated';
    const linkedProject=new URLSearchParams(location.search).get('project');if(projectOf(linkedProject)){activeProjectId=linkedProject;data.selection={project:linkedProject,portfolio:projectOf(linkedProject).portfolioId};}
    if(!data.selection)data.selection={portfolio:data.portfolios[0].id,project:'AFTERSALES'};data.activity||=[];for(const project of data.projects){project.tasks||=[];project.assistants||=[];}persist();
  }
  return {configure,persist,isScope,isCollection,route,syncLocation,restoreLocation,sidebar,topbar,legacyBanner,libraryNav,navProject(){return projectOf(activeProjectId)||null;},page:()=>host.getView().page==='portfolio-form'?formPage():host.getView().page==='project'?projectPage():overview(),dispatch(name,element){if(name==='global-section'){ui.section='projects';ui.libraryTab='all';ui.group='all';resetFilters();host.navigate('portfolios');}else dispatch(name,element);},input(identifier,value){if(identifier==='portfolio-search'){ui.query=value;refresh();}},change(identifier,value){if(identifier==='library-sort'&&['updated','recent','name'].includes(value)){ui.sort=value;data.library.sort=value;persist();refresh();return;}if(!['portfolio-department','portfolio-health'].includes(identifier))return;if(identifier==='portfolio-department')ui.department=value;if(identifier==='portfolio-health')ui.health=value;refresh();},save,openPortfolio,openProject,openParent(){openPortfolio(projectOf('AFTERSALES').portfolioId);}};
})();

window.ProjectStudio=(()=>{
  let host;
  const ui={scene:{},tab:{},agent:{},object:{},objectTab:{},error:'',mention:false,mentionIndex:0};
  const toolNames={summary:'整理信息摘要',form:'准备表单草稿'};
  const outcomes={prepared:'已准备，待人工核对',missing:'信息不足，需补充',handoff:'转人工核实'};
  const project=()=>window.PortfolioHub.navProject();
  const escape=value=>host.escape(String(value??''));
  const button=(text,name,attributes='',tone='quiet small')=>host.button(text,'studio-'+name,tone,attributes);
  const persist=()=>window.PortfolioHub.persist();
  const identifier=prefix=>prefix+'-'+crypto.randomUUID();
  const date=value=>new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  function baseMembers(current){return current.id==='AFTERSALES'?host.getState().agents.map(member=>({id:member.id,name:member.name,role:member.desc,enabled:member.enabled,legacy:true})):current.assistants.map(member=>({...member,enabled:true}));}
  function data(current=project()){
    if(!current)return null;
    if(!current.workspace){
      const labels={AFTERSALES:'售后项目助手',RETAIL:'门店项目助手',PRESALES:'售前项目助手',PEOPLE:'员工服务项目助手','IT-SERVICE':'IT项目助手'};
      const profile={name:labels[current.id]||current.name.replace(/项目$/,'')+'项目助手',mission:current.goal,scope:current.goal,escalation:'超出授权范围、缺少依据或涉及对外承诺时，由项目负责人确认。',knowledge:'尚未接入本项目业务资料',prompt:'只协调本项目已授权的成员，记录依据、缺项与卡点，不替代人工审批。',provider:'未连接',model:'',connectionRef:'',allowed:baseMembers(current).map(member=>member.id)};
      current.workspace={schema:1,profile,profileVersions:[{version:'P1',time:new Date().toISOString(),profile:structuredClone(profile)}],agents:[],scenes:[],messages:{manager:[],group:[]},drafts:{manager:'',group:''},tasks:[]};
      persist();
    }
    return current.workspace;
  }
  function members(current=project()){
    if(!current)return [];
    const workspace=data(current);
    return [{id:'manager',name:workspace.profile.name,role:workspace.profile.mission,enabled:true},...baseMembers(current),...workspace.agents.map(agent=>({id:agent.id,name:agent.name,role:agent.role,enabled:agent.enabled,custom:true,version:agent.activeVersion}))];
  }
  function contextBar(){
    const current=project();const workspace=data();
    return `<section class="studio-context"><div>${window.HubIdentity.worker('manager','sm')}<span><strong>${escape(workspace.profile.name)}</strong><small>${escape(current.name)} · 配置 ${workspace.profileVersions.at(-1).version}</small></span></div><div>${button('设置项目助手','profile')}${button('业务助手','roster','','small')}</div></section>`;
  }
  function sidebar(){
    const current=project();const page=host.getView().page;
    const active=route=>page===route||(route==='agents'&&['orbit','custom-assistant'].includes(page));
    return `<aside class="sidebar" aria-label="本项目导航">${window.HubBrand.header()}${window.PortfolioHub.libraryNav()}<button class="workspace-switch" data-action="portfolio-switch" aria-label="切换项目，当前${escape(current.name)}">${window.HubIdentity.worker('manager','sm')}<span class="grow"><strong>${escape(current.name)}</strong><small>${escape(current.department)}</small></span>${host.icon('chevron-down','small')}</button><nav class="nav-section">${[['manager','项目助手','message-circle'],['group','项目协作群','messages'],['agents','业务助手','users'],['project','项目与任务','clipboard-list']].map(([route,label,icon])=>host.button(host.icon(icon)+`<span class="nav-label">${label}</span>`,'navigate',`nav-item ${active(route)?'active':''}`,`data-page="${route}" aria-label="${label}" aria-current="${active(route)?'page':'false'}"`)).join('')}</nav><div class="studio-sidebar-scope"><strong>${escape(data().profile.name)}</strong><p>${escape(current.goal)}</p>${button('设置职责与范围','profile')}</div><div class="sidebar-bottom"><div class="sidebar-environment">${host.icon('shield-check','small')}<span>本项目本地演示<small>不读取其他项目资料</small></span></div></div></aside>`;
  }
  const field=(label,name,value,extra='',area=false)=>`<label class="studio-field"><span>${label}</span>${area?`<textarea name="${name}" ${extra}>${escape(value)}</textarea>`:`<input name="${name}" value="${escape(value)}" ${extra}>`}</label>`;
  function profilePage(){
    const current=project();const workspace=data();const profile=workspace.profile;
    return `<div class="studio-page"><header class="studio-page-head"><div><span>${escape(current.name)} / 项目助手</span><h1>项目助手设置</h1><p>设置业务范围、可调度成员和转人工条件。</p></div>${host.button('返回对话','navigate','small','data-page="manager"')}</header><div class="studio-settings-layout"><form id="studio-profile-form" class="studio-form"><div class="studio-fields">${field('项目助手名称','name',profile.name,'required maxlength="40"')}${field('负责的业务目标','mission',profile.mission,'required maxlength="400" rows="3"',true)}${field('受理范围与不处理的事项','scope',profile.scope,'required maxlength="500" rows="3"',true)}${field('交给人工的条件','escalation',profile.escalation,'required maxlength="400" rows="3"',true)}${field('业务资料 / 知识版本引用','knowledge',profile.knowledge,'maxlength="300"')}<p class="studio-note">仅保存引用说明，不读取资料或跨项目共享。</p><fieldset><legend>允许项目助手调度的成员</legend>${members().filter(member=>member.id!=='manager').map(member=>`<label class="studio-check"><input type="checkbox" name="allowed" value="${escape(member.id)}" ${profile.allowed.includes(member.id)?'checked':''}><span><strong>${escape(member.name)}</strong><small>${escape(member.role)}</small></span></label>`).join('')||'<p>还没有业务助手，可以先在 Orbit 研发。</p>'}</fieldset>${field('项目 Prompt 草稿','prompt',profile.prompt,'required maxlength="1600" rows="4"',true)}<details><summary>模型与连接引用（待后端接入）</summary><div class="studio-fields">${field('模型服务商','provider',profile.provider,'maxlength="60"')}${field('模型名称','model',profile.model,'maxlength="80"')}${field('凭证引用名称，不是 API Key','connectionRef',profile.connectionRef,'maxlength="80" placeholder="例如：本项目协调模型连接"')}<p class="studio-note">这里只保存配置意图，不保存密钥、不发起模型请求。运行仍使用本地规则；生产 Prompt 和模型须单独部署验收。</p></div></details></div><p class="studio-error" role="alert" id="studio-profile-error"></p><footer><button type="submit" class="button primary">保存本项目配置</button><span>只影响新分派，历史记录不改写</span></footer></form><aside class="studio-side"><h2>所属项目</h2><dl><dt>项目</dt><dd>${escape(current.name)}</dd><dt>人工负责人</dt><dd>${escape(current.owner)}</dd><dt>群成员</dt><dd>${members().length} 位助手</dd></dl><p>成员授权仅控制本地任务分派。职责与 Prompt 为草稿，尚未用于生产权限或模型执行。</p><h3>配置版本</h3>${workspace.profileVersions.slice().reverse().map(version=>`<details class="studio-version"><summary>${version.version} · ${date(version.time)}</summary><p>${escape(version.profile.name)}</p><p>${escape(version.profile.mission)}</p><p>授权 ${version.profile.allowed.length} 位业务助手</p><p>${escape(version.profile.scope)}</p></details>`).join('')}</aside></div></div>`;
  }
  function saveProfile(form){
    if(!form.reportValidity())return;
    const input=new FormData(form);const workspace=data();const profile={};
    for(const key of ['name','mission','scope','escalation','knowledge','prompt','provider','model','connectionRef'])profile[key]=String(input.get(key)||'').trim();
    if(['name','mission','scope','escalation','prompt'].some(key=>!profile[key]))return fail('studio-profile-error','必填内容不能只含空格。');
    if(Object.values(profile).some(value=>unsafe(value)))return fail('studio-profile-error','请移除敏感信息；连接处只填写引用名称，不填写密钥。');
    if(/[\s@，,。；;]/.test(profile.name))return fail('studio-profile-error','名称请勿包含空格、@ 或分隔符，便于群内提及。');
    if(members().some(member=>member.id!=='manager'&&member.name===profile.name))return fail('studio-profile-error','名称不能与本项目业务助手重复。');
    profile.allowed=input.getAll('allowed').filter(value=>members().some(member=>member.id===value&&member.id!=='manager'));
    if(JSON.stringify(profile)===JSON.stringify(workspace.profile))return host.toast('配置没有变化。');
    workspace.profile=profile;workspace.profileVersions.push({version:'P'+(workspace.profileVersions.length+1),time:new Date().toISOString(),profile:structuredClone(profile)});persist();host.render();host.toast('已保存本项目配置；其他项目保持不变。');
  }
  function unsafe(value){return host.isSensitive(value)||/(?:sk[-_][A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{10,}|-----BEGIN.*PRIVATE KEY)/i.test(value);}
  function fail(target,text){const element=document.getElementById(target);if(element)element.textContent=text;else host.toast(text,true);return false;}
  function taskList(){const workspace=data();return workspace.tasks.slice().reverse().map(task=>`<article class="studio-task"><header><strong>${escape(task.name)}</strong><span>${escape(task.status)}</span></header><p>${escape(task.summary)}</p><small>${escape(task.assigneeName)} · ${escape(task.version||'尚无验收版本')} · ${date(task.time)}</small>${task.traceId?button('执行记录','agent',`data-id="${task.assignee}" data-tab="traces"`):''}</article>`).join('')||'<p class="studio-empty-note">暂无群内任务。</p>';}
  function chatPage(channel){
    const current=project();const workspace=data();const group=channel==='group';const roster=members();
    return `<div class="studio-project-chat">${contextBar()}<div class="studio-chat-layout"><section class="studio-chat-main"><header><div><span>${escape(current.department)}</span><h1>${group?escape(current.name)+'协作群':escape(workspace.profile.name)}</h1><p>${group?'你与 '+roster.length+' 位本项目助手 · 群消息仅在本地演示保存':escape(workspace.profile.mission)}</p></div>${group?button('成员与分工','members'):host.button('进入项目群','navigate','small','data-page="group"')}</header><div class="studio-chat-stream" id="studio-chat-stream">${workspace.messages[channel].length?workspace.messages[channel].map(message=>`<article class="studio-message ${message.author==='operator'?'is-operator':''}">${message.author==='operator'?window.HubIdentity.avatar({entityType:'staff',identityTone:'blue'},{size:'sm'}):window.HubIdentity.worker(message.author,'sm')}<div><div class="studio-message-author"><strong>${escape(message.name)}</strong><time>${date(message.time)}</time></div><p>${escape(message.text)}</p>${message.traceId?button('查看本次记录','agent',`data-id="${escape(message.author)}" data-tab="traces"`):''}</div></article>`).join(''):`<div class="studio-chat-empty"><span>${group?'项目协作群':'项目对话'}</span><h2>${group?'还没有群消息':'开始一项任务'}</h2><p>${escape(workspace.profile.scope)}</p><div>${button('查看当前团队','roster')}${button('在 Orbit 研发新助手','orbit','','primary small')}</div></div>`}</div><div class="studio-chat-compose"><form id="studio-chat-form" data-channel="${channel}"><label class="sr-only" for="studio-prompt">${group?'给本项目群发消息':'给本项目助手发消息'}</label><textarea id="studio-prompt" rows="3" maxlength="1200" placeholder="${group?'@助手名称，说明需要处理的事项…':'输入任务内容；@成员后可确认转到项目群…'}">${escape(workspace.drafts[channel])}</textarea>${ui.mention&&group?`<div class="studio-mentions" role="listbox" aria-label="本项目助手">${roster.map(member=>button(escape(member.name),'mention',`data-id="${escape(member.id)}" role="option" aria-selected="false"`)).join('')}</div>`:''}<footer>${group?button('@ 提及项目成员','mention-open'):button('配置业务范围','profile')}<span>${group?'Enter 发送 · Shift + Enter 换行':'单聊不会自动发到群里'}</span><button type="submit" class="button primary">发送</button></footer></form><p class="studio-note">本地协作演示。未配置助手只接收待办；已验收助手可试跑本地规则。不会调用真实系统。</p></div></section><aside class="studio-chat-side"><h2>本项目团队</h2>${roster.map(member=>`<div class="studio-roster-member">${window.HubIdentity.worker(member.id,'sm')}<div><strong>${escape(member.name)}</strong><small>${member.id==='manager'?'协调本项目':!workspace.profile.allowed.includes(member.id)?'未授权调度':member.custom?'本地规则 · '+escape(member.version):'职责草稿 · 待接入'}</small></div></div>`).join('')}<h2>群内任务</h2>${taskList()}${host.button('完整项目任务','navigate','small','data-page="project"')}</aside></div></div>`;
  }
  function addMessage(channel,author,text,traceId=''){
    const message={id:identifier('MSG'),author,name:author==='operator'?'你':members().find(member=>member.id===author)?.name||'项目助手',text,traceId,time:new Date().toISOString()};data().messages[channel].push(message);return message;
  }
  function runRules(config,input){
    const steps=[{name:'读取本次输入',result:'只读取当前项目本次文字，不检索其他项目。'}];
    const fields=config.fields.split(/[、,，\n]/).map(value=>value.trim()).filter(Boolean);
    const missing=fields.filter(name=>{const safe=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return !new RegExp(safe+'\\s*[:：]\\s*[^\\s，,；;\\n]+').test(input);});
    const matched=config.keywords.split(/[、,，\n]/).map(value=>value.trim()).filter(Boolean).some(value=>input.includes(value));
    let outcome='prepared';
    if(/人工|退款|赔付|删除|绕过|转账|密码|立即发送/.test(input)||(config.transferWords||'').split(/[、,，\n]/).map(word=>word.trim()).filter(Boolean).some(word=>input.includes(word))||!matched)outcome='handoff';
    else if(missing.length)outcome='missing';
    steps.push({name:'核对受理边界',result:matched?'命中已配置场景关键词':'不在当前关键词范围，交回人工'});
    steps.push({name:'检查必填字段',result:missing.length?'缺少：'+missing.join('、'):'已找到全部字段'});
    if(outcome==='prepared')steps.push({name:toolNames[config.tool]||'未配置动作',result:config.tool==='form'?'已在本地整理字段草稿；没有提交外部系统。':'已整理本次信息；未调用模型或外部查询。'});
    const output=outcome==='handoff'?'建议交给人工核实。'+config.handoff:outcome==='missing'?'请补充：'+missing.map(name=>name+'：具体内容').join('；'):'已准备'+(config.tool==='form'?'表单草稿':'信息摘要')+'：\n'+input+'\n请项目负责人核对后再使用；尚未对外发送或提交。';
    return {outcome,output,steps};
  }
  function dispatchMembers(value,selected,onMessage){
    const workspace=data();const current=project();
    if(!selected.length)throw new Error('请 @ 一位本项目业务助手，或先让项目助手确认分工。');
    if(selected.some(member=>!workspace.profile.allowed.includes(member.id)||!member.enabled))throw new Error('所选成员未获本项目调度授权或已暂停，请先核对项目助手设置。');
    onMessage('manager',selected.map(member=>'@'+member.name).join(' ')+' 请按本项目职责处理；对外动作交由人工确认。');
    for(const member of selected){
      onMessage(member.id,'收到，正在核对任务范围。');
      const agent=workspace.agents.find(entry=>entry.id===member.id);const release=agent?.releases.find(entry=>entry.version===agent.activeVersion);
      let trace=null;let summary='已记录为待配置。尚无本地验收版本或执行适配器，可到 Orbit 配置验收，或转人工处理。';
      if(release){const result=runRules(release.config,value);trace={id:identifier('TRACE'),projectId:current.id,agentId:agent.id,version:release.version,profileVersion:workspace.profileVersions.at(-1).version,input:value,...result,time:new Date().toISOString()};agent.traces.push(trace);summary=result.output;}
      workspace.tasks.push({id:identifier('TASK'),projectId:current.id,name:value.slice(0,90),assignee:member.id,assigneeName:member.name,version:release?.version||'',status:trace?outcomes[trace.outcome]:'待配置',summary,traceId:trace?.id||'',time:new Date().toISOString()});
      onMessage(member.id,summary,trace?.id||'');
    }
    persist();
  }
  function resolveMentions(value){
    const roster=members();const mentioned=[...value.matchAll(/@([^\s，,。；;]+)/g)].map(match=>match[1]);
    const resolved=mentioned.map(name=>roster.find(member=>member.name===name||member.id==='manager'&&name==='项目助手'));
    if(resolved.some(member=>!member))throw new Error('有未加入本项目的助手，请从 @ 列表选择。');
    return [...new Map(resolved.map(member=>[member.id,member])).values()];
  }
  function sendChat(channel){
    const workspace=data();const value=(document.getElementById('studio-prompt')?.value||workspace.drafts[channel]).trim();
    if(!value)return host.toast('请先填写任务或业务需求。',true);
    if(value.length>1200||unsafe(value))return host.toast('请缩短内容并移除敏感信息。',true);
    try{
      const selected=resolveMentions(value).filter(member=>member.id!=='manager');
      if(channel==='manager'&&selected.length){host.showDialog('转到本项目群','单聊内容不会自动共享。',`<p>确认后将发送到 ${escape(project().name)}协作群，仅在本地保存。</p><p>${escape(value)}</p>`,host.button('取消','close-dialog')+button('确认转到项目群','confirm-group','','primary'));return;}
      if(selected.some(member=>!workspace.profile.allowed.includes(member.id)||!member.enabled))throw new Error('所选成员未获本项目调度授权或已暂停。请先核对项目助手设置。');
      addMessage(channel,'operator',value);
      if(!selected.length){const hasMembers=members().some(member=>member.id!=='manager'&&workspace.profile.allowed.includes(member.id)&&member.enabled);addMessage(channel,'manager',/研发|新.*助手|配置|开发/.test(value)?'这条需求已保存在对话中，尚未创建场景。请打开 Orbit 新建场景，配置范围并完成案例验收。':hasMembers?'已记录这条消息，尚未分派任务。请 @ 要处理的业务助手；单聊中的分派需确认转到项目群。':'已记录这条消息。目前没有可调度的业务助手，可在设置中授权成员，或通过 Orbit 配置新助手。');}
      else dispatchMembers(value,selected,(author,text,traceId)=>addMessage(channel,author,text,traceId));
      workspace.drafts[channel]='';ui.mention=false;persist();host.render();document.getElementById('studio-chat-stream')?.scrollTo({top:999999});
    }catch(error){host.toast(error.message,true);}
  }
  function legacyCustom(value,onMessage){
    const selected=resolveMentions(value).filter(member=>member.id!=='manager');
    if(!selected.some(member=>member.custom))return false;
    if(selected.some(member=>!member.custom))throw new Error('原售后流程与定制助手任务暂不支持混合分派，请分开发送。');
    if(selected.some(member=>!data().profile.allowed.includes(member.id)||!member.enabled))throw new Error('所选定制助手未获本项目授权或已暂停。');
    onMessage('operator',value);dispatchMembers(value,selected,onMessage);return true;
  }
  function directoryExtra(){return data().agents.length?`<section class="studio-directory-extra"><div><h2>从业务定义创建的助手</h2><p>每位助手保留独立的规则、验收证据与版本。</p></div></section>${customCards()}`:'';}
  function orbitEntry(){
    return `<section class="orbit-entry"><div class="orbit-entry-copy"><span class="orbit-eyebrow">ORBIT · 业务助手研发</span><h2>让业务规则，成为助手的工作方式。</h2><p>梳理业务对象与关系，明确处理规则，再把它们变成可验收的业务助手。</p><div>${button('打开业务本体 '+host.icon('arrow-up-right','small'),'orbit','','primary')}${button('从空白场景开始','scene-new')}</div><small>${data().scenes.length} 个研发场景 · ${data().agents.length} 位定制助手 · 仅当前项目</small></div><div class="orbit-entry-visual" aria-hidden="true"><span class="orbit-entry-orbit orbit-entry-orbit-one"></span><span class="orbit-entry-orbit orbit-entry-orbit-two"></span><i class="orbit-entry-dot dot-object"></i><i class="orbit-entry-dot dot-rule"></i><i class="orbit-entry-dot dot-action"></i><b class="orbit-entry-label label-object">业务对象</b><b class="orbit-entry-label label-rule">规则</b><b class="orbit-entry-label label-action">动作</b><strong>Orbit<small>从业务到助手</small></strong></div></section>`;
  }
  function customCards(){return data().agents.length?`<div class="studio-agent-grid">${data().agents.map(agent=>`<article class="studio-agent-card" data-custom-agent="${escape(agent.id)}"><div>${window.HubIdentity.worker(agent.id,'md')}<span><h2>${escape(agent.name)}</h2><small>Orbit 本地验收 · ${escape(agent.activeVersion)}</small></span></div><p>${escape(agent.role)}</p><footer>${button('工作区与版本','agent',`data-id="${escape(agent.id)}"`)}${button('在群里协作','use',`data-id="${escape(agent.id)}"`)}<span>${agent.enabled?'已加入本项目':'已暂停'}</span></footer></article>`).join('')}</div>`:'';}
  function directory(){return `<div class="studio-page"><header class="studio-page-head"><div><span>${escape(project().name)}</span><h1>本项目业务助手</h1><p>各助手分别配置业务、验收案例和版本，不跨项目共享。</p></div>${button('设置项目助手','profile')}</header>${orbitEntry()}<div class="studio-base-roster">${baseMembers(project()).map(member=>`<article><div>${window.HubIdentity.worker(member.id,'md')}<span><h2>${escape(member.name)}</h2><p>${escape(member.role)}</p></span></div><small>职责草稿 · 尚无执行适配器</small>${button('按此职责研发','from-role',`data-id="${escape(member.id)}"`)}${button('群内分配待办','use',`data-id="${escape(member.id)}"`)}</article>`).join('')||'<p>暂无预设助手，可在 Orbit 新建业务场景。</p>'}</div>${directoryExtra()}</div>`;}
  function newScene(member){
    const scene={id:identifier('SCENE'),projectId:project().id,config:{name:member?.name||'',goal:member?.role||'',keywords:'',fields:'',transferWords:'',tool:'summary',handoff:'不在受理范围、客户要求人工或涉及风险承诺时交给负责人。',knowledge:'',prompt:'仅按已确认范围处理；缺字段先追问，对外操作必须人工确认。',provider:'未连接',model:'',connectionRef:'',...member?.config},samples:[],runs:[],agentId:'',createdAt:new Date().toISOString()};
    data().scenes.push(scene);ui.scene[project().id]=scene.id;ui.tab[project().id]='config';persist();host.navigate('orbit');
  }
  const scene=()=>data().scenes.find(entry=>entry.id===ui.scene[project().id])||data().scenes.at(-1)||null;
  const fingerprint=entry=>JSON.stringify({config:entry.config,samples:entry.samples.map(sample=>({id:sample.id,input:sample.input,expected:sample.expected,approved:sample.approved})),runner:'local-scene-1'});
  const currentRun=entry=>entry.runs.at(-1)?.fingerprint===fingerprint(entry)?entry.runs.at(-1):null;
  function configPanel(entry){const config=entry.config;return `<form id="studio-scene-form" class="studio-form"><div class="studio-fields">${field('业务助手名称','name',config.name,'required maxlength="40" placeholder="例如：门店巡检汇总助手"')}${field('业务目标与交付结果','goal',config.goal,'required maxlength="400" rows="3"',true)}<div class="studio-field-pair">${field('受理关键词（逗号分隔）','keywords',config.keywords,'required maxlength="200" placeholder="巡检,整改"')}${field('必要字段（逗号分隔）','fields',config.fields,'required maxlength="160" placeholder="门店,问题"')}</div><p class="studio-note">本地规则按关键词分流，并识别“字段：内容”。这不是语义模型；遇到人工、退款等风险词直接转人工。</p><label class="studio-field"><span>允许的本地动作</span><select name="tool">${Object.entries(toolNames).map(([value,label])=>`<option value="${value}" ${config.tool===value?'selected':''}>${label}</option>`).join('')}</select></label>${field('补充转人工关键词（逗号分隔）','transferWords',config.transferWords||'','maxlength="200" placeholder="例如：主管复核,安全隐患"')}${field('转人工规则说明','handoff',config.handoff,'required maxlength="400" rows="2"',true)}${field('知识 / 本体版本引用（选填）','knowledge',config.knowledge,'maxlength="160" placeholder="仅引用说明，尚未自动读取 Orbit 资产"')}${field('Prompt 草稿','prompt',config.prompt,'required maxlength="1200" rows="3"',true)}<details><summary>独立模型与凭证引用</summary><div class="studio-fields">${field('模型服务商','provider',config.provider,'maxlength="60"')}${field('模型名称','model',config.model,'maxlength="80"')}${field('凭证引用名，不填写 API Key','connectionRef',config.connectionRef,'maxlength="80"')}<p class="studio-note">定制助手暂未接入密钥保险库与模型运行适配器；仅保存不含凭证的配置草稿，不继承其他项目连接。</p></div></details></div><p class="studio-error" role="alert" id="studio-scene-error"></p><footer><button type="submit" class="button primary">保存场景配置</button><span>修改后旧验收失效，历史证据保留</span></footer></form>`;}
  function testsPanel(entry){
    const latest=currentRun(entry);const previous=entry.runs.at(-1);
    return `<section class="studio-tests"><header><div><h2>案例验收</h2><p>核对人工预期、必填字段和受理边界。通过率仅表示规则验收结果，不代表模型准确率。</p></div>${button('添加示例案例','sample-template')}</header><div class="studio-samples">${entry.samples.map(sample=>`<article data-sample="${sample.id}"><div><span>${escape(sample.source)}</span>${button('移除','sample-remove',`data-id="${sample.id}"`)}</div><p>${escape(sample.input)}</p><label>人工预期<select data-studio-sample="${sample.id}">${Object.entries(outcomes).map(([value,label])=>`<option value="${value}" ${sample.expected===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="studio-check"><input type="checkbox" data-studio-approve="${sample.id}" ${sample.approved?'checked':''}>我已核对输入与预期；同意纳入回归</label></article>`).join('')||'<p class="studio-empty-note">还没有案例。零案例不能验收通过；示例预期也需要人工确认。</p>'}</div><form id="studio-sample-form" class="studio-sample-add">${field('案例输入','input','','required maxlength="800" rows="2" placeholder="使用脱敏业务信息，不含真实客户资料"',true)}<label class="studio-field"><span>人工预期</span><select name="expected"><option value="">请选择，不自动套用助手结果</option>${Object.entries(outcomes).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><button type="submit" class="button small">添加待审核案例</button></form><div class="studio-run-actions">${button('运行本地验收','evaluate','','primary')}<span>${latest?'当前配置有有效验收':previous?'配置或案例已变化，请重新验收':'还没有验收结果'}</span></div>${previous?`<div class="studio-evaluation"><h3>${latest?'当前':'历史'}验收：${previous.results.filter(result=>result.pass).length} / ${previous.results.length} 通过</h3><small>${date(previous.time)} · ${escape(previous.id)}</small>${previous.results.map(result=>`<details><summary>${result.pass?'通过':'未通过'} · ${escape(result.input.slice(0,70))}</summary><p>人工预期：${outcomes[result.expected]}；实际：${outcomes[result.outcome]}；预期${result.approved?'已审核':'未审核'}。</p><p>${escape(result.output)}</p><ol>${result.steps.map(step=>`<li>${escape(step.name)}：${escape(step.result)}</li>`).join('')}</ol></details>`).join('')}</div>`:''}</section>`;
  }
  function releasePanel(entry){const run=currentRun(entry);const ready=run&&run.results.length>0&&run.results.every(result=>result.pass);const agent=data().agents.find(agent=>agent.id===entry.agentId);return `<section class="studio-release"><h2>${agent?'更新助手版本':'纳入项目团队'}</h2><p>目标项目：<strong>${escape(project().name)}</strong>。不会加入其他项目，也不部署生产流量。</p><ul><li>场景配置：${escape(entry.config.name||'尚未填写')}</li><li>当前验收：${ready?'全部案例通过，人工预期已确认':'尚未满足：需有效、非零且全部通过的验收'}</li><li>入群后能力：本地关键词分流、字段检查、草稿整理</li><li>仍未接入：真实模型、外部系统和 Orbit 生产接口</li></ul><form id="studio-release-form">${field('纳入 / 更新原因','reason','','required maxlength="240" rows="2"',true)}<label class="studio-check"><input type="checkbox" name="confirmed" required>我已核对目标项目和验收证据，同意加入本地团队并授权项目助手调度。</label><button type="submit" class="button primary" ${ready?'':'disabled'}>${agent?'保留新版本并更新团队':'纳入本项目团队'}</button></form>${agent?`<p>当前版本：${escape(agent.activeVersion)} · ${button('查看助手工作区','agent',`data-id="${agent.id}"`)}</p>`:''}<h3>版本与问题回归</h3><p>场景、验收与助手版本保留关联。群内失败记录可登记问题案例，审核预期后回到原场景回归；更新不改写旧记录。</p></section>`;}
  function orbitPage(){
    const current=project();const workspace=data();const entry=scene();const tab=ui.tab[current.id]||'ontology';
    return `<div class="studio-page orbit-page orbit-studio"><header class="studio-page-head"><div><div class="orbit-breadcrumb">${button('业务助手','roster')}<span>／ Orbit</span></div><span class="orbit-eyebrow">DOMAIN ONTOLOGY</span><h1>${tab==='ontology'?'业务本体':escape(entry?.config.name||'业务助手研发')}</h1><p>${tab==='ontology'?'同一种业务表达，找到同一条处理路径。对象、规则与动作，一起定义助手如何工作。':'业务定义形成草案，案例验证处理边界，人工确认后加入本项目。'}</p></div><div>${button('新建助手场景','scene-new','','small')}</div></header><nav class="studio-tabs orbit-workflow" aria-label="业务助手研发步骤">${[['ontology','业务本体'],['config','助手配置'],['tests','案例验收'],['release','加入团队']].map(([value,label],index)=>button('<span>'+String(index+1).padStart(2,'0')+'</span> '+label,'tab',`data-value="${value}" aria-current="${tab===value?'page':'false'}"`,tab===value?'active':'')).join('')}<small>本项目独立 · 本地演示</small></nav>${tab==='ontology'?window.OrbitOntology.page():`<div class="orbit-layout"><aside class="orbit-scenes"><h2>研发场景 <span>${workspace.scenes.length}</span></h2>${workspace.scenes.map(item=>`<button data-action="studio-scene" data-id="${item.id}" aria-current="${item.id===entry?.id?'page':'false'}"><strong>${escape(item.config.name||'未命名场景')}</strong><small>${item.agentId?'已纳入团队':currentRun(item)?.results.every(result=>result.pass)&&item.samples.length?'待确认纳入':'研发中'}</small></button>`).join('')||'<p>从本体动作创建，或新建空白场景。</p>'}${button('返回业务本体','tab','data-value="ontology"')}</aside><section class="orbit-work">${entry?`${entry.config.ontologyBinding?`<div class="orbit-binding-note"><strong>来自业务本体 · O${entry.config.ontologyBinding.revision}</strong><span>${escape(entry.config.ontologyBinding.actionName)} · ${entry.config.ontologyBinding.ruleNames.map(escape).join('、')||'基础人工边界'}${workspace.ontology?.revision!==entry.config.ontologyBinding.revision?' · 本体有新修改；当前草案仍保留原快照，请从本体重新创建以采用新规则。':''}</span></div>`:''}${tab==='tests'?testsPanel(entry):tab==='release'?releasePanel(entry):configPanel(entry)}`:`<div class="orbit-empty"><h2>先定义一位业务助手</h2><p>在本体中选择一个业务动作，可以带入关联对象、必要字段与规则；也可以从空白场景开始。</p>${button('打开业务本体','tab','data-value="ontology"','primary')}${button('新建空白场景','scene-new')}</div>`}</section></div>`}<p class="orbit-local-note">本体为可编辑的示例定义，不是已确认业务事实。仅本地规则演练，未连接真实模型、外部系统或原 Orbit 接口。</p></div>`;
  }
  function saveScene(form){
    if(!form.reportValidity())return;
    const entry=scene();if(!entry)return;const config=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value).trim()]));
    if(['name','goal','keywords','fields','handoff','prompt'].some(key=>!config[key]))return fail('studio-scene-error','请补全必填业务配置。');
    if(Object.values(config).some(unsafe))return fail('studio-scene-error','请移除敏感信息，不填写 API Key 或真实客户资料。');
    if(!toolNames[config.tool])return fail('studio-scene-error','请选择允许的本地动作。');
    if(/[\s@，,。；;]/.test(config.name))return fail('studio-scene-error','助手名称请勿包含空格、@ 或分隔符，便于群内提及。');
    entry.config={...config,...(entry.config.ontologyBinding?{ontologyBinding:entry.config.ontologyBinding}:{})};persist();host.toast('配置已保存，请用当前案例重新验收。');
  }
  function evaluate(){
    const entry=scene();if(!entry)return;
    if(!entry.config.name||!entry.config.keywords||!entry.config.fields)return host.toast('请先完整填写并保存场景配置。',true);
    if(!entry.samples.length)return host.toast('请先添加并核对案例，零案例不能通过。',true);
    const run={id:identifier('EVAL'),time:new Date().toISOString(),fingerprint:fingerprint(entry),config:structuredClone(entry.config),results:entry.samples.map(sample=>{const result=runRules(entry.config,sample.input);return {...result,sampleId:sample.id,input:sample.input,expected:sample.expected,approved:sample.approved,pass:sample.approved&&sample.expected===result.outcome};})};
    entry.runs.push(run);persist();host.render();
  }
  function release(form){
    if(!form.reportValidity())return;const entry=scene();const run=entry&&currentRun(entry);const input=new FormData(form);const reason=String(input.get('reason')||'').trim();
    if(!input.has('confirmed')||!reason||unsafe(reason))return host.toast('请填写不含敏感信息的原因，并确认纳入范围。',true);
    if(!run||!run.results.length||run.results.some(result=>!result.pass))return host.toast('当前配置没有有效的全通过验收，请先重新验证。',true);
    const workspace=data();let agent=workspace.agents.find(agent=>agent.id===entry.agentId);
    if(members().some(member=>member.name===entry.config.name&&member.id!==agent?.id))return host.toast('本项目已有同名成员，请更改定制助手名称后重新验收。',true);
    if(agent?.releases.some(version=>version.runId===run.id))return host.toast('这次验收已经纳入团队，不重复创建版本。');
    if(!agent){agent={id:identifier('ASSISTANT'),name:entry.config.name,role:entry.config.goal,sceneId:entry.id,enabled:true,releases:[],traces:[],cases:[]};workspace.agents.push(agent);entry.agentId=agent.id;}
    const version={version:'V'+(agent.releases.length+1),runId:run.id,projectId:project().id,sceneId:entry.id,time:new Date().toISOString(),config:structuredClone(entry.config),samples:structuredClone(entry.samples),reason};
    agent.releases.push(version);agent.activeVersion=version.version;agent.name=entry.config.name;agent.role=entry.config.goal;
    if(!workspace.profile.allowed.includes(agent.id)){workspace.profile.allowed.push(agent.id);workspace.profileVersions.push({version:'P'+(workspace.profileVersions.length+1),time:new Date().toISOString(),profile:structuredClone(workspace.profile)});}
    persist();host.toast('已纳入当前项目的本地团队，未部署生产环境。');openAgent(agent.id);
  }
  function openAgent(id,tab='traces'){if(!data().agents.some(agent=>agent.id===id))return host.toast('该助手不属于当前项目。',true);ui.agent[project().id]={id,tab};host.navigate('custom-assistant');}
  function agentPage(){
    const selected=ui.agent[project().id];const agent=data().agents.find(agent=>agent.id===selected?.id);
    if(!agent)return `<div class="studio-page"><h1>请选择本项目业务助手</h1>${button('返回业务助手','roster','','primary')}</div>`;
    const tab=selected.tab||'traces';const entry=data().scenes.find(entry=>entry.id===agent.sceneId);
    const content=tab==='cases'?agent.cases.map(item=>`<article class="studio-record"><h3>${escape(item.note)}</h3><p>来源 ${escape(item.traceId)} · 预期 ${outcomes[item.expected]}</p><p>${caseState(agent,item)}</p>${item.sampleId?button('回 Orbit 验收','iterate',`data-id="${agent.id}" data-tab="tests"`):button('确认预期并加入回归','case-approve',`data-id="${item.id}"`)}</article>`).join(''):tab==='samples'?`<p>当前研发场景 ${escape(entry?.config.name)} · ${entry?.samples.length||0} 个案例</p>${entry?.samples.map(sample=>`<article class="studio-record"><p>${escape(sample.input)}</p><small>${sample.approved?'人工预期已确认':'待审核'} · ${outcomes[sample.expected]}</small></article>`).join('')||''}${button('在 Orbit 验收与调整','iterate',`data-id="${agent.id}" data-tab="tests"`,'primary small')}`:tab==='versions'?agent.releases.slice().reverse().map(version=>`<article class="studio-record"><h3>${escape(version.version)} ${version.version===agent.activeVersion?'· 当前本地版本':''}</h3><p>${escape(version.reason)} · ${date(version.time)}</p><small>项目 ${escape(project().name)} / 场景 ${escape(version.config.name)} / ${version.samples.length} 个验收案例</small><details><summary>冻结配置与验收引用</summary><p>${escape(version.config.goal)}</p><p>${escape(version.config.keywords)} · ${escape(version.config.fields)}</p><p>${escape(version.runId)}</p></details>${button('以此版本继续研发','version-draft',`data-version="${version.version}"`)}</article>`).join(''):agent.traces.slice().reverse().map(trace=>`<article class="studio-record" data-trace="${trace.id}"><header><h3>${outcomes[trace.outcome]}</h3><span>${escape(trace.version)} · ${date(trace.time)}</span></header><p>${escape(trace.input)}</p><details><summary>处理步骤、依据与结果</summary><ol>${trace.steps.map(step=>`<li><strong>${escape(step.name)}</strong> · ${escape(step.result)}</li>`).join('')}</ol><p>${escape(trace.output)}</p><small>本地规则执行 · ${escape(trace.profileVersion)} · 非隐式思维</small></details>${button('登记问题案例','badcase',`data-id="${trace.id}"`)}</article>`).join('');
    return `<div class="studio-page"><header class="studio-page-head"><div><span>${escape(project().name)} / Orbit 定制助手</span><h1>${escape(agent.name)}</h1><p>${escape(agent.role)} · ${escape(agent.activeVersion)} · ${agent.enabled?'已加入本地团队':'已暂停'}</p></div><div>${button('去群里协作','use',`data-id="${agent.id}"`)}${button('继续研发','iterate',`data-id="${agent.id}"`,'primary small')}${button(agent.enabled?'暂停分派':'恢复分派','toggle-agent',`data-id="${agent.id}"`)}</div></header><nav class="studio-tabs" aria-label="助手迭代">${[['traces','执行追踪'],['cases','问题案例'],['samples','回归样本'],['versions','验收与版本']].map(([value,label])=>button(label,'agent-tab',`data-value="${value}" aria-current="${tab===value?'page':'false'}"`,tab===value?'active':'')).join('')}</nav><div class="studio-records">${content||'<p class="studio-empty-note">暂无记录。先在本项目群使用助手，结果将关联此助手与当时版本。</p>'}</div></div>`;
  }
  function useMember(id){const member=members().find(member=>member.id===id);if(!member)return;const text='@'+member.name+' ';if(project().id==='AFTERSALES'){window.ProjectHub.setDraft(text);host.navigate('group');}else{data().drafts.group=text;persist();host.navigate('group');} }
  function selectedAgent(){return data().agents.find(agent=>agent.id===ui.agent[project().id]?.id);}
  function caseState(agent,item){const entry=data().scenes.find(scene=>scene.id===agent.sceneId);if(!item.sampleId)return '待人工核对并纳入回归';if(!entry?.samples.some(sample=>sample.id===item.sampleId))return '已移出当前回归集，历史问题保留';const result=currentRun(entry)?.results.find(result=>result.sampleId===item.sampleId);return result?result.pass?'当前配置回归通过，纳入版本须另行确认':'当前回归未通过，请继续修正':'已加入原场景回归，等待重新验收';}
  function dispatch(name,element){
    if(!project())return;const id=element.dataset.id;const value=element.dataset.value;
    if(name==='profile')host.navigate('project-assistant');
    if(name==='orbit'){ui.tab[project().id]='ontology';host.navigate('orbit');}
    if(name==='roster')host.navigate('agents');
    if(name==='scene-new')newScene();
    if(name==='from-role'){const member=baseMembers(project()).find(member=>member.id===id);if(member)newScene({...member,name:member.name+'定制版'});}
    if(name==='scene'&&data().scenes.some(entry=>entry.id===id)){ui.scene[project().id]=id;host.render();}
    if(name==='tab'&&['ontology','config','tests','release'].includes(value)){ui.tab[project().id]=value;host.render();}
    if(name==='members')host.showDialog('本项目成员与职责',project().name,members().map(member=>`<div class="studio-member-detail"><strong>${escape(member.name)}</strong><p>${escape(member.role)}</p></div>`).join(''),host.button('关闭','close-dialog'));
    if(name==='mention-open'){ui.mention=!ui.mention;host.render();document.getElementById('studio-prompt')?.focus();}
    if(name==='mention'){const member=members().find(member=>member.id===id);if(member){const input=document.getElementById('studio-prompt');data().drafts.group=input.value.replace(/@[^\s@]*$/,'')+'@'+member.name+' ';ui.mention=false;persist();host.render();document.getElementById('studio-prompt')?.focus();}}
    if(name==='confirm-group'){host.closeDialog();data().drafts.group=data().drafts.manager;data().drafts.manager='';persist();host.navigate('group');sendChat('group');}
    if(name==='use')useMember(id);
    if(name==='agent')openAgent(id,element.dataset.tab||'traces');
    if(name==='agent-tab'&&['traces','cases','samples','versions'].includes(value)){ui.agent[project().id].tab=value;host.render();}
    if(name==='toggle-agent'){const agent=data().agents.find(agent=>agent.id===id);if(agent){agent.enabled=!agent.enabled;persist();host.render();}}
    if(name==='iterate'){const agent=data().agents.find(agent=>agent.id===id);if(agent){ui.scene[project().id]=agent.sceneId;ui.tab[project().id]=element.dataset.tab||'config';host.navigate('orbit');}}
    if(name==='sample-template'){
      const entry=scene();if(!entry)return;const keyword=entry.config.keywords.split(/[,，、]/)[0];const fields=entry.config.fields.split(/[,，、]/).map(value=>value.trim()).filter(Boolean);
      if(!keyword||!fields.length)return host.toast('先保存受理关键词与必要字段，才能添加示例。',true);
      if(entry.samples.some(sample=>sample.source==='内置示例 · 待人工确认'))return host.toast('示例已添加，请核对，不重复添加。');
      const complete=keyword+'，'+fields.map((field,index)=>field+'：示例内容'+(index+1)).join('，');
      for(const [input,expected] of [[complete,'prepared'],[keyword,'missing'],['请找人工处理这件事','handoff']])entry.samples.push({id:identifier('SAMPLE'),input,expected,approved:false,source:'内置示例 · 待人工确认'});persist();host.render();
    }
    if(name==='sample-remove'){const entry=scene();if(entry){entry.samples=entry.samples.filter(sample=>sample.id!==id);persist();host.render();}}
    if(name==='evaluate')evaluate();
    if(name==='badcase'){const agent=selectedAgent();const trace=agent?.traces.find(trace=>trace.id===id);if(!trace)return;host.showDialog('登记本助手的问题案例','保留来源输入、执行版本；预期由人工重新判断。',`<form id="studio-case-form" data-trace="${trace.id}">${field('问题与修改依据','note','','required maxlength="400" rows="3"',true)}<label class="studio-field"><span>人工预期</span><select name="expected" required><option value="">请选择正确结果</option>${Object.entries(outcomes).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><button type="submit" class="button primary">保存待审核问题</button></form>`,host.button('取消','close-dialog'));}
    if(name==='case-approve'){const agent=selectedAgent();const item=agent?.cases.find(item=>item.id===id);const entry=data().scenes.find(entry=>entry.id===agent?.sceneId);if(item&&!item.sampleId&&entry){const sample={id:identifier('SAMPLE'),input:item.input,expected:item.expected,approved:true,source:'人工确认问题案例 '+item.id};entry.samples.push(sample);item.sampleId=sample.id;persist();host.render();host.toast('已加入该助手原场景回归，需重新验收。');}}
    if(name==='version-draft'){const agent=selectedAgent();const version=agent?.releases.find(version=>version.version===element.dataset.version);const entry=data().scenes.find(entry=>entry.id===agent?.sceneId);if(version&&entry){host.showDialog('用历史版本继续研发','不立即切换运行版本，也不回退案例集。','<p>此操作会替换当前场景配置草稿，保留最新回归案例。重新验收并确认纳入后，团队才使用新版本。</p>',host.button('取消','close-dialog')+button('确认替换配置草稿','version-confirm',`data-version="${version.version}"`,'primary'));}}
    if(name==='version-confirm'){const agent=selectedAgent();const version=agent?.releases.find(version=>version.version===element.dataset.version);const entry=data().scenes.find(entry=>entry.id===agent?.sceneId);if(version&&entry){entry.config=structuredClone(version.config);ui.scene[project().id]=entry.id;ui.tab[project().id]='config';persist();host.closeDialog();host.navigate('orbit');}}
  }
  function configure(adapter){
    host=adapter;
    window.OrbitOntology?.configure(adapter);
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="studio-"]');if(element){event.preventDefault();dispatch(element.dataset.action.slice(7),element);}});
    document.addEventListener('input',event=>{if(event.target.id==='studio-prompt'&&project()){const channel=host.getView().page==='group'?'group':'manager';const value=event.target.value;data().drafts[channel]=unsafe(value)?'':value;persist();const mentioned=channel==='group'&&/@[^\s@]*$/.test(value.slice(0,event.target.selectionStart));if(mentioned!==ui.mention){const caret=event.target.selectionStart;ui.mention=mentioned;host.render();const input=document.getElementById('studio-prompt');input?.focus();input?.setSelectionRange(caret,caret);}}});
    document.addEventListener('change',event=>{const sampleId=event.target.dataset.studioSample||event.target.dataset.studioApprove;if(!sampleId||!project())return;const sample=scene()?.samples.find(sample=>sample.id===sampleId);if(!sample)return;if(event.target.dataset.studioSample){sample.expected=event.target.value;sample.approved=false;}else sample.approved=event.target.checked;persist();host.render();});
    document.addEventListener('keydown',event=>{
      if(event.target.id!=='studio-prompt'||event.isComposing)return;
      const options=[...document.querySelectorAll('.studio-mentions [data-id]')];
      if(ui.mention&&options.length&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();ui.mentionIndex=(ui.mentionIndex+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((option,index)=>option.setAttribute('aria-selected',String(index===ui.mentionIndex)));options[ui.mentionIndex].scrollIntoView({block:'nearest'});return;}
      if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(ui.mention&&options.length){dispatch('mention',options[ui.mentionIndex%options.length]);ui.mentionIndex=0;return;}sendChat(host.getView().page==='group'?'group':'manager');}
      if(event.key==='Escape'&&ui.mention){event.preventDefault();ui.mention=false;host.render();document.getElementById('studio-prompt')?.focus();}
    });
    document.addEventListener('submit',event=>{
      const form=event.target;if(!form.id.startsWith('studio-')||!project())return;event.preventDefault();
      if(form.id==='studio-profile-form')saveProfile(form);
      if(form.id==='studio-scene-form')saveScene(form);
      if(form.id==='studio-chat-form')sendChat(form.dataset.channel);
      if(form.id==='studio-release-form')release(form);
      if(form.id==='studio-sample-form'){const input=new FormData(form);const text=String(input.get('input')||'').trim();const expected=input.get('expected');if(!text||text.length>800||unsafe(text)||!outcomes[expected])return host.toast('请填写脱敏输入，并明确选择人工预期。',true);scene().samples.push({id:identifier('SAMPLE'),input:text,expected,approved:false,source:'人工编写 · 待核对'});persist();host.render();}
      if(form.id==='studio-case-form'){const agent=selectedAgent();const trace=agent?.traces.find(trace=>trace.id===form.dataset.trace);const input=new FormData(form);const note=String(input.get('note')||'').trim();const expected=input.get('expected');if(!trace||!note||unsafe(note)||!outcomes[expected])return host.toast('请补全脱敏的问题依据和人工预期。',true);agent.cases.push({id:identifier('CASE'),traceId:trace.id,version:trace.version,input:trace.input,note,expected,sampleId:''});persist();host.closeDialog();ui.agent[project().id].tab='cases';host.render();}
    });
  }
  function authorizeLegacy(workers){if(!project())throw new Error('请先选择项目。');if(project().id!=='AFTERSALES')throw new Error('不能在当前项目调度售后流程。');const blocked=workers.map(worker=>worker==='knowledge'?'service':worker).filter(worker=>!['manager','expert'].includes(worker)&&!data().profile.allowed.includes(worker));if(blocked.length)throw new Error('当前项目助手未获所需成员授权，请先检查项目助手设置。');}
  return {configure,data,members,contextBar,sidebar,profilePage,chatPage,directory,directoryExtra,orbitEntry,orbitPage,agentPage,legacyCustom,authorizeLegacy,allowed:id=>data()?.profile.allowed.includes(id),dispatch,createFromOntology(config){newScene({config});}};
})();
window.OrbitOntology=(()=>{
  let host;
  let cleanup=()=>{};
  const views=new Map();
  const labels={object:'业务对象',alias:'同义表达',rule:'业务规则',action:'业务动作',human:'人工节点'};
  const colors={object:'#d8bd7f',alias:'#b8c9ab',rule:'#d6a27d',action:'#acc7b7',human:'#adbdd2'};
  const escape=value=>host.escape(String(value??''));
  const button=(label,name,extra='',tone='quiet small')=>{
    const captions={zoom:extra.includes('out')?'缩小':'放大',fit:'适应',pause:view().paused?'播放':'暂停',theme:'明暗',fullscreen:'全屏'};
    return host.button(label+(captions[name]?'<span class="ontology-control-caption">'+captions[name]+'</span>':''),'ontology-'+name,tone,extra);
  };
  const current=()=>window.PortfolioHub.navProject();
  const persist=()=>window.PortfolioHub.persist();
  function view(){
    if(!views.has(current().id))views.set(current().id,{mode:'star',selected:'symptom',theme:'dark',progressive:false,expanded:new Set(['symptom']),dragMode:'branch',zoom:1,pan:{x:0,y:0},paused:false,query:'',filter:'all',positions:{}});
    return views.get(current().id);
  }
  function seed(){
    const aftersales=current().id==='AFTERSALES';
    const nodes=[
      {id:'symptom',name:aftersales?'屏幕无显示':'业务事项',type:'object',description:aftersales?'统一现象名称，归并不同叫法；现象不代表已确认根因。':'统一本项目事项名称，为规则和处理动作提供入口。',fields:aftersales?'产品型号,问题描述':'事项编号,事项描述',keywords:aftersales?'屏幕无显示,黑屏,屏幕不亮':'业务事项,待办,处理'},
      {id:'alias-dark',name:aftersales?'黑屏':'常用叫法',type:'alias',description:'同义表达只归一名称，不自动确认故障原因。'},
      {id:'alias-off',name:aftersales?'屏幕不亮':'补充表达',type:'alias',description:'同一业务含义的另一种表述，关联到统一对象。'},
      {id:'device',name:aftersales?'显示终端':'业务对象',type:'object',description:'界定规则适用的对象范围，不跨项目复用事实数据。',fields:aftersales?'产品型号':'对象名称'},
      {id:'board',name:aftersales?'主控板':'待核查原因',type:'object',description:'仅为待验证的原因假设，不将关联关系当作已确认根因。'},
      {id:'warranty',name:aftersales?'保修待核实':'依据待核实',type:'object',description:'资料不足时保留未知状态，先补充必要信息。',fields:aftersales?'购买日期,设备编号':'依据说明'},
      {id:'rule-check',name:aftersales?'先核实保修':'先核实依据',type:'rule',description:'先核对必填资料，再准备后续动作；缺项先追问。',fields:aftersales?'购买日期,设备编号':'依据说明',transferWords:'资料冲突',blockedTerms:''},
      {id:'rule-replace',name:aftersales?'禁止直接更换':'禁止直接承诺',type:'rule',description:'未经负责人核实，不承诺更换、费用或结果。',fields:'',transferWords:aftersales?'直接更换,承诺换机':'直接承诺',blockedTerms:aftersales?'更换,換机':'承诺'},
      {id:'verify',name:aftersales?'核实保修':'核实依据',type:'action',description:'整理核实清单和现有证据；不查询或判断真实权益。',tool:'summary',fields:aftersales?'产品型号,购买日期,设备编号':'事项编号,依据说明'},
      {id:'draft',name:aftersales?'准备报修草稿':'准备处理草稿',type:'action',description:'收集必要字段，准备待审核草稿，不提交真实系统。',tool:'form',fields:aftersales?'产品型号,问题描述':'事项编号,事项描述'},
      {id:'human',name:'人工复核',type:'human',description:'负责人核对依据、权限与对外承诺。助手不能替代审批。'},
      {id:'escalate',name:'紧急升级',type:'rule',description:'安全风险、紧急事项或主动求助，优先交给人工。',transferWords:aftersales?'冒烟,起火,紧急':'紧急,安全风险',fields:'',blockedTerms:''}
    ];
    const links=[
      ['alias-dark','symptom','同义表达'],['alias-off','symptom','同义表达'],['device','symptom','可能出现'],['board','symptom','原因假设'],['symptom','rule-replace','约束'],['rule-replace','draft','限制动作'],['symptom','rule-check','触发'],['warranty','rule-check','需核实'],['rule-check','verify','执行'],['verify','draft','提供依据'],['draft','human','提交核对'],['escalate','human','交给人工']
    ].map(([source,target,label],index)=>({id:'relation-'+index,source,target,label}));
    return {schema:1,revision:1,nodes,links};
  }
  function data(){
    const workspace=window.ProjectStudio.data();
    if(!workspace.ontology){workspace.ontology=seed();persist();}
    return workspace.ontology;
  }
  const neighbors=identifier=>data().links.flatMap(link=>link.source===identifier?[link.target]:link.target===identifier?[link.source]:[]);
  function related(identifier){return new Set([identifier,...neighbors(identifier)]);}
  function downstream(identifier){
    const found=new Set([identifier]);
    for(let step=0;step<data().nodes.length;step++)for(const link of data().links)if(found.has(link.source))found.add(link.target);
    return found;
  }
  function visibleNodes(){
    const state=view();
    if(!state.progressive)return data().nodes;
    const visible=new Set(['symptom',...state.expanded]);
    for(const identifier of state.expanded)for(const neighbor of neighbors(identifier))visible.add(neighbor);
    return data().nodes.filter(node=>visible.has(node.id));
  }
  function nodeDetail(){
    const model=data();const node=model.nodes.find(item=>item.id===view().selected)||model.nodes[0];
    const relationships=model.links.filter(link=>link.source===node.id||link.target===node.id);
    const options=model.nodes.filter(item=>item.id!==node.id);
    return `<div class="ontology-inspector-heading"><span class="ontology-kind kind-${node.type}">${labels[node.type]}</span><span>O${model.revision} · 示例定义</span></div><h2>${escape(node.name)}</h2><p class="ontology-description">${escape(node.description)}</p>${node.type==='action'?button('由此创建业务助手 '+host.icon('arrow-up-right','small'),'create',`data-id="${node.id}"`,'primary ontology-create'):''}<section class="ontology-detail-section"><h3>关联关系 <span>${relationships.length}</span></h3>${relationships.map(link=>{const target=model.nodes.find(item=>item.id===(link.source===node.id?link.target:link.source));return `<button class="ontology-relation" data-action="ontology-select" data-id="${target.id}"><span>${escape(link.label)}${link.label==='原因假设'?' · 待验证':''}</span><strong>${escape(target.name)} ${host.icon('arrow-up-right','small')}</strong></button>`;}).join('')||'<p>暂无关系。可在下方添加本项目关系。</p>'}</section><details class="ontology-editor"><summary>编辑${labels[node.type]}</summary><form id="ontology-node-form" data-id="${node.id}"><label>名称<input name="name" value="${escape(node.name)}" required maxlength="30"></label><label>定义与边界<textarea name="description" required maxlength="240" rows="3">${escape(node.description)}</textarea></label>${['rule','action','object'].includes(node.type)?`<label>必要字段（逗号分隔）<input name="fields" value="${escape(node.fields||'')}" maxlength="160"></label>`:''}${node.type==='object'?`<label>受理表达（逗号分隔）<input name="keywords" value="${escape(node.keywords||'')}" maxlength="160"></label>`:''}${node.type==='rule'?`<label>触发转人工的表达<input name="transferWords" value="${escape(node.transferWords||'')}" maxlength="160"></label>`:''}<button class="button small" type="submit">保存本项目定义</button><p class="ontology-form-note">更新不会改写已验收的助手版本。</p></form></details><details class="ontology-editor"><summary>添加关联关系</summary><form id="ontology-relation-form" data-id="${node.id}"><label>关系<select name="label"><option>关联</option><option>约束</option><option>执行</option><option>需核实</option><option>原因假设</option><option>同义表达</option></select></label><label>关联到<select name="target">${options.map(item=>`<option value="${item.id}">${escape(item.name)}</option>`).join('')}</select></label><button class="button small" type="submit">添加关系</button><p class="ontology-form-note">关系影响从动作创建的下一份草案；不改变已发布版本。</p></form></details><div class="ontology-inspector-foot">${host.icon('shield-check','small')}<span>对象不是事实结论<br>关系不是自动执行授权</span></div>`;
  }
  function page(){
    const model=data();const state=view();
    return `<details class="ontology-guide"><summary><span>${host.icon('help','small')} 怎么理解本体、关系与规则？</span><span>展开说明</span></summary><div><p><b>对象</b>统一业务名称；<b>关系</b>连接适用范围与依据；<b>规则</b>明确先做什么、何时转人工；<b>动作</b>生成可验收的助手草案。</p><p>例如“黑屏”与“屏幕不亮”归到同一现象，再按关联规则核实保修。主控板仅是原因假设，不直接得出更换结论。</p></div></details><section id="ontology-shell" class="ontology-shell ${state.theme==='light'?'is-light':''} ${state.paused?'is-paused':''}"><header class="ontology-toolbar"><div class="ontology-segments" role="group" aria-label="本体视图">${button('业务链路','mode','data-value="flow" aria-pressed="'+(state.mode==='flow')+'"',state.mode==='flow'?'active':'')}${button('关系星图','mode','data-value="star" aria-pressed="'+(state.mode==='star')+'"',state.mode==='star'?'active':'')}</div><div class="ontology-controls"><label class="ontology-check"><input type="checkbox" id="ontology-progressive" ${state.progressive?'checked':''}>逐级展开</label><select id="ontology-drag-mode" aria-label="节点拖动方式"><option value="branch" ${state.dragMode==='branch'?'selected':''}>拖动关联分支</option><option value="single" ${state.dragMode==='single'?'selected':''}>只拖动当前节点</option></select>${button(host.icon('minus','small'),'zoom','data-value="out" aria-label="缩小图谱"')}${button(host.icon('plus','small'),'zoom','data-value="in" aria-label="放大图谱"')}${button(host.icon('arrows-maximize','small'),'fit','aria-label="适应画布"')}${button(host.icon(state.paused?'player-play':'player-pause','small'),'pause',`aria-label="${state.paused?'播放':'暂停'}动效" aria-pressed="${state.paused}"`)}${button(host.icon('sun','small'),'theme','aria-label="切换画布明暗"')}${button(host.icon('maximize','small'),'fullscreen','aria-label="全屏图谱"')}</div></header><div class="ontology-body"><div class="ontology-stage"><div class="ontology-canvas-caption"><span>${host.icon('share','small')} <b>${model.nodes.length}</b> 个元素 · <b>${model.links.length}</b> 条关系</span><small>从现象、依据到处理动作 · 示例业务定义</small></div><div class="ontology-search"><label>${host.icon('search','small')}<input id="ontology-search" value="${escape(state.query)}" placeholder="查找对象、规则或动作" aria-label="查找本体节点" autocomplete="off"></label><div id="ontology-search-results" class="ontology-search-results" hidden></div></div><div id="ontology-viewport" class="ontology-viewport" aria-label="可交互业务本体图谱"><canvas id="ontology-canvas" aria-hidden="true"></canvas><div id="ontology-nodes" class="ontology-nodes"></div></div><div class="ontology-stage-footer"><div class="ontology-legend" role="group" aria-label="按类型高亮">${Object.entries(labels).filter(([key])=>key!=='alias').map(([key,label])=>`<button data-action="ontology-filter" data-value="${key}" aria-pressed="${state.filter===key}"><i style="--node-color:${colors[key]}"></i>${label}</button>`).join('')}</div><span id="ontology-zoom">${Math.round(state.zoom*100)}%</span></div><p class="ontology-hint">拖动节点整理关系 · 拖动空白平移 · 点击查看定义 · ${state.progressive?'点击节点继续展开':'滚轮缩放'}</p><div id="ontology-live" class="sr-only" aria-live="polite"></div></div><aside id="ontology-inspector" class="ontology-inspector" aria-label="节点定义与业务规则">${nodeDetail()}</aside></div></section><div class="ontology-next"><div><strong>从关系走向业务执行</strong><p>选择“核实保修”或“准备草稿”等动作，把关联字段与转人工规则带入助手配置。</p></div>${button('查看助手研发场景','scenes','','small')}</div>`;
  }
  function configFromAction(identifier){
    const model=data();const action=model.nodes.find(node=>node.id===identifier&&node.type==='action');
    if(!action)throw new Error('请选择业务动作，再创建助手草案。');
    const ancestors=new Set([action.id]);
    for(let step=0;step<model.nodes.length;step++)for(const link of model.links)if(ancestors.has(link.target)&&link.label!=='原因假设')ancestors.add(link.source);
    const outcomes=downstream(action.id);
    for(const link of model.links)if(outcomes.has(link.target)&&model.nodes.some(node=>node.id===link.target&&node.type==='human')&&model.nodes.some(node=>node.id===link.source&&node.type==='rule'))ancestors.add(link.source);
    const connected=model.nodes.filter(node=>ancestors.has(node.id));
    const rules=connected.filter(node=>node.type==='rule');
    const split=value=>String(value||'').split(/[,，、\n]/).map(item=>item.trim()).filter(Boolean);
    const fields=[...new Set([action,...rules,...connected.filter(node=>node.type==='object')].flatMap(node=>split(node.fields)))].join(',');
    const keywords=[...new Set(connected.filter(node=>['object','alias'].includes(node.type)).flatMap(node=>[node.name,...split(node.keywords)]))].join(',');
    const transferWords=[...new Set(rules.flatMap(node=>split(node.transferWords)))].join(',');
    return {name:action.name+'助手',goal:action.description,keywords:keywords||action.name,fields:fields||'事项描述',transferWords,tool:action.tool||'summary',handoff:[...rules.map(node=>node.description),'超出权限、风险承诺及主动求助交人工；不自动发送或提交。'].join(' ').slice(0,400),knowledge:'本项目业务本体 O'+model.revision,prompt:'依据本项目关联规则整理草稿；缺项先追问，根因假设不能当作事实，对外动作由人工确认。',ontologyBinding:{revision:model.revision,projectId:current().id,actionId:action.id,actionName:action.name,ruleNames:rules.map(node=>node.name),nodes:structuredClone(connected),links:structuredClone(model.links.filter(link=>ancestors.has(link.source)&&ancestors.has(link.target)))}};
  }
  function select(identifier){
    const node=data().nodes.find(item=>item.id===identifier);if(!node)return;
    view().selected=identifier;
    if(view().progressive)view().expanded.add(identifier);
    const inspector=document.getElementById('ontology-inspector');if(inspector)inspector.innerHTML=nodeDetail();
    const results=document.getElementById('ontology-search-results');if(results)results.hidden=true;
    const live=document.getElementById('ontology-live');if(live)live.textContent=node.name+'，'+labels[node.type]+'，'+neighbors(identifier).length+' 个关联';
    mounted?.refresh();
  }
  let mounted=null;
  function dispatch(name,element){
    if(!current())return;
    const state=view();const value=element.dataset.value;
    if(name==='select')select(element.dataset.id);
    if(name==='mode'&&['star','flow'].includes(value)){state.mode=value;state.pan={x:0,y:0};state.zoom=1;document.querySelectorAll('[data-action="ontology-mode"]').forEach(control=>{const active=control.dataset.value===value;control.classList.toggle('active',active);control.setAttribute('aria-pressed',String(active));});mounted?.layout();}
    if(name==='zoom')mounted?.zoom(value==='in'?1.2:1/1.2);
    if(name==='fit'){state.pan={x:0,y:0};state.zoom=1;state.positions={};document.getElementById('ontology-zoom').textContent='100%';mounted?.layout();}
    if(name==='pause'){state.paused=!state.paused;document.getElementById('ontology-shell')?.classList.toggle('is-paused',state.paused);element.setAttribute('aria-pressed',String(state.paused));element.setAttribute('aria-label',state.paused?'播放动效':'暂停动效');element.innerHTML=host.icon(state.paused?'player-play':'player-pause','small')+'<span class="ontology-control-caption">'+(state.paused?'播放':'暂停')+'</span>';mounted?.wake();}
    if(name==='theme'){state.theme=state.theme==='dark'?'light':'dark';document.getElementById('ontology-shell')?.classList.toggle('is-light',state.theme==='light');mounted?.wake();}
    if(name==='filter'){state.filter=state.filter===value?'all':value;document.querySelectorAll('[data-action="ontology-filter"]').forEach(control=>control.setAttribute('aria-pressed',String(control.dataset.value===state.filter)));mounted?.refresh();}
    if(name==='fullscreen'){const shell=document.getElementById('ontology-shell');if(document.fullscreenElement)document.exitFullscreen?.();else if(shell?.requestFullscreen)shell.requestFullscreen().catch(()=>host.toast('当前窗口不支持全屏，可以使用适应画布。',true));}
    if(name==='scenes')window.ProjectStudio.dispatch('tab',{dataset:{value:'config'}});
    if(name==='create'){
      try{window.ProjectStudio.createFromOntology(configFromAction(element.dataset.id));host.toast('已带入关联字段与规则，生成助手配置草案；尚未加入团队。');}catch(error){host.toast(error.message,true);}
    }
  }
  function mount(){
    cleanup();mounted=null;
    const viewport=document.getElementById('ontology-viewport');if(!viewport)return;
    const state=view();const model=data();const canvas=document.getElementById('ontology-canvas');const layer=document.getElementById('ontology-nodes');const context=canvas.getContext('2d');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const controllers=new AbortController();const signal=controllers.signal;
    let frame=0;let disposed=false;let width=0;let height=0;let animationStart=performance.now();let layoutStart=animationStart;let lastDraw=0;let dragging=null;let suppressClick=false;let targets={};let starts={};let positions={};
    const nodeButtons=new Map();
    const stars=Array.from({length:76},(_,index)=>({x:((index*197+71)%997)/997,y:((index*331+41)%991)/991,size:index%9===0?1.15:.6,phase:index*.63}));
    const locations={symptom:[.25,.48],'alias-dark':[.12,.28],'alias-off':[.14,.71],device:[.43,.15],board:[.66,.16],warranty:[.39,.82],'rule-check':[.50,.59],'rule-replace':[.49,.34],verify:[.69,.69],draft:[.79,.40],human:[.88,.81],escalate:[.63,.89]};
    const flowLocations={symptom:[.13,.45],'alias-dark':[.13,.18],'alias-off':[.13,.72],device:[.33,.18],board:[.53,.18],warranty:[.33,.74],'rule-check':[.50,.61],'rule-replace':[.50,.36],verify:[.70,.68],draft:[.70,.38],human:[.88,.52],escalate:[.70,.87]};
    function scalePoint(point){return {x:(point.x-width/2)*state.zoom+width/2+state.pan.x,y:(point.y-height/2)*state.zoom+height/2+state.pan.y};}
    function worldPoint(clientX,clientY){const bounds=viewport.getBoundingClientRect();return {x:(clientX-bounds.left-width/2-state.pan.x)/state.zoom+width/2,y:(clientY-bounds.top-height/2-state.pan.y)/state.zoom+height/2};}
    function targetPositions(){
      const layout=state.mode==='flow'?flowLocations:locations;const padding=50;
      return Object.fromEntries(model.nodes.map(node=>{const spot=state.positions[state.mode+':'+node.id]||layout[node.id]||[.5,.5];return [node.id,{x:padding+spot[0]*(width-padding*2),y:22+spot[1]*(height-52)}];}));
    }
    function wake(){if(!frame&&!disposed&&!document.hidden)frame=requestAnimationFrame(draw);}
    function refresh(){
      const visible=new Set(visibleNodes().map(node=>node.id));const focused=related(state.selected);
      for(const [identifier,element] of nodeButtons){
        const node=model.nodes.find(item=>item.id===identifier);element.hidden=!visible.has(identifier);
        const dim=(state.filter!=='all'&&node.type!==state.filter)||(state.query&&!node.name.includes(state.query));
        element.classList.toggle('is-dim',dim);element.classList.toggle('is-selected',state.selected===identifier);element.classList.toggle('is-related',focused.has(identifier));element.setAttribute('aria-pressed',String(state.selected===identifier));
      }
      wake();
    }
    function layout(){starts=structuredClone(positions);targets=targetPositions();layoutStart=performance.now();wake();}
    function resize(){
      const bounds=viewport.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
      width=bounds.width;height=bounds.height;const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);targets=targetPositions();positions=structuredClone(targets);starts=structuredClone(targets);layoutStart=performance.now();wake();
    }
    function zoom(multiplier,anchor){
      const previous=state.zoom;state.zoom=Math.max(.5,Math.min(2.5,state.zoom*multiplier));
      if(anchor){const center={x:width/2,y:height/2};state.pan.x=anchor.x-center.x-(anchor.x-center.x-state.pan.x)*state.zoom/previous;state.pan.y=anchor.y-center.y-(anchor.y-center.y-state.pan.y)*state.zoom/previous;}
      document.getElementById('ontology-zoom').textContent=Math.round(state.zoom*100)+'%';wake();
    }
    function draw(now){
      frame=0;if(disposed)return;
      const reduced=motion.matches;const isStill=state.paused||reduced;const elapsed=(now-animationStart)/1000;const progress=isStill?1:Math.min(1,(now-layoutStart)/560);const eased=1-Math.pow(1-progress,4);const light=state.theme==='light';
      context.clearRect(0,0,width,height);
      for(const star of stars){context.beginPath();context.fillStyle=light?'rgba(63,88,66,.17)':'rgba(184,206,177,'+(isStill?.18:.12+.09*(1+Math.sin(elapsed*.55+star.phase))/2)+')';context.arc(star.x*width,star.y*height,star.size,0,Math.PI*2);context.fill();}
      for(const node of model.nodes){const target=targets[node.id];const start=starts[node.id]||target;if(!target)continue;positions[node.id]={x:start.x+(target.x-start.x)*eased,y:start.y+(target.y-start.y)*eased};const point=scalePoint(positions[node.id]);const element=nodeButtons.get(node.id);element.style.transform=`translate(${point.x}px,${point.y}px)`;}
      const visible=new Set(visibleNodes().map(node=>node.id));const focus=related(state.selected);
      for(const link of model.links){
        if(!visible.has(link.source)||!visible.has(link.target))continue;
        const source=scalePoint(positions[link.source]);const target=scalePoint(positions[link.target]);const distance=Math.hypot(target.x-source.x,target.y-source.y);if(distance<32)continue;
        const unitX=(target.x-source.x)/distance;const unitY=(target.y-source.y)/distance;const start={x:source.x+unitX*15,y:source.y+unitY*15};const end={x:target.x-unitX*18,y:target.y-unitY*18};const active=link.source===state.selected||link.target===state.selected;
        context.strokeStyle=active?(light?'#728662':'#b9c496'):(light?'rgba(77,103,80,.25)':'rgba(148,175,153,.29)');context.lineWidth=active?1.45:1;context.setLineDash(link.label==='原因假设'?[3,5]:[]);context.beginPath();context.moveTo(start.x,start.y);context.lineTo(end.x,end.y);context.stroke();context.setLineDash([]);
        context.fillStyle=context.strokeStyle;context.beginPath();context.moveTo(end.x,end.y);context.lineTo(end.x-unitX*6-unitY*3,end.y-unitY*6+unitX*3);context.lineTo(end.x-unitX*6+unitY*3,end.y-unitY*6-unitX*3);context.closePath();context.fill();
        if(active&&!isStill){const travel=(elapsed*.12+model.links.indexOf(link)*.17)%1;context.beginPath();context.fillStyle=light?'#728662':'#d8d8aa';context.arc(start.x+(end.x-start.x)*travel,start.y+(end.y-start.y)*travel,1.8,0,Math.PI*2);context.fill();}
      }
      for(const node of model.nodes){if(!visible.has(node.id))continue;const point=scalePoint(positions[node.id]);const active=focus.has(node.id);if(!active)continue;const radius=node.id===state.selected?30:18;const pulse=isStill?0:Math.sin(elapsed*1.4+model.nodes.indexOf(node))*.8;context.strokeStyle=light?'rgba(101,124,81,.13)':'rgba(169,191,153,.14)';context.lineWidth=1;context.beginPath();context.arc(point.x,point.y,radius+pulse,0,Math.PI*2);context.stroke();}
      lastDraw=now;
      if(!isStill||progress<1)wake();
    }
    for(const [index,node] of model.nodes.entries()){
      const element=document.createElement('button');element.type='button';element.className='ontology-node node-'+node.type;element.dataset.node=node.id;element.setAttribute('aria-label',node.name+'，'+labels[node.type]+'，点击查看关联');element.style.setProperty('--node-color',colors[node.type]);element.style.setProperty('--reveal-delay',Math.min(index*35,350)+'ms');element.innerHTML='<span class="ontology-node-dot"><i></i></span><span class="ontology-node-label">'+escape(node.name)+'</span>';element.title=node.name+' · '+labels[node.type];layer.append(element);nodeButtons.set(node.id,element);
    }
    viewport.addEventListener('click',event=>{if(suppressClick){suppressClick=false;return;}const node=event.target.closest('[data-node]');if(node)select(node.dataset.node);},{signal});
    viewport.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;const node=event.target.closest('[data-node]');const identifiers=node?(state.dragMode==='branch'?related(node.dataset.node):new Set([node.dataset.node])):new Set();
      dragging={pointerId:event.pointerId,node:node?.dataset.node,start:{x:event.clientX,y:event.clientY},world:worldPoint(event.clientX,event.clientY),positions:structuredClone(positions),pan:{...state.pan},identifiers,moved:false};viewport.setPointerCapture(event.pointerId);
    },{signal});
    viewport.addEventListener('pointermove',event=>{
      if(!dragging||dragging.pointerId!==event.pointerId)return;const deltaX=event.clientX-dragging.start.x;const deltaY=event.clientY-dragging.start.y;if(Math.hypot(deltaX,deltaY)>4)dragging.moved=true;if(!dragging.moved)return;
      viewport.classList.add('is-dragging');
      if(dragging.node){for(const identifier of dragging.identifiers){const start=dragging.positions[identifier];const next={x:Math.max(30,Math.min(width-30,start.x+deltaX/state.zoom)),y:Math.max(22,Math.min(height-22,start.y+deltaY/state.zoom))};state.positions[state.mode+':'+identifier]=[(next.x-50)/(width-100),(next.y-22)/(height-52)];positions[identifier]=next;targets[identifier]=next;starts[identifier]=next;}}
      else{state.pan.x=dragging.pan.x+deltaX;state.pan.y=dragging.pan.y+deltaY;}
      wake();
    },{signal});
    const endDrag=event=>{if(!dragging||dragging.pointerId!==event.pointerId)return;suppressClick=dragging.moved;const identifier=dragging.node;dragging=null;viewport.classList.remove('is-dragging');if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);if(identifier&&!suppressClick)select(identifier);};
    viewport.addEventListener('pointerup',endDrag,{signal});viewport.addEventListener('pointercancel',endDrag,{signal});
    viewport.addEventListener('wheel',event=>{event.preventDefault();const bounds=viewport.getBoundingClientRect();zoom(Math.exp(-event.deltaY*.001),{x:event.clientX-bounds.left,y:event.clientY-bounds.top});},{signal,passive:false});
    viewport.addEventListener('keydown',event=>{const node=event.target.closest('[data-node]');if(!node)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const options=visibleNodes();const index=options.findIndex(item=>item.id===node.dataset.node);const next=options[(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+options.length)%options.length];nodeButtons.get(next.id).focus();select(next.id);}},{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();},{signal});motion.addEventListener('change',wake,{signal});
    const observer=new ResizeObserver(resize);observer.observe(viewport);resize();refresh();
    mounted={refresh,layout,zoom,wake,positions:()=>structuredClone(positions),lastDraw:()=>lastDraw};
    cleanup=()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controllers.abort();layer.replaceChildren();};
  }
  function configure(adapter){
    host=adapter;
    const paths={minus:'<path d="M5 12h14"/>',share:'<circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4m-6 8 6 4"/>','arrows-maximize':'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8 3 3m13 5 5-5M8 16l-5 5m13-5 5 5"/>',maximize:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'};
    for(const [name,path] of Object.entries(paths))if(!window.HUB_ICONS[name])window.HUB_ICONS[name]='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="ontology-"]');if(element){event.preventDefault();dispatch(element.dataset.action.slice(9),element);}});
    document.addEventListener('change',event=>{if(event.target.id==='ontology-progressive'){view().progressive=event.target.checked;view().expanded=new Set(['symptom']);select('symptom');}if(event.target.id==='ontology-drag-mode')view().dragMode=event.target.value;});
    document.addEventListener('input',event=>{if(event.target.id!=='ontology-search')return;view().query=event.target.value.trim();const results=document.getElementById('ontology-search-results');const matches=data().nodes.filter(node=>node.name.includes(view().query));results.hidden=!view().query;results.innerHTML=matches.length?matches.map(node=>button(escape(node.name)+' <small>'+labels[node.type]+'</small>','select',`data-id="${node.id}"`)).join(''):'<p>没有匹配的定义</p>';mounted?.refresh();});
    document.addEventListener('submit',event=>{
      const form=event.target;if(!['ontology-node-form','ontology-relation-form'].includes(form.id))return;event.preventDefault();if(!form.reportValidity())return;
      const model=data();const node=model.nodes.find(item=>item.id===form.dataset.id);if(!node)return;const input=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value).trim()]));
      if(Object.values(input).some(value=>host.isSensitive(value)))return host.toast('请先移除敏感信息，本体中只保存业务定义。',true);
      if(form.id==='ontology-node-form'){
        if(!input.name||!input.description)return host.toast('名称和定义不能为空。',true);
        if(model.nodes.some(item=>item.id!==node.id&&item.name===input.name))return host.toast('本项目已有同名定义，请使用不同名称。',true);
        Object.assign(node,input);
      }else{
        if(!model.nodes.some(item=>item.id===input.target)||input.target===node.id)return host.toast('请选择有效的关联对象。',true);
        if(model.links.some(link=>link.source===node.id&&link.target===input.target&&link.label===input.label))return host.toast('这条关系已经存在。',true);
        model.links.push({id:'relation-'+crypto.randomUUID(),source:node.id,target:input.target,label:input.label});
      }
      model.revision+=1;persist();host.render();host.toast('已保存本项目定义，已验收的助手版本保持不变。');
    });
  }
  return {configure,page,mount,data,configFromAction,view,positions:()=>mounted?.positions()||{},lastFrame:()=>mounted?.lastDraw()||0};
})();
