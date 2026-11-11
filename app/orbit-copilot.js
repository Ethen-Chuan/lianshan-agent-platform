window.OrbitCopilot = (() => {
  const typeNames={业务入口:'start',收集信息:'collect',条件分支:'condition',处理动作:'action',人工确认:'human',交付结果:'end'};
  const properties={名称:'name',说明:'description',业务定义:'description',必要字段:'fields',必要信息:'fields',受理关键词:'keywords',转人工关键词:'keywords',业务能力:'capability'};
  const limits={name:20,description:180,fields:160,keywords:120,capability:60};
  const quote='[「“"]([^「」“”"\\n]+)[」”"]';
  const matches=(pattern,line)=>new RegExp('^(?:请)?'+pattern+'[。]?$').exec(line);
  const identifier=prefix=>prefix+'-'+crypto.randomUUID();
  const copy=value=>structuredClone(value);
  function resolve(graph,name,selected) {
    if(name==='选中节点'||name==='这个节点'){const node=graph.nodes.find(node=>node.id===selected);if(!node)throw new Error('请先选中一个节点，或在指令中写明节点名称。');return node;}
    const nodes=graph.nodes.filter(node=>node.name===name||node.id===name);
    if(nodes.length!==1)throw new Error(nodes.length?'同名节点不止一个，请选中目标后使用“选中节点”。':`没有找到「${name}」，请使用画布里的完整名称。`);
    return nodes[0];
  }
  function structural(graph) {
    if(graph.nodes.length>20||graph.edges.length>32)throw new Error('当前草案最多 20 个节点、32 条连线。');
    if(graph.nodes.filter(node=>node.type==='start').length>1)throw new Error('业务入口只能有一个。');
    if(window.OrbitFlow.levels(graph).cyclic)throw new Error('修改会形成循环，已拒绝整批修改。');
    for(const node of graph.nodes){
      const incoming=graph.edges.filter(edge=>edge.to===node.id);const outgoing=graph.edges.filter(edge=>edge.from===node.id);
      if(node.type==='start'&&incoming.length)throw new Error('业务入口不能有前置连线。');
      if(node.type==='end'&&outgoing.length)throw new Error('交付结果不能继续向外连接。');
      if(outgoing.length>(node.type==='condition'?2:node.type==='end'?0:1))throw new Error(`「${node.name}」的出口已满，请使用条件分支。`);
      for(const [key,limit] of Object.entries(limits))if(String(node[key]||'').length>limit)throw new Error(`「${node.name}」的${key}超过 ${limit} 字上限。`);
    }
    const ids=new Set(graph.nodes.map(node=>node.id));
    if(ids.size!==graph.nodes.length||graph.edges.some(edge=>!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to))throw new Error('修改包含无效连接。');
    if(new Set(graph.edges.map(edge=>edge.from+'→'+edge.to)).size!==graph.edges.length)throw new Error('两个节点已存在连线，不能重复连接。');
    if(graph.edges.some(edge=>!edge.label.trim()||edge.label.length>12))throw new Error('连线条件须为 1–12 字。');
  }
  function addNode(graph,type,name) {
    if(!name.trim()||name.length>20)throw new Error('新节点名称须为 1–20 字。');
    if(graph.nodes.some(node=>node.name===name))throw new Error('已有同名节点，请换一个名称以免指令歧义。');
    const node={id:identifier('node'),type,name,description:'',fields:'',keywords:'',capability:'',tool:'summary'};
    Object.assign(node,window.OrbitFlow.freePosition(graph,node.id,60,60));graph.nodes.push(node);return node;
  }
  function insert(graph,fromId,type,name) {
    const from=graph.nodes.find(node=>node.id===fromId);if(!from)throw new Error('来源节点不存在。');
    const edges=graph.edges.filter(edge=>edge.from===from.id);if(from.type==='end')throw new Error('不能在交付结果后插入步骤。');
    if(edges.length>1)throw new Error('这个节点有两条分支，请在线上点击 +，明确选择要插入的分支。');
    if(type==='start'||type==='end')throw new Error('中间步骤请选择收集信息、处理动作、条件分支或人工确认。');
    const node=addNode(graph,type,name);const edge=edges[0];
    if(edge){const target=edge.to;edge.to=node.id;graph.edges.push({id:identifier('edge'),from:node.id,to:target,label:'继续',fromPort:0});}
    else graph.edges.push({id:identifier('edge'),from:from.id,to:node.id,label:'继续',fromPort:0});
    return node;
  }
  function differences(before,after) {
    const changes=[];
    if(before.name!==after.name)changes.push({kind:'identity',label:'助手名称',before:before.name||'未命名',after:after.name});
    for(const node of before.nodes){const next=after.nodes.find(entry=>entry.id===node.id);if(next&&node.type!==next.type)changes.push({kind:'edit',id:node.id,label:node.name+' · 节点类型',before:node.type,after:next.type,risk:node.type==='human'});if(next&&node.type==='action'&&(node.tool||'summary')!==(next.tool||'summary'))changes.push({kind:'edit',id:node.id,label:node.name+' · 本地准备方式',before:node.tool||'summary',after:next.tool||'summary',risk:true});}
    for(const node of before.nodes){const next=after.nodes.find(item=>item.id===node.id);if(!next){changes.push({kind:'remove',id:node.id,label:'删除节点',before:node.name,after:'移除节点及关联连线',risk:node.type==='human'});continue;}
      for(const [name,key] of [['名称','name'],['说明','description'],['必要信息','fields'],['关键词','keywords'],['所需能力','capability']])if((node[key]||'')!==(next[key]||''))changes.push({kind:'edit',id:node.id,label:node.name+' · '+name,before:node[key]||'未填写',after:next[key]||'未填写',risk:node.type==='human'&&['description','keywords'].includes(key)});
    }
    for(const node of after.nodes.filter(node=>!before.nodes.some(item=>item.id===node.id)))changes.push({kind:'add',id:node.id,label:'新增'+Object.keys(typeNames).find(key=>typeNames[key]===node.type),before:'无',after:node.name+' · '+(node.description||'业务定义待补充')});
    const edgeText=(graph,edge)=>(graph.nodes.find(node=>node.id===edge.from)?.name||edge.from)+' — '+edge.label+' → '+(graph.nodes.find(node=>node.id===edge.to)?.name||edge.to);
    for(const edge of before.edges){const next=after.edges.find(item=>item.id===edge.id);if(!next||JSON.stringify([edge.from,edge.to,edge.label])!==JSON.stringify([next.from,next.to,next.label]))changes.push({kind:next?'edge-edit':'edge-remove',label:'关系调整',before:edgeText(before,edge),after:next?edgeText(after,next):'断开关系'});}
    for(const edge of after.edges.filter(edge=>!before.edges.some(item=>item.id===edge.id)))changes.push({kind:'edge-add',label:'新增连线',before:'无',after:edgeText(after,edge)});
    if(before.nodes.some(node=>{const next=after.nodes.find(item=>item.id===node.id);return next&&(node.x!==next.x||node.y!==next.y);})||before.layout!==after.layout||before.density!==after.density)changes.push({kind:'layout',label:'画布排版',before:(before.layout==='horizontal'?'横向':'纵向')+' / '+(before.density==='compact'?'紧凑':'宽松'),after:(after.layout==='horizontal'?'横向':'纵向')+' / '+(after.density==='compact'?'紧凑':'宽松')+' · 更新节点位置'});
    return changes;
  }
  function propose(source,command,selected='',projectId=source.projectId) {
    if(source.projectId!==projectId)throw new Error('不能修改其他项目的流程。');
    const text=String(command||'').trim();if(!text||text.length>1600)throw new Error('请输入 1–1600 字的修改指令。');
    const lines=text.split('\n').map(line=>line.trim()).filter(Boolean);if(lines.length>12)throw new Error('一次最多 12 条修改，请拆分后逐批确认。');
    let graph=copy(source);const operations=[];
    for(const line of lines){let result;
      if((result=matches('(?:把|将)?('+quote+'|选中节点|这个节点)(?:的名称)?(?:重命名为|改名为|改为)'+quote,line))){
        const node=resolve(graph,result[2]||result[1],selected);const value=result[3].trim();if(!value)throw new Error('名称不能为空。');node.name=value;operations.push('rename');
      }else if((result=matches('(?:修改|设置)(?:'+quote+'|(选中节点|这个节点))的(名称|说明|业务定义|必要字段|必要信息|受理关键词|转人工关键词|业务能力)(?:为|：|:)'+quote,line))){
        const node=resolve(graph,result[1]||result[2],selected);const property=properties[result[3]];const value=result[4].trim();
        if(property==='fields'&&!['collect','condition'].includes(node.type))throw new Error('必要信息只适用于收集信息或条件分支节点。');
        if(property==='keywords'&&!['start','human'].includes(node.type))throw new Error('关键词只适用于业务入口或人工确认节点。');
        if(property==='capability'&&node.type!=='action')throw new Error('业务能力只适用于处理动作节点。');
        if(!value)throw new Error('修改内容不能为空。');node[property]=value;operations.push('update');
      }else if((result=matches('在(?:'+quote+'|(选中节点|这个节点))后(?:添加|新增|插入)(业务入口|收集信息|条件分支|处理动作|人工确认|交付结果)(?:节点)?'+quote,line))){
        const from=resolve(graph,result[1]||result[2],selected);insert(graph,from.id,typeNames[result[3]],result[4].trim());graph=window.OrbitFlow.arrange(graph);operations.push('insert');
      }else if((result=matches('(?:添加|新增)(业务入口|收集信息|条件分支|处理动作|人工确认|交付结果)(?:节点)?'+quote,line))){addNode(graph,typeNames[result[1]],result[2].trim());operations.push('add');
      }else if((result=matches('(?:删除|移除)(?:节点)?(?:'+quote+'|(选中节点|这个节点))',line))){const node=resolve(graph,result[1]||result[2],selected);graph.nodes=graph.nodes.filter(item=>item.id!==node.id);graph.edges=graph.edges.filter(edge=>edge.from!==node.id&&edge.to!==node.id);operations.push('remove');
      }else if((result=matches('连接'+quote+'(?:到|至)'+quote+'(?:[，,]条件'+quote+')?',line))){const from=resolve(graph,result[1],selected);const to=resolve(graph,result[2],selected);window.OrbitFlow.addConnection(graph,from.id,to.id,result[3]||'继续');operations.push('connect');
      }else if((result=matches('断开'+quote+'(?:到|至)'+quote+'(?:的连线)?',line))){const from=resolve(graph,result[1],selected);const to=resolve(graph,result[2],selected);const edge=graph.edges.find(edge=>edge.from===from.id&&edge.to===to.id);if(!edge)throw new Error('未找到指定连线。');graph.edges=graph.edges.filter(item=>item.id!==edge.id);operations.push('disconnect');
      }else if((result=matches('将所有节点向(右|左|上|下)移动(\\d{1,3})(?:像素)?',line))){const amount=Number(result[2]);if(!amount||amount>600)throw new Error('一次移动范围为 1–600 像素。');const horizontal=['左','右'].includes(result[1]);const delta=['左','上'].includes(result[1])?-amount:amount;for(const node of graph.nodes)node[horizontal?'x':'y']=Math.max(24,Math.min(7000,node[horizontal?'x':'y']+delta));operations.push('move');
      }else{
        try{graph=window.OrbitFlow.layoutCommand(graph,line);operations.push('layout');}
        catch{throw new Error('无法完整识别这条指令，未应用任何修改：'+line+'。请参照下方示例，一行一条；当前未连接语义模型。');}
      }
      structural(graph);
    }
    const changes=differences(source,graph);if(!changes.length)throw new Error('这条指令没有产生变化。');
    return {graph,changes,command:text,source:'local-commands',sourceSnapshot:JSON.stringify(source),projectId,flowId:source.id,revision:source.revision,layoutRevision:source.layoutRevision,semantic:operations.some(operation=>!['layout','move'].includes(operation)),warnings:window.OrbitFlow.validate(graph),requiresRisk:changes.some(change=>change.kind==='remove'||change.kind==='edge-remove'||change.risk),selected};
  }
  return {propose,differences,structural,insert};
})();
