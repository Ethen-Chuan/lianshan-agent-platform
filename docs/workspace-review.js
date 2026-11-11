window.WorkspaceReview=(()=>{
  let host;
  const views=new Map();
  const current=()=>window.PortfolioHub.navProject();
  const workspace=()=>window.ProjectStudio.data();
  const escape=value=>host.escape(String(value??''));
  const button=(label,action,attributes='',tone='wr-button')=>host.button(label,'wr-'+action,tone,attributes);
  const arrow=()=>host.icon('arrow-up-right','small');
  const types=[['all','全部','list'],['object','业务对象','database'],['rule','处理规则','shield-check'],['action','动作定义','route'],['human','人工边界','user-check'],['alias','业务表达','messages']];
  const boundaries=[['prepared','正常处理'],['missing','必要信息不足'],['handoff','风险转人工']];
  function view(){
    if(!views.has(current().id))views.set(current().id,{type:'all',evaluation:'all'});
    return views.get(current().id);
  }
  function heading(eyebrow,title,description,action){
    return `<header class="aw-section-intro wr-heading"><div><span class="aw-eyebrow">${eyebrow}</span><h2>${title}</h2><p>${description}</p></div>${action||''}</header>`;
  }
  function status(label,tone='muted',symbol='circle'){
    return `<span class="wr-status is-${tone}">${host.icon(symbol,'small')}${escape(label)}</span>`;
  }
  function definitionRow(node,references){
    const type=types.find(([value])=>value===node.type)||['other','业务定义','book-2'];
    const count=references.filter(record=>record.config.ontologyBinding.nodes.some(entry=>entry.id===node.id)).length;
    const fields=String(node.fields||'').split(/[,，、\n]/).map(field=>field.trim()).filter(Boolean);
    return `<button type="button" class="wr-definition" data-action="wr-definition" data-id="${escape(node.id)}" aria-label="查看${escape(node.name)}的业务定义"><span class="wr-type-symbol is-${type[0]}">${host.icon(type[2],'small')}</span><span class="wr-definition-body"><span class="wr-definition-title"><strong>${escape(node.name)}</strong><small>${type[1]}</small></span><span class="wr-definition-note">${escape(node.description||'尚未填写说明')}</span>${fields.length?'<span class="wr-fields">'+fields.slice(0,3).map(field=>'<span>'+escape(field)+'</span>').join('')+(fields.length>3?'<span>另 '+(fields.length-3)+' 项</span>':'')+'</span>':''}</span><span class="wr-definition-end"><small>${count?count+' 处引用':'未引用'}</small>${arrow()}</span></button>`;
  }
  function referencePanel(references,changed,revision){
    const records=changed.length?changed:references;
    return `<aside class="wr-reference-panel" aria-label="引用与变更影响"><header><span>引用与变更</span><span class="wr-version">O${escape(revision)}</span></header><h3>${changed.length?'有 '+changed.length+' 处引用待复核':references.length?'当前引用内容一致':'暂无引用'}</h3><p>${changed.length?'核对差异后重新验收；原记录保持不变。':references.length?'引用内容一致，业务正确性仍需核实。':'在 Orbit 选择业务动作，带入字段与规则。'}</p><dl class="wr-reference-counts"><div><dt>草案与当前版本引用</dt><dd>${references.length}<small>处</small></dd></div><div><dt>需要复核</dt><dd>${changed.length}<small>处</small></dd></div></dl>${records.length?'<div class="wr-reference-list">'+records.slice(0,3).map(record=>button('<span><strong>'+escape(record.name||'未命名草案')+'</strong><small>'+escape(record.kind)+' · '+(record.changes.length?record.changes.length+' 项变化':'引用内容一致')+'</small></span>'+arrow(),'reference','data-id="'+escape(record.id)+'"','wr-reference-link')).join('')+'</div>':'<div class="wr-reference-empty">'+host.icon('link','small')+'<span>建立引用后，这里会列出受影响的助手。</span></div>'}<footer>${button((references.length?'查看引用与差异':'在 Orbit 创建助手')+arrow(),'section','data-value="'+(references.length?'changes':'compose')+'"','wr-button wr-on-dark')}<small>布局调整不算业务定义变更</small></footer></aside>`;
  }
  function shared(){
    const model=window.OrbitOntology.data();const references=window.OrbitWorkbench.references();const changed=references.filter(record=>record.changes.length);
    const selected=types.some(([value])=>value===view().type)?view().type:'all';
    const nodes=model.nodes.filter(node=>selected==='all'||node.type===selected);
    const facts=window.AgentWorkspace.tasks().filter(task=>task.legacy).slice(0,6);
    return `<section class="aw-shared workspace-review">${heading('项目资料 / 共享定义','共享业务定义','本项目共用定义；客户资料按任务取用。',button('查看业务定义 '+arrow(),'ontology','','wr-button wr-primary'))}<div class="wr-shared-layout"><section class="wr-library" aria-labelledby="wr-library-title"><header class="wr-panel-heading"><div><h3 id="wr-library-title">业务定义库 <span>${model.nodes.length}</span></h3></div><span class="wr-subtle-label">当前项目</span></header><div class="wr-filters" role="group" aria-label="业务定义类型">${types.filter(([type])=>type==='all'||model.nodes.some(node=>node.type===type)).map(([type,label])=>button(label+' <span>'+model.nodes.filter(node=>type==='all'||node.type===type).length+'</span>','type',`id="wr-type-${type}" data-value="${type}" aria-pressed="${selected===type}"`,'wr-filter')).join('')}</div><div class="wr-definition-list" id="wr-definition-list">${nodes.length?nodes.slice(0,5).map(node=>definitionRow(node,references)).join(''):'<div class="wr-empty"><h4>暂无这类定义</h4><p>可以切换类型，或在业务设计中补充。</p>'+button('查看全部定义','type','data-value="all"')+'</div>'}</div><footer class="wr-library-footer"><span role="status">显示 ${Math.min(5,nodes.length)} / ${nodes.length} 项${selected==='all'?'业务定义':''}</span>${button('在业务设计中查看全部 '+arrow(),'ontology','','wr-text-button')}</footer></section>${referencePanel(references,changed,model.revision)}</div><details class="copy-help wr-view-guide"><summary>相关视图</summary><div class="wr-view-links">${[['01','业务定义','对象、字段与规则','对象是什么，动作需要什么依据？','ontology',''],['02','业务流程','步骤、分支与交接','先做什么，何时分支或交给人？','section','data-value="compose"'],['03','业务实例图谱','会话、工单与证据','某次服务发生了什么，有什么记录支持？','instances','']].map(([index,title,note,question,action,attributes])=>`<article><span class="wr-view-index">${index}</span><div><h4>${title}</h4><small>${note}</small><p>${question}</p>${action==='instances'&&current().id!=='AFTERSALES'?'<span class="wr-unavailable">本项目尚未接入</span>':button((action==='section'?'设计业务流程':action==='instances'?'查看业务实例':'查看业务定义')+' '+arrow(),action,attributes,'wr-text-button')}</div></article>`).join('')}</div></details><section class="wr-facts" aria-labelledby="wr-facts-title"><div class="wr-section-label"><div><h3 id="wr-facts-title">任务资料</h3><p>仅限当前任务，不含其他客户记录。</p></div>${host.icon('lock','small')}</div><div class="aw-shared-tasks">${facts.length?facts.map(task=>button('<span><strong>'+escape(task.title)+'</strong><small>'+escape(task.id)+' · '+escape(task.caseId)+'</small></span>'+arrow(),'facts','data-id="'+escape(task.key)+'"','wr-fact-link')).join(''):'<div class="wr-empty-inline"><p>尚无可查看的任务资料。</p>'+button('回群聊发起任务 '+arrow(),'collaboration','','wr-text-button')+'</div>'}</div></section></section>`;
  }
  function evaluation(scene){
    const gate=window.ProjectStudio.readiness(scene);const latest=scene.runs.at(-1);
    const checks=boundaries.map(([outcome,label])=>{
      const samples=scene.samples.filter(sample=>sample.expected===outcome);const results=gate.current?latest.results.filter(result=>result.expected===outcome):[];
      let state='pending';let text='待验收';
      if(!samples.length){state='empty';text='缺少案例';}
      else if(!gate.current){text=latest?'需重验':'待验收';}
      else if(results.length!==samples.length||results.some(result=>!result.approved)){text='待核对';}
      else if(results.some(result=>!result.pass)){state='failed';text='未通过';}
      else{state='passed';text='已通过';}
      return {outcome,label,state,text};
    });
    const label=gate.localReady?'本地验收通过':!scene.samples.length?'待添加案例':!latest?'待运行验收':!gate.current?'需重新验收':checks.some(check=>check.state==='failed')?'有未通过项':'待完善验收';
    return {scene,gate,checks,label};
  }
  function evaluationRow(record){
    const {scene,gate,checks,label}=record;const name=scene.config.name||'未命名草案';
    const avatar=window.HubIdentity.assistant({id:scene.id,name,avatar:scene.config.avatar},'md');
    const action=!scene.samples.length?'添加验收案例':gate.localReady?'查看验收记录':gate.current?'核对验收结果':'继续验收';
    return `<article class="aw-evaluation-row wr-evaluation" data-scene-id="${escape(scene.id)}"><div class="wr-assistant-name">${avatar}<div><h4>${escape(name)}</h4><p>${scene.samples.length} 个案例 · ${scene.runs.length} 次本地验收</p></div>${status(label,gate.localReady?'passed':'pending',gate.localReady?'circle-check':'clock')}</div><div class="wr-boundaries" aria-label="${escape(name)}的三类边界验收">${checks.map(check=>`<div class="wr-boundary is-${check.state}" data-boundary="${check.outcome}">${host.icon(check.state==='passed'?'circle-check':check.state==='failed'?'circle-x':'circle','small')}<span>${check.label}<small>${check.text}</small></span></div>`).join('')}</div><footer><p>${gate.localReady?'当前配置通过三类本地边界检查，不代表模型准确率。':escape(gate.reason)}</p>${button(action+' '+arrow(),'scene',`data-id="${escape(scene.id)}" aria-label="${escape(name+'：'+action)}"`,'wr-button '+(gate.localReady?'':'wr-primary'))}</footer></article>`;
  }
  function outcomes(){
    const records=window.AgentWorkspace.tasks();const evaluations=workspace().scenes.map(evaluation);const verified=evaluations.filter(record=>record.gate.localReady);
    const pending=evaluations.filter(record=>!record.gate.localReady);const sessions=current().id==='AFTERSALES'?window.ServiceJourney.sessions():[];
    const resolved=sessions.filter(session=>session.resolved&&!session.caseId).length;
    const selected=view().evaluation;const shown=evaluations.filter(record=>selected==='all'||selected==='pending'&&!record.gate.localReady||selected==='passed'&&record.gate.localReady);
    const filters=[['all','全部草案',evaluations.length],['pending','待完善',pending.length],['passed','已通过',verified.length]];
    const intro=!evaluations.length?'先完成一份助手的边界验收':pending.length?pending.length+' 份草案还需要完善验收':'当前草案已通过本地边界验收';
    const next=!evaluations.length?'创建助手后，添加正常处理、必要信息不足和风险转人工案例。':pending.length?'补齐案例并重新验收后，再加入团队。':'可回群聊演练；尚不具备上线条件。';
    return `<section class="aw-outcomes workspace-review">${heading('本地演练 / 验收记录','验收与使用记录','仅统计本地演练；真实自助解决率、模型准确率与成本均未采集。','<span class="wr-local-badge">'+host.icon('shield-check','small')+'仅本地演练</span>')}<div class="wr-review-overview"><div class="wr-review-next"><span class="wr-kicker">当前验收状态</span><h3>${intro}</h3><p>${next}</p>${pending.length?button('继续完善 '+arrow(),'scene','data-id="'+escape(pending[0].scene.id)+'"','wr-button wr-primary'):button((evaluations.length?'回到业务协作':'在 Orbit 创建助手')+' '+arrow(),evaluations.length?'collaboration':'section',evaluations.length?'':'data-value="compose"','wr-button wr-primary')}</div><dl class="aw-measures wr-measures"><div><dt>准备任务<small>包括历史任务，不代表客户解决数</small></dt><dd>${records.length}<small>项</small></dd></div><div><dt>通过边界验收<small>当前配置下，三类案例均通过</small></dt><dd>${verified.length} / ${evaluations.length}<small>份</small></dd></div><div><dt>客户确认解决<small>${current().id==='AFTERSALES'?'客户端自助演练确认，不含转人工后解决':'本项目尚未接入客户自助预览'}</small></dt><dd>${current().id==='AFTERSALES'?resolved+' / '+sessions.length:'—'}${current().id==='AFTERSALES'?'<small>次</small>':''}</dd></div></dl></div><section class="wr-evaluation-list" aria-labelledby="wr-evaluation-title"><header class="wr-evaluation-heading"><div><h3 id="wr-evaluation-title">助手验收记录</h3></div><div class="wr-filters" role="group" aria-label="筛选助手验收状态">${filters.map(([value,label,count])=>button(label+' <span>'+count+'</span>','evaluation',`id="wr-evaluation-${value}" data-value="${value}" aria-pressed="${selected===value}"`,'wr-filter')).join('')}</div></header><div id="wr-evaluation-records">${shown.length?shown.map(evaluationRow).join(''):'<div class="wr-empty"><span class="wr-empty-symbol">'+host.icon(evaluations.length?'filter':'checklist','small')+'</span><h4>'+(!evaluations.length?'还没有助手草案':selected==='passed'?'暂无通过验收的草案':'暂无待完善的草案')+'</h4><p>'+(!evaluations.length?'先在 Orbit 定义业务，再添加三类验收案例。':selected==='passed'?'完成案例核对并运行验收后，通过的草案会显示在这里。':'所有当前草案均已通过本地边界检查，仍需核对业务依据。')+'</p>'+button(evaluations.length?'查看全部草案':'去创建助手',evaluations.length?'evaluation':'section','data-value="'+(evaluations.length?'all':'compose')+'"','wr-button')+'</div>'}</div><p class="wr-record-count" role="status">显示 ${shown.length} / ${evaluations.length} 份草案 · 不代表生产发布状态</p></section><details class="aw-measurement-contract wr-method"><summary><span>${host.icon('info-circle','small')}统计口径与上线后的采集要求</span><span class="wr-method-caption">本地演练 ≠ 生产效果 ${host.icon('chevron-down','small')}</span></summary><p>准备任务包括历史记录；客户确认解决仅计当前浏览器中未转人工的自助演练。未做重复咨询观察窗口校验，不作为真实自助解决率。</p><dl><div><dt>自助解决</dt><dd>限定可自助范围，有解决证据，且在约定窗口内未转人工、未因同一问题再次求助。</dd></div><div><dt>人工修改与转交</dt><dd>记录草稿实质修改原因，以及交接时是否重复询问已知信息。</dd></div><div><dt>可靠性与成本</dt><dd>以工具回执计成功；错误承诺、越权和敏感数据问题单独统计。</dd></div></dl></details></section>`;
  }
  function refresh(focus){
    const main=document.getElementById('main-content');const scroll=main?.scrollTop||0;host.render();
    const fresh=document.getElementById('main-content');if(fresh)fresh.scrollTop=scroll;
    document.getElementById(focus)?.focus({preventScroll:true});
  }
  function configure(adapter){
    host=adapter;
    document.addEventListener('click',event=>{
      const element=event.target.closest('[data-action^="wr-"]');if(!element||!current())return;event.preventDefault();
      const action=element.dataset.action.slice(3);const value=element.dataset.value;const identifier=element.dataset.id;
      if(action==='type'&&types.some(([type])=>type===value)){view().type=value;return refresh('wr-type-'+value);}
      if(action==='evaluation'&&['all','pending','passed'].includes(value)){view().evaluation=value;return refresh('wr-evaluation-'+value);}
      if(action==='ontology')return host.navigate('ontology');
      if(action==='definition'){
        if(!window.OrbitOntology.data().nodes.some(node=>node.id===identifier))return host.toast('这项定义不在当前项目中。',true);
        Object.assign(window.OrbitOntology.view(),{selected:identifier,scope:'complete',local:false,progressive:false,inspector:'details',query:''});return host.navigate('ontology');
      }
      if(action==='scene'){
        if(!workspace().scenes.some(scene=>scene.id===identifier))return host.toast('该草案不属于当前项目。',true);
        window.ProjectStudio.openScene(identifier);return window.ProjectStudio.dispatch('tab',{dataset:{value:'tests'}});
      }
      if(action==='section'&&['compose','library','changes'].includes(value)){
        window.OrbitWorkbench.view().section=value;return window.ProjectStudio.dispatch('tab',{dataset:{value:'workbench'}});
      }
      if(action==='reference'){
        const record=window.OrbitWorkbench.references().find(record=>record.id===identifier);if(!record)return host.toast('当前项目已没有这处引用。',true);
        if(record.kind==='配置草案')return window.ProjectStudio.openScene(record.sceneId);
        return window.ProjectStudio.dispatch('agent',{dataset:{id:record.id,tab:'releases'}});
      }
      if(action==='instances'&&current().id==='AFTERSALES')return host.navigate('graph');
      if(action==='facts'){
        const task=window.AgentWorkspace.tasks().find(task=>task.key===identifier&&task.legacy);
        if(task)return window.AgentWorkspace.showFacts(identifier);
      }
      if(action==='collaboration'){window.AgentWorkspace.view().tab='collaboration';host.navigate('group');}
    });
  }
  return {configure,shared,outcomes,evaluation,view,reset(){views.clear();}};
})();
