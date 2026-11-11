window.BusinessGraph = (() => {
  let host;
  const defaults = () => ({day:'2026-11-07',channel:'all',domain:'all',search:'',topic:'audio',selected:'topic',selectionType:'node',kind:'all',evidenceOnly:false,query:'same',presentation:'graph',result:null});
  let ui = defaults();
  const source = () => window.HubProblemData;
  const escape = value => host.escape(value);
  const action = (label,name,attributes='',tone='quiet small') => host.button(label,'graph-'+name,tone,attributes);
  const scope = () => ({day:ui.day,channel:ui.channel,domain:ui.domain});
  const catalog = () => window.ProblemInsights.currentOntology();
  const accepted = topic => catalog().terms.some(term => term.id===topic.id || term.aliases?.some(alias => alias.id===topic.id));
  const channelName = identifier => window.HubAnalyticsData.channels.find(entry => entry.id===identifier)?.name || '历史存档';
  const matches = topic => `${topic.title} ${topic.domain} ${topic.product} ${topic.version} ${topic.knowledge}`.toLowerCase().includes(ui.search.trim().toLowerCase()) && (ui.kind!=='new' || !accepted(topic));
  const lanes = [{id:'scope',name:'发生范围',note:'实例中记录的业务字段'},{id:'sources',name:'来源案例',note:'回到原始描述核对信息'},{id:'leads',name:'核验线索',note:'关联不等于原因或结论'}];

  function model() {
    const report = source().snapshot(scope());
    const groups = report.groups.filter(matches);
    const topic = groups.find(entry => entry.id===ui.topic) || groups[0];
    if (!topic) return {report,groups,topic:null,nodes:[],edges:[],rows:[],related:[]};
    ui.topic = topic.id;
    const rows = topic.rows.filter(row => !ui.evidenceOnly || row.primaryEvidence);
    const cases = [...rows].sort((left,right) => Number(right.primaryEvidence)-Number(left.primaryEvidence) || left.id.localeCompare(right.id)).slice(0,2);
    const related = topic.version==='不适用' ? [] : report.groups.filter(entry => entry.id!==topic.id && entry.product===topic.product && entry.version===topic.version && (!ui.evidenceOnly || entry.evidenceCount>0));
    const sourceIds = rows.map(row => row.id);
    const nodes = [
      {id:'topic',kind:'topic',type:'问题现象',label:topic.short,description:topic.symptom,sourceIds},
      {id:'product',kind:'entity',lane:'scope',type:'产品型号',label:topic.product,description:'来自所列实例的产品字段；不根据渠道或相似症状推断型号。',sourceIds},
      {id:'version',kind:'entity',lane:'scope',type:'软件版本',label:topic.version,description:topic.version==='不适用'?'此类业务没有软件版本约束。“不适用”不是共同版本，不能用于扩大关联检索。':'版本是检索约束。不同版本的相似症状不能直接沿用处理结论。',sourceIds},
      {id:'stage',kind:'entity',lane:'scope',type:'业务环节',label:topic.stage,description:'记录触发步骤或服务节点，不将发生环节解释为故障原因。',sourceIds},
      {id:'domain',kind:'entity',lane:'scope',type:'业务领域',label:topic.domain,description:'来自历史问题分类 v0.2；与 Orbit 共享业务本体尚未自动映射。',sourceIds},
      ...cases.map(row => ({id:row.id,kind:'case',lane:'sources',type:row.primaryEvidence?'含佐证示例 · 待核实':'信息不足',label:row.id,description:row.customerText,sourceIds:[row.id],record:row})),
      {id:'hypothesis',kind:'hypothesis',lane:'leads',type:'原因假设 · 未确认',label:topic.hypothesis,description:topic.evidence,sourceIds:rows.filter(row => row.primaryEvidence).map(row => row.id)},
      {id:'knowledge',kind:'knowledge',lane:'leads',type:'知识索引 · 未接正文',label:topic.knowledge,description:'仅预置索引，没有正式文档正文、发布状态和适用性审核，不能当作处理依据。',sourceIds:[]},
      ...(related.length ? [{id:'related',kind:'related',lane:'leads',type:'同范围问题 · 非同根因',label:related.length+' 类其他问题',description:'共享型号与软件版本，尚未证明原因相同；不跨当前日期、渠道和领域范围。',sourceIds:related.flatMap(entry => entry.rows.filter(row => !ui.evidenceOnly || row.primaryEvidence).map(row => row.id)),related}] : [])
    ];
    const relations = {product:'涉及型号',version:'发生版本',stage:'发生环节',domain:'归入领域',knowledge:'待核对索引',hypothesis:'提出假设',related:'同范围关联'};
    const edges = nodes.filter(node => node.id!=='topic').map(node => ({id:'edge-'+node.id,from:'topic',to:node.id,label:relations[node.id] || '来源实例',uncertain:node.lane==='leads',sourceIds:node.sourceIds}));
    return {report,groups,topic,rows,nodes,edges,related};
  }

  function refresh(focusId) {
    const previous = document.getElementById('main-content')?.scrollTop || 0;
    const topicScroll = document.querySelector('.graph-topic-list');
    const listScroll = topicScroll ? {left:topicScroll.scrollLeft,top:topicScroll.scrollTop} : null;
    const focused = document.activeElement;
    const selection = focusId && focused?.id===focusId ? focused.selectionStart : null;
    host.render();
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = previous;
    const freshList = document.querySelector('.graph-topic-list');
    if (freshList && listScroll) {freshList.scrollLeft=listScroll.left;freshList.scrollTop=listScroll.top;}
    if (focusId) {
      const fresh = document.getElementById(focusId);
      fresh?.focus({preventScroll:true});
      if (typeof selection==='number' && fresh?.setSelectionRange) fresh.setSelectionRange(selection,selection);
    }
  }

  function invalidate() {ui.result=null;ui.selected='topic';ui.selectionType='node';}

  function open(identifier,filters={}) {
    const report = source().snapshot(filters);
    ui = {...defaults(),day:report.day,channel:report.channel,domain:report.domain,topic:source().topics.some(topic => topic.id===identifier)?identifier:'audio'};
    host.navigate('graph');
  }

  function filters() {
    return `<section class="graph-filters" aria-label="实例图谱筛选"><label><span>样本日期</span><select id="graph-day">${[...source().dates].reverse().map(day => `<option value="${day}" ${ui.day===day?'selected':''}>${day}</option>`).join('')}<option value="week" ${ui.day==='week'?'selected':''}>2026.11.01 — 11.07</option></select></label><label><span>渠道</span><select id="graph-channel">${[{id:'all',name:'全部示例渠道'},...window.HubAnalyticsData.channels,{id:'archive',name:'历史存档（无样本）'}].map(channel => `<option value="${channel.id}" ${ui.channel===channel.id?'selected':''}>${escape(channel.name)}</option>`).join('')}</select></label><label><span>领域</span><select id="graph-domain">${['all',...source().domains].map(domain => `<option value="${escape(domain)}" ${ui.domain===domain?'selected':''}>${domain==='all'?'全部业务领域':escape(domain)}</option>`).join('')}</select></label><label class="graph-evidence-filter"><input type="checkbox" id="graph-evidence-only" ${ui.evidenceOnly?'checked':''}><span>仅含佐证的案例</span></label><span class="graph-sample-tag">固定模拟样本</span></section>`;
  }

  function issueList(graph) {
    const remaining = graph.report.groups.filter(topic => !accepted(topic)).length;
    return `<aside class="graph-issues" aria-label="问题列表"><div class="graph-issues-title"><h3>问题列表</h3><span>${graph.groups.length} 类</span></div><label class="graph-search">${host.icon('search','small')}<input id="graph-search" value="${escape(ui.search)}" placeholder="问题 / 型号 / 知识编号" aria-label="搜索图谱问题" maxlength="120"></label><div class="graph-list-tabs">${[['all','全部'],['new','待归类 '+remaining]].map(([kind,label]) => action(label,'kind',`data-value="${kind}" id="graph-kind-${kind}" aria-pressed="${ui.kind===kind}"`,ui.kind===kind?'selected':'quiet')).join('')}</div><div class="graph-topic-list">${graph.groups.map((topic,index) => `<button class="graph-topic ${graph.topic?.id===topic.id?'selected':''}" data-action="graph-topic" data-id="${topic.id}" id="graph-topic-${topic.id}" aria-pressed="${graph.topic?.id===topic.id}"><span class="graph-topic-index">${String(index+1).padStart(2,'0')}</span><span><strong>${escape(topic.short)}</strong><small>${escape(topic.product)} · ${escape(topic.version)}</small><em>${accepted(topic)?'已入问题目录':'候选分类 · 待审核'}</em></span><b>${topic.count}<small>件</small></b></button>`).join('') || '<p class="graph-list-empty">没有匹配的问题。</p>'}</div><p class="graph-index-note">按当前范围的去重实例数排序。搜索与“待归类”只筛选问题目录；佐证筛选只改变案例展示。</p><div class="graph-catalog-link">${action('问题分类目录 · v'+escape(catalog().version),'catalog')}${action('分类版本记录','versions')}</div></aside>`;
  }

  function relationItem(node,edge) {
    const selected = ui.selectionType==='node' && ui.selected===node.id;
    return `<div class="graph-relation graph-relation-${node.kind}"><button class="graph-edge ${ui.selectionType==='edge'&&ui.selected===edge.id?'selected':''}" data-action="graph-edge" data-id="${edge.id}" aria-pressed="${ui.selectionType==='edge'&&ui.selected===edge.id}" aria-label="查看关系：${escape(edge.label)}，${escape(node.label)}"><span>${escape(edge.label)}</span></button><button class="graph-node graph-node-${node.kind} ${selected?'selected':''}" data-action="graph-node" data-id="${node.id}" aria-pressed="${selected}" aria-controls="graph-inspector"><span class="graph-node-type">${escape(node.type)}</span><strong class="graph-node-label">${escape(node.label)}</strong>${node.record?`<p>${escape(node.description)}</p><small>${escape(channelName(node.record.channel))} · ${node.record.date}</small>`:''}${node.id==='knowledge'?'<small>正文与适用性均待核对</small>':''}${node.id==='related'?'<small>相同型号与版本，不代表相同原因</small>':''}<span class="graph-node-open" aria-hidden="true">${host.icon('arrow-up-right','small')}</span></button></div>`;
  }

  function relationList(graph) {
    return `<div class="graph-table-scroll"><table class="graph-relation-table"><caption class="sr-only">当前问题的完整关联，所有关系均不代表确定因果</caption><thead><tr><th>从当前问题出发</th><th>关联对象</th><th>依据状态</th></tr></thead><tbody>${graph.edges.map(edge => {const node=graph.nodes.find(entry => entry.id===edge.to);return `<tr><td>${action(escape(edge.label),'edge',`data-id="${edge.id}" aria-pressed="${ui.selectionType==='edge'&&ui.selected===edge.id}"`)}</td><td>${action(escape(node.label),'node',`data-id="${node.id}" aria-pressed="${ui.selectionType==='node'&&ui.selected===node.id}"`)}<small>${escape(node.type)}</small></td><td>${node.kind==='knowledge'?'无正文':edge.uncertain?'待核验线索':node.kind==='case'?'来源可回查 · 待人工核实':'实例字段'}<small>${node.sourceIds.length} 个关联实例</small></td></tr>`;}).join('')}</tbody></table></div>`;
  }

  function canvas(graph) {
    const evidenceCount = graph.rows.filter(row => row.primaryEvidence).length;
    return `<section class="graph-canvas-panel" aria-label="问题与证据关联"><div class="graph-viewbar"><span>问题与证据关联 <small>连线表示关联，不是执行流程</small></span><div role="group" aria-label="图谱呈现方式">${[['graph','关联视图'],['list','关系列表']].map(([value,label]) => action(label,'presentation',`data-value="${value}" id="graph-view-${value}" aria-pressed="${ui.presentation===value}"`,ui.presentation===value?'selected':'quiet')).join('')}</div></div><div class="graph-focus" id="graph-focus"><div><span class="graph-focus-kicker">当前问题 <i></i> ${accepted(graph.topic)?'已入问题目录':'分类候选 · 待审核'}</span><h3>${escape(graph.topic.title)}</h3><p>${escape(graph.topic.symptom)}</p></div><div class="graph-focus-count"><strong>${graph.topic.count}</strong><span>当前范围实例</span></div></div><div class="graph-scope-summary"><span>展示 <b>${graph.rows.length}</b> 件 / 其中 <b>${evidenceCount}</b> 件含佐证示例</span><span>佐证待人工核实 · 根因尚未确认</span></div>${ui.presentation==='list'?relationList(graph):`<div class="graph-branches" role="group" aria-label="按发生范围、来源案例、核验线索分组的关系图">${lanes.map((lane,index) => `<section class="graph-lane graph-lane-${lane.id}"><header><span>${String(index+1).padStart(2,'0')}</span><div><h4>${lane.name}</h4><p>${lane.note}</p></div></header><div class="graph-lane-relations">${graph.nodes.filter(node => node.lane===lane.id).map(node => relationItem(node,graph.edges.find(edge => edge.to===node.id))).join('') || '<p class="graph-lane-empty">当前筛选无可展示的案例。可取消佐证筛选，不补造来源。</p>'}</div>${lane.id==='sources'?`<div class="graph-cases-note"><p>先展示 ${graph.nodes.filter(node => node.kind==='case').length} / ${graph.rows.length} 件，优先含佐证示例。</p>${action('查看全部 '+graph.rows.length+' 件来源','all-cases','','small')}</div>`:''}</section>`).join('')}</div>`}<div class="graph-legend"><span><i></i>实例字段 / 来源归属</span><span><i class="graph-dashed"></i>待核验关联</span><small>点击对象或关系标签，展开依据与边界</small></div></section>`;
  }

  function sourceLinks(identifiers,limit=4) {
    return identifiers.slice(0,limit).map(identifier => action(escape(identifier)+' '+host.icon('arrow-up-right','small'),'source',`data-id="${identifier}"`)).join('');
  }

  function inspector(graph) {
    const edge = ui.selectionType==='edge' ? graph.edges.find(entry => entry.id===ui.selected) : null;
    const node = graph.nodes.find(entry => entry.id===(edge?edge.to:ui.selected)) || graph.nodes[0];
    return `<section class="graph-inspector" id="graph-inspector" aria-label="所选对象与关系详情"><div class="graph-inspector-main"><div class="graph-inspector-label">${edge?'关系依据':'所选对象'} <span>${escape(node.type)}</span></div><h3 id="graph-inspector-heading" tabindex="-1">${escape(node.label)}</h3><p>${escape(node.description)}</p>${edge?`<p class="graph-proof"><b>${escape(graph.topic.short)} · ${escape(edge.label)} · ${escape(node.label)}</b><span>${edge.uncertain?'只记录关联或待核验线索，不作为确定因果。':'来自所列模拟实例的明确字段或来源归属，不代表业务执行。'}</span></p>`:''}${node.kind==='hypothesis'?`<div class="graph-caution"><strong>反证与限制</strong><p>${escape(graph.topic.counter)}</p></div>`:''}${node.kind==='knowledge'?'<div class="graph-caution">索引不是知识正文，也未通过适用性审核；不能直接交给助手执行。</div>':''}${node.related?`<div class="graph-neighbors">${node.related.map(topic => action(escape(topic.short)+' · '+topic.count+' 件','topic',`data-id="${topic.id}"`)).join('')}</div>`:''}${node.record?`<dl class="graph-record-meta"><div><dt>日期 / 渠道</dt><dd>${node.record.date} · ${escape(channelName(node.record.channel))}</dd></div><div><dt>结果</dt><dd>${escape(node.record.result)}</dd></div><div><dt>复核状态</dt><dd>${escape(node.record.reviewStatus)}</dd></div></dl>`:''}${node.id==='topic'?`<p class="graph-proof">${graph.topic.count} 个实例来自当前筛选，当前展示 ${graph.rows.length} 件。分类归属不代表原因已确认。</p>`:''}</div><div class="graph-inspector-sources"><h4>${node.kind==='hypothesis'?'关联佐证示例':'关联来源'} <span>${node.sourceIds.length} 件</span></h4><div class="graph-source-links">${sourceLinks(node.sourceIds) || '<p>当前无可回查来源；不是已确认的业务依据。</p>'}</div>${node.sourceIds.length>4?`<p>先列 4 件，可通过下方关联检索查看其余来源。</p>`:''}<small>固定模拟片段，仅支持来源回查；不是可信度评分。</small>${action('返回当前关系','return','','quiet small')}</div></section>`;
  }

  function nextStep(graph) {
    return `<section class="graph-next"><div><span>待核实事项</span><h3>${escape(graph.topic.action)}</h3><p>建议核验团队：${escape(graph.topic.owner)} · 尚未创建真实工单或通知团队</p></div><div>${action(window.ProblemInsights.getState().followups.some(entry => entry.topicId===graph.topic.id)?'查看跟进草稿':'登记核验草稿','followup',`data-id="${graph.topic.id}"`,'primary small')}${!accepted(graph.topic)?action(window.ProblemInsights.getState().decisions.some(entry => entry.topicId===graph.topic.id)?'查看分类审核':'审核候选分类','review',`data-id="${graph.topic.id}"`):''}</div></section>`;
  }

  function queryBar(graph) {
    return `<section class="graph-query" aria-label="有范围的关联检索"><div><strong>关联案例检索</strong><small>${graph.topic.version==='不适用'?'本问题没有软件版本约束，仅检索当前问题。':'限定当前日期、渠道、领域；同型号同版本也不代表同根因。'}</small></div><label><span class="sr-only">关联检索范围</span><select id="graph-query"><option value="current" ${ui.query==='current'||graph.topic.version==='不适用'?'selected':''}>仅当前问题</option><option value="same" ${ui.query==='same'&&graph.topic.version!=='不适用'?'selected':''} ${graph.topic.version==='不适用'?'disabled':''}>同型号 + 同版本</option></select></label>${action('检索关联案例 '+host.icon('arrow-right','small'),'run','','primary small')}</section>`;
  }

  function resultPanel() {
    const result = ui.result;
    if (!result) return '';
    return `<section class="graph-results" id="graph-results" tabindex="-1"><header><div><span>本次关联检索 · ${escape(result.snapshotId)}</span><h3>${result.rows.length} 个案例，${result.topicIds.length} 类问题</h3></div>${host.button('查看检索追踪','trace-open','quiet small',`data-id="${result.traceId}" data-owner="analytics"`)}</header><ol class="graph-retrieval-path">${result.path.map(step => `<li>${escape(step)}</li>`).join('')}</ol><p>本问题 ${result.ownCount} 件；同范围其他问题 ${result.rows.length-result.ownCount} 件。排除 ${result.excluded} 个不符合型号 / 版本 / 问题条件的实例${result.noEvidence?'，另有 '+result.noEvidence+' 个缺少佐证示例未展示':''}。仅返回关联来源，未调用模型生成答案。</p><div class="graph-result-rows">${result.rows.slice(0,result.limit).map(row => `<button data-action="graph-source" data-id="${row.id}"><span><strong>${escape(source().topics.find(topic => topic.id===row.topicId).short)}</strong><small>${row.id} · ${row.date} · ${escape(channelName(row.channel))}</small></span><span>${row.primaryEvidence?'含佐证示例':'信息不足'} ${host.icon('arrow-up-right','small')}</span></button>`).join('') || '<div class="graph-list-empty">当前证据筛选没有可返回的案例；没有补造结果。</div>'}</div>${result.rows.length>result.limit?action('再显示 12 条','more','id="graph-more"','small'):''}<p class="graph-result-note">固定模拟数据；不等同于生产 GraphRAG、自动根因分析或助手执行。</p></section>`;
  }

  function page() {
    const graph = model();
    return `<div class="business-graph"><header class="graph-page-heading"><div><span class="graph-eyebrow">业务分析 / 实例层</span><h1>业务实例图谱</h1><p>查看问题的发生范围、来源案例和待核实原因。</p></div><div>${action('这张图怎么看','schema')}${action('Orbit 业务本体 '+host.icon('arrow-up-right','small'),'orbit','','small')}</div></header><div class="graph-boundary"><span><b>这里看事实与线索</b> 具体问题、发生范围、来源和证据缺口</span><span><b>Orbit 定义业务与规则</b> 供业务助手配置复用</span><small>当前尚未自动映射 · 分类审核不会修改 Orbit</small></div>${filters()}<div class="graph-workspace">${issueList(graph)}<div class="graph-analysis">${graph.topic?canvas(graph)+inspector(graph)+nextStep(graph):`<section class="graph-empty"><span>暂无实例</span><h2>当前范围没有匹配的问题</h2><p>调整日期、渠道或搜索条件。没有样本时，不生成关系或检索结果。</p>${action('清除筛选','clear','','primary')}</section>`}</div></div>${graph.topic?queryBar(graph)+resultPanel():''}<footer class="graph-footer"><span>历史分类快照 v0.2 · 当前问题目录 v${escape(catalog().version)} · 固定样本截至 2026.11.07</span><span>本地结构化关联 · 未接入自动抽取、模型生成或外部执行</span></footer></div>`;
  }

  function run() {
    const started = performance.now();
    const graph = model();
    if (!graph.topic) return;
    const query = graph.topic.version==='不适用' ? 'current' : ui.query;
    const candidates = graph.report.rows.filter(row => query==='current'?row.topicId===graph.topic.id:row.product===graph.topic.product && row.version===graph.topic.version);
    const rows = candidates.filter(row => !ui.evidenceOnly || row.primaryEvidence).sort((left,right) => Number(right.topicId===graph.topic.id)-Number(left.topicId===graph.topic.id) || Number(right.primaryEvidence)-Number(left.primaryEvidence) || left.id.localeCompare(right.id));
    const result = {snapshotId:graph.report.snapshotId,rows,topicIds:[...new Set(rows.map(row => row.topicId))],ownCount:rows.filter(row => row.topicId===graph.topic.id).length,excluded:graph.report.rows.length-candidates.length,noEvidence:candidates.length-rows.length,limit:12,path:[graph.topic.title,query==='same'?graph.topic.product+' / '+graph.topic.version:'限定当前问题',ui.evidenceOnly?'保留含佐证示例的来源':'保留全部来源，标注信息缺口','按实例去重并返回原始片段']};
    result.traceId = window.TraceHub.record({title:'图谱关联检索：'+graph.topic.short,agent:'analytics',tool:'local.graph.traverse',input:{...scope(),topicId:graph.topic.id,query,evidenceOnly:ui.evidenceOnly,catalogVersion:catalog().version,statisticsCatalog:'0.2'},output:{snapshotId:result.snapshotId,path:result.path,count:rows.length,topicIds:result.topicIds,sourceIds:rows.map(row => row.id),excluded:result.excluded,noEvidence:result.noEvidence,modelCalled:false,causalConclusion:null},source:'本地模拟实例 / 问题目录 v'+catalog().version,durationMs:performance.now()-started,summary:'范围过滤、结构化关联和实例去重；未调用模型，没有自动生成原因结论。'});
    ui.result = result;
    refresh();
    document.getElementById('graph-results')?.focus({preventScroll:true});
    document.getElementById('graph-results')?.scrollIntoView({block:'nearest',behavior:'auto'});
  }

  function schema() {
    host.showDialog('实例图谱与业务本体，不是同一层','本页分析具体业务实例；Orbit 管理可复用的业务定义和处理边界。',`<div class="graph-schema"><h3>这张图回答什么？</h3><p>哪里出现了什么问题、哪些原始案例可以回查、还缺哪些证据、下一步由谁核验。连线是关联，不是任务执行顺序。</p><h3>实线与虚线怎么读？</h3><p>实线表示实例中记录的产品、版本、环节或来源；虚线表示原因假设、待核对的知识索引、同范围其他问题。来源可追溯不代表原因已证实。</p><h3>问题分类目录 ≠ Orbit 本体</h3><p>分类目录只管理问题的命名、纳入与排除条件、候选审核和版本。旧版“本体与回流”现已改名，保留历史快照和人工发布机制。</p><h3>如何跟进问题？</h3><p>先查看来源、登记核验草稿。分类候选经人工审核后可更新本地问题目录；如果确认需要调整助手规则，再到 Orbit 单独修改定义并验收。本页不会自动修改本体、创建助手或更新已验收版本。</p><h3>当前接入边界</h3><p>实例与 Orbit 尚未自动映射。数据为固定模拟样本；已实现本地筛选、来源回查与检索追踪，未接入自动抽取、向量召回、模型生成和业务执行。</p></div>`,host.button('明白了','close-dialog'));
  }

  function dispatch(name,element) {
    const identifier = element.dataset.id;
    const value = element.dataset.value;
    if (name==='topic' && source().topics.some(topic => topic.id===identifier)) {ui.topic=identifier;ui.search='';ui.kind='all';invalidate();refresh('graph-topic-'+identifier);}
    else if (name==='node' || name==='edge') {
      const graph = model();
      if (!(name==='node'?graph.nodes:graph.edges).some(entry => entry.id===identifier)) return;
      ui.selected=identifier;ui.selectionType=name;refresh();
      document.getElementById('graph-inspector-heading')?.focus({preventScroll:true});
      document.getElementById('graph-inspector')?.scrollIntoView({block:'nearest',behavior:'auto'});
    }
    else if (name==='return') {const identifier=ui.selected==='topic'?null:ui.selected;const element=identifier?document.querySelector(`[data-action="graph-${ui.selectionType}"][data-id="${CSS.escape(identifier)}"]`):document.getElementById('graph-focus');element?.scrollIntoView({block:'center',behavior:'auto'});element?.focus({preventScroll:true});}
    else if (name==='kind' && ['all','new'].includes(value)) {ui.kind=value;invalidate();refresh('graph-kind-'+value);}
    else if (name==='source' && source().records.some(row => row.id===identifier)) window.ProblemInsights.openRecord(identifier);
    else if (name==='run') run();
    else if (name==='all-cases') {ui.query='current';run();}
    else if (name==='more' && ui.result) {ui.result.limit+=12;refresh('graph-more');}
    else if (name==='clear') {ui=defaults();refresh('graph-search');}
    else if (name==='catalog' || name==='review') window.ProblemInsights.openOntology(scope(),name==='review'?identifier:null);
    else if (name==='versions') window.ProblemInsights.versions();
    else if (name==='followup') {window.ProblemInsights.openOntology(scope());window.ProblemInsights.dispatch('followup',element);}
    else if (name==='orbit') {window.ProjectStudio.dispatch('orbit',{dataset:{}});window.ProjectStudio.dispatch('tab',{dataset:{value:'ontology'}});}
    else if (name==='schema') schema();
    else if (name==='presentation' && ['graph','list'].includes(value)) {ui.presentation=value;refresh('graph-view-'+value);}
  }

  function configure(adapter) {
    host = adapter;
    document.addEventListener('click',event => {const element=event.target.closest('[data-action^="graph-"]');if(element){event.preventDefault();dispatch(element.dataset.action.slice(6),element);}});
    document.addEventListener('input',event => {if(event.target.id==='graph-search'){ui.search=event.target.value.slice(0,120);invalidate();refresh('graph-search');}});
    document.addEventListener('change',event => {
      const identifier = event.target.id;
      const value = event.target.value;
      const allowed = {'graph-day':[...source().dates,'week'],'graph-channel':['all','archive',...window.HubAnalyticsData.channels.map(channel => channel.id)],'graph-domain':['all',...source().domains],'graph-query':['same','current']};
      if (identifier==='graph-evidence-only') ui.evidenceOnly=event.target.checked;
      else if (allowed[identifier]?.includes(value)) ui[identifier.slice(6)]=value;
      else return;
      invalidate();refresh(identifier);
    });
  }

  return {configure,page,open,model,dispatch,reset(){ui=defaults();}};
})();
