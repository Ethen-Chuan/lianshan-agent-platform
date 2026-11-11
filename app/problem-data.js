window.HubProblemData = (() => {
  const topics = [
    {id:'audio',title:'A1 升级 V2.3.2 后蓝牙通话无声',short:'蓝牙通话无声',domain:'设备故障',product:'座舱终端 A1',version:'V2.3.2',stage:'升级后首次通话',known:true,owner:'终端技术组',symptom:'手机能连接，通话没有声音；音乐播放正常。',hypothesis:'升级后的通话音频路由未恢复',evidence:'日志示例中通话输出指向旧音频通道，重新选择通话通道后部分案例恢复。',counter:'同版本也有未复现案例；尚未排除手机系统和安装方式的影响。',action:'收集音频路由日志、手机系统版本，并在同型号设备上复现。',knowledge:'KB-AUD-023',relation:'相同型号、软件版本和触发步骤',color:'forest'},
    {id:'inspection',title:'送检超过 48 小时仍查不到检测进度',short:'送检后进度未更新',domain:'工单进度',product:'座舱终端 A1',version:'不适用',stage:'送检 → 检测',known:true,owner:'售后履约组',symptom:'门店已经寄出设备，工单还是待收件，客户再次催问。',hypothesis:'收件记录与检测工单未完成关联',evidence:'部分示例有签收记录，但对应工单的收件字段为空。',counter:'仍有运输中、无法确认是否签收的样本，不能都归为回写问题。',action:'核对签收凭证与工单号，区分未签收和已签收未关联。',knowledge:'SOP-TKT-012',relation:'同一流程节点与状态回写缺口',color:'clay'},
    {id:'projection',title:'手机连接成功但 CarPlay 无法投屏',short:'连接成功但无法投屏',domain:'操作咨询',product:'座舱终端 A1',version:'V2.3.1',stage:'首次配对',known:true,owner:'一线支持组',symptom:'蓝牙显示已连接，车机没有进入投屏界面。',hypothesis:'仅完成蓝牙配对，投屏授权未完成',evidence:'示例对话中补充授权步骤后部分客户确认可投屏。',counter:'部分样本没有授权截图，也可能与数据线或连接模式有关。',action:'先确认连接方式与授权状态，再按对应模式排查。',knowledge:'KB-CP-008',relation:'相同操作步骤与授权条件',color:'blue'},
    {id:'gps',title:'A1 地图升级后出现定位漂移',short:'地图升级后定位漂移',domain:'软件问题',product:'座舱终端 A1',version:'V2.3.2',stage:'地图升级后',known:true,owner:'导航软件组',symptom:'车辆在道路上行驶，地图显示在旁边道路。',hypothesis:'升级后的定位校准或配置存在差异',evidence:'关联示例集中在升级后的首次定位，但缺少同环境对照。',counter:'遮挡环境、定位天线安装也可能产生相似现象。',action:'补充定位日志、天线安装和开阔环境复测结果。',knowledge:'KB-GPS-016',relation:'同版本、相似症状和校准步骤',color:'sand'},
    {id:'proof',title:'换机申请缺少原购买凭证怎么办',short:'换机所需购买凭证',domain:'服务政策',product:'座舱终端 A1',version:'不适用',stage:'换机资格核验',known:true,owner:'服务政策组',symptom:'客户没有纸质凭证，希望确认其他证明是否可以受理。',hypothesis:'可接受凭证的说明不够具体',evidence:'示例追问集中在电子订单、登记信息是否可替代原凭证。',counter:'是否有资格换机仍要核对具体政策，不能只凭相似案例承诺。',action:'完善凭证清单；资格和换机结果交由授权人员审核。',knowledge:'POL-EX-004',relation:'同一政策条款与资格条件',color:'moss'},
    {id:'camera',title:'C2 挂倒挡后影像黑屏但有提示音',short:'倒车影像黑屏',domain:'设备故障',product:'影像模块 C2',version:'V1.8.0',stage:'切换倒挡',known:true,owner:'影像技术组',symptom:'能听到提示音，屏幕没有显示后视影像。',hypothesis:'影像输入链路或协议配置不一致',evidence:'关联维修记录中存在更换连接线和修正协议两种不同处理。',counter:'相似黑屏并不代表同一故障，仍需区分供电、接线和协议。',action:'先收集输入状态和接线信息，禁止仅按聚类结论要求换件。',knowledge:'KB-CAM-011',relation:'同型号与影像输入故障现象',color:'blue'},
    {id:'package',title:'升级包下载完成后提示校验失败',short:'升级包校验失败',domain:'操作咨询',product:'座舱终端 A1',version:'V2.3.2',stage:'下载 → 校验',known:true,owner:'一线支持组',symptom:'升级包已下载，执行安装时提示校验失败。',hypothesis:'升级包与目标型号不匹配或下载不完整',evidence:'示例中记录了包名不一致和重新下载后恢复两类情况。',counter:'没有包校验值的样本暂不能确认原因。',action:'核对型号、升级包标识和校验值。',knowledge:'KB-UPD-007',relation:'同一校验步骤与包标识',color:'sand'},
    {id:'warranty',title:'非原购买门店能否受理保修',short:'跨门店保修受理',domain:'服务政策',product:'影像模块 C2',version:'不适用',stage:'服务受理',known:true,owner:'服务政策组',symptom:'客户不在原购买城市，询问就近门店能否受理。',hypothesis:'受理范围与服务网点说明不清晰',evidence:'多条示例都先询问门店范围，再询问需要提供的资料。',counter:'受理与最终保修资格是两件事，不能直接承诺免费服务。',action:'补充受理网点说明和资格核验入口。',knowledge:'POL-SVC-006',relation:'同一受理条款与服务地域',color:'moss'},
    {id:'reset',title:'A1 熄火重启后声音设置自动复位',short:'重启后声音设置复位',domain:'软件问题',product:'座舱终端 A1',version:'V2.3.2',stage:'熄火 → 再次启动',known:false,owner:'导航软件组',symptom:'昨天调整的声音设置，在熄火重启后恢复默认。',hypothesis:'设置持久化或电源状态切换可能有关',evidence:'相似描述集中在重启后；现有分类目录只有“通话无声”，不包含“设置复位”。',counter:'没有完整电源日志，无法确认是保存失败还是异常断电。',action:'新增候选问题定义，补充重启前后配置与电源日志。',knowledge:'KB-AUD-023',relation:'同设备、相邻功能，但症状不等同',color:'clay'},
    {id:'stripes',title:'C2 夜间影像间歇出现紫色条纹',short:'夜间影像紫色条纹',domain:'设备故障',product:'影像模块 C2',version:'V1.8.1',stage:'夜间低照度',known:false,owner:'影像技术组',symptom:'白天正常，夜间后视画面偶尔出现紫色条纹。',hypothesis:'低照度条件与影像链路可能有关',evidence:'少量跨门店示例均提到夜间，但尚无可复现记录。',counter:'样本量较少，拍摄反光或描述差异可能造成误聚类。',action:'先补充原始视频和环境信息，不直接扩充正式根因类型。',knowledge:'KB-CAM-011',relation:'同型号与低照度条件',color:'sand'}
  ];
  const dates = Array.from({length:7},(_,index)=>`2026-11-${String(index+1).padStart(2,'0')}`);
  const domains = window.HubAnalyticsData.categories;
  const topicMap = new Map(topics.map(topic=>[topic.id,Object.freeze(topic)]));

  function decorate(source) {
    const counters = new Map();
    return source.map(sample=>{
      const key = sample.date+sample.category;
      const ordinal = counters.get(key)||0;
      counters.set(key,ordinal+1);
      const recent = sample.date>='2026-11-06';
      const selector = ordinal%10;
      let topicId;
      if(sample.category==='设备故障')topicId=selector<6?'audio':recent&&selector>=8?'stripes':'camera';
      if(sample.category==='工单进度')topicId='inspection';
      if(sample.category==='操作咨询')topicId=selector<8?'projection':'package';
      if(sample.category==='软件问题')topicId=recent&&selector>=6?'reset':'gps';
      if(sample.category==='服务政策')topicId=selector<8?'proof':'warranty';
      const topic=topicMap.get(topicId);
      const serial=Number(sample.id.split('-').at(-1));
      const store=`示例门店 ${String((ordinal*7+serial)%24+1).padStart(2,'0')}`;
      const hasOutcome=['ai','assisted'].includes(sample.outcome);
      const primaryEvidence=ordinal%3!==0;
      return Object.freeze({...sample,topicId,store,product:topic.product,version:topic.version,stage:topic.stage,primaryEvidence,known:topic.known,reviewStatus:primaryEvidence?'待人工核实':'信息不足',customerText:topic.symptom,reply:hasOutcome?'已按当前适用步骤排查。请确认处理后是否恢复；本示例保留了结果确认记录。':'先补充设备版本和复现步骤，再按适用方案排查。暂不承诺修复时间。',result:hasOutcome?'有结果确认记录（示例）':sample.outcome==='open'?'仍未解决':'等待客户确认',messageId:`${sample.id}-M01`,evidenceId:`${sample.id}-E01`,traceId:`TRACE-${sample.id}`,duplicateMessages:1+ordinal%4});
    });
  }

  const records=Object.freeze(decorate(window.HubAnalyticsData.samples));
  const previousRecords=Object.freeze(decorate(window.HubAnalyticsData.baseline));
  const unique=rows=>Array.from(new Map(rows.map(row=>[row.id,row])).values());
  const validChannel=value=>['all','archive',...window.HubAnalyticsData.channels.map(channel=>channel.id)].includes(value)?value:'all';
  const validDay=value=>[...dates,'week'].includes(value)?value:dates.at(-1);

  function groups(rows,comparison) {
    return topics.map(topic=>{
      const members=rows.filter(row=>row.topicId===topic.id);
      const previous=comparison.filter(row=>row.topicId===topic.id).length;
      const solved=members.filter(row=>['ai','assisted'].includes(row.outcome)).length;
      return {...topic,count:members.length,previous,change:previous?(members.length-previous)/previous*100:null,share:rows.length?members.length/rows.length*100:null,solved,pending:members.length-solved,stores:new Set(members.map(row=>row.store)).size,evidenceCount:members.filter(row=>row.primaryEvidence).length,rows:members};
    }).filter(topic=>topic.count>0).sort((left,right)=>right.count-left.count||left.id.localeCompare(right.id));
  }

  function snapshot(options={}) {
    const day=validDay(options.day);
    const channel=validChannel(options.channel);
    const domain=domains.includes(options.domain)?options.domain:'all';
    const selectedDates=day==='week'?dates:[day];
    const previousDay=day==='week'?null:new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
    const compareDates=day==='week'?Array.from({length:7},(_,index)=>`2026-10-${25+index}`):[previousDay];
    const accepts=row=>(channel==='all'||row.channel===channel)&&(domain==='all'||row.category===domain);
    const rows=unique(records.filter(row=>selectedDates.includes(row.date)&&accepts(row)));
    const comparison=unique([...records,...previousRecords].filter(row=>compareDates.includes(row.date)&&accepts(row)));
    const grouped=groups(rows,comparison);
    const top=grouped.slice(0,5);
    const newRows=rows.filter(row=>!row.known);
    const rawMessages=rows.reduce((total,row)=>total+row.duplicateMessages,0);
    const buckets=day==='week'?selectedDates:Array.from({length:7},(_,index)=>String(8+index*2).padStart(2,'0')+':00');
    return {day,channel,domain,rows,comparison,groups:grouped,top,rawMessages,count:rows.length,stores:new Set(rows.map(row=>row.store)).size,pending:rows.filter(row=>!['ai','assisted'].includes(row.outcome)).length,newCount:newRows.length,knownCount:rows.length-newRows.length,newClusters:grouped.filter(topic=>!topic.known),topCount:top.reduce((total,topic)=>total+topic.count,0),otherCount:grouped.slice(5).reduce((total,topic)=>total+topic.count,0),dateLabel:day==='week'?'2026.11.01 — 11.07':day.replaceAll('-','.'),comparisonLabel:day==='week'?'2026.10.25 — 10.31':previousDay.replaceAll('-','.'),trend:buckets.map(bucket=>({label:bucket,topics:grouped.map(topic=>({id:topic.id,count:rows.filter(row=>row.topicId===topic.id&&(day==='week'?row.date:row.hour)===bucket).length}))})),ontologyVersion:'0.2',snapshotId:`INS-1107-${day}-${channel}-${domain}`,channelLabel:channel==='all'?'全部实时渠道':channel==='archive'?'历史存档（不计入）':window.HubAnalyticsData.channels.find(entry=>entry.id===channel).name};
  }

  function detail(topicId,options) {
    const report=snapshot(options);
    const group=report.groups.find(topic=>topic.id===topicId);
    if(!group)return null;
    const related=records.filter(row=>row.topicId===topicId&&!report.rows.some(member=>member.id===row.id)&&row.date<(report.day==='week'?dates[0]:report.day)).slice(-4);
    return {...group,report,related};
  }

  function csv(report) {
    const rows=[['连山 · 问题分析 · 固定模拟样本'],['统计日期',report.dateLabel],['渠道',report.channelLabel],['领域',report.domain],['比较日期',report.comparisonLabel],['历史分类版本',report.ontologyVersion],['计数口径','按问题实例去重；单实例仅有一个主要问题，不按消息条数计数'],['有效问题',report.count],['可追溯消息',report.rawMessages],[],['问题ID','具体问题','领域','本期问题数','对比期问题数','占有效问题比重(%)','未确认解决','覆盖门店','已知/候选','原因结论'],...report.groups.map(topic=>[topic.id,topic.title,topic.domain,topic.count,topic.previous,topic.share.toFixed(2),topic.pending,topic.stores,topic.known?'已知问题':'新问题候选','待验证假设，非已确认根因']),[],['提示','所有数据为离线模拟；未运行真实 GraphRAG、自动聚类或生产分类发布。']];
    return '\ufeff'+rows.map(row=>row.map(value=>{const text=String(value??'');return '"'+(/^[=+@-]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
  }

  return {topics:Object.freeze(topics),dates,domains,records,previousRecords,snapshot,detail,csv,unique};
})();
