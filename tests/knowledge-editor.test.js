const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function fixture(saved=null) {
  const nodes=new Map();const storage=new Map();const listeners={};
  let failStorage=false;let project='AFTERSALES';
  if(saved)storage.set('servicehub_demo_project_v13',saved);
  const document={activeElement:null,addEventListener(name,callback){(listeners[name]||=[]).push(callback);},getElementById(identifier){return nodes.get(identifier)||null;},querySelector(){return null;}};
  const decode=value=>String(value||'').replace(/&(?:amp|lt|gt|quot|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity]));
  function node(identifier,value='') {
    const element={id:identifier,value,dataset:{},innerHTML:'',textContent:'',checked:false,attributes:{},closest(){return null;},focus(){document.activeElement=this;},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},querySelectorAll(){return [];}};
    nodes.set(identifier,element);return element;
  }
  function captureDialog(title,subtitle,body,footer,size) {
    nodes.clear();window.lastDialog={title,subtitle,body,footer,size};
    for(const match of body.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))node(match[1]);
    for(const match of body.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g))nodes.get(match[1]).value=decode(match[0].match(/\bvalue="([^"]*)"/)?.[1]);
    for(const match of body.matchAll(/<textarea\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g))nodes.get(match[1]).value=decode(match[2]);
    for(const match of body.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
      nodes.get(match[1]).value=decode(match[2].match(/<option\s+selected[^>]*>([^<]*)<\/option>/)?.[1]||match[2].match(/<option[^>]*>([^<]*)<\/option>/)?.[1]);
    }
  }
  const window={addEventListener(){},PortfolioHub:{navProject:()=>({id:project})}};
  const context=vm.createContext({window,document,localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){if(failStorage)throw new Error('Storage unavailable');storage.set(key,value);}},location:{hash:'#knowledge',search:'?project=AFTERSALES'},URLSearchParams,structuredClone,console,setTimeout,clearTimeout,requestAnimationFrame:callback=>callback(),captureDialog});
  const read=filename=>filesystem.readFileSync(path.join(__dirname,'../app',filename),'utf8');
  for(const filename of ['icons.js','identity.js','knowledge-editor.js'])vm.runInContext(read(filename),context);
  const app=read('app.js');vm.runInContext(app.slice(0,app.indexOf('window.HubModels.configure(')),context);
  vm.runInContext(`
    toast=(message)=>{window.lastNotice=message;};
    render=()=>{window.lastPage=knowledgePage();};
    showDialog=captureDialog;
    closeDialog=()=>{window.KnowledgeEditor.close();view.modal=null;};
    window.KnowledgeEditor.configure({getState:()=>state,getView:()=>view,persist,render,escape:escapeHtml,button,badge,showDialog,closeDialog,toast,openKnowledge,isSensitive:text=>!!detectRisk(text)?.sensitive});
  `,context);
  const run=script=>vm.runInContext(script,context);
  const dispatch=(action,values={})=>{context.clicked={dataset:values};run(`dispatch(${JSON.stringify(action)},clicked)`);};
  const type=(name,value)=>{
    const target=nodes.get('knowledge-'+name);target.value=value;
    for(const callback of listeners[name==='category'?'change':'input']||[])callback({target});
  };
  const submit=()=>{for(const callback of listeners.submit||[])callback({preventDefault(){},target:{id:'knowledge-form'}});};
  const fill=()=>{type('title','A1 版本信息查看说明');type('content','在设备设置中打开系统信息，查看软件版本。菜单不一致时请转交人工核对。');};
  return {window,nodes,storage,run,dispatch,type,submit,fill,failStorage(value){failStorage=value;},project(value){project=value;},snapshot:()=>storage.get('servicehub_demo_project_v13')};
}

test('new knowledge opens a working form, visual preview, twelve icons and six colors',()=>{
  const {window,dispatch,nodes}=fixture();dispatch('new-knowledge');
  const dialog=window.lastDialog;
  assert.equal(dialog.size,'knowledge-editor-dialog');assert.match(dialog.body,/列表预览/);
  assert.equal((dialog.body.match(/data-action="knowledge-icon"/g)||[]).length,12);
  assert.equal((dialog.body.match(/data-action="knowledge-tone"/g)||[]).length,6);
  assert.equal((dialog.body.match(/aria-pressed="true"/g)||[]).length,2);
  assert.match(dialog.footer,/type="submit" form="knowledge-form"/);assert.match(dialog.footer,/审核前不用于自动回答/);
  assert.equal(nodes.get('knowledge-category').value,'操作咨询');assert.equal(nodes.get('knowledge-product').value,'座舱终端 A1');
});

test('typing updates preview without saving and escapes text rather than executing markup',()=>{
  const {dispatch,type,nodes,run,snapshot}=fixture();const original=run('JSON.stringify(state.knowledge)');dispatch('new-knowledge');
  type('title','<img src=x> & 标题');type('product','座舱终端 B2');type('content','第一步：打开设置。\n第二步：查看软件版本。');
  const preview=nodes.get('knowledge-preview').innerHTML;
  assert.match(preview,/&lt;img src=x&gt; &amp; 标题/);assert.doesNotMatch(preview,/<img/);assert.match(preview,/座舱终端 B2/);assert.match(preview,/第二步/);
  assert.equal(nodes.get('knowledge-content-count').textContent,nodes.get('knowledge-content').value.length+' / 12000');
  assert.equal(run('JSON.stringify(state.knowledge)'),original);assert.equal(snapshot(),undefined);
});

test('category chooses a matching default while manual choices survive later category changes',()=>{
  const {dispatch,type,nodes}=fixture();dispatch('new-knowledge');type('category','软件问题');
  assert.match(nodes.get('knowledge-preview').innerHTML,/data-tone="blue"/);assert.match(nodes.get('knowledge-preview').innerHTML,/软件说明图标/);
  dispatch('knowledge-icon',{value:'ticket'});dispatch('knowledge-tone',{value:'clay'});type('category','服务规范');
  assert.match(nodes.get('knowledge-preview').innerHTML,/操作清单图标/);assert.match(nodes.get('knowledge-preview').innerHTML,/data-tone="clay"/);
});

test('all twelve knowledge icons have distinct artwork and no external media references',()=>{
  const {window}=fixture();const picker=window.HubIdentity.knowledgePicker({});
  const identifiers=[...picker.matchAll(/data-action="knowledge-icon" data-value="([^"]+)"/g)].map(match=>match[1]);
  const artwork=identifiers.map(art=>window.HubIdentity.knowledge({appearance:{art,tone:'teal'}}).match(/<svg[\s\S]*<\/svg>/)[0]);
  assert.equal(new Set(artwork).size,12);assert.doesNotMatch(artwork.join(''),/<image|<script|href=|onload=/);
  assert.doesNotMatch(window.HubIdentity.knowledge({appearance:{art:'__proto__',tone:'constructor'}}),/undefined|\[object Object\]/);
});

test('saving persists all content and appearance and opens the actual saved detail',()=>{
  const {window,dispatch,fill,type,submit,run,snapshot}=fixture();dispatch('new-knowledge');fill();type('source','A1 使用手册 · 第 3 章');type('owner','软件专家组');type('category','故障排查');dispatch('knowledge-icon',{value:'workflow'});dispatch('knowledge-tone',{value:'blue'});submit();
  const entry=JSON.parse(snapshot()).knowledge[0];
  assert.equal(entry.title,'A1 版本信息查看说明');assert.equal(entry.status,'待审核');assert.equal(entry.source,'A1 使用手册 · 第 3 章');assert.equal(entry.owner,'软件专家组');assert.deepEqual(entry.appearance,{art:'workflow',tone:'blue'});
  assert.match(entry.date,/\d{2}-\d{2}/);assert.equal(entry.version,'草稿');assert.equal(run('state.knowledge.length'),5);
  assert.ok(window.lastPage.includes(window.HubIdentity.knowledge(entry)));assert.ok(window.lastDialog.body.includes(window.HubIdentity.knowledge(entry,'lg')));
  assert.match(window.lastDialog.footer,/data-action="edit-knowledge"/);assert.match(window.lastDialog.body,/模型对话可引用已发布且型号匹配的知识/);
});

test('reload restores the saved icon and editing updates the same record without duplication',()=>{
  const first=fixture();first.dispatch('new-knowledge');first.fill();first.dispatch('knowledge-icon',{value:'research'});first.dispatch('knowledge-tone',{value:'plum'});first.submit();
  const saved=JSON.parse(first.snapshot()).knowledge[0];const second=fixture(first.snapshot());second.dispatch('edit-knowledge',{id:saved.id});
  assert.equal(second.nodes.get('knowledge-title').value,saved.title);assert.match(second.window.lastDialog.body,/排查检索图标/);
  second.type('title','A1 版本说明修订稿');second.submit();const records=JSON.parse(second.snapshot()).knowledge;
  assert.equal(records.length,5);assert.equal(records[0].id,saved.id);assert.equal(records[0].title,'A1 版本说明修订稿');assert.deepEqual(records[0].appearance,saved.appearance);
});

test('cancel and repeated save do not create records or duplicate a successful submission',()=>{
  const {dispatch,fill,run,submit,window}=fixture();dispatch('new-knowledge');fill();dispatch('close-dialog');assert.equal(run('state.knowledge.length'),4);assert.equal(window.KnowledgeEditor.save(),false);
  dispatch('new-knowledge');fill();submit();assert.equal(run('state.knowledge.length'),5);dispatch('save-knowledge');assert.equal(run('state.knowledge.length'),5);
});

test('missing, whitespace-only, short and oversized content return specific inline errors',()=>{
  const {dispatch,type,fill,submit,nodes,run}=fixture();dispatch('new-knowledge');submit();assert.match(nodes.get('knowledge-error').textContent,/知识标题/);
  fill();type('product','   ');submit();assert.match(nodes.get('knowledge-error').textContent,/适用产品/);
  type('product','A1');type('content','短说明');submit();assert.match(nodes.get('knowledge-error').textContent,/至少 10 字/);
  assert.equal(nodes.get('knowledge-content').attributes['aria-invalid'],'true');
  type('content','说明'.repeat(6001));submit();assert.match(nodes.get('knowledge-error').textContent,/12000/);assert.equal(run('state.knowledge.length'),4);
});

test('sensitive information in any editable field is blocked and never reaches storage',()=>{
  for(const field of ['title','product','content','source','owner']){
    const subject=fixture();subject.dispatch('new-knowledge');subject.fill();subject.type(field,['pass','word'].join('')+': '+['NOT','A','CREDENTIAL'].join('_'));subject.submit();
    assert.match(subject.nodes.get('knowledge-error').textContent,/敏感信息/,field);assert.equal(subject.run('state.knowledge.length'),4,field);assert.equal(subject.snapshot(),undefined,field);
  }
});

test('storage failure rolls back records, retains the form and succeeds on retry',()=>{
  const subject=fixture();const before=subject.run('JSON.stringify({knowledge:state.knowledge,audit:state.audit})');subject.dispatch('new-knowledge');subject.fill();subject.dispatch('knowledge-tone',{value:'blue'});subject.failStorage(true);subject.submit();
  assert.match(subject.nodes.get('knowledge-error').textContent,/未能保存/);assert.equal(subject.run('JSON.stringify({knowledge:state.knowledge,audit:state.audit})'),before);assert.equal(subject.run('view.modal.kind'),'knowledge-editor');assert.equal(subject.snapshot(),undefined);
  assert.equal(subject.nodes.get('knowledge-title').value,'A1 版本信息查看说明');subject.failStorage(false);subject.submit();assert.equal(JSON.parse(subject.snapshot()).knowledge[0].appearance.tone,'blue');assert.match(subject.window.lastNotice,/草稿已保存/);
});

test('published entries cannot be overwritten and changes during editing are not silently lost',()=>{
  const subject=fixture();subject.dispatch('edit-knowledge',{id:'KB-0101'});assert.match(subject.window.lastNotice,/只能编辑待审核/);
  const before=subject.run('JSON.stringify(state.knowledge.find(entry=>entry.id==="KB-0101"))');subject.dispatch('save-knowledge');assert.equal(subject.run('JSON.stringify(state.knowledge.find(entry=>entry.id==="KB-0101"))'),before);
  subject.dispatch('edit-knowledge',{id:'KB-0108'});subject.type('title','修改中的草稿');subject.run('state.knowledge.find(entry=>entry.id==="KB-0108").status="已发布"');subject.submit();assert.match(subject.nodes.get('knowledge-error').textContent,/发生变化/);assert.equal(subject.run('state.knowledge.find(entry=>entry.id==="KB-0108").title'),'B2 蓝牙断连问题处理建议');
});

test('new knowledge IDs remain unique even with imported numeric IDs and gaps',()=>{
  const subject=fixture();subject.run('state.knowledge.push({...state.knowledge[0],id:"KB-0250"})');subject.dispatch('new-knowledge');subject.fill();subject.submit();
  const records=JSON.parse(subject.snapshot()).knowledge;assert.equal(records[0].id,'KB-0251');assert.equal(new Set(records.map(entry=>entry.id)).size,records.length);
});

test('knowledge editor is scoped to the service project, including an already-open form',()=>{
  const subject=fixture();subject.project('RETAIL');subject.dispatch('new-knowledge');assert.match(subject.window.lastNotice,/售后服务项目/);assert.equal(subject.window.lastDialog,undefined);
  subject.project('AFTERSALES');subject.dispatch('new-knowledge');subject.fill();subject.project('RETAIL');subject.submit();assert.match(subject.nodes.get('knowledge-error').textContent,/项目已切换/);assert.equal(subject.run('state.knowledge.length'),4);
});

test('saving a draft never publishes it and publishing still requires explicit approval',()=>{
  const subject=fixture();subject.dispatch('new-knowledge');subject.fill();subject.submit();const identifier=JSON.parse(subject.snapshot()).knowledge[0].id;
  subject.dispatch('publish-knowledge',{id:identifier});assert.equal(subject.run('state.knowledge[0].status'),'待审核');assert.match(subject.window.lastNotice,/请先确认/);
  subject.nodes.get('knowledge-approve').checked=true;subject.dispatch('publish-knowledge',{id:identifier});assert.equal(subject.run('state.knowledge[0].status'),'已发布');assert.equal(subject.run('state.knowledge[0].version'),'V1.0');
});

test('legacy categories and records keep their default icons without a forced migration',()=>{
  const subject=fixture();const original=subject.run('JSON.stringify(state.knowledge)');
  assert.match(subject.window.HubIdentity.knowledge({category:'故障排查'}),/data-tone="clay"/);assert.match(subject.window.HubIdentity.knowledge({category:'待分类'}),/说明文档图标/);assert.equal(subject.run('JSON.stringify(state.knowledge)'),original);
  subject.run('state.knowledge[3].category="待分类"');subject.dispatch('edit-knowledge',{id:'KB-0108'});assert.equal(subject.nodes.get('knowledge-category').value,'待分类');subject.submit();assert.equal(JSON.parse(subject.snapshot()).knowledge[3].category,'待分类');
});

test('publishing and disabling roll back on storage failure rather than reporting success',()=>{
  const subject=fixture();subject.dispatch('knowledge-detail',{id:'KB-0108'});subject.nodes.get('knowledge-approve').checked=true;subject.failStorage(true);subject.dispatch('publish-knowledge',{id:'KB-0108'});
  assert.equal(subject.run('state.knowledge[3].status'),'待审核');assert.match(subject.window.lastNotice,/状态没有改变/);
  subject.failStorage(false);subject.dispatch('publish-knowledge',{id:'KB-0108'});assert.equal(subject.run('state.knowledge[3].status'),'已发布');
  subject.dispatch('knowledge-detail',{id:'KB-0108'});subject.failStorage(true);subject.dispatch('disable-knowledge',{id:'KB-0108'});assert.equal(subject.run('state.knowledge[3].status'),'已发布');
  subject.failStorage(false);subject.dispatch('disable-knowledge',{id:'KB-0108'});assert.equal(subject.run('state.knowledge[3].status'),'已停用');
});

test('invalid appearance and category values cannot add arbitrary markup or unknown categories',()=>{
  const subject=fixture();subject.dispatch('new-knowledge');subject.fill();subject.dispatch('knowledge-icon',{value:'<script>'});subject.dispatch('knowledge-tone',{value:'url(invalid)'});
  subject.type('category','<unknown>');subject.submit();assert.match(subject.nodes.get('knowledge-error').textContent,/有效的知识分类/);
  subject.type('category','其他知识');subject.submit();const entry=JSON.parse(subject.snapshot()).knowledge[0];assert.deepEqual(entry.appearance,{art:'document',tone:'slate'});
});
