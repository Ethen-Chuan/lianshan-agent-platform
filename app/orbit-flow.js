window.OrbitFlow = (() => {
  let host;
  const views = new Map();
  const types = {start:{label:'业务入口',icon:'message-circle'},collect:{label:'收集信息',icon:'file-text'},condition:{label:'条件分支',icon:'route'},action:{label:'处理动作',icon:'bolt'},human:{label:'人工确认',icon:'user-check'},end:{label:'交付结果',icon:'circle-check'}};
  const nodeSize = {width:220,height:116};
  const current = () => window.PortfolioHub.navProject();
  const workspace = () => window.ProjectStudio.data();
  const escape = value => host.escape(String(value ?? ''));
  const button = (label,name,attributes='',tone='quiet small') => host.button(label,'flow-'+name,tone,attributes);
  const uid = prefix => prefix+'-'+crypto.randomUUID();
  const split = value => [...new Set(String(value||'').split(/[,，、\n]/).map(item=>item.trim()).filter(Boolean))];
  function view() {if(!views.has(current().id))views.set(current().id,{selected:'',selectedEdge:'',connect:'',connectPort:0,zoom:1,snap:false,side:'node',undo:[],redo:[],pending:null,command:'',error:'',review:null,nodeDrafts:{},edgeDrafts:{},identityDraft:null,agent:{input:'',proposal:null,history:[]}});return views.get(current().id);}
  function initial(projectId) {return {id:uid('FLOW'),projectId,name:'',revision:1,layoutRevision:1,layout:'vertical',density:'comfortable',avatar:{art:'service',tone:'teal'},nodes:[],edges:[]};}
  function data() {const graph=workspace().businessFlow ||= initial(current().id);for(const node of graph.nodes)graph.edges.filter(edge=>edge.from===node.id).forEach((edge,index)=>{edge.fromPort??=index;});return graph;}
  function sample(projectId) {
    const graph = initial(projectId);
    graph.name='售后受理流程助手';
    graph.nodes=[
      {id:'start',type:'start',name:'受理报修诉求',description:'受理设备报修，先了解具体问题。',keywords:'报修,黑屏',fields:''},
      {id:'collect',type:'collect',name:'收集报修信息',description:'核对已提供的资料，缺少时先追问。',fields:'设备型号,购买日期,故障现象',keywords:''},
      {id:'condition',type:'condition',name:'资料是否齐全',description:'三项必要信息齐全才能准备草稿；否则交给坐席补充。',fields:'设备型号,购买日期,故障现象',keywords:''},
      {id:'action',type:'action',name:'整理报修草稿',description:'仅准备草稿，不能承诺换机、费用或处理时限。',fields:'',keywords:'',capability:'创建报修单',tool:'form'},
      {id:'human',type:'human',name:'人工补充与核实',description:'信息不足、冒烟或客户要求人工时，由坐席核实处理。',fields:'',keywords:'冒烟,人工'},
      {id:'review',type:'human',name:'坐席确认草稿',description:'核对信息与处理边界，取得授权后再提交；当前不执行真实提交。',fields:'',keywords:''},
      {id:'end',type:'end',name:'交付待确认结果',description:'保留本地草稿和核验依据，不代表已经提交工单。',fields:'',keywords:''}
    ];
    graph.edges=[['start','collect','进入'],['collect','condition','核对信息'],['condition','action','资料齐全'],['condition','human','资料不足'],['action','review','草稿待审'],['human','review','补充后复核'],['review','end','确认交付']].map(([from,to,label],index)=>({id:'link-'+index,from,to,label}));
    return arrange(graph,'vertical','comfortable');
  }
  function levels(graph) {
    const degree=new Map(graph.nodes.map(node=>[node.id,0]));
    const ranks=new Map(graph.nodes.map(node=>[node.id,0]));
    for(const edge of graph.edges)if(degree.has(edge.to)&&degree.has(edge.from))degree.set(edge.to,degree.get(edge.to)+1);
    const queue=graph.nodes.filter(node=>degree.get(node.id)===0).map(node=>node.id);
    const order=[];
    while(queue.length){const identifier=queue.shift();order.push(identifier);for(const edge of graph.edges.filter(edge=>edge.from===identifier&&degree.has(edge.to))){ranks.set(edge.to,Math.max(ranks.get(edge.to),ranks.get(identifier)+1));degree.set(edge.to,degree.get(edge.to)-1);if(degree.get(edge.to)===0)queue.push(edge.to);}}
    return {ranks,order,cyclic:order.length!==graph.nodes.length};
  }
  function numbers(graph){
    const order=levels(graph).order;
    return Object.fromEntries([...order,...graph.nodes.filter(node=>!order.includes(node.id)).map(node=>node.id)].map((id,index)=>[id,String(index+1).padStart(2,'0')]));
  }
  function applyDraft(next,snapshot){
    if(next.projectId!==current().id||snapshot!==JSON.stringify(data()))throw new Error('原流程已变化，请重新生成或核对，未覆盖你的修改。');
    if(hasEdits())throw new Error('请先保存手动编辑中的节点、连线或头像。');
    const errors=validate(next);if(errors.length)throw new Error(errors.join('\n'));
    save(structuredClone(next));
    view().selected='';view().selectedEdge='';view().connect='';
  }
  function preview(graph,changes=[],selected='',zoom=1){
    const dimensions=geometry(graph);const sequence=numbers(graph);
    const links=graph.edges.map(edge=>{
      const from=graph.nodes.find(node=>node.id===edge.from);const to=graph.nodes.find(node=>node.id===edge.to);if(!from||!to)return '';
      const slot=graph.edges.filter(entry=>entry.from===from.id).findIndex(entry=>entry.id===edge.id);
      const start=anchor(graph,from,false,slot);const end=anchor(graph,to,true);const middle={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
      return `<g class="od-link"><path d="${curve(start,end,graph.layout==='vertical')}" marker-end="url(#od-arrow)"></path><rect x="${middle.x-66}" y="${middle.y-12}" width="132" height="24" rx="4"></rect><text x="${middle.x}" y="${middle.y+4}" text-anchor="middle">${escape(edge.label)}</text></g>`;
    }).join('');
    return `<div class="od-flow-viewport" id="od-flow-viewport" tabindex="0" aria-label="流程预览，可滚动查看并选择步骤"><div style="width:${dimensions.width*zoom}px;height:${dimensions.height*zoom}px"><div class="od-flow-stage" style="width:${dimensions.width}px;height:${dimensions.height}px;transform:scale(${zoom})"><svg class="od-flow-lines" width="${dimensions.width}" height="${dimensions.height}" aria-hidden="true"><defs><marker id="od-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10" fill="#617953"></path></marker></defs>${links}</svg>${graph.nodes.map(node=>`<button class="od-node ${selected===node.id?'is-selected':''} ${changes.some(change=>change.id===node.id)?'is-changed':''}" data-action="od-select" data-id="${escape(node.id)}" style="left:${node.x}px;top:${node.y}px" aria-pressed="${selected===node.id}" aria-label="第${sequence[node.id]}步：${escape(node.name)}"><span><b>${sequence[node.id]}</b>${types[node.type].label}</span><strong>${escape(node.name)}</strong><small>${escape(node.description)}</small>${changes.some(change=>change.id===node.id)?'<i>有修改</i>':''}</button>`).join('')}</div></div></div>`;
  }
  function arrange(graph,layout=graph.layout,density=graph.density) {
    const copy=structuredClone(graph);const {ranks}=levels(copy);const gap=density==='compact'?52:88;
    const grouped=new Map();for(const node of copy.nodes){const rank=ranks.get(node.id);if(!grouped.has(rank))grouped.set(rank,[]);grouped.get(rank).push(node);}
    const widest=Math.max(1,...[...grouped.values()].map(group=>group.length));
    for(const [rank,nodes] of grouped)nodes.forEach((node,index)=>{
      const across=(widest-nodes.length)/2+index;
      node.x=60+(layout==='horizontal'?rank*(nodeSize.width+gap+88):across*(nodeSize.width+gap));
      node.y=60+(layout==='horizontal'?across*(nodeSize.height+gap):rank*(nodeSize.height+gap+24));
    });
    copy.layout=layout;copy.density=density;return copy;
  }
  function validate(graph) {
    const errors=[];
    if(!graph.name.trim()||graph.name.length>32||/[\s@，,。；;]/.test(graph.name))errors.push('填写 32 字以内、不含空格或 @ 的助手名称。');
    if(!graph.nodes.length)errors.push('至少添加业务入口、处理节点和交付结果。');
    if(graph.nodes.length>20||graph.edges.length>32)errors.push('一个草案最多 20 个节点、32 条连线。');
    if(graph.nodes.filter(node=>node.type==='start').length!==1)errors.push('流程必须有且只有一个业务入口。');
    if(!graph.nodes.some(node=>node.type==='end'))errors.push('添加至少一个交付结果。');
    const identifiers=new Set(graph.nodes.map(node=>node.id));
    if(identifiers.size!==graph.nodes.length)errors.push('节点标识重复。');
    if(new Set(graph.edges.map(edge=>edge.id)).size!==graph.edges.length||new Set(graph.edges.map(edge=>edge.from+'→'+edge.to)).size!==graph.edges.length)errors.push('连线标识或连接关系重复。');
    if(graph.edges.some(edge=>!identifiers.has(edge.from)||!identifiers.has(edge.to)||edge.from===edge.to))errors.push('连线端点无效。');
    if(graph.edges.some(edge=>!edge.label?.trim()||edge.label.length>12))errors.push('每条关系需填写 12 字以内的说明。');
    if(levels(graph).cyclic)errors.push('当前仅支持无环流程；回退业务请用人工处理节点描述，不建立循环。');
    for(const node of graph.nodes){
      const incoming=graph.edges.filter(edge=>edge.to===node.id);const outgoing=graph.edges.filter(edge=>edge.from===node.id);
      if(!types[node.type]||!node.name?.trim()||!node.description?.trim())errors.push(`${node.name||'未命名节点'}：补齐名称与业务定义。`);
      if(node.name?.length>20||node.description?.length>180||node.fields?.length>160||node.keywords?.length>120||node.capability?.length>60)errors.push(`${node.name}：内容超过编辑上限，请精简后再保存。`);
      if(node.type==='start'&&incoming.length)errors.push('业务入口不能有前置连线。');
      if(node.type!=='start'&&!incoming.length)errors.push(`${node.name}：尚未连接到业务入口。`);
      if(node.type==='end'&&outgoing.length)errors.push(`${node.name}：交付结果不能继续向外连接。`);
      if(node.type!=='end'&&!outgoing.length)errors.push(`${node.name}：请连接下一步。`);
      if(node.type==='condition'&&(outgoing.length!==2||outgoing.some(edge=>!edge.label.trim())||new Set(outgoing.map(edge=>edge.label.trim())).size!==2))errors.push(`${node.name}：需要两条不同条件的分支。`);
      if(!['condition','end'].includes(node.type)&&outgoing.length>1)errors.push(`${node.name}：多路径请通过条件分支节点表达。`);
      if(node.type==='collect'&&!split(node.fields).length)errors.push(`${node.name}：填写要收集的必要信息。`);
    }
    if(!graph.nodes.some(node=>node.type==='start'&&split(node.keywords).length))errors.push('业务入口需填写受理关键词，用于当前本地演练。');
    if(!graph.nodes.some(node=>split(node.fields).length))errors.push('至少定义一项必要信息。');
    return [...new Set(errors)];
  }
  function definitions(graph) {
    return graph.nodes.map(node=>({id:node.id,type:node.type==='start'?'业务表达':node.type==='collect'?'业务对象':node.type==='condition'?'处理规则':node.type==='human'?'人工边界':node.type==='action'?'动作定义':'交付定义',name:node.name,description:node.description,fields:split(node.fields),branches:graph.edges.filter(edge=>edge.from===node.id).map(edge=>({condition:edge.label,next:graph.nodes.find(node=>node.id===edge.to)?.name||'缺失节点'}))}));
  }
  function compile(graph,projectId) {
    if(graph.projectId!==projectId)throw new Error('不能使用其他项目的流程。');
    const errors=validate(graph);if(errors.length)throw new Error(errors.join('\n'));
    const projected=definitions(graph);
    const brief=projected.map(node=>`${node.name}：${node.description}${node.branches.length?' 下一步：'+node.branches.map(branch=>`${branch.condition||'继续'} → ${branch.next}`).join('；'):''}`).join('\n');
    const fields=split(graph.nodes.map(node=>node.fields).join(','));
    const keywords=split(graph.nodes.filter(node=>node.type==='start').map(node=>node.keywords).join(','));
    const transferWords=split(graph.nodes.filter(node=>node.type==='human').map(node=>node.keywords).join(','));
    if(fields.join(',').length>160||keywords.join(',').length>200||transferWords.join(',').length>200)throw new Error('必要信息或关键词超过配置上限，请合并重复字段或拆分业务。');
    const fullPrompt=`你是${graph.name}。\n按以下经人工核对的业务流程处理：\n${brief}\n边界：信息不足先追问，候选原因不得当作事实，未接入的能力不得声称执行成功；外部操作需授权与人工确认。`;
    if(fullPrompt.length>1200)throw new Error('流程定义超过配置页 1200 字上限，请精简节点说明后再生成；不会截断你的规则。');
    return {name:graph.name,goal:('按流程处理业务：'+graph.nodes.filter(node=>['start','end'].includes(node.type)).map(node=>node.name).join(' → ')).slice(0,400),keywords:keywords.join(','),fields:fields.join(','),transferWords:transferWords.join(','),tool:graph.nodes.some(node=>node.type==='action'&&node.tool==='form')?'form':'summary',handoff:'缺少依据先追问；涉及人工请求、安全风险或权限不足时交由负责人核实。',knowledge:'流程定义 F'+graph.revision+' · 独立快照，未自动写入共享本体',prompt:fullPrompt,provider:'未连接',model:'',connectionRef:'',avatar:window.HubIdentity.appearance(graph.avatar,graph.id),flowDesign:{schema:1,projectId,flowId:graph.id,revision:graph.revision,definitions:projected,graph:structuredClone(graph),confirmed:false,execution:'definition-only'},businessDesign:{schema:1,projectId,brief,requests:split(graph.nodes.filter(node=>node.type==='action').map(node=>node.capability).join('\n')).map(name=>({name,status:'not-connected'})),source:'local-flow-definition',confirmed:false}};
  }
  function layoutCommand(graph,command) {
    const text=String(command||'').trim();if(!text||text.length>120)throw new Error('请输入 120 字以内的布局指令。');
    const horizontal=/横向|从左到右|水平/.test(text);const vertical=/纵向|从上到下|垂直/.test(text);
    const compact=/紧凑/.test(text);const comfortable=/宽松|疏朗/.test(text);
    if((horizontal&&vertical)||(compact&&comfortable))throw new Error('指令包含冲突布局，请只选择一个方向和一种间距。');
    const remainder=text.replace(/从左到右|从上到下|横向|纵向|水平|垂直|紧凑|宽松|疏朗|自动整理|重新排列|请|帮我|把|将|整个|全局|流程|画布|节点|布局|排版|方向|间距|调整|改成|改为|设置|排列|变得|一些|一点|和|并|为|成|，|。|、|\s/g,'');
    if(remainder||(!horizontal&&!vertical&&!compact&&!comfortable&&!/自动整理|重新排列/.test(text)))throw new Error('当前只支持布局指令，例如“从左到右，间距紧凑”。不解析任意业务改写，尚未连接语义模型。');
    return arrange(graph,horizontal?'horizontal':vertical?'vertical':graph.layout,compact?'compact':comfortable?'comfortable':graph.density);
  }
  function freePosition(graph,identifier,x,y) {
    const origin={x:Math.max(24,Math.min(7000,Math.round(x/12)*12)),y:Math.max(24,Math.min(7000,Math.round(y/12)*12))};
    const clear=position=>graph.nodes.every(node=>node.id===identifier||Math.abs(position.x-node.x)>=nodeSize.width+16||Math.abs(position.y-node.y)>=nodeSize.height+16);
    if(clear(origin))return origin;
    for(let ring=1;ring<80;ring++)for(const offset of [[ring,0],[-ring,0],[0,ring],[0,-ring],[ring,ring],[-ring,ring]]){const position={x:Math.max(24,origin.x+offset[0]*36),y:Math.max(24,origin.y+offset[1]*36)};if(clear(position))return position;}
    return {x:Math.max(24,...graph.nodes.map(node=>node.x+nodeSize.width+24)),y:24};
  }
  function save(next,semantic=true) {
    const state=view();state.undo.push(structuredClone(data()));state.undo=state.undo.slice(-20);state.redo=[];
    next.revision=data().revision+(semantic?1:0);next.layoutRevision=data().layoutRevision+1;
    workspace().businessFlow=next;state.pending=null;state.agent.proposal=null;state.review=null;state.error='';window.PortfolioHub.persist();
  }
  function refresh(focusId,animateLayout=false) {
    const positions=new Map([...document.querySelectorAll('.flow-node')].map(node=>[node.dataset.node,{x:parseFloat(node.style.left),y:parseFloat(node.style.top)}]));
    const viewport=document.getElementById('flow-viewport');const scroll=viewport?{left:viewport.scrollLeft,top:viewport.scrollTop}:null;const main=document.getElementById('main-content');const top=main?.scrollTop||0;const focusedTop=document.querySelector('.orbit-flow.is-focused')?.scrollTop||0;const sideTop=document.querySelector('.flow-agent-panel,.flow-inspector')?.scrollTop||0;
    host.render();if(scroll)document.getElementById('flow-viewport')?.scrollTo(scroll.left,scroll.top);if(main)document.getElementById('main-content').scrollTop=top;if(focusedTop)document.querySelector('.orbit-flow.is-focused')?.scrollTo(0,focusedTop);if(sideTop)document.querySelector('.flow-agent-panel,.flow-inspector')?.scrollTo(0,sideTop);if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
    if(animateLayout&&!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const node of document.querySelectorAll('.flow-node')){const before=positions.get(node.dataset.node);if(before)node.animate([{transform:`translate(${before.x-parseFloat(node.style.left)}px,${before.y-parseFloat(node.style.top)}px)`},{transform:'none'}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'});}
  }
  function add(type,position) {
    if(!types[type])return;
    if(data().nodes.length>=20)throw new Error('最多 20 个节点，请拆分业务流程。');
    if(type==='start'&&data().nodes.some(node=>node.type==='start'))throw new Error('已有业务入口，不重复添加。');
    const graph=structuredClone(data());const id=uid('node');
    const placement=freePosition(graph,id,position?.x||60,position?.y||60);
    graph.nodes.push({id,type,name:types[type].label,description:'',keywords:'',fields:'',capability:'',tool:'summary',...placement});view().selected=id;view().selectedEdge='';view().side='node';view().connect='';save(graph);refresh('flow-node-name');
  }
  function addConnection(graph,from,to,label='',port) {
    const source=graph.nodes.find(node=>node.id===from);const target=graph.nodes.find(node=>node.id===to);
    if(!source||!target||from===to)throw new Error('请选择不同的有效节点。');
    if(graph.edges.length>=32)throw new Error('最多 32 条连线。');
    if(source.type==='end'||target.type==='start')throw new Error('交付结果不能向外连线，业务入口不能作为下一步。');
    if(graph.edges.some(edge=>edge.from===from&&edge.to===to))throw new Error('这两个节点已经连接。');
    const count=graph.edges.filter(edge=>edge.from===from).length;
    if(count>=(source.type==='condition'?2:1))throw new Error(source.type==='condition'?'条件节点最多两条分支。':'需要多条路径时，请添加条件分支节点。');
    const used=graph.edges.filter(edge=>edge.from===from).map((edge,index)=>edge.fromPort??index);const slot=port??[0,1].find(value=>!used.includes(value));
    if(used.includes(slot)||slot<0||slot>=(source.type==='condition'?2:1))throw new Error('这个出口已经连接。请先断开，或从另一分支出口连线。');
    graph.edges.push({id:uid('edge'),from,to,label:label||(source.type==='condition'?(slot?'不满足条件':'满足条件'):'继续'),fromPort:slot});
    if(levels(graph).cyclic)throw new Error('这条连线会形成循环，已阻止。');
    return graph;
  }
  function connect(from,to,label='',port=view().connectPort) {
    const graph=addConnection(structuredClone(data()),from,to,label,port);
    save(graph);view().connect='';refresh();
  }
  function updateEdge(graph,identifier,values) {
    const next=structuredClone(graph);const edge=next.edges.find(entry=>entry.id===identifier);
    if(!edge)throw new Error('这条连线已删除，请重新选择。');
    for(const node of next.nodes)next.edges.filter(entry=>entry.from===node.id).forEach((entry,index)=>{entry.fromPort??=index;});
    const from=values.from??edge.from;const to=values.to??edge.to;const label=String(values.label??edge.label).trim();
    if(!label||label.length>12)throw new Error('请填写 12 字以内的关系或分支条件。');
    next.edges=next.edges.filter(entry=>entry.id!==identifier);
    if(next.nodes.find(node=>node.id===from)?.type==='condition'&&next.edges.some(entry=>entry.from===from&&entry.label===label))throw new Error('两个分支条件不能相同，请分别说明。');
    addConnection(next,from,to,label,from===edge.from?edge.fromPort:undefined);
    const replacement=next.edges.pop();replacement.id=edge.id;
    next.edges.splice(graph.edges.findIndex(entry=>entry.id===identifier),0,replacement);
    return next;
  }
  function editSelection(identifier,edge=false) {
    const state=view();state.side='node';state.connect='';state.selected=edge?'':identifier;state.selectedEdge=edge?identifier:'';
    refresh(edge?'flow-edge-label':'flow-node-name');
    document.querySelector('.flow-inspector')?.scrollTo(0,0);
    document.querySelector('.flow-side')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function selectionBar() {
    const state=view();const graph=data();const edge=graph.edges.find(entry=>entry.id===state.selectedEdge);const node=edge?null:graph.nodes.find(entry=>entry.id===state.selected);
    const locked=state.pending||state.agent.proposal;
    const label=edge?graph.nodes.find(entry=>entry.id===edge.from)?.name+' → '+graph.nodes.find(entry=>entry.id===edge.to)?.name:node?.name;
    return `<div class="flow-selection-bar" aria-label="选中内容操作"><div><span>${edge?'已选连线':node?'已选节点':'编辑画布'}</span><strong>${escape(label||'点击节点或连线')}</strong></div>${edge||node?`<div class="flow-selection-actions">${button(host.icon('pencil','small')+' '+(edge?'编辑连线':'编辑节点'),edge?'edge-edit':'edit',`data-id="${escape(edge?.id||node.id)}" ${locked?'disabled':''}`,'small')}${button(host.icon('trash','small')+' '+(edge?'删除连线':'删除节点'),edge?'unlink':'remove',`data-id="${escape(edge?.id||node.id)}" ${locked?'disabled':''}`,'small flow-danger')}</div>`:'<small>拖动调整位置 · 选中后可编辑或删除</small>'}</div>`;
  }
  function anchor(graph,node,incoming=false,port=0) {
    const vertical=graph.layout==='vertical';const ratio=!incoming&&node.type==='condition'?(port===1?.74:.26):.5;
    return {x:node.x+(vertical?nodeSize.width*ratio:incoming?0:nodeSize.width),y:node.y+(vertical?incoming?0:nodeSize.height:nodeSize.height*ratio)};
  }
  function curve(start,end,vertical) {const middle={x:(start.x+end.x)/2,y:(start.y+end.y)/2};return vertical?`M${start.x},${start.y} C${start.x},${middle.y} ${end.x},${middle.y} ${end.x},${end.y}`:`M${start.x},${start.y} C${middle.x},${start.y} ${middle.x},${end.y} ${end.x},${end.y}`;}
  function markers() {return '<defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10" fill="#567448"></path></marker></defs>';}
  function geometry(graph) {
    return {width:Math.max(840,...graph.nodes.map(node=>node.x+nodeSize.width+90)),height:Math.max(540,...graph.nodes.map(node=>node.y+nodeSize.height+90))};
  }
  function paths(graph) {
    return graph.edges.map(edge=>{
      const from=graph.nodes.find(node=>node.id===edge.from);const to=graph.nodes.find(node=>node.id===edge.to);if(!from||!to)return '';
      const vertical=graph.layout==='vertical';
      const slot=edge.fromPort??graph.edges.filter(item=>item.from===from.id).findIndex(item=>item.id===edge.id);
      const start=anchor(graph,from,false,slot);const end=anchor(graph,to,true);
      if(vertical){start.y+=12;end.y-=16;}else{start.x+=12;end.x-=16;}
      const middle={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
      const path=curve(start,end,vertical);
      const characters=Array.from(edge.label);const lines=characters.length>8?[characters.slice(0,8).join(''),characters.slice(8).join('')]:[edge.label];
      const width=Math.max(38,...lines.map(line=>Array.from(line).length*12+20));const height=lines.length===1?24:44;
      return `<g class="flow-link ${from.type==='condition'?'is-condition':''} ${view().selectedEdge===edge.id?'selected':''}" data-edge="${escape(edge.id)}" data-action="flow-edge-select" data-id="${escape(edge.id)}" role="button" tabindex="0" aria-label="编辑连线：${escape(from.name)}，${escape(edge.label)}，${escape(to.name)}"><path d="${path}" marker-end="url(#flow-arrow)"></path><path class="flow-edge-hit" d="${path}"></path><rect x="${middle.x-width/2}" y="${middle.y-height/2}" width="${width}" height="${height}" rx="5"></rect><text text-anchor="middle">${lines.map((line,index)=>`<tspan x="${middle.x}" y="${middle.y+(lines.length===1?4:-5+index*18)}">${escape(line)}</tspan>`).join('')}</text><g class="flow-edge-add" data-action="flow-insert-menu" data-id="${escape(edge.id)}" role="button" tabindex="0" aria-label="在${escape(from.name)}与${escape(to.name)}之间插入节点"><circle cx="${middle.x}" cy="${middle.y+height/2+14}" r="10"/><text x="${middle.x}" y="${middle.y+height/2+19}" text-anchor="middle">+</text></g></g>`;
    }).join('');
  }
  function edgeInspector(edge) {
    const graph=data();const from=graph.nodes.find(node=>node.id===edge.from);const to=graph.nodes.find(node=>node.id===edge.to);
    return `<aside class="flow-inspector"><header><span class="flow-eyebrow">连线与分支</span>${button(host.icon('trash','small')+' 删除连线','unlink',`data-id="${escape(edge.id)}"`,'small flow-danger')}</header><h3>${escape(from.name)}<br>→ ${escape(to.name)}</h3><form class="flow-edge-form" data-id="${escape(edge.id)}"><label>起点<select name="from" aria-label="连线起点">${graph.nodes.filter(node=>node.type!=='end').map(node=>`<option value="${escape(node.id)}" ${(view().edgeDrafts[edge.id]?.from??edge.from)===node.id?'selected':''}>${escape(node.name)}</option>`).join('')}</select></label><label>终点<select name="to" aria-label="连线终点">${graph.nodes.filter(node=>node.type!=='start').map(node=>`<option value="${escape(node.id)}" ${(view().edgeDrafts[edge.id]?.to??edge.to)===node.id?'selected':''}>${escape(node.name)}</option>`).join('')}</select></label><label>关系 / 分支条件<input id="flow-edge-label" name="label" value="${escape(view().edgeDrafts[edge.id]?.label??edge.label)}" maxlength="12" required aria-label="分支条件"></label><button class="button primary" type="submit">保存连线</button></form><h4>在线上插入步骤</h4><p>自动接回原来的下一步，保留原分支条件。</p><div class="flow-edge-insert-options">${['collect','action','human','condition'].map(type=>button(host.icon(types[type].icon,'small')+' '+types[type].label,'edge-insert',`data-id="${escape(edge.id)}" data-value="${type}"`)).join('')}</div><p class="flow-node-hint">点击连线可修改条件；节点边缘的圆点支持按住拉线，也支持先点击出口、再点击入口。</p></aside>`;
  }
  function inspector() {
    const graph=data();const original=graph.nodes.find(node=>node.id===view().selected);const selected=original?{...original,...view().nodeDrafts[original.id]}:null;
    const edge=graph.edges.find(item=>item.id===view().selectedEdge);if(edge)return edgeInspector(edge);
    if(!selected)return `<aside class="flow-inspector"><span class="flow-eyebrow">步骤编辑</span><h3>选择节点以编辑</h3><p>整张卡片都能拖动；从边缘的箭头圆点拉线到下一节点入口。点击连线可改条件或插入步骤。</p><div class="flow-tip">调整布局不会更改业务规则。生成草案后，仍需核对字段、案例和转人工条件。</div></aside>`;
    const outgoing=graph.edges.filter(edge=>edge.from===selected.id);
    return `<aside class="flow-inspector"><header><span class="flow-eyebrow">${types[selected.type].label}</span>${button(host.icon('trash','small')+' 删除节点','remove',`data-id="${escape(selected.id)}"`,'small flow-danger')}</header><form id="flow-node-form" data-id="${escape(selected.id)}"><label>节点名称<input id="flow-node-name" name="name" required maxlength="20" value="${escape(selected.name)}"></label><label>步骤说明与处理边界<textarea name="description" rows="4" maxlength="180" placeholder="此步做什么？依据是什么？不能做什么？">${escape(selected.description)}</textarea></label>${['collect','condition'].includes(selected.type)?`<label>必要信息（逗号分隔）<input name="fields" maxlength="160" value="${escape(selected.fields)}" placeholder="设备型号,故障现象"></label>`:''}${['start','human'].includes(selected.type)?`<label>${selected.type==='start'?'受理关键词':'转人工关键词'}<input name="keywords" maxlength="120" value="${escape(selected.keywords)}" placeholder="逗号分隔"></label>`:''}${selected.type==='action'?`<label>需要的业务能力<input name="capability" maxlength="60" value="${escape(selected.capability)}" placeholder="例如：查询保修状态"></label><p class="flow-tip">登记需求不等于已接入工具。</p><label>本地演练<select name="tool"><option value="summary" ${selected.tool==='summary'?'selected':''}>整理信息摘要</option><option value="form" ${selected.tool==='form'?'selected':''}>准备表单草稿</option></select></label>`:''}<button class="button primary" type="submit">保存步骤</button></form><section class="flow-connections"><h4>下一步 <span>${outgoing.length}</span></h4>${outgoing.map(edge=>`<form class="flow-edge-form" data-id="${escape(edge.id)}"><strong>→ ${escape(graph.nodes.find(node=>node.id===edge.to)?.name)}</strong><label class="sr-only" for="flow-label-${escape(edge.id)}">分支条件</label><input id="flow-label-${escape(edge.id)}" name="label" value="${escape(view().edgeDrafts[edge.id]?.label??edge.label)}" required maxlength="12" aria-label="分支条件"><div><button type="submit" class="button quiet small">保存关系</button>${button(host.icon('trash','small')+' 删除连线','unlink',`data-id="${escape(edge.id)}"`,'small flow-danger')}</div></form>`).join('')||'<p>尚无下一步。</p>'}${selected.type!=='end'?button(view().connect===selected.id?'取消连接':'连接下一步','connect',`data-id="${escape(selected.id)}" aria-pressed="${view().connect===selected.id}"`):''}</section></aside>`;
  }
  function ports(graph,node) {
    const incoming=node.type!=='start'?button('→','target',`data-id="${escape(node.id)}" data-flow-port="in" aria-label="连接到${escape(node.name)}的入口"`,'flow-port flow-port-in'):'';
    const count=node.type==='condition'?2:node.type==='end'?0:1;
    return incoming+Array.from({length:count},(_,index)=>button('→','connect',`data-id="${escape(node.id)}" data-flow-port="out" data-port="${index}" style="--port-ratio:${count===2?(index?.74:.26):.5}" aria-label="从${escape(node.name)}${count===2?'分支'+(index+1):''}拉线连接下一步"`,'flow-port flow-port-out')).join('');
  }
  function stage() {
    const state=view();const proposal=state.agent.proposal;const graph=proposal?.graph||state.pending?.graph||data();const dimensions=geometry(graph);const preview=!!proposal||!!state.pending;
    return `<div id="flow-viewport" class="flow-viewport" tabindex="0" aria-label="流程画布，拖动空白处平移，拖动节点移动，方向键可微调"><div class="flow-stage-space" style="width:${dimensions.width*state.zoom}px;height:${dimensions.height*state.zoom}px"><div id="flow-stage" class="flow-stage is-${graph.layout}" ${preview?'inert aria-label="待确认修改预览"':''} style="width:${dimensions.width}px;height:${dimensions.height}px;transform:scale(${state.zoom})"><svg class="flow-lines" width="${dimensions.width}" height="${dimensions.height}" aria-label="业务流程连线">${markers()}${paths(graph)}</svg>${graph.nodes.map(node=>`<article class="flow-node flow-type-${node.type} ${state.selected===node.id?'selected':''} ${state.connect===node.id?'connecting':''} ${proposal?.changes.some(change=>change.id===node.id)?'is-proposed':''} ${proposal?.changes.some(change=>change.id===node.id&&change.kind==='add')?'is-new':''}" data-node="${escape(node.id)}" style="left:${node.x}px;top:${node.y}px"><button class="flow-node-body" data-flow-drag="${escape(node.id)}" data-action="flow-select" data-id="${escape(node.id)}" aria-pressed="${state.selected===node.id}" aria-label="${state.connect?'连接到':'编辑'}${escape(node.name)}"><span><b class="flow-node-number">${numbers(graph)[node.id]}</b>${types[node.type].label}</span><strong>${escape(node.name)}</strong><small>${escape(node.description||'点击补充步骤说明')}</small></button><div class="flow-node-actions">${button('编辑','edit',`data-id="${escape(node.id)}" aria-label="编辑节点：${escape(node.name)}"`,'flow-node-edit')}${button(host.icon('trash','small'),'remove',`data-id="${escape(node.id)}" aria-label="删除节点：${escape(node.name)}" title="删除节点"`,'flow-node-delete')}</div>${node.type==='action'?'<span class="flow-node-state">工具未接入</span>':node.type==='condition'?'<span class="flow-node-state">定义 · 非执行</span>':''}${ports(graph,node)}</article>`).join('')}${!graph.nodes.length?'<div class="flow-empty"><span>空白画布</span><h3>添加第一个节点</h3><p>从上方拖入节点，或载入售后示例。拖动卡片可移动位置，从箭头圆点可连接下一步。</p></div>':''}</div></div></div>`;
  }
  function agentPanel() {
    const state=view();const agent=state.agent;const proposal=agent.proposal;const selected=data().nodes.find(node=>node.id===state.selected);
    return `<aside class="flow-agent-panel"><h3>修改画布</h3><span class="flow-agent-status">本地指令模式 · 语义模型未连接</span><p>只修改当前画布，不改已发布助手。</p><form id="flow-agent-form"><label>修改范围<select name="target" id="flow-agent-target"><option value="">全局 · 请写明节点名称</option>${data().nodes.map(node=>`<option value="${escape(node.id)}" ${selected?.id===node.id?'selected':''}>选中：${escape(node.name)}</option>`).join('')}</select></label><label for="flow-agent-command">修改要求<textarea id="flow-agent-command" name="command" rows="5" maxlength="1600" placeholder="修改选中节点的说明为「先核实资料，再交给人工确认」&#10;横向紧凑" required>${escape(agent.input)}</textarea></label><button class="button primary" type="submit">预览修改</button></form><div class="flow-agent-examples">${[['content','改节点内容'],['insert','插入确认步骤'],['layout','调整布局']].map(([value,label])=>button(label,'agent-example',`data-value="${value}"`)).join('')}</div>${state.error?`<p class="flow-error" role="alert">${escape(state.error)}</p>`:''}${proposal?`<section class="flow-agent-plan"><h4>${proposal.changes.length} 项待确认修改</h4><p>画布预览尚未保存。绿色边框标出变更节点。</p>${proposal.changes.map(change=>`<article class="flow-agent-diff"><strong>${escape(change.label)}</strong><del>${escape(change.before)}</del><ins>${escape(change.after)}</ins></article>`).join('')}${proposal.warnings.length?`<div class="flow-agent-warning">保存为草稿后仍需补齐：<ul>${proposal.warnings.map(warning=>`<li>${escape(warning)}</li>`).join('')}</ul></div>`:''}${proposal.requiresRisk?'<label><input type="checkbox" id="flow-agent-risk">我已核对删除 / 人工边界变更及断开的关系</label>':''}<div class="flow-agent-actions">${button('确认应用','agent-apply','','primary small')}${button('放弃修改','agent-cancel')}</div></section>`:''}<details class="flow-agent-history"><summary>支持的指令格式</summary><p>一行一条，名称和内容用「」包围。任一指令格式不支持时，本批修改均不会应用。</p><ul><li>将「节点名称」改名为「新名称」</li><li>修改选中节点的说明为「业务说明」</li><li>修改「收集信息」的必要字段为「设备型号,故障现象」</li><li>在「处理动作」后添加人工确认「负责人复核」</li><li>连接「节点甲」到「节点乙」，条件「满足条件」</li><li>断开「节点甲」到「节点乙」</li><li>删除「节点名称」</li><li>横向紧凑</li></ul></details>${agent.history.length?`<div class="flow-agent-history">本次编辑记录<ul>${agent.history.slice(-4).reverse().map(entry=>`<li>${entry.count} 项修改已应用 · F${entry.revision}</li>`).join('')}</ul><p>可用画布「撤销」恢复。</p></div>`:''}</aside>`;
  }
  function side() {return `<div class="flow-side"><nav class="flow-side-tabs" aria-label="画布编辑面板">${button('节点与连线','side','data-value="node" aria-pressed="'+(view().side==='node')+'"')}${button(host.icon('sparkles','small')+' 画布指令','side','data-value="agent" aria-pressed="'+(view().side==='agent')+'"')}</nav>${view().side==='agent'?agentPanel():inspector()}</div>`;}
  function review() {
    const config=view().review;if(!config)return '';
    return `<section class="flow-review" id="flow-review" tabindex="-1"><header><div><span class="flow-eyebrow">流程步骤 → 助手草案</span><h3>${escape(config.name)}</h3></div>${window.HubIdentity.assistant(config,'lg')}</header><div class="flow-definition-list">${config.flowDesign.definitions.map(node=>`<article><span>${node.type}</span><div><strong>${escape(node.name)}</strong><p>${escape(node.description)}</p>${node.fields.length?`<small>必要信息：${node.fields.map(escape).join('、')}</small>`:''}${node.branches.map(branch=>`<small>${escape(branch.condition)} → ${escape(branch.next)}</small>`).join('')}</div></article>`).join('')}</div><p class="flow-tip">保留流程步骤与已引用定义的快照，不重复创建共享定义。条件分支当前只用于定义审阅；本地运行仍是关键词分流与字段检查，不能执行任意流程或验证 Prompt 语义。</p><form id="flow-confirm-form"><label><input type="checkbox" name="confirmed" required>我已核对业务定义，理解模型与业务工具尚未接入。</label><button type="submit" class="button primary">创建助手草案，继续配置</button></form></section>`;
  }
  function page() {
    const graph=data();const state=view();const identity=state.identityDraft?{...graph,name:state.identityDraft.name,avatar:{art:state.identityDraft.avatarArt,tone:state.identityDraft.avatarTone}}:graph;
    return `<section class="orbit-flow ${state.focus?'is-focused':''}" aria-label="业务流程设计器">
      <header class="flow-heading"><div><h2>业务流程</h2></div><div>${button(host.icon('sparkles','small')+' 指令修改','side','data-value="agent"')}${button('载入售后示例','sample')}${button(state.focus?'退出专注':'展开画布','focus',`aria-pressed="${!!state.focus}"`)}</div></header>
      <details class="flow-identity-settings" ${state.identityDraft?'open':''}><summary>${window.HubIdentity.assistant(identity,'sm')}<span><strong>${escape(identity.name||'设置助手名称与头像')}</strong><small>名称与头像</small></span>${host.icon('chevron-down','small')}</summary><form id="flow-identity-form" class="flow-identity"><label>助手名称<input name="name" maxlength="32" value="${escape(identity.name)}" placeholder="例如：门店巡检助手" required></label>${window.HubIdentity.picker(identity,'flow')}<button type="submit" class="button small">保存名称与头像</button></form></details>
      <div class="flow-palette" aria-label="业务节点工具箱">${Object.entries(types).map(([type,definition])=>`<button draggable="true" data-flow-type="${type}" data-action="flow-add" data-value="${type}" aria-label="添加${definition.label}">${host.icon(definition.icon,'small')}${definition.label}<span>+</span></button>`).join('')}</div>
      <details class="flow-command-disclosure" ${state.command||state.pending?'open':''}><summary>快速排版</summary><div class="flow-command"><form id="flow-command-form"><label class="sr-only" for="flow-command">用文字调整全局排版</label><input id="flow-command" name="command" maxlength="120" value="${escape(state.command)}" placeholder="布局指令，例如：从左到右，间距紧凑"><button type="submit" class="button small">预览调整</button></form><details><summary>支持哪些指令？</summary><p>横向 / 纵向、紧凑 / 宽松、自动整理。仅本地布局指令，不调用模型，不改业务逻辑。</p></details></div></details>
      ${state.pending?`<div class="flow-command-preview" role="status"><div><strong>预览中：${state.pending.graph.layout==='horizontal'?'从左到右':'从上到下'} · ${state.pending.graph.density==='compact'?'紧凑':'宽松'}</strong><p>画布展示待应用布局；业务规则不变。应用或取消后继续编辑。</p></div><div>${button('应用布局','apply-layout','','primary small')}${button('取消','cancel-layout')}</div></div>`:''}
      <div class="flow-toolbar"><span>${graph.nodes.length} 个节点 · ${graph.edges.length} 条关系 · F${graph.revision}</span><div><label class="flow-snap"><input type="checkbox" id="flow-snap" ${state.snap?'checked':''}>网格吸附</label>${button('撤销','undo',state.undo.length?'':'disabled')}${button('重做','redo',state.redo.length?'':'disabled')}${button('自动整理','arrange')}${button('−','zoom','data-value="out" aria-label="缩小流程"'+(state.zoom<=.65?' disabled':''))}<span>${Math.round(state.zoom*100)}%</span>${button('+','zoom','data-value="in" aria-label="放大流程"'+(state.zoom>=1.5?' disabled':''))}</div></div>
      ${selectionBar()}${state.connect?`<div class="flow-connect-status" role="status"><span>正在连线：点击或拖到下一节点的入口 · Esc 取消</span>${button('取消连线','cancel-connect')}</div>`:''}<p class="flow-error" id="flow-error" role="alert">${escape(state.error)}</p><div class="flow-editor">${stage()}${side()}</div>
      <footer class="flow-bottom"><div><details class="copy-help"><summary>画布操作</summary><p>拖动卡片调整位置；从箭头圆点拉线；拖动空白处平移；点击连线修改。</p></details><small id="flow-save-status" role="status">${hasEdits()?'有未保存编辑 · 切换节点不会丢失，请保存后生成助手':'已保存到当前项目'}</small></div>${button('核对业务定义 '+host.icon('arrow-right','small'),'compile','','primary')}</footer>${review()}
    </section>`;
  }
  function dispatch(name,element) {
    if(!current())return;const state=view();const graph=data();const identifier=element.dataset.id;
    try {
      if((state.pending||state.agent.proposal)&&['add','remove','remove-confirm','unlink','edge-insert','arrange','compile','connect','target'].includes(name))throw new Error('请先应用或取消当前修改预览，再继续编辑或生成助手。');
      if(name==='side'){state.side=element.dataset.value;refresh();}
      if(name==='cancel-connect'){state.connect='';refresh();}
      if(name==='edge-select'||name==='edge-edit'||name==='insert-menu'){if(!graph.edges.some(edge=>edge.id===identifier))return;editSelection(identifier,true);if(name==='insert-menu')document.querySelector('.flow-edge-insert-options .button')?.focus({preventScroll:true});}
      if(name==='edge-insert'){
        if(hasEdits())throw new Error('请先保存正在编辑的定义，再插入步骤。');
        const edge=graph.edges.find(item=>item.id===identifier);const type=element.dataset.value;if(!edge||!['collect','action','human','condition'].includes(type))return;
        const next=structuredClone(graph);const original=next.edges.find(item=>item.id===identifier);const target=original.to;const id=uid('node');let nodeName=types[type].label;let suffix=2;while(next.nodes.some(node=>node.name===nodeName))nodeName=types[type].label+suffix++;
        next.nodes.push({id,type,name:nodeName,description:'',fields:'',keywords:'',capability:'',tool:'summary',x:60,y:60});original.to=id;next.edges.push({id:uid('edge'),from:id,to:target,label:'继续',fromPort:0});window.OrbitCopilot.structural(next);save(arrange(next));state.selected=id;state.selectedEdge='';refresh('flow-node-name',true);
      }
      if(name==='agent-example'){
        const selected=graph.nodes.find(node=>node.id===state.selected)||graph.nodes[0];
        if(selected)state.selected=selected.id;
        state.agent.input=element.dataset.value==='layout'?'从左到右，间距紧凑':element.dataset.value==='insert'?`在「${selected?.name||'处理动作'}」后添加人工确认「负责人复核」\n修改「负责人复核」的说明为「核对处理依据，获得授权后再继续」`:'修改选中节点的说明为「先核实资料，缺少信息先追问，不代替人工做业务承诺」';state.agent.proposal=null;refresh('flow-agent-command');
      }
      if(name==='agent-cancel'){state.agent.proposal=null;state.error='';refresh();}
      if(name==='agent-apply'){
        const proposal=state.agent.proposal;if(!proposal||proposal.projectId!==current().id||proposal.flowId!==graph.id||proposal.revision!==graph.revision||proposal.layoutRevision!==graph.layoutRevision||hasEdits())throw new Error('画布或待保存内容已变化，请重新预览修改。');
        if(proposal.requiresRisk&&!document.getElementById('flow-agent-risk')?.checked)throw new Error('请先勾选确认删除 / 人工边界变更。');
        if(proposal.sourceSnapshot!==JSON.stringify(graph))throw new Error('画布已变化，请重新预览修改。');window.OrbitCopilot.structural(proposal.graph);if(host.isSensitive(proposal.command))throw new Error('请先移除敏感信息。');
        const count=proposal.changes.length;save(structuredClone(proposal.graph),proposal.semantic);state.agent.history.push({count,revision:data().revision});state.agent.history=state.agent.history.slice(-10);state.agent.proposal=null;state.pending=null;state.error='';refresh();host.toast('已应用到当前画布，可撤销；未修改已发布助手。');
      }
      if(name==='focus'){state.focus=!state.focus;refresh();document.querySelector('[data-action="flow-focus"]')?.focus({preventScroll:true});}
      if(name==='sample'){if(graph.nodes.length){host.showDialog('用示例替换当前流程？','保留已创建的助手与版本；当前画布可通过撤销恢复。','<p>只替换本项目当前编辑流程，不修改共享本体、既有配置和助手。</p>',button('确认载入示例','sample-confirm','','primary')+host.button('取消','close-dialog'));return;}save(sample(current().id));state.nodeDrafts={};state.edgeDrafts={};state.identityDraft=null;state.selected='collect';state.selectedEdge='';state.side='node';state.connect='';refresh();}
      if(name==='sample-confirm'){host.closeDialog();save(sample(current().id));state.nodeDrafts={};state.edgeDrafts={};state.identityDraft=null;state.selected='collect';state.selectedEdge='';state.side='node';state.connect='';refresh();}
      if(name==='add')add(element.dataset.value);
      if(name==='select'||name==='edit'){if(!graph.nodes.some(node=>node.id===identifier))return;if(name==='select'&&state.connect)connect(state.connect,identifier);else editSelection(identifier);}
      if(name==='target'){if(!state.connect)throw new Error('先从上一步的箭头出口拉线，或点击出口再选择这里。');connect(state.connect,identifier);}
      if(name==='connect'){const used=graph.edges.filter(edge=>edge.from===identifier).map((edge,index)=>edge.fromPort??index);const slot=element.dataset.port!==undefined?Number(element.dataset.port):[0,1].find(value=>!used.includes(value))??0;state.connect=state.connect===identifier&&state.connectPort===slot?'':identifier;state.connectPort=slot;state.selected=identifier;state.selectedEdge='';refresh();}
      if(name==='remove'){
        const node=graph.nodes.find(node=>node.id===identifier);if(!node)return;
        const count=graph.edges.filter(edge=>edge.from===identifier||edge.to===identifier).length;
        state.removeRequest={identifier,projectId:current().id,snapshot:JSON.stringify(graph)};
        host.showDialog('删除「'+escape(node.name)+'」？',`同时移除 ${count} 条关联连线，可通过撤销恢复。`,`<p>只修改当前画布，不影响已发布助手。${state.nodeDrafts[identifier]?'该节点尚未保存的输入也会丢弃。':''}${node.type==='human'?'删除后请重新核对人工确认环节。':''}</p>`,button('删除节点','remove-confirm',`data-id="${escape(identifier)}"`,'flow-danger')+host.button('取消','close-dialog'));
      }
      if(name==='remove-confirm'){
        const request=state.removeRequest;
        if(!request||request.identifier!==identifier||request.projectId!==current().id||request.snapshot!==JSON.stringify(graph))throw new Error('画布已变化，请关闭弹窗后重新选择要删除的节点。');
        const next=structuredClone(graph);next.nodes=next.nodes.filter(node=>node.id!==identifier);next.edges=next.edges.filter(edge=>edge.from!==identifier&&edge.to!==identifier);save(next);delete state.nodeDrafts[identifier];for(const edge of graph.edges.filter(edge=>edge.from===identifier||edge.to===identifier))delete state.edgeDrafts[edge.id];state.selected='';state.selectedEdge='';state.connect='';state.removeRequest=null;host.closeDialog();refresh();document.getElementById('flow-viewport')?.focus({preventScroll:true});host.toast('节点及关联连线已删除，可撤销。');
      }
      if(name==='unlink'){
        if(!graph.edges.some(edge=>edge.id===identifier))return;
        const next=structuredClone(graph);next.edges=next.edges.filter(edge=>edge.id!==identifier);save(next);delete state.edgeDrafts[identifier];if(state.selectedEdge===identifier)state.selectedEdge='';state.connect='';refresh();document.getElementById('flow-viewport')?.focus({preventScroll:true});host.toast('连线已删除，节点保留；可撤销。');
      }
      if(name==='arrange'){save(arrange(graph),false);refresh('',true);}
      if(name==='zoom'){state.zoom=Math.max(.65,Math.min(1.5,Math.round((state.zoom+(element.dataset.value==='in'?.1:-.1))*100)/100));refresh();}
      if(name==='undo'||name==='redo'){const from=state[name];if(!from.length)return;if(hasEdits())throw new Error('请先保存正在编辑的定义，再撤销或重做。');state[name==='undo'?'redo':'undo'].push(structuredClone(graph));const next=from.pop();next.revision=graph.revision+1;next.layoutRevision=graph.layoutRevision+1;workspace().businessFlow=next;state.pending=null;state.agent.proposal=null;state.review=null;state.connect='';state.error='';window.PortfolioHub.persist();refresh();}
      if(name==='apply-layout'){const pending=state.pending;if(!pending||pending.revision!==graph.revision||pending.layoutRevision!==graph.layoutRevision)throw new Error('流程已变化，请重新预览排版。');save(pending.graph,false);refresh();}
      if(name==='cancel-layout'){state.pending=null;refresh('flow-command');}
      if(name==='compile'){if(hasEdits())throw new Error('还有未保存的名称、节点或关系编辑，请先保存，再核对业务定义。');state.review=compile(graph,current().id);state.error='';refresh();document.getElementById('flow-review')?.scrollIntoView({block:'start',behavior:'auto'});document.getElementById('flow-review')?.focus({preventScroll:true});}
    }catch(error){state.error=error.message;refresh();}
  }
  function hasEdits() {const state=view();return !!state.identityDraft||Object.keys(state.nodeDrafts).length>0||Object.keys(state.edgeDrafts).length>0;}
  function captureEdit(form) {
    if(!form)return;
    const state=view();const graph=data();const values=Object.fromEntries(new FormData(form));let original;
    if(form.id==='flow-node-form'){original=graph.nodes.find(node=>node.id===form.dataset.id);if(!original)return;if(Object.entries(values).some(([key,value])=>value!==(original[key]||'')))state.nodeDrafts[original.id]=values;else delete state.nodeDrafts[original.id];}
    else if(form.classList.contains('flow-edge-form')){original=graph.edges.find(edge=>edge.id===form.dataset.id);if(!original)return;if(['label','from','to'].some(key=>values[key]!==undefined&&values[key]!==original[key]))state.edgeDrafts[original.id]=values;else delete state.edgeDrafts[original.id];}
    else if(form.id==='flow-identity-form'){state.identityDraft=values.name!==graph.name||values.avatarArt!==graph.avatar.art||values.avatarTone!==graph.avatar.tone?values:null;}
    else return;
    state.review=null;document.getElementById('flow-review')?.remove();
    if(state.agent.proposal){state.agent.proposal=null;document.querySelector('.flow-agent-plan')?.remove();const viewport=document.getElementById('flow-viewport');if(viewport)viewport.outerHTML=stage();}
    const status=document.getElementById('flow-save-status');if(status)status.textContent=hasEdits()?'有未保存编辑 · 切换节点不会丢失，请保存后生成助手':'已保存到当前项目';
  }
  function configure(adapter) {
    host=adapter;
    document.addEventListener('click',event=>{const element=event.target.closest('[data-action^="flow-"]');if(element){event.preventDefault();dispatch(element.dataset.action.slice(5),element);}});
    document.addEventListener('input',event=>{if(event.target.id==='flow-command'){view().command=event.target.value;if(view().pending){view().pending=null;document.querySelector('.flow-command-preview')?.remove();const viewport=document.getElementById('flow-viewport');if(viewport)viewport.outerHTML=stage();}}});
    document.addEventListener('input',event=>captureEdit(event.target.closest('#flow-node-form,#flow-identity-form,.flow-edge-form')));
    document.addEventListener('change',event=>captureEdit(event.target.closest('#flow-node-form,#flow-identity-form,.flow-edge-form')));
    document.addEventListener('change',event=>{if(event.target.id==='flow-snap')view().snap=event.target.checked;if(event.target.id==='flow-agent-target'){view().selected=event.target.value;view().agent.proposal=null;refresh('flow-agent-command');}});
    document.addEventListener('input',event=>{if(event.target.id!=='flow-agent-command')return;view().agent.input=event.target.value;if(view().agent.proposal){view().agent.proposal=null;document.querySelector('.flow-agent-plan')?.remove();const viewport=document.getElementById('flow-viewport');if(viewport)viewport.outerHTML=stage();}});
    document.addEventListener('submit',event=>{
      const form=event.target;if(!form.id.startsWith('flow-')&&!form.classList.contains('flow-edge-form'))return;event.preventDefault();if(!current()||!form.reportValidity())return;
      try{if((view().pending||view().agent.proposal)&&(form.id==='flow-node-form'||form.id==='flow-identity-form'||form.classList.contains('flow-edge-form')))throw new Error('请先应用或取消当前预览，再保存编辑。');const input=Object.fromEntries(new FormData(form));if(Object.values(input).some(value=>host.isSensitive(String(value))))throw new Error('请先移除敏感内容；仅使用示例信息。');
        const next=structuredClone(data());
        if(form.id==='flow-identity-form'){if(/[\s@，,。；;]/.test(input.name))throw new Error('名称不能含空格、@ 或分隔符。');next.name=input.name.trim();next.avatar=window.HubIdentity.appearance({art:input.avatarArt,tone:input.avatarTone},next.name);save(next);view().identityDraft=null;refresh();}
        if(form.id==='flow-node-form'){const node=next.nodes.find(node=>node.id===form.dataset.id);if(!node)return;for(const [key,value] of Object.entries(input))node[key]=String(value).trim();if(!node.name)throw new Error('请填写节点名称。');save(next);delete view().nodeDrafts[node.id];refresh('flow-node-name');host.toast(node.description?'节点已保存，可撤销。':'节点已保存，业务定义待补充。');}
        if(form.classList.contains('flow-edge-form')){const changed=updateEdge(next,form.dataset.id,input);save(changed);delete view().edgeDrafts[form.dataset.id];refresh('flow-edge-label');host.toast('连线已保存，可撤销。');}
        if(form.id==='flow-command-form'){view().pending=null;view().agent.proposal=null;const proposed=layoutCommand(next,input.command);view().pending={graph:proposed,revision:next.revision,layoutRevision:next.layoutRevision};view().error='';refresh('flow-command',true);}
        if(form.id==='flow-agent-form'){view().agent.proposal=null;if(hasEdits())throw new Error('请先保存名称、节点或连线的编辑，再使用修改指令。');view().agent.input=input.command;view().pending=null;view().selected=input.target||'';view().agent.proposal=window.OrbitCopilot.propose(next,input.command,view().selected,current().id);view().error='';refresh('',true);}
        if(form.id==='flow-confirm-form'){const config=view().review;if(!input.confirmed||!config||config.flowDesign.revision!==next.revision)throw new Error('流程已变化或尚未确认，请重新核对业务定义。');const fresh=compile(next,current().id);fresh.flowDesign.confirmed=true;fresh.businessDesign.confirmed=true;view().review=null;window.ProjectStudio.createFromOntology(fresh);host.toast('已保存独立的流程定义与助手头像。请继续核对配置和案例，未启用真实业务执行。');}
      }catch(error){view().error=error.message;refresh();}
    });
    document.addEventListener('dragstart',event=>{const palette=event.target.closest('[data-flow-type]');if(palette){event.dataTransfer.setData('application/x-lianshan-node',palette.dataset.flowType);event.dataTransfer.effectAllowed='copy';}});
    document.addEventListener('dragover',event=>{if(event.target.closest('#flow-viewport')&&event.dataTransfer.types.includes('application/x-lianshan-node'))event.preventDefault();});
    document.addEventListener('drop',event=>{if(!event.target.closest('#flow-viewport'))return;const type=event.dataTransfer.getData('application/x-lianshan-node');if(!types[type])return;event.preventDefault();const bounds=document.getElementById('flow-stage').getBoundingClientRect();try{if(view().pending||view().agent.proposal)throw new Error('请先应用或取消当前预览，再添加节点。');add(type,{x:(event.clientX-bounds.left)/view().zoom,y:(event.clientY-bounds.top)/view().zoom});}catch(error){view().error=error.message;refresh();}});
    window.OrbitFlowGestures.configure({data,view,save,refresh,connect,addConnection,anchor,curve,paths,markers,current,dispatch});
    document.addEventListener('keydown',event=>{if(!document.querySelector('.orbit-flow'))return;const state=view();if(event.key==='Escape'){if(window.OrbitFlowGestures.cancel())return;if(state.connect){state.connect='';refresh();}else if(state.focus){state.focus=false;refresh();}return;}
      if(event.target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')||document.querySelector('[role="dialog"]'))return;
      if(event.target.closest('#flow-viewport')&&!state.pending&&!state.agent.proposal){
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();dispatch(event.shiftKey?'redo':'undo',{dataset:{}});return;}
        const focusedEdge=event.target.closest('.flow-link');const focusedNode=event.target.closest('.flow-node');
        const edgeId=focusedEdge?.dataset.id||(!focusedNode?state.selectedEdge:'');const nodeId=focusedNode?.dataset.node||(!edgeId?state.selected:'');
        if(['Delete','Backspace','F2'].includes(event.key)&&(edgeId||nodeId)){event.preventDefault();dispatch(event.key==='F2'?(edgeId?'edge-edit':'edit'):(edgeId?'unlink':'remove'),{dataset:{id:edgeId||nodeId}});return;}
      }
      const target=event.target.closest('.flow-link,.flow-edge-add');if(target&&['Enter',' '].includes(event.key)){event.preventDefault();dispatch(target.dataset.action.slice(5),target);return;}
      const handle=event.target.closest('.flow-node-body');const deltas={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};if(!handle||!deltas[event.key]||state.pending||state.agent.proposal)return;event.preventDefault();const next=structuredClone(data());const node=next.nodes.find(node=>node.id===handle.dataset.id);const delta=deltas[event.key];node.x=Math.max(24,Math.min(7000,node.x+delta[0]));node.y=Math.max(24,Math.min(7000,node.y+delta[1]));save(next,false);refresh();document.querySelector(`.flow-node-body[data-id="${CSS.escape(node.id)}"]`)?.focus({preventScroll:true});});
  }
  return {configure,page,data,view,sample,arrange,levels,numbers,preview,applyDraft,hasEdits,validate,definitions,compile,layoutCommand,freePosition,connect,addConnection,updateEdge,dispatch,nodeSize};
})();
