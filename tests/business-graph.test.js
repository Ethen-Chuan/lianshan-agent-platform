const assert = require('node:assert/strict');
const test = require('node:test');
const filesystem = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const listeners = {};
  const traces = [];
  const appState = {};
  const document = {addEventListener(name,handler){listeners[name]=handler;},getElementById(){return null;},querySelector(){return null;},activeElement:null};
  const window = {TraceHub:{record(trace){traces.push(trace);return 'TRACE-LOCAL-'+traces.length;}},AnalyticsHub:{dispatch(){}}};
  const context = vm.createContext({window,document,performance,structuredClone,console,CSS:{escape:value=>value}});
  for (const filename of ['analytics-data.js','problem-data.js','problem-insights.js','business-graph.js']) vm.runInContext(filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8'),context);
  const host = {getState:()=>appState,persist(){},render(){},navigate(){},escape:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:()=>'',button:(label,name,tone,attributes)=>`<button data-action="${name}" ${attributes}>${label}</button>`};
  window.ProblemInsights.configure(host);
  window.BusinessGraph.configure(host);
  return {graph:window.BusinessGraph,data:window.HubProblemData,insights:window.ProblemInsights,traces,change(id,value,checked=false){listeners.change({target:{id,value,checked}});},input(value){listeners.input({target:{id:'graph-search',value}});}};
}

test('instance graph models three relationship groups with explicit provenance and uncertainty',() => {
  const {graph,data} = fixture();
  const model = graph.model();
  assert.equal(model.topic.id,'audio');
  assert.equal(model.rows.length,model.topic.count);
  assert.equal(model.nodes.filter(node=>node.kind==='case').length,2);
  for (const edge of model.edges) {
    const target = model.nodes.find(node=>node.id===edge.to);
    assert.equal(edge.from,'topic');
    assert.equal(edge.uncertain,target.lane==='leads');
    assert.ok(edge.sourceIds.every(identifier=>data.records.some(row=>row.id===identifier)));
  }
  assert.equal(model.nodes.find(node=>node.id==='knowledge').sourceIds.length,0);
  assert.match(model.nodes.find(node=>node.id==='related').description,/尚未证明原因相同/);
});

test('scope filters constrain rows, related topics and trace counts without model-generated conclusions',() => {
  const {graph,traces} = fixture();
  graph.open('audio',{day:'week',channel:'wechat',domain:'设备故障'});
  const model = graph.model();
  graph.dispatch('run',{dataset:{}});
  const trace = traces.at(-1);
  assert.ok(model.rows.every(row=>row.channel==='wechat'&&row.category==='设备故障'));
  assert.equal(model.related.length,0);
  assert.equal(trace.output.count,model.rows.length);
  assert.equal(new Set(trace.output.sourceIds).size,trace.output.count);
  assert.equal(trace.output.modelCalled,false);
  assert.equal(trace.output.causalConclusion,null);
  assert.equal(trace.input.catalogVersion,'0.2');
  assert.equal(trace.input.ontologyVersion,undefined);
  assert.equal(trace.output.count+trace.output.excluded+trace.output.noEvidence,model.report.rows.length);
});

test('evidence filter affects displayed cases and retrieval, not historical totals',() => {
  const {graph,change,traces} = fixture();
  const before = graph.model();
  change('graph-evidence-only','',true);
  const after = graph.model();
  assert.equal(after.topic.count,before.topic.count);
  assert.equal(after.rows.length,before.topic.evidenceCount);
  assert.ok(after.rows.every(row=>row.primaryEvidence));
  graph.dispatch('all-cases',{dataset:{}});
  assert.equal(traces.at(-1).output.count,after.rows.length);
  assert.equal(traces.at(-1).input.query,'current');
  assert.equal(traces.at(-1).output.noEvidence,before.rows.length-after.rows.length);
});

test('not-applicable versions are not treated as a shared version',() => {
  const {graph,traces} = fixture();
  graph.open('inspection');
  const model = graph.model();
  assert.equal(model.topic.version,'不适用');
  assert.equal(model.related.length,0);
  graph.dispatch('run',{dataset:{}});
  assert.equal(traces.at(-1).input.query,'current');
  assert.deepEqual(Array.from(traces.at(-1).output.topicIds),['inspection']);
});

test('empty scopes do not fabricate graph nodes, traces or query results',() => {
  const {graph,traces,input} = fixture();
  graph.open('audio',{channel:'archive'});
  assert.equal(graph.model().nodes.length,0);
  assert.match(graph.page(),/没有匹配的问题/);
  graph.dispatch('run',{dataset:{}});
  assert.equal(traces.length,0);
  graph.open('audio');input('不存在的业务 abcdef');
  assert.equal(graph.model().topic,null);
  assert.doesNotMatch(graph.page(),/data-action="graph-run"/);
});

test('catalog aliases remove candidates without mutating historical classifications',() => {
  const {graph,insights,data} = fixture();
  graph.dispatch('kind',{dataset:{value:'new'}});
  assert.deepEqual(Array.from(graph.model().groups.map(topic=>topic.id)).sort(),['reset','stripes']);
  const original = JSON.stringify(data.records);
  insights.currentOntology().terms[0].aliases=[{id:'reset'}];
  assert.deepEqual(Array.from(graph.model().groups.map(topic=>topic.id)),['stripes']);
  assert.equal(JSON.stringify(data.records),original);
});

test('related case retrieval is constrained and invalidates when the scope changes',() => {
  const {graph,traces,change} = fixture();
  graph.dispatch('run',{dataset:{}});
  assert.equal(traces.at(-1).output.topicIds.length,4);
  assert.match(graph.page(),/id="graph-results"/);
  change('graph-channel','ding');
  assert.doesNotMatch(graph.page(),/id="graph-results"/);
  graph.dispatch('run',{dataset:{}});
  assert.equal(traces.at(-1).input.channel,'ding');
});

test('search text is escaped and presentation changes preserve results and underlying records',() => {
  const {graph,input,data} = fixture();
  input('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(graph.page(),/<img src=x/);
  assert.match(graph.page(),/&lt;img/);
  graph.open('audio');graph.dispatch('run',{dataset:{}});
  const before = JSON.stringify(data.records);
  graph.dispatch('presentation',{dataset:{value:'list'}});
  assert.match(graph.page(),/graph-relation-table/);
  assert.match(graph.page(),/id="graph-results"/);
  assert.equal(JSON.stringify(data.records),before);
});
