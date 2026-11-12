const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fixture}=require('./helpers/orbit-designer-fixture');
const plain=value=>JSON.parse(JSON.stringify(value));
function surface(mode='star',zoom=1,showAll=false){
  const session=fixture({business:true});const {window,document,emit}=session;const map=window.OrbitMap;const state=mode==='star'?window.OrbitBusiness.view():window.OntologyCatalog.view();state.zoom=zoom;state.showAll=showAll;
  const model=window.OrbitOntology.data();const base=mode==='star'?window.OrbitBusiness.starLayout(model,state):window.OrbitAtlasGraph.catalogLayout(model,'complete');
  const prefix=mode==='star'?'od-business':'catalog-map';const key=mode==='star'?'star:'+base.centerId+':'+showAll:'cards:complete';const readout={textContent:''};const status={textContent:''};const feedback={textContent:'',hidden:true};let captured=null;
  function element(dataset={}){const classes=new Set();return {dataset,style:{},classList:{add(...values){values.forEach(value=>classes.add(value));},remove(...values){values.forEach(value=>classes.delete(value));},contains:value=>classes.has(value)},focus(){document.activeElement=this;},setPointerCapture(identifier){captured=identifier;},hasPointerCapture:identifier=>captured===identifier,releasePointerCapture(){captured=null;},setAttribute(name,value){this[name]=value;}};}
  const root=element({relationshipMap:prefix});const viewport=element();Object.assign(viewport,{clientWidth:950,clientHeight:600,scrollLeft:120,scrollTop:60,scrollTo(left,top){this.scrollLeft=left;this.scrollTop=top;}});
  const dragMode=element();dragMode.id='';dragMode.value='single';dragMode.matches=()=>false;dragMode.closest=selector=>selector==='[data-map-drag-mode]'?dragMode:selector==='[data-relationship-map]'?root:null;
  const stage=element({width:base.width,height:base.height});stage.parentElement=element();const svg=element();
  const nodes=base.nodes.map(node=>{const item=element({mapNode:node.id,id:node.id,action:mode==='star'?'od-business-select':'catalog-map-select'});item.closest=selector=>selector==='[data-map-node]'?item:selector==='[data-map-viewport]'?viewport:selector==='[data-relationship-map]'?root:selector.startsWith('[data-action^=')?item:null;return item;});
  const edges=base.links.map(link=>{const item=element({mapEdge:link.id});const line=element();item.querySelector=()=>line;return item;});const labels=base.links.map(link=>element({mapLabel:link.id,mapVisible:'true'}));
  stage.querySelector=selector=>selector==='svg'?svg:null;stage.querySelectorAll=selector=>selector==='[data-map-node]'?nodes:selector==='[data-map-edge]'?edges:selector==='[data-map-label]'?labels:[];
  viewport.querySelector=selector=>selector==='[data-map-stage]'?stage:null;viewport.closest=selector=>selector==='[data-map-viewport]'?viewport:selector==='[data-relationship-map]'?root:null;
  root.querySelector=selector=>selector==='[data-map-viewport]'?viewport:selector==='[data-map-zoom]'?readout:selector==='[data-map-status]'?status:selector==='[data-map-drag-feedback]'?feedback:null;
  document.querySelector=selector=>selector.includes('[data-map-viewport]')?viewport:null;document.querySelectorAll=selector=>selector==='[data-map-viewport]'?[viewport]:[];
  const current=()=>map.bind(prefix,base,state,key);current();map.mount();
  function drag(identifier,deltaX,deltaY,end='pointerup'){const target=nodes.find(entry=>entry.dataset.id===identifier)||viewport;emit('pointerdown',target,{button:0,pointerId:7,clientX:200,clientY:200});emit('pointermove',target,{pointerId:7,clientX:200+deltaX,clientY:200+deltaY});if(end==='Escape')emit('keydown',target,{key:'Escape'});else emit(end,target,{pointerId:7});return target;}
  return {...session,map,state,base,prefix,key,root,viewport,stage,nodes,edges,labels,current,drag,readout,status,feedback,setMode(mode){dragMode.value=mode;emit('change',dragMode);}};
}

for(const mode of ['star','cards'])test(`${mode}: whole node drag is zoom-aware, reroutes edges, and preserves definitions`,()=>{
  const value=surface(mode,.8);const {map,base,window,drag,current,edges}=value;const businessSnapshot=window.OrbitBusiness.snapshot();const snapshot=JSON.stringify(window.ProjectStudio.data());const original=base.nodes[0];
  drag(original.id,16,8);const moved=current().nodes.find(node=>node.id===original.id);assert.equal(moved.x,original.x+20);assert.equal(moved.y,original.y+10);
  assert.ok(edges.some(edge=>edge.querySelector().d!==base.links.find(link=>link.id===edge.dataset.mapEdge).path));
  assert.equal(JSON.stringify(window.ProjectStudio.data()),snapshot);assert.equal(window.OrbitBusiness.snapshot(),businessSnapshot);
  assert.deepEqual(plain(map.bind(value.prefix,base,value.state,value.key).nodes),plain(current().nodes));assert.equal(value.calls.length,0);
});

test('movement threshold keeps a click intact and completed drags suppress accidental node selection',()=>{
  const value=surface();const identifier=value.base.nodes[0].id;const target=value.drag(identifier,3,1);assert.deepEqual(plain(value.current().nodes),plain(value.base.nodes));
  const click=value.emit('click',target);assert.notEqual(click.stopped,true);
  value.drag(identifier,40,20);const after=value.emit('click',target);assert.equal(after.stopped,true);assert.equal(after.defaultPrevented,true);
});

test('Escape and pointercancel restore positions and cancel an unfinished drag before rerender',()=>{
  const value=surface();const identifier=value.base.nodes[0].id;
  for(const end of ['Escape','pointercancel','lostpointercapture']){value.drag(identifier,180,90,end);assert.deepEqual(plain(value.current().nodes),plain(value.base.nodes));}
  const target=value.nodes[0];value.emit('pointerdown',target,{button:0,pointerId:1,clientX:0,clientY:0});value.emit('pointermove',target,{pointerId:1,clientX:100,clientY:100});value.map.capture();assert.deepEqual(plain(value.current().nodes),plain(value.base.nodes));assert.equal(target.classList.contains('is-dragging'),false);
});

test('blank canvas pans instead of changing nodes and cancellation restores its previous scroll',()=>{
  const value=surface();const before={left:value.viewport.scrollLeft,top:value.viewport.scrollTop};value.drag('',-160,-90);assert.equal(value.viewport.scrollLeft,before.left+160);assert.equal(value.viewport.scrollTop,before.top+90);assert.deepEqual(plain(value.current().nodes),plain(value.base.nodes));
  value.drag('',-200,0,'Escape');assert.equal(value.viewport.scrollLeft,before.left+160);
});

test('keyboard movement, larger steps, boundaries and reset use only view state',()=>{
  const value=surface();const node=value.base.nodes[0];const target=value.nodes[0];value.emit('keydown',target,{key:'ArrowRight'});assert.equal(value.current().nodes[0].x,node.x+12);
  value.emit('keydown',target,{key:'ArrowDown',shiftKey:true});assert.equal(value.current().nodes[0].y,node.y+40);assert.match(value.status.textContent,/已移动/);
  value.map.reset(value.prefix);assert.deepEqual(plain(value.current().nodes),plain(value.base.nodes));assert.equal(value.viewport.scrollLeft,0);
  value.drag(node.id,-10000,-10000);assert.ok(value.current().nodes.every(entry=>entry.x>=24&&entry.y>=76));
});

test('overlapping drops settle outside other nodes, while both layouts and projects retain independent positions',()=>{
  const value=surface('cards');const first=value.base.nodes[0];const second=value.base.nodes[1];value.drag(first.id,second.x-first.x,second.y-first.y);const result=value.current();
  for(const left of result.nodes)for(const right of result.nodes)if(left.id!==right.id)assert.ok(left.x+left.width<=right.x||right.x+right.width<=left.x||left.y+left.height<=right.y||right.y+right.height<=left.y);
  const independent=value.map.bind('other',value.base,value.state,'star:another');assert.deepEqual(plain(independent.nodes),plain(value.base.nodes));
  value.switchProject('RETAIL');const otherState=value.window.OntologyCatalog.view();assert.deepEqual(plain(value.map.bind('other',value.base,otherState,value.key).nodes),plain(value.base.nodes));value.switchProject('AFTERSALES');assert.deepEqual(plain(value.current().nodes),plain(result.nodes));
});

test('fit includes width and height, zoom readout matches, and hidden relation labels stay hidden after drag',()=>{
  const value=surface();value.map.fit(value.prefix);assert.ok(value.state.zoom*value.base.width<=value.viewport.clientWidth);assert.ok(value.state.zoom*value.base.height<=value.viewport.clientHeight);assert.equal(value.readout.textContent,Math.round(value.state.zoom*100)+'%');
  value.labels[0].dataset.mapVisible='false';value.drag(value.base.nodes[0].id,30,20);assert.equal(value.labels[0].hidden,true);
});

test('full names have content-derived space, all captions sit outside nodes, and star nodes have top breathing room',()=>{
  const value=surface();const model=value.window.OrbitOntology.data();model.nodes[0].name='这里是一个需要完整显示且不能出现上下遮挡的业务定义名称';const graph=value.window.OrbitBusiness.starLayout(model,{focusId:model.nodes[0].id});
  assert.ok(graph.nodes.every(node=>node.y>=76&&node.x>=24));
  for(const node of graph.nodes){const lines=Math.max(1,Math.ceil(Array.from(node.name).length/(node.isCenter?10:9)));assert.ok(node.height>=(node.isCenter?122+lines*24:36+lines*22));}
  assert.ok(graph.nodes.filter(node=>!node.isCenter).every(node=>node.height<graph.nodes[0].height));
  assert.ok(value.map.metrics([{name:'W'.repeat(30)}]).height>=192);assert.equal(value.map.excerpt('W'.repeat(50)).length,30);
  for(const link of graph.links.filter(entry=>entry.labelPosition))for(const node of graph.nodes){const label=link.labelPosition;assert.ok(label.x+label.width/2<=node.x||label.x-label.width/2>=node.x+node.width||label.y+15<=node.y||label.y-15>=node.y+node.height);}
  const css=fs.readFileSync(path.join(__dirname,'../app/orbit-map.css'),'utf8');assert.match(css,/flex:0 0 auto/);assert.match(css,/strong\{[^}]*height:auto[^}]*white-space:normal;overflow:visible/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/forced-colors:active/);
});

test('all three rendering paths include drag hooks, real relation identifiers and explicit map controls',()=>{
  const value=fixture({business:true});const {window}=value;const model=window.OrbitOntology.data();
  for(const presentation of ['star','cards']){const html=window.OrbitBusiness.diagram(model,{presentation,focusId:'symptom',zoom:1});for(const marker of ['data-relationship-map','data-map-node','data-map-edge','data-map-label','data-map-control="reset"','data-map-viewport','data-map-stage'])assert.ok(html.includes(marker),marker);assert.doesNotMatch(html,/undefined|NaN|\[object Object\]/);}
  const catalog=window.OntologyCatalog.page();assert.match(catalog,/data-relationship-map="catalog-map"/);assert.match(catalog,/data-map-node="symptom"/);
});

test('a drag frame updates its node and paths before release, and Escape restores that visible state',()=>{
  const value=surface();value.run('let pendingMapFrame; requestAnimationFrame=callback=>{pendingMapFrame=callback;return 7;}; cancelAnimationFrame=()=>{pendingMapFrame=null;};');
  const target=value.nodes[0];const before=value.base.nodes[0];value.emit('pointerdown',target,{button:0,pointerId:2,clientX:100,clientY:100});value.emit('pointermove',target,{pointerId:2,clientX:120,clientY:110});
  value.run('pendingMapFrame();');assert.equal(target.style.left,before.x+20+'px');assert.ok(value.edges.some(edge=>edge.querySelector().d));assert.equal(target.classList.contains('is-dragging'),true);
  value.emit('keydown',target,{key:'Escape'});assert.equal(target.style.left,before.x+'px');assert.equal(target.classList.contains('is-dragging'),false);
});
test('star drag positions are restored after explicitly recentering and returning',()=>{
  const value=surface();const model=value.window.OrbitOntology.data();const original=value.base.nodes[0];value.drag(original.id,24,12);const saved=plain(bounds(value.current()));
  const star=value.window.OrbitStar;star.interact('center','rule-check',value.state,model);star.diagram(model,value.state,value.prefix);star.interact('back','',value.state,model);star.diagram(model,value.state,value.prefix);
  assert.deepEqual(plain(bounds(value.current())),saved);
  function bounds(layout){return layout.nodes.map(({id,x,y})=>({id,x,y}));}
});

test('branch mode moves only displayed one-hop neighbors with preserved offsets and zoom',()=>{
  const value=surface('star',.8,true);const original=plain(value.current());const node=original.nodes.find(entry=>entry.id==='alias-dark');const snapshot=JSON.stringify(value.window.ProjectStudio.data());
  value.setMode('branch');assert.equal(value.state.dragMode,'branch');assert.match(value.status.textContent,/直接相连/);
  value.drag(node.id,16,-8);const moving=new Set([node.id,...original.links.filter(link=>link.source===node.id||link.target===node.id).flatMap(link=>[link.source,link.target])]);
  for(const previous of original.nodes){const next=value.current().nodes.find(entry=>entry.id===previous.id);assert.equal(next.x,previous.x+(moving.has(previous.id)?20:0),previous.id);assert.equal(next.y,previous.y+(moving.has(previous.id)?-10:0),previous.id);}
  assert.equal(moving.size,2);assert.match(value.status.textContent,/已移动 2 项/);assert.equal(JSON.stringify(value.window.ProjectStudio.data()),snapshot);assert.equal(value.calls.length,0);
  value.switchProject('RETAIL');assert.notEqual(value.window.OrbitBusiness.view().dragMode,'branch');value.switchProject('AFTERSALES');assert.equal(value.window.OrbitBusiness.view().dragMode,'branch');
});
test('branch cancellation restores every member, including previously placed nodes, and removes drag feedback',()=>{
  for(const end of ['Escape','pointercancel','lostpointercapture']){
    const value=surface();value.drag('alias-dark',12,6);const original=plain(value.current().nodes);value.setMode('branch');
    value.drag('symptom',100,80,end);assert.deepEqual(plain(value.current().nodes),original);assert.ok(value.nodes.every(node=>!node.classList.contains('is-dragging')));assert.match(value.status.textContent,/已取消移动/);
  }
});
test('branch clamping keeps relative positions at boundaries and expands the canvas when needed',()=>{
  const value=surface();value.setMode('branch');const original=value.current();value.drag('symptom',-10000,-10000);const current=value.current();
  assert.equal(Math.min(...current.nodes.map(node=>node.x)),24);assert.equal(Math.min(...current.nodes.map(node=>node.y)),76);
  const offset={x:current.nodes[0].x-original.nodes[0].x,y:current.nodes[0].y-original.nodes[0].y};
  for(const previous of original.nodes){const next=current.nodes.find(node=>node.id===previous.id);assert.equal(next.x-previous.x,offset.x);assert.equal(next.y-previous.y,offset.y);}
  value.drag('symptom',1200,1200);const expanded=value.current();assert.ok(expanded.width>original.width&&expanded.height>original.height);assert.ok(expanded.nodes.every(node=>node.x+node.width<=expanded.width&&node.y+node.height<=expanded.height));
});
test('branch settling avoids fixed nodes without changing internal offsets',()=>{
  const value=surface();const nodes=[{id:'one',x:300,y:100,width:100,height:60},{id:'two',x:430,y:180,width:100,height:80},{id:'fixed',x:350,y:110,width:100,height:140}];const original=plain(nodes);
  const placed=value.map.settleBranch(nodes.slice(0,2),nodes);assert.equal(placed[1].x-placed[0].x,130);assert.equal(placed[1].y-placed[0].y,80);
  for(const node of placed){const fixed=nodes[2];assert.ok(node.x+node.width+16<=fixed.x||node.x>=fixed.x+fixed.width+16||node.y+node.height+16<=fixed.y||node.y>=fixed.y+fixed.height+16);assert.ok(node.x>=24&&node.y>=76);}
  assert.deepEqual(nodes,original);
});
test('branch keyboard movement and switching back to single share the same safe view behavior',()=>{
  const value=surface();const before=plain(value.current().nodes);value.setMode('branch');value.emit('keydown',value.nodes[0],{key:'ArrowRight'});
  assert.ok(value.current().nodes.every((node,index)=>node.x===before[index].x+12));value.setMode('single');const branch=plain(value.current().nodes);value.drag('symptom',18,0);assert.ok(value.current().nodes.slice(1).every((node,index)=>node.x===branch[index+1].x));
  value.setMode('invalid');assert.equal(value.state.dragMode,'single');
  const cards=surface('cards');cards.setMode('branch');assert.notEqual(cards.state.dragMode,'branch');
});
test('hiding or rerendering the page cancels a live branch drag and clears every pending position',()=>{
  for(const operation of ['capture','hidden','mode']){
    const value=surface();value.setMode('branch');const before=plain(value.current().nodes);const target=value.nodes[0];
    value.emit('pointerdown',target,{button:0,pointerId:11,clientX:0,clientY:0});value.emit('pointermove',target,{pointerId:11,clientX:30,clientY:40});assert.ok(value.nodes.every(node=>node.classList.contains('is-dragging')));assert.match(value.status.textContent,/关联分支跟随中/);assert.equal(value.feedback.hidden,false);assert.match(value.feedback.textContent,/Esc 取消/);
    if(operation==='capture')value.map.capture();if(operation==='hidden'){value.document.hidden=true;value.emit('visibilitychange',value.document);}if(operation==='mode')value.setMode('single');
    assert.deepEqual(plain(value.current().nodes),before);assert.ok(value.nodes.every(node=>!node.classList.contains('is-dragging')));assert.equal(value.feedback.hidden,true);
  }
});
