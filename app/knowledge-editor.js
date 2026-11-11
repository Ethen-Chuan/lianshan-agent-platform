window.KnowledgeEditor = (() => {
  let host;
  let editing=null;
  const fields={title:{label:'知识标题',limit:120},category:{label:'知识分类',limit:20},product:{label:'适用产品',limit:80},content:{label:'知识内容',limit:12000},source:{label:'来源说明',limit:200},owner:{label:'负责人',limit:60}};
  const escape=value=>host.escape(String(value??''));
  const current=()=>editing&&host.getView().modal?.kind==='knowledge-editor'?editing:null;
  const dateLabel=()=>new Date().toLocaleDateString('en-CA',{month:'2-digit',day:'2-digit'});
  const fingerprint=entry=>JSON.stringify(entry);
  const scopeAllowed=()=>window.PortfolioHub.navProject()?.id==='AFTERSALES';

  function titleCell(entry,interactive=true) {
    const title=escape(entry.title||'知识标题');
    return `<div class="knowledge-title-cell">${window.HubIdentity.knowledge(entry)}<div>${interactive?`<button class="knowledge-title-link" data-action="knowledge-detail" data-id="${escape(entry.id)}">${title}</button>`:`<strong class="knowledge-title-link">${title}</strong>`}<div class="knowledge-meta"><span>${escape(entry.category||'其他知识')}</span><span>${escape(entry.id||'保存后分配编号')}</span><span>${entry.date?'更新 '+escape(entry.date):'尚未保存'}</span></div></div></div>`;
  }

  function preview(entry) {
    return `<div class="knowledge-preview-heading"><span>列表预览</span></div><article class="knowledge-preview-card">${titleCell(entry,false)}<dl><div><dt>适用产品</dt><dd>${escape(entry.product||'待填写')}</dd></div><div><dt>状态 / 负责人</dt><dd><span class="badge amber">待审核</span><span>${escape(entry.owner||'演示审核员')}</span></dd></div></dl></article><div class="knowledge-preview-excerpt"><span>正文预览</span><p>${escape(entry.content?entry.content.slice(0,180)+(entry.content.length>180?'…':''):'填写处理步骤后，会在这里显示内容摘要。')}</p></div>`;
  }

  function showError(message,field) {
    const output=document.getElementById('knowledge-error');
    if(output)output.textContent=message;
    const input=field&&document.getElementById('knowledge-'+field);
    if(input){input.setAttribute('aria-invalid','true');input.focus();}
    return false;
  }

  function open(identifier='') {
    if(!scopeAllowed())return host.toast('请在售后服务项目管理知识。',true);
    const entry=identifier?host.getState().knowledge.find(record=>record.id===identifier):null;
    if(identifier&&(!entry||entry.status!=='待审核'))return host.toast('只能编辑待审核草稿，已发布内容不会被直接覆盖。',true);
    editing={id:identifier,original:entry?fingerprint(entry):null,value:{title:entry?.title||'',category:entry?.category||'操作咨询',product:entry?.product||'座舱终端 A1',content:entry?.content||'',source:entry?.source||'',owner:entry?.owner||'演示审核员',appearance:window.HubIdentity.knowledgeAppearance(entry||{category:'操作咨询'})},customAppearance:!!entry?.appearance};
    const value=editing.value;
    const categories=[...new Set([...window.HubIdentity.knowledgeCategories,value.category])];
    const input=(name,placeholder,required=false)=>`<div class="field"><label for="knowledge-${name}">${fields[name].label}${required?' <span aria-hidden="true">*</span>':''}</label><input id="knowledge-${name}" name="${name}" value="${escape(value[name])}" maxlength="${fields[name].limit}" placeholder="${escape(placeholder)}" ${required?'required':''} aria-describedby="knowledge-error" autocomplete="off"></div>`;
    const body=`<form id="knowledge-form" class="knowledge-editor-layout" novalidate><div class="knowledge-editor-fields"><div class="knowledge-section-intro"><h3>内容与适用范围</h3></div>${input('title','例如：A1 软件版本查看方法',true)}<div class="knowledge-field-pair"><div class="field"><label for="knowledge-category">知识分类</label><select id="knowledge-category" name="category">${categories.map(category=>`<option ${category===value.category?'selected':''}>${escape(category)}</option>`).join('')}</select></div>${input('product','例如：座舱终端 A1',true)}</div><div class="field"><div class="knowledge-label-row"><label for="knowledge-content">知识内容 <span aria-hidden="true">*</span></label><span id="knowledge-content-count">${value.content.length} / 12000</span></div><textarea id="knowledge-content" name="content" required minlength="10" maxlength="12000" rows="9" aria-describedby="knowledge-content-hint knowledge-error" placeholder="适用条件：产品型号、软件版本或使用场景。&#10;&#10;处理步骤：按实际操作顺序填写。&#10;&#10;无效时怎么办：停止条件，以及何时转交人工。">${escape(value.content)}</textarea><small id="knowledge-content-hint">可手动录入或粘贴脱敏文本，至少 10 字。不要填写真实客户资料。</small></div><details class="knowledge-extra-fields" ${value.source?'open':''}><summary>补充来源与负责人 <span>选填</span></summary><div>${input('source','例如：A1 使用手册 · 第 3 章')}${input('owner','例如：软件领域专家')}</div><p>填写文档名或章节；仅保存文字，不读取文件。</p></details><p id="knowledge-error" class="knowledge-editor-error" role="alert"></p></div><aside class="knowledge-editor-aside" aria-label="知识外观与预览"><div id="knowledge-preview">${preview({...entry,...value})}</div><div id="knowledge-appearance-controls">${window.HubIdentity.knowledgePicker(value)}</div><p class="knowledge-appearance-note">图标用于区分知识内容，不代表审核状态。</p></aside></form>`;
    host.getView().modal={kind:'knowledge-editor',id:identifier};
    host.showDialog(identifier?'编辑知识草稿':'新建知识草稿','保存后待审核。',body,`<span class="hint">仅保存到当前浏览器 · 审核前不用于自动回答</span><div class="row">${host.button('取消','close-dialog')}<button class="button primary" type="submit" form="knowledge-form">${identifier?'保存草稿修改':'保存待审核草稿'}</button></div>`,'knowledge-editor-dialog');
    document.getElementById('knowledge-title')?.focus();
  }

  function updatePreview() {
    const draft=current();if(!draft)return;
    const previewRoot=document.getElementById('knowledge-preview');
    if(previewRoot)previewRoot.innerHTML=preview({...draft.value,id:draft.id});
    const count=document.getElementById('knowledge-content-count');
    if(count)count.textContent=draft.value.content.length+' / 12000';
  }

  function updatePicker() {
    const root=document.getElementById('knowledge-appearance-controls');
    const focused=document.activeElement;
    const action=focused?.dataset.action;const value=focused?.dataset.value;
    if(root)root.innerHTML=window.HubIdentity.knowledgePicker(current().value);
    if(action&&['knowledge-icon','knowledge-tone'].includes(action)){
      [...(root?.querySelectorAll('button')||[])].find(button=>button.dataset.action===action&&button.dataset.value===value)?.focus({preventScroll:true});
    }
  }

  function input(identifier,value) {
    const draft=current();const name=identifier.replace(/^knowledge-/,'');
    if(!draft||!Object.hasOwn(fields,name))return;
    draft.value[name]=String(value);
    document.getElementById(identifier)?.removeAttribute('aria-invalid');
    const output=document.getElementById('knowledge-error');if(output)output.textContent='';
    if(name==='category'&&!draft.customAppearance){draft.value.appearance=window.HubIdentity.knowledgeAppearance({category:value});updatePicker();}
    updatePreview();
  }

  function choose(kind,value) {
    const draft=current();if(!draft)return;
    if(!['art','tone'].includes(kind))return;
    const candidate={...draft.value.appearance,[kind]:value};
    const appearance=window.HubIdentity.knowledgeAppearance({appearance:candidate});
    if(appearance[kind]!==value)return;
    draft.value.appearance=appearance;draft.customAppearance=true;
    updatePicker();updatePreview();
  }

  function save() {
    const draft=current();if(!draft)return false;
    if(!scopeAllowed())return showError('项目已切换，草稿未保存。请返回售后服务项目。');
    for(const name of Object.keys(fields)){
      const node=document.getElementById('knowledge-'+name);
      if(node)draft.value[name]=node.value;
    }
    const value={...draft.value};
    for(const [name,field] of Object.entries(fields)){
      value[name]=String(value[name]||'').trim();
      if(value[name].length>field.limit)return showError(field.label+'不能超过 '+field.limit+' 字。',name);
      if(host.isSensitive(value[name]))return showError(field.label+'含疑似敏感信息，请移除后再保存。',name);
    }
    for(const name of ['title','product','content']){
      if(!value[name])return showError('请填写'+fields[name].label+'。',name);
    }
    if(value.content.length<10)return showError('请补充可供审核的处理说明，知识内容至少 10 字。','content');
    const state=host.getState();const existing=state.knowledge.find(entry=>entry.id===draft.id);
    if(draft.id&&(!existing||existing.status!=='待审核'||fingerprint(existing)!==draft.original))return showError('这条知识已发生变化，未覆盖原记录。请保留当前文字，重新打开后核对。');
    if(!window.HubIdentity.knowledgeCategories.includes(value.category)&&value.category!==existing?.category)return showError('请选择有效的知识分类。','category');
    const identifier=draft.id||'KB-'+String(Math.max(200,...state.knowledge.map(entry=>/^KB-\d{1,7}$/.test(entry.id)?Number(entry.id.slice(3)):0))+1).padStart(4,'0');
    const entry={...existing,...value,appearance:window.HubIdentity.knowledgeAppearance(value),id:identifier,owner:value.owner||'演示审核员',version:existing?.version||'草稿',status:'待审核',date:dateLabel(),updatedAt:new Date().toISOString()};
    const previousKnowledge=state.knowledge;const previousAudit=state.audit;
    state.knowledge=draft.id?state.knowledge.map(record=>record.id===identifier?entry:record):[entry,...state.knowledge];
    state.audit=[{time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}),text:(draft.id?'修改待审核知识 ':'新建待审核知识 ')+identifier,caseId:''},...state.audit].slice(0,100);
    if(host.persist()===false){state.knowledge=previousKnowledge;state.audit=previousAudit;return showError('浏览器未能保存，填写内容仍保留在这里。请检查存储空间后重试。');}
    editing=null;host.closeDialog();host.getView().filter='all';host.render();
    host.openKnowledge(identifier);
    host.toast('草稿已保存。图标和内容可继续修改，审核前不用于自动回答。');
    return true;
  }

  function detail(entry) {
    return `<div class="knowledge-detail-identity">${window.HubIdentity.knowledge(entry,'lg')}<div><strong>${escape(entry.category)}</strong><span>${escape(entry.id)} · ${escape(entry.version)}</span></div>${host.badge(entry.status,entry.status==='已发布'?'green':'amber')}</div><dl class="knowledge-detail-meta"><div><dt>适用产品</dt><dd>${escape(entry.product)}</dd></div><div><dt>负责人</dt><dd>${escape(entry.owner)}</dd></div><div><dt>来源说明</dt><dd>${escape(entry.source||'未补充，请在审核时核对依据')}</dd></div><div><dt>更新时间</dt><dd>${escape(entry.date)}</dd></div></dl><div class="knowledge-detail-content">${escape(entry.content)}</div>`;
  }

  function setStatus(identifier,status) {
    const state=host.getState();const entry=state.knowledge.find(record=>record.id===identifier);
    const publishing=status==='已发布';
    if(!scopeAllowed()||!['已发布','已停用'].includes(status))return false;
    if(!entry||entry.status!==(publishing?'待审核':'已发布')||host.getView().modal?.id!==identifier)return host.toast('这条知识已发生变化，请重新打开后核对。',true);
    if(publishing&&!document.getElementById('knowledge-approve')?.checked)return host.toast('请先确认已完成适用范围与内容复核。',true);
    const previousKnowledge=state.knowledge;const previousAudit=state.audit;
    const changed={...entry,status,date:dateLabel(),updatedAt:new Date().toISOString(),version:publishing&&entry.version==='草稿'?'V1.0':entry.version};
    state.knowledge=state.knowledge.map(record=>record.id===identifier?changed:record);
    state.audit=[{time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}),text:(publishing?'演示审核发布知识 ':'停用知识版本 ')+identifier,caseId:''},...state.audit].slice(0,100);
    if(host.persist()===false){state.knowledge=previousKnowledge;state.audit=previousAudit;host.toast('浏览器未能保存，知识状态没有改变。请检查存储空间后重试。',true);return false;}
    host.closeDialog();host.render();host.toast(publishing?'已发布；型号匹配时可用于客户体验的模型对话。':'此知识已停用，后续不再引用。');
    return true;
  }

  function configure(adapter){host=adapter;}
  function close(){editing=null;}
  return {configure,open,input,choose,save,detail,titleCell,close,setStatus};
})();
