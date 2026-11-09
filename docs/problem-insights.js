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
  const initial=()=>({drafts:[],decisions:[],followups:[],feedback:[],versions:[{version:'0.2',terms:data().topics.filter(topic=>topic.known).map(topic=>({id:topic.id,name:topic.title,domain:topic.domain,definition:topic.symptom,product:topic.product,version:topic.version,stage:topic.stage,sourceTopicId:topic.id})),reason:'预置演示本体',time:'2026-11-07 20:00'}],audit:[]});
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
    return `<div class="dash-navigation pi-navigation"><nav aria-label="运营视图">${[['problems','问题洞察'],['overview','服务概览'],['performance','性能与 SLA'],['quality','质量与回流'],['agents','助手协同']].map(([key,title])=>host.button(title,'analytics-tab',key==='problems'?'selected':'',`id="dash-tab-${key}" data-value="${key}" aria-pressed="${key==='problems'}"`)).join('')}</nav><span>样本截至 2026.11.07 20:00</span></div>`;
  }
  function filterBar(snapshot){
    return `<section class="pi-filters" aria-label="问题洞察筛选"><div class="pi-filter-fields"><label for="insight-day">${icon('calendar')}<span class="sr-only">统计日期</span><select id="insight-day">${[...data().dates].reverse().map(day=>`<option value="${day}" ${ui.day===day?'selected':''}>${day.replaceAll('-','.')} · 单日</option>`).join('')}<option value="week" ${ui.day==='week'?'selected':''}>11.01—11.07 · 7 天</option></select></label><label for="insight-channel">${icon('filter')}<span class="sr-only">渠道</span><select id="insight-channel">${[{id:'all',name:'全部实时渠道'},...window.HubAnalyticsData.channels,{id:'archive',name:'历史存档（不计入）'}].map(channel=>`<option value="${channel.id}" ${ui.channel===channel.id?'selected':''}>${channel.name}</option>`).join('')}</select></label><label for="insight-domain"><span class="sr-only">业务领域</span><select id="insight-domain">${['all',...data().domains].map(domain=>`<option value="${domain}" ${ui.domain===domain?'selected':''}>${domain==='all'?'全部业务领域':domain}</option>`).join('')}</select></label></div><div class="pi-snapshot-label">${ui.day!=='2026-11-07'||ui.channel!=='all'||ui.domain!=='all'?button('重置筛选','clear','','quiet'):''}${badge('固定模拟样本')}<span>对比 ${snapshot.comparisonLabel}</span></div></section>`;
  }
  function metrics(snapshot){
    const metrics=[['有效服务问题',snapshot.count,'按问题实例去重，不按消息计数'],['Top 5 问题覆盖',snapshot.topCount,`${pct(snapshot.count?snapshot.topCount/snapshot.count*100:null)} · 分母 ${snapshot.count} 件`],['未确认解决',snapshot.pending,'包括明确未解决与结果待确认'],['新问题候选',snapshot.newCount,`${snapshot.newClusters.length} 个候选簇 · 不等于新根因`]];
    return `<section class="pi-metrics" aria-label="当前范围问题指标">${metrics.map(([title,value,note])=>`<div><span>${title}</span><strong>${num(value)}<small>件</small></strong><p>${note}</p></div>`).join('')}</section>`;
  }
  function topChart(snapshot){
    const ceiling=Math.max(10,Math.ceil(Math.max(...snapshot.top.map(topic=>topic.count),0)/10)*10);
    return `<section class="pi-panel pi-top-panel">${heading('客户最关心的 Top 5','具体症状 / 业务环节 · 按去重问题量排序',button('全部问题 '+icon('arrow-up-right'),'all'))}<div class="pi-rank-head"><span>问题与场景</span><span>问题量 / 占比</span><span>较对比期</span></div><div class="pi-rank-list">${snapshot.top.map((topic,index)=>`<button class="pi-rank-row" id="insight-topic-${topic.id}" data-action="insight-topic" data-id="${topic.id}" aria-label="查看${escape(topic.title)}，${topic.count}件，占${pct(topic.share)}"><span class="pi-rank-number">${String(index+1).padStart(2,'0')}</span><span class="pi-rank-content"><span class="pi-rank-title">${escape(topic.title)} ${!topic.known?'<em>新</em>':''}</span><span class="pi-rank-track"><i class="pi-color-${topic.color}" style="width:${topic.count/ceiling*100}%"></i></span><span class="pi-rank-context">${escape(topic.domain)}<span>·</span>${topic.stores} 家门店<span>·</span>${topic.pending} 件未确认解决</span></span><span class="pi-rank-total"><strong>${topic.count}</strong><small>${pct(topic.share)}</small></span><span class="pi-rank-delta ${topic.change>0?'is-up':''}">${changeText(topic)}${icon('chevron-right')}</span></button>`).join('')}</div><div class="pi-rank-axis"><span>件</span><div>${Array.from({length:6},(_,index)=>`<span>${ceiling/5*index}</span>`).join('')}</div><span></span><span></span></div><p class="pi-footnote">${icon('pointer')}点击具体问题，查看原始会话、关联案例和待验证原因。</p></section>`;
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
    return `<section class="pi-panel pi-candidates">${heading('正在出现的新问题','未能匹配已知问题定义，等待业务确认',button('本体与回流 '+icon('arrow-up-right'),'ontology'))}<div>${snapshot.newClusters.map(topic=>{const status=decision(topic.id);return `<article class="pi-candidate"><div><span class="pi-novel-mark">候选</span><span>${topic.count} 件 / ${topic.stores} 家门店</span>${badge(status?.status||'待确认',status?'':'amber')}</div><button data-action="insight-topic" data-id="${topic.id}">${escape(topic.title)} ${icon('arrow-up-right')}</button><p>${topic.id==='stripes'?'样本较少，先补视频与环境信息。':'与已知“通话无声”症状不同，建议检查是否需要单列。'}</p><div class="pi-candidate-actions">${button(status?'查看处理记录':'审核候选','review',`data-id="${topic.id}"`)}${button('查看案例','topic',`data-id="${topic.id}"`,'quiet')}</div></article>`;}).join('')||'<div class="pi-empty"><h3>当前范围没有新问题候选</h3><p>可切换 11 月 6—7 日查看候选审核示例。</p></div>'}</div><p class="pi-footnote">合并、拒绝和发布都保留记录，不自动修改正式本体。</p></section>`;
  }
  function definitions(){
    return `<section class="pi-definitions"><h2>统计口径与判断依据</h2><dl><div><dt>计数单位</dt><dd>问题实例 = 同一客户 / 服务对象在一次服务周期内的一个诉求。多条追问不重复计数；本例每个 SAMPLE ID 代表一个实例。跨渠道身份未确认时不自动合并。</dd></div><div><dt>Top 5 与占比</dt><dd>按主要问题量排序，同量按问题 ID 排序。占比 = 该问题实例数 / 当前范围全部有效问题数；“其他”保留剩余类别，候选不从分母删除。</dd></div><div><dt>已知问题不等于已知根因</dt><dd>本体约束产品、版本、症状、业务环节、原因假设和处理动作。关系与聚类只是线索；要有复现、日志或人工核验才能确认原因。</dd></div><div><dt>新问题发现</dt><dd>真实方案需对无法匹配或低置信样本做语义聚类、实体约束与异常检测。本演示使用预置候选，未运行 GraphRAG 或自动发现。</dd></div><div><dt>本体更新</dt><dd>审核定义和边界 → 规则检查 → 明确确认 → 发布演示版本。历史样本绑定 v0.2，不因目录更新而重算；重算应另存快照。</dd></div><div><dt>比较与边界</dt><dd>单日对比前一天；7 天对比前一周。零基线不显示增幅。模拟样本截至 2026-11-07，不能当作 2026-11-08 的实时业绩。</dd></div></dl></section>`;
  }
  function dashboard(snapshot){
    if(!snapshot.count)return `<div class="pi-empty pi-empty-page">${icon('archive')}<h2>这个范围没有可统计的问题</h2><p>历史存档不计入实时服务样本。没有数据时不显示 Top 5 或虚构占比。</p>${button('恢复样本范围','clear','','primary')}</div>`;
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
    return `<div class="pi-evidence-grid"><section class="pi-panel pi-hypothesis">${heading('可能原因与核验线索','当前为待验证假设，不作为自动换机或承诺的依据',badge('待验证','amber'))}<h3>${escape(detail.hypothesis)}</h3><dl class="pi-evidence-points"><div><dt>支持线索</dt><dd>${escape(detail.evidence)} <button class="text-button" data-action="insight-record" data-id="${first.id}">查看来源 ${icon('arrow-up-right')}</button></dd></div><div><dt>反例与缺口</dt><dd>${escape(detail.counter)}</dd></div><div><dt>下一步核验</dt><dd>${escape(detail.action)}</dd></div></dl><div class="pi-evidence-footer"><span>${detail.evidenceCount} / ${detail.count} 件有预置关联线索</span>${button(state().followups.some(item=>item.topicId===detail.id)?'查看跟进任务':'建立跟进任务','followup',`data-id="${detail.id}"`,'primary')}</div></section><section class="pi-panel pi-scope">${heading('问题定位','轻本体约束的业务范围')}<dl>${[['产品',detail.product],['版本',detail.version],['业务环节',detail.stage],['问题现象',detail.short],['业务领域',detail.domain],['维护团队',detail.owner],['统计本体','v0.2 · 历史快照']].map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section></div><section class="pi-panel pi-related">${heading('关联案例与知识依据','演示结构化关联检索结果 · 未运行真实 GraphRAG')}<div class="pi-retrieval-note">检索约束：${escape(detail.product)} / ${escape(detail.version)} / ${escape(detail.stage)}。相似症状不自动合并为相同根因。</div><div class="pi-relation-row"><span class="pi-relation-type">知识</span><div><strong>${detail.knowledge}</strong><p>${escape(detail.relation)} · 适用条件仍需核对</p></div><span>预置知识索引</span></div>${related.map(row=>`<button class="pi-relation-row" data-action="insight-record" data-id="${row.id}"><span class="pi-relation-type">案例</span><span><strong>${row.id} · ${row.store}</strong><small>${row.date} · ${escape(row.customerText)}</small></span><span>${row.result}</span>${icon('chevron-right')}</button>`).join('')||'<p class="pi-retrieval-note">当前范围未找到更早的同类案例。</p>'}<p class="pi-footnote">历史关联案例仅作参考，不计入当前筛选的问题数量；每条记录可回查来源。</p></section>`;
  }
  function detailPage(snapshot){
    const detail=snapshot.groups.find(topic=>topic.id===ui.topic);
    if(!detail)return `<div class="pi-empty"><h2>当前筛选下没有这个问题</h2>${button('返回问题列表','back')}</div>`;
    return `<div class="pi-detail-header">${button(icon('arrow-left')+' 返回问题洞察','back','','quiet')}<div><span>${badge(detail.known?'已知问题':'新问题候选',detail.known?'':'amber')}<span>${escape(detail.domain)} / ${escape(detail.product)}</span></span><h2>${escape(detail.title)}</h2><p>${detail.count} 件 · 占当前范围 ${pct(detail.share)} · ${detail.stores} 家门店 · ${detail.pending} 件未确认解决</p></div>${button('在图谱中查看','graph',`data-id="${detail.id}"`)}${!detail.known?button('审核新问题','review',`data-id="${detail.id}"`,'primary'):''}</div><nav class="pi-detail-tabs" aria-label="问题详情">${[['evidence','原因与证据'],['cases','关联会话'],['trace','处理记录']].map(([key,title])=>button(title,'detail-tab',`id="insight-detail-${key}" data-value="${key}" aria-pressed="${ui.detailTab===key}"`,ui.detailTab===key?'selected':'')).join('')}</nav>${ui.detailTab==='cases'?caseTable(detail):ui.detailTab==='trace'?processing(detail):evidence(detail)}`;
  }
  function processing(detail){
    const events=[['归一与去重',`${detail.count} 个问题实例；各实例的来源消息可回查。`],['已知范围匹配',`${detail.product} / ${detail.version} / ${detail.domain}；${detail.known?'匹配预置问题定义':'未命中预置定义，保留为候选'}。`],['关联检索示例',`按${detail.relation}关联案例与知识；未执行真实向量检索或 GraphRAG。`],['问题量统计',`以问题 ID 去重后聚合，${detail.count} / ${report().count} 件，不由语言模型估算。`],['原因核验',`${detail.hypothesis}；当前待验证。`]];
    return `<section class="pi-panel">${heading('处理步骤与数据版本','展示处理摘要与输入输出，不展示模型隐式思维链',badge('离线演示'))}<ol class="pi-processing">${events.map(([title,description],index)=>`<li><span>${String(index+1).padStart(2,'0')}</span><div><h3>${title}</h3><p>${escape(description)}</p><small>报告 ${escape(report().snapshotId)} · 本体 v0.2</small></div>${badge(index===4?'待人工核验':'预置记录',index===4?'amber':'')}</li>`).join('')}</ol></section>`;
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
    host.showDialog('审核新问题候选','先确认业务定义，再决定是否进入本体草案。',body,button('保存审核草案','save-review','','primary')+host.button('取消','close-dialog','quiet'));
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
    host.toast(kind==='reject'?'已保留暂不采纳的依据，没有修改本体。':'已保存草案。通过规则检查后，还需要单独确认发布。');
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
    if(draft.baseVersion!==current().version)return host.toast('本体基线已变化，请更新基线并重新检查。',true);
    host.showDialog('发布演示本体版本','仅修改本地演示目录，不发布生产知识，不重算历史报表。',`<div class="pi-review-context"><h3>${escape(draft.name)}</h3><p>${escape(draft.definition)}</p><p>排除：${escape(draft.boundary)}</p><p>${draft.checks.positive} 个来源样本 / ${draft.checks.negative} 个同领域排除样本。规则检查不等于真实语义回归。</p></div><label class="pi-consent"><input id="insight-publish-consent" type="checkbox">我确认业务定义与权限边界，批准发布到本地演示本体。</label>`,button('确认发布演示版本','publish',`data-id="${draft.id}"`,'primary')+host.button('取消','close-dialog','quiet'));
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
    audit('发布演示本体 v'+version,draft.topicId);
    host.closeDialog();refresh();host.toast('已发布演示本体 v'+version+'。历史报表仍使用 v0.2，没有自动重算。');
  }
  function ontology(){
    return `<div class="pi-ontology-header">${button(icon('arrow-left')+' 返回问题洞察','back','','quiet')}<h2 id="insight-ontology-heading" tabindex="-1">本体与问题回流</h2><p>管理问题定义、候选审核和历史版本。</p></div><div class="pi-ontology-meta"><span>当前演示目录 <b>v${escape(current().version)}</b> · ${current().terms.length} 个问题定义</span><span>统计快照 <b>v0.2</b> · 不自动追溯重算</span>${button('查看版本记录','versions','','quiet')}</div><section class="pi-panel">${heading('候选审核与本体草案','审核草案通过规则检查后，由人工确认发布。原因假设仍需单独验证。')}<div class="pi-drafts">${state().drafts.map(draft=>`<article class="pi-draft"><div class="pi-draft-title"><span><b>${escape(draft.name)}</b><small>${draft.id} · ${draft.kind==='new'?'新增定义':draft.kind==='merge'?'合并别名':'暂不采纳'} · 基线 v${escape(draft.baseVersion)}</small></span>${badge(draft.status,draft.status==='检查通过'?'green':'amber')}</div><p>${escape(draft.definition)}</p><p><b>排除：</b>${escape(draft.boundary)}</p><p><b>审核依据：</b>${escape(draft.note)}</p>${draft.checks?`<ul class="pi-check-results">${draft.checks.checks.map(check=>`<li>${icon(check.passed?'circle-check':'alert-triangle')}${escape(check.name)} · ${check.passed?'通过':'未通过'}</li>`).join('')}</ul><p class="pi-rule-caveat">检查 ${draft.checks.positive} 个来源 / ${draft.checks.negative} 个排除样例。仅校验记录与规则，不代表模型语义回归通过。</p>`:''}<div class="pi-draft-actions">${['待检查','检查通过','检查未通过'].includes(draft.status)?button('运行规则检查','check',`data-id="${draft.id}"`):''}${draft.baseVersion!==current().version&&['待检查','检查通过','检查未通过'].includes(draft.status)?button('更新基线并清除旧检查','rebase',`data-id="${draft.id}"`,'quiet'):''}${draft.status==='检查通过'?button('审核发布','publish-review',`data-id="${draft.id}"`,'primary'):''}</div></article>`).join('')||'<div class="pi-empty"><h3>还没有审核草案</h3><p>从“正在出现的新问题”打开候选，核对案例并保存审核意见。</p></div>'}</div></section><section class="pi-panel">${heading('已知问题目录','产品、版本、现象、业务环节、原因假设、处理动作分开建模')}<div class="pi-table-scroll"><table><thead><tr><th>问题定义</th><th>领域</th><th>产品 / 版本 / 环节</th><th>定义与边界</th></tr></thead><tbody>${current().terms.map(term=>`<tr><th scope="row">${escape(term.name)}<small>${escape(term.id)}${term.aliases?.length?' · '+term.aliases.length+' 个审核别名':''}</small></th><td>${escape(term.domain)}</td><td>${escape(term.product||'待补充')}<small>${escape(term.version||'待补充')} · ${escape(term.stage||'待补充')}</small></td><td class="pi-message-cell">${escape(term.definition)}${term.boundary?'<small>排除：'+escape(term.boundary)+'</small>':''}</td></tr>`).join('')}</tbody></table></div></section>${localWork()}`;
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
    host.showDialog('本体版本记录','每次发布生成新记录；历史统计和旧版本不被覆盖。',`<div class="pi-version-list">${state().versions.map(version=>`<article><strong>v${escape(version.version)} ${version===current()?badge('当前演示版本','green'):''}</strong><p>${escape(version.reason)} · ${version.terms.length} 个问题定义</p><small>${escape(version.time)}</small><details><summary>查看该版本定义</summary><ul>${version.terms.map(term=>`<li>${escape(term.name)}${term.aliases?.length?' · 别名：'+term.aliases.map(alias=>escape(alias.name)).join('、'):''}</li>`).join('')}</ul></details></article>`).join('')}</div>`,host.button('关闭','close-dialog','quiet'));
  }
  function openExport(){
    exportReport=report();
    if(!exportReport.count)return host.toast('当前范围没有可导出的有效问题。',true);
    host.showDialog('导出问题统计','仅导出当前筛选的聚合问题统计，不含聊天、密钥或本地审核意见。',`<div class="pi-review-context"><p>${exportReport.dateLabel} · ${exportReport.channelLabel} · ${exportReport.count} 个问题</p><p>包含全部问题分类、数量、占比、未确认解决数、门店数及本体版本。</p></div><label class="pi-consent"><input id="insight-export-consent" type="checkbox">确认此报表是模拟数据，不作为真实经营报告。</label>`,button('下载 CSV','export-confirm','','primary')+host.button('取消','close-dialog','quiet'),'compact');
  }
  function page(){
    const snapshot=report();
    return `<div class="dash-page pi-page"><header class="dash-header pi-header"><div><div class="dash-eyebrow">问题统计</div><h1>运营大盘</h1><p>查看高频问题、变化趋势和待跟进事项。</p></div><div class="dash-header-actions">${button(icon('info-circle')+' 统计口径','definitions',`id="insight-definitions" aria-expanded="${ui.definitions}"`,'quiet')}${button('业务图谱','graph','','quiet')}${button('本体与回流','ontology','','quiet')}${button(icon('download')+' 导出问题统计','export')}</div></header>${navigation()}${filterBar(snapshot)}${ui.definitions?definitions():''}${ui.view==='ontology'?ontology():ui.view==='all'?allTopics(snapshot):ui.view==='detail'?detailPage(snapshot):dashboard(snapshot)}<footer class="pi-footer"><span>${icon('shield-lock')}固定脱敏示例 · 统计本体 v0.2 · 当前演示目录 v${escape(current().version)}</span><span>图表与审核可交互；自动聚类、GraphRAG、生产发布尚未接通。</span></footer></div>`;
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

window.BusinessGraph=(()=>{
  let host;
  Object.assign(window.HUB_ICONS,{
    'graph-network':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" class="icon" aria-hidden="true"><path d="m6 7 6 4m0 0 6-4m-6 4v7"/><circle cx="4.5" cy="5.5" r="2.5"/><circle cx="19.5" cy="5.5" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="20" r="2"/></svg>',
    focus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" class="icon" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="8" y="8" width="8" height="8" rx="2"/></svg>'
  });
  const defaults=()=>({day:'2026-11-07',channel:'all',domain:'all',search:'',topic:'audio',selected:'topic',selectionType:'node',kind:'all',evidenceOnly:false,zoom:1,panX:0,panY:0,query:'same',result:null});
  let ui=defaults();
  let drag=null;
  const source=()=>window.HubProblemData;
  const escape=value=>host.escape(value);
  const action=(label,name,attributes='',tone='quiet small')=>host.button(label,'graph-'+name,tone,attributes);
  const scope=()=>({day:ui.day,channel:ui.channel,domain:ui.domain});
  const snapshot=()=>source().snapshot(scope());
  const ontology=()=>window.ProblemInsights.currentOntology();
  const accepted=topic=>ontology().terms.some(term=>term.id===topic.id||term.aliases?.some(alias=>alias.id===topic.id));
  const channelName=identifier=>window.HubAnalyticsData.channels.find(entry=>entry.id===identifier)?.name||'历史存档';
  const titleLines=(text,width=14)=>String(text).match(new RegExp('.{1,'+width+'}','gu'))||[''];
  const matches=topic=>`${topic.title} ${topic.domain} ${topic.product} ${topic.version} ${topic.knowledge}`.toLowerCase().includes(ui.search.trim().toLowerCase())&&(ui.kind!=='new'||!accepted(topic));
  function model(){
    const report=snapshot();
    const groups=report.groups.filter(matches);
    const topic=groups.find(entry=>entry.id===ui.topic)||groups[0];
    if(!topic)return {report,groups,topic:null,nodes:[],edges:[],rows:[]};
    ui.topic=topic.id;
    const rows=topic.rows.filter(row=>!ui.evidenceOnly||row.primaryEvidence);
    const cases=[...rows].sort((left,right)=>Number(right.primaryEvidence)-Number(left.primaryEvidence)||left.id.localeCompare(right.id)).slice(0,2);
    const related=report.groups.filter(entry=>entry.id!==topic.id&&entry.product===topic.product&&entry.version===topic.version);
    const nodes=[
      {id:'topic',kind:'topic',type:accepted(topic)?'已知问题':'待确认问题',label:topic.short,x:410,y:262,description:topic.symptom,sourceIds:rows.map(row=>row.id)},
      {id:'product',kind:'entity',type:'产品型号',label:topic.product,x:135,y:94,description:'来自当前问题实例的产品字段，不根据渠道推断。',sourceIds:rows.map(row=>row.id)},
      {id:'version',kind:'entity',type:'软件版本',label:topic.version,x:410,y:73,description:'版本是检索约束。不同版本的相似症状不能直接沿用处理结论。',sourceIds:rows.map(row=>row.id)},
      {id:'domain',kind:'entity',type:'业务领域',label:topic.domain,x:115,y:260,description:'轻本体限定本项目的业务范围；历史样本使用 v0.2 分类。',sourceIds:rows.map(row=>row.id)},
      {id:'stage',kind:'entity',type:'触发 / 业务环节',label:topic.stage,x:145,y:437,description:'记录触发步骤或服务节点，与原因假设分别管理。',sourceIds:rows.map(row=>row.id)},
      {id:'knowledge',kind:'knowledge',type:'知识索引 · 待核对',label:topic.knowledge,x:689,y:83,description:'这是预置知识索引，没有接入该编号的正式文档正文；不能当作已发布的处理依据。',sourceIds:[]},
      ...cases.map((row,index)=>({id:row.id,kind:'case',type:row.primaryEvidence?'案例 · 含佐证示例':'案例 · 信息不足',label:row.id,x:700,y:224+index*104,description:row.customerText,sourceIds:[row.id],record:row})),
      {id:'hypothesis',kind:'hypothesis',type:'原因假设 · 未确认',label:topic.hypothesis,x:675,y:480,description:topic.evidence+' '+topic.counter,sourceIds:rows.filter(row=>row.primaryEvidence).map(row=>row.id)},
      ...(related.length?[{id:'related',kind:'related',type:'同型号 / 同版本',label:related.length+' 个其他问题',x:410,y:472,description:'这些问题共享型号和版本，并未证明原因相同。点击具体问题可切换焦点。',sourceIds:related.flatMap(entry=>entry.rows.filter(row=>!ui.evidenceOnly||row.primaryEvidence).map(row=>row.id)),related}]:[])
    ];
    const relations={product:'涉及型号',version:'发生版本',domain:'属于领域',stage:'发生环节',knowledge:'引用索引',hypothesis:'待核验',related:'同范围关联'};
    const edges=nodes.filter(node=>node.id!=='topic').map(node=>({id:'edge-'+node.id,from:'topic',to:node.id,label:relations[node.id]||'来源实例',uncertain:['hypothesis','knowledge','related'].includes(node.id),sourceIds:node.sourceIds}));
    return {report,groups,topic,rows,nodes,edges,related};
  }
  function refresh(focusId){
    const previous=document.getElementById('main-content')?.scrollTop||0;
    const focused=document.activeElement;
    const selection=focused?.id===focusId?focused.selectionStart:null;
    host.render();
    const main=document.getElementById('main-content');if(main)main.scrollTop=previous;
    if(focusId){const fresh=document.getElementById(focusId);fresh?.focus({preventScroll:true});if(typeof selection==='number'&&fresh?.setSelectionRange)fresh.setSelectionRange(selection,selection);}
  }
  function invalidate(){ui.result=null;ui.selected='topic';ui.selectionType='node';ui.zoom=1;ui.panX=0;ui.panY=0;}
  function open(identifier,filters={}){
    ui={...defaults(),...filters,topic:source().topics.some(topic=>topic.id===identifier)?identifier:'audio'};
    host.navigate('graph');
  }
  function filters(){
    return `<div class="graph-filters"><label><span>样本日期</span><select id="graph-day">${[...source().dates].reverse().map(day=>`<option value="${day}" ${ui.day===day?'selected':''}>${day}</option>`).join('')}<option value="week" ${ui.day==='week'?'selected':''}>11.01—11.07</option></select></label><label><span>渠道</span><select id="graph-channel">${[{id:'all',name:'全部实时渠道'},...window.HubAnalyticsData.channels,{id:'archive',name:'历史存档（无样本）'}].map(channel=>`<option value="${channel.id}" ${ui.channel===channel.id?'selected':''}>${channel.name}</option>`).join('')}</select></label><label><span>领域</span><select id="graph-domain">${['all',...source().domains].map(domain=>`<option value="${escape(domain)}" ${ui.domain===domain?'selected':''}>${domain==='all'?'全部业务领域':escape(domain)}</option>`).join('')}</select></label><label class="graph-evidence-filter"><input type="checkbox" id="graph-evidence-only" ${ui.evidenceOnly?'checked':''}><span>案例只看含佐证示例</span></label><span class="graph-sample-tag">固定模拟数据</span></div>`;
  }
  function issueList(graph){
    const remaining=graph.report.groups.filter(topic=>!accepted(topic)).length;
    return `<aside class="graph-issues" aria-label="问题列表"><div class="graph-issues-title"><h3>问题索引</h3><span>${graph.groups.length} 类</span></div><label class="graph-search">${host.icon('search','small')}<input id="graph-search" value="${escape(ui.search)}" placeholder="搜索问题、型号或知识编号" aria-label="搜索图谱问题" maxlength="120"></label><div class="graph-list-tabs">${[['all','全部'],['new','待确认 '+remaining]].map(([kind,label])=>action(label,'kind',`data-value="${kind}" aria-pressed="${ui.kind===kind}"`,ui.kind===kind?'selected':'quiet')).join('')}</div><div class="graph-topic-list">${graph.groups.map((topic,index)=>`<button class="graph-topic ${graph.topic?.id===topic.id?'selected':''}" data-action="graph-topic" data-id="${topic.id}" aria-pressed="${graph.topic?.id===topic.id}"><span class="graph-topic-index">${String(index+1).padStart(2,'0')}</span><span><strong>${escape(topic.short)}</strong><small>${escape(topic.product)} · ${escape(topic.version)}</small><em>${accepted(topic)?'已知范围':'待确认定义'}</em></span><b>${topic.count}<small>件</small></b></button>`).join('')||'<p class="graph-list-empty">没有匹配的问题。</p>'}</div><p class="graph-index-note">按去重问题量排序。检索词与“待确认”只筛选目录，不改变原始统计。</p></aside>`;
  }
  function viewBox(){return `${420-420/ui.zoom+ui.panX} ${282-282/ui.zoom+ui.panY} ${840/ui.zoom} ${564/ui.zoom}`;}
  function canvas(graph){
    const center=graph.nodes[0];
    const lines=graph.edges.map(edge=>{
      const target=graph.nodes.find(node=>node.id===edge.to);
      const selected=ui.selectionType==='edge'?ui.selected===edge.id:ui.selected===target.id||ui.selected==='topic';
      const path=`M ${center.x} ${center.y} Q ${(center.x+target.x)/2} ${center.y} ${target.x} ${target.y}`;
      return `<g class="graph-edge ${edge.uncertain?'uncertain':''} ${selected?'connected':''}" data-action="graph-edge" data-id="${edge.id}" role="button" tabindex="0" aria-label="${edge.label}：${escape(center.label)}到${escape(target.label)}"><title>${edge.label} · ${edge.sourceIds.length} 个来源实例${edge.uncertain?' · 不代表已确认因果':''}</title><path class="graph-edge-hit" d="${path}"></path><path class="graph-edge-line" d="${path}" marker-end="url(#graph-arrow)"></path></g>`;
    }).join('');
    const nodes=graph.nodes.map(node=>{
      const central=node.id==='topic';
      const width=central?208:190;
      const labels=titleLines(node.label,central?13:15).slice(0,2);
      return `<g class="graph-node graph-node-${node.kind} ${ui.selectionType==='node'&&ui.selected===node.id?'selected':''}" role="button" tabindex="0" data-action="graph-node" data-id="${node.id}" aria-label="${escape(node.type+'：'+node.label)}" transform="translate(${node.x},${node.y})"><title>${escape(node.type+'：'+node.label)}</title><rect x="${-width/2}" y="-38" width="${width}" height="${labels.length>1?87:76}" rx="${central?14:9}"></rect><circle cx="${-width/2+17}" cy="-19" r="3.5"></circle><text class="graph-node-type" x="${-width/2+28}" y="-15">${escape(node.type)}</text>${labels.map((label,index)=>`<text class="graph-node-label" x="0" y="${11+index*19}" text-anchor="middle">${escape(label)}</text>`).join('')}</g>`;
    }).join('');
    return `<section class="graph-canvas-panel"><div class="graph-canvas-heading"><div><span>当前焦点</span><h3>${escape(graph.topic.title)}</h3></div><span>${graph.topic.count} 件</span></div><div class="graph-canvas" aria-label="问题关系画布"><svg id="business-graph-svg" viewBox="${viewBox()}" role="group" aria-label="可交互业务关系图，按 Tab 选择节点或关系，Enter 查看详情"><defs><marker id="graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#a5afa7"></path></marker><pattern id="graph-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#d5ddd4"></circle></pattern></defs><rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#graph-dots)"></rect>${lines}${nodes}</svg><div class="graph-canvas-controls" role="group" aria-label="图谱视野">${action('−','zoom','data-value="out" aria-label="缩小图谱" '+(ui.zoom<=.7?'disabled':''))}<span id="graph-zoom-value">${Math.round(ui.zoom*100)}%</span>${action('+','zoom','data-value="in" aria-label="放大图谱" '+(ui.zoom>=1.8?'disabled':''))}${action(host.icon('focus','small'),'reset','aria-label="适应画布"')}</div></div><div class="graph-legend"><span><i class="graph-solid"></i>结构 / 来源关系</span><span><i class="graph-dashed"></i>线索 / 待核验</span><small>展示 ${graph.nodes.filter(node=>node.kind==='case').length} / ${graph.rows.length} 个案例；点击节点或连线查依据</small></div></section>`;
  }
  function sourceLinks(identifiers,limit=4){
    return identifiers.slice(0,limit).map(identifier=>action(escape(identifier)+' '+host.icon('arrow-up-right','small'),'source',`data-id="${identifier}"`)).join('');
  }
  function inspector(graph){
    const edge=ui.selectionType==='edge'?graph.edges.find(entry=>entry.id===ui.selected):null;
    const node=graph.nodes.find(entry=>entry.id===(edge?edge.to:ui.selected))||graph.nodes[0];
    const chosen=source().records.filter(row=>node.sourceIds.includes(row.id));
    return `<aside class="graph-inspector" aria-label="节点与关系详情"><div class="graph-inspector-label">${host.icon('graph-network','small')} ${edge?'关系依据':'节点详情'}</div><span class="graph-type graph-type-${node.kind}">${escape(edge?edge.label:node.type)}</span><h3>${escape(node.label)}</h3><p>${escape(node.description)}</p>${edge?`<div class="graph-proof"><strong>${escape(graph.topic.short)} → ${escape(node.label)}</strong><p>${edge.uncertain?'只记录关联或待核验线索，不作为确定因果。':'关系来自所列模拟实例的明确字段或来源归属。'}</p></div>`:''}${node.id==='topic'?`<dl><div><dt>历史问题量</dt><dd>${graph.topic.count} 件</dd></div><div><dt>当前展示范围</dt><dd>${graph.rows.length} 个案例</dd></div><div><dt>已核实根因</dt><dd>尚无</dd></div><div><dt>负责核验</dt><dd>${escape(graph.topic.owner)}</dd></div></dl><h4>下一步核验</h4><p>${escape(graph.topic.action)}</p>`:''}${node.kind==='hypothesis'?`<h4>反证与限制</h4><p class="graph-caution">${escape(graph.topic.counter)}</p>`:''}${node.kind==='knowledge'?'<p class="graph-caution">索引不等于知识正文，也不代表已通过适用性审核。正式接入后需校验来源、发布状态和版本。</p>':''}${node.related?`<div class="graph-neighbors">${node.related.map(topic=>action(escape(topic.short)+' · '+topic.count+' 件','topic',`data-id="${topic.id}"`)).join('')}</div>`:''}${node.record?`<dl><div><dt>日期 / 渠道</dt><dd>${node.record.date} · ${channelName(node.record.channel)}</dd></div><div><dt>结果</dt><dd>${escape(node.record.result)}</dd></div><div><dt>复核状态</dt><dd>${escape(node.record.reviewStatus)}</dd></div></dl>`:''}<h4>来源实例 <span>${node.sourceIds.length}</span></h4><div class="graph-source-links">${sourceLinks(node.sourceIds)||'<p>仅预置索引，无可核验正文。</p>'}</div>${node.sourceIds.length>4?`<small class="graph-source-note">先列 4 条；关联检索可浏览其余 ${node.sourceIds.length-4} 条。</small>`:''}${chosen.length?`<p class="graph-source-note">${chosen.filter(row=>row.primaryEvidence).length} 条含佐证示例，均待人工核实；不是可信度评分。</p>`:''}<div class="graph-inspector-actions">${!accepted(graph.topic)?action(window.ProblemInsights.getState().decisions.some(entry=>entry.topicId===graph.topic.id)?'查看审核草案':'审核新问题','review',`data-id="${graph.topic.id}"`,'primary small'):action('查看本体与版本','ontology','','small')}</div></aside>`;
  }
  function resultPanel(){
    const result=ui.result;
    if(!result)return '';
    return `<section class="graph-results" id="graph-results" tabindex="-1"><header><div><span>本次关联检索 · ${escape(result.snapshotId)}</span><h3>${result.rows.length} 个案例，${result.topicIds.length} 类问题</h3></div>${host.button('查看执行追踪','trace-open','quiet small',`data-id="${result.traceId}" data-owner="analytics"`)}</header><ol class="graph-retrieval-path">${result.path.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><p>本问题 ${result.ownCount} 件；同范围其他问题 ${result.rows.length-result.ownCount} 件。排除 ${result.excluded} 个不符型号 / 版本 / 问题条件的实例${result.noEvidence?'，另有 '+result.noEvidence+' 个缺少佐证示例未展示':''}。仅返回关联来源，未调用模型生成答案。</p><div class="graph-result-rows">${result.rows.slice(0,result.limit).map(row=>`<button data-action="graph-source" data-id="${row.id}"><span><strong>${escape(source().topics.find(topic=>topic.id===row.topicId).short)}</strong><small>${row.id} · ${row.date} · ${channelName(row.channel)}</small></span><span>${row.primaryEvidence?'含佐证示例':'信息不足'} ${host.icon('arrow-up-right','small')}</span></button>`).join('')||'<div class="graph-list-empty">当前证据筛选没有可返回的案例；没有补造结果。</div>'}</div>${result.rows.length>result.limit?action('再显示 12 条','more','','small'):''}<p class="graph-result-note">来源于固定模拟片段，不等同于生产 GraphRAG 的向量召回、社区归纳或自动根因分析。</p></section>`;
  }
  function queryBar(){
    return `<section class="graph-query" aria-label="有范围的关联检索"><div>${host.icon('graph-network')}<span><strong>顺着关系查案例</strong><small>从焦点问题出发，不跨型号套用结论</small></span></div><label><span class="sr-only">关联检索范围</span><select id="graph-query"><option value="same" ${ui.query==='same'?'selected':''}>同型号 + 同版本的关联案例</option><option value="current" ${ui.query==='current'?'selected':''}>仅当前问题的来源证据</option></select></label>${action('关联检索 '+host.icon('arrow-right','small'),'run','','primary')}</section>`;
  }
  function page(){
    const graph=model();
    return `<div class="business-graph"><header class="graph-page-heading"><div><span class="graph-eyebrow">案例关联</span><h1>业务图谱</h1><p>按问题查看产品、版本和来源案例，核对关联依据。</p></div><div>${action('本体结构','schema')}${action('本体与回流','ontology')}${action('版本 v'+escape(ontology().version),'versions')}</div></header>${filters()}<div class="graph-workspace">${issueList(graph)}${graph.topic?canvas(graph)+inspector(graph):`<section class="graph-empty"><h2>当前范围没有匹配的问题</h2><p>调整日期、渠道或搜索条件。没有样本时，不生成图谱或检索结果。</p>${action('清除筛选','clear','','primary')}</section>`}</div>${graph.topic?queryBar()+resultPanel():''}<footer class="graph-footer"><span>历史样本分类 v0.2 · 当前本体 v${escape(ontology().version)} · 本地结构化关联检索</span><span>自动抽取、向量召回、社区聚类与模型生成尚未接入</span></footer></div>`;
  }
  function run(){
    const started=performance.now();
    const graph=model();if(!graph.topic)return;
    const candidates=graph.report.rows.filter(row=>ui.query==='current'?row.topicId===graph.topic.id:row.product===graph.topic.product&&row.version===graph.topic.version);
    const rows=candidates.filter(row=>!ui.evidenceOnly||row.primaryEvidence).sort((left,right)=>Number(right.topicId===graph.topic.id)-Number(left.topicId===graph.topic.id)||Number(right.primaryEvidence)-Number(left.primaryEvidence)||left.id.localeCompare(right.id));
    const result={snapshotId:graph.report.snapshotId,rows,topicIds:[...new Set(rows.map(row=>row.topicId))],ownCount:rows.filter(row=>row.topicId===graph.topic.id).length,excluded:graph.report.rows.length-candidates.length,noEvidence:candidates.length-rows.length,limit:12,path:[graph.topic.title,ui.query==='same'?graph.topic.product+' / '+graph.topic.version:'限定同一问题定义',ui.evidenceOnly?'保留含佐证示例的来源':'保留全部来源，标注证据缺口','按实例去重并返回原始片段']};
    result.traceId=window.TraceHub.record({title:'图谱关联检索：'+graph.topic.short,agent:'analytics',tool:'local.graph.traverse',input:{...scope(),topicId:graph.topic.id,query:ui.query,evidenceOnly:ui.evidenceOnly,ontologyVersion:ontology().version,statisticsOntology:'0.2'},output:{snapshotId:result.snapshotId,path:result.path,count:rows.length,topicIds:result.topicIds,sourceIds:rows.map(row=>row.id),excluded:result.excluded,noEvidence:result.noEvidence,modelCalled:false,causalConclusion:null},source:'本地模拟图谱 / 本体 v'+ontology().version,durationMs:performance.now()-started,summary:'执行了范围过滤、结构化关系遍历和实例去重；来源可回查，未执行向量检索、社区聚类或模型生成。'});
    ui.result=result;refresh();document.getElementById('graph-results')?.focus({preventScroll:true});document.getElementById('graph-results')?.scrollIntoView({block:'nearest',behavior:'auto'});
  }
  function schema(){
    host.showDialog('轻本体结构','已知领域按本体约束，未知问题进入候选审核；关系不等于因果。',`<div class="graph-schema"><h3>实体类型</h3><p>领域、问题、产品、版本、业务环节、案例、知识索引、原因假设。</p><h3>允许的主要关系</h3><dl><div><dt>问题 → 产品 / 版本 / 环节</dt><dd>发生范围，来自实例字段</dd></div><div><dt>问题 → 案例 → 来源片段</dt><dd>支持回查与去重计数</dd></div><div><dt>问题 → 知识索引</dt><dd>正文、发布状态与适用性待接入校验</dd></div><div><dt>问题 → 原因假设</dt><dd>需独立证据和反证，不自动确认为根因</dd></div></dl><h3>新问题回流</h3><p>候选核验 → 人工定义 / 合并 / 暂不采纳 → 规则检查 → 人工发布新版本。历史分类快照仍保留 v0.2。</p><h3>GraphRAG 接入边界</h3><p>当前已实现本地结构化图关联与来源回查。生产仍需文档脱敏、实体抽取与消歧、向量召回、受权限约束的邻域检索、社区报告和带引用的生成。以上生产能力尚未接入。</p></div>`,host.button('关闭','close-dialog'));
  }
  function dispatch(name,element){
    const identifier=element.dataset.id;
    const value=element.dataset.value;
    if(name==='topic'){ui.topic=identifier;ui.search='';ui.kind='all';invalidate();refresh();}
    else if(name==='node'||name==='edge'){ui.selected=identifier;ui.selectionType=name;refresh();document.querySelector(`.graph-${name}[data-id="${CSS.escape(identifier)}"]`)?.focus({preventScroll:true});}
    else if(name==='kind'){ui.kind=value;invalidate();refresh();}
    else if(name==='source')window.ProblemInsights.openRecord(identifier);
    else if(name==='run')run();
    else if(name==='more'&&ui.result){ui.result.limit+=12;refresh();}
    else if(name==='clear'){ui=defaults();refresh();}
    else if(name==='ontology'||name==='review')window.ProblemInsights.openOntology(scope(),name==='review'?identifier:null);
    else if(name==='versions')window.ProblemInsights.versions();
    else if(name==='schema')schema();
    else if(name==='zoom'){ui.zoom=Math.max(.7,Math.min(1.8,Math.round((ui.zoom+(value==='in'?.15:-.15))*100)/100));refresh();}
    else if(name==='reset'){ui.zoom=1;ui.panX=0;ui.panY=0;refresh();}
  }
  function configure(adapter){
    host=adapter;
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="graph-"]');if(element){event.preventDefault();dispatch(element.dataset.action.slice(6),element);}});
    document.addEventListener('input',event=>{if(event.target.id==='graph-search'){ui.search=event.target.value.slice(0,120);invalidate();refresh('graph-search');}});
    document.addEventListener('change',event=>{
      const identifier=event.target.id;const value=event.target.value;
      const allowed={'graph-day':[...source().dates,'week'],'graph-channel':['all','archive',...window.HubAnalyticsData.channels.map(channel=>channel.id)],'graph-domain':['all',...source().domains],'graph-query':['same','current']};
      if(identifier==='graph-evidence-only')ui.evidenceOnly=event.target.checked;
      else if(allowed[identifier]?.includes(value))ui[identifier.slice(6)]=value;
      else return;
      invalidate();refresh(identifier);
    });
    document.addEventListener('keydown',event=>{const element=event.target.closest('svg [data-action^="graph-"]');if(element&&['Enter',' '].includes(event.key)){event.preventDefault();dispatch(element.dataset.action.slice(6),element);}});
    document.addEventListener('pointerdown',event=>{const canvas=event.target.closest('#business-graph-svg');if(!canvas||event.target.closest('[data-action]')||event.button!==0)return;drag={identifier:event.pointerId,canvas,startX:event.clientX,startY:event.clientY,panX:ui.panX,panY:ui.panY,scale:840/ui.zoom/canvas.getBoundingClientRect().width};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');});
    document.addEventListener('pointermove',event=>{if(!drag||drag.identifier!==event.pointerId)return;ui.panX=Math.max(-500,Math.min(500,drag.panX-(event.clientX-drag.startX)*drag.scale));ui.panY=Math.max(-350,Math.min(350,drag.panY-(event.clientY-drag.startY)*drag.scale));drag.canvas.setAttribute('viewBox',viewBox());});
    const stopDrag=()=>{drag?.canvas.classList.remove('dragging');drag=null;};
    document.addEventListener('pointerup',stopDrag);document.addEventListener('pointercancel',stopDrag);
  }
  return {configure,page,open,model,reset(){ui=defaults();}};
})();
