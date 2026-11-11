window.ProblemInsights = (() => {
  let host;
  let exportReport;
  const defaults=()=>({day:'2026-11-07',channel:'all',domain:'all',view:'dashboard',topic:null,detailTab:'evidence',record:null,search:'',limit:20,draft:null,definitions:false});
  let ui=defaults();
  const data=()=>window.HubProblemData;
  const escape=value=>host.escape(value);
  const icon=name=>host.icon(name,'small');
  const button=(label,action,attributes='',tone='')=>host.button(label,'insight-'+action,tone,attributes);
  const num=value=>Number(value).toLocaleString('en-US');
  const pct=value=>value===null?'—':value.toFixed(1)+'%';
  const badge=(label,tone='')=>host.badge(label,tone);
  const initial=()=>({drafts:[],decisions:[],followups:[],feedback:[],versions:[{version:'0.2',terms:data().topics.filter(topic=>topic.known).map(topic=>({id:topic.id,name:topic.title,domain:topic.domain,definition:topic.symptom,product:topic.product,version:topic.version,stage:topic.stage,sourceTopicId:topic.id})),reason:'预置演示问题目录',time:'2026-11-07 20:00'}],audit:[]});
  function state(){
    const parent=host.getState();
    if(!parent.insights||!Array.isArray(parent.insights.versions)||!parent.insights.versions.length)parent.insights=initial();
    for(const key of ['drafts','decisions','followups','feedback','audit'])if(!Array.isArray(parent.insights[key]))parent.insights[key]=[];
    return parent.insights;
  }
  const current=()=>state().versions.at(-1);
  const report=()=>data().snapshot(ui);
  const decision=topicId=>state().decisions.find(entry=>entry.topicId===topicId);
  function audit(action,topicId=''){
    state().audit.unshift({action,topicId,time:new Date().toLocaleString('zh-CN',{hour12:false})});
    host.persist();
  }
  function refresh(focusId,top=false){
    const container=document.getElementById('main-content');
    const scroll=top?0:container?.scrollTop||0;
    host.render();
    const fresh=document.getElementById('main-content');
    if(fresh)fresh.scrollTop=scroll;
    if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  }
  const changeText=topic=>topic.previous===0?topic.count?'对比期无样本':'—':`${topic.change>0?'+':''}${topic.change.toFixed(1)}%`;
  function heading(title,note,actions=''){
    return `<div class="pi-section-head"><div><h2>${title}</h2><p>${note}</p></div>${actions}</div>`;
  }
  function navigation(){
    return `<div class="dash-navigation pi-navigation"><nav aria-label="运营视图">${[['problems','问题分析'],['overview','服务概览'],['performance','性能与 SLA'],['quality','质量与改进'],['agents','助手协同']].map(([key,title])=>host.button(title,'analytics-tab',key==='problems'?'selected':'',`id="dash-tab-${key}" data-value="${key}" aria-pressed="${key==='problems'}"`)).join('')}</nav><span>样本截至 2026.11.07 20:00</span></div>`;
  }
  function filterBar(snapshot){
    return `<section class="pi-filters" aria-label="问题分析筛选"><div class="pi-filter-fields"><label for="insight-day">${icon('calendar')}<span class="sr-only">统计日期</span><select id="insight-day">${[...data().dates].reverse().map(day=>`<option value="${day}" ${ui.day===day?'selected':''}>${day.replaceAll('-','.')} · 单日</option>`).join('')}<option value="week" ${ui.day==='week'?'selected':''}>11.01—11.07 · 7 天</option></select></label><label for="insight-channel">${icon('filter')}<span class="sr-only">渠道</span><select id="insight-channel">${[{id:'all',name:'全部示例渠道'},...window.HubAnalyticsData.channels,{id:'archive',name:'历史存档（不计入）'}].map(channel=>`<option value="${channel.id}" ${ui.channel===channel.id?'selected':''}>${channel.name}</option>`).join('')}</select></label><label for="insight-domain"><span class="sr-only">业务领域</span><select id="insight-domain">${['all',...data().domains].map(domain=>`<option value="${domain}" ${ui.domain===domain?'selected':''}>${domain==='all'?'全部业务领域':domain}</option>`).join('')}</select></label></div><div class="pi-snapshot-label">${ui.day!=='2026-11-07'||ui.channel!=='all'||ui.domain!=='all'?button('重置筛选','clear','','quiet'):''}${badge('固定模拟样本')}<span>对比 ${snapshot.comparisonLabel}</span></div></section>`;
  }
  function metrics(snapshot){
    const metrics=[['有效服务问题',snapshot.count,'按问题实例去重，不按消息计数'],['Top 5 问题覆盖',snapshot.topCount,`${pct(snapshot.count?snapshot.topCount/snapshot.count*100:null)} · 分母 ${snapshot.count} 件`],['未确认解决',snapshot.pending,'包括明确未解决与结果待确认'],['新问题候选',snapshot.newCount,`${snapshot.newClusters.length} 个候选分类 · 不等于新根因`]];
    return `<section class="pi-metrics" aria-label="当前范围问题指标">${metrics.map(([title,value,note])=>`<div><span>${title}</span><strong>${num(value)}<small>件</small></strong><p>${note}</p></div>`).join('')}</section>`;
  }
  function topChart(snapshot){
    const ceiling=Math.max(10,Math.ceil(Math.max(...snapshot.top.map(topic=>topic.count),0)/10)*10);
    return `<section class="pi-panel pi-top-panel">${heading('高频问题 Top 5','具体症状 / 业务环节 · 按去重问题量排序',button('全部问题 '+icon('arrow-up-right'),'all'))}<div class="pi-rank-head"><span>问题与场景</span><span>问题量 / 占比</span><span>较对比期</span></div><div class="pi-rank-list">${snapshot.top.map((topic,index)=>`<button class="pi-rank-row" id="insight-topic-${topic.id}" data-action="insight-topic" data-id="${topic.id}" aria-label="查看${escape(topic.title)}，${topic.count}件，占${pct(topic.share)}"><span class="pi-rank-number">${String(index+1).padStart(2,'0')}</span><span class="pi-rank-content"><span class="pi-rank-title">${escape(topic.title)} ${!topic.known?'<em>新</em>':''}</span><span class="pi-rank-track"><i class="pi-color-${topic.color}" style="width:${topic.count/ceiling*100}%"></i></span><span class="pi-rank-context">${escape(topic.domain)}<span>·</span>${topic.stores} 家门店<span>·</span>${topic.pending} 件未确认解决</span></span><span class="pi-rank-total"><strong>${topic.count}</strong><small>${pct(topic.share)}</small></span><span class="pi-rank-delta ${topic.change>0?'is-up':''}">${changeText(topic)}${icon('chevron-right')}</span></button>`).join('')}</div><div class="pi-rank-axis"><span>件</span><div>${Array.from({length:6},(_,index)=>`<span>${ceiling/5*index}</span>`).join('')}</div><span></span><span></span></div><p class="pi-footnote">${icon('pointer')}点击具体问题，查看原始会话、关联案例和待验证原因。</p></section>`;
  }
  function distribution(snapshot){
    const entries=[...snapshot.top.map(topic=>({...topic,label:topic.short})),{id:'other',label:'其他问题',count:snapshot.otherCount,color:'stone'}];
    let used=0;
    const segments=entries.map(entry=>{const start=used;used+=entry.count/snapshot.count*100;return `var(--pi-${entry.color}) ${start}% ${used}%`;}).join(',');
    return `<section class="pi-panel pi-distribution">${heading('问题占比','Top 5 + 其他 · 分母为全部有效问题')}<div class="pi-donut" role="img" aria-label="${entries.map(entry=>`${entry.label}${entry.count}件`).join('，')}" style="--pi-segments:conic-gradient(${segments})"><div><span>有效问题</span><strong>${snapshot.count}</strong><small>${snapshot.dateLabel}</small></div></div><div class="pi-donut-legend">${entries.map(entry=>`<button data-action="insight-${entry.id==='other'?'all':'topic'}" data-id="${entry.id}" aria-label="${escape(entry.label)} ${entry.count}件"><i class="pi-color-${entry.color}"></i><span>${escape(entry.label)}</span><strong>${entry.count}</strong><small>${pct(entry.count/snapshot.count*100)}</small></button>`).join('')}</div><p class="pi-footnote">一个问题只归一个主类，不重复叠加。</p></section>`;
  }
  function dailyChart(snapshot){
    const week=data().snapshot({...ui,day:'week'});
    const rows=data().dates.map(day=>({day,rows:week.rows.filter(row=>row.date===day)}));
    const ceiling=Math.max(40,Math.ceil(Math.max(...rows.map(entry=>entry.rows.length))/40)*40);
    return `<section class="pi-panel pi-daily-panel">${heading('每天的问题量','固定 7 天视窗 · 沿用当前渠道和领域筛选')}<div class="pi-chart-legend"><span><i class="pi-color-forest"></i>已知问题</span><span><i class="pi-color-clay"></i>新问题候选</span><span>单位：件</span></div><div class="pi-daily-chart"><div class="pi-y-axis">${[4,3,2,1,0].map(step=>`<span>${ceiling/4*step}</span>`).join('')}</div><div class="pi-columns">${rows.map(entry=>{const total=entry.rows.length;const novel=entry.rows.filter(row=>!row.known).length;return `<button data-action="insight-day" data-value="${entry.day}" id="insight-column-${entry.day}" class="pi-column ${ui.day===entry.day?'selected':''}" aria-pressed="${ui.day===entry.day}" aria-label="${entry.day}，有效问题${total}件，新问题候选${novel}件"><span class="pi-column-value">${total}</span><span class="pi-column-plot"><span class="pi-column-bar" style="height:${total/ceiling*100}%"><i class="pi-color-clay" style="height:${total?novel/total*100:0}%"></i><i class="pi-color-forest" style="height:${total?(total-novel)/total*100:0}%"></i></span></span><span class="pi-column-date">${entry.day.slice(5).replace('-','/')}</span></button>`;}).join('')}</div></div><p class="pi-footnote">点击柱子切换统计日；新问题候选未被直接认定为根因。</p></section>`;
  }
  function candidates(snapshot){
    return `<section class="pi-panel pi-candidates">${heading('待确认的新问题','未能匹配已知问题定义，等待业务确认',button('问题分类与审核 '+icon('arrow-up-right'),'ontology'))}<div>${snapshot.newClusters.map(topic=>{const status=decision(topic.id);return `<article class="pi-candidate"><div><span class="pi-novel-mark">候选</span><span>${topic.count} 件 / ${topic.stores} 家门店</span>${badge(status?.status||'待确认',status?'':'amber')}</div><button data-action="insight-topic" data-id="${topic.id}">${escape(topic.title)} ${icon('arrow-up-right')}</button><p>${topic.id==='stripes'?'样本较少，先补视频与环境信息。':'与已知“通话无声”症状不同，建议检查是否需要单列。'}</p><div class="pi-candidate-actions">${button(status?'查看处理记录':'审核候选','review',`data-id="${topic.id}"`)}${button('查看案例','topic',`data-id="${topic.id}"`,'quiet')}</div></article>`;}).join('')||'<div class="pi-empty"><h3>当前范围没有新问题候选</h3><p>可切换 11 月 6—7 日查看候选审核示例。</p></div>'}</div><p class="pi-footnote">合并、拒绝和发布都保留记录，不自动修改正式本体。</p></section>`;
  }
  function definitions(){
    return `<section class="pi-definitions"><h2>统计口径与判断依据</h2><dl><div><dt>计数单位</dt><dd>问题实例 = 同一客户 / 服务对象在一次服务周期内的一个诉求。多条追问不重复计数；本例每个 SAMPLE ID 代表一个实例。跨渠道身份未确认时不自动合并。</dd></div><div><dt>Top 5 与占比</dt><dd>按主要问题量排序，同量按问题 ID 排序。占比 = 该问题实例数 / 当前范围全部有效问题数；“其他”保留剩余类别，候选不从分母删除。</dd></div><div><dt>已知问题不等于已知根因</dt><dd>分类目录记录问题名称、范围和纳入边界；原因假设另行核验。关系与聚类只是线索；要有复现、日志或人工核验才能确认原因。</dd></div><div><dt>新问题发现</dt><dd>真实方案需对无法匹配或低置信样本做语义聚类、实体约束与异常检测。本演示使用预置候选，未运行 GraphRAG 或自动发现。</dd></div><div><dt>分类目录更新</dt><dd>审核定义和边界 → 规则检查 → 明确确认 → 发布演示版本。历史样本绑定 v0.2，不因目录更新而重算；重算应另存快照。</dd></div><div><dt>比较与边界</dt><dd>单日对比前一天；7 天对比前一周。零基线不显示增幅。模拟样本截至 2026-11-07，不能当作 2026-11-08 的实时业绩。</dd></div></dl></section>`;
  }
  function dashboard(snapshot){
    if(!snapshot.count)return `<div class="pi-empty pi-empty-page">${icon('archive')}<h2>这个范围没有可统计的问题</h2><p>历史存档不计入服务样本。请调整日期、渠道或业务领域后查看。</p>${button('恢复样本范围','clear','','primary')}</div>`;
    return `${metrics(snapshot)}<div class="pi-main-grid">${topChart(snapshot)}${distribution(snapshot)}</div><div class="pi-bottom-grid">${dailyChart(snapshot)}${candidates(snapshot)}</div>`;
  }
  function allTopics(snapshot){
    return `<section class="pi-panel">${heading('全部具体问题',`${snapshot.groups.length} 类 · ${snapshot.count} 个有效问题`,button('返回图表','back'))}<div class="pi-table-scroll"><table><thead><tr><th>问题</th><th>领域</th><th>问题量</th><th>占比</th><th>未确认解决</th><th>识别状态</th></tr></thead><tbody>${snapshot.groups.map(topic=>`<tr><th scope="row"><button class="text-button" data-action="insight-topic" data-id="${topic.id}">${escape(topic.title)}</button></th><td>${topic.domain}</td><td>${topic.count}</td><td>${pct(topic.share)}</td><td>${topic.pending}</td><td>${badge(topic.known?'已知问题':'新问题候选',topic.known?'':'amber')}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function caseTable(detail){
    const needle=ui.search.trim().toLowerCase();
    const rows=detail.rows.filter(row=>[row.id,row.store,row.customerText].some(text=>text.toLowerCase().includes(needle)));
    return `<section class="pi-panel pi-case-panel">${heading('关联会话',`当前范围 ${detail.count} 件 · 同一问题实例中的追问已去重`)}<div class="pi-search"><label for="insight-search">${icon('search')}<span class="sr-only">搜索问题实例或门店</span><input id="insight-search" value="${escape(ui.search)}" placeholder="搜索问题 ID、门店或会话内容" maxlength="120"></label><span>匹配 ${rows.length} 件</span></div><div class="pi-table-scroll"><table><thead><tr><th>问题实例 / 门店</th><th>客户描述</th><th>渠道</th><th>解决情况</th><th>证据</th><th>查看</th></tr></thead><tbody>${rows.slice(0,ui.limit).map(row=>`<tr><th scope="row"><strong>${row.id}</strong><small>${row.store}</small></th><td class="pi-message-cell">${escape(row.customerText)}</td><td>${host.channelMark(row.channel)}</td><td>${badge(row.result)}</td><td>${row.primaryEvidence?'有关联线索':'信息不足'}</td><td>${button('原始记录','record',`data-id="${row.id}"`,'quiet')}</td></tr>`).join('')||'<tr><td colspan="6">没有匹配记录，请调整搜索内容。</td></tr>'}</tbody></table></div><div class="pi-table-footer"><span>已展示 ${Math.min(rows.length,ui.limit)} / ${rows.length} 件</span>${rows.length>ui.limit?button('再显示 20 件','more'):''}</div></section>`;
  }
  function evidence(detail){
    const first=detail.rows.find(row=>row.primaryEvidence)||detail.rows[0];
    const related=data().records.filter(row=>row.topicId===detail.id&&!detail.rows.some(member=>member.id===row.id)&&row.date<(ui.day==='week'?'2026-11-01':ui.day)).slice(-3);
    return `<div class="pi-evidence-grid"><section class="pi-panel pi-hypothesis">${heading('可能原因与核验线索','当前为待验证假设，不作为自动换机或承诺的依据',badge('待验证','amber'))}<h3>${escape(detail.hypothesis)}</h3><dl class="pi-evidence-points"><div><dt>支持线索</dt><dd>${escape(detail.evidence)} <button class="text-button" data-action="insight-record" data-id="${first.id}">查看来源 ${icon('arrow-up-right')}</button></dd></div><div><dt>反例与缺口</dt><dd>${escape(detail.counter)}</dd></div><div><dt>下一步核验</dt><dd>${escape(detail.action)}</dd></div></dl><div class="pi-evidence-footer"><span>${detail.evidenceCount} / ${detail.count} 件有预置关联线索</span>${button(state().followups.some(item=>item.topicId===detail.id)?'查看跟进任务':'建立跟进任务','followup',`data-id="${detail.id}"`,'primary')}</div></section><section class="pi-panel pi-scope">${heading('问题定位','实例记录的业务范围')}<dl>${[['产品',detail.product],['版本',detail.version],['业务环节',detail.stage],['问题现象',detail.short],['业务领域',detail.domain],['维护团队',detail.owner],['历史分类','v0.2 · 历史快照']].map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section></div><section class="pi-panel pi-related">${heading('关联案例与知识依据','演示结构化关联检索结果 · 未运行真实 GraphRAG')}<div class="pi-retrieval-note">检索约束：${escape(detail.product)} / ${escape(detail.version)} / ${escape(detail.stage)}。相似症状不自动合并为相同根因。</div><div class="pi-relation-row"><span class="pi-relation-type">知识</span><div><strong>${detail.knowledge}</strong><p>${escape(detail.relation)} · 适用条件仍需核对</p></div><span>预置知识索引</span></div>${related.map(row=>`<button class="pi-relation-row" data-action="insight-record" data-id="${row.id}"><span class="pi-relation-type">案例</span><span><strong>${row.id} · ${row.store}</strong><small>${row.date} · ${escape(row.customerText)}</small></span><span>${row.result}</span>${icon('chevron-right')}</button>`).join('')||'<p class="pi-retrieval-note">当前范围未找到更早的同类案例。</p>'}<p class="pi-footnote">历史关联案例仅作参考，不计入当前筛选的问题数量；每条记录可回查来源。</p></section>`;
  }
  function detailPage(snapshot){
    const detail=snapshot.groups.find(topic=>topic.id===ui.topic);
    if(!detail)return `<div class="pi-empty"><h2>当前筛选下没有这个问题</h2>${button('返回问题列表','back')}</div>`;
    return `<div class="pi-detail-header">${button(icon('arrow-left')+' 返回问题分析','back','','quiet')}<div><span>${badge(detail.known?'已知问题':'新问题候选',detail.known?'':'amber')}<span>${escape(detail.domain)} / ${escape(detail.product)}</span></span><h2>${escape(detail.title)}</h2><p>${detail.count} 件 · 占当前范围 ${pct(detail.share)} · ${detail.stores} 家门店 · ${detail.pending} 件未确认解决</p></div>${button('在图谱中查看','graph',`data-id="${detail.id}"`)}${!detail.known?button('审核新问题','review',`data-id="${detail.id}"`,'primary'):''}</div><nav class="pi-detail-tabs" aria-label="问题详情">${[['evidence','原因与证据'],['cases','关联会话'],['trace','处理记录']].map(([key,title])=>button(title,'detail-tab',`id="insight-detail-${key}" data-value="${key}" aria-pressed="${ui.detailTab===key}"`,ui.detailTab===key?'selected':'')).join('')}</nav>${ui.detailTab==='cases'?caseTable(detail):ui.detailTab==='trace'?processing(detail):evidence(detail)}`;
  }
  function processing(detail){
    const events=[['归一与去重',`${detail.count} 个问题实例；各实例的来源消息可回查。`],['已知范围匹配',`${detail.product} / ${detail.version} / ${detail.domain}；${detail.known?'匹配预置问题定义':'未命中预置定义，保留为候选'}。`],['关联检索示例',`按${detail.relation}关联案例与知识；未执行真实向量检索或 GraphRAG。`],['问题量统计',`以问题 ID 去重后聚合，${detail.count} / ${report().count} 件，不由语言模型估算。`],['原因核验',`${detail.hypothesis}；当前待验证。`]];
    return `<section class="pi-panel">${heading('处理步骤与数据版本','展示处理摘要与输入输出，不展示模型隐式思维链',badge('离线演示'))}<ol class="pi-processing">${events.map(([title,description],index)=>`<li><span>${String(index+1).padStart(2,'0')}</span><div><h3>${title}</h3><p>${escape(description)}</p><small>报告 ${escape(report().snapshotId)} · 历史分类 v0.2</small></div>${badge(index===4?'待人工核验':'预置记录',index===4?'amber':'')}</li>`).join('')}</ol></section>`;
  }
  function openRecord(identifier){
    const row=data().records.find(entry=>entry.id===identifier);
    if(!row)return host.toast('该记录不在当前演示样本中。',true);
    const topic=data().topics.find(entry=>entry.id===row.topicId);
    ui.record=identifier;
    const marked=state().feedback.some(entry=>entry.recordId===identifier);
    host.showDialog('原始会话与证据',`${row.id} · ${row.store} · ${row.date} ${row.hour} · 固定模拟样本`,`<div class="pi-record-meta">${badge(topic.title)}${host.channelMark(row.channel)}</div><div class="pi-record-messages"><article><span>客户 · 消息 ${row.messageId}</span><p>${escape(row.customerText)}</p></article><article><span>售后接待助手 · 示例回复</span><p>${escape(row.reply)}</p></article></div><dl class="pi-record-evidence"><div><dt>结果</dt><dd>${row.result}</dd></div><div><dt>关联线索</dt><dd>${row.primaryEvidence?escape(topic.evidence):'该记录暂缺日志或其他佐证，不能确认原因。'}</dd></div><div><dt>证据 ID</dt><dd>${row.evidenceId} · 预置示例，非真实日志附件</dd></div><div><dt>执行记录</dt><dd>${row.traceId} · 预置处理摘要</dd></div><div><dt>计数</dt><dd>${row.duplicateMessages} 条客户消息归为 1 个问题实例；上方仅展示代表片段</dd></div></dl><p class="pi-warning">示例已用编号门店代替真实身份；没有真实客户资料或接口返回。</p>`,button(marked?'已登记待复核':'登记待复核案例','feedback',`data-id="${identifier}" ${marked?'disabled':''}`,'primary')+host.button('关闭','close-dialog','quiet'),'');
  }
  function review(topicId){
    const topic=data().topics.find(entry=>entry.id===topicId&&!entry.known);
    if(!topic)return;
    const existing=decision(topicId);
    if(existing){ui.view='ontology';refresh('insight-ontology-heading',true);return;}
    const members=report().groups.find(entry=>entry.id===topicId);
    if(!members)return host.toast('当前范围没有该候选，不能基于空样本审核。',true);
    ui.draft=topicId;
    const body=`<div class="pi-review-context"><strong>${members.count} 件 · ${members.stores} 家门店 · 当前筛选</strong><p>限定范围：${escape(topic.product)} / ${escape(topic.version)} / ${escape(topic.stage)}</p><p>${escape(topic.evidence)}</p><p>相似案例不代表同一根因。可保留新定义、合并到已知问题，或暂不采纳。</p></div><div class="pi-review-form"><label for="insight-decision">处理方式<select id="insight-decision"><option value="new">保留为新问题定义</option><option value="merge">合并到已有问题</option><option value="reject">暂不采纳 / 需要更多证据</option></select></label><label for="insight-name">问题名称<input id="insight-name" maxlength="70" value="${escape(topic.title)}"></label><label for="insight-definition">定义与纳入条件<textarea id="insight-definition" maxlength="600">${escape(topic.symptom)} 仅纳入已确认型号、版本和触发步骤的实例。</textarea></label><label for="insight-boundary">排除条件<textarea id="insight-boundary" maxlength="400">排除已知的${topicId==='reset'?'持续通话无声':'持续影像黑屏'}；信息不完整的案例继续保持待确认。</textarea></label><label for="insight-merge-target">合并目标（仅合并时使用）<select id="insight-merge-target">${current().terms.map(term=>`<option value="${escape(term.id)}">${escape(term.name)}</option>`).join('')}</select></label><label for="insight-review-note">审核依据 / 暂不采纳的原因<textarea id="insight-review-note" maxlength="600" placeholder="请记录你核对了什么，以及仍有哪些不确定之处。"></textarea></label><label class="pi-consent"><input id="insight-human-review" type="checkbox">我已核对当前范围的来源案例与定义边界；这不代表根因已确认。</label></div>`;
    host.showDialog('审核新问题候选','先确认业务定义，再决定是否进入分类草案。',body,button('保存审核草案','save-review','','primary')+host.button('取消','close-dialog','quiet'));
  }
  function saveReview(){
    const topic=data().topics.find(entry=>entry.id===ui.draft&&!entry.known);
    if(!topic||decision(topic.id))return host.toast('候选状态已变化，请重新打开。',true);
    const value=identifier=>document.getElementById(identifier)?.value.trim()||'';
    const kind=value('insight-decision');
    const name=value('insight-name');
    const definition=value('insight-definition');
    const boundary=value('insight-boundary');
    const note=value('insight-review-note');
    const target=value('insight-merge-target');
    const members=report().groups.find(entry=>entry.id===topic.id);
    if(!members?.count)return host.toast('没有来源样本，不能保存审核结果。',true);
    if(!['new','merge','reject'].includes(kind)||name.length<5||name.length>70||definition.length<12||definition.length>600||boundary.length<8||boundary.length>400||note.length<8||note.length>600||!document.getElementById('insight-human-review')?.checked)return host.toast('请补齐定义、排除条件和至少 8 字审核依据，并确认已核对样本。',true);
    if(/(?:sk-[\w-]{12,}|-----BEGIN .*PRIVATE KEY|(?:密码|token|api.?key)\s*[:：=]\s*\S{6,}|(?<!\d)1[3-9]\d{9}(?!\d))/i.test([name,definition,boundary,note].join(' ')))return host.toast('内容疑似包含凭证或联系方式，请先脱敏。',true);
    if(kind==='merge'&&!current().terms.some(term=>term.id===target))return host.toast('合并目标已失效，请重新选择。',true);
    const duplicate=current().terms.some(term=>term.name===name)||state().drafts.some(entry=>entry.name===name&&entry.status!=='已拒绝');
    if(kind==='new'&&duplicate)return host.toast('已有同名定义，请合并或修改边界，不重复创建。',true);
    const id=`DRAFT-${String(state().drafts.length+1).padStart(3,'0')}`;
    state().drafts.push({id,topicId:topic.id,name,definition,boundary,note,kind,target,domain:topic.domain,product:topic.product,version:topic.version,stage:topic.stage,sourceIds:members.rows.map(row=>row.id),baseVersion:current().version,status:kind==='reject'?'暂不采纳':'待检查',checks:null,reportId:report().snapshotId});
    state().decisions.push({topicId:topic.id,draftId:id,status:kind==='reject'?'暂不采纳':'草案待检查'});
    audit('保存候选审核：'+name,topic.id);
    host.closeDialog();ui.view='ontology';refresh('insight-ontology-heading',true);
    host.toast(kind==='reject'?'已保留暂不采纳的依据，没有修改分类目录。':'已保存草案。通过规则检查后，还需要单独确认发布。');
  }
  function runChecks(identifier){
    const draft=state().drafts.find(entry=>entry.id===identifier);
    if(!draft||!['待检查','检查通过','检查未通过'].includes(draft.status))return;
    const positive=draft.sourceIds.map(id=>data().records.find(row=>row.id===id)).filter(Boolean);
    const negative=data().records.filter(row=>row.topicId!==draft.topicId&&row.category===draft.domain).slice(0,10);
    const checks=[{name:'定义、领域和排除条件完整',passed:!!draft.name&&data().domains.includes(draft.domain)&&!!draft.product&&!!draft.version&&!!draft.stage&&draft.boundary.length>=8},{name:'来源 ID 存在且属于同一候选',passed:positive.length===draft.sourceIds.length&&positive.length>0&&positive.every(row=>row.topicId===draft.topicId)},{name:'有同领域的排除样例',passed:negative.length>0},{name:'基线版本未变化且无命名冲突',passed:draft.baseVersion===current().version&&(draft.kind!=='new'||!current().terms.some(term=>term.name===draft.name))}];
    draft.checks={checks,positive:positive.length,negative:negative.length,baseVersion:current().version,time:new Date().toISOString()};
    draft.status=checks.every(check=>check.passed)?'检查通过':'检查未通过';
    decision(draft.topicId).status=draft.status;
    audit('草案规则检查：'+draft.status,draft.topicId);refresh();
    host.toast('完成本地规则检查；未调用模型，不代表语义聚类或回答正确率通过。');
  }
  function requestPublish(identifier){
    const draft=state().drafts.find(entry=>entry.id===identifier);
    if(!draft||draft.status!=='检查通过'||!draft.checks?.checks.every(check=>check.passed))return host.toast('请先完成草案检查。',true);
    if(draft.baseVersion!==current().version)return host.toast('分类基线已变化，请更新基线并重新检查。',true);
    host.showDialog('发布演示问题目录版本','仅修改本地演示目录，不发布生产知识，不重算历史报表。',`<div class="pi-review-context"><h3>${escape(draft.name)}</h3><p>${escape(draft.definition)}</p><p>排除：${escape(draft.boundary)}</p><p>${draft.checks.positive} 个来源样本 / ${draft.checks.negative} 个同领域排除样本。规则检查不等于真实语义回归。</p></div><label class="pi-consent"><input id="insight-publish-consent" type="checkbox">我确认业务定义与权限边界，批准发布到本地演示问题目录。</label>`,button('确认发布演示版本','publish',`data-id="${draft.id}"`,'primary')+host.button('取消','close-dialog','quiet'));
  }
  function publish(identifier){
    const draft=state().drafts.find(entry=>entry.id===identifier);
    if(!draft||draft.status!=='检查通过'||draft.baseVersion!==current().version||!draft.checks?.checks.every(check=>check.passed)||!document.getElementById('insight-publish-consent')?.checked)return host.toast('请确认发布；如基线已变化，需要重新检查。',true);
    const terms=structuredClone(current().terms);
    if(draft.kind==='new')terms.push({id:draft.topicId,name:draft.name,definition:draft.definition,boundary:draft.boundary,domain:draft.domain,product:draft.product,version:draft.version,stage:draft.stage,sourceTopicId:draft.topicId});
    else if(draft.kind==='merge'){
      const target=terms.find(term=>term.id===draft.target);
      if(!target)return host.toast('合并目标不存在，已阻止发布。',true);
      target.aliases=[...(target.aliases||[]),{id:draft.topicId,name:draft.name,definition:draft.definition,boundary:draft.boundary,product:draft.product,version:draft.version,stage:draft.stage}];
    }else return;
    const version='0.'+(state().versions.length+2);
    state().versions.push({version,terms,reason:escape(draft.kind==='new'?'新增问题定义':'合并问题别名'),draftId:draft.id,time:new Date().toLocaleString('zh-CN',{hour12:false})});
    draft.status='已发布演示版';decision(draft.topicId).status='已发布演示版';
    audit('发布演示问题目录 v'+version,draft.topicId);
    host.closeDialog();refresh();host.toast('已发布演示问题目录 v'+version+'。历史报表仍使用 v0.2，没有自动重算。');
  }
  function ontology(){
    return `<div class="pi-ontology-header">${button(icon('arrow-left')+' 返回问题分析','back','','quiet')}<h2 id="insight-ontology-heading" tabindex="-1">问题分类与审核</h2><p>管理问题定义、候选审核和历史分类版本。这是独立的问题分类目录，不是 Orbit 共享业务本体；审核发布不会修改助手规则。</p></div><div class="pi-ontology-meta"><span>当前演示目录 <b>v${escape(current().version)}</b> · ${current().terms.length} 个问题定义</span><span>统计快照 <b>v0.2</b> · 不自动追溯重算</span>${button('查看版本记录','versions','','quiet')}</div><section class="pi-panel">${heading('候选审核与分类草案','审核草案通过规则检查后，由人工确认发布。原因假设仍需单独验证。')}<div class="pi-drafts">${state().drafts.map(draft=>`<article class="pi-draft"><div class="pi-draft-title"><span><b>${escape(draft.name)}</b><small>${draft.id} · ${draft.kind==='new'?'新增定义':draft.kind==='merge'?'合并别名':'暂不采纳'} · 基线 v${escape(draft.baseVersion)}</small></span>${badge(draft.status,draft.status==='检查通过'?'green':'amber')}</div><p>${escape(draft.definition)}</p><p><b>排除：</b>${escape(draft.boundary)}</p><p><b>审核依据：</b>${escape(draft.note)}</p>${draft.checks?`<ul class="pi-check-results">${draft.checks.checks.map(check=>`<li>${icon(check.passed?'circle-check':'alert-triangle')}${escape(check.name)} · ${check.passed?'通过':'未通过'}</li>`).join('')}</ul><p class="pi-rule-caveat">检查 ${draft.checks.positive} 个来源 / ${draft.checks.negative} 个排除样例。仅校验记录与规则，不代表模型语义回归通过。</p>`:''}<div class="pi-draft-actions">${['待检查','检查通过','检查未通过'].includes(draft.status)?button('运行规则检查','check',`data-id="${draft.id}"`):''}${draft.baseVersion!==current().version&&['待检查','检查通过','检查未通过'].includes(draft.status)?button('更新基线并清除旧检查','rebase',`data-id="${draft.id}"`,'quiet'):''}${draft.status==='检查通过'?button('审核发布','publish-review',`data-id="${draft.id}"`,'primary'):''}</div></article>`).join('')||'<div class="pi-empty"><h3>还没有审核草案</h3><p>从“待确认的新问题”打开候选，核对案例并保存审核意见。</p></div>'}</div></section><section class="pi-panel">${heading('已知问题目录','记录问题名称、领域、适用范围及纳入 / 排除条件')}<div class="pi-table-scroll"><table><thead><tr><th>问题定义</th><th>领域</th><th>产品 / 版本 / 环节</th><th>定义与边界</th></tr></thead><tbody>${current().terms.map(term=>`<tr><th scope="row">${escape(term.name)}<small>${escape(term.id)}${term.aliases?.length?' · '+term.aliases.length+' 个审核别名':''}</small></th><td>${escape(term.domain)}</td><td>${escape(term.product||'待补充')}<small>${escape(term.version||'待补充')} · ${escape(term.stage||'待补充')}</small></td><td class="pi-message-cell">${escape(term.definition)}${term.boundary?'<small>排除：'+escape(term.boundary)+'</small>':''}</td></tr>`).join('')}</tbody></table></div></section>${localWork()}`;
  }
  function localWork(){
    return `<section class="pi-panel">${heading('本地跟进与待复核案例','此处记录操作结果，不混入历史样本的经营指标')}<div class="pi-local-work">${state().followups.map(task=>`<article><span>${badge(task.status,'amber')}</span><div><strong>${escape(task.title)}</strong><p>${escape(task.owner)} · ${escape(task.action)}</p><small>${escape(task.id)} · ${escape(task.reportId)}</small></div></article>`).join('')}${state().feedback.map(item=>`<article><span>${badge('待人工复核','amber')}</span><div><strong>${escape(item.title)}</strong><p>来源 ${escape(item.recordId)}。尚未确认错误归因和人工预期，不自动纳入回归金标。</p></div>${button('查看来源','record',`data-id="${item.recordId}"`,'quiet')}</article>`).join('')}${!state().followups.length&&!state().feedback.length?'<p>尚未登记跟进任务或待复核案例。</p>':''}</div></section>`;
  }
  function followup(topicId){
    const topic=report().groups.find(entry=>entry.id===topicId);
    if(!topic)return;
    if(!state().followups.some(entry=>entry.topicId===topicId)){
      state().followups.push({id:'INV-'+String(state().followups.length+1).padStart(3,'0'),topicId,title:topic.title,owner:topic.owner,action:topic.action,status:'待分派 · 本地草稿',reportId:report().snapshotId,sourceIds:topic.rows.map(row=>row.id)});
      audit('登记问题核验任务',topicId);
    }
    ui.view='ontology';refresh('insight-ontology-heading',true);host.toast('已保留本地跟进草稿，没有通知外部人员或创建真实工单。');
  }
  function versions(){
    host.showDialog('分类版本记录','每次发布生成新记录；历史统计和旧版本不被覆盖。',`<div class="pi-version-list">${state().versions.map(version=>`<article><strong>v${escape(version.version)} ${version===current()?badge('当前演示版本','green'):''}</strong><p>${escape(version.reason)} · ${version.terms.length} 个问题定义</p><small>${escape(version.time)}</small><details><summary>查看该版本定义</summary><ul>${version.terms.map(term=>`<li>${escape(term.name)}${term.aliases?.length?' · 别名：'+term.aliases.map(alias=>escape(alias.name)).join('、'):''}</li>`).join('')}</ul></details></article>`).join('')}</div>`,host.button('关闭','close-dialog','quiet'));
  }
  function openExport(){
    exportReport=report();
    if(!exportReport.count)return host.toast('当前范围没有可导出的有效问题。',true);
    host.showDialog('导出问题统计','仅导出当前筛选的聚合问题统计，不含聊天、密钥或本地审核意见。',`<div class="pi-review-context"><p>${exportReport.dateLabel} · ${exportReport.channelLabel} · ${exportReport.count} 个问题</p><p>包含全部问题分类、数量、占比、未确认解决数、门店数及分类版本。</p></div><label class="pi-consent"><input id="insight-export-consent" type="checkbox">确认此报表是模拟数据，不作为真实经营报告。</label>`,button('下载 CSV','export-confirm','','primary')+host.button('取消','close-dialog','quiet'),'compact');
  }
  function page(){
    const snapshot=report();
    return `<div class="dash-page pi-page"><header class="dash-header pi-header"><div><div class="dash-eyebrow">问题统计</div><h1>运营大盘</h1><p>查看高频问题、变化趋势和待跟进事项。</p></div><div class="dash-header-actions">${button(icon('info-circle')+' 统计口径','definitions',`id="insight-definitions" aria-expanded="${ui.definitions}"`,'quiet')}${button('业务实例图谱','graph','','quiet')}${button('问题分类与审核','ontology','','quiet')}${button(icon('download')+' 导出问题统计','export')}</div></header>${navigation()}${filterBar(snapshot)}${ui.definitions?definitions():''}${ui.view==='ontology'?ontology():ui.view==='all'?allTopics(snapshot):ui.view==='detail'?detailPage(snapshot):dashboard(snapshot)}<footer class="pi-footer"><span>${icon('shield-lock')}固定脱敏示例 · 历史分类 v0.2 · 当前演示目录 v${escape(current().version)}</span><span>图表与审核可交互；自动聚类、GraphRAG、生产发布尚未接通。</span></footer></div>`;
  }
  function dispatch(action,element){
    const identifier=element.dataset.id;
    const value=element.dataset.value;
    if(action==='topic'&&data().topics.some(topic=>topic.id===identifier)){ui.topic=identifier;ui.view='detail';ui.detailTab='evidence';ui.search='';ui.limit=20;refresh(null,true);}
    else if(action==='back'){ui.view='dashboard';refresh(ui.topic?'insight-topic-'+ui.topic:null,true);}
    else if(action==='all'){ui.view='all';refresh(null,true);}
    else if(action==='ontology'){ui.view='ontology';refresh('insight-ontology-heading',true);}
    else if(action==='definitions'){ui.definitions=!ui.definitions;refresh('insight-definitions');}
    else if(action==='clear'){ui=defaults();refresh(null,true);}
    else if(action==='day')change('insight-day',value);
    else if(action==='detail-tab'&&['evidence','cases','trace'].includes(value)){ui.detailTab=value;refresh('insight-detail-'+value);}
    else if(action==='graph')window.BusinessGraph.open(identifier,{day:ui.day,channel:ui.channel,domain:ui.domain});
    else if(action==='record')openRecord(identifier);
    else if(action==='review')review(identifier);
    else if(action==='save-review')saveReview();
    else if(action==='check')runChecks(identifier);
    else if(action==='publish-review')requestPublish(identifier);
    else if(action==='publish')publish(identifier);
    else if(action==='rebase'){
      const draft=state().drafts.find(entry=>entry.id===identifier);
      if(draft&&['待检查','检查通过','检查未通过'].includes(draft.status)){draft.baseVersion=current().version;draft.checks=null;draft.status='待检查';decision(draft.topicId).status='草案待检查';audit('更新草案基线并作废旧检查',draft.topicId);refresh();}
    }
    else if(action==='versions')versions();
    else if(action==='followup')followup(identifier);
    else if(action==='more'){ui.limit+=20;refresh();}
    else if(action==='feedback'){
      const row=data().records.find(entry=>entry.id===identifier);
      if(row&&!state().feedback.some(entry=>entry.recordId===identifier)){state().feedback.push({recordId:identifier,topicId:row.topicId,title:data().topics.find(topic=>topic.id===row.topicId).title,status:'待人工复核'});audit('登记待复核案例',row.topicId);openRecord(identifier);host.toast('已登记待人工复核；不会直接作为正确答案或自动更新知识。');}
    }
    else if(action==='export')openExport();
    else if(action==='export-confirm'){
      if(!exportReport||!document.getElementById('insight-export-consent')?.checked)return host.toast('请先确认报表的数据范围。',true);
      try{const url=URL.createObjectURL(new Blob([data().csv(exportReport)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`连山_模拟问题统计_${exportReport.day}_${exportReport.channel}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);exportReport=null;host.closeDialog();host.toast('已导出当前范围的问题统计。');}catch{host.toast('浏览器下载失败，请重新打开演示后再试。',true);}
    }
  }
  function change(identifier,value){
    if(identifier==='insight-search'){ui.search=value.slice(0,120);ui.limit=20;refresh('insight-search');return;}
    if(identifier==='insight-day'&&[...data().dates,'week'].includes(value))ui.day=value;
    else if(identifier==='insight-channel'&&['all','archive',...window.HubAnalyticsData.channels.map(entry=>entry.id)].includes(value))ui.channel=value;
    else if(identifier==='insight-domain'&&['all',...data().domains].includes(value))ui.domain=value;
    else return;
    ui.search='';ui.limit=20;refresh(identifier,true);
  }
  return {configure(adapter){host=adapter;state();},page,dispatch,change,openScope(scope){ui={...defaults(),day:scope.period==='week'?'week':'2026-11-07',channel:[...window.HubAnalyticsData.channels.map(item=>item.id),'all'].includes(scope.channel)?scope.channel:'all'};},snapshot:report,openRecord,versions,currentOntology:current,openOntology(scope={},topicId=null){ui={...defaults(),...scope,view:'ontology'};window.AnalyticsHub.dispatch('tab',{dataset:{value:'problems'}});host.navigate('analytics');if(topicId)review(topicId);},reset(){ui=defaults();exportReport=null;},getState:state};
})();
