const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

function fixture(){
  const stores=new Map();let projectId='AFTERSALES';
  const window={PortfolioHub:{navProject:()=>({id:projectId}),persist(){}},ProjectStudio:{data(){if(!stores.has(projectId))stores.set(projectId,{});return stores.get(projectId);}}};
  const context=vm.createContext({window,document:{addEventListener(){}},structuredClone,crypto});
  for(const filename of ['identity.js','orbit-flow.js','seat-assist.js'])vm.runInContext(filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8'),context);
  return {flow:window.OrbitFlow,identity:window.HubIdentity,seat:window.SeatAssist,switchProject(value){projectId=value;}};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('flow compilation retains full branches, fields, human boundaries and an independent snapshot',()=>{
  const {flow}=fixture();const graph=flow.sample('AFTERSALES');const original=JSON.stringify(graph);const config=flow.compile(graph,'AFTERSALES');
  assert.deepEqual(plain(flow.validate(graph)),[]);assert.equal(config.flowDesign.definitions.length,7);assert.equal(config.flowDesign.execution,'definition-only');
  assert.equal(config.flowDesign.definitions.find(node=>node.id==='condition').branches.length,2);assert.equal(config.fields,'设备型号,购买日期,故障现象');assert.equal(config.transferWords,'冒烟,人工');
  assert.equal(config.tool,'form');assert.equal(config.provider,'未连接');assert.equal(config.flowDesign.confirmed,false);assert.equal(config.ontologyBinding,undefined);
  assert.equal(config.businessDesign.requests[0].status,'not-connected');assert.match(config.prompt,/资料不足 → 人工补充与核实/);
  config.flowDesign.graph.nodes[0].name='副本';assert.equal(JSON.stringify(graph),original);assert.ok(config.prompt.length<=1200);
});

test('flow validation rejects cycles, disconnected nodes and ambiguous branches',()=>{
  const {flow}=fixture();
  const cyclic=flow.sample('AFTERSALES');cyclic.edges.push({id:'cycle',from:'review',to:'collect',label:'回退'});assert.ok(flow.validate(cyclic).some(error=>error.includes('无环')));
  const orphan=flow.sample('AFTERSALES');orphan.edges=orphan.edges.filter(edge=>edge.to!=='collect');assert.ok(flow.validate(orphan).some(error=>error.includes('尚未连接')));
  const ambiguous=flow.sample('AFTERSALES');ambiguous.edges.filter(edge=>edge.from==='condition').forEach(edge=>edge.label='相同条件');assert.ok(flow.validate(ambiguous).some(error=>error.includes('不同条件')));
  const incomplete=flow.sample('AFTERSALES');incomplete.edges=incomplete.edges.filter(edge=>edge.id!=='link-3');assert.throws(()=>flow.compile(incomplete,'AFTERSALES'),/两条/);
});

test('invalid identity, duplicate edges, field and prompt overflow cannot silently truncate definitions',()=>{
  const {flow}=fixture();
  for(const name of ['','有 空格','@助手','名'.repeat(33)]){const graph=flow.sample('AFTERSALES');graph.name=name;assert.throws(()=>flow.compile(graph,'AFTERSALES'));}
  const duplicate=flow.sample('AFTERSALES');duplicate.edges.push({...duplicate.edges[0],id:'duplicate'});assert.throws(()=>flow.compile(duplicate,'AFTERSALES'),/重复/);
  const fields=flow.sample('AFTERSALES');fields.nodes[1].fields='字段'.repeat(81);assert.throws(()=>flow.compile(fields,'AFTERSALES'),/上限/);
  const long=flow.sample('AFTERSALES');long.nodes.forEach(node=>node.description='业务说明'.repeat(45));assert.throws(()=>flow.compile(long,'AFTERSALES'),/1200/);
  assert.throws(()=>flow.compile(flow.sample('AFTERSALES'),'RETAIL'),/其他项目/);
});

test('all automatic layouts preserve business definitions and separate cards deterministically',()=>{
  const {flow}=fixture();const graph=flow.sample('AFTERSALES');const definitions=JSON.stringify(flow.definitions(graph));
  for(const direction of ['horizontal','vertical'])for(const density of ['comfortable','compact']){
    const arranged=flow.arrange(graph,direction,density);assert.equal(JSON.stringify(flow.definitions(arranged)),definitions);assert.deepEqual(plain(arranged),plain(flow.arrange(graph,direction,density)));
    for(let first=0;first<arranged.nodes.length;first++)for(let second=first+1;second<arranged.nodes.length;second++){
      const left=arranged.nodes[first];const right=arranged.nodes[second];assert.ok(Math.abs(left.x-right.x)>=flow.nodeSize.width||Math.abs(left.y-right.y)>=flow.nodeSize.height);
    }
  }
});

test('layout commands only adjust layout and explicitly reject conflicting or semantic edits',()=>{
  const {flow}=fixture();const graph=flow.sample('AFTERSALES');const before=JSON.stringify(graph);
  const next=flow.layoutCommand(graph,'请把整个流程改为从左到右，间距紧凑');assert.equal(next.layout,'horizontal');assert.equal(next.density,'compact');assert.equal(JSON.stringify(graph),before);
  assert.equal(JSON.stringify(flow.definitions(next)),JSON.stringify(flow.definitions(graph)));
  for(const command of ['横向纵向','紧凑并宽松','删除所有节点','横向并取消人工审批','把退款金额改为零','', 'x'.repeat(121)])assert.throws(()=>flow.layoutCommand(graph,command));
});

test('manual positioning avoids overlaps and project state is isolated',()=>{
  const {flow,switchProject}=fixture();const graph=flow.sample('AFTERSALES');const position=flow.freePosition(graph,'new',graph.nodes[0].x,graph.nodes[0].y);
  assert.ok(graph.nodes.every(node=>Math.abs(node.x-position.x)>=236||Math.abs(node.y-position.y)>=132));
  flow.data().name='售后流程';flow.view().nodeDrafts.example={name:'编辑中'};switchProject('RETAIL');assert.equal(flow.data().name,'');assert.equal(Object.keys(flow.view().nodeDrafts).length,0);switchProject('AFTERSALES');assert.equal(flow.data().name,'售后流程');
});

test('new assistant avatars use safe deterministic choices and escape labels',()=>{
  const {identity}=fixture();assert.deepEqual(plain(identity.appearance({art:'ticket',tone:'blue'})),{art:'ticket',tone:'blue'});
  assert.deepEqual(plain(identity.appearance({art:'__proto__',tone:'constructor'},'demo')),plain(identity.appearance({},'demo')));
  assert.ok(!identity.assistant({name:'<img src=x>',avatar:{art:'unknown',tone:'unknown'}}).includes('<img'));assert.match(identity.assistant({name:'助手'}),/identity-avatar/);
});

test('phrase matching uses the cursor suffix, longest match first, and preserves insertion ranges',()=>{
  const {seat}=fixture();const text='您好，补充；谢谢';const results=seat.matchPhrases(text,5);assert.equal(results[0].id,'more');assert.equal(results[0].start,3);assert.equal(results[0].end,5);
  assert.equal(seat.matchPhrases('补充资料',4).length,0);assert.equal(seat.matchPhrases('补',1).length,0);
  const bank=[{id:'short',keywords:['其他']},{id:'long',keywords:['确认其他','其他']}];const ordered=seat.matchPhrases('确认其他',4,bank);assert.equal(ordered[0].id,'long');assert.equal(ordered[0].keyword,'确认其他');
});
