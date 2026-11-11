window.AgentHarness = (() => {
  const version = 'business-harness-1';
  const toolNames = {summary:'整理信息摘要',form:'准备表单草稿'};
  const split = value => [...new Set(String(value || '').split(/[,，、\n]/).map(entry => entry.trim()).filter(Boolean))];
  const clone = value => structuredClone(value);
  const reject = message => {throw new Error(message);};
  const unknown = /^(?:未知|未提供|待补充|待确认|待核实|不详|不清楚|不知道|无|暂无|待定|null|undefined|n\/?a|unknown|[-—?？]+)$/i;
  const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  function compile(config, projectId) {
    if (!projectId || !config || !Object.hasOwn(toolNames,config.tool)) reject('尚未接入这个动作，请选择本地摘要或表单草稿。');
    for (const reference of [config.ontologyBinding,config.flowDesign,config.businessDesign]) {
      if (reference && reference.projectId !== projectId) reject('业务定义不属于当前项目，不能执行。');
    }
    const binding = config.ontologyBinding;
    const nodes = binding?.nodes || [];
    if (nodes.length > 80 || (binding && !nodes.some(node => node.id === binding.actionId && node.type === 'action'))) reject('业务本体快照无效，请重新引用并验收。');
    if (binding?.links?.some(link => link.label === '原因假设')) reject('原因假设不能进入执行依据，请重新引用业务动作。');
    const definitions = config.flowDesign?.definitions || [];
    const rules = nodes.filter(node => node.type === 'rule');
    const fields = [...new Set([...split(config.fields),...nodes.flatMap(node => split(node.fields)),...definitions.flatMap(node => Array.isArray(node.fields) ? node.fields : split(node.fields))])];
    const keywords = split(config.keywords);
    if (!fields.length || !keywords.length || fields.length > 24 || keywords.length > 40) reject('请配置受理关键词与必要字段，字段不超过 24 项。');
    if (fields.some(field => typeof field !== 'string' || !field.trim() || field.length > 40 || /[:：,，;；\n]/.test(field) || ['__proto__','constructor','prototype'].includes(field))) reject('字段名称无效，请使用不含分隔符的业务名称。');
    const manualChecks = [...rules.map(node => ({id:node.id,name:node.name,description:node.description || '请按业务规则核对'})),...definitions.filter(node => ['处理规则','人工边界'].includes(node.type)).map(node => ({id:node.id,name:node.name,description:node.description || '请核对流程中的人工条件'}))];
    return {schema:1,runner:version,projectId,tool:config.tool,toolName:toolNames[config.tool],fields,keywords,transferWords:[...new Set([...split(config.transferWords),...rules.flatMap(node => [...split(node.transferWords),...split(node.blockedTerms)])])],manualChecks,handoff:String(config.handoff || '请交给负责人核实。'),maxRounds:3,sources:{ontology:binding ? {revision:binding.revision,actionId:binding.actionId,actionName:binding.actionName} : null,flow:config.flowDesign ? {revision:config.flowDesign.revision,flowId:config.flowDesign.flowId} : null},limitations:['仅本次输入，不读取其他任务或客户资料','文字规则与任意流程分支仍需人工核对','本地草稿，不发送、不建单、不调用真实模型']};
  }

  function policy(release, projectId) {
    if (!release || release.runner !== version || !release.contract) reject('这个旧版本尚未接入执行检查，请回 Orbit 重新验收并发布新版本；历史记录仍保留。');
    if (release.projectId !== projectId) reject('助手版本不属于当前项目。');
    const contract = compile(release.config,projectId);
    if (JSON.stringify(contract) !== JSON.stringify(release.contract)) reject('版本中的执行规则与配置不一致，请重新验收，不能继续使用。');
    return contract;
  }

  function preflight(contract, input, context) {
    if (contract.projectId !== context.projectId || context.enabled !== true || context.allowed !== true) reject('助手已暂停、未获授权或不属于当前项目，未执行任何动作。');
    const text = String(input || '').trim();
    if (!text || text.length > 1200 || context.isSensitive?.(text)) reject('请输入 1200 字以内的脱敏任务描述。');
    const body = text.replace(/@Super\s+Agent\b/gi,'').replace(/@[^\s，,。；;]+/g,'').trim();
    const fields = {};
    const missing = [];
    const conflicts = [];
    const fieldBoundary = contract.fields.map(escapePattern).join('|');
    for (const field of contract.fields) {
      const expression = new RegExp('(?:^|[\\s，,；;])'+escapePattern(field)+'\\s*[:：]\\s*([^，,；;\\n]*?)(?=\\s+(?:'+fieldBoundary+')\\s*[:：]|[，,；;\\n]|$)','g');
      const values = [...new Set([...body.matchAll(expression)].map(match => match[1].trim()))];
      if (values.length > 1) {conflicts.push(field);missing.push(field);}
      else if (!values[0] || unknown.test(values[0]) || new RegExp('^(?:'+fieldBoundary+')\\s*[:：]').test(values[0])) missing.push(field);
      else fields[field] = {value:values[0],source:'本次输入 · 待人工核实'};
    }
    const matched = contract.keywords.some(keyword => body.includes(keyword));
    const risk = /人工|退款|赔付|删除|绕过|转账|密码|立即发送|自动发送/.test(body) || contract.transferWords.some(word => body.includes(word));
    const outcome = risk || !matched ? 'handoff' : missing.length ? 'missing' : 'prepared';
    const steps = [
      {name:'检查项目与调度授权',result:'仅当前项目的已授权助手'},
      {name:'核对受理范围与风险',result:risk ? '触发转人工条件，不调用动作' : matched ? '命中本版本受理关键词' : '未命中受理范围，不调用动作'},
      {name:'检查必要字段',result:conflicts.length ? '字段存在冲突：'+conflicts.join('、') : missing.length ? '缺少或尚未核实：'+missing.join('、') : '字段已提供，内容仍需人工核实'},
      {name:'限制动作与上下文',result:contract.toolName+'；只使用所需字段；不授予外部操作权限'}
    ];
    return {runner:version,outcome,missing,conflicts,fields,steps,manualChecks:clone(contract.manualChecks),contract:clone(contract),output:outcome === 'handoff' ? '建议交给人工核实。'+contract.handoff : outcome === 'missing' ? (conflicts.length ? '先核对冲突字段：'+conflicts.join('、')+'。' : '')+'请补充：'+missing.map(field => field+'：具体内容').join('；') : '资料符合本地准备条件，尚未执行动作。'};
  }

  function artifactFor(contract,fields) {
    const content = contract.fields.map(field => field+'：'+fields[field].value).join('\n');
    const artifact = {type:contract.tool === 'form' ? 'form-draft' : 'summary',fields:clone(fields),text:content};
    if (!contract.fields.every(field => artifact.fields[field]?.value) || Object.keys(artifact.fields).length !== contract.fields.length) reject('动作结果不满足字段要求，未形成可确认结果。');
    return artifact;
  }
  function execute(contract, input, context) {
    const result = preflight(contract,input,context);
    if (result.outcome !== 'prepared') return {...result,receipt:null,toolCalls:0};
    const artifact = artifactFor(contract,result.fields);
    const receipt = {id:context.receiptId || 'evaluation',operation:'local.'+contract.tool+'.prepare',scope:'local-draft',externalWrite:false,artifact};
    result.steps.push({name:contract.toolName,result:'本地动作已完成，只生成所需字段的草稿'},{name:'核对交付结果',result:'字段完整；业务真实性与文字规则留给人工核对，未自动确认'});
    return {...result,receipt,toolCalls:1,output:'已准备'+(contract.tool === 'form' ? '表单草稿' : '信息摘要')+'：\n'+artifact.text+'\n请核对来源和业务规则；尚未对外发送或提交。'};
  }

  function evaluate(config,input,projectId,isSensitive) {
    return execute(compile(config,projectId),input,{projectId,enabled:true,allowed:true,isSensitive,receiptId:'evaluation'});
  }

  function inspect(release,input,context) {return preflight(policy(release,context.projectId),input,context);}
  function run(release,input,context) {return execute(policy(release,context.projectId),input,context);}
  function review(release,task,context,{confirmed,note}) {
    const contract = policy(release,context.projectId);
    if (task.projectId !== context.projectId || context.allowed !== true || context.enabled !== true) reject('当前任务不可确认，请核对项目和助手授权。');
    if (task.status !== '已准备，待人工核对' || task.runner !== version || !task.receipt || task.receipt.scope !== 'local-draft' || task.receipt.externalWrite !== false) reject('任务尚无可确认的本地结果。');
    if (!confirmed || !String(note || '').trim() || String(note).length > 400 || context.isSensitive?.(String(note))) reject('请填写 400 字以内的脱敏核对说明，并勾选确认来源与规则。');
    const expected = preflight(contract,task.input,context);
    if (expected.outcome !== 'prepared' || task.receipt.operation !== 'local.'+contract.tool+'.prepare' || JSON.stringify(artifactFor(contract,expected.fields)) !== JSON.stringify(task.receipt.artifact)) reject('结果与本次输入不一致，请重新核对。');
    return {runner:version,note:String(note).trim(),confirmed:true,externalWrite:false,receiptId:task.receipt.id,manualChecks:clone(contract.manualChecks)};
  }
  return {version,compile,policy,inspect,run,evaluate,review};
})();
