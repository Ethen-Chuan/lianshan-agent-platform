const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const read=filename=>filesystem.readFileSync(path.join(__dirname,'../../app',filename),'utf8');

module.exports=function fixture(projectId='AFTERSALES',options={}){
  const listeners={};const nodes=new Map();const timers=new Map();const notices=[];const records=[];const dialogs=[];const stored=new Map();const location={};let sequence=0;let attachments=false;let failSave=false;let renders=0;
  const setURL=identifier=>{const url=new URL('http://127.0.0.1/?project='+identifier+'#group');Object.assign(location,{href:url.href,search:url.search,hash:url.hash,protocol:url.protocol,hostname:url.hostname});};
  setURL(projectId);
  function emit(name,properties){
    let stopped=false;let prevented=false;
    const event={...properties,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}};
    for(const listener of [...(listeners[name]||[])].sort((left,right)=>Number(right.capture)-Number(left.capture))){listener.handler(event);if(stopped)break;}
    return prevented;
  }
  function node(id,value=''){
    const attributes={};const events={};
    const element={id,value,selectionStart:0,selectionEnd:0,dataset:{},style:{setProperty(){}},isConnected:true,scrollHeight:56,clientHeight:40,scrollTop:0,hidden:false,innerHTML:'',classList:{contains:()=>false},
      setAttribute(name,value){attributes[name]=value;},getAttribute(name){return attributes[name];},removeAttribute(name){delete attributes[name];},
      focus(){document.activeElement=this;},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},
      getBoundingClientRect:()=>({left:120,top:400,height:200}),scrollTo({top}){this.scrollTop=top;},scrollIntoView(){},
      addEventListener(name,handler){(events[name]||=[]).push(handler);},dispatchEvent(event){emit(event.type,{target:this});},
      trigger(name){for(const handler of events[name]||[])handler({target:this});},remove(){this.isConnected=false;nodes.delete(this.id);},closest:()=>null};
    nodes.set(id,element);return element;
  }
  const document={activeElement:null,documentElement:{style:{setProperty(){}}},
    addEventListener(name,handler,capture=false){(listeners[name]||=[]).push({handler,capture});},getElementById:id=>nodes.get(id)||null,
    querySelector(selector){return selector==='.aw-chat'&&nodes.has('chat-root')?nodes.get('chat-root'):null;},querySelectorAll:()=>[],createElement:()=>node(''),head:{append(){}},body:{append(element){nodes.set(element.id,element);}}};
  const window={addEventListener(){},HubBrand:{header:()=>''},HubMedia:{has:()=>attachments,tray:()=>'',tools:()=>'',messages:()=>'',sync(){}}};
  const context=vm.createContext({window,document,location,URL,URLSearchParams,history:{replaceState(state,title,url){const next=new URL(url);Object.assign(location,{href:next.href,search:next.search,hash:next.hash});}},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},structuredClone,crypto:{randomUUID},performance,console,innerWidth:1440,Event:class{constructor(type){this.type=type;}},setTimeout(callback){const id=++sequence;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>1,FormData:class{constructor(form){this.values=form.values||{};}get(name){return this.values[name];}has(name){return !!this.values[name];}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}}});
  const run=source=>vm.runInContext(source,context);
  if(options.customerModel){
    context.fetch=options.fetchImpl;context.AbortSignal=AbortSignal;context.AbortController=AbortController;context.queueMicrotask=queueMicrotask;
    window.LIANSHAN_PUBLIC_DEMO=!!options.publicMode;window.HubModels={open(){dialogs.push(['model-config']);}};
    for(const filename of ['model-providers.js','customer-chat-policy.js','customer-chat.js'])run(read(filename));
  }
  for(const filename of ['icons.js','identity.js','agent-harness.js','manager-engine.js','project-hub.js','ontology-graph.js','ontology-atlas.js','orbit-workbench.js','ontology-usage.js','group-chat.js','workspace-review.js','agent-workspace.js','service-journey.js'])run(read(filename));
  const source=read('app.js');run(source.slice(0,source.indexOf('window.HubModels.configure(')));
  if(options.serviceJourney)run('state.serviceJourney='+JSON.stringify(options.serviceJourney));
  context.redraw=()=>redraw();context.notify=text=>notices.push(text);context.dialog=(...values)=>dialogs.push(values);context.record=payload=>{records.push(payload);return 'TRACE-'+records.length;};
  run(`render=redraw;toast=notify;showDialog=dialog;closeDialog=()=>{};
    const host={getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast,isSensitive:value=>String(value).includes('SENSITIVE'),summarize:item=>item.messages.at(-1)?.text,checkRisk:detectRisk,record,addMessage,audit};
    window.PortfolioHub.configure(host);window.ProjectStudio.configure(host);window.TicketAssistant.configure(host);
    const engine=window.ManagerEngine.create({...host,onChange(){window.ProjectHub.engineChanged();redraw();}});
    window.ManagerHub={getEngine:()=>engine,repaint(){window.ProjectHub.engineChanged();redraw();},resultPanel:()=>'',taskDetail:()=>''};
    window.ProjectHub.configure(host);window.AgentWorkspace.configure(host);window.ServiceJourney.configure(host);navigate('group');`);
  const persist=window.PortfolioHub.persist;
  window.PortfolioHub.persist=()=>failSave?false:persist();
  function redraw(){
    renders++;window.GroupChat.capture();
    for(const element of nodes.values())element.isConnected=false;
    nodes.clear();document.activeElement=null;
    if(run('view.page')!=='group')return;
    const aftersales=window.PortfolioHub.navProject().id==='AFTERSALES';
    const draft=aftersales?window.ProjectHub.composerContext().draft:window.ProjectStudio.data().drafts.group;
    node(aftersales?'project-group-prompt':'studio-prompt',draft);node('chat-root');
    const stream=node(aftersales?'project-group-stream':'studio-chat-stream');Object.assign(stream,{scrollHeight:1000+window.GroupChat.messages().length*60,clientHeight:400});
    node('gc-latest');node('gc-update-status');window.GroupChat.mount();
  }
  function submit(id,values={},dataset={}){return emit('submit',{target:{id,values,dataset,reportValidity:()=>true,matches:()=>false}});}
  function click(action,value,id){
    const target={id:'',dataset:{action,value,id},closest(selector){return selector.includes('[data-action^="'+action.split('-')[0]+'-"]')?this:null;},classList:{contains:()=>false}};
    emit('click',{target});
  }
  function publish(name='报修资料助手'){
    window.ProjectStudio.createFromOntology({name,goal:'准备本地报修资料',keywords:'报修',fields:'设备编号,故障现象',transferWords:'冒烟',tool:'form',handoff:'交给负责人核实。',prompt:'只整理草稿',knowledge:''});
    const scene=window.ProjectStudio.data().scenes.at(-1);
    window.ProjectStudio.dispatch('sample-template',{dataset:{}});scene.samples.forEach(sample=>sample.approved=true);window.ProjectStudio.dispatch('evaluate',{dataset:{}});
    assert.equal(window.ProjectStudio.readiness(scene).localReady,true,notices.at(-1));submit('studio-release-form',{confirmed:true,reason:'已核对本地三类边界'});
    run("navigate('group')");return window.ProjectStudio.data().agents.at(-1);
  }
  const input=()=>nodes.get(window.PortfolioHub.navProject().id==='AFTERSALES'?'project-group-prompt':'studio-prompt');
  function type(value,start=value.length,end=start){const element=input();element.value=value;element.setSelectionRange(start,end);emit('input',{target:element});return element;}
  function send(value){type(value);if(window.PortfolioHub.navProject().id==='AFTERSALES')click('project-send');else submit('studio-chat-form',{}, {channel:'group'});}
  function flush(){let iterations=0;while(timers.size){if(++iterations>200)throw new Error('unexpected scheduling loop');const [id,callback]=timers.entries().next().value;timers.delete(id);callback();}}
  return {window,run,document,nodes,notices,records,dialogs,publish,redraw,input,type,send,click,submit,emit,flush,engine:window.ManagerHub.getEngine(),renders:()=>renders,setAttachments(value){attachments=value;},failSaving(value){failSave=value;},switchProject(id){window.GroupChat.capture();setURL(id);window.PortfolioHub.restoreLocation();run("navigate('group')");}};
};
