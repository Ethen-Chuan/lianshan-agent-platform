const assert=require('node:assert/strict');

module.exports=async function verifyWorkspaceReview({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];const results=[];
  page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
  const check=async(name,run)=>{try{await run();results.push(name);}catch(error){throw new Error(name+': '+error.message,{cause:error});}};
  const tab=async value=>{
    if(new URL(page.url()).hash!=='#group')await page.locator('.sidebar [data-page="group"]').click();
    await page.locator('#aw-tab-'+value).click();
  };
  try{
    await page.goto(baseURL+'?project=AFTERSALES#group');
    await tab('shared');
    await check('definition filters retain focus, expose real content and preserve the model',async()=>{
      const before=await page.evaluate(()=>JSON.stringify(OrbitOntology.data()));
      await page.locator('#wr-type-rule').focus();await page.locator('#wr-type-rule').press('Enter');
      assert.equal(await page.locator('#wr-type-rule').getAttribute('aria-pressed'),'true');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'wr-type-rule');
      const expected=await page.evaluate(()=>OrbitOntology.data().nodes.filter(node=>node.type==='rule').slice(0,5).map(node=>node.name));
      assert.deepEqual(await page.locator('.wr-definition-title strong').allTextContents(),expected);
      assert.equal(await page.evaluate(()=>JSON.stringify(OrbitOntology.data())),before);
      assert.match(await page.locator('.wr-reference-panel').innerText(),/暂无引用/);
      assert.equal(await page.locator('.wr-view-guide').getAttribute('open'),null);
      await page.locator('.wr-view-guide > summary').press('Enter');
      assert.equal(await page.locator('.wr-view-guide').getAttribute('open'),'');
      assert.equal(await page.locator('.wr-view-guide [data-action="wr-section"]').isVisible(),true);
      await page.locator('.wr-view-guide > summary').press('Enter');
      await page.locator('#wr-type-all').click();
    });
    await check('a definition opens the same node in the standalone ontology',async()=>{
      const row=page.locator('.wr-definition').first();const selected=await row.getAttribute('data-id');
      await row.click();assert.equal(new URL(page.url()).hash,'#ontology');
      assert.equal(await page.evaluate(()=>OrbitOntology.view().selected),selected);await tab('shared');
    });
    await check('the empty evaluation screen makes creation possible without claiming production results',async()=>{
      await tab('outcomes');assert.match(await page.locator('#wr-evaluation-records').innerText(),/还没有助手草案/);
      assert.equal(await page.locator('.wr-method').getAttribute('open'),null);
      await page.locator('.wr-method>summary').focus();await page.locator('.wr-method>summary').press('Enter');
      assert.equal(await page.locator('.wr-method').getAttribute('open'),'');
      assert.match(await page.locator('.wr-method').innerText(),/未做重复咨询观察窗口校验/);
      await page.locator('.wr-method>summary').press('Enter');
    });
    const sceneIds=await page.evaluate(()=>{
      const config={name:'示例报修助手',goal:'准备本地报修资料',keywords:'报修',fields:'设备编号,故障现象',transferWords:'冒烟',tool:'form',handoff:'交给人工核实',prompt:'只整理本地草稿',avatar:{art:'panda',tone:'teal'}};
      ProjectStudio.createFromOntology(config);const ready=ProjectStudio.data().scenes.at(-1);
      ProjectStudio.dispatch('sample-template',{dataset:{}});ready.samples.forEach(sample=>sample.approved=true);ProjectStudio.dispatch('evaluate',{dataset:{}});
      ProjectStudio.createFromOntology({...config,name:'示例待完善助手'});
      return {ready:ready.id,pending:ProjectStudio.data().scenes.at(-1).id};
    });
    await tab('outcomes');
    await check('avatars, three boundary states and filters agree with canonical readiness',async()=>{
      assert.equal(await page.locator('.wr-evaluation').count(),2);
      const ready=page.locator('[data-scene-id="'+sceneIds.ready+'"]');
      assert.match(await ready.locator('.identity-avatar').getAttribute('aria-label'),/熊猫/);
      assert.equal(await ready.locator('.wr-boundary.is-passed').count(),3);
      await page.locator('#wr-evaluation-pending').click();
      assert.equal(await page.locator('.wr-evaluation').count(),1);assert.equal(await page.locator('.wr-evaluation').getAttribute('data-scene-id'),sceneIds.pending);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'wr-evaluation-pending');
      await page.locator('#wr-evaluation-passed').click();assert.equal(await page.locator('.wr-evaluation').getAttribute('data-scene-id'),sceneIds.ready);
      await page.locator('#wr-evaluation-all').click();
    });
    await check('a record opens its exact scene tests without approving, running or publishing',async()=>{
      const before=await page.evaluate(()=>JSON.stringify(ProjectStudio.data()));
      await page.locator('[data-scene-id="'+sceneIds.ready+'"] [data-action="wr-scene"]').click();
      assert.equal(new URL(page.url()).hash,'#orbit');
      assert.equal(await page.locator('[data-action="studio-scene"][aria-current="page"]').getAttribute('data-id'),sceneIds.ready);
      assert.equal(await page.locator('[data-action="studio-tab"][data-value="tests"]').getAttribute('aria-current'),'page');
      assert.equal(await page.evaluate(()=>JSON.stringify(ProjectStudio.data())),before);await tab('outcomes');
    });
    for(const width of [1440,1024,768,390,320])await check('both review layouts fit '+width+' pixels and retain usable controls',async()=>{
      await page.setViewportSize({width,height:900});
      for(const section of ['shared','outcomes']){
        await tab(section);
        const size=await page.evaluate(()=>{const main=document.getElementById('main-content');const content=document.querySelector('.workspace-review');return {body:document.body.scrollWidth,viewport:innerWidth,main:main.scrollWidth,mainWidth:main.clientWidth,content:content.scrollWidth,contentWidth:content.clientWidth};});
        assert.ok(size.body<=size.viewport+1,JSON.stringify({section,...size}));assert.ok(size.main<=size.mainWidth+1,JSON.stringify({section,...size}));assert.ok(size.content<=size.contentWidth+1,JSON.stringify({section,...size}));
        assert.equal(await page.locator('.agent-workspace.is-review').count(),1);
        assert.equal(await page.locator('.wr-heading').evaluate(element=>getComputedStyle(element).animationName),'none');
        const filter=page.locator(section==='shared'?'#wr-type-rule':'#wr-evaluation-pending');await filter.click();assert.equal(await filter.getAttribute('aria-pressed'),'true');
        await page.locator(section==='shared'?'#wr-type-all':'#wr-evaluation-all').click();
      }
    });
    await check('long names and unbroken fields wrap without changing underlying data',async()=>{
      await page.evaluate(()=>{OrbitOntology.data().nodes[0].fields='LONG_FIELD_'.repeat(30);ProjectStudio.data().scenes[0].config.name='LONG_ASSISTANT_NAME_'.repeat(20);});
      for(const section of ['shared','outcomes']){await tab(section);assert.ok(await page.evaluate(()=>document.getElementById('main-content').scrollWidth<=document.getElementById('main-content').clientWidth+1));}
    });
    await check('other projects do not inherit selections, drafts or client metrics',async()=>{
      await page.goto(baseURL+'?project=RETAIL#group');await tab('outcomes');
      assert.equal(await page.locator('.wr-evaluation').count(),0);assert.match(await page.locator('.wr-measures').innerText(),/尚未接入客户自助预览/);
      assert.equal(await page.locator('#wr-evaluation-all').getAttribute('aria-pressed'),'true');
      await tab('shared');assert.equal(await page.locator('[data-action="wr-instances"]').count(),0);
    });
    assert.deepEqual(errors,[]);return {checks:results.length,results};
  }finally{await context.close();}
};
