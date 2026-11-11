const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/orbit-designer-fixture');
const plain=value=>JSON.parse(JSON.stringify(value));
const coordinates=layout=>layout.nodes.map(node=>[node.id,node.x,node.y,node.width,node.height]);
const segments=link=>link.points.slice(1).map((end,index)=>({start:link.points[index],end}));
const between=(value,start,end)=>value>Math.min(start,end)&&value<Math.max(start,end);
const onSegment=(point,start,end)=>start.x===end.x?point.x===start.x&&point.y>=Math.min(start.y,end.y)&&point.y<=Math.max(start.y,end.y):point.y===start.y&&point.x>=Math.min(start.x,end.x)&&point.x<=Math.max(start.x,end.x);

test('shared definitions open with one relationship map and keep editing inline',()=>{
  const {window}=fixture();const catalog=window.OntologyCatalog;const page=catalog.page();
  assert.equal(catalog.view().presentation,'graph');assert.match(page,/id="og-viewport"/);assert.match(page,/data-action="catalog-map-select"/);assert.match(page,/data-action="catalog-edge"/);
  assert.doesNotMatch(page,/id="ontology-original-graph"/);
  assert.doesNotMatch(page,/id="ontology-canvas"|\[object Object\]/);
  for(const label of ['对象与依据','处理规则','业务动作','人工确认','关系清单','尚未影响任何助手','字段与动作'])assert.ok(page.includes(label),label);
  assert.equal(catalog.mapData().nodes.length,8);assert.equal(catalog.mapData().links.length,8);
});

test('core and complete graphs retain exact directed definitions and never mutate stored positions or business data',()=>{
  const {window}=fixture();const model=window.OrbitOntology.data();const original=JSON.stringify(model);const graph=window.OrbitAtlasGraph;
  for(const scope of ['business','complete']){
    const layout=graph.catalogLayout(model,scope);assert.deepEqual(plain(coordinates(graph.catalogLayout(model,scope))),plain(coordinates(layout)));
    for(const link of layout.links){const source=model.links.find(entry=>entry.id===link.id);assert.equal(link.source,source.source);assert.equal(link.target,source.target);assert.equal(link.label,source.label);}
    assert.ok(layout.nodes.every(node=>model.nodes.some(entry=>entry.id===node.id)));
  }
  const complete=graph.catalogLayout(model,'complete');assert.equal(complete.nodes.length,model.nodes.length);assert.equal(complete.links.length,model.links.length);assert.equal(complete.links.find(link=>link.label==='原因假设').kind,'candidate');
  assert.equal(JSON.stringify(model),original);
});

test('core graph branches have no crossing lines and all relationship labels sit on their actual paths',()=>{
  const {window}=fixture();const layout=window.OntologyCatalog.mapData();
  assert.ok(layout.links.every(link=>link.labelPosition));
  for(const link of layout.links)assert.ok(segments(link).some(({start,end})=>onSegment(link.labelPosition,start,end)),link.label);
  for(let first=0;first<layout.links.length;first++)for(let second=first+1;second<layout.links.length;second++){
    for(const left of segments(layout.links[first]))for(const right of segments(layout.links[second])){
      const crossing=left.start.x===left.end.x&&right.start.y===right.end.y&&between(left.start.x,right.start.x,right.end.x)&&between(right.start.y,left.start.y,left.end.y)||left.start.y===left.end.y&&right.start.x===right.end.x&&between(right.start.x,left.start.x,left.end.x)&&between(left.start.y,right.start.y,right.end.y);
      assert.equal(crossing,false,layout.links[first].label+' / '+layout.links[second].label);
    }
  }
});

test('node and label rectangles remain separate and routes never pass through unrelated nodes',()=>{
  const {window}=fixture();const graph=window.OrbitAtlasGraph;const model=window.OrbitOntology.data();
  for(const scope of ['business','complete']){
    const layout=graph.catalogLayout(model,scope);
    for(const node of layout.nodes){assert.ok(node.x>=0&&node.y>=0&&node.x+node.width<=layout.width&&node.y+node.height<=layout.height);}
    for(let first=0;first<layout.nodes.length;first++)for(let second=first+1;second<layout.nodes.length;second++){
      const left=layout.nodes[first];const right=layout.nodes[second];assert.ok(left.x+left.width<=right.x||right.x+right.width<=left.x||left.y+left.height<=right.y||right.y+right.height<=left.y);
    }
    const labels=layout.links.map(link=>link.labelPosition).filter(Boolean);
    for(let first=0;first<labels.length;first++)for(let second=first+1;second<labels.length;second++)assert.ok(Math.abs(labels[first].x-labels[second].x)>=(labels[first].width+labels[second].width)/2||Math.abs(labels[first].y-labels[second].y)>=28);
    for(const label of labels)for(const node of layout.nodes)assert.ok(label.x+label.width/2<=node.x||label.x-label.width/2>=node.x+node.width||label.y+14<=node.y||label.y-14>=node.y+node.height);
    for(const link of layout.links)for(const {start,end} of segments(link)){
      assert.ok(start.x===end.x||start.y===end.y);
      for(const node of layout.nodes.filter(entry=>![link.source,link.target].includes(entry.id))){
        const overlap=start.x===end.x?between(start.x,node.x,node.x+node.width)&&Math.max(start.y,end.y)>node.y&&Math.min(start.y,end.y)<node.y+node.height:between(start.y,node.y,node.y+node.height)&&Math.max(start.x,end.x)>node.x&&Math.min(start.x,end.x)<node.x+node.width;
        assert.equal(overlap,false,scope+': '+link.label+' crosses '+node.name);
      }
    }
  }
});

test('selecting a node emphasizes only direct relations and keeps every position fixed',()=>{
  const {window,click,calls}=fixture();const catalog=window.OntologyCatalog;const original=JSON.stringify(window.OrbitOntology.data());const before=coordinates(catalog.mapData());
  click('catalog-map-select',{id:'draft'});const focused=catalog.mapData();assert.equal(catalog.selected().id,'draft');assert.equal(focused.focused,true);assert.equal(focused.highlighted.length,3);
  assert.ok(focused.highlighted.every(link=>link.source==='draft'||link.target==='draft'));assert.deepEqual(plain(coordinates(focused)),plain(before));
  assert.match(catalog.page(),/聚焦「准备报修草稿」/);assert.match(catalog.page(),/is-muted/);
  click('catalog-map-reset');assert.equal(catalog.mapData().highlighted.length,8);assert.equal(catalog.mapData().focused,false);assert.equal(JSON.stringify(window.OrbitOntology.data()),original);assert.equal(calls.length,0);
});

test('clicking a relation preserves its direction and shows its real label rather than creating new logic',()=>{
  const {window,click}=fixture();const catalog=window.OntologyCatalog;const before=JSON.stringify(window.OrbitOntology.data());
  click('catalog-edge',{id:'relation-5'});assert.equal(catalog.selected().id,'draft');assert.equal(catalog.mapData().highlighted.length,1);
  assert.match(catalog.page(),/禁止直接更换 — 限制动作 → 准备报修草稿/);assert.equal(JSON.stringify(window.OrbitOntology.data()),before);
});

test('locating an auxiliary definition reveals it with uncertainty retained and scope changes select visible content',()=>{
  const {window,click,emit}=fixture();const catalog=window.OntologyCatalog;
  emit('change',{id:'og-locate',value:'board',dataset:{},matches:()=>false,closest:()=>null});
  assert.equal(catalog.view().scope,'complete');assert.equal(catalog.selected().id,'board');assert.equal(catalog.mapData().highlighted.length,1);assert.match(catalog.page(),/原因假设 · 待验证/);
  click('catalog-scope',{value:'business'});assert.equal(catalog.mapData().nodes.length,8);assert.ok(catalog.mapData().nodes.some(node=>node.id===catalog.selected().id));
});

test('directory, inline editor and flow links use the same original definition',()=>{
  const {window,click,run,calls}=fixture();const catalog=window.OntologyCatalog;click('catalog-map-select',{id:'rule-check'});
  click('catalog-open-directory',{id:'rule-check'});assert.equal(catalog.view().presentation,'directory');assert.match(catalog.page(),/class="oc-property-table"/);assert.doesNotMatch(catalog.page(),/id="og-viewport"/);
  click('catalog-presentation',{value:'graph'});assert.match(catalog.page(),/id="og-viewport"/);
  click('catalog-edit',{id:'rule-check'});assert.equal(catalog.view().editingId,'rule-check');assert.doesNotMatch(catalog.page(),/id="ontology-canvas"|id="ontology-original-graph"/);assert.equal(window.OrbitOntology.view().selected,'rule-check');assert.match(catalog.page(),/id="ontology-node-form"/);
  click('catalog-use',{id:'rule-check'});assert.equal(run('view.page'),'orbit');assert.deepEqual(plain(window.OrbitDesigner.data().referenceIds),['rule-check']);assert.equal(calls.length,0);
});

test('graph reading controls isolate projects and never update assistant snapshots',()=>{
  const {window,click,switchProject}=fixture();const catalog=window.OntologyCatalog;const config=window.OrbitOntology.configFromAction('draft');window.ProjectStudio.createFromOntology(config);const scene=window.ProjectStudio.data().scenes[0];const saved=JSON.stringify(scene);
  click('catalog-map-select',{id:'draft'});click('catalog-map-zoom',{value:'in'});const zoom=catalog.view().zoom;
  switchProject('RETAIL');assert.equal(catalog.view().focusId,'');assert.equal(catalog.view().zoom,null);assert.doesNotMatch(catalog.page(),/准备报修草稿/);
  switchProject('AFTERSALES');assert.equal(catalog.view().focusId,'draft');assert.equal(catalog.view().zoom,zoom);assert.equal(JSON.stringify(scene),saved);
  assert.match(catalog.page(),/已保存规则快照/);window.OrbitOntology.data().nodes.find(node=>node.id==='draft').description='待复核的定义';assert.match(catalog.page(),/定义已变化 · 待复核/);assert.equal(JSON.stringify(scene),saved);
});

test('empty models and unknown links do not fabricate demonstration definitions',()=>{
  const {window}=fixture();const catalog=window.OntologyCatalog;window.ProjectStudio.data().ontology={schema:1,revision:1,nodes:[],links:[]};
  assert.deepEqual(plain(catalog.mapData().nodes),[]);assert.match(catalog.page(),/当前范围没有业务定义/);assert.doesNotMatch(catalog.page(),/屏幕无显示|\[object Object\]/);
  window.ProjectStudio.data().ontology.nodes.push({id:'custom',type:'object',name:'自定义事项',description:'仅登记',fields:''});window.ProjectStudio.data().ontology.links.push({id:'missing',source:'custom',target:'absent',label:'关联'});
  assert.equal(catalog.mapData().links.length,0);assert.equal(catalog.mapData().nodes.length,1);
});

test('custom cyclic and backward relationships remain bounded without being interpreted as execution',()=>{
  const {window}=fixture();const graph=window.OrbitAtlasGraph;const model={nodes:[{id:'one',type:'object',name:'事项'},{id:'two',type:'rule',name:'规则'},{id:'three',type:'action',name:'动作'},{id:'four',type:'human',name:'复核'}],links:[{id:'back',source:'four',target:'one',label:'补充说明'},{id:'loop',source:'one',target:'four',label:'交给人工'},{id:'self',source:'two',target:'two',label:'关联'}]};const before=JSON.stringify(model);const layout=graph.catalogLayout(model,'complete');
  assert.equal(layout.links.length,3);assert.equal(JSON.stringify(model),before);for(const link of layout.links)for(const point of link.points)assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.x<=layout.width&&point.y>=0&&point.y<=layout.height);
});

test('all user-authored node names and relation labels are escaped in graph controls and detail text',()=>{
  const {window}=fixture();const catalog=window.OntologyCatalog;const model=window.OrbitOntology.data();model.nodes.find(node=>node.id==='symptom').name='<img src=x onerror=alert(1)>';model.links.find(link=>link.id==='relation-4').label='<script>bad()</script>';
  const page=catalog.page();assert.doesNotMatch(page,/<img src=x|<script>bad/);assert.match(page,/&lt;img src=x/);assert.match(page,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);
});

test('repainting restores chart scroll and node keyboard focus without moving the page',()=>{
  const {window,document}=fixture();const catalog=window.OntologyCatalog;let focused=null;let scrolled;
  const node={dataset:{action:'catalog-map-select',id:'draft'},focus(options){focused=options;}};
  const elements={'og-viewport':{scrollLeft:100,scrollTop:70,clientWidth:930,scrollTo(left,top){scrolled=[left,top];}},'og-stage':{dataset:{width:1200,height:620},style:{}},'og-scaled-space':{style:{}},'og-zoom-readout':{textContent:''}};
  document.getElementById=id=>elements[id]||null;document.querySelectorAll=()=>[node];document.activeElement=node;catalog.capture();catalog.mount();
  assert.deepEqual(scrolled,[100,70]);assert.equal(focused.preventScroll,true);assert.equal(elements['og-stage'].style.transform,'scale(0.8)');assert.equal(elements['og-zoom-readout'].textContent,'80%');
});
