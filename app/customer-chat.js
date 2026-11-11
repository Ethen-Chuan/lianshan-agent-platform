window.CustomerChat=(()=>{
  let host;
  let connection=null;
  let checked=false;
  let loading=false;
  let connectionError='';
  let pending=null;
  let viewState=null;
  const consent=new Map();
  const policy=window.CustomerChatPolicy;
  const local=()=>!window.LIANSHAN_PUBLIC_DEMO&&location.protocol==='http:'&&location.hostname==='127.0.0.1';
  const current=()=>host.current()?.mode==='model'?host.current():null;
  const active=()=>window.PortfolioHub.navProject()?.id==='AFTERSALES';
  const escape=value=>host.escape(String(value??''));
  const button=(label,name,attributes='',tone='quiet small')=>host.button(label,'customer-'+name,tone,attributes);
  const signature=()=>connection?connection.csrf+':'+connection.meta.revision:'';
  const authorized=session=>!!connection?.meta.configured&&consent.get(session?.id)===signature();
  const enabled=()=>{const service=host.getState().agents.find(entry=>entry.id==='service');return service?.enabled&&service.mode==='auto';};
  const repaint=()=>{if(active())host.render();};
  function messages(session){return session.messages.filter(entry=>['customer','agent'].includes(entry.role)).map(entry=>({role:entry.role==='customer'?'user':'assistant',content:entry.text}));}
  function knowledge(session){return policy.selectKnowledge(host.getState().knowledge,messages(session));}
  function stop(session=current(),message='请求已停止；已发出的请求仍可能计费。'){
    if(!pending||pending.session!==session)return;
    const request=pending;pending=null;request.controller.abort();
    if(session&&!session.caseId){session.modelError=message;session.status='model-error';host.persist();}
    repaint();
  }
  function invalidate(){stop();connection=null;checked=false;consent.clear();}
  async function refresh(){
    if(loading||!active())return;
    checked=true;connectionError='';
    if(!local()){connection=null;connectionError='此页面为静态演示，不能保存密钥或调用模型。请使用本机服务版。';repaint();return;}
    loading=true;repaint();
    try{
      const response=await fetch('/api/model-connections',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw Error('本机模型服务不可用，请检查服务是否启动。');
      const data=await response.json();
      const meta=data.connections?.find(entry=>entry.agentId==='service');
      if(data.mode!=='local-server'||!data.capabilities?.includes('customer-chat-v1')||!meta||typeof data.csrf!=='string')throw Error('当前服务尚不支持模型对话，请启动更新后的本机服务。');
      const previous=signature();connection={csrf:data.csrf,meta};
      if(previous!==signature())consent.clear();
    }catch(error){connection=null;consent.clear();connectionError=error.message==='Failed to fetch'?'无法连接本机模型服务，请重试。':error.message;}
    finally{loading=false;repaint();}
  }
  async function send(text,retry=false){
    const session=current();const value=String(text||'').trim();
    if(!active()||!session||pending)return;
    if(!retry&&session.messages.at(-1)?.role==='customer'&&!session.caseId)return host.toast('上一条尚未完成，请重试或新建对话。',true);
    if(session.caseId){if(policy.sensitive(value))return host.toast('请先移除个人信息或凭证。',true);return host.submitCustomer(value);}
    if(!enabled())return host.toast('自动接待已暂停，请启用后重试或转人工。',true);
    if(!authorized(session))return host.toast('请先配置模型，并确认本次会话的数据范围与费用。',true);
    if(!retry&&(!value||value.length>800||policy.sensitive(value)))return host.toast('请使用 800 字以内的脱敏问题，不输入真实客户资料或凭证。',true);
    if(retry&&session.messages.at(-1)?.role!=='customer')return;
    const candidate=retry?messages(session):[...messages(session),{role:'user',content:value}];
    const selected=policy.selectKnowledge(host.getState().knowledge,candidate);
    const payload={agentId:'service',projectId:'AFTERSALES',expectedRevision:connection.meta.revision,consent:true,messages:candidate,knowledge:selected};
    try{policy.prepare(payload);}catch(error){return host.toast(error.message,true);}
    if(!retry){session.messages.push({role:'customer',text:value,time:new Date().toISOString()});session.draft='';}
    const request={session,controller:new AbortController(),signature:signature(),context:connection,knowledge:JSON.stringify(selected)};
    pending=request;session.modelError='';session.status='model-pending';session.resolved=false;session.resolvedAt=null;
    const codes=[...new Set(candidate.filter(message=>message.role==='user').flatMap(message=>message.content.match(/\b[A-UW-Z]\d{1,3}\b/gi)||[]).map(code=>code.toUpperCase()))];
    const versions=[...new Set(candidate.filter(message=>message.role==='user').flatMap(message=>message.content.match(/\bV\d+(?:\.\d+){1,3}\b/gi)||[]).map(version=>version.toUpperCase()))];
    session.product=codes.length===1?host.getState().knowledge.find(entry=>entry.product.endsWith(' '+codes[0])||entry.product===codes[0])?.product||codes[0]:'待确认';
    session.productSource='客户表述，尚未验证';session.version=versions.length===1?versions[0]:'待确认';
    host.persist();repaint();
    const timer=setTimeout(()=>request.controller.abort(),35000);
    try{
      const response=await fetch('/api/model-connections/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Session':request.context.csrf},body:JSON.stringify(payload),signal:request.controller.signal});
      let result;
      try{result=await response.json();}catch{throw Error('本机服务响应格式不正确；未使用预设回复。');}
      if(!response.ok)throw Error(result.error||'模型请求未完成，请重试。');
      if(pending!==request||request.controller.signal.aborted||session.caseId)return;
      if(!active()||signature()!==request.signature||!enabled())throw Error('项目、连接或接待策略已变化，本次结果未采用。');
      if(JSON.stringify(knowledge(session))!==request.knowledge)throw Error('引用知识已变化，本次结果未采用，请重新发送。');
      if(result.origin!=='model'||result.revision!==payload.expectedRevision||result.provider!==request.context.meta.provider||result.model!==request.context.meta.model||typeof result.reply!=='string'||policy.sensitive(result.reply)||host.checkRisk?.(result.reply))throw Error('模型结果未通过检查，请转人工核对。');
      const verified=policy.parseReply(JSON.stringify({reply:result.reply,status:result.status,sources:result.sources?.map(source=>source.id)}),policy.prepare(payload));
      const sources=verified.sources.map(source=>[source.id,source.title,source.version].join(' · '));
      session.messages.push({role:'agent',text:verified.reply,time:new Date().toISOString(),source:sources.join('；'),model:{provider:result.provider,name:result.model,latencyMs:result.latencyMs},origin:'model'});
      session.status=verified.status;session.handoffReason=verified.status==='needs-human'?'模型建议人工核实':'';
      session.lastModel={provider:result.provider,name:result.model,latencyMs:result.latencyMs};
    }catch(error){
      if(pending!==request||session.caseId)return;
      session.modelError=request.controller.signal.aborted?'请求超时或已停止；可手动重试，可能再次计费。':error.message;
      session.status='model-error';
    }finally{clearTimeout(timer);if(pending===request){pending=null;host.persist();repaint();}}
  }
  function page(){
    const session=current();const meta=connection?.meta;const busy=pending?.session===session&&!!session;
    const title=meta?.configured?window.HubModelProviders.providers[meta.provider].name+' · '+meta.model:'尚未连接模型';
    const history=host.sessions().filter(entry=>entry.mode==='model');
    const status=busy?'模型正在回复…':session?.caseId?'已交接客服，模型停止回复':session?.modelError?'请求未完成':session?.resolved?'客户已确认解决':session?.status==='answered'?'已回答，待客户确认':session?.status==='needs-human'?'建议转人工':session?.status==='collecting'?'等待补充信息':'等待提问';
    return `<section class="journey customer-model"><header class="journey-heading"><div><span class="aw-eyebrow">客户视角 / 模型对话</span><h1>客户体验</h1><p>自由提问与追问，不连接真实客户渠道。</p></div>${host.button('切换到客服视角','navigate','small','data-page="workspace"')}</header>${host.modeTabs()}<div class="customer-model-bar"><div><strong>${escape(title)}</strong><span>${loading?'正在检查连接':meta?.configured?'真实模型请求 · 业务操作仍为模拟':'配置接待助手后开始测试'}</span></div><div>${button('配置模型','configure')}${button('刷新','refresh',loading?'disabled':'')}${button('新对话','new','','primary small')}</div></div>${connectionError?`<p class="customer-notice" role="status">${escape(connectionError)}</p>`:''}<div class="customer-model-layout"><section class="journey-phone"><header>${window.HubIdentity.worker('service','sm')}<div><strong>连山服务助手</strong><small>${escape(session?.lastModel?'最近回复：'+session.lastModel.name:'模型回复，无预设答案')}</small></div></header><div class="journey-messages" id="customer-model-messages" aria-label="客户对话记录">${session?host.publicMessages(session).map(message=>`<article class="${message.role==='customer'?'from-customer':''}"><span>${message.role==='customer'?'客户':message.role==='staff'?'客服':'服务助手'}</span><p>${escape(message.text)}</p>${message.source?`<small>参考知识：${escape(message.source)}</small>`:''}</article>`).join(''):''}${!session?.messages.length?`<div class="customer-empty"><h3>用客户的问题试一试</h3><p>可以换一种问法、追问，或要求转人工。</p>${!session?button('开始新对话','new','','small'):''}</div>`:''}</div><div class="journey-controls"><p role="status" aria-live="polite">${escape(status)}</p>${session?.modelError?`<p class="customer-error" role="alert">${escape(session.modelError)}</p>`:''}${session?`<div class="customer-actions">${busy?button('停止回复','stop'):session.modelError&&!session.caseId?button('重试本条','retry','','small'):''}${host.canConfirm(session)?button('客户确认：问题已解决','resolve','','small'):''}${button(session.caseId?'去客服继续处理':'携带记录转人工','handoff')}</div><form id="customer-model-form"><label class="sr-only" for="customer-model-input">客户问题</label><textarea id="customer-model-input" name="text" rows="3" maxlength="800" ${busy||(!session.caseId&&!!session.modelError)?'disabled':''} placeholder="输入客户问题，例如：我的 A1 在哪里查看软件版本？">${escape(session.draft)}</textarea>${!session.caseId?`<label class="customer-consent"><input id="customer-model-consent" type="checkbox" ${authorized(session)?'checked':''} ${busy||!meta?.configured?'disabled':''}><span>同意本会话向 ${escape(meta?.configured?window.HubModelProviders.providers[meta.provider].name:'所选服务商')} 发送对话及匹配的已审核知识，可能产生费用。仅使用脱敏内容。</span></label>`:''}<div class="customer-send"><small>${session.caseId?'只发到本地客服会话':Math.floor(session.messages.length/2)+' / 15 轮 · 不自动重试'}</small><button type="submit" class="button primary" ${busy||(!session.caseId&&(!authorized(session)||!!session.modelError||!enabled()))?'disabled':''}>${session.caseId?'发送给客服':'发送'}</button></div></form>`:''}</div></section><aside class="customer-context"><h3>本次测试</h3><dl><div><dt>型号 / 软件版本</dt><dd>${escape(session?session.product+' / '+session.version:'尚未提供')}</dd></div><div><dt>可引用知识</dt><dd>${session?knowledge(session).length:0} 条 · 按客户提供的型号匹配</dd></div><div><dt>业务操作</dt><dd>未接入查询、退款与建单接口</dd></div></dl>${session?`<details class="copy-help"><summary>发给模型的知识</summary>${knowledge(session).map(entry=>`<p>${escape(entry.id+' · '+entry.title+' · '+entry.version)}</p>`).join('')||'<p>未匹配知识；模型应先追问或建议人工核实。</p>'}</details>`:''}${history.length?`<label>历史测试<select id="customer-model-history">${history.slice().reverse().map(entry=>`<option value="${escape(entry.id)}" ${entry.id===session?.id?'selected':''}>${escape(entry.messages[0]?.text.slice(0,24)||'新对话')}</option>`).join('')}</select></label>`:''}<p class="customer-privacy">只使用当前对话，不发送内部备注、工单或其他客户记录。停止请求不保证服务商停止计费。</p></aside></div></section>`;
  }
  function configure(adapter){
    host=adapter;
    document.addEventListener('click',event=>{
      const element=event.target.closest('[data-action^="customer-"]');if(!element||!active())return;
      event.preventDefault();const name=element.dataset.action.slice(9);
      if(name==='configure')window.HubModels.open('service','model');
      if(name==='refresh')void refresh();
      if(name==='new'){stop();host.startModel();}
      if(name==='stop')stop();
      if(name==='retry')void send('',true);
      if(name==='handoff'){stop();host.handoff();}
      if(name==='resolve')host.confirmResolution();
    });
    document.addEventListener('input',event=>{if(event.target.id==='customer-model-input'&&current()){if(policy.sensitive(event.target.value)){current().draft='';host.persist();return;}current().draft=event.target.value;host.persist();}});
    document.addEventListener('change',event=>{
      if(!active())return;
      if(event.target.id==='customer-model-consent'&&current()){if(event.target.checked&&connection?.meta.configured)consent.set(current().id,signature());else consent.delete(current().id);repaint();document.getElementById('customer-model-consent')?.focus();}
      if(event.target.id==='customer-model-history'){stop();host.selectSession(event.target.value);}
    });
    document.addEventListener('submit',event=>{if(event.target.id==='customer-model-form'){event.preventDefault();void send(new FormData(event.target).get('text'));}});
  }
  function capture(){
    const stream=document.getElementById('customer-model-messages');const input=document.getElementById('customer-model-input');
    if(!stream||!current()){viewState=null;return;}
    viewState={sessionId:current().id,top:stream.scrollTop,atBottom:stream.scrollHeight-stream.clientHeight-stream.scrollTop<64,focused:document.activeElement===input,start:input?.selectionStart,end:input?.selectionEnd};
  }
  function mount(){
    const stream=document.getElementById('customer-model-messages');const input=document.getElementById('customer-model-input');
    const previous=viewState?.sessionId===current()?.id?viewState:null;
    if(stream)stream.scrollTop=!previous||previous.atBottom?stream.scrollHeight:previous.top;
    if(previous?.focused&&input&&!input.disabled){input.focus({preventScroll:true});input.setSelectionRange(previous.start,previous.end);}
    if(document.querySelector('.customer-model')&&!checked&&!loading){checked=true;queueMicrotask(()=>void refresh());}
  }
  return {configure,page,capture,mount,refresh,send,stop,invalidate};
})();
