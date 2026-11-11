const assert=require('node:assert/strict');

module.exports=async function verifyAgentWorkspace({browser,baseURL='http://127.0.0.1:4340/'}){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];const results=[];let taskId;let handoffCase;
  page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
  const check=async(name,run)=>{try{await run();results.push(name);}catch(error){throw new Error(name+': '+error.message,{cause:error});}};
  const tab=async value=>{if(!await page.locator('.aw-tabs').count())await group();await page.locator('.aw-tabs [data-value="'+value+'"]').click();};
  const sidebar=async route=>{const entry=page.locator('.sidebar [data-page="'+route+'"]');if(!await entry.isVisible()||await entry.evaluate(element=>element.getBoundingClientRect().right<=0))await page.locator('.mobile-menu').click();await entry.click();};
  const group=async()=>sidebar('group');
  const client=async()=>sidebar('customer');
  try{
    await page.goto(baseURL+'?project=AFTERSALES#manager');
    await check('the collaboration entrance, group title and coordinator have distinct names',async()=>{
      assert.match(await page.locator('.sidebar [data-page="group"]').innerText(),/业务协作/);assert.match(await page.locator('.aw-header h1').innerText(),/售后协作群/);assert.match(await page.locator('.aw-roster').innerText(),/连小山/);assert.match(await page.locator('.aw-header [role="img"]').getAttribute('aria-label'),/连小山/);assert.doesNotMatch(await page.locator('.aw-header').innerText(),/Super Agent/);
    });
    await check('legacy route has one collaboration destination and preserves original task identities',async()=>{
      assert.equal(new URL(page.url()).hash,'#group');assert.equal(await page.locator('.sidebar [data-page="manager"]').count(),0);assert.equal(await page.locator('.sidebar [data-page="group"]').count(),1);assert.equal(await page.locator('.scope-notice').count(),0);
      const original=await page.evaluate(()=>ManagerHub.getEngine().get().tasks.map(task=>({id:task.id,conversationId:task.conversationId})));
      await tab('tasks');await tab('collaboration');assert.deepEqual(await page.evaluate(()=>ManagerHub.getEngine().get().tasks.map(task=>({id:task.id,conversationId:task.conversationId}))),original);
    });
    await check('segmented navigation has distinct selected styling, keyboard focus and a live task count',async()=>{
      assert.equal(await page.locator('.aw-settings-actions .button').count(),2);assert.equal(await page.locator('.aw-header-actions [role="tab"]').count(),0);assert.equal(await page.locator('.aw-preview-button').count(),0);assert.equal(await page.locator('.nav-experience-section [data-page="customer"]').count(),1);
      assert.equal(await page.locator('.aw-tabs [role="tab"]').count(),4);assert.equal(await page.locator('.aw-tabs [aria-selected="true"]').count(),1);assert.equal(await page.locator('.aw-tabs [tabindex="0"]').count(),1);
      await page.locator('#aw-tab-collaboration').press('ArrowRight');assert.equal(await page.locator('#aw-tab-tasks').getAttribute('aria-selected'),'true');assert.equal(await page.evaluate(()=>document.activeElement.id),'aw-tab-tasks');assert.equal(await page.locator('#aw-surface').getAttribute('aria-labelledby'),'aw-tab-tasks');
      const selected=await page.locator('#aw-tab-tasks').evaluate(element=>getComputedStyle(element).backgroundColor);const resting=await page.locator('#aw-tab-shared').evaluate(element=>getComputedStyle(element).backgroundColor);assert.notEqual(selected,resting);
      await page.locator('#aw-tab-tasks').press('End');assert.equal(await page.evaluate(()=>document.activeElement.id),'aw-tab-outcomes');await page.locator('#aw-tab-outcomes').press('Home');assert.equal(await page.evaluate(()=>document.activeElement.id),'aw-tab-collaboration');
      const count=await page.evaluate(()=>AgentWorkspace.tasks().filter(task=>/待确认|待人工|需修正|失败|暂停|不足|待配置|转人工/.test(task.status)).length);if(count)assert.equal(await page.locator('.aw-tab-count').innerText(),String(count));else assert.equal(await page.locator('.aw-tab-count').count(),0);
      assert.match(await page.locator('.aw-environment').innerText(),/非生产系统/);
    });
    await check('ontology has one sidebar destination, supports refresh and leaves original records intact',async()=>{
      const before=await page.evaluate(()=>JSON.stringify({scenes:ProjectStudio.data().scenes,tasks:ManagerHub.getEngine().get().tasks}));await page.locator('.sidebar [data-page="ontology"]').click();assert.equal(new URL(page.url()).hash,'#ontology');assert.equal(await page.locator('.sidebar [aria-current="page"]').count(),1);assert.equal(await page.locator('.sidebar [data-page="ontology"]').getAttribute('aria-current'),'page');
      assert.equal(await page.locator('.ontology-page>header h1').innerText(),'业务本体');assert.equal(await page.locator('.orbit-workflow').count(),0);const ontology=await page.evaluate(()=>JSON.stringify(OrbitOntology.data()));await page.reload();assert.equal(await page.locator('#ontology-shell').count(),1);assert.equal(await page.evaluate(()=>JSON.stringify(OrbitOntology.data())),ontology);assert.equal(await page.evaluate(()=>JSON.stringify({scenes:ProjectStudio.data().scenes,tasks:ManagerHub.getEngine().get().tasks})),before);await group();
    });
    await check('query failure exposes retry and recovery retains the same task and trace history',async()=>{
      await page.locator('#gc-group-options>summary').click();
      await page.locator('[data-action="aw-fault"]').click();
      await page.waitForFunction(()=>AgentWorkspace.tasks().some(task=>task.status==='失败'));
      const failed=await page.evaluate(()=>AgentWorkspace.tasks().find(task=>task.status==='失败').legacy);
      assert.equal(await page.locator('.aw-execution').getAttribute('open'),'');
      await page.locator('[data-action="manager-retry"]').click();
      await page.waitForFunction(identifier=>ManagerHub.getEngine().find(identifier).status==='待确认',failed.id);
      const retried=await page.evaluate(identifier=>ManagerHub.getEngine().find(identifier),failed.id);
      assert.ok(retried.events.length>failed.events.length);assert.ok(retried.events.some(event=>event.type==='failure'));assert.equal(retried.id,failed.id);assert.match(await page.locator('.manager-result').innerText(),/非实时查询/);
    });
    await check('a group request prepares one task without sending or creating tickets',async()=>{
      await tab('collaboration');const before=await page.evaluate(()=>({tasks:ManagerHub.getEngine().get().tasks.length,cases:JSON.stringify(state.cases),tickets:JSON.stringify(state.tickets)}));
      await page.locator('#project-group-prompt').fill('@连小山 处理 CS-0108，准备报修资料和回复，先不要发送。');await page.locator('[data-action="project-send"]').click();
      taskId=await page.evaluate(()=>ManagerHub.getEngine().get().tasks[0].id);await page.waitForFunction(identifier=>ManagerHub.getEngine().find(identifier).status==='待确认',taskId);
      assert.equal(await page.evaluate(()=>ManagerHub.getEngine().get().tasks.length),before.tasks+1);assert.equal(await page.evaluate(()=>JSON.stringify(state.cases)),before.cases);assert.equal(await page.evaluate(()=>JSON.stringify(state.tickets)),before.tickets);
      await tab('tasks');await page.locator('[data-action="aw-task"][data-id="legacy:'+taskId+'"]').click();assert.equal(await page.locator('[data-action="manager-reply"]').isEnabled(),true);assert.equal(await page.locator('[data-action="manager-draft"]').isEnabled(),true);
    });
    await check('result approval requires notes and consent and never resolves the customer case',async()=>{
      await page.locator('.manager-review>summary').click();await page.locator('[data-action="manager-approve"]').click();assert.equal(await page.evaluate(identifier=>ManagerHub.getEngine().find(identifier).status,taskId),'待确认');
      await page.locator('#manager-note-'+taskId).fill('已核对资料与依据，草稿仍需坐席发送前确认。');await page.locator('#manager-confirm-'+taskId).check();await page.locator('[data-action="manager-approve"]').click();
      assert.equal(await page.evaluate(identifier=>ManagerHub.getEngine().find(identifier).status,taskId),'已完成');assert.notEqual(await page.evaluate(()=>state.cases.find(item=>item.id==='CS-0108').status),'已解决');assert.match(await page.locator('.aw-result-intro').innerText(),/非业务解决/);
    });
    await check('task facts are scoped, and reply and ticket draft stay human-confirmed',async()=>{
      await page.locator('[data-action="aw-facts"]').click();assert.match(await page.locator('[role="dialog"]').innerText(),/CS-0108/);assert.doesNotMatch(await page.locator('[role="dialog"]').innerText(),/CS-0106/);await page.locator('[data-action="close-dialog"]').first().click();
      await page.locator('[data-action="manager-reply"]').click();assert.equal(new URL(page.url()).hash,'#workspace');assert.ok((await page.locator('#reply-input').inputValue()).length);assert.equal(await page.evaluate(()=>view.caseId),'CS-0108');
      await group();await tab('tasks');await page.locator('[data-action="aw-task"][data-id="legacy:'+taskId+'"]').click();const tickets=await page.evaluate(()=>state.tickets.length);await page.locator('[data-action="manager-draft"]').click();assert.equal(await page.locator('[role="dialog"]').count(),1);assert.equal(await page.evaluate(()=>state.tickets.length),tickets);await page.locator('[data-action="close-dialog"]').first().click();
    });
    await check('shared definitions and launch checks distinguish reuse from production permissions',async()=>{
      await tab('shared');assert.match(await page.locator('.aw-shared').innerText(),/业务本体[\s\S]*业务流程[\s\S]*业务实例图谱/);await page.locator('[data-action="aw-readiness"]').click();assert.match(await page.locator('[role="dialog"]').innerText(),/上线前必须完成/);assert.equal(await page.locator('[role="dialog"] input[type="checkbox"]').count(),0);await page.locator('[data-action="close-dialog"]').first().click();
    });
    await check('client knowledge is not a solved case until customer confirmation',async()=>{
      await client();await page.locator('[data-action="journey-mode"][data-value="rules"]').click();await page.locator('[data-action="journey-start"][data-value="version"]').click();assert.equal(await page.evaluate(()=>ServiceJourney.sessions().at(-1).resolved),false);await page.locator('[data-action="journey-resolve"]').click();assert.equal(await page.evaluate(()=>ServiceJourney.sessions().at(-1).resolved),true);await tab('outcomes');assert.match(await page.locator('.aw-measures').innerText(),/1 \/ 1/);
    });
    await check('client handoff retains supplied facts and the workspace reopens its matching customer preview',async()=>{
      await client();await page.locator('[data-action="journey-start"][data-value="repair"]').click();assert.equal(await page.evaluate(()=>ServiceJourney.sessions().at(-1).status),'collecting');
      await page.locator('#journey-message').fill('A1 软件版本 V2.3.1，重启后仍未恢复。');await page.locator('#journey-message-form button').click();const before=await page.evaluate(()=>state.cases.length);await page.locator('[data-action="journey-handoff"]').click();assert.equal(await page.evaluate(()=>state.cases.length),before+1);
      handoffCase=await page.evaluate(()=>ServiceJourney.sessions().at(-1).caseId);await page.locator('[data-action="journey-open"]').first().click();assert.equal(await page.evaluate(()=>view.caseId),handoffCase);await page.locator('.journey-handoff-banner summary').click();assert.match(await page.locator('.journey-handoff-banner').innerText(),/V2.3.1[\s\S]*重启/);
      await page.locator('[data-action="customer-preview"]').click();assert.equal(new URL(page.url()).hash,'#customer');assert.equal(await page.evaluate(()=>ServiceJourney.sessions().find(session=>session.id===state.serviceJourney.activeId).caseId),handoffCase);await page.locator('[data-action="journey-open"]').first().click();assert.equal(await page.evaluate(()=>state.cases.length),before+1);
    });
    await check('task search has a recoverable empty state and retains keyboard focus',async()=>{
      await group();await tab('tasks');await page.locator('#aw-search').fill('不存在的任务');assert.match(await page.locator('.aw-task-list').innerText(),/没有符合条件/);assert.equal(await page.locator('#aw-search').evaluate(element=>document.activeElement===element),true);await page.locator('#aw-search').fill('');assert.ok(await page.locator('.aw-task-list .aw-task-link').count());
    });
    for(const width of [390,768,1440])await check('collaboration, results, shared info, outcomes and client preview fit '+width,async()=>{
      await page.setViewportSize({width,height:1000});for(const section of ['collaboration','tasks','shared','outcomes','experience']){if(section==='experience')await client();else await tab(section);assert.ok(await page.locator('main').evaluate(element=>parseFloat(getComputedStyle(element).paddingLeft)>=12));const size=await page.evaluate(()=>({body:document.body.scrollWidth,width:innerWidth,main:document.querySelector('main').scrollWidth,mainWidth:document.querySelector('main').clientWidth}));assert.ok(size.body<=size.width+1,JSON.stringify({section,...size}));assert.ok(size.main<=size.mainWidth+1,JSON.stringify({section,...size}));}
    });
    for(const [width,height] of [[1440,900],[1024,720],[768,720],[390,720],[320,640]])await check('group input remains visible and members stay reachable at '+width+' × '+height,async()=>{
      await page.setViewportSize({width,height});await group();await tab('collaboration');
      const dimensions=await page.locator('.aw-chat').evaluate(element=>{const composer=element.querySelector('.aw-composer').getBoundingClientRect();const stream=element.querySelector('.aw-stream').getBoundingClientRect();return {bottom:composer.bottom,top:composer.top,stream:stream.height,height:innerHeight,overflow:document.body.scrollWidth-innerWidth};});
      assert.ok(dimensions.bottom<=dimensions.height&&dimensions.top>=0,JSON.stringify(dimensions));assert.ok(dimensions.stream>=80,JSON.stringify(dimensions));assert.ok(dimensions.overflow<=1);
      await page.locator('.gc-members-button').click();assert.equal(await page.locator('.gc-member').count(),await page.evaluate(()=>ProjectStudio.members().length));await page.locator('[data-action="gc-close"]').click();await page.locator('#project-group-prompt').fill('保留输入');await page.locator('#project-group-prompt').press('Shift+Enter');assert.match(await page.locator('#project-group-prompt').inputValue(),/保留输入/);await page.locator('#project-group-prompt').fill('');
    });
    await check('another project has no aftersales tasks or client sessions and provides its own composer',async()=>{
      await page.setViewportSize({width:1440,height:1000});await page.goto(baseURL+'?project=RETAIL#group');assert.equal(await page.locator('#studio-prompt').count(),1);assert.equal(await page.evaluate(()=>AgentWorkspace.tasks().length),0);assert.equal(await page.evaluate(()=>ServiceJourney.sessions().length),0);assert.equal(await page.locator('[data-value="experience"]').count(),0);
      const payload='请整理 <img src=x onerror=alert(1)> 商品介绍';await page.locator('#studio-prompt').fill(payload);await page.locator('#studio-chat-form button[type="submit"]').click();assert.match(await page.locator('#studio-chat-stream').innerText(),/onerror/);assert.equal(await page.locator('#studio-chat-stream img').count(),0);
      await tab('outcomes');await page.goto(baseURL+'?project=AFTERSALES#group');assert.equal(await page.evaluate(()=>ServiceJourney.sessions().length),2);assert.ok(await page.evaluate(identifier=>AgentWorkspace.tasks().some(task=>task.id===identifier),taskId));
    });
    await check('two assistant drafts reuse a definition and expose only their related regression sets after a rule changes',async()=>{
      await page.goto(baseURL+'?project=AFTERSALES#orbit');
      const library=async()=>{if(new URL(page.url()).hash==='#ontology')await sidebar('orbit');else await page.locator('[data-action="studio-tab"][data-value="workbench"]').first().click();await page.locator('.ow-navigation [data-value="library"]').click();};
      for(const name of ['报修资料助手','报修核对助手']){await library();await page.locator('[data-action="ow-reuse"][data-id="draft"]').click();await page.locator('#studio-scene-form [name="name"]').fill(name);await page.locator('#studio-scene-form button[type="submit"]').click();await page.locator('[data-action="studio-tab"][data-value="tests"]').click();await page.locator('[data-action="studio-sample-template"]').click();}
      const frozen=await page.evaluate(()=>JSON.stringify(ProjectStudio.data().scenes));await library();await page.locator('#ow-search').fill('先核实保修');assert.match(await page.locator('.ow-definition').innerText(),/2 处引用/);await page.locator('[data-action="ow-definition"]').click();await page.locator('.ontology-editor>summary').first().click();await page.locator('#ontology-node-form [name="fields"]').fill('购买日期,设备编号,检修记录');await page.locator('#ontology-node-form button').click();
      await sidebar('orbit');await page.locator('.ow-navigation [data-value="changes"]').click();assert.equal(await page.locator('.ow-change-samples').count(),2);for(const review of await page.locator('.ow-change-samples').all()){assert.match(await review.innerText(),/3 个案例待复核/);await review.locator('summary').click();assert.equal(await review.locator('li').count(),3);}assert.equal(await page.evaluate(()=>JSON.stringify(ProjectStudio.data().scenes)),frozen);
    });
    await check('relationship exploration centers the selected element and remains readable on small screens',async()=>{
      await page.locator('[data-action="studio-tab"][data-value="ontology"]').first().click();await page.locator('[data-node="draft"]').click();const definition=await page.evaluate(()=>JSON.stringify(OrbitOntology.data()));const before=await page.evaluate(()=>OrbitOntology.positions());await page.locator('[data-action="ontology-mode"][data-value="star"]').click();await page.waitForTimeout(650);
      assert.equal(await page.evaluate(()=>OrbitOntology.view().local),true);assert.equal(await page.locator('.ontology-node:visible').count(),4);assert.notDeepEqual(await page.evaluate(()=>OrbitOntology.positions().draft),before.draft);
      await page.locator('[data-node="verify"]').click();await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>OrbitOntology.view().selected),'verify');await page.setViewportSize({width:390,height:1100});await page.waitForTimeout(650);assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1));assert.match(await page.locator('#ontology-scope-note').innerText(),/窄屏分层/);assert.equal(await page.evaluate(()=>JSON.stringify(OrbitOntology.data())),definition);
    });
    await check('unique local matches dispatch once, while ambiguous or unauthorized matches never execute',async()=>{
      await page.setViewportSize({width:1440,height:1000});await page.goto(baseURL+'?project=RETAIL#group');
      await page.evaluate(()=>{const storage=ProjectStudio.data();const agent={id:'TEST-PRODUCT',name:'商品信息助手',role:'整理示例商品资料',enabled:true,activeVersion:'V1',traces:[],releases:[{version:'V1',config:{keywords:'商品介绍',fields:'商品名称',transferWords:'',handoff:'交回人工',tool:'summary'}}]};agent.releases[0].projectId="RETAIL";agent.releases[0].runner=AgentHarness.version;agent.releases[0].contract=AgentHarness.compile(agent.releases[0].config,"RETAIL");storage.agents.push(agent);storage.profile.allowed.push(agent.id);});
      await page.locator('#studio-prompt').fill('商品介绍 商品名称：示例商品');await page.locator('#studio-chat-form button[type="submit"]').click();assert.equal(await page.evaluate(()=>ProjectStudio.data().tasks.length),1);
      await page.evaluate(()=>{const storage=ProjectStudio.data();const agent=structuredClone(storage.agents[0]);agent.id='TEST-SECOND';agent.name='商品核对助手';agent.traces=[];storage.agents.push(agent);storage.profile.allowed.push(agent.id);});
      await page.locator('#studio-prompt').fill('商品介绍 商品名称：示例商品');await page.locator('#studio-chat-form button[type="submit"]').click();assert.equal(await page.evaluate(()=>ProjectStudio.data().tasks.length),1);assert.match(await page.locator('#toast-root').innerText(),/多位助手符合/);
      await page.evaluate(()=>{ProjectStudio.data().profile.allowed=[];});await page.locator('#studio-prompt').fill('@商品信息助手 商品介绍 商品名称：示例商品');await page.locator('#studio-chat-form button[type="submit"]').click();assert.equal(await page.evaluate(()=>ProjectStudio.data().tasks.length),1);
    });
    assert.deepEqual(errors,[]);return {passed:results.length,results};
  }finally{await context.close();}
};
