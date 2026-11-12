window.OrbitBusiness=(()=>{
  let host;let captured=null;const views=new Map();const policy=window.OrbitBusinessPolicy;
  const current=()=>window.PortfolioHub.navProject();
  const workspace=()=>window.ProjectStudio.data();
  const escape=value=>host.escape(String(value??''));
  const button=(label,action,attributes='',tone='quiet small')=>host.button(label,'od-'+action,tone,attributes);
  const kinds={object:'业务对象',alias:'业务叫法',rule:'处理规则',action:'业务动作',human:'人工确认'};
  function data(){return workspace().businessDefinitionDesigner||={id:'DESIGN-'+crypto.randomUUID(),input:'',history:[],proposal:null,sceneId:'',savedSnapshot:'',savedModel:null};}
  function view(){if(!views.has(current().id))views.set(current().id,{presentation:'star',focusId:'',edgeId:'',zoom:null,editing:false,showAll:false});return views.get(current().id);}
  function snapshot(){const storage=data();return JSON.stringify({model:window.OrbitOntology.data(),scene:workspace().scenes.find(entry=>entry.id===storage.sceneId)||null});}
  function valid(){return !!data().proposal&&data().proposal.snapshot===snapshot();}
  function target(){return valid()?data().proposal.model:window.OrbitOntology.data();}
  function previous(){const proposal=valid()?data().proposal:null;return proposal?Object.fromEntries(['name','goal','definitionIds','entryActionId'].map(key=>[key,proposal.design[key]])):data().savedModel?.design||null;}
  function request(meta){return {agentId:'manager',projectId:current().id,expectedRevision:meta.revision,consent:true,prompt:data().input,model:policy.projectModel(target(),current().id),history:data().history.slice(-12).map(({role,content})=>({role,content})),selectedNode:target().nodes.some(entry=>entry.id===view().focusId)?view().focusId:'',previous:previous()};}
  function differences(before,after){
    const changes=[];const summary=entry=>[entry.name+'：'+entry.description,...Object.entries({fields:'字段',keywords:'受理表达',transferWords:'转人工表达',blockedTerms:'限制表达',tool:'草稿方式'}).filter(([key])=>entry[key]).map(([key,label])=>label+'：'+entry[key])].join('；');
    for(const entry of after.nodes){const old=before.nodes.find(node=>node.id===entry.id);if(!old)changes.push({label:'新增 '+entry.name,before:'',after:summary(entry)});else if(JSON.stringify(policy.projectModel({nodes:[old],links:[]},current().id))!==JSON.stringify(policy.projectModel({nodes:[entry],links:[]},current().id)))changes.push({label:'修改 '+entry.name,before:summary(old),after:summary(entry)});}
    const sentence=(link,model)=>`${model.nodes.find(entry=>entry.id===link.source)?.name} — ${link.label} → ${model.nodes.find(entry=>entry.id===link.target)?.name}`;
    for(const link of after.links){const old=before.links.find(entry=>entry.id===link.id);if(!old||JSON.stringify(old)!==JSON.stringify(link))changes.push({label:old?'调整关系':'新增关系',before:old?sentence(old,before):'',after:sentence(link,after)});}
    for(const link of before.links)if(!after.links.some(entry=>entry.id===link.id))changes.push({label:'移除关系',before:sentence(link,before),after:''});
    return changes;
  }
  function receive(result,context,source,modelName){
    const parsed=policy.parseProposal(result,context);const storage=data();
    if(parsed.design){const next=policy.merge(target(),parsed.design);storage.proposal={design:parsed.design,model:next,snapshot:source,questions:parsed.questions,modelName,changes:differences(window.OrbitOntology.data(),next)};view().focusId=parsed.design.entryActionId;view().edgeId='';view().centerId='';view().trailId='';view().starHistory=[];}
    else if(storage.proposal)storage.proposal.questions=parsed.questions;
    storage.history.push({role:'user',content:context.prompt},{role:'assistant',content:parsed.message+(parsed.questions.length?'\n'+parsed.questions.join('\n'):'')});storage.history=storage.history.slice(-12);storage.input='';
  }
  function confirm(){
    if(!valid())throw Error('定义或助手已经变化，请重新生成，避免覆盖修改。');
    if(!window.OrbitDesigner.view().ack)throw Error('请先核对业务定义、关系与助手配置。');
    const storage=data();const proposal=storage.proposal;
    if(proposal.questions.length)throw Error('请先回复待确认问题，再创建助手。');
    const pendingEdits=window.OrbitOntology.view();
    if(Object.values(pendingEdits.definitionDrafts||{}).some(entry=>Object.keys(entry).length)||Object.values(pendingEdits.relationDrafts||{}).some(entry=>Object.keys(entry).length)||Object.keys(window.OrbitWorkbench.view().definitionDraft||{}).length)throw Error('还有未保存的手动定义，请先保存或清空再确认。');
    const model=structuredClone(proposal.model);model.revision=window.OrbitOntology.data().revision+1;
    const config=policy.compile(proposal.design,model,current().id);config.avatar=window.HubIdentity.appearance({art:'owl',tone:'teal'},storage.id);
    config.businessDesign={schema:1,projectId:current().id,designId:storage.id,source:'model-definitions',confirmed:true,brief:storage.history.filter(entry=>entry.role==='user').map(entry=>entry.content).join('\n'),requests:[]};
    const existing=workspace().scenes.find(entry=>entry.id===storage.sceneId);const original=storage.savedSnapshot?JSON.parse(storage.savedSnapshot).scene?.config:null;
    if(existing&&original)for(const key of ['name','goal','fields','keywords','transferWords','tool','handoff','knowledge','prompt','provider','model','connectionRef','avatar']){
      if(JSON.stringify(existing.config[key])===JSON.stringify(original[key]))continue;
      if(!['avatar','provider','model','connectionRef'].includes(key)&&JSON.stringify(config[key])!==JSON.stringify(original[key])&&JSON.stringify(config[key])!==JSON.stringify(existing.config[key]))throw Error('新设计与手动配置的「'+({name:'名称',goal:'职责',fields:'字段',keywords:'受理表达',transferWords:'转人工表达',tool:'草稿方式',handoff:'人工边界',knowledge:'知识引用',prompt:'Prompt'}[key]||key)+'」存在冲突，请先核对，未覆盖原配置。');
      config[key]=structuredClone(existing.config[key]);
    }
    window.AgentHarness.compile(config,current().id);
    const scene=window.ProjectStudio.confirmBusinessDesign({config,model,designId:storage.id,sceneId:storage.sceneId});
    storage.sceneId=scene.id;storage.savedModel={design:{...Object.fromEntries(['name','goal','definitionIds','entryActionId'].map(key=>[key,proposal.design[key]])),name:scene.config.name,goal:scene.config.goal}};storage.proposal=null;storage.savedSnapshot=snapshot();window.OrbitDesigner.view().ack=false;
    window.PortfolioHub.persist();host.render();host.toast('助手已创建，头像和配置已带入。测试前不会参与分派。');return scene;
  }
  function edit(values){
    if(!valid())throw Error('原定义已变化，请重新生成。');
    const proposal=data().proposal;const node=proposal.model.nodes.find(entry=>entry.id===values.id);if(!node)throw Error('请选择定义。');
    const patch={...node,name:values.name,description:values.description,fields:values.fields};
    const next=structuredClone(proposal.model);Object.assign(next.nodes.find(entry=>entry.id===node.id),patch);
    policy.model(policy.projectModel(next,current().id),current().id);policy.compile(proposal.design,next,current().id);
    proposal.model=next;proposal.changes=differences(window.OrbitOntology.data(),next);view().editing=false;window.OrbitDesigner.view().ack=false;window.OrbitDesigner.view().consent='';window.PortfolioHub.persist();host.render();
  }
  function starLayout(model,state){
    return window.OrbitStar.layout(model,state);
  }
  function diagram(model,state,prefix='od-business'){
    if(state.presentation==='star')return window.OrbitStar.diagram(model,state,prefix);
    const star=state.presentation==='star';const base=star?starLayout(model,state):window.OrbitAtlasGraph.catalogLayout(model,'complete');const layout=window.OrbitMap.bind(prefix,base,state,star?'star:'+base.centerId+':'+!!state.showAll:'cards:complete');const zoom=state.zoom??1;
    const selected=model.nodes.find(entry=>entry.id===state.focusId)||model.nodes.find(entry=>entry.id===layout.centerId);const edge=model.links.find(entry=>entry.id===state.edgeId);
    const related=edge?[edge]:selected?layout.links.filter(link=>link.source===selected.id||link.target===selected.id):layout.links;const relatedIds=new Set(related.flatMap(entry=>[entry.source,entry.target]));if(selected)relatedIds.add(selected.id);
    const sentence=link=>`${model.nodes.find(entry=>entry.id===link.source)?.name} — ${link.label} → ${model.nodes.find(entry=>entry.id===link.target)?.name}`;
    const action=(label,name,attributes='',tone='quiet small')=>host.button(label,prefix+'-'+name,tone,attributes);
    const marker=prefix+'-arrow';
    return `<div class="ob-graph" data-ob-graph="${prefix}" data-ob-mode="${state.presentation}" data-relationship-map="${prefix}"><div class="ob-graph-tools">${prefix==='catalog-star'?'<div class="rm-map-title">关系图谱 <span>以对象为中心</span></div>':`<div class="rm-view-switch" role="group" aria-label="关系图谱表现形式">${action('星状图','presentation',`data-value="star" aria-pressed="${star}"`,star?'small selected':'quiet small')}${action('卡片图','presentation',`data-value="cards" aria-pressed="${!star}"`,!star?'small selected':'quiet small')}</div>`}<div>${star?action(state.showAll?'只看直接关系':'展开全部','all',`aria-pressed="${!!state.showAll}"`):''}${window.OrbitMap.controls()}</div></div><div class="ob-graph-caption" role="status">${escape(edge?sentence(edge):star?`以「${selected?.name||'业务对象'}」为中心 · ${layout.links.length} 条关系`:'按对象、规则、动作和人工边界分区')}<small>${layout.nodes.length} 项定义 · ${layout.links.length} 条关系</small></div><div class="ob-graph-viewport" data-map-viewport tabindex="0" aria-label="关系图，拖动空白平移，方向键移动选中节点"><div class="ob-scaled" style="width:${layout.width*zoom}px;height:${layout.height*zoom}px"><div class="ob-stage" data-map-stage data-width="${layout.width}" data-height="${layout.height}" style="width:${layout.width}px;height:${layout.height}px;transform:scale(${zoom})">${layout.columns.map(column=>`<div class="og-lane-heading" style="left:${column.x}px;width:${column.width}px"><strong>${column.name}</strong><span>${column.count}</span></div>`).join('')}<svg class="og-edges" width="${layout.width}" height="${layout.height}" aria-hidden="true"><defs><marker id="${marker}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="context-stroke" stroke-width="1.3"/></marker></defs>${layout.links.map(link=>`<g data-map-edge="${escape(link.id)}" class="og-link${related.some(entry=>entry.id===link.id)?'':' is-muted'}${link.label==='原因假设'?' candidate':''}"><path d="${link.path}" marker-end="url(#${marker})"/></g>`).join('')}</svg>${layout.nodes.map(node=>`<button type="button" class="og-node ob-node${star?' ob-star-node':''}${node.id===selected?.id?' is-selected':''}${selected&&!relatedIds.has(node.id)?' is-muted':''}" data-map-node="${escape(node.id)}" title="${escape(node.name+'：'+(node.fields||node.description||''))}" data-action="${prefix}-select" data-id="${escape(node.id)}" data-kind="${node.type}" aria-pressed="${node.id===selected?.id}" style="left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px"><span><b>${node.displayNumber||String(model.nodes.findIndex(entry=>entry.id===node.id)+1).padStart(2,'0')}</b>${kinds[node.type]}</span><strong>${escape(node.name)}</strong><small>${escape(window.OrbitMap.excerpt(node.fields||node.description))}</small></button>`).join('')}${layout.links.map(link=>`<button type="button" data-map-label="${escape(link.id)}" data-map-visible="${related.some(entry=>entry.id===link.id)}" ${!link.labelPosition||!related.some(entry=>entry.id===link.id)?'hidden':''} class="og-edge-label${link.id===state.edgeId?' is-selected':''}" data-action="${prefix}-edge" data-id="${escape(link.id)}" aria-label="${escape(sentence(link))}" style="left:${link.labelPosition?.x||0}px;top:${link.labelPosition?.y||0}px;width:${link.labelPosition?.width||84}px">${escape(link.label)}</button>`).join('')}</div></div></div>${window.OrbitMap.hint()}<details class="ob-relations"><summary>关系清单 · ${related.length} 条${layout.hiddenNodes?' · '+layout.hiddenNodes+' 项暂未展开':''}</summary>${related.map(link=>action(escape(sentence(link)),'edge',`data-id="${escape(link.id)}"`)).join('')||'<p>这个对象还没有关系。</p>'}</details></div>`;
  }
  function preview(){
    const proposal=data().proposal;const design=proposal?.design||data().savedModel?.design;const model=proposal?.model||window.OrbitOntology.data();
    if(!design)return null;const ids=new Set(design.definitionIds);return {design,model:{...model,nodes:model.nodes.map((entry,index)=>({...entry,displayNumber:String(index+1).padStart(2,'0')})).filter(entry=>ids.has(entry.id)),links:model.links.filter(entry=>ids.has(entry.source)&&ids.has(entry.target))}};
  }
  function page({composer,meta,busy,title,error,connectionError,consent}){
    const storage=data();const state=view();const proposal=storage.proposal;const shown=preview();const selected=shown?.model.nodes.find(entry=>entry.id===state.focusId);const scene=workspace().scenes.find(entry=>entry.id===storage.sceneId);
    return `<section class="orbit-designer ob-designer" aria-label="描述业务生成定义与助手"><header class="od-heading"><div><span class="od-eyebrow">业务设计</span><h2>描述业务，梳理定义与关系</h2></div><div class="od-model"><span>${escape(title)}</span>${button('配置模型','configure')}${button('刷新','refresh')}</div></header>${connectionError?`<p class="od-notice" role="status">${escape(connectionError)}</p>`:''}<div class="od-layout"><section class="od-conversation"><header>${window.HubIdentity.worker('manager','md')}<div><strong>和连小山设计业务</strong><small>输入文字，或点麦克风说一段</small></div>${scene?button('新业务','business-new'):''}</header><div id="od-messages" class="od-messages" role="log" aria-label="业务设计对话">${storage.history.length?storage.history.map(entry=>`<article class="${entry.role==='user'?'is-user':''}"><span>${entry.role==='user'?'你':'连小山'}</span><p>${escape(entry.content)}</p></article>`).join(''):`<div class="od-welcome"><h3>你想让助手处理什么？</h3><p>说清服务对象、处理规则和例外情况，连小山会拆出定义与关系。</p><div>${button('售后报修','example','data-value="repair"')}${button('员工入职','example','data-value="onboarding"')}${button('门店巡检','example','data-value="inspection"')}</div></div>`}${busy?'<p class="od-working" role="status">正在理解业务、整理对象与关系…</p>':''}</div><form id="od-form" class="od-compose">${selected?`<div class="od-selection"><span>正在讨论：${escape(selected.name)}</span>${button('取消选择','business-clear')}</div>`:''}${composer}<label class="od-consent"><input id="od-consent" type="checkbox" ${consent?'checked':''} ${busy||!meta?.configured?'disabled':''}><span>本次将描述、最近6轮对话和本项目 ${window.OrbitOntology.data().nodes.length} 项定义发给所选模型，可能产生费用。仅使用脱敏内容。</span></label></form>${error?`<p class="od-error" role="alert">${escape(error)}</p>`:''}</section><section class="od-workspace"><header><div><span class="od-eyebrow">${proposal?'待确认设计':scene?'已确认设计':'关系预览'}</span><h3>${escape(shown?.design.name||'业务对象 · 规则 · 动作')}</h3></div><span class="ob-status">${proposal?'模型草稿':scene?'助手已创建':'等待业务描述'}</span></header>${shown?diagram(shown.model,state):`<div class="ob-empty"><div class="ob-empty-index" aria-hidden="true"><span>对象</span><i>关联</i><span>规则</span><i>约束</i><span>动作</span></div><h3>先描述，不必从画框开始</h3><p>生成后可切换星状图与卡片图，核对每一条关系。</p></div>`}${selected?`<section class="ob-definition"><div><span>${kinds[selected.type]}</span><h3>${escape(selected.name)}</h3><p>${escape(selected.description)}</p><small>${selected.fields?'字段：'+escape(selected.fields):'未单独定义字段'}</small></div>${proposal?button(state.editing?'收起编辑':'微调定义','business-edit',busy?'disabled':''):''}</section>${proposal&&state.editing?`<form id="od-definition-form" data-id="${escape(selected.id)}" class="ob-edit"><label>名称<input name="name" value="${escape(selected.name)}" required maxlength="30"></label><label>定义<textarea name="description" required maxlength="240">${escape(selected.description)}</textarea></label><label>字段<input name="fields" value="${escape(selected.fields||'')}" maxlength="160"></label><button class="button small" type="submit">保存到预览</button></form>`:''}`:''}${proposal?`<section class="od-proposal"><header><strong>${proposal.changes.length} 项定义与关系变化</strong><span>未保存到项目</span></header>${!valid()?'<p class="od-error">原定义或助手已变化，请重新生成。</p>':''}${proposal.questions.length?`<div class="od-questions"><strong>请先补充</strong><ol>${proposal.questions.map(question=>`<li>${escape(question)}</li>`).join('')}</ol></div>`:''}<details><summary>查看修改前后</summary>${proposal.changes.map(change=>`<div class="od-diff"><strong>${escape(change.label)}</strong><del>${escape(change.before)}</del><ins>${escape(change.after)}</ins></div>`).join('')||'<p>定义未变化，仅调整助手配置。</p>'}</details><div class="ob-agent-preview">${window.HubIdentity.assistant({name:proposal.design.name,avatar:scene?.config.avatar||{art:'owl',tone:'teal'}},'md')}<div><strong>${escape(proposal.design.name)}</strong><p>${escape(proposal.design.goal)}</p><small>自动带入头像、职责、字段与规则 · 待测试</small></div></div><label class="od-consent"><input id="od-ack" type="checkbox" ${window.OrbitDesigner.view().ack?'checked':''} ${busy?'disabled':''}><span>我已核对本次设计。创建助手，不启用分派或执行外部操作。</span></label><div class="od-actions">${button(scene?'确认并更新助手':'确认设计并创建助手','business-confirm',busy||!valid()||!window.OrbitDesigner.view().ack||proposal.questions.length?'disabled':'','primary small')}${button('放弃本次修改','business-discard',busy?'disabled':'')}</div></section>`:scene?`<section class="ob-created" role="status">${window.HubIdentity.assistant({name:scene.config.name,avatar:scene.config.avatar},'md')}<div><strong>${escape(scene.config.name)} · 已创建</strong><p>配置已带入，可以直接测试；无需再次新建。</p><small>尚未加入运行团队</small></div><div>${button('测试助手','business-tests','','primary small')}${button('查看配置','business-config')}</div></section>`:''}</section></div><details class="ob-legacy"><summary>已有流程与手工编辑</summary><p>保留原流程草稿，不要求先画流程再创建助手。</p>${button('打开原流程设计','flow-mode')}${host.button('手动编辑流程','ow-design-mode','quiet small','data-value="flow"')}</details></section>`;
  }
  function dispatch(name,element){
    const state=view();const storage=data();const shown=preview();
    if(['select','edge','clear','center','back','trail'].includes(name))window.OrbitDesigner.view().consent='';
    if(state.presentation==='star'&&shown&&window.OrbitStar.interact(name,element.dataset.id,state,shown.model)){state.editing=false;host.render();return;}
    if(name==='select'&&shown?.model.nodes.some(entry=>entry.id===element.dataset.id)){state.focusId=element.dataset.id;state.edgeId='';state.editing=false;}
    if(name==='edge'&&shown?.model.links.some(entry=>entry.id===element.dataset.id)){state.edgeId=element.dataset.id;state.editing=false;}
    if(name==='presentation'&&['star','cards'].includes(element.dataset.value)){state.presentation=element.dataset.value;state.zoom=null;if(state.presentation==='star'&&shown)window.OrbitStar.enter(shown.model,state);}
    if(name==='all')state.showAll=!state.showAll;
    if(name==='zoom')state.zoom=Math.max(.65,Math.min(1.4,state.zoom+(element.dataset.value==='in'?.1:-.1)));
    if(name==='fit'){const graph=document.querySelector('[data-ob-graph="od-business"]');const stage=graph?.querySelector('.ob-stage');state.zoom=stage?Math.max(.65,Math.min(1,(graph.clientWidth-20)/Number(stage.dataset.width))):1;}
    if(name==='clear'){state.focusId='';state.edgeId='';}
    if(name==='edit')state.editing=!state.editing;
    if(name==='confirm')return confirm();
    if(name==='discard'){storage.proposal=null;window.OrbitDesigner.view().ack=false;}
    if(name==='tests'||name==='config'){window.ProjectStudio.openScene(storage.sceneId);if(name==='tests')window.ProjectStudio.dispatch('tab',{dataset:{value:'tests'}});return;}
    if(name==='new'){if(storage.input||storage.proposal)throw Error('请先保留输入或放弃待确认设计，再开始新业务。');workspace().businessDefinitionDesigner=null;state.focusId='';state.edgeId='';state.centerId='';state.trailId='';state.starHistory=[];window.OrbitDesigner.view().consent='';}
    window.PortfolioHub.persist();host.render();
  }
  function capture(){
    const graph=document.querySelector('[data-ob-graph]');const viewport=graph?.querySelector('.ob-graph-viewport');const selected=graph?.querySelector('.ob-node.is-selected');const focused=document.activeElement;
    captured=current()&&viewport?{projectId:current().id,prefix:graph.dataset.obGraph,mode:graph.dataset.obMode,center:graph.dataset.obCenter,selected:selected?.dataset.id,left:viewport.scrollLeft,top:viewport.scrollTop,action:focused?.dataset?.action,id:focused?.dataset?.id}:null;
  }
  function mount(){
    const graph=document.querySelector('[data-ob-graph]');const viewport=graph?.querySelector('.ob-graph-viewport');const selected=graph?.querySelector('.ob-node.is-selected');if(!current()||!viewport)return;
    const previous=captured?.projectId===current().id&&captured.prefix===graph.dataset.obGraph?captured:null;
    if(previous&&previous.mode===graph.dataset.obMode&&previous.center===graph.dataset.obCenter)viewport.scrollTo(previous.left,previous.top);
    else viewport.scrollTo(0,0);
    if(previous?.action){const control=Array.from(graph.querySelectorAll('button')).find(entry=>entry.dataset.action===previous.action&&entry.dataset.id===previous.id);(control||selected)?.focus({preventScroll:true});}
  }
  return {configure(adapter){host=adapter;window.OrbitMap.configure(adapter);window.OrbitStar.configure(adapter);},data,view,snapshot,valid,target,request,receive,confirm,edit,differences,starLayout,diagram,page,dispatch,capture,mount};
})();
