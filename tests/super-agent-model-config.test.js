const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const fixture=require('./helpers/group-chat-fixture');
const source=fs.readFileSync(path.join(__dirname,'../app/model-connections.js'),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));

function setup(publicMode=false){
  const calls=[];const tools=fixture('AFTERSALES',{customerModel:true,publicMode,fetchImpl:async(url,options={})=>{
    calls.push({url,options});
    if(url==='/api/model-connections')return Response.json({mode:'local-server',csrf:'test-session',connections:[{agentId:'manager',configured:false,revision:0}]});
    const input=JSON.parse(options.body);return Response.json({agentId:'manager',configured:true,revision:1,provider:input.provider,model:input.model,tested:false});
  }});
  tools.run(source);tools.run('window.HubModels.configure({...host,render:()=>{},footer:()=>""})');
  tools.document.querySelector=selector=>selector==='.dialog-content'?{scrollTop:0}:null;
  const ids=['model-provider','model-key','model-name','model-endpoint','model-protocol','model-status','model-environment','model-save-label','model-save','model-consent','model-test','model-remove','model-refresh','model-error',...['policy','model'].flatMap(name=>['model-tab-'+name,'model-panel-'+name,'model-footer-'+name])];
  for(const id of ids)tools.nodes.set(id,{value:'',checked:false,hidden:false,disabled:false,setAttribute(){},classList:{toggle(){}}});
  return {...tools,calls,api:tools.window.HubModels};
}

test('coordinator configuration opens its model tab without inventing a business assistant',async()=>{
  const {api,run,nodes,dialogs}=setup();const before=run('JSON.stringify(state.agents)');api.open('manager');await settle();
  assert.equal(nodes.get('model-tab-policy').hidden,true);assert.equal(nodes.get('model-panel-model').hidden,false);assert.equal(nodes.get('model-key').disabled,false);
  assert.equal(dialogs.at(-1)[0],'连小山 · 配置');assert.equal(run('JSON.stringify(state.agents)'),before);
});
test('saving the coordinator connection sends the key only to the local service and stores only its profile',async()=>{
  const {api,run,nodes,calls}=setup();api.open('manager');await settle();nodes.get('model-provider').value='deepseek';nodes.get('model-name').value='test-model';
  nodes.get('model-key').value='unit-test-only-not-a-real-credential';await api.dispatch('save');
  assert.equal(calls.filter(call=>call.url.endsWith('/save')).length,1);assert.equal(nodes.get('model-key').value,'');
  assert.doesNotMatch(run('JSON.stringify(state)'),/unit-test-only-not-a-real-credential/);assert.equal(run('state.coordinatorModel.modelConnection.model'),'test-model');
  assert.equal(calls.filter(call=>call.url.endsWith('/test')).length,0);
});
test('static coordinator configuration remains a key-free preview and never calls an API',async()=>{
  const {api,nodes,calls}=setup(true);api.open('manager');await settle();assert.equal(nodes.get('model-key').disabled,true);assert.equal(calls.length,0);
});
