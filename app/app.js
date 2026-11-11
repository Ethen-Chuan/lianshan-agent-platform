const STORAGE_KEY = 'servicehub_demo_project_v13';
const caseSeed = [
  { id: 'CS-0108', name: '门店顾问 A', organization: '华东服务门店 · 演示', initial: 'A', entityType:'store', identityTone:'clay', identityVariant:0, channel: 'wechat', channelName: '微信客服', origin: '官方客服入口 · 模拟', title: '中控屏幕黑屏，重启后仍未恢复', preview: '已经尝试重启，还是黑屏，需要进一步排查。', time: '10:42', status: 'AI 处理中', owner: 'ai', priority: '普通', product: '座舱终端 A1', version: 'V2.3.1', model: 'A1 标准版', tags: ['故障排查', '身份已验证'], verified: true, unread: true, related: '仅当前授权会话', messages: [
    {role:'customer', text:'你好，我们门店的一台座舱终端 A1 中控黑屏了，车辆启动后屏幕没有反应。', time:'10:38'},
    {role:'agent', text:'您好，这台设备的软件版本是多少？最近有没有拆装或升级过？', time:'10:38', source:'A1 显示异常排查指南 · V3.2'},
    {role:'customer', text:'软件是 V2.3.1，没有拆装过。已经尝试重启，还是黑屏。', time:'10:40'},
    {role:'agent', text:'重启后还是黑屏，先请门店技术人员检查供电和连接，暂时不要拆机。如果仍未恢复，可以提交报修单，请专家一起排查。', time:'10:41', source:'A1 显示异常排查指南 · V3.2'},
    {role:'customer', text:'可以，帮我整理一下报修单，我们这边需要专家一起确认。', time:'10:42'}
  ]},
  {id:'CS-0107',name:'技术同事 B',organization:'内部售后团队 · 演示',initial:'B',entityType:'technician',identityTone:'blue',channel:'ding',channelName:'钉钉',origin:'售后支持群 · @ 机器人 · 模拟',title:'升级后蓝牙连接频繁断开',preview:'版本升级后蓝牙会自动断开，已经复现两次。',time:'10:39',status:'等待专家',owner:'human',priority:'优先',product:'座舱终端 B2',version:'V4.0.2',model:'B2 专业版',tags:['软件问题','待专家'],verified:true,unread:false,related:'仅当前授权群线程',messages:[{role:'customer',text:'升级到 V4.0.2 后蓝牙会自动断开，已经复现两次。',time:'10:34'},{role:'agent',text:'还没有 V4.0.2 对应的处理方案，先别照旧版本的方法操作。这次升级后断连的情况，需要软件专家确认。',time:'10:35'},{role:'system',text:'客服已接管，已给软件专家分派待办',time:'10:39'}]},
  {id:'CS-0106',name:'门店顾问 C',organization:'华南服务门店 · 演示',initial:'C',entityType:'store',identityTone:'teal',identityVariant:1,channel:'feishu',channelName:'飞书',origin:'服务协作群 · 模拟',title:'报修工单处理到哪一步了？',preview:'想确认一下设备检测的进度。',time:'10:35',status:'人工处理中',owner:'human',priority:'普通',product:'座舱终端 A1',version:'V2.3.2',model:'A1 标准版',tags:['进度查询'],verified:true,unread:false,related:'已绑定工单 DEMO-0021',messages:[{role:'customer',text:'想确认一下设备检测的进度，工单是 DEMO-0021。',time:'10:33'},{role:'agent',text:'工单 DEMO-0021 还在技术检测中，目前没有新的检测结论。',time:'10:34'},{role:'customer',text:'好的，有进一步结论请通知我。',time:'10:35'}]},
  {id:'CS-0105',name:'服务顾问 D',organization:'北区服务门店 · 演示',initial:'D',entityType:'store',identityTone:'plum',identityVariant:2,channel:'wechat',channelName:'微信客服',origin:'官方客服入口 · 模拟',title:'希望直接更换设备',preview:'能不能保证今天免费更换？',time:'10:28',status:'待人工接管',owner:'ai',priority:'高风险',product:'座舱终端 C3',version:'待确认',model:'C3 标准版',tags:['投诉升级','承诺风险'],verified:false,unread:true,related:'身份尚未完成验证',messages:[{role:'customer',text:'这个问题已经问了几次了，能不能保证今天免费更换？',time:'10:27'},{role:'agent',text:'让您来回问了几次，抱歉。能否换机、是否收费，需要专员核实，现在还不能确定今天能否更换。会话已进入人工队列，请稍等接待。',time:'10:28',source:'服务承诺与升级规则 · V2.0'}]},
  {id:'CS-0104',name:'门店顾问 E',organization:'西区服务门店 · 演示',initial:'E',entityType:'store',identityTone:'amber',identityVariant:0,channel:'ding',channelName:'钉钉',origin:'机器人单聊 · 模拟',title:'在哪里查看设备的软件版本？',preview:'找到了，谢谢，问题已解决。',time:'10:16',status:'已解决',owner:'ai',priority:'普通',product:'座舱终端 A1',version:'V2.3.1',model:'A1 标准版',tags:['操作咨询','已确认解决'],verified:true,unread:false,related:'用户已确认解决',evidence:'用户明确反馈已找到版本信息',messages:[{role:'customer',text:'在哪里查看设备的软件版本？',time:'10:14'},{role:'agent',text:'在设备设置里打开“系统信息”，就能看到“软件版本”。如果菜单名称不同，告诉我您看到的选项。',time:'10:15',source:'A1 使用手册 · V2.1'},{role:'customer',text:'找到了，谢谢，问题已解决。',time:'10:16'}]},
  {id:'CS-0089',name:'历史资料 F',organization:'授权存档样本 · 演示',initial:'F',entityType:'archive',identityTone:'slate',channel:'archive',channelName:'授权历史存档',origin:'历史导入批次 BATCH-DEMO · 只读',title:'历史导航异常咨询记录',preview:'历史资料仅用于参考，不自动发送或进入知识库。',time:'11/03',status:'历史资料',owner:'readonly',priority:'普通',product:'座舱终端 B2',version:'历史版本',model:'B2 专业版',tags:['只读存档','未经知识审核'],verified:false,unread:false,related:'没有进行跨渠道身份合并',messages:[{role:'customer',text:'这是一条脱敏历史咨询样本，部分附件未包含在导入范围内。',time:'历史'},{role:'system',text:'只读资料：附件存在缺口，处理结果未知，不参与实时服务解决率',time:'历史'}]}
];
const channelSeed = [
  {id:'wechat',name:'微信客服',kind:'官方服务入口',scope:'客服账号 DEMO · 试点入口',status:'正常',read:true,reply:true,history:false,media:true,count:1248,delay:'0.8 秒',note:'可回复范围仍受会话状态和官方规则限制。'},
  {id:'ding',name:'钉钉',kind:'应用机器人',scope:'2 个服务群 · 单聊 / @ 机器人',status:'正常',read:true,reply:true,history:false,media:true,count:836,delay:'1.2 秒',note:'仅演示机器人授权场景，不读取任意员工私聊。'},
  {id:'feishu',name:'飞书',kind:'企业应用机器人',scope:'3 个授权群 · 指定用户',status:'正常',read:true,reply:true,history:true,media:true,count:964,delay:'0.6 秒',note:'群消息与历史查询分别授权，不默认全量开放。'},
  {id:'archive',name:'企业微信存档',kind:'只读 / 联邦接入',scope:'脱敏历史样本 · 不复制受限正文',status:'只读',read:true,reply:false,history:true,media:false,count:320,delay:'批次导入',note:'存档不代表可回复。第三方正文输出边界需单独验证。'}
];
const agentSeed = [
  {id:'service',name:'售后接待助手',icon:'headset',desc:'优先解决常见售后问题，减少不必要的转人工；风险、主动求助与知识缺口及时交接。',mode:'auto',enabled:true,version:'V1.4',runs:826,accuracy:'96.3%',latency:'2.8s',tags:['官方问答','故障信息采集']},
  {id:'ticket',name:'工单填写助手',icon:'clipboard-list',desc:'从客户对话提取信息，映射 CRM、QMS 表单，补齐缺项并核对提交回执。',mode:'assist',enabled:true,version:'V1.2',runs:184,accuracy:'97.8%',latency:'1.6s',tags:['字段抽取','人工确认']},
  {id:'quality',name:'对话质检助手',icon:'shield-check',desc:'按评分标准核对坐席与客户的完整对话，逐项记录扣分依据，复核服务规范。',mode:'observe',enabled:true,version:'V1.1',runs:1216,accuracy:'待人工校准',latency:'3.1s',tags:['发送前规则','事后质检']},
  {id:'analytics',name:'大盘助手',icon:'chart-bar',desc:'查服务指标、解释统计口径，把异常关联到具体请求与责任助手。',mode:'assist',enabled:true,version:'V1.0',runs:0,accuracy:'待人工复核',latency:'未采集',tags:['运营问数','异常排查','只读分析']}
];
const knowledgeSeed = [
  {id:'KB-0102',title:'A1 显示异常排查指南',category:'故障排查',product:'座舱终端 A1',version:'V3.2',status:'已发布',owner:'显示领域专家',date:'11-06',content:'适用于 A1 标准版。先核实设备、软件版本和发生条件，由专业人员按审核流程检查供电和连接。无充分依据不得直接判定硬件损坏或承诺换机。'},
  {id:'KB-0087',title:'服务承诺与投诉升级规则',category:'服务规范',product:'全业务',version:'V2.0',status:'已发布',owner:'服务运营组',date:'11-05',content:'涉及免费更换、赔付、确定处理期限等承诺，应提交具有权限的人员确认。客户要求人工时，不重复强制 AI 问答。'},
  {id:'KB-0101',title:'A1 软件版本信息查询',category:'操作咨询',product:'座舱终端 A1',version:'V2.1',status:'已发布',owner:'软件领域专家',date:'11-04',content:'在设备设置中打开系统信息，查看软件版本。升级前需查询匹配机型与硬件版本的官方版本记录，不根据历史对话判断最新版本。'},
  {id:'KB-0108',title:'B2 蓝牙断连问题处理建议',category:'软件问题',product:'座舱终端 B2',version:'草稿',status:'待审核',owner:'软件领域专家',date:'11-07',content:'来自服务对话的候选知识：升级后存在蓝牙断连反馈。尚缺复现条件与专家验证，不能用于自动对外回答。'}
];
const initialState = () => ({version:1,cases:structuredClone(caseSeed),channels:structuredClone(channelSeed),agents:structuredClone(agentSeed),knowledge:structuredClone(knowledgeSeed),tickets:[{id:'DEMO-0021',caseId:'CS-0106',title:'座舱终端 A1 检测申请',customer:'门店顾问 C',type:'报修单',product:'座舱终端 A1',version:'V2.3.2',priority:'普通',description:'设备异常，等待技术检测结果。',department:'技术支持组',status:'技术检测中',created:'11-06 15:24',notified:true}],reviews:[{id:'QC-0032',caseId:'CS-0105',type:'未经批准的服务承诺',risk:'高风险',status:'待复核',answer:'我们保证今天免费更换设备。',reason:'缺少审批与资格确认，不能作出换机或时效承诺。',time:'10:28'},{id:'QC-0031',caseId:'CS-0107',type:'知识适用版本不匹配',risk:'中风险',status:'待复核',answer:'直接使用旧版本处理方案。',reason:'当前版本未在知识适用范围内，已退回人工复核。',time:'10:19'},{id:'QC-0030',caseId:'CS-0104',type:'引用与结论一致',risk:'低风险',status:'已通过',answer:'按已审核的使用手册查看软件版本。',reason:'专家复核通过，来源支持结论。',time:'10:16'}],audit:[{time:'10:42',text:'已收到微信客服模拟消息',caseId:'CS-0108'},{time:'10:28',text:'高风险承诺进入质检复核',caseId:'CS-0105'}],imports:[{id:'BATCH-DEMO',name:'授权历史样本',records:320,status:'已归集 · 只读',time:'11-03 14:20'}],settings:{mask:true,log:true},metricsPeriod:'week'});
let state;
try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); state = saved && saved.version === 1 && Array.isArray(saved.cases) ? saved : initialState(); } catch { state = initialState(); }
state.agents.forEach(agent=>{const definition=agentSeed.find(entry=>entry.id===agent.id);if(definition){agent.name=definition.name;agent.desc=definition.desc;}});
if(!state.agents.some(agent=>agent.id==='analytics'))state.agents.push(structuredClone(agentSeed.find(agent=>agent.id==='analytics')));
const view = { page:location.hash.slice(1)||'portfolios',caseId:state.cases[0].id,queue:'all',channel:'all',search:'',context:'profile',composer:'reply',mobileCase:false,contextOpen:false,filter:'all',modal:null,guideStep:0 };
const pageNames={'project-assistant':'协调助手设置',orbit:'Orbit · 业务设计',ontology:'业务本体 · Ontology','custom-assistant':'定制业务助手',portfolios:'项目集',portfolio:'项目集',project:'部门项目', 'portfolio-form':'项目设置',workspace:'客服工作台',customer:'客户体验',manager:'业务协作',group:'业务协作',graph:'业务实例图谱',reception:'智能接待',forms:'系统填单',scoring:'会话评分',channels:'渠道接入',agents:'业务助手',dashboard:'大盘助手',tickets:'工单填写助手 / 工单记录',quality:'发送风险复核',knowledge:'知识库',analytics:'运营大盘',settings:'平台设置'};
if(!pageNames[view.page]) view.page='portfolios';
const corePages=['workspace','group','knowledge','agents','project-assistant','customer','quality','channels','settings'];
const deferredPages={
  analytics:'这里读取固定样本，不反映客服工作台中的操作和解决结果。',
  dashboard:'问数与简报使用固定样本；当前先验证单次服务能否完成。',
  graph:'此处为样例记录的关联图，尚未与实际会话和业务定义同步。',
  scoring:'独立评分暂缓；发送前风险检查和人工复核仍在主流程中。',
  reception:'独立接待测试已退出主流程，请从左侧「客户体验」模拟咨询与自助处理。',
  forms:'独立填单演练已退出主流程，请从具体客户会话核对并创建工单。'
};
function deferredNotice(){
  const reason=window.PortfolioHub.navProject()?.id==='AFTERSALES'&&deferredPages[view.page];
  return reason?'<section class="scope-notice" aria-label="实验功能说明"><div><strong>实验与旧版记录 · 不在当前主流程</strong><p>'+escapeHtml(reason)+' 原有记录继续保留。</p></div>'+button('返回客服工作台','navigate','small','data-page="workspace"')+'</section>':'';
}
function deferredSettings(){
  return '<details class="panel section-spacer scope-archive"><summary>实验与旧版记录</summary><p>这些功能暂不纳入日常服务流程，不需要逐一配置。保留旧记录，不新增接入承诺。</p><div class="scope-archive-list">'+Object.entries(deferredPages).map(([page,reason])=>'<div><span><strong>'+escapeHtml(pageNames[page])+'</strong><small>'+escapeHtml(reason)+'</small></span>'+button('查看旧版','navigate','quiet small','data-page="'+page+'"')+'</div>').join('')+'</div></details>';
}
let toastTimer = null;
let importTimer = null;
let lastFocused = null;
const escapeHtml = value => String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const icon = (name,extra='') => (window.HUB_ICONS[name]||window.HUB_ICONS['circle']).replace('class="icon"',`class="icon ${extra}"`);
const badge = (text,tone='') => `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
const channelMark = (channel,big=false) => `<span class="channel-mark ${channel}${big?' big':''}">${icon(channel==='wechat'?'brand-wechat':channel==='ding'?'brand-dingtalk':channel==='feishu'?'send':'archive',big?'large':'small')}</span>`;
const button = (text,action,tone='',attributes='')=>`<button class="button ${tone}" data-action="${action}" ${attributes}>${text}</button>`;
const now = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
const selectedCase = () => state.cases.find(item=>item.id===view.caseId)||state.cases[0];
const toneForStatus = status => status==='已解决'||status==='已发布'||status==='已通过'||status==='已复核'?'green':status.includes('待')||status==='等待专家'?'amber':status==='AI 处理中'?'teal':status==='历史资料'?'':'blue';
const persist = () => { try { window.ServiceJourney?.sync();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true; } catch { toast('浏览器存储不可用，本次状态仅在当前页面保留。',true);return false; } };
const audit = (text,caseId='') => {state.audit.unshift({time:now(),text,caseId});state.audit=state.audit.slice(0,100);persist();};
const canReply = item => item.owner!=='readonly' && state.channels.some(channel=>channel.id===item.channel&&channel.read&&channel.reply&&channel.status!=='已停用');
const canAgent = item => canReply(item)&&item.owner==='ai'&&state.agents[0].enabled&&state.agents[0].mode==='auto'&&!['已解决','关闭未解决','待人工接管'].includes(item.status)&&item.priority!=='高风险';
const composerDrafts = new Map();
function setComposerText(text){
  const input=document.getElementById('reply-input');
  if(!input||input.disabled)return false;
  input.value=text;
  if(!detectRisk(text)?.sensitive)composerDrafts.set(`${input.dataset.case}:${input.dataset.kind}`,text);
  else composerDrafts.delete(`${input.dataset.case}:${input.dataset.kind}`);
  input.focus();
  return true;
}

function toast(text,error=false){
  if(window.HubUI)return window.HubUI.feedback(text,error);
  clearTimeout(toastTimer);
  document.getElementById('toast-root').innerHTML=`<div class="toast${error?' error':''}">${icon(error?'alert-triangle':'circle-check')}<span>${escapeHtml(text)}</span></div>`;
  toastTimer=setTimeout(()=>{document.getElementById('toast-root').innerHTML='';},3600);
}

function sidebar(){
  if(window.PortfolioHub.isCollection(view.page))return '';
  const navProject=window.PortfolioHub.navProject();
  if(navProject.id!=='AFTERSALES')return window.ProjectStudio.sidebar();
  const daily=[['workspace','inbox'],['group','messages']];
  const design=[['agents','users'],['orbit','route'],['knowledge','book-2']];
    const navItems=items=>items.map(([page,symbol])=>{
    const count=page==='workspace'?state.cases.filter(item=>!['已解决','历史资料','关闭未解决'].includes(item.status)).length:page==='quality'?state.reviews.filter(item=>item.status==='待复核').length:null;
    const active=view.page===page||(page==='agents'&&['tickets','custom-assistant','quality'].includes(view.page))||(page==='group'&&['manager','project-assistant'].includes(view.page));
    const label=page==='customer'?'客户体验<small class="nav-mode-tag">模拟</small>':page==='workspace'?'客服工作台':page==='orbit'?'Orbit<small class="nav-subtitle">业务设计</small>':pageNames[page];

    return `<button class="nav-item${active?' active':''}" data-action="${page==='agents'?'assistant-directory':page==='orbit'?'studio-orbit':'navigate'}" data-page="${page}" aria-current="${active?'page':'false'}" title="${pageNames[page]}${page==='customer'?'（模拟咨询与自助处理）':''}" aria-label="${pageNames[page]}${page==='customer'?'（模拟）':''}">${icon(symbol)}<span class="nav-label">${label}</span>${count!==null?`<span class="nav-count">${count}</span>`:''}</button>`;
  }).join('');
  return `<aside class="sidebar" aria-label="主导航">${window.HubBrand.header()}${window.PortfolioHub.libraryNav()}<button class="workspace-switch" data-action="portfolio-switch" aria-label="切换项目，当前${escapeHtml(navProject.name)}">${window.HubIdentity.worker('manager','sm')}<span class="grow"><strong>${escapeHtml(navProject.name)}</strong><small>${escapeHtml(navProject.department)} · 项目空间</small></span>${icon('chevron-down','small')}</button><nav class="nav-section nav-work-section" aria-label="日常处理"><div class="nav-caption">日常处理</div>${navItems(daily)}</nav><nav class="nav-section nav-build-section" aria-label="业务能力"><div class="nav-caption">业务能力</div>${navItems(design)}</nav><nav class="nav-section nav-experience-section" aria-label="体验与验证"><div class="nav-caption">体验与验证</div>${navItems([['customer','eye']])}</nav><div class="sidebar-bottom"><div class="sidebar-environment">${icon('shield-check','small')}<span>本地演示 <small>未连接真实业务系统</small></span></div><button class="nav-item" data-action="guide" aria-label="使用说明">${icon('help')}<span class="nav-label">使用说明</span></button><button class="nav-item${view.page==='settings'?' active':''}" data-action="navigate" data-page="settings" aria-label="平台设置" aria-current="${view.page==='settings'?'page':'false'}">${icon('settings')}<span class="nav-label">项目设置</span></button><button class="profile" data-action="team-info" aria-label="查看演示管理员账号">${window.HubIdentity.avatar({entityType:'staff',identityTone:'blue'},{size:'sm'})}<span class="grow"><strong>演示管理员</strong><small>客服主管</small></span>${icon('chevron-down','small')}</button></div></aside>`;
}

function heading(title,subtitle,actions=''){
  return `<div class="page-heading"><div><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div><div class="heading-actions">${actions}</div></div>`;
}
function topbar(){ if(window.PortfolioHub?.isScope(view.page)||window.PortfolioHub.navProject()?.id!=='AFTERSALES')return window.PortfolioHub.topbar();
  return `<header class="topbar"><div class="row"><button class="icon-button mobile-menu" data-action="mobile-menu" aria-label="打开导航">${icon('menu-2')}</button><div class="breadcrumb"><span class="parent">${escapeHtml(window.PortfolioHub.navProject()?.name||'项目集')}</span>${icon('chevron-right','small')}<strong>${view.page==='manager'?'工作空间':(corePages.includes(view.page)?pageNames[view.page]:window.AssistantHub?.breadcrumb(view.page)||pageNames[view.page])}</strong></div></div><div class="topbar-right"><button class="ui-search-button" data-action="ui-navigator" aria-label="查找功能，快捷键 Command 或 Control K">${icon('search','small')}<span>查找功能</span><kbd>⌘ K</kbd></button><span class="demo-pill">交互演示 · 模拟数据</span><button class="icon-button" data-action="notifications" aria-label="通知与待办">${icon('bell')}</button><button class="ui-account" data-action="team-info" aria-label="查看账号">${window.HubIdentity.avatar({entityType:'staff',identityTone:'blue'},{size:'sm'})}</button></div></header>`;
}


function openNavigator(){
  if(window.PortfolioHub.isCollection(view.page)){document.getElementById('portfolio-search')?.focus();return;}
  if(window.PortfolioHub.navProject()?.id!=='AFTERSALES')return;
  const modules=corePages.map(page=>'<button data-action="'+(page==='agents'?'assistant-directory':'navigate')+'" data-page="'+page+'" data-ui-search="'+escapeHtml(pageNames[page])+'"><span>'+escapeHtml(pageNames[page])+'</span>'+icon('arrow-right','small')+'</button>').join('');
  const operations=button('业务助手 / 填单助手 / 工单记录','assistant-business','quiet small','data-page="tickets" data-ui-search="智能填单助手 工单记录 状态 回告"')+button('业务设计 · Orbit','studio-orbit','quiet small','data-ui-search="业务设计 Orbit 流程 定义"');
  showDialog('查找功能','查找服务、协作、业务设计和客户体验；实验功能可在项目设置中查看。',`<label class="search-field ui-nav-search">${icon('search')}<input id="ui-nav-search" aria-label="搜索功能名称" placeholder="搜索客服、工单、知识、业务设计…" autocomplete="off"></label><div class="ui-nav-results">${modules}${operations}</div><p id="ui-nav-empty" class="empty" hidden>没有匹配的功能，试试其他名称。</p>`,'','compact');
  document.getElementById('ui-nav-search')?.focus();
}

function render(){
  window.OrbitMap?.capture();
  window.OrbitBusiness?.capture();
  window.OntologyCatalog?.capture();
  window.OrbitDesigner?.capture();
  window.SuperAgentChat?.capture();
  const interfaceState=window.HubUI?.capture();
  window.CustomerChat?.capture();
  window.GroupChat?.capture();
  const active=document.activeElement;
  const savedFocus=active?.id==='case-search'?{id:active.id,start:active.selectionStart}:null;
  const pages={'project-assistant':()=>window.ProjectStudio.profilePage(),orbit:()=>window.ProjectStudio.orbitPage(),ontology:()=>window.ProjectStudio.ontologyPage(),'custom-assistant':()=>window.ProjectStudio.agentPage(),portfolios:()=>window.PortfolioHub.page(),portfolio:()=>window.PortfolioHub.page(),project:()=>window.PortfolioHub.page(),'portfolio-form':()=>window.PortfolioHub.page(),workspace:workspacePage,customer:()=>`<div class="agent-workspace">${window.ServiceJourney.page()}</div>`,manager:()=>window.ProjectHub.managerPage(),group:()=>window.ProjectHub.groupWorkspace(),graph:()=>window.AssistantHub.managed('graph',window.BusinessGraph.page()),reception:()=>window.AssistantHub.managed('reception',window.BusinessDesk.reception()),forms:()=>window.AssistantHub.managed('forms',window.BusinessDesk.forms()),scoring:()=>window.AssistantHub.managed('scoring',window.BusinessDesk.scoring()),channels:channelsPage,agents:agentsPage,dashboard:()=>window.AssistantHub.managed('dashboard',window.DashboardAssistant.page()),tickets:()=>window.AssistantHub.managed('tickets',ticketsPage()),quality:qualityPage,knowledge:knowledgePage,analytics:()=>window.AssistantHub.managed('analytics',analyticsPage()),settings:settingsPage};
  document.getElementById('app').innerHTML=`<div class="app-shell${window.PortfolioHub.isCollection(view.page)?' collection-shell':''}" data-current-page="${view.page}">${sidebar()}<div class="main-shell">${topbar()}<main class="page-content${view.page==='workspace'?' workspace':''}" data-page="${view.page}" id="main-content" tabindex="-1">${deferredNotice()}${pages[view.page]()}</main></div></div>`;
  const composerInput=document.getElementById('reply-input');
  if(composerInput){composerInput.dataset.case=view.caseId;composerInput.dataset.kind=view.composer;composerInput.value=composerDrafts.get(`${view.caseId}:${view.composer}`)||'';}
  if(savedFocus){const input=document.getElementById(savedFocus.id);input?.focus();input?.setSelectionRange(savedFocus.start,savedFocus.start);}
  if(['manager','group'].includes(view.page)&&!document.querySelector('[role=dialog]')){document.querySelector('.manager-compose textarea')?.focus({preventScroll:true});const stream=document.getElementById(view.page==='group'?'project-group-stream':'manager-messages');if(stream)stream.scrollTop=stream.scrollHeight;}
  document.title=`${pageNames[view.page]} · 连山`;
  window.HubMedia?.sync();
  window.OrbitOntology?.mount();
  window.OntologyCatalog?.mount();
  window.GroupChat?.mount();
  window.CustomerChat?.mount();
  window.SuperAgentChat?.mount();
  window.OrbitDesigner?.mount();
  window.OrbitBusiness?.mount();
  window.OrbitMap?.mount();
  window.SeatAssist?.typeahead(document.getElementById('reply-input'));
  window.HubUI?.mount(interfaceState,(window.PortfolioHub.navProject()?.id||'collection')+':'+view.page);
}

function workspacePage(){
  const item=selectedCase();
  const activeCases=state.cases.filter(entry=>!['已解决','历史资料','关闭未解决'].includes(entry.status));
  const waiting=activeCases.filter(entry=>entry.status==='待人工接管').length;
  return `<div class="seat-workspace-header"><div class="row"><h1>客服工作台</h1><span class="seat-workspace-count">${activeCases.length} 个进行中</span>${waiting?`<span class="seat-waiting-count">${waiting} 个待接管</span>`:''}</div><div class="row">${item.owner!=='readonly'?button('交给协作群','aw-from-case','small'):''}${item.handoff?button('查看客户视角','customer-preview','small','data-id="'+item.id+'"'):''}</div></div><div class="workbench${view.mobileCase?' mobile-conversation':''}${view.contextOpen?' show-context':''}"><section class="queue" aria-label="会话队列">${queuePanel()}</section><section class="conversation" aria-label="当前客户对话">${item.handoff?`<section class="journey-handoff-banner"><strong>自助服务转人工 · 已保留完整上下文</strong><details><summary>查看已知信息、已尝试操作与待解决项</summary><p>产品：${escapeHtml(item.handoff.knownFields.product)}（${escapeHtml(item.handoff.knownFields.productSource||"来源待核实")}） / 版本：${escapeHtml(item.handoff.knownFields.version)}</p><p>已尝试：${escapeHtml(item.handoff.attempted.join("；")||"尚未明确提供")}</p><p>待解决：${escapeHtml(item.handoff.unresolved)}</p><p>先阅读前序对话，不重复询问已知信息；客户表述仍需核实。</p></details></section>`:""}${conversationPanel(item)}</section><aside class="context" aria-label="客户与工单资料"><div class="context-mobile-head"><strong>客户资料</strong>${button(icon('x','small'),'toggle-context','quiet small','aria-label="关闭客户资料"')}</div>${contextPanel(item)}</aside></div>`;
}

function filteredCases(){
  return state.cases.filter(item=>(view.channel==='all'||item.channel===view.channel)&&(view.queue==='all'||view.queue==='mine'&&item.owner==='human'||view.queue==='unread'&&item.unread)&&(!view.search||`${item.name}${item.title}${item.id}${item.product}`.toLowerCase().includes(view.search.toLowerCase())));
}
function queuePanel(){
  const cases=filteredCases();
  return `<div class="queue-head"><div class="between"><div class="queue-title">统一收件箱 <span class="queue-number">${state.cases.length}</span></div><button class="icon-button" data-action="filter-info" aria-label="会话筛选说明">${icon('adjustments-horizontal','small')}</button></div><label class="search-field">${icon('search','small')}<input id="case-search" placeholder="搜索客户、问题或编号" aria-label="搜索会话" value="${escapeHtml(view.search)}"></label><div class="queue-tabs">${[['all','全部会话'],['mine','我的接待'],['unread','未读']].map(([key,title])=>`<button class="queue-tab${view.queue===key?' active':''}" data-action="queue-tab" data-value="${key}">${title}${key==='unread'?' '+state.cases.filter(item=>item.unread).length:''}</button>`).join('')}</div></div><div class="queue-tools"><select id="channel-filter" aria-label="筛选渠道"><option value="all">全部渠道</option>${[['wechat','微信客服'],['ding','钉钉'],['feishu','飞书'],['archive','历史存档']].map(([key,title])=>`<option value="${key}" ${view.channel===key?'selected':''}>${title}</option>`).join('')}</select><span>最近更新 ${icon('arrow-down','small')}</span></div><div class="case-list">${cases.length?cases.map(item=>`<button class="case-item${item.id===view.caseId?' selected':''}" data-action="select-case" data-id="${item.id}"><div class="case-top">${window.HubIdentity.avatar(item,{channel:true})}<div class="grow"><strong>${escapeHtml(item.name)}</strong><div class="case-identity-line"><span>${escapeHtml(window.HubIdentity.describe(item).label)}</span><i class="identity-separator" aria-hidden="true"></i><span>${escapeHtml(item.channelName)}</span></div></div><span class="case-time-group"><span class="case-time">${escapeHtml(item.time)}</span>${item.unread?'<span class="case-unread" role="img" aria-label="未读消息"></span>':''}</span></div><p class="case-preview">${escapeHtml(item.preview)}</p><div class="case-meta">${badge(item.status,toneForStatus(item.status))}${item.priority==='高风险'?badge('需关注','red'):''}<span class="case-id mono">${item.id}</span></div></button>`).join(''):`<div class="empty">${icon('search')}<h3>没有匹配的会话</h3><p>试试其他关键词或渠道。</p></div>`}</div><div class="queue-footer">仅展示已授权范围 · ${cases.length} 条演示会话</div>`;
}
function messageMarkup(message,item,messageIndex){
  const messageAnchor = `id="seat-message-${item.id}-${messageIndex}" tabindex="-1"`;
  if(message.role==='system')return `<div class="system-event seat-message-anchor" ${messageAnchor}>${icon('shield-check')}${escapeHtml(message.text)}</div>`;
  if(message.role==='internal')return `<div class="internal-note seat-message-anchor" ${messageAnchor}>${icon('lock','small')} 内部备注 · 仅团队可见<br>${escapeHtml(message.text)}</div>`;
  const isAgent=message.role==='agent';
  const sourceId=message.source?.includes('承诺')?'KB-0087':message.source?.includes('使用手册')||message.source?.includes('软件版本')?'KB-0101':'KB-0102';
  if(message.source?.includes('使用手册'))message={...message,source:'A1 软件版本信息查询 · V2.1'};
  return `<div class="chat-message ${message.role} seat-message-anchor" ${messageAnchor}>${isAgent?window.HubIdentity.worker('service','sm'):window.HubIdentity.avatar(message.role==='staff'?{entityType:'staff',identityTone:'blue'}:item,{size:'sm'})}<div class="message-content"><div class="message-author">${isAgent?'售后接待助手':message.role==='staff'?'演示客服':escapeHtml(item.name)}${isAgent?badge('AI','green'):''}<span>${message.time}</span></div><div class="message-body">${escapeHtml(message.text)}${message.source?`<button class="message-reference text-button" data-action="knowledge-detail" data-id="${sourceId}">${icon('book-2','small')}${escapeHtml(message.source)} ${icon('chevron-right','small')}</button>`:''}</div>${message.role!=='customer'?'<div class="message-status">'+icon('checks','small')+' 模拟消息</div>':''}</div></div>`;
}
function conversationActions(item){
  if(!canReply(item)||['已解决','关闭未解决'].includes(item.status))return '';
  const ticket=state.tickets.find(entry=>entry.caseId===item.id);
  const description=ticket?`${ticket.id} · ${ticket.status}`:item.priority==='高风险'?'换机申请待专员核实':item.status==='等待专家'?'已转专家，等待接单':'可根据当前对话填写工单';
  return `<div class="conversation-actions"><span>${escapeHtml(description)}</span><div class="row">${button(ticket?'查看工单':'助手填单',ticket?'ticket-detail':'create-draft','small',ticket?`data-id="${ticket.id}"`:'')}${item.status==='等待专家'?'':button('转给专家','assign','small')}</div></div>`;
}

function serviceReply(prompt,context={}){
  const hasKnowledge=identifier=>state.knowledge.some(entry=>entry.id===identifier&&entry.status==='已发布');
  if(/人工|投诉/.test(prompt))return {text:'可以，这个问题需要人工接着处理。',handoff:true};
  if(/更换|换机|退款|赔付/.test(prompt))return {text:'能否更换、是否收费，需要专员核实检测结果和服务政策，目前还不能确定。',handoff:true};
  if(context.ticket)return {text:`工单 ${context.ticket.id} 当前是“${context.ticket.status}”。`,source:''};
  if(context.status==='等待专家')return {text:'已给专家分派待办，还在等待接单，暂时没有新的处理结论。',source:''};
  const unsupportedProduct=/B2|C3/.test((context.product||'')+' '+prompt);
  const versionKnowledge=state.knowledge.find(entry=>entry.id==='KB-0101'&&entry.status==='已发布'&&entry.product==='座舱终端 A1'&&typeof entry.content==='string'&&entry.content.trim()&&!detectRisk(entry.content));
  if(!unsupportedProduct&&/在哪|哪里|怎么|查看/.test(prompt)&&/版本/.test(prompt)&&!/(升级|更新|最新|黑屏|断连|报修|换机)/.test(prompt)&&versionKnowledge){
    return {text:versionKnowledge.content.trim(),source:versionKnowledge.title+' · '+versionKnowledge.version};
  }
  if(!unsupportedProduct&&/黑屏|屏幕/.test(prompt)&&hasKnowledge('KB-0102')){
    return {text:context.softwareVersion&&context.softwareVersion!=='待确认'?'重启后还是黑屏，先请门店技术人员检查供电和连接，暂时不要拆机。如果仍未恢复，可以提交报修单。':'黑屏通常在什么时候出现，是启动时还是使用途中？如果现在看不到软件版本，可以先不填。',source:'A1 显示异常排查指南 · V3.2'};
  }
  return {text:'暂时没有适用的处理方案，需要技术同事进一步确认。',handoff:true};
}

function replyDraft(item){
  const ticket=state.tickets.find(entry=>entry.caseId===item.id);
  const prompt=item.messages.filter(message=>message.role==='customer').at(-1)?.text||item.title;
  if(item.priority==='高风险')return serviceReply('更换');
  if(!ticket&&/报修|报修单|整理.*单/.test(prompt))return {text:'可以，现有信息可以先填进报修草稿，核对后再提交。'};
  return serviceReply(prompt,{product:item.product,softwareVersion:item.version,ticket,status:item.status});
}

function openQuickReplies(){
  showDialog('常用回复','点击填入输入框，检查后再发送。',`<div class="quick-replies">${[['more','请再描述一下具体情况，我接着帮您看。'],['menu','您现在看到哪些菜单选项？'],['wait','还没有新的处理结果。'],['confirm','现在恢复正常了吗？']].map(([key,text])=>`<button class="quick-reply-option" data-action="use-quick-reply" data-value="${key}">${text}${icon('arrow-right','small')}</button>`).join('')}</div>`,'','compact');
}

function safeReply(risk){
  if(risk.sensitive)return '';
  if(risk.type==='危险操作建议')return '先不要拆机或尝试接线，请让专业技术人员检查。';
  return '能否更换、是否收费，需要专员核实检测结果和服务政策，目前还不能确定。';
}
function conversationPanel(item){
  const readonly=!canReply(item);
  const headAction=item.owner==='ai'?button(icon('user-check','small')+' 人工接管','takeover','',`data-id="${item.id}"`):item.owner==='human'?button(icon('robot','small')+' 恢复 AI','resume-ai','',`data-id="${item.id}"`):'';
  const ownerText=readonly?'只读历史资料或渠道停用，不可向原渠道回复':['已解决','关闭未解决'].includes(item.status)?'本次服务已结束 · 继续处理请先重新打开':item.status==='待人工接管'?'等待人工接待 · 自动回复已暂停':item.owner==='human'?'人工接待中 · 助手仅提供建议':!state.agents[0].enabled?'接待助手 已暂停 · 可人工接管':state.agents[0].mode!=='auto'?'Agent 为'+(state.agents[0].mode==='assist'?'辅助':'观察')+'模式 · 不自动发送':'助手接待中';
  return `<header class="conversation-head"><div class="row grow"><button class="icon-button case-back" data-action="back-queue" aria-label="返回会话列表">${icon('arrow-left')}</button>${window.HubIdentity.avatar(item,{size:'md'})}<div class="grow"><h2>${escapeHtml(item.name)}</h2><div class="subline">${channelMark(item.channel)}<span>${escapeHtml(item.origin)}</span></div></div></div><div class="row">${headAction}<button class="icon-button context-toggle" data-action="toggle-context" aria-label="查看客户资料" aria-expanded="${view.contextOpen}">${icon('user','small')}</button><button class="icon-button" data-action="resolve" title="记录服务结果" aria-label="记录服务结果" ${item.owner==='readonly'?'disabled':''}>${icon('circle-check')}</button><button class="icon-button" data-action="case-more" aria-label="更多会话操作">${icon('dots')}</button></div></header><div class="owner-strip${readonly?' archive':item.owner==='human'?' human':''}">${icon(readonly?'archive':item.owner==='human'?'user':'robot','small')}<span>${ownerText}</span>${readonly?'':`<button class="text-button" style="margin-left:auto;font-size:9px" data-action="agent-trace">执行记录 ${icon('chevron-right','small')}</button>`}</div>${window.SeatAssist.summaryPanel(item)}<div class="chat-messages" id="chat-messages"><div class="date-separator">${item.owner==='readonly'?'历史导入记录':'演示会话 · 11 月 7 日'}</div>${item.messages.map((message,index)=>messageMarkup(message,item,index)).join('')}${conversationActions(item)}</div><div class="composer"><div class="composer-tabs"><button class="composer-tab${view.composer==='reply'?' active':''}" data-action="composer-tab" data-value="reply">${item.owner==='ai'?'客服回复':'回复客户'}</button><button class="composer-tab${view.composer==='note'?' active':''}" data-action="composer-tab" data-value="note">内部备注</button></div>${window.SeatAssist.replyPanel(item)}<div id="seat-inline-phrases" aria-live="polite"></div><textarea id="reply-input" aria-label="回复内容" placeholder="${readonly?'此来源只读或已停用，无法发送消息':view.composer==='note'?'添加内部备注…':item.owner==='ai'?'先接管，再回复客户':'输入回复…'}" ${readonly?'disabled':''}></textarea><div class="composer-bottom"><div class="composer-tools"><button class="icon-button" data-action="attachment-info" aria-label="附件说明">${icon('paperclip')}</button><button class="icon-button" data-action="quick-reply" aria-label="常用回复">${icon('message-circle')}</button><button class="icon-button" data-action="insert-suggestion" aria-label="起草回复">${icon('file-text')}</button><button class="icon-button" data-action="risk-example" title="插入风险回复示例" aria-label="插入风险示例">${icon('shield-check')}</button></div><div class="composer-send"><span>${view.composer==='note'?'仅内部可见':'Ctrl / ⌘ + Enter'}</span>${button((view.composer==='note'?'保存备注':'发送')+' '+icon('send','small'),'send-message','primary small',readonly?'disabled':'')}</div></div></div><div class="composer-hint">${view.composer==='note'?'内部备注不会发给客户':'消息仅在本地演示 · 请勿输入真实客户信息'}</div>`;
}
function contextPanel(item){
  const ticket=state.tickets.find(entry=>entry.caseId===item.id);
  return `<div class="context-tabs"><button class="${view.context==='profile'?'active':''}" data-action="context-tab" data-value="profile">服务档案</button><button class="${view.context==='activity'?'active':''}" data-action="context-tab" data-value="activity">处理记录</button></div>${view.context==='activity'?`<div class="context-section"><h3>本次服务活动</h3><div class="progress-steps">${state.audit.filter(entry=>entry.caseId===item.id).map(entry=>`<div class="progress-step"><span class="step-icon">${icon('check','small')}</span>${escapeHtml(entry.text)}<p>${entry.time} · 本地模拟</p></div>`).join('')||'<p class="muted small-text">暂无新的操作记录</p>'}</div></div>`:`<div class="context-section"><h3>客户信息 ${icon('user')}</h3><div class="context-user">${window.HubIdentity.avatar(item,{size:'xl',channel:true})}<div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.organization)}</p><span class="context-identity-label">${escapeHtml(window.HubIdentity.describe(item).label)}</span></div></div><dl><div class="info-pair"><dt>身份状态</dt><dd>${badge(item.verified?'已验证 · 演示':'待验证',item.verified?'green':'amber')}</dd></div><div class="info-pair"><dt>客户类型</dt><dd>${escapeHtml(window.HubIdentity.describe(item).label)}</dd></div><div class="info-pair"><dt>关联范围</dt><dd>${escapeHtml(item.related)}</dd></div></dl><div class="tag-list">${item.tags.map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div></div><div class="context-section"><h3>问题摘要 ${icon('file-text')}</h3><dl><div class="info-pair"><dt>问题编号</dt><dd class="mono">${item.id}</dd></div><div class="info-pair"><dt>产品型号</dt><dd>${escapeHtml(item.product)}</dd></div><div class="info-pair"><dt>软件版本</dt><dd>${escapeHtml(item.version)}</dd></div><div class="info-pair"><dt>服务状态</dt><dd>${badge(item.status,toneForStatus(item.status))}</dd></div></dl><p style="font-size:10px;color:#85949e;line-height:1.8;margin-top:12px">${escapeHtml(item.title)}。已提供的信息会保留在工单中。</p></div><div class="context-section"><h3>参考知识 <button class="text-button" style="font-size:9px" data-action="navigate" data-page="knowledge">查看全部</button></h3>${state.knowledge.filter(entry=>entry.status==='已发布').slice(0,2).map(entry=>`<button class="source-card" data-action="knowledge-detail" data-id="${entry.id}">${window.HubIdentity.knowledge(entry,'sm')}<span class="source-copy"><strong>${escapeHtml(entry.title)}</strong><span class="sub">${entry.version} · 已审核 · ${entry.product}</span></span></button>`).join('')}</div><div class="context-section"><div class="context-action"><h4>${icon('clipboard-list','small')} ${ticket?'已关联工单':'工单'}</h4><p>${ticket?ticket.id+' · '+ticket.status:'工单填写助手会读取这段对话，自动填写并标出缺项。'}</p>${button(ticket?'查看工单 '+icon('arrow-right','small'):icon('file-text','small')+' 助手自动填单',ticket?'ticket-detail':'create-draft','soft wide',ticket?`data-id="${ticket.id}"`:item.owner==='readonly'?'disabled':'')}</div></div><div class="context-bottom">${icon('shield-lock')}<span>仅当前授权范围可见<br>不根据昵称自动合并身份</span></div>`}`;
}

function channelsPage(){
  return `${heading('渠道接入','管理消息接收、回复和历史记录权限。',`${button(icon('file-import','small')+' 历史样本导入','import-history')}${button(icon('plus','small')+' 添加渠道','add-channel','primary')}`)}<div class="notice">${icon('info-circle')}<span>尚未连接真实账号。正式接入前，需要分别确认服务入口和读写权限。</span></div><div class="grid-3">${state.channels.map(channel=>`<section class="channel-card${channel.status==='已停用'?' off':''}"><div class="channel-top">${channelMark(channel.id,true)}${badge(channel.status,channel.status==='正常'?'green':channel.status==='只读'?'amber':'')}</div><h2>${channel.name}</h2><p class="sub">${channel.kind} · ${channel.scope}</p><div class="capability">${[['接收消息',channel.read],['原渠道回复',channel.reply],['历史读取',channel.history],['附件处理',channel.media]].map(([text,supported])=>`<span class="${supported?'':'disabled'}">${icon(supported?'circle-check':'circle-x')}${text}</span>`).join('')}</div><p style="font-size:10px;line-height:1.8;color:#94a1a9;min-height:36px">${channel.note}</p><div class="channel-footer"><span><i class="dot" style="color:${channel.status==='已停用'?'#c0c7ca':'#8bad99'}"></i> ${channel.status==='已停用'?'已停止模拟同步':channel.delay+' · 演示延迟'}</span><button class="text-button" style="font-size:10px" data-action="channel-detail" data-id="${channel.id}">管理 ${icon('chevron-right','small')}</button></div></section>`).join('')}</div><section class="panel section-spacer"><div class="panel-title"><div><h2>历史归集记录</h2><p>历史记录默认只读，不触发回复，也不自动发布为知识。</p></div>${badge(state.imports.length+' 个演示批次')}</div><div class="table-wrap"><table><thead><tr><th>导入批次</th><th>来源名称</th><th>记录数量</th><th>状态与完整性</th><th>时间</th></tr></thead><tbody>${state.imports.map(batch=>`<tr><td class="mono">${batch.id}</td><td><strong>${batch.name}</strong></td><td>${batch.records} 条</td><td>${badge(batch.status,'amber')}</td><td>${batch.time}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function agentsPage(){if(window.PortfolioHub.navProject()?.id!=='AFTERSALES')return window.ProjectStudio.directory();return window.TraceHub.page(()=>window.ProjectHub.assistantsPage());}
function agentsOverviewPage(){
  const labels={auto:'自动接待',assist:'辅助坐席',observe:'观察检查'};
  const tasks=state.manager?.tasks||[];
  const enabled=state.agents.filter(agent=>agent.enabled).length;
  return `<div class="agents-overview">${heading('业务助手','管理助手的职责、策略与执行记录。',button('回复写法','reply-style')+button(icon('player-play','small')+' 测试接待回复','test-agent','primary',`data-id="service"`))}<section class="manager-entry"><div class="manager-entry-main"><span class="agent-feature-label">任务调度</span><h2>Agent 协作工作台</h2><p>分配接待、填单和质检任务，查看进度并核对结果。</p>${button('进入团队协作 '+icon('arrow-right','small'),'navigate','primary',`data-page="manager"`)}</div><div class="manager-entry-queue"><div class="between"><strong>当前任务</strong><span>本地演示</span></div><div class="agent-queue-counts">${[['待开始',tasks.filter(task=>task.status==='待开始').length],['执行中',tasks.filter(task=>['执行中','排队中'].includes(task.status)).length],['待确认',tasks.filter(task=>task.status==='待确认').length]].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><div class="agent-team-line">${state.agents.map(agent=>`<span>${window.HubIdentity.worker(agent.id,'xs')}${agent.name}</span>`).join('')}</div><small>任务记录与人工审核</small></div></section><section class="agent-directory"><div class="section-heading"><div><h2>业务助手 <span>${state.agents.length}</span></h2><p>${enabled} 个已启用，按各自策略运行。</p></div><span class="directory-caption">修改策略只影响后续模拟执行</span></div><div class="agent-directory-labels"><span>助手 / 职责</span><span>工作方式</span><span>操作</span></div>${state.agents.map(agent=>`<article class="agent-card"><div class="agent-identity">${window.HubIdentity.worker(agent.id,'lg')}<div><h2>${agent.name}<span class="agent-version">${agent.version}</span></h2><p>${agent.desc}</p>${window.HubModels.summary(agent)}<div class="tag-list">${agent.tags.map(tag=>`<span class="tag">${tag}</span>`).join('')}</div></div></div><div class="agent-mode"><span class="agent-state${agent.enabled?'':' paused'}"><i></i>${agent.enabled?labels[agent.mode]:'已暂停'}</span><button class="agent-toggle" data-action="toggle-agent" data-id="${agent.id}" aria-label="${agent.enabled?'暂停':'启用'}${agent.name}" aria-pressed="${agent.enabled}"><span class="status-switch${agent.enabled?'':' off'}"><span></span></span><span>${agent.enabled?'已启用':'已停用'}</span></button></div><div class="agent-bottom">${button('配置策略','configure-agent','small',`data-id="${agent.id}"`)}${button('试运行 '+icon('arrow-right','small'),'test-agent','soft small',`data-id="${agent.id}"`)}</div><details class="agent-metric-disclosure"><summary>查看调用与抽检示例</summary><div class="agent-metrics"><div><strong>${agent.runs}</strong><span>模拟调用</span></div><div><strong>${agent.accuracy}</strong><span>${agent.id==='quality'?'不等于准确率':'人工抽检 · 示例'}</span></div><div><strong>${agent.latency}</strong><span>模拟响应</span></div></div></details></article>`).join('')}</section><details class="rules-disclosure"><summary>${icon('shield-check','small')} 处理规则 <span>知识、人工接管与审批边界</span></summary><section class="panel"><div class="rule-list">${[['book-2','按知识库回答','引用已发布知识，适用版本不一致时转人工。'],['user-check','人工接管优先','接管后停止 AI 对外发送，仅保留辅助建议。'],['shield-check','发送前风险检查','未授权承诺、敏感信息和危险操作进入复核。'],['clipboard-list','建单前确认','工单草稿可自动生成，正式提交须人工确认。']].map(([symbol,title,description])=>`<div class="rule-item"><div class="rule-symbol">${icon(symbol)}</div><div><h3>${title}</h3><p>${description}</p></div></div>`).join('')}</div></section></details></div>`;
}

function ticketsPage(){
  const tickets=state.tickets.filter(ticket=>view.filter==='all'||ticket.status===view.filter);
  return `${heading('工单记录','查看报修、咨询和专家支持单。',button(icon('file-text','small')+' 选择会话填单','ticket-choose-case','primary'))}<div class="metrics-grid"><div class="metric-card"><div class="metric-name">演示工单</div><div class="metric-value">${state.tickets.length}</div><div class="metric-foot">本地创建，无真实业务写入</div></div><div class="metric-card"><div class="metric-name">处理中</div><div class="metric-value">${state.tickets.filter(ticket=>ticket.status!=='已完成').length}</div><div class="metric-foot">等待处理或检测结果</div></div><div class="metric-card"><div class="metric-name">已完成</div><div class="metric-value">${state.tickets.filter(ticket=>ticket.status==='已完成').length}</div><div class="metric-foot">工单完成不自动等于问题解决</div></div><div class="metric-card"><div class="metric-name">重复建单保护</div><div class="metric-value" style="font-size:24px">已开启</div><div class="metric-foot">按服务问题检查关联工单</div></div></div><div class="filters"><label class="search-field">${icon('search','small')}<input id="table-search" placeholder="搜索工单、客户或产品" aria-label="搜索工单"></label><select id="ticket-filter" aria-label="筛选工单状态"><option value="all">全部状态</option>${['已创建','技术检测中','已完成'].map(status=>`<option ${view.filter===status?'selected':''}>${status}</option>`).join('')}</select><span class="grow"></span>${badge('必填校验 + 人工确认','green')}</div><div class="table-wrap"><table id="searchable-table"><thead><tr><th>工单 / 关联问题</th><th>客户 / 产品</th><th>工单类型</th><th>优先级</th><th>处理状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${tickets.map(ticket=>`<tr><td><strong class="mono">${ticket.id}</strong><span class="sub">${ticket.caseId}</span></td><td><div class="ticket-customer-cell">${window.HubIdentity.avatar(state.cases.find(item=>item.id===ticket.caseId)||{name:ticket.customer},{size:'sm'})}<div><strong>${escapeHtml(ticket.customer)}</strong><span class="sub">${escapeHtml(ticket.product)}</span></div></div></td><td>${ticket.type}</td><td>${badge(ticket.priority,ticket.priority==='优先'?'amber':'')}</td><td>${badge(ticket.status,ticket.status==='已完成'?'green':'blue')}</td><td>${ticket.created}</td><td><button class="text-button" data-action="ticket-detail" data-id="${ticket.id}">查看详情 ${icon('chevron-right','small')}</button></td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">当前筛选下没有工单</div></td></tr>'}</tbody></table></div><div class="notice section-spacer">${icon('shield-check')}<span>自动填单只抽取明确提供的信息，未知字段保持待确认。退换件、赔付和责任判定不在自动审批范围。</span></div>`;
}
function qualityPage(){
  const reviews=state.reviews.filter(review=>view.filter==='all'||review.status===view.filter);
  return `${heading('发送风险复核','查看拦截记录，核实问题并记录处理意见。',button(icon('shield-check','small')+' 测试回复检查','risk-lab','primary'))}<div class="metrics-grid"><div class="metric-card"><div class="metric-name">质检记录</div><div class="metric-value">${state.reviews.length}</div><div class="metric-foot">本地演示任务</div></div><div class="metric-card"><div class="metric-name">待人工复核</div><div class="metric-value">${state.reviews.filter(review=>review.status==='待复核').length}</div><div class="metric-foot">待核实原因和原始回复</div></div><div class="metric-card"><div class="metric-name">高风险命中</div><div class="metric-value">${state.reviews.filter(review=>review.risk==='高风险').length}</div><div class="metric-foot">已阻断，待核实</div></div><div class="metric-card"><div class="metric-name">已复核</div><div class="metric-value">${state.reviews.filter(review=>review.status!=='待复核').length}</div><div class="metric-foot">已保存复核结论</div></div></div><div class="filters"><button class="button small ${view.filter==='all'?'soft':''}" data-action="quality-filter" data-value="all">全部记录</button><button class="button small ${view.filter==='待复核'?'soft':''}" data-action="quality-filter" data-value="待复核">待复核</button><span class="grow"></span><span class="muted small-text">只拦截经本平台发送的消息</span></div><div class="table-wrap"><table><thead><tr><th>风险事件</th><th>关联问题</th><th>风险级别</th><th>检查来源</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>${reviews.map(review=>`<tr><td><strong>${review.type}</strong><span class="sub mono">${review.id}</span></td><td class="mono">${review.caseId}</td><td>${badge(review.risk,review.risk==='高风险'?'red':review.risk==='中风险'?'amber':'green')}</td><td>规则 + 人工复核</td><td>${badge(review.status,toneForStatus(review.status))}</td><td>${review.time}</td><td><button class="text-button" data-action="review-detail" data-id="${review.id}">${review.status==='待复核'?'开始复核':'查看结果'} ${icon('chevron-right','small')}</button></td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">所有待复核事项已处理</div></td></tr>'}</tbody></table></div><details class="rules-disclosure"><summary>检查项目与统计口径</summary><div class="grid-2 section-spacer"><section class="panel"><div class="panel-title"><h2>检查项目</h2>${icon('list-check')}</div><div class="rule-list">${['事实与知识依据','产品 / 版本适用性','信息与字段完整性','敏感信息与越权','危险操作与承诺','实际处理结果'].map(title=>`<div class="row" style="font-size:11px;color:#7e938a">${icon('circle-check','small')}${title}</div>`).join('')}</div></section><section class="panel"><div class="panel-title"><h2>正确率统计</h2>${icon('target')}</div><p style="font-size:11px;line-height:1.9;color:#91a0a8">正确率按人工复核样本计算，样本量和适用版本见运营大盘。点赞、客户未回复或检索相似度不作为正确依据。</p>${button('查看质量指标 '+icon('arrow-right','small'),'navigate','soft small',`data-page="analytics" style="margin-top:17px"`)}</section></div></details>`;
}
function knowledgePage(){
  const knowledge=state.knowledge.filter(entry=>view.filter==='all'||entry.status===view.filter);
  return `<div class="knowledge-page">${heading('知识库','',button(icon('plus','small')+' 新建知识草稿','new-knowledge','primary'))}<div class="content-tabs">${[['all','全部知识'],['已发布','正式知识'],['待审核','待审核草稿']].map(([key,title])=>`<button class="${view.filter===key?'active':''}" data-action="knowledge-filter" data-value="${key}">${title}<span>${state.knowledge.filter(entry=>key==='all'||entry.status===key).length}</span></button>`).join('')}<button data-action="navigate" data-page="channels">历史资料</button></div><div class="knowledge-toolbar"><label class="search-field">${icon('search','small')}<input id="table-search" placeholder="搜索知识标题、产品、编号或负责人" aria-label="搜索知识"></label><span id="knowledge-result-count" aria-live="polite">${knowledge.length} 条知识</span></div><div class="knowledge-table-wrap"><table id="searchable-table" class="knowledge-table"><colgroup><col class="knowledge-main-col"><col class="knowledge-scope-col"><col class="knowledge-status-col"><col class="knowledge-action-col"></colgroup><thead><tr><th>知识标题与来源</th><th>适用范围</th><th>状态 / 负责人</th><th>操作</th></tr></thead><tbody>${knowledge.map(entry=>`<tr><td>${window.KnowledgeEditor.titleCell(entry)}</td><td data-label="适用范围"><strong>${escapeHtml(entry.product)}</strong><span class="sub">知识版本 ${escapeHtml(entry.version)}</span></td><td data-label="状态 / 负责人">${badge(entry.status,toneForStatus(entry.status))}<span class="sub">${escapeHtml(entry.owner)}</span></td><td class="knowledge-row-action"><button class="text-button" data-action="knowledge-detail" data-id="${escapeHtml(entry.id)}">${entry.status==='待审核'?'审核草稿':'查看知识'} ${icon('chevron-right','small')}</button></td></tr>`).join('')}</tbody></table><div id="knowledge-empty" class="knowledge-empty" ${knowledge.length?'hidden':''}>没有符合条件的知识，请调整搜索词或切换分类。</div></div><div class="knowledge-policy">${icon('shield-check','small')}<span>仅使用已发布且产品、版本匹配的知识；草稿和历史聊天不直接使用。</span></div><section class="knowledge-followup"><div><span class="knowledge-section-label">待补充方案</span><h2>B2 升级后蓝牙连接不稳定</h2><p>缺少对应版本的验证结果，待专家核实；不沿用旧方案。</p></div>${button('查看关联问题 '+icon('arrow-up-right','small'),'open-case','','data-id="CS-0107"')}</section></div>`;
}
function getMetrics(){return window.AnalyticsHub.snapshot().total;}
function analyticsPage(){return window.AnalyticsHub.page();}
function settingsPage(){
  return `${heading('项目设置','管理接入与数据；实验功能不影响日常服务。',button('渠道接入 '+icon('arrow-up-right','small'),'navigate','','data-page="channels"'))}<div class="grid-2"><section class="panel"><div class="panel-title"><h2>演示工作空间</h2>${icon('building','small')}</div><dl><div class="info-pair"><dt>空间名称</dt><dd>售后服务中心 · 演示</dd></div><div class="info-pair"><dt>当前角色</dt><dd>演示管理员</dd></div><div class="info-pair"><dt>数据保存</dt><dd>当前浏览器本地存储</dd></div><div class="info-pair"><dt>真实渠道 / 业务执行</dt><dd>未接入；模型可单独试连</dd></div><div class="info-pair"><dt>当前工单记录</dt><dd>${state.tickets.length} 条模拟数据</dd></div></dl></section><section class="panel"><div class="panel-title"><h2>安全演示策略</h2>${badge('默认开启','green')}</div><div class="toggle-row"><div><h3>敏感内容检查</h3><p>发送前阻断凭证、长号码和高风险承诺示例</p></div><input type="checkbox" checked disabled aria-label="敏感检查强制开启"></div><div class="toggle-row"><div><h3>操作记录</h3><p>保留接管、建单、质检和知识操作记录</p></div><input type="checkbox" checked disabled aria-label="操作记录强制开启"></div><div class="toggle-row"><div><h3>真实信息保护</h3><p>请勿在此演示中输入真实客户或账号资料</p></div>${icon('shield-lock')}</div></section></div>${deferredSettings()}<section class="panel section-spacer"><div class="panel-title"><div><h2>演示管理</h2><p>只重置售后项目的会话、工单与质检记录，不删除项目集和其他部门台账。</p></div>${button(icon('refresh','small')+' 重置演示数据','reset-confirm','danger')}</div><p style="font-size:11px;color:#8e9da6">正式产品仍需建设服务端鉴权、租户隔离、审计、数据删除策略、真实连接器以及业务接口，不应将此 Demo 直接接入生产。</p></section><div class="local-status">连山 · 本地业务演示 · 模型连接可独立测试 · 图标使用 Tabler Icons（MIT）</div>`;
}

function closeDialog(){
  window.KnowledgeEditor?.close();
  window.HubModels?.close();
  clearTimeout(importTimer);view.modal=null;
  document.getElementById('overlay-root').innerHTML='';
  document.getElementById('app').inert=false;
  lastFocused?.isConnected&&lastFocused.focus();
  window.SeatAssist?.sync();
}
function showDialog(title,subtitle,body,footer='',size=''){
  window.HubUI?.closeNavigation(false);
  if(!document.getElementById('overlay-root').children.length)lastFocused=document.activeElement;
  document.getElementById('app').inert=true;
  document.getElementById('overlay-root').innerHTML=`<div class="dialog-backdrop"><section class="dialog ${size}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><header class="dialog-head"><div><h2 id="dialog-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-action="close-dialog" aria-label="关闭弹窗">${icon('x')}</button></header><div class="dialog-content">${body}</div>${footer?`<footer class="dialog-footer">${footer}</footer>`:''}</section></div>`;
  document.querySelector('.dialog')?.focus();
}
const footerButtons=(primaryText,primaryAction,attrs='',hint='操作仅影响本地演示')=>`<span class="hint">${hint}</span><div class="row">${button('取消','close-dialog')}${button(primaryText,primaryAction,'primary',attrs)}</div>`;

function openGuide(){
  showDialog('如何使用连山','连小山在协作群里安排分工，业务助手处理具体工作；客服是第一个业务场景。',`<ol class="scope-guide"><li><strong>提出目标</strong><p>在业务协作群中描述目标，或从客服工作台携带当前会话进入。简单问题仍可直接处理。</p></li><li><strong>核对分工</strong><p>预览参与助手、前置步骤和交付内容，再发起本地任务。缺少能力时进入 Orbit 研发，不把未接入能力当作已完成。</p></li><li><strong>检查结果</strong><p>在同一个协作区查看任务、异常与来源。确认草稿后回到客服或工单页面，发送和建单仍需单独确认。</p></li><li><strong>扩展业务</strong><p>在业务助手中进入 Orbit，定义范围、字段和规则，完成案例验收后加入团队。知识库维护资料，不等于创建助手。</p></li></ol><div class="notice amber">真实模型业务调用、客户渠道和业务系统仍未接入，请只用脱敏示例。准备完成不等于客户问题解决。</div>`,button('从客服工作台开始','guide-path','','data-value="workspace"')+button('打开业务协作','guide-path','primary','data-value="group"'));
}

function openDraft(){return window.TicketAssistant.open(selectedCase().id);}

function openTicket(identifier){
  const ticket=state.tickets.find(entry=>entry.id===identifier);if(!ticket)return;
  view.modal={kind:'ticket',id:identifier};
  showDialog(`${ticket.id} · 工单详情`,'仅保存在本地，未提交真实业务系统。',`<div class="row" style="margin-bottom:18px">${badge(ticket.status,ticket.status==='已完成'?'green':'blue')}${badge(ticket.type)}${badge(ticket.priority)}</div><dl><div class="info-pair"><dt>关联问题</dt><dd>${ticket.caseId}</dd></div><div class="info-pair"><dt>客户 / 产品</dt><dd>${escapeHtml(ticket.customer)} · ${escapeHtml(ticket.product)}</dd></div><div class="info-pair"><dt>软件版本</dt><dd>${escapeHtml(ticket.version)}</dd></div><div class="info-pair"><dt>受理部门</dt><dd>${escapeHtml(ticket.department)}</dd></div><div class="info-pair"><dt>创建时间</dt><dd>${ticket.created}</dd></div><div class="info-pair"><dt>客户通知</dt><dd>${badge(ticket.notified&&ticket.lastNotifiedStatus===ticket.status?'当前状态已回告':'当前状态待回告',ticket.notified&&ticket.lastNotifiedStatus===ticket.status?'green':'amber')}</dd></div></dl>${ticket.preparedBy==='ticket'?`<div class="ticket-fill-receipt"><strong>工单填写助手已整理 · 客服已确认</strong><p>${escapeHtml(ticket.fillRuleVersion)} · 本地模拟回执，未写入 CRM / QMS</p>${button('查看填单记录','trace-open','quiet small',`data-id="${ticket.prepareTraceId}" data-owner="ticket"`)}${button('查看提交记录','trace-open','quiet small',`data-id="${ticket.traceId}" data-owner="ticket"`)}</div>`:''}<div class="quote">${escapeHtml(ticket.description)}</div><div class="field"><label for="ticket-status">更新模拟处理状态</label><select id="ticket-status">${['已创建','技术检测中','已完成'].map(status=>`<option ${ticket.status===status?'selected':''}>${status}</option>`).join('')}</select></div><p class="muted" style="font-size:10px;margin-top:15px">工单完成后，服务问题仍需单独记录结果证据。不会自动计入“已解决”。</p>`,`${button('返回会话','open-case','',`data-id="${ticket.caseId}"`)}<div class="row">${button('回告客户','notify-ticket','',`data-id="${ticket.id}"`)}${button('保存状态','save-ticket-status','primary',`data-id="${ticket.id}"`)}</div>`);
}

function detectRisk(text){
  if(/(?:api[_ -]?key|access[_ -]?token|password|密码)\s*[:=：]\s*\S{4,}|\bsk-[A-Za-z0-9_-]{12,}|-----BEGIN .*PRIVATE KEY-----|\b\d{11,19}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text))return {type:'疑似敏感信息',reason:'检测到疑似凭证、联系方式或长号码。已阻断且不保存原值，请移除真实信息。',sensitive:true};
  if(/(保证|承诺|一定|直接).{0,12}(免费|退款|更换|赔付)|免费.{0,6}(更换|换机)|全额退款/.test(text))return {type:'未经批准的服务承诺',reason:'涉及免费更换、退款或明确处理承诺，需要资格核实和有权审批人确认。'};
  if(/自行.{0,6}(拆|短接)|短接|带电拆/.test(text))return {type:'危险操作建议',reason:'检测到未经确认的拆修或危险操作，必须转交专业人员。'};
  return null;
}

function showBlocked(text,risk,caseId,lab=false){
  const safeText=risk.sensitive?'[疑似敏感内容已移除，未保存原值]':text;
  const identifier=`QC-${String(100+state.reviews.length).padStart(4,'0')}`;
  state.reviews.unshift({id:identifier,caseId,type:risk.type,risk:'高风险',status:'待复核',answer:safeText,reason:risk.reason,time:now()});
  state.reviews[0].traceId=window.TraceHub.record({caseId,title:'发送前检查：'+risk.type,agent:'quality',input:safeText,output:{allowSend:false,reason:risk.reason},status:'按预期完成',tool:'local.detectRisk',spanStatus:'已拦截',category:risk.type==='未经批准的服务承诺'?'未经批准的承诺':'表达或其他问题',fixture:risk.type==='未经批准的服务承诺'?{approved:false}:null,reviewId:identifier,summary:'本地规则阻止了发送，是否为上游缺陷需要人工复核。'});
  audit('发送前风险检查已阻断，进入人工复核',caseId);
  const rewrite=safeReply(risk);
  view.modal={kind:'blocked',id:identifier,rewrite};
  if(risk.sensitive){const input=document.getElementById('reply-input');if(input)input.value='';composerDrafts.delete(`${caseId}:${view.composer}`);}
  render();
  showDialog('回复未发送','请处理以下问题后再发送。',`<div class="row">${badge(risk.type,'red')}${badge('待人工复核','amber')}</div><div class="quote danger">${escapeHtml(safeText)}</div><p style="font-size:12px;line-height:1.9;color:#8e777a">${risk.reason}</p>${rewrite?`<div class="result-box"><strong>可参考的回复</strong>${escapeHtml(rewrite)}</div>`:'<div class="notice section-spacer">敏感内容已清除，请重新填写回复。</div>'}`,`${button('查看质检任务','review-detail','',`data-id="${identifier}"`)}${button(lab?'完成测试':rewrite?'填入回复框':'重新填写','safe-rewrite','primary',`data-lab="${lab}"`)}`);
}

function openReview(identifier){
  const review=state.reviews.find(entry=>entry.id===identifier);if(!review)return;
  view.modal={kind:'review',id:identifier};
  showDialog('人工复核 · '+review.id,'规则命中与人工最终结论分别保留。',`<div class="row">${badge(review.risk,review.risk==='高风险'?'red':'amber')}${badge(review.status,toneForStatus(review.status))}</div><div class="quote danger">${escapeHtml(review.answer)}</div><div class="field"><label>规则判断</label><p style="font-size:12px;line-height:1.9;color:#81929b">${review.reason}</p></div><div class="divider"></div><div class="field"><label for="review-result">人工复核结论</label><select id="review-result"><option>确认风险，保持拦截</option><option>判定误报，修正规则</option><option>已纠正，完成复核</option></select></div><div class="field" style="margin-top:15px"><label for="review-note">复核依据 *</label><textarea id="review-note" placeholder="说明判断依据，不输入真实敏感信息">${escapeHtml(review.reviewNote||'')}</textarea></div><div id="review-error" class="inline-error" role="alert"></div>`,`${button('查看原会话','open-case','',`data-id="${review.caseId}"`)}<div class="row">${button('查看执行追踪','trace-review-open','',`data-id="${identifier}"`)}${button('提交复核结果','save-review','primary',`data-id="${identifier}"`)}</div>`);
}

function openKnowledge(identifier){
  const entry=state.knowledge.find(record=>record.id===identifier);if(!entry)return;
  view.modal={kind:'knowledge',id:identifier};
  const pending=entry.status==='待审核';
  const approval=pending?`<div class="notice amber">这是待审核内容，尚未用于自动回答。请先核对来源、适用条件与处理步骤。</div><label class="check-label"><input id="knowledge-approve" type="checkbox"><span>我已核实内容与适用范围，确认以演示审核角色批准发布。</span></label>`:'';
  const actions=pending?button('编辑草稿','edit-knowledge','',`data-id="${escapeHtml(identifier)}"`)+button('审核并发布','publish-knowledge','primary',`data-id="${escapeHtml(identifier)}"`):entry.status==='已发布'?button('停用此版本','disable-knowledge','danger',`data-id="${escapeHtml(identifier)}"`):badge('版本已停用');
  showDialog(escapeHtml(entry.title),'知识内容与外观 · 仅当前浏览器保存',window.KnowledgeEditor.detail(entry)+approval+'<p class="knowledge-runtime-note">客户体验的模型对话可引用已发布且型号匹配的知识；版本适用性仍需核实。客服工作台和流程回归继续使用原有规则。</p>',button('关闭','close-dialog')+'<div class="row">'+actions+'</div>','knowledge-detail-dialog');
}

function openChannel(identifier){
  const channel=state.channels.find(entry=>entry.id===identifier);if(!channel)return;
  showDialog(channel.name+' · 接入管理','读取、回复和历史覆盖分别确认。此处不收集账号凭证。',`<div class="between"><div class="row">${channelMark(channel.id,true)}<div><h3>${channel.kind}</h3><p class="muted small-text">${channel.scope}</p></div></div>${badge(channel.status,channel.status==='正常'?'green':'amber')}</div><div class="divider"></div><dl><div class="info-pair"><dt>读取能力</dt><dd>${channel.read?'授权范围内模拟读取':'不支持'}</dd></div><div class="info-pair"><dt>回复能力</dt><dd>${channel.reply?'模拟原渠道回复':'只读，不可回复'}</dd></div><div class="info-pair"><dt>历史覆盖</dt><dd>${channel.history?'按授权验证，不承诺全量':'不提供历史全量回填'}</dd></div><div class="info-pair"><dt>数据处理</dt><dd>${channel.id==='archive'?'受限内容使用批准组件或专区':'Demo 中只保存模拟消息'}</dd></div></dl><div class="notice amber">${icon('info-circle')}<span>${channel.note}</span></div><div id="channel-test-result"></div>`,`${button(channel.status==='已停用'?'恢复模拟接入':'停用模拟接入','toggle-channel',channel.status==='已停用'?'soft':'danger',`data-id="${channel.id}"`)}${button('验证模拟连接','test-channel','primary',`data-id="${channel.id}"`)}`);
}

function openAgentConfig(identifier){
  return window.HubModels.open(identifier);
}

function openAgentTest(identifier){
  const agent=state.agents.find(entry=>entry.id===identifier);if(!agent)return;
  view.modal={kind:'test',id:identifier};
  showDialog('测试 · '+agent.name,'本地预设回复，不调用模型，不对客户发送。',`${identifier==='service'?`<div class="test-scenarios">${[['version','版本查询'],['fault','故障报修'],['replacement','换机申请'],['human','要求人工']].map(([key,title])=>button(title,'test-scenario','small',`data-value="${key}"`)).join('')}</div>`:''}<div class="field"><label for="test-prompt">测试输入</label><textarea id="test-prompt">${identifier==='quality'?'我们保证今天免费更换设备。':identifier==='ticket'?'座舱终端 A1，软件 V2.3.1，中控黑屏，重启无效，请帮我报修。':'座舱终端 A1 怎么查看软件版本？'}</textarea></div><div id="test-output"></div>`,footerButtons('运行测试','run-agent-test',`data-id="${identifier}"`));
}

function openImport(){
  showDialog('导入授权历史样本','只使用 Demo 内置样本，不读取或上传真实文件。',`<div class="notice">${icon('archive')}<span>历史资料只读，不向旧会话发送消息，不计入实时解决率。</span></div><div class="form-grid"><div class="field"><label for="import-channel">来源渠道</label><select id="import-channel"><option>授权历史样本</option><option>飞书历史会话样本</option><option>钉钉人工提供样本</option></select></div><div class="field"><label>导入样本</label><input value="12 条内置脱敏记录 · 1 条附件缺失" readonly></div></div><label class="check-label"><input id="import-consent" type="checkbox"><span>确认资料具备授权，了解历史内容不会自动成为正式知识。</span></label><div id="import-progress"></div>`,footerButtons('校验并导入样本','run-import'));
}

function openSimulate(){
  showDialog('模拟一条新的客户消息','选择入口和场景，观察消息进入工作台与 Agent 分流。',`<div class="form-grid"><div class="field"><label for="sim-channel">服务渠道</label><select id="sim-channel">${state.channels.filter(channel=>channel.reply).map(channel=>`<option value="${channel.id}" ${channel.status==='已停用'?'disabled':''}>${channel.name}${channel.status==='已停用'?' · 已停用':''}</option>`).join('')}</select></div><div class="field"><label for="sim-scenario">咨询场景</label><select id="sim-scenario"><option value="version">软件版本查询 · 低风险</option><option value="fault">设备故障 · 收集信息</option><option value="human">客户明确要求人工</option></select></div></div><div class="notice section-spacer" style="margin-bottom:0">${icon('info-circle')}<span>新消息与回复均为本地模拟。切换到人工接管时，尚未发送的 AI 回复会取消。</span></div>`,footerButtons('发送模拟消息','submit-simulate'));
}

function navigate(page){
  if(!pageNames[page])return;
  window.ProjectHub?.closeMention?.();closeDialog();view.page=window.PortfolioHub.route(page);view.filter='all';
  window.PortfolioHub.syncLocation(view.page);
  render();
}
function scrollChat(){requestAnimationFrame(()=>{const container=document.getElementById('chat-messages');if(container)container.scrollTop=container.scrollHeight;});}
function addMessage(item,role,text,source=''){
  item.messages.push({role,text,time:now(),...(source?{source}:{})});item.time=now();
  if(role!=='system'&&role!=='internal')item.preview=text;
  persist();
}

function submitTicket(){return window.TicketAssistant.submit();}

function sendMessage(){
  const item=selectedCase();const input=document.getElementById('reply-input');const text=input?.value.trim();
  if(!text)return toast('请先输入回复或备注。',true);
  if(!canReply(item))return toast('当前来源只读或已停用，无法发送。',true);
  if(view.composer==='reply'&&item.owner!=='human')return toast('请先点击“人工接管”，再发送客服回复。',true);
  if(['已解决','关闭未解决'].includes(item.status))return toast('问题已结束，请通过“重新打开”后继续接待。',true);
  const risk=detectRisk(text);
  if(risk&&(view.composer==='reply'||risk.sensitive))return showBlocked(text,risk,item.id);
  addMessage(item,view.composer==='note'?'internal':'staff',text);
  composerDrafts.delete(`${item.id}:${view.composer}`);
  if(view.composer==='reply')item.status='等待客户';
  audit(view.composer==='note'?'保存内部备注，未对客户发送':'人工回复已通过演示风险检查',item.id);
  render();scrollChat();toast(view.composer==='note'?'内部备注已保存，仅团队可见。':'回复已模拟发送。');
}

function simulateIncoming(){
  const channelId=document.getElementById('sim-channel').value;const scenario=document.getElementById('sim-scenario').value;
  const channel=state.channels.find(entry=>entry.id===channelId);if(!channel||channel.status==='已停用')return toast('请选择一个正常的模拟渠道。',true);
  const identifier=`CS-${String(Math.max(...state.cases.map(item=>Number(item.id.split('-')[1])))+1).padStart(4,'0')}`;
  const texts={version:'你好，座舱终端 A1 应该在哪里查看软件版本？',fault:'座舱终端 A1 的屏幕偶发黑屏，目前不知道软件版本，需要帮忙。',human:'我需要人工客服跟进，不想再自动问答了。'};
  const item={id:identifier,name:'模拟顾问 '+String(state.cases.length+1),organization:'演示服务门店',initial:'新',entityType:'store',channel:channelId,channelName:channel.name,origin:channel.kind+' · 模拟',title:texts[scenario],preview:texts[scenario],time:now(),status:scenario==='human'?'待人工接管':'AI 处理中',owner:'ai',priority:scenario==='human'?'优先':'普通',product:'座舱终端 A1',version:'待确认',model:'A1 标准版',tags:['新咨询','演示样本'],verified:true,unread:true,related:'仅本次模拟会话',messages:[{role:'customer',text:texts[scenario],time:now()}]};
  state.cases.unshift(item);view.caseId=identifier;view.channel='all';view.queue='all';view.search='';view.mobileCase=true;
  audit(channel.name+' 新消息进入统一收件箱',identifier);navigate('workspace');toast('已收到来自'+channel.name+'的模拟消息。');
  if(scenario==='human'){window.TraceHub.record({caseId:identifier,title:'客户要求人工',input:texts[scenario],output:{route:'人工队列',automaticReply:false},status:'待人工',tool:'local.route',summary:'客户明确要求人工，未继续问诊。'});addMessage(item,'system','客户要求人工，已进入人工待接管队列，AI 不继续问诊');render();scrollChat();return;}
  const captured=state;
  setTimeout(()=>{
    if(state!==captured)return;if(!canAgent(item)){window.TraceHub.record({caseId:identifier,title:'自动回复取消',input:texts[scenario],output:{sent:false,owner:item.owner},status:'已取消',tool:'local.ownership_check',summary:'人工接管、模式调整或渠道停用后，不再执行延迟回复。'});return;}const began=performance.now();
    const knowledge=state.knowledge.find(entry=>entry.id===(scenario==='version'?'KB-0101':'KB-0102')&&entry.status==='已发布');
    if(!knowledge){item.status='待人工接管';addMessage(item,'system','没有可用的已发布知识，转交人工，未自动回答');}
    else {const response=serviceReply(texts[scenario],{product:item.product,softwareVersion:item.version});addMessage(item,'agent',response.text,response.source);}
    window.TraceHub.record({caseId:identifier,title:'接待模拟消息',agent:'service',input:texts[scenario],output:item.messages.at(-1).text,source:knowledge?knowledge.title+' · '+knowledge.version:'',status:knowledge?'按预期完成':'待人工',durationMs:performance.now()-began,tool:'local.serviceReply',summary:knowledge?'按本地已发布知识生成预设回复。':'没有可用的已发布知识，未自动回答。'});audit('完成本地模拟检索与接待',identifier);if(view.page==='agents'&&!view.modal)render();
    if(view.page==='workspace'&&!view.modal){render();scrollChat();}
  },900);
}

function dispatch(action,element){
  if(action==='assistant-directory'&&window.PortfolioHub.navProject()?.id!=='AFTERSALES')return navigate('agents');
  if(action.startsWith('model-'))return window.HubModels.dispatch(action.slice(6),element);
  if(action.startsWith('assistant-'))return window.AssistantHub.dispatch(action.slice(10),element);
  if(action.startsWith('reporter-'))return window.DashboardAssistant.dispatch(action.slice(9),element);
  if(action.startsWith('analytics-'))return window.AnalyticsHub.dispatch(action.slice(10),element);
  if(action.startsWith('portfolio-'))return window.PortfolioHub.dispatch(action.slice(10),element);if(action.startsWith('insight-'))return window.ProblemInsights?.dispatch(action.slice(8),element);
  if(action.startsWith('manager-'))return window.ManagerHub.dispatch(action.slice(8),element);
  if(action.startsWith('trace-'))return window.TraceHub.dispatch(action.slice(6),element);
  if(action.startsWith('seat-'))return window.SeatAssist.dispatch(action.slice(5),element);
  const identifier=element.dataset.id;const value=element.dataset.value;const item=selectedCase();
  switch(action){
    case 'ui-navigator':return openNavigator();
    case 'customer-preview':return window.ServiceJourney.open(identifier);

    case 'navigate':return navigate(element.dataset.page);
    case 'mobile-menu':return window.HubUI?.toggleNavigation();
    case 'close-dialog':return closeDialog();
    case 'guide':return openGuide();
    case 'guide-path':
      closeDialog();if(value==='draft'){navigate('workspace');view.caseId='CS-0108';render();return openDraft();}return navigate(value);
    case 'select-case':view.caseId=identifier;view.mobileCase=true;state.cases.find(entry=>entry.id===identifier).unread=false;persist();return render();
    case 'open-case':
      if(!state.cases.some(entry=>entry.id===identifier))return toast('此任务没有关联的可见会话。',true);
      view.caseId=identifier;view.mobileCase=true;view.queue='all';view.channel='all';view.search='';return navigate('workspace');
    case 'back-queue':view.mobileCase=false;return render();
    case 'queue-tab':view.queue=value;return render();
    case 'context-tab':view.context=value;return render();
    case 'toggle-context':view.contextOpen=!view.contextOpen;return render();
    case 'composer-tab':view.composer=value;return render();
    case 'takeover':
      if(!canReply(item))return toast('当前渠道不可回复，请检查接入状态。',true);
      if(item.status==='已解决')return toast('请先重新打开已结束的问题。',true);
      item.owner='human';item.status='人工处理中';addMessage(item,'system','演示客服已接管 · AI 已停止对外发送');audit('人工接管，取消后续 AI 自动回复',item.id);render();scrollChat();return toast('已接管，自动回复已暂停。');
    case 'resume-ai':
      if(!state.agents[0].enabled||state.agents[0].mode!=='auto')return toast('请先将接待助手 启用并设为自动接待模式。',true);
      if(!canReply(item))return toast('当前来源不可回复。',true);
      return showDialog('确认恢复 AI 接待','恢复后，后续模拟客户咨询可由 Agent 自动响应。',`<div class="notice amber">${icon('info-circle')}<span>仅对低风险、已发布知识覆盖范围开放。已有工单与人工操作不会被撤销。</span></div>`,footerButtons('确认恢复','confirm-resume'));
    case 'confirm-resume':
      if(item.priority==='高风险')return toast('高风险问题必须继续由人工处理。',true);
      item.owner='ai';item.status='AI 处理中';audit('客服显式恢复 AI 接待',item.id);closeDialog();render();return toast('后续消息已恢复 AI 接待。');
    case 'send-message':return sendMessage();
    case 'quick-reply':return window.SeatAssist.dispatch('tab',{dataset:{value:'phrases'}});
    case 'use-quick-reply':{
      const replies={more:'请再描述一下具体情况，我接着帮您看。',menu:'您现在看到哪些菜单选项？',wait:'还没有新的处理结果。',confirm:'现在恢复正常了吗？'};
      closeDialog();if(replies[value])window.SeatAssist.externalInsert(replies[value]);return;}
    case 'insert-suggestion':{
      const input=document.getElementById('reply-input');if(!input||input.disabled)return toast('此来源无法回复。',true);
      if(view.composer==='note')return toast('请切换到“回复客户”后起草。',true);
      const suggestion=window.SeatAssist.suggestions(item)[0];if(!suggestion)return toast('当前会话没有可用的对客建议。',true);
      return window.SeatAssist.externalInsert(suggestion.text,suggestion.source);}
    case 'risk-example':{
      const input=document.getElementById('reply-input');if(!input||input.disabled)return;
      setComposerText('我们保证今天免费更换设备。');return toast('已插入风险示例。接管后点击发送，可体验拦截。');}
    case 'safe-rewrite':{
      const isLab=element.dataset.lab==='true';const rewrite=view.modal?.rewrite||'';
      closeDialog();if(isLab)return toast('测试结束，消息未发送。');
      setComposerText(rewrite);return toast(rewrite?'已填入回复框，请核实后发送。':'请重新填写回复。');}
    case 'ticket-choose-case':return window.TicketAssistant.chooseCase();
    case 'create-draft':return openDraft();
    case 'submit-ticket':return submitTicket();
    case 'ticket-detail':return openTicket(identifier);
    case 'save-ticket-status':{
      const ticket=state.tickets.find(entry=>entry.id===identifier);ticket.status=document.getElementById('ticket-status').value;
      audit('更新模拟工单状态：'+ticket.status,ticket.caseId);render();openTicket(identifier);return toast('状态已保存，服务结果需要单独确认。');}
    case 'notify-ticket':{
      const ticket=state.tickets.find(entry=>entry.id===identifier);const linked=state.cases.find(entry=>entry.id===ticket.caseId);
      if(!linked||!canReply(linked))return toast('当前渠道不可回告，工单保持已创建。',true);
      if(ticket.notified&&ticket.lastNotifiedStatus===ticket.status)return toast('该状态已经回告，无需重复发送。');
      linked.owner='human';addMessage(linked,'staff',`工单 ${ticket.id} 当前是“${ticket.status}”。`);ticket.notified=true;ticket.lastNotifiedStatus=ticket.status;audit('工单状态已模拟回告客户',ticket.caseId);render();openTicket(identifier);return toast('已模拟回告，不重复创建工单。');}
    case 'simulate-message':return openSimulate();
    case 'submit-simulate':return simulateIncoming();
    case 'resolve':
      return showDialog('记录服务结果','关闭对话不等于解决问题，请保留结果依据。',`<div class="field"><label for="case-result">服务结果</label><select id="case-result"><option value="已解决">已解决 · 有证据</option><option value="待结果确认">待结果确认 · 不计为解决</option><option value="关闭未解决">关闭未解决 · 保留原因</option></select></div><div class="field" style="margin-top:17px"><label for="case-evidence">结果证据或原因 *</label><textarea id="case-evidence" placeholder="例如：用户确认功能恢复；或仍需等待专家结论。">${escapeHtml(item.evidence||'')}</textarea></div><div id="result-error" class="inline-error" role="alert"></div>`,footerButtons('保存结果','save-result'));
    case 'save-result':{
      const evidence=document.getElementById('case-evidence').value.trim();if(evidence.length<4)return document.getElementById('result-error').textContent='请填写可复核的结果依据或关闭原因。';
      if(detectRisk(evidence)?.sensitive)return document.getElementById('result-error').textContent='请移除真实敏感信息。';
      item.status=document.getElementById('case-result').value;item.evidence=evidence;addMessage(item,'system','服务结果：'+item.status+' · '+evidence);audit('保存服务结果与证据：'+item.status,item.id);closeDialog();render();return toast('处理结果已保存。');}
    case 'case-more':
      return showDialog('会话操作',item.id+' · '+item.name,`<div class="stack">${button(icon('clipboard-list','small')+' 助手自动填单','create-draft','wide')}${button(icon('users','small')+' 邀请专家协同','assign','wide')}${button(icon('circle-check','small')+' 记录服务结果','resolve','wide')}${button(icon('refresh','small')+' 重新打开问题','reopen-case','wide')}</div>`,'','compact');
    case 'reopen-case':
      if(item.owner==='readonly')return toast('历史资料不能重新打开为实时问题。',true);
      item.status='人工处理中';item.owner='human';item.evidence='';audit('人工重新打开问题',item.id);closeDialog();render();return toast('问题已重新打开，由人工接待。');
    case 'assign':
      return showDialog('转给专家','对话摘要随任务同步，内部讨论不对客户可见。',`<div class="field"><label for="expert-team">选择领域专家</label><select id="expert-team"><option>显示领域专家</option><option>软件领域专家</option><option>服务政策专员</option></select></div><div class="quote">${escapeHtml(item.product+' · '+item.version+'\n'+item.title)}</div><div class="notice" style="margin-bottom:0">${icon('lock')}<span>此处只创建内部模拟待办，不代表专家已接单。</span></div>`,footerButtons('创建专家待办','confirm-assign'));
    case 'confirm-assign':{
      if(item.owner==='readonly')return toast('历史记录不直接创建实时协同任务。',true);
      const expert=document.getElementById('expert-team').value;item.owner='human';item.status='等待专家';addMessage(item,'internal','已向'+expert+'创建专家待办，等待接单。');audit('分派给'+expert+'，尚未接单',item.id);closeDialog();render();scrollChat();return toast('专家待办已创建，等待接单。');}
    case 'risk-lab':
      return showDialog('测试回复检查','本地规则示例，不向任何渠道发送。',`<div class="field"><label for="risk-input">待发送内容</label><textarea id="risk-input">我们保证今天免费更换设备。</textarea></div><p class="muted" style="font-size:10px;margin-top:15px">请使用模拟文本，不要输入真实凭证、电话号码或客户信息。</p><div id="risk-result"></div>`,footerButtons('执行风险检查','run-risk-test'));
    case 'run-risk-test':{
      const input=document.getElementById('risk-input').value.trim();if(!input)return toast('请填写测试文本。',true);
      const risk=detectRisk(input);if(risk)return showBlocked(input,risk,item.id,true);
      document.getElementById('risk-result').innerHTML=`<div class="result-box"><strong>本地演示规则未命中</strong>这不等于内容绝对安全，正式系统仍需业务规则和人工复核。</div>`;return;}
    case 'review-detail':return openReview(identifier);
    case 'quality-filter':view.filter=value;return render();
    case 'save-review':{
      const note=document.getElementById('review-note').value.trim();if(note.length<4)return document.getElementById('review-error').textContent='请填写复核依据。';
      if(detectRisk(note)?.sensitive)return document.getElementById('review-error').textContent='请移除敏感信息后保存。';
      const review=state.reviews.find(entry=>entry.id===identifier);review.result=document.getElementById('review-result').value;review.status=review.result.startsWith('判定误报')?'已标记误报':'已复核';review.reviewNote=note;audit('质检复核完成：'+review.type,review.caseId);closeDialog();render();return toast('复核结论已记录，不会自动补发被拦截消息。');}
    case 'knowledge-filter':view.filter=value;return render();
    case 'knowledge-detail':return openKnowledge(identifier);
    case 'publish-knowledge':return window.KnowledgeEditor.setStatus(identifier,'已发布');
    case 'disable-knowledge':return window.KnowledgeEditor.setStatus(identifier,'已停用');
    case 'new-knowledge':return window.KnowledgeEditor.open();
    case 'edit-knowledge':return window.KnowledgeEditor.open(identifier);
    case 'knowledge-icon':return window.KnowledgeEditor.choose('art',value);
    case 'knowledge-tone':return window.KnowledgeEditor.choose('tone',value);
    case 'save-knowledge':return window.KnowledgeEditor.save();
    case 'add-channel':
      return showDialog('选择一种接入方式','Demo 不执行真实授权，也不需要你填写任何密钥。',`<div class="guide-grid">${state.channels.map(channel=>`<button class="guide-card" data-action="channel-detail" data-id="${channel.id}">${channelMark(channel.id,true)}<strong>${channel.name}</strong><p>${channel.kind} · ${channel.reply?'可验证双向接待':'只读或受限联邦'}</p></button>`).join('')}</div><div class="notice amber" style="margin-bottom:0">${icon('alert-triangle')}<span>个人微信任意群、钉钉全员私聊与未授权飞书群，不在已验证可接入范围。</span></div>`);
    case 'channel-detail':return openChannel(identifier);
    case 'toggle-channel':{
      const channel=state.channels.find(entry=>entry.id===identifier);channel.status=channel.status==='已停用'?(channel.reply?'正常':'只读'):'已停用';audit(channel.name+' 模拟接入状态改为'+channel.status);render();openChannel(identifier);return toast('接入状态已更新，会同步限制后续模拟收发。');}
    case 'test-channel':{
      const channel=state.channels.find(entry=>entry.id===identifier);document.getElementById('channel-test-result').innerHTML=`<div class="result-box${channel.status==='已停用'?' error':''}"><strong>${channel.status==='已停用'?'连接器已停用':'模拟验证完成'}</strong>${channel.status==='已停用'?'请先恢复接入再测试。':channel.reply?'模拟读取、发送与权限状态校验通过，未连接官方服务。':'只读边界校验通过；发送能力不开放。'}</div>`;return;}
    case 'import-history':return openImport();
    case 'run-import':{
      if(!document.getElementById('import-consent').checked)return toast('请先确认导入权限和用途。',true);
      const source=document.getElementById('import-channel').value;element.disabled=true;element.textContent='正在校验…';
      document.getElementById('import-progress').innerHTML=`<div class="result-box"><strong>正在验证内置模拟样本</strong>检查重复、格式、来源与附件完整性…</div>`;
      importTimer=setTimeout(()=>{
        if(!document.getElementById('import-progress'))return;
        const batchId='BATCH-'+String(state.imports.length+1).padStart(3,'0');state.imports.unshift({id:batchId,name:source,records:12,status:'只读 · 1 条附件缺失',time:'11-07 '+now()});
        const record=structuredClone(caseSeed[5]);record.id='CS-'+String(Math.max(...state.cases.map(entry=>Number(entry.id.split('-')[1])))+1).padStart(4,'0');record.name='历史样本 '+state.imports.length;record.origin=batchId+' · 只读';record.title=source+'导入记录';record.time=now();state.cases.push(record);
        audit('历史样本已归集，缺失附件已标记',record.id);render();showDialog('历史样本已归集','12 条内置样本，1 条附件缺失，均保持只读。',`<div class="result-box"><strong>没有触发任何历史回复</strong>批次 ${batchId} 已写入导入台账，收件箱新增一条只读样本。内容不会自动发布到正式知识库。</div>`,`${button('关闭','close-dialog')}${button('查看只读样本','open-case','primary',`data-id="${record.id}"`)}`);
      },700);return;}
    case 'configure-agent':return openAgentConfig(identifier);
    case 'toggle-agent':{
      const agent=state.agents.find(entry=>entry.id===identifier);agent.enabled=!agent.enabled;audit(agent.name+(agent.enabled?'已启用':'已暂停'));render();return toast(agent.name+(agent.enabled?'已启用。':'已暂停，人工服务不受影响。'));}
    case 'save-agent-config':{
      const agent=state.agents.find(entry=>entry.id===identifier);agent.mode=document.querySelector('input[name="agent-mode"]:checked').value;audit(agent.name+' 策略已保存');closeDialog();render();return toast('策略已保存，将影响后续模拟执行。');}
    case 'test-agent':if(identifier==='analytics')return navigate('dashboard');if(identifier==='ticket')return openDraft();if(identifier==='quality')return navigate('scoring');return window.ServiceJourney.open();
    case 'reply-style':
      return showDialog('回复写法','用于本版示例回复；真实模型尚未接入。',`<ul class="writing-rules"><li>先回答客户的问题，不先介绍自己能做什么。</li><li>客户已经提供的型号、版本和操作，不重复询问。</li><li>需要补充信息时，问当前最需要确认的一两项。</li><li>按实际状态说话：待创建、已创建、待接单，不混用。</li><li>没有依据就说明需要核实，不编造处理结果或承诺。</li><li>保留 AI 标识，不假装是真人客服。</li></ul><div class="copy-example"><span>报修</span><p>可以，现有信息可以先填进报修草稿，核对后再提交。</p></div><div class="copy-example"><span>等待专家</span><p>已给专家分派待办，还在等待接单，暂时没有新的处理结论。</p></div>`,button('关闭','close-dialog'));
    case 'test-scenario':{
      const prompts={version:'座舱终端 A1 怎么查看软件版本？',fault:'座舱终端 A1 黑屏了，现在看不到软件版本。',replacement:'能不能今天直接换机？',human:'我想找人工客服。'};
      document.getElementById('test-prompt').value=prompts[value];document.getElementById('test-output').innerHTML='';return;}
    case 'run-agent-test':{
      const began=performance.now();const agent=state.agents.find(entry=>entry.id===identifier);const prompt=document.getElementById('test-prompt').value.trim();if(!prompt)return toast('请填写测试输入。',true);
      if(detectRisk(prompt)?.sensitive){document.getElementById('test-prompt').value='';return toast('输入包含疑似敏感信息，已清空，不保存原值。',true);}
      let result='';let error=false;let source='';let handoff=false;
      if(!agent.enabled){result='Agent 已暂停。本次不执行，请先启用。';error=true;}
      else if(identifier==='quality'){const risk=detectRisk(prompt);result=risk?'命中：'+risk.type+'。'+risk.reason:'本地演示规则未命中；仍需人工复核，不能据此宣称内容绝对安全。';error=!!risk;}
      else if(identifier==='ticket')result='已识别模拟产品、版本与故障描述。下一步生成草稿，由客服核实必填字段并确认提交。测试模式不创建工单。';
      else {const response=serviceReply(prompt);result=response.text;source=response.source||'';handoff=!!response.handoff;}
      const traceId=window.TraceHub.record({title:agent.name+' · 本地测试',agent:identifier,input:prompt,output:{text:result,handoff,source},source,status:error?'待人工':handoff?'待人工':'按预期完成',tool:identifier==='quality'?'local.detectRisk':identifier==='ticket'?'local.ticket.preview':'local.serviceReply',durationMs:performance.now()-began,summary:'记录本次本地测试的实际输入和输出；未执行真实工具或对外发送。'});document.getElementById('test-output').innerHTML=`<div class="result-box${error?' error':''}"><strong>${error?'检查结果':identifier==='service'?'回复预览':'测试结果'}</strong><div class="reply-preview">${escapeHtml(result)}</div>${source?`<div class="test-source">参考：${escapeHtml(source)}</div>`:''}${handoff?'<div class="test-source">处理方式：转人工（仅预览，未创建待办）</div>':''}<div class="test-source">${agent.version} · 本地模拟 · 未发送</div>${button('查看本次追踪','trace-open','small',`data-id="${traceId}" style="margin-top:12px"`)}</div>`;audit(agent.name+' 完成一次本地试运行');return;}
    case 'agent-trace':return window.TraceHub.openCase(item.id);
    case 'notifications':
      return showDialog('通知与操作记录','本地演示中的接管、工单、质检和知识活动。',`<div class="progress-steps">${state.audit.slice(0,18).map(entry=>`<div class="progress-step"><span class="step-icon">${icon('check','small')}</span>${escapeHtml(entry.text)}<p>${entry.time} ${entry.caseId?' · '+entry.caseId:''}</p></div>`).join('')}</div>`);
    case 'metric-definition':
      return showDialog(element.dataset.name+' · 指标口径','所有数字均为演示样本，不能解释为客户实际成绩。',`<div class="stack"><p style="font-size:12px;line-height:1.9;color:#7d919b">${({'有效服务问题':'按独立服务诉求去重，排除测试、垃圾与明确非服务内容；只统计授权实时范围。','确认解决率':'有用户、人工或批准的客观业务结果证据的问题 / 同期有效服务问题。客户无回复、关闭会话和创建工单不算已解决。','AI 独立解决率':'未进入人工处理且获得解决证据的问题 / 同期全部有效实时服务问题。不能为了指标阻止用户转人工。','人工复核正确率':'人工判为事实正确的适用答案 / 已复核适用答案。样本量、95% Wilson 区间、版本与抽样范围必须一起展示。','服务协同与效率':'建议采纳、工单成功、转接完成和回复耗时分别统计。测试执行或界面点击不算业务成功。'}[element.dataset.name]||'请按 PRD 中的定义进行人工校验。')}</p><div class="notice" style="margin-bottom:0">${icon('info-circle')}<span>大盘使用独立的固定模拟数据，工作台操作不会改变这些样本指标。</span></div></div>`,'','compact');
    case 'export-metrics':return window.AnalyticsHub.openExport();
    case 'reset-confirm':
      return showDialog('重置售后项目的演示数据？','不删除项目集配置、其他部门任务或文件。',`<p style="color:#85949d;line-height:1.9;font-size:12px">新增会话、工单、复核结果和知识草稿将恢复为初始模拟数据。本机服务中的模型密钥不会随此操作删除，请到对应助手中单独移除连接。</p>`,footerButtons('确认重置','reset-data'),'compact');
    case 'reset-data':
      clearTimeout(importTimer);window.ManagerHub.getEngine().dispose();composerDrafts.clear();state=initialState();window.ProjectHub.reset();window.AgentWorkspace.reset();window.HubMedia.reset();window.TraceHub.reset();window.SeatAssist.reset();window.ManagerHub.reset();window.AnalyticsHub.reset();window.DashboardAssistant.reset();window.BusinessGraph.reset();window.BusinessDesk.reset();persist();view.caseId=state.cases[0].id;view.queue='all';view.channel='all';view.search='';view.context='profile';view.composer='reply';view.mobileCase=false;navigate('workspace');return toast('已恢复初始演示数据。');
    case 'team-info':return showDialog('售后服务中心 · 演示工作空间','当前以演示管理员角色体验。',`<p style="font-size:12px;line-height:1.9;color:#7b909b">此版本使用本地模拟数据，不提供真实 SSO、租户鉴权、渠道账号切换或生产权限管理。正式产品需在服务端实施最小权限与数据隔离。</p>`,'','compact');
    case 'attachment-info':return showDialog('附件能力说明','为保护信息，Demo 不接受真实附件上传。',`<div class="notice amber" style="margin-bottom:0">${icon('shield-lock')}<span>正式版应先检查授权、格式、病毒与敏感内容，无法可靠扫描的内容进入隔离区；通过后才允许被客服和 Agent 使用。</span></div>`,'','compact');
    case 'filter-info':return showDialog('找到需要处理的会话','支持关键词、接待队列与来源渠道组合筛选。',`<p style="font-size:12px;color:#84969e;line-height:1.9">“我的接待”显示人工接管会话；“未读”显示尚未打开的新消息；历史资料有独立只读标识，不混入实时服务结果。</p>`,'','compact');
  }
}

document.addEventListener('click',event=>{
  const control=event.target.closest('[data-action]');
  if(control&&!control.disabled){event.preventDefault();dispatch(control.dataset.action,control);}
  else if(event.target.classList.contains('dialog-backdrop'))closeDialog();
});
document.addEventListener('input',event=>{
  if(event.target.id.startsWith('knowledge-'))return window.KnowledgeEditor.input(event.target.id,event.target.value);
  if(event.target.id.startsWith('model-'))return window.HubModels.change(event.target.id);
  if(event.target.id.startsWith('portfolio-'))return window.PortfolioHub.input(event.target.id,event.target.value);if(event.target.id==='ui-nav-search'){const query=event.target.value.trim().toLowerCase();const options=[...document.querySelectorAll('[data-ui-search]')];options.forEach(option=>{option.hidden=!option.dataset.uiSearch.toLowerCase().includes(query);});document.getElementById('ui-nav-empty').hidden=options.some(option=>!option.hidden);return;}
  if(event.target.id.startsWith('manager-'))return window.ManagerHub.input(event.target.id,event.target.value);
  if(event.target.id.startsWith('seat-'))return window.SeatAssist.input(event.target.id,event.target.value);
  if(event.target.id==='trace-search')return window.TraceHub.search(event.target.value);
  if(event.target.id==='reply-input'){window.SeatAssist.typeahead(event.target,event.isComposing);const key=`${event.target.dataset.case}:${event.target.dataset.kind}`;if(detectRisk(event.target.value)?.sensitive)composerDrafts.delete(key);else composerDrafts.set(key,event.target.value);}
  if(event.target.id==='case-search'){view.search=event.target.value;render();}
  if(event.target.id==='reporter-prompt')return window.DashboardAssistant.input(event.target.value);
  if(event.target.id==='table-search'){const query=event.target.value.toLowerCase();const rows=[...document.querySelectorAll('#searchable-table tbody tr')];rows.forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(query);});const count=rows.filter(row=>!row.hidden).length;const empty=document.getElementById('knowledge-empty');if(empty)empty.hidden=count>0;const label=document.getElementById('knowledge-result-count');if(label)label.textContent=count+' 条知识';}
});
document.addEventListener('change',event=>{
  if(event.target.id.startsWith('knowledge-'))return window.KnowledgeEditor.input(event.target.id,event.target.value);
  if(event.target.id==='library-sort')return window.PortfolioHub.change(event.target.id,event.target.value);
  if(event.target.id.startsWith('model-'))return window.HubModels.change(event.target.id);
  if(event.target.id.startsWith('manager-'))return window.ManagerHub.change(event.target.id,event.target.value,event.target.checked);
  if(event.target.id.startsWith('seat-'))return window.SeatAssist.change(event.target.id,event.target.value);
  if(event.target.id.startsWith('trace-'))return window.TraceHub.change(event.target.id,event.target.value);
  if(event.target.id.startsWith('portfolio-'))return window.PortfolioHub.change(event.target.id,event.target.value);if(event.target.id==='channel-filter'){view.channel=event.target.value;render();}
  if(event.target.id==='ticket-filter'){view.filter=event.target.value;render();}
  if(event.target.id.startsWith('reporter-'))return window.DashboardAssistant.change(event.target.id,event.target.value);
  if(event.target.id.startsWith('perf-'))return window.PerformanceHub.change(event.target.id,event.target.value);
  if(event.target.id==='metrics-period'||event.target.id==='analytics-channel')return window.AnalyticsHub.change(event.target.id,event.target.value);
  if(event.target.id.startsWith('insight-'))return window.ProblemInsights?.change(event.target.id,event.target.value);
});
document.addEventListener('submit',event=>{if(event.target.id==='knowledge-form'){event.preventDefault();return window.KnowledgeEditor.save();}if(event.target.id==='reporter-form'){event.preventDefault();return window.DashboardAssistant.dispatch('send',{dataset:{}});}if(event.target.id==='portfolio-editor'){event.preventDefault();return window.PortfolioHub.save(event.target);}if(event.target.matches('.manager-compose'))event.preventDefault();});
document.addEventListener('keydown',event=>{
  if(event.target.id?.startsWith('model-tab-')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const value=event.key==='Home'?'policy':event.key==='End'?'model':event.target.id==='model-tab-model'?'policy':'model';window.HubModels.dispatch('tab',{dataset:{value}});document.getElementById('model-tab-'+value).focus();return;}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();return openNavigator();}
  if(!event.isComposing&&event.keyCode!==229&&event.key==='Enter'&&!event.shiftKey&&['manager-prompt','manager-cli'].includes(document.activeElement?.id)){event.preventDefault();return window.ManagerHub.dispatch('send',{dataset:{}});}
  if(event.target.id==='reporter-prompt'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();return window.DashboardAssistant.dispatch('send',{dataset:{}});}
  if(event.key==='Escape'){if(document.querySelector('[role=dialog]'))closeDialog();else if(view.page==='manager')window.ManagerHub.dispatch('close-drawer',{dataset:{}});view.contextOpen=false;document.querySelector('[data-action="toggle-context"]')?.setAttribute('aria-expanded','false');document.querySelector('.workbench')?.classList.remove('show-context');document.querySelector('.sidebar')?.classList.remove('open');}
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&document.activeElement?.id==='reply-input'){event.preventDefault();sendMessage();}
  const dialog=document.querySelector('.dialog');
  if(event.key==='Tab'&&dialog){const controls=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(control=>control.offsetParent!==null);if(!controls.length)return;const first=controls[0];const last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===dialog)){event.preventDefault();first.focus();}}
});
window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(pageNames[page]){window.PortfolioHub.restoreLocation();navigate(page);}});
window.HubModels.configure({getState:()=>state,persist,render,escape:escapeHtml,button,icon,showDialog,footer:footerButtons});
window.KnowledgeEditor.configure({getState:()=>state,getView:()=>view,persist,render,escape:escapeHtml,button,badge,showDialog,closeDialog,toast,openKnowledge,isSensitive:text=>!!detectRisk(text)?.sensitive});
window.AnalyticsHub.configure({getState:()=>state,getView:()=>view,persist,escape:escapeHtml,badge,button,icon,channelMark,render,navigate,showDialog,closeDialog,footer:footerButtons,toast});
window.TraceHub.configure({getState:()=>state,persist,escape:escapeHtml,badge,button,icon,heading,render,navigate,showDialog,closeDialog,footer:footerButtons,toast,isSensitive:text=>!!detectRisk(text)?.sensitive,serviceReply,checkRisk:detectRisk});
window.SeatAssist.configure({getState:()=>state,persist,getView:()=>view,selectedCase,canReply,escape:escapeHtml,button,icon,setComposerText,toast,render,showDialog,closeDialog,footer:footerButtons,addMessage,audit,scrollChat,isSensitive:text=>!!detectRisk(text)?.sensitive});
window.ManagerHub.configure({getState:()=>state,getView:()=>view,persist,escape:escapeHtml,button,badge,icon,heading,toast,render,navigate,showDialog,closeDialog,isSensitive:text=>!!detectRisk(text)?.sensitive,summarize:(item,ticket)=>window.SeatAssist.summarize(item,ticket),checkRisk:detectRisk,record:payload=>window.TraceHub.record(payload),openTraces:identifier=>window.TraceHub.openTask(identifier),openReply(caseId,text,taskId){view.caseId=caseId;view.composer='reply';view.mobileCase=true;navigate('workspace');window.SeatAssist.externalInsert(text,'项目助手任务 '+taskId+' · 待人工核对');},openDraft(caseId){view.caseId=caseId;openDraft();}});
window.ProjectHub.configure({getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast,isSensitive:text=>!!detectRisk(text)?.sensitive});
window.HubMedia.configure({render:()=>['manager','group'].includes(view.page)?window.ProjectHub.repaint():null,escape:escapeHtml,icon,button,showDialog,closeDialog,toast,isSensitive:text=>!!detectRisk(text)?.sensitive});
window.PortfolioHub.configure({getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,toast,showDialog,closeDialog,isSensitive:text=>!!detectRisk(text)?.sensitive});
window.ProjectStudio.configure({getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast,isSensitive:text=>!!detectRisk(text)?.sensitive});
window.AssistantHub.configure({getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast,isSensitive:text=>!!detectRisk(text)?.sensitive});
window.BusinessDesk.configure({getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast,serviceReply,checkRisk:detectRisk,openDraftFor(identifier){view.caseId=identifier;openDraft();}});
window.TicketAssistant.configure({getState:()=>state,getView:()=>view,persist,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast,render,navigate,addMessage,audit,openTicket,isSensitive:text=>!!detectRisk(text)?.sensitive});
window.BusinessGraph.configure({getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast});
window.AgentWorkspace.configure({getState:()=>state,getView:()=>view,persist,render,navigate,escape:escapeHtml,button,icon,badge,showDialog,closeDialog,toast});
window.ServiceJourney.configure({getState:()=>state,persist,render,navigate,addMessage,audit,checkRisk:detectRisk,escape:escapeHtml,button,icon,toast,isSensitive:text=>!!detectRisk(text)?.sensitive,openCase(identifier){view.caseId=identifier;view.mobileCase=true;view.queue='all';view.channel='all';view.search='';navigate('workspace');}});
view.page=window.PortfolioHub.route(view.page);
window.PortfolioHub.syncLocation(view.page);
render();
const configuredAgent=new URLSearchParams(location.search).get('configure');
if(window.PortfolioHub.navProject()?.id==='AFTERSALES'&&view.page==='agents'&&state.agents.some(entry=>entry.id===configuredAgent))window.HubModels.open(configuredAgent,'model');
