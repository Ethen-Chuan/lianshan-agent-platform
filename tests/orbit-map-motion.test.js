const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fixture}=require('./helpers/orbit-designer-fixture');
const plain=value=>JSON.parse(JSON.stringify(value));
function surface({reducedMotion=false}={}){
  const value=fixture({business:true,reducedMotion});const {window,document,run}=value;
  run(`let motionClock=0;let motionCounter=0;const motionFrames=new Map();performance={now:()=>motionClock};requestAnimationFrame=callback=>{motionFrames.set(++motionCounter,callback);return motionCounter;};cancelAnimationFrame=identifier=>motionFrames.delete(identifier);window.motionStep=duration=>{motionClock+=duration;const callbacks=[...motionFrames.values()];motionFrames.clear();callbacks.forEach(callback=>callback(motionClock));};window.motionPending=()=>motionFrames.size;`);
  const state=window.OrbitBusiness.view();state.zoom=1;let current=null;
  function element(dataset={},initial=[]){const classes=new Set(initial);return {dataset,style:{},disabled:false,isConnected:true,classList:{add(...values){values.forEach(entry=>classes.add(entry));},remove(...values){values.forEach(entry=>classes.delete(entry));},contains:entry=>classes.has(entry)},setAttribute(name,result){this[name]=result;},querySelector:()=>null,querySelectorAll:()=>[],focus(){document.activeElement=this;},setPointerCapture(){},hasPointerCapture:()=>false};}
  function render({prefix='od-business',model=window.OrbitOntology.data(),selected=state.focusId,pan=null}={}){
    window.OrbitMap.capture();if(current)current.viewport.isConnected=false;
    const base=window.OrbitStar.layout(model,state);state.centerId=base.centerId;const key='star:'+base.centerId+':'+!!state.showAll;const layout=window.OrbitMap.bind(prefix,base,state,key);
    const root=element({relationshipMap:prefix,obMode:'star'});const viewport=element();Object.assign(viewport,{clientWidth:1000,clientHeight:650,scrollLeft:pan?.left||0,scrollTop:pan?.top||0,scrollTo(left,top){this.scrollLeft=left;this.scrollTop=top;}});
    const stage=element({width:layout.width,height:layout.height});stage.parentElement=element();const svg=element();const readout=element();const status=element();
    const emphasis=window.OrbitStar.emphasis(layout,{...state,focusId:selected});const selectId=emphasis.selected?.id;const activeLinks=emphasis.relatedLinks;const activeNodes=emphasis.relatedNodes;
    const nodes=layout.nodes.map(node=>{const item=element({mapNode:node.id,id:node.id,action:prefix+'-select'},[...(activeNodes.has(node.id)?[]:['is-muted']),...(selectId===node.id?['is-selected']:[])]);item.title=element();item.halo=element();item.querySelector=selector=>selector==='strong'?item.title:selector==='[data-star-halo]'?item.halo:null;item.closest=selector=>selector==='[data-map-node]'?item:selector==='[data-map-viewport]'?viewport:selector==='[data-relationship-map]'?root:null;return item;});
    const edges=layout.links.map(link=>{const item=element({mapEdge:link.id},activeLinks.has(link.id)?[]:['is-muted']);item.path=element();item.signal=element();item.querySelector=selector=>selector==='path'?item.path:selector==='[data-map-signal]'?item.signal:null;return item;});
    const labels=layout.links.map(link=>{const item=element({mapLabel:link.id,mapVisible:String(activeLinks.has(link.id)),mapSummary:String(emphasis.summary)});item.hidden=!link.labelPosition||!activeLinks.has(link.id)||emphasis.summary&&!!link.summaryGroupId;return item;});
    const groups=layout.groups.map(group=>{const item=element({mapGroup:group.id},group.nodeIds.some(identifier=>activeNodes.has(identifier))?[]:['is-muted']);item.hidden=group.hidden;return item;});
    const controls=Object.fromEntries(['motion','replay','in','out','fit','reset'].map(name=>{const item=element({mapControl:name});item.closest=selector=>selector==='[data-map-control]'?item:selector==='[data-relationship-map]'?root:null;return [name,item];}));
    stage.querySelector=selector=>selector==='svg'?svg:null;stage.querySelectorAll=selector=>selector==='[data-map-node]'?nodes:selector==='[data-map-edge]'?edges:selector==='[data-map-label]'?labels:selector==='[data-map-group]'?groups:[];
    viewport.querySelector=selector=>selector==='[data-map-stage]'?stage:null;viewport.closest=selector=>selector==='[data-map-viewport]'?viewport:selector==='[data-relationship-map]'?root:null;
    root.querySelector=selector=>selector==='[data-map-viewport]'?viewport:selector==='[data-map-zoom]'?readout:selector==='[data-map-status]'?status:controls[selector.match(/data-map-control="([^"]+)"/)?.[1]]||null;
    document.querySelector=selector=>selector.includes('[data-map-viewport]')?viewport:null;document.querySelectorAll=selector=>selector==='[data-map-viewport]'?[viewport]:[];
    current={root,viewport,stage,nodes,edges,labels,groups,layout,controls,key,prefix,model};window.OrbitMap.mount();return current;
  }
  const step=duration=>window.motionStep(duration);const pending=()=>window.motionPending();
  return {...value,state,render,step,pending,get current(){return current;}};
}
test('entry is staggered, moves real nodes and connectors together, and settles within 380ms',()=>{
  const value=surface();const map=value.render();const snapshot=JSON.stringify(value.window.ProjectStudio.data());const line=map.edges[0];const before=line.path.d;
  assert.equal(map.root.dataset.mapMotion,'on');assert.equal(value.pending(),1);assert.equal(map.nodes[0].style.opacity,'0');assert.notEqual(map.nodes[0].style.transform,'');
  value.step(50);assert.ok(Number(map.nodes[0].style.opacity)>Number(map.nodes.at(-1).style.opacity));assert.notEqual(line.path.d,before);
  value.step(330);assert.equal(value.pending(),0);assert.equal(line.path.d,map.layout.links[0].path);assert.equal(map.nodes[0].style.transform,'');assert.equal(map.nodes[0].style.opacity,'');assert.equal(map.nodes[0].halo.style.opacity,'');assert.equal(map.root.classList.contains('is-map-animating'),false);assert.equal(JSON.stringify(value.window.ProjectStudio.data()),snapshot);assert.equal(value.calls.length,0);
});
test('unrelated rerenders do not replay animation and selecting only animates emphasis',()=>{
  const value=surface();value.render();value.step(400);const stable=value.render();assert.equal(value.pending(),0);
  value.state.focusId='rule-check';const selected=value.render();assert.equal(value.pending(),1);assert.ok(selected.nodes.every(node=>!node.style.transform));
  const target=selected.nodes.find(node=>node.dataset.id==='rule-check');assert.match(target.title.style.transform,/translateY/);assert.equal(selected.edges[0].path.d,selected.layout.links[0].path);
  value.step(200);assert.equal(target.title.style.transform,'');assert.equal(value.pending(),0);assert.deepEqual(plain(selected.layout.nodes.map(({id,x,y})=>({id,x,y}))),plain(stable.layout.nodes.map(({id,x,y})=>({id,x,y}))));
});
test('recenter uses prior screen coordinates, including old zoom after state changes',()=>{
  const value=surface();value.state.zoom=.8;value.render({pan:{left:24,top:16}});value.step(400);
  value.window.OrbitStar.interact('center','rule-check',value.state,value.window.OrbitOntology.data());assert.equal(value.state.zoom,null);
  const next=value.render();assert.equal(value.pending(),1);const node=next.nodes.find(entry=>entry.dataset.id==='rule-check');assert.match(node.style.transform,/scale\(/);assert.notEqual(node.style.transform,'translate(0px,0px) scale(1,1)');value.step(400);assert.equal(node.style.transform,'');
  const starts=value.window.OrbitMapMotion.starts({zoom:.8,left:24,top:16,layout:{nodes:[{id:'node',x:200,y:100,width:100,height:80}]}},{zoom:1,left:0,top:0,layout:{nodes:[{id:'node',x:400,y:200,width:150,height:100}]}});
  assert.deepEqual(plain(starts[0]),{id:'node',x:136,y:64,width:80,height:64});
});
test('path expansion animates bounded geometry and restores exact curves and hidden labels',()=>{
  const value=surface();value.render();value.step(400);const model=value.window.OrbitOntology.data();const path=value.window.OrbitStar.trails(model,'symptom').find(entry=>entry.targetId==='verify');value.window.OrbitStar.interact('trail',path.id,value.state,model);
  const map=value.render();const node=map.nodes.find(entry=>entry.dataset.id==='verify');assert.equal(node.style.opacity,'0');value.step(190);
  assert.ok(Number(node.style.opacity)>0&&Number(node.style.opacity)<=1);assert.ok(map.edges.every(edge=>!edge.path.d.includes('NaN')));
  value.step(190);assert.ok(map.edges.every(edge=>edge.path.d===map.layout.links.find(link=>link.id===edge.dataset.mapEdge).path));assert.ok(map.labels.every(label=>{const link=map.layout.links.find(link=>link.id===label.dataset.mapLabel);return label.hidden===(!link.labelPosition||label.dataset.mapVisible==='false'||label.dataset.mapSummary==='true'&&!!link.summaryGroupId);}));
});
test('pointer movement interrupts animation permanently and leaves drag coordinates editable',()=>{
  const value=surface();const map=value.render();value.step(100);const target=map.nodes[0];const before=map.layout.nodes[0];
  value.emit('pointerdown',target,{button:0,pointerId:9,clientX:200,clientY:200});assert.equal(value.pending(),0);assert.equal(target.style.transform,'');
  value.emit('pointermove',target,{pointerId:9,clientX:224,clientY:212});value.step(16);value.emit('pointerup',target,{pointerId:9});
  assert.equal(target.style.left,before.x+24+'px');assert.equal(target.style.top,before.y+12+'px');value.step(500);assert.equal(target.style.left,before.x+24+'px');assert.equal(value.pending(),0);
});
test('zoom and keyboard gestures interrupt transition without a stale frame restoring the old state',()=>{
  for(const control of ['in','fit','ArrowRight']){
    const value=surface();const map=value.render();value.step(60);
    if(control==='ArrowRight')value.emit('keydown',map.nodes[0],{key:control});else value.emit('click',map.controls[control]);
    assert.equal(value.pending(),0);const transform=map.stage.style.transform;const position=map.nodes[0].style.left;value.step(500);assert.equal(map.stage.style.transform,transform);assert.equal(map.nodes[0].style.left,position);
  }
});
test('motion toggle and replay change no business state or layout and do not trigger model requests',()=>{
  const value=surface();const map=value.render();const original=JSON.stringify(value.window.ProjectStudio.data());const layout=JSON.stringify(map.layout);
  value.emit('click',map.controls.motion);assert.equal(value.pending(),0);assert.equal(value.state.motionEnabled,false);assert.equal(map.root.dataset.mapMotion,'off');assert.equal(map.controls.replay.disabled,true);
  value.emit('click',map.controls.replay);assert.equal(value.pending(),0);value.emit('click',map.controls.motion);assert.equal(map.root.dataset.mapMotion,'on');assert.equal(value.pending(),1);value.step(400);
  value.emit('click',map.controls.replay);assert.equal(value.pending(),1);value.step(400);assert.equal(JSON.stringify(value.window.ProjectStudio.data()),original);assert.equal(JSON.stringify(map.layout),layout);assert.equal(value.calls.length,0);
});
test('reduced motion is respected on load and changing system preference cancels pending frames',()=>{
  for(const initiallyReduced of [false,true]){
    const value=surface({reducedMotion:initiallyReduced});const map=value.render();if(!initiallyReduced){assert.equal(value.pending(),1);value.setReducedMotion(true);}
    assert.equal(value.pending(),0);assert.equal(map.root.dataset.mapMotion,'off');assert.equal(map.controls.motion.disabled,true);assert.equal(map.controls.replay.disabled,true);assert.ok(map.nodes.every(node=>!node.style.transform));value.step(500);assert.equal(value.pending(),0);
    value.setReducedMotion(false);assert.equal(map.controls.motion.disabled,false);assert.equal(value.pending(),0);
  }
});
test('leaving the view or hiding the document cancels transitions and resets temporary styles',()=>{
  for(const action of ['capture','hidden','disconnect']){
    const value=surface();const map=value.render();value.step(70);
    if(action==='capture')value.window.OrbitMap.capture();if(action==='hidden'){value.document.hidden=true;value.emit('visibilitychange',value.document);}if(action==='disconnect'){map.viewport.isConnected=false;value.step(16);}
    assert.equal(value.pending(),0);assert.ok(map.nodes.every(node=>!node.style.transform));assert.equal(map.root.classList.contains('is-map-animating'),false);
  }
});
test('dense maps fall back to a short fade instead of morphing a large number of paths',()=>{
  const value=surface();const model={nodes:Array.from({length:20},(_,index)=>({id:'node-'+index,type:'object',name:'对象 '+index})),links:Array.from({length:19},(_,index)=>({id:'link-'+index,source:'node-0',target:'node-'+(index+1),label:'关联'}))};value.state.showAll=true;
  const map=value.render({model});assert.equal(value.pending(),1);assert.ok(map.nodes.every(node=>!node.style.transform));assert.ok(map.edges.every(edge=>edge.path.d===map.layout.links.find(link=>link.id===edge.dataset.mapEdge).path));value.step(400);assert.equal(value.pending(),0);
});
test('classification frames animate with their members and selection does not move a group',()=>{
  const value=surface();const map=value.render();const aliases=map.groups.find(group=>group.dataset.mapGroup==='alias');assert.equal(aliases.style.opacity,'0');assert.match(aliases.style.transform,/translate/);
  value.step(380);assert.equal(aliases.style.opacity,'');assert.equal(aliases.style.transform,'');
  value.window.OrbitStar.interact('group','alias',value.state,value.window.OrbitOntology.data());const selected=value.render();assert.ok(selected.groups.every(group=>!group.style.transform));assert.ok(selected.labels.filter(label=>selected.layout.links.find(link=>link.id===label.dataset.mapLabel)?.summaryGroupId==='alias').every(label=>label.hidden));
  value.step(200);assert.equal(value.pending(),0);assert.ok(selected.groups.every(group=>!group.style.transform&&!group.style.opacity));
});
test('returning from a hidden tab restores the motion controls without automatically replaying',()=>{
  const value=surface();value.document.hidden=true;const map=value.render();assert.equal(map.root.dataset.mapMotion,'off');assert.equal(value.pending(),0);
  value.document.hidden=false;value.emit('visibilitychange',value.document);assert.equal(map.root.dataset.mapMotion,'on');assert.equal(map.controls.replay.disabled,false);assert.equal(value.pending(),0);
  value.emit('click',map.controls.replay);value.step(70);value.document.hidden=true;value.emit('visibilitychange',value.document);assert.equal(value.pending(),0);assert.equal(map.root.dataset.mapMotion,'off');assert.ok(map.groups.every(group=>!group.style.transform));
});
test('free dragging updates the category frame and restores per-edge labels if members no longer fit together',()=>{
  const value=surface();const map=value.render();value.step(380);const target=map.nodes.find(node=>node.dataset.id==='alias-dark');const aliases=map.groups.find(group=>group.dataset.mapGroup==='alias');
  value.emit('pointerdown',target,{button:0,pointerId:21,clientX:200,clientY:200});value.emit('pointermove',target,{pointerId:21,clientX:480,clientY:150});value.step(16);
  assert.equal(aliases.hidden,true);assert.equal(target.dataset.grouped,'false');const label=map.labels.find(entry=>entry.dataset.mapLabel==='relation-0');assert.equal(label.hidden,false);
  value.emit('keydown',target,{key:'Escape'});assert.equal(aliases.hidden,false);assert.equal(target.dataset.grouped,'true');assert.equal(label.hidden,true);
});
test('motion UI is accessible and both entry points keep numbers, non-execution labels and reduction styles',()=>{
  const value=surface();const model=value.window.OrbitOntology.data();
  for(const prefix of ['od-business','catalog-star']){const html=value.window.OrbitStar.diagram(model,value.state,prefix);assert.match(html,/data-map-control="motion" aria-pressed="true"/);assert.match(html,/重播图谱入场动效/);assert.match(html,/data-star-halo aria-hidden="true"/);assert.match(html,/已定义关系 · 非执行记录/);assert.match(html,/<b>01<\/b>/);}
  const css=fs.readFileSync(path.join(__dirname,'../app/orbit-constellation.css'),'utf8');assert.match(css,/data-map-motion=off/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/forced-colors:active/);assert.doesNotMatch(css,/animation:[^;}]*infinite/);
});
test('finite light accents follow interpolated real paths, never animate hypotheses and clean up on cancellation',()=>{
  const value=surface();const map=value.render();value.step(190);
  const edge=map.edges[0];const point=edge.path.d.split(' ')[16].slice(1).split(',').map(Number);const signal=edge.signal.style.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/);
  assert.ok(Number(edge.signal.style.opacity)>0);assert.ok(Math.abs(Number(signal[1])-point[0])<.01);assert.ok(Math.abs(Number(signal[2])-point[1])<.01);
  const candidate=map.edges.find(entry=>map.layout.links.find(link=>link.id===entry.dataset.mapEdge).label==='原因假设');assert.equal(candidate.signal.style.transform,undefined);
  value.window.OrbitMap.capture();assert.ok(map.edges.every(entry=>!entry.signal.style.opacity&&!entry.signal.style.transform));assert.equal(value.pending(),0);
  value.state.focusId='rule-check';const selected=value.render();value.step(100);assert.ok(selected.edges.filter(entry=>entry.classList.contains('is-muted')).every(entry=>!entry.signal.style.transform));value.step(100);assert.equal(value.pending(),0);assert.ok(selected.edges.every(entry=>!entry.signal.style.opacity&&!entry.signal.style.transform));
});
test('reduced motion and dense maps never start relation light accents',()=>{
  const reduced=surface({reducedMotion:true});const staticMap=reduced.render();reduced.step(190);assert.ok(staticMap.edges.every(entry=>!entry.signal.style.transform));
  const dense=surface();dense.state.showAll=true;const model={nodes:Array.from({length:20},(_,index)=>({id:'node-'+index,type:'object',name:'对象 '+index})),links:Array.from({length:19},(_,index)=>({id:'link-'+index,source:'node-0',target:'node-'+(index+1),label:'关联'}))};const map=dense.render({model});dense.step(190);assert.ok(map.edges.every(entry=>!entry.signal.style.transform));dense.step(190);assert.equal(dense.pending(),0);
});
