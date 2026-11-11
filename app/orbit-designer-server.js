const policy=require('./orbit-designer-policy');
const businessPolicy=require('./orbit-business-policy');

function createOrbitDesignerService(connections,{designTimeoutMs=45000}={}){
  let pending=null;
  const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
  async function handle(request,response,pathname){
    if(!pathname.startsWith('/api/orbit-designer'))return false;
    const send=(status,value)=>{if(response.destroyed)return;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(value));};
    let controller;let timer;
    const cancel=()=>controller?.abort();
    try{
      connections.authorize(request);
      if(request.method!=='POST')fail(405,'不支持此请求方式。');
      if(!['/api/orbit-designer/generate','/api/orbit-designer/simulate','/api/orbit-designer/define'].includes(pathname))fail(404,'没有此接口。');
      const mode=pathname.split('/').at(-1);
      const body=await connections.readBody(request);const context=mode==='define'?businessPolicy.prepare(body):policy.prepare(body,mode);
      const meta=connections.list().find(entry=>entry.agentId==='manager');
      if(!meta?.configured||meta.revision!==body.expectedRevision)fail(409,'请连接连小山的模型，或刷新后重新确认。');
      if(pending)fail(409,'已有设计请求进行中，请等待完成后重试。');
      controller=new AbortController();pending=controller;timer=setTimeout(cancel,designTimeoutMs);
      request.on?.('aborted',cancel);response.on?.('close',cancel);
      const started=Date.now();
      const text=await connections.completeTask('manager',{system:mode==='define'?businessPolicy.system:mode==='generate'?policy.system:policy.simulationSystem,messages:[{role:'user',content:JSON.stringify(context)}],maxTokens:mode==='simulate'?2500:6500},{signal:controller.signal,expectedRevision:body.expectedRevision});
      if(controller.signal.aborted)fail(409,'请求已停止，未采用结果。');
      let result;
      try{result=mode==='define'?businessPolicy.parseProposal(text,context):mode==='generate'?policy.parseProposal(text,context):policy.parseSimulation(text,context);}catch(error){fail(502,error.message);}
      send(200,{result,origin:'model',projectId:body.projectId,revision:meta.revision,provider:meta.provider,model:meta.model,latencyMs:Date.now()-started,externalActions:0});
    }catch(error){send(error.status||502,{error:controller?.signal.aborted?'请求超时或已停止，原流程未修改；已发出的请求仍可能计费。':error.status?error.message:'模型请求未完成，请手动重试；没有使用预设流程替代。'});}
    finally{clearTimeout(timer);request.off?.('aborted',cancel);response.off?.('close',cancel);if(controller&&pending===controller)pending=null;}
    return true;
  }
  return {handle,dispose(){pending?.abort();}};
}
module.exports={createOrbitDesignerService};
