const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const read=name=>fs.readFileSync(path.join(__dirname,'../../app',name),'utf8');
function fixture({fetchImpl,publicMode=false,stored:existingStore,url,business=false,reducedMotion=true}={}){
  const listeners={};const stored=existingStore||new Map();const notices=[];const calls=[];const location={href:'http://127.0.0.1:4342/?project=AFTERSALES#orbit',search:'?project=AFTERSALES',hash:'#orbit',protocol:'http:',hostname:'127.0.0.1'};
  if(url){const initial=new URL(url);Object.assign(location,{href:initial.href,search:initial.search,hash:initial.hash,protocol:initial.protocol,hostname:initial.hostname});}
  const document={activeElement:null,hidden:false,addEventListener(name,handler){(listeners[name]||=[]).push(handler);},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],head:{append(){}},createElement:()=>({})};
  const window={LIANSHAN_PUBLIC_DEMO:publicMode,addEventListener(){},HubBrand:{header:()=>''},HubModels:{open(){}},HubMedia:{has:()=>false,tray:()=>'',tools:()=>'',messages:()=>''}};
  const fetch=async(url,options={})=>{calls.push({url,options});if(fetchImpl)return fetchImpl(url,options);if(url==='/api/model-connections')return Response.json({mode:'local-server',capabilities:['orbit-designer-v1'],csrf:'test-session',connections:[{agentId:'manager',configured:true,revision:1,provider:'openai',model:'test-model'}]});const body=JSON.parse(options.body);return Response.json({result:{message:'已整理流程，请核对。',questions:[],graph:window.OrbitDesignerPolicy.projectGraph(window.OrbitFlow.sample(body.projectId)),cases:[{name:'缺少资料',input:'设备报修',expected:'missing'}]},origin:'model',projectId:body.projectId,revision:1,provider:'openai',model:'test-model',externalActions:0});};
  const motionListeners=[];const motionPreference={matches:reducedMotion,addEventListener(name,handler){if(name==='change')motionListeners.push(handler);}};
  const context=vm.createContext({window,document,location,URL,URLSearchParams,history:{replaceState(state,title,url){const next=new URL(url);Object.assign(location,{href:next.href,search:next.search,hash:next.hash});}},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},structuredClone,crypto,console,performance,setTimeout,clearTimeout,AbortController,AbortSignal,fetch,queueMicrotask,requestAnimationFrame:()=>1,cancelAnimationFrame(){},matchMedia:()=>motionPreference,CSS:{escape:value=>value},FormData:class{constructor(form){this.values=form.values||{};}get(key){return this.values[key];}has(key){return !!this.values[key];}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}}});
  const run=code=>vm.runInContext(code,context);
  for(const name of ['icons.js','model-providers.js','identity.js','agent-harness.js','manager-engine.js','project-hub.js','ontology-graph.js','orbit-map-motion.js','orbit-map.js','ontology-atlas.js','orbit-workbench.js','ontology-usage.js','orbit-flow.js','orbit-flow-gestures.js','orbit-copilot.js','orbit-designer-policy.js','orbit-business-policy.js','orbit-star.js','orbit-business.js','orbit-designer.js','ontology-catalog.js'])run(read(name));
  const app=read('app.js');run(app.slice(0,app.indexOf('window.HubModels.configure(')));
  context.notice=(...values)=>notices.push(values);
  run(`render=()=>{};toast=notice;showDialog=()=>{};closeDialog=()=>{};
    const host={getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,toast,showDialog,closeDialog,isSensitive:()=>false};
    window.PortfolioHub.configure(host);window.ProjectStudio.configure(host);navigate(view.page);`);
  if(!business)window.OrbitDesigner.view().purpose='flow';
  const emit=(type,target,extra={})=>{const event={target,...extra,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const listener of listeners[type]||[]){listener(event);if(event.stopped)break;}return event;};
  function click(action,extra={}){const target={dataset:{action,...extra},classList:{contains:()=>false},closest(selector){return selector===`[data-action^="${action.split('-')[0]}-"]`?this:null;}};emit('click',target);}
  function change(id,checked){emit('change',{id,checked,dataset:{},closest:()=>null,matches:()=>false});}
  function submit(id,values){emit('submit',{id,values,dataset:{},reportValidity:()=>true,classList:{contains:()=>false},closest:()=>null,matches:()=>false});}
  function switchProject(id){location.href='http://127.0.0.1:4342/?project='+id+'#orbit';location.search='?project='+id;location.hash='#orbit';window.PortfolioHub.restoreLocation();run("navigate('orbit')");}
  return {window,run,calls,notices,stored,document,location,emit,click,change,submit,switchProject,setReducedMotion(value){motionPreference.matches=value;motionListeners.forEach(handler=>handler(motionPreference));}};
}
module.exports={fixture};
