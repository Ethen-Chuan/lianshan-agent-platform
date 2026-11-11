window.OrbitWorkbench=(()=>{
  let host;
  const views=new Map();
  const sections=[['compose','描述业务'],['library','业务定义'],['capabilities','能力与依据'],['changes','变更影响']];
  const properties={name:'名称',description:'定义',fields:'必要信息',keywords:'受理表达',transferWords:'转人工条件',blockedTerms:'限制表达',tool:'演练方式',type:'类型'};
  const examples=[
    {name:'售后受理助手',brief:'处理设备黑屏报修。先了解设备型号、问题表现和购买日期，再核实保修依据。资料不足时先追问，不把黑屏直接判断为主控板故障。准备报修草稿供坐席确认；遇到冒烟、起火或客户要求人工时立即转交。',needs:'查询设备保修状态\n创建报修单'},
    {name:'员工入职助手',brief:'帮助新员工完成入职准备。了解入职日期、所属部门和岗位，列出需要准备的材料。材料缺失时说明补充要求；涉及账号开通或权限申请时交给对应负责人确认，不自动分配权限。',needs:'查询入职材料清单\n提交账号开通申请'},
    {name:'门店巡检助手',brief:'收集门店巡检问题，按照门店、问题类型和整改负责人整理待办。缺少照片或整改期限时提醒补充。输出巡检摘要和整改草稿；涉及安全隐患时优先交给负责人。',needs:'读取巡检记录\n创建整改任务'}
  ];
  const current=()=>window.PortfolioHub.navProject();
  const workspace=()=>window.ProjectStudio.data();
  const model=()=>window.OrbitOntology.data();
  const escape=value=>host.escape(String(value??''));
  const persist=()=>window.PortfolioHub.persist();
  const button=(text,action,attributes='',tone='quiet small')=>host.button(text,'ow-'+action,tone,attributes);
  const split=value=>[...new Set(String(value||'').split(/[,，、\n]/).map(item=>item.trim()).filter(Boolean))];
  function view(){if(!views.has(current().id))views.set(current().id,{section:'compose',mode:window.OrbitDesigner?'prompt':'flow',query:'',motion:true,previous:null});return views.get(current().id);}
  function data(){const storage=workspace();storage.businessDesign||={name:'',brief:'',needs:'',actionId:'',draft:null,requests:[]};return storage.businessDesign;}
  function sensitive(value){return host.isSensitive(String(value))||/(?:sk[-_][A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{10,}|-----BEGIN.*PRIVATE KEY)/i.test(String(value));}
  function makeDraft(input,binding,projectId){
    const name=String(input.name||'').trim();const brief=String(input.brief||'').trim();
    if(!name||name.length>32||/[\s@，,。；;]/.test(name))throw new Error('请填写 32 字以内的助手名称，不含空格、@ 或分隔符。');
    if(brief.length<12||brief.length>800)throw new Error('请用 12–800 字说明业务目标、处理方式和例外情况。');
    if(String(input.needs||'').length>400)throw new Error('能力需求请控制在 400 字以内。');
    if(binding&&binding.ontologyBinding.projectId!==projectId)throw new Error('不能引用其他项目的业务定义。');
    const requests=split(input.needs).map(name=>({name,status:'not-connected'}));
    const config={name,goal:brief.slice(0,400),keywords:binding?.keywords||'',fields:binding?.fields||'',tool:binding?.tool||'summary',transferWords:binding?.transferWords||'',handoff:binding?.handoff||'信息不足先追问；权限不足、安全风险和主动求助交由人工确认，不自动发送或提交。',knowledge:binding?.knowledge||'',prompt:`你是${name}。\n业务要求（按用户原文保留）：\n${brief}\n\n处理边界：缺少依据先追问；未知状态不得当作事实；未接入的工具不可声称调用成功；对外操作必须获得授权与人工确认。`,provider:'未连接',model:'',connectionRef:'',businessDesign:{schema:1,projectId,brief,requests,source:'local-structure',confirmed:false},...(binding?{ontologyBinding:structuredClone(binding.ontologyBinding)}:{})};
    return {config,requirements:brief.split(/(?<=[。！？\n])/).map(value=>value.trim()).filter(Boolean),createdAt:new Date().toISOString()};
  }
  function compareBindings(previous,next){
    const changes=[];const oldNodes=previous?.nodes||[];const newNodes=next?.nodes||[];
    for(const before of oldNodes){
      const after=newNodes.find(node=>node.id===before.id);
      if(!after){changes.push({id:before.id,name:before.name,label:'不再引用',before:before.description||'',after:'当前依赖中已移除'});continue;}
      for(const [key,label] of Object.entries(properties))if(String(before[key]||'')!==String(after[key]||''))changes.push({id:before.id,name:after.name,label,before:String(before[key]||'未设置'),after:String(after[key]||'未设置')});
    }
    for(const after of newNodes)if(!oldNodes.some(node=>node.id===after.id))changes.push({id:after.id,name:after.name,label:'新增引用',before:'未引用',after:after.description||after.name});
    const edgeKey=link=>[link.source,link.target,link.label].join('|');
    const describe=(link,nodes)=>`${nodes.find(node=>node.id===link.source)?.name||link.source} → ${nodes.find(node=>node.id===link.target)?.name||link.target} · ${link.label}`;
    for(const link of previous?.links||[])if(!(next?.links||[]).some(item=>edgeKey(item)===edgeKey(link)))changes.push({id:link.id,name:'关系调整',label:'移除关系',before:describe(link,oldNodes),after:'当前依赖不再包含此关系'});
    for(const link of next?.links||[])if(!(previous?.links||[]).some(item=>edgeKey(item)===edgeKey(link)))changes.push({id:link.id,name:'关系调整',label:'新增关系',before:'未引用',after:describe(link,newNodes)});
    return changes;
  }
  function references(){
    const storage=workspace();const entries=storage.scenes.filter(entry=>entry.config.ontologyBinding).map(entry=>({id:entry.id,sceneId:entry.id,name:entry.config.name,kind:'配置草案',config:entry.config}));
    for(const agent of storage.agents){const release=agent.releases.find(item=>item.version===agent.activeVersion);if(release?.config.ontologyBinding)entries.push({id:agent.id,sceneId:agent.sceneId,name:agent.name,kind:'当前版本 '+agent.activeVersion,config:release.config});}
    return entries.map(entry=>{let next=null;try{next=window.OrbitOntology.configFromAction(entry.config.ontologyBinding.actionId).ontologyBinding;}catch{}const changes=compareBindings(entry.config.ontologyBinding,next);const samples=changes.length?storage.scenes.find(scene=>scene.id===entry.sceneId)?.samples||[]:[];return {...entry,changes,samples,next};});
  }
  function flowReferences(){
    const storage=workspace();
    const entries=[{id:'current',name:storage.businessFlow?.name||'当前流程',graph:storage.businessFlow,kind:'当前流程参考'},...storage.scenes.filter(scene=>scene.config.flowDesign?.graph).map(scene=>({id:scene.id,sceneId:scene.id,name:scene.config.name,graph:scene.config.flowDesign.graph,kind:'流程草案参考'})),...storage.agents.flatMap(agent=>{const release=agent.releases.find(entry=>entry.version===agent.activeVersion);return release?.config.flowDesign?.graph?[{id:agent.id,agentId:agent.id,sceneId:agent.sceneId,name:agent.name,graph:release.config.flowDesign.graph,kind:'当前版本参考 '+agent.activeVersion}]:[];})];
    return entries.filter(entry=>entry.graph?.designerReferences?.projectId===current().id&&entry.graph.designerReferences.nodes?.length).map(entry=>{
      const snapshot=entry.graph.designerReferences;const changes=[];
      for(const before of snapshot.nodes){const after=model().nodes.find(node=>node.id===before.id);if(!after){changes.push({id:before.id,name:before.name,label:'定义已移除',before:before.description||'',after:'当前定义已移除'});continue;}for(const key of ['name','type','description','fields'])if((before[key]||'')!==(after[key]||''))changes.push({id:before.id,name:after.name,label:properties[key],before:before[key]||'未设置',after:after[key]||'未设置'});}
      return {...entry,snapshot,changes};
    });
  }
  function flowChanges(){
    const records=flowReferences();if(!records.length)return '';
    return `<section class="ow-flow-change-list"><h3>流程引用</h3>${records.map(record=>`<article class="ow-change-record"><header><div><span class="ow-eyebrow">${escape(record.kind)}</span><h3>${escape(record.name)}</h3></div><span class="ow-status ${record.changes.length?'is-pending':''}">${record.changes.length?record.changes.length+' 项变化待复核':'引用内容一致'}</span></header>${record.changes.length?`<div class="ow-diff-list">${record.changes.map(change=>`<div class="ow-diff"><strong>${escape(change.name)}<small>${escape(change.label)}</small></strong><div><span>原引用</span><p>${escape(change.before)}</p></div><div><span>当前定义</span><p>${escape(change.after)}</p></div></div>`).join('')}</div>`:''}<footer>${record.agentId?host.button('查看版本','studio-agent','quiet small',`data-id="${escape(record.agentId)}" data-tab="versions"`):record.sceneId?button('查看草案','scene',`data-id="${escape(record.sceneId)}"`):button('返回流程','section','data-value="compose"')}<small>仅为设计参考；复核前保持原流程与版本。</small></footer></article>`).join('')}</section>`;
  }
  function reviewSamples(record){
    if(!record.changes.length)return '';
    return `<details class="ow-change-samples"><summary>关联验收集 · ${record.samples.length} 个案例待复核</summary><p>本配置引用的业务定义有变化。迁移新定义后，请重新验收这些案例；此处不代表案例已经失败，也不会改写旧版本的通过记录。</p>${record.samples.length?`<ol>${record.samples.map(sample=>`<li><strong>${escape(sample.id)}</strong> · ${escape(sample.input)}<br>人工预期：${escape({prepared:'正常准备',missing:'必要信息不足',handoff:'转人工'}[sample.expected]||sample.expected)} · ${sample.approved?'已审核':'待审核'}</li>`).join('')}</ol>`:'<p>这份草案还没有关联案例，需补齐正常、缺项与转人工验收。</p>'}</details>`;
  }
  function hero(){
    return `<section class="ow-hero"><div class="ow-hero-copy"><span class="ow-eyebrow">Orbit / 业务设计</span><h2>创建业务助手</h2><p>写下处理范围、步骤和转人工条件。</p><div class="ow-hero-note"><i></i> 当前项目独立 · 业务数据尚未接入</div></div><div class="ow-instrument ${view().motion?'':'is-paused'}" aria-hidden="true"><div class="ow-grid"></div><div class="ow-orb"><i class="ow-ring ring-one"></i><i class="ow-ring ring-two"></i><i class="ow-ring ring-three"></i><span class="ow-orb-center">O<span>ORBIT</span></span></div><span class="ow-instrument-caption">ORBIT</span><span class="ow-coordinate">定义 · 依据 · 行动</span></div>${button(host.icon(view().motion?'player-pause':'player-play','small'),'motion',`aria-label="${view().motion?'暂停':'播放'}装饰动效" aria-pressed="${!view().motion}"`,'ow-motion')}</section>`;
  }
  function referenceSummary(){
    if(!window.OrbitDesigner)return '';
    const selected=workspace().businessDesigner?.referenceIds||[];
    const snapshot=workspace().businessFlow?.designerReferences;
    const saved=snapshot?.projectId===current().id?snapshot.nodes||[]:[];
    const changed=saved.filter(before=>{const after=model().nodes.find(node=>node.id===before.id);return !after||['name','type','description','fields'].some(key=>(before[key]||'')!==(after[key]||''));});
    const pending=selected.length!==saved.length||selected.some(id=>!saved.some(node=>node.id===id))||changed.length;
    return `<section class="ow-flow-references" aria-label="流程引用的共享定义"><header><strong>引用业务定义 <span>${selected.length}</span></strong>${button('选择定义','choose-definitions','','small')}</header><div class="ow-reference-chips">${selected.map(id=>{const node=model().nodes.find(entry=>entry.id===id);return `<span>${button(escape(node?.name||'定义已移除'),'definition',`data-id="${escape(id)}" ${node?'':'disabled'}`)}${button('×','remove-reference',`data-id="${escape(id)}" aria-label="不再引用${escape(node?.name||'已移除的定义')}"`)}</span>`;}).join('')||'<p>需要共用规则时直接引用，不必在每个步骤重填。</p>'}</div>${saved.length?`<details class="ow-reference-snapshot"><summary>当前流程已引用 ${saved.length} 项${changed.length?' · '+changed.length+' 项定义变化，待复核':''}</summary>${saved.map(node=>`<div>${button(escape(node.name),'definition',`data-id="${escape(node.id)}"`)}<small>${changed.some(entry=>entry.id===node.id)?'定义已变化 · 当前流程保留原引用':'引用内容一致'}</small></div>`).join('')}<p>仅作为流程设计参考；已保存的流程和助手不会自动改写。</p></details>`:''}${pending?'<p class="ow-reference-pending" role="status">引用待采用：下次生成时使用，核对并采用后才更新流程。</p>':''}</section>`;
  }
  function compose(){
    const modes=`<div class="ow-design-modes" role="group" aria-label="业务设计方式">${[['prompt','描述业务'],['flow','手动编辑'],['text','旧文字草稿']].map(([value,label])=>button(label,'design-mode',`data-value="${value}" aria-pressed="${view().mode===value}"`,view().mode===value?'selected':'quiet')).join('')}</div>`;
    if(view().mode==='prompt'&&window.OrbitDesigner)return (window.OrbitDesigner.view().purpose==='flow'?modes+referenceSummary():'')+window.OrbitDesigner.page();
    if(view().mode==='flow'&&window.OrbitFlow)return modes+referenceSummary()+window.OrbitFlow.page();
    const storage=data();const actions=model().nodes.filter(node=>node.type==='action');
    return `${modes}${hero()}<div class="ow-compose-layout"><section class="ow-brief"><div class="ow-section-title"><span class="ow-number">01</span><div><h3>处理范围与规则</h3></div></div><form id="ow-brief-form"><label class="ow-field ow-name"><span>助手名称</span><input name="name" id="ow-name" required maxlength="32" value="${escape(storage.name)}" placeholder="例如：售后受理助手"></label><label class="ow-field"><span>业务描述</span><textarea id="ow-brief" name="brief" required minlength="12" maxlength="800" rows="6" aria-describedby="ow-brief-note ow-error" placeholder="这个助手服务谁？需要处理什么问题？正常情况怎么做，信息不足或遇到风险时怎么办？">${escape(storage.brief)}</textarea></label><div class="ow-examples"><span>填入示例</span>${examples.map((example,index)=>button(example.name.replace('助手',''),'example',`data-index="${index}"`)).join('')}${view().previous?button('撤销替换','undo'):''}</div><details class="ow-options" ${storage.actionId||storage.needs?'open':''}><summary>引用定义与工具需求 <span>可选</span></summary><label class="ow-field"><span>复用当前项目的定义</span><select id="ow-binding" name="actionId"><option value="">不复用，先描述新的业务</option>${actions.map(action=>`<option value="${escape(action.id)}" ${storage.actionId===action.id?'selected':''}>${escape(action.name)} · O${model().revision}</option>`).join('')}</select></label><p class="ow-help">带入关联对象、必要信息与规则；不会获得真实系统权限。</p><label class="ow-field"><span>还需要哪些处理能力？</span><textarea id="ow-needs" name="needs" rows="2" maxlength="400" placeholder="例如：查询保修状态、创建报修单。可填写任意能力，每行一项。">${escape(storage.needs)}</textarea></label><p class="ow-help">需求会标记为“未接入”，接通工具并验收后才能执行。</p></details><p id="ow-error" class="ow-error" role="alert"></p><footer class="ow-submit"><span id="ow-brief-note">按本地规则整理，未调用模型<br>业务内容需人工核实</span><button type="submit" class="button primary">生成助手草案 ${host.icon('arrow-right','small')}</button></footer></form></section><aside class="ow-margin"><span class="ow-eyebrow">配置参考</span><h3>已有定义与接入情况</h3><ol>${[['library','复用业务定义','将已有对象、字段和规则带入新助手。'],['capabilities','查看可用功能','区分本地演练、待接入工具与未核实依据。'],['changes','查看变更影响','对比引用内容，已验收配置保持不变。']].map(([section,title,note],index)=>`<li><span>0${index+1}</span><div>${button(title+' '+host.icon('arrow-up-right','small'),'section',`data-value="${section}"`)}<p>${note}</p></div></li>`).join('')}</ol><div class="ow-margin-foot">${workspace().scenes.length} 个研发场景<span>·</span>${workspace().agents.length} 位定制助手</div></aside></div>${storage.draft?preview(storage.draft):''}${recent()}`;
  }
  function preview(draft){
    const config=draft.config;const binding=config.ontologyBinding;const stale=binding&&binding.revision!==model().revision;
    return `<section class="ow-review" id="ow-review" tabindex="-1"><header><div><span class="ow-eyebrow">草案待确认 · 尚未上线</span><h3>${escape(config.name)}</h3></div><span class="ow-status">本地草案</span></header><div class="ow-review-grid"><div><h4>业务要求 · 来自你的原文</h4><ol class="ow-requirements">${draft.requirements.map(requirement=>`<li>${escape(requirement)}</li>`).join('')}</ol><details class="ow-prompt"><summary>查看完整 Prompt 草稿</summary><pre>${escape(config.prompt)}</pre></details></div><div class="ow-review-side"><h4>${binding?'已选业务定义':'尚未选择共享定义'}</h4><p>${binding?escape(binding.actionName)+' · O'+binding.revision:'可以先保存新业务；受理范围与必要信息需在配置页补充。'}</p>${binding?`<div class="ow-tags">${split(config.fields).map(field=>`<span>${escape(field)}</span>`).join('')}</div><p>${binding.ruleNames.length} 条关联规则 · 原因假设不作为事实</p>`:''}<h4>待接入能力</h4>${config.businessDesign.requests.length?config.businessDesign.requests.map(request=>`<div class="ow-request-line"><span>${escape(request.name)}</span><small>未接入</small></div>`).join(''):'<p>尚未登记，可在配置后继续补充。</p>'}<p class="ow-caution">模型未接入。当前只能验收关键词分流、缺项检查和本地草稿；不能验证这段 Prompt 的语义处理效果。</p></div></div>${stale?'<p class="ow-caution">业务定义已更新，请重新整理草案后再确认。</p>':''}<form id="ow-confirm-form" class="ow-confirm"><label><input type="checkbox" name="confirmed" required> 我已核对业务要求，理解待接入能力尚不可执行。</label><button class="button primary" type="submit" ${stale?'disabled':''}>保存草案，继续配置 ${host.icon('arrow-right','small')}</button></form></section>`;
  }
  function recent(){const scenes=workspace().scenes.slice(-3).reverse();return scenes.length?`<section class="ow-recent"><div class="ow-panel-title"><h3>继续研发</h3><span>仅当前项目</span></div>${scenes.map(scene=>`<button data-action="ow-scene" data-id="${escape(scene.id)}"><span><strong>${escape(scene.config.name||'未命名场景')}</strong><small>${scene.config.ontologyBinding?'引用本体 O'+scene.config.ontologyBinding.revision:'独立业务草案'} · ${scene.samples.length} 个验收案例</small></span>${host.icon('arrow-up-right','small')}</button>`).join('')}</section>`:'';}
  function panelHeading(index,title,description,actions=''){return `<header class="ow-panel-heading"><div><h2>${title}</h2><p>${description}</p></div>${actions}</header>`;}
  function library(){
    return (window.OntologyCatalog?.page()||definitionForm()+window.OrbitOntology.page())+'<details class="copy-help ow-footnote"><summary>引用统计说明</summary><p>统计本项目的当前流程、配置草案与当前助手版本，历史版本不重复计入。业务定义不会跨项目自动共享。</p></details>';
  }
  function definitionForm(){const draft=view().definitionDraft||{};return `<details class="ow-definition-add"><summary>${host.icon('plus','small')} 新增业务定义 <span>仅当前项目</span></summary><form id="ow-definition-form"><div class="ow-definition-fields"><label class="ow-field"><span>定义名称</span><input name="name" value="${escape(draft.name||'')}" required maxlength="30" placeholder="例如：返修物流"></label><label class="ow-field"><span>定义类型</span><select name="type">${[['object','业务对象'],['rule','处理规则'],['action','动作定义'],['alias','业务表达']].map(([value,label])=>`<option value="${value}" ${draft.type===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="ow-field ow-definition-wide"><span>业务含义与处理边界</span><textarea name="description" required maxlength="240" rows="2" placeholder="说明是什么、适用条件，以及不能做什么；不要填写真实客户资料。">${escape(draft.description||'')}</textarea></label><label class="ow-field"><span>必要信息（可选，逗号分隔）</span><input name="fields" value="${escape(draft.fields||'')}" maxlength="160" placeholder="例如：物流编号,设备编号"></label><label class="ow-field"><span>引用已有定义（可选）</span><select name="upstream"><option value="">先独立定义，稍后建立关系</option>${model().nodes.filter(node=>['rule','object'].includes(node.type)&&!model().links.some(link=>link.source===node.id&&link.label==='原因假设')).map(node=>`<option value="${escape(node.id)}" ${draft.upstream===node.id?'selected':''}>${escape(node.name)}</option>`).join('')}</select></label></div><footer><p>所选定义 → 新定义，建立“关联”。动作定义不会自动获得工具或执行权限。</p><button type="submit" class="button primary">保存业务定义</button></footer></form></details>`;}
  function capabilities(){
    const storage=data();const requests=[...storage.requests,...workspace().scenes.flatMap(scene=>(scene.config.businessDesign?.requests||[]).map(request=>({...request,source:scene.config.name})))];
    const fields=[...new Set(workspace().scenes.flatMap(scene=>split(scene.config.fields)))];
    return `${panelHeading('02','可用功能与待接入工具','模型、接口与权限需分别接入，登记需求不会开通权限。')}<div class="ow-capability-grid"><section class="ow-capability-main"><div class="ow-panel-title"><h3>当前可用</h3><span class="ow-status">仅本地演练</span></div>${[['整理信息摘要','整理本次输入，不调用模型或检索外部数据。'],['准备表单草稿','核对配置字段并整理草稿，不提交真实业务系统。']].map(([title,note])=>`<article class="ow-capability-row"><span class="ow-capability-dot"></span><div><h4>${title}</h4><p>${note}</p></div><span>本地</span></article>`).join('')}<div class="ow-panel-title ow-spaced"><h3>业务能力需求</h3><span>${requests.length} 项待接入</span></div>${requests.length?requests.map(request=>`<article class="ow-capability-row"><span class="ow-capability-dot pending"></span><div><h4>${escape(request.name)}</h4><p>${escape(request.source||'手动登记')} · 需要接口、权限和验收案例</p></div><span class="ow-pending">未接入</span></article>`).join(''):'<div class="ow-empty compact"><h4>还没有登记工具需求</h4><p>可在下方添加查询订单、核实保修、创建工单等需求。</p></div>'}<form id="ow-request-form" class="ow-request-form"><label class="ow-field"><span>新增能力需求</span><input name="name" required maxlength="80" placeholder="例如：查询设备保修状态"></label><button type="submit" class="button small">登记需求 ${host.icon('plus','small')}</button></form></section><aside class="ow-evidence"><span class="ow-eyebrow">数据来源</span><h3>必要字段与数据来源</h3><p>下方列出助手需要的信息。真实数据源尚未接入，字段内容仍需核实。</p><div class="ow-evidence-source"><strong>语义模型</strong><span>未接入运行链路</span></div><div class="ow-evidence-source"><strong>业务数据源</strong><span>尚未连接</span></div><h4>草案要求的信息 <span>${fields.length}</span></h4>${fields.length?fields.map(field=>`<div class="ow-evidence-field"><span>${escape(field)}</span><small>来源待核实</small></div>`).join(''):'<p>创建草案并配置必要字段后，会在这里展示依据需求。</p>'}<small>接入状态需通过真实接口验证，不能手动设为“可用”。</small></aside></div>`;
  }
  function changes(){
    const records=references();const impacted=[...records,...flowReferences()].filter(record=>record.changes.length);
    return `${panelHeading('03','规则变更影响','对比当前定义与引用快照；已验收版本不自动更新。')}<div class="ow-change-summary"><div><strong>${impacted.length}</strong><span>处引用需要复核</span></div><p>当前业务定义 O${model().revision}<br>${records.length+flowReferences().length} 处引用 · 流程与版本分别检查</p>${button('查看共享定义','section','data-value="library"')}</div>${flowChanges()}${records.length?records.map(record=>`<article class="ow-change-record"><header><div><span class="ow-eyebrow">${escape(record.kind)}</span><h3>${escape(record.name)}</h3><p>引用 O${record.config.ontologyBinding.revision} · ${escape(record.config.ontologyBinding.actionName)}</p></div><span class="ow-status ${record.changes.length?'is-pending':''}">${record.changes.length?record.changes.length+' 项定义变化':'引用内容一致'}</span></header>${record.changes.length?`<details open><summary>变更明细 · 原值与当前定义</summary><div class="ow-diff-list">${record.changes.map(change=>`<div class="ow-diff"><strong>${escape(change.name)}<small>${escape(change.label)}</small></strong><div><span>原引用</span><p>${escape(change.before)}</p></div><div><span>当前定义</span><p>${escape(change.after)}</p></div></div>`).join('')}</div></details>`:'<p class="ow-help">仅比较实际引用内容；无关节点变化不会将此引用标为受影响。</p>'}${reviewSamples(record)}<footer>${button('查看原配置','scene',`data-id="${escape(record.sceneId)}"`)}${record.changes.length&&record.next?button('用当前定义另建草案','rebase',`data-id="${escape(record.id)}"`):''}<small>${record.changes.length?'另建仅带入当前本体配置；原草案的个性化修改需人工迁移，旧版本保留。':'图谱布局变化不影响业务配置。'}</small></footer></article>`).join(''):flowReferences().length?'':`<div class="ow-empty ow-empty-large"><span class="ow-empty-mark">O${model().revision}</span><h3>暂无引用</h3><p>创建助手时引用业务定义，即可在这里查看差异。</p>${button('创建第一份业务草案','section','data-value="compose"','primary')}</div>`}<p class="ow-footnote">更新后仍需核对业务要求、重新验收案例，再确认加入团队。此页不会自动发布。</p>`;
  }
  function page(){const active=view().section;return `<div class="orbit-workbench"><nav class="ow-navigation" aria-label="业务设计工作区">${sections.map(([value,label])=>button(label,'section',`data-value="${value}" aria-current="${active===value?'page':'false'}"`,active===value?'active':'')).join('')}</nav><div class="ow-surface" id="ow-surface">${active==='library'?library():active==='capabilities'?capabilities():active==='changes'?changes():compose()}</div></div>`;}
  function refresh(focus){host.render();if(focus)document.getElementById(focus)?.focus({preventScroll:true});}
  function openDefinition(identifier){
    if(!model().nodes.some(node=>node.id===identifier))return;
    window.OrbitOntology.view().selected=identifier;
    if(window.OntologyCatalog)Object.assign(window.OntologyCatalog.view(),{presentation:'directory',tab:'overview',query:'',kind:'all',editingId:'',adding:false});
    window.ProjectStudio.designSection('library');host.navigate('orbit');
  }
  function dispatch(action,element){
    if(!current())return;const storage=data();
    if(action==='section'&&sections.some(([value])=>value===element.dataset.value)){view().section=element.dataset.value;window.PortfolioHub.syncLocation('orbit');refresh();document.querySelector(`.ow-navigation [data-value="${view().section}"]`)?.focus({preventScroll:true});}
    if(action==='design-mode'&&['prompt','flow','text'].includes(element.dataset.value)){view().mode=element.dataset.value;refresh();}
    if(action==='motion'){view().motion=!view().motion;document.querySelector('.ow-instrument')?.classList.toggle('is-paused',!view().motion);element.setAttribute('aria-pressed',String(!view().motion));element.setAttribute('aria-label',(view().motion?'暂停':'播放')+'装饰动效');element.innerHTML=host.icon(view().motion?'player-pause':'player-play','small');}
    if(action==='example'){const example=examples[Number(element.dataset.index)];if(!example)return;view().previous={name:storage.name,brief:storage.brief,needs:storage.needs,actionId:storage.actionId,draft:structuredClone(storage.draft)};Object.assign(storage,example,{actionId:'',draft:null});persist();refresh('ow-brief');}
    if(action==='undo'&&view().previous){Object.assign(storage,view().previous);view().previous=null;persist();refresh('ow-brief');}
    if(action==='choose-definitions'){window.ProjectStudio.designSection('library');host.navigate('orbit');}
    if(action==='remove-reference'){try{window.OrbitDesigner.removeReference(element.dataset.id);refresh();}catch(error){host.toast(error.message,true);}}
    if(action==='scene')window.ProjectStudio.openScene(element.dataset.id);
    if(action==='definition')openDefinition(element.dataset.id);if(action==='reuse'){try{window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction(element.dataset.id));host.toast('已新建带引用快照的助手草案。原定义和已有助手不变。');}catch(error){host.toast(error.message,true);}}
    if(action==='rebase'){const reference=references().find(item=>item.id===element.dataset.id);if(!reference?.next)return;window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction(reference.config.ontologyBinding.actionId));host.toast('已用当前定义另建草案。原配置、个性化 Prompt 与历史版本未修改，请人工核对迁移。');}
  }
  function configure(adapter){
    host=adapter;
    window.OrbitFlow?.configure(adapter);
    window.OrbitDesigner?.configure(adapter);
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="ow-"]');if(element){event.preventDefault();dispatch(element.dataset.action.slice(3),element);}});
    const captureDefinition=event=>{const form=event.target.closest?.('#ow-definition-form');if(!form||!current()||!['name','type','description','fields','upstream'].includes(event.target.name))return;const draft=view().definitionDraft||={};draft[event.target.name]=sensitive(event.target.value)?'':event.target.value;};
    document.addEventListener('input',captureDefinition);document.addEventListener('change',captureDefinition);
    document.addEventListener('input',event=>{
      if(!current())return;
      const key={'ow-name':'name','ow-brief':'brief','ow-needs':'needs','ow-binding':'actionId'}[event.target.id];if(!key)return;
      const storage=data();storage.draft=null;document.getElementById('ow-review')?.remove();const invalid=sensitive(event.target.value);storage[key]=invalid?'':event.target.value;const error=document.getElementById('ow-error');if(error)error.textContent=invalid?'请移除敏感信息；当前字段不会保存。':'';persist();
    });
    document.addEventListener('submit',event=>{
      const form=event.target;if(!form.id.startsWith('ow-')||!current())return;event.preventDefault();if(!form.reportValidity())return;
      const storage=data();
      try{
        if(form.id==='ow-brief-form'){
          const input=Object.fromEntries(new FormData(form));if(Object.values(input).some(sensitive))throw new Error('请移除敏感信息后再整理草案。');
          const binding=input.actionId?window.OrbitOntology.configFromAction(input.actionId):null;const draft=makeDraft(input,binding,current().id);Object.assign(storage,input,{draft});persist();refresh();document.getElementById('ow-review')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});document.getElementById('ow-review')?.focus({preventScroll:true});
        }
        if(form.id==='ow-confirm-form'){
          if(!new FormData(form).has('confirmed')||!storage.draft)throw new Error('请先整理并确认业务草案。');
          const config=structuredClone(storage.draft.config);if(config.businessDesign.projectId!==current().id)throw new Error('草案不属于当前项目。');
          if(config.ontologyBinding&&config.ontologyBinding.revision!==model().revision)throw new Error('业务定义已更新，请重新整理草案。');
          config.businessDesign.confirmed=true;config.businessDesign.confirmedAt=new Date().toISOString();storage.draft=null;persist();window.ProjectStudio.createFromOntology(config);host.toast('业务草案已保存。请继续核对范围与必要字段，模型和真实业务工具尚未接入。');
        }
        if(form.id==='ow-request-form'){
          const name=String(new FormData(form).get('name')||'').trim();if(!name||name.length>80||sensitive(name))throw new Error('请填写 80 字以内、不含敏感信息的能力名称。');
          if(storage.requests.some(request=>request.name===name))throw new Error('这项能力需求已登记。');storage.requests.push({name,status:'not-connected',source:'手动登记'});persist();refresh();host.toast('需求已登记，等待接入；未执行操作或更改权限。');
        }
        if(form.id==='ow-definition-form'){
          const input=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value).trim()]));
          if(!input.name||!input.description||input.name.length>30||input.description.length>240||input.fields.length>160||!['object','rule','action','alias'].includes(input.type))throw new Error('请补全业务定义，名称不超过 30 字，说明不超过 240 字。');
          if(Object.values(input).some(sensitive))throw new Error('请移除敏感信息，只保存业务含义。');
          if(model().nodes.some(node=>node.name===input.name))throw new Error('已有同名定义，请先查看或编辑原定义。');
          if(input.upstream&&!model().nodes.some(node=>node.id===input.upstream))throw new Error('引用的定义已不存在，请重新选择。');
          const id='definition-'+crypto.randomUUID();model().nodes.push({id,name:input.name,type:input.type,description:input.description,fields:input.fields,origin:'manual',...(input.type==='action'?{tool:'summary'}:{})});
          if(input.upstream)model().links.push({id:'relation-'+crypto.randomUUID(),source:input.upstream,target:id,label:'关联'});
          model().revision++;view().query='';view().definitionDraft={};window.OrbitOntology.view().selected=id;if(window.OntologyCatalog){window.OntologyCatalog.view().adding=false;window.OntologyCatalog.view().presentation='directory';window.OntologyCatalog.view().query='';window.OntologyCatalog.view().kind='all';}persist();refresh();host.toast('已保存本项目业务定义；未改变旧助手版本，也未接入真实工具。');
        }
      }catch(error){const target=document.getElementById('ow-error');if(target&&form.id==='ow-brief-form')target.textContent=error.message;else host.toast(error.message,true);}
    });
  }
  return {configure,page,data,view,makeDraft,compareBindings,references,flowReferences,dispatch,referenceSummary,openDefinition,definitionForm,libraryPage:library};
})();
