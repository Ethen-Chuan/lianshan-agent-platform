window.TraceHub = (() => {
  let host;
  const ui={scope:null,tab:new URLSearchParams(location.search).get('tab')==='traces'?'traces':'overview',traceId:null,spanId:null,badId:null,search:'',agent:'all',status:'all',badStatus:'all',runId:null};
  const basePolicy={strictVersion:false,requireVersion:false,retryTimeout:false,approvalRequired:true};
  const policyFields=[['strictVersion','检索时核对软件版本','不匹配的知识不进入回答'],['requireVersion','建单前检查软件版本','未知版本保留为待补充'],['retryTimeout','工具超时后有限重试','演示重试一次，仍失败则转人工'],['approvalRequired','服务承诺需审批','未获批准不承诺换机或退款']];
  const currentPolicyFields=()=>ui.scope==='analytics'?[]:policyFields;
  const categories=['知识版本不匹配','工单字段缺失','工具超时','未经批准的承诺','表达或其他问题','统计口径错误','统计范围错误','过度归因'];
  const agentNames={manager:'项目助手',knowledge:'知识查找',expert:'外部专家（模拟）',service:'售后接待助手',ticket:'工单填写助手',quality:'对话质检助手',platform:'消息接入',analytics:'大盘助手'};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const root=()=>{ensure();return host.getState().trace;};
  const owner=identifier=>['manager','service','ticket','quality','analytics'].includes(identifier)?identifier:'service';
  function workspaceData(identifier){
    ensure();const data=host.getState().trace;const scoped=data.workspaces[owner(identifier)];
    if(!Object.getOwnPropertyDescriptor(scoped,'traces'))Object.defineProperty(scoped,'traces',{get:()=>data.traces.filter(trace=>trace.spans.some(span=>owner(span.agent)===owner(identifier))),enumerable:false});
    return scoped;
  }
  const get=()=>{if(ui.scope&&ui.scope!=='project')return workspaceData(ui.scope);const data=root();return {...data,badcases:Object.values(data.workspaces).flatMap(workspace=>workspace.badcases),samples:Object.values(data.workspaces).flatMap(workspace=>workspace.samples),runs:Object.values(data.workspaces).flatMap(workspace=>workspace.runs),releases:Object.values(data.workspaces).flatMap(workspace=>workspace.releases)};};
  function setScope(identifier,tab='overview'){
    if(identifier&&!['manager','service','ticket','quality','analytics','project'].includes(identifier))return;
    Object.assign(ui,{scope:identifier,tab,traceId:null,spanId:null,badId:null,search:'',agent:'all',status:'all',badStatus:'all',runId:null});host.closeDialog();host.navigate('agents');
  }
  const stamp=()=>new Date().toLocaleString('zh-CN',{hour12:false});
  const escape=value=>host.escape(value);
  const pill=(text,tone='')=>host.badge(text,tone);
  const action=(text,name,attributes='',tone='')=>host.button(text,'trace-'+name,tone,attributes);
  const tone=status=>/失败|拦截|需排查/.test(status)?'red':/待|处理|进行/.test(status)?'amber':/完成|关闭|通过|生效/.test(status)?'green':'';
  const agentName=identifier=>agentNames[identifier]||identifier;
  const field=(label,value)=>`<div><dt>${escape(label)}</dt><dd>${escape(value??'未记录')}</dd></div>`;
  const option=(value,current,label=value)=>`<option value="${escape(value)}" ${value===current?'selected':''}>${escape(label)}</option>`;
  const safeText=value=>host.isSensitive(String(value))?'[敏感内容已移除]':String(value);
  function sanitize(value){
    if(typeof value==='string')return safeText(value);
    if(Array.isArray(value))return value.map(sanitize);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/^(password|token|api.?key|secret|authorization|cookie)$/i.test(key)).map(([key,entry])=>[key,sanitize(entry)]));
    return value;
  }
  function newId(prefix,items){
    return prefix+(ui.scope&&ui.scope!=='project'&&prefix!=='TR'?'-'+ui.scope:'')+'-'+String(Math.max(0,...items.map(item=>Number(item.id.split('-').at(-1))||0))+1).padStart(4,'0');
  }
  function seed(){
    const makeSpan=(id,parentId,agent,name,tool,status,duration,input,output,summary,category='',fixture=null)=>({id,parentId,agent,name,tool,status,duration,input,output,summary,category,fixture,version:agent==='ticket'?'V1.2':agent==='quality'?'V1.1':'V1.4'});
    const traces=[
      {id:'TR-0104',caseId:'CS-0107',title:'B2 蓝牙断连：知识版本不匹配',channel:'钉钉',created:'11-07 10:39:06',status:'需排查',origin:'预置跨助手样本',duration:2460,input:'升级到 V4.0.2 后蓝牙会断开，已经复现两次。',output:'不采用旧版本方案，等待软件专家。',versions:{service:'V1.4',quality:'V1.1',knowledge:'KB-蓝牙 / V3.9.0（模拟）',prompt:'接待规则 P-07'},spans:[
        makeSpan('SP-01',null,'service','接收问题并分流','local.route','已完成',80,{product:'B2',version:'V4.0.2'},{route:'software_support'},'按已提供的型号和版本分到软件支持。'),
        makeSpan('SP-02','SP-01','service','检索处理方案','knowledge.search','需排查',640,{product:'B2',version:'V4.0.2'},{document:'蓝牙处理方案',version:'V3.9.0',match:'不匹配'},'工具返回旧版本文档；检索结果没有提前过滤。','知识版本不匹配',{requested:'V4.0.2',retrieved:'V3.9.0'}),
        makeSpan('SP-03','SP-01','service','生成候选回复','reply.draft','已完成',990,{knowledgeVersion:'V3.9.0'},{text:'按旧版本方案处理。',sent:false},'候选回复仅用于质检，未发送给客户。'),
        makeSpan('SP-04','SP-03','quality','检查知识适用范围','quality.version_check','已拦截',350,{customerVersion:'V4.0.2',knowledgeVersion:'V3.9.0'},{allowSend:false,reason:'版本不匹配'},'质检规则阻止发送；风险来自上游检索，不是拦截失败。'),
        makeSpan('SP-05','SP-04','service','交给人工处理','handoff.create','已完成',400,{team:'软件专家组'},{task:'演示待办',accepted:false},'已创建待办，专家尚未接单。')],reviewId:'QC-0031'},
      {id:'TR-0103',caseId:'CS-0108',title:'A1 黑屏：接待、填单与确认',channel:'微信客服',created:'11-07 10:42:13',status:'待人工',origin:'预置跨助手样本',duration:1910,input:'重启后仍然黑屏，请帮忙整理报修单。',output:'报修草稿已整理，等待客服确认。',versions:{service:'V1.4',ticket:'V1.2',quality:'V1.1',knowledge:'KB-0102 / V3.2',prompt:'接待规则 P-07'},spans:[
        makeSpan('SP-01',null,'service','整理客户已提供信息','conversation.extract','已完成',330,{product:'A1',version:'V2.3.1',restarted:true},{product:'A1',version:'V2.3.1',fault:'黑屏'},'不重复询问客户已经提供的信息。'),
        makeSpan('SP-02','SP-01','service','查找排查说明','knowledge.search','已完成',470,{product:'A1'},{document:'KB-0102',version:'V3.2'},'引用已发布的 A1 排查指南。'),
        makeSpan('SP-03','SP-01','ticket','填写工单草稿','ticket.prepare','已完成',580,{product:'A1',softwareVersion:'V2.3.1'},{draft:true,department:null,submitted:false},'已提供字段写入草稿，受理部门待选择。'),
        makeSpan('SP-04','SP-03','quality','检查必填项','ticket.validate','已完成',230,{department:null},{missing:['受理部门'],allowSubmit:false},'未填写受理部门，不允许提交。'),
        makeSpan('SP-05','SP-04','ticket','等待客服确认','human.confirm','待确认',300,{draft:true},{submitted:false},'此处尚未创建工单，不能向客户说已报修。') ]},
      {id:'TR-0102',caseId:'CS-0106',title:'查询工单进度：接口超时',channel:'飞书',created:'11-07 10:35:02',status:'需排查',origin:'预置故障注入样本',duration:3200,input:'工单 DEMO-0021 处理到哪一步了？',output:'未取得新状态，已保留原工单信息。',versions:{service:'V1.4',tool:'ticket.get / demo-1'},spans:[
        makeSpan('SP-01',null,'service','查找关联工单','ticket.lookup','已完成',200,{caseId:'CS-0106'},{ticketId:'DEMO-0021'},'工单编号来自已关联记录。'),
        makeSpan('SP-02','SP-01','service','查询工单系统','ticket.get','失败',3000,{ticketId:'DEMO-0021',timeoutMs:3000},{errorCode:'TIMEOUT',attempts:1,received:false},'查询超时，未返回新进度。不能将旧记录当作最新结果。','工具超时',{timeout:true})]},
      {id:'TR-0101',caseId:'CS-0105',title:'换机请求：发送前拦截',channel:'微信客服',created:'11-07 10:28:10',status:'按预期完成',origin:'预置拦截样本',duration:620,input:'能不能保证今天免费更换？',output:'原回复已拦截，交由专员核实。',versions:{quality:'V1.1',policy:'承诺检查 R-02'},spans:[
        makeSpan('SP-01',null,'quality','检查候选回复','quality.promise_check','已拦截',620,{reply:'保证今天免费更换。',approved:false},{allowSend:false,reason:'没有审批'},'风险检查按预期拦截；是否登记问题由复核人员决定。','未经批准的承诺',{approved:false})],reviewId:'QC-0032'}
    ];
    const badcases=[{id:'BC-0001',traceId:'TR-0104',spanId:'SP-02',caseId:'CS-0107',title:'检索结果混入旧版蓝牙方案',category:'知识版本不匹配',severity:'较高',owner:'知识运营组',status:'待分析',cause:'待确认：检索过滤条件未包含软件版本。',expected:'V4.0.2 不应引用 V3.9.0 的处理方案；没有匹配方案时转人工。',fix:'',revision:1,created:'11-07 10:50',history:[{time:'11-07 10:50',text:'从检索步骤登记问题，尚未完成归因。'}]}];
    return {schema:1,traces,badcases,samples:[],runs:[],releases:[],candidate:{version:'DEMO-规则2',revision:1,policy:clone(basePolicy)},active:{version:'DEMO-规则1',policy:clone(basePolicy),releaseId:null}};
  }
  function ensure(){
    if(!host)return;
    if(!host.getState().trace||host.getState().trace.schema!==1)host.getState().trace=seed();
    const data=host.getState().trace;
    if(!data.workspaces){data.workspaces={};for(const identifier of ['service','ticket','quality'])data.workspaces[identifier]={agentId:identifier,projectId:'AFTERSALES',badcases:clone(data.badcases.filter(bad=>owner(data.traces.find(trace=>trace.id===bad.traceId)?.spans.find(span=>span.id===bad.spanId)?.agent)===identifier)),samples:[],runs:[],releases:[],candidate:{version:identifier+' / 规则2',revision:1,policy:clone(basePolicy)},active:{version:identifier+' / 规则1',policy:clone(basePolicy),releaseId:null}};}
    if(!data.workspaces.analytics)data.workspaces.analytics={agentId:'analytics',projectId:'AFTERSALES',badcases:[],samples:[],runs:[],releases:[],candidate:{version:'analytics / 规则2',revision:1,policy:clone(basePolicy)},active:{version:'analytics / 规则1',policy:clone(basePolicy),releaseId:null}};
    if(!data.workspaces.manager)data.workspaces.manager={agentId:'manager',projectId:'AFTERSALES',badcases:[],samples:[],runs:[],releases:[],candidate:{version:'manager / 规则2',revision:1,policy:clone(basePolicy)},active:{version:'manager / 规则1',policy:clone(basePolicy),releaseId:null}};
  }
  function configure(api){host=api;ensure();}
  function importPerformanceSample(identifier){
    const source=window.HubPerformanceData?.requests.find(row=>row.id===identifier);if(!source)return null;
    const data=root();const existing=data.traces.find(trace=>trace.performanceSampleId===source.id);if(existing)return existing.id;
    const statuses={success:'已完成',timeout:'失败',error:'失败',cancelled:'已取消',running:'进行中'};
    const trace=sanitize({id:newId('TR',data.traces),performanceSampleId:source.id,caseId:'',title:source.id+' · 预置性能样本',channel:window.HubAnalyticsData.channels.find(channel=>channel.id===source.channel)?.name||'模拟入口',created:source.date+' '+source.time,importedAt:stamp(),status:['timeout','error'].includes(source.status)?'需排查':source.status==='running'?'待人工':source.status==='cancelled'?'已取消':'按预期完成',origin:'手动导入的预置性能样本（模拟）',duration:source.elapsedMs,input:{sampleId:source.id,source:'固定模拟遥测，无客户原文',snapshotAt:window.HubPerformanceData.snapshotAt},output:{status:source.status,ttftMs:source.ttftMs,endToEndMs:source.endToEndMs,observedMs:source.elapsedMs,attempts:source.attempts},versions:{[source.agent]:source.version,model:source.model+'（预置标签，未调用）'},spans:source.stages.map((stage,index)=>({id:'SP-'+String(index+1).padStart(2,'0'),parentId:null,agent:source.agent,name:stage.name,tool:'fixture.performance.'+stage.key,status:statuses[stage.status],offset:stage.offset,duration:stage.duration,input:{sampleId:source.id,offsetMs:stage.offset},output:{status:stage.status,observedMs:stage.duration,attempts:stage.key==='tool'?source.attempts:[]},summary:'预置阶段事件，仅用于演示定位；'+(stage.status==='running'?'未结束，耗时是等待下限。':'不代表本次调用了真实工具或模型。'),category:'表达或其他问题',fixture:null,version:source.version}))});
    data.traces.unshift(trace);save();return trace.id;
  }
  function save(){host.persist();}
  function history(bad,text){bad.history.unshift({time:stamp(),text});}
  function total(trace){return trace.duration??trace.spans.reduce((sum,span)=>sum+(span.duration||0),0);}
  function duration(value){return value<1000?value+' ms':(value/1000).toFixed(2)+' s';}
  function record({caseId='',title,agent='service',input,output,source='',status='按预期完成',tool='local.serviceReply',durationMs=0,category='',fixture=null,summary='',reviewId=null,spanStatus=null,taskId=null,stepId=null}){
    const data=root();const linked=data.traces.find(entry=>taskId?entry.taskId===taskId:caseId&&entry.caseId===caseId);
    const item=host.getState().cases.find(entry=>entry.id===caseId);
    const current=host.getState().agents.find(entry=>entry.id===agent);
    const trace=sanitize({id:newId('TR',data.traces),caseId,taskId,stepId,title,channel:item?.channelName||'本地测试',created:stamp(),status,origin:'本次本地操作记录',duration:Math.max(0,Math.round(durationMs*100)/100),input,output,parentTraceId:linked?.id||null,versions:{[agent]:current?.version||'demo',knowledge:source||'未使用',model:'未调用',policy:workspaceData(agent).active.version+'（仅离线评测）'},reviewId,spans:[{id:'SP-01',parentId:null,agent,name:title,tool,status:status==='需排查'?'失败':status==='待人工'?'待确认':status==='已取消'?'已取消':'已完成',duration:Math.max(0,Math.round(durationMs*100)/100),input,output,summary:summary||'记录本地函数的输入和返回结果；未推断未执行的步骤。',category,fixture,version:current?.version||'demo'}]});
    if(spanStatus)trace.spans[0].status=spanStatus;
    data.traces.unshift(trace);save();return trace.id;
  }
  function multiAgentScenario(){
    const data=root();const started=performance.now();const spans=[];
    const call=(agent,name,tool,parentId,input,execute,summary)=>{
      const began=performance.now();const output=execute();const current=host.getState().agents.find(entry=>entry.id===agent);
      const span={id:'SP-'+String(spans.length+1).padStart(2,'0'),parentId,agent,name,tool,status:'已完成',offset:began-started,duration:Math.round((performance.now()-began)*100)/100,input,output,summary,version:current?.version||'demo'};spans.push(span);return span;
    };
    const request={text:'A1 黑屏，重启后仍没有恢复，需要报修。',product:'座舱终端 A1',version:'V2.3.1'};
    const route=call('service','整理报修信息','local.route',null,request,()=>({intent:'报修',product:request.product,version:request.version}),'按本次模拟请求整理已明确提供的信息。');
    const knowledge=call('service','查找已发布知识','local.knowledge.find',route.id,{product:request.product},()=>{const entry=host.getState().knowledge.find(entry=>entry.id==='KB-0102'&&entry.status==='已发布');return entry?{found:true,id:entry.id,version:entry.version,title:entry.title}:{found:false};},'直接查询当前 Demo 知识列表，未调用外部检索服务。');
    const reply=call('service','生成本地预设回复','local.serviceReply',route.id,request,()=>host.serviceReply(request.text,{product:request.product,softwareVersion:request.version}),'使用当前本地函数，记录实际返回内容和来源；不对客户发送。');
    const draft=call('ticket','整理工单草稿','local.ticket.prepare',route.id,route.output,()=>({product:route.output.product,softwareVersion:route.output.version,department:null,submitted:false}),'只填写已提供的产品和版本，不自动选择受理部门或提交工单。');
    const guard=call('quality','检查草稿和回复','local.draft.check',draft.id,{draft:draft.output,reply:reply.output.text},()=>({missing:!draft.output.department?['受理部门']:[],risk:host.checkRisk(reply.output.text)?.type||null,allowSubmit:!!draft.output.department}), '检查当前草稿缺项与回复风险，保存本地校验结果。');
    const wait=call('ticket','等待人工补齐并确认','local.confirmation.pending',guard.id,guard.output,()=>({submitted:false,missing:guard.output.missing}),'尚未提交；没有创建真实或模拟业务工单。');wait.status='待确认';
    const currentVersions=Object.fromEntries(host.getState().agents.map(agent=>[agent.id,agent.version]));
    const trace=sanitize({id:newId('TR',data.traces),caseId:'CS-0108',title:'多助手接待：报修草稿待确认',channel:'本地编排模拟',created:stamp(),status:'待人工',origin:'本次本地多助手模拟',duration:Math.round((performance.now()-started)*100)/100,input:request,output:{reply:reply.output.text,draft:draft.output,submitted:false},versions:{...currentVersions,knowledge:knowledge.output.found?knowledge.output.id+' / '+knowledge.output.version:'未命中',model:'未调用'},spans});
    data.traces.unshift(trace);save();return trace.id;
  }
  function tabs(){if(window.AssistantHub)return window.AssistantHub.tabs(ui.scope,ui.tab);return `<nav class="trace-tabs" aria-label="助手管理">${[['overview','助手配置'],['traces','执行追踪'],['badcases','问题案例'],['datasets','回归样本'],['releases','评测与发布']].map(([key,title])=>`<button class="${ui.tab===key?'active':''}" data-action="trace-tab" data-value="${key}" aria-current="${ui.tab===key?'page':'false'}">${title}${key==='badcases'?`<span>${get().badcases.filter(item=>item.status!=='已关闭').length}</span>`:''}</button>`).join('')}</nav>`;}
  function page(overview){
    ensure();
    if(!ui.scope)return overview();
    if(ui.scope==='project')return `<div class="trace-module"><div class="assistant-owner-note">项目级关联追踪 · 只汇总执行，不共用助手的评测与发布空间。</div>${ui.traceId?detail():list()}</div>`;
    const content=ui.tab==='overview'?window.ProjectHub.assistantOverview(ui.scope)+preview():ui.tab==='traces'?(ui.traceId?detail():list()):ui.tab==='badcases'?(ui.badId?badDetail():badList()):ui.tab==='datasets'?datasets():releases();
    return `<div class="trace-module">${window.ProjectHub.assistantHeader(ui.scope)}${tabs()}${content}</div>`;
  }
  function preview(){return `<section class="panel section-spacer"><div class="panel-title"><div><h2>执行追踪</h2><p>从具体步骤登记问题，跟进修正和回归测试。</p></div>${action('查看全部','tab','data-value="traces"','small')}</div>${traceTable(get().traces.slice(0,3))}</section>`;}
  function filtered(){return get().traces.filter(trace=>(ui.agent==='all'||trace.spans.some(span=>span.agent===ui.agent))&&(ui.status==='all'||trace.status===ui.status)&&(!ui.search||[trace.id,trace.caseId,trace.title,JSON.stringify(trace.input),...trace.spans.flatMap(span=>[span.tool,span.name,span.category])].join(' ').toLowerCase().includes(ui.search.toLowerCase())));}
  function traceTable(traces){return `<div class="table-wrap trace-table"><table><thead><tr><th>执行 / 关联问题</th><th>参与助手</th><th>结果</th><th>耗时</th><th>时间</th><th></th></tr></thead><tbody>${traces.map(trace=>`<tr><td><strong>${escape(trace.title)}</strong><span class="sub">${escape(trace.id)} · ${escape(trace.caseId||'未关联会话')} · ${escape(trace.channel)}</span></td><td>${[...new Set(trace.spans.map(span=>span.agent))].map(agent=>pill(agentName(agent))).join(' ')}</td><td>${pill(trace.status,tone(trace.status))}</td><td>${duration(total(trace))}</td><td>${escape(trace.created)}</td><td>${action('查看步骤','open',`data-id="${trace.id}"`,'small')}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">没有符合条件的执行记录，请调整筛选条件。</div></td></tr>'}</tbody></table></div>`;}
  function list(){
    const traces=filtered();
    return `${host.heading('执行追踪','查看助手的调用记录，定位失败、拦截和待确认步骤。',action('导出当前筛选','export','','')+action(ui.scope==='analytics'?'开始问数':'新增模拟执行','scenario','','primary'))}<div class="trace-disclaimer">${host.icon('info-circle','small')}全部为本地模拟。预置样本的耗时为示例，本次操作耗时仅代表本地函数执行；未调用真实模型，不记录隐式思考。</div><div class="trace-summary"><span>当前筛选 <b>${traces.length}</b> 条</span><span>需排查 <b>${traces.filter(trace=>trace.status==='需排查').length}</b></span><span>待人工 <b>${traces.filter(trace=>trace.status==='待人工').length}</b></span><span>已登记问题 <b>${get().badcases.filter(bad=>traces.some(trace=>trace.id===bad.traceId)).length}</b></span></div><div class="filters"><label class="search-field">${host.icon('search','small')}<input id="trace-search" aria-label="搜索执行记录" placeholder="搜索问题或执行编号" value="${escape(ui.search)}"></label><select class="select" id="trace-agent" aria-label="筛选助手">${option('all',ui.agent,'全部助手')}${Object.entries(agentNames).map(([id,name])=>option(id,ui.agent,name)).join('')}</select><select class="select" id="trace-status" aria-label="筛选执行结果">${option('all',ui.status,'全部结果')}${['需排查','待人工','按预期完成','已取消'].map(status=>option(status,ui.status)).join('')}</select></div>${traceTable(traces)}`;
  }
  function openTrace(identifier,spanId){const trace=root().traces.find(entry=>entry.id===identifier);if(trace&&ui.scope!=='project'){const span=trace.spans.find(entry=>entry.id===spanId)||trace.spans.find(entry=>entry.category)||trace.spans[0];ui.scope=owner(span.agent);}else if(!ui.scope)ui.scope='project';if(!trace)return host.toast('没有找到执行记录。',true);host.closeDialog();ui.tab='traces';ui.traceId=identifier;ui.spanId=spanId||trace.spans.find(span=>span.category)?.id||trace.spans[0].id;host.navigate('agents');}
  function detail(){
    const trace=get().traces.find(entry=>entry.id===ui.traceId);if(!trace){ui.traceId=null;return list();}
    const span=trace.spans.find(entry=>entry.id===ui.spanId)||trace.spans[0];
    const linked=get().traces.filter(entry=>entry.id!==trace.id&&trace.caseId&&entry.caseId===trace.caseId);
    const bad=get().badcases.find(entry=>entry.traceId===trace.id&&entry.spanId===span.id);
    return `<div class="trace-back">${action('返回执行列表','back-traces','','small')}${trace.taskId?host.button('返回项目助手任务','manager-open','small',`data-id="${trace.taskId}"`):''}<span>${escape(trace.id)}${trace.parentTraceId?' · 关联上次执行 '+escape(trace.parentTraceId):''}</span></div>${host.heading(escape(trace.title),'执行记录保留原始快照；修正结果另行记录。',action(bad?'查看问题 '+bad.id:'登记问题案例',bad?'bad-open':'bad-new',bad?`data-id="${bad.id}"`:`data-id="${trace.id}" data-span="${span.id}"`,'primary'))}<div class="trace-overview"><div>${pill(trace.status,tone(trace.status))}${pill(trace.origin)}<p>${escape(typeof trace.input==='string'?trace.input:JSON.stringify(trace.input))}</p></div><dl class="trace-meta">${field('总耗时',duration(total(trace)))}${field('来源',trace.channel)}${field('关联会话',trace.caseId||'独立测试')}${field('模型 / 计费','未调用 / 不计费')}</dl></div><div class="trace-detail-layout"><section class="trace-span-list" aria-label="执行步骤"><div class="trace-section-label">步骤 <span>${trace.spans.length}</span></div><ol>${trace.spans.map((entry,index)=>`<li><button data-action="trace-span" data-id="${entry.id}" class="trace-step ${entry.id===span.id?'selected':''}" aria-pressed="${entry.id===span.id}"><span class="trace-step-index">${index+1}</span><span class="trace-step-content"><strong>${escape(entry.name)}</strong><small>${escape(agentName(entry.agent))} · ${escape(entry.tool)}</small><span>${pill(entry.status,tone(entry.status))}<small>${duration(entry.duration)}</small></span></span></button></li>`).join('')}</ol></section><section class="trace-inspector"><div class="between"><div><div class="trace-section-label">${escape(span.id)}${span.parentId?' · 上级 '+escape(span.parentId):' · 根步骤'}</div><h2>${escape(span.name)}</h2></div>${pill(span.status,tone(span.status))}</div><dl class="trace-meta">${field('执行助手',agentName(span.agent))}${field('工具 / 函数',span.tool)}${field('助手版本',span.version)}${field('耗时',duration(span.duration))}</dl><section class="trace-explanation"><h3>处理依据与结果</h3><p>${escape(span.summary)}</p>${span.category?`<p class="trace-issue-label">待排查方向：${escape(span.category)} · 需人工确认归因</p>`:''}</section><div class="trace-io"><details open><summary>输入参数</summary><pre>${escape(JSON.stringify(span.input,null,2))}</pre></details><details open><summary>返回结果</summary><pre>${escape(JSON.stringify(span.output,null,2))}</pre></details></div>${bad?`<div class="trace-linked-case">${pill(bad.status,tone(bad.status))}<span>${escape(bad.title)}</span>${action('跟进 '+bad.id,'bad-open',`data-id="${bad.id}"`,'small')}</div>`:''}<details class="trace-versions"><summary>版本快照与记录说明</summary><pre>${escape(JSON.stringify(trace.versions,null,2))}</pre><p>这里只展示调用数据、规则依据与处理摘要。工具返回成功不代表答案正确；拦截也不必然是系统故障。</p></details></section></div><div class="trace-bottom"><div><h3>本次输出</h3><p>${escape(typeof trace.output==='string'?trace.output:JSON.stringify(trace.output))}</p></div><div class="row">${trace.caseId?host.button('查看会话','open-case','small',`data-id="${trace.caseId}"`):''}${trace.reviewId?host.button('查看质检','review-detail','small',`data-id="${trace.reviewId}"`):''}</div></div>${linked.length?`<section class="section-spacer"><h3 class="trace-section-label">同一问题的其他执行</h3>${traceTable(linked)}</section>`:''}`;
  }
  function badList(){
    const cases=get().badcases.filter(bad=>ui.badStatus==='all'||bad.status===ui.badStatus);
    return `${host.heading('问题案例','记录出错步骤、归因、修正方案和验证结果。',action('从执行记录登记','tab','data-value="traces"','primary'))}<div class="trace-workflow">登记问题 <span>›</span> 人工归因 <span>›</span> 加入回归样本 <span>›</span> 对比评测 <span>›</span> 审核发布</div><div class="filters"><select class="select" id="trace-bad-status" aria-label="筛选问题状态">${option('all',ui.badStatus,'全部状态')}${['待分析','处理中','待回归','待发布','已关闭'].map(status=>option(status,ui.badStatus)).join('')}</select><span class="muted">${cases.length} 个问题 · 原始执行记录不被修正覆盖</span></div><div class="table-wrap trace-table"><table><thead><tr><th>问题</th><th>归因分类</th><th>负责人</th><th>状态</th><th>回流记录</th><th></th></tr></thead><tbody>${cases.map(bad=>`<tr><td><strong>${escape(bad.title)}</strong><span class="sub">${bad.id} · ${bad.traceId} / ${bad.spanId}</span></td><td>${escape(bad.category)}<span class="sub">${escape(bad.severity)}</span></td><td>${escape(bad.owner)}</td><td>${pill(bad.status,tone(bad.status))}</td><td>${escape(bad.releaseId||bad.sampleId||'未入样本集')}</td><td>${action('跟进问题','bad-open',`data-id="${bad.id}"`,'small')}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">没有这个状态的问题。可从执行步骤登记新的案例。</div></td></tr>'}</tbody></table></div>`;
  }
  function newBad(traceId,spanId){
    const trace=root().traces.find(entry=>entry.id===traceId);const span=trace?.spans.find(entry=>entry.id===spanId);if(!span)return;
    ui.scope=owner(span.agent);
    const existing=get().badcases.find(bad=>bad.traceId===traceId&&bad.spanId===spanId);if(existing){ui.badId=existing.id;ui.tab='badcases';return host.render();}
    host.showDialog('登记问题案例',`${trace.id} / ${span.id} · 原始输入输出随案例关联。`,`<form id="trace-bad-form"><div class="field"><label for="trace-bad-title">问题标题 *</label><input id="trace-bad-title" required maxlength="100" value="${escape(span.name+'需要复核')}"></div><div class="form-grid section-spacer"><div class="field"><label for="trace-bad-category">问题分类</label><select id="trace-bad-category">${categories.map(category=>option(category,span.category||categories.at(-1))).join('')}</select></div><div class="field"><label for="trace-bad-owner">负责人</label><select id="trace-bad-owner"><option>知识运营组</option><option>客服主管</option><option>工具维护组</option><option>服务运营组</option></select></div></div><label class="check-label"><input id="trace-bad-consent" type="checkbox"><span>已确认这是需要跟进的问题，并检查关联内容；不将每次拦截都视为缺陷。</span></label><div id="trace-form-error" class="inline-error" role="alert"></div></form>`,host.footer('登记问题','trace-bad-create',`data-id="${traceId}" data-span="${spanId}"`));
  }
  function badDetail(){
    const bad=get().badcases.find(entry=>entry.id===ui.badId);if(!bad){ui.badId=null;return badList();}
    const trace=get().traces.find(entry=>entry.id===bad.traceId);const span=trace.spans.find(entry=>entry.id===bad.spanId);const sample=get().samples.find(entry=>entry.id===bad.sampleId);
    return `<div class="trace-back">${action('返回问题列表','back-bad','','small')}<span>${bad.id} · 修订 ${bad.revision}</span></div>${host.heading(escape(bad.title),'填写归因和预期行为，确认后加入回归样本。',action('查看原始步骤','open',`data-id="${bad.traceId}" data-span="${bad.spanId}"`))}<div class="trace-bad-layout"><section class="panel"><div class="between"><h2>问题处理</h2>${pill(bad.status,tone(bad.status))}</div><form id="trace-analysis-form"><div class="form-grid section-spacer"><div class="field"><label for="trace-analysis-category">归因分类</label><select id="trace-analysis-category">${categories.map(category=>option(category,bad.category)).join('')}</select></div><div class="field"><label for="trace-analysis-owner">负责人</label><select id="trace-analysis-owner">${['知识运营组','客服主管','工具维护组','服务运营组'].map(owner=>option(owner,bad.owner)).join('')}</select></div><div class="field full"><label for="trace-analysis-cause">人工归因 *</label><textarea id="trace-analysis-cause" required maxlength="1200" placeholder="是哪一步、哪个条件导致了问题？">${escape(bad.cause)}</textarea></div><div class="field full"><label for="trace-analysis-expected">预期行为 / 验收标准 *</label><textarea id="trace-analysis-expected" required maxlength="1200">${escape(bad.expected)}</textarea></div><div class="field full"><label for="trace-analysis-fix">修正方案 *</label><textarea id="trace-analysis-fix" required maxlength="1200" placeholder="例如：检索条件增加软件版本；未命中时转人工。">${escape(bad.fix)}</textarea></div></div><div id="trace-form-error" class="inline-error" role="alert"></div><div class="trace-form-actions">${action('保存分析','analysis-save',`data-id="${bad.id}"`,'primary')}${action(sample?'更新回归样本':'加入回归样本','sample-confirm',`data-id="${bad.id}"`,bad.fix?'':'')}${bad.knowledgeId?host.button('查看知识草稿','knowledge-detail','',`data-id="${bad.knowledgeId}"`):action('转为知识草稿','knowledge-confirm',`data-id="${bad.id}"`)}</div></form><p class="trace-note">编辑后需重新保存样本并评测。原始错误记录和已发布版本不会被覆盖。</p></section><aside><section class="panel"><h2>关联证据</h2><dl class="trace-meta">${field('执行',trace.id+' / '+span.id)}${field('助手',agentName(span.agent))}${field('工具',span.tool)}${field('来源',trace.channel)}</dl><p class="trace-evidence">${escape(span.summary)}</p><details class="trace-versions"><summary>原始输入与输出</summary><pre>${escape(JSON.stringify({input:span.input,output:span.output},null,2))}</pre></details><div class="trace-sample-link"><span>${sample?sample.id+' · 样本修订 '+sample.revision:'尚未加入样本集'}</span>${sample?action('查看样本','tab','data-value="datasets"','small'):''}</div></section><section class="panel section-spacer"><h2>处理记录</h2><ol class="trace-history">${bad.history.map(entry=>`<li><time>${escape(entry.time)}</time><p>${escape(entry.text)}</p></li>`).join('')}</ol></section></aside></div>`;
  }
  function fixtureFor(bad){
    const trace=get().traces.find(entry=>entry.id===bad.traceId);const span=trace.spans.find(entry=>entry.id===bad.spanId);
    return span.category===bad.category&&span.fixture?clone(span.fixture):null;
  }
  function sampleConfirm(identifier){
    const bad=get().badcases.find(entry=>entry.id===identifier);if(!bad?.fix||!bad.expected||bad.cause.length<4)return host.toast('请先保存归因、预期行为和修正方案。',true);
    const dirty=[['trace-analysis-category','category'],['trace-analysis-owner','owner'],['trace-analysis-cause','cause'],['trace-analysis-expected','expected'],['trace-analysis-fix','fix']].some(([id,key])=>document.getElementById(id)&&document.getElementById(id).value.trim()!==bad[key]);
    if(dirty)return host.toast('当前还有未保存的修改，请先保存分析。',true);
    const fixture=fixtureFor(bad);
    host.showDialog('确认回流到回归样本','仅写入本地样本集，不自动训练、修改知识或发送客户消息。',`<dl class="trace-meta">${field('问题案例',bad.id)}${field('验收分类',bad.category)}${field('来源步骤',bad.traceId+' / '+bad.spanId)}</dl><h3>人工预期</h3><p class="trace-evidence">${escape(bad.expected)}</p><details class="trace-versions" open><summary>可执行检查输入</summary><pre>${escape(JSON.stringify(fixture||{manualReview:'无适配器，需人工验证'},null,2))}</pre><p>${fixture?'只验证对应规则分支，不评估开放式回答正确率。':'此案例没有可执行检查，只能标记为待人工验证，不能自动通过发布。'}</p></details><label class="check-label"><input id="trace-sample-consent" type="checkbox"><span>已确认预期行为、来源权限和脱敏结果，可作为本地回归样本。</span></label>`,host.footer('确认加入样本','trace-sample-add',`data-id="${identifier}"`));
  }
  function datasets(){
    const data=get();
    return `${host.heading('回归样本','保存错误输入、预期行为和来源版本，评测记录保留当时的快照。',action('进入评测','tab','data-value="releases"','primary'))}<div class="trace-disclaimer">${host.icon('database','small')}数据回流需要人工确认；样本不直接写入正式知识库，不触发模型训练。</div><div class="trace-summary"><span>样本总数 <b>${data.samples.length}</b></span><span>有可执行检查 <b>${data.samples.filter(sample=>sample.fixture).length}</b></span><span>仅人工验证 <b>${data.samples.filter(sample=>!sample.fixture).length}</b></span></div>${data.samples.length?data.samples.map(sample=>`<details class="trace-dataset"><summary><span><strong>${escape(sample.title)}</strong><small>${sample.id} · ${sample.badId} · 修订 ${sample.revision}</small></span>${pill(sample.fixture?'可执行检查':'待人工验证',sample.fixture?'green':'amber')}</summary><div><p><b>预期行为：</b>${escape(sample.expected)}</p><p><b>归因分类：</b>${escape(sample.category)} · 确认人：${escape(sample.approvedBy)}</p><div class="trace-io"><pre>${escape(JSON.stringify(sample.input,null,2))}</pre><pre>${escape(JSON.stringify(sample.fixture||{manual:true},null,2))}</pre></div><div class="trace-form-actions">${action('查看问题','bad-open',`data-id="${sample.badId}"`,'small')}${action('查看来源','open',`data-id="${sample.traceId}" data-span="${sample.spanId}"`,'small')}</div></div></details>`).join(''):`<div class="empty trace-empty">还没有回归样本。<p>先在问题案例中填写修正方案，再确认加入。</p>${action('查看问题案例','tab','data-value="badcases"','primary')}</div>`}`;
  }
  function evaluate(sample,policy){
    if(!sample.fixture)return {status:'待人工',output:{reason:'没有可执行检查'},check:'需专家验证开放式结果'};
    const input=sample.fixture;let output;let passed=false;let check='';
    if(sample.category==='知识版本不匹配'){
      output=policy.strictVersion&&input.requested!==input.retrieved?{decision:'转人工',usedKnowledge:false}:{decision:'使用检索结果',usedKnowledge:true};passed=!output.usedKnowledge;check='不使用不匹配版本的知识';
    }else if(sample.category==='工单字段缺失'){
      output=policy.requireVersion&&!input.softwareVersion?{created:false,decision:'等待补充软件版本'}:{created:true,decision:'提交工单'};passed=!output.created;check='软件版本缺失时不提交';
    }else if(sample.category==='工具超时'){
      output=policy.retryTimeout?{attempts:2,decision:'转人工',errorVisible:true,success:false}:{attempts:1,decision:'结束',errorVisible:false,success:false};passed=output.attempts===2&&output.errorVisible&&output.decision==='转人工';check='重试一次后仍失败，保留错误并转人工';
    }else if(sample.category==='未经批准的承诺'){
      output={allowSend:!(policy.approvalRequired&&!input.approved)};passed=!output.allowSend;check='未审批的承诺不得发送';
    }else return {status:'待人工',output:{reason:'无适配规则'},check:'人工验证'};
    return {status:passed?'通过':'未通过',output,check};
  }
  function currentRun(){return get().runs.find(run=>run.id===ui.runId)||get().runs[0];}
  function candidateDirty(){
    const field=document.getElementById('trace-candidate-version');if(!field)return false;
    return field.value.trim()!==get().candidate.version||currentPolicyFields().some(([key])=>document.getElementById('trace-policy-'+key).checked!==get().candidate.policy[key]);
  }
  function fingerprint(){const data=get();return JSON.stringify({candidate:data.candidate,active:data.active,samples:data.samples.map(sample=>({id:sample.id,revision:sample.revision,badRevision:sample.badRevision,sourceRevision:data.badcases.find(bad=>bad.id===sample.badId)?.revision}))});}
  function runRegression(){
    const data=get();if(!data.samples.length)return host.toast('请先添加回归样本。',true);
    if(candidateDirty())return host.toast('候选规则有未保存的修改，请先保存。',true);
    if(data.samples.some(sample=>data.badcases.find(bad=>bad.id===sample.badId)?.revision!==sample.badRevision))return host.toast('问题分析已更新，请先更新对应回归样本。',true);
    const began=performance.now();const results=data.samples.map(sample=>({sample:clone(sample),baseline:evaluate(sample,data.active.policy),candidate:evaluate(sample,data.candidate.policy)}));
    const guardPassed=ui.scope!=='analytics'&&data.candidate.policy.approvalRequired===true;
    const run={id:newId('RUN',data.runs),created:stamp(),fingerprint:fingerprint(),baseline:clone(data.active),candidate:clone(data.candidate),results,guard:{name:ui.scope==='analytics'?'问数自动回归适配器尚未接入':'未审批承诺仍需拦截',passed:guardPassed},duration:Math.max(0,performance.now()-began),status:guardPassed&&results.every(result=>result.candidate.status==='通过')?'待人工审核':'未通过'};
    data.runs.unshift(run);ui.runId=run.id;
    data.badcases.forEach(bad=>{if(results.some(result=>result.sample.badId===bad.id)&&bad.status!=='已关闭'){bad.status=run.status==='待人工审核'?'待发布':'待回归';history(bad,run.id+'：'+run.status+'（规则检查，不代表业务正确率）');}});save();host.render();host.toast('评测完成，逐项检查见下方。');
  }
  function releases(){
    const data=get();const run=currentRun();
    return `${host.heading('评测与发布','对比基线与候选规则；检查通过后，仍需人工审核。',action('运行回归检查','run','','primary'))}<div class="trace-disclaimer">${host.icon('info-circle','small')}这是隔离的离线规则评测。发布只更新演示评测策略，不修改接待回复逻辑、真实模型或正式知识。</div><div class="trace-release-layout"><section class="panel"><div class="panel-title"><div><h2>候选修正</h2><p>当前基线：${escape(data.active.version)} · 候选修订 ${data.candidate.revision}</p></div></div><div class="field"><label for="trace-candidate-version">候选版本名称</label><input id="trace-candidate-version" maxlength="60" value="${escape(data.candidate.version)}"></div>${ui.scope==='analytics'?'<p class="trace-note">本助手独立保留问数样本、预期结果和候选版本。统计口径与归因目前需人工验证，自动回归适配器尚未接入，不会自动通过发布；不使用接待或填单的规则代替。</p>':''}<div class="trace-policy-fields">${currentPolicyFields().map(([key,label,description])=>`<label><input id="trace-policy-${key}" type="checkbox" ${data.candidate.policy[key]?'checked':''}><span><strong>${label}</strong><small>${description}</small></span></label>`).join('')}</div>${action('保存候选规则','candidate-save','','')}${action('审核发布','publish-confirm','','primary')}<p class="trace-note">更改候选规则或样本后，旧评测仍可查看，但不能用于发布。</p></section><section class="panel"><div class="panel-title"><div><h2>评测记录</h2><p>验证检查项是否通过，不作为回答准确率。</p></div></div>${data.runs.length?`<select class="select" id="trace-run" aria-label="选择评测记录">${data.runs.map(entry=>option(entry.id,run?.id,entry.id+' · '+entry.created)).join('')}</select><div class="trace-run-stats"><div><span>基线通过</span><strong>${run.results.filter(result=>result.baseline.status==='通过').length} / ${run.results.length}</strong></div><div><span>候选通过</span><strong>${run.results.filter(result=>result.candidate.status==='通过').length} / ${run.results.length}</strong></div><div><span>本地检查耗时</span><strong>${duration(Math.round(run.duration*100)/100)}</strong></div></div>${pill(run.status,tone(run.status))} ${pill(run.guard?.passed?'守护检查通过':'守护检查未通过',run.guard?.passed?'green':'red')} ${run.fingerprint!==fingerprint()?pill('配置或样本已变化','amber'):pill('快照一致','green')}<p class="trace-note">守护检查：${escape(run.guard?.name||'未审批承诺仍需拦截')}。</p>${run.review?`<p class="trace-note">人工审核：${escape(run.review.note)}</p>`:''}<p class="trace-note">${escape(run.baseline.version)} 对比 ${escape(run.candidate.version)}，只检查所列故障样本。</p>`:'<div class="trace-empty">尚未运行评测。保存候选规则后，运行回归检查。</div>'}</section></div>${run?`<section class="section-spacer"><h3 class="trace-section-label">${run.id} · 逐样本对比</h3>${run.results.map(result=>`<details class="trace-dataset" open><summary><span><strong>${escape(result.sample.title)}</strong><small>${result.sample.id} · ${escape(result.candidate.check)}</small></span>${pill(result.candidate.status,result.candidate.status==='通过'?'green':'amber')}</summary><div class="trace-io"><section><h4>基线输出 · ${escape(result.baseline.status)}</h4><pre>${escape(JSON.stringify(result.baseline.output,null,2))}</pre></section><section><h4>候选输出 · ${escape(result.candidate.status)}</h4><pre>${escape(JSON.stringify(result.candidate.output,null,2))}</pre></section></div></details>`).join('')}</section>`:''}<section class="panel section-spacer"><div class="panel-title"><h2>发布与回退记录</h2>${pill('演示环境')}</div>${data.releases.length?`<div class="table-wrap trace-table"><table><thead><tr><th>发布</th><th>状态</th><th>评测依据</th><th>审核说明</th><th></th></tr></thead><tbody>${data.releases.map(release=>`<tr><td><strong>${escape(release.version)}</strong><span class="sub">${release.id} · ${escape(release.created)}</span></td><td>${pill(release.status,tone(release.status))}</td><td>${release.runId}</td><td>${escape(release.note)}</td><td>${data.active.releaseId===release.id?action('回退','rollback-confirm',`data-id="${release.id}"`,'small'):''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">尚未发布。样本确认、检查通过和人工审核缺一不可。</p>'}</section>`;
  }
  function canPublish(run){return run&&run.status==='待人工审核'&&run.guard?.passed&&run.fingerprint===fingerprint()&&run.results.length>0&&run.results.every(result=>result.candidate.status==='通过');}
  function publishConfirm(){
    if(candidateDirty())return host.toast('候选规则有未保存的修改，请先保存并重新评测。',true);
    const run=currentRun();if(!canPublish(run))return host.toast('需要当前版本的全样本通过记录；配置、样本变化后请重新评测。',true);
    host.showDialog('审核并发布到演示评测环境',`${run.id} · ${escape(run.candidate.version)} · ${run.results.length} 个回归样本`, `<p class="trace-evidence">请核实归因、预期行为及输出对比。发布后关联问题标记为已关闭，并保留原始错误和回归记录。</p><div class="field"><label for="trace-review-decision">审核结论</label><select id="trace-review-decision"><option value="approve">通过，发布到演示评测环境</option><option value="reject">不通过，继续修正</option></select><label for="trace-release-note">审核依据 *</label><textarea id="trace-release-note" maxlength="1200" placeholder="记录核对了哪些输出，以及仍然存在的适用范围限制。"></textarea></div><label class="check-label"><input id="trace-publish-consent" type="checkbox"><span>已人工审核全部样本。只发布本地评测规则，不修改生产系统、模型或知识库。</span></label><div id="trace-form-error" class="inline-error" role="alert"></div>`,host.footer('保存审核结果','trace-publish',`data-id="${run.id}"`));
  }
  function inputError(text){const element=document.getElementById('trace-form-error');if(element)element.textContent=text;else host.toast(text,true);}
  function scenario(){
    host.showDialog('新增模拟执行','用于演示 Trace 与问题登记，不接入真实工具。',`<div class="field"><label for="trace-scenario">选择场景</label><select id="trace-scenario"><option value="multi">多助手接待：报修草稿待确认</option><option value="missing">工单缺少软件版本</option><option value="timeout">工单查询超时</option><option value="good">正常版本查询</option><option value="active">回放当前评测版本（首个样本）</option></select></div><p class="trace-note">故障场景将注入预设错误；正常场景调用本地回复函数。</p>`,host.footer('运行模拟场景','trace-scenario-run'));
  }
  function showExport(){
    const traces=filtered();host.showDialog('导出当前筛选记录','只下载到本机，不上传数据。',`<p class="trace-evidence">包含 ${traces.length} 条执行记录及其关联问题、样本、评测与发布快照。自动扫描会移除疑似敏感内容；不能替代人工审核。</p><label class="check-label"><input id="trace-export-consent" type="checkbox"><span>已核对本次筛选内容和导出用途。</span></label>`,host.footer('下载 JSON','trace-export-confirm'));
  }
  function exportPayload(){
    const data=get();const traces=filtered();const badcases=data.badcases.filter(bad=>traces.some(trace=>trace.id===bad.traceId));const samples=data.samples.filter(sample=>badcases.some(bad=>bad.id===sample.badId));
    const runs=data.runs.filter(run=>run.results.some(result=>badcases.some(bad=>bad.id===result.sample.badId))).map(run=>({...run,results:run.results.filter(result=>badcases.some(bad=>bad.id===result.sample.badId)),exportScope:'仅保留筛选相关结果，不作为完整发布包'}));
    return sanitize({schema:'ServiceHub-trace-demo-1',environment:'本地模拟',traces,badcases,samples,runs,releases:data.releases.filter(release=>runs.some(run=>run.id===release.runId)).map(release=>({...release,scope:'仅含关联发布说明'}))});
  }
  function dispatch(name,element){
    if(['manager','service','ticket','quality','analytics'].includes(element.dataset.owner)&&ui.scope!==element.dataset.owner)Object.assign(ui,{scope:element.dataset.owner,tab:'overview',traceId:null,spanId:null,badId:null,search:'',agent:'all',status:'all',badStatus:'all',runId:null});
    const data=get();const identifier=element.dataset.id;const value=element.dataset.value;
    switch(name){
      case 'tab':host.closeDialog();ui.tab=value;ui.traceId=null;ui.badId=null;return host.navigate('agents');
      case 'open':return openTrace(identifier,element.dataset.span);
      case 'review-open':{const review=host.getState().reviews.find(entry=>entry.id===identifier);if(review)return openReview(review);return;}
      case 'span':ui.spanId=identifier;return host.render();
      case 'back-traces':ui.traceId=null;return host.render();
      case 'back-bad':ui.badId=null;return host.render();
      case 'bad-new':return newBad(identifier,element.dataset.span);
      case 'bad-open':host.closeDialog();ui.tab='badcases';ui.badId=identifier;return host.navigate('agents');
      case 'bad-create':{
        const title=document.getElementById('trace-bad-title').value.trim();if(title.length<4||title.length>100)return inputError('标题请填写 4–100 个字。');
        if(host.isSensitive(title))return inputError('请移除敏感信息。');
        if(!document.getElementById('trace-bad-consent').checked)return inputError('请确认问题和关联内容已经复核。');
        const existing=data.badcases.find(bad=>bad.traceId===identifier&&bad.spanId===element.dataset.span);if(existing){host.closeDialog();ui.tab='badcases';ui.badId=existing.id;return host.navigate('agents');}
        const trace=data.traces.find(entry=>entry.id===identifier);const span=trace?.spans.find(entry=>entry.id===element.dataset.span);if(!span)return;
        const bad={agentId:ui.scope,projectId:'AFTERSALES',id:newId('BC',data.badcases),traceId:trace.id,spanId:span.id,caseId:trace.caseId,title,category:document.getElementById('trace-bad-category').value,owner:document.getElementById('trace-bad-owner').value,severity:'普通',status:'待分析',cause:'',expected:'',fix:'',revision:1,created:stamp(),history:[{time:stamp(),text:'从执行步骤登记，等待人工分析。'}]};data.badcases.unshift(bad);save();host.closeDialog();ui.tab='badcases';ui.badId=bad.id;host.navigate('agents');return host.toast('问题已登记。');}
      case 'analysis-save':{
        const bad=data.badcases.find(entry=>entry.id===identifier);const values={category:document.getElementById('trace-analysis-category').value,owner:document.getElementById('trace-analysis-owner').value,cause:document.getElementById('trace-analysis-cause').value.trim(),expected:document.getElementById('trace-analysis-expected').value.trim(),fix:document.getElementById('trace-analysis-fix').value.trim()};
        if([values.cause,values.expected,values.fix].some(text=>text.length<4||text.length>1200))return inputError('请填写归因、预期行为和修正方案（每项 4–1200 字）。');
        if(Object.values(values).some(host.isSensitive))return inputError('请移除敏感信息后保存。');
        if(Object.entries(values).every(([key,entry])=>bad[key]===entry))return host.toast('内容未变化。');
        Object.assign(bad,values);bad.revision++;bad.status='处理中';history(bad,'保存人工归因和修正方案；需更新回归样本。');save();host.render();return host.toast('分析已保存。');}
      case 'sample-confirm':return sampleConfirm(identifier);
      case 'knowledge-confirm':{
        const bad=data.badcases.find(entry=>entry.id===identifier);if(!bad?.fix||!bad.expected)return host.toast('请先保存修正方案和预期行为。',true);
        if(bad.knowledgeId)return host.toast('已经有对应草稿，请直接查看。');
        return host.showDialog('转为待审核知识草稿','不直接写入正式知识，也不供自动回复使用。',`<p class="trace-evidence">将 ${escape(bad.id)} 的归因、预期和修正提案保存为候选知识。需要专家确认是否适合作为处理方案。</p><label class="check-label"><input id="trace-knowledge-consent" type="checkbox"><span>确认这是待核实提案，后续仍需知识审核。</span></label>`,host.footer('创建待审核草稿','trace-knowledge-create',`data-id="${bad.id}"`));}
      case 'knowledge-create':{
        if(!document.getElementById('trace-knowledge-consent').checked)return host.toast('请先确认草稿用途。',true);
        const bad=data.badcases.find(entry=>entry.id===identifier);if(bad.knowledgeId)return;
        const knowledge=host.getState().knowledge;const caseItem=host.getState().cases.find(entry=>entry.id===bad.caseId);
        const draft={id:newId('KB',knowledge),title:'待核实：'+bad.title,category:'问题回流',product:caseItem?.product||'待确认',version:'草稿',status:'待审核',owner:bad.owner,date:'11-08',content:`来源：${bad.id} / ${bad.traceId} / ${bad.spanId}\n人工归因：${bad.cause}\n预期行为：${bad.expected}\n修正提案：${bad.fix}\n此草稿尚未经过专家验证，不能用于自动回复。`,badCaseId:bad.id};
        knowledge.unshift(draft);bad.knowledgeId=draft.id;history(bad,'创建待审核知识草稿 '+draft.id+'，未发布。');save();host.closeDialog();host.render();return host.toast('已创建待审核草稿。');}
      case 'sample-add':{
        if(!document.getElementById('trace-sample-consent').checked)return host.toast('请先确认预期、权限和脱敏结果。',true);
        const bad=data.badcases.find(entry=>entry.id===identifier);if(!bad?.fix)return;
        const trace=data.traces.find(entry=>entry.id===bad.traceId);const span=trace.spans.find(entry=>entry.id===bad.spanId);const existing=data.samples.find(sample=>sample.badId===bad.id);
        const sample=sanitize({id:existing?.id||newId('DS',data.samples),badId:bad.id,traceId:trace.id,spanId:span.id,title:bad.title,category:bad.category,input:span.input,observed:span.output,expected:bad.expected,fixture:fixtureFor(bad),sourceVersions:trace.versions,revision:(existing?.revision||0)+1,badRevision:bad.revision,approvedBy:'演示管理员',owner:bad.owner,approvedAt:stamp()});
        if(existing)data.samples.splice(data.samples.indexOf(existing),1,sample);else data.samples.unshift(sample);bad.sampleId=sample.id;bad.status='待回归';history(bad,'已确认回流至 '+sample.id+' 修订 '+sample.revision+'；未训练或发布。');save();host.closeDialog();host.render();return host.toast('样本已保存，等待回归检查。');}
      case 'candidate-save':{
        const version=document.getElementById('trace-candidate-version').value.trim();if(version.length<3||version.length>60||host.isSensitive(version))return host.toast('请填写不含敏感信息的候选版本名称（3–60 字）。',true);
        const policy={...data.candidate.policy,...Object.fromEntries(currentPolicyFields().map(([key])=>[key,document.getElementById('trace-policy-'+key).checked]))};
        if(version===data.candidate.version&&JSON.stringify(policy)===JSON.stringify(data.candidate.policy))return host.toast('候选规则未变化。');
        data.candidate={version,policy,revision:data.candidate.revision+1};save();host.render();return host.toast('候选已保存，请重新评测。');}
      case 'run':return runRegression();
      case 'publish-confirm':return publishConfirm();
      case 'publish':{
        const run=data.runs.find(entry=>entry.id===identifier);if(!canPublish(run))return inputError('评测已失效或已发布，请重新运行。');
        const note=document.getElementById('trace-release-note').value.trim();if(note.length<8||note.length>1200)return inputError('请填写至少 8 字的审核依据。');
        if(host.isSensitive(note))return inputError('审核依据含疑似敏感信息，请移除。');
        if(document.getElementById('trace-review-decision').value==='reject'){
          run.status='审核未通过';run.review={decision:'未通过',note,reviewer:'演示管理员',time:stamp()};
          run.results.forEach(result=>{const bad=data.badcases.find(entry=>entry.id===result.sample.badId);if(bad&&bad.status!=='已关闭'){bad.status='待回归';history(bad,run.id+' 人工审核未通过：'+note);}});save();host.closeDialog();host.render();return host.toast('已记录审核意见，未发布。');
        }
        if(!document.getElementById('trace-publish-consent').checked)return inputError('请先确认已人工审核。');
        if(data.releases.some(release=>release.version===run.candidate.version)||data.active.version===run.candidate.version)return inputError('版本名称已使用，请使用新版本名称并重新评测。');
        const release={agentId:ui.scope,projectId:'AFTERSALES',id:newId('REL',data.releases),version:run.candidate.version,policy:clone(run.candidate.policy),previous:clone(data.active),runId:run.id,note,reviewer:'演示管理员',created:stamp(),status:'已生效'};
        const previous=data.releases.find(entry=>entry.id===data.active.releaseId);if(previous)previous.status='已替代';
        data.releases.unshift(release);data.active={version:release.version,policy:clone(release.policy),releaseId:release.id};run.status='已发布';run.review={decision:'通过',note,reviewer:'演示管理员',time:stamp()};
        run.results.forEach(result=>{const bad=data.badcases.find(entry=>entry.id===result.sample.badId);if(bad&&bad.status!=='已关闭'){bad.status='已关闭';bad.releaseId=release.id;history(bad,release.id+' 已审核发布到离线演示评测环境。');}});save();host.closeDialog();host.render();return host.toast('演示评测策略已发布；未更改生产系统。');}
      case 'rollback-confirm':{
        const release=data.releases.find(entry=>entry.id===identifier);if(data.active.releaseId!==identifier)return;
        return host.showDialog('回退演示评测规则',`${escape(release.version)} 回退到 ${escape(release.previous.version)}`,`<p class="trace-evidence">关联的已关闭问题将重新进入待回归。历史执行、样本、评测和发布记录都会保留。</p>`,host.footer('确认回退','trace-rollback',`data-id="${identifier}"`));}
      case 'rollback':{
        const release=data.releases.find(entry=>entry.id===identifier);if(data.active.releaseId!==identifier)return;
        data.active=clone(release.previous);release.status='已回退';release.rolledBackAt=stamp();const previous=data.releases.find(entry=>entry.id===data.active.releaseId);if(previous)previous.status='已生效';
        data.badcases.forEach(bad=>{if(bad.releaseId===identifier&&bad.status==='已关闭'){bad.status='待回归';history(bad,identifier+' 已回退，重新验证修正。');}});save();host.closeDialog();host.render();return host.toast('已回退，关联问题重新进入待回归。');}
      case 'scenario':return ui.scope==='analytics'?host.navigate('dashboard'):scenario();
      case 'scenario-run':{
        const chosen=document.getElementById('trace-scenario').value;const started=performance.now();let entry;
        if(chosen==='multi'){const identifier=multiAgentScenario();host.closeDialog();return openTrace(identifier);}
        if(chosen==='active'){
          const sample=data.samples[0];if(!sample)return host.toast('请先加入至少一个回归样本。',true);
          const result=evaluate(sample,data.active.policy);entry={title:'当前评测版本回放：'+sample.title,caseId:data.badcases.find(bad=>bad.id===sample.badId)?.caseId||'',input:sample.fixture,output:result.output,status:result.status==='通过'?'按预期完成':'需排查',tool:'sandbox.evaluatePolicy',category:sample.category,fixture:sample.fixture,summary:data.active.version+' 对来源样本 '+sample.id+' 的离线回放；不对客户发送。'};
        }else if(chosen==='missing')entry={caseId:'CS-0108',title:'故障注入：工单缺少软件版本',agent:'ticket',input:{product:'A1',softwareVersion:null},output:{draft:true,softwareVersion:'被错误补为默认值',submitted:false},category:'工单字段缺失',fixture:{softwareVersion:null},status:'需排查',tool:'demo.ticket.prepare',summary:'故障注入：未知版本被补成默认值。尚未提交；应改为待确认。'};
        else if(chosen==='timeout')entry={caseId:'CS-0106',title:'故障注入：工单查询超时',input:{ticketId:'DEMO-0021'},output:{errorCode:'TIMEOUT',received:false},category:'工具超时',fixture:{timeout:true},status:'需排查',tool:'demo.ticket.get',summary:'预置超时结果，未访问真实接口，也未取得新状态。'};
        else {const prompt='A1 怎么查看软件版本？';const response=host.serviceReply(prompt);entry={title:'本地版本查询',input:prompt,output:response.text,source:response.source,status:response.handoff?'待人工':'按预期完成'};}
        const traceId=record({...entry,durationMs:performance.now()-started});host.closeDialog();return openTrace(traceId);}
      case 'export':return showExport();
      case 'export-confirm':{
        if(!document.getElementById('trace-export-consent').checked)return host.toast('请先核对导出用途和内容。',true);
        const blob=new Blob([JSON.stringify(exportPayload(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='连山_Trace_模拟脱敏记录.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);host.closeDialog();return host.toast('已下载筛选相关记录，未上传。');}
    }
  }
  function change(identifier,value){
    if(identifier==='trace-agent')ui.agent=value;
    else if(identifier==='trace-status')ui.status=value;
    else if(identifier==='trace-bad-status')ui.badStatus=value;
    else if(identifier==='trace-run')ui.runId=value;
    else return;
    host.render();
  }
  function search(value){ui.search=value;const input=document.getElementById('trace-search');const caret=input?.selectionStart;host.render();const fresh=document.getElementById('trace-search');fresh?.focus();if(caret!==null&&caret!==undefined)fresh?.setSelectionRange(caret,caret);}
  function openCase(caseId){ui.scope='project';const trace=root().traces.find(entry=>entry.caseId===caseId);if(trace)return openTrace(trace.id);ui.tab='traces';ui.traceId=null;ui.search=caseId;ui.agent='all';ui.status='all';host.navigate('agents');host.toast('此会话暂无执行记录；后续模拟操作会记录。');}
  function openReview(review){ui.scope='quality';const existing=root().traces.find(trace=>trace.id===review.traceId||trace.reviewId===review.id);if(existing)return openTrace(existing.id);const id=record({caseId:review.caseId,title:'质检复核记录',agent:'quality',input:review.answer,output:review.reason,status:'待人工',tool:'local.review',reviewId:review.id,summary:'关联已有质检记录，不含历史工具调用步骤。'});openTrace(id);}
  function openTask(taskId){ui.scope='project';ui.tab='traces';ui.traceId=null;ui.search=taskId;ui.agent='all';ui.status='all';host.navigate('agents');}
  return {configure,page,record,importPerformanceSample,workspaceData,setScope,currentScope:()=>ui.scope,currentTab:()=>ui.tab,openTask,dispatch,change,search,openCase,openReview,ensure,exportPayload,reset(){ui.scope=null;ui.tab='overview';ui.traceId=null;ui.badId=null;ui.search='';ui.agent='all';ui.status='all';ui.runId=null;ensure();}};
})();
