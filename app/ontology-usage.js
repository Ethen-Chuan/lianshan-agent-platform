window.OntologyUsage=(()=>{
  let host;
  const views=new Map();
  const current=()=>window.PortfolioHub.navProject();
  const escape=value=>host.escape(String(value??''));
  const button=(label,name,attributes='',tone='quiet small')=>host.button(label,'usage-'+name,tone,attributes);
  const scenarios=[['missing','信息不全'],['complete','资料齐全'],['risk','风险求助']];
  function view(){if(!views.has(current().id))views.set(current().id,{scenario:'missing'});return views.get(current().id);}
  function evidence(){
    const model=window.OrbitOntology.data();
    const selected=model.nodes.find(node=>node.id===window.OrbitOntology.view().selected)||model.nodes[0];
    const references=window.OrbitWorkbench.references();
    const actions=model.nodes.filter(node=>node.type==='action').map(action=>{
      try{return {action,config:window.OrbitOntology.configFromAction(action.id)};}catch{return null;}
    }).filter(Boolean);
    const related=actions.filter(entry=>entry.config.ontologyBinding.nodes.some(node=>node.id===selected?.id));
    const chosen=related.find(entry=>entry.action.id===selected?.id)||related.find(entry=>entry.action.id==='draft')||related[0];
    const used=references.filter(record=>record.config.ontologyBinding.nodes.some(node=>node.id===selected?.id));
    if(!chosen)return {selected,used,related};
    try{
      const contract=window.AgentHarness.compile(chosen.config,current().id);
      const complete=contract.keywords[0]+'，'+contract.fields.map((field,index)=>field+'：示例内容'+(index+1)).join('，');
      const input=view().scenario==='complete'?complete:view().scenario==='risk'?(contract.transferWords[0]||'请转人工处理')+'，请转人工处理':contract.keywords[0];
      const result=window.AgentHarness.evaluate(chosen.config,input,current().id,host.isSensitive);
      return {selected,used,related,chosen,contract,input,result};
    }catch(error){return {selected,used,related,chosen,error:error.message};}
  }
  function content(){
    const context=evidence();const {selected,chosen,contract,input,result,used,related}=context;
    if(!selected)return '<div class="usage-empty"><h2>暂无业务定义</h2><p>先添加对象和动作，再创建助手。</p></div>';
    const changes=used.filter(record=>record.changes.length);
    const rules=chosen?.config.ontologyBinding.ruleNames||[];
    const outcome=result?.outcome;
    const headline=outcome==='prepared'?'草稿待人工核对':outcome==='missing'?'信息不足，暂不处理':outcome==='handoff'?'转人工，停止准备':'当前定义尚不能处理此输入';
    return `<header class="usage-heading"><div><h2>定义与引用</h2></div><small>本地规则预览 · 不创建任务 · 不计入验收</small></header><div class="usage-layout"><section class="usage-definition"><span class="usage-kicker">当前定义 · O${window.OrbitOntology.data().revision}</span><h3>${escape(selected.name)}</h3>${chosen?`<p>关联动作：${escape(chosen.action.name)}</p><dl><div><dt>必须提供</dt><dd class="usage-tags">${(contract?.fields||chosen.config.fields.split(',')).map(field=>'<span>'+escape(field)+'</span>').join('')}</dd></div><div><dt>需遵循的规则</dt><dd>${rules.length?rules.map(escape).join('、'):'尚未关联规则，需人工补充业务边界。'}</dd></div></dl><details class="usage-source"><summary>配置来源</summary><p>字段和规则来自关联动作的上游定义。</p><div>${related.map(entry=>button(escape(entry.action.name),'action','data-id="'+escape(entry.action.id)+'"')).join('')}</div></details>`:'<p>这项定义尚未被带入任何业务动作，暂不约束助手执行。原因假设也不会作为确认事实带入配置。</p>'}</section><section class="usage-preview" aria-label="定义约束的本地示例"><div class="usage-scenarios" role="group" aria-label="切换本地示例">${chosen?scenarios.map(([value,label])=>button(label,'scenario',`id="usage-scenario-${value}" data-value="${value}" aria-pressed="${view().scenario===value}"`)).join(''):''}</div>${result?`<div class="usage-preview-body" role="status"><span class="usage-kicker">示例输入 · 非真实客户</span><p class="usage-example">${escape(input)}</p><h3>${host.icon(outcome==='prepared'?'file-text':outcome==='missing'?'list-check':'user-check','small')}${headline}</h3><p>${outcome==='missing'?'待补充：'+result.missing.map(escape).join('、'):outcome==='prepared'?'本地准备「'+escape(contract.toolName)+'」。字段齐全不等于事实已核实，也不会向业务系统提交。':escape(result.output)}</p><small>${result.toolCalls} 次本地准备动作 · 0 次外部调用</small></div>`:`<div class="usage-empty"><h3>${chosen?'暂时无法预览':'尚无可预览的处理动作'}</h3><p>${escape(context.error||'先在本体中关联业务动作，再查看字段和规则如何影响助手。')}</p></div>`}<details class="copy-help usage-limit"><summary>检查范围</summary><p>仅检查字段、风险词和本地动作。文字规则的含义、真实权益和任意流程分支仍需人工核对。</p></details></section></div><footer class="usage-references"><div><h3>${used.length?used.length+' 处引用':'暂无引用'}</h3><p>${used.length?(changes.length?changes.length+' 处引用有变化，待复核；旧版本不自动更新。':'引用内容一致；后续变更需重新核对，旧版本不自动更新。'):'尚未影响现有助手。创建并验收后，需确认加入团队。'}</p><div class="usage-reference-links">${used.slice(0,3).map(record=>button(escape(record.name||'未命名草案')+' · '+escape(record.kind),'reference','data-id="'+escape(record.id)+'"')).join('')}</div></div><div class="usage-next">${chosen?button('用「'+escape(chosen.action.name)+'」创建助手草案','create','data-id="'+escape(chosen.action.id)+'"','small primary'):''}${used.length?button('查看引用差异','changes'):''}</div></footer>`;
  }
  function page(){return '<section class="ontology-usage" id="ontology-usage" tabindex="-1" aria-label="本体的业务用途">'+content()+'</section>';}
  function inspector(){
    const {used,chosen}=evidence();
    return `<div class="usage-inspector"><span>${used.length?used.length+' 处草案或当前版本正在引用':'尚未被助手引用'}</span>${chosen?button('预览规则','preview'):''}</div>`;
  }
  function refresh(focus){const target=document.getElementById('ontology-usage');if(target){target.innerHTML=content();if(focus)document.getElementById(focus)?.focus({preventScroll:true});}}
  function configure(adapter){
    host=adapter;
    document.addEventListener('click',event=>{
      const element=event.target.closest('[data-action^="usage-"]');if(!element||!current())return;event.preventDefault();
      const name=element.dataset.action.slice(6);const identifier=element.dataset.id;const value=element.dataset.value;
      if(name==='preview'){const target=document.getElementById('ontology-usage');target?.scrollIntoView({block:'start',behavior:'instant'});target?.focus({preventScroll:true});}
      if(name==='scenario'&&scenarios.some(([key])=>key===value)){view().scenario=value;return refresh('usage-scenario-'+value);}
      if(name==='action'&&window.OrbitOntology.data().nodes.some(node=>node.id===identifier&&node.type==='action'))return window.OrbitOntology.select(identifier);
      if(name==='create'){
        try{window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction(identifier));}catch(error){host.toast(error.message,true);}
      }
      if(name==='reference'){
        const reference=window.OrbitWorkbench.references().find(record=>record.id===identifier);if(!reference)return host.toast('当前项目已没有这处引用。',true);
        if(reference.kind==='配置草案')return window.ProjectStudio.openScene(reference.sceneId);
        return window.ProjectStudio.dispatch('agent',{dataset:{id:reference.id,tab:'versions'}});
      }
      if(name==='changes'){window.OrbitWorkbench.view().section='changes';window.ProjectStudio.dispatch('tab',{dataset:{value:'workbench'}});}
    });
  }
  return {configure,page,refresh,evidence,inspector,view};
})();
