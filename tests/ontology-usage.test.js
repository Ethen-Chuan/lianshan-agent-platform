const test=require('node:test');
const assert=require('node:assert/strict');
const fixture=require('./helpers/group-chat-fixture');
const plain=value=>JSON.parse(JSON.stringify(value));

test('ontology usage is based on inherited definitions rather than decorative metrics',()=>{
  const {window}=fixture();const usage=window.OntologyUsage;const evidence=usage.evidence();
  assert.equal(evidence.chosen.action.id,'draft');assert.deepEqual(plain(evidence.contract.fields),plain(window.AgentHarness.compile(window.OrbitOntology.configFromAction('draft'),'AFTERSALES').fields));
  assert.equal(evidence.used.length,0);assert.match(usage.page(),/暂无引用/);assert.match(usage.page(),/尚未影响现有助手/);
  assert.equal(evidence.chosen.config.ontologyBinding.nodes.some(node=>node.id==='board'),false);assert.match(usage.page(),/文字规则的含义、真实权益和任意流程分支仍需人工核对/);
});
test('example states run actual local checks without creating tasks, samples or releases',()=>{
  const {window,click,run}=fixture();window.OntologyUsage.evidence();const before=JSON.stringify(window.ProjectStudio.data());const state=run('JSON.stringify({tasks:state.projectManager,tickets:state.tickets,cases:state.cases})');
  for(const [scenario,outcome,calls] of [['missing','missing',0],['complete','prepared',1],['risk','handoff',0]]){
    click('usage-scenario',scenario);const result=window.OntologyUsage.evidence().result;assert.equal(result.outcome,outcome);assert.equal(result.toolCalls,calls);assert.equal(result.receipt?.externalWrite||false,false);
  }
  assert.equal(JSON.stringify(window.ProjectStudio.data()),before);assert.equal(run('JSON.stringify({tasks:state.projectManager,tickets:state.tickets,cases:state.cases})'),state);
});
test('updated required fields change the preview without mutating earlier assistant snapshots',()=>{
  const {window}=fixture();window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction('draft'));const before=JSON.stringify(window.ProjectStudio.data().scenes);
  window.OrbitOntology.data().nodes.find(node=>node.id==='rule-check').fields+=',检修记录';
  const context=window.OntologyUsage.evidence();assert.ok(context.result.missing.includes('检修记录'));assert.equal(context.used.length,1);assert.ok(context.used[0].changes.length);
  assert.match(window.OntologyUsage.page(),/1 处引用有变化/);assert.equal(JSON.stringify(window.ProjectStudio.data().scenes),before);
});
test('node selection refreshes usage and unbound cause hypotheses have no invented consumers',()=>{
  const {window,click,nodes}=fixture();const target={innerHTML:''};nodes.set('ontology-usage',target);
  click('ontology-select',undefined,'board');assert.equal(window.OntologyUsage.evidence().chosen,undefined);assert.match(target.innerHTML,/暂不约束助手执行/);assert.match(target.innerHTML,/原因假设也不会作为确认事实/);
  click('usage-action',undefined,'verify');assert.equal(window.OrbitOntology.view().selected,'verify');assert.equal(window.OntologyUsage.evidence().chosen.action.id,'verify');assert.match(target.innerHTML,/整理信息摘要|必须提供/);
});
test('explicit create uses the existing binding and creates only a draft with an avatar',()=>{
  const {window,click,run}=fixture();window.OntologyUsage.evidence();const before=JSON.stringify(window.OrbitOntology.data());
  click('usage-create',undefined,'draft');assert.equal(run('view.page'),'orbit');const scene=window.ProjectStudio.data().scenes[0];
  assert.ok(scene.config.avatar.art);assert.equal(scene.config.ontologyBinding.actionId,'draft');assert.equal(scene.samples.length,0);assert.equal(scene.runs.length,0);assert.equal(window.ProjectStudio.data().agents.length,0);assert.equal(JSON.stringify(window.OrbitOntology.data()),before);
});
test('usage references navigate to the original scene and exact published version view',()=>{
  const {window,click,submit,run}=fixture();window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction('draft'));const scene=window.ProjectStudio.data().scenes[0];
  window.ProjectStudio.dispatch('sample-template',{dataset:{}});scene.samples.forEach(sample=>sample.approved=true);window.ProjectStudio.dispatch('evaluate',{dataset:{}});submit('studio-release-form',{confirmed:true,reason:'已核对示例'});
  const agent=window.ProjectStudio.data().agents[0];const before=JSON.stringify(window.ProjectStudio.data());assert.equal(window.OntologyUsage.evidence().used.length,2);
  click('usage-reference',undefined,scene.id);assert.equal(run('view.page'),'orbit');click('usage-reference',undefined,agent.id);assert.equal(run('view.page'),'custom-assistant');assert.match(window.ProjectStudio.agentPage(),/data-value="versions" aria-current="page"/);
  assert.equal(JSON.stringify(window.ProjectStudio.data()),before);click('usage-changes');assert.equal(run('view.page'),'orbit');assert.equal(window.OrbitWorkbench.view().section,'changes');
});
test('preview selections are project-local and cannot open another project’s references',()=>{
  const {window,click,switchProject,run,notices}=fixture();window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction('draft'));const scene=window.ProjectStudio.data().scenes[0];click('usage-scenario','complete');
  switchProject('RETAIL');assert.equal(window.OntologyUsage.view().scenario,'missing');assert.equal(window.OntologyUsage.evidence().used.length,0);assert.doesNotMatch(window.OntologyUsage.page(),/购买日期|屏幕无显示/);
  click('usage-reference',undefined,scene.id);assert.equal(run('view.page'),'group');assert.match(notices.at(-1),/已没有这处引用/);switchProject('AFTERSALES');assert.equal(window.OntologyUsage.view().scenario,'complete');
});
test('unsupported definitions show an honest error and user-authored labels remain escaped',()=>{
  const {window}=fixture();const model=window.OrbitOntology.data();model.nodes[0].name='<img src=x onerror=alert(1)>';
  assert.match(window.OntologyUsage.page(),/&lt;img/);assert.doesNotMatch(window.OntologyUsage.page(),/<img src=x/);
  window.OrbitOntology.view().selected='draft';model.nodes.find(node=>node.id==='draft').tool='remote-operation';assert.match(window.OntologyUsage.page(),/暂时无法预览|尚未接入这个动作/);assert.equal(window.OntologyUsage.evidence().result,undefined);
});
