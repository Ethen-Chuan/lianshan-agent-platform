const assert=require('node:assert/strict');

module.exports=async function verifyCanvas({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];const results=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  const check=async(name,run)=>{try{await run();results.push(name);}catch(error){throw new Error(name+': '+error.message,{cause:error});}};
  const click=async(name,extra='')=>page.locator(`[data-action="flow-${name}"]${extra}`).first().click();
  const seed=async(mode='sample')=>{
    await page.evaluate(mode=>{
      const graph=OrbitFlow.sample('AFTERSALES');
      if(mode==='linear'){graph.nodes=graph.nodes.filter(node=>['start','collect','end'].includes(node.id));graph.nodes.forEach((node,index)=>{node.x=60+index*320;node.y=80;});graph.edges=[];graph.layout='horizontal';}
      ProjectStudio.data().businessFlow=graph;const state=OrbitFlow.view();Object.assign(state,{selected:'',selectedEdge:'',connect:'',connectPort:0,zoom:1,snap:false,side:'node',undo:[],redo:[],pending:null,command:'',error:'',review:null,nodeDrafts:{},edgeDrafts:{},identityDraft:null,agent:{input:'',proposal:null,history:[]}});OrbitFlow.dispatch('side',{dataset:{value:'node'}});
      document.querySelector('#flow-viewport').scrollTo(0,0);
    },mode);
    await page.locator('#flow-viewport').scrollIntoViewIfNeeded();
  };
  const snapshot=()=>page.evaluate(()=>JSON.stringify(OrbitFlow.data()));
  const node=identifier=>page.locator(`.flow-node[data-node="${identifier}"]`);
  const body=identifier=>node(identifier).locator('.flow-node-body');
  const center=async locator=>{const box=await locator.boundingBox();assert.ok(box);return {x:box.x+box.width/2,y:box.y+box.height/2};};
  const drag=async(locator,delta,hold=false)=>{await locator.scrollIntoViewIfNeeded();const start=await center(locator);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+delta.x,start.y+delta.y,{steps:8});if(!hold)await page.mouse.up();};
  const wire=async(from,to,port=0,hold=false)=>{const source=node(from).locator(`[data-flow-port="out"][data-port="${port}"]`);await source.scrollIntoViewIfNeeded();const start=await center(source);const end=await center(node(to).locator('[data-flow-port="in"]'));await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+15,start.y+12,{steps:2});await page.mouse.move(end.x,end.y,{steps:10});if(!hold)await page.mouse.up();};
  const prompt=async command=>{await click('side','[data-value="agent"]');await page.locator('#flow-agent-command').fill(command);await page.locator('#flow-agent-form button[type="submit"]').click();};
  try{
    await page.goto(baseURL+'?project=AFTERSALES#orbit');
    await check('whole node click opens definition and no handle is needed',async()=>{
      await seed('linear');assert.equal(await page.locator('.flow-node-handle').count(),0);await body('collect').locator('strong').click();assert.equal(await page.locator('#flow-node-name').inputValue(),'收集报修信息');
    });
    await check('free body drag tracks both axes exactly and preserves semantic version',async()=>{
      await seed('linear');const before=await page.evaluate(()=>({node:{...OrbitFlow.data().nodes[1]},revision:OrbitFlow.data().revision}));await drag(body('collect').locator('strong'),{x:47,y:31});const after=await page.evaluate(()=>({node:OrbitFlow.data().nodes[1],revision:OrbitFlow.data().revision}));assert.equal(after.node.x,before.node.x+47);assert.equal(after.node.y,before.node.y+31);assert.equal(after.revision,before.revision);await click('undo');assert.equal(await page.evaluate(()=>OrbitFlow.data().nodes[1].x),before.node.x);
    });
    await check('live dragging does not persist until release and Escape restores the graph',async()=>{
      await seed('linear');const before=await snapshot();await drag(body('collect').locator('small'),{x:61,y:45},true);assert.equal(await snapshot(),before);assert.equal(await node('collect').evaluate(element=>element.classList.contains('is-dragging')),true);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await snapshot(),before);assert.equal(await page.locator('.is-dragging').count(),0);
    });
    await check('pointercancel and lost capture discard transient positions',async()=>{
      for(const event of ['pointercancel','lostpointercapture']){await seed('linear');const before=await snapshot();await drag(body('collect'),{x:35,y:22},true);await body('collect').dispatchEvent(event,{pointerId:1,isPrimary:true});await page.mouse.up();assert.equal(await snapshot(),before);assert.equal(await page.locator('.is-dragging').count(),0);}
    });
    await check('zoom-aware free drag and optional grid snapping',async()=>{
      await seed('linear');await click('zoom','[data-value="out"]');const before=await page.evaluate(()=>({...OrbitFlow.data().nodes[1]}));await drag(body('collect'),{x:45,y:27});let after=await page.evaluate(()=>OrbitFlow.data().nodes[1]);assert.equal(after.x,before.x+50);assert.equal(after.y,before.y+30);await page.locator('#flow-snap').check();await drag(body('collect'),{x:17,y:13});after=await page.evaluate(()=>OrbitFlow.data().nodes[1]);assert.equal(after.x%12,0);assert.equal(after.y%12,0);
    });
    await check('free drag permits intentional overlapping nodes instead of jumping away',async()=>{
      await seed('linear');const before=await page.evaluate(()=>OrbitFlow.data().nodes[1].x);await drag(body('collect'),{x:-220,y:0});assert.equal(await page.evaluate(()=>OrbitFlow.data().nodes[1].x),before-220);assert.ok(await page.evaluate(()=>Math.abs(OrbitFlow.data().nodes[1].x-OrbitFlow.data().nodes[0].x)<220));
    });
    await check('blank canvas panning scrolls without creating history',async()=>{
      await seed();const bounds=await page.locator('#flow-viewport').boundingBox();const before=await snapshot();await page.mouse.move(bounds.x+30,bounds.y+300);await page.mouse.down();await page.mouse.move(bounds.x+30,bounds.y+130,{steps:10});await page.mouse.up();assert.ok(await page.locator('#flow-viewport').evaluate(element=>element.scrollTop)>100);assert.equal(await snapshot(),before);
    });
    await check('dragging output to input previews an arrow then saves a connection',async()=>{
      await seed('linear');const before=await snapshot();await wire('start','collect',0,true);assert.equal(await page.locator('.flow-wire-preview').count(),1);assert.equal(await node('collect').evaluate(element=>element.classList.contains('can-connect')),true);assert.equal(await snapshot(),before);await page.mouse.up();assert.equal(await page.evaluate(()=>OrbitFlow.data().edges.length),1);assert.equal(await page.locator('.flow-link>path[marker-end]').count(),1);assert.equal(await page.locator('.flow-wire-preview').count(),0);
    });
    await check('click-to-connect remains available for pointer and keyboard use',async()=>{
      await seed('linear');await node('start').locator('[data-flow-port="out"]').focus();await page.keyboard.press('Enter');await node('collect').locator('[data-flow-port="in"]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>OrbitFlow.data().edges.length),1);
    });
    await check('invalid drops, occupied ports, blank drops and Escape cannot create edges',async()=>{
      await seed('linear');await wire('start','collect');const before=await snapshot();await wire('start','collect');assert.equal(await snapshot(),before);assert.match(await page.locator('#flow-error').innerText(),/已经连接/);await wire('collect','end',0,true);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await snapshot(),before);
      await drag(node('collect').locator('[data-flow-port="out"]'),{x:25,y:170});assert.equal(await snapshot(),before);
    });
    await check('two branch arrow ports connect independently and preserve labels',async()=>{
      await seed('linear');await page.evaluate(()=>{const graph=OrbitFlow.data();graph.nodes[0].type='condition';graph.nodes[0].name='确认分支';OrbitFlow.dispatch('side',{dataset:{value:'node'}});});await wire('start','collect',0);await click('zoom','[data-value="out"]');await click('zoom','[data-value="out"]');await click('zoom','[data-value="out"]');await wire('start','end',1);const edges=await page.evaluate(()=>OrbitFlow.data().edges);assert.equal(edges.length,2);assert.deepEqual(edges.map(edge=>edge.fromPort),[0,1]);assert.deepEqual(edges.map(edge=>edge.label),['满足条件','不满足条件']);
    });
    await check('edge hit target opens editable conditions and plus inserts a connected step',async()=>{
      await seed('linear');await wire('start','collect');const edge=page.locator('.flow-link');await edge.locator('rect').click();assert.equal(await page.locator('.flow-edge-insert-options').count(),1);await page.locator('.flow-edge-form input').fill('进入核对');await page.locator('.flow-edge-form button[type="submit"]').click();assert.equal(await page.evaluate(()=>OrbitFlow.data().edges[0].label),'进入核对');await edge.locator('.flow-edge-add').focus();await page.keyboard.press('Enter');await click('edge-insert','[data-value="human"]');const graph=await page.evaluate(()=>OrbitFlow.data());const added=graph.nodes.find(node=>node.type==='human');assert.ok(added);assert.equal(graph.edges[0].to,added.id);assert.equal(graph.edges[0].label,'进入核对');assert.ok(graph.edges.some(item=>item.from===added.id&&item.to==='collect'));assert.equal(await page.locator('#flow-node-name').inputValue(),'人工确认');
    });
    await check('all 36 avatar choices show previews and selected art persists on reload',async()=>{
      await seed();await page.locator('.flow-identity-settings>summary').click();await page.locator('.avatar-gallery>summary').click();assert.equal(await page.locator('[data-avatar-art]').count(),36);const glyphs=await page.locator('[data-avatar-art] .identity-art text').evaluateAll(elements=>elements.map(element=>({fill:getComputedStyle(element).fill,width:element.getBBox().width})));assert.equal(glyphs.length,12);assert.ok(glyphs.every(glyph=>glyph.fill!=='none'&&glyph.width>0));await page.locator('[data-avatar-art="fox"]').click();await page.locator('[data-avatar-tone="clay"]').click();assert.equal(await page.locator('#flow-avatar-art').inputValue(),'fox');assert.equal(await page.locator('#flow-avatar-tone').inputValue(),'clay');assert.equal(await page.locator('[data-avatar-art="fox"]').getAttribute('aria-pressed'),'true');await page.locator('#flow-identity-form button[type="submit"]').click();await page.reload();assert.deepEqual(await page.evaluate(()=>OrbitFlow.data().avatar),{art:'fox',tone:'clay'});
    });
    await check('canvas assistant previews content and layout, applies once and supports undo',async()=>{
      await seed();const before=await snapshot();await prompt('修改「收集报修信息」的说明为「资料不足先追问，确认后继续」\n横向紧凑');assert.equal(await snapshot(),before);assert.equal(await page.locator('.flow-agent-diff').count(),2);assert.equal(await page.locator('#flow-stage').getAttribute('inert'),'');assert.match(await node('collect').innerText(),/资料不足先追问/);await click('agent-apply');assert.equal(await page.evaluate(()=>OrbitFlow.data().layout),'horizontal');assert.equal(await page.evaluate(()=>OrbitFlow.data().nodes[1].description),'资料不足先追问，确认后继续');await click('undo');assert.equal(await page.evaluate(()=>OrbitFlow.data().nodes[1].description),JSON.parse(before).nodes[1].description);
    });
    await check('assistant insertion saves the same reviewed node IDs and independent source snapshot',async()=>{
      await seed();await prompt('在「整理报修草稿」后添加人工确认「负责人复核」\n修改「负责人复核」的说明为「检查资料与授权后继续」');const proposed=await page.evaluate(()=>structuredClone(OrbitFlow.view().agent.proposal.graph));await click('agent-apply');const actual=await page.evaluate(()=>OrbitFlow.data());assert.deepEqual(actual.nodes,proposed.nodes);assert.deepEqual(actual.edges,proposed.edges);
    });
    await check('destructive proposals require an additional acknowledgement',async()=>{
      await seed();const before=await snapshot();await prompt('删除「人工补充与核实」');assert.equal(await page.locator('#flow-agent-risk').count(),1);await click('agent-apply');assert.equal(await snapshot(),before);assert.match(await page.locator('#flow-error').innerText(),/勾选/);await page.locator('#flow-agent-risk').check();await click('agent-apply');assert.equal(await page.evaluate(()=>OrbitFlow.data().nodes.some(node=>node.id==='human')),false);assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),0);
    });
    await check('unsupported commands reject the complete batch and editing cancels an old preview',async()=>{
      await seed();const before=await snapshot();await prompt('横向紧凑\n完全自动帮我审批');assert.equal(await snapshot(),before);assert.equal(await page.locator('.flow-agent-plan').count(),0);assert.match(await page.locator('#flow-error').innerText(),/无法完整识别/);await prompt('横向紧凑');await page.locator('#flow-agent-command').fill('纵向紧凑');assert.equal(await page.locator('.flow-agent-plan').count(),0);assert.equal(await page.locator('#flow-stage').getAttribute('inert'),null);
    });
    await check('unsaved definitions and stale source versions cannot be overwritten by the assistant',async()=>{
      await seed();await body('collect').click();await page.locator('#flow-node-form textarea').fill('尚未保存的业务约束');await prompt('横向紧凑');assert.match(await page.locator('#flow-error').innerText(),/先保存/);await seed();await prompt('横向紧凑');await page.evaluate(()=>{OrbitFlow.data().layoutRevision+=1;});const before=await snapshot();await click('agent-apply');assert.equal(await snapshot(),before);assert.match(await page.locator('#flow-error').innerText(),/已变化/);
    });
    await check('unconfirmed preview cannot compile a different saved graph or accept palette edits',async()=>{
      await seed();const before=await snapshot();await prompt('横向紧凑');await click('compile');assert.match(await page.locator('#flow-error').innerText(),/先应用或取消/);assert.equal(await page.locator('#flow-review').count(),0);await click('add','[data-value="action"]');assert.equal(await snapshot(),before);assert.equal(await page.locator('.flow-agent-plan').count(),1);
    });
    await check('project switch during a drag cannot write to another project',async()=>{
      await seed('linear');await page.evaluate(()=>PortfolioHub.persist());const before=await snapshot();await drag(body('collect'),{x:45,y:20},true);await page.goto(baseURL+'?project=RETAIL#orbit');await page.mouse.up();assert.equal(await page.evaluate(()=>OrbitFlow.data().nodes.length),0);await page.goto(baseURL+'?project=AFTERSALES#orbit');assert.equal(await snapshot(),before);assert.equal(await page.locator('.is-dragging').count(),0);
    });
    for(const width of [390,768,1440])await check('avatar gallery and assistant sidebar fit '+width+'px',async()=>{
      await page.setViewportSize({width,height:1100});await seed();await prompt('横向紧凑');const size=await page.locator('.orbit-flow').evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify(size));await click('agent-cancel');await page.locator('.flow-identity-settings>summary').click();await page.locator('.avatar-gallery>summary').click();const gallery=await page.locator('.avatar-gallery').evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth}));assert.ok(gallery.scroll<=gallery.width+1,JSON.stringify(gallery));assert.equal(await page.locator('[data-avatar-art="compass"]').count(),1);await page.locator('.flow-identity-settings>summary').click();
    });
    assert.deepEqual(errors,[]);return {checks:results.length,results,errors};
  }finally{await context.close();}
};
