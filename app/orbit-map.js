window.OrbitMap=(()=>{
  const layouts=new WeakMap();const contexts=new Map();const mounted=new WeakSet();const animations=new WeakMap();
  let host;let active=null;let suppressed=null;let frame=null;
  const units=text=>Array.from(String(text||'')).length;
  function excerpt(text){let result='';for(const character of String(text||'')){if(units(result+character)>29)return result+'…';result+=character;}return result;}
  function metrics(nodes){return {width:224,height:Math.max(164,...nodes.map(node=>120+Math.max(1,Math.ceil(units(node.name)/10))*24))};}
  function storage(state,key){if(!layouts.has(state))layouts.set(state,new Map());const saved=layouts.get(state);if(!saved.has(key))saved.set(key,new Map());return saved.get(key);}
  const intersects=(left,right,gap=0)=>left.x<right.x+right.width+gap&&left.x+left.width+gap>right.x&&left.y<right.y+right.height+gap&&left.y+left.height+gap>right.y;
  function settle(node,nodes){
    const fixed=nodes.filter(entry=>entry.id!==node.id);const allowed=candidate=>candidate.x>=24&&candidate.y>=76&&fixed.every(other=>!intersects(candidate,other,16));
    if(allowed(node))return node;
    const columns=[node.x,24,...fixed.flatMap(entry=>[entry.x-node.width-16,entry.x+entry.width+16])];
    const rows=[node.y,76,...fixed.flatMap(entry=>[entry.y-node.height-16,entry.y+entry.height+16])];
    return columns.flatMap(horizontal=>rows.map(vertical=>({...node,x:horizontal,y:vertical}))).filter(allowed).sort((left,right)=>Math.hypot(left.x-node.x,left.y-node.y)-Math.hypot(right.x-node.x,right.y-node.y))[0]||node;
  }
  function reroute(layout){
    const graph=window.OrbitAtlasGraph;const indexed=new Map(layout.nodes.map(node=>[node.id,{...node,x:node.x+node.width/2,y:node.y+node.height/2}]));const occupied=[];
    const links=layout.links.map((link,index)=>{
      const source=indexed.get(link.source);const target=indexed.get(link.target);if(!source||!target)return {...link,path:'',labelPosition:null};
      let curve;
      if(source.id===target.id){const right=source.x+source.width/2+4;const top=source.y-source.height/2;curve=[{x:right,y:top+24},{x:right+104,y:top-60},{x:right+104,y:top+source.height+60},{x:right,y:top+source.height-24}];}
      else curve=graph.route(source,target,[...indexed.values()],layout.width,layout.height,1,index%3);
      const parallel=layout.links.filter(entry=>entry.source===link.source&&entry.target===link.target||entry.source===link.target&&entry.target===link.source).sort((left,right)=>left.id.localeCompare(right.id));
      if(parallel.length>1&&!curve.segments&&source.id!==target.id){const length=Math.hypot(target.x-source.x,target.y-source.y)||1;const offset=(parallel.findIndex(entry=>entry.id===link.id)-(parallel.length-1)/2)*112*(link.source.localeCompare(link.target)<0?1:-1);curve=curve.map((point,position)=>position===1||position===2?{x:point.x-(target.y-source.y)/length*offset,y:point.y+(target.x-source.x)/length*offset}:point);}
      const fractions=parallel.length>1?[.28+parallel.findIndex(entry=>entry.id===link.id)/parallel.length*.44,.5,.2,.8]:[.5,.35,.65,.2,.8];
      const width=Math.min(160,Math.max(66,units(link.label)*12+24));
      const position=fractions.map(fraction=>graph.point(curve,fraction)).find(point=>point.x-width/2>=8&&point.x+width/2<=layout.width-8&&point.y>=24&&point.y<=layout.height-24&&!layout.nodes.some(node=>intersects({x:point.x-width/2,y:point.y-15,width,height:30},node,10))&&!occupied.some(box=>intersects({x:point.x-width/2,y:point.y-15,width,height:30},box,8)));
      if(position)occupied.push({x:position.x-width/2,y:position.y-15,width,height:30});
      return {...link,path:graph.path(curve),labelPosition:position?{...position,width}:null};
    });
    return {...layout,links};
  }
  function place(base,positions){
    if(!positions.size)return base;
    const nodes=base.nodes.map(node=>({...node,...positions.get(node.id)}));
    return reroute({...base,nodes,width:Math.max(base.width,...nodes.map(node=>node.x+node.width+144)),height:Math.max(base.height,...nodes.map(node=>node.y+node.height+96))});
  }
  function bind(prefix,base,state,key){const positions=storage(state,key);const layout=place(base,positions);contexts.set(prefix,{prefix,base,state,key,positions,layout});return layout;}
  function reset(prefix){const context=contexts.get(prefix);if(!context)return;context.positions.clear();context.state.zoom=1;host.render();document.querySelector(`[data-relationship-map="${prefix}"] [data-map-viewport]`)?.scrollTo(0,0);}
  function fit(prefix){const context=contexts.get(prefix);const viewport=document.querySelector(`[data-relationship-map="${prefix}"] [data-map-viewport]`);if(!context||!viewport)return;
    context.state.zoom=Math.max(.05,Math.min(1,(viewport.clientWidth-32)/context.layout.width,(viewport.clientHeight-32)/context.layout.height));paint(viewport,context);viewport.scrollTo(0,0);announce(viewport,'已显示完整图谱');}
  function paint(viewport,context){
    const stage=viewport.querySelector('[data-map-stage]');const space=stage?.parentElement;if(!stage||!space)return;
    const layout=context.layout;const zoom=context.state.zoom??1;stage.style.width=layout.width+'px';stage.style.height=layout.height+'px';stage.style.transform=`scale(${zoom})`;stage.dataset.width=layout.width;stage.dataset.height=layout.height;
    space.style.width=layout.width*zoom+'px';space.style.height=layout.height*zoom+'px';const svg=stage.querySelector('svg');svg?.setAttribute('width',layout.width);svg?.setAttribute('height',layout.height);
    for(const element of stage.querySelectorAll('[data-map-node]')){const node=layout.nodes.find(entry=>entry.id===element.dataset.mapNode);if(node){element.style.left=node.x+'px';element.style.top=node.y+'px';}}
    for(const element of stage.querySelectorAll('[data-map-edge]')){const link=layout.links.find(entry=>entry.id===element.dataset.mapEdge);element.querySelector('path')?.setAttribute('d',link?.path||'');}
    for(const element of stage.querySelectorAll('[data-map-label]')){const link=layout.links.find(entry=>entry.id===element.dataset.mapLabel);element.hidden=!link?.labelPosition||element.dataset.mapVisible==='false';if(link?.labelPosition){element.style.left=link.labelPosition.x+'px';element.style.top=link.labelPosition.y+'px';element.style.width=link.labelPosition.width+'px';}}
    const root=viewport.closest('[data-relationship-map]');const readout=root?.querySelector('[data-map-zoom]');if(readout)readout.textContent=Math.round(zoom*100)+'%';
  }
  function announce(viewport,message){const status=viewport.closest('[data-relationship-map]')?.querySelector('[data-map-status]');if(status)status.textContent=message;}
  function applyMove(gesture){
    if(!gesture.moved)return;
    if(!gesture.node){gesture.viewport.scrollLeft=gesture.scrollLeft-gesture.deltaX;gesture.viewport.scrollTop=gesture.scrollTop-gesture.deltaY;return;}
    const node={...gesture.node,x:Math.max(24,gesture.node.x+gesture.deltaX/gesture.zoom),y:Math.max(76,gesture.node.y+gesture.deltaY/gesture.zoom)};
    gesture.context.positions.set(node.id,{x:node.x,y:node.y});gesture.context.layout=place(gesture.context.base,gesture.context.positions);paint(gesture.viewport,gesture.context);
  }
  function flush(){if(frame!==null){cancelAnimationFrame(frame);frame=null;}if(active)applyMove(active);}
  function finish(cancel=false){
    if(!active)return;flush();const gesture=active;active=null;
    if(gesture.node&&gesture.moved){
      if(cancel){if(gesture.before)gesture.context.positions.set(gesture.node.id,gesture.before);else gesture.context.positions.delete(gesture.node.id);}
      else{const moved=gesture.context.layout.nodes.find(node=>node.id===gesture.node.id);const placed=settle(moved,gesture.context.layout.nodes);gesture.context.positions.set(moved.id,{x:placed.x,y:placed.y});}
      gesture.context.layout=place(gesture.context.base,gesture.context.positions);paint(gesture.viewport,gesture.context);announce(gesture.viewport,cancel?'已取消移动':`已移动「${gesture.node.name}」`);
    }
    if(cancel&&!gesture.node){gesture.viewport.scrollLeft=gesture.scrollLeft;gesture.viewport.scrollTop=gesture.scrollTop;}
    gesture.viewport.classList.remove('is-panning','is-moving');gesture.element?.classList.remove('is-dragging');
    if(gesture.captureTarget.hasPointerCapture?.(gesture.pointerId))gesture.captureTarget.releasePointerCapture(gesture.pointerId);
    if(gesture.moved)suppressed={prefix:gesture.context.prefix,until:performance.now()+500};
  }
  function down(event){
    if(active||event.button!==0||event.isPrimary===false)return;
    const viewport=event.target.closest?.('[data-map-viewport]');if(!viewport)return;
    const root=viewport.closest('[data-relationship-map]');const context=contexts.get(root?.dataset.relationshipMap);if(!context)return;
    const element=event.target.closest('[data-map-node]');if(!element&&event.target.closest('button,a,input,select,textarea,summary'))return;
    const node=element?context.layout.nodes.find(entry=>entry.id===element.dataset.mapNode):null;if(element&&!node)return;
    event.preventDefault();element?.focus({preventScroll:true});const captureTarget=element||viewport;captureTarget.setPointerCapture(event.pointerId);
    active={viewport,context,element,node,captureTarget,before:node?context.positions.get(node.id):null,zoom:context.state.zoom??1,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,deltaX:0,deltaY:0,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop,moved:false};
  }
  function move(event){
    if(!active||event.pointerId!==active.pointerId)return;
    active.deltaX=event.clientX-active.startX;active.deltaY=event.clientY-active.startY;
    if(!active.moved&&Math.hypot(active.deltaX,active.deltaY)<5)return;
    active.moved=true;active.viewport.classList.add(active.node?'is-moving':'is-panning');active.element?.classList.add('is-dragging');
    if(frame===null)frame=requestAnimationFrame(()=>{frame=null;if(active)applyMove(active);});
  }
  function keyboard(event){
    if(event.key==='Escape'&&active){event.preventDefault();event.stopImmediatePropagation();finish(true);return;}
    const element=event.target.closest?.('[data-map-node]');if(!element||event.altKey||event.ctrlKey||event.metaKey)return;
    const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const offset=offsets[event.key];if(!offset)return;
    const viewport=element.closest('[data-map-viewport]');const context=contexts.get(viewport.closest('[data-relationship-map]').dataset.relationshipMap);if(!context)return;
    event.preventDefault();event.stopImmediatePropagation();const node=context.layout.nodes.find(entry=>entry.id===element.dataset.mapNode);const step=event.shiftKey?40:12;
    const position=settle({...node,x:Math.max(24,node.x+offset[0]*step),y:Math.max(76,node.y+offset[1]*step)},context.layout.nodes);
    context.positions.set(node.id,{x:position.x,y:position.y});context.layout=place(context.base,context.positions);paint(viewport,context);announce(viewport,`已移动「${node.name}」`);
  }
  function mount(){
    for(const viewport of document.querySelectorAll('[data-map-viewport]')){
      if(mounted.has(viewport))continue;mounted.add(viewport);
      const context=contexts.get(viewport.closest('[data-relationship-map]').dataset.relationshipMap);if(!context)continue;
      if(context.state.zoom===null)context.state.zoom=1;paint(viewport,context);
      const signature=context.key+':'+context.state.focusId+':'+context.state.edgeId+':'+context.layout.nodes.map(node=>[node.id,node.x,node.y].join(',')).join(';');
      if(animations.get(context.state)!==signature&&!matchMedia('(prefers-reduced-motion: reduce)').matches)viewport.querySelector('[data-map-stage]')?.animate?.([{opacity:.4},{opacity:1}],{duration:180,easing:'cubic-bezier(.16,1,.3,1)'});animations.set(context.state,signature);
    }
  }
  function configure(adapter){if(host)return;host=adapter;
    document.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,true);
    document.addEventListener('pointerup',event=>{if(active?.pointerId===event.pointerId)finish();},true);
    document.addEventListener('pointercancel',event=>{if(active?.pointerId===event.pointerId)finish(true);},true);
    document.addEventListener('lostpointercapture',event=>{if(active?.pointerId===event.pointerId)finish(true);},true);
    document.addEventListener('keydown',keyboard,true);
    document.addEventListener('click',event=>{const root=event.target.closest?.('[data-relationship-map]');if(suppressed&&suppressed.until>performance.now()&&root?.dataset.relationshipMap===suppressed.prefix){event.preventDefault();event.stopImmediatePropagation();suppressed=null;return;}
      const control=event.target.closest?.('[data-map-control]');if(!control||!root)return;event.preventDefault();event.stopImmediatePropagation();const prefix=root.dataset.relationshipMap;const context=contexts.get(prefix);if(!context)return;
      if(control.dataset.mapControl==='reset')reset(prefix);else if(control.dataset.mapControl==='fit')fit(prefix);else{context.state.zoom=Math.round(Math.max(.3,Math.min(1.6,(context.state.zoom??1)+(control.dataset.mapControl==='in'?.1:-.1)))*100)/100;const viewport=root.querySelector('[data-map-viewport]');const before=Number(viewport.querySelector('[data-map-stage]').style.transform.match(/[\d.]+/)?.[0])||1;const center={x:(viewport.scrollLeft+viewport.clientWidth/2)/before,y:(viewport.scrollTop+viewport.clientHeight/2)/before};paint(viewport,context);viewport.scrollTo(Math.max(0,center.x*context.state.zoom-viewport.clientWidth/2),Math.max(0,center.y*context.state.zoom-viewport.clientHeight/2));}
    },true);
    window.addEventListener('blur',()=>finish(true));
  }
  function controls(){return `<div class="rm-controls" role="group" aria-label="画布操作"><button type="button" data-map-control="out" aria-label="缩小关系图">−</button><output data-map-zoom aria-label="缩放比例">100%</output><button type="button" data-map-control="in" aria-label="放大关系图">+</button><span></span><button type="button" data-map-control="fit">适应画布</button><button type="button" data-map-control="reset">恢复排布</button></div>`;}
  function hint(){return '<div class="rm-hint"><span data-map-status role="status" aria-live="polite">拖动节点排布 · 拖动空白平移</span><details><summary>操作帮助</summary><p>点击节点查看关系；方向键微调位置，Shift 加速，Esc 取消拖动。编号是定义索引，不是执行顺序。</p></details></div>';}
  return {configure,metrics,excerpt,reroute,place,bind,settle,reset,fit,controls,hint,mount,capture(){finish(true);}};
})();
