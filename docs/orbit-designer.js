window.OrbitDesigner=(()=>{
  let host;let connection=null;let checked=false;let loading=false;let connectionError='';let pending=null;let voice=null;let latestVoice=null;let captured=null;
  const views=new Map();const policy=window.OrbitDesignerPolicy;
  const current=()=>window.PortfolioHub.navProject();
  const workspace=()=>window.ProjectStudio.data();
  const flow=()=>window.OrbitFlow;
  const local=()=>!window.LIANSHAN_PUBLIC_DEMO&&location.protocol==='http:'&&location.hostname==='127.0.0.1';
  const active=()=>!!current()&&host.getView().page==='orbit'&&(!window.ProjectStudio.orbitSection||window.ProjectStudio.orbitSection()==='workbench')&&window.OrbitWorkbench.view().section==='compose'&&window.OrbitWorkbench.view().mode==='prompt';
  const escape=value=>host.escape(String(value??''));
  const button=(label,name,attributes='',tone='quiet small')=>host.button(label,'od-'+name,tone,attributes);
  const persist=()=>window.PortfolioHub.persist();
  const signature=()=>connection?connection.csrf+':'+connection.meta.revision:'';
  const business=()=>!!window.OrbitBusiness&&view().purpose!=='flow';
  const inputData=()=>business()?window.OrbitBusiness.data():data();
  function data(){return workspace().businessDesigner||=( {input:'',history:[],referenceIds:[],proposal:null,cases:[],caseInput:'',simulation:null} );}
  function view(){if(!views.has(current().id))views.set(current().id,{selected:'',zoom:.8,error:'',errorMode:'generate',consent:'',simulationConsent:'',ack:false,reviewed:'',voiceNotice:false});return views.get(current().id);}
  function referenceData(){
    return window.OrbitOntology.data().nodes.filter(node=>data().referenceIds.includes(node.id)).map(node=>({id:node.id,projectId:current().id,name:node.name,type:node.type,description:node.description||'',fields:node.fields||''}));
  }
  const sourceSnapshot=()=>JSON.stringify(flow().data());
  const referenceSnapshot=()=>JSON.stringify(referenceData());
  const repaint=()=>{if(active())host.render();};
  function stop(message='已停止生成，原设计未修改；已发出的请求仍可能计费。'){
    if(!pending)return;const request=pending;pending=null;request.controller.abort();request.state.error=message;repaint();
  }
  function invalidate(){stop('模型连接有变化，请刷新后重新确认。');connection=null;checked=false;for(const state of views.values()){state.consent='';state.simulationConsent='';}}
  async function refresh(){
    if(loading)return;checked=true;connectionError='';
    if(!local()){connection=null;connectionError='在线静态演示不调用模型。请在本机服务版使用描述生成功能。';repaint();return;}
    loading=true;repaint();
    try{
      const response=await fetch('/api/model-connections',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw Error('本机模型服务不可用。');
      const result=await response.json();const meta=result.connections?.find(entry=>entry.agentId==='manager');
      if(result.mode!=='local-server'||!result.capabilities?.includes('orbit-designer-v1')||!meta||typeof result.csrf!=='string')throw Error('当前服务还未加载流程生成功能，请启动更新后的本机服务。');
      const previous=signature();connection={csrf:result.csrf,meta,capabilities:result.capabilities};if(previous!==signature())for(const state of views.values()){state.consent='';state.simulationConsent='';}
    }catch(error){connection=null;connectionError=error.message==='Failed to fetch'?'无法连接本机服务，请重试。':error.message;}
    finally{loading=false;repaint();}
  }
  function mergeGraph(base,next){
    const graph={...structuredClone(base),name:next.name,layout:next.layout,nodes:next.nodes.map(node=>({...node,x:base.nodes.find(entry=>entry.id===node.id)?.x||60,y:base.nodes.find(entry=>entry.id===node.id)?.y||60})),edges:next.edges.map(edge=>({...edge}))};
    const structure=value=>JSON.stringify({nodes:value.nodes.map(node=>node.id),edges:value.edges.map(edge=>[edge.from,edge.to]),layout:value.layout});
    if(structure(base)!==structure(graph)){
      const arranged=flow().arrange(graph);const occupied=[];
      for(const node of arranged.nodes){const original=base.nodes.find(entry=>entry.id===node.id);if(original&&base.layout===graph.layout){node.x=original.x;node.y=original.y;occupied.push(node);}}
      for(const node of arranged.nodes.filter(entry=>!base.nodes.some(original=>original.id===entry.id)||base.layout!==graph.layout)){
        const position=flow().freePosition({nodes:occupied},node.id,node.x,node.y);Object.assign(node,position);occupied.push(node);
      }
      return arranged;
    }
    return graph;
  }
  function proposalValid(){const proposal=data().proposal;return !!proposal&&proposal.snapshot===sourceSnapshot()&&proposal.referenceSnapshot===referenceSnapshot();}
  async function send(mode='generate'){
    if(mode==='generate'&&business())return sendDefinitions();
    if(!active()||pending)return;
    const storage=data();const state=view();state.error='';state.errorMode=mode;
    const consentKey=mode==='simulate'?'simulationConsent':'consent';
    if(!connection?.meta.configured||state[consentKey]!==signature()){state.error='请连接模型，并确认本次发送范围与费用。';repaint();return;}
    if(flow().hasEdits()){state.error='画布有未保存的编辑，请先保存后再生成。';repaint();return;}
    if(mode==='simulate'&&storage.proposal){state.error='请先采用或放弃待确认的修改，再试跑当前流程。';repaint();return;}
    const base=structuredClone(flow().data());const target=mode==='generate'&&proposalValid()?storage.proposal.graph:base;
    const prompt=mode==='simulate'?storage.caseInput:storage.input;
    const payload={agentId:'manager',projectId:current().id,expectedRevision:connection.meta.revision,consent:true,prompt,graph:policy.projectGraph(target),history:mode==='generate'?storage.history.slice(-12).map(({role,content})=>({role,content})):[],references:referenceData(),selectedNode:target.nodes.some(node=>node.id===state.selected)?state.selected:''};
    let context;try{context=policy.prepare(payload,mode);}catch(error){state.error=error.message;repaint();return;}
    stopVoice(true);
    const request={controller:new AbortController(),state,storage,projectId:current().id,context:connection,snapshot:JSON.stringify(base),references:referenceSnapshot(),mode};
    pending=request;state.consent='';state.simulationConsent='';storage.simulation=null;state.ack=false;repaint();
    const timer=setTimeout(()=>request.controller.abort(),50000);
    try{
      const response=await fetch('/api/orbit-designer/'+mode,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Session':request.context.csrf},body:JSON.stringify(payload),signal:request.controller.signal});
      let result;try{result=await response.json();}catch{throw Error('服务未返回有效结果，原流程没有修改。');}
      if(!response.ok)throw Error(result.error||'模型请求未完成，请手动重试。');
      if(pending!==request||request.controller.signal.aborted)return;
      if(!active()||current().id!==request.projectId||sourceSnapshot()!==request.snapshot||referenceSnapshot()!==request.references||signature()!==request.context.csrf+':'+request.context.meta.revision)throw Error('项目、流程、引用或连接有变化，已丢弃这次结果。');
      if(result.origin!=='model'||result.projectId!==request.projectId||result.revision!==payload.expectedRevision||result.provider!==request.context.meta.provider||result.model!==request.context.meta.model||result.externalActions!==0)throw Error('模型结果来源不匹配，未采用。');
      if(mode==='generate'){
        const proposal=policy.parseProposal(result.result,context);
        storage.history.push({role:'user',content:prompt},{role:'assistant',content:proposal.message+(proposal.questions.length?'\n'+proposal.questions.join('\n'):'')});
        storage.history=storage.history.slice(-12);storage.input='';
        if(proposal.graph){
          const next=mergeGraph(target,proposal.graph);const errors=flow().validate(next);if(errors.length)throw Error(errors.join(' '));
          next.designerReferences={projectId:request.projectId,revision:window.OrbitOntology.data().revision,nodes:structuredClone(payload.references)};
          storage.proposal={graph:next,snapshot:request.snapshot,referenceSnapshot:request.references,questions:proposal.questions,message:proposal.message,cases:proposal.cases,changes:window.OrbitCopilot.differences(base,next),model:result.model};
        }else if(storage.proposal){storage.proposal.questions=proposal.questions;storage.proposal.message=proposal.message;}
      }else storage.simulation={...policy.parseSimulation(result.result,context),snapshot:request.snapshot,references:request.references,input:prompt,model:result.model};
      persist();
    }catch(error){if(pending===request)state.error=request.controller.signal.aborted?'请求已停止或超时；原流程未修改，可以手动重试。':error.message;}
    finally{clearTimeout(timer);if(pending===request){pending=null;repaint();}}
  }
  async function sendDefinitions(){
    if(!active()||pending)return;
    const state=view();state.error='';state.errorMode='generate';const designer=window.OrbitBusiness;
    if(!connection?.meta.configured||state.consent!==signature()){state.error='请连接模型，并确认本次发送范围与费用。';repaint();return;}
    if(!connection.capabilities.includes('orbit-definitions-v1')){state.error='当前服务尚未加载业务定义生成功能，请更新本机服务后刷新连接。';repaint();return;}
    let payload,context;try{payload=designer.request(connection.meta);context=window.OrbitBusinessPolicy.prepare(payload);}catch(error){state.error=error.message;repaint();return;}
    stopVoice(true);
    const request={controller:new AbortController(),state,storage:designer.data(),projectId:current().id,context:connection,snapshot:designer.snapshot(),mode:'define'};
    pending=request;state.consent='';state.ack=false;repaint();const timer=setTimeout(()=>request.controller.abort(),50000);
    try{
      const response=await fetch('/api/orbit-designer/define',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Session':request.context.csrf},body:JSON.stringify(payload),signal:request.controller.signal});
      let result;try{result=await response.json();}catch{throw Error('服务未返回有效结果，原设计未修改。');}
      if(!response.ok)throw Error(result.error||'模型请求未完成，请手动重试。');
      if(pending!==request||request.controller.signal.aborted)return;
      if(!active()||!business()||current().id!==request.projectId||designer.snapshot()!==request.snapshot||signature()!==request.context.csrf+':'+request.context.meta.revision)throw Error('项目、定义、助手或连接已变化，未采用这次结果。');
      if(result.origin!=='model'||result.projectId!==request.projectId||result.revision!==payload.expectedRevision||result.provider!==request.context.meta.provider||result.model!==request.context.meta.model||result.externalActions!==0)throw Error('模型结果来源不匹配，未采用。');
      designer.receive(result.result,context,request.snapshot,result.model);persist();
    }catch(error){if(pending===request)state.error=request.controller.signal.aborted?'请求已停止或超时，原设计未修改；已发送的请求仍可能计费。':error.message;}
    finally{clearTimeout(timer);if(pending===request){pending=null;repaint();}}
  }
  function adopt(){
    if(!proposalValid())throw Error('原流程或引用定义已变化，请重新生成，避免覆盖你的编辑。');
    const proposal=data().proposal;
    if(!view().ack)throw Error('请先核对本次修改与待确认事项。');
    flow().applyDraft(proposal.graph,proposal.snapshot);data().cases=proposal.cases;data().proposal=null;data().simulation=null;view().ack=false;view().reviewed='';persist();repaint();host.toast('流程草稿已保存，可撤销；未发布或执行。');
  }
  function assistantDraft(){
    const graph=data().proposal?.graph||flow().data();
    if(!graph.nodes.length)return {scene:null,config:null,error:''};
    const snapshot=JSON.stringify(graph);
    const scene=workspace().scenes.slice().reverse().find(entry=>entry.projectId===current().id&&JSON.stringify(entry.config.flowDesign?.graph)===snapshot);
    try{return {scene,config:flow().compile(graph,current().id),error:''};}catch(error){return {scene,config:null,error:error.message};}
  }
  function saveAssistant(){
    if(data().proposal)throw Error('请先采用修改，并核对当前流程。');
    const draft=assistantDraft();
    if(draft.scene){window.ProjectStudio.openScene(draft.scene.id);return draft.scene;}
    if(view().reviewed!==sourceSnapshot())throw Error('请先采用修改，并核对当前流程。');
    if(draft.error||!draft.config)throw Error(draft.error||'请先完成业务流程。');
    const config=draft.config;config.flowDesign.confirmed=true;config.businessDesign.confirmed=true;
    const scene=window.ProjectStudio.createFromOntology(config);
    if(scene&&scene.config.flowDesign?.flowId===config.flowDesign.flowId){scene.samples=data().cases.map(entry=>({id:'SAMPLE-'+crypto.randomUUID(),input:entry.input,expected:entry.expected,approved:false,source:'模型建议 · 待人工核对'}));persist();host.render();}
    host.toast('已保存助手草案与待审核案例，尚未发布。');
    return scene;
  }
  function selectReference(id){
    if(pending)throw Error('请先停止生成，再调整引用。');
    if(!window.OrbitOntology.data().nodes.some(node=>node.id===id))return;
    if(!data().referenceIds.includes(id)){if(data().referenceIds.length>=8)throw Error('一次最多引用 8 项定义。');data().referenceIds.push(id);}
    view().consent='';view().simulationConsent='';persist();
  }
  function removeReference(id){
    if(pending)throw Error('请先停止生成，再调整引用。');
    data().referenceIds=data().referenceIds.filter(identifier=>identifier!==id);view().consent='';view().simulationConsent='';persist();
  }
  function definitionsChanged(id){
    if(business()){if(pending?.mode==='define')stop('业务定义有变化，请核对后重新生成。');view().consent='';view().ack=false;}
    if(!(workspace().businessDesigner?.referenceIds||[]).includes(id))return;
    if(pending?.projectId===current().id)stop('引用定义已更新，请重新核对后生成。');
    view().consent='';view().simulationConsent='';view().ack=false;
  }
  function stopVoice(abort=false){const session=voice||latestVoice;if(!session)return;if(abort)session.cancelled=true;if(!voice)return;voice=null;clearTimeout(session.timer);abort?session.recognition.abort():session.recognition.stop();repaint();}
  function startVoice(){
    if(!local()||!active()||document.hidden||pending||voice)return;
    view().error='';view().errorMode='generate';
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){view().voiceNotice=false;view().errorMode='generate';view().error='此浏览器不支持语音转文字，可使用系统听写或直接输入。';repaint();document.getElementById('od-input')?.focus({preventScroll:true});return;}
    const projectId=current().id;const storage=inputData();const original=storage.input;const recognition=new Recognition();const session={recognition,projectId,timer:null};
    recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=false;
    recognition.onresult=event=>{
      if(session.cancelled||latestVoice!==session||!active()||current().id!==projectId)return;
      let transcript='';for(let index=0;index<event.results.length;index++)if(event.results[index].isFinal)transcript+=event.results[index][0].transcript;
      const next=original+transcript;if(next.length>2400||policy.sensitive(next)){view().error='识别内容过长或含疑似敏感信息，未写入；请手动检查。';stopVoice(true);return;}
      storage.input=next;view().consent='';persist();repaint();
    };
    recognition.onerror=()=>{if(session.cancelled||voice!==session)return;if(current()?.id===projectId){view().error='语音识别未完成，请检查麦克风权限或改用文字输入。';}stopVoice(true);};
    recognition.onend=()=>{session.cancelled=true;if(voice===session){clearTimeout(session.timer);voice=null;repaint();}};
    try{voice=session;latestVoice=session;recognition.start();session.timer=setTimeout(()=>stopVoice(),90000);view().voiceNotice=false;repaint();}catch{session.cancelled=true;voice=null;view().error='无法启动语音识别，请使用文字输入。';repaint();}
  }
  function draftFooter(busy){
    const draft=assistantDraft();
    if(draft.scene)return `<footer class="od-draft-handoff"><div><strong>已保存：${escape(draft.scene.config.name)}</strong><p>继续在原草案中配置和审核案例，不重复创建。</p></div><div>${button('继续配置','open-draft',busy?'disabled':'','small')}${button('审核案例','open-tests',busy?'disabled':'','primary small')}</div></footer>`;
    return `<footer class="od-draft-handoff"><div>${draft.error?`<p class="od-error" role="status">暂不能保存为助手：${escape(draft.error)}</p>`:`<label class="od-consent"><input id="od-reviewed" type="checkbox" ${view().reviewed===sourceSnapshot()?'checked':''} ${busy?'disabled':''}><span>已核对当前流程。下一步审核案例，不直接发布。</span></label>`}</div>${button('保存为助手草案','save-assistant',busy||draft.error||view().reviewed!==sourceSnapshot()?'disabled':'','primary small')}</footer>`;
  }
  function testingSection(graph,sequence,simulation,busy,meta){
    const storage=data();const state=view();const consent=!!signature()&&state.simulationConsent===signature();
    return `<section class="od-testing"><header><div><h3>用一个案例检查流程</h3><p>模型推演不执行真实工具，也不自动算作验收通过。</p></div>${storage.cases.map((entry,index)=>button(escape(entry.name),'case',`data-index="${index}"`, 'quiet small')).join('')}</header><form id="od-test-form"><div class="od-test-input"><label class="sr-only" for="od-case">案例内容</label><textarea id="od-case" maxlength="2400" rows="2" ${busy?'disabled':''} placeholder="输入正常、资料缺失或需要人工处理的业务案例">${escape(storage.caseInput)}</textarea><label class="od-consent"><input id="od-test-consent" type="checkbox" ${consent?'checked':''} ${busy||!meta?.configured?'disabled':''}><span>同意本次将案例、当前流程和所选业务定义发给 ${escape(meta?.configured?window.HubModelProviders.providers[meta.provider].name:'所选模型')}，可能产生费用。仅使用脱敏内容。</span></label></div><div class="od-test-actions">${!meta?.configured?button('先连接模型','configure','','small'):''}<button class="button small" type="submit" ${busy||!meta?.configured||!consent?'disabled':''}>试跑这个案例</button></div></form>${state.error&&state.errorMode==='simulate'?`<p class="od-error" role="alert">${escape(state.error)}</p>`:''}${simulation?`<div class="od-simulation"><strong>${{prepared:'到达结果节点',missing:'等待补充信息',handoff:'停在人工确认'}[simulation.outcome]} · 待人工核对</strong><ol>${simulation.steps.map(step=>`<li><b>${sequence[step.nodeId]}</b><span>${escape(graph.nodes.find(node=>node.id===step.nodeId)?.name)}：${escape(step.summary)}</span></li>`).join('')}</ol><p>${escape(simulation.reply)}</p>${simulation.missing.length?`<p>缺少：${simulation.missing.map(escape).join('、')}</p>`:''}</div>`:''}${draftFooter(busy)}</section>`;
  }
  function composerInput(storage,state,graph,busy,meta){
    const listening=!!voice;
    const voiceIcon=`<svg class="od-voice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${listening?'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>':'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M9 21h6"/>'}</svg>`;
    return `<div class="od-input-box${listening?' is-listening':''}">
      <label class="sr-only" for="od-input">业务描述或修改要求</label>
      <textarea id="od-input" name="prompt" rows="5" maxlength="2400" ${busy?'disabled':''} placeholder="${business()?'描述服务对象、业务规则和例外情况，也可以点麦克风输入。':'输入业务描述，或点麦克风说一段。也可以说“修改第 3 步”。'}">${escape(storage.input)}</textarea>
      ${state.voiceNotice?`<div id="od-voice-notice" class="od-voice-notice" role="group" aria-label="语音输入确认"><p>浏览器可能将音频发送给语音识别服务。识别文字填入这里，核对后再发送。</p><div>${button('同意并开始','voice-start','id="od-voice-confirm" type="button"','small')}${button('取消','voice-cancel','type="button"')}</div></div>`:''}
      <div class="od-compose-actions">
        <div class="od-input-tools">${button(voiceIcon+`<span>${listening?'停止听写':'语音输入'}</span>`,listening?'voice-stop':'voice',`id="od-voice-toggle" type="button" aria-pressed="${listening}" aria-describedby="od-voice-status" ${!listening?`aria-expanded="${state.voiceNotice}"`:''} ${!local()||busy?'disabled':''}`,'quiet small od-voice-toggle')}<span id="od-voice-status" class="od-voice-status" role="status">${listening?'正在听写…':''}</span></div>
        ${busy?button('停止','stop','type="button"','small'):`<button class="button primary" type="submit" ${!meta?.configured||state.consent!==signature()?'disabled':''}>${business()?(inputData().proposal?'更新设计':'生成业务设计'):graph.nodes.length?'发送修改':'生成流程'}</button>`}
      </div>
    </div>`;
  }
  function page(){
    if(business())return window.OrbitBusiness.page({composer:composerInput(inputData(),view(),{nodes:[]},!!pending,connection?.meta),meta:connection?.meta,busy:!!pending,title:loading?'检查连接中…':connection?.meta.configured?window.HubModelProviders.providers[connection.meta.provider].name+' · '+connection.meta.model:'连接连小山的模型',error:view().error,connectionError,consent:!!signature()&&view().consent===signature()});
    const storage=data();const state=view();const proposal=storage.proposal;const graph=proposal?.graph||flow().data();const sequence=flow().numbers(graph);const selected=graph.nodes.find(node=>node.id===state.selected);const busy=!!pending;const meta=connection?.meta;
    const title=meta?.configured?window.HubModelProviders.providers[meta.provider].name+' · '+meta.model:'连接连小山的模型';
    const stale=proposal&&!proposalValid();const simulation=storage.simulation?.snapshot===sourceSnapshot()&&storage.simulation.input===storage.caseInput&&storage.simulation.references===referenceSnapshot()?storage.simulation:null;
    return `${button('返回业务设计','business-mode')}<section class="orbit-designer" aria-label="用对话设计业务流程"><header class="od-heading"><div><span class="od-eyebrow">业务设计</span><h2>说清业务，流程在旁边</h2></div><div class="od-model"><span>${loading?'检查连接中…':escape(title)}</span>${button('配置模型','configure')}${button('刷新','refresh',loading?'disabled':'')}</div></header>${connectionError?`<p class="od-notice" role="status">${escape(connectionError)}</p>`:''}<div class="od-layout"><section class="od-conversation"><header>${window.HubIdentity.worker('manager','md')}<div><strong>和连小山一起设计</strong><small>描述目标，也可以直接说“修改第 3 步”</small></div></header><div id="od-messages" class="od-messages" role="log" aria-label="业务设计对话">${storage.history.length?storage.history.map(entry=>`<article class="${entry.role==='user'?'is-user':''}"><span>${entry.role==='user'?'你':'连小山'}</span><p>${escape(entry.content)}</p></article>`).join(''):`<div class="od-welcome"><h3>这项业务需要怎么处理？</h3><p>告诉我服务谁、要完成什么，以及什么情况需要人工处理。</p><div>${button('售后报修','example','data-value="repair"')}${button('员工入职','example','data-value="onboarding"')}${button('门店巡检','example','data-value="inspection"')}</div><small>示例只填入描述，不生成预设流程。</small></div>`}${busy?'<p class="od-working" role="status">连小山正在整理，请稍候…</p>':''}</div><form id="od-form" class="od-compose">${selected?`<div class="od-selection"><span>正在讨论 ${sequence[selected.id]} · ${escape(selected.name)}</span>${button('取消选择','clear-selection')}</div>`:''}${composerInput(storage,state,graph,busy,meta)}<label class="od-consent"><input id="od-consent" type="checkbox" ${state.consent===signature()&&!!signature()?'checked':''} ${busy||!meta?.configured?'disabled':''}><span>同意本次将描述、最近 6 轮设计对话、当前流程和所选定义发给 ${escape(meta?.configured?window.HubModelProviders.providers[meta.provider].name:'所选模型')}，可能产生费用。仅使用脱敏内容。</span></label></form>${state.error&&state.errorMode!=='simulate'?`<p class="od-error" role="alert">${escape(state.error)}</p>`:''}</section><section class="od-workspace"><header><div><span class="od-eyebrow">${proposal?'待确认修改':'当前流程'}</span><h3>${escape(graph.name||'流程预览')}</h3></div><div>${button('−','zoom','data-value="out" aria-label="缩小流程"')}${button(Math.round(state.zoom*100)+'%','fit','aria-label="适应画布宽度"')}${button('+','zoom','data-value="in" aria-label="放大流程"')}${button('手动微调','manual',busy?'disabled':'')}</div></header>${graph.nodes.length?flow().preview(graph,proposal?.changes||[],state.selected,state.zoom):'<div class="od-empty"><span>01 → 02 → 03</span><h3>先说业务，不用从空白画布开始</h3><p>生成后，这里显示步骤、分支和需要确认的内容。</p></div>'}${proposal?`<section class="od-proposal"><header><strong>${proposal.changes.length} 项修改待确认</strong><span>模型草稿 · ${escape(proposal.model)}</span></header>${stale?'<p class="od-error">原流程或引用已变化，请重新生成，不能直接覆盖。</p>':''}${proposal.questions.length?`<div class="od-questions"><strong>需要你确认</strong><ol>${proposal.questions.map(question=>`<li>${escape(question)}</li>`).join('')}</ol></div>`:''}<details><summary>查看修改前后</summary>${proposal.changes.map(change=>`<div class="od-diff"><strong>${escape(change.label)}</strong><del>${escape(change.before)}</del><ins>${escape(change.after)}</ins></div>`).join('')||'<p>流程内容未变化。</p>'}</details><label class="od-consent"><input id="od-ack" type="checkbox" ${state.ack?'checked':''} ${busy?'disabled':''}><span>我已核对修改与待确认事项，仅保存草稿，不发布或执行。</span></label><div class="od-actions">${button('采用这版流程','adopt',busy||stale||!state.ack?'disabled':'','primary small')}${button('放弃修改','discard',busy?'disabled':'')}</div></section>`:graph.nodes.length?`<footer class="od-saved"><span>F${graph.revision} · ${graph.nodes.length} 个步骤 · 未发布</span>${button('撤销上次修改','undo',busy||!flow().view().undo.length?'disabled':'')}</footer>`:''}</section></div>${!proposal&&graph.nodes.length?testingSection(graph,sequence,simulation,busy,meta):''}</section>`;
  }
  function configure(adapter){
    host=adapter;
    window.OrbitBusiness?.configure(adapter);
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="od-"]');if(!element||element.disabled||!active())return;event.preventDefault();const name=element.dataset.action.slice(3);const state=view();
      try{
        if(name==='configure')window.HubModels.open('manager','model');
        if(name==='refresh')void refresh();if(name==='stop')stop();
        if(name==='select'){const graph=data().proposal?.graph||flow().data();if(graph.nodes.some(node=>node.id===element.dataset.id)){state.selected=element.dataset.id;repaint();document.getElementById('od-input')?.focus({preventScroll:true});}}
        if(name==='clear-selection'){state.selected='';repaint();}
        if(name==='zoom'){state.zoom=Math.max(.4,Math.min(1.4,state.zoom+(element.dataset.value==='in'?.1:-.1)));repaint();}
        if(name==='fit'){const graph=data().proposal?.graph||flow().data();const width=Math.max(840,...graph.nodes.map(node=>node.x+310));state.zoom=Math.max(.4,Math.min(1,(document.getElementById('od-flow-viewport')?.clientWidth||760)/width));repaint();}
        if(name==='voice'&&!pending&&local()){state.voiceNotice=!state.voiceNotice;repaint();document.getElementById(state.voiceNotice?'od-voice-confirm':'od-voice-toggle')?.focus({preventScroll:true});}
        if(name==='voice-cancel'){state.voiceNotice=false;repaint();document.getElementById('od-voice-toggle')?.focus({preventScroll:true});}
        if(name==='voice-start'&&state.voiceNotice){startVoice();if(voice)document.getElementById('od-voice-toggle')?.focus({preventScroll:true});}
        if(name==='voice-stop'){stopVoice();const input=document.getElementById('od-input');input?.focus({preventScroll:true});input?.setSelectionRange(input.value.length,input.value.length);}
        if(pending)return;
        if(name.startsWith('business-')&&name!=='business-mode'){window.OrbitBusiness.dispatch(name.slice(9),element);return;}
        if(name==='business-mode'||name==='flow-mode'){stopVoice(true);state.purpose=name==='flow-mode'?'flow':'business';state.consent='';state.ack=false;repaint();return;}
        if(name==='adopt')adopt();if(name==='discard'){data().proposal=null;state.ack=false;persist();repaint();}
        if(name==='manual'){if(data().proposal)throw Error('先采用或放弃待确认的修改，再手动编辑。');stopVoice(true);window.OrbitWorkbench.view().mode='flow';Object.assign(flow().view(),{selected:state.selected,selectedEdge:'',side:'node',connect:''});host.render();}
        if(name==='undo'){flow().dispatch('undo',{dataset:{}});state.reviewed='';data().simulation=null;persist();}
        if(name==='save-assistant')saveAssistant();
        if(name==='open-draft'||name==='open-tests'){const scene=assistantDraft().scene;if(!scene)throw Error('原草案已变化或不在当前项目，请重新核对。');window.ProjectStudio.openScene(scene.id);if(name==='open-tests')window.ProjectStudio.dispatch('tab',{dataset:{value:'tests'}});}
        if(name==='case'){const entry=data().cases[Number(element.dataset.index)];if(entry){data().caseInput=entry.input;persist();repaint();document.getElementById('od-case')?.focus({preventScroll:true});}}
        if(name==='example'){
          const examples={repair:'客户报修后，先了解产品型号和故障现象。资料不全先追问；根据知识准备排查建议。没有解决时准备工单草稿，交客服确认，不自动提交。客户要求人工时直接转交。',onboarding:'为新员工准备入职清单。先了解入职日期、部门和岗位，材料缺失时先补充。涉及账号和权限时交给负责人确认，不自动开通，最后输出待确认的入职清单。',inspection:'收集门店巡检问题，核对门店、问题描述和整改负责人。缺资料先补充，涉及安全隐患时转交负责人，其他问题整理为整改草稿供人工确认。'};
          if(inputData().input)throw Error('输入框已有内容，请先保留或清空，再填入示例。');inputData().input=examples[element.dataset.value]||'';state.consent='';persist();repaint();
        }
      }catch(error){state.error=error.message;state.errorMode='generate';repaint();}
    });
    document.addEventListener('keydown',event=>{if(!active()||event.key!=='Escape'||!view().voiceNotice||!event.target.closest('#od-form'))return;event.preventDefault();view().voiceNotice=false;repaint();document.getElementById('od-voice-toggle')?.focus({preventScroll:true});});
    document.addEventListener('input',event=>{if(!active()||!['od-input','od-case'].includes(event.target.id))return;const key=event.target.id==='od-input'?'input':'caseInput';const consentKey=key==='input'?'consent':'simulationConsent';const refreshNeeded=!!view()[consentKey]||(key==='caseInput'&&!!data().simulation);if(policy.sensitive(event.target.value)){view().error='输入可能含有个人信息或凭证，未保存；请先脱敏。';inputData()[key]='';}else inputData()[key]=event.target.value;view()[consentKey]='';persist();if(key==='input')stopVoice(true);if(refreshNeeded)repaint();});
    document.addEventListener('change',event=>{if(!active())return;const state=view();const target=event.target;
      if(target.id==='od-consent'){state.consent=target.checked&&connection?.meta.configured?signature():'';repaint();}
      if(target.id==='od-test-consent'){state.simulationConsent=target.checked&&connection?.meta.configured?signature():'';repaint();}
      if(target.id==='od-ack'){state.ack=target.checked;repaint();}
      if(target.id==='od-reviewed'){state.reviewed=target.checked?sourceSnapshot():'';repaint();}
      if(target.dataset.odReference&&!pending){try{target.checked?selectReference(target.dataset.odReference):removeReference(target.dataset.odReference);state.consent='';state.simulationConsent='';persist();repaint();}catch(error){state.error=error.message;repaint();}}
    });
    document.addEventListener('submit',event=>{if(event.target.id==='od-definition-form'&&active()&&business()){event.preventDefault();if(pending)return;try{window.OrbitBusiness.edit({...Object.fromEntries(new FormData(event.target)),id:event.target.dataset.id});}catch(error){view().error=error.message;repaint();}return;}if(!['od-form','od-test-form'].includes(event.target.id))return;event.preventDefault();void send(event.target.id==='od-form'?'generate':'simulate');});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice(true);});
    window.addEventListener('pagehide',()=>{stop();stopVoice(true);});
  }
  function capture(){const focused=document.activeElement;const stream=document.getElementById('od-messages');const viewport=document.getElementById('od-flow-viewport');captured=active()&&stream?{projectId:current().id,focused:focused?.id,start:focused?.selectionStart,end:focused?.selectionEnd,top:stream.scrollTop,bottom:stream.scrollHeight-stream.clientHeight-stream.scrollTop<50,flowTop:viewport?.scrollTop||0,flowLeft:viewport?.scrollLeft||0}:null;}
  function mount(){
    if(!active()){stop();stopVoice(true);return;}
    if(pending&&pending.mode==='define'&&!business())stop('已切换设计方式，停止原请求。');
    if(pending&&pending.projectId!==current().id)stop('已切换项目，停止上一个项目的生成。');
    if(voice&&voice.projectId!==current().id)stopVoice(true);
    const previous=captured?.projectId===current().id?captured:null;const stream=document.getElementById('od-messages');
    if(stream)stream.scrollTop=!previous||previous.bottom?stream.scrollHeight:previous.top;
    if(previous){document.getElementById('od-flow-viewport')?.scrollTo(previous.flowLeft,previous.flowTop);const focused=document.getElementById(previous.focused);if(focused&&!focused.disabled){focused.focus({preventScroll:true});if(['od-input','od-case'].includes(previous.focused))focused.setSelectionRange(previous.start,previous.end);}}
    if(!checked&&!loading){checked=true;queueMicrotask(()=>void refresh());}
  }
  return {configure,page,data,view,refresh,send,stop,invalidate,mergeGraph,adopt,assistantDraft,saveAssistant,selectReference,removeReference,definitionsChanged,capture,mount,proposalValid,startVoice,stopVoice};
})();
