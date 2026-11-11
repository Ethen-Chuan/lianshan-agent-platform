const assert=require('node:assert/strict');

module.exports=async function verifyFlow({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];const results=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  const check=async(name,run)=>{try{await run();results.push(name);}catch(error){error.message=name+': '+error.message;throw error;}};
  const click=async name=>page.locator('[data-action="flow-'+name+'"]').first().click();
  const select=async identifier=>page.locator('[data-action="flow-select"][data-id="'+identifier+'"]').click();
  try{
    await page.goto(baseURL+'?project=AFTERSALES#orbit');
    await check('default flow canvas and unambiguous sidebar identity',async()=>{
      assert.equal(await page.locator('.orbit-flow').count(),1);assert.equal(await page.locator('.flow-node').count(),0);assert.equal(await page.locator('.sidebar .nav-item.active').count(),1);assert.match(await page.locator('.sidebar .nav-item.active').innerText(),/Orbit/);
    });
    await check('palette drag creates an editable node and undo removes it',async()=>{
      const payload=await page.evaluateHandle(()=>new DataTransfer());await page.locator('[data-flow-type="start"]').dispatchEvent('dragstart',{dataTransfer:payload});
      const viewport=await page.locator('#flow-viewport').boundingBox();await page.locator('#flow-viewport').dispatchEvent('drop',{dataTransfer:payload,clientX:viewport.x+60,clientY:viewport.y+60});
      assert.equal(await page.locator('.flow-node').count(),1);assert.equal(await page.locator('#flow-node-name').inputValue(),'业务入口');await click('undo');assert.equal(await page.locator('.flow-node').count(),0);await click('sample');assert.equal(await page.locator('.flow-node').count(),7);
    });
    await check('unsaved definitions survive selection changes and prevent premature generation',async()=>{
      await page.locator('#flow-node-form [name="description"]').fill('核对设备信息；不足时先追问，未经确认不得提交。');await select('start');await select('collect');assert.match(await page.locator('#flow-node-form [name="description"]').inputValue(),/未经确认/);
      await click('compile');assert.match(await page.locator('#flow-error').innerText(),/未保存/);assert.equal(await page.locator('#flow-review').count(),0);await page.locator('#flow-node-form button[type="submit"]').click();assert.match(await page.evaluate(()=>OrbitFlow.data().nodes.find(node=>node.id==='collect').description),/未经确认/);
    });
    await check('relations can be disconnected and reconnected without losing node definitions',async()=>{
      await select('start');await click('unlink');assert.equal(await page.evaluate(()=>OrbitFlow.data().edges.length),6);await page.locator('.flow-connections [data-action="flow-connect"]').click();await select('collect');assert.equal(await page.evaluate(()=>OrbitFlow.data().edges.length),7);await click('undo');await click('undo');assert.equal(await page.evaluate(()=>OrbitFlow.validate(OrbitFlow.data()).length),0);
    });
    await check('pointer drag and keyboard movement update positions, not semantic revision',async()=>{
      const before=await page.evaluate(()=>({node:{...OrbitFlow.data().nodes.find(node=>node.id==='collect')},revision:OrbitFlow.data().revision}));
      const handle=page.locator('[data-flow-drag="collect"]');await handle.scrollIntoViewIfNeeded();const bounds=await handle.boundingBox();await page.mouse.move(bounds.x+12,bounds.y+12);await page.mouse.down();await page.mouse.move(bounds.x+60,bounds.y+36,{steps:6});await page.mouse.up();
      const after=await page.evaluate(()=>({node:OrbitFlow.data().nodes.find(node=>node.id==='collect'),revision:OrbitFlow.data().revision}));assert.notEqual(after.node.x,before.node.x);assert.equal(after.revision,before.revision);await click('undo');assert.equal(await page.evaluate(()=>OrbitFlow.data().nodes.find(node=>node.id==='collect').x),before.node.x);await click('redo');
      await handle.focus();const previous=await page.evaluate(()=>OrbitFlow.data().nodes.find(node=>node.id==='collect').x);await page.keyboard.press('ArrowRight');assert.notEqual(await page.evaluate(()=>OrbitFlow.data().nodes.find(node=>node.id==='collect').x),previous);
    });
    await check('layout command displays a real preview, applies explicitly and rejects semantic rewrites',async()=>{
      const definitions=await page.evaluate(()=>JSON.stringify(OrbitFlow.definitions(OrbitFlow.data())));await page.locator('.flow-command-disclosure>summary').click();await page.locator('#flow-command').fill('从左到右，间距紧凑');await page.locator('#flow-command-form button').click();assert.equal(await page.evaluate(()=>OrbitFlow.data().layout),'vertical');assert.equal(await page.locator('#flow-stage').getAttribute('inert'),'');assert.match(await page.locator('#flow-stage').getAttribute('class'),/horizontal/);
      await click('apply-layout');assert.equal(await page.evaluate(()=>OrbitFlow.data().layout),'horizontal');assert.equal(await page.evaluate(()=>JSON.stringify(OrbitFlow.definitions(OrbitFlow.data()))),definitions);
      await page.locator('#flow-command').fill('横向并删除人工确认');await page.locator('#flow-command-form button').click();assert.match(await page.locator('#flow-error').innerText(),/不解析任意业务改写/);assert.equal(await page.evaluate(()=>JSON.stringify(OrbitFlow.definitions(OrbitFlow.data()))),definitions);
      await page.locator('#flow-command').fill('纵向宽松');await page.locator('#flow-command-form button').click();await page.locator('#flow-command').fill('横向紧凑');assert.equal(await page.locator('.flow-command-preview').count(),0);assert.equal(await page.locator('#flow-stage').getAttribute('inert'),null);await click('arrange');
    });
    await check('avatar preview updates immediately and saves with the assistant identity',async()=>{
      await page.locator('.flow-identity-settings>summary').click();await page.locator('#flow-identity-form [name="name"]').fill('流程受理助手');await page.locator('#flow-avatar-art').selectOption('quality');await page.locator('#flow-avatar-tone').selectOption('blue');assert.equal(await page.locator('#flow-identity-form .assistant-avatar-preview .identity-avatar').getAttribute('data-tone'),'blue');await page.locator('#flow-identity-form button[type="submit"]').click();assert.deepEqual(await page.evaluate(()=>OrbitFlow.data().avatar),{art:'quality',tone:'blue'});
    });
    await check('confirmed flow produces a separate configuration with complete source snapshot and avatar',async()=>{
      await click('compile');assert.equal(await page.locator('.flow-definition-list article').count(),7);assert.equal(await page.evaluate(()=>ProjectStudio.data().scenes.length),0);await page.locator('#flow-confirm-form button').click();assert.equal(await page.evaluate(()=>ProjectStudio.data().scenes.length),0);await page.locator('#flow-confirm-form input').check();await page.locator('#flow-confirm-form button').click();
      assert.equal(await page.locator('#studio-scene-form [name="fields"]').inputValue(),'设备型号,购买日期,故障现象');assert.equal(await page.locator('#studio-avatar-tone').inputValue(),'blue');assert.match(await page.locator('.ow-origin-note').innerText(),/独立来源快照/);assert.equal(await page.evaluate(()=>ProjectStudio.data().scenes[0].config.flowDesign.confirmed),true);
      await page.locator('#studio-scene-form button[type="submit"]').click();assert.equal(await page.evaluate(()=>ProjectStudio.data().scenes[0].config.flowDesign.definitions.length),7);assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),0);
    });
    await check('release requires approved tests and exposes the avatar in assistant workspace and directory',async()=>{
      await page.locator('[data-action="studio-tab"][data-value="release"]').click();assert.equal(await page.locator('#studio-release-form button').isDisabled(),true);await page.locator('[data-action="studio-tab"][data-value="tests"]').click();await page.locator('[data-action="studio-sample-template"]').click();
      for(const checkbox of await page.locator('[data-studio-approve]').all())await checkbox.check();await page.locator('[data-action="studio-evaluate"]').click();assert.match(await page.locator('.studio-evaluation h3').innerText(),/3 \/ 3/);await page.locator('[data-action="studio-tab"][data-value="release"]').click();await page.locator('#studio-release-form [name="reason"]').fill('已核对流程定义和三类本地验收案例。');await page.locator('#studio-release-form input[type="checkbox"]').check();await page.locator('#studio-release-form button').click();
      assert.equal(await page.locator('.studio-page-head h1 .identity-avatar').getAttribute('data-tone'),'blue');assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),1);await page.locator('.sidebar [data-page="agents"]').click();assert.equal(await page.locator('[data-custom-agent] .identity-avatar').getAttribute('data-tone'),'blue');
    });
    await check('later flow edits do not change released config and both survive reload',async()=>{
      const frozen=await page.evaluate(()=>JSON.stringify(ProjectStudio.data().agents[0].releases));await page.locator('.sidebar [data-page="agents"]').click();await page.locator('.focus-design [data-action="studio-orbit"]').click();await select('collect');await page.locator('#flow-node-form [name="description"]').fill('后续编辑，仅更新画布。');await page.locator('#flow-node-form button[type="submit"]').click();await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(ProjectStudio.data().agents[0].releases)),frozen);assert.equal(await page.evaluate(()=>OrbitFlow.data().nodes.find(node=>node.id==='collect').description),'后续编辑，仅更新画布。');
    });
    await check('project switching does not inherit flows or assistants',async()=>{
      await page.goto(baseURL+'?project=RETAIL#orbit');assert.equal(await page.locator('.flow-node').count(),0);assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),0);await page.goto(baseURL+'?project=AFTERSALES#orbit');assert.equal(await page.locator('.flow-node').count(),7);
    });
    await check('focused canvas can be entered, edited and dismissed with Escape',async()=>{
      await click('focus');assert.equal(await page.locator('.orbit-flow.is-focused').count(),1);assert.equal(await page.locator('[data-action="flow-focus"]').getAttribute('aria-pressed'),'true');await select('start');assert.equal(await page.locator('#flow-node-name').inputValue(),'受理报修诉求');await page.keyboard.press('Escape');assert.equal(await page.locator('.orbit-flow.is-focused').count(),0);
    });
    for(const width of [390,768,1024,1440])await check('responsive flow has no page overflow at '+width,async()=>{
      await page.setViewportSize({width,height:1100});await page.waitForTimeout(80);const dimensions=await page.evaluate(()=>({body:document.body.scrollWidth,width:innerWidth,main:document.querySelector('main').scrollWidth,mainWidth:document.querySelector('main').clientWidth}));assert.ok(dimensions.body<=dimensions.width+1,JSON.stringify(dimensions));assert.ok(dimensions.main<=dimensions.mainWidth+1,JSON.stringify(dimensions));assert.equal(await page.locator('.flow-node').first().evaluate(element=>getComputedStyle(element).width),'220px');await click('focus');const focused=await page.locator('.orbit-flow').evaluate(element=>({width:element.clientWidth,content:element.scrollWidth}));assert.ok(focused.content<=focused.width+1,JSON.stringify(focused));await page.keyboard.press('Escape');
    });
    await check('auto-layout connectors and labels do not cover unrelated cards',async()=>{
      await select('condition');await page.locator('.flow-edge-form input').first().fill('必要信息核对已全部完成');await page.locator('.flow-edge-form button[type="submit"]').first().click();
      for(const command of ['纵向宽松','横向紧凑']){
        if(!await page.locator('#flow-command').isVisible())await page.locator('.flow-command-disclosure>summary').click();
        await page.locator('#flow-command').fill(command);await page.locator('#flow-command-form button').click();await click('apply-layout');
        const intersections=await page.evaluate(()=>{const graph=OrbitFlow.data();const found=[];for(const group of document.querySelectorAll('.flow-link')){const edge=graph.edges.find(edge=>edge.id===group.dataset.edge);const path=group.querySelector('path');for(const node of graph.nodes.filter(node=>![edge.from,edge.to].includes(node.id)))for(let sample=1;sample<80;sample++){const point=path.getPointAtLength(path.getTotalLength()*sample/80);if(point.x>node.x&&point.x<node.x+220&&point.y>node.y&&point.y<node.y+116){found.push(edge.id);break;}}const label=group.querySelector('text');const background=group.querySelector('rect');const box=background.getBBox();if(label.getBBox().width>box.width)found.push('label overflow');for(const node of graph.nodes)if(box.x<node.x+220&&box.x+box.width>node.x&&box.y<node.y+116&&box.y+box.height>node.y)found.push('label covers node');}return found;});assert.deepEqual(intersections,[]);
      }
    });
    assert.deepEqual(errors,[]);return {passed:results.length,results};
  }finally{await context.close();}
};
