const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/orbit-designer-fixture');

async function savedDesign(){
  const context=fixture();const {window,change}=context;const designer=window.OrbitDesigner;
  designer.selectReference('rule-check');await designer.refresh();designer.data().input='先收集报修资料，核对齐全后准备草稿，再交给客服确认。';change('od-consent',true);await designer.send();designer.view().ack=true;designer.adopt();designer.view().reviewed=JSON.stringify(window.OrbitFlow.data());
  const scene=designer.saveAssistant();return {...context,designer,scene};
}
const showDesigner=window=>window.ProjectStudio.dispatch('tab',{dataset:{value:'workbench'}});
const inputEvent=(context,id,value)=>context.emit('input',{id,value,dataset:{},closest:()=>null,matches:()=>false});

test('saving the same source reopens its original draft without replacing manual edits or cases',async()=>{
  const {window,designer,scene,click}=await savedDesign();const sceneId=scene.id;
  scene.config.prompt+='\n人工补充的注意事项。';scene.samples[0].expected='handoff';scene.samples[0].approved=true;const before=JSON.stringify(scene);
  showDesigner(window);designer.view().reviewed='';assert.match(designer.page(),/继续配置/);assert.match(designer.page(),/审核案例/);
  assert.equal(designer.saveAssistant().id,sceneId);assert.equal(window.ProjectStudio.data().scenes.length,1);assert.equal(JSON.stringify(scene),before);
  showDesigner(window);click('od-open-tests');assert.equal(window.ProjectStudio.orbitSection(),'tests');assert.equal(JSON.stringify(scene),before);
});

test('the full draft to local-team path requires reviewed cases and preserves its ontology source',async()=>{
  const {window,designer,scene,emit,submit}=await savedDesign();
  assert.equal(window.ProjectStudio.orbitSection(),'config');assert.equal(scene.samples[0].source,'模型建议 · 待人工核对');assert.equal(scene.samples[0].approved,false);assert.ok(scene.config.avatar.art);
  window.ProjectStudio.dispatch('tab',{dataset:{value:'tests'}});window.ProjectStudio.dispatch('evaluate',{dataset:{}});assert.equal(window.ProjectStudio.readiness(scene).localReady,false);
  submit('studio-release-form',{confirmed:true,reason:'自动测试中的本地发布检查'});assert.equal(window.ProjectStudio.data().agents.length,0);
  submit('studio-sample-form',{input:'报修，设备型号：演示型号，购买日期：演示日期，故障现象：屏幕无显示。',expected:'prepared'});
  submit('studio-sample-form',{input:'请转人工处理报修。',expected:'handoff'});
  for(const sample of scene.samples)emit('change',{id:'',dataset:{studioApprove:sample.id},checked:true,closest:()=>null,matches:()=>false});
  window.ProjectStudio.dispatch('evaluate',{dataset:{}});assert.equal(window.ProjectStudio.readiness(scene).localReady,true);
  submit('studio-release-form',{confirmed:true,reason:'自动测试已核对三类本地规则边界'});
  const agent=window.ProjectStudio.data().agents[0];assert.ok(agent);assert.ok(window.ProjectStudio.data().profile.allowed.includes(agent.id));assert.equal(agent.releases[0].config.flowDesign.execution,'definition-only');
  assert.equal(agent.releases[0].config.flowDesign.graph.designerReferences.nodes[0].id,'rule-check');assert.ok(window.OntologyCatalog.references('rule-check').some(reference=>reference.agentId===agent.id&&reference.mode==='reference'));
  const release=JSON.stringify(agent.releases[0]);showDesigner(window);designer.saveAssistant();assert.equal(window.ProjectStudio.data().scenes.length,1);assert.equal(JSON.stringify(agent.releases[0]),release);
});

test('draft links are scoped to the current project and fail if the original draft was removed',async()=>{
  const {window,designer,scene,switchProject,click}=await savedDesign();showDesigner(window);assert.equal(designer.assistantDraft().scene.id,scene.id);
  switchProject('RETAIL');assert.equal(designer.assistantDraft().scene,null);assert.doesNotMatch(designer.page(),/继续配置/);switchProject('AFTERSALES');
  window.ProjectStudio.data().scenes=[];click('od-open-tests');assert.match(designer.view().error,/原草案已变化或不在当前项目/);assert.equal(window.ProjectStudio.data().scenes.length,0);
});

test('handoff validation is visible before saving and does not silently truncate a long flow',()=>{
  const {window}=fixture();const graph=window.OrbitFlow.sample('AFTERSALES');graph.nodes.forEach(node=>node.description='业务规则'.repeat(45));window.ProjectStudio.data().businessFlow=graph;
  const designer=window.OrbitDesigner;const original=JSON.stringify(window.OrbitFlow.data());assert.match(designer.page(),/暂不能保存为助手/);assert.match(designer.page(),/1200/);designer.view().reviewed=original;
  assert.throws(()=>designer.saveAssistant(),/1200/);assert.equal(window.ProjectStudio.data().scenes.length,0);assert.equal(JSON.stringify(window.OrbitFlow.data()),original);
});

test('case simulation has its own adjacent consent and generation consent cannot authorize it',async()=>{
  const context=fixture();const {window,change,calls}=context;const designer=window.OrbitDesigner;window.ProjectStudio.data().businessFlow=window.OrbitFlow.sample('AFTERSALES');await designer.refresh();designer.data().caseInput='请帮我处理设备报修。';
  const page=designer.page();const form=page.slice(page.indexOf('<form id="od-test-form">'),page.indexOf('</form>',page.indexOf('<form id="od-test-form">')));assert.match(form,/id="od-test-consent"/);assert.match(form,/试跑这个案例/);
  change('od-consent',true);await designer.send('simulate');assert.equal(calls.filter(call=>call.url.endsWith('/simulate')).length,0);assert.equal(designer.view().errorMode,'simulate');
  change('od-test-consent',true);inputEvent(context,'od-case','我重新描述报修情况。');assert.equal(designer.view().simulationConsent,'');await designer.send('simulate');assert.equal(calls.filter(call=>call.url.endsWith('/simulate')).length,0);
  change('od-test-consent',true);designer.selectReference('rule-check');assert.equal(designer.view().simulationConsent,'');
});

test('old simulation results disappear when the case or referenced definitions change',()=>{
  const {window}=fixture();const designer=window.OrbitDesigner;window.ProjectStudio.data().businessFlow=window.OrbitFlow.sample('AFTERSALES');designer.data().caseInput='原报修案例';
  const result={snapshot:JSON.stringify(window.OrbitFlow.data()),references:'[]',input:'原报修案例',outcome:'missing',steps:[{nodeId:'collect',summary:'需要设备型号'}],missing:['设备型号'],reply:'这条推演只属于原案例。'};designer.data().simulation=result;
  assert.match(designer.page(),/这条推演只属于原案例/);designer.data().caseInput='新报修案例';assert.doesNotMatch(designer.page(),/这条推演只属于原案例/);designer.data().caseInput='原报修案例';designer.selectReference('rule-check');assert.doesNotMatch(designer.page(),/这条推演只属于原案例/);
});

test('manual refinement selects the requested node rather than the last edge or command panel',()=>{
  const {window,click}=fixture();window.ProjectStudio.data().businessFlow=window.OrbitFlow.sample('AFTERSALES');window.OrbitDesigner.view().selected='condition';Object.assign(window.OrbitFlow.view(),{selectedEdge:'link-0',side:'agent',connect:'collect'});
  click('od-manual');assert.equal(window.OrbitWorkbench.view().mode,'flow');assert.equal(window.OrbitFlow.view().selected,'condition');assert.equal(window.OrbitFlow.view().selectedEdge,'');assert.equal(window.OrbitFlow.view().side,'node');assert.equal(window.OrbitFlow.view().connect,'');
});

test('final results from an earlier dictation cannot overwrite a new session or typed corrections',()=>{
  const context=fixture();const {window}=context;const designer=window.OrbitDesigner;const sessions=[];
  window.SpeechRecognition=class{constructor(){sessions.push(this);}start(){}stop(){}abort(){}result(text){this.onresult({results:[Object.assign([{transcript:text}],{isFinal:true})]});}};
  designer.startVoice();sessions[0].result('第一段描述。');designer.stopVoice();designer.startVoice();sessions[1].result('第二段描述。');sessions[0].result('第一段的迟到结果。');assert.equal(designer.data().input,'第一段描述。第二段描述。');
  inputEvent(context,'od-input','手动核对后的业务描述。');sessions[1].result('不应覆盖手动修改。');assert.equal(designer.data().input,'手动核对后的业务描述。');designer.stopVoice(true);
});

test('case input keeps its caret and scroll position after consent or result updates',()=>{
  const {window,document}=fixture();const designer=window.OrbitDesigner;let selection;let focused=false;
  const elements={'od-case':{id:'od-case',selectionStart:2,selectionEnd:5,focus(){focused=true;},setSelectionRange(start,end){selection=[start,end];}},'od-messages':{scrollTop:60,scrollHeight:600,clientHeight:200},'od-flow-viewport':{scrollTop:40,scrollLeft:30,scrollTo(){}}};
  document.getElementById=id=>elements[id]||null;document.activeElement=elements['od-case'];designer.capture();designer.mount();assert.equal(focused,true);assert.deepEqual(selection,[2,5]);assert.equal(elements['od-messages'].scrollTop,60);
});
