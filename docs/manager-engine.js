window.ManagerEngine = {
  create(host) {
    const jobs = new Map();
    const limits = {tasks:6,workerSteps:2,attempts:3,assists:4,storedTasks:40};
    const names = {get manager(){return window.ProjectStudio?.coordinatorName?.()||'连小山';},knowledge:'知识查找',service:'售后接待助手',ticket:'工单填写助手',quality:'对话质检助手',expert:'外部专家（模拟）'};
    const kinds = {service:'接待与报修准备',ticket:'仅整理工单',lookup:'查询工单进度',review:'复核已有对话',knowledge:'仅核查方案'};
    const activeStates = ['排队中','执行中'];
    let alive = true;
    let booting = true;
    let pumping = false;
    const clone = value => value === undefined ? null : JSON.parse(JSON.stringify(value));
    const stamp = () => new Date().toISOString();
    const clean = value => {
      if (typeof value === 'string') return host.isSensitive(value) ? '[敏感内容已移除]' : value;
      if (Array.isArray(value)) return value.map(clean);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/token|secret|password|api.?key/i.test(key)).map(([key,item]) => [key,clean(item)]));
      return value;
    };
    const get = () => host.getState().manager;
    const find = identifier => get().tasks.find(task => task.id === identifier);
    const stepOf = (task,identifier) => task.steps.find(step => step.id === identifier);
    const saved = () => {host.persist();if (!booting && alive) host.onChange();};
    const fail = message => {throw new Error(message);};
    const event = (task,text,actor='manager',type='state',context={}) => {
      task.events.push({sequence:task.events.length+1,time:stamp(),actor,type,text,...context});
      task.updatedAt = stamp();
    };
    const message = (role,text,taskIds=[],conversationId) => {
      const thread = conversationId || (taskIds.length ? find(taskIds[0])?.conversationId : null) || get().activeConversationId;
      get().messages.push({role,text:clean(text),time:stamp(),taskIds,conversationId:thread});
      get().messages = get().messages.slice(-80);
    };

    function capture(caseId) {
      const item = host.getState().cases.find(entry => entry.id === caseId);
      if (!item) fail('没有找到这个授权会话。');
      const scoped = clean({id:item.id,name:item.name,channel:item.channel,channelName:item.channelName,origin:item.origin,product:item.product,model:item.model,version:item.version,priority:item.priority,status:item.status,owner:item.owner,verified:item.verified,evidence:item.evidence,messages:item.messages.filter(entry => entry.role !== 'internal')});
      const ticket = clean(host.getState().tickets.find(entry => entry.caseId === caseId) || null);
      const knowledge = clean(host.getState().knowledge.filter(entry => entry.product === item.product || entry.product === '全业务'));
      return {item:clone(scoped),ticket:clone(ticket),knowledge:clone(knowledge),capturedAt:stamp(),caseSignature:JSON.stringify([scoped,ticket]),signature:JSON.stringify([scoped,ticket,knowledge])};
    }

    function allowed(caseId,kind) {
      const item = host.getState().cases.find(entry => entry.id === caseId);
      if (!item || item.owner === 'readonly') fail('此来源只读或不可见，不能创建调度任务。');
      const channel = host.getState().channels.find(entry => entry.id === item.channel);
      if (!channel || channel.status === '已停用' || !channel.read) fail('渠道已停用或无读取权限，请先检查接入状态。');
      if (['已解决','关闭未解决'].includes(item.status) && kind !== 'review') fail('会话已结束；先重新打开，或只复核已有对话。');
      return item;
    }

    function step(identifier,worker,label,type,dependencies=[]) {
      return {id:identifier,worker,label,type,dependencies,status:'待执行',attempts:0,token:0,output:null,traceId:null,history:[]};
    }

    function plan(kind) {
      const steps = [step('context','manager','整理当前诉求','context')];
      if (['service','knowledge'].includes(kind)) steps.push(step('knowledge','knowledge','核对适用知识','knowledge',['context']));
      if (['service','ticket'].includes(kind)) steps.push(step('draft','ticket','准备工单草稿','draft',['context']));
      if (kind === 'lookup') steps.push(step('lookup','ticket','读取工单记录','lookup',['context']));
      if (['service','lookup'].includes(kind)) steps.push(step('reply','service','起草待审核回复','reply',[kind === 'lookup' ? 'lookup' : 'knowledge']));
      if (kind !== 'knowledge') steps.push(step('quality','quality',kind === 'review' ? '复核已有回复' : '检查回复与草稿','quality',kind === 'service' ? ['reply','draft'] : kind === 'ticket' ? ['draft'] : kind === 'lookup' ? ['reply'] : ['context']));
      steps.push(step('result','manager','汇总结果与待办','result',[kind === 'knowledge' ? 'knowledge' : 'quality']));
      return steps;
    }

    function createTask(caseId,kind,goal,options={}) {
      allowed(caseId,kind);
      if (!kinds[kind]) fail('不支持这种任务类型。');
      if (host.isSensitive(goal)) fail('指令含疑似敏感信息，请移除后再演示。');
      if (get().tasks.length >= limits.storedTasks) fail('本地演示最多保留 40 个任务，请先在平台设置中重置。');
      get().sequence += 1;
      const task = {id:'PM-'+String(get().sequence).padStart(4,'0'),caseId,kind,goal:clean(goal.replace(/CS-\d+/gi,'').trim()) || kinds[kind],status:'待开始',priority:options.priority === '优先' ? '优先' : '普通',origin:options.origin || '本次指令',round:1,createdAt:stamp(),updatedAt:stamp(),snapshot:capture(caseId),steps:plan(kind),events:[],exchanges:[],reviews:[],fault:options.fault === 'timeout' ? 'timeout' : '',faultConsumed:false};
      event(task,'已拆分为 '+task.steps.length+' 个步骤；只读取、准备草稿和检查，不自动发送或建单。');
      task.conversationId = options.conversationId || get().activeConversationId || null;
      get().tasks.unshift(task);
      return task;
    }

    function changed(task) {
      try {return capture(task.caseId).signature !== task.snapshot.signature;}
      catch {return true;}
    }

    function requiredTask(identifier) {
      const task = find(identifier);
      if (!task) fail('没有找到任务 '+identifier+'。');
      return task;
    }

    function archiveStep(task,entry,reason) {
      if (entry.output !== null || entry.traceId || entry.status === '执行中' || entry.status === '失败') entry.history.push({round:task.round,reason,status:entry.status,output:clone(entry.output),traceId:entry.traceId,attempts:entry.attempts,time:stamp(),error:entry.error || ''});
      const job = jobs.get(task.id+':'+entry.id);
      if (job) {clearTimeout(job.timer);jobs.delete(task.id+':'+entry.id);}
      entry.token += 1;
      entry.status = '待执行';entry.output = null;entry.traceId = null;entry.error = '';
      const exchange=task.exchanges.find(item=>item.stepId===entry.id);
      if(exchange){exchange.status='排队中';exchange.traceId=null;}
    }

    function stopRunning(task,reason) {
      for (const entry of task.steps.filter(entry => entry.status === '执行中')) archiveStep(task,entry,reason);
    }

    function unavailableWorker(identifier) {
      return ['service','ticket','quality'].includes(identifier) && !host.getState().agents.find(agent => agent.id === identifier)?.enabled;
    }

    function start(identifier) {
      if(typeof window!=='undefined'&&window.ProjectStudio)window.ProjectStudio.authorizeLegacy(requiredTask(identifier).steps.map(entry=>entry.worker));
      const task = requiredTask(identifier);
      if (!['待开始','已暂停'].includes(task.status)) fail('这个任务当前不能开始或继续。');
      allowed(task.caseId,task.kind);
      if (changed(task)) fail('来源记录已有变化，请先“刷新资料并重跑”。');
      task.status = '排队中';
      event(task,'任务进入调度队列；最多 '+limits.tasks+' 个任务同时推进，同一助手一次执行 '+limits.workerSteps+' 个步骤。');
      saved();pump();return task;
    }

    function submit(caseIds,kind,goal,options={}) {
      if(typeof window!=='undefined'&&window.ProjectStudio)window.ProjectStudio.authorizeLegacy(plan(kind).map(entry=>entry.worker));
      const unique = [...new Set(caseIds)];
      if (!unique.length || unique.length > 4) fail('一次请选择 1 到 4 个授权会话。');
      if (get().tasks.length + unique.length > limits.storedTasks) fail('本地任务数量已达演示上限。');
      unique.forEach(caseId => allowed(caseId,kind));
      if (!kinds[kind] || !goal.trim() || goal.length > 1200) fail('请填写 1200 字以内的有效指令。');
      if (host.isSensitive(goal)) fail('指令含疑似敏感信息，请移除后再演示。');
      const duplicates = unique.map(caseId => get().tasks.find(task => task.caseId === caseId && task.kind === kind && ['排队中','执行中','待确认'].includes(task.status) && task.goal === (goal.replace(/CS-\d+/gi,'').trim() || kinds[kind]))).filter(Boolean);
      if (duplicates.length) fail('已有同样的未结束任务：'+duplicates.map(task => task.id).join('、')+'。请先查看，不重复调度。');
      const tasks = unique.map(caseId => createTask(caseId,kind,goal,options));
      tasks.forEach(task => {task.status='排队中';event(task,'项目助手已安排任务，等待助手空闲。');});
      saved();pump();return tasks;
    }

    function pause(identifier) {
      const task = requiredTask(identifier);
      if (!activeStates.includes(task.status)) fail('只有执行中或排队中的任务可以暂停。');
      stopRunning(task,'人工暂停，尚未执行的本地调用已取消');task.status='已暂停';event(task,'已暂停；已完成步骤保留，未完成步骤不会继续回写。');saved();pump();return task;
    }

    function cancel(identifier) {
      const task = requiredTask(identifier);
      if (['已完成','已取消'].includes(task.status)) fail('这个任务已经结束。');
      stopRunning(task,'人工取消');task.status='已取消';
      task.steps.filter(entry => entry.status==='待执行').forEach(entry => {entry.status='已取消';});
      task.exchanges.filter(exchange => exchange.status==='排队中').forEach(exchange => {exchange.status='已取消';});
      event(task,'任务已取消；历史输出保留，不对客服会话或工单做反向修改。');saved();pump();return task;
    }

    function invalidate(task,identifiers,reason) {
      const affected = new Set(identifiers);
      let expanding = true;
      while (expanding) {
        expanding=false;
        for (const entry of task.steps) if (!affected.has(entry.id) && entry.dependencies.some(dependency => affected.has(dependency))) {affected.add(entry.id);expanding=true;}
      }
      for (const entry of task.steps) if (affected.has(entry.id)) archiveStep(task,entry,reason);
      return [...affected];
    }

    function retry(identifier) {
      if(typeof window!=='undefined'&&window.ProjectStudio)window.ProjectStudio.authorizeLegacy(requiredTask(identifier).steps.map(entry=>entry.worker));
      const task=requiredTask(identifier);
      if (task.status !== '失败') fail('只有失败任务可以重试失败步骤。');
      allowed(task.caseId,task.kind);
      if (changed(task)) fail('资料已变化，请刷新资料后重跑，不沿用旧输入。');
      const failed=task.steps.filter(entry=>entry.status==='失败');
      if (failed.some(entry=>entry.attempts>=limits.attempts)) fail('同一步骤已达到 3 次尝试上限，请人工排查或开启新一轮。');
      invalidate(task,failed.map(entry=>entry.id),'人工重试失败步骤');task.status='排队中';event(task,'仅重试失败步骤及其后续步骤；已完成的独立步骤保留。');saved();pump();return task;
    }

    function rerunKnowledge(identifier) {
      if(typeof window!=='undefined'&&window.ProjectStudio)window.ProjectStudio.authorizeLegacy(requiredTask(identifier).steps.map(entry=>entry.worker));
      const task=requiredTask(identifier);
      if (['已完成','已取消','待开始'].includes(task.status)) fail('请先开始任务；已结束任务应开启新一轮。');
      if (!stepOf(task,'knowledge')) fail('这类任务没有知识检索步骤。');
      allowed(task.caseId,task.kind);
      const latest=capture(task.caseId);
      if (latest.caseSignature !== task.snapshot.caseSignature) fail('客户或工单资料已改变，不能只重查方案；请刷新资料并重跑。');
      task.snapshot=latest;
      const affected=invalidate(task,['knowledge',...task.steps.filter(entry=>entry.id.startsWith('assist-')).map(entry=>entry.id)],'只重查方案');
      task.exchanges.forEach(exchange=>{exchange.status='排队中';});
      task.status='排队中';event(task,'重新核查知识及相关后续步骤，保留已完成的工单草稿。涉及：'+affected.join('、'));saved();pump();return task;
    }

    function refresh(identifier) {
      if(typeof window!=='undefined'&&window.ProjectStudio)window.ProjectStudio.authorizeLegacy(requiredTask(identifier).steps.map(entry=>entry.worker));
      const task=requiredTask(identifier);
      if (activeStates.includes(task.status)) fail('请先暂停当前任务，再刷新资料。');
      allowed(task.caseId,task.kind);
      stopRunning(task,'刷新资料');
      task.steps.forEach(entry=>{archiveStep(task,entry,'刷新资料并重跑');entry.attempts=0;});
      task.round += 1;
      task.snapshot=capture(task.caseId);task.status='排队中';task.exchanges.forEach(exchange=>{exchange.status='排队中';exchange.round=task.round;});
      event(task,'已读取当前授权资料，开启第 '+task.round+' 轮；旧输出、审批和 Trace 仍可追溯。');saved();pump();return task;
    }

    function assist(identifier,from,to,automatic=false) {
      const task=requiredTask(identifier);
      if (['已完成','已取消','待开始','失败'].includes(task.status)) fail('请在任务执行中、暂停或待确认时安排协助。');
      if (!['knowledge','expert'].includes(to)) fail('演示只支持调度知识查找或外部专家模拟端点协助。');
      if (from === to || (from !== 'manager' && !task.steps.some(entry=>entry.worker===from))) fail('发起助手不在当前任务中，或发起方与接收方相同。');
      const existing=task.exchanges.find(exchange=>exchange.from===from && exchange.to===to && exchange.round===task.round);
      if (existing) return existing;
      if (task.exchanges.length >= limits.assists) fail('每个任务最多安排 4 条协作请求，避免循环调度。');
      allowed(task.caseId,task.kind);
      if (changed(task)) fail('资料已有变化，请先刷新，不向协作方发送旧上下文。');
      const identifierStep='assist-'+String(task.exchanges.length+1);
      const exchange={id:task.id+'-A2A-'+String(task.exchanges.length+1),taskId:task.id,round:task.round,stepId:identifierStep,from,to,status:'排队中',mode:'本地协作模拟，非真实 A2A 连接',externalSent:false};
      task.exchanges.push(exchange);
      task.steps.splice(task.steps.length-1,0,step(identifierStep,to,to==='expert'?'请求外部专家协助（模拟）':'追加一次知识核对',to==='expert'?'expert':'assistKnowledge',['context']));
      const anchor=stepOf(task,'reply') || stepOf(task,'quality') || stepOf(task,'result');
      invalidate(task,[anchor.id],'等待新增协作结果');
      if (!anchor.dependencies.includes(identifierStep)) anchor.dependencies.push(identifierStep);
      event(task,(automatic?'知识未匹配，':'根据人工指令，')+names[from]+' 请求 '+names[to]+' 协助；由项目助手校验范围并排队。',from,'a2a-request');
      task.status='排队中';
      if (!automatic) {saved();pump();}
      return exchange;
    }

    function knowledgeResult(task) {
      const item=task.snapshot.item;
      const customers=item.messages.filter(entry=>entry.role==='customer');
      const texts=customers.map(entry=>entry.text).join(' ');
      const latest=customers.at(-1)?.text || '';
      const versions=[...new Set(texts.match(/\bV\d+(?:\.\d+)+\b/gi) || [])];
      const mentions=texts.match(/\b(?:A1|B2|C3)\b/g) || [];
      const modelMismatch=mentions.some(model=>!item.product.includes(model));
      const desired=/更换|换机|退款|赔付/.test(latest)?'KB-0087':/在哪|哪里|查看/.test(latest)&&/版本/.test(latest)?'KB-0101':/黑屏/.test(texts)?'KB-0102':null;
      const documents=task.snapshot.knowledge.filter(entry=>entry.status==='已发布' && entry.id===desired && !modelMismatch && versions.length<=1);
      return {found:documents.length>0,documents,versionConflict:versions.length>1,modelMismatch,source:'任务创建时的本地已发布知识快照',reason:documents.length?'已找到候选资料，仍需核对适用条件。':'没有匹配的已发布资料，不能套用其他产品或旧版本方案。'};
    }

    function execute(task,entry) {
      const snapshot=task.snapshot;
      const item=snapshot.item;
      const lookup=identifier=>stepOf(task,identifier)?.output;
      switch(entry.type) {
        case 'context': return {summary:host.summarize(item,snapshot.ticket),caseId:task.caseId,capturedAt:snapshot.capturedAt,scope:'仅此任务对应授权会话，不含内部备注或其他客户对话'};
        case 'knowledge': case 'assistKnowledge': return knowledgeResult(task);
        case 'draft': {
          if (snapshot.ticket) return {existing:true,ticketId:snapshot.ticket.id,status:snapshot.ticket.status,submitted:false,missing:[],note:'已有工单，不重复建单。'};
          const prepared=window.TicketAssistant.analyze(item);
          const fieldNames={customer:'客户',product:'产品型号',version:'软件版本',type:'工单类型',description:'问题描述',priority:'优先级',department:'受理部门'};
          return {existing:false,product:prepared.values.product||'待确认',softwareVersion:prepared.values.version||'待确认',description:prepared.values.description,department:prepared.values.department||null,missing:prepared.missing.map(key=>fieldNames[key]),sources:prepared.sources,ruleVersion:prepared.ruleVersion,submitted:false};
        }
        case 'lookup':
          if (task.fault==='timeout' && !task.faultConsumed) {task.faultConsumed=true;fail('模拟超时：本地故障注入，未调用真实工单接口。');}
          return {found:!!snapshot.ticket,ticket:clone(snapshot.ticket),source:'本地已有工单记录，非实时查询',externalRequest:false};
        case 'reply': {
          if (task.kind==='lookup') return {text:snapshot.ticket?`目前记录的工单 ${snapshot.ticket.id} 状态是“${snapshot.ticket.status}”。`:'暂未找到当前会话关联的工单，请提供需要查询的工单编号。',source:'本地工单记录，发送前需核实',sent:false};
          const knowledge=lookup('knowledge');
          const latest=item.messages.filter(message=>message.role==='customer').at(-1)?.text || '';
          let text;
          if (/人工/.test(latest)) text='我来接着处理，先核对一下前面的记录。';
          else if (/更换|换机|退款|赔付/.test(latest) || item.priority==='高风险') text='能否更换、是否收费，需要专员核实检测结果和服务政策，目前还不能确定。';
          else if (!knowledge?.found) text='目前没有找到适用的已审核方案，需要技术同事进一步核实。';
          else if (/报修|整理.*单/.test(latest)) text=snapshot.ticket?'已有报修记录，先核对当前工单的处理情况。':'可以，现有信息可以先填进报修草稿，核对后再提交。';
          else text=knowledge.documents[0].content;
          return {text,source:knowledge?.found?knowledge.documents.map(document=>document.id+' / '+document.version).join('、'):'未使用未审核知识',sent:false};
        }
        case 'quality': {
          const reply=lookup('reply')?.text || (task.kind==='review'?item.messages.filter(message=>['agent','staff'].includes(message.role)).at(-1)?.text:'') || '';
          const risk=reply?host.checkRisk(reply):null;
          const draft=lookup('draft');
          const knowledge=lookup('knowledge');
          return {checkedReply:reply,blocking:!!risk,risk:risk?.type || null,missing:draft?.missing || [],knowledgeMatched:knowledge?knowledge.found:null,notes:[...(!reply && task.kind==='review'?['没有可复核的客服回复。']:[]),...(!knowledge?.found && task.kind==='service'?['未匹配适用知识，只能采用澄清或转人工表述。']:[]),'仅通过本地规则不代表回答正确，仍需业务人员核对。'],allowSend:false,allowSubmit:false};
        }
        case 'expert': return {acceptedInDemo:true,externalSent:false,conclusion:null,requiresHumanReview:true,text:'模拟端点已接收这条协作请求；没有真实专家接单或验证结论。'};
        case 'result': return {reply:clone(lookup('reply')),draft:clone(lookup('draft')),knowledge:clone(lookup('knowledge')),lookup:clone(lookup('lookup')),quality:clone(lookup('quality')),assistance:task.steps.filter(step=>step.id.startsWith('assist-')).map(step=>({stepId:step.id,worker:step.worker,output:clone(step.output)})),sent:false,submitted:false,needsHumanReview:true};
        default: fail('没有为此步骤配置本地执行函数。');
      }
    }

    function recordStep(task,entry,input,output,durationMs,status='按预期完成') {
      const injectedTimeout=status==='需排查' && entry.type==='lookup' && task.fault==='timeout';
      return host.record({caseId:task.caseId,taskId:task.id,stepId:entry.id,title:names[entry.worker]+' · '+entry.label,agent:entry.worker,tool:entry.type==='expert'?'mock.a2a.request':'local.manager.'+entry.type,input:{taskId:task.id,round:task.round,stepId:entry.id,caseId:task.caseId,dependencies:entry.dependencies,request:input},output,source:'本地任务快照',durationMs,status,category:injectedTimeout?'工具超时':status==='需排查'?'表达或其他问题':'',fixture:injectedTimeout?{timeout:true}:null,summary:'记录本次本地函数的输入与输出；页面步骤间有演示延迟，不是模型耗时。未对客户发送，未调用真实外部 Agent。'});
    }

    function resultText(entry){
      const output=entry.output;
      if(['knowledge','assistKnowledge'].includes(entry.type))return output.found?'找到候选资料：'+output.documents.map(document=>document.id+' / '+document.version).join('、')+'。适用条件仍需人工核实。':'没有匹配的已发布资料，需要补充依据，不能直接套用旧方案。';
      if(entry.type==='draft')return output.existing?'已有工单 '+output.ticketId+'，不重复建单。':'报修草稿已整理。'+(output.missing.length?'还缺少：'+output.missing.join('、')+'。':'字段已齐备，仍需核对来源。')+'尚未提交。';
      if(entry.type==='reply')return '待审核回复：'+output.text+'\n尚未发送给客户。';
      if(entry.type==='quality')return (output.blocking?'发现需拦截的风险：'+output.risk+'。':'本地检查未命中拦截项。')+(output.missing.length?'仍缺少：'+output.missing.join('、')+'。':'')+'请人工核对依据与承诺。';
      if(entry.type==='expert')return output.text;
      return entry.label+'完成。';
    }

    function launch(task,entry) {
      const stateIdentity=host.getState();
      const token=++entry.token;
      const key=task.id+':'+entry.id;
      entry.status='执行中';entry.startedAt=stamp();task.status='执行中';
      const exchangeInFlight=task.exchanges.find(item=>item.stepId===entry.id);
      if(exchangeInFlight)exchangeInFlight.status='执行中';
      event(task,names[entry.worker]+' 开始“'+entry.label+'”。',entry.worker,'start',{stepId:entry.id,dependencies:[...entry.dependencies],from:[...new Set(entry.dependencies.map(identifier=>stepOf(task,identifier).worker))],round:task.round});
      const timer=setTimeout(()=>{
        const job=jobs.get(key);
        if (!alive || host.getState()!==stateIdentity || !job || job.token!==token || entry.token!==token || entry.status!=='执行中' || !activeStates.includes(task.status)) return;
        jobs.delete(key);
        try {allowed(task.caseId,task.kind);if(unavailableWorker(entry.worker))fail('助手已暂停。');}
        catch(error) {archiveStep(task,entry,'权限或助手状态变化');stopRunning(task,'来源不可用');task.status='已暂停';event(task,error.message+' 未继续执行。');saved();pump();return;}
        entry.attempts+=1;
        const started=performance.now();
        const exchange=task.exchanges.find(item=>item.stepId===entry.id);
        const input=exchange?{messageId:exchange.id,taskId:task.id,from:exchange.from,to:exchange.to,product:task.snapshot.item.product,softwareVersion:task.snapshot.item.version,question:task.snapshot.item.messages.filter(message=>message.role==='customer').at(-1)?.text || '',scope:'仅当前会话',mode:exchange.mode}:entry.dependencies.length?Object.fromEntries(entry.dependencies.map(identifier=>[identifier,clone(stepOf(task,identifier)?.output)])):{item:task.snapshot.item,capturedAt:task.snapshot.capturedAt};
        try {
          entry.output=clean(execute(task,entry));entry.durationMs=performance.now()-started;entry.status='已完成';entry.finishedAt=stamp();
          entry.traceId=recordStep(task,entry,input,entry.output,entry.durationMs);
          if(exchange){exchange.status='已返回';exchange.traceId=entry.traceId;event(task,names[exchange.to]+' 返回协作结果，交回 '+names[exchange.from]+'；没有外发请求。',exchange.to,'a2a-result');}
          event(task,entry.label+'完成。',entry.worker,'finish',{stepId:entry.id,round:task.round,resultText:clean(resultText(entry))});
          if(entry.type==='knowledge' && !entry.output.found && task.kind==='service' && !changed(task)) assist(task.id,'knowledge','expert',true);
          if(entry.type==='result') {task.status='待确认';event(task,'结果已汇总，等待人工核对；回复未发送、工单未提交。');message('manager',task.id+' 已准备好结果，请核对回复、草稿和待补充项。',[task.id]);}
        } catch(error) {
          entry.status='失败';entry.error=clean(error.message);entry.durationMs=performance.now()-started;
          if(exchange)exchange.status='失败';
          entry.traceId=recordStep(task,entry,input,{error:entry.error,attempt:entry.attempts,injected:task.fault==='timeout'},entry.durationMs,'需排查');
          stopRunning(task,'其他步骤失败，停止本轮未完成调用');task.status='失败';event(task,entry.label+'失败：'+entry.error,entry.worker,'failure',{stepId:entry.id,round:task.round});
          message('manager',task.id+' 暂停在“'+entry.label+'”，可查看原因后重试。',[task.id]);
        }
        saved();pump();
      },host.delayMs ?? 850);
      jobs.set(key,{timer,worker:entry.worker,taskId:task.id,stepId:entry.id,token});
    }

    function pump() {
      if (!alive || pumping) return;
      pumping=true;
      try {
        const candidates=get().tasks.filter(task=>activeStates.includes(task.status)).sort((first,second)=>(first.priority==='优先'?0:1)-(second.priority==='优先'?0:1)||first.createdAt.localeCompare(second.createdAt)||first.id.localeCompare(second.id));
        const admitted=new Set([...jobs.values()].map(job=>job.taskId));
        for(const task of candidates) {
          if(!admitted.has(task.id) && admitted.size>=limits.tasks)continue;
          try {allowed(task.caseId,task.kind);}catch(error){stopRunning(task,'来源不可用');task.status='已暂停';admitted.delete(task.id);event(task,error.message);continue;}
          const ready=task.steps.filter(entry=>entry.status==='待执行' && entry.dependencies.every(identifier=>stepOf(task,identifier)?.status==='已完成'));
          for(const entry of ready) {
            if(unavailableWorker(entry.worker)){stopRunning(task,'助手暂停');task.status='已暂停';event(task,names[entry.worker]+' 已暂停，请启用后继续。');break;}
            if([...jobs.values()].filter(job=>job.worker===entry.worker).length>=limits.workerSteps)continue;
            if([...jobs.values()].some(job=>job.taskId!==task.id&&find(job.taskId)?.caseId===task.caseId))continue;
            if(!admitted.has(task.id) && admitted.size>=limits.tasks)break;
            launch(task,entry);admitted.add(task.id);
          }
          if(activeStates.includes(task.status))task.status=[...jobs.values()].some(job=>job.taskId===task.id)?'执行中':'排队中';
          if(![...jobs.values()].some(job=>job.taskId===task.id))admitted.delete(task.id);
        }
      } finally {pumping=false;saved();}
    }

    function review(identifier,approved,note,confirmed) {
      const task=requiredTask(identifier);
      if(task.status!=='待确认')fail('这个任务还没有可审核的完整结果。');
      allowed(task.caseId,task.kind);
      if(changed(task))fail('来源记录已有变化，请刷新资料后再审核。');
      if(!note.trim() || host.isSensitive(note))fail('请填写不含敏感信息的审核说明。');
      if(approved && !confirmed)fail('请确认已核对结果；完成任务不会发送回复或提交工单。');
      if(approved && stepOf(task,'quality')?.output?.blocking)fail('本地检查已拦截风险内容，请先修正，不能直接确认。');
      task.reviews.push({round:task.round,approved,note:clean(note),reviewer:'演示管理员',time:stamp(),sourceSignature:task.snapshot.signature});
      task.status=approved?'已完成':'需修正';event(task,approved?'人工已确认本次准备结果；客户服务状态没有自动改变。':'人工退回修正：'+clean(note),'operator','review');saved();return task;
    }

    function priority(identifier,value) {
      const task=requiredTask(identifier);
      if(!['待开始','排队中','执行中','已暂停'].includes(task.status))fail('当前状态不能调整调度优先级。');
      task.priority=value==='优先'?'优先':'普通';event(task,'优先级调整为'+task.priority+'；不抢占已开始的步骤。','operator');saved();pump();return task;
    }

    function stats() {
      return Object.keys(names).map(worker=>({id:worker,name:names[worker],enabled:!unavailableWorker(worker),capacity:limits.workerSteps,running:[...jobs.values()].filter(job=>job.worker===worker).map(job=>({taskId:job.taskId,stepId:job.stepId})),waiting:get().tasks.filter(task=>activeStates.includes(task.status)).flatMap(task=>task.steps.filter(entry=>entry.worker===worker && entry.status==='待执行').map(entry=>({taskId:task.id,stepId:entry.id})))}));
    }

    function setConcurrency(tasks,workerSteps) {
      if(!Number.isInteger(tasks)||tasks<1||tasks>12||!Number.isInteger(workerSteps)||workerSteps<1||workerSteps>4)fail('任务并行数须为 1–12，单助手并行步骤须为 1–4。');
      limits.tasks=tasks;limits.workerSteps=workerSteps;
      get().concurrency={tasks,workerSteps};saved();pump();
      return {...get().concurrency};
    }

    function dispose() {alive=false;for(const job of jobs.values())clearTimeout(job.timer);jobs.clear();}
    function describePlan(kind) {
      if (!Object.hasOwn(kinds,kind)) fail('不支持这种任务类型。');
      return plan(kind).map(({id,worker,label,dependencies}) => ({id,worker,label,dependencies:[...dependencies]}));
    }
    function reset() {for(const job of jobs.values())clearTimeout(job.timer);jobs.clear();alive=true;host.getState().manager=null;initialize();saved();}
    function initialize() {
      if(!host.getState().manager || host.getState().manager.schema!==1) {
        host.getState().manager={schema:1,sequence:0,tasks:[],messages:[{role:'manager',text:'告诉我需要处理的会话和目标。我会安排助手、收集结果，把需要你确认的内容留在这里。',time:stamp(),taskIds:[]}]};
        const initial=host.getState().cases.find(item=>item.id==='CS-0108');
        if(initial)createTask(initial.id,'service','核对方案，准备回复和报修草稿；先不发送、不提交。',{origin:'预置计划 · 尚未执行'});
      } else {
        for(const task of get().tasks.filter(task=>activeStates.includes(task.status))) {stopRunning(task,'页面重新打开');task.status='已暂停';event(task,'页面重新打开，未完成任务已暂停；请检查后继续，不自动恢复执行。');}
      }
      const stored=get().concurrency;
      limits.tasks=Number.isInteger(stored?.tasks)&&stored.tasks>=1&&stored.tasks<=12?stored.tasks:6;
      limits.workerSteps=Number.isInteger(stored?.workerSteps)&&stored.workerSteps>=1&&stored.workerSteps<=4?stored.workerSteps:2;
      get().concurrency={tasks:limits.tasks,workerSteps:limits.workerSteps};
    }
    initialize();booting=false;
    return {get,find,names,kinds,limits,describePlan,submit,start,pause,cancel,retry,rerunKnowledge,refresh,assist,review,priority,stats,setConcurrency,changed,allowed,message,save:saved,dispose,reset};
  }
};
