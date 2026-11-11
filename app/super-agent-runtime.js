const {randomUUID}=require('node:crypto');
const {createTaskStore}=require('./super-agent-store');
const policy=require('./super-agent-policy');

function createSuperAgentRuntime({filename=':memory:',models,complete,timeoutMs=45000}={}){
  const store=createTaskStore(filename);
  let data=store.read();let closed=false;let scheduled=false;let router=Promise.resolve();let serviceError='';
  const running=new Map();
  const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
  const stamp=()=>new Date().toISOString();
  function available(){if(closed)fail('服务已停止。');if(serviceError)fail(serviceError,503);}
  function update(change){
    available();const next=structuredClone(data);change(next);
    try{data=store.write(next,data.revision);}catch{
      serviceError='任务记录无法保存，已暂停全部处理。请检查磁盘和重复运行的服务，再重启恢复；不要重复提交。';
      running.forEach(controller=>controller.abort());fail(serviceError,503);
    }
  }
  function event(next,task,type,text){next.events.push({id:randomUUID(),taskId:task.id,type,text,at:stamp()});task.updatedAt=stamp();task.revision++;}
  function mutate(id,change){update(next=>{const task=next.tasks.find(entry=>entry.id===id);if(!task)fail('任务不存在。',404);change(task,next);});}
  if(data.tasks.some(task=>['queued','routing','working'].includes(task.status))){
    update(next=>{for(const task of next.tasks){if(['queued','routing','working'].includes(task.status)){task.status='interrupted';task.error='服务曾中断。确认后可重新处理本轮，不会自动补发模型请求。';event(next,task,'recovery','服务重启，资料与进度已保留。');}}});
  }
  function bindings(expected,allowedAgents){
    if(!Array.isArray(allowedAgents)||allowedAgents.length>4||!allowedAgents.includes('manager')||allowedAgents.some(id=>!['manager',...Object.keys(policy.roles)].includes(id)))fail('请明确本轮可用的助手范围。',400);
    const connected=models().filter(entry=>entry.configured&&allowedAgents.includes(entry.agentId));
    if(!connected.some(entry=>entry.agentId==='manager')||!connected.some(entry=>entry.agentId!=='manager'))fail('请先连接连小山和至少一位业务助手。');
    if(!policy.keys(expected,connected.map(entry=>entry.agentId))||connected.some(entry=>expected[entry.agentId]!==entry.revision))fail('模型连接已变化，请刷新后重新确认。');
    return Object.fromEntries(connected.map(entry=>[entry.agentId,{revision:entry.revision,provider:entry.provider,model:entry.model}]));
  }
  function validate(body,fields){
    if(!policy.keys(body,fields)||body.projectId!=='AFTERSALES')fail('此入口目前仅支持售后项目。',400);
    if(typeof body.eventId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(body.eventId))fail('消息标识无效。',400);
    const duplicate=data.events.find(entry=>entry.clientId===body.eventId);
    if(duplicate){if(duplicate.payload!==JSON.stringify(body))fail('消息标识重复但内容不同。');return duplicate.taskId;}
    return null;
  }
  function receive(body){
    available();
    const duplicate=validate(body,['projectId','eventId','taskId','expectedRevision','text','context','modelRevisions','consent','allowedAgents']);
    if(duplicate)return {taskId:duplicate,duplicate:true};
    if(data.events.length>=4000)fail('本机试运行记录已达上限，暂停接收新消息。请保留数据库；当前版本没有归档功能。');
    if(body.consent!==true)fail('请确认本轮资料范围与模型费用。',400);
    const text=policy.text(body.text,1200,'任务消息');
    const modelBindings=bindings(body.modelRevisions,body.allowedAgents);
    let id=body.taskId;
    if(id){
      const original=data.tasks.find(task=>task.id===id);
      if(!original||original.projectId!==body.projectId)fail('任务不存在。',404);
      if(original.revision!==body.expectedRevision)fail('任务有新进展，请刷新后再补充。');
      if(original.status==='stopped')fail('已停止的任务不会自动恢复，请新建任务。');
      if(original.round>=6)fail('这项任务已达 6 轮，请人工核对。');
      if(original.attempts>=12)fail('这项任务已达 12 次处理尝试，请人工核对。');
      if(body.context!==undefined)fail('补充原任务不能更换客户或资料，请新建任务。',400);
      update(next=>{
        const task=next.tasks.find(entry=>entry.id===id);
        task.history.push({round:task.round,steps:task.steps,status:task.status,question:task.question});
        task.round++;task.attempts++;task.generation++;task.status='queued';task.question='';task.error='';task.steps=[];task.bindings=modelBindings;
        task.inputs.push({text,at:stamp()});event(next,task,'followup',text);
        next.events.push({id:randomUUID(),clientId:body.eventId,payload:JSON.stringify(body),taskId:id,type:'received',at:stamp()});
      });
      running.get(id)?.abort();
    }else{
      if(data.tasks.length>=100)fail('试运行最多保留 100 项任务，暂停新增；当前版本没有归档功能。');
      const context=policy.context(body.context);
      id='LS-'+randomUUID();
      update(next=>{
        const task={id,projectId:body.projectId,title:text.slice(0,48),context,status:'queued',createdAt:stamp(),updatedAt:stamp(),revision:0,generation:1,round:1,attempts:1,inputs:[{text,at:stamp()}],steps:[],history:[],question:'',error:'',bindings:modelBindings,mandate:{version:'local-draft-1',source:'workspace-group',scope:'仅本次资料内的草稿准备',externalWrite:false}};
        next.tasks.push(task);event(next,task,'accepted','已接收，后台准备；本轮最多四次模型请求。');
        next.events.push({id:randomUUID(),clientId:body.eventId,payload:JSON.stringify(body),taskId:id,type:'received',at:stamp()});
      });
    }
    schedule();return {taskId:id,duplicate:false};
  }
  function command(body){
    available();
    const duplicate=validate(body,['projectId','eventId','taskId','expectedRevision','action','consent','modelRevisions','allowedAgents']);
    if(duplicate)return {taskId:duplicate,duplicate:true};
    const original=data.tasks.find(task=>task.id===body.taskId&&task.projectId===body.projectId);
    if(!original)fail('任务不存在。',404);
    if(original.revision!==body.expectedRevision)fail('任务已更新，请刷新后重试。');
    if(!['stop','retry','accept'].includes(body.action))fail('不支持此操作。',400);
    if(body.action==='retry'&&!['failed','interrupted'].includes(original.status))fail('只有失败或中断任务可以重试。');
    if(body.action==='retry'&&data.events.length>=4000)fail('记录已达上限，不能继续模型处理；仍可核对或停止任务。');
    if(body.action==='accept'&&original.status!=='review')fail('仅待核对的结果可以确认。');
    if(body.action==='stop'&&['stopped','accepted'].includes(original.status))fail('任务已结束。');
    if(body.action==='retry'&&(body.consent!==true||original.attempts>=12))fail('恢复需确认模型费用，且单项任务最多尝试 12 次。',400);
    const modelBindings=body.action==='retry'?bindings(body.modelRevisions,body.allowedAgents):null;
    mutate(original.id,(task,next)=>{
      if(modelBindings){task.history.push({round:task.round,steps:task.steps,status:task.status,question:task.question});task.steps=[];task.bindings=modelBindings;task.generation++;task.attempts++;task.error='';task.question='';}
      task.status=body.action==='stop'?'stopped':body.action==='accept'?'accepted':'queued';
      event(next,task,body.action,{stop:'已停止任务；已发出的模型请求仍可能计费。',accept:'已核对草稿；未对外发送、未建单，不计为问题已解决。',retry:'已确认重新处理本轮，原记录保留。'}[body.action]);
      next.events.push({id:randomUUID(),clientId:body.eventId,payload:JSON.stringify(body),taskId:task.id,type:'command',at:stamp()});
    });
    if(body.action==='stop')running.get(original.id)?.abort();
    schedule();return {taskId:original.id};
  }
  function configure(body){
    available();
    if(!policy.keys(body,['projectId','expectedRevision','concurrency'])||body.projectId!=='AFTERSALES'||body.expectedRevision!==data.revision)fail('配置已更新，请刷新后重试。');
    if(!Number.isInteger(body.concurrency)||body.concurrency<1||body.concurrency>6)fail('同时处理的任务数需为 1–6。',400);
    update(next=>{next.concurrency=body.concurrency;});schedule();return snapshot();
  }
  function snapshot(){
    return {mode:'local-super-agent',revision:data.revision,serviceError,concurrency:data.concurrency,active:running.size,models:models(),tasks:structuredClone(data.tasks).reverse(),events:data.events.filter(entry=>!entry.clientId).map(entry=>({...entry})),capabilities:{persistence:'sqlite',routing:'model',workers:'model',businessWrites:false,externalSources:false,alwaysOn:false,proactive:'off'}};
  }
  function schedule(){if(closed||serviceError||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;pump();});}
  function pump(){
    if(closed||serviceError)return;
    for(const task of data.tasks){
      if(running.size>=data.concurrency)break;
      if(task.status!=='queued'||running.has(task.id))continue;
      const controller=new AbortController();running.set(task.id,controller);
      void execute(task.id,task.generation,controller).catch(()=>{serviceError=serviceError||'运行遇到异常，已暂停全部任务。请保留记录并重启服务后恢复。';running.forEach(entry=>entry.abort());}).finally(()=>{running.delete(task.id);schedule();});
    }
  }
  async function execute(id,generation,controller){
    const current=()=>data.tasks.find(task=>task.id===id);
    const valid=()=>!closed&&!serviceError&&!controller.signal.aborted&&current()?.generation===generation&&!['stopped','interrupted'].includes(current()?.status);
    async function invoke(agent,system,input){
      if(!valid())throw new Error('cancelled');
      const binding=current().bindings[agent];
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(timeoutMs)]);
      const call=complete(agent,{system,messages:[{role:'user',content:JSON.stringify(input)}],maxTokens:2200},{signal,expectedRevision:binding.revision});
      let onAbort;
      const aborted=new Promise((resolve,reject)=>{onAbort=()=>reject(Object.assign(new Error('模型请求超时或已停止。'),{status:408}));signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();});
      try{const result=await Promise.race([call,aborted]);if(!valid())throw new Error('cancelled');return result;}finally{signal.removeEventListener('abort',onAbort);}
    }
    try{
      mutate(id,(task,next)=>{task.status='routing';event(next,task,'routing','连小山正在安排这项任务。');});
      const task=current();const available=Object.keys(task.bindings).filter(agent=>agent!=='manager');
      const previousRound=task.history.at(-1);
      const prior=previousRound?{question:previousRound.question||'',reports:previousRound.steps.filter(step=>step.result).map(step=>({agent:step.agent,...step.result}))}:null;
      const routing=router.then(()=>invoke('manager',policy.routerPrompt,{goal:task.inputs,previousRound:prior,available:available.map(agent=>({id:agent,name:policy.roles[agent]})),context:task.context,mandate:task.mandate}));
      router=routing.catch(()=>{});
      const planned=policy.plan(await routing,available);
      if(!valid())return;
      mutate(id,(task,next)=>{task.title=planned.title;task.question=planned.question;task.status=planned.question?'waiting':'working';task.steps=planned.steps.map(step=>({...step,status:'queued',result:null}));event(next,task,planned.question?'question':'plan',planned.question||'分工已确定，业务助手开始准备。');});
      for(let index=0;index<planned.steps.length;index++){
        if(!valid())return;
        const step=current().steps[index];
        mutate(id,(task,next)=>{task.steps[index].status='working';event(next,task,'step',policy.roles[step.agent]+'正在处理。');});
        const task=current();
        const output=policy.report(await invoke(step.agent,policy.workerPrompt(step.agent),{goal:task.inputs,instruction:step.instruction,context:task.context,previousRound:prior,previous:step.dependsOn.map(position=>task.steps[position].result),mandate:task.mandate}),task);
        mutate(id,(task,next)=>{task.steps[index].result=output;task.steps[index].status=output.status;event(next,task,'result',output.summary);if(output.status==='waiting'){task.status='waiting';task.question=output.question;event(next,task,'question',output.question);}});
        if(output.status==='waiting')return;
      }
      if(!planned.question)mutate(id,(task,next)=>{task.status='review';event(next,task,'review','草稿已准备好，等待你核对。');});
    }catch(error){
      if(!valid())return;
      try{mutate(id,(task,next)=>{task.status='failed';task.error=error.status&&!policy.sensitive(error.message)?error.message:'本轮执行未完成，请检查连接后重试；没有使用预设结果。';event(next,task,'failed',task.error);});}catch{if(!serviceError)throw error;}
    }
  }
  function dispose(){
    if(closed)return;
    try{if(!serviceError)update(next=>{for(const task of next.tasks){if(['queued','routing','working'].includes(task.status)){task.status='interrupted';task.error='服务已停止，确认后可恢复本轮。';event(next,task,'recovery',task.error);}}});}
    catch{if(!serviceError)throw Error('任务停止状态无法保存。');}
    finally{closed=true;running.forEach(controller=>controller.abort());store.close();}
  }
  return {receive,command,configure,snapshot,dispose};
}
module.exports={createSuperAgentRuntime};
