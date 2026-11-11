const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/orbit-designer-fixture');
const plain=value=>JSON.parse(JSON.stringify(value));
const form=(id,values,nodeId)=>({id,values,dataset:{id:nodeId},classList:{contains:()=>false},reportValidity:()=>true,matches:()=>false,closest:()=>null});

test('Ontology deep links canonicalize to the single design workspace and survive reload',()=>{
  for(const project of ['AFTERSALES','RETAIL']){
    const original=fixture({url:'http://127.0.0.1:4342/?project='+project+'#ontology'});
    assert.equal(original.run('view.page'),'orbit');assert.equal(original.window.OrbitWorkbench.view().section,'library');
    assert.equal(new URL(original.location.href).searchParams.get('design'),'definitions');
    const navigation=original.run('sidebar()');
    assert.equal((navigation.match(/data-page="orbit"/g)||[]).length,1);assert.doesNotMatch(navigation,/data-page="ontology"/);
    const page=original.window.ProjectStudio.orbitPage();assert.match(page,/id="og-viewport"/);assert.doesNotMatch(page,/id="ow-library-list"|id="ontology-canvas"/);
    original.window.OrbitOntology.data().revision=12;original.window.PortfolioHub.persist();
    const reloaded=fixture({stored:original.stored,url:original.location.href});
    assert.equal(reloaded.window.OrbitWorkbench.view().section,'library');assert.equal(reloaded.window.OrbitOntology.data().revision,12);assert.equal(reloaded.window.PortfolioHub.navProject().id,project);
    reloaded.click('catalog-return');assert.equal(new URL(reloaded.location.href).searchParams.has('design'),false);
    const flowReload=fixture({stored:original.stored,url:reloaded.location.href});assert.equal(flowReload.window.OrbitWorkbench.view().section,'compose');
  }
});

test('one catalog switches between relationships and the directory without duplicating records',()=>{
  const {window,click}=fixture();const model=window.OrbitOntology.data();const snapshot=JSON.stringify(model);
  click('ow-choose-definitions');
  for(const presentation of ['graph','directory','graph']){
    click('catalog-presentation',{value:presentation});const page=window.ProjectStudio.orbitPage();
    assert.equal((page.match(/class="ontology-catalog"/g)||[]).length,1);assert.doesNotMatch(page,/id="ow-library-list"|id="ontology-original-graph"|id="ontology-canvas"/);
    assert.equal(JSON.stringify(model),snapshot);
  }
});

test('create once, reuse repeatedly, and reject another definition with the same name',()=>{
  const {window,click,submit,notices,calls}=fixture();const model=window.OrbitOntology.data();const count=model.nodes.length;const revision=model.revision;
  click('catalog-new');assert.equal((window.ProjectStudio.orbitPage().match(/id="ow-definition-form"/g)||[]).length,1);
  const input={name:'返修物流',type:'object',description:'登记返修物流所需资料，不提交物流系统。',fields:'物流编号,设备编号',upstream:''};
  submit('ow-definition-form',input);assert.equal(model.nodes.length,count+1);assert.equal(model.revision,revision+1);assert.equal(window.OntologyCatalog.view().adding,false);
  const entry=model.nodes.find(node=>node.name===input.name);assert.equal(window.OntologyCatalog.selected().id,entry.id);
  submit('ow-definition-form',input);assert.equal(model.nodes.length,count+1);assert.match(notices.at(-1)[0],/同名定义/);
  click('catalog-use',{id:entry.id});click('catalog-use',{id:entry.id});
  assert.deepEqual(plain(window.OrbitDesigner.data().referenceIds),[entry.id]);assert.equal(window.ProjectStudio.data().scenes.length,0);assert.equal(calls.length,0);
  assert.match(window.OrbitWorkbench.referenceSummary(),/返修物流/);assert.match(window.OrbitWorkbench.referenceSummary(),/引用待采用/);
});

test('editing from either view updates the canonical definition but not flow or accepted snapshots',()=>{
  const {window,click,emit}=fixture();const model=window.OrbitOntology.data();const workspace=window.ProjectStudio.data();const config=window.OrbitOntology.configFromAction('draft');
  const scene=window.ProjectStudio.createFromOntology(config);workspace.agents.push({id:'accepted',sceneId:scene.id,name:'已验收助手',activeVersion:'V1',releases:[{version:'V1',config:structuredClone(config)}]});
  workspace.businessFlow=window.OrbitFlow.sample('AFTERSALES');const snapshot=JSON.stringify({flow:workspace.businessFlow,scenes:workspace.scenes,agents:workspace.agents});const total=model.nodes.length;
  click('ow-definition',{id:'rule-check'});click('catalog-edit',{id:'rule-check'});
  const page=window.ProjectStudio.orbitPage();assert.equal((page.match(/id="ontology-node-form"/g)||[]).length,1);assert.doesNotMatch(page,/id="ontology-canvas"/);
  emit('submit',form('ontology-node-form',{name:'核对服务依据',description:'先核实来源，不按未知状态承诺权益。',fields:'核实依据',transferWords:'主管复核'},'rule-check'));
  assert.equal(model.nodes.find(node=>node.id==='rule-check').name,'核对服务依据');assert.equal(model.nodes.length,total);
  assert.equal(JSON.stringify({flow:workspace.businessFlow,scenes:workspace.scenes,agents:workspace.agents}),snapshot);
  assert.ok(window.OrbitWorkbench.references().every(entry=>entry.changes.length));
});

test('inline editing saves directed relations into the same graph without duplicating an existing relation',()=>{
  const {window,click,emit,notices}=fixture();const model=window.OrbitOntology.data();const count=model.links.length;
  click('catalog-edit',{id:'rule-check'});
  const relation=form('ontology-relation-form',{label:'需核实',target:'draft'},'rule-check');emit('submit',relation);
  assert.equal(model.links.length,count+1);assert.ok(window.OntologyCatalog.mapData().links.some(link=>link.source==='rule-check'&&link.target==='draft'&&link.label==='需核实'));
  emit('submit',relation);assert.equal(model.links.length,count+1);assert.match(notices.at(-1)[0],/已经存在/);
});

test('unfinished new definitions and inline edits survive view changes and remain project-local',()=>{
  const {window,click,emit,switchProject}=fixture();const model=window.OrbitOntology.data();const before=JSON.stringify(model);
  click('catalog-new');
  for(const [name,value] of Object.entries({name:'未提交定义',description:'尚待核对的说明',type:'rule',fields:'依据',upstream:'symptom'}))emit(name==='type'||name==='upstream'?'change':'input',{id:'',name,value,dataset:{},closest:selector=>selector==='#ow-definition-form'?{id:'ow-definition-form'}:null});
  click('catalog-return');click('ow-choose-definitions');assert.match(window.ProjectStudio.orbitPage(),/value="未提交定义"/);
  click('catalog-edit',{id:'rule-check'});
  emit('input',{id:'ontology-definition-name',name:'name',value:'未提交修改',dataset:{},closest:selector=>selector==='#ontology-node-form'?{id:'ontology-node-form',dataset:{id:'rule-check'}}:null});
  click('catalog-return');click('ow-choose-definitions');assert.match(window.ProjectStudio.orbitPage(),/value="未提交修改"/);
  switchProject('RETAIL');click('ow-choose-definitions');assert.doesNotMatch(window.ProjectStudio.orbitPage(),/未提交定义|未提交修改/);
  switchProject('AFTERSALES');click('ow-choose-definitions');assert.match(window.ProjectStudio.orbitPage(),/value="未提交修改"/);assert.equal(JSON.stringify(model),before);
});

test('selecting and removing references preserves input, current flow and separate model consents',()=>{
  const {window,click,calls}=fixture();window.OrbitDesigner.data().input='保留未发送的业务描述';window.ProjectStudio.data().businessFlow=window.OrbitFlow.sample('AFTERSALES');const before=JSON.stringify(window.OrbitFlow.data());
  click('ow-choose-definitions');click('catalog-use',{id:'rule-check'});
  Object.assign(window.OrbitDesigner.view(),{consent:'authorized',simulationConsent:'authorized'});click('ow-remove-reference',{id:'rule-check'});
  assert.equal(window.OrbitDesigner.data().input,'保留未发送的业务描述');assert.equal(JSON.stringify(window.OrbitFlow.data()),before);assert.equal(window.OrbitDesigner.view().consent,'');assert.equal(window.OrbitDesigner.view().simulationConsent,'');assert.equal(calls.length,0);
  assert.doesNotMatch(window.OrbitDesigner.page(),/data-od-reference/);assert.match(window.OrbitWorkbench.page(),/aria-label="流程引用的共享定义"/);
});

test('unfinished relationship choices survive the return to flow without creating a relation',()=>{
  const {window,click,emit}=fixture();const before=JSON.stringify(window.OrbitOntology.data());
  click('catalog-edit',{id:'rule-check'});
  for(const [name,value] of [['label','需核实'],['target','draft']])emit('change',{id:'',name,value,dataset:{},closest:selector=>selector==='#ontology-relation-form'?{id:'ontology-relation-form',dataset:{id:'rule-check'}}:null});
  click('catalog-return');click('ow-choose-definitions');
  const page=window.ProjectStudio.orbitPage();assert.match(page,/<option selected>需核实<\/option>/);assert.match(page,/<option value="draft" selected>/);assert.equal(JSON.stringify(window.OrbitOntology.data()),before);
  emit('submit',form('ontology-relation-form',{label:'需核实',target:'draft'},'rule-check'));assert.equal(window.OrbitOntology.view().relationDrafts['rule-check'],undefined);
});

test('selecting another definition cannot leave the previous definition editor in focus',()=>{
  const {window,click}=fixture();click('catalog-edit',{id:'rule-check'});assert.equal(window.OntologyCatalog.view().editingId,'rule-check');
  click('catalog-map-select',{id:'draft'});assert.equal(window.OntologyCatalog.view().editingId,'');assert.equal(window.OntologyCatalog.selected().id,'draft');
  assert.doesNotMatch(window.ProjectStudio.ontologyPage(),/id="ontology-node-form"/);
});

test('latest canonical definitions reach the model only after separate explicit consent and adoption',async()=>{
  const {window,click,change,calls,emit}=fixture();const designer=window.OrbitDesigner;
  click('catalog-use',{id:'rule-check'});click('ow-definition',{id:'rule-check'});click('catalog-edit',{id:'rule-check'});
  emit('submit',form('ontology-node-form',{name:'核实依据',description:'未知来源不能作为服务承诺。',fields:'来源依据',transferWords:''},'rule-check'));
  click('catalog-return');designer.data().input='按选定定义处理设备报修，资料不全时先询问，再准备草稿。';await designer.refresh();
  await designer.send();assert.equal(calls.filter(entry=>entry.options.method==='POST').length,0);
  change('od-consent',true);await designer.send();const request=JSON.parse(calls.find(entry=>entry.options.method==='POST').options.body);
  assert.equal(request.references[0].description,'未知来源不能作为服务承诺。');assert.equal(request.references[0].fields,'来源依据');assert.equal(window.OrbitFlow.data().designerReferences,undefined);
  designer.view().ack=true;designer.adopt();assert.equal(window.OrbitFlow.data().designerReferences.nodes[0].id,'rule-check');
  assert.equal(window.OrbitWorkbench.flowReferences().length,1);assert.match(window.OrbitWorkbench.referenceSummary(),/当前流程已引用 1 项/);
});

test('changed definitions invalidate pending proposals and appear in the shared change view without rewriting snapshots',async()=>{
  const {window,change,click}=fixture();const designer=window.OrbitDesigner;designer.selectReference('rule-check');designer.data().input='先核实客户提供的资料，再整理报修草稿供人工核对。';await designer.refresh();change('od-consent',true);await designer.send();
  window.OrbitOntology.data().nodes.find(node=>node.id==='rule-check').fields='新依据';assert.equal(designer.proposalValid(),false);designer.view().ack=true;assert.throws(()=>designer.adopt(),/变化/);
  designer.data().input='请按照刚刚更新的依据，重新整理待确认流程。';change('od-consent',true);await designer.send();designer.view().ack=true;designer.adopt();const before=JSON.stringify(window.OrbitFlow.data());
  window.OrbitOntology.data().nodes.find(node=>node.id==='rule-check').fields='再次变化';
  assert.match(window.OrbitWorkbench.referenceSummary(),/待复核/);click('ow-section',{value:'changes'});
  const page=window.OrbitWorkbench.page();assert.match(page,/流程引用/);assert.match(page,/新依据/);assert.match(page,/再次变化/);assert.doesNotMatch(page,/<h3>暂无引用<\/h3>/);assert.equal(JSON.stringify(window.OrbitFlow.data()),before);
});

test('editing a selected definition revokes earlier model authorization before sending changed content',async()=>{
  const {window,click,change,emit,calls}=fixture();const designer=window.OrbitDesigner;
  designer.selectReference('rule-check');designer.data().input='先核实资料，再准备待人工确认的业务草稿。';await designer.refresh();change('od-consent',true);change('od-test-consent',true);
  click('ow-definition',{id:'rule-check'});click('catalog-edit',{id:'rule-check'});
  emit('submit',form('ontology-node-form',{name:'核实业务依据',description:'更新后的规则仍须核查来源。',fields:'来源',transferWords:''},'rule-check'));
  assert.equal(designer.view().consent,'');assert.equal(designer.view().simulationConsent,'');
  click('catalog-return');await designer.send();assert.equal(calls.filter(entry=>entry.options.method==='POST').length,0);
  change('od-consent',true);await designer.send();assert.equal(calls.filter(entry=>entry.options.method==='POST').length,1);
});

test('integration escapes authored text and keeps balanced markup',()=>{
  const {window,click}=fixture();const node=window.OrbitOntology.data().nodes.find(entry=>entry.id==='rule-check');node.name='<img src=x onerror=bad()> ';window.OrbitDesigner.selectReference(node.id);
  assert.doesNotMatch(window.OrbitWorkbench.referenceSummary(),/<img src=x/);assert.match(window.OrbitWorkbench.referenceSummary(),/&lt;img/);
  click('catalog-edit',{id:node.id});const page=window.ProjectStudio.ontologyPage();assert.doesNotMatch(page,/<img src=x/);
  const voidTags=new Set(['input','br','hr','img','area','source','meta','link']);
  for(const html of [page,window.OrbitWorkbench.referenceSummary()]){const stack=[];for(const [tag,name] of html.matchAll(/<\/?([a-z][a-z0-9-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)){if(voidTags.has(name)||tag.endsWith('/>'))continue;if(tag.startsWith('</'))assert.equal(stack.pop(),name);else stack.push(name);}assert.deepEqual(stack,[]);}
});
