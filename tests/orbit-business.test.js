const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/orbit-designer-fixture');
const policy=require('../app/orbit-business-policy');
const plain=value=>JSON.parse(JSON.stringify(value));
const metadata=()=>Response.json({mode:'local-server',capabilities:['orbit-designer-v1','orbit-definitions-v1'],csrf:'test-session',connections:[{agentId:'manager',configured:true,revision:1,provider:'openai',model:'test-model'}]});
const design=()=>({message:'已整理业务对象与规则，请核对。',questions:[],design:{name:'设备报修专员',goal:'收集报修信息并准备待审核草稿。',definitionIds:['symptom','rule-check','draft','human','warranty'],entryActionId:'draft',nodes:[{id:'symptom',type:'object',name:'报修问题',description:'记录报修现象，不能推断故障原因。',fields:'产品型号,问题描述',keywords:'报修'}],links:[{id:'new-relation',source:'warranty',target:'draft',label:'提供依据'}],removeLinks:[]}});
const envelope=(result,projectId='AFTERSALES')=>Response.json({result,origin:'model',projectId,revision:1,provider:'openai',model:'test-model',externalActions:0});
function setup({response=design,fetchImpl,stored,url}={}){
  const value=fixture({business:true,stored,url,fetchImpl:fetchImpl||async function(url,options){if(url==='/api/model-connections')return metadata();return envelope(response(JSON.parse(options.body)),JSON.parse(options.body).projectId);}});
  async function generate(prompt='客户报修，核对设备资料与保修依据后准备草稿，交人工确认。'){
    const designer=value.window.OrbitDesigner;value.window.OrbitBusiness.data().input=prompt;await designer.refresh();value.change('od-consent',true);await designer.send();
  }
  return {...value,generate};
}
test('default business page has one text/voice composer and no second assistant-creation stage',()=>{
  const {window}=setup();const page=window.ProjectStudio.orbitPage();
  assert.equal(window.OrbitDesigner.view().purpose,undefined);
  assert.match(page,/生成业务设计/);assert.match(page,/定义与关系/);assert.doesNotMatch(page,/data-value="config"|data-value="tests"|先定义一位业务助手|id="ow-brief-form"/);
  assert.equal((page.match(/id="od-input"/g)||[]).length,1);assert.equal((page.match(/id="od-voice-toggle"/g)||[]).length,1);
});
test('a model proposal previews real definition changes, with no writes until confirmation',async()=>{
  const value=setup();const {window,calls}=value;const original=JSON.stringify(window.OrbitOntology.data());
  await value.generate();const proposal=window.OrbitBusiness.data().proposal;
  assert.ok(proposal,window.OrbitDesigner.view().error);assert.equal(JSON.stringify(window.OrbitOntology.data()),original);assert.equal(window.ProjectStudio.data().agents.length,0);
  const request=JSON.parse(calls.find(entry=>entry.url.endsWith('/define')).options.body);assert.equal(request.graph,undefined);assert.equal(request.model.nodes.length,12);assert.equal(request.previous,null);
  const page=window.OrbitDesigner.page();assert.match(page,/确认设计并创建助手/);assert.match(page,/星状图/);assert.match(page,/卡片图/);assert.match(page,/待确认设计/);
  assert.equal(window.OrbitDesigner.view().consent,'');assert.throws(()=>window.OrbitBusiness.confirm(),/核对/);
});
test('one confirmation creates an agent with avatar and populated config, without enabling it',async()=>{
  const {window,generate,click}=setup();await generate();const originalCount=window.OrbitOntology.data().nodes.length;const originalRevision=window.OrbitOntology.data().revision;
  window.OrbitDesigner.view().ack=true;const entry=window.OrbitBusiness.confirm();const workspace=window.ProjectStudio.data();const agent=workspace.agents[0];
  assert.equal(workspace.scenes.length,1);assert.equal(workspace.agents.length,1);assert.equal(entry.agentId,agent.id);assert.ok(entry.config.avatar.art);assert.equal(agent.avatar.art,entry.config.avatar.art);assert.equal(entry.config.businessDesign.source,'model-definitions');
  assert.equal(agent.enabled,false);assert.equal(agent.activeVersion,'');assert.equal(agent.releases.length,0);assert.ok(!window.ProjectStudio.members().some(member=>member.id===agent.id));assert.ok(!workspace.profile.allowed.includes(agent.id));
  assert.equal(window.OrbitOntology.data().nodes.length,originalCount);assert.equal(window.OrbitOntology.data().revision,originalRevision+1);assert.equal(window.OrbitOntology.data().nodes.find(node=>node.id==='symptom').name,'报修问题');
  assert.match(window.OrbitDesigner.page(),/助手已创建/);assert.match(window.ProjectStudio.directoryExtra(),/设备报修专员/);assert.throws(()=>window.OrbitBusiness.confirm(),/变化/);assert.equal(workspace.agents.length,1);
  click('od-business-tests');assert.equal(window.ProjectStudio.orbitSection(),'tests');assert.doesNotMatch(window.ProjectStudio.orbitPage(),/先定义一位/);
  click('studio-tab',{value:'config'});assert.match(window.ProjectStudio.orbitPage(),/设计已确认 · 助手已创建/);assert.match(window.ProjectStudio.orbitPage(),/查看或微调已生成配置/);
});
test('revising the same design updates the same agent and preserves custom avatars, samples and releases',async()=>{
  const value=setup();const {window}=value;await value.generate();window.OrbitDesigner.view().ack=true;const scene=window.OrbitBusiness.confirm();const agent=window.ProjectStudio.data().agents[0];
  scene.config.avatar={art:'fox',tone:'amber'};scene.samples.push({id:'existing',input:'报修',expected:'missing',approved:true});agent.releases.push({version:'V1',config:structuredClone(scene.config)});agent.activeVersion='V1';agent.enabled=true;
  const release=JSON.stringify(agent.releases);await value.generate('仍使用当前定义，更新职责描述。');window.OrbitDesigner.view().ack=true;const updated=window.OrbitBusiness.confirm();
  assert.equal(updated.id,scene.id);assert.equal(window.ProjectStudio.data().agents.length,1);assert.equal(updated.config.avatar.art,'fox');assert.equal(updated.samples[0].id,'existing');assert.equal(JSON.stringify(agent.releases),release);
});
test('question-only replies and unresolved questions cannot create an assistant',async()=>{
  for(const result of [{message:'请补充处理范围。',questions:['需要哪些报修资料？'],design:null},{...design(),questions:['什么情况需要人工？']}]){
    const value=setup({response:()=>result});const {window}=value;const original=JSON.stringify(window.OrbitOntology.data());await value.generate();assert.match(window.OrbitDesigner.page(),new RegExp(result.questions[0].replace('？','')));
    window.OrbitDesigner.view().ack=true;assert.throws(()=>window.OrbitBusiness.confirm());assert.equal(JSON.stringify(window.OrbitOntology.data()),original);assert.equal(window.ProjectStudio.data().agents.length,0);
  }
});
test('follow-up model edits use the pending model without duplicating prior changes',async()=>{
  let round=0;const value=setup({response:()=>{const result=design();if(round++){result.design.nodes=[];result.design.links=[];result.design.goal='准备报修草稿和资料清单。';}return result;}});const {window,calls}=value;
  await value.generate();await value.generate('保留原关系，再补充资料清单作为交付内容。');
  const second=JSON.parse(calls.filter(entry=>entry.url.endsWith('/define'))[1].options.body);assert.equal(second.previous.name,'设备报修专员');assert.ok(second.model.links.some(entry=>entry.id==='new-relation'));
  assert.equal(window.OrbitBusiness.data().proposal.model.links.filter(entry=>entry.id==='new-relation').length,1);window.OrbitDesigner.view().ack=true;window.OrbitBusiness.confirm();assert.match(window.ProjectStudio.data().scenes[0].config.goal,/资料清单/);
});
test('manual preview edits retain IDs and are reflected in both map presentations',async()=>{
  const {window,generate,click}=setup();await generate();click('od-business-select',{id:'symptom'});window.OrbitDesigner.view().ack=true;
  window.OrbitBusiness.edit({id:'symptom',name:'报修现象',description:'客户反馈的现象，尚未诊断。',fields:'产品型号,问题描述'});
  assert.equal(window.OrbitDesigner.view().ack,false);const before=JSON.stringify(window.OrbitBusiness.data().proposal.model);
  for(const presentation of ['cards','star','cards']){click('od-business-presentation',{value:presentation});const page=window.OrbitDesigner.page();assert.match(page,/报修现象/);assert.equal(JSON.stringify(window.OrbitBusiness.data().proposal.model),before);assert.equal(window.OrbitBusiness.view().focusId,'symptom');}
});
test('the saved catalog switches star/card/directory while preserving the canonical definitions',()=>{
  const {window,click}=setup();const before=JSON.stringify(window.OrbitOntology.data());click('ow-choose-definitions');
  for(const presentation of ['star','graph','directory','star']){click('catalog-presentation',{value:presentation});const page=window.ProjectStudio.orbitPage();assert.match(page,/星状图/);assert.match(page,/卡片图/);assert.equal(JSON.stringify(window.OrbitOntology.data()),before);}
  click('catalog-star-select',{id:'draft'});assert.equal(window.OntologyCatalog.view().focusId,'draft');click('catalog-star-presentation',{value:'cards'});assert.equal(window.OntologyCatalog.view().presentation,'graph');assert.equal(window.OntologyCatalog.selected().id,'draft');
});
test('radial layout keeps real directions, focuses immediate neighbors and spaces nodes apart',()=>{
  const {window}=setup();const model=window.OrbitOntology.data();const before=JSON.stringify(model);
  for(const focusId of model.nodes.map(entry=>entry.id)){
    const layout=window.OrbitBusiness.starLayout(model,{focusId,showAll:false});assert.equal(layout.centerId,focusId);
    for(const link of layout.links){assert.ok(link.source===focusId||link.target===focusId);assert.ok(model.links.some(entry=>entry.id===link.id&&entry.source===link.source&&entry.target===link.target&&entry.label===link.label));}
    for(const node of layout.nodes)for(const other of layout.nodes.filter(entry=>entry.id!==node.id)){const overlap=node.x<other.x+other.width&&node.x+node.width>other.x&&node.y<other.y+other.height&&node.y+node.height>other.y;assert.equal(overlap,false);}
  }
  assert.equal(JSON.stringify(model),before);const all=window.OrbitBusiness.starLayout(model,{focusId:'draft',showAll:true});assert.equal(all.nodes.length,model.nodes.length);assert.equal(all.links.length,model.links.length);
});
test('stale canonical edits or assistant edits prevent adoption, and project switching keeps data separate',async()=>{
  for(const mutation of ['model','scene']){
    const value=setup();const {window}=value;if(mutation==='scene'){await value.generate();window.OrbitDesigner.view().ack=true;window.OrbitBusiness.confirm();}
    await value.generate();if(mutation==='model')window.OrbitOntology.data().nodes[0].description='人工修改';else window.ProjectStudio.data().scenes[0].config.goal='人工调整职责';
    const before=JSON.stringify(window.ProjectStudio.data());window.OrbitDesigner.view().ack=true;assert.throws(()=>window.OrbitBusiness.confirm(),/变化/);assert.equal(JSON.stringify(window.ProjectStudio.data()),before);
  }
  const value=setup();await value.generate();const storage=value.window.OrbitBusiness.data();value.switchProject('RETAIL');assert.equal(value.window.OrbitBusiness.data().proposal,null);value.switchProject('AFTERSALES');assert.equal(value.window.OrbitBusiness.data(),storage);
});
test('failed or cancelled model calls never substitute demo graphs and keep the original input',async()=>{
  const value=setup({fetchImpl:async url=>url==='/api/model-connections'?metadata():Response.json({error:'模型暂不可用'},{status:502})});const {window,calls}=value;await value.generate();assert.equal(window.OrbitBusiness.data().proposal,null);assert.ok(window.OrbitBusiness.data().input);assert.equal(window.OrbitBusiness.data().history.length,0);assert.equal(calls.filter(entry=>entry.url.endsWith('/define')).length,1);
  for(const change of ['project','definition','connection','stop']){
    let finish;const delayed=setup({fetchImpl:async url=>url==='/api/model-connections'?metadata():new Promise(resolve=>{finish=resolve;})});const designer=delayed.window.OrbitDesigner;const storage=delayed.window.OrbitBusiness.data();await designer.refresh();storage.input='整理报修业务定义';delayed.change('od-consent',true);const running=designer.send();
    if(change==='project'){delayed.switchProject('RETAIL');designer.mount();}if(change==='definition'){delayed.window.OrbitOntology.data().nodes[0].name='手动改名';}if(change==='connection')designer.invalidate();if(change==='stop')designer.stop();finish(envelope(design()));await running;assert.equal(storage.proposal,null,change);
  }
});
test('speech only fills the business composer; legacy flow drafts remain untouched',()=>{
  const {window,click,calls}=setup();let recognition;window.SpeechRecognition=class{constructor(){recognition=this;}start(){}abort(){}stop(){}};
  window.OrbitDesigner.data().input='原流程描述';click('od-voice');assert.equal(recognition,undefined);click('od-voice-start');recognition.onresult({results:[Object.assign([{transcript:'客户报修先核对资料。'}],{isFinal:true})]});window.OrbitDesigner.stopVoice(true);
  assert.equal(window.OrbitBusiness.data().input,'客户报修先核对资料。');assert.equal(window.OrbitDesigner.data().input,'原流程描述');assert.equal(calls.length,0);
});
test('invalid definitions, foreign references, duplicate names and unknown tools are rejected',()=>{
  const {window}=setup();const context={projectId:'AFTERSALES',model:policy.projectModel(window.OrbitOntology.data(),'AFTERSALES')};
  for(const mutate of [result=>{result.design.nodes[0].type='start';},result=>{result.design.nodes[0].tool='refund';},result=>{result.design.links[0].target='missing';},result=>{result.design.nodes[0].id='duplicate';result.design.nodes[0].name='先核实保修';},result=>{result.design.nodes[0].description='person@example.com';},result=>{result.design.removeLinks=['missing'];},result=>{result.design.definitionIds.push('foreign');},result=>{result.design.nodes[0].execute=true;}]){const result=design();mutate(result);assert.throws(()=>policy.parseProposal(result,context));}
  const body={agentId:'manager',projectId:'RETAIL',expectedRevision:1,consent:true,prompt:'设计业务',model:context.model,history:[],selectedNode:'',previous:null};assert.throws(()=>policy.prepare(body));body.projectId='AFTERSALES';body.consent=false;assert.throws(()=>policy.prepare(body));
});
test('incremental edits keep unmentioned fields, layout and definitions; cause hypotheses stay out of the assistant contract',()=>{
  const {window}=setup();const model=window.OrbitOntology.data();model.nodes[0].x=200;model.nodes[0].custom='manual';const result=design();delete result.design.nodes[0].fields;const context={projectId:'AFTERSALES',model:policy.projectModel(model,'AFTERSALES')};const parsed=policy.parseProposal(result,context);const merged=policy.merge(model,parsed.design);
  assert.equal(merged.nodes[0].fields,model.nodes[0].fields);assert.equal(merged.nodes[0].x,200);assert.equal(merged.nodes[0].custom,'manual');assert.deepEqual(plain(merged.nodes.find(entry=>entry.id==='board')),plain(model.nodes.find(entry=>entry.id==='board')));
  parsed.design.definitionIds.push('board');const config=policy.compile(parsed.design,merged,'AFTERSALES');assert.ok(!config.ontologyBinding.nodes.some(entry=>entry.id==='board'));assert.ok(!config.ontologyBinding.links.some(entry=>entry.label==='原因假设'));assert.doesNotThrow(()=>window.AgentHarness.compile(config,'AFTERSALES'));
});
test('draft persistence survives refresh and confirmation cannot overwrite unfinished manual forms',async()=>{
  const value=setup();await value.generate();const restored=setup({stored:value.stored});assert.ok(restored.window.OrbitBusiness.data().proposal);assert.equal(restored.window.OrbitBusiness.valid(),true);
  restored.window.OrbitOntology.view().definitionDrafts={symptom:{description:'尚未保存'}};restored.window.OrbitDesigner.view().ack=true;assert.throws(()=>restored.window.OrbitBusiness.confirm(),/手动定义/);assert.equal(restored.window.ProjectStudio.data().agents.length,0);
});
test('static mode makes no model request and leaves typed descriptions available',async()=>{
  const value=fixture({business:true,publicMode:true});value.window.OrbitBusiness.data().input='本地描述';await value.window.OrbitDesigner.refresh();await value.window.OrbitDesigner.send();assert.equal(value.calls.length,0);assert.equal(value.window.OrbitBusiness.data().input,'本地描述');assert.match(value.window.OrbitDesigner.page(),/在线静态演示不调用模型/);
});
test('testing and enabling use the already-created agent rather than creating a second one',async()=>{
  const value=setup();const {window,click,emit,submit}=value;await value.generate();window.OrbitDesigner.view().ack=true;const scene=window.OrbitBusiness.confirm();const agent=window.ProjectStudio.data().agents[0];const agentId=agent.id;
  click('od-business-tests');click('studio-sample-template');assert.equal(scene.samples.length,3);
  for(const sample of scene.samples)emit('change',{id:'',dataset:{studioApprove:sample.id},checked:true,closest:()=>null,matches:()=>false});
  click('studio-evaluate');assert.equal(window.ProjectStudio.readiness(scene).localReady,true);
  submit('studio-release-form',{confirmed:true,reason:'自动化测试中核对三类本地边界'});assert.equal(window.ProjectStudio.data().agents.length,1);assert.equal(agent.id,agentId);assert.equal(agent.activeVersion,'V1');assert.equal(agent.enabled,true);assert.ok(window.ProjectStudio.data().profile.allowed.includes(agent.id));
  submit('studio-release-form',{confirmed:true,reason:'重复确认检查'});assert.equal(agent.releases.length,1);
});
test('failed persistence rolls back both definitions and the automatically created agent',async()=>{
  const value=setup();const {window}=value;await value.generate();const before=JSON.stringify(window.ProjectStudio.data());const original=window.PortfolioHub.persist;window.PortfolioHub.persist=()=>false;window.OrbitDesigner.view().ack=true;
  assert.throws(()=>window.OrbitBusiness.confirm(),/未保存/);window.PortfolioHub.persist=original;assert.equal(JSON.stringify(window.ProjectStudio.data()),before);
});
test('graph numbers match the model definition indices across star/card switching',async()=>{
  const value=setup();const {window,click}=value;await value.generate();window.OrbitBusiness.data().input='请调整第三项定义';const context=policy.prepare(window.OrbitBusiness.request({revision:1}));const expected=context.definitionNumbers.find(entry=>entry.nodeId==='draft').number;
  for(const presentation of ['star','cards']){click('od-business-presentation',{value:presentation});const html=window.OrbitDesigner.page();const card=html.match(/<button[^>]*data-id="draft"[^>]*>[\s\S]*?<\/button>/)?.[0];assert.ok(card);assert.ok(card.includes('<b>'+expected+'</b>'));}
});
test('manual config changes made before a new request are preserved unless they conflict with a new design',async()=>{
  const value=setup();const {window}=value;await value.generate();window.OrbitDesigner.view().ack=true;const scene=window.OrbitBusiness.confirm();scene.config.goal='人工填写的处理职责';await value.generate();window.OrbitDesigner.view().ack=true;window.OrbitBusiness.confirm();assert.equal(scene.config.goal,'人工填写的处理职责');
  scene.config.goal='第二次人工职责';await value.generate();window.OrbitBusiness.data().proposal.design.goal='与人工职责不同的模型目标';window.OrbitDesigner.view().ack=true;assert.throws(()=>window.OrbitBusiness.confirm(),/冲突/);assert.equal(scene.config.goal,'第二次人工职责');
});
test('parallel and reverse star relationships keep distinct paths and correct labels',()=>{
  const {window}=setup();const model={nodes:[{id:'center',name:'对象',type:'object'},{id:'target',name:'规则',type:'rule'}],links:[{id:'one',source:'center',target:'target',label:'触发'},{id:'two',source:'center',target:'target',label:'受约束'},{id:'three',source:'target',target:'center',label:'适用于'}]};
  const layout=window.OrbitBusiness.starLayout(model,{focusId:'center'});assert.equal(new Set(layout.links.map(entry=>entry.path)).size,3);assert.equal(new Set(layout.links.map(entry=>JSON.stringify(entry.labelPosition))).size,3);
});
test('new business templates are not model output and switching modes retains both drafts',()=>{
  const {window,click,calls}=setup();window.OrbitDesigner.data().input='已有流程描述';click('od-example',{value:'repair'});const description=window.OrbitBusiness.data().input;assert.ok(description);assert.equal(calls.length,0);assert.equal(window.OrbitBusiness.data().proposal,null);
  click('od-flow-mode');assert.equal(window.OrbitDesigner.view().purpose,'flow');assert.match(window.OrbitDesigner.page(),/已有流程描述/);click('od-business-mode');assert.equal(window.OrbitDesigner.view().purpose,'business');assert.equal(window.OrbitBusiness.data().input,description);
});
