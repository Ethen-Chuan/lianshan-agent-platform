window.SeatAssist = (() => {
  let host;
  const sessions = new Map();
  const phrases = [
    {id:'more',label:'补充现象',keywords:['现象','具体情况','补充'],group:'信息补充',text:'请再描述一下具体情况，我接着帮您看。'},
    {id:'menu',label:'确认菜单',keywords:['菜单','选项'],group:'信息补充',text:'您现在看到哪些菜单选项？'},
    {id:'steps',label:'确认已做操作',keywords:['操作','试过','排查'],group:'信息补充',text:'方便说一下已经试过哪些方法、操作后有什么变化吗？'},
    {id:'wait',label:'说明等待',keywords:['等待','进度','结果'],group:'进度反馈',text:'还没有新的处理结果。'},
    {id:'confirm',label:'确认恢复',keywords:['恢复','正常'],group:'服务确认',text:'现在恢复正常了吗？'},
    {id:'other',label:'确认其他问题',keywords:['其他问题','其他'],group:'服务确认',text:'还有其他需要一起确认的问题吗？'}
  ];
  const escape = value => host.escape(value);
  const safe = value => host.isSensitive(String(value || '')) ? '[敏感内容已移除]' : String(value || '');
  const roleName = role => ({customer:'客户',agent:'接待助手',staff:'客服',system:'系统',internal:'内部备注'}[role] || '消息');
  const action = (label,name,attributes='',tone='') => host.button(label,'seat-'+name,tone,attributes);
  const closed = item => ['已解决','关闭未解决'].includes(item.status);
  const active = item => host.canReply(item) && !closed(item);
  const ticketFor = item => host.getState().tickets.find(ticket => ticket.caseId === item.id);
  const phraseBank = () => [...phrases,...(host.getState().seatPhrases||[])];
  let composing = false;

  function signature(item) {
    return JSON.stringify([item.messages,item.status,item.owner,item.product,item.version,item.evidence,ticketFor(item),host.getState().channels.find(channel => channel.id === item.channel)?.status,host.getState().knowledge]);
  }

  function session(item) {
    if (!sessions.has(item.id)) sessions.set(item.id,{signature:'',revision:0,expanded:false,evidence:false,tab:'suggestions',collapsed:true,query:'',category:'全部',selected:null,pending:null,lastTrace:null,completion:null,dismissed:''});
    const current = sessions.get(item.id);
    const next = signature(item);
    if (current.signature !== next) {
      current.signature = next;
      current.revision += 1;
      current.selected = null;
      current.pending = null;
      current.lastTrace = null;
      current.completion = null;
    }
    return current;
  }

  function messages(item,roles) {
    return item.messages.map((message,index) => ({...message,index,text:safe(message.text)})).filter(message => roles.includes(message.role));
  }

  function context(item,ticketOverride) {
    const customers = messages(item,['customer']);
    const latest = customers.at(-1);
    const versions = [...new Set(customers.flatMap(message => message.text.match(/\bV\d+(?:\.\d+){1,3}\b/gi) || []).map(version => version.toUpperCase()))];
    const human = /(?:需要|要求|找|转|给我|要|请).*人工|不想再自动问答/.test(latest?.text || '');
    const recovered = /已经恢复正常|已恢复正常|现在正常了|问题(?:已经|已)?解决了|已经好了|找到了.*谢谢/.test(latest?.text || '') && !/未恢复|没恢复|没有恢复|尚未|仍未|还是/.test(latest?.text || '');
    return {customers,latest,versions,human,recovered,ticket:ticketOverride===undefined?ticketFor(item):ticketOverride};
  }

  function summarize(item,ticketOverride) {
    const started = performance.now();
    const current = context(item,ticketOverride);
    const answers = messages(item,['agent','staff']);
    const operations = messages(item,['system']);
    const notes = messages(item,['internal']);
    const observations = current.customers.filter(message => /重启|尝试|试过|复现|没有拆装|仍|还是|已经|找到了|恢复/.test(message.text));
    let next = '核对客户最近的诉求，再决定回复或转交。';
    if (item.owner === 'readonly') next = '历史附件不完整、结果未知；只能参考，不可向原渠道回复。';
    else if (!host.canReply(item)) next = '渠道已停用；可查看记录，不能向原渠道回复。';
    else if (closed(item)) next = item.status === '已解决' ? '已记录解决结果；如需继续处理，先重新打开会话。' : '会话已关闭，不能视为已解决；继续处理需重新打开。';
    else if (current.human || item.status === '待人工接管') next = item.owner === 'human' ? '已由人工接待，直接跟进客户诉求，不重复要求自动问答。' : '客户等待人工接待；先接管，不继续自动问诊。';
    else if (current.recovered) next = '客户反馈已恢复；客服核对后记录处理结果，尚未自动结案。';
    else if (/更换|换机|退款|赔付/.test(current.latest?.text || '') || item.priority === '高风险') next = '换机资格、费用和时间需专员核实，不能直接承诺。';
    else if (current.versions.length > 1) next = '对话提到不同软件版本，先核对当前版本，暂不套用处理方案。';
    else if (current.ticket) next = `本地工单 ${current.ticket.id}：${current.ticket.status}。这不是刚查询到的实时结果，回复前请核对。`;
    else if (item.status === '等待专家') next = '已分派专家待办，仍在等待接单；目前没有新的专家结论。';
    else if (/报修|报修单|整理.*单/.test(current.latest?.text || '')) next = '工单未创建。点击“助手填单”生成草稿，补齐信息后核对提交。';
    else if (!current.versions.length && /黑屏|断连|故障/.test(current.latest?.text || '')) next = '软件版本尚未在客户消息中明确；需要补充时再询问，不代填。';
    const rows = [
      {label:'最初诉求',text:current.customers[0]?.text || '当前没有可读取的客户正文。',indices:current.customers[0] ? [current.customers[0].index] : []},
      ...(observations.length ? [{label:'客户反馈',text:observations.at(-1).text,indices:[observations.at(-1).index]}] : []),
      {label:'最近诉求',text:current.latest?.text || '尚无客户消息。',indices:current.latest ? [current.latest.index] : []},
      {label:'已回复',text:answers.at(-1)?.text || '尚未向客户回复。',indices:answers.length ? [answers.at(-1).index] : []},
      ...(operations.length ? [{label:'系统记录',text:operations.at(-1).text,indices:[operations.at(-1).index]}] : [])
    ];
    return {caseId:item.id,rows,next,version:current.versions.length > 1 ? current.versions.join(' / ')+'（有不同说法，待核对）' : current.versions[0] || '客户未明确提供',versionIndices:current.customers.filter(message => /\bV\d+(?:\.\d+)+\b/i.test(message.text)).map(message => message.index),count:item.messages.length,lastTime:item.messages.at(-1)?.time || '无消息',noteCount:notes.length,evidence:safe(item.evidence),status:item.status,durationMs:performance.now()-started};
  }

  function suggestions(item) {
    const started = performance.now();
    const choices = generateSuggestions(item);
    const durationMs = performance.now()-started;
    return choices.map(choice => ({...choice,durationMs}));
  }

  function generateSuggestions(item) {
    if (!active(item)) return [];
    const current = context(item);
    const prompt = current.latest?.text || '';
    const published = identifier => host.getState().knowledge.find(entry => entry.id === identifier && entry.status === '已发布');
    const create = (id,label,text,source,knowledgeId='') => ({id,label,text,source,knowledgeId,group:'场景建议'});
    if (current.human) return [create('human','人工跟进',item.owner === 'human' ? '我来接着处理，前面的记录我先核对一下。' : '您的人工接待请求已收到，请稍等客服接待。','最近客户消息与当前接待状态；发送前必须人工接管')];
    if (current.recovered) return [create('recovery','确认客户反馈','好的，收到您的反馈。还有其他需要一起确认的问题吗？','客户反馈已恢复；是否结案仍需客服记录结果，不自动标记解决')];
    if (/更换|换机|退款|赔付/.test(prompt) || item.priority === '高风险') return [create('replacement','说明核实条件','能否更换、是否收费，需要专员核实检测结果和服务政策，目前还不能确定。','服务承诺限制；不保证结果或时间')];
    if (current.versions.length > 1) return [create('version-conflict','核对版本','前面的消息提到了不同软件版本，方便确认一下这台设备当前使用的版本吗？','客户消息出现不同版本，尚未核实')];
    if (current.ticket && /进度|工单|检测|结论|通知|处理到|结果/.test(prompt)) return [create('ticket','说明已有进度',`目前记录的工单 ${current.ticket.id} 状态是“${current.ticket.status}”。`,'本地关联工单记录，非实时查询；发送前核对状态')];
    if (item.status === '等待专家') return [create('expert','说明专家进度','已给专家分派待办，还在等待接单，暂时没有新的处理结论。','当前服务状态：等待专家；不等于专家已接单')];
    if (!current.ticket && /报修|报修单|整理.*单/.test(prompt)) return [
      create('draft','整理报修草稿','可以，现有信息可以先填进报修草稿，核对后再提交。','客户申请报修；当前尚无关联工单'),
      create('repair-detail','补充发生条件','除了前面提到的情况，故障在什么条件下出现、是否一直持续？','补充故障条件；不重复询问已经提供的软件版本')
    ];
    const productMentions = current.customers.flatMap(message => message.text.match(/\b(?:A1|B2|C3)\b/g) || []);
    const onlyA1 = item.product === '座舱终端 A1' && productMentions.every(product => product === 'A1');
    const versionKnowledge = published('KB-0101');
    if (onlyA1 && /在哪|哪里|怎么|查看/.test(prompt) && /版本/.test(prompt) && !/升级|更新|最新|黑屏|断连|报修|换机/.test(prompt) && versionKnowledge && versionKnowledge.product === item.product) {
      return [create('find-version','查看软件版本',safe(versionKnowledge.content),`${versionKnowledge.title} · ${versionKnowledge.version} · 已发布`,versionKnowledge.id),create('menu','确认菜单选项',phrases.find(phrase => phrase.id === 'menu').text,'信息补充常用语；请先确认客户是否需要')];
    }
    if (/黑屏|屏幕/.test(prompt)) return [create('fault-detail','补充故障现象','黑屏是在启动时出现，还是使用过程中出现？','当前客户描述；不判断硬件损坏，也不默认客户已重启')];
    return [create('clarify','确认当前问题','您希望先确认哪一部分？我按您现在遇到的问题继续跟进。','暂未匹配到已审核的适用答案，先澄清，不套用其他产品方案')];
  }

  function summaryPanel(item) {
    const current = session(item);
    const summary = summarize(item);
    const latest = summary.rows.find(row => row.label === '最近诉求');
    return `<section class="seat-summary" aria-label="会话摘要" data-case="${escape(item.id)}" data-revision="${current.revision}"><div class="seat-summary-head"><strong>${host.icon('file-text','small')} 会话摘要</strong><span>至第 ${summary.count} 条 · ${escape(summary.lastTime)}</span>${action(current.expanded?'收起':'展开','summary-toggle',`aria-expanded="${current.expanded}" aria-controls="seat-summary-detail"`,'small')}</div><p class="seat-summary-brief" title="${escape(summary.rows[0].text)}">${escape(summary.rows[0].text)}</p>${latest.text!==summary.rows[0].text?`<p class="seat-summary-recent">最近：${escape(latest.text)}</p>`:''}<p class="seat-next"><b>待跟进</b>${escape(summary.next)}</p>${current.expanded?`<div id="seat-summary-detail" class="seat-summary-detail"><dl>${summary.rows.map(row=>`<div><dt>${row.label}</dt><dd>${escape(row.text)}${row.indices.map(index=>action('原话','locate',`data-id="${escape(item.id)}" data-index="${index}" aria-label="查看${row.label}的原话"`,'small')).join('')}</dd></div>`).join('')}<div><dt>提及版本</dt><dd>${escape(summary.version)}${summary.versionIndices.map(index=>action('原话','locate',`data-id="${escape(item.id)}" data-index="${index}"`,'small')).join('')}</dd></div>${summary.evidence?`<div><dt>结案依据</dt><dd>${escape(summary.evidence)}</dd></div>`:''}</dl><p class="seat-muted">范围：当前授权会话。客户陈述、助手回复与结案依据分别记录；回复不等于已解决。${summary.noteCount?' '+summary.noteCount+' 条内部备注不参与对客建议。':''}</p></div>`:''}<div class="seat-summary-footer"><span>规则摘要 · 未接入模型</span><div>${action('更新摘要','summary-refresh','','small')}${action('摘要有误','feedback','data-kind="summary"','small')}${active(item)?action('模拟追问','followup','','small'):''}</div></div></section>`;
  }

  function available(item) {
    const current = session(item);
    if (current.tab === 'suggestions') return suggestions(item);
    return phraseBank().filter(phrase => (current.category === '全部' || phrase.group === current.category) && (!current.query || `${phrase.label}${phrase.text}${phrase.keywords?.join('')}`.includes(current.query))).map(phrase => ({...phrase,source:'本地常用语 · 请核对是否适用于当前问题'}));
  }

  function replyPanel(item) {
    const current = session(item);
    if (!active(item)) return `<section class="seat-replies seat-unavailable" aria-label="回复辅助">${closed(item)?'会话已结束，重新打开后可使用回复建议。':'当前来源只读或渠道已停用，不生成对客回复。'}</section>`;
    if (host.getView().composer === 'note') return '<section class="seat-replies seat-unavailable" aria-label="回复辅助">内部备注仅团队可见；切换到“回复客户”后可使用对客建议。</section>';
    const choices = available(item);
    const selected = choices.find(choice => choice.id === current.selected) || choices[0];
    const attributes = `data-id="${escape(item.id)}" data-revision="${current.revision}"`;
    return `<section class="seat-replies" aria-label="回复辅助"><div class="seat-reply-head"><div role="group" aria-label="回复辅助类型">${['suggestions','phrases'].map(tab=>action(tab==='suggestions'?'回复建议':'常用语库','tab',`data-value="${tab}" aria-pressed="${current.tab===tab}"`,current.tab===tab?'small selected':'small')).join('')}</div>${action(current.collapsed?'展开':'收起','reply-toggle',`aria-expanded="${!current.collapsed}" aria-controls="seat-reply-detail"`,'small')}</div>${current.collapsed?'<span class="seat-typing-hint">输入关键词时推荐常用语</span>':`<div id="seat-reply-detail">${current.tab==='phrases'?`<div class="seat-phrase-filter">${action('新增','phrase-new','','small')}<label><span class="sr-only">搜索常用语</span><input id="seat-phrase-search" type="search" placeholder="搜索常用语" value="${escape(current.query)}"></label><label><span class="sr-only">常用语分类</span><select id="seat-phrase-category">${['全部','信息补充','进度反馈','服务确认','自定义'].map(category=>`<option ${category===current.category?'selected':''}>${category}</option>`).join('')}</select></label></div>`:''}<div class="seat-reply-options" role="group" aria-label="选择回复内容">${choices.map(choice=>action(escape(choice.label),'select',`${attributes} data-value="${choice.id}" aria-pressed="${choice.id===selected?.id}"`,choice.id===selected?.id?'small selected':'small')).join('')}</div>${selected?`<div class="seat-reply-preview"><p>${escape(selected.text)}</p><div class="seat-reply-source"><span>${escape(selected.source)}</span>${selected.knowledgeId?host.button('查看知识','knowledge-detail','small',`data-id="${selected.knowledgeId}"`):''}</div><div class="seat-reply-actions"><span>仅填入草稿，不自动发送</span><div>${action('建议有误','feedback',`${attributes} data-kind="reply" data-value="${selected.id}"`,'small')}${action('填入草稿','insert',`${attributes} data-value="${selected.id}"`,'small soft')}</div></div></div>`:'<p class="seat-muted seat-empty">没有匹配的常用语，试试其他关键词或分类。</p>'}${current.pending?`<div class="seat-draft-conflict" role="status"><p>输入框已有内容，保留还是替换？</p><div>${action('追加到末尾','confirm-insert',`${attributes} data-value="append"`,'small')}${action('替换原草稿','confirm-insert',`${attributes} data-value="replace"`,'small')}${action('取消','cancel-insert','','small')}</div></div>`:''}</div>`}</section>`;
  }

  function refreshPanels(focusId) {
    const item = host.selectedCase();
    const summary = document.querySelector('.seat-summary');
    const replies = document.querySelector('.seat-replies');
    const focus = document.getElementById(focusId || '');
    const selection = focus?.selectionStart;
    if (summary) summary.outerHTML = summaryPanel(item);
    if (replies) replies.outerHTML = replyPanel(item);
    if (focusId) {
      const replacement = document.getElementById(focusId);
      replacement?.focus();
      if (replacement && typeof selection === 'number' && replacement.type !== 'search') replacement.setSelectionRange(selection,selection);
    }
  }

  function record(item,kind,payload) {
    return window.TraceHub.record({caseId:item.id,title:kind==='summary'?'生成会话摘要':payload.inserted?'选用回复建议':'生成回复建议',agent:'service',tool:kind==='summary'?'local.seat.summarize':'local.seat.suggest',durationMs:payload.durationMs||payload.candidate?.durationMs||0,input:{scope:'仅当前授权会话',messageCount:item.messages.length,caseId:item.id},output:payload,summary:kind==='summary'?'用当前消息和本地业务状态整理摘录；保留来源角色，未调用模型。':'记录本地候选文本、来源及是否填入草稿；未发送，不代表客户问题已解决。'});
  }

  function insert(item,candidate,mode='choose') {
    if (!active(item)) return host.toast('当前会话不能回复，请检查渠道和服务状态。',true);
    if (host.getView().composer !== 'reply') return host.toast('请先切换到“回复客户”。',true);
    const input = document.getElementById('reply-input');
    if (!input || input.disabled) return;
    const current = session(item);
    if (input.value.trim() && input.value !== candidate.text && mode === 'choose') {
      current.pending = {candidate,revision:current.revision,original:input.value};
      current.collapsed = false;
      refreshPanels();
      return;
    }
    const text = mode === 'append' ? input.value.trimEnd()+'\n'+candidate.text : candidate.text;
    if (host.isSensitive(text)) return host.toast('草稿含疑似敏感信息，请先移除。',true);
    if (!host.setComposerText(text)) return;
    current.pending = null;
    record(item,'reply',{candidate:{id:candidate.id,text:candidate.text,source:candidate.source,durationMs:candidate.durationMs||0},inserted:true,sent:false,mode});
    refreshPanels();
    document.getElementById('reply-input')?.focus();
    host.toast('已填入草稿，核对后再发送。');
  }

  function externalInsert(text,label='常用回复') {
    insert(host.selectedCase(),{id:'legacy',text,source:label});
  }

  function dispatch(name,element) {
    const item = host.selectedCase();
    const current = session(item);
    const value = element.dataset.value;
    if(name==='complete')return complete(value);
    if(name==='dismiss-completion'){current.dismissed=document.getElementById('reply-input')?.value||'';current.completion=null;return paintCompletion();}
    if(name==='phrase-new')return newPhrase();
    if(name==='phrase-save')return savePhrase();
    if (element.dataset.id && element.dataset.id !== item.id) return host.toast('会话已切换，请重新选择。',true);
    if (element.dataset.revision && Number(element.dataset.revision) !== current.revision) return host.toast('会话已有更新，请使用新的建议。',true);
    switch (name) {
      case 'summary-toggle': current.expanded = !current.expanded; return refreshPanels();
      case 'summary-refresh': current.lastTrace = record(item,'summary',summarize(item)); refreshPanels(); return host.toast('已按当前可见记录更新摘要。');
      case 'locate': {
        const target = document.getElementById(`seat-message-${item.id}-${element.dataset.index}`);
        if (!target) return host.toast('原消息暂不可见。',true);
        document.querySelectorAll('.seat-message-highlight').forEach(message => message.classList.remove('seat-message-highlight'));
        target.classList.add('seat-message-highlight');
        target.scrollIntoView?.({block:'center',behavior:'auto'});
        target.focus({preventScroll:true});
        return;
      }
      case 'tab': current.tab = value === 'phrases' ? 'phrases' : 'suggestions'; current.selected = null; current.pending = null; current.collapsed = false; return refreshPanels();
      case 'reply-toggle': current.collapsed = !current.collapsed; return refreshPanels();
      case 'select': current.selected = value; current.pending = null; return refreshPanels();
      case 'insert': {
        const candidate = available(item).find(choice => choice.id === value);
        if (!candidate) return host.toast('这条建议已不可用，请重新选择。',true);
        return insert(item,candidate);
      }
      case 'confirm-insert': {
        const pending = current.pending;
        if (!pending || pending.revision !== current.revision) return host.toast('内容已更新，请重新选择建议。',true);
        if (document.getElementById('reply-input')?.value !== pending.original) {
          current.pending = null; refreshPanels(); return host.toast('草稿已被编辑，未覆盖；请重新选择插入方式。',true);
        }
        if (!['append','replace'].includes(value)) return;
        return insert(item,pending.candidate,value);
      }
      case 'cancel-insert': current.pending = null; return refreshPanels();
      case 'feedback': {
        const isSummary = element.dataset.kind === 'summary';
        const candidate = available(item).find(choice => choice.id === value);
        if (!isSummary && !candidate) return host.toast('当前建议已更新，请重新选择。',true);
        const identifier = isSummary ? current.lastTrace || record(item,'summary',summarize(item)) : record(item,'reply',{candidate,inserted:false,sent:false,feedback:true});
        if (isSummary) current.lastTrace = identifier;
        return window.TraceHub.dispatch('bad-new',{dataset:{id:identifier,span:'SP-01'}});
      }
      case 'followup':
        if (!active(item)) return;
        return host.showDialog('模拟客户补充','只向当前会话加入演示消息，不自动回复或修改工单。',`<div class="field"><label for="seat-followup-text">客户消息（仅限模拟内容）</label><textarea id="seat-followup-text" maxlength="800">还没有恢复，想确认接下来怎么处理。</textarea></div><div id="seat-followup-error" class="inline-error" role="alert"></div>`,host.footer('加入当前会话','seat-followup-submit'));
      case 'followup-submit': {
        if (!active(item)) return host.toast('当前会话不能加入新消息。',true);
        const text = document.getElementById('seat-followup-text')?.value.trim();
        if (!text) return document.getElementById('seat-followup-error').textContent = '请填写一条模拟客户消息。';
        if (text.length > 800) return document.getElementById('seat-followup-error').textContent = '模拟消息请控制在 800 字以内。';
        if (host.isSensitive(text)) return document.getElementById('seat-followup-error').textContent = '含疑似敏感信息，请移除后再演示。';
        host.addMessage(item,'customer',text);
        item.status = item.owner === 'human' ? '人工处理中' : '待人工接管';
        host.audit('已加入当前会话的模拟追问，未自动回复',item.id);
        host.closeDialog(); host.render(); host.scrollChat();
        return host.toast('已加入消息，摘要和建议已更新。');
      }
    }
  }

  function input(identifier,value) {
    if (identifier !== 'seat-phrase-search') return;
    const current = session(host.selectedCase());
    current.query = value; current.selected = null; current.pending = null;
    refreshPanels(identifier);
  }

  function change(identifier,value) {
    if (identifier !== 'seat-phrase-category') return;
    const current = session(host.selectedCase());
    current.category = value; current.selected = null; current.pending = null;
    refreshPanels(identifier);
  }

  function sync() {
    if (!host || host.getView().page !== 'workspace') return;
    const panel = document.querySelector('.seat-summary');
    if (panel && Number(panel.dataset.revision) !== session(host.selectedCase()).revision) host.render();
  }

  function matchPhrases(text,caret,bank=phrases) {
    const before=String(text).slice(0,caret);
    return bank.flatMap(phrase=>{
      const keyword=(phrase.keywords||[]).filter(word=>word.length>=2&&before.toLowerCase().endsWith(word.toLowerCase())).sort((left,right)=>right.length-left.length)[0];
      return keyword?[{...phrase,keyword,start:caret-keyword.length,end:caret}]:[];
    }).sort((left,right)=>right.keyword.length-left.keyword.length).slice(0,3);
  }
  function typeahead(input,isComposing=false) {
    if(!host||host.getView().page!=='workspace')return;
    const item=host.selectedCase();const state=session(item);
    if(!input||input.disabled||isComposing||composing||!active(item)||host.getView().composer!=='reply'||host.isSensitive(input.value)||input.selectionStart!==input.selectionEnd){state.completion=null;paintCompletion();return;}
    const choices=input.value===state.dismissed?[]:matchPhrases(input.value,input.selectionStart,phraseBank());
    state.completion=choices.length?{original:input.value,caret:input.selectionStart,choices,index:-1,revision:state.revision}:null;
    paintCompletion();
  }
  function paintCompletion() {
    const container=document.getElementById('seat-inline-phrases');if(!container)return;
    const state=session(host.selectedCase());const completion=state.completion;
    container.innerHTML=completion?`<section class="seat-typeahead" aria-label="输入触发的常用语"><header><span>匹配“${escape(completion.choices[0].keyword)}” · 仅填入草稿</span>${action('关闭','dismiss-completion','','quiet small')}</header><div id="seat-completions" role="listbox" aria-label="常用语候选">${completion.choices.map((choice,index)=>`<button id="seat-completion-${index}" data-action="seat-complete" data-value="${escape(choice.id)}" role="option" aria-selected="${completion.index===index}"><strong>${escape(choice.label)}</strong><span>${escape(choice.text)}</span><small>替换关键词</small></button>`).join('')}</div><footer>↑ ↓ 选择 · Enter 填入 · Esc 收起 · 不自动发送</footer></section>`:'';
    const input=document.getElementById('reply-input');
    if(input){if(completion){input.setAttribute('aria-controls','seat-completions');if(completion.index>=0)input.setAttribute('aria-activedescendant','seat-completion-'+completion.index);else input.removeAttribute('aria-activedescendant');}else{input.removeAttribute('aria-controls');input.removeAttribute('aria-activedescendant');}}
  }
  function complete(identifier) {
    const item=host.selectedCase();const state=session(item);const completion=state.completion;
    const choice=completion?.choices.find(choice=>choice.id===identifier);const input=document.getElementById('reply-input');
    if(!choice||!input||input.disabled||!active(item)||host.getView().composer!=='reply'||completion.revision!==state.revision||input.value!==completion.original||input.selectionStart!==completion.caret)return host.toast('草稿或会话已变化，请重新选择常用语。',true);
    const text=input.value.slice(0,choice.start)+choice.text+input.value.slice(choice.end);
    if(host.isSensitive(text)||!host.setComposerText(text))return;
    state.completion=null;state.dismissed=text;paintCompletion();
    input.focus();input.setSelectionRange(choice.start+choice.text.length,choice.start+choice.text.length);
    record(item,'reply',{candidate:{id:choice.id,text:choice.text,source:'关键词触发的本地常用语'},inserted:true,sent:false,mode:'replace-keyword'});
  }
  function newPhrase() {
    host.showDialog('新增本地常用语','只保存在当前浏览器的售后项目，不自动回复客户。',`<div class="seat-new-phrase"><label>名称<input id="seat-new-label" maxlength="24" placeholder="例如：补充序列号"></label><label>触发关键词（逗号分隔，至少 2 字）<input id="seat-new-keywords" maxlength="80" placeholder="序列号,设备编号"></label><label>完整话术<textarea id="seat-new-text" maxlength="500" rows="4" placeholder="仅填写通用话术，不含真实客户信息或未核实承诺。"></textarea></label><p id="seat-new-error" role="alert"></p></div>`,action('保存常用语','phrase-save','','primary')+host.button('取消','close-dialog'));
  }
  function savePhrase() {
    const label=document.getElementById('seat-new-label')?.value.trim()||'';
    const raw=document.getElementById('seat-new-keywords')?.value||'';
    const keywords=[...new Set(raw.split(/[,，、\n]/).map(word=>word.trim()).filter(Boolean))];
    const text=document.getElementById('seat-new-text')?.value.trim()||'';
    const error=document.getElementById('seat-new-error');if(!error)return;
    if(!label||label.length>24||!text||text.length>500||!keywords.length||keywords.some(word=>word.length<2||word.length>20)||raw.length>80){error.textContent='请补全名称、2–20 字的关键词和 500 字以内话术。';return;}
    if(host.isSensitive([label,text,raw].join(' '))){error.textContent='请先移除敏感信息。';return;}
    const bank=phraseBank();if(bank.some(phrase=>phrase.label===label||phrase.text===text)){error.textContent='已有相同名称或内容，不重复添加。';return;}
    const state=host.getState();state.seatPhrases ||= [];if(state.seatPhrases.length>=50){error.textContent='本地自定义常用语最多 50 条。';return;}
    state.seatPhrases.push({id:'phrase-'+crypto.randomUUID(),label,keywords,text,group:'自定义'});host.persist();host.closeDialog();session(host.selectedCase()).tab='phrases';session(host.selectedCase()).collapsed=false;refreshPanels();host.toast('已保存本地常用语，输入对应关键词即可看到推荐。');
  }
  function configure(api) {
    host=api;
    document.addEventListener('compositionstart',event=>{if(event.target.id==='reply-input'){composing=true;typeahead(event.target,true);}});
    document.addEventListener('compositionend',event=>{if(event.target.id==='reply-input'){composing=false;typeahead(event.target);}});
    document.addEventListener('click',event=>{if(event.target.id==='reply-input')typeahead(event.target);});
    document.addEventListener('keydown',event=>{
      if(event.target.id!=='reply-input'||event.isComposing||composing||event.ctrlKey||event.metaKey)return;
      const state=session(host.selectedCase());const completion=state.completion;if(!completion)return;
      if(event.key==='Escape'){event.preventDefault();state.dismissed=event.target.value;state.completion=null;paintCompletion();}
      if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();completion.index=(completion.index+(event.key==='ArrowDown'?1:completion.index<0?0:-1)+completion.choices.length)%completion.choices.length;paintCompletion();}
      if(event.key==='Enter'&&completion.index>=0){event.preventDefault();complete(completion.choices[completion.index].id);}
    });
  }
  return {configure,summaryPanel,replyPanel,dispatch,input,change,externalInsert,summarize,suggestions,sync,typeahead,matchPhrases,reset(){sessions.clear();composing=false;}};
})();
