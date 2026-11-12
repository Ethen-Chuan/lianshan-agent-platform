window.OrbitStar=(()=>{
  let host;
  const labels={object:'业务对象',alias:'同义表达',scope:'适用范围',evidence:'待核实信息',candidate:'原因假设 · 待验证',rule:'处理规则',action:'业务动作',human:'人工确认'};
  const order={alias:0,scope:1,object:2,evidence:3,candidate:4,rule:0,action:1,human:2};
  const role=(node,model)=>window.OrbitAtlasGraph.role(node,model);
  const escape=value=>host.escape(String(value??''));
  const units=value=>Array.from(String(value||'')).length;
  function center(model,state){
    const degree=identifier=>model.links.filter(link=>link.source===identifier||link.target===identifier).length;
    return model.nodes.find(node=>node.id===state.centerId)||model.nodes.find(node=>node.id===state.focusId)||[...model.nodes].filter(node=>role(node,model)==='object').sort((left,right)=>degree(right.id)-degree(left.id))[0]||model.nodes[0];
  }
  function trails(model,identifier){
    const indexed=new Map(model.nodes.map(node=>[node.id,node]));
    if(!indexed.has(identifier)||role(indexed.get(identifier),model)==='candidate')return [];
    const queue=[{nodes:[identifier],links:[]}];const found=new Map();const visited=new Set([identifier]);
    while(queue.length){
      const path=queue.shift();if(path.links.length>=4)continue;
      for(const link of model.links.filter(entry=>entry.source===path.nodes.at(-1))){
        const target=indexed.get(link.target);if(!target||visited.has(target.id)||['candidate','context'].includes(window.OrbitAtlasGraph.relation(link))||role(target,model)==='candidate')continue;
        visited.add(target.id);const next={nodes:[...path.nodes,target.id],links:[...path.links,link]};
        if(['action','human'].includes(target.type))found.set(target.id,{...next,id:next.links.map(entry=>entry.id).join('|'),targetId:target.id});
        else queue.push(next);
      }
    }
    return [...found.values()];
  }
  function dimensions(node,isCenter){
    const lines=Math.max(1,Math.ceil(units(node.name)/(isCenter?10:9)));
    return isCenter?{width:236,height:122+lines*24}:{width:208,height:36+lines*22};
  }
  function anchor(node){return {id:node.id,x:node.x+node.width*node.pointX,y:node.y+node.height*node.pointY,width:node.pointSize,height:node.pointSize};}
  function textBounds(node){return node.isCenter?{id:'text:'+node.id,x:node.x+12,y:node.y+49,width:node.width-24,height:node.height-59}:{id:'text:'+node.id,x:node.x+(node.orbitSide==='left'?8:42),y:node.y+7,width:node.width-50,height:node.height-14};}
  function routeKey(link,map){return map.constellation?JSON.stringify([link.source,link.target,map.nodes.filter(node=>node.id===link.source||node.id===link.target).map(node=>[node.id,node.x,node.y,node.width,node.height,node.pointX,node.pointY,node.pointSize]),map.links.filter(entry=>entry.source===link.source&&entry.target===link.target||entry.source===link.target&&entry.target===link.source).map(entry=>entry.id).sort()]):'';}
  const overlaps=(first,second,gap=0)=>first.x<second.x+second.width+gap&&first.x+first.width+gap>second.x&&first.y<second.y+second.height+gap&&first.y+first.height+gap>second.y;
  function joined(segments){
    const lengths=segments.map(segment=>{let length=0;let previous=segment[0];for(let sample=1;sample<=16;sample++){const next=window.OrbitAtlasGraph.point(segment,sample/16);length+=Math.hypot(next.x-previous.x,next.y-previous.y);previous=next;}return Math.max(.001,length);});
    return {segments,lengths,total:lengths.reduce((total,length)=>total+length,0)};
  }
  function frameGroups(map){
    if(!map.classified)return map;
    const groups=map.groups.map(group=>{
      const members=map.nodes.filter(node=>group.nodeIds.includes(node.id));
      if(!members.length)return {...group,hidden:true};
      const x=Math.min(...members.map(node=>node.x))-16;const y=Math.min(...members.map(node=>node.y))-54;
      const frame={...group,x,y,width:Math.max(...members.map(node=>node.x+node.width))-x+16,height:Math.max(...members.map(node=>node.y+node.height))-y+16};
      frame.hidden=x<8||y<68||map.nodes.some(node=>!group.nodeIds.includes(node.id)&&overlaps(frame,node,8));return frame;
    });
    const shown=groups.filter(group=>!group.hidden);
    for(const group of shown)if(shown.some(other=>other.id!==group.id&&overlaps(group,other,4)))group.hidden=true;
    return {...map,groups};
  }
  function route(link,map){
    if(!map.classified)return null;
    if(map.constellation){
      const sourceNode=map.nodes.find(node=>node.id===link.source);const targetNode=map.nodes.find(node=>node.id===link.target);if(!sourceNode||!targetNode)return null;
      const source=anchor(sourceNode);const target=anchor(targetNode);const graph=window.OrbitAtlasGraph;
      if(source.id===target.id)return [{x:source.x+source.width/2,y:source.y},{x:source.x+90,y:source.y-92},{x:source.x-90,y:source.y-92},{x:source.x-source.width/2,y:source.y}];
      const obstacles=[...map.nodes.filter(node=>![source.id,target.id].includes(node.id)),textBounds(sourceNode),textBounds(targetNode),...map.groups.filter(group=>!group.hidden).map(group=>({id:'heading:'+group.id,x:group.x,y:group.y,width:group.width,height:42}))];
      const clear=curve=>Array.from({length:39},(_,index)=>graph.point(curve,(index+1)/40)).every(point=>obstacles.every(node=>!overlaps({x:point.x-3,y:point.y-3,width:6,height:6},node)));
      if(link.curve&&link.routeKey===routeKey(link,map)&&clear(link.curve))return link.curve;
      const peers=map.links.filter(entry=>entry.source===link.source&&entry.target===link.target||entry.source===link.target&&entry.target===link.source).sort((first,second)=>first.id.localeCompare(second.id));
      const distance=Math.hypot(target.x-source.x,target.y-source.y)||1;const horizontal=(target.x-source.x)/distance;const vertical=(target.y-source.y)/distance;
      const separation=(peers.findIndex(entry=>entry.id===link.id)-(peers.length-1)/2)*92*(source.id.localeCompare(target.id)<0?1:-1);const bend=Math.min(72,distance*.16);
      const start={x:source.x+horizontal*(source.width/2+3),y:source.y+vertical*(source.height/2+3)};const end={x:target.x-horizontal*(target.width/2+5),y:target.y-vertical*(target.height/2+5)};
      let curve=[start,{x:start.x+(end.x-start.x)*(sourceNode.isCenter?.68:.32)-vertical*bend,y:sourceNode.isCenter?start.y:start.y+(end.y-start.y)*.32+horizontal*bend},{x:start.x+(end.x-start.x)*(targetNode.isCenter?.32:.68)-vertical*bend,y:targetNode.isCenter?end.y:start.y+(end.y-start.y)*.68+horizontal*bend},end];
      if(peers.length>1){const fraction=sourceNode.isCenter?.65:targetNode.isCenter?.35:.5;const middle={x:start.x+(end.x-start.x)*fraction-vertical*separation,y:start.y+(end.y-start.y)*fraction+horizontal*separation};const across=Math.abs(horizontal)>=Math.abs(vertical);curve=joined([[start,across?{x:middle.x,y:start.y}:{x:start.x,y:middle.y},middle,middle],[middle,middle,across?{x:middle.x,y:end.y}:{x:end.x,y:middle.y},end]]);}
      return clear(curve)?curve:graph.route(source,target,[source,target,...obstacles.map(node=>({...node,x:node.x+node.width/2,y:node.y+node.height/2}))],map.width,map.height,1,peers.findIndex(entry=>entry.id===link.id));
    }
    if(link.source===link.target||![link.source,link.target].includes(map.centerId))return null;
    const center=map.nodes.find(node=>node.id===map.centerId);const peer=map.nodes.find(node=>node.id===(link.source===map.centerId?link.target:link.source));
    if(!center||!peer)return null;
    const left=peer.x+peer.width<=center.x-40;const right=peer.x>=center.x+center.width+40;if(!left&&!right)return null;
    const adjacent=map.links.filter(entry=>entry.source!==entry.target&&[entry.source,entry.target].includes(map.centerId)).map(entry=>({link:entry,node:map.nodes.find(node=>node.id===(entry.source===map.centerId?entry.target:entry.source))})).filter(entry=>entry.node&&(left?entry.node.x+entry.node.width<=center.x-40:entry.node.x>=center.x+center.width+40)).sort((first,second)=>first.node.y+first.node.height/2-second.node.y-second.node.height/2||first.link.id.localeCompare(second.link.id));
    const index=adjacent.findIndex(entry=>entry.link.id===link.id);const angle=adjacent.length===1?0:-.85+index*1.7/(adjacent.length-1);
    const port={x:center.x+center.width/2+(left?-1:1)*Math.cos(angle)*(center.width/2+4),y:center.y+center.height/2+Math.sin(angle)*center.height/2};
    const endpoint={x:left?peer.x+peer.width+4:peer.x-4,y:peer.y+peer.height/2};const distance=Math.abs(port.x-endpoint.x)*.5;
    const curve=[endpoint,{x:endpoint.x+(left?distance:-distance),y:endpoint.y},{x:port.x+(left?-distance:distance),y:port.y},port];
    const clear=Array.from({length:23},(_,position)=>window.OrbitAtlasGraph.point(curve,(position+1)/24)).every(point=>map.nodes.every(node=>[peer.id,center.id].includes(node.id)||!overlaps({x:point.x-3,y:point.y-3,width:6,height:6},node)));
    return clear?(link.target===center.id?curve:curve.reverse()):null;
  }
  function enter(model,state){
    state.groupId='';
    if(model.nodes.some(node=>node.id===state.focusId)&&!layout(model,state).nodes.some(node=>node.id===state.focusId)){state.centerId=state.focusId;state.trailId='';state.starHistory=[];}
    state.zoom=null;
  }
  function layout(model,state){
    const root=center(model,state);if(!root)return {nodes:[],links:[],width:1000,height:600,columns:[],groups:[],paths:[]};
    const paths=trails(model,root.id);const trail=paths.find(path=>path.id===state.trailId);
    const direct=model.links.filter(link=>link.source===root.id||link.target===root.id);const visible=new Set([root.id,...direct.flatMap(link=>[link.source,link.target]),...(trail?.nodes||[])]);
    const peers=model.nodes.filter(node=>node.id!==root.id&&(state.showAll||visible.has(node.id))).map(node=>({...node,orbitRole:role(node,model),...dimensions(node,false)}));
    const right=peers.filter(node=>['rule','action','human'].includes(node.orbitRole));const left=peers.filter(node=>!right.includes(node));
    const sides=[left,right].map(side=>[...new Set(side.map(node=>node.orbitRole))].sort((first,second)=>(order[first]??2)-(order[second]??2)).map(kind=>({id:kind,name:labels[kind]||'其他定义',role:kind,members:side.filter(node=>node.orbitRole===kind)})));
    const groupHeight=group=>70+group.members.reduce((total,node)=>total+node.height,0)+Math.max(0,group.members.length-1)*16;
    const span=side=>side.reduce((total,group)=>total+groupHeight(group),0)+Math.max(0,side.length-1)*20;
    const rootSize=dimensions(root,true);const width=1000;const height=Math.max(640,...sides.map(side=>span(side)+160),rootSize.height+184);
    const nodes=[{...root,...rootSize,x:(width-rootSize.width)/2,y:height/2-28,pointX:.5,pointY:28/rootSize.height,pointSize:28,orbitSide:'center',orbitRole:role(root,model),isCenter:true}];
    const groups=[];
    for(const [sideIndex,side] of sides.entries()){
      let top=(height-span(side))/2;
      for(const group of side){
        let row=top+54;for(const [index,node] of group.members.entries()){const offset=index%2?16:0;nodes.push({...node,x:sideIndex?744-offset:40+offset,y:row,pointX:sideIndex?18/node.width:1-18/node.width,pointY:22/node.height,pointSize:16,orbitSide:sideIndex?'right':'left'});row+=node.height+16;}
        groups.push({id:group.id,name:group.name,role:group.role,nodeIds:group.members.map(node=>node.id),count:group.members.length});top+=groupHeight(group)+20;
      }
    }
    const identifiers=new Set(nodes.map(node=>node.id));const pathIds=new Set(trail?.links.map(link=>link.id)||[]);
    const links=model.links.filter(link=>identifiers.has(link.source)&&identifiers.has(link.target)&&(state.showAll||link.source===root.id||link.target===root.id||pathIds.has(link.id)));
    for(const group of groups){
      group.linkIds=links.filter(link=>group.nodeIds.includes(link.source)||group.nodeIds.includes(link.target)).map(link=>link.id);
      const attached=links.filter(link=>group.linkIds.includes(link.id));const direction=link=>link.source===root.id?'out':link.target===root.id?'in':'other';
      if(group.count>1&&attached.length===group.count&&attached.every(link=>direction(link)!=='other'&&direction(link)===direction(attached[0])&&link.label===attached[0].label)&&group.nodeIds.every(identifier=>attached.filter(link=>link.source===identifier||link.target===identifier).length===1))group.relation={label:attached[0].label,direction:direction(attached[0]),linkIds:attached.map(link=>link.id)};
    }
    const sectors=[{name:'识别与依据',count:left.length,x:24},{name:'规则与处理',count:right.length,x:728}].filter(group=>group.count);
    return window.OrbitMap.reroute({nodes,links,width,height,columns:[],groups,sectors,classified:true,constellation:true,centerId:root.id,paths,trail,hiddenNodes:model.nodes.length-nodes.length});
  }
  function emphasis(map,state){
    const root=map.nodes.find(node=>node.id===map.centerId);const selected=map.nodes.find(node=>node.id===state.focusId)||root;
    const edge=map.links.find(link=>link.id===state.edgeId);const trail=state.trailActive?map.trail:null;const group=map.groups.find(entry=>entry.id===state.groupId);
    const related=edge?[edge]:trail?trail.links:group?map.links.filter(link=>group.linkIds.includes(link.id)):selected&&selected.id!==root?.id?map.links.filter(link=>link.source===selected.id||link.target===selected.id):map.links;
    return {selected,edge,trail,group,related,relatedLinks:new Set(related.map(link=>link.id)),relatedNodes:new Set([selected?.id,...(group?.nodeIds||[]),...related.flatMap(link=>[link.source,link.target])]),summary:!edge&&!trail&&selected?.id===root?.id};
  }
  function interact(name,identifier,state,model){
    const root=center(model,state);const node=model.nodes.find(entry=>entry.id===identifier);
    if(name==='group'&&layout(model,state).groups.some(group=>group.id===identifier)){state.centerId=root?.id;state.groupId=state.groupId===identifier?'':identifier;state.focusId='';state.edgeId='';state.trailActive=false;return true;}
    if(['select','edge','trail','center','back','clear','all'].includes(name))state.groupId='';
    if(name==='select'&&node){state.centerId=root?.id;state.focusId=node.id;state.edgeId='';state.trailActive=false;return true;}
    if(name==='edge'&&model.links.some(link=>link.id===identifier)){state.edgeId=identifier;state.focusId=model.links.find(link=>link.id===identifier).target;state.trailActive=false;return true;}
    if(name==='trail'&&trails(model,root?.id).some(path=>path.id===identifier)){state.centerId=root.id;state.trailId=state.trailId===identifier?'':identifier;state.trailActive=!!state.trailId;state.focusId=root.id;state.edgeId='';return true;}
    if(name==='center'&&node&&node.id!==root?.id){state.starHistory=[...(state.starHistory||[]),root.id].slice(-12);state.centerId=node.id;}
    else if(name==='back'&&state.starHistory?.some(id=>model.nodes.some(entry=>entry.id===id))){do{state.centerId=state.starHistory.pop();}while(!model.nodes.some(entry=>entry.id===state.centerId));}
    else if(name==='clear'){state.focusId='';state.edgeId='';state.trailActive=false;return true;}
    else if(name==='all'){state.centerId=root?.id;state.showAll=!state.showAll;state.edgeId='';state.trailActive=false;return true;}
    else return false;
    state.focusId=state.centerId;state.edgeId='';state.trailId='';state.trailActive=false;state.showAll=false;state.zoom=null;return true;
  }
  function diagram(model,state,prefix){
    const base=layout(model,state);state.centerId=base.centerId;
    const map=window.OrbitMap.bind(prefix,base,state,'star:'+base.centerId+':'+!!state.showAll);const zoom=state.zoom??1;
    const root=model.nodes.find(node=>node.id===map.centerId);const {selected,edge,trail,group,related,relatedLinks,relatedNodes,summary}=emphasis(map,state);
    const action=(label,name,attributes='',tone='quiet small')=>host.button(label,prefix+'-'+name,tone,attributes);
    const nodeName=identifier=>model.nodes.find(node=>node.id===identifier)?.name||'已移除';
    const sentence=link=>`${nodeName(link.source)} — ${link.label} → ${nodeName(link.target)}`;
    const marker=prefix+'-arrow';const caption=edge?sentence(edge):trail?'关联路径 · '+nodeName(trail.targetId):group?group.name+' · '+group.count+' 项':selected?.id!==root?.id?'选中：'+selected.name:'中心：'+(root?.name||'未选择');
    const pathButton=path=>`<button type="button" class="os-path" data-action="${prefix}-trail" data-id="${escape(path.id)}" aria-pressed="${map.trail?.id===path.id}" aria-label="${map.trail?.id===path.id?'收起':'展开'}关联路径：${escape(path.links.map(sentence).join('；'))}"><span class="os-path-steps"><strong>${escape(nodeName(path.nodes[0]))}</strong>${path.links.map(link=>`<span class="os-path-relation">${escape(link.label)} <i aria-hidden="true">→</i></span><strong>${escape(nodeName(link.target))}</strong>`).join('')}</span><span class="os-path-length">${path.links.length} 条关系 <i aria-hidden="true">${map.trail?.id===path.id?'−':'↗'}</i></span></button>`;
    return `<section class="ob-graph os-map os-constellation" data-ob-graph="${prefix}" data-ob-mode="star" data-ob-center="${escape(map.centerId||'')}" data-relationship-map="${prefix}" aria-label="对象关系星状图">
      <div class="ob-graph-tools"><div>${prefix==='catalog-star'?'<div class="rm-map-title">关系星图 <span>RELATION MAP</span></div>':`<div class="rm-view-switch" role="group" aria-label="关系图谱表现形式">${action('星状图','presentation','data-value="star" aria-pressed="true"','small selected')}${action('卡片图','presentation','data-value="cards" aria-pressed="false"')}</div>`}${window.OrbitMapMotion.controls(state)}${state.starHistory?.some(identifier=>model.nodes.some(node=>node.id===identifier))?action('← 返回上个中心','back'):''}</div><div>${action(state.showAll?'收起全图':'展开全图','all',`aria-pressed="${!!state.showAll}"`)}<label class="os-drag-mode"><span>拖动</span><select data-map-drag-mode aria-label="节点拖动方式"><option value="single" ${state.dragMode!=='branch'?'selected':''}>单个节点</option><option value="branch" ${state.dragMode==='branch'?'selected':''}>关联分支</option></select></label>${window.OrbitMap.controls()}</div></div>
      <div class="os-caption" role="status"><span>${escape(caption)}</span><div>${selected?.id!==root?.id?action('设为中心','center',`data-id="${escape(selected.id)}"`):''}${edge||trail||group||selected?.id!==root?.id?action('取消高亮','clear'):''}<small>${map.nodes.length} 项定义 · ${map.links.length} 条关系</small></div></div>
      ${root?`<div class="os-viewport-shell"><div class="os-drag-feedback" data-map-drag-feedback hidden aria-hidden="true"></div><div class="ob-graph-viewport" data-map-viewport tabindex="0" aria-label="关系图，点击查看关联，拖动节点调整位置"><div class="ob-scaled" style="width:${map.width*zoom}px;height:${map.height*zoom}px"><div class="ob-stage" data-map-stage data-width="${map.width}" data-height="${map.height}" style="width:${map.width}px;height:${map.height}px;transform:scale(${zoom})">
        ${map.sectors.map(sector=>`<div class="os-sector" style="left:${sector.x}px"><span>${sector.name}</span><small>${sector.count}</small></div>`).join('')}
        ${map.groups.map(entry=>`<section class="os-definition-group${entry.nodeIds.some(identifier=>relatedNodes.has(identifier))?'':' is-muted'}${entry.id===group?.id?' is-active':''}" data-map-group="${escape(entry.id)}" data-role="${escape(entry.role)}" ${entry.hidden?'hidden':''} style="left:${entry.x}px;top:${entry.y}px;width:${entry.width}px;height:${entry.height}px" aria-label="${escape(entry.name)}分组"><button type="button" class="os-group-heading" data-action="${prefix}-group" data-id="${escape(entry.id)}" aria-pressed="${entry.id===group?.id}" aria-label="查看${escape(entry.name)}，${entry.count}项定义"><span><strong>${escape(entry.name)}</strong>${entry.relation&&entry.relation.label!==entry.name?`<small>${escape(entry.relation.label)} ${entry.relation.direction==='in'?'→ 中心':'← 中心'}</small>`:''}</span><b>${entry.count}</b></button></section>`).join('')}
        <svg class="og-edges" width="${map.width}" height="${map.height}" aria-hidden="true"><defs><marker id="${marker}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="context-stroke" stroke-width="1.3"/></marker></defs>${map.links.map(link=>`<g data-map-edge="${escape(link.id)}" data-relation="${window.OrbitAtlasGraph.relation(link)}" class="og-link${relatedLinks.has(link.id)?'':' is-muted'}${link.label==='原因假设'?' candidate':''}"><path d="${link.path}" marker-end="url(#${marker})"/><circle data-map-signal r="2.4" cx="0" cy="0"/></g>`).join('')}</svg>
        ${map.nodes.map(node=>`<button type="button" class="og-node ob-node ob-star-node${node.isCenter?' is-hub':''}${node.id===selected?.id?' is-selected':''}${!relatedNodes.has(node.id)?' is-muted':''}" data-map-node="${escape(node.id)}" data-grouped="${map.groups.some(entry=>!entry.hidden&&entry.nodeIds.includes(node.id))}" data-action="${prefix}-select" data-id="${escape(node.id)}" data-kind="${escape(node.type)}" data-role="${escape(node.orbitRole)}" data-side="${node.orbitSide}" aria-pressed="${node.id===selected?.id}" aria-label="查看${escape(node.name)}，${labels[node.orbitRole]||'业务定义'}" title="${escape(node.name+'：'+(node.fields||node.description||''))}" style="left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px"><i class="os-node-point" aria-hidden="true"><i class="os-node-halo" data-star-halo aria-hidden="true"></i></i><span><b>${escape(node.displayNumber||String(model.nodes.findIndex(entry=>entry.id===node.id)+1).padStart(2,'0'))}</b><i class="os-node-kind">${labels[node.orbitRole]||'业务定义'}</i></span><strong>${escape(node.name)}</strong>${node.isCenter?`<small>${escape(window.OrbitMap.excerpt(node.fields||node.description))}</small>`:''}</button>`).join('')}
        ${map.links.map(link=>`<button type="button" data-map-label="${escape(link.id)}" data-map-visible="${relatedLinks.has(link.id)}" data-map-summary="${summary}" ${!link.labelPosition||!relatedLinks.has(link.id)||summary&&link.summaryGroupId?'hidden':''} class="og-edge-label${link.id===state.edgeId?' is-selected':''}${link.label==='原因假设'?' is-hypothesis':''}" data-action="${prefix}-edge" data-id="${escape(link.id)}" aria-label="${escape(sentence(link))}" title="${escape(sentence(link))}" style="left:${link.labelPosition?.x||0}px;top:${link.labelPosition?.y||0}px;width:${link.labelPosition?.width||84}px">${escape(link.label)}</button>`).join('')}
      </div></div></div></div>`:'<div class="og-empty"><h3>还没有业务定义</h3><p>描述业务后，这里会显示对象与关系。</p></div>'}
      ${root?`<section class="os-paths" aria-label="中心对象关联的动作路径"><header><strong>${root.type==='action'?'后续关联':'关联动作'}</strong><span>已定义关系 · 非执行记录</span></header>${map.paths.length?map.paths.slice(0,2).map(pathButton).join('')+(map.paths.length>2?`<details><summary>另有 ${map.paths.length-2} 条关联路径</summary>${map.paths.slice(2).map(pathButton).join('')}</details>`:''):'<p>4 层关系内没有可展示的动作路径。</p>'}</section>`:''}
      <div class="os-key"><span><i data-shape="object"></i>对象</span><span><i data-shape="rule"></i>规则</span><span><i data-shape="action"></i>动作</span><span><i data-shape="candidate"></i>原因假设 · 待验证</span><small>关系示意，不代表执行状态</small></div>${window.OrbitMap.hint()}<details class="ob-relations"><summary>关系清单 · ${related.length} 条${map.hiddenNodes?' · '+map.hiddenNodes+' 项未展开':''}</summary>${related.map(link=>action(escape(sentence(link)),'edge',`data-id="${escape(link.id)}"`)).join('')||'<p>当前对象尚无关系。</p>'}</details>
    </section>`;
  }
  return {configure(adapter){host=adapter;},center,layout,trails,dimensions,anchor,textBounds,routeKey,frameGroups,route,emphasis,enter,interact,diagram};
})();
