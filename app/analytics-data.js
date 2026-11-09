window.HubAnalyticsData = (() => {
  const channels=[{id:'wechat',name:'微信客服'},{id:'ding',name:'钉钉'},{id:'feishu',name:'飞书'}];
  const categories=['设备故障','操作咨询','工单进度','软件问题','服务政策'];
  const errors=['版本不匹配','依据不充分','字段遗漏','服务承诺'];
  const current={start:1,cases:[132,143,158,171,192,244,208],solved:[80,93,104,115,132,180,138],ai:[44,48,53,66,74,99,78],reviewed:[35,36,38,42,43,46,60],correct:[33,35,37,40,42,44,58]};
  const previous={start:25,cases:[110,122,135,149,165,222,181],solved:[64,75,86,99,111,151,120],ai:[28,34,40,48,54,91,68],reviewed:[28,30,33,35,39,43,52],correct:[26,28,31,33,37,41,50]};
  const pad=value=>String(value).padStart(2,'0');

  function permutation(length,seed){
    const values=Array.from({length},(_,index)=>index);
    let state=seed;
    for(let index=length-1;index>0;index--){state=(Math.imul(state,1664525)+1013904223)>>>0;const next=state%(index+1);[values[index],values[next]]=[values[next],values[index]];}
    return values;
  }

  function build(config,month){
    return config.cases.flatMap((count,day)=>{
      const outcomes=permutation(count,101+day);
      const reviewOrder=permutation(count,903+day);
      const channelOrder=permutation(count,761+day);
      const open=Math.round((count-config.solved[day])*.3);
      return Array.from({length:count},(_,index)=>{
        const rank=outcomes[index];
        const reviewed=reviewOrder[index]<config.reviewed[day];
        const correct=reviewed&&reviewOrder[index]<config.correct[day];
        const distribution=channelOrder[index]/count;
        return Object.freeze({id:`SAMPLE-${month}-${pad(day+config.start)}-${pad(index+1)}`,date:`2026-${month}-${pad(day+config.start)}`,hour:pad(8+(index%7)*2)+':00',channel:distribution<.46?'wechat':distribution<.75?'ding':'feishu',category:categories[(index*3+day)%11<4?0:(index+day)%4+1],outcome:rank<config.ai[day]?'ai':rank<config.solved[day]?'assisted':rank<config.solved[day]+open?'open':'unknown',reviewed,correct,error:reviewed&&!correct?errors[reviewOrder[index]%errors.length]:null,responseMs:1300+((index*17+day*11)%55)*145+(index%19===0?19000:0)});
      });
    });
  }

  const samples=Object.freeze(build(current,'11'));
  const baseline=Object.freeze(build(previous,'10'));
  const rate=(numerator,denominator)=>denominator?numerator/denominator*100:null;
  const percentile=(values,percent)=>values.length?[...values].sort((left,right)=>left-right)[Math.max(0,Math.ceil(values.length*percent)-1)]:null;

  function aggregate(rows){
    const counts={cases:rows.length,solved:0,ai:0,assisted:0,open:0,unknown:0,reviewed:0,correct:0,incorrect:0};
    for(const row of rows){counts[row.outcome]++;if(['ai','assisted'].includes(row.outcome))counts.solved++;if(row.reviewed){counts.reviewed++;if(row.correct)counts.correct++;else counts.incorrect++;}}
    const responses=rows.map(row=>row.responseMs);
    return {...counts,solveRate:rate(counts.solved,counts.cases),aiRate:rate(counts.ai,counts.cases),accuracy:rate(counts.correct,counts.reviewed),p50:percentile(responses,.5),p95:percentile(responses,.95)};
  }

  function interval(correct,total){
    if(!total)return null;
    const proportion=correct/total;
    const confidence=1.96;
    const denominator=1+confidence*confidence/total;
    const center=(proportion+confidence*confidence/(2*total))/denominator;
    const margin=confidence*Math.sqrt(proportion*(1-proportion)/total+confidence*confidence/(4*total*total))/denominator;
    return [(center-margin)*100,(center+margin)*100];
  }

  function snapshot(period='week',channel='all'){
    const mode=period==='today'?'today':'week';
    const source=channels.some(entry=>entry.id===channel)||channel==='archive'?channel:'all';
    const dates=mode==='today'?['2026-11-07']:Array.from({length:7},(_,index)=>`2026-11-${pad(index+1)}`);
    const previousDates=mode==='today'?['2026-10-31']:Array.from({length:7},(_,index)=>`2026-10-${pad(index+25)}`);
    const currentRows=samples.filter(row=>dates.includes(row.date)&&(source==='all'||row.channel===source));
    const comparisonRows=baseline.filter(row=>previousDates.includes(row.date)&&(source==='all'||row.channel===source));
    const buckets=mode==='today'?Array.from({length:7},(_,index)=>pad(8+index*2)+':00'):dates;
    const total=aggregate(currentRows);
    return {period:mode,channel:source,dates,previousDates,label:mode==='today'?'2026.11.07':'2026.11.01 — 11.07',comparisonLabel:mode==='today'?'2026.10.31':'2026.10.25 — 10.31',channelLabel:source==='all'?'全部实时渠道':source==='archive'?'历史存档（不计入）':channels.find(entry=>entry.id===source).name,total,previous:aggregate(comparisonRows),interval:interval(total.correct,total.reviewed),trend:buckets.map(key=>({key,label:mode==='today'?key:key.slice(5).replace('-','/'),...aggregate(currentRows.filter(row=>(mode==='today'?row.hour:row.date)===key))})),channels:channels.filter(entry=>source==='all'||entry.id===source).map(entry=>({...entry,...aggregate(currentRows.filter(row=>row.channel===entry.id))})),categories:categories.map(name=>({name,...aggregate(currentRows.filter(row=>row.category===name))})).sort((left,right)=>right.cases-left.cases),errors:errors.map(name=>({name,count:currentRows.filter(row=>row.error===name).length})).sort((left,right)=>right.count-left.count)};
  }

  return {snapshot,aggregate,interval,rate,channels,categories,samples,baseline};
})();

window.HubPerformanceData = (() => {
  const snapshotAt='2026-11-07T23:59:59+08:00';
  const agents=[{id:'service',name:'售后接待助手'},{id:'ticket',name:'工单填写助手'},{id:'quality',name:'对话质检助手'}];
  const models=[{id:'standard',name:'标准模型 · 模拟'},{id:'fast',name:'轻量模型 · 模拟'}];
  const defaults=Object.freeze({ttftMs:1500,endToEndMs:10000,aiFrtMs:15000,humanFrtMs:60000,goal:95});
  const metrics=[
    {id:'ttftMs',name:'首 token 延迟',short:'TTFT',note:'模型请求发出 → 第一个内容 token。不是客户可见首响；只统计实际返回首 token 的调用。'},
    {id:'modelMs',name:'完整生成耗时',short:'完整生成',note:'模型请求发出 → 最后一个内容 token。包含 TTFT；只统计完成的模型调用。'},
    {id:'endToEndMs',name:'端到端处理耗时',short:'端到端',note:'平台受理 → 结果交付确认。接待为渠道确认，填单与质检为内部结果交付。仅成功请求；不含渠道入站。'},
    {id:'queueMs',name:'调度排队',short:'排队',note:'平台受理 → 助手开始执行。仅已出队请求，不含正在排队的等待下限。'},
    {id:'toolMs',name:'工具调用',short:'工具',note:'每次工具尝试发出 → 返回或超时。重试单独计一次；包含失败尝试，不是每个请求的工具总时长。'},
    {id:'ingressMs',name:'渠道入站',short:'入站',note:'渠道事件产生 → 平台接收。依赖双方时钟校准；固定样本仅用于演示。'},
    {id:'deliveryMs',name:'结果交付确认',short:'交付',note:'平台发送结果 → 渠道或调用方确认接收。接待为渠道回传；不代表客户已经阅读。'},
    {id:'gapMs',name:'内容块最大间隔',short:'流式停顿',note:'单次调用相邻内容块的最大间隔，再跨调用取分位数。内容块不等于单 token，不以此冒充 TPOT。'}
  ];
  const rate=(count,total)=>total?count/total*100:null;
  function quantile(values,percentile){const ordered=values.filter(value=>Number.isFinite(value)&&value>=0).sort((left,right)=>left-right);return ordered.length?ordered[Math.max(0,Math.ceil(ordered.length*percentile)-1)]:null;}
  function distribution(values){const valid=values.filter(value=>Number.isFinite(value)&&value>=0);return {n:valid.length,p50:quantile(valid,.5),p95:quantile(valid,.95),p99:quantile(valid,.99),mean:valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null};}
  function makeRequest(source,index){
    const agent=agents[index%3].id;
    const model=index%4===0?'fast':'standard';
    const residue=index%41;
    const status=residue===0?'timeout':residue===1?'error':residue===2?'cancelled':residue===3&&source.date==='2026-11-07'?'running':'success';
    const toolTimeout=status==='timeout'&&index%2===0;
    const failureStage=status==='timeout'?(toolTimeout?'tool':'model'):status==='error'?'delivery':status==='cancelled'?'model':status==='running'?'queue':null;
    const stages=[];const attempts=[];let offset=0;
    const stage=(key,name,duration,state='success')=>{const item=Object.freeze({key,name,offset,duration,status:state});stages.push(item);offset+=duration;return item;};
    const queueMs=80+(index*43%720)+(index%17===0?2400:0);
    stage('queue','调度排队',status==='running'?4200:queueMs,status==='running'?'running':'success');
    if(status!=='running'){
      if(index%5!==0){
        const retry=index%13===0;
        if(retry)attempts.push(Object.freeze({name:'知识 / 工单查询',attempt:1,duration:3000,status:'timeout'}));
        const duration=toolTimeout?3000:90+(index*71%650);
        attempts.push(Object.freeze({name:agent==='ticket'?'工单字段校验':agent==='quality'?'规则查询':'知识检索',attempt:retry?2:1,duration,status:toolTimeout?'timeout':'success'}));
        stage('tool','工具查询'+(retry?'（含一次重试）':''),attempts.reduce((sum,item)=>sum+item.duration,0),toolTimeout?'timeout':'success');
      }else if(toolTimeout){attempts.push(Object.freeze({name:'知识检索',attempt:1,duration:3000,status:'timeout'}));stage('tool','工具查询',3000,'timeout');}
      if(!toolTimeout){
        const ttftMs=(model==='fast'?160:360)+(index*37%1200)+(index%19===0?3100:0);
        const decodeMs=(model==='fast'?580:1200)+(index*53%3100)+(index%23===0?6400:0);
        if(status==='timeout')stage('model-wait','等待模型首 token',12000,'timeout');
        else if(status==='cancelled')stage('model-wait','等待模型首 token',650,'cancelled');
        else{stage('model-first','等待首 token',ttftMs);stage('model-generate','生成剩余内容',decodeMs);stage('guard','发送前检查',100+(index*29%550));stage('delivery',agent==='service'?'渠道回传确认':'内部结果交付',status==='error'?1800:50+(index*11%340),status==='error'?'error':'success');}
      }
    }
    const find=key=>stages.find(item=>item.key===key&&item.status==='success')?.duration??null;
    const ttftMs=find('model-first');const generation=find('model-generate');
    return Object.freeze({id:'PERF-'+String(index+1).padStart(4,'0'),sourceId:source.id,date:source.date,hour:status==='running'?'20:00':source.hour,time:status==='running'?'23:59:54.800':source.hour+':00',channel:source.channel,agent,model,version:agent+' / demo-1',status,failureStage,ingressMs:20+index*7%320,queueMs:status==='running'?null:queueMs,ttftMs,modelMs:ttftMs===null||generation===null?null:ttftMs+generation,endToEndMs:status==='success'?offset:null,deliveryMs:find('delivery'),gapMs:generation===null?null:Math.min(generation,40+index*31%380+(index%23===0?1400:0)),elapsedMs:offset,stages:Object.freeze(stages),attempts:Object.freeze(attempts)});
  }
  const requests=Object.freeze(window.HubAnalyticsData.samples.map(makeRequest));
  const sessions=Object.freeze(window.HubAnalyticsData.samples.map((source,index)=>{
    const created=Date.parse(source.date+'T'+source.hour+':00+08:00');
    const mode=index%4===0?'human':'ai';
    const unanswered=index%31===0;
    const transferred=mode==='ai'&&index%5===0;
    const queueMs=mode==='human'||transferred?3000+index*379%80000:null;
    const frtMs=unanswered?null:mode==='ai'?1600+index*173%18000:queueMs+5000+index*977%60000;
    const resolvedCandidate=['ai','assisted'].includes(source.outcome);
    const resolutionMs=resolvedCandidate?300000+index*17009%65000000:null;
    const resolvedAt=resolutionMs===null?null:created+resolutionMs;
    const resolved=!unanswered&&resolvedAt!==null&&resolvedAt<=Date.parse(snapshotAt);
    const observed24h=Date.parse(snapshotAt)-created>=86400000;
    const repeat24h=observed24h&&index%9===0;
    const firstContact=resolved&&resolutionMs<3600000&&!repeat24h;
    const reopenedEligible=resolved&&Date.parse(snapshotAt)-resolvedAt>=86400000;
    const handled=resolved&&(mode==='human'||transferred);
    const invited=resolved&&index%3!==0;
    const score=invited&&index%2===0?(index%7===0?2:index%11===0?3:4+Math.floor(index/2)%2):null;
    return Object.freeze({id:source.id,date:source.date,channel:source.channel,mode,frtMs,created,transferred,queueMs,resolved,resolutionMs:resolved?resolutionMs:null,handlingMs:handled?120000+index*701%1000000:null,observed24h,repeat24h,firstContact,reopenedEligible,reopened:reopenedEligible&&index%17===0,invited,score});
  }));
  function aggregate(rows,targets=defaults){
    const terminal=rows.filter(row=>['success','timeout','error'].includes(row.status));
    const success=rows.filter(row=>row.status==='success');
    const attempts=rows.flatMap(row=>row.attempts);
    const values=Object.fromEntries(metrics.map(metric=>[metric.id,distribution(metric.id==='toolMs'?attempts.map(item=>item.duration):rows.map(row=>row[metric.id]))]));
    const timeout=rows.filter(row=>row.status==='timeout').length;const errors=rows.filter(row=>row.status==='error').length;
    const met=success.filter(row=>row.endToEndMs<=targets.endToEndMs).length;
    return {count:rows.length,terminal:terminal.length,success:success.length,timeout,errors,cancelled:rows.filter(row=>row.status==='cancelled').length,running:rows.filter(row=>row.status==='running').length,successRate:rate(success.length,terminal.length),timeoutRate:rate(timeout,terminal.length),errorRate:rate(errors,terminal.length),sloMet:met,sloRate:rate(met,terminal.length),toolAttempts:attempts.length,toolFailures:attempts.filter(item=>item.status!=='success').length,retried:rows.filter(row=>row.attempts.length>1).length,toolRequests:rows.filter(row=>row.attempts.length).length,metrics:values};
  }
  function serviceSummary(rows,targets=defaults){
    const matured=rows.filter(row=>Date.parse(snapshotAt)-row.created>=targets[row.mode==='ai'?'aiFrtMs':'humanFrtMs']);
    const responded=rows.filter(row=>row.frtMs!==null);
    const met=matured.filter(row=>row.frtMs!==null&&row.frtMs<=targets[row.mode==='ai'?'aiFrtMs':'humanFrtMs']);
    const observation=rows.filter(row=>row.observed24h);
    const reopened=rows.filter(row=>row.reopenedEligible);
    const invited=rows.filter(row=>row.invited);const scored=invited.filter(row=>row.score!==null);
    const ai=rows.filter(row=>row.mode==='ai');
    return {count:rows.length,matured:matured.length,met:met.length,slaRate:rate(met.length,matured.length),unanswered:rows.filter(row=>row.frtMs===null).length,frt:distribution(responded.map(row=>row.frtMs)),aiFrt:distribution(rows.filter(row=>row.mode==='ai').map(row=>row.frtMs)),humanFrt:distribution(rows.filter(row=>row.mode==='human').map(row=>row.frtMs)),queue:distribution(rows.map(row=>row.queueMs)),aht:distribution(rows.map(row=>row.handlingMs)),resolution:distribution(rows.map(row=>row.resolutionMs)),aiStarted:ai.length,transferred:ai.filter(row=>row.transferred).length,observed:observation.length,fcr:observation.filter(row=>row.firstContact).length,repeated:observation.filter(row=>row.repeat24h).length,reopenEligible:reopened.length,reopened:reopened.filter(row=>row.reopened).length,invited:invited.length,scored:scored.length,satisfied:scored.filter(row=>row.score>=4).length};
  }
  function snapshot(filters={},targets=defaults){
    const period=filters.period==='today'?'today':'week';const channel=filters.channel||'all';
    const inRange=row=>(period!=='today'||row.date==='2026-11-07')&&(channel==='all'||channel===row.channel);
    const rows=requests.filter(row=>inRange(row)&&(filters.agent==='all'||!filters.agent||row.agent===filters.agent)&&(filters.model==='all'||!filters.model||row.model===filters.model));
    const serviceRows=sessions.filter(inRange);
    const buckets=period==='today'?Array.from({length:7},(_,index)=>String(8+index*2).padStart(2,'0')+':00'):Array.from({length:7},(_,index)=>'2026-11-0'+(index+1));
    return {rows,serviceRows,period,channel,total:aggregate(rows,targets),service:serviceSummary(serviceRows,targets),trend:buckets.map(key=>({key,label:period==='today'?key:key.slice(5).replace('-','/'),...aggregate(rows.filter(row=>(period==='today'?row.hour:row.date)===key),targets)}))};
  }
  return {requests,sessions,agents,models,metrics,defaults,snapshotAt,rate,quantile,distribution,aggregate,serviceSummary,snapshot};
})();
