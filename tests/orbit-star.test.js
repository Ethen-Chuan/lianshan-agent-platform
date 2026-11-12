const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/orbit-designer-fixture');
const plain=value=>JSON.parse(JSON.stringify(value));
const bounds=layout=>layout.nodes.map(({id,x,y,width,height})=>({id,x,y,width,height}));
function setup(){const context=fixture({business:true});return {...context,star:context.window.OrbitStar,model:context.window.OrbitOntology.data()};}
function separated(layout){
  for(const node of layout.nodes){
    assert.ok(node.x>=24&&node.y>=76&&node.x+node.width<=layout.width&&node.y+node.height<=layout.height,node.id);
    for(const other of layout.nodes.filter(entry=>entry.id!==node.id))assert.ok(node.x+node.width<=other.x||other.x+other.width<=node.x||node.y+node.height<=other.y||other.y+other.height<=node.y,node.id+' / '+other.id);
  }
}
test('star gives the core business object prominence and separates context from handling rules',()=>{
  const {star,model}=setup();const map=star.layout(model,{});const hub=map.nodes[0];assert.equal(hub.id,'symptom');assert.equal(hub.isCenter,true);
  for(const node of map.nodes.slice(1)){assert.ok(node.width<hub.width&&node.height<hub.height);if(['rule','action','human'].includes(node.type))assert.ok(node.x>hub.x);else assert.ok(node.x<hub.x);}
  assert.equal(map.nodes.find(node=>node.id==='board').orbitRole,'candidate');assert.equal(map.nodes.find(node=>node.id==='device').orbitRole,'scope');separated(map);
});
test('selecting a satellite or relation changes the highlight, not the center or layout',()=>{
  const {star,model}=setup();const state={presentation:'star',zoom:.9};const before=bounds(star.layout(model,state));
  star.interact('select','rule-check',state,model);assert.equal(state.centerId,'symptom');assert.equal(state.focusId,'rule-check');assert.deepEqual(plain(bounds(star.layout(model,state))),plain(before));
  const link=model.links.find(entry=>entry.source==='symptom'&&entry.target==='rule-check');star.interact('edge',link.id,state,model);assert.equal(state.edgeId,link.id);assert.deepEqual(plain(bounds(star.layout(model,state))),plain(before));
  const html=star.diagram(model,state,'catalog-star');assert.match(html,/设为中心/);assert.match(html,/取消高亮/);assert.match(html,/aria-label="对象关系星状图"/);
});
test('explicit recenter and back keep the selected definition consistent and reset only view state',()=>{
  const {star,model}=setup();const snapshot=JSON.stringify(model);const state={focusId:'symptom',zoom:1};
  assert.equal(star.interact('center','rule-check',state,model),true);assert.equal(star.layout(model,state).centerId,'rule-check');assert.equal(state.focusId,'rule-check');assert.equal(state.zoom,null);
  star.interact('center','verify',state,model);model.nodes=model.nodes.filter(node=>node.id!=='rule-check');star.interact('back','',state,model);assert.equal(state.centerId,'symptom');assert.equal(state.focusId,'symptom');
  model.nodes=JSON.parse(snapshot).nodes;assert.equal(JSON.stringify(model),snapshot);assert.equal(star.interact('center','missing',state,model),false);
});
test('action paths use exact directed relations and never manufacture a shortcut or include a hypothesis',()=>{
  const {star,model}=setup();const paths=star.trails(model,'symptom');assert.deepEqual(new Set(paths.map(path=>path.targetId)),new Set(['verify','draft']));
  const path=paths.find(entry=>entry.targetId==='verify');assert.deepEqual(plain(path.nodes),['symptom','rule-check','verify']);assert.deepEqual(plain(path.links.map(link=>link.label)),['触发','执行']);
  for(const trail of paths)for(const [index,link] of trail.links.entries()){assert.equal(link.source,trail.nodes[index]);assert.equal(link.target,trail.nodes[index+1]);assert.ok(model.links.includes(link));assert.notEqual(link.label,'原因假设');}
  assert.equal(star.trails(model,'board').length,0);const state={focusId:'symptom'};star.interact('trail',path.id,state,model);const map=star.layout(model,state);
  assert.ok(map.nodes.some(node=>node.id==='verify'));assert.ok(map.links.some(link=>link.source==='rule-check'&&link.target==='verify'));assert.ok(!map.links.some(link=>link.source==='symptom'&&link.target==='verify'));
  const before=bounds(map);star.interact('select','verify',state,model);assert.deepEqual(plain(bounds(star.layout(model,state))),plain(before));assert.equal(state.trailActive,false);
  star.interact('trail',path.id,state,model);assert.equal(state.trailId,'');assert.ok(!star.layout(model,state).nodes.some(node=>node.id==='verify'));
});
test('path traversal handles cycles, disconnected actions and stale path selections',()=>{
  const {star}=setup();const model={nodes:[{id:'root',type:'object',name:'对象'},{id:'rule',type:'rule',name:'规则'},{id:'target',type:'action',name:'动作'},{id:'alone',type:'action',name:'孤立动作'}],links:[{id:'first',source:'root',target:'rule',label:'触发'},{id:'cycle',source:'rule',target:'root',label:'返回'},{id:'finish',source:'rule',target:'target',label:'执行'}]};
  const paths=star.trails(model,'root');assert.equal(paths.length,1);assert.equal(paths[0].links.length,2);assert.equal(paths[0].targetId,'target');
  const state={focusId:'root',trailId:paths[0].id,trailActive:true};model.links.pop();assert.equal(star.layout(model,state).trail,undefined);assert.equal(star.interact('trail',paths[0].id,state,model),false);assert.ok(!star.layout(model,state).nodes.some(node=>node.id==='target'));
});
test('every center, full map and expanded path have separated nodes and full definition titles',()=>{
  const {star,model}=setup();model.nodes.find(node=>node.id==='alias-dark').name='需要完整显示而不是裁剪的业务叫法与中英文W'.repeat(2);
  for(const root of model.nodes){
    for(const showAll of [false,true]){const map=star.layout(model,{centerId:root.id,showAll});separated(map);if(showAll){assert.equal(map.nodes.length,model.nodes.length);assert.equal(map.links.length,model.links.length);}}
    for(const path of star.trails(model,root.id))separated(star.layout(model,{centerId:root.id,trailId:path.id}));
  }
});
test('new star interactions work in both preview and saved catalog without writes or model calls',()=>{
  const value=setup();const {window,click,star,model}=value;const storage=window.OrbitBusiness.data();storage.savedModel={design:{name:'报修助手',definitionIds:model.nodes.map(node=>node.id),entryActionId:'draft'}};
  const snapshot=JSON.stringify(window.ProjectStudio.data());const revision=model.revision;
  for(const prefix of ['od-business','catalog-star']){
    if(prefix==='catalog-star')click('catalog-presentation',{value:'star'});
    const state=prefix==='od-business'?window.OrbitBusiness.view():window.OntologyCatalog.view();star.diagram(model,state,prefix);
    click(prefix+'-select',{id:'rule-check'});assert.equal(state.focusId,'rule-check');assert.equal(state.centerId,'symptom');
    click(prefix+'-center',{id:'rule-check'});assert.equal(state.centerId,'rule-check');click(prefix+'-back');assert.equal(state.centerId,'symptom');
    const path=star.trails(model,'symptom')[0];click(prefix+'-trail',{id:path.id});assert.equal(state.trailActive,true);assert.match(star.diagram(model,state,prefix),/已定义关系 · 非执行记录/);
    click(prefix+'-clear');assert.equal(state.focusId,'');assert.equal(state.trailActive,false);
    if(prefix==='catalog-star')assert.equal(window.OntologyCatalog.selected().id,'symptom');
  }
  assert.equal(JSON.stringify(window.ProjectStudio.data()),snapshot);assert.equal(model.revision,revision);assert.equal(value.calls.length,0);
});
test('layout positions survive recentering, return, and switching projects without changing model data',()=>{
  const {window,star,model,switchProject}=setup();const state=window.OrbitBusiness.view();const original=star.layout(model,state);const first=original.nodes[0];const snapshot=JSON.stringify(model);
  const positions=new Map([[first.id,{x:first.x+12,y:first.y+24}]]);const manual=window.OrbitMap.place(original,positions);
  assert.equal(manual.nodes[0].x,first.x+12);star.interact('center','rule-check',state,model);star.interact('back','',state,model);assert.equal(star.layout(model,state).centerId,'symptom');
  switchProject('RETAIL');assert.notEqual(window.OrbitBusiness.view(),state);assert.equal(window.OrbitBusiness.view().centerId,undefined);switchProject('AFTERSALES');assert.equal(window.OrbitBusiness.view(),state);assert.equal(JSON.stringify(model),snapshot);
});
test('empty and isolated graphs are usable; model text is escaped in graph labels and paths',()=>{
  const {star,model}=setup();const empty=star.diagram({nodes:[],links:[]},{presentation:'star'},'catalog-star');assert.match(empty,/还没有业务定义/);assert.doesNotMatch(empty,/undefined|NaN/);
  const isolated=star.diagram({nodes:[{id:'alone',type:'object',name:'独立对象'}],links:[]},{presentation:'star'},'catalog-star');assert.match(isolated,/尚无关系/);assert.match(isolated,/4 层关系内/);
  model.nodes[0].name='<script>bad()</script>';const html=star.diagram(model,{presentation:'star'},'catalog-star');assert.doesNotMatch(html,/<script>bad\(\)<\/script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/原因假设 · 待验证/);
});
test('star preview links open the requested presentation without altering the canonical model',()=>{
  const value=fixture({business:true,url:'http://127.0.0.1:4342/?project=AFTERSALES&design=definitions&map=star#orbit'});const {window}=value;const original=JSON.stringify(window.OrbitOntology.data());
  assert.equal(window.OntologyCatalog.view().presentation,'star');assert.match(window.ProjectStudio.orbitPage(),/data-ob-mode="star"/);assert.equal(JSON.stringify(window.OrbitOntology.data()),original);
});
test('switching from a card outside the current star neighborhood shows the same selection',()=>{
  const {window,star,model,click}=setup();const state=window.OntologyCatalog.view();state.centerId='symptom';click('catalog-map-select',{id:'human'});click('catalog-presentation',{value:'star'});
  assert.equal(star.layout(model,state).centerId,'human');assert.equal(window.OntologyCatalog.selected().id,'human');
  state.centerId='symptom';state.focusId='rule-check';star.enter(model,state);assert.equal(state.centerId,'symptom');
});
test('selecting a node preserves viewport scroll and recentering restores keyboard focus',()=>{
  const {window,document}=setup();let selected={dataset:{id:'symptom'},focus(){document.activeElement=this;}};
  const viewport={scrollLeft:240,scrollTop:100,scrollTo(left,top){this.scrollLeft=left;this.scrollTop=top;}};
  const graph={dataset:{obGraph:'catalog-star',obMode:'star',obCenter:'symptom'},querySelector:selector=>selector==='.ob-graph-viewport'?viewport:selected,querySelectorAll:()=>[]};
  document.querySelector=()=>graph;document.activeElement={dataset:{action:'catalog-star-select',id:'rule-check'}};window.OrbitBusiness.capture();
  selected={dataset:{id:'rule-check'},focus(){document.activeElement=this;}};viewport.scrollTo(0,0);window.OrbitBusiness.mount();assert.equal(viewport.scrollLeft,240);assert.equal(viewport.scrollTop,100);assert.equal(document.activeElement,selected);
  graph.dataset.obCenter='rule-check';window.OrbitBusiness.mount();assert.equal(viewport.scrollLeft,0);assert.equal(viewport.scrollTop,0);
});
test('definitions are grouped by existing semantic roles, with aliases separate from scope and unverified causes',()=>{
  const {star,model}=setup();const original=JSON.stringify(model);const map=star.layout(model,{});const aliases=map.groups.find(group=>group.id==='alias');
  assert.deepEqual(plain(aliases.nodeIds),['alias-dark','alias-off']);assert.equal(aliases.count,2);assert.equal(aliases.relation.label,'同义表达');assert.equal(aliases.relation.direction,'in');
  assert.deepEqual(plain(map.groups.find(group=>group.id==='scope').nodeIds),['device']);assert.deepEqual(plain(map.groups.find(group=>group.id==='candidate').nodeIds),['board']);assert.match(map.groups.find(group=>group.id==='candidate').name,/待验证/);
  assert.ok(!map.nodes.some(node=>node.id==='alias'));assert.deepEqual(new Set(map.groups.flatMap(group=>group.nodeIds)),new Set(map.nodes.filter(node=>!node.isCenter).map(node=>node.id)));assert.equal(JSON.stringify(model),original);
});
test('group headings and category bounds stay separate from other definitions in automatic layouts',()=>{
  const {star,model}=setup();model.nodes.find(node=>node.id==='alias-dark').name='长标题应完整展示'.repeat(8);
  for(const center of model.nodes)for(const showAll of [false,true]){
    const map=star.layout(model,{centerId:center.id,showAll});
    for(const group of map.groups){assert.equal(group.hidden,false,center.id+' / '+group.id);assert.ok(group.y>=68);for(const identifier of group.nodeIds){const member=map.nodes.find(node=>node.id===identifier);assert.ok(member.x>=group.x&&member.x+member.width<=group.x+group.width&&member.y>=group.y+54&&member.y+member.height<=group.y+group.height);}}
  }
});
test('duplicate relation labels move into the category heading, but selecting a member reveals its precise edge',()=>{
  const {star,model}=setup();const state={presentation:'star'};const markup=()=>star.diagram(model,state,'catalog-star');const label=(html,id)=>html.match(new RegExp('<button[^>]+data-map-label="'+id+'"[^>]*>'))?.[0];
  const overview=markup();assert.match(overview,/class="os-group-heading"[^>]+data-action="catalog-star-group" data-id="alias"/);assert.match(label(overview,'relation-0'),/hidden/);assert.match(label(overview,'relation-1'),/hidden/);
  const before=bounds(star.layout(model,state));star.interact('select','alias-dark',state,model);const selected=markup();assert.doesNotMatch(label(selected,'relation-0'),/hidden/);assert.match(label(selected,'relation-1'),/hidden/);assert.deepEqual(plain(bounds(star.layout(model,state))),plain(before));
  assert.match(selected,/黑屏 — 同义表达 → 屏幕无显示/);assert.match(selected,/屏幕不亮/);
});
test('relations with different directions, labels or extra endpoints are never collapsed into a shared assertion',()=>{
  const {star}=setup();const make=()=>({nodes:[{id:'root',name:'对象',type:'object'},{id:'first',name:'叫法甲',type:'alias'},{id:'second',name:'叫法乙',type:'alias'}],links:[{id:'one',source:'first',target:'root',label:'同义表达'},{id:'two',source:'second',target:'root',label:'同义表达'}]});
  for(const variant of ['direction','label','extra']){
    const model=make();if(variant==='direction')Object.assign(model.links[1],{source:'root',target:'second'});if(variant==='label')model.links[1].label='相关但不等同';if(variant==='extra')model.links.push({id:'three',source:'first',target:'second',label:'关联'});
    const map=star.layout(model,{centerId:'root',showAll:true});assert.equal(map.groups.find(group=>group.id==='alias').relation,undefined);assert.ok(map.links.every(link=>!link.summaryGroupId));assert.equal(map.links.length,model.links.length);
  }
});
test('category highlighting works in both entry points and remains only a view operation',()=>{
  const value=setup();const {window,click,star,model}=value;window.OrbitBusiness.data().savedModel={design:{name:'报修助手',definitionIds:model.nodes.map(node=>node.id),entryActionId:'draft'}};
  const original=JSON.stringify(window.ProjectStudio.data());
  for(const prefix of ['od-business','catalog-star']){
    if(prefix==='catalog-star')click('catalog-presentation',{value:'star'});
    const state=prefix==='catalog-star'?window.OntologyCatalog.view():window.OrbitBusiness.view();star.diagram(model,state,prefix);const before=bounds(star.layout(model,state));
    click(prefix+'-group',{id:'alias'});assert.equal(state.groupId,'alias');const map=star.layout(model,state);const focus=star.emphasis(map,state);assert.equal(focus.related.length,2);assert.ok(focus.related.every(link=>link.label==='同义表达'));assert.ok(focus.relatedNodes.has('alias-dark')&&focus.relatedNodes.has('alias-off'));assert.deepEqual(plain(bounds(map)),plain(before));
    click(prefix+'-group',{id:'alias'});assert.equal(state.groupId,'');click(prefix+'-group',{id:'scope'});click(prefix+'-select',{id:'device'});assert.equal(state.groupId,'');assert.equal(state.focusId,'device');
    click(prefix+'-group',{id:'alias'});star.enter(model,state);assert.equal(state.groupId,'');
  }
  assert.equal(JSON.stringify(window.ProjectStudio.data()),original);assert.equal(value.calls.length,0);
});
test('constellation links connect small visible points, retain direction, and avoid definition text',()=>{
  const {star,model,window}=setup();const map=star.layout(model,{});assert.equal(map.constellation,true);
  for(const link of map.links){
    const source=star.anchor(map.nodes.find(node=>node.id===link.source));const target=star.anchor(map.nodes.find(node=>node.id===link.target));
    const start=window.OrbitAtlasGraph.point(link.curve,0);const end=window.OrbitAtlasGraph.point(link.curve,1);
    assert.ok(Math.hypot(start.x-source.x,start.y-source.y)<=source.width/2+10);assert.ok(Math.hypot(end.x-target.x,end.y-target.y)<=target.width/2+10);
    for(let index=1;index<100;index++){const point=window.OrbitAtlasGraph.point(link.curve,index/100);for(const node of map.nodes){const box=star.textBounds(node);assert.ok(point.x<=box.x||point.x>=box.x+box.width||point.y<=box.y||point.y>=box.y+box.height,link.id+' / '+node.id);}}
  }
  const loop={id:'self',source:map.centerId,target:map.centerId,label:'关联'};const loopMap=window.OrbitMap.reroute({...map,links:[...map.links,loop]});
  assert.equal(loopMap.links.at(-1).path,window.OrbitAtlasGraph.path(star.route(loop,loopMap)));assert.doesNotMatch(loopMap.links.at(-1).path,/NaN/);
});
test('parallel and reversed constellation links stay distinct and view markup preserves all definition numbers',()=>{
  const {star,model}=setup();model.links.push({id:'parallel',source:'symptom',target:'rule-check',label:'参考'},{id:'reverse',source:'rule-check',target:'symptom',label:'适用'});
  const original=JSON.stringify(model);const map=star.layout(model,{});const paths=map.links.filter(link=>[link.source,link.target].includes('rule-check')).map(link=>link.path);assert.equal(paths.length,3);assert.equal(new Set(paths).size,3);
  for(const prefix of ['od-business','catalog-star']){const html=star.diagram(model,{dragMode:'branch'},prefix);assert.match(html,/data-map-drag-mode aria-label="节点拖动方式"/);assert.match(html,/<option value="branch" selected>/);assert.match(html,/os-node-point/);assert.match(html,/data-map-signal/);assert.match(html,/关系示意，不代表执行状态/);assert.match(html,/原因假设 · 待验证/);assert.doesNotMatch(html,/undefined|NaN/);}
  assert.equal(JSON.stringify(model),original);
});
test('unchanged routes reuse their curve only while the current node and heading obstacles remain clear',()=>{
  const {star,model,window}=setup();const map=star.layout(model,{});const link=map.links[0];assert.equal(star.route(link,map),link.curve);
  const point=window.OrbitAtlasGraph.point(link.curve,.5);const intruder={id:'intruder',name:'新位置',type:'object',x:point.x-30,y:point.y-25,width:60,height:50,pointX:.3,pointY:.44,pointSize:16,orbitSide:'right'};
  const obstructed={...map,nodes:[...map.nodes,intruder]};assert.equal(star.routeKey(link,obstructed),link.routeKey);const rerouted=star.route(link,obstructed);assert.notEqual(rerouted,link.curve);assert.notEqual(window.OrbitAtlasGraph.path(rerouted),link.path);
  for(let index=1;index<100;index++){const sample=window.OrbitAtlasGraph.point(rerouted,index/100);assert.ok(sample.x<=intruder.x||sample.x>=intruder.x+intruder.width||sample.y<=intruder.y||sample.y>=intruder.y+intruder.height);}
});
