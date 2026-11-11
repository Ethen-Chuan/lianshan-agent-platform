const assert=require('node:assert/strict');

module.exports=async function verifyKnowledgeEditor({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];const results=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  const check=async(name,callback)=>{await callback();results.push(name);};
  try{
    await page.goto(baseURL+'?project=AFTERSALES#knowledge');
    await check('form appearance choices, live preview and saved detail agree',async()=>{
      await page.locator('[data-action="new-knowledge"]').click();
      assert.equal(await page.locator('[data-action="knowledge-icon"]').count(),12);
      assert.equal(await page.locator('[data-action="knowledge-tone"]').count(),6);
      await page.locator('#knowledge-title').fill('A1 操作说明 · 外观验收');
      await page.locator('#knowledge-content').fill('第一步：进入设备设置。\n第二步：打开系统信息查看版本，菜单不一致时交给人工核对。');
      await page.locator('[data-action="knowledge-icon"][data-value="software"]').click();
      await page.locator('[data-action="knowledge-tone"][data-value="blue"]').click();
      assert.match(await page.locator('#knowledge-preview').innerText(),/A1 操作说明 · 外观验收/);
      assert.equal(await page.locator('#knowledge-preview .identity-knowledge').getAttribute('data-tone'),'blue');
      const previewArt=await page.locator('#knowledge-preview .identity-art').innerHTML();
      await page.getByRole('button',{name:'保存待审核草稿',exact:true}).click();
      assert.equal(await page.locator('#dialog-title').innerText(),'A1 操作说明 · 外观验收');
      assert.equal(await page.locator('.knowledge-detail-identity .identity-art').innerHTML(),previewArt);
      assert.match(await page.locator('.knowledge-detail-content').innerText(),/第二步/);
      await page.locator('.dialog-footer [data-action="close-dialog"]').click();
      const row=page.locator('.knowledge-table tbody tr').filter({hasText:'A1 操作说明 · 外观验收'});
      assert.equal(await row.locator('.identity-art').innerHTML(),previewArt);assert.match(await row.innerText(),/待审核/);
    });
    await check('reload and edit preserve appearance and update the existing record',async()=>{
      await page.reload();await page.getByRole('button',{name:'A1 操作说明 · 外观验收',exact:true}).click();await page.locator('[data-action="edit-knowledge"]').click();
      assert.equal(await page.locator('[data-action="knowledge-icon"][data-value="software"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('[data-action="knowledge-tone"][data-value="blue"]').getAttribute('aria-pressed'),'true');
      await page.locator('#knowledge-title').fill('A1 操作说明 · 已修订');await page.getByRole('button',{name:'保存草稿修改',exact:true}).click();
      await page.locator('.dialog-footer [data-action="close-dialog"]').click();assert.equal(await page.locator('.knowledge-table tbody tr').count(),5);
      assert.equal(await page.getByRole('button',{name:'A1 操作说明 · 已修订',exact:true}).count(),1);
    });
    await check('validation, keyboard selection and narrow screens remain usable',async()=>{
      for(const width of [1440,900,390]){
        await page.setViewportSize({width,height:844});await page.locator('[data-action="new-knowledge"]').click();
        await page.getByRole('button',{name:'保存待审核草稿',exact:true}).click();assert.match(await page.locator('#knowledge-error').innerText(),/知识标题/);
        await page.locator('#knowledge-title').fill('键盘演练');await page.locator('#knowledge-content').fill('请先确认设备型号和版本，再按照已审核的说明操作。');
        const choice=page.locator('[data-action="knowledge-icon"][data-value="ticket"]');await choice.focus();await page.keyboard.press('Enter');
        assert.equal(await choice.getAttribute('aria-pressed'),'true');
        const dialog=await page.locator('.knowledge-editor-dialog').boundingBox();assert.ok(dialog.x>=0&&dialog.x+dialog.width<=width);
        assert.equal(await page.locator('.knowledge-editor-layout').evaluate(element=>element.scrollWidth>element.clientWidth+1),false);
        await page.getByRole('button',{name:'保存待审核草稿',exact:true}).scrollIntoViewIfNeeded();
        const footer=await page.locator('.knowledge-editor-dialog .dialog-footer').boundingBox();assert.ok(footer.y+footer.height<=844);
        await page.getByRole('button',{name:'取消',exact:true}).click();
      }
    });
    assert.deepEqual(errors,[]);return {passed:results.length,results};
  }finally{await context.close();}
};
