window.OrbitMapMotion=(()=>{
  const memories=new WeakMap();const running=new Set();const surfaces=new Set();
  const easing=progress=>1-(1-progress)**3;
  const interpolate=(start,end,progress)=>start+(end-start)*progress;
  let preference;
  const reduced=()=>!!preference?.matches;
  const allowed=context=>context.state.motionEnabled!==false&&!reduced()&&!document.hidden;
  const rootOf=viewport=>viewport.closest('[data-relationship-map]');
  const enabledSurface=viewport=>rootOf(viewport)?.dataset.obMode==='star';
  function elements(viewport){
    const stage=viewport.querySelector('[data-map-stage]');
    return {stage,nodes:[...stage.querySelectorAll('[data-map-node]')],edges:[...stage.querySelectorAll('[data-map-edge]')],labels:[...stage.querySelectorAll('[data-map-label]')],groups:[...stage.querySelectorAll('[data-map-group]')]};
  }
  function snapshot(viewport,context){
    const items=elements(viewport);
    const scale=Number(items.stage.style.transform?.match(/scale\(([\d.]+)/)?.[1])||context.state.zoom||1;
    return {viewport,context,layout:context.layout,zoom:scale,left:viewport.scrollLeft,top:viewport.scrollTop,
      geometry:JSON.stringify([context.key,context.layout.nodes.map(node=>[node.id,node.x,node.y,node.width,node.height]),context.layout.links.map(link=>[link.id,link.path])]),
      nodes:new Map(items.nodes.map(element=>[element.dataset.mapNode,{opacity:element.classList.contains('is-muted')?.7:1,selected:element.classList.contains('is-selected')} ])),
      edges:new Map(items.edges.map(element=>[element.dataset.mapEdge,element.classList.contains('is-muted')?.18:1])),groups:new Map(items.groups.map(element=>[element.dataset.mapGroup,element.classList.contains('is-muted')?.8:1]))};
  }
  function remember(viewport,context){
    const old=memories.get(context.state);
    if(old?.viewport===viewport){const current=snapshot(viewport,context);old.layout=current.layout;old.zoom=current.zoom;old.left=current.left;old.top=current.top;old.geometry=current.geometry;}
  }
  function sync(viewport,context){
    const root=rootOf(viewport);if(!root)return;
    root.dataset.mapMotion=allowed(context)?'on':'off';
    const toggle=root.querySelector('[data-map-control="motion"]');
    if(toggle){toggle.setAttribute('aria-pressed',String(allowed(context)));toggle.disabled=reduced();toggle.title=reduced()?'已跟随系统减少动态效果':'开关图谱动效';}
    const replay=root.querySelector('[data-map-control="replay"]');if(replay)replay.disabled=!allowed(context);
  }
  function restore(effect){
    for(const [element,values] of effect.originals)for(const [property,value] of Object.entries(values))element.style[property]=value;
    for(const element of effect.items.edges){const link=effect.context.layout.links.find(entry=>entry.id===element.dataset.mapEdge);element.querySelector('path')?.setAttribute('d',link?.path||'');}
    rootOf(effect.viewport)?.classList.remove('is-map-animating');
  }
  function stop(effect){
    if(!running.has(effect))return;
    running.delete(effect);if(effect.frame!==null)cancelAnimationFrame(effect.frame);restore(effect);remember(effect.viewport,effect.context);
  }
  function cancel(viewport){for(const effect of [...running])if(!viewport||effect.viewport===viewport)stop(effect);}
  function starts(before,after){
    const oldNodes=new Map(before?.layout.nodes.map(node=>[node.id,node])||[]);
    return after.layout.nodes.map(node=>{
      const old=oldNodes.get(node.id);
      if(old){const ratio=before.zoom/after.zoom;return {...node,x:(old.x*before.zoom-before.left+after.left)/after.zoom,y:(old.y*before.zoom-before.top+after.top)/after.zoom,width:old.width*ratio,height:old.height*ratio};}
      const scale=node.isCenter?.96:.98;return {...node,x:node.x+(node.width-node.width*scale)/2+(node.isCenter?0:node.x<after.layout.width/2?18:-18),y:node.y+(node.height-node.height*scale)/2+10,width:node.width*scale,height:node.height*scale};
    });
  }
  function sample(curve){return Array.from({length:33},(_,index)=>window.OrbitAtlasGraph.point(curve,index/32));}
  function pathBetween(start,end,progress){return start.map((point,index)=>`${index?'L':'M'}${interpolate(point.x,end[index].x,progress).toFixed(2)},${interpolate(point.y,end[index].y,progress).toFixed(2)}`).join(' ');}
  function animate(viewport,context,before,after,replay=false){
    cancel(viewport);if(!allowed(context)||!after.layout.nodes.length)return;
    const moving=replay||!before||before.geometry!==after.geometry;
    const focused=!before||JSON.stringify([...before.nodes])!==JSON.stringify([...after.nodes])||JSON.stringify([...before.edges])!==JSON.stringify([...after.edges]);
    if(!moving&&!focused)return;
    const items=elements(viewport);const originals=new Map();
    const set=(element,property,value)=>{if(!element)return;if(!originals.has(element))originals.set(element,{});const saved=originals.get(element);if(!(property in saved))saved[property]=element.style[property]||'';element.style[property]=value;};
    const spatial=moving&&after.layout.nodes.length<=18&&after.layout.links.length<=24;
    const initial=spatial?starts(replay?null:before,after):after.layout.nodes;
    const startGroups=new Map(window.OrbitStar.frameGroups({...after.layout,nodes:initial}).groups.map(group=>[group.id,group]));const endGroups=new Map(after.layout.groups.map(group=>[group.id,group]));
    const startMap=new Map(initial.map(node=>[node.id,node]));const finalMap=new Map(after.layout.nodes.map(node=>[node.id,node]));
    const links=spatial?window.OrbitMap.reroute({...after.layout,nodes:initial}).links:[];
    const curves=new Map(links.flatMap(link=>{const target=after.layout.links.find(entry=>entry.id===link.id);return link.curve&&target?.curve?[[link.id,{start:sample(link.curve),end:sample(target.curve)}]]:[];}));
    const signals=new Map(after.layout.nodes.length<=18&&after.layout.links.length<=24?after.layout.links.filter(link=>after.edges.get(link.id)===1&&window.OrbitAtlasGraph.relation(link)!=='candidate'&&link.curve).map(link=>[link.id,curves.get(link.id)||{start:sample(link.curve),end:sample(link.curve)}]):[]);
    const startLabels=new Map(links.map(link=>[link.id,link.labelPosition]));const endLabels=new Map(after.layout.links.map(link=>[link.id,link.labelPosition]));
    const duration=moving?380:200;const started=performance.now();const effect={viewport,context,items,originals,frame:null};running.add(effect);rootOf(viewport)?.classList.add('is-map-animating');
    function frame(now){
      if(!running.has(effect))return;
      if(!allowed(context)||viewport.isConnected===false){stop(effect);return;}
      const progress=Math.max(0,Math.min(1,(now-started)/duration));const eased=easing(progress);
      for(const element of items.groups){
        if(element.hidden)continue;const identifier=element.dataset.mapGroup;const start=startGroups.get(identifier);const target=endGroups.get(identifier);if(!target)continue;
        set(element,'opacity',String(interpolate(before?.groups?.get(identifier)??0,after.groups.get(identifier)??1,eased)));
        if(spatial&&start){set(element,'transformOrigin','0 0');set(element,'transform',`translate(${(start.x-target.x)*(1-eased)}px,${(start.y-target.y)*(1-eased)}px) scale(${interpolate(start.width/target.width,1,eased)},${interpolate(start.height/target.height,1,eased)})`);}
      }
      for(const [index,element] of items.nodes.entries()){
        const identifier=element.dataset.mapNode;const target=finalMap.get(identifier);if(!target)continue;
        const start=startMap.get(identifier);const appearance=after.nodes.get(identifier);const was=before?.nodes.get(identifier);
        const arriving=replay||!was;const delay=target.isCenter?0:Math.min(96,index*20);const reveal=easing(Math.max(0,Math.min(1,(now-started-delay)/220)));
        set(element,'opacity',String(arriving?appearance.opacity*reveal:interpolate(was.opacity,appearance.opacity,eased)));
        if(spatial){set(element,'transformOrigin','0 0');set(element,'transform',`translate(${(start.x-target.x)*(1-eased)}px,${(start.y-target.y)*(1-eased)}px) scale(${interpolate(start.width/target.width,1,eased)},${interpolate(start.height/target.height,1,eased)})`);}
        const halo=element.querySelector('[data-star-halo]');if(halo&&(target.isCenter||appearance.selected&&!was?.selected)){set(halo,'opacity',String(Math.sin(progress*Math.PI)*.7));set(halo,'transform',`scale(${interpolate(.98,1.055,eased)})`);}
        if(!moving&&appearance.selected&&!was?.selected){const title=element.querySelector('strong');set(title,'transform',`translateY(${3*(1-eased)}px)`);}
      }
      for(const element of items.edges){
        const identifier=element.dataset.mapEdge;const opacity=after.edges.get(identifier)??1;set(element,'opacity',String(interpolate(before?.edges.get(identifier)??.08,opacity,eased)));
        const curve=curves.get(identifier);if(curve)element.querySelector('path')?.setAttribute('d',pathBetween(curve.start,curve.end,eased));
        const signal=element.querySelector('[data-map-signal]');const track=signals.get(identifier);
        if(signal&&track){const distance=progress*32;const index=Math.min(31,Math.floor(distance));const fraction=distance-index;const point=coordinates=>({x:interpolate(coordinates[index].x,coordinates[index+1].x,fraction),y:interpolate(coordinates[index].y,coordinates[index+1].y,fraction)});const start=point(track.start);const end=point(track.end);set(signal,'opacity',String(Math.sin(progress*Math.PI)*.85));set(signal,'transform',`translate(${interpolate(start.x,end.x,eased)}px,${interpolate(start.y,end.y,eased)}px)`);}
      }
      for(const element of items.labels){
        if(element.hidden)continue;
        if(moving){const start=startLabels.get(element.dataset.mapLabel);const end=endLabels.get(element.dataset.mapLabel);if(spatial&&start&&end)set(element,'transform',`translate(-50%,-50%) translate(${(start.x-end.x)*(1-eased)}px,${(start.y-end.y)*(1-eased)}px)`);set(element,'opacity',String(easing(Math.max(0,(progress-.35)/.65))));}
        else set(element,'opacity',String(interpolate(.45,1,eased)));
      }
      if(progress>=1){stop(effect);return;}effect.frame=requestAnimationFrame(frame);
    }
    frame(started);
  }
  function mount(viewport,context){
    if(!enabledSurface(viewport))return;
    for(const entry of [...surfaces])if(entry.viewport.isConnected===false)surfaces.delete(entry);
    const old=memories.get(context.state);const before=old?.context.prefix===context.prefix?old:null;
    surfaces.add({viewport,context});sync(viewport,context);const after=snapshot(viewport,context);memories.set(context.state,after);animate(viewport,context,before,after);
  }
  function replay(viewport,context){cancel(viewport);sync(viewport,context);if(enabledSurface(viewport))animate(viewport,context,null,snapshot(viewport,context),true);}
  function toggle(viewport,context){context.state.motionEnabled=context.state.motionEnabled===false;cancel(viewport);sync(viewport,context);if(allowed(context))replay(viewport,context);}
  function configure(){
    if(preference)return;preference=matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener?.('change',()=>{cancel();for(const {viewport,context} of surfaces)if(viewport.isConnected!==false)sync(viewport,context);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();for(const {viewport,context} of surfaces)if(viewport.isConnected!==false)sync(viewport,context);});
    window.addEventListener('blur',()=>cancel());
  }
  function controls(state){const on=state.motionEnabled!==false&&!reduced();return `<div class="os-motion-controls" role="group" aria-label="图谱动效"><button type="button" data-map-control="motion" aria-pressed="${on}" ${reduced()?'disabled':''} title="${reduced()?'已跟随系统减少动态效果':'开关图谱动效'}"><span class="os-motion-switch" aria-hidden="true"><i></i></span>动效</button><button type="button" data-map-control="replay" ${!on?'disabled':''} aria-label="重播图谱入场动效" title="重播图谱入场动效"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5 15 10l-8 5.5Z"/></svg>重播</button></div>`;}
  return {configure,mount,remember,cancel,replay,toggle,controls,starts,pathBetween,capture(){cancel();for(const entry of [...surfaces]){if(entry.viewport.isConnected===false)surfaces.delete(entry);else remember(entry.viewport,entry.context);}}};
})();
