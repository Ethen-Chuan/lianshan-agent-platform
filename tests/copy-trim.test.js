const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const fixture=require('./helpers/group-chat-fixture');
const read=filename=>filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8');

test('ontology keeps actionable rules and references, with optional explanations closed',()=>{
  const {window}=fixture();
  const page=window.OntologyUsage.page()+window.OrbitOntology.page();
  assert.match(page,/<h2>定义与引用<\/h2>/);
  assert.doesNotMatch(page,/atlas-outcome|这条定义会怎样影响助手|先看处理主线/);
  assert.match(page,/<details class="copy-help usage-limit"><summary>检查范围<\/summary>/);
  assert.match(page,/<details class="copy-help atlas-impact"><summary>用途说明<\/summary>/);
  assert.match(page,/文字规则的含义、真实权益和任意流程分支仍需人工核对/);
  assert.match(page,/必须提供[\s\S]*需遵循的规则/);
  assert.match(page,/本地规则预览 · 不创建任务 · 不计入验收/);
  assert.match(page,/关系示意 · 不执行真实操作/);
  assert.match(page,/暂无引用[\s\S]*需确认加入团队/);
  assert.match(page,/data-action="usage-create"/);
});

test('short preview results retain missing, manual-review and risk boundaries without writes',()=>{
  const {window,click}=fixture();
  window.OntologyUsage.evidence();
  const before=JSON.stringify(window.ProjectStudio.data());
  for(const [scenario,label,outcome] of [['missing','信息不足，暂不处理','missing'],['complete','草稿待人工核对','prepared'],['risk','转人工，停止准备','handoff']]){
    click('usage-scenario',scenario);
    assert.ok(window.OntologyUsage.page().includes(label));
    assert.equal(window.OntologyUsage.evidence().result.outcome,outcome);
  }
  assert.match(window.OntologyUsage.page(),/非真实客户/);
  assert.equal(JSON.stringify(window.ProjectStudio.data()),before);
});

test('group uses short navigation while keeping internal visibility and execution limits',()=>{
  for(const projectId of ['AFTERSALES','RETAIL']){
    const {window}=fixture(projectId);
    const page=window.AgentWorkspace.page();
    for(const [tab,label] of [['collaboration','群聊'],['tasks','任务'],['shared','业务资料'],['outcomes','验收记录']]){
      assert.match(page,new RegExp('id="aw-tab-'+tab+'"[^>]*>[\\s\\S]*?<span>'+label+'<\\/span>'));
    }
    assert.match(page,/内部协作群 · 客户不可见/);
    assert.match(page,/本地演练 · 模型与业务系统未接入/);
    assert.match(page,/对客发送、建单需另行确认/);
    assert.doesNotMatch(page,/把任务发到群里，一起处理|负责分派与汇总；这是/);
    assert.equal((page.match(/<textarea/g)||[]).length,1);
  }
});

test('shared view links and statistical caveats are still accessible through details',()=>{
  const {window}=fixture();
  const shared=window.WorkspaceReview.shared();
  assert.match(shared,/<details class="copy-help wr-view-guide"><summary>相关视图<\/summary>/);
  assert.match(shared,/data-action="wr-ontology"/);
  assert.match(shared,/data-action="wr-section" data-value="compose"/);
  assert.match(shared,/data-action="wr-instances"/);
  assert.match(shared,/客户资料按任务取用/);
  const outcomes=window.WorkspaceReview.outcomes();
  assert.match(outcomes,/真实自助解决率、模型准确率与成本均未采集/);
  assert.match(outcomes,/<details class="aw-measurement-contract wr-method">/);
  assert.match(outcomes,/未做重复咨询观察窗口校验/);
});

test('flow and text design omit repeated introductions, not editing tools or approval',()=>{
  const {window,run}=fixture();
  run(read('orbit-flow.js'));
  run(read('orbit-flow-gestures.js'));
  run('window.OrbitFlow.configure(host)');
  const page=window.OrbitWorkbench.page();
  assert.doesNotMatch(page,/ow-model-boundary|两种方式均可生成草案|点击调整/);
  assert.match(page,/<details class="copy-help"><summary>画布操作<\/summary>/);
  assert.match(page,/id="flow-save-status" role="status"/);
  assert.match(page,/data-action="flow-compile"/);
  window.OrbitFlow.view().side='agent';
  assert.match(window.OrbitFlow.page(),/语义模型未连接/);
  window.OrbitWorkbench.view().mode='text';
  const textPage=window.OrbitWorkbench.page();
  assert.doesNotMatch(textPage,/Prompt · 保留完整原文/);
  assert.match(textPage,/未调用模型/);
  assert.match(textPage,/id="ow-brief"[^>]*aria-describedby="ow-brief-note ow-error"/);
  window.OrbitWorkbench.view().section='library';
  assert.match(window.OrbitWorkbench.page(),/<details class="copy-help ow-footnote"><summary>引用统计说明<\/summary>/);
});

test('rendering trimmed copy preserves authored definitions, drafts, messages and releases',()=>{
  const {window,run,publish,type}=fixture();
  publish('文案验证助手');
  window.OrbitOntology.data().nodes[0].description='一起把事情办完。我的业务定义与边界保持原文。';
  window.OrbitWorkbench.data().brief='保留 Prompt 原文、业务闭环与全部条件。';
  const history='把任务发到群里，一起处理。旧消息不改写。';
  run('state.projectCollab.messages.push({id:"copy-history",author:"operator",text:'+JSON.stringify(history)+',time:"2026-11-11T01:00:00Z"})');
  type('保留我的输入，不套用界面文案规则。');
  const render=()=>{
    window.ProjectStudio.ontologyPage();
    window.ProjectStudio.orbitPage();
    window.AgentWorkspace.page();
    window.WorkspaceReview.shared();
    window.WorkspaceReview.outcomes();
    window.ServiceJourney.page();
  };
  render();
  const snapshot=()=>run('JSON.stringify({project:window.ProjectStudio.data(),messages:state.projectCollab,manager:state.projectManager,cases:state.cases,tickets:state.tickets,journey:state.serviceJourney})');
  const before=snapshot();
  render();render();
  assert.equal(snapshot(),before);
  assert.ok(window.GroupChat.page().includes(history));
  assert.ok(window.ProjectStudio.ontologyPage().includes(window.OrbitOntology.data().nodes[0].description));
  assert.equal(window.ProjectHub.composerContext().draft,'保留我的输入，不套用界面文案规则。');
});

test('customer and knowledge copy retain simulation, history, privacy and draft limits',()=>{
  const {window,run,dialogs}=fixture();
  const page=window.ServiceJourney.page();
  assert.match(page,/不连接真实渠道/);
  assert.match(page,/每次选择会新建演练，已有记录保留/);
  assert.match(page,/工单完成不自动视为问题解决/);
  assert.match(page,/不展示内部备注、审批原因或其他客户记录/);
  assert.doesNotMatch(page,/建议从报修开始/);
  run(read('knowledge-editor.js'));
  run('window.KnowledgeEditor.configure(host)');
  window.KnowledgeEditor.open();
  const dialog=dialogs.at(-1).join('');
  assert.match(dialog,/列表预览/);
  assert.match(dialog,/审核前不用于自动回答/);
  assert.match(dialog,/不要填写真实客户资料/);
  assert.doesNotMatch(dialog,/随填写更新|先写清楚解决什么问题/);
  assert.doesNotMatch(run('knowledgePage()'),/<p><\/p>/);
});

test('trimmed page markup keeps balanced containers and disclosure boundaries',()=>{
  const {window,run}=fixture();
  run(read('orbit-flow.js'));
  run(read('orbit-flow-gestures.js'));
  run('window.OrbitFlow.configure(host)');
  const pages=[window.ProjectStudio.ontologyPage(),window.AgentWorkspace.page(),window.WorkspaceReview.shared(),window.WorkspaceReview.outcomes(),window.ServiceJourney.page(),window.OrbitWorkbench.page()];
  window.OrbitWorkbench.view().mode='text';
  pages.push(window.OrbitWorkbench.page());
  const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for(const html of pages){
    const stack=[];
    for(const match of html.matchAll(/<\/?([a-z][a-z0-9-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)){
      const [tag,name]=match;
      if(voidTags.has(name)||tag.endsWith('/>'))continue;
      if(tag.startsWith('</'))assert.equal(stack.pop(),name,'unexpected closing tag '+tag);
      else stack.push(name);
    }
    assert.deepEqual(stack,[]);
  }
});
