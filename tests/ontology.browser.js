const assert=require('node:assert/strict');

module.exports=async function verifyOntology({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1060}});const page=await context.newPage();const errors=[];const results=[];
  page.on('pageerror',error=>errors.push(error.message));
  const check=async(name,run)=>{await run();results.push(name);};
  try{
    await page.goto(baseURL+'?project=AFTERSALES#orbit');
    await page.locator('[data-action="studio-tab"][data-value="ontology"]').first().click();
    await check('mainline and full scope preserve the model and display accurate counts',async()=>{
      assert.equal(await page.locator('.ontology-node:visible').count(),8);const original=await page.evaluate(()=>JSON.stringify(OrbitOntology.data()));
      await page.locator('[data-action="ontology-scope"][data-value="complete"]').click();assert.equal(await page.locator('.ontology-node:visible').count(),12);assert.equal(await page.evaluate(()=>JSON.stringify(OrbitOntology.data())),original);
      assert.match(await page.locator('#ontology-count').innerText(),/12\s*\/\s*12/);
    });
    await check('semantic legend highlights both endpoints without removing relationships',async()=>{
      await page.locator('[data-action="ontology-filter"][data-value="candidate"]').click();assert.equal(await page.locator('[data-action="ontology-filter"][data-value="candidate"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('[data-node="board"]').evaluate(element=>element.classList.contains('is-dim')),false);assert.equal(await page.locator('[data-node="symptom"]').evaluate(element=>element.classList.contains('is-dim')),false);assert.equal(await page.locator('.ontology-node:visible').count(),12);
      await page.locator('[data-action="ontology-filter"][data-value="candidate"]').click();assert.equal(await page.evaluate(()=>OrbitOntology.view().filter),'all');
    });
    await check('directory reveals hidden definitions and keeps candidate direction explicit',async()=>{
      await page.locator('[data-action="ontology-scope"][data-value="mainline"]').click();await page.locator('[data-action="ontology-inspector"][data-value="directory"]').click();
      await page.locator('.atlas-directory [data-id="board"]').click();assert.equal(await page.evaluate(()=>OrbitOntology.view().scope),'complete');assert.match(await page.locator('.atlas-impact').innerText(),/不将原因假设作为事实依据/);
      const relation=page.locator('.ontology-relation[data-source="board"][data-target="symptom"]');assert.match(await relation.innerText(),/主控板.*→.*屏幕无显示/s);
    });
    await check('search result is clickable and exposes an auxiliary definition',async()=>{
      await page.locator('[data-action="ontology-scope"][data-value="mainline"]').click();await page.locator('#ontology-search').fill('黑屏');await page.locator('#ontology-search-results [data-id="alias-dark"]').click();assert.equal(await page.locator('#ontology-inspector h2').innerText(),'黑屏');assert.equal(await page.locator('#ontology-search').inputValue(),'');
    });
    await check('action preview matches the configuration and does not create an agent',async()=>{
      await page.locator('[data-action="ontology-start"]').first().click();assert.equal(await page.locator('#ontology-inspector h2').innerText(),'准备报修草稿');assert.equal(await page.locator('.atlas-fields>div>span').count(),4);assert.equal(await page.locator('.atlas-binding p').count(),3);assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),0);
      await page.locator('[data-action="ontology-create"]').click();assert.match(await page.locator('#studio-scene-form [name="name"]').inputValue(),/准备报修草稿助手/);assert.equal(await page.evaluate(()=>ProjectStudio.data().agents.length),0);
      await page.locator('[data-action="studio-tab"][data-value="ontology"]').first().click();
    });
    for(const width of [390,768,1024,1440,1600])for(const scope of ['mainline','complete'])await check(`geometry ${width}/${scope}`,async()=>{
      await page.setViewportSize({width,height:1060});await page.locator('[data-action="ontology-scope"][data-value="'+scope+'"]').click();
      for(const mode of width<1000?['flow']:['flow','star']){
        if(await page.locator('[data-action="ontology-mode"][data-value="'+mode+'"]').isVisible())await page.locator('[data-action="ontology-mode"][data-value="'+mode+'"]').click();
        await page.waitForTimeout(650);
        const issues=await page.evaluate(()=>{
          const errors=[];const cards=[...document.querySelectorAll('.ontology-node:not([hidden])')].map(element=>({id:element.dataset.node,box:element.getBoundingClientRect()}));const viewport=document.getElementById('ontology-viewport').getBoundingClientRect();
          if(document.body.scrollWidth>innerWidth+1)errors.push('page overflow');
          for(let first=0;first<cards.length;first++)for(let second=first+1;second<cards.length;second++){const left=cards[first].box;const right=cards[second].box;if(left.left<right.right&&left.right>right.left&&left.top<right.bottom&&left.bottom>right.top)errors.push('overlapping nodes');}
          for(const edge of document.querySelectorAll('.atlas-edge-line')){
            if(edge.parentElement.style.display==='none')continue;
            for(const card of cards){if([edge.parentElement.dataset.source,edge.parentElement.dataset.target].includes(card.id))continue;
              for(let sample=1;sample<50;sample++){const point=edge.getPointAtLength(edge.getTotalLength()*sample/50);if(point.x+viewport.x>card.box.left&&point.x+viewport.x<card.box.right&&point.y+viewport.y>card.box.top&&point.y+viewport.y<card.box.bottom){errors.push('edge crosses unrelated node');break;}}
            }
          }
          return errors;
        });assert.deepEqual(issues,[],`${width}/${scope}/${mode}`);
      }
    });
    assert.deepEqual(errors,[]);return {passed:results.length,results};
  }finally{await context.close();}
};
