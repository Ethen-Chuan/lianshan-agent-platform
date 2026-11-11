window.OrbitOntology=(()=>{
  let host;
  let cleanup=()=>{};
  const views=new Map();
  const graph=window.OrbitAtlasGraph;
  const labels={object:'业务对象',alias:'同义表达',rule:'业务规则',action:'业务动作',human:'人工节点'};
  const colors={object:'#c2d4aa',alias:'#a8b6ad',rule:'#dfc48c',action:'#86cbbb',human:'#a5bbdf'};
  const roleNames={object:'受理现象',alias:'同义表达',scope:'适用对象',candidate:'候选原因',evidence:'待核依据',rule:'业务规则',action:'业务动作',human:'人工确认'};
  const escape=value=>host.escape(String(value??''));
  const button=(label,name,extra='',tone='quiet small')=>{
    const captions={zoom:extra.includes('out')?'缩小':'放大',fit:'适应',pause:view().paused?'播放':'暂停',theme:'明暗',fullscreen:'全屏'};
    return host.button(label+(captions[name]?'<span class="ontology-control-caption">'+captions[name]+'</span>':''),'ontology-'+name,tone,extra);
  };
  const current=()=>window.PortfolioHub.navProject();
  const persist=()=>window.PortfolioHub.persist();
  function view(){
    if(!views.has(current().id))views.set(current().id,{mode:'flow',scope:'mainline',presentation:'graph',local:false,inspector:'details',selected:'symptom',theme:'dark',progressive:false,expanded:new Set(['symptom']),dragMode:'branch',zoom:1,pan:{x:0,y:0},paused:false,query:'',filter:'all',positions:{}});
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
    return graph.visible(data(),view()).nodes;
  }
  function relationshipList(){
    const model=data();const state=view();const shown=graph.visible(model,state);const indexed=new Map(model.nodes.map(node=>[node.id,node]));
    return `<header><div><h2>把关系读成一句话</h2><p>从谁出发，通过什么关系，指向谁。与图谱使用同一份本体定义。</p></div><span>${shown.links.length} 条有向关系</span></header><div class="atlas-relation-table">${shown.links.map(link=>{const source=indexed.get(link.source);const target=indexed.get(link.target);const kind=graph.relation(link);return `<article class="atlas-relation-row ${state.filter!=='all'&&state.filter!==kind?'is-dim':''}" data-source="${escape(link.source)}" data-target="${escape(link.target)}"><button data-action="ontology-select" data-id="${escape(source.id)}"><small>${roleNames[graph.role(source,model)]}</small><strong>${escape(source.name)}</strong></button><span class="atlas-relation-verb" style="--relation-color:${graph.palette[kind][state.theme==='light'?'light':'color']}">${escape(link.label)}<b aria-hidden="true">→</b></span><button data-action="ontology-select" data-id="${escape(target.id)}"><small>${roleNames[graph.role(target,model)]}</small><strong>${escape(target.name)}</strong></button><p>${kind==='candidate'?'仅为原因假设，不能据此确认故障':kind==='boundary'?'限制后续动作，不授予执行权限':kind==='human'?'交给负责人核对，不替代人工审批':kind==='context'?'统一名称或适用范围，不代表因果':'用于定义处理依据，不表示已经执行'}</p></article>`;}).join('')||'<p class="atlas-list-empty">当前范围没有关系。关闭“只看相关”或切换“完整本体”查看。</p>'}</div>`;
  }
  function editors(identifier,expanded=false){
    const saved=data().nodes.find(entry=>entry.id===identifier);if(!saved)return '';
    const node={...saved,...view().definitionDrafts?.[identifier]};const options=data().nodes.filter(entry=>entry.id!==identifier);const relation=view().relationDrafts?.[identifier]||{};
    return `<details class="ontology-editor" ${expanded?'open':''}><summary>编辑${labels[node.type]}</summary><form id="ontology-node-form" data-id="${escape(node.id)}"><label>名称<input id="ontology-definition-name" name="name" value="${escape(node.name)}" required maxlength="30"></label><label>定义与边界<textarea name="description" required maxlength="240" rows="3">${escape(node.description)}</textarea></label>${['rule','action','object'].includes(node.type)?`<label>必要字段（逗号分隔）<input name="fields" value="${escape(node.fields||'')}" maxlength="160"></label>`:''}${node.type==='object'?`<label>受理表达（逗号分隔）<input name="keywords" value="${escape(node.keywords||'')}" maxlength="160"></label>`:''}${node.type==='rule'?`<label>触发转人工的表达<input name="transferWords" value="${escape(node.transferWords||'')}" maxlength="160"></label>`:''}<button class="button small" type="submit">保存本项目定义</button><p class="ontology-form-note">更新不会改写已验收的助手版本。</p></form></details><details class="ontology-editor" ${Object.keys(relation).length?'open':''}><summary>添加有向关系</summary><form id="ontology-relation-form" data-id="${escape(node.id)}"><p class="ontology-form-note">从「${escape(node.name)}」指向下方选择的元素。</p><label>关系<select name="label">${['关联','约束','执行','需核实','原因假设','同义表达'].map(label=>`<option ${relation.label===label?'selected':''}>${label}</option>`).join('')}</select></label><label>指向<select name="target">${options.map(item=>`<option value="${escape(item.id)}" ${relation.target===item.id?'selected':''}>${escape(item.name)}</option>`).join('')}</select></label><button class="button small" type="submit">添加关系</button><p class="ontology-form-note">只影响下一份草案，不改变已发布版本。</p></form></details>`;
  }
  function nodeDetail(){
    const model=data();const state=view();const node=model.nodes.find(item=>item.id===state.selected)||model.nodes[0];
    if(!node)return '<p>本项目尚未定义业务元素。</p>';
    const tabs=`<nav class="atlas-inspector-tabs" aria-label="本体详情">${button('定义详情','inspector','data-value="details" aria-pressed="'+(state.inspector==='details')+'"',state.inspector==='details'?'active':'')}${button('元素目录 <span>'+model.nodes.length+'</span>','inspector','data-value="directory" aria-pressed="'+(state.inspector==='directory')+'"',state.inspector==='directory'?'active':'')}</nav>`;
    if(state.inspector==='directory')return tabs+`<div class="atlas-directory">${Object.entries(roleNames).map(([kind,label])=>{const nodes=model.nodes.filter(item=>graph.role(item,model)===kind);return nodes.length?`<section><h3>${label}<span>${nodes.length}</span></h3>${nodes.map(item=>button(escape(item.name)+host.icon('arrow-up-right','small'),'select',`data-id="${escape(item.id)}"`)).join('')}</section>`:'';}).join('')}</div>`;
    const relationships=model.links.filter(link=>link.source===node.id||link.target===node.id);
    const options=model.nodes.filter(item=>item.id!==node.id);
    const kind=graph.role(node,model);
    const impact={object:'统一问题名称，关联对应处理规则。现象本身不能作为故障结论。',alias:'将不同叫法归到同一受理范围。',scope:'限定业务对象范围，不把其他对象的规则当作当前事实。',candidate:'只补充排查方向。创建助手草案时，不将原因假设作为事实依据带入。',evidence:'把未知信息变成待补齐字段；信息不足时先追问，不直接承诺权益。',rule:'为相关动作补充字段要求与转人工表达。它是配置依据，不是已执行的指令。',action:'把上游业务定义整理成助手配置，保留版本快照；还需案例验收和人工确认。',human:'设置转人工条件。助手可准备草稿，对外承诺需负责人核对。'};
    const configuration=node.type==='action'?configFromAction(node.id):null;
    const fields=String(configuration?.fields||node.fields||'').split(/[,，、\n]/).filter(Boolean);
    return tabs+`<div class="atlas-object-detail"><div class="atlas-definition"><div class="ontology-inspector-heading"><span class="ontology-kind kind-${node.type}">${roleNames[kind]}</span><span>O${model.revision} · ${node.origin==='manual'?'人工定义':'示例定义'}</span></div><h2>${escape(node.name)}</h2><p class="ontology-description">${escape(node.description)}</p>${configuration?button('创建业务助手草案 '+host.icon('arrow-up-right','small'),'create',`data-id="${escape(node.id)}"`,'primary ontology-create'):''}${window.OntologyUsage?.inspector()||''}<details class="copy-help atlas-impact"><summary>用途说明</summary><p>${impact[kind]}</p></details></div><div class="atlas-rule-info">${fields.length?`<section class="atlas-fields"><h3>${configuration?'将带入的必填信息':'关联的必要信息'} <span>${fields.length}</span></h3><div>${fields.map(field=>`<span>${escape(field)}</span>`).join('')}</div></section>`:''}${configuration?`<section class="atlas-binding"><h3>将继承的业务规则 <span>${configuration.ontologyBinding.ruleNames.length}</span></h3>${configuration.ontologyBinding.ruleNames.map(name=>`<p>${host.icon('shield-check','small')}${escape(name)}</p>`).join('')}<small>原因假设不带入事实依据；旧版本不随本体修改。</small></section>`:''}</div><div class="atlas-relation-info"><section class="ontology-detail-section"><h3>直接关系 <span>${relationships.length}</span></h3>${relationships.map(link=>{const source=model.nodes.find(item=>item.id===link.source);const target=model.nodes.find(item=>item.id===link.target);if(!source||!target)return '';const other=link.source===node.id?target:source;const color=graph.palette[graph.relation(link)].color;return `<button class="ontology-relation" data-action="ontology-select" data-id="${escape(other.id)}" data-source="${escape(source.id)}" data-target="${escape(target.id)}" style="--relation-color:${color}"><span>${escape(link.label)}${link.label==='原因假设'?' · 待验证':''}</span><strong><span>${escape(source.name)}</span><b aria-label="指向">→</b><span>${escape(target.name)}</span></strong></button>`;}).join('')||'<p>暂无关系。可在下方添加本项目关系。</p>'}</section>${editors(node.id)}<div class="ontology-inspector-foot">${host.icon('shield-check','small')}<span>位置不代表因果<br>流光不代表动作已执行</span></div></div></div>`;
  }
  function page(){
    const model=data();const state=view();


    return `<section id="ontology-shell" class="ontology-shell atlas-shell ${state.theme==='light'?'is-light':''} ${state.paused?'is-paused':''}" data-scope="${state.scope}" data-layout="${state.mode}"><header class="ontology-toolbar"><div class="atlas-identity"><span class="atlas-mark">${host.icon('share','small')}</span><div><strong>Ontology <span>定义与关系</span></strong></div></div><div class="atlas-top-actions"><span class="atlas-version"><i></i> O${model.revision} · 本地示例</span>${button('从动作创建助手 '+host.icon('arrow-up-right','small'),'start','','atlas-primary')}</div></header><div class="atlas-options"><div class="ontology-segments" role="group" aria-label="图谱展示重点">${button('业务主线','scope','data-value="mainline" aria-pressed="'+(state.scope==='mainline')+'"',state.scope==='mainline'?'active':'')}${button('完整本体','scope','data-value="complete" aria-pressed="'+(state.scope==='complete')+'"',state.scope==='complete'?'active':'')}</div><div class="ontology-segments atlas-layout-switch" role="group" aria-label="本体视图">${button('业务分区','mode','data-value="flow" aria-pressed="'+(state.mode==='flow')+'"',state.mode==='flow'?'active':'')}${button('关系探索','mode','data-value="star" aria-pressed="'+(state.mode==='star')+'"',state.mode==='star'?'active':'')}</div><div class="ontology-search"><label>${host.icon('search','small')}<input id="ontology-search" value="${escape(state.query)}" placeholder="搜索名称、规则或动作" aria-label="查找本体节点" autocomplete="off"></label><div id="ontology-search-results" class="ontology-search-results" hidden></div></div><div class="atlas-display-tools">${button(host.icon(state.paused?'player-play':'player-pause','small'),'pause',`aria-label="${state.paused?'播放':'暂停'}动效" aria-pressed="${state.paused}"`)}${button(host.icon('sun','small'),'theme','aria-label="切换画布明暗"')}${button(host.icon('maximize','small'),'fullscreen','aria-label="全屏图谱"')}</div></div><div class="atlas-reading-toolbar"><div class="ontology-segments" role="group" aria-label="阅读方式">${button('图谱探索','presentation','data-value="graph" aria-pressed="'+(state.presentation==='graph')+'"',state.presentation==='graph'?'active':'')}${button('关系清单','presentation','data-value="relations" aria-pressed="'+(state.presentation==='relations')+'"',state.presentation==='relations'?'active':'')}</div>${button('只看相关','local','aria-pressed="'+state.local+'"',state.local?'active':'')}${button('重新整理布局','arrange','aria-label="重新整理布局"')}</div><div class="ontology-body"><div id="ontology-relationship-list" class="atlas-relationship-list" ${state.presentation==='relations'?'':'hidden'}>${relationshipList()}</div><div class="ontology-stage" ${state.presentation==='graph'?'':'hidden'}><div class="atlas-stage-heading"><div class="ontology-canvas-caption"><span id="ontology-count"></span><small id="ontology-scope-note"></small></div><label class="ontology-check"><input type="checkbox" id="ontology-progressive" ${state.progressive?'checked':''}>逐级展开</label></div><div class="atlas-lanes" aria-hidden="true">${['现象入口','核实条件','核实动作','处理草稿','人工确认'].map((label,index)=>`<span><b>0${index+1}</b>${label}</span>`).join('')}</div><div class="atlas-auxiliary-caption">辅助定义 <span>非处理步骤</span></div><div id="ontology-viewport" class="ontology-viewport" aria-label="可交互业务本体图谱"><canvas id="ontology-canvas" aria-hidden="true"></canvas><svg id="ontology-edges" class="atlas-edges" aria-label="有向业务关系"></svg><div id="ontology-nodes" class="ontology-nodes"></div></div><div class="atlas-canvas-bottom"><button id="ontology-label-hint" data-action="ontology-open-list" hidden></button><span id="ontology-focus-note">横向阅读关系 · 拖动自动留白</span><div class="atlas-camera"><select id="ontology-drag-mode" aria-label="节点拖动方式"><option value="branch" ${state.dragMode==='branch'?'selected':''}>拖动关联分支</option><option value="single" ${state.dragMode==='single'?'selected':''}>只拖当前节点</option></select>${button(host.icon('minus','small'),'zoom','data-value="out" aria-label="缩小图谱"')}<span id="ontology-zoom">${Math.round(state.zoom*100)}%</span>${button(host.icon('plus','small'),'zoom','data-value="in" aria-label="放大图谱"')}${button(host.icon('arrows-maximize','small'),'fit','aria-label="适应画布"')}</div></div><div id="ontology-live" class="sr-only" aria-live="polite"></div></div><aside id="ontology-inspector" class="ontology-inspector" aria-label="节点定义与业务规则">${nodeDetail()}</aside></div><footer class="atlas-footer"><div class="ontology-legend" role="group" aria-label="按关系类型高亮"><span>关系图例</span>${Object.entries(graph.palette).map(([key,item])=>`<button data-action="ontology-filter" data-value="${key}" aria-pressed="${state.filter===key}" style="--relation-color:${item.color}"><i class="${item.dash.length?'is-dashed':''}"></i>${item.name}</button>`).join('')}</div><span class="atlas-motion-note">关系示意 · 不执行真实操作</span></footer></section><details class="ontology-guide"><summary><span>${host.icon('help','small')} 图谱说明</span></summary><div><p><b>本体</b>统一表达与对象；<b>关系</b>明确方向和依据；<b>规则</b>限定助手能做什么、什么时候交给人；<b>动作</b>把相关定义转成可验收的配置。</p><p>业务主线只收起辅助信息，不删除任何定义。完整本体可查看同义表达、适用对象与候选原因。候选原因不是诊断结论。</p></div></details>`;
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
    const state=view();const previousScope=state.scope;state.selected=identifier;state.inspector='details';state.filter='all';state.query='';
    if(state.progressive)state.expanded.add(identifier);
    if(!visibleNodes().some(item=>item.id===identifier)){state.scope='complete';state.pan={x:0,y:0};state.zoom=1;}
    const search=document.getElementById('ontology-search');if(search)search.value='';
    const inspector=document.getElementById('ontology-inspector');if(inspector)inspector.innerHTML=nodeDetail();
    window.OntologyUsage?.refresh();
    const results=document.getElementById('ontology-search-results');if(results)results.hidden=true;
    const live=document.getElementById('ontology-live');if(live)live.textContent=node.name+'，'+labels[node.type]+'，'+neighbors(identifier).length+' 个关联';
    const needsLayout=state.progressive||state.local||state.mode==='star'||previousScope!==state.scope;if(state.mode==='star')state.positions={};mounted?.refresh();if(needsLayout)mounted?.layout();
  }
  let mounted=null;
  function dispatch(name,element){
    if(!current())return;
    const state=view();const value=element.dataset.value;
    if(name==='select')select(element.dataset.id);
    if(name==='mode'&&['star','flow'].includes(value)){state.mode=value;state.local=value==='star';state.progressive=false;state.positions={};state.pan={x:0,y:0};state.zoom=1;const progressive=document.getElementById('ontology-progressive');if(progressive)progressive.checked=false;mounted?.refresh();mounted?.layout();}
    if(name==='scope'&&['mainline','complete'].includes(value)){state.scope=value;state.pan={x:0,y:0};state.zoom=1;if(!visibleNodes().some(node=>node.id===state.selected)){state.selected=visibleNodes()[0]?.id||data().nodes[0]?.id;document.getElementById('ontology-inspector').innerHTML=nodeDetail();}window.OntologyUsage?.refresh();mounted?.refresh();mounted?.layout();}
    if(name==='inspector'){state.inspector=value==='directory'?'directory':'details';document.getElementById('ontology-inspector').innerHTML=nodeDetail();}
    if(name==='presentation'&&['graph','relations'].includes(value)){state.presentation=value;mounted?.refresh();}
    if(name==='open-list'){state.presentation='relations';mounted?.refresh();}
    if(name==='local'){state.local=!state.local;state.progressive=false;document.getElementById('ontology-progressive').checked=false;state.pan={x:0,y:0};state.zoom=1;mounted?.refresh();mounted?.layout();}
    if(name==='start'){const action=data().nodes.find(node=>node.id==='draft'&&node.type==='action')||data().nodes.find(node=>node.type==='action');if(action){select(action.id);document.getElementById('ontology-inspector').scrollIntoView({block:'nearest',behavior:'instant'});}else host.toast('先添加业务动作，再创建助手。',true);}
    if(name==='zoom')mounted?.zoom(value==='in'?1.2:1/1.2);
    if(name==='fit'||name==='arrange'){state.pan={x:0,y:0};state.zoom=1;if(name==='arrange')state.positions={};document.getElementById('ontology-zoom').textContent='100%';mounted?.layout();}
    if(name==='pause'){state.paused=!state.paused;document.getElementById('ontology-shell')?.classList.toggle('is-paused',state.paused);element.setAttribute('aria-pressed',String(state.paused));element.setAttribute('aria-label',state.paused?'播放动效':'暂停动效');element.innerHTML=host.icon(state.paused?'player-play':'player-pause','small')+'<span class="ontology-control-caption">'+(state.paused?'播放':'暂停')+'</span>';mounted?.wake();}
    if(name==='theme'){state.theme=state.theme==='dark'?'light':'dark';document.getElementById('ontology-shell')?.classList.toggle('is-light',state.theme==='light');mounted?.refresh();}
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
    const state=view();const model=data();const canvas=document.getElementById('ontology-canvas');const layer=document.getElementById('ontology-nodes');const edges=document.getElementById('ontology-edges');const context=canvas.getContext('2d');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');const controllers=new AbortController();const signal=controllers.signal;
    let frame=0;let disposed=false;let width=0;let height=0;let layoutStart=performance.now();let lastDraw=0;let elapsed=0;let previousTime=0;let dragging=null;let suppressClick=false;let targets={};let starts={};let positions={};
    const nodeButtons=new Map();const edgeElements=new Map();const routes=new Map();const labelPositions=new Map();const routeSamples=new Map();let routingKey='';
    const stars=Array.from({length:48},(_,index)=>({x:((index*197+71)%997)/997,y:((index*331+41)%991)/991,size:index%9===0?1:.55,phase:index*.63}));
    const svgElement=(name,attributes={})=>{const element=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);return element;};
    for(const link of model.links){
      const group=svgElement('g',{'data-edge':link.id,'data-source':link.source,'data-target':link.target,'data-relation':graph.relation(link)});
      const title=svgElement('title');title.textContent=(model.nodes.find(node=>node.id===link.source)?.name||link.source)+' → '+(model.nodes.find(node=>node.id===link.target)?.name||link.target)+'：'+link.label;
      const line=svgElement('path',{class:'atlas-edge-line',fill:'none'});const arrow=svgElement('path',{class:'atlas-edge-arrow'});
      const background=svgElement('rect',{class:'atlas-edge-label-background',rx:'4'});const label=svgElement('text',{'text-anchor':'middle','dominant-baseline':'central',class:'atlas-edge-label'});label.textContent=link.label;
      group.append(title,line,arrow,background,label);edges.append(group);edgeElements.set(link.id,{group,line,arrow,background,label});
    }
    function scalePoint(point){return {x:(point.x-width/2)*state.zoom+width/2+state.pan.x,y:(point.y-height/2)*state.zoom+height/2+state.pan.y};}
    function wake(){if(!frame&&!disposed&&!document.hidden)frame=requestAnimationFrame(draw);}
    function refresh(){
      const shown=graph.visible(model,state);const visible=new Set(shown.nodes.map(node=>node.id));
      const selectedRelations=model.links.filter(link=>graph.relation(link)===state.filter);const emphasized=new Set(selectedRelations.flatMap(link=>[link.source,link.target]));const focused=related(state.selected);
      const shell=document.getElementById('ontology-shell');shell.dataset.scope=state.scope;shell.dataset.layout=state.mode;shell.dataset.presentation=state.presentation;
      const stage=document.querySelector('.ontology-stage');stage.hidden=state.presentation!=='graph';
      const list=document.getElementById('ontology-relationship-list');list.hidden=state.presentation!=='relations';if(!list.hidden)list.innerHTML=relationshipList();
      for(const action of ['scope','mode','filter','presentation'])document.querySelectorAll('[data-action="ontology-'+action+'"]').forEach(control=>{const active=control.dataset.value===state[action];control.classList.toggle('active',active);control.setAttribute('aria-pressed',String(active));});
      document.querySelector('[data-action="ontology-local"]').setAttribute('aria-pressed',String(state.local));
      if(viewport.clientWidth){const size=graph.dimensions(model,state,viewport.clientWidth);stage.style.setProperty('--atlas-graph-height',size.height+'px');stage.dataset.orientation=size.orientation;stage.style.setProperty('--atlas-auxiliary-top',(size.width<540?8*144-10:size.width<1000?864:506)+'px');}
      document.getElementById('ontology-count').innerHTML=`<b>${shown.nodes.length}</b> / ${model.nodes.length} 个元素 <span>·</span> <b>${shown.links.length}</b> / ${model.links.length} 条关系`;
      document.getElementById('ontology-scope-note').textContent=state.mode==='star'?'围绕当前元素探索 · 点击关联节点切换中心；窄屏分层阅读':state.local?'当前元素及其直接关系 · 不删除其他定义':state.scope==='mainline'?'处理主线保持固定位置；依据和限制在旁侧补充':'处理主线位置不变；别名、范围和候选原因在辅助区';
      document.getElementById('ontology-focus-note').textContent=state.filter==='all'?'横向阅读关系 · 拖动自动留白':'正在高亮：'+graph.palette[state.filter].name+' · 再次点击图例取消';
      document.getElementById('ontology-zoom').textContent=Math.round(state.zoom*100)+'%';
      for(const [identifier,element] of nodeButtons){
        const node=model.nodes.find(item=>item.id===identifier);element.hidden=!visible.has(identifier);
        const dim=(state.filter!=='all'&&!emphasized.has(identifier))||(state.query&&!node.name.includes(state.query));
        element.classList.toggle('is-dim',Boolean(dim));element.classList.toggle('is-selected',state.selected===identifier);element.classList.toggle('is-related',focused.has(identifier));element.setAttribute('aria-pressed',String(state.selected===identifier));
      }
      wake();
    }
    function layout(){starts=structuredClone(positions);targets=graph.layout(model,state,width,height);layoutStart=performance.now();wake();}
    function resize(){
      const bounds=viewport.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
      const stage=viewport.closest('.ontology-stage');const size=graph.dimensions(model,state,bounds.width);const desiredHeight=size.height+'px';if(stage.style.getPropertyValue('--atlas-graph-height')!==desiredHeight){stage.style.setProperty('--atlas-graph-height',desiredHeight);stage.dataset.orientation=size.orientation;stage.style.setProperty('--atlas-auxiliary-top',(size.width<540?8*144-10:size.width<1000?864:506)+'px');return;}
      width=bounds.width;height=bounds.height;const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);edges.setAttribute('viewBox',`0 0 ${width} ${height}`);targets=graph.layout(model,state,width,height);positions=structuredClone(targets);starts=structuredClone(targets);layoutStart=performance.now();wake();
    }
    function zoom(multiplier,anchor){
      const previous=state.zoom;state.zoom=Math.max(.85,Math.min(2,state.zoom*multiplier));
      if(anchor){const center={x:width/2,y:height/2};state.pan.x=anchor.x-center.x-(anchor.x-center.x-state.pan.x)*state.zoom/previous;state.pan.y=anchor.y-center.y-(anchor.y-center.y-state.pan.y)*state.zoom/previous;}
      document.getElementById('ontology-zoom').textContent=Math.round(state.zoom*100)+'%';wake();
    }
    function labelPlacement(curve,text,nodePoints,occupied,otherRoutes){
      const labelWidth=text.length*12+14;const nodeHalfWidth=graph.nodeSize.width/2*state.zoom+6;const nodeHalfHeight=graph.nodeSize.height/2*state.zoom+6;
      for(const fraction of [.5,.42,.58,.34,.66,.26,.74,.18,.82,.1,.9,.05,.95]){
        const center=graph.point(curve,fraction);const box={left:center.x-labelWidth/2,right:center.x+labelWidth/2,top:center.y-12,bottom:center.y+12};
        const collides=box.left<2||box.right>width-2||box.top<2||box.bottom>height-2||nodePoints.some(point=>box.left<point.x+nodeHalfWidth&&box.right>point.x-nodeHalfWidth&&box.top<point.y+nodeHalfHeight&&box.bottom>point.y-nodeHalfHeight)||occupied.some(other=>box.left<other.right+5&&box.right>other.left-5&&box.top<other.bottom+5&&box.bottom>other.top-5)||otherRoutes.some(samples=>samples.some(point=>point.x>box.left-2&&point.x<box.right+2&&point.y>box.top-2&&point.y<box.bottom+2));
        if(!collides){occupied.push(box);return {center,width:labelWidth};}
      }
      return null;
    }
    function draw(now){
      frame=0;if(disposed||state.presentation!=='graph'||!width||!height||!targets[model.nodes[0]?.id])return;
      const still=state.paused||motion.matches;if(!still&&previousTime)elapsed+=Math.min(now-previousTime,40)/1000;previousTime=now;
      const progress=still?1:Math.min(1,(now-layoutStart)/560);const eased=1-Math.pow(1-progress,4);const light=state.theme==='light';
      context.clearRect(0,0,width,height);
      for(const star of stars){context.beginPath();context.fillStyle=light?'rgba(63,88,66,.10)':'rgba(190,218,203,'+(still?.12:.08+.06*(1+Math.sin(elapsed*.55+star.phase))/2)+')';context.arc(star.x*width,star.y*height,star.size,0,Math.PI*2);context.fill();}
      for(const node of model.nodes){const target=targets[node.id];const start=starts[node.id]||target;if(!target)continue;positions[node.id]={x:start.x+(target.x-start.x)*eased,y:start.y+(target.y-start.y)*eased};const point=scalePoint(positions[node.id]);nodeButtons.get(node.id).style.transform=`translate(${point.x}px,${point.y}px) scale(${state.zoom})`;}
      const shown=graph.visible(model,state);const visible=new Set(shown.nodes.map(node=>node.id));const nodePoints=shown.nodes.map(node=>({...scalePoint(positions[node.id]),id:node.id}));const occupied=[];
      const nextRoutingKey=JSON.stringify([width,height,nodePoints]);if(nextRoutingKey!==routingKey){routes.clear();routeSamples.clear();labelPositions.clear();routingKey=nextRoutingKey;}
      for(const [index,link] of shown.links.entries())if(!routes.has(link.id)){
        const source={...scalePoint(positions[link.source]),id:link.source};const target={...scalePoint(positions[link.target]),id:link.target};const curve=graph.route(source,target,nodePoints,width,height,state.zoom,index%7);routes.set(link.id,curve);routeSamples.set(link.id,Array.from({length:64},(_,sample)=>graph.point(curve,(sample+1)/65)));
      }
      if(!labelPositions.size){
        for(const link of shown.links){const otherRoutes=[...routeSamples].filter(([identifier])=>identifier!==link.id).map(([,samples])=>samples);labelPositions.set(link.id,labelPlacement(routes.get(link.id),link.label,nodePoints,occupied,otherRoutes));}
        const hidden=shown.links.filter(link=>!labelPositions.get(link.id)).length;const hint=document.getElementById('ontology-label-hint');hint.hidden=!hidden;hint.textContent=hidden+' 条拥挤关系的文字 → 在清单中阅读';
      }
      for(const [index,link] of model.links.entries()){
        const elements=edgeElements.get(link.id);const show=visible.has(link.source)&&visible.has(link.target);elements.group.style.display=show?'':'none';if(!show)continue;
        const curve=routes.get(link.id);const kind=graph.relation(link);const style=graph.palette[kind];const active=state.filter==='all'?(link.source===state.selected||link.target===state.selected):kind===state.filter;const dim=state.filter!=='all'&&kind!==state.filter;const color=light?style.light:style.color;
        elements.group.style.setProperty('--edge-color',color);elements.group.classList.toggle('is-active',active);elements.group.classList.toggle('is-dim',dim);elements.line.setAttribute('d',graph.path(curve));elements.line.setAttribute('stroke-dasharray',style.dash.join(' '));
        const end=graph.point(curve,1);const tangent=graph.point(curve,.98);const angle=Math.atan2(end.y-tangent.y,end.x-tangent.x);const cosine=Math.cos(angle);const sine=Math.sin(angle);
        elements.arrow.setAttribute('d',`M${end.x},${end.y} L${end.x-cosine*6-sine*3},${end.y-sine*6+cosine*3} L${end.x-cosine*6+sine*3},${end.y-sine*6-cosine*3} Z`);
        const placement=labelPositions.get(link.id);elements.label.style.display=placement?'':'none';elements.background.style.display=placement?'':'none';if(placement){elements.label.setAttribute('transform',`translate(${placement.center.x},${placement.center.y})`);elements.background.setAttribute('x',placement.center.x-placement.width/2);elements.background.setAttribute('y',placement.center.y-12);elements.background.setAttribute('width',placement.width);elements.background.setAttribute('height',24);}
        if(!dim&&active){const travel=(elapsed*.08+index*.19)%1;const particle=graph.point(curve,travel);context.beginPath();context.fillStyle=color;context.globalAlpha=.7;context.arc(particle.x,particle.y,1.8,0,Math.PI*2);context.fill();context.globalAlpha=1;}
      }
      const selected=positions[state.selected];
      if(selected&&visible.has(state.selected)){
        const point=scalePoint(selected);context.strokeStyle=light?'rgba(92,127,69,.2)':'rgba(187,211,167,.22)';context.lineWidth=.8;
        context.beginPath();context.ellipse(point.x,point.y,92*state.zoom,51*state.zoom,0,0,Math.PI*2);context.stroke();
        for(let index=0;index<2;index++){const angle=elapsed*.18+index*Math.PI;context.beginPath();context.fillStyle=light?'#64834e':'#bfdaa8';context.arc(point.x+Math.cos(angle)*92*state.zoom,point.y+Math.sin(angle)*51*state.zoom,1.4,0,Math.PI*2);context.fill();}
      }
      lastDraw=now;if(!still||progress<1)wake();
    }
    for(const node of model.nodes){
      const element=document.createElement('button');const role=graph.role(node,model);element.type='button';element.className='ontology-node node-'+node.type+' role-'+role;element.dataset.node=node.id;element.setAttribute('aria-label',node.name+'，'+roleNames[role]+'，点击查看关联');element.style.setProperty('--node-color',colors[node.type]);element.innerHTML='<span class="ontology-node-dot"><i></i></span><span class="atlas-node-type">'+roleNames[role]+'</span><span class="ontology-node-label">'+escape(node.name)+'</span>';element.title=node.name+' · '+roleNames[role];layer.append(element);nodeButtons.set(node.id,element);
    }
    viewport.addEventListener('click',event=>{if(suppressClick){suppressClick=false;return;}const node=event.target.closest('[data-node]');if(node)select(node.dataset.node);},{signal});
    viewport.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;const node=event.target.closest('[data-node]');const visible=new Set(visibleNodes().map(item=>item.id));const identifiers=node?(state.dragMode==='branch'&&!event.shiftKey?new Set([...related(node.dataset.node)].filter(identifier=>visible.has(identifier))):new Set([node.dataset.node])):new Set();
      dragging={pointerId:event.pointerId,node:node?.dataset.node,start:{x:event.clientX,y:event.clientY},positions:structuredClone(positions),savedPositions:structuredClone(state.positions),pan:{...state.pan},identifiers,moved:false,adjusted:false};viewport.setPointerCapture(event.pointerId);
    },{signal});
    viewport.addEventListener('pointermove',event=>{
      if(!dragging||dragging.pointerId!==event.pointerId)return;const deltaX=event.clientX-dragging.start.x;const deltaY=event.clientY-dragging.start.y;if(Math.hypot(deltaX,deltaY)>4)dragging.moved=true;if(!dragging.moved)return;viewport.classList.add('is-dragging');
      if(dragging.node){const result=graph.move(visibleNodes(),dragging.positions,dragging.identifiers,{x:deltaX/state.zoom,y:deltaY/state.zoom},width,height);dragging.adjusted=result.adjusted;positions=result.positions;targets=structuredClone(positions);starts=structuredClone(positions);layoutStart=performance.now()-600;for(const identifier of dragging.identifiers)state.positions[graph.positionKey(state,width,identifier)]=[positions[identifier].x/width,positions[identifier].y/height];}
      else{state.pan.x=dragging.pan.x+deltaX;state.pan.y=dragging.pan.y+deltaY;}wake();
    },{signal});
    const endDrag=event=>{if(!dragging||dragging.pointerId!==event.pointerId)return;suppressClick=dragging.moved;const identifier=dragging.node;const adjusted=dragging.adjusted;if(event.type==='pointercancel'){state.positions=dragging.savedPositions;positions=dragging.positions;targets=structuredClone(positions);starts=structuredClone(positions);state.pan=dragging.pan;wake();}dragging=null;viewport.classList.remove('is-dragging');if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);if(identifier&&event.type!=='pointercancel'){select(identifier);if(suppressClick){const message=adjusted?'已自动留出间距，节点不会相互覆盖；本体关系未改变。':'已调整位置；本体关系未改变。';document.getElementById('ontology-live').textContent=message;document.getElementById('ontology-focus-note').textContent=message;}}};
    viewport.addEventListener('pointerup',endDrag,{signal});viewport.addEventListener('pointercancel',endDrag,{signal});
    viewport.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();const bounds=viewport.getBoundingClientRect();zoom(Math.exp(-event.deltaY*.001),{x:event.clientX-bounds.left,y:event.clientY-bounds.top});},{signal,passive:false});
    viewport.addEventListener('keydown',event=>{const node=event.target.closest('[data-node]');if(!node)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const options=visibleNodes();const index=options.findIndex(item=>item.id===node.dataset.node);const next=options[(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+options.length)%options.length];nodeButtons.get(next.id).focus();select(next.id);}},{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;previousTime=0;}else wake();},{signal});motion.addEventListener('change',wake,{signal});
    const observer=new ResizeObserver(resize);observer.observe(viewport);resize();refresh();
    mounted={refresh,layout,zoom,wake,positions:()=>structuredClone(positions),lastDraw:()=>lastDraw};
    cleanup=()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controllers.abort();layer.replaceChildren();edges.replaceChildren();};
  }
  function configure(adapter){
    host=adapter;
    const paths={minus:'<path d="M5 12h14"/>',share:'<circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4m-6 8 6 4"/>','arrows-maximize':'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8 3 3m13 5 5-5M8 16l-5 5m13-5 5 5"/>',maximize:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'};
    for(const [name,path] of Object.entries(paths))if(!window.HUB_ICONS[name])window.HUB_ICONS[name]='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="ontology-"]');if(element){event.preventDefault();dispatch(element.dataset.action.slice(9),element);}});
    document.addEventListener('change',event=>{const form=event.target.closest?.('#ontology-relation-form');if(form&&current()&&['label','target'].includes(event.target.name)){const drafts=view().relationDrafts||={};const draft=drafts[form.dataset.id]||={};draft[event.target.name]=host.isSensitive(event.target.value)?'':event.target.value;}});
    document.addEventListener('change',event=>{if(event.target.id==='ontology-progressive'){view().progressive=event.target.checked;view().expanded=new Set(['symptom']);select('symptom');}if(event.target.id==='ontology-drag-mode')view().dragMode=event.target.value;});
    document.addEventListener('input',event=>{const form=event.target.closest?.('#ontology-node-form');if(form&&current()){const drafts=view().definitionDrafts||={};const draft=drafts[form.dataset.id]||={};const key=event.target.name;if(['name','description','fields','keywords','transferWords'].includes(key))draft[key]=host.isSensitive(event.target.value)?'':event.target.value;return;}if(event.target.id!=='ontology-search')return;view().query=event.target.value.trim();const results=document.getElementById('ontology-search-results');const matches=data().nodes.filter(node=>node.name.includes(view().query));results.hidden=!view().query;results.innerHTML=matches.length?matches.map(node=>button(escape(node.name)+' <small>'+labels[node.type]+'</small>','select',`data-id="${node.id}"`)).join(''):'<p>没有匹配的定义</p>';mounted?.refresh();});
    document.addEventListener('submit',event=>{
      const form=event.target;if(!['ontology-node-form','ontology-relation-form'].includes(form.id))return;event.preventDefault();if(!form.reportValidity())return;
      const model=data();const node=model.nodes.find(item=>item.id===form.dataset.id);if(!node)return;const input=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value).trim()]));
      if(Object.values(input).some(value=>host.isSensitive(value)))return host.toast('请先移除敏感信息，本体中只保存业务定义。',true);
      if(form.id==='ontology-node-form'){
        if(Object.entries(input).some(([key,value])=>!['name','description','fields','keywords','transferWords'].includes(key)||value.length>({name:30,description:240}[key]||160)))return host.toast('定义内容超过长度限制，请精简后保存。',true);
        if(!input.name||!input.description)return host.toast('名称和定义不能为空。',true);
        if(model.nodes.some(item=>item.id!==node.id&&item.name===input.name))return host.toast('本项目已有同名定义，请使用不同名称。',true);
        Object.assign(node,input);
        if(view().definitionDrafts)delete view().definitionDrafts[node.id];
        window.OrbitDesigner?.definitionsChanged(node.id);
      }else{
        if(!model.nodes.some(item=>item.id===input.target)||input.target===node.id)return host.toast('请选择有效的关联对象。',true);
        if(model.links.some(link=>link.source===node.id&&link.target===input.target&&link.label===input.label))return host.toast('这条关系已经存在。',true);
        model.links.push({id:'relation-'+crypto.randomUUID(),source:node.id,target:input.target,label:input.label});
        if(view().relationDrafts)delete view().relationDrafts[node.id];
      }
      model.revision+=1;persist();host.render();host.toast('已保存本项目定义，已验收的助手版本保持不变。');
    });
  }
  return {configure,page,mount,data,editors,configFromAction,select,view,visible:()=>graph.visible(data(),view()),positions:()=>mounted?.positions()||{},lastFrame:()=>mounted?.lastDraw()||0};
})();
