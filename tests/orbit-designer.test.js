const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/orbit-designer-fixture');
const policy=require('../app/orbit-designer-policy');
const plain=value=>JSON.parse(JSON.stringify(value));
const connectionResponse=()=>Response.json({mode:'local-server',capabilities:['orbit-designer-v1'],csrf:'test-session',connections:[{agentId:'manager',configured:true,revision:1,provider:'openai',model:'test-model'}]});
const modelResponse=(result,projectId='AFTERSALES')=>Response.json({result,origin:'model',projectId,revision:1,provider:'openai',model:'test-model',externalActions:0});
function speechFixture(window){
  const recognitions=[];
  window.SpeechRecognition=class{
    constructor(){this.aborted=false;this.started=0;recognitions.push(this);}
    start(){this.started++;}
    abort(){this.aborted=true;}
    stop(){}
    result(transcript){this.onresult({results:[Object.assign([{transcript}],{isFinal:true})]});}
  };
  return recognitions;
}

test('Orbit opens prompt-first and keeps manual editing as a secondary mode',()=>{
  const {window}=fixture();assert.equal(window.OrbitWorkbench.view().mode,'prompt');
  const page=window.OrbitWorkbench.page();assert.match(page,/id="od-input"/);assert.match(page,/生成流程/);assert.doesNotMatch(page,/data-flow-type=/);assert.match(page,/手动编辑/);
});
test('generation uses a real-request boundary and does not silently adopt a model draft',async()=>{
  const {window,calls,change}=fixture();const designer=window.OrbitDesigner;
  await designer.refresh();const before=JSON.stringify(window.OrbitFlow.data());designer.data().input='客户报修先收集设备型号和故障现象，再准备草稿，由人工核对。';
  await designer.send();assert.equal(calls.filter(call=>call.url.endsWith('/generate')).length,0);
  change('od-consent',true);await designer.send();assert.equal(calls.filter(call=>call.url.endsWith('/generate')).length,1);
  assert.ok(designer.data().proposal);assert.equal(JSON.stringify(window.OrbitFlow.data()),before);assert.equal(designer.view().consent,'');
  assert.throws(()=>designer.adopt(),/核对/);designer.view().ack=true;designer.adopt();assert.equal(window.OrbitFlow.data().nodes.length,7);assert.equal(designer.data().proposal,null);assert.equal(window.ProjectStudio.data().agents.length,0);
  const saved=JSON.stringify(window.OrbitFlow.data());designer.view().reviewed=saved;designer.saveAssistant();const scene=window.ProjectStudio.data().scenes.at(-1);assert.ok(scene.config.avatar);assert.equal(scene.samples[0].approved,false);assert.equal(scene.config.flowDesign.execution,'definition-only');assert.equal(window.ProjectStudio.data().agents.length,0);
});
test('model context only contains the design, selected definitions and stable step numbers',async()=>{
  const {window,change,calls}=fixture();const designer=window.OrbitDesigner;window.ProjectStudio.data().businessFlow=window.OrbitFlow.sample('AFTERSALES');
  designer.selectReference('rule-check');designer.view().selected='condition';designer.data().input='请精简第3步的说明，其他步骤不要改。';await designer.refresh();change('od-consent',true);await designer.send();
  const body=JSON.parse(calls.find(call=>call.url.endsWith('/generate')).options.body);assert.equal(body.references.length,1);assert.equal(body.references[0].id,'rule-check');assert.equal(body.selectedNode,'condition');assert.equal(body.graph.nodes[0].x,undefined);assert.equal(body.messages,undefined);assert.equal(body.cases,undefined);
  const context=policy.prepare(body);const numbers=window.OrbitFlow.numbers(body.graph);for(const step of context.stepNumbers)assert.equal(step.number,numbers[step.nodeId]);
});
test('content changes retain manual placement, avatar and IDs; structural edits keep surviving nodes',()=>{
  const {window}=fixture();const base=window.OrbitFlow.sample('AFTERSALES');base.avatar={art:'fox',tone:'plum'};base.nodes[1].x=372;base.nodes[1].y=912;
  const next=policy.projectGraph(base);next.nodes[1].description='只更新说明。';const merged=window.OrbitDesigner.mergeGraph(base,next);assert.equal(merged.nodes[1].x,372);assert.equal(merged.nodes[1].y,912);assert.deepEqual(plain(merged.avatar),base.avatar);
  const more=policy.projectGraph(base);more.nodes.push({id:'extra',type:'human',name:'再次核对',description:'人工确认',fields:'',keywords:'',capability:'',tool:'summary'});more.edges.find(edge=>edge.from==='review').to='extra';more.edges.push({id:'extra-edge',from:'extra',to:'end',label:'交付'});
  const enlarged=window.OrbitDesigner.mergeGraph(base,more);assert.equal(enlarged.nodes[1].x,372);assert.equal(enlarged.nodes[1].y,912);assert.deepEqual(plain(window.OrbitFlow.validate(enlarged)),[]);
});
test('drafts reject stale graph and reference updates instead of overwriting work',async()=>{
  for(const kind of ['graph','reference']){
    const {window,change}=fixture();const designer=window.OrbitDesigner;designer.selectReference('rule-check');await designer.refresh();designer.data().input='准备一个报修流程，先核对设备型号，人工确认后整理结果。';change('od-consent',true);await designer.send();
    if(kind==='graph')window.OrbitFlow.data().name='手动改名';else window.OrbitOntology.data().nodes.find(node=>node.id==='rule-check').description='已更新规则';
    const before=JSON.stringify(window.OrbitFlow.data());designer.view().ack=true;assert.throws(()=>designer.adopt(),/变化/);assert.equal(JSON.stringify(window.OrbitFlow.data()),before);
  }
});
test('static pages do not request models and do not start speech recognition',async()=>{
  const {window,calls}=fixture({publicMode:true});let started=0;window.SpeechRecognition=class{start(){started++;}};
  await window.OrbitDesigner.refresh();window.OrbitDesigner.startVoice();assert.equal(calls.length,0);assert.equal(started,0);assert.match(window.OrbitDesigner.page(),/在线静态演示不调用模型/);
});
test('numbered nodes follow topology and do not change with layout or corrupt the graph',()=>{
  const {window}=fixture();const flow=window.OrbitFlow;const graph=flow.sample('AFTERSALES');const before=JSON.stringify(graph);const numbers=flow.numbers(graph);
  assert.equal(numbers.start,'01');assert.equal(numbers.condition,'03');assert.deepEqual(plain(flow.numbers(flow.arrange(graph,'horizontal'))),plain(numbers));assert.equal(JSON.stringify(graph),before);
  assert.match(flow.preview(graph),/第03步：资料是否齐全/);assert.match(flow.preview(graph),/<b>03<\/b>/);
  window.ProjectStudio.data().businessFlow=graph;assert.match(flow.page(),/class="flow-node-number">03/);
});
test('ontology catalog shows actual fields, relations and zero references without claiming integration',()=>{
  const {window}=fixture();window.OrbitOntology.view().selected='draft';const page=window.ProjectStudio.ontologyPage();
  assert.match(page,/定义目录/);assert.match(page,/字段与动作/);assert.match(page,/尚未影响任何助手/);assert.match(page,/真实系统未接入/);assert.match(page,/待业务输入/);
  assert.doesNotMatch(page,/id="ontology-original-graph"/);assert.match(page,/data-action="catalog-edit"/);assert.equal(window.OntologyCatalog.references('draft').length,0);
});
test('adopted design references are traced separately from contracts and changes remain local',async()=>{
  const {window,change,switchProject}=fixture();const designer=window.OrbitDesigner;designer.selectReference('rule-check');designer.data().input='使用所选规则准备报修流程。先核对资料，再由人工确认。';await designer.refresh();change('od-consent',true);await designer.send();designer.view().ack=true;designer.adopt();
  let references=window.OntologyCatalog.references('rule-check');assert.equal(references.length,1);assert.equal(references[0].mode,'reference');assert.equal(references[0].changed,false);
  window.OrbitOntology.data().nodes.find(node=>node.id==='rule-check').fields+='，新的字段';references=window.OntologyCatalog.references('rule-check');assert.equal(references[0].changed,true);
  const before=JSON.stringify(window.OrbitFlow.data());switchProject('RETAIL');assert.equal(window.OntologyCatalog.references('rule-check').length,0);switchProject('AFTERSALES');assert.equal(JSON.stringify(window.OrbitFlow.data()),before);
});
test('model graph validation rejects unknown tools, cross-project data and structural errors',()=>{
  const {window}=fixture();const graph=policy.projectGraph(window.OrbitFlow.sample('AFTERSALES'));const context={projectId:'AFTERSALES',graph};
  const response=()=>({message:'草稿',questions:[],graph:structuredClone(graph),cases:[]});
  const tool=response();tool.graph.nodes[3].tool='refund';assert.throws(()=>policy.parseProposal(tool,context),/工具/);
  const cross=response();cross.graph.projectId='RETAIL';assert.throws(()=>policy.parseProposal(cross,context),/范围/);
  const loop=response();loop.graph.edges.push({id:'loop',from:'review',to:'collect',label:'重来'});assert.throws(()=>policy.parseProposal(loop,context),/循环/);
  const invalid=response();invalid.graph.nodes[0].description='mail@example.com';assert.throws(()=>policy.parseProposal(invalid,context),/个人信息/);
  const extra=response();extra.graph.nodes[0].code='run()';assert.throws(()=>policy.parseProposal(extra,context),/类型或工具/);
});
test('case simulation must follow an existing path and stops at human review',()=>{
  const {window}=fixture();const graph=policy.projectGraph(window.OrbitFlow.sample('AFTERSALES'));const context={graph};
  const response={outcome:'handoff',steps:['start','collect','condition','action','review'].map(nodeId=>({nodeId,summary:'待核对'})),reply:'请客服核对草稿。',missing:[]};
  assert.equal(policy.parseSimulation(response,context).outcome,'handoff');
  assert.throws(()=>policy.parseSimulation({...response,outcome:'prepared',steps:[...response.steps,{nodeId:'end',summary:'跳过审批'}]},context),/人工确认/);
  assert.throws(()=>policy.parseSimulation({...response,steps:[response.steps[0],response.steps[3]]},context),/连线/);
});
test('clarification-only replies keep the original flow and show questions in the design conversation',async()=>{
  const {window,change,calls}=fixture({fetchImpl:async url=>url==='/api/model-connections'?connectionResponse():modelResponse({message:'需要先确认报修范围。',questions:['哪些问题需要交给人工？'],graph:null,cases:[]})});
  const designer=window.OrbitDesigner;const original=JSON.stringify(window.OrbitFlow.data());
  await designer.refresh();designer.data().input='请为售后设计报修处理流程。';change('od-consent',true);await designer.send();
  assert.equal(designer.data().proposal,null);assert.equal(JSON.stringify(window.OrbitFlow.data()),original);assert.match(designer.page(),/哪些问题需要交给人工/);assert.equal(calls.filter(call=>call.url.endsWith('/generate')).length,1);
});
test('failed requests preserve the description and never retry or substitute a template',async()=>{
  const {window,change,calls}=fixture({fetchImpl:async url=>url==='/api/model-connections'?connectionResponse():Response.json({error:'模型暂不可用，请手动重试。'},{status:502})});
  const designer=window.OrbitDesigner;const original=JSON.stringify(window.OrbitFlow.data());const prompt='请根据门店巡检情况整理处理流程。';
  await designer.refresh();designer.data().input=prompt;change('od-consent',true);await designer.send();
  assert.equal(designer.data().input,prompt);assert.equal(designer.data().proposal,null);assert.equal(designer.data().history.length,0);assert.equal(JSON.stringify(window.OrbitFlow.data()),original);assert.match(designer.page(),/模型暂不可用/);assert.equal(calls.filter(call=>call.url.endsWith('/generate')).length,1);
});
test('leaving the designer, changing project, stopping or changing connection discards late model results',async()=>{
  for(const operation of ['config','project','stop','connection']){
    let finish;let signal;
    const {window,change,switchProject}=fixture({fetchImpl:async(url,options)=>url==='/api/model-connections'?connectionResponse():new Promise(resolve=>{finish=resolve;signal=options.signal;})});
    const designer=window.OrbitDesigner;const storage=designer.data();const original=JSON.stringify(window.OrbitFlow.data());
    await designer.refresh();storage.input='请为本项目准备售后报修流程。';change('od-consent',true);const request=designer.send();
    if(operation==='config')window.ProjectStudio.dispatch('tab',{dataset:{value:'config'}});
    if(operation==='project')switchProject('RETAIL');
    if(operation==='stop')designer.stop();
    if(operation==='connection')designer.invalidate();
    designer.mount();assert.equal(signal.aborted,true,operation);
    finish(modelResponse({message:'返回的旧草稿。',questions:[],graph:policy.projectGraph(window.OrbitFlow.sample('AFTERSALES')),cases:[]}));await request;
    assert.equal(storage.proposal,null,operation);assert.equal(storage.history.length,0,operation);
    if(operation==='project')switchProject('AFTERSALES');assert.equal(JSON.stringify(window.OrbitFlow.data()),original,operation);
  }
});
test('speech fills text only and cancelled sessions cannot change text or abort a newer session',()=>{
  const {window,document,emit,calls}=fixture();const designer=window.OrbitDesigner;const recognitions=speechFixture(window);
  designer.data().input='报修：';designer.startVoice();designer.startVoice();assert.equal(recognitions.length,1);
  recognitions[0].result('先收集型号。');assert.equal(designer.data().input,'报修：先收集型号。');assert.equal(calls.length,0);
  document.hidden=true;emit('visibilitychange',document);assert.equal(recognitions[0].aborted,true);
  recognitions[0].result('迟到文字。');assert.equal(designer.data().input,'报修：先收集型号。');document.hidden=false;
  designer.startVoice();recognitions[0].onerror();assert.equal(recognitions[1].aborted,false);
  window.ProjectStudio.dispatch('tab',{dataset:{value:'config'}});designer.mount();assert.equal(recognitions[1].aborted,true);
  recognitions[1].result('配置页不能录入。');assert.equal(designer.data().input,'报修：先收集型号。');
});
test('sending a description stops speech and freezes the confirmed input',async()=>{
  const {window,change,calls}=fixture();const designer=window.OrbitDesigner;const recognitions=speechFixture(window);
  await designer.refresh();designer.data().input='请准备售后报修流程。';designer.startVoice();recognitions[0].result('先核对型号。');change('od-consent',true);const request=designer.send();
  assert.equal(recognitions[0].aborted,true);recognitions[0].result('不得添加到已发送描述。');await request;
  const body=JSON.parse(calls.find(call=>call.url.endsWith('/generate')).options.body);assert.equal(body.prompt,'请准备售后报修流程。先核对型号。');assert.equal(designer.data().input,'');
});
test('simulation shows a numbered human stop without publishing or automatically passing any case',async()=>{
  const result={outcome:'handoff',steps:['start','collect','condition','action','review'].map(nodeId=>({nodeId,summary:'需人工核对'})),reply:'草稿待人工确认。',missing:[]};
  const {window,change}=fixture({fetchImpl:async url=>url==='/api/model-connections'?connectionResponse():modelResponse(result)});const designer=window.OrbitDesigner;
  window.ProjectStudio.data().businessFlow=window.OrbitFlow.sample('AFTERSALES');await designer.refresh();const original=JSON.stringify(window.OrbitFlow.data());designer.data().caseInput='设备报修，型号为演示型号，屏幕无显示。';change('od-test-consent',true);await designer.send('simulate');
  assert.equal(designer.data().simulation.outcome,'handoff');assert.match(designer.page(),/停在人工确认/);assert.match(designer.page(),/待人工核对/);assert.equal(JSON.stringify(window.OrbitFlow.data()),original);assert.equal(window.ProjectStudio.data().agents.length,0);assert.equal(window.ProjectStudio.data().scenes.length,0);
});
test('catalog definitions use available icons and only explicitly chosen definitions enter Orbit',()=>{
  const {window,click,run,calls}=fixture();for(const icon of ['database','folders','bolt','shield-check','message-circle','user-check'])assert.ok(window.HUB_ICONS[icon],icon);
  click('catalog-use',{id:'rule-check'});assert.equal(run('view.page'),'orbit');assert.equal(window.ProjectStudio.orbitSection(),'workbench');assert.deepEqual(plain(window.OrbitDesigner.data().referenceIds),['rule-check']);assert.equal(calls.length,0);assert.equal(window.OntologyCatalog.references('rule-check').length,0);
});
test('catalog release links open the original version rather than an editable scene',()=>{
  const {window,click,run}=fixture();const config=window.OrbitOntology.configFromAction('draft');window.ProjectStudio.createFromOntology(config);const scene=window.ProjectStudio.data().scenes[0];
  const agent={id:'TEST-AGENT',sceneId:scene.id,name:config.name,activeVersion:'V1.0',releases:[{version:'V1.0',config:structuredClone(config)}]};window.ProjectStudio.data().agents.push(agent);window.OrbitOntology.view().selected='draft';
  const before=JSON.stringify(window.ProjectStudio.data());click('catalog-reference',{id:agent.id});assert.equal(run('view.page'),'custom-assistant');assert.equal(JSON.stringify(window.ProjectStudio.data()),before);
  click('catalog-reference',{id:scene.id});assert.equal(run('view.page'),'orbit');assert.equal(window.ProjectStudio.orbitSection(),'config');
});
