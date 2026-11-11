const path=require('node:path');
const {createSuperAgentRuntime}=require('./super-agent-runtime');

function createSuperAgentService(connections,options={}){
  let runtime;
  const get=()=>runtime||(runtime=createSuperAgentRuntime({filename:options.runtimeFile||path.join(__dirname,'../work/super-agent/tasks.sqlite'),models:connections.list,complete:connections.completeTask,timeoutMs:options.taskTimeoutMs||45000}));
  async function handle(request,response,pathname){
    if(!pathname.startsWith('/api/super-agent'))return false;
    const send=(status,value)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(value));};
    try{
      connections.authorize(request);
      if(pathname==='/api/super-agent'&&request.method==='GET'){send(200,get().snapshot());return true;}
      if(request.method!=='POST')throw Object.assign(new Error('不支持此请求方式。'),{status:405});
      const routes={'/api/super-agent/events':'receive','/api/super-agent/command':'command','/api/super-agent/settings':'configure'};
      if(!routes[pathname])throw Object.assign(new Error('没有此接口。'),{status:404});
      const body=await connections.readBody(request);
      send(pathname.endsWith('/events')?202:200,get()[routes[pathname]](body));
    }catch(error){send(error.status||500,{error:error.status?error.message:'任务服务未完成操作，请检查服务状态。'});}
    return true;
  }
  return {handle,dispose(){runtime?.dispose();}};
}
module.exports={createSuperAgentService};
