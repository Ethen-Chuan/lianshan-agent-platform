const assert = require('node:assert/strict');

module.exports = async function verifyCopyPolish({browser, baseURL = 'http://127.0.0.1:4340/'}) {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const errors = [];
  const results = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  const check = async (name, run) => {
    try {
      await run();
      results.push(name);
    } catch (error) {
      throw new Error(name + ': ' + error.message, {cause: error});
    }
  };
  const visit = route => page.goto(baseURL + '?project=AFTERSALES#' + route);
  const section = value => page.locator('.ow-navigation [data-value="' + value + '"]').click();
  try {
    await check('collaboration names the work and keeps approval and demo boundaries visible', async () => {
      await visit('group');
      assert.equal(await page.locator('.aw-header h1').innerText(), '售后协作群');
      assert.equal(await page.locator('.aw-welcome h2').innerText(), '开始一项任务');
      assert.match(await page.locator('.aw-header').innerText(), /内部协作群 · 客户不可见/);
      assert.match(await page.locator('.aw-environment').innerText(), /本地演练 · 模型与业务系统未接入/);
      assert.match(await page.locator('.aw-composer').innerText(), /对客发送、建单需另行确认/);
      await page.locator('.aw-tabs [data-value="shared"]').click();
      assert.equal(await page.locator('.aw-section-intro h2').innerText(), '共享业务定义');
      assert.match(await page.locator('.aw-shared').innerText(), /客户资料按任务取用/);
      await page.locator('.aw-tabs [data-value="outcomes"]').click();
      assert.equal(await page.locator('.aw-section-intro h2').innerText(), '验收与使用记录');
      assert.match(await page.locator('.aw-outcomes').innerText(), /真实自助解决率、模型准确率与成本均未采集/);
    });
    await check('assistant entry, flow and text design use consistent actions', async () => {
      await visit('agents');
      assert.equal(await page.locator('.focus-design h2').innerText(), '创建业务助手');
      await page.locator('.focus-design [data-action="studio-orbit"]').click();
      assert.equal(await page.locator('.flow-heading h2').innerText(), '业务流程');
      assert.equal(await page.locator('.flow-empty h3').innerText(), '添加第一个节点');
      await page.locator('.flow-heading [data-action="flow-side"]').click();
      assert.equal(await page.locator('.flow-agent-panel h3').innerText(), '修改画布');
      assert.equal(await page.locator('#flow-agent-form button[type="submit"]').innerText(), '预览修改');
      assert.match(await page.locator('.flow-agent-status').innerText(), /本地指令模式 · 语义模型未连接/);
      await page.locator('[data-action="ow-design-mode"][data-value="text"]').click();
      assert.match(await page.locator('.ow-hero h2').innerText(), /创建业务助手/);
      assert.match(await page.locator('#ow-brief-note').innerText(), /未调用模型/);
    });
    await check('definitions, tools and change views explain their actual state', async () => {
      await section('library');
      assert.equal(await page.locator('.ow-panel-heading h2').innerText(), '共享业务定义');
      await section('capabilities');
      assert.equal(await page.locator('.ow-panel-heading h2').innerText(), '可用功能与待接入工具');
      assert.match(await page.locator('.ow-evidence').innerText(), /真实数据源尚未接入/);
      assert.match(await page.locator('.ow-evidence').innerText(), /不能手动设为“可用”/);
      await section('changes');
      assert.equal(await page.locator('.ow-panel-heading h2').innerText(), '规则变更影响');
      assert.match(await page.locator('.ow-footnote').innerText(), /此页不会自动发布/);
    });
    await check('ontology and instance graph remain distinct after copy changes', async () => {
      await page.locator('[data-action="studio-tab"][data-value="ontology"]').first().click();
      assert.equal(await page.locator('.usage-heading h2').innerText(), '定义与引用');
      assert.equal(await page.locator('.atlas-outcome').count(), 0);
      assert.equal(await page.locator('.usage-limit').getAttribute('open'), null);
      await page.locator('.usage-limit > summary').click();
      assert.match(await page.locator('.usage-limit').innerText(), /仍需人工核对/);
      assert.match(await page.locator('.atlas-motion-note').innerText(), /不执行真实操作/);
      await visit('graph');
      assert.equal(await page.locator('.graph-issues-title h3').innerText(), '问题列表');
      assert.match(await page.locator('main').innerText(), /待核实事项/);
      assert.match(await page.locator('main').innerText(), /当前尚未自动映射/);
      assert.match(await page.locator('main').innerText(), /关联案例检索/);
    });
    await check('analytics titles describe counted problems rather than customer preferences', async () => {
      await visit('analytics');
      assert.match(await page.locator('.pi-top-panel').innerText(), /高频问题 Top 5/);
      assert.doesNotMatch(await page.locator('main').innerText(), /客户最关心|候选簇/);
      assert.match(await page.locator('main').innerText(), /固定模拟样本/);
      assert.match(await page.locator('.pi-navigation').innerText(), /问题分析[\s\S]*质量与改进/);
    });
    await check('client handoff and retry copy retain real-system limitations', async () => {
      await visit('group');
      await page.locator('.nav-experience-section [data-page="customer"]').click();
      assert.equal(await page.locator('.journey-heading h1').innerText(), '客户体验');
      assert.equal(await page.locator('.sidebar [data-page="customer"]').getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('.sidebar [data-page="workspace"]').getAttribute('aria-current'), 'false');
      await page.locator('[data-action="journey-mode"][data-value="rules"]').click();
      assert.equal(await page.locator('.journey-boundary-tests .journey-boundary-button').count(),2);
      await page.locator('[data-action="journey-start"][data-value="timeout"]').click();
      await page.locator('[data-action="journey-retry"]').click();
      assert.match(await page.locator('.journey-messages').innerText(), /工单接口尚未接入，仍无法核实进度，请转人工查询/);
      assert.equal(await page.locator('[data-action="journey-handoff"]').innerText(), '携带记录转人工');
      assert.equal(await page.evaluate(() => ServiceJourney.sessions().at(-1).resolved), false);
    });
    await check('saved user and historical wording is never rewritten on render or reload', async () => {
      await visit('group');
      const historical = '一起把事情办完。旧记录中的 Prompt 与业务闭环保留原文。';
      const storageBefore = await page.evaluate(text => {
        state.projectCollab.messages.push({author: 'operator', text, time: new Date().toISOString()});
        persist();
        return JSON.stringify(state.projectCollab.messages);
      }, historical);
      await page.reload();
      assert.equal(await page.evaluate(() => JSON.stringify(state.projectCollab.messages)), storageBefore);
      assert.ok((await page.locator('#project-group-stream').innerText()).includes(historical));
    });
    for (const width of [390, 1440]) {
      await check('updated copy fits primary pages at width ' + width, async () => {
        await page.setViewportSize({width, height: 1000});
        for (const route of ['portfolios', 'group', 'agents', 'orbit', 'ontology', 'customer', 'graph', 'analytics', 'knowledge', 'tickets', 'quality', 'project']) {
          await visit(route);
          const size = await page.evaluate(() => ({body: document.body.scrollWidth, viewport: innerWidth, main: document.querySelector('main').scrollWidth, content: document.querySelector('main').clientWidth}));
          assert.ok(size.body <= size.viewport + 1 && size.main <= size.content + 1, JSON.stringify({route, ...size}));
        }
      });
    }
    assert.deepEqual(errors, []);
    return {passed: results.length, results};
  } finally {
    await context.close();
  }
};
