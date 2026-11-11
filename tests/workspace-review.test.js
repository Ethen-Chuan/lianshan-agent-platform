const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const fixture=require('./helpers/group-chat-fixture');
const plain=value=>JSON.parse(JSON.stringify(value));
const config={name:'示例报修助手',keywords:'报修',fields:'设备编号,故障现象',transferWords:'冒烟',tool:'form',handoff:'交由人工核实',prompt:'只整理本地资料',goal:'准备报修资料'};
function draft(window){window.ProjectStudio.createFromOntology(config);return window.ProjectStudio.data().scenes.at(-1);}
function evaluate(window,scene,approved=true){window.ProjectStudio.dispatch('sample-template',{dataset:{}});scene.samples.forEach(sample=>sample.approved=approved);window.ProjectStudio.dispatch('evaluate',{dataset:{}});}

test('definition preview reads project ontology and type filters never duplicate or mutate it',()=>{
  const {window,click}=fixture();const model=window.OrbitOntology.data();const snapshot=JSON.stringify(model);const page=window.WorkspaceReview.shared();
  assert.match(page,/业务定义库/);assert.match(page,/wr-reference-panel/);assert.equal((page.match(/class="wr-definition"/g)||[]).length,Math.min(5,model.nodes.length));
  click('wr-type','rule');const rules=window.WorkspaceReview.shared();for(const node of model.nodes.filter(node=>node.type==='rule').slice(0,5))assert.ok(rules.includes('data-id="'+node.id+'"'));assert.equal((rules.match(/class="wr-definition"/g)||[]).length,Math.min(5,model.nodes.filter(node=>node.type==='rule').length));assert.match(rules,/id="wr-type-rule"[^>]*aria-pressed="true"/);assert.equal(JSON.stringify(model),snapshot);
});

test('definition actions open the exact shared record in Orbit without creating a new copy',()=>{
  const {window,click,run}=fixture();const model=window.OrbitOntology.data();const before=JSON.stringify(model);click('wr-definition',undefined,model.nodes[1].id);
  assert.equal(run('view.page'),'orbit');assert.equal(window.OrbitWorkbench.view().section,'library');assert.equal(window.OrbitOntology.view().selected,model.nodes[1].id);assert.equal(window.OrbitOntology.view().scope,'complete');assert.equal(window.OrbitOntology.view().progressive,false);assert.equal(JSON.stringify(model),before);
});

test('shared definitions and flows open distinct Orbit views while instances remain separate',()=>{
  const {window,click,run}=fixture();click('wr-ontology');assert.equal(run('view.page'),'orbit');assert.equal(window.OrbitWorkbench.view().section,'library');click('wr-section','compose');assert.equal(run('view.page'),'orbit');assert.equal(window.OrbitWorkbench.view().section,'compose');click('wr-instances');assert.equal(run('view.page'),'graph');
  assert.match(window.WorkspaceReview.shared(),/业务定义[\s\S]*业务流程[\s\S]*业务实例图谱/);
});

test('references and change counts use actual snapshot comparisons, not layout differences',()=>{
  const {window}=fixture();const model=window.OrbitOntology.data();window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction('draft'));const frozen=JSON.stringify(window.ProjectStudio.data().scenes);
  let refs=window.OrbitWorkbench.references();assert.equal(refs.length,1);assert.equal(refs[0].changes.length,0);assert.match(window.WorkspaceReview.shared(),/当前引用内容一致/);
  model.nodes.find(node=>node.id==='draft').description+='（示例变更）';refs=window.OrbitWorkbench.references();assert.equal(refs.filter(record=>record.changes.length).length,1);assert.match(window.WorkspaceReview.shared(),/有 1 处引用待复核/);assert.equal(JSON.stringify(window.ProjectStudio.data().scenes),frozen);
});

test('zero references communicate setup work, never falsely claim validation is complete',()=>{
  const {window}=fixture();const page=window.WorkspaceReview.shared();assert.match(page,/暂无引用/);assert.match(page,/在 Orbit 选择业务动作，带入字段与规则/);assert.doesNotMatch(page,/当前引用内容一致|全部已同步/);
});

test('each reference opens either its original scene or its published version',()=>{
  const {window,click,run,submit}=fixture();window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction('draft'));const scene=window.ProjectStudio.data().scenes[0];evaluate(window,scene);submit('studio-release-form',{confirmed:true,reason:'核对本地边界'});const agent=window.ProjectStudio.data().agents[0];const before=JSON.stringify(agent.releases);
  click('wr-reference',undefined,scene.id);assert.equal(run('view.page'),'orbit');assert.match(window.ProjectStudio.orbitPage(),new RegExp('data-id="'+scene.id+'" aria-current="page"'));
  click('wr-reference',undefined,agent.id);assert.equal(run('view.page'),'custom-assistant');assert.match(window.ProjectStudio.agentPage(),/V1/);assert.equal(JSON.stringify(agent.releases),before);
});

test('empty evaluation screen offers a real creation route without fake zero rates or charts',()=>{
  const {window,click,run}=fixture();const page=window.WorkspaceReview.outcomes();assert.match(page,/还没有助手草案/);assert.match(page,/先完成一份助手的边界验收/);assert.doesNotMatch(page,/NaN|Infinity|0%|<canvas/);assert.match(page,/真实自助解决率、模型准确率与成本均未采集/);click('wr-section','compose');assert.equal(run('view.page'),'orbit');assert.equal(window.ProjectStudio.data().scenes.length,0);
});

test('evaluation rows show the configured avatar and identify missing, pending and passed boundaries',()=>{
  const {window}=fixture();const scene=draft(window);scene.config.avatar={art:'panda',tone:'teal'};
  assert.equal(window.WorkspaceReview.evaluation(scene).checks.filter(check=>check.state==='empty').length,3);assert.match(window.WorkspaceReview.outcomes(),/熊猫头像/);assert.match(window.WorkspaceReview.outcomes(),/待添加案例/);
  window.ProjectStudio.dispatch('sample-template',{dataset:{}});assert.equal(window.WorkspaceReview.evaluation(scene).checks.filter(check=>check.text==='待验收').length,3);
  scene.samples.forEach(sample=>sample.approved=true);window.ProjectStudio.dispatch('evaluate',{dataset:{}});const record=window.WorkspaceReview.evaluation(scene);assert.equal(record.gate.localReady,true);assert.equal(record.checks.filter(check=>check.state==='passed').length,3);assert.match(window.WorkspaceReview.outcomes(),/本地验收通过/);
});

test('edited configuration, edited expected outcomes and old runners cannot display stale passed indicators',()=>{
  const {window}=fixture();const scene=draft(window);evaluate(window,scene);const historical=JSON.stringify(scene.runs);scene.config.goal+='调整';let record=window.WorkspaceReview.evaluation(scene);assert.equal(record.gate.localReady,false);assert.equal(record.checks.some(check=>check.state==='passed'),false);assert.equal(record.label,'需重新验收');assert.equal(JSON.stringify(scene.runs),historical);
  scene.config.goal=config.goal;scene.samples[0].approved=false;record=window.WorkspaceReview.evaluation(scene);assert.equal(record.checks.some(check=>check.state==='passed'),false);scene.samples[0].approved=true;scene.runs[0].runner='old-runner';record=window.WorkspaceReview.evaluation(scene);assert.equal(record.checks.some(check=>check.state==='passed'),false);
});

test('partial coverage, unapproved cases and failed results remain distinct from successful checks',()=>{
  const {window}=fixture();const scene=draft(window);evaluate(window,scene,false);let record=window.WorkspaceReview.evaluation(scene);assert.equal(record.gate.localReady,false);assert.equal(record.checks.some(check=>check.state==='passed'),false);
  scene.samples.forEach(sample=>sample.approved=true);scene.samples.find(sample=>sample.expected==='prepared').input='报修';window.ProjectStudio.dispatch('evaluate',{dataset:{}});record=window.WorkspaceReview.evaluation(scene);assert.equal(record.checks.find(check=>check.outcome==='prepared').state,'failed');assert.equal(record.label,'有未通过项');assert.equal(record.checks.find(check=>check.outcome==='handoff').state,'passed');
  scene.samples=scene.samples.filter(sample=>sample.expected!=='handoff');window.ProjectStudio.dispatch('evaluate',{dataset:{}});record=window.WorkspaceReview.evaluation(scene);assert.equal(record.checks.find(check=>check.outcome==='handoff').state,'empty');
});

test('filtering evaluations changes only the view and follows the canonical readiness check',()=>{
  const {window,publish,click}=fixture();publish();draft(window);const workspace=window.ProjectStudio.data();const before=JSON.stringify(workspace);
  click('wr-evaluation','pending');const pending=window.WorkspaceReview.outcomes();assert.equal((pending.match(/class="aw-evaluation-row wr-evaluation"/g)||[]).length,1);assert.match(pending,/待添加案例/);assert.match(pending,/id="wr-evaluation-pending"[^>]*aria-pressed="true"/);
  click('wr-evaluation','passed');const passed=window.WorkspaceReview.outcomes();assert.equal((passed.match(/class="aw-evaluation-row wr-evaluation"/g)||[]).length,1);assert.match(passed,/本地验收通过/);assert.equal(JSON.stringify(workspace),before);
});

test('evaluation actions land in the selected scene tests and never run or approve anything',()=>{
  const {window,publish,click,run}=fixture();publish('示例甲');const target=window.ProjectStudio.data().scenes[0];publish('示例乙');const before=JSON.stringify(window.ProjectStudio.data());
  click('wr-scene',undefined,target.id);assert.equal(run('view.page'),'orbit');const page=window.ProjectStudio.orbitPage();assert.match(page,new RegExp('data-id="'+target.id+'" aria-current="page"'));assert.match(page,/data-value="tests" aria-current="page"/);assert.equal(JSON.stringify(window.ProjectStudio.data()),before);
});

test('local metric denominators remain distinct and non-customer projects show unavailable rather than zero',()=>{
  const {window,run,switchProject}=fixture();window.ServiceJourney.start('version');let sessions=window.ServiceJourney.sessions();sessions[0].resolved=true;window.ServiceJourney.start('repair');sessions=window.ServiceJourney.sessions();sessions[1].resolved=true;sessions[1].caseId='CS-DEMO';
  const count=window.AgentWorkspace.tasks().length;const page=window.WorkspaceReview.outcomes();assert.match(page,new RegExp('<dd>'+count+'<small>项'));assert.match(page,/<dd>1 \/ 2<small>次/);assert.match(page,/不含转人工后解决/);assert.match(page,/未做重复咨询观察窗口校验/);
  switchProject('RETAIL');assert.match(window.WorkspaceReview.outcomes(),/本项目尚未接入客户自助预览/);assert.match(window.WorkspaceReview.outcomes(),/<dd>—<\/dd>/);assert.equal(run('view.page'),'group');
});

test('task fact links retain the same scoped dialog and do not expose other customer transcripts',()=>{
  const {window,click,dialogs}=fixture();const task=window.AgentWorkspace.tasks()[0];click('wr-facts',undefined,task.key);assert.match(dialogs.at(-1)[0],new RegExp(task.id));assert.match(dialogs.at(-1)[2],new RegExp(task.caseId));assert.doesNotMatch(dialogs.at(-1)[2],/CS-0106/);
});

test('project view selections stay local and cross-project actions fail closed',()=>{
  const {window,click,switchProject,run,notices}=fixture();const scene=draft(window);click('wr-type','rule');click('wr-evaluation','pending');const previous=plain(window.WorkspaceReview.view());switchProject('RETAIL');assert.deepEqual(plain(window.WorkspaceReview.view()),{type:'all',evaluation:'all'});
  click('wr-scene',undefined,scene.id);assert.equal(run('view.page'),'group');assert.match(notices.at(-1),/不属于当前项目/);click('wr-instances');assert.equal(run('view.page'),'group');assert.doesNotMatch(window.WorkspaceReview.shared(),/data-action="wr-instances"/);switchProject('AFTERSALES');assert.deepEqual(plain(window.WorkspaceReview.view()),previous);
});

test('untrusted definition and assistant copy are rendered as text, not executable markup',()=>{
  const {window}=fixture();const model=window.OrbitOntology.data();model.nodes[0].name='<img src=x>';model.nodes[0].description='<script>bad()</script>';const scene=draft(window);scene.config.name='<img src=x>';
  for(const page of [window.WorkspaceReview.shared(),window.WorkspaceReview.outcomes()]){assert.match(page,/&lt;img/);assert.doesNotMatch(page,/<img src=x>|<script>/);}
});

test('both review screens opt into the polish while the group composer retains its own layout',()=>{
  const {window}=fixture();for(const tab of ['shared','outcomes']){window.AgentWorkspace.view().tab=tab;assert.match(window.AgentWorkspace.page(),/class="agent-workspace is-review"/);}
  window.AgentWorkspace.view().tab='collaboration';assert.match(window.AgentWorkspace.page(),/class="agent-workspace is-chat"/);assert.doesNotMatch(window.AgentWorkspace.page(),/class="workspace-review"/);
  const css=filesystem.readFileSync(path.join(__dirname,'../app/workspace-review.css'),'utf8');assert.match(css,/@container agent-workspace \(max-width:520px\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css,/border-(?:left|right):[2-9]px|background-clip:text/);
});
