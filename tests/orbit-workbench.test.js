const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function fixture(){
  const stores=new Map();let projectId='AFTERSALES';
  const window={PortfolioHub:{navProject:()=>({id:projectId}),persist(){}},ProjectStudio:{data(){if(!stores.has(projectId))stores.set(projectId,{scenes:[],agents:[]});return stores.get(projectId);}}};
  const context=vm.createContext({window,structuredClone});
  for(const filename of ['ontology-graph.js','ontology-atlas.js','orbit-workbench.js'])vm.runInContext(filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8'),context);
  return {workbench:window.OrbitWorkbench,ontology:window.OrbitOntology,storage:window.ProjectStudio.data,switchProject(value){projectId=value;}};
}

test('a new business starts from prose without requiring a fixed ontology action',()=>{
  const {workbench}=fixture();const brief='处理供应商入驻。核实资质材料；信息缺失时追问，涉及签约时由采购负责人确认。';
  const draft=workbench.makeDraft({name:'供应商入驻助手',brief,needs:'核实资质\n准备合同\n核实资质'},null,'AFTERSALES');
  assert.equal(draft.config.businessDesign.brief,brief);assert.ok(draft.config.prompt.includes(brief));assert.equal(draft.config.businessDesign.requests.length,2);
  assert.ok(draft.config.businessDesign.requests.every(request=>request.status==='not-connected'));assert.equal(draft.config.businessDesign.confirmed,false);
  assert.equal(draft.config.fields,'');assert.equal(draft.config.keywords,'');assert.equal(draft.config.provider,'未连接');assert.equal(draft.config.ontologyBinding,undefined);
  assert.equal(draft.requirements.join(''),brief);assert.equal(draft.config.tool,'summary');
});

test('reuse carries actual fields and rules into an isolated snapshot without cause assumptions',()=>{
  const {workbench,ontology}=fixture();const binding=ontology.configFromAction('draft');const original=JSON.stringify(binding);
  const draft=workbench.makeDraft({name:'业务助手',brief:'处理设备故障问题，先核实依据再准备报修草稿。',needs:'创建工单'},binding,'AFTERSALES');
  assert.equal(draft.config.fields,binding.fields);assert.equal(draft.config.transferWords,binding.transferWords);assert.equal(draft.config.ontologyBinding.ruleNames.length,3);
  assert.ok(!draft.config.ontologyBinding.nodes.some(node=>node.id==='board'));draft.config.ontologyBinding.nodes[0].name='草案快照编辑';assert.equal(JSON.stringify(binding),original);
});

test('invalid names, short briefs and cross-project bindings cannot produce a draft',()=>{
  const {workbench,ontology}=fixture();const brief='先检查业务资料，然后整理待人工确认的处理方案。';
  for(const name of ['', '有 空格','@错误','名字'.repeat(20)])assert.throws(()=>workbench.makeDraft({name,brief},null,'AFTERSALES'));
  assert.throws(()=>workbench.makeDraft({name:'助手',brief:'太短'},null,'AFTERSALES'));
  assert.throws(()=>workbench.makeDraft({name:'助手',brief:'业务'.repeat(500)},null,'AFTERSALES'));
  assert.throws(()=>workbench.makeDraft({name:'助手',brief},ontology.configFromAction('draft'),'RETAIL'),/其他项目/);
});

test('full prose is retained while brief summary and prompt stay within editor limits',()=>{
  const {workbench}=fixture();const brief='请核实业务信息再准备草稿。'.repeat(55).slice(0,800);
  const draft=workbench.makeDraft({name:'长文本业务助手',brief},null,'AFTERSALES');assert.equal(draft.config.businessDesign.brief,brief);assert.ok(draft.config.prompt.includes(brief));assert.ok(draft.config.prompt.length<=1200);assert.equal(draft.config.goal.length,400);
});

test('impact compares actual dependencies rather than merely revision numbers',()=>{
  const {workbench,ontology}=fixture();const before=ontology.configFromAction('draft').ontologyBinding;
  ontology.data().revision++;ontology.data().nodes.find(node=>node.id==='board').description='修改一个未引用的原因假设';
  assert.equal(workbench.compareBindings(before,ontology.configFromAction('draft').ontologyBinding).length,0);
  ontology.data().nodes.find(node=>node.id==='rule-check').fields+=',检修记录';
  const differences=workbench.compareBindings(before,ontology.configFromAction('draft').ontologyBinding);assert.equal(differences.length,1);assert.equal(differences[0].label,'必要信息');assert.match(differences[0].after,/检修记录/);assert.ok(!differences[0].before.includes('检修记录'));
});

test('removed actions, new dependencies and changed relations are visible',()=>{
  const {workbench,ontology}=fixture();const before=ontology.configFromAction('draft').ontologyBinding;
  assert.ok(workbench.compareBindings(before,null).some(change=>change.label==='不再引用'));
  ontology.data().nodes.push({id:'new-rule',type:'rule',name:'新规则',description:'必须负责人核实'});ontology.data().links.push({id:'new-edge',source:'new-rule',target:'draft',label:'约束'});
  const changes=workbench.compareBindings(before,ontology.configFromAction('draft').ontologyBinding);assert.ok(changes.some(change=>change.label==='新增引用'));assert.ok(changes.some(change=>change.label==='新增关系'));
  ontology.data().links.find(link=>link.id==='new-edge').label='限制动作';const next=ontology.configFromAction('draft').ontologyBinding;assert.ok(workbench.compareBindings(before,next).some(change=>change.after.includes('限制动作')));
});

test('drafts and active releases are both checked without rewriting history',()=>{
  const {workbench,ontology,storage}=fixture();const config=ontology.configFromAction('draft');
  storage().scenes.push({id:'scene-one',config});storage().agents.push({id:'agent-one',name:'受理助手',sceneId:'scene-one',activeVersion:'V2',releases:[{version:'V1',config:structuredClone(config)},{version:'V2',config:structuredClone(config)}]});
  const frozen=JSON.stringify(storage().agents);ontology.data().nodes.find(node=>node.id==='rule-check').description='更新核实规则';
  const refs=workbench.references();assert.equal(refs.length,2);assert.ok(refs.every(reference=>reference.changes.length===1));assert.equal(JSON.stringify(storage().agents),frozen);
});

test('business drafts, requests and view state are isolated by project',()=>{
  const {workbench,switchProject}=fixture();workbench.data().brief='售后专属说明';workbench.data().requests.push({name:'售后专属工具'});workbench.view().section='changes';
  switchProject('RETAIL');assert.equal(workbench.data().brief,'');assert.equal(workbench.data().requests.length,0);assert.equal(workbench.view().section,'compose');assert.equal(workbench.references().length,0);
  switchProject('AFTERSALES');assert.equal(workbench.data().brief,'售后专属说明');assert.equal(workbench.view().section,'changes');
});
