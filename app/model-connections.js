window.HubModels = (()=>{
  const {providers,validModel}=window.HubModelProviders;
  let host;
  let active=null;
  let session='';
  const known=new Map();
  const localServer=!window.LIANSHAN_PUBLIC_DEMO&&location.protocol==='http:'&&location.hostname==='127.0.0.1'&&typeof fetch==='function';
  const escape=value=>host.escape(value);
  const action=(text,name,extra='',tone='')=>host.button(text,'model-'+name,tone,extra);
  const agent=identifier=>identifier==='manager'?(host.getState().coordinatorModel||(host.getState().coordinatorModel={id:'manager',name:'连小山',version:'协调运行版',mode:'assist',enabled:true})):host.getState().agents.find(entry=>entry.id===identifier);
  const safeProfile=value=>value&&Object.hasOwn(providers,value.provider)&&validModel(value.model)?{provider:value.provider,model:value.model}:null;
  const configured=()=>active?.meta?.configured;
  const changed=()=>!active?.meta||active.draft.provider!==active.meta.provider||active.draft.model!==active.meta.model||!!document.getElementById('model-key')?.value;

  function summary(entry){
    const profile=safeProfile(entry.modelConnection);
    const record=known.get(entry.id);
    const label=profile?providers[profile.provider].name+' · '+profile.model:'独立模型 · 未配置';
    const state=record?.tested?'本次连接已通过':record?.configured?'已保存 · 待测试':profile?'配置草稿 · 未连接':'';
    return `<button class="agent-model-link" data-action="model-open" data-id="${entry.id}">${host.icon('plug-connected','small')}<span>${escape(label)}</span>${state?`<small>${state}</small>`:''}${host.icon('chevron-right','small')}</button>`;
  }
  function setError(message){const node=document.getElementById('model-error');if(node)node.textContent=message;}
  function paint(){
    if(!active||!document.getElementById('model-provider'))return;
    const provider=providers[active.draft.provider];
    document.getElementById('model-endpoint').textContent=provider?.endpoint||'选择服务商后显示固定官方地址';
    document.getElementById('model-protocol').textContent=provider?provider.protocol+' · '+provider.region:'不接收任意代理地址';
    const key=document.getElementById('model-key');
    key.disabled=!active.live||active.busy;
    key.placeholder=!active.live?'配置预览不接收真实密钥':configured()&&active.meta.provider===active.draft.provider?'已保存；留空沿用，输入新值替换':'输入该助手专用的 API Key';
    const status=document.getElementById('model-status');
    status.textContent=active.loading?'正在检查本机服务':active.busy?'正在处理':active.result||(active.meta?.tested&&!changed()?'本次连接测试通过':configured()&&!changed()?'已保存 · 尚未测试':configured()?'有未保存修改':'未连接');
    status.classList.toggle('verified',!!active.meta?.tested&&!changed()&&!active.busy&&!active.result);
    document.getElementById('model-environment').textContent=active.loading?'正在检查本机服务；此时不会发送密钥或调用模型。':active.live?'本机服务可用。密钥只保存在服务进程内存；重启后须重新输入。':active.unsupported?'当前本机服务尚不支持这位新增助手，只可保存配置草稿。重启更新后的服务才能独立连接；重启会清空其他助手的内存密钥，请确认后操作。':'当前为配置预览：只保存服务商与模型名称，不接收密钥，不调用模型。运行源码目录中的 node server.js 后，可从本机地址配置真实连接。';
    document.getElementById('model-save-label').textContent=active.live?'保存连接':'保存配置草稿';
    for(const identifier of ['model-provider','model-name','model-save','model-consent'])document.getElementById(identifier).disabled=active.busy||active.loading;
    document.getElementById('model-consent').disabled=active.busy||!active.live||!configured()||changed();
    document.getElementById('model-test').disabled=active.busy||!active.live||!configured()||changed()||!document.getElementById('model-consent').checked;
    document.getElementById('model-remove').hidden=!configured()&&!safeProfile(agent(active.id).modelConnection);
    document.getElementById('model-remove').disabled=active.busy;
    document.getElementById('model-refresh').disabled=active.busy||active.loading;
  }
  function tabs(tab){
    if(!active)return;
    if(active.id==='manager')tab='model';
    active.tab=tab;
    for(const name of ['policy','model']){
      document.getElementById('model-tab-'+name).setAttribute('aria-selected',String(name===tab));
      document.getElementById('model-tab-'+name).tabIndex=name===tab?0:-1;
      document.getElementById('model-panel-'+name).hidden=name!==tab;
      document.getElementById('model-footer-'+name).hidden=name!==tab;
    }
    document.querySelector('.dialog-content').scrollTop=0;
  }
  async function refresh(){
    const current=active;
    if(!current||current.busy)return;
    const consent=document.getElementById('model-consent');if(consent)consent.checked=false;
    if(!localServer){current.loading=false;paint();return;}
    current.loading=true;paint();
    try{
      const response=await fetch('/api/model-connections',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw new Error();
      const data=await response.json();
      if(data.mode!=='local-server'||typeof data.csrf!=='string'||!Array.isArray(data.connections))throw new Error();
      if(active!==current)return;
      session=data.csrf;
      known.clear();
      data.connections.forEach(record=>known.set(record.agentId,record));
      current.meta=known.get(current.id);
      current.live=!!current.meta;
      current.unsupported=!current.meta;
      if(!current.edited&&current.meta?.configured){
        current.draft={provider:current.meta.provider,model:current.meta.model};
        document.getElementById('model-provider').value=current.draft.provider;
        document.getElementById('model-name').value=current.draft.model;
      }
    }catch{
      if(active!==current)return;
      current.live=false;current.meta=null;current.unsupported=false;known.clear();session='';
    }finally{if(active===current){current.loading=false;paint();}}
  }
  function open(identifier,tab='policy'){
    close();
    const entry=agent(identifier);
    if(!entry)return;
    if(identifier==='manager')tab='model';
    active={id:identifier,tab,draft:safeProfile(entry.modelConnection)||{provider:'',model:''},meta:null,live:false,loading:localServer,busy:false,result:'',edited:false};
    const profile=active.draft;
    const modes=entry.id==='analytics'?[['assist','按需分析','只读查询项目样本，不自动处理业务']]:[['observe','观察模式','只检查，不对外回复'],['assist','人工辅助','准备建议，由坐席确认'],['auto','自动接待','仅限已验证的低风险问题']];
    const policy=`<section id="model-panel-policy" role="tabpanel" aria-labelledby="model-tab-policy"><div class="model-section-title"><h3>运行方式</h3><p>自动接待用于客户体验的模型对话；其他模式保留人工处理。</p></div><fieldset class="model-modes"><legend class="sr-only">运行方式</legend>${modes.map(([value,label,note])=>`<label class="model-mode-option"><input type="radio" name="agent-mode" value="${value}" ${entry.mode===value?'checked':''} ${entry.id!=='service'&&value==='auto'?'disabled':''}><span><strong>${label}</strong><small>${note}</small></span></label>`).join('')}</fieldset><div class="model-section-title"><h3>处理边界</h3><p>更换模型不会改变这些规则。</p></div><div class="model-rules">${(entry.id==='analytics'?['明确统计范围','仅只读查询','来源与样本量可查','不自动对外发送']:['只使用审核知识','尊重人工接管','发送前风险检查','建单前确认']).map(text=>`<span>${host.icon('shield-check','small')}${text}</span>`).join('')}</div><p class="model-scope-note">工单提交和对外回复仍需按原流程核对。模型连接不会自动切换客服或项目助手的执行方式。</p></section>`;
    const model=`<section id="model-panel-model" role="tabpanel" aria-labelledby="model-tab-model"><div class="model-section-title"><div><h3>这个助手使用哪个模型</h3><p>独立选择服务商和密钥，不继承其他助手的连接。</p></div><span class="model-status" id="model-status">未连接</span></div><div class="model-environment" id="model-environment"></div><div class="model-fields"><div class="field"><label for="model-provider">模型服务商</label><select id="model-provider"><option value="">请选择服务商</option>${Object.entries(providers).map(([identifier,provider])=>`<option value="${identifier}" ${profile.provider===identifier?'selected':''}>${provider.name}</option>`).join('')}</select></div><div class="field"><label for="model-name">模型 ID</label><input id="model-name" value="${escape(profile.model)}" maxlength="100" placeholder="填写服务商控制台中的模型 ID" autocomplete="off" spellcheck="false"><small>使用账号可访问的文本对话模型，不自动推荐或替换。</small></div><div class="model-endpoint"><span>请求地址 · 只读</span><code id="model-endpoint"></code><small id="model-protocol"></small></div><div class="field model-key-field"><label for="model-key">API Key <span>仅用于 ${escape(entry.name)}</span></label><input id="model-key" type="password" autocomplete="off" spellcheck="false" maxlength="1024" disabled aria-describedby="model-key-note"><small id="model-key-note">密钥不回显、不写入浏览器存储、Trace、导出或日志。请勿填写到模型 ID 栏。</small></div></div><div class="model-test-area"><div><h3>连接测试</h3><p>只发送一条固定的英文连通性问候，不携带客户对话、知识库或工单。</p></div><label class="model-consent"><input type="checkbox" id="model-consent"><span>同意本次向上方官方地址发起测试，可能产生费用。每次测试需重新确认。</span></label><div class="model-test-actions">${action(host.icon('plug-connected','small')+' 测试连接','test','id="model-test"')}${action('刷新连接状态','refresh','id="model-refresh"','quiet small')}<small>最多等待 30 秒 · 不自动重试</small></div></div><div id="model-error" role="alert" class="model-error"></div><p class="model-scope-note">接待助手可用于客户体验；连小山与业务助手可用于协作群的「模型协作」。原规则演练保持不变，真实业务系统尚未接入。</p></section>`;
    host.showDialog(entry.name+' · 配置','策略与模型分别保存，只影响当前助手。',`<div class="model-agent-identity">${window.HubIdentity.worker(identifier,'md')}<div><strong>${escape(entry.name)}</strong><span>${escape(entry.version)} · 独立配置</span></div></div><div class="model-tabs" role="tablist" aria-label="助手配置"><button id="model-tab-policy" role="tab" data-action="model-tab" data-value="policy" aria-controls="model-panel-policy">运行策略</button><button id="model-tab-model" role="tab" data-action="model-tab" data-value="model" aria-controls="model-panel-model">模型连接</button></div>${policy}${model}`,`<div id="model-footer-policy" class="model-footer">${host.footer('保存策略','save-agent-config',`data-id="${identifier}"`)}</div><div id="model-footer-model" class="model-footer"><span class="hint">模型测试不等于业务验收</span><div class="row">${action('移除连接','remove','id="model-remove"','quiet')}${host.button('关闭','close-dialog')}${action('<span id="model-save-label">保存配置草稿</span>','save','id="model-save"','primary')}</div></div>`,'model-config');
    tabs(tab);if(identifier==='manager')document.getElementById('model-tab-policy').hidden=true;paint();void refresh();
  }
  function collect(){
    if(!active)return;
    active.draft={provider:document.getElementById('model-provider').value,model:document.getElementById('model-name').value.trim()};
  }
  async function request(name,body){
    let response;
    try{response=await fetch('/api/model-connections/'+name,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Session':session},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});}catch{throw new Error('本机服务未完成请求。请刷新连接状态后再操作，不会自动重试。');}
    let data;
    try{data=await response.json();}catch{throw new Error('本机服务响应格式不正确。');}
    if(!response.ok)throw new Error(data.error||'操作失败，请重新打开配置。');
    return data;
  }
  function persistProfile(current){
    agent(current.id).modelConnection={provider:current.draft.provider,model:current.draft.model};
    if(current.id==='service')window.CustomerChat?.invalidate();
    if(current.id==='manager')window.OrbitDesigner?.invalidate();
    host.persist();host.render();
  }
  async function save(){
    if(!active||active.busy||active.loading)return;
    collect();setError('');
    const current=active;
    if(!Object.hasOwn(providers,current.draft.provider)||!validModel(current.draft.model))return setError('请选择服务商，并填写有效的模型 ID。不要把 API Key 填入模型 ID 栏。');
    if(!current.live){persistProfile(current);current.result='配置草稿已保存 · 未连接模型';paint();return;}
    const input=document.getElementById('model-key');
    let key=input.value.trim();
    if(!key&&(!configured()||current.meta.provider!==current.draft.provider))return setError('请填写当前助手的 API Key。更换服务商不能沿用原密钥。');
    const payload={agentId:current.id,...current.draft,key,expectedRevision:current.meta.revision};
    input.value='';key='';current.busy=true;current.result='';document.getElementById('model-consent').checked=false;paint();
    try{const data=await request('save',payload);known.set(current.id,data);persistProfile(current);if(active===current){current.meta=data;current.result='连接已保存 · 请单独测试';}}
    catch(error){if(active===current)setError(error.message);}
    finally{payload.key='';current.busy=false;if(active===current)paint();}
  }
  async function test(){
    if(!active||active.busy||!active.live||!configured()||changed())return;
    if(!document.getElementById('model-consent').checked)return setError('请先确认本次测试的数据范围与费用。');
    const current=active;
    document.getElementById('model-consent').checked=false;current.busy=true;current.result='';current.meta.tested=false;setError('');paint();
    try{const data=await request('test',{agentId:current.id,expectedRevision:current.meta.revision,consent:true});known.set(current.id,data);host.render();if(active===current){current.meta=data;current.result=`连接测试通过 · ${(data.latencyMs/1000).toFixed(2)} 秒`;}}
    catch(error){known.set(current.id,{...current.meta,tested:false});host.render();if(active===current){current.result='测试未通过';setError(error.message);}}
    finally{current.busy=false;if(active===current)paint();}
  }
  async function remove(){
    if(!active||active.busy)return;
    const current=active;
    current.busy=true;setError('');paint();
    try{if(current.live&&configured()){const data=await request('remove',{agentId:current.id,expectedRevision:current.meta.revision});known.set(current.id,data);current.meta=data;}delete agent(current.id).modelConnection;if(current.id==='service')window.CustomerChat?.invalidate();if(current.id==='manager')window.OrbitDesigner?.invalidate();host.persist();host.render();if(active===current){current.draft={provider:'',model:''};document.getElementById('model-provider').value='';document.getElementById('model-name').value='';document.getElementById('model-key').value='';current.result='连接已移除 · 不影响其他助手';}}
    catch(error){if(active===current)setError(error.message);}
    finally{current.busy=false;if(active===current)paint();}
  }
  function change(identifier){
    if(!active)return;
    if(identifier==='model-consent'){paint();return;}
    collect();active.edited=true;active.result='';setError('');document.getElementById('model-consent').checked=false;
    if(identifier==='model-provider')document.getElementById('model-key').value='';
    paint();
  }
  function close(){const key=document.getElementById('model-key');if(key)key.value='';active=null;}
  function dispatch(name,element){
    if(name==='open')return open(element.dataset.id,'model');
    if(name==='tab')return tabs(element.dataset.value);
    if(name==='save')return save();
    if(name==='test')return test();
    if(name==='remove')return remove();
    if(name==='refresh')return refresh();
  }
  function configure(api){host=api;host.getState().agents.forEach(entry=>{const profile=safeProfile(entry.modelConnection);if(profile)entry.modelConnection=profile;else delete entry.modelConnection;});}
  return {configure,open,close,dispatch,change,summary};
})();
