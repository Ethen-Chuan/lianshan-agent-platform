const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createModelConnections}=require('../app/model-connections-server');
const {createOrbitDesignerService}=require('../app/orbit-designer-server');
const policy=require('../app/orbit-designer-policy');
const {fixture:browserFixture}=require('./helpers/orbit-designer-fixture');
const demoKey='unit-test-only-not-a-real-credential';
async function fixture({fetchImpl,designTimeoutMs=1000,provider='openai',definitionResult}={}){
  const {window}=browserFixture();const graph=policy.projectGraph(window.OrbitFlow.sample('AFTERSALES'));const calls=[];
  const result=definitionResult||{message:'已生成，请核对。',questions:[],graph,cases:[]};
  const connections=createModelConnections({fetchImpl:fetchImpl||asyncFetch});
  async function asyncFetch(url,options){calls.push({url,payload:JSON.parse(options.body)});return Response.json(provider==='anthropic'?{content:[{type:'text',text:JSON.stringify(result)}]}:{choices:[{message:{content:JSON.stringify(result)},finish_reason:'stop'}]});}
  const designer=createOrbitDesignerService(connections,{designTimeoutMs});let csrf='';
  async function request(route,body,headers={}){
    const incoming=new EventEmitter();Object.assign(incoming,{method:body?'POST':'GET',socket:{localPort:4333},headers:{host:'127.0.0.1:4333',origin:'http://127.0.0.1:4333','content-type':'application/json','x-hub-session':csrf,...headers}});
    incoming[Symbol.asyncIterator]=async function*(){yield Buffer.from(JSON.stringify(body||{}));};
    const response=new EventEmitter();let status,data;response.writeHead=value=>{status=value;};response.end=value=>{data=JSON.parse(value);};
    if(route.startsWith('/api/model-connections'))await connections.handle(incoming,response,route);else await designer.handle(incoming,response,route);
    return {status,data};
  }
  const metadata=await request('/api/model-connections');csrf=metadata.data.csrf;
  await request('/api/model-connections/save',{agentId:'manager',provider,model:'test-model',expectedRevision:0,key:demoKey});
  const body=()=>({agentId:'manager',projectId:'AFTERSALES',expectedRevision:1,consent:true,prompt:'请根据报修描述整理流程，第3步先核实资料。',graph:structuredClone(graph),history:[],references:[],selectedNode:''});
  return {request,body,calls,dispose(){designer.dispose();connections.dispose();}};
}
test('designer uses the coordinator connection and returns validated model output without executing tools',async()=>{
  for(const provider of ['openai','anthropic','qwen','deepseek']){
    const {request,body,calls,dispose}=await fixture({provider});try{
      const response=await request('/api/orbit-designer/generate',body());assert.equal(response.status,200);assert.equal(response.data.origin,'model');assert.equal(response.data.externalActions,0);assert.equal(response.data.result.graph.nodes.length,7);
      assert.equal(calls.length,1);assert.equal(calls[0].payload.tools,undefined);assert.equal(calls[0].payload[provider==='openai'?'max_completion_tokens':'max_tokens'],6500);
      const context=JSON.parse(calls[0].payload.messages.at(-1).content);assert.equal(context.stepNumbers[2].nodeId,'condition');assert.equal(context.stepNumbers[2].number,'03');assert.equal(context.graph.projectId,'AFTERSALES');assert.ok(!JSON.stringify(response).includes(demoKey));
    }finally{dispose();}
  }
});
test('designer enforces same-origin, nonce, explicit consent, revision and project boundaries before model calls',async()=>{
  const {request,body,calls,dispose}=await fixture();try{
    for(const headers of [{origin:'https://untrusted.example'},{host:'untrusted.example'},{'x-hub-session':'wrong'},{'sec-fetch-site':'cross-site'}])assert.equal((await request('/api/orbit-designer/generate',body(),headers)).status,403);
    for(const change of [{consent:false},{agentId:'service'},{expectedRevision:0},{projectId:'RETAIL'},{endpoint:'https://untrusted.example'}])assert.ok((await request('/api/orbit-designer/generate',{...body(),...change})).status>=400);
    assert.equal(calls.length,0);
  }finally{dispose();}
});
test('sensitive descriptions, references, invalid output and unexpected tools have no canned fallback',async()=>{
  const {request,body,calls,dispose}=await fixture();try{
    assert.equal((await request('/api/orbit-designer/generate',{...body(),prompt:'person@example.com'})).status,400);
    const reference={id:'test-rule',projectId:'AFTERSALES',name:'定义',type:'rule',description:'person@example.com',fields:''};assert.equal((await request('/api/orbit-designer/generate',{...body(),references:[reference]})).status,400);assert.equal(calls.length,0);
  }finally{dispose();}
  for(const response of [{choices:[{message:{content:'not json'}}]},{choices:[{message:{content:demoKey}}]},{choices:[{message:{content:'{}',tool_calls:[{}]}}]}]){
    const fixtureValue=await fixture({fetchImpl:async()=>Response.json(response)});try{const result=await fixtureValue.request('/api/orbit-designer/generate',fixtureValue.body());assert.equal(result.status,502);assert.equal(result.data.result,undefined);assert.ok(!JSON.stringify(result).includes(demoKey));}finally{fixtureValue.dispose();}
  }
});
test('timeouts cancel the provider request and permit a later explicit retry',async()=>{
  let count=0;const {request,body,dispose}=await fixture({designTimeoutMs:5,fetchImpl:async(url,{signal})=>{count++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));}});
  try{const result=await request('/api/orbit-designer/generate',body());assert.equal(result.status,502);assert.match(result.data.error,/超时或已停止/);assert.equal(count,1);await request('/api/orbit-designer/generate',body());assert.equal(count,2);}finally{dispose();}
});
test('removing the coordinator connection cancels pending work and ignores late output',async()=>{
  let release;let begin;const started=new Promise(resolve=>{begin=resolve;});
  const {request,body,dispose}=await fixture({fetchImpl:async()=>{begin();return new Promise(resolve=>{release=()=>resolve(Response.json({choices:[{message:{content:'{}'}}]}));});}});
  try{const running=request('/api/orbit-designer/generate',body());await started;assert.equal((await request('/api/orbit-designer/generate',body())).status,409);assert.equal((await request('/api/model-connections/remove',{agentId:'manager',expectedRevision:1})).status,200);release();assert.equal((await running).status,409);}finally{dispose();}
});

test('business definition generation uses the real provider adapter with a distinct object schema',async()=>{
  const businessPolicy=require('../app/orbit-business-policy');const {window}=browserFixture();const model=businessPolicy.projectModel(window.OrbitOntology.data(),'AFTERSALES');
  const definitionResult={message:'已理解业务，请核对。',questions:[],design:{name:'报修设计助手',goal:'准备草稿供人工确认',definitionIds:['symptom','rule-check','draft'],entryActionId:'draft',nodes:[],links:[],removeLinks:[]}};
  for(const provider of ['openai','anthropic','qwen','deepseek']){
    const value=await fixture({provider,definitionResult});try{
      const body={agentId:'manager',projectId:'AFTERSALES',expectedRevision:1,consent:true,prompt:'基于已有定义准备报修助手',model,history:[],selectedNode:'',previous:null};
      const result=await value.request('/api/orbit-designer/define',body);assert.equal(result.status,200);assert.equal(result.data.result.design.name,'报修设计助手');assert.equal(result.data.result.graph,undefined);assert.equal(result.data.externalActions,0);
      assert.equal(value.calls.length,1);const request=value.calls[0].payload;assert.equal(request.tools,undefined);const context=JSON.parse(request.messages.at(-1).content);assert.equal(context.model.nodes.length,12);assert.equal(context.definitionNumbers[0].number,'01');assert.equal(context.graph,undefined);
      const metadata=await value.request('/api/model-connections');assert.ok(metadata.data.capabilities.includes('orbit-definitions-v1'));
      for(const change of [{consent:false},{expectedRevision:0},{projectId:'RETAIL'},{agentId:'service'},{prompt:'person@example.com'}])assert.ok((await value.request('/api/orbit-designer/define',{...body,...change})).status>=400);
      assert.equal(value.calls.length,1);
    }finally{value.dispose();}
  }
});
test('invalid or clarification-only business outputs do not become canned graphs',async()=>{
  const businessPolicy=require('../app/orbit-business-policy');const {window}=browserFixture();const model=businessPolicy.projectModel(window.OrbitOntology.data(),'AFTERSALES');
  for(const definitionResult of [{message:'请补充',questions:['哪些信息是必填？'],design:null},{message:'错误结果',questions:[],design:{}}]){
    const value=await fixture({definitionResult});try{
      const result=await value.request('/api/orbit-designer/define',{agentId:'manager',projectId:'AFTERSALES',expectedRevision:1,consent:true,prompt:'整理业务',model,history:[],selectedNode:'',previous:null});
      if(definitionResult.design===null){assert.equal(result.status,200);assert.equal(result.data.result.design,null);}else{assert.equal(result.status,502);assert.equal(result.data.result,undefined);}assert.equal(value.calls.length,1);
    }finally{value.dispose();}
  }
});
