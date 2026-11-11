const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const fixture=require('./helpers/group-chat-fixture');
const read=filename=>filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

function setup(){
  const tools=fixture();
  for(const filename of ['orbit-flow.js','orbit-flow-gestures.js'])tools.run(read(filename));
  tools.run('globalThis.matchMedia=()=>({matches:true});window.OrbitFlow.configure(host);window.ProjectStudio.data().businessFlow=window.OrbitFlow.sample("AFTERSALES")');
  const query=tools.document.querySelector;
  tools.document.querySelector=selector=>selector==='.orbit-flow'?{}:query(selector);
  const flow=tools.window.OrbitFlow;flow.data();
  function submit(id,identifier,values){
    tools.emit('submit',{target:{id,dataset:{id:identifier},values,reportValidity:()=>true,classList:{contains:className=>id==='edge-form'&&className==='flow-edge-form'},matches:()=>false,closest:()=>null}});
  }
  function key(key,editable=false,extra={}){
    const target={closest:selector=>selector==='#flow-viewport'?{}:editable&&selector.startsWith('input,')?{}:null};
    return tools.emit('keydown',{key,target,...extra});
  }
  return {...tools,flow,submit,key};
}

test('nodes expose edit and delete controls and selection opens the inspector from command mode',()=>{
  const {flow,click}=setup();const html=flow.page();
  assert.equal((html.match(/class="flow-node-actions"/g)||[]).length,flow.data().nodes.length);
  assert.match(html,/aria-label="编辑节点：收集报修信息"/);assert.match(html,/aria-label="删除节点：收集报修信息"/);
  flow.view().side='agent';click('flow-edit',undefined,'collect');
  assert.equal(flow.view().side,'node');assert.equal(flow.view().selected,'collect');assert.equal(flow.view().selectedEdge,'');
  assert.match(flow.page(),/已选节点[\s\S]*编辑节点[\s\S]*删除节点/);
  flow.view().side='agent';click('flow-select',undefined,'start');assert.equal(flow.view().side,'node');
});

test('node form changes persist and undo restores the saved definition',()=>{
  const {flow,click,submit}=setup();const before=flow.data().nodes.find(node=>node.id==='collect').description;
  click('flow-edit',undefined,'collect');submit('flow-node-form','collect',{name:'核对设备信息',description:'先核对，再交给人工。',fields:'设备型号,故障现象'});
  assert.equal(flow.data().nodes.find(node=>node.id==='collect').name,'核对设备信息');
  click('flow-undo');assert.equal(flow.data().nodes.find(node=>node.id==='collect').description,before);
  click('flow-redo');assert.equal(flow.data().nodes.find(node=>node.id==='collect').name,'核对设备信息');
});

test('unfinished node descriptions can be saved as drafts but cannot pass compilation',()=>{
  const {flow,submit}=setup();submit('flow-node-form','collect',{name:'待补充信息',description:'',fields:''});
  assert.equal(flow.data().nodes.find(node=>node.id==='collect').name,'待补充信息');
  assert.throws(()=>flow.compile(flow.data(),'AFTERSALES'),/补齐名称与业务定义/);
});

test('deleting a node requires confirmation, removes exactly its connections, and supports undo and redo',()=>{
  const {flow,click,dialogs}=setup();const before=plain(flow.data());
  click('flow-remove',undefined,'condition');assert.equal(flow.data().nodes.length,7);assert.match(dialogs.at(-1).join(''),/3 条关联连线/);
  click('flow-remove-confirm',undefined,'condition');assert.equal(flow.data().nodes.length,6);assert.equal(flow.data().edges.length,4);
  assert.ok(flow.data().edges.every(edge=>edge.from!=='condition'&&edge.to!=='condition'));
  click('flow-undo');assert.deepEqual(plain(flow.data().nodes),before.nodes);assert.deepEqual(plain(flow.data().edges),before.edges);
  click('flow-redo');assert.equal(flow.data().nodes.length,6);assert.equal(flow.data().edges.length,4);
});

test('a stale or cross-project delete confirmation cannot delete current content',()=>{
  const {flow,click,switchProject}=setup();click('flow-remove',undefined,'collect');flow.data().revision++;
  click('flow-remove-confirm',undefined,'collect');assert.equal(flow.data().nodes.length,7);assert.match(flow.view().error,/画布已变化/);
  click('flow-remove',undefined,'collect');switchProject('RETAIL');const before=JSON.stringify(flow.data());
  click('flow-remove-confirm',undefined,'collect');assert.equal(JSON.stringify(flow.data()),before);
  switchProject('AFTERSALES');assert.equal(flow.data().nodes.length,7);
});

test('selected links expose endpoints and conditions and can be relabelled and reconnected',()=>{
  const {flow,click,submit}=setup();click('flow-edge-select',undefined,'link-0');
  assert.equal(flow.view().selected,'');assert.equal(flow.view().side,'node');
  const html=flow.page();assert.match(html,/aria-label="连线起点"/);assert.match(html,/aria-label="连线终点"/);assert.match(html,/编辑连线[\s\S]*删除连线/);
  submit('edge-form','link-0',{from:'start',to:'action',label:'进入准备'});
  const updated=flow.data().edges.find(edge=>edge.id==='link-0');assert.equal(updated.to,'action');assert.equal(updated.label,'进入准备');
  click('flow-undo');assert.equal(flow.data().edges.find(edge=>edge.id==='link-0').to,'collect');
});

test('reconnecting links preserves branch slots and rejects cycles, self-links, duplicates and ambiguous conditions',()=>{
  const {flow}=setup();const before=JSON.stringify(flow.data());
  const branch=flow.updateEdge(flow.data(),'link-3',{label:'需要补充'}).edges.find(edge=>edge.id==='link-3');assert.equal(branch.fromPort,1);
  for(const [identifier,values] of [['link-4',{to:'collect'}],['link-0',{to:'start'}],['link-2',{to:'human'}],['link-3',{label:'资料齐全'}],['link-0',{label:'字'.repeat(13)}]])assert.throws(()=>flow.updateEdge(flow.data(),identifier,values));
  assert.equal(JSON.stringify(flow.data()),before);
});

test('deleting a selected link keeps its nodes and undo restores the identical branch',()=>{
  const {flow,click}=setup();const before=plain(flow.data());click('flow-edge-select',undefined,'link-3');click('flow-unlink',undefined,'link-3');
  assert.deepEqual(plain(flow.data().nodes),before.nodes);assert.equal(flow.data().edges.length,6);assert.equal(flow.view().selectedEdge,'');
  click('flow-undo');assert.deepEqual(plain(flow.data().edges),before.edges);
});

test('canvas shortcuts delete and undo selections but never intercept text editing',()=>{
  const {flow,click,key}=setup();click('flow-edge-select',undefined,'link-0');
  assert.equal(key('Delete',true),false);assert.equal(flow.data().edges.length,7);
  assert.equal(key('Delete'),true);assert.equal(flow.data().edges.length,6);
  key('z',false,{metaKey:true});assert.equal(flow.data().edges.length,7);
  click('flow-select',undefined,'collect');flow.view().side='agent';key('F2');assert.equal(flow.view().side,'node');
  key('Backspace');assert.equal(flow.data().nodes.length,7);assert.equal(flow.view().removeRequest.identifier,'collect');
});

test('pending previews cannot be silently overwritten by node or link edits',()=>{
  const {flow,click,submit}=setup();const before=JSON.stringify(flow.data());flow.view().pending={graph:plain(flow.data())};
  click('flow-unlink',undefined,'link-0');assert.equal(JSON.stringify(flow.data()),before);
  submit('edge-form','link-0',{label:'不得保存'});assert.equal(JSON.stringify(flow.data()),before);
  submit('flow-node-form','start',{name:'不得保存',description:'编辑'});assert.equal(JSON.stringify(flow.data()),before);
});

test('scenario tests are visible action buttons, not hidden text links',()=>{
  const {window,click}=setup();const html=window.ServiceJourney.page();
  assert.doesNotMatch(html,/<details class="journey-boundary-tests"/);
  for(const label of ['开始人工与风险测试','开始工具失败测试'])assert.ok(html.includes('aria-label="'+label+'"'));
  assert.equal((html.match(/class="journey-scenario-cta"/g)||[]).length,2);
  click('journey-start','risk');assert.equal(window.ServiceJourney.sessions().at(-1).status,'needs-human');
  click('journey-start','timeout');assert.equal(window.ServiceJourney.sessions().at(-1).status,'tool-failed');
});

test('editing controls opt out of drag capture and keep keyboard-sized targets',()=>{
  assert.match(read('orbit-flow-gestures.js'),/\.flow-node-actions'\)\)return/);
  assert.match(read('orbit-canvas.css'),/\.flow-node-actions \.button\{min-height:28px/);
  assert.match(read('orbit-canvas.css'),/\.flow-selection-actions \.button\{flex:1;min-height:40px/);
});

test('node names stay escaped in both the action bar and the delete dialog',()=>{
  const {flow,click,dialogs}=setup();flow.data().nodes.find(node=>node.id==='collect').name='<img src=x>';
  click('flow-edit',undefined,'collect');assert.doesNotMatch(flow.page(),/<img src=x>/);
  click('flow-remove',undefined,'collect');assert.doesNotMatch(dialogs.at(-1).join(''),/<img src=x>/);assert.match(dialogs.at(-1).join(''),/&lt;img/);
});
