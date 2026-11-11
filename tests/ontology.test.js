const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function fixture(){
  const workspaces=new Map();let projectId='AFTERSALES';
  const window={PortfolioHub:{navProject:()=>({id:projectId}),persist(){}},ProjectStudio:{data(){if(!workspaces.has(projectId))workspaces.set(projectId,{});return workspaces.get(projectId);}}};
  const context=vm.createContext({window,structuredClone});
  for(const filename of ['ontology-graph.js','ontology-atlas.js'])vm.runInContext(filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8'),context);
  return {atlas:window.OrbitOntology,graph:window.OrbitAtlasGraph,switchProject:identifier=>{projectId=identifier;}};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('default mainline hides auxiliaries without deleting or reversing any relation',()=>{
  const {atlas}=fixture();const model=atlas.data();const snapshot=JSON.stringify(model);
  assert.equal(atlas.view().mode,'flow');assert.equal(atlas.visible().nodes.length,8);assert.equal(atlas.visible().links.length,8);
  for(const identifier of ['alias-dark','alias-off','board','device'])assert.ok(!atlas.visible().nodes.some(node=>node.id===identifier));
  assert.ok(atlas.visible().nodes.some(node=>node.id==='escalate'));
  atlas.view().scope='complete';assert.equal(atlas.visible().nodes.length,12);assert.equal(atlas.visible().links.length,12);
  assert.equal(JSON.stringify(model),snapshot);
  assert.ok(model.links.some(link=>link.source==='board'&&link.target==='symptom'&&link.label==='原因假设'));
});

test('progressive exploration only shows connected endpoints in the current scope',()=>{
  const {atlas}=fixture();atlas.view().progressive=true;
  assert.equal(atlas.visible().nodes.length,3);
  atlas.view().expanded.add('rule-check');assert.equal(atlas.visible().nodes.length,5);
  const identifiers=new Set(atlas.visible().nodes.map(node=>node.id));
  assert.ok(atlas.visible().links.every(link=>identifiers.has(link.source)&&identifiers.has(link.target)));
  atlas.view().progressive=false;assert.equal(atlas.visible().nodes.length,8);
});

test('relationship exploration differs from the flow at narrow widths and centers the selected node',()=>{
  const {atlas,graph}=fixture();const model=atlas.data();
  for(const width of [342,760,1200]){
    Object.assign(atlas.view(),{mode:'flow',local:false,selected:'draft',positions:{}});
    let dimensions=graph.dimensions(model,atlas.view(),width);const flow=graph.layout(model,atlas.view(),width,dimensions.height);
    Object.assign(atlas.view(),{mode:'star',local:true});dimensions=graph.dimensions(model,atlas.view(),width);const explore=graph.layout(model,atlas.view(),width,dimensions.height);
    assert.notDeepEqual(plain(explore.draft),plain(flow.draft));assert.equal(explore.draft.x,width/2);
    for(const node of atlas.visible().nodes)assert.ok(Number.isFinite(explore[node.id].x)&&Number.isFinite(explore[node.id].y));
    if(width>=540)assert.equal(explore.draft.y,dimensions.height/2);
    atlas.view().selected='verify';const next=graph.layout(model,atlas.view(),width,dimensions.height);assert.equal(next.verify.x,width/2);
  }
});

test('semantic edge styles preserve uncertainty, prohibition, evidence and handoff',()=>{
  const {graph}=fixture();
  for(const [label,kind] of [['原因假设','candidate'],['约束','boundary'],['限制动作','boundary'],['提供依据','evidence'],['提交核对','human'],['执行','rule'],['同义表达','context']])assert.equal(graph.relation({label}),kind);
  assert.ok(graph.palette.candidate.dash.length);assert.ok(graph.palette.boundary.dash.length);
  assert.notEqual(graph.palette.candidate.color,graph.palette.boundary.color);
});

test('mainline layouts are stable, bounded, and do not overlap nodes on desktop or mobile',()=>{
  const {atlas,graph}=fixture();const model=atlas.data();const snapshot=JSON.stringify(model);
  for(const width of [1266,1090,984,820,680,342,300]){
    const {height}=graph.dimensions(model,atlas.view(),width);
    const positions=graph.layout(model,atlas.view(),width,height);const visible=atlas.visible().nodes;
    for(const node of visible){const position=positions[node.id];assert.ok(position.x>=graph.nodeSize.width/2&&position.x<=width-graph.nodeSize.width/2,node.id);assert.ok(position.y>=graph.nodeSize.height/2&&position.y<=height-graph.nodeSize.height/2,node.id);}
    for(let first=0;first<visible.length;first++)for(let second=first+1;second<visible.length;second++){
      const left=positions[visible[first].id];const right=positions[visible[second].id];assert.ok(graph.separated(left,right),`${width}: ${visible[first].id} / ${visible[second].id}`);
    }
    assert.deepEqual(plain(graph.layout(model,atlas.view(),width,height)),plain(positions));
  }
  assert.equal(JSON.stringify(model),snapshot);
});

test('curved paths retain source-to-target ordering and finite coordinates',()=>{
  const {graph}=fixture();
  for(const [source,target] of [[{x:80,y:180},{x:430,y:80}],[{x:450,y:210},{x:80,y:120}],[{x:210,y:80},{x:210,y:300}]]){
    const curve=graph.curve(source,target);assert.deepEqual(plain(graph.point(curve,0)),plain(curve[0]));assert.deepEqual(plain(graph.point(curve,1)),plain(curve[3]));assert.ok(curve.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));assert.match(graph.path(curve),/^M.+ C/);
  }
});

test('action binding includes real rules and fields but never candidate cause facts',()=>{
  const {atlas}=fixture();const binding=atlas.configFromAction('draft');
  assert.equal(binding.ontologyBinding.revision,1);
  assert.equal(binding.fields.split(',').length,4);
  assert.equal(binding.ontologyBinding.ruleNames.length,3);
  assert.match(binding.transferWords,/直接更换/);assert.match(binding.transferWords,/起火/);
  assert.ok(!binding.ontologyBinding.nodes.some(node=>node.id==='board'));
  assert.ok(!binding.ontologyBinding.links.some(link=>link.label==='原因假设'));
  assert.throws(()=>atlas.configFromAction('board'),/请选择业务动作/);
});

test('layout, scope and current edits never rewrite an existing configuration snapshot',()=>{
  const {atlas,graph}=fixture();const binding=atlas.configFromAction('draft');const snapshot=JSON.stringify(binding);
  atlas.view().scope='complete';atlas.view().mode='star';graph.layout(atlas.data(),atlas.view(),984,372);
  atlas.data().nodes.find(node=>node.id==='rule-check').fields+=',检修记录';atlas.data().revision++;
  assert.match(atlas.configFromAction('draft').fields,/检修记录/);assert.equal(JSON.stringify(binding),snapshot);
});

test('projects isolate ontology content, view settings and assistant binding',()=>{
  const {atlas,switchProject}=fixture();atlas.data().revision=3;atlas.view().scope='complete';
  switchProject('RETAIL');assert.equal(atlas.data().revision,1);assert.equal(atlas.view().scope,'mainline');assert.equal(atlas.data().nodes[0].name,'业务事项');assert.equal(atlas.configFromAction('draft').ontologyBinding.projectId,'RETAIL');
  switchProject('AFTERSALES');assert.equal(atlas.data().revision,3);assert.equal(atlas.view().scope,'complete');
});

test('all default routes avoid unrelated nodes in both scopes and responsive layouts',()=>{
  const {atlas,graph}=fixture();const model=atlas.data();
  for(const width of [342,638,984,1090,1266])for(const scope of ['mainline','complete'])for(const mode of ['flow','star']){
    atlas.view().scope=scope;atlas.view().mode=mode;const actualHeight=graph.dimensions(model,atlas.view(),width).height;const positions=graph.layout(model,atlas.view(),width,actualHeight);const shown=atlas.visible();const obstacles=shown.nodes.map(node=>({...positions[node.id],id:node.id}));
    for(const link of shown.links){
      const curve=graph.route({...positions[link.source],id:link.source},{...positions[link.target],id:link.target},obstacles,width,actualHeight);
      for(let sample=1;sample<80;sample++){
        const position=graph.point(curve,sample/80);
        for(const obstacle of obstacles)if(![link.source,link.target].includes(obstacle.id))assert.ok(Math.abs(position.x-obstacle.x)>=graph.nodeSize.width/2||Math.abs(position.y-obstacle.y)>=graph.nodeSize.height/2,`${width}/${scope}/${mode}: ${link.id} crosses ${obstacle.id}`);
      }
    }
  }
});

test('mainline positions stay fixed when auxiliary definitions are revealed',()=>{
  const {atlas,graph}=fixture();const model=atlas.data();
  for(const width of [300,342,638,984,1090,1266]){
    atlas.view().scope='mainline';const identifiers=atlas.visible().nodes.map(node=>node.id);const before=graph.layout(model,atlas.view(),width,graph.dimensions(model,atlas.view(),width).height);
    atlas.view().scope='complete';const after=graph.layout(model,atlas.view(),width,graph.dimensions(model,atlas.view(),width).height);
    for(const identifier of identifiers)assert.deepEqual(plain(after[identifier]),plain(before[identifier]),`${width}/${identifier}`);
  }
});

test('local exploration preserves scope and only shows the selected node and direct neighbors',()=>{
  const {atlas}=fixture();atlas.view().local=true;atlas.view().selected='draft';
  assert.deepEqual(atlas.visible().nodes.map(node=>node.id).sort().join(','),'draft,human,rule-replace,verify');assert.equal(atlas.data().nodes.length,12);
  atlas.view().local=false;assert.equal(atlas.visible().nodes.length,8);
});

test('dragging singles and branches protects clearance and does not move unrelated nodes',()=>{
  const {atlas,graph}=fixture();const model=atlas.data();const snapshot=JSON.stringify(model);
  for(const width of [342,638,984,1090,1266])for(const scope of ['mainline','complete']){
    atlas.view().scope=scope;const {height}=graph.dimensions(model,atlas.view(),width);const nodes=atlas.visible().nodes;const initial=graph.layout(model,atlas.view(),width,height);
    for(const identifiers of [new Set(['symptom']),new Set(['verify','rule-check','draft'])])for(const delta of [{x:0,y:144},{x:300,y:300},{x:-500,y:-300},{x:900,y:1600}]){
      const moved=graph.move(nodes,initial,identifiers,delta,width,height).positions;
      for(let first=0;first<nodes.length;first++){
        const position=moved[nodes[first].id];assert.ok(position.x>=graph.nodeSize.width/2&&position.x<=width-graph.nodeSize.width/2);assert.ok(position.y>=graph.nodeSize.height/2&&position.y<=height-graph.nodeSize.height/2);
        if(!identifiers.has(nodes[first].id))assert.deepEqual(plain(position),plain(initial[nodes[first].id]));
        for(let second=first+1;second<nodes.length;second++)assert.ok(graph.separated(position,moved[nodes[second].id]),`${width}/${scope}/${nodes[first].id}/${nodes[second].id}`);
      }
      if(identifiers.size>1)assert.equal(Math.round(moved.verify.x-moved.draft.x),Math.round(initial.verify.x-initial.draft.x));
    }
  }
  assert.equal(JSON.stringify(model),snapshot);
});

test('saved overlapping layout positions are separated without changing the ontology',()=>{
  const {atlas,graph}=fixture();const model=atlas.data();const snapshot=JSON.stringify(model);atlas.view().scope='complete';
  for(const width of [342,638,1090]){
    const {height}=graph.dimensions(model,atlas.view(),width);
    for(const node of model.nodes)atlas.view().positions[graph.positionKey(atlas.view(),width,node.id)]=[.5,.5];
    const positions=graph.layout(model,atlas.view(),width,height);
    for(let first=0;first<model.nodes.length;first++)for(let second=first+1;second<model.nodes.length;second++)assert.ok(graph.separated(positions[model.nodes[first].id],positions[model.nodes[second].id]),`${width}/${first}/${second}`);
  }
  assert.equal(JSON.stringify(model),snapshot);
});
