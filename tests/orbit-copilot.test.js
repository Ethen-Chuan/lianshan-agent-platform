const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

function fixture(){
  const window={};const context=vm.createContext({window,document:{addEventListener(){}},structuredClone,crypto});
  for(const filename of ['icons.js','identity.js','orbit-flow.js','orbit-copilot.js'])vm.runInContext(filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8'),context);
  return {flow:window.OrbitFlow,copilot:window.OrbitCopilot,identity:window.HubIdentity,graph:window.OrbitFlow.sample('AFTERSALES')};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('canvas commands preview content and layout together without mutating the source',()=>{
  const {copilot,graph}=fixture();const original=JSON.stringify(graph);
  const plan=copilot.propose(graph,'将「收集报修信息」改名为「核对资料」\n修改「核对资料」的必要字段为「设备型号,故障现象」\n修改选中节点的说明为「逐项核对，信息不足时先追问」\n横向紧凑','collect');
  assert.equal(JSON.stringify(graph),original);assert.equal(plan.sourceSnapshot,original);assert.equal(plan.graph.layout,'horizontal');assert.equal(plan.graph.density,'compact');assert.equal(plan.graph.nodes[1].name,'核对资料');assert.equal(plan.graph.nodes[1].fields,'设备型号,故障现象');assert.equal(plan.changes.filter(change=>change.kind==='edit').length,3);assert.equal(plan.semantic,true);assert.equal(plan.source,'local-commands');
});
test('new steps reconnect the original successor and retain its branch label',()=>{
  const {copilot,graph}=fixture();const plan=copilot.propose(graph,'在「整理报修草稿」后添加人工确认「负责人复核」\n修改「负责人复核」的说明为「检查授权和资料后再继续」');
  const node=plan.graph.nodes.find(node=>node.name==='负责人复核');assert.equal(node.type,'human');assert.equal(plan.graph.edges.find(edge=>edge.from==='action').to,node.id);assert.equal(plan.graph.edges.find(edge=>edge.from==='action').label,'草稿待审');assert.equal(plan.graph.edges.find(edge=>edge.from===node.id).to,'review');assert.deepEqual(plain(plan.warnings),[]);assert.equal(graph.nodes.length,7);
});
test('incomplete definitions are explicitly flagged rather than invented',()=>{
  const {copilot,graph,flow}=fixture();const plan=copilot.propose(graph,'添加处理动作「核验授权」');const node=plan.graph.nodes.find(node=>node.name==='核验授权');assert.equal(node.description,'');assert.equal(node.capability,'');assert.ok(plan.warnings.some(warning=>warning.includes('核验授权')));assert.throws(()=>flow.compile(plan.graph,'AFTERSALES'),/核验授权/);
});
test('deletions, disconnected paths and human boundary edits require explicit review',()=>{
  const {copilot,graph}=fixture();for(const command of ['删除「人工补充与核实」','断开「整理报修草稿」到「坐席确认草稿」','修改「坐席确认草稿」的说明为「交由专人重新审核」'])assert.equal(copilot.propose(graph,command).requiresRisk,true);
});
test('invalid or ambiguous instructions reject the entire transaction',()=>{
  const {copilot,graph}=fixture();const original=JSON.stringify(graph);
  for(const command of ['横向紧凑\n让流程变得非常聪明','删除「不存在」','修改选中节点的说明为「内容」','在「资料是否齐全」后添加人工确认「复核」','横向并取消人工审批']){assert.throws(()=>copilot.propose(graph,command));assert.equal(JSON.stringify(graph),original);}
  graph.nodes[0].name=graph.nodes[1].name;assert.throws(()=>copilot.propose(graph,'将「收集报修信息」改名为「新名字」'),/同名/);
});
test('commands enforce project, content, type and batch limits',()=>{
  const {copilot,graph}=fixture();assert.throws(()=>copilot.propose(graph,'横向紧凑','','RETAIL'),/其他项目/);
  for(const command of ['a'.repeat(1601),Array(13).fill('横向紧凑').join('\n'),'将「收集报修信息」改名为「'+ '名'.repeat(21)+'」','修改「收集报修信息」的说明为「'+'字'.repeat(181)+'」','修改「受理报修诉求」的必要字段为「型号」','修改「坐席确认草稿」的业务能力为「提交」','新增业务入口「另一个入口」'])assert.throws(()=>copilot.propose(graph,command));
});
test('relative positioning only changes layout and does not alter business definitions',()=>{
  const {copilot,graph,flow}=fixture();const plan=copilot.propose(graph,'将所有节点向右移动120像素');assert.equal(plan.graph.nodes[0].x,graph.nodes[0].x+120);assert.equal(plan.semantic,false);assert.deepEqual(plain(flow.definitions(plan.graph)),plain(flow.definitions(graph)));assert.throws(()=>copilot.propose(graph,'将所有节点向右移动700像素'),/范围/);
});
test('wire connections reject duplicates, full ports, self loops, cycles and invalid endpoints',()=>{
  const {flow,graph,copilot}=fixture();assert.throws(()=>flow.addConnection(structuredClone(graph),'start','collect'),/已经连接/);assert.throws(()=>flow.addConnection(structuredClone(graph),'start','action'),/多条路径/);assert.throws(()=>flow.addConnection(structuredClone(graph),'collect','collect'),/不同/);assert.throws(()=>flow.addConnection(structuredClone(graph),'end','action'),/交付结果/);assert.throws(()=>flow.addConnection(structuredClone(graph),'human','start'),/业务入口/);
  const open=structuredClone(graph);open.edges=open.edges.filter(edge=>edge.from!=='review');assert.throws(()=>flow.addConnection(open,'review','collect'),/循环/);
  assert.throws(()=>copilot.propose(graph,'断开「坐席确认草稿」到「交付待确认结果」\n连接「坐席确认草稿」到「收集报修信息」'),/循环/);assert.equal(graph.edges.length,7);
});
test('branch ports keep independent output slots when disconnecting and reconnecting',()=>{
  const {flow,graph}=fixture();const branch=graph.edges.filter(edge=>edge.from==='condition');branch.forEach((edge,index)=>edge.fromPort=index);graph.edges=graph.edges.filter(edge=>edge.id!==branch[0].id);
  assert.throws(()=>flow.addConnection(structuredClone(graph),'condition','action','齐全',1),/出口已经连接/);flow.addConnection(graph,'condition','action','齐全',0);assert.equal(graph.edges.find(edge=>edge.to==='human').fromPort,1);assert.equal(graph.edges.find(edge=>edge.to==='action').fromPort,0);
});
test('avatar gallery contains 36 distinct arts with six palettes and safe stable defaults',()=>{
  const {identity}=fixture();const picker=identity.picker({name:'演示助手'});const keys=[...picker.matchAll(/data-avatar-art="([^"]+)"/g)].map(match=>match[1]);assert.equal(keys.length,36);assert.equal(new Set(keys).size,36);assert.equal([...picker.matchAll(/data-avatar-tone=/g)].length,6);
  const images=keys.map(art=>identity.assistant({name:'演示',avatar:{art,tone:'teal'}}).match(/<svg[\s\S]*<\/svg>/)[0]);assert.equal(new Set(images).size,36);
  for(const art of keys)assert.equal(identity.appearance({art,tone:'blue'}).art,art);assert.equal(identity.appearance({art:'__proto__'}).art,identity.appearance({}).art);assert.doesNotMatch(identity.assistant({name:'<script>bad</script>',avatar:{art:'fox',tone:'teal'}}),/<script>/);
});
