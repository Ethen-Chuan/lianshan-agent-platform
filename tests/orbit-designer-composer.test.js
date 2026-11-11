const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/orbit-designer-fixture');

function speechFixture(window){
  const sessions=[];
  window.SpeechRecognition=class{
    constructor(){sessions.push(this);this.stopped=false;this.aborted=false;}
    start(){}
    stop(){this.stopped=true;}
    abort(){this.aborted=true;}
    result(transcript){this.onresult({results:[Object.assign([{transcript}],{isFinal:true})]});}
  };
  return sessions;
}

function inputBox(page){
  return page.slice(page.indexOf('<div class="od-input-box'),page.indexOf('<details class="od-references"'));
}

test('one composer contains the text field, microphone and only one submit action',()=>{
  const {window}=fixture();const page=window.OrbitDesigner.page();const composer=inputBox(page);
  assert.equal((page.match(/id="od-input"/g)||[]).length,1);
  assert.equal((page.match(/id="od-voice-toggle"/g)||[]).length,1);
  assert.equal((composer.match(/type="submit"/g)||[]).length,1);
  assert.match(composer,/<textarea id="od-input"/);
  assert.match(composer,/data-action="od-voice"[^>]*type="button"/);
  assert.match(composer,/aria-pressed="false"/);
  assert.match(composer,/语音输入/);
  assert.match(composer,/生成流程/);
  assert.doesNotMatch(composer,/id="od-voice-notice"/);
  assert.doesNotMatch(page.slice(page.indexOf('<details class="od-references"')),/data-action="od-voice/);
});

test('microphone opens inline consent without recording, sending or changing the business design',()=>{
  const {window,click,calls,document}=fixture();const designer=window.OrbitDesigner;const sessions=speechFixture(window);const focused=[];
  document.getElementById=id=>({focus(){focused.push(id);}});
  designer.data().input='先了解业务范围。';const original=JSON.stringify(window.OrbitFlow.data());
  click('od-voice-start');assert.equal(sessions.length,0);
  click('od-voice');assert.equal(designer.view().voiceNotice,true);assert.equal(sessions.length,0);
  assert.match(inputBox(designer.page()),/id="od-voice-notice"/);
  assert.match(inputBox(designer.page()),/浏览器可能将音频发送给语音识别服务/);
  assert.equal(focused.at(-1),'od-voice-confirm');
  click('od-voice-cancel');assert.equal(designer.view().voiceNotice,false);assert.equal(focused.at(-1),'od-voice-toggle');
  assert.equal(calls.length,0);assert.equal(designer.data().input,'先了解业务范围。');assert.equal(JSON.stringify(window.OrbitFlow.data()),original);
});

test('dictation fills the same draft and stopping returns to editable text without auto-sending',()=>{
  const context=fixture();const {window,click,calls,document,emit}=context;const designer=window.OrbitDesigner;const sessions=speechFixture(window);const focused=[];let selection;
  const input={get value(){return designer.data().input;},focus(){focused.push('od-input');},setSelectionRange(start,end){selection=[start,end];}};
  document.getElementById=id=>id==='od-input'?input:{focus(){focused.push(id);}};
  designer.data().input='报修：';click('od-voice');click('od-voice-start');
  assert.equal(sessions.length,1);assert.equal(designer.view().voiceNotice,false);assert.equal(focused.at(-1),'od-voice-toggle');
  let composer=inputBox(designer.page());assert.match(composer,/is-listening/);assert.match(composer,/aria-pressed="true"/);assert.match(composer,/正在听写/);assert.match(composer,/停止听写/);
  sessions[0].result('先收集型号。');assert.equal(designer.data().input,'报修：先收集型号。');
  click('od-voice-stop');assert.equal(sessions[0].stopped,true);assert.equal(focused.at(-1),'od-input');assert.deepEqual(selection,[input.value.length,input.value.length]);
  composer=inputBox(designer.page());assert.doesNotMatch(composer,/is-listening|停止听写/);assert.match(composer,/语音输入/);
  emit('input',{id:'od-input',value:'手动核对后的描述。',dataset:{},closest:()=>null,matches:()=>false});
  sessions[0].result('迟到的识别。');assert.equal(designer.data().input,'手动核对后的描述。');assert.equal(calls.length,0);
});

test('Escape closes the voice disclosure only inside the composer and restores microphone focus',()=>{
  const {window,click,emit,document}=fixture();let focused='';document.getElementById=id=>({focus(){focused=id;}});
  click('od-voice');emit('keydown',{closest:()=>null},{key:'Escape'});assert.equal(window.OrbitDesigner.view().voiceNotice,true);
  emit('keydown',{closest:selector=>selector==='#od-form'?{}:null},{key:'Escape'});
  assert.equal(window.OrbitDesigner.view().voiceNotice,false);assert.equal(focused,'od-voice-toggle');
  click('od-voice');click('od-voice');assert.equal(window.OrbitDesigner.view().voiceNotice,false);
});

test('unsupported speech falls back to the existing text field without leaving a second input panel',()=>{
  const {window,click,document,calls}=fixture();const designer=window.OrbitDesigner;let focused='';document.getElementById=id=>({focus(){focused=id;}});
  designer.data().input='保留我的业务描述。';designer.view().errorMode='simulate';click('od-voice');click('od-voice-start');
  assert.equal(designer.view().voiceNotice,false);assert.equal(focused,'od-input');assert.match(designer.page(),/此浏览器不支持语音转文字/);
  assert.equal(designer.data().input,'保留我的业务描述。');assert.doesNotMatch(designer.page(),/id="od-voice-notice"/);assert.equal(calls.length,0);
});

test('static demo keeps the unified microphone disabled and does not begin audio capture',()=>{
  const {window,click,calls}=fixture({publicMode:true});const sessions=speechFixture(window);
  assert.match(inputBox(window.OrbitDesigner.page()),/data-action="od-voice"[^>]*disabled/);
  click('od-voice');click('od-voice-start');assert.equal(window.OrbitDesigner.view().voiceNotice,false);assert.equal(sessions.length,0);assert.equal(calls.length,0);
});

test('the merged entry preserves escaped drafts and separate explicit model authorization',async()=>{
  const {window,click,change,calls}=fixture();const designer=window.OrbitDesigner;const sessions=speechFixture(window);
  await designer.refresh();designer.data().input='规则 <待核对>：';click('od-voice');click('od-voice-start');sessions[0].result('先确认资料。');click('od-voice-stop');
  assert.match(inputBox(designer.page()),/规则 &lt;待核对&gt;：先确认资料。/);
  assert.match(inputBox(designer.page()),/type="submit" disabled/);
  await designer.send();assert.equal(calls.filter(call=>call.url.endsWith('/generate')).length,0);
  change('od-consent',true);assert.doesNotMatch(inputBox(designer.page()),/type="submit" disabled/);
  await designer.send();const generated=calls.filter(call=>call.url.endsWith('/generate'));assert.equal(generated.length,1);
  assert.equal(JSON.parse(generated[0].options.body).prompt,'规则 <待核对>：先确认资料。');
});
