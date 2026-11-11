const assert=require('node:assert/strict');

module.exports=async function verifyNavigationRoles({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];const results=[];
  page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
  const check=async(name,run)=>{try{await run();results.push(name);}catch(error){throw new Error(name+': '+error.message,{cause:error});}};
  const visit=route=>page.goto(baseURL+'?project=AFTERSALES#'+route);
  const sidebar=async route=>{
    const entry=page.locator('.sidebar [data-page="'+route+'"]');
    if(await entry.evaluate(element=>element.getBoundingClientRect().right<=0)||!await entry.isVisible())await page.locator('.mobile-menu').click();
    await entry.click();
  };
  try{
    await visit('group');
    await check('customer simulation is separate from group controls and navigating never creates data',async()=>{
      assert.equal(await page.locator('.aw-preview-button,[data-value="experience"]').count(),0);
      const before=await page.evaluate(()=>JSON.stringify({cases:state.cases,tickets:state.tickets,sessions:ServiceJourney.sessions()}));
      await sidebar('customer');assert.equal(await page.locator('.journey-heading h1').innerText(),'客户体验');
      assert.equal(await page.locator('.sidebar [aria-current="page"]').getAttribute('data-page'),'customer');
      assert.match(await page.locator('.journey-heading').innerText(),/模型对话/);assert.equal(await page.locator('.nav-mode-tag').innerText(),'模拟');
      assert.equal(await page.evaluate(()=>JSON.stringify({cases:state.cases,tickets:state.tickets,sessions:ServiceJourney.sessions()})),before);
    });
    await check('customer and staff perspectives continue the same conversation and preserve history',async()=>{
      await page.locator('[data-action="journey-mode"][data-value="rules"]').click();await page.locator('[data-action="journey-start"][data-value="repair"]').click();await page.locator('[data-action="journey-handoff"]').click();
      const identifier=await page.evaluate(()=>ServiceJourney.sessions().at(-1).caseId);
      await page.locator('.journey-heading [data-action="journey-open"]').click();assert.equal(await page.evaluate(()=>view.caseId),identifier);
      assert.equal(new URL(page.url()).hash,'#workspace');await page.locator('[data-action="customer-preview"]').click();
      assert.equal(await page.evaluate(()=>state.serviceJourney.activeId),await page.evaluate(()=>ServiceJourney.sessions().at(-1).id));
      await page.locator('#journey-message').fill('保留尚未发出的信息');await sidebar('group');await sidebar('customer');assert.equal(await page.locator('#journey-message').inputValue(),'保留尚未发出的信息');
      await page.reload();assert.equal(await page.locator('#journey-message').inputValue(),'保留尚未发出的信息');assert.equal(await page.evaluate(()=>ServiceJourney.sessions().length),1);
    });
    await check('ticket records live under the filling assistant and old routes keep working',async()=>{
      await sidebar('agents');assert.equal(await page.locator('.sidebar [data-page="tickets"]').count(),0);
      await page.locator('[data-assistant="ticket"] [data-page="tickets"]').click();assert.equal(new URL(page.url()).hash,'#tickets');
      assert.equal(await page.locator('.owned-assistant-page').getAttribute('data-owner'),'ticket');assert.equal(await page.locator('.owned-assistant-identity h1').innerText(),'工单填写助手');
      assert.equal(await page.locator('.owned-assistant-tabs [aria-current="page"]').getAttribute('data-page'),'tickets');
      assert.equal(await page.locator('.sidebar [aria-current="page"]').getAttribute('data-page'),'agents');
      const before=await page.evaluate(()=>JSON.stringify(state.tickets));await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(state.tickets)),before);
      await page.locator('[data-action="ticket-detail"]').first().click();assert.equal(await page.locator('[role="dialog"]').count(),1);await page.locator('[data-action="close-dialog"]').first().click();
    });
    await check('Orbit is directly reachable and no longer activates the assistant or ontology navigation',async()=>{
      await sidebar('orbit');assert.equal(new URL(page.url()).hash,'#orbit');assert.equal(await page.locator('.sidebar [aria-current="page"]').getAttribute('data-page'),'orbit');
      await sidebar('ontology');assert.equal(await page.locator('.ontology-page-actions [data-action="studio-orbit"]').count(),0);
      assert.equal(await page.locator('#ontology-usage').count(),1);assert.equal(await page.locator('.sidebar [aria-current="page"]').getAttribute('data-page'),'ontology');
    });
    await check('ontology examples show actual local outcomes without recording runs or tasks',async()=>{
      const before=await page.evaluate(()=>JSON.stringify({workspace:ProjectStudio.data(),tasks:ManagerHub.getEngine().get().tasks}));
      for(const [mode,label]of [['missing','信息不足，暂不处理'],['complete','草稿待人工核对'],['risk','转人工，停止准备']]){
        await page.locator('#usage-scenario-'+mode).click();assert.match(await page.locator('.usage-preview-body').innerText(),new RegExp(label));assert.equal(await page.evaluate(()=>document.activeElement.id),'usage-scenario-'+mode);
      }
      assert.equal(await page.evaluate(()=>JSON.stringify({workspace:ProjectStudio.data(),tasks:ManagerHub.getEngine().get().tasks})),before);
      await page.locator('.usage-inspector [data-action="usage-preview"]').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'ontology-usage');
    });
    for(const width of [1440,1024,768,390,320])await check('new navigation remains reachable and customer and ontology previews fit '+width,async()=>{
      await page.setViewportSize({width,height:900});
      for(const route of ['customer','ontology','orbit','agents']){
        await sidebar(route);assert.equal(new URL(page.url()).hash,'#'+route);assert.equal(await page.locator('.sidebar [aria-current="page"]').count(),1);
        if(['customer','ontology'].includes(route))assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1));
      }
    });
    assert.deepEqual(errors,[]);return {checks:results.length,results};
  }finally{await context.close();}
};
