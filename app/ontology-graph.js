window.OrbitAtlasGraph=(()=>{
  const palette={
    evidence:{name:'核实与依据',color:'#86cbbb',light:'#326c5e',dash:[]},
    rule:{name:'触发与执行',color:'#dfc48c',light:'#806124',dash:[]},
    boundary:{name:'约束与限制',color:'#ea9d9b',light:'#9a4848',dash:[5,4]},
    human:{name:'人工交接',color:'#a5bbdf',light:'#4a6597',dash:[]},
    candidate:{name:'原因假设 · 待验证',color:'#e7bc76',light:'#876020',dash:[9,5]},
    context:{name:'名称与范围',color:'#a8b6ad',light:'#58695f',dash:[2,4]}
  };
  function relation(link){
    if(link.label==='原因假设')return 'candidate';
    if(['约束','限制动作'].includes(link.label))return 'boundary';
    if(['提交核对','交给人工'].includes(link.label))return 'human';
    if(['需核实','提供依据'].includes(link.label))return 'evidence';
    if(['同义表达','可能出现','关联'].includes(link.label))return 'context';
    return 'rule';
  }
  function role(node,model){
    if(node.type!=='object')return node.type;
    const outgoing=model.links.filter(link=>link.source===node.id);
    if(outgoing.some(link=>link.label==='原因假设'))return 'candidate';
    if(outgoing.some(link=>link.label==='可能出现'))return 'scope';
    if(outgoing.some(link=>link.label==='需核实'))return 'evidence';
    return 'object';
  }
  function visible(model,state){
    const connected=new Set(model.links.flatMap(link=>[link.source,link.target]));
    let nodes=model.nodes.filter(node=>state.scope==='complete'||(!['alias','candidate','scope'].includes(role(node,model))&&connected.has(node.id)));
    if(state.progressive){
      const shown=new Set([state.selected,...state.expanded]);
      for(const link of model.links)if(state.expanded.has(link.source)||state.expanded.has(link.target)){shown.add(link.source);shown.add(link.target);}
      nodes=nodes.filter(node=>shown.has(node.id));
    }
    if(state.local){
      const connected=new Set([state.selected]);
      for(const link of model.links)if(link.source===state.selected||link.target===state.selected){connected.add(link.source);connected.add(link.target);}
      nodes=nodes.filter(node=>connected.has(node.id));
    }
    const identifiers=new Set(nodes.map(node=>node.id));
    return {nodes,links:model.links.filter(link=>identifiers.has(link.source)&&identifiers.has(link.target))};
  }
  function lane(node,model){
    const kind=role(node,model);
    if(['object','alias','scope'].includes(kind))return 0;
    if(['evidence','candidate'].includes(kind))return 1;
    if(kind==='rule')return 2;
    if(kind==='action')return 3;
    return 4;
  }
  const nodeSize={width:156,height:76,gap:28};
  const primaryOrder=['symptom','rule-check','verify','draft','human'];
  const supportOrder=['warranty','rule-replace','escalate'];
  const auxiliaryOrder=['alias-dark','alias-off','device','board'];
  function dimensions(model,state,width){
    const complete=state.scope==='complete';
    const extra=Math.max(0,visible(model,{...state,local:false,progressive:false}).nodes.length-(complete?12:8));
    if(state.mode==='star'){
      const count=visible(model,state).nodes.length;
      return {width,height:width<540?Math.max(420,count*144+36):Math.max(620,Math.ceil(count/3)*170+120),orientation:width<540?'vertical':'horizontal'};
    }
    if(width<540)return {width,height:(complete?12:8)*144+36+extra*144,orientation:'vertical'};
    if(width<1000)return {width,height:(complete?1210:870)+Math.ceil(extra/2)*154,orientation:'vertical'};
    return {width,height:(state.mode==='star'?680:complete?690:500)+Math.ceil(extra/5)*154,orientation:'horizontal'};
  }
  function positionKey(state,width,identifier){return (width<540?'narrow':width<1000?'portrait':'wide')+':'+state.mode+':'+identifier;}
  function separated(first,second,gap=nodeSize.gap){return Math.abs(first.x-second.x)>=nodeSize.width+gap||Math.abs(first.y-second.y)>=nodeSize.height+gap;}
  function settle(nodes,positions,width,height){
    const result={...positions};const placed=[];const marginX=nodeSize.width/2+14;const marginY=nodeSize.height/2+14;
    for(const node of nodes){
      const desired={x:Math.max(marginX,Math.min(width-marginX,positions[node.id].x)),y:Math.max(marginY,Math.min(height-marginY,positions[node.id].y))};
      if(placed.every(other=>separated(desired,other))){result[node.id]=desired;placed.push(desired);continue;}
      const candidates=[];
      for(let row=marginY;row<=height-marginY;row+=nodeSize.height+nodeSize.gap)for(let column=marginX;column<=width-marginX;column+=nodeSize.width+nodeSize.gap)candidates.push({x:column,y:row});
      for(const other of placed)for(const direction of [-1,1]){candidates.push({x:desired.x,y:other.y+direction*(nodeSize.height+nodeSize.gap)},{x:other.x+direction*(nodeSize.width+nodeSize.gap),y:desired.y});}
      candidates.sort((left,right)=>Math.hypot(left.x-desired.x,left.y-desired.y)-Math.hypot(right.x-desired.x,right.y-desired.y));
      const available=candidates.find(candidate=>candidate.x>=marginX&&candidate.x<=width-marginX&&candidate.y>=marginY&&candidate.y<=height-marginY&&placed.every(other=>separated(candidate,other)));
      result[node.id]=available||desired;placed.push(result[node.id]);
    }
    return result;
  }
  function layout(model,state,width,height){
    const shown=visible(model,state).nodes;const positions={};
    if(state.mode==='star'){
      const focus=model.nodes.find(node=>node.id===state.selected)||shown[0];
      const direct=new Set(model.links.filter(link=>link.source===focus?.id||link.target===focus?.id).flatMap(link=>[link.source,link.target]));
      const ordered=[focus,...model.nodes.filter(node=>node.id!==focus?.id).sort((left,right)=>Number(direct.has(right.id))-Number(direct.has(left.id)))].filter(Boolean);
      const surrounding=ordered.filter(node=>node.id!==focus?.id&&shown.some(item=>item.id===node.id));
      for(const [index,node] of ordered.entries()){
        if(width<540){const order=node.id===focus?.id?0:surrounding.findIndex(item=>item.id===node.id)+1;positions[node.id]={x:width/2,y:66+Math.max(0,order)*144};}
        else if(node.id===focus?.id)positions[node.id]={x:width/2,y:height/2};
        else{const order=Math.max(0,surrounding.findIndex(item=>item.id===node.id));const angle=-Math.PI/2+order*2*Math.PI/Math.max(1,surrounding.length);positions[node.id]={x:width/2+Math.cos(angle)*(width/2-100),y:height/2+Math.sin(angle)*(height/2-78)};}
        const saved=state.positions[positionKey(state,width,node.id)];if(saved)positions[node.id]={x:saved[0]*width,y:saved[1]*height};
      }
      return settle(ordered.filter(node=>shown.some(item=>item.id===node.id)),positions,width,height);
    }
    const known=new Set([...primaryOrder,...supportOrder,...auxiliaryOrder]);
    const extras=model.nodes.filter(node=>!known.has(node.id));
    const narrowOrder=['symptom','warranty','rule-check','verify','rule-replace','draft','escalate','human',...auxiliaryOrder];
    const stars={symptom:[.10,.38],'rule-check':[.36,.4],verify:[.62,.38],draft:[.79,.63],human:[.93,.86],warranty:[.31,.1],'rule-replace':[.52,.73],escalate:[.66,.93],'alias-dark':[.02,.66],'alias-off':[.20,.90],device:[.06,.08],board:[.84,.1]};
    for(const node of model.nodes){
      const primary=primaryOrder.indexOf(node.id);const support=supportOrder.indexOf(node.id);const auxiliary=auxiliaryOrder.indexOf(node.id);const extra=extras.indexOf(node);
      if(width<540){const order=narrowOrder.indexOf(node.id);positions[node.id]={x:width/2,y:66+(order<0?narrowOrder.length+extra:order)*144};}
      else if(width<1000){
        if(primary>=0)positions[node.id]={x:width*.27,y:66+primary*178};
        else if(support>=0)positions[node.id]={x:width*.75,y:[166,482,736][support]};
        else{const order=auxiliary>=0?auxiliary:4+extra;positions[node.id]={x:width*(order%2?.75:.27),y:956+Math.floor(order/2)*164};}
      }else if(state.mode==='star'){
        const spot=stars[node.id]||[.1+(extra%5)*.2,.8+Math.floor(extra/5)*.16];positions[node.id]={x:94+spot[0]*(width-188),y:58+spot[1]*(height-116)};
      }else{
        const step=(width-208)/4;const column=primary>=0?primary:support>=0?[1,3,3][support]:auxiliary>=0?auxiliary:extra%5;
        positions[node.id]={x:104+step*column,y:primary>=0?238:support>=0?[66,66,424][support]:auxiliary>=0?598:598+(1+Math.floor(extra/5))*154};
      }
      const saved=state.positions[positionKey(state,width,node.id)];if(saved)positions[node.id]={x:saved[0]*width,y:saved[1]*height};
    }
    return settle(shown,positions,width,height);
  }
  function move(nodes,positions,identifiers,delta,width,height){
    const moving=nodes.filter(node=>identifiers.has(node.id));const fixed=nodes.filter(node=>!identifiers.has(node.id));
    if(!moving.length)return {positions,adjusted:false};
    const marginX=nodeSize.width/2+14;const marginY=nodeSize.height/2+14;
    const minimumX=marginX-Math.min(...moving.map(node=>positions[node.id].x));const maximumX=width-marginX-Math.max(...moving.map(node=>positions[node.id].x));
    const minimumY=marginY-Math.min(...moving.map(node=>positions[node.id].y));const maximumY=height-marginY-Math.max(...moving.map(node=>positions[node.id].y));
    const clamp=offset=>({x:Math.max(minimumX,Math.min(maximumX,offset.x)),y:Math.max(minimumY,Math.min(maximumY,offset.y))});
    const desired=clamp(delta);const allowed=offset=>moving.every(node=>fixed.every(other=>separated({x:positions[node.id].x+offset.x,y:positions[node.id].y+offset.y},positions[other.id])));
    let selected=desired;
    if(!allowed(desired)){
      const columns=[desired.x,0,minimumX,maximumX];const rows=[desired.y,0,minimumY,maximumY];
      for(const node of moving)for(const other of fixed)for(const direction of [-1,1]){columns.push(positions[other.id].x-positions[node.id].x+direction*(nodeSize.width+nodeSize.gap));rows.push(positions[other.id].y-positions[node.id].y+direction*(nodeSize.height+nodeSize.gap));}
      const candidates=[...new Set(columns)].flatMap(horizontal=>[...new Set(rows)].map(vertical=>({x:horizontal,y:vertical}))).filter(offset=>offset.x>=minimumX&&offset.x<=maximumX&&offset.y>=minimumY&&offset.y<=maximumY);
      candidates.sort((left,right)=>Math.hypot(left.x-desired.x,left.y-desired.y)-Math.hypot(right.x-desired.x,right.y-desired.y));selected=candidates.find(allowed)||{x:0,y:0};
    }
    const result=structuredClone(positions);for(const node of moving){result[node.id].x+=selected.x;result[node.id].y+=selected.y;}
    return {positions:result,adjusted:Math.abs(selected.x-delta.x)>.5||Math.abs(selected.y-delta.y)>.5};
  }
  function curve(source,target,scale=1){
    const horizontal=Math.abs(target.x-source.x)>Math.abs(target.y-source.y)*.8;
    const direction=horizontal?Math.sign(target.x-source.x):Math.sign(target.y-source.y);
    const start={x:source.x+(horizontal?direction*((source.width||nodeSize.width)/2+2)*scale:0),y:source.y+(horizontal?0:direction*((source.height||nodeSize.height)/2+2)*scale)};
    const end={x:target.x-(horizontal?direction*((target.width||nodeSize.width)/2+4)*scale:0),y:target.y-(horizontal?0:direction*((target.height||nodeSize.height)/2+4)*scale)};
    const reach=Math.max(28,(horizontal?Math.abs(end.x-start.x):Math.abs(end.y-start.y))*.48);
    return [start,{x:start.x+(horizontal?direction*reach:0),y:start.y+(horizontal?0:direction*reach)},{x:end.x-(horizontal?direction*reach:0),y:end.y-(horizontal?0:direction*reach)},end];
  }
  function point(curve,progress){
    if(curve.segments){let distance=Math.max(0,Math.min(1,progress))*curve.total;for(let index=0;index<curve.segments.length;index++){if(distance<=curve.lengths[index]||index===curve.segments.length-1)return point(curve.segments[index],Math.min(1,distance/curve.lengths[index]));distance-=curve.lengths[index];}}
    const remaining=1-progress;
    return {x:remaining**3*curve[0].x+3*remaining**2*progress*curve[1].x+3*remaining*progress**2*curve[2].x+progress**3*curve[3].x,y:remaining**3*curve[0].y+3*remaining**2*progress*curve[1].y+3*remaining*progress**2*curve[2].y+progress**3*curve[3].y};
  }
  const path=curve=>curve.segments?curve.segments.map((segment,index)=>(index?'':`M${segment[0].x},${segment[0].y} `)+`C${segment[1].x},${segment[1].y} ${segment[2].x},${segment[2].y} ${segment[3].x},${segment[3].y}`).join(' '):`M${curve[0].x},${curve[0].y} C${curve[1].x},${curve[1].y} ${curve[2].x},${curve[2].y} ${curve[3].x},${curve[3].y}`;
  function smoothRoute(points){
    const simplified=points.filter((position,index)=>!index||index===points.length-1||!((points[index-1].x===position.x&&position.x===points[index+1].x)||(points[index-1].y===position.y&&position.y===points[index+1].y)));
    const segments=[];let previous=simplified[0];
    const straight=(start,end)=>[start,{x:start.x+(end.x-start.x)/3,y:start.y+(end.y-start.y)/3},{x:start.x+(end.x-start.x)*2/3,y:start.y+(end.y-start.y)*2/3},end];
    for(let index=1;index<simplified.length-1;index++){
      const corner=simplified[index];const next=simplified[index+1];const incoming=Math.hypot(corner.x-previous.x,corner.y-previous.y);const outgoing=Math.hypot(next.x-corner.x,next.y-corner.y);const radius=Math.min(7,incoming/2,outgoing/2);
      if(!incoming||!outgoing)continue;
      const before={x:corner.x-(corner.x-previous.x)/incoming*radius,y:corner.y-(corner.y-previous.y)/incoming*radius};const after={x:corner.x+(next.x-corner.x)/outgoing*radius,y:corner.y+(next.y-corner.y)/outgoing*radius};
      segments.push(straight(previous,before),[before,{x:before.x+(corner.x-before.x)*2/3,y:before.y+(corner.y-before.y)*2/3},{x:after.x+(corner.x-after.x)*2/3,y:after.y+(corner.y-after.y)*2/3},after]);previous=after;
    }
    segments.push(straight(previous,simplified.at(-1)));
    const lengths=segments.map(segment=>{let length=0;let previous=segment[0];for(let sample=1;sample<=12;sample++){const next=point(segment,sample/12);length+=Math.hypot(next.x-previous.x,next.y-previous.y);previous=next;}return Math.max(.001,length);});
    return {segments,lengths,total:lengths.reduce((total,length)=>total+length,0)};
  }
  function route(source,target,obstacles,width,height,scale=1,channel=0){
    const direct=curve(source,target,scale);const halfWidth=nodeSize.width/2*scale+6;const halfHeight=nodeSize.height/2*scale+6;
    const other=obstacles.filter(position=>position.id!==source.id&&position.id!==target.id);
    const hits=position=>other.some(obstacle=>Math.abs(position.x-obstacle.x)<(obstacle.width?obstacle.width/2*scale+6:halfWidth)&&Math.abs(position.y-obstacle.y)<(obstacle.height?obstacle.height/2*scale+6:halfHeight));
    if(!Array.from({length:39},(_,index)=>point(direct,(index+1)/40)).some(hits))return direct;
    const rectangles=obstacles.map(position=>{const spacing=[source.id,target.id].includes(position.id)?0:channel*4;const horizontal=position.width?position.width/2*scale+6:halfWidth;const vertical=position.height?position.height/2*scale+6:halfHeight;return {left:position.x-horizontal-spacing,right:position.x+horizontal+spacing,top:position.y-vertical-spacing,bottom:position.y+vertical+spacing};});
    const ports=position=>{const horizontal=position.width?position.width/2*scale+6:halfWidth;const vertical=position.height?position.height/2*scale+6:halfHeight;return [{x:position.x+horizontal+3,y:position.y},{x:position.x-horizontal-3,y:position.y},{x:position.x,y:position.y+vertical+3},{x:position.x,y:position.y-vertical-3}].filter(port=>port.x>=3&&port.x<=width-3&&port.y>=3&&port.y<=height-3);};
    const starts=ports(source);const goals=ports(target);
    const columns=[...new Set([3,width-3,...rectangles.flatMap(box=>[box.left-7,box.right+7]),...starts.map(port=>port.x),...goals.map(port=>port.x)].filter(value=>value>=3&&value<=width-3))].sort((left,right)=>left-right);
    const rows=[...new Set([3,height-3,...rectangles.flatMap(box=>[box.top-7,box.bottom+7]),...starts.map(port=>port.y),...goals.map(port=>port.y)].filter(value=>value>=3&&value<=height-3))].sort((left,right)=>left-right);
    const identifier=position=>rows.indexOf(position.y)*columns.length+columns.indexOf(position.x);
    const location=identifier=>({x:columns[identifier%columns.length],y:rows[Math.floor(identifier/columns.length)]});
    const targets=new Set(goals.map(identifier));const blocked=new Set();
    for(let row=0;row<rows.length;row++)for(let column=0;column<columns.length;column++)if(rectangles.some(box=>columns[column]>box.left&&columns[column]<box.right&&rows[row]>box.top&&rows[row]<box.bottom))blocked.add(row*columns.length+column);
    const clear=(first,second)=>!rectangles.some(box=>first.x===second.x?first.x>box.left&&first.x<box.right&&Math.max(first.y,second.y)>box.top&&Math.min(first.y,second.y)<box.bottom:first.y>box.top&&first.y<box.bottom&&Math.max(first.x,second.x)>box.left&&Math.min(first.x,second.x)<box.right);
    const costs=new Map();const previous=new Map();const pending=[];let end=null;
    for(const port of starts){const index=identifier(port);if(!blocked.has(index)){const key=index*3;costs.set(key,0);pending.push({key,index,direction:0,cost:0});}}
    while(pending.length){
      let best=0;for(let index=1;index<pending.length;index++)if(pending[index].cost<pending[best].cost)best=index;
      const active=pending.splice(best,1)[0];if(active.cost!==costs.get(active.key))continue;if(targets.has(active.index)){end=active.key;break;}
      const position=location(active.index);const column=active.index%columns.length;const row=Math.floor(active.index/columns.length);
      const adjacent=[];if(column)adjacent.push([active.index-1,1]);if(column<columns.length-1)adjacent.push([active.index+1,1]);if(row)adjacent.push([active.index-columns.length,2]);if(row<rows.length-1)adjacent.push([active.index+columns.length,2]);
      for(const [next,direction] of adjacent){if(blocked.has(next))continue;const destination=location(next);if(!clear(position,destination))continue;const cost=active.cost+Math.abs(position.x-destination.x)+Math.abs(position.y-destination.y)+(active.direction&&active.direction!==direction?18:0);const key=next*3+direction;if(cost>=(costs.get(key)??Infinity))continue;costs.set(key,cost);previous.set(key,active.key);pending.push({key,index:next,direction,cost});}
    }
    if(end===null)return direct;
    const points=[];let cursor=end;while(cursor!==undefined){points.unshift(location(Math.floor(cursor/3)));cursor=previous.get(cursor);}
    return smoothRoute(points);
  }
  function catalogLayout(model,scope='business'){
    const columns=[{key:'object',name:'对象与依据'},{key:'rule',name:'处理规则'},{key:'action',name:'业务动作'},{key:'human',name:'人工确认'}];
    const columnOf=node=>node.type==='rule'?1:node.type==='action'?2:node.type==='human'?3:0;
    const auxiliary=node=>['alias','candidate','scope'].includes(role(node,model));
    const included=model.nodes.filter(node=>scope==='complete'||!auxiliary(node));
    const ids=new Set(included.map(node=>node.id));
    const links=model.links.filter(link=>ids.has(link.source)&&ids.has(link.target));
    const grouped=columns.map((column,index)=>included.filter(node=>columnOf(node)===index));
    const indexOf=id=>{const column=grouped.find(entries=>entries.some(node=>node.id===id));return column?.findIndex(node=>node.id===id)??0;};
    for(let pass=0;pass<3;pass++)for(const entries of grouped){
      const average=node=>{const outgoing=links.filter(link=>link.source===node.id&&columnOf(included.find(entry=>entry.id===link.target))===columnOf(node)+1).map(link=>indexOf(link.target));const incoming=links.filter(link=>link.target===node.id&&columnOf(included.find(entry=>entry.id===link.source))<columnOf(node)).map(link=>indexOf(link.source));const neighbors=outgoing.length?outgoing:incoming;return neighbors.length?neighbors.reduce((total,value)=>total+value,0)/neighbors.length:indexOf(node.id);};
      const ranks=new Map(entries.map(node=>[node.id,average(node)]));entries.sort((left,right)=>ranks.get(left.id)-ranks.get(right.id));
      const ordered=[];const remaining=[...entries];while(remaining.length){const next=remaining.find(node=>!links.some(link=>link.target===node.id&&remaining.some(entry=>entry.id===link.source&&entry.id!==node.id)))||remaining[0];ordered.push(next);remaining.splice(remaining.indexOf(next),1);}entries.splice(0,entries.length,...ordered);
    }
    const size=window.OrbitMap?.metrics(included)||{width:176,height:108};const width=size.width;const height=size.height;const gap=116;const rowGap=88;const inset=36;const top=88;
    const placed=grouped.flatMap((entries,column)=>entries.map((node,row)=>({...node,column,x:inset+column*(width+gap),y:top+row*(height+rowGap),width,height,auxiliary:auxiliary(node)})));
    const indexed=new Map(placed.map(node=>[node.id,node]));
    const baseHeight=top+Math.max(1,...grouped.map(entries=>entries.length))*(height+rowGap)-rowGap+32;
    const outer=links.filter(link=>Math.abs(indexed.get(link.target).column-indexed.get(link.source).column)>1||indexed.get(link.target).column<indexed.get(link.source).column);
    const positions=new Map(links.map(link=>[link.id,{}]));
    const ports=new Map();
    for(const link of links){
      const source=indexed.get(link.source);const target=indexed.get(link.target);const same=source.column===target.column;
      const vertical=same&&Math.abs(source.y-target.y)===height+rowGap;const down=target.y>source.y;
      for(const [node,endpoint,side] of [[source,'source',vertical?(down?'bottom':'top'):'right'],[target,'target',vertical?(down?'top':'bottom'):same?'right':'left']]){
        const key=node.id+':'+side;if(!ports.has(key))ports.set(key,[]);ports.get(key).push({link,endpoint,node,side});
      }
    }
    for(const entries of ports.values()){
      entries.sort((left,right)=>indexed.get(left.link[left.endpoint==='source'?'target':'source']).y-indexed.get(right.link[right.endpoint==='source'?'target':'source']).y);
      entries.forEach((entry,index)=>{const vertical=['top','bottom'].includes(entry.side);positions.get(entry.link.id)[entry.endpoint]={x:entry.node.x+(vertical?width*(index+1)/(entries.length+1):entry.side==='right'?width:0),y:entry.node.y+(vertical?(entry.side==='bottom'?height:0):height*(index+1)/(entries.length+1))};});
    }
    const occupied=[];
    const routes=links.map((link,index)=>{
      const source=indexed.get(link.source);const target=indexed.get(link.target);const start=positions.get(link.id).source;const end=positions.get(link.id).target;
      const outside=outer.indexOf(link);let points;
      if(outside>=0){
        const bottom=baseHeight+outside*38;const departure=source.x+width+16+(outside%4)*10;const arrival=Math.max(8,target.x-16-(outside%4)*10);
        points=[start,{x:departure,y:start.y},{x:departure,y:bottom},{x:arrival,y:bottom},{x:arrival,y:end.y},end];
      }else if(source.column===target.column&&Math.abs(source.y-target.y)===height+rowGap){
        const middle=(start.y+end.y)/2;points=[start,{x:start.x,y:middle},{x:end.x,y:middle},end];
      }else if(source.column===target.column){
        const channel=source.x+width+gap/2+(index%3)*8;points=[start,{x:channel,y:start.y},{x:channel,y:end.y},end];
      }else{
        const neighbors=links.filter(entry=>indexed.get(entry.source).column===source.column&&indexed.get(entry.target).column===target.column);
        const channel=source.x+width+24+(gap-48)*(neighbors.indexOf(link)+1)/(neighbors.length+1);
        points=[start,{x:channel,y:start.y},{x:channel,y:end.y},end];
      }
      points=points.filter((point,index)=>!index||point.x!==points[index-1].x||point.y!==points[index-1].y);
      points=points.filter((point,index)=>!index||index===points.length-1||!((points[index-1].x===point.x&&point.x===points[index+1].x)||(points[index-1].y===point.y&&point.y===points[index+1].y)));
      const labelWidth=Math.min(104,Math.max(64,String(link.label).length*12+20));const candidates=[];
      for(let segment=1;segment<points.length;segment++)for(const fraction of [.5,.25,.75]){
        const before=points[segment-1];const after=points[segment];candidates.push({x:before.x+(after.x-before.x)*fraction,y:before.y+(after.y-before.y)*fraction});
      }
      const label=candidates.find(candidate=>candidate.y>48&&!occupied.some(box=>Math.abs(box.x-candidate.x)<(box.width+labelWidth)/2+6&&Math.abs(box.y-candidate.y)<30)&&!placed.some(node=>candidate.x+labelWidth/2>node.x-6&&candidate.x-labelWidth/2<node.x+width+6&&candidate.y+13>node.y-6&&candidate.y-13<node.y+height+6));
      if(label)occupied.push({...label,width:labelWidth});
      return {...link,kind:relation(link),points,labelPosition:label?{...label,width:labelWidth}:null,path:points.map((point,index)=>(index?'L':'M')+point.x+','+point.y).join(' ')};
    });
    return {columns:columns.map((column,index)=>({...column,x:inset+index*(width+gap),width,count:grouped[index].length})),nodes:placed,links:routes,width:inset*2+columns.length*width+(columns.length-1)*gap+gap/2,height:baseHeight+Math.max(0,outer.length-1)*38+(outer.length?36:0),hiddenNodes:model.nodes.length-included.length,hiddenLinks:model.links.length-links.length};
  }
  return {palette,relation,role,visible,lane,nodeSize,dimensions,positionKey,separated,settle,move,layout,curve,route,point,path,catalogLayout};
})();
