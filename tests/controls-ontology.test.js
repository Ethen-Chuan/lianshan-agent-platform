const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const read=filename=>filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

function fixture(projectId='AFTERSALES',stored=new Map(),route='ontology'){
  const listeners={};const notices=[];const dialogs=[];const focused=[];let renders=0;
  const location={};
  const setURL=value=>{const next=new URL(value);Object.assign(location,{href:next.href,search:next.search,hash:next.hash});};
  setURL('http://localhost/?project='+projectId+'#'+route);
  const document={activeElement:null,addEventListener(name,handler){(listeners[name]||=[]).push(handler);},getElementById:()=>null,querySelector(selector){return selector.startsWith('#aw-tab-')?{focus(options){focused.push({selector,options,renders});}}:null;},querySelectorAll:()=>[],createElement:()=>({}),head:{append(){}}};
  const window={addEventListener(){},HubBrand:{header:()=>''},HubMedia:{has:()=>false,tray:()=>'',tools:()=>'',messages:()=>''}};
  const context=vm.createContext({window,document,location,URL,URLSearchParams,history:{replaceState(state,title,url){setURL(url);}},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},structuredClone,crypto:{randomUUID},performance,console,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,FormData:class{constructor(form){this.values=form.values||{};}get(name){return this.values[name];}has(name){return !!this.values[name];}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}}});
  const run=script=>vm.runInContext(script,context);
  for(const filename of ['icons.js','identity.js','agent-harness.js','manager-engine.js','project-hub.js','ontology-graph.js','ontology-atlas.js','orbit-workbench.js','ontology-usage.js','group-chat.js','workspace-review.js','agent-workspace.js','service-journey.js'])run(read(filename));
  const source=read('app.js');run(source.slice(0,source.indexOf('window.HubModels.configure(')));
  context.recordRender=()=>{renders++;};context.recordNotice=text=>notices.push(text);context.recordDialog=(...values)=>dialogs.push(values);
  run(`render=recordRender;closeDialog=()=>{};toast=recordNotice;showDialog=recordDialog;
    const host={getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast,isSensitive:()=>false,addMessage,audit};
    window.PortfolioHub.configure(host);
    window.ProjectStudio.configure(host);
    const engine=window.ManagerEngine.create(host);
    window.ManagerHub={getEngine:()=>engine,repaint(){},resultPanel:()=>'',taskDetail:()=>''};
    window.ProjectHub.configure(host);
    window.AgentWorkspace.configure(host);
    window.ServiceJourney.configure(host);
    navigate(view.page);
  `);
  function emit(name,event){for(const listener of listeners[name]||[])listener(event);}
  function click(action,value,identifier){
    const target={id:'',dataset:{action,value,id:identifier},closest(selector){return selector.includes('[data-action^="'+action.split('-')[0]+'-"]')?this:null;},classList:{contains:()=>false}};
    emit('click',{target,preventDefault(){}});
  }
  function key(value,keyName){
    let prevented=false;
    const target={id:'aw-tab-'+value,dataset:{value},closest:selector=>selector==='.aw-tabs [role="tab"]'?target:null};
    emit('keydown',{target,key:keyName,preventDefault(){prevented=true;}});return prevented;
  }
  return {window,run,document,location,stored,notices,dialogs,focused,click,key,renders:()=>renders,submit(id,values){emit('submit',{target:{id,values,dataset:{},reportValidity:()=>true,matches:()=>false},preventDefault(){}});},switchProject(identifier,page='ontology'){setURL('http://localhost/?project='+identifier+'#'+page);window.PortfolioHub.restoreLocation();run('navigate('+JSON.stringify(page)+')');}};
}

test('aftersales project switch uses the same Lianxiaoshan avatar across workspace routes and reloads',()=>{
  const {window,run,stored}=fixture('AFTERSALES',new Map(),'workspace');
  const original=JSON.stringify(window.ProjectStudio.data());
  for(const page of ['workspace','group','agents','orbit','ontology','knowledge','customer','settings']){
    run('navigate('+JSON.stringify(page)+')');
    const projectSwitch=run('sidebar()').match(/<button class="workspace-switch"[\s\S]*?<\/button>/)[0];
    assert.ok(projectSwitch.includes(window.HubIdentity.worker('manager','sm')));
    assert.match(projectSwitch,/data-mascot="lianxiaoshan"/);
    assert.match(projectSwitch,/data-action="portfolio-switch"/);
    assert.match(projectSwitch,/aria-label="切换项目，当前售后服务项目"/);
    assert.doesNotMatch(projectSwitch,/data-entity-type="store"/);
  }
  assert.equal(JSON.stringify(window.ProjectStudio.data()),original);
  window.PortfolioHub.persist();
  const reloaded=fixture('AFTERSALES',stored,'group');
  const projectSwitch=reloaded.run('sidebar()').match(/<button class="workspace-switch"[\s\S]*?<\/button>/)[0];
  assert.match(projectSwitch,/data-mascot="lianxiaoshan"/);
  assert.equal(JSON.stringify(reloaded.window.ProjectStudio.data()),original);
});

test('project entry avatar does not replace store customers or other project identities',()=>{
  const {window,run,switchProject}=fixture('RETAIL');
  const customer={entityType:'store',identityTone:'clay',identityVariant:2};
  const before=window.HubIdentity.avatar(customer,{size:'sm'});
  const retailSwitch=run('sidebar()').match(/<button class="workspace-switch"[\s\S]*?<\/button>/)[0];
  switchProject('AFTERSALES');
  run('sidebar()');
  switchProject('RETAIL');
  const projectSwitch=run('sidebar()').match(/<button class="workspace-switch"[\s\S]*?<\/button>/)[0];
  assert.equal(projectSwitch,retailSwitch);
  switchProject('AFTERSALES');
  assert.equal(window.HubIdentity.avatar(customer,{size:'sm'}),before);
  assert.match(before,/data-entity-type="store"/);
  assert.doesNotMatch(before,/data-mascot="lianxiaoshan"/);
  window.ProjectStudio.data().profile.name='值班<助手>';
  const original=JSON.stringify(window.ProjectStudio.data());
  const updated=run('sidebar()').match(/<button class="workspace-switch"[\s\S]*?<\/button>/)[0];
  assert.match(updated,/aria-label="值班&lt;助手&gt; · 协调助手"/);
  assert.equal(JSON.stringify(window.ProjectStudio.data()),original);
});

test('legacy ontology routes resolve to one Orbit entry and preserve project definitions on refresh',()=>{
  for(const projectId of ['AFTERSALES','RETAIL']){
    const {window,run,stored,location}=fixture(projectId);assert.equal(run('view.page'),'orbit');assert.equal(new URL(location.href).searchParams.get('project'),projectId);
    const model=window.OrbitOntology.data();const page=window.ProjectStudio.orbitPage();
    assert.equal(window.OrbitWorkbench.view().section,'library');assert.match(page,/业务设计/);assert.match(page,/data-value="library"[^>]*aria-current="page"/);
    assert.strictEqual(window.ProjectStudio.data().ontology,model);
    const sidebar=run('sidebar()');assert.equal((sidebar.match(/data-page="ontology"/g)||[]).length,0);assert.equal((sidebar.match(/data-page="orbit"/g)||[]).length,1);assert.equal((sidebar.match(/aria-current="page"/g)||[]).length,1);
    model.revision=7;window.PortfolioHub.persist();const reloaded=fixture(projectId,stored);assert.equal(reloaded.run('view.page'),'orbit');assert.equal(reloaded.window.OrbitOntology.data().revision,7);assert.equal(reloaded.location.hash,'#orbit');assert.equal(new URL(reloaded.location.href).searchParams.get('design'),'definitions');
  }
});

test('an unknown project cannot enter ontology through a deep link',()=>{
  const {window,run,location}=fixture('MISSING');assert.equal(run('view.page'),'portfolios');assert.equal(window.PortfolioHub.navProject(),null);assert.equal(new URL(location.href).searchParams.has('project'),false);
});
test('Orbit is an independent sidebar destination in both project types and preserves existing drafts',()=>{
  for(const projectId of ['AFTERSALES','RETAIL']){
    const {window,run,click}=fixture(projectId);window.ProjectStudio.createFromOntology(window.OrbitOntology.configFromAction('draft'));
    window.OrbitWorkbench.data().brief='保留未提交的流程说明';const before=JSON.stringify(window.ProjectStudio.data());
    click('studio-orbit');assert.equal(run('view.page'),'orbit');const navigation=run('sidebar()');
    assert.equal((navigation.match(/data-page="orbit"/g)||[]).length,1);assert.match(navigation,/data-page="orbit"[^>]*aria-current="page"|aria-current="page"[^>]*data-page="orbit"/);
    assert.match(navigation,/Orbit<small class="nav-subtitle">业务设计<\/small>/);assert.match(navigation,/data-page="agents"[^>]*aria-current="false"|aria-current="false"[^>]*data-page="agents"/);
    assert.equal((navigation.match(/aria-current="page"/g)||[]).length,1);assert.equal(JSON.stringify(window.ProjectStudio.data()),before);
  }
});
test('customer-experience deep links and reload retain the same simulation rather than creating a second one',()=>{
  const {window,run,stored,location}=fixture('AFTERSALES',new Map(),'customer');assert.equal(run('view.page'),'customer');assert.equal(location.hash,'#customer');
  window.ServiceJourney.start('repair');window.ServiceJourney.handoff();const session=window.ServiceJourney.sessions()[0];
  const before=run('JSON.stringify({journey:state.serviceJourney,cases:state.cases})');
  const reloaded=fixture('AFTERSALES',stored,'customer');assert.equal(reloaded.run('view.page'),'customer');assert.equal(reloaded.run('state.serviceJourney.activeId'),session.id);
  assert.equal(reloaded.run('JSON.stringify({journey:state.serviceJourney,cases:state.cases})'),before);assert.equal((reloaded.run('sidebar()').match(/aria-current="page"/g)||[]).length,1);
});
test('unsupported and missing projects cannot access aftersales simulations from a customer deep link',()=>{
  const {window,stored}=fixture('AFTERSALES');window.ServiceJourney.start('repair');const before=JSON.stringify(window.ServiceJourney.sessions());
  const retail=fixture('RETAIL',stored,'customer');assert.equal(retail.run('view.page'),'project');assert.doesNotMatch(retail.run('sidebar()'),/data-page="customer"/);assert.equal(retail.window.ServiceJourney.sessions().length,0);
  retail.window.ServiceJourney.open();assert.equal(retail.run('view.page'),'project');
  const missing=fixture('MISSING',stored,'customer');assert.equal(missing.run('view.page'),'portfolios');
  const original=fixture('AFTERSALES',stored,'customer');assert.equal(JSON.stringify(original.window.ServiceJourney.sessions()),before);
});

test('ontology shortcuts preserve Orbit drafts, current scene and project-local view choices',()=>{
  const {window,run,click}=fixture();const studio=window.ProjectStudio;const atlas=window.OrbitOntology;const workbench=window.OrbitWorkbench;
  studio.createFromOntology(atlas.configFromAction('draft'));studio.createFromOntology(atlas.configFromAction('verify'));
  const selected=studio.data().scenes[0];studio.openScene(selected.id);workbench.data().brief='尚未提交的业务描述';atlas.view().selected='verify';atlas.view().scope='complete';
  const before=JSON.stringify(studio.data());const workbenchBefore=JSON.stringify(workbench.data());
  click('studio-tab','ontology');assert.equal(run('view.page'),'orbit');assert.equal(workbench.view().section,'library');studio.ontologyPage();
  assert.equal(JSON.stringify(studio.data()),before);assert.equal(JSON.stringify(workbench.data()),workbenchBefore);
  click('studio-tab','config');assert.match(studio.orbitPage(),new RegExp('data-id="'+selected.id+'" aria-current="page"'));assert.match(studio.orbitPage(),/data-value="config" aria-current="page"/);
  click('studio-tab','ontology');click('studio-orbit');assert.equal(run('view.page'),'orbit');assert.match(studio.orbitPage(),/data-value="workbench" aria-current="page"/);assert.equal(atlas.view().selected,'verify');assert.equal(atlas.view().scope,'complete');assert.equal(JSON.stringify(studio.data()),before);
});

test('creating an assistant from the sidebar ontology uses the original binding and never publishes automatically',()=>{
  const {window,run,click}=fixture();const model=window.OrbitOntology.data();const snapshot=JSON.stringify(model);const expected=window.OrbitOntology.configFromAction('draft');
  click('ontology-create',undefined,'draft');assert.equal(run('view.page'),'orbit');const workspace=window.ProjectStudio.data();assert.equal(workspace.scenes.length,1);assert.equal(workspace.agents.length,0);assert.equal(workspace.tasks.length,0);
  assert.deepEqual(plain(workspace.scenes[0].config.ontologyBinding),plain(expected.ontologyBinding));assert.ok(workspace.scenes[0].config.avatar.art);assert.match(window.ProjectStudio.orbitPage(),/id="studio-scene-form"/);assert.equal(JSON.stringify(model),snapshot);
});

test('sidebar moves and project switches never rewrite a published snapshot, tasks or business definitions',()=>{
  const {window,click,submit,switchProject}=fixture();const studio=window.ProjectStudio;
  studio.createFromOntology(window.OrbitOntology.configFromAction('draft'));click('studio-sample-template');studio.data().scenes[0].samples.forEach(sample=>sample.approved=true);click('studio-evaluate');assert.equal(studio.readiness(studio.data().scenes[0]).localReady,true);
  submit('studio-release-form',{confirmed:true,reason:'已人工核对示例边界'});assert.equal(studio.data().agents.length,1);
  const original=JSON.stringify(studio.data());const runtimeTasks=JSON.stringify(window.ManagerHub.getEngine().get().tasks);click('studio-tab','ontology');studio.ontologyPage();switchProject('RETAIL');
  const retail=window.OrbitOntology.data();assert.equal(retail.revision,1);assert.equal(retail.nodes[0].name,'业务事项');assert.equal(studio.data().agents.length,0);assert.equal(studio.data().tasks.length,0);retail.revision=4;
  switchProject('AFTERSALES');assert.equal(JSON.stringify(studio.data()),original);assert.equal(JSON.stringify(window.ManagerHub.getEngine().get().tasks),runtimeTasks);switchProject('RETAIL');assert.equal(window.OrbitOntology.data().revision,4);
});

test('collaboration tabs expose one selected tab, one keyboard entry and the matching panel label',()=>{
  const {window,run,click}=fixture();run("navigate('group')");
  for(const value of ['collaboration','tasks','shared','outcomes']){
    click('aw-tab',value);const page=window.AgentWorkspace.page();const navigation=page.match(/<nav class="aw-tabs"[\s\S]*?<\/nav>/)[0];
    assert.equal((navigation.match(/role="tab"/g)||[]).length,4);assert.equal((navigation.match(/aria-selected="true"/g)||[]).length,1);assert.equal((navigation.match(/tabindex="0"/g)||[]).length,1);
    assert.match(navigation,new RegExp('id="aw-tab-'+value+'"[^>]*aria-selected="true"'));assert.match(page,new RegExp('role="tabpanel" aria-labelledby="aw-tab-'+value+'"'));assert.doesNotMatch(navigation,/本地执行检查/);assert.match(page,/class="aw-environment"[\s\S]*本地演练 · 模型与业务系统未接入/);
  }
});

test('arrow, Home and End keys wrap across tabs and restore focus only after rendering',()=>{
  const {window,run,key,focused,renders}=fixture();run("navigate('group')");
  for(const [current,keyName,expected] of [['collaboration','ArrowRight','tasks'],['tasks','End','outcomes'],['outcomes','ArrowRight','collaboration'],['collaboration','ArrowLeft','outcomes'],['outcomes','Home','collaboration']]){
    const before=renders();assert.equal(key(current,keyName),true);assert.equal(window.AgentWorkspace.view().tab,expected);assert.equal(renders(),before+1);assert.equal(focused.at(-1).selector,'#aw-tab-'+expected);assert.equal(focused.at(-1).renders,renders());assert.equal(focused.at(-1).options.preventScroll,true);
  }
  const before=renders();assert.equal(key('collaboration','Tab'),false);assert.equal(key('unknown','ArrowRight'),false);assert.equal(renders(),before);
});

test('tab switches keep drafts and selected tasks, isolate project state and ignore invalid values',()=>{
  const {window,run,click,switchProject,renders}=fixture();run("navigate('group')");window.ProjectHub.setDraft('保留尚未发起的目标');Object.assign(window.AgentWorkspace.view(),{selected:'legacy:KEEP',filter:'attention',query:'检索条件'});
  click('aw-tab','outcomes');const original=plain(window.AgentWorkspace.view());const before=renders();click('aw-tab','invalid');assert.equal(renders(),before);
  switchProject('RETAIL','group');assert.equal(window.AgentWorkspace.view().tab,'collaboration');click('aw-tab','shared');switchProject('AFTERSALES','group');assert.deepEqual(plain(window.AgentWorkspace.view()),original);assert.equal(window.ProjectHub.composerContext().draft,'保留尚未发起的目标');
});

test('pending badges are derived from original tasks and disappear when attention is cleared',()=>{
  const {window,run}=fixture();run("navigate('group')");const workspace=window.ProjectStudio.data();const legacy=window.ManagerHub.getEngine().get().tasks;legacy.splice(0);workspace.tasks.push({id:'LOCAL-1',status:'信息不足，需补充',name:'示例任务',time:''});legacy.push({id:'LEGACY-1',status:'待确认',kind:'service',steps:[],updatedAt:''});
  window.AgentWorkspace.view().tab='outcomes';assert.match(window.AgentWorkspace.page(),/class="aw-tab-count" aria-label="2 项待确认">2<\/span>/);
  workspace.tasks[0].status='已完成';assert.match(window.AgentWorkspace.page(),/class="aw-tab-count" aria-label="1 项待确认">1<\/span>/);legacy[0].status='已完成';assert.doesNotMatch(window.AgentWorkspace.page(),/class="aw-tab-count"/);assert.equal(workspace.tasks.length,1);assert.equal(legacy.length,1);
});

test('collaboration settings stay in the group while customer experience lives in the sidebar',()=>{
  const {window,run,click,dialogs,switchProject}=fixture();run("navigate('group')");const page=window.AgentWorkspace.page();const actions=page.match(/<div class="aw-header-actions"[\s\S]*?<\/header>/)[0];assert.match(actions,/class="aw-settings-actions"/);assert.match(actions,/data-action="studio-profile"/);assert.match(actions,/data-action="aw-readiness"/);assert.doesNotMatch(actions,/aw-preview-button|体验客户自助|data-value="experience"/);assert.doesNotMatch(actions,/role="tab"/);assert.match(run('sidebar()'),/nav-experience-section[\s\S]*data-page="customer"/);
  click('studio-profile');assert.equal(run('view.page'),'project-assistant');run("navigate('group')");click('aw-readiness');assert.equal(dialogs.at(-1)[0],'能力与上线检查');assert.match(dialogs.at(-1)[2],/上线前必须完成/);
  click('aw-tab','experience');assert.equal(run('view.page'),'customer');assert.equal(window.AgentWorkspace.view().tab,'collaboration');switchProject('RETAIL','group');assert.doesNotMatch(window.AgentWorkspace.page(),/aw-preview-button/);click('aw-tab','experience');assert.equal(run('view.page'),'group');
});

test('shared-definition links leave the group for the requested Orbit section without duplicating data',()=>{
  const {window,run,click}=fixture();run("navigate('group')");window.AgentWorkspace.view().tab='shared';window.AgentWorkspace.page();const before=JSON.stringify(window.ProjectStudio.data());
  for(const section of ['library','changes','compose']){run("navigate('group')");click('aw-orbit-section',section);assert.equal(run('view.page'),'orbit');assert.equal(window.OrbitWorkbench.view().section,section);assert.equal(JSON.stringify(window.ProjectStudio.data()),before);}
});
