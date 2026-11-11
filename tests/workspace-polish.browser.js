const assert=require('node:assert/strict');

module.exports=async function verifyWorkspacePolish({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];const results=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  const check=async(name,run)=>{try{await run();results.push(name);}catch(error){error.message=name+': '+error.message;throw error;}};
  try{
    await page.goto(baseURL+'?project=AFTERSALES#workspace');
    await check('manual library is collapsed and keyword suggestions never send a message',async()=>{
      assert.equal(await page.locator('#seat-reply-detail').count(),0);const messages=await page.evaluate(()=>selectedCase().messages.length);await page.locator('#reply-input').fill('您好，补充');assert.equal(await page.locator('#seat-completions [role="option"]').count(),1);await page.locator('#seat-completions [role="option"]').click();assert.equal(await page.locator('#reply-input').inputValue(),'您好，请再描述一下具体情况，我接着帮您看。');assert.equal(await page.evaluate(()=>selectedCase().messages.length),messages);
    });
    await check('cursor-middle replacement preserves both surrounding text and keyboard selection',async()=>{
      await page.locator('#reply-input').fill('您好，补充；谢谢');await page.locator('#reply-input').evaluate(element=>{element.setSelectionRange(5,5);element.dispatchEvent(new Event('click',{bubbles:true}));});await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#reply-input').inputValue(),'您好，请再描述一下具体情况，我接着帮您看。；谢谢');
    });
    await check('IME waits for composition to finish and Escape dismisses the suggestion',async()=>{
      await page.locator('#reply-input').dispatchEvent('compositionstart');await page.locator('#reply-input').fill('补充');assert.equal(await page.locator('#seat-completions').count(),0);await page.locator('#reply-input').dispatchEvent('compositionend');assert.equal(await page.locator('#seat-completions').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('#seat-completions').count(),0);await page.locator('#reply-input').click();assert.equal(await page.locator('#seat-completions').count(),0);
      await page.locator('#reply-input').fill('等待');await page.keyboard.press('Enter');assert.equal(await page.locator('#reply-input').inputValue(),'等待\n');
    });
    await check('internal notes and read-only sources never trigger customer phrases',async()=>{
      await page.locator('[data-action="composer-tab"][data-value="note"]').click();await page.locator('#reply-input').fill('补充');assert.equal(await page.locator('#seat-completions').count(),0);await page.locator('[data-action="composer-tab"][data-value="reply"]').click();const readonly=await page.evaluate(()=>state.cases.find(item=>item.owner==='readonly').id);await page.locator('[data-action="select-case"][data-id="'+readonly+'"]').click();assert.equal(await page.locator('#reply-input').isDisabled(),true);assert.equal(await page.locator('#seat-completions').count(),0);const active=await page.evaluate(()=>state.cases.find(item=>item.owner!=='readonly'&&!['已解决','关闭未解决'].includes(item.status)).id);await page.locator('[data-action="select-case"][data-id="'+active+'"]').click();
    });
    await check('manual library adds and persists a custom keyword phrase',async()=>{
      await page.locator('[data-action="seat-tab"][data-value="phrases"]').click();await page.locator('[data-action="seat-phrase-new"]').click();await page.locator('#seat-new-label').fill('补充资料');await page.locator('#seat-new-keywords').fill('资料补全');await page.locator('#seat-new-text').fill('请补充相关资料，核实后再继续处理。');await page.locator('[data-action="seat-phrase-save"]').click();await page.reload();await page.locator('#reply-input').fill('资料补全');assert.match(await page.locator('#seat-completions').innerText(),/请补充相关资料/);assert.equal(await page.evaluate(()=>state.seatPhrases.length),1);
    });
    await check('sidebar separates everyday work from assistant development without dual selection',async()=>{
      assert.match(await page.locator('.nav-work-section').innerText(),/客服工作台[\s\S]*工单记录/);assert.match(await page.locator('.nav-build-section').innerText(),/知识库[\s\S]*业务助手/);assert.equal(await page.locator('.sidebar .nav-item.active').count(),1);await page.locator('.sidebar [data-page="tickets"]').click();assert.equal(await page.locator('.sidebar .nav-item.active').count(),1);assert.match(await page.locator('.sidebar .nav-item.active').innerText(),/工单记录/);
    });
    await check('customer workspace is first in desktop and compact navigation',async()=>{
      for(const width of [1440,900]){
        await page.setViewportSize({width,height:1000});
        const entries=page.locator('.nav-work-section .nav-item');
        assert.deepEqual(await entries.evaluateAll(elements=>elements.map(element=>element.dataset.page)),['workspace','group','tickets']);
        const firstBounds=await entries.nth(0).boundingBox();const secondBounds=await entries.nth(1).boundingBox();assert.ok(firstBounds.y+firstBounds.height<=secondBounds.y);
        if(width===900)assert.equal(await entries.first().locator('.nav-label').isVisible(),false);
        await entries.first().click();assert.equal(new URL(page.url()).hash,'#workspace');assert.equal(await page.locator('.sidebar .nav-item.active').getAttribute('data-page'),'workspace');
        await entries.nth(2).click();assert.equal(new URL(page.url()).hash,'#tickets');assert.equal(await page.locator('.sidebar .nav-item.active').getAttribute('data-page'),'tickets');
      }
    });
    await check('keyword suggestions keep the reply composer reachable on desktop and mobile',async()=>{
      await page.goto(baseURL+'?project=AFTERSALES#workspace');for(const dimensions of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(dimensions);if(await page.locator('[data-action="select-case"]').first().isVisible())await page.locator('[data-action="select-case"]').first().click();await page.locator('#reply-input').fill('补充');const bounds=await page.locator('.composer').boundingBox();assert.ok(bounds.y+bounds.height<=dimensions.height,JSON.stringify(bounds));const send=page.locator('[data-action="send-message"]');await send.scrollIntoViewIfNeeded();const sendBounds=await send.boundingBox();assert.ok(sendBounds.y+sendBounds.height<=dimensions.height,JSON.stringify(sendBounds));}
    });
    assert.deepEqual(errors,[]);return {passed:results.length,results};
  }finally{await context.close();}
};
