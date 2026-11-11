const assert=require('node:assert/strict');

module.exports=async function verifyReadableOntology({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:2000}});const page=await context.newPage();const errors=[];const results=[];
  page.on('pageerror',error=>errors.push(error.message));
  const check=async(name,run)=>{await run();results.push(name);};
  const geometry=async()=>page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.ontology-node:not([hidden])')].map(element=>({id:element.dataset.node,box:element.getBoundingClientRect()}));const overlaps=[];
    for(let first=0;first<cards.length;first++)for(let second=first+1;second<cards.length;second++){
      const left=cards[first].box;const right=cards[second].box;
      if(left.left<right.right-.5&&left.right>right.left+.5&&left.top<right.bottom-.5&&left.bottom>right.top+.5)overlaps.push(cards[first].id+'/'+cards[second].id);
    }
    const labels=[...document.querySelectorAll('.atlas-edge-label')].filter(element=>element.style.display!=='none'&&element.parentElement.style.display!=='none');
    const labelCollisions=[];
    for(const label of labels){const box=label.getBoundingClientRect();for(const card of cards){const node=card.box;if(box.left<node.right&&box.right>node.left&&box.top<node.bottom&&box.bottom>node.top)labelCollisions.push(label.textContent+'/'+card.id);}}
    return {overlaps,labelCollisions,rotated:labels.filter(element=>(element.getAttribute('transform')||'').includes('rotate')).length,fontSize:parseFloat(getComputedStyle(document.querySelector('.ontology-node-label')).fontSize)};
  });
  try{
    await page.goto(baseURL+'?project=AFTERSALES#orbit');await page.locator('[data-action="studio-tab"][data-value="ontology"]').first().click();await page.waitForTimeout(650);
    const frozen=await page.evaluate(()=>JSON.stringify(OrbitOntology.data()));
    await check('mainline stays in place when full ontology is opened',async()=>{
      const before=await page.evaluate(()=>OrbitOntology.positions());await page.locator('[data-action="ontology-scope"][data-value="complete"]').click();await page.waitForTimeout(650);const after=await page.evaluate(()=>OrbitOntology.positions());
      for(const identifier of ['symptom','warranty','rule-check','verify','draft','human','escalate'])assert.deepEqual(after[identifier],before[identifier]);
    });
    await check('dragging one node onto another is corrected without moving unrelated nodes',async()=>{
      await page.locator('#ontology-drag-mode').selectOption('single');const initial=await page.evaluate(()=>OrbitOntology.positions());
      const source=await page.locator('[data-node="board"]').boundingBox();const target=await page.locator('[data-node="device"]').boundingBox();
      await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:12});await page.mouse.up();await page.waitForTimeout(200);
      assert.deepEqual((await geometry()).overlaps,[]);const moved=await page.evaluate(()=>OrbitOntology.positions());assert.notDeepEqual(moved.board,initial.board);for(const identifier of Object.keys(initial).filter(identifier=>identifier!=='board'))assert.deepEqual(moved[identifier],initial[identifier]);
    });
    await check('branch drag preserves spacing, geometry and the ontology model',async()=>{
      await page.locator('[data-action="ontology-arrange"]').click();await page.waitForTimeout(650);await page.locator('#ontology-drag-mode').selectOption('branch');
      const before=await page.evaluate(()=>OrbitOntology.positions());const source=await page.locator('[data-node="verify"]').boundingBox();
      await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(source.x+source.width/2+95,source.y+source.height/2+110,{steps:12});await page.mouse.up();await page.waitForTimeout(200);
      const after=await page.evaluate(()=>OrbitOntology.positions());assert.ok(Math.abs((after.verify.x-after.draft.x)-(before.verify.x-before.draft.x))<1);assert.deepEqual((await geometry()).overlaps,[]);assert.equal(await page.evaluate(()=>JSON.stringify(OrbitOntology.data())),frozen);
    });
    await check('zoom scales the cards with the distances and keeps labels horizontal',async()=>{
      await page.locator('[data-action="ontology-arrange"]').click();await page.waitForTimeout(650);const before=await page.locator('[data-node="verify"]').boundingBox();
      for(let index=0;index<4;index++)await page.locator('[data-action="ontology-zoom"][data-value="out"]').click();await page.waitForTimeout(150);
      const after=await page.locator('[data-node="verify"]').boundingBox();assert.ok(Math.abs(after.width/before.width-.85)<.01);const issues=await geometry();assert.deepEqual(issues.overlaps,[]);assert.deepEqual(issues.labelCollisions,[]);assert.equal(issues.rotated,0);assert.ok(issues.fontSize>=15);
      await page.locator('[data-action="ontology-fit"]').click();await page.waitForTimeout(650);
    });
    await check('local focus can be reset without losing any definition',async()=>{
      await page.locator('[data-node="draft"]').click();await page.locator('[data-action="ontology-local"]').click();assert.equal(await page.locator('.ontology-node:visible').count(),4);await page.locator('[data-action="ontology-local"]').click();assert.equal(await page.locator('.ontology-node:visible').count(),12);
    });
    await check('ordinary wheel scroll does not change zoom, modified wheel does',async()=>{
      const zoom=await page.evaluate(()=>OrbitOntology.view().zoom);
      await page.locator('#ontology-viewport').dispatchEvent('wheel',{deltaY:120,ctrlKey:false,metaKey:false});assert.equal(await page.evaluate(()=>OrbitOntology.view().zoom),zoom);
      await page.locator('#ontology-viewport').dispatchEvent('wheel',{deltaY:-120,ctrlKey:true});assert.ok(await page.evaluate(()=>OrbitOntology.view().zoom)>zoom);await page.locator('[data-action="ontology-fit"]').click();await page.waitForTimeout(650);
    });
    await check('relationship list has the same directions and can navigate definitions',async()=>{
      await page.locator('[data-action="ontology-presentation"][data-value="relations"]').click();assert.equal(await page.locator('.atlas-relation-row').count(),12);
      assert.equal(await page.locator('.atlas-relation-row[data-source="board"][data-target="symptom"]').count(),1);
      await page.locator('.atlas-relation-row[data-source="board"] [data-id="board"]').click();assert.equal(await page.locator('#ontology-inspector h2').innerText(),'主控板');assert.equal(await page.evaluate(()=>OrbitOntology.view().presentation),'relations');
    });
    for(const width of [390,768,1024,1440])await check(`readability after resize ${width}`,async()=>{
      await page.setViewportSize({width,height:2400});assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1));await page.locator('[data-action="ontology-presentation"][data-value="graph"]').click();await page.waitForTimeout(650);
      const issues=await geometry();assert.deepEqual(issues.overlaps,[]);assert.deepEqual(issues.labelCollisions,[]);assert.equal(issues.rotated,0);assert.ok(issues.fontSize>=15);
      await page.locator('[data-action="ontology-presentation"][data-value="relations"]').click();assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1));
    });
    assert.deepEqual(errors,[]);return {passed:results.length,results};
  }finally{await context.close();}
};
