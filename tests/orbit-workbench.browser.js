const assert=require('node:assert/strict');

module.exports=async function verifyWorkbench({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1100}});const page=await context.newPage();const errors=[];const results=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(12000);
  const check=async(name,run)=>{await run();results.push(name);};
  const textMode=async()=>page.locator('[data-action="ow-design-mode"][data-value="text"]').click();
  const open=async section=>{if(new URL(page.url()).hash==='#ontology')await page.locator('.ontology-page-actions [data-action="studio-orbit"]').click();else await page.locator('[data-action="studio-tab"][data-value="workbench"]').first().click();await page.locator('.ow-navigation [data-value="'+section+'"]').click();if(section==='compose')await textMode();};
  try{
    await page.goto(baseURL+'?project=AFTERSALES#orbit');
    await check('new default is the business composer, not a mandatory ontology graph',async()=>{
      assert.equal(await page.locator('.orbit-flow').count(),1);await textMode();assert.equal(await page.locator('#ow-brief').count(),1);assert.equal(await page.locator('.ontology-node').count(),0);assert.equal(await page.locator('.ow-navigation .button').count(),4);
      await page.locator('[data-action="ow-motion"]').click();assert.equal(await page.locator('.ring-one').evaluate(element=>getComputedStyle(element).animationPlayState),'paused');
      await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.ring-one').evaluate(element=>getComputedStyle(element).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
    });
    await check('examples can be undone and edited prose survives reload',async()=>{
      await page.locator('#ow-name').fill('自定义助手');await page.locator('#ow-brief').fill('先理解业务目标，再核实资料，最后整理处理草稿。');
      await page.locator('[data-action="ow-example"][data-index="0"]').click();assert.match(await page.locator('#ow-brief').inputValue(),/设备黑屏/);await page.locator('[data-action="ow-undo"]').click();assert.equal(await page.locator('#ow-name').inputValue(),'自定义助手');
      await page.reload();await textMode();assert.equal(await page.locator('#ow-brief').inputValue(),'先理解业务目标，再核实资料，最后整理处理草稿。');
    });
    await check('arbitrary business creates a reviewable draft without claiming model or tools',async()=>{
      await page.locator('[data-action="ow-example"][data-index="1"]').click();if(await page.locator('.ow-options').getAttribute('open')===null)await page.locator('.ow-options>summary').click();
      await page.locator('#ow-needs').fill('查询入职材料\n任意新的业务能力');await page.locator('#ow-brief-form button[type="submit"]').click();
      assert.equal(await page.evaluate(()=>ProjectStudio.data().scenes.length),0);assert.match(await page.locator('#ow-review').innerText(),/任意新的业务能力/);assert.match(await page.locator('#ow-review').innerText(),/未接入/);
      assert.equal(await page.locator('#ow-review pre').textContent(),await page.evaluate(()=>OrbitWorkbench.data().draft.config.prompt));
      await page.locator('#ow-confirm-form button').click();assert.equal(await page.evaluate(()=>ProjectStudio.data().scenes.length),0);
      await page.locator('#ow-confirm-form input').check();await page.locator('#ow-confirm-form button').click();assert.equal(await page.locator('#studio-scene-form [name="fields"]').inputValue(),'');assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),0);
    });
    await check('shared definitions fill real config fields but do not confer tools or permissions',async()=>{
      await open('compose');await page.locator('[data-action="ow-example"][data-index="0"]').click();if(await page.locator('.ow-options').getAttribute('open')===null)await page.locator('.ow-options>summary').click();await page.locator('#ow-binding').selectOption('draft');
      await page.locator('#ow-brief-form button[type="submit"]').click();assert.equal(await page.locator('#ow-review .ow-tags span').count(),4);
      await page.locator('#ow-confirm-form input').check();await page.locator('#ow-confirm-form button').click();
      assert.match(await page.locator('#studio-scene-form [name="fields"]').inputValue(),/购买日期/);assert.match(await page.locator('#studio-scene-form [name="prompt"]').inputValue(),/不把黑屏直接判断/);
      await page.locator('#studio-scene-form button[type="submit"]').click();assert.equal(await page.evaluate(()=>ProjectStudio.data().scenes.at(-1).config.businessDesign.requests.length),2);
      await page.locator('[data-action="studio-tab"][data-value="release"]').click();assert.equal(await page.locator('#studio-release-form button').isDisabled(),true);
    });
    await check('library searches actual definitions and exposes their configuration references',async()=>{
      await open('library');assert.equal(await page.locator('.ow-definition').count(),12);await page.locator('#ow-search').fill('先核实保修');assert.equal(await page.locator('.ow-definition').count(),1);assert.match(await page.locator('.ow-definition').innerText(),/1 处引用/);
      await page.locator('.ow-definition details>summary').click();await page.locator('.ow-reference-links button').click();assert.equal(await page.locator('#studio-scene-form [name="name"]').inputValue(),'售后受理助手');
    });
    await check('requested capabilities and evidence have explicit unconnected states',async()=>{
      await open('capabilities');assert.match(await page.locator('.ow-evidence').innerText(),/购买日期/);assert.match(await page.locator('.ow-evidence').innerText(),/来源待核实/);
      await page.locator('#ow-request-form input').fill('安排上门检修');await page.locator('#ow-request-form button').click();assert.match(await page.locator('.ow-capability-main').innerText(),/安排上门检修/);
      assert.equal(await page.evaluate(()=>OrbitWorkbench.data().requests[0].status),'not-connected');await page.locator('#ow-request-form input').fill('安排上门检修');await page.locator('#ow-request-form button').click();assert.equal(await page.evaluate(()=>OrbitWorkbench.data().requests.length),1);
    });
    await check('editing a referenced rule yields exact before/after impact without updating config',async()=>{
      const frozen=await page.evaluate(()=>JSON.stringify(ProjectStudio.data().scenes.at(-1).config));
      await open('library');await page.locator('#ow-search').fill('先核实保修');await page.locator('.ow-definition [data-action="ow-definition"]').click();
      assert.equal(await page.locator('#ontology-inspector h2').innerText(),'先核实保修');await page.locator('.ontology-editor>summary').first().click();await page.locator('#ontology-node-form [name="fields"]').fill('购买日期,设备编号,检修记录');await page.locator('#ontology-node-form button').click();
      await open('changes');assert.match(await page.locator('.ow-change-summary').innerText(),/1\s*处引用需要复核/);assert.match(await page.locator('.ow-diff').innerText(),/必要信息/);assert.match(await page.locator('.ow-diff').innerText(),/检修记录/);assert.equal(await page.evaluate(()=>JSON.stringify(ProjectStudio.data().scenes.at(-1).config)),frozen);
      await page.locator('[data-action="ow-rebase"]').click();assert.match(await page.locator('#studio-scene-form [name="fields"]').inputValue(),/检修记录/);assert.equal(await page.evaluate(()=>JSON.stringify(ProjectStudio.data().scenes[1].config)),frozen);assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),0);
    });
    await check('text changes invalidate an unconfirmed preview and HTML is displayed as text',async()=>{
      await open('compose');await page.locator('#ow-brief').fill('请整理 <img src=x onerror="window.injected=true"> 这段示例文本，核实信息后提交人工。');await page.locator('#ow-brief-form button[type="submit"]').click();assert.equal(await page.locator('#ow-review img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
      await page.locator('#ow-brief').fill('业务定义修改后必须重新确认，缺少资料先追问。');assert.equal(await page.locator('#ow-review').count(),0);assert.equal(await page.evaluate(()=>OrbitWorkbench.data().draft),null);
    });
    await check('new project does not inherit business prose or capability requests',async()=>{
      await page.goto(baseURL+'?project=RETAIL#orbit');await page.reload();await textMode();assert.equal(await page.locator('#ow-brief').inputValue(),'');assert.equal(await page.evaluate(()=>OrbitWorkbench.data().requests.length),0);await open('changes');assert.match(await page.locator('.ow-empty h3').innerText(),/没有/);
    });
    await check('new business definitions can be authored, viewed and reused beyond the built-in actions',async()=>{
      await open('library');await page.locator('.ow-definition-add>summary').click();await page.locator('#ow-definition-form [name="name"]').fill('返修物流');await page.locator('#ow-definition-form [name="type"]').selectOption('action');await page.locator('#ow-definition-form [name="description"]').fill('核对寄件信息并准备物流草稿，不直接发起寄件。');await page.locator('#ow-definition-form [name="fields"]').fill('物流编号');await page.locator('#ow-definition-form [name="upstream"]').selectOption('rule-check');await page.locator('#ow-definition-form button').click();
      assert.equal(await page.locator('.ow-definition').count(),13);await page.locator('#ow-search').fill('返修物流');await page.locator('.ow-definition [data-action="ow-definition"]').click();assert.equal(await page.locator('#ontology-inspector h2').innerText(),'返修物流');assert.match(await page.locator('.ontology-inspector-heading').innerText(),/人工定义/);
      await page.locator('[data-action="ontology-create"]').click();assert.match(await page.locator('#studio-scene-form [name="fields"]').inputValue(),/物流编号/);assert.match(await page.locator('#studio-scene-form [name="fields"]').inputValue(),/依据说明/);assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),0);
    });
    for(const width of [390,768,1024,1440])await check('all workspaces fit '+width+'px without horizontal overflow',async()=>{
      await page.setViewportSize({width,height:1000});for(const section of ['compose','library','capabilities','changes']){await open(section);await page.waitForTimeout(480);const sizes=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth,main:document.querySelector('main').scrollWidth,mainWidth:document.querySelector('main').clientWidth}));assert.ok(sizes.body<=sizes.viewport+1,JSON.stringify(sizes));assert.ok(sizes.main<=sizes.mainWidth+1,JSON.stringify(sizes));}
    });
    assert.deepEqual(errors,[]);return {passed:results.length,results};
  }finally{await context.close();}
};
