window.OntologyCatalog=(()=>{
  let host;let captured=null;const views=new Map();
  const kinds={object:['业务对象','database'],action:['业务动作','bolt'],rule:['处理规则','shield-check'],alias:['业务叫法','message-circle'],human:['人工边界','user-check']};
  const current=()=>window.PortfolioHub.navProject();
  const model=()=>window.OrbitOntology.data();
  const workspace=()=>window.ProjectStudio.data();
  const escape=value=>host.escape(String(value??''));
  const button=(label,name,attributes='',tone='quiet small')=>host.button(label,'catalog-'+name,tone,attributes);
  const fields=value=>[...new Set(String(value||'').split(/[,，、\n]/).map(entry=>entry.trim()).filter(Boolean))];
  function view(){if(!views.has(current().id))views.set(current().id,{kind:'all',query:'',tab:'overview',editingId:'',adding:false,presentation:'graph',scope:'business',focusId:'',edgeId:'',zoom:null,relationsOpen:false,showAll:false});return views.get(current().id);}
  function selected(){return model().nodes.find(node=>node.id===window.OrbitOntology.view().selected)||model().nodes[0];}
  function references(id){
    const direct=window.OrbitWorkbench.references().filter(entry=>entry.config.ontologyBinding.nodes.some(node=>node.id===id)).map(entry=>({id:entry.id,name:entry.name,kind:entry.kind,sceneId:entry.sceneId,agentId:workspace().agents.some(agent=>agent.id===entry.id)?entry.id:'',changed:entry.changes.some(change=>change.id===id||[...(entry.config.ontologyBinding.links||[]),...(entry.next?.links||[])].some(link=>link.id===change.id&&(link.source===id||link.target===id))),mode:'contract'}));
    for(const entry of window.OrbitWorkbench.flowReferences()){
      if(!entry.snapshot.nodes.some(node=>node.id===id))continue;
      direct.push({...entry,mode:'reference',changed:entry.changes.some(change=>change.id===id)});
    }
    return direct;
  }
  function actions(id){
    return model().nodes.filter(node=>node.type==='action').flatMap(action=>{try{const config=window.OrbitOntology.configFromAction(action.id);return config.ontologyBinding.nodes.some(node=>node.id===id)?[{action,config}]:[];}catch{return [];}});
  }
  function select(id){if(!model().nodes.some(node=>node.id===id))return;if(view().editingId!==id)view().editingId='';window.OrbitOntology.view().selected=id;view().tab='overview';if(['graph','star'].includes(view().presentation)){view().focusId=id;view().edgeId='';if(!window.OrbitAtlasGraph.catalogLayout(model(),view().scope).nodes.some(node=>node.id===id))view().scope='complete';}host.render();}
  function detail(node){
    const state=view();const connected=model().links.filter(link=>link.source===node.id||link.target===node.id);const used=references(node.id);const applicable=actions(node.id);
    const candidate=model().links.some(link=>link.source===node.id&&link.label==='原因假设');
    const rows=fields(node.fields);const tabButton=(value,label)=>button(label,'tab',`data-value="${value}" aria-pressed="${state.tab===value}"`,state.tab===value?'small selected':'quiet small');
    let content='';
    if(state.tab==='overview')content=`<section class="oc-description"><h3>业务含义</h3><p>${escape(node.description||'尚未填写业务说明。')}</p>${candidate?'<p class="oc-warning">这是待核查的原因假设，不是已确认事实，不会作为事实依据带入助手。</p>':''}</section><section><div class="oc-section-title"><h3>必要信息</h3><span>${rows.length} 项</span></div>${rows.length?`<table class="oc-property-table"><thead><tr><th>业务字段</th><th>定义来源</th><th>当前取值</th></tr></thead><tbody>${rows.map(field=>`<tr><td>${host.icon('file-text','small')}${escape(field)}</td><td>本项目定义</td><td><span class="oc-unknown">待业务输入</span></td></tr>`).join('')}</tbody></table>`:'<p class="oc-muted">这条定义没有单独登记字段，可能由关联动作补齐。</p>'}</section><section><div class="oc-section-title"><h3>关联动作</h3><span>${applicable.length} 项</span></div>${applicable.length?applicable.map(({action,config})=>`<article class="oc-action"><div>${host.icon('bolt','small')}<strong>${escape(action.name)}</strong><span>仅准备草稿</span></div><p>需要：${fields(config.fields).map(escape).join('、')||'待补充'}</p><footer><small>真实系统未接入 · 需人工核对</small>${button('查看动作','select',`data-id="${escape(action.id)}"`)}</footer></article>`).join(''):'<p class="oc-muted">尚未关联动作，目前不会因此触发处理。</p>'}</section>`;
    if(state.tab==='relations')content=`<section><div class="oc-section-title"><h3>关系必须能读成一句话</h3><span>${connected.length} 条</span></div><div class="oc-relations">${connected.map(link=>{const source=model().nodes.find(item=>item.id===link.source);const target=model().nodes.find(item=>item.id===link.target);return `<article>${button(escape(source?.name||'已移除'),'select',`data-id="${escape(link.source)}"`)}<span>${escape(link.label)}<b>→</b></span>${button(escape(target?.name||'已移除'),'select',`data-id="${escape(link.target)}"`)}${link.label==='原因假设'?'<small>待验证，不代表因果结论</small>':''}</article>`;}).join('')||'<p class="oc-muted">尚未与其他定义建立关系。</p>'}</div></section>`;
    if(state.tab==='usage')content=`<section><div class="oc-section-title"><h3>谁在使用这条定义</h3><span>${used.length} 处</span></div>${used.length?used.map(entry=>`<article class="oc-reference"><div><strong>${escape(entry.name)}</strong><span class="${entry.changed?'oc-changed':''}">${entry.changed?'定义有变化，待复核':'引用内容一致'}</span></div><p>${escape(entry.kind)} · ${entry.mode==='reference'?'仅作为流程生成参考，不是自动执行规则':'已保存字段与规则快照'}</p>${button('打开引用','reference',`data-id="${escape(entry.id)}"`)}</article>`).join(''):'<div class="oc-no-use"><h3>还没有流程或助手引用它</h3><p>目前只是登记了定义，不会改变助手的处理行为。可以在流程设计中引用，无需重新填写。</p></div>'}<p class="oc-muted">修改定义不会改写已验收版本，引用方需重新核对后采用。</p></section>`;
    return `<div class="oc-detail"><header><span class="oc-type-label">${host.icon(kinds[node.type]?.[1]||'database','small')}${kinds[node.type]?.[0]||'业务定义'}</span><h2>${escape(node.name)}</h2><div class="oc-meta"><span>O${model().revision}</span><span>${node.origin==='manual'?'手动定义':'项目内定义'}</span><span>${used.length?'已有引用':'尚无引用'}</span></div></header><nav class="oc-tabs" aria-label="业务定义详情">${tabButton('overview','字段与动作')}${tabButton('relations','关系')}${tabButton('usage','引用与变更')}</nav><div class="oc-tab-content">${content}</div></div>`;
  }
  function impact(node){
    const applicable=actions(node.id);const chosen=applicable.find(entry=>entry.action.id===node.id)||applicable[0];const used=references(node.id);
    const required=fields(chosen?.config.fields||node.fields);const rules=chosen?.config.ontologyBinding.ruleNames||[];
    return `<aside class="oc-impact"><span class="oc-eyebrow">在连山里的作用</span><h3>让助手用同一套<br>业务定义办事</h3><ol><li><b>01</b><div><strong>知道在处理什么</strong><p>${escape(node.name)}${node.keywords?'；相关表达：'+escape(node.keywords):''}。</p></div></li><li><b>02</b><div><strong>知道还缺什么</strong><p>${required.length?'核对 '+required.map(escape).join('、')+'，缺少时先补充。':'必要信息尚未定义，需要补齐。'}</p></div></li><li><b>03</b><div><strong>知道能做到哪一步</strong><p>${chosen?'只能准备「'+escape(chosen.action.name)+'」，不能据此提交真实系统。':'没有关联动作，暂不触发业务处理。'}</p></div></li></ol>${rules.length?`<details><summary>需遵循的 ${rules.length} 条规则</summary>${rules.map(rule=>`<p>${escape(rule)}</p>`).join('')}</details>`:''}<div class="oc-impact-footer"><strong>${used.length?used.length+' 处真实配置引用':'尚未影响任何助手'}</strong><p>${used.length?'查看引用，才能知道变更会影响谁。':'先带入流程，再核对和验收，定义才会被用起来。'}</p>${button((workspace().businessDesigner?.referenceIds||[]).includes(node.id)?'已选 · 返回流程':'引用到当前流程','use',`data-id="${escape(node.id)}"`,'primary small')}${button('编辑这条定义','edit',`data-id="${escape(node.id)}"`)}</div></aside>`;
  }
  function mapData(){
    const state=view();const layout=window.OrbitMap.bind('catalog-map',window.OrbitAtlasGraph.catalogLayout(model(),state.scope),state,'cards:'+state.scope);
    const edge=layout.links.find(link=>link.id===state.edgeId);const focus=layout.nodes.find(node=>node.id===state.focusId);
    const highlighted=edge?[edge]:focus?layout.links.filter(link=>link.source===focus.id||link.target===focus.id):layout.links;
    const ids=new Set(highlighted.flatMap(link=>[link.source,link.target]));if(focus)ids.add(focus.id);
    return {...layout,highlighted,ids,focused:!!edge||!!focus,edge,focus};
  }
  function relationText(link){
    return `${model().nodes.find(node=>node.id===link.source)?.name||'已移除'} — ${link.label} → ${model().nodes.find(node=>node.id===link.target)?.name||'已移除'}`;
  }
  function mapDetail(node,layout){
    const used=references(node.id);const attached=actions(node.id);const chosen=attached.find(entry=>entry.action.id===node.id)||attached[0];
    const required=fields(chosen?.config.fields||node.fields);const candidate=window.OrbitAtlasGraph.role(node,model())==='candidate';
    const related=layout.links.filter(link=>link.source===node.id||link.target===node.id);
    return `<section class="og-detail" aria-label="所选定义与业务影响">
      <div class="og-definition"><span class="oc-type-label">${host.icon(kinds[node.type]?.[1]||'database','small')}${kinds[node.type]?.[0]||'业务定义'}</span><h3>${escape(node.name)}</h3><p>${escape(node.description||'尚未填写业务说明。')}</p>${candidate?'<p class="oc-warning">原因假设 · 待验证，不作为已确认事实。</p>':''}<div class="og-detail-actions">${button('字段与动作','open-directory',`data-id="${escape(node.id)}"`)}${button('编辑定义与关系','edit',`data-id="${escape(node.id)}"`)}</div></div>
      <div class="og-requirements"><h4>这条定义约束什么</h4>${required.length?`<div class="og-field-tags">${required.map(field=>`<span>${escape(field)}</span>`).join('')}</div><p>字段待业务输入，缺少时先补齐。</p>`:'<p>未单独登记必要字段。</p>'}${chosen?`<p><strong>${escape(chosen.action.name)}</strong> · 仅准备草稿，真实系统未接入。</p>`:'<p>尚未关联可配置的业务动作。</p>'}<details><summary>查看 ${related.length} 条直接关系</summary>${related.map(link=>button(escape(relationText(link)),'edge',`data-id="${escape(link.id)}"`)).join('')||'<p>尚无直接关系。</p>'}</details></div>
      <div class="og-usage"><h4>${used.length?used.length+' 处配置引用':'尚未影响任何助手'}</h4>${used.length?`<div>${used.map(entry=>`<article><strong>${escape(entry.name)}</strong><small>${entry.changed?'定义已变化 · 待复核':entry.mode==='reference'?'流程设计参考':'已保存规则快照'}</small>${button('查看','reference',`data-id="${escape(entry.id)}"`)}</article>`).join('')}</div>`:'<p>还没有流程或助手引用这条定义。</p>'}${button((workspace().businessDesigner?.referenceIds||[]).includes(node.id)?'已选 · 返回流程':'引用到当前流程','use',`data-id="${escape(node.id)}"`,'primary small')}<small>不发布，不执行真实操作</small></div>
    </section>`;
  }
  function mapPanel(){
    const state=view();const layout=mapData();const node=selected();const zoom=state.zoom??1;
    const activeLinks=new Set(layout.highlighted.map(link=>link.id));
    const caption=layout.edge?relationText(layout.edge):layout.focus?`聚焦「${layout.focus.name}」 · ${layout.highlighted.length} 条直接关系`:'按分区阅读定义，点击节点查看它与谁有关。';
    return `<section class="ontology-map" data-relationship-map="catalog-map" aria-label="分层业务关系图谱">
      <header class="og-header"><div><h2>关系图谱</h2><p>对象是什么，受哪些规则约束，允许准备哪些动作。</p></div><div class="og-scope" role="group" aria-label="图谱范围">${button('核心业务','scope',`data-value="business" aria-pressed="${state.scope==='business'}"`,state.scope==='business'?'small selected':'quiet small')}${button('全部定义','scope',`data-value="complete" aria-pressed="${state.scope==='complete'}"`,state.scope==='complete'?'small selected':'quiet small')}</div></header>
      <div class="og-toolbar"><label for="og-locate">定位定义<select id="og-locate"><option value="">选择对象、规则或动作</option>${model().nodes.map(entry=>`<option value="${escape(entry.id)}" ${state.focusId===entry.id?'selected':''}>${escape(entry.name)}</option>`).join('')}</select></label><div class="og-map-actions">${button('显示全部关系','map-reset',layout.focused?'':'disabled')}${window.OrbitMap.controls()}</div></div>
      <div class="og-focus-caption" role="status"><span>${escape(caption)}</span><small>${layout.nodes.length} / ${model().nodes.length} 项定义 · ${layout.highlighted.length} / ${layout.links.length} 条关系</small></div>
      ${layout.nodes.length?`<div id="og-viewport" class="og-viewport" data-map-viewport tabindex="0" aria-label="业务关系图，可横向滚动查看各分区"><div id="og-scaled-space" style="width:${layout.width*zoom}px;height:${layout.height*zoom}px"><div id="og-stage" class="og-stage" data-map-stage data-width="${layout.width}" data-height="${layout.height}" style="width:${layout.width}px;height:${layout.height}px;transform:scale(${zoom})">
        ${layout.columns.map(column=>`<div class="og-lane-heading" style="left:${column.x}px;width:${column.width}px"><strong>${column.name}</strong><span>${column.count}</span></div>`).join('')}
        <svg class="og-edges" width="${layout.width}" height="${layout.height}" aria-hidden="true"><defs><marker id="og-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="context-stroke" stroke-width="1.3"/></marker></defs>${layout.links.map(link=>`<g data-map-edge="${escape(link.id)}" class="og-link ${link.kind}${activeLinks.has(link.id)?'':' is-muted'}"><path d="${link.path}" marker-end="url(#og-arrow)"/></g>`).join('')}</svg>
        ${layout.nodes.map(entry=>`<button type="button" class="og-node${node?.id===entry.id?' is-selected':''}${layout.focused&&!layout.ids.has(entry.id)?' is-muted':''}" data-map-node="${escape(entry.id)}" title="${escape(entry.name+'：'+(entry.fields||entry.description||''))}" data-action="catalog-map-select" data-id="${escape(entry.id)}" data-kind="${escape(entry.type)}" style="left:${entry.x}px;top:${entry.y}px;width:${entry.width}px;height:${entry.height}px" aria-pressed="${node?.id===entry.id}" aria-label="查看${escape(entry.name)}的关系与业务定义"><span><b>${String(model().nodes.findIndex(node=>node.id===entry.id)+1).padStart(2,'0')}</b>${entry.auxiliary?(window.OrbitAtlasGraph.role(entry,model())==='candidate'?'原因假设 · 待验证':kinds[entry.type]?.[0]||'适用范围'):kinds[entry.type]?.[0]||'业务定义'}</span><strong>${escape(entry.name)}</strong><small>${fields(entry.fields).length?escape(window.OrbitMap.excerpt(fields(entry.fields).join(' · '))):entry.type==='action'?'仅准备草稿':entry.type==='human'?'不自动审批':'查看定义与关系'}</small></button>`).join('')}
        ${layout.links.map(link=>`<button type="button" data-map-label="${escape(link.id)}" data-map-visible="${activeLinks.has(link.id)}" ${!link.labelPosition||!activeLinks.has(link.id)?'hidden':''} class="og-edge-label ${link.kind}${state.edgeId===link.id?' is-selected':''}" data-action="catalog-edge" data-id="${escape(link.id)}" style="left:${link.labelPosition?.x||0}px;top:${link.labelPosition?.y||0}px;width:${link.labelPosition?.width||84}px" aria-label="${escape(relationText(link))}" title="${escape(relationText(link))}">${escape(link.label)}</button>`).join('')}
      </div></div></div>`:`<div class="og-empty"><h3>当前范围没有业务定义</h3><p>可切换全部定义，或新增对象、规则与动作。</p>${button('查看全部定义','scope','data-value="complete"')}${button('新增定义','new','','small')}</div>`}
      ${window.OrbitMap.hint()}<footer class="og-footer"><div><span><i></i>已定义关系</span><span><i class="is-dashed"></i>限制 / 待验证</span></div><small>箭头表示关系方向，不是执行进度${layout.hiddenNodes?' · '+layout.hiddenNodes+' 项辅助定义已收起':''}</small></footer>
      <details class="og-relation-list" id="og-relation-list" ${state.relationsOpen?'open':''}><summary>关系清单 <span>${layout.highlighted.length} 条${layout.highlighted.some(link=>!link.labelPosition)?' · 含未在画布标注的关系':''}</span></summary>${layout.highlighted.map(link=>`<article>${button(escape(model().nodes.find(entry=>entry.id===link.source)?.name),'map-select',`data-id="${escape(link.source)}"`)}${button(escape(link.label)+' →','edge',`data-id="${escape(link.id)}"`,state.edgeId===link.id?'small selected':'quiet small')}${button(escape(model().nodes.find(entry=>entry.id===link.target)?.name),'map-select',`data-id="${escape(link.target)}"`)}${link.kind==='candidate'?'<small>待验证，不代表因果结论</small>':''}</article>`).join('')||'<p class="oc-muted">当前定义还没有关联关系。</p>'}</details>
    </section>${node?mapDetail(node,layout):''}`;
  }
  function page(){
    const state=view();const node=selected();const query=state.query.trim().toLowerCase();const nodes=model().nodes.filter(entry=>(state.kind==='all'||entry.type===state.kind)&&(entry.name+' '+entry.description+' '+(entry.fields||'')).toLowerCase().includes(query));
    const directory=`<div class="oc-workbench"><aside class="oc-directory"><header><h2>定义目录</h2></header><label class="oc-search">${host.icon('search','small')}<input id="oc-search" value="${escape(state.query)}" placeholder="查找对象、规则或动作" aria-label="查找业务定义"></label><nav aria-label="定义类型">${[['all',['全部定义','folders']],...Object.entries(kinds)].map(([kind,[label,icon]])=>button(host.icon(icon,'small')+label+`<span>${model().nodes.filter(entry=>kind==='all'||entry.type===kind).length}</span>`,'kind',`data-value="${kind}" aria-pressed="${state.kind===kind}"`,state.kind===kind?'selected':'quiet')).join('')}</nav><div class="oc-entries" aria-label="定义列表">${nodes.map(entry=>button(`<span>${host.icon(kinds[entry.type]?.[1]||'database','small')}</span><span><strong>${escape(entry.name)}</strong><small>${kinds[entry.type]?.[0]||'业务定义'} · ${references(entry.id).length} 处引用</small></span>`,'select',`data-id="${escape(entry.id)}" aria-pressed="${node?.id===entry.id}"`,node?.id===entry.id?'selected':'quiet')).join('')||'<p class="oc-muted">没有匹配的定义。</p>'}</div></aside>${node?detail(node)+impact(node):'<div class="oc-no-use"><h2>先定义业务对象和动作</h2><p>本项目还没有业务定义。</p></div>'}</div>`;
    return `<section class="ontology-catalog" aria-label="业务定义与关系"><div class="oc-view-bar"><nav aria-label="业务定义视图">${button('星状图','presentation',`data-value="star" aria-pressed="${state.presentation==='star'}"`,state.presentation==='star'?'selected':'quiet')}${button('卡片图','presentation',`data-value="graph" aria-pressed="${state.presentation==='graph'}"`,state.presentation==='graph'?'selected':'quiet')}${button('定义目录','presentation',`data-value="directory" aria-pressed="${state.presentation==='directory'}"`,state.presentation==='directory'?'selected':'quiet')}</nav><div class="oc-library-actions"><span>本项目 · O${model().revision}</span>${button('新增定义','new','','small')}${button('描述业务','return','','primary small')}</div></div><p class="oc-purpose-line">同一份业务定义，可切换星状图、卡片图或目录查看。</p>${state.adding?window.OrbitWorkbench.definitionForm().replace('<details class="ow-definition-add">','<details class="ow-definition-add" open>'):''}${state.editingId?editorPanel(state.editingId):''}${state.presentation==='star'?window.OrbitBusiness.diagram(model(),state,'catalog-star')+(node?mapDetail(node,{links:model().links}):''):state.presentation==='graph'?mapPanel():directory}<details class="oc-advanced" id="ontology-rules-demo"><summary>规则预览 <span>本地示例，不计入验收</span></summary>${window.OntologyUsage.page()}</details></section>`;
  }
  function editorPanel(identifier){
    const node=model().nodes.find(entry=>entry.id===identifier);if(!node)return '';
    return `<section class="oc-inline-editor" id="oc-editor" aria-label="编辑共享定义"><header><div><span>编辑共享定义</span><h3>${escape(node.name)}</h3></div>${button('收起编辑','close-editor')}</header>${window.OrbitOntology.editors(identifier,true)}</section>`;
  }
  function configure(adapter){
    host=adapter;
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="catalog-"]');if(!element||element.disabled||!current())return;event.preventDefault();const name=element.dataset.action.slice(8);const id=element.dataset.id;
      try{
        if(name.startsWith('star-')){const control=name.slice(5);if(control==='select'){select(id);view().focusId=id;view().edgeId='';}if(control==='edge'){view().edgeId=id;const relation=model().links.find(entry=>entry.id===id);if(relation)window.OrbitOntology.view().selected=relation.target;}if(control==='presentation')view().presentation=element.dataset.value==='cards'?'graph':'star';if(control==='all')view().showAll=!view().showAll;if(control==='zoom')view().zoom=Math.max(.65,Math.min(1.4,(view().zoom??1)+(element.dataset.value==='in'?.1:-.1)));if(control==='fit'){const graph=document.querySelector('[data-ob-graph="catalog-star"]');const stage=graph?.querySelector('.ob-stage');view().zoom=stage?Math.max(.65,Math.min(1,(graph.clientWidth-20)/Number(stage.dataset.width))):1;}host.render();return;}
        if(name==='select')select(id);
        if(name==='map-select'){select(id);focusNode(id);}
        if(name==='presentation'&&['graph','star','directory'].includes(element.dataset.value)){view().presentation=element.dataset.value;host.render();}
        if(name==='open-directory'){view().presentation='directory';select(id);}
        if(name==='scope'&&['business','complete'].includes(element.dataset.value)){view().scope=element.dataset.value;view().focusId='';view().edgeId='';view().zoom=null;const nodes=mapData().nodes;if(nodes.length&&!nodes.some(node=>node.id===selected()?.id))window.OrbitOntology.view().selected=nodes[0].id;host.render();}
        if(name==='map-reset'){view().focusId='';view().edgeId='';host.render();}
        if(name==='edge'){const link=model().links.find(entry=>entry.id===id);if(!link)return;if(view().editingId!==link.target)view().editingId='';window.OrbitOntology.view().selected=link.target;view().focusId='';view().edgeId=id;host.render();}
        if(name==='map-zoom'){view().zoom=Math.max(.8,Math.min(1.4,(view().zoom??1)+(element.dataset.value==='in'?.1:-.1)));host.render();}
        if(name==='map-fit'){view().zoom=null;host.render();document.getElementById('og-viewport')?.scrollTo(0,0);}
        if(name==='kind'&&(element.dataset.value==='all'||kinds[element.dataset.value])){view().kind=element.dataset.value;host.render();}
        if(name==='tab'&&['overview','relations','usage'].includes(element.dataset.value)){view().tab=element.dataset.value;host.render();}
        if(name==='use'){window.OrbitDesigner.view().purpose='flow';window.OrbitDesigner.selectReference(id);window.OrbitWorkbench.view().mode='prompt';window.OrbitWorkbench.view().section='compose';window.ProjectStudio.dispatch('tab',{dataset:{value:'workbench'}});}
        if(name==='edit'&&model().nodes.some(node=>node.id===id)){window.OrbitOntology.view().selected=id;view().editingId=id;view().adding=false;host.render();document.getElementById('oc-editor')?.scrollIntoView({block:'nearest'});document.getElementById('ontology-definition-name')?.focus({preventScroll:true});}
        if(name==='close-editor'){view().editingId='';host.render();}
        if(name==='return'){window.OrbitWorkbench.view().section='compose';window.ProjectStudio.dispatch('tab',{dataset:{value:'workbench'}});}
        if(name==='new'){view().adding=true;view().editingId='';window.ProjectStudio.designSection('library');host.navigate('orbit');document.querySelector('.ow-definition-add input')?.focus({preventScroll:true});}
        if(name==='reference'){
          const entry=references(selected().id).find(item=>item.id===id);if(!entry)return;
          if(entry.agentId)window.ProjectStudio.dispatch('agent',{dataset:{id:entry.agentId,tab:'versions'}});else if(entry.sceneId)window.ProjectStudio.openScene(entry.sceneId);else {window.OrbitWorkbench.view().mode='prompt';window.OrbitWorkbench.view().section='compose';window.ProjectStudio.dispatch('tab',{dataset:{value:'workbench'}});}
        }
      }catch(error){host.toast(error.message,true);}
    });
    document.addEventListener('input',event=>{if(event.target.id!=='oc-search'||!current())return;const position=event.target.selectionStart;view().query=event.target.value;host.render();const input=document.getElementById('oc-search');input?.focus({preventScroll:true});input?.setSelectionRange(position,position);});
    document.addEventListener('change',event=>{if(event.target.id==='og-locate'&&current()&&event.target.value){select(event.target.value);focusNode(event.target.value);}});
    document.addEventListener('keydown',event=>{if(!current()||event.key!=='Escape'||!event.target.closest('#og-viewport'))return;event.preventDefault();view().focusId='';view().edgeId='';host.render();});
    document.addEventListener('toggle',event=>{
      if(!current())return;
      if(event.target.id==='og-relation-list')view().relationsOpen=event.target.open;
      if(event.target.classList?.contains('ow-definition-add'))view().adding=event.target.open;
    },true);
  }
  function capture(){
    const viewport=document.getElementById('og-viewport');const focused=document.activeElement;
    captured=current()&&viewport?{projectId:current().id,left:viewport.scrollLeft,top:viewport.scrollTop,focusedId:focused?.id,action:focused?.dataset?.action,id:focused?.dataset?.id,value:focused?.dataset?.value}:null;
  }
  function mount(){
    const viewport=document.getElementById('og-viewport');const stage=document.getElementById('og-stage');const space=document.getElementById('og-scaled-space');if(!current()||!viewport||!stage||!space)return;
    const width=Number(stage.dataset.width);const height=Number(stage.dataset.height);if(view().zoom===null)view().zoom=Math.max(.8,Math.min(1,(viewport.clientWidth-12)/width));
    const zoom=view().zoom;stage.style.transform=`scale(${zoom})`;space.style.width=width*zoom+'px';space.style.height=height*zoom+'px';const readout=document.getElementById('og-zoom-readout');if(readout)readout.textContent=Math.round(zoom*100)+'%';
    if(captured?.projectId!==current().id)return;
    viewport.scrollTo(captured.left,captured.top);
    const control=captured.focusedId?document.getElementById(captured.focusedId):Array.from(document.querySelectorAll('[data-action^="catalog-"]')).find(element=>element.dataset.action===captured.action&&element.dataset.id===captured.id&&element.dataset.value===captured.value);
    control?.focus({preventScroll:true});
  }
  function focusNode(id){
    const viewport=document.getElementById('og-viewport');const node=mapData().nodes.find(entry=>entry.id===id);if(!viewport||!node)return;const zoom=view().zoom??1;
    const left=node.x*zoom;const top=node.y*zoom;const right=left+node.width*zoom;const bottom=top+node.height*zoom;
    if(left<viewport.scrollLeft||right>viewport.scrollLeft+viewport.clientWidth||top<viewport.scrollTop||bottom>viewport.scrollTop+viewport.clientHeight)viewport.scrollTo(Math.max(0,left-(viewport.clientWidth-node.width*zoom)/2),Math.max(0,top-(viewport.clientHeight-node.height*zoom)/2));
  }
  return {configure,page,view,selected,select,references,actions,mapData,capture,mount};
})();
