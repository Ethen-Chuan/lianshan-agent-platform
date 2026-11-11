window.OrbitFlowGestures = (() => {
  let host;
  let active=null;
  let frame=0;
  let suppressed=null;
  const clone=value=>structuredClone(value);
  const valid=gesture=>gesture.viewport.isConnected&&host.current()?.id===gesture.projectId&&host.data().id===gesture.flowId&&host.data().revision===gesture.revision&&host.data().layoutRevision===gesture.layoutRevision;
  const point=(event,gesture)=>{const bounds=gesture.stage.getBoundingClientRect();return {x:(event.clientX-bounds.left)/gesture.zoom,y:(event.clientY-bounds.top)/gesture.zoom};};
  function cleanup(gesture) {
    cancelAnimationFrame(frame);frame=0;
    gesture.viewport.classList.remove('is-panning');
    gesture.stage.querySelectorAll('.is-dragging,.can-connect,.cannot-connect').forEach(node=>node.classList.remove('is-dragging','can-connect','cannot-connect'));
    gesture.stage.querySelector('.flow-wire-preview')?.remove();
    if(gesture.capture.hasPointerCapture(gesture.pointerId))gesture.capture.releasePointerCapture(gesture.pointerId);
  }
  function cancel() {
    if(!active)return false;
    const gesture=active;active=null;cleanup(gesture);
    if(gesture.moved){suppressed={pointerId:gesture.pointerId,until:performance.now()+400};if(valid(gesture)&&gesture.kind!=='pan')host.refresh();}
    return true;
  }
  function dimensions(gesture) {
    const width=Math.max(840,...gesture.graph.nodes.map(node=>node.x+310));
    const height=Math.max(540,...gesture.graph.nodes.map(node=>node.y+206));
    gesture.stage.style.width=width+'px';gesture.stage.style.height=height+'px';
    gesture.stage.parentElement.style.width=width*gesture.zoom+'px';gesture.stage.parentElement.style.height=height*gesture.zoom+'px';
    const svg=gesture.stage.querySelector('.flow-lines');svg.setAttribute('width',width);svg.setAttribute('height',height);
  }
  function scrollAtEdge(gesture) {
    const bounds=gesture.viewport.getBoundingClientRect();const pointer=gesture.pointer;
    if(pointer.clientX<bounds.left-25||pointer.clientX>bounds.right+25||pointer.clientY<bounds.top-25||pointer.clientY>bounds.bottom+25)return;
    const speed=(coordinate,start,end)=>coordinate<start+36?-Math.min(14,(start+36-coordinate)/3):coordinate>end-36?Math.min(14,(coordinate-end+36)/3):0;
    gesture.viewport.scrollLeft+=speed(pointer.clientX,bounds.left,bounds.right);
    gesture.viewport.scrollTop+=speed(pointer.clientY,bounds.top,bounds.bottom);
  }
  function paint() {
    frame=0;const gesture=active;if(!gesture||!gesture.moved)return;
    if(!valid(gesture)){cancel();return;}
    if(gesture.kind==='pan'){
      gesture.viewport.scrollLeft=gesture.scrollLeft-(gesture.pointer.clientX-gesture.clientX);
      gesture.viewport.scrollTop=gesture.scrollTop-(gesture.pointer.clientY-gesture.clientY);
      return;
    }
    scrollAtEdge(gesture);const position=point(gesture.pointer,gesture);
    if(gesture.kind==='node'){
      const node=gesture.graph.nodes.find(node=>node.id===gesture.nodeId);const original=gesture.origin;
      const clamp=value=>Math.max(24,Math.min(7000,gesture.snap?Math.round(value/12)*12:Math.round(value)));
      const nextX=clamp(original.x+position.x-gesture.start.x);const nextY=clamp(original.y+position.y-gesture.start.y);
      if(node.x!==nextX||node.y!==nextY){
        node.x=nextX;node.y=nextY;
        gesture.card.style.left=node.x+'px';gesture.card.style.top=node.y+'px';dimensions(gesture);
        gesture.stage.querySelector('.flow-lines').innerHTML=host.markers()+host.paths(gesture.graph);
      }
    }else{
      const source=gesture.graph.nodes.find(node=>node.id===gesture.nodeId);const start=host.anchor(gesture.graph,source,false,gesture.port);
      gesture.wire.setAttribute('d',host.curve(start,position,gesture.graph.layout==='vertical'));
    }
    frame=requestAnimationFrame(paint);
  }
  function begin(event) {
    suppressed=null;
    if(active||event.button!==0||!event.isPrimary)return;
    const viewport=event.target.closest('#flow-viewport');if(!viewport)return;
    const stage=viewport.querySelector('#flow-stage');const output=event.target.closest('[data-flow-port="out"]');const card=event.target.closest('.flow-node');
    if(event.target.closest('[data-flow-port="in"],.flow-link,.flow-edge-add,.flow-node-actions'))return;
    const kind=output?'wire':card?'node':'pan';const state=host.view();
    if(kind!=='pan'&&(state.pending||state.agent.proposal))return;
    if(kind==='node'&&state.connect)return;
    if(kind==='pan'&&event.target.closest('button,input,textarea,select'))return;
    const graph=clone(host.data());const capture=output||card?.querySelector('.flow-node-body')||viewport;
    active={kind,viewport,stage,capture,card,graph,nodeId:card?.dataset.node,port:Number(output?.dataset.port||0),projectId:host.current().id,flowId:graph.id,revision:graph.revision,layoutRevision:graph.layoutRevision,zoom:state.zoom,snap:state.snap,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop,pointer:{clientX:event.clientX,clientY:event.clientY},moved:false};
    active.start=point(event,active);active.origin=graph.nodes.find(node=>node.id===active.nodeId);
    if(active.origin)active.origin={...active.origin};
    capture.setPointerCapture(event.pointerId);
  }
  function move(event) {
    const gesture=active;if(!gesture||event.pointerId!==gesture.pointerId)return;
    if(!valid(gesture)){cancel();return;}
    gesture.pointer={clientX:event.clientX,clientY:event.clientY};
    if(!gesture.moved&&Math.hypot(event.clientX-gesture.clientX,event.clientY-gesture.clientY)<5)return;
    event.preventDefault();
    if(!gesture.moved){
      gesture.moved=true;
      if(gesture.kind==='node')gesture.card.classList.add('is-dragging');
      if(gesture.kind==='pan')gesture.viewport.classList.add('is-panning');
      if(gesture.kind==='wire'){
        gesture.wire=document.createElementNS('http://www.w3.org/2000/svg','path');gesture.wire.setAttribute('class','flow-wire-preview');gesture.wire.setAttribute('marker-end','url(#flow-arrow)');gesture.stage.querySelector('.flow-lines').append(gesture.wire);
        gesture.stage.querySelectorAll('.flow-node').forEach(card=>{if(card.dataset.node===gesture.nodeId)return;try{host.addConnection(clone(gesture.graph),gesture.nodeId,card.dataset.node,'',gesture.port);card.classList.add('can-connect');}catch{card.classList.add('cannot-connect');}});
      }
    }
    if(!frame)frame=requestAnimationFrame(paint);
  }
  function finish(event) {
    const gesture=active;if(!gesture||event.pointerId!==gesture.pointerId)return;
    if(!valid(gesture)){cancel();return;}
    if(gesture.moved){gesture.pointer={clientX:event.clientX,clientY:event.clientY};cancelAnimationFrame(frame);paint();}
    active=null;cleanup(gesture);if(!gesture.moved)return;
    suppressed={pointerId:event.pointerId,until:performance.now()+400};
    try{
      if(gesture.kind==='node'){
        const node=gesture.graph.nodes.find(node=>node.id===gesture.nodeId);
        if(node.x!==gesture.origin.x||node.y!==gesture.origin.y){host.view().selected=node.id;host.view().selectedEdge='';host.save(gesture.graph,false);}
        host.refresh();document.querySelector(`.flow-node-body[data-id="${CSS.escape(node.id)}"]`)?.focus({preventScroll:true});
      }else if(gesture.kind==='wire'){
        const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.flow-node');
        if(target&&gesture.stage.contains(target))host.connect(gesture.nodeId,target.dataset.node,'',gesture.port);
      }
    }catch(error){host.view().error=error.message;host.refresh();}
  }
  function configure(adapter) {
    host=adapter;
    document.addEventListener('pointerdown',begin);
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',finish);
    document.addEventListener('pointercancel',event=>{if(active?.pointerId===event.pointerId)cancel();});
    document.addEventListener('lostpointercapture',event=>{if(active?.pointerId===event.pointerId)cancel();});
    document.addEventListener('click',event=>{if(suppressed&&performance.now()<suppressed.until&&event.pointerId===suppressed.pointerId){event.preventDefault();event.stopImmediatePropagation();}suppressed=null;},true);
    window.addEventListener('blur',cancel);
    window.addEventListener('hashchange',cancel);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  }
  return {configure,cancel};
})();
