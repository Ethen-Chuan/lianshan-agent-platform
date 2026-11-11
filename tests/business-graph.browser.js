const assert = require('node:assert/strict');

module.exports = async function verifyBusinessGraph({browser,baseURL='http://127.0.0.1:4340/'}) {
  const context = await browser.newContext({viewport:{width:1440,height:1100}});
  const page = await context.newPage();
  const errors = [];
  const results = [];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(12000);
  const check = async(name,run) => {try{await run();results.push(name);}catch(error){error.message=name+': '+error.message;throw error;}};
  const open = async(topic='audio',filters={}) => {await page.evaluate(({topic,filters})=>BusinessGraph.open(topic,filters),{topic,filters});};
  try {
    await page.goto(baseURL+'?project=AFTERSALES#graph');
    await check('instance identity, three readable lanes and explicit ontology boundary',async() => {
      assert.match(await page.locator('.graph-page-heading').innerText(),/业务实例图谱/);
      assert.match(await page.locator('.graph-boundary').innerText(),/尚未自动映射/);
      assert.equal(await page.locator('.graph-lane').count(),3);
      assert.equal(await page.locator('.graph-node').count(),9);
      assert.equal(await page.locator('.graph-edge').count(),9);
      assert.equal(await page.locator('.graph-node-label').first().evaluate(element=>getComputedStyle(element).fontSize),'14px');
    });
    await check('keyboard relationship inspection retains full evidence limits and returns to focus',async() => {
      await page.locator('[data-action="graph-edge"][data-id="edge-hypothesis"]').focus();
      await page.keyboard.press('Enter');
      assert.match(await page.locator('.graph-inspector').innerText(),/反证与限制/);
      assert.match(await page.locator('.graph-inspector').innerText(),/不作为确定因果/);
      assert.equal(await page.locator('#graph-inspector-heading').evaluate(element=>element===document.activeElement),true);
      await page.locator('[data-action="graph-return"]').click();
      assert.equal(await page.locator('[data-action="graph-edge"][data-id="edge-hypothesis"]').evaluate(element=>element===document.activeElement),true);
    });
    await check('knowledge index has no fabricated document evidence and source opens original record',async() => {
      await page.locator('[data-action="graph-node"][data-id="knowledge"]').click();
      assert.match(await page.locator('.graph-inspector').innerText(),/没有正式文档正文/);
      assert.equal(await page.locator('.graph-inspector [data-action="graph-source"]').count(),0);
      const identifier = await page.locator('.graph-node-case').first().getAttribute('data-id');
      await page.locator('.graph-node-case').first().click();
      await page.locator('.graph-inspector [data-action="graph-source"]').click();
      assert.match(await page.locator('[role="dialog"]').innerText(),new RegExp(identifier));
      assert.match(await page.locator('[role="dialog"]').innerText(),/预置示例，非真实日志附件/);
      await page.locator('[data-action="close-dialog"]').first().click();
    });
    await check('query count, pagination and trace agree with scoped, deduplicated source rows',async() => {
      await page.locator('[data-action="graph-run"]').click();
      const count = await page.evaluate(()=>{const graph=BusinessGraph.model();return graph.report.rows.filter(row=>row.product===graph.topic.product&&row.version===graph.topic.version).length;});
      assert.match(await page.locator('#graph-results h3').innerText(),new RegExp('^'+count+' 个案例'));
      assert.equal(await page.locator('.graph-result-rows>button').count(),12);
      await page.locator('[data-action="graph-more"]').click();
      assert.equal(await page.locator('.graph-result-rows>button').count(),24);
      await page.locator('#graph-results [data-action="trace-open"]').click();
      assert.match(await page.locator('.trace-module').innerText(),/local.graph.traverse/);
      assert.match(await page.locator('.trace-module').innerText(),/modelCalled/);
      await page.goto(baseURL+'?project=AFTERSALES#graph');
      await page.locator('[data-action="graph-run"]').click();
    });
    await check('filters invalidate retrieval and evidence-only leaves issue totals unchanged',async() => {
      const count = await page.locator('.graph-focus-count strong').innerText();
      await page.locator('#graph-evidence-only').check();
      assert.equal(await page.locator('#graph-results').count(),0);
      assert.equal(await page.locator('.graph-focus-count strong').innerText(),count);
      await page.locator('[data-action="graph-all-cases"]').click();
      const evidence = await page.evaluate(()=>BusinessGraph.model().rows.length);
      assert.match(await page.locator('#graph-results h3').innerText(),new RegExp('^'+evidence+' 个案例'));
      await page.locator('#graph-channel').selectOption('ding');
      assert.equal(await page.locator('#graph-results').count(),0);
      assert.equal(await page.evaluate(()=>BusinessGraph.model().rows.every(row=>row.channel==='ding'&&row.primaryEvidence)),true);
    });
    await check('empty and malicious search have honest zero results and preserve typing focus',async() => {
      await page.locator('#graph-search').fill('<img src=x onerror=alert(1)>');
      assert.equal(await page.locator('.graph-node').count(),0);
      assert.equal(await page.locator('.graph-search img').count(),0);
      assert.equal(await page.locator('#graph-search').evaluate(element=>element===document.activeElement),true);
      await page.locator('[data-action="graph-clear"]').click();
      await page.locator('#graph-channel').selectOption('archive');
      assert.equal(await page.locator('.graph-empty').count(),1);
      assert.equal(await page.locator('[data-action="graph-run"]').count(),0);
      await page.locator('[data-action="graph-clear"]').click();
    });
    await check('non-applicable software versions cannot join unrelated policy and service cases',async() => {
      await open('inspection');
      assert.equal(await page.locator('[data-action="graph-node"][data-id="related"]').count(),0);
      assert.equal(await page.locator('#graph-query').inputValue(),'current');
      assert.equal(await page.locator('#graph-query option[value="same"]').evaluate(element=>element.disabled),true);
      await page.locator('[data-action="graph-run"]').click();
      assert.match(await page.locator('#graph-results h3').innerText(),/1 类问题/);
    });
    await check('classification catalog and Orbit are separate destinations',async() => {
      await page.locator('[data-action="graph-catalog"]').click();
      assert.match(await page.locator('#insight-ontology-heading').innerText(),/问题分类与审核/);
      assert.match(await page.locator('.pi-ontology-header').innerText(),/不是 Orbit/);
      await open();
      await page.locator('[data-action="graph-orbit"]').click();
      assert.match(page.url(),/#orbit/);
      assert.ok(await page.locator('.ontology-node').count()>0);
      await open();
    });
    await check('followup creates only an idempotent local draft and never mutates Orbit',async() => {
      const original = await page.evaluate(()=>JSON.stringify(ProjectStudio.data()));
      await page.locator('[data-action="graph-followup"]').click();
      assert.match(await page.locator('.pi-local-work').innerText(),/待分派 · 本地草稿/);
      assert.equal(await page.evaluate(()=>JSON.stringify(ProjectStudio.data())),original);
      const count = await page.evaluate(()=>ProblemInsights.getState().followups.length);
      await open();await page.locator('[data-action="graph-followup"]').click();
      assert.equal(await page.evaluate(()=>ProblemInsights.getState().followups.length),count);
      await open('reset');await page.locator('[data-action="graph-review"]').click();
      assert.match(await page.locator('[role="dialog"]').innerText(),/分类草案/);
      await page.locator('[data-action="close-dialog"]').first().click();
      assert.equal(await page.evaluate(()=>JSON.stringify(ProjectStudio.data())),original);
    });
    await check('incoming problem context preserves topic, date, channel and business domain',async() => {
      await open('gps',{day:'week',channel:'feishu',domain:'软件问题'});
      assert.match(await page.locator('.graph-focus h3').innerText(),/定位漂移/);
      assert.equal(await page.locator('#graph-day').inputValue(),'week');
      assert.equal(await page.locator('#graph-channel').inputValue(),'feishu');
      assert.equal(await page.locator('#graph-domain').inputValue(),'软件问题');
      await page.locator('[data-action="graph-presentation"][data-value="list"]').click();
      assert.equal(await page.locator('.graph-relation-table tbody tr').count(),await page.evaluate(()=>BusinessGraph.model().edges.length));
      await page.locator('.graph-relation-table [data-action="graph-node"][data-id="product"]').click();
      assert.match(await page.locator('#graph-inspector-heading').innerText(),/座舱终端 A1/);
    });
    for (const width of [1920,1440,1024,768,390,320]) {
      await check('readable card geometry and no page overflow at '+width,async() => {
        await page.setViewportSize({width,height:1200});await open();
        const geometry = await page.evaluate(()=>{
          const nodes=[...document.querySelectorAll('.graph-node')];const issues=[];
          for(let first=0;first<nodes.length;first++){
            const bounds=nodes[first].getBoundingClientRect();
            for(const text of nodes[first].querySelectorAll('.graph-node-type,.graph-node-label,p,small')){
              const box=text.getBoundingClientRect();
              if(text.scrollWidth>text.clientWidth+1||box.left<bounds.left||box.right>bounds.right+1)issues.push('text overflow '+nodes[first].dataset.id);
              if(parseFloat(getComputedStyle(text).fontSize)<12)issues.push('small text');
            }
            for(let second=first+1;second<nodes.length;second++){
              const other=nodes[second].getBoundingClientRect();
              if(Math.min(bounds.right,other.right)>Math.max(bounds.left,other.left)+1&&Math.min(bounds.bottom,other.bottom)>Math.max(bounds.top,other.top)+1)issues.push('overlap');
            }
          }
          return {issues,overflow:document.body.scrollWidth>innerWidth+1};
        });
        assert.deepEqual(geometry,{issues:[],overflow:false});
        await page.locator('[data-action="graph-presentation"][data-value="list"]').click();
        assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth+1),false);
      });
    }
    await check('reduced motion and project isolation remain intact',async() => {
      await page.emulateMedia({reducedMotion:'reduce'});await open();
      assert.equal(await page.locator('.graph-inspector').evaluate(element=>getComputedStyle(element).animationName),'none');
      await page.goto(baseURL+'?project=RETAIL#graph');
      assert.equal(await page.locator('.business-graph').count(),0);
      assert.deepEqual(errors,[]);
    });
    return results;
  } finally {await context.close();}
};
