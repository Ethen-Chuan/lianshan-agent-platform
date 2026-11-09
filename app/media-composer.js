window.HubMedia=(()=>{
  let host;
  let recognition;
  let voice=null;
  let voiceTimer;
  const drafts=new Map();
  const files=new Map();
  const busy=new Set();
  const accept='image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,audio/webm';
  const escape=value=>host.escape(value);
  const button=(label,action,scope='',extra='')=>host.button(label,'media-'+action,'quiet small',`data-scope="${escape(scope)}" ${extra}`);
  const list=scope=>(drafts.get(scope)||[]).map(identifier=>files.get(identifier)).filter(Boolean);
  const size=value=>value<1048576?Math.ceil(value/1024)+' KB':(value/1048576).toFixed(1)+' MB';
  const currentScope=()=>document.querySelector('[data-media-scope]')?.dataset.mediaScope;
  function tools(scope){return `<div class="media-tools">${button(host.icon('paperclip','small')+'<span>附件</span>','choose',scope,'aria-label="添加图片、视频或音频" title="选择图片、视频或音频；仅本地预览，不上传服务器"')}${button('<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg><span>语音输入</span>','voice',scope,'aria-label="语音转文字，确认后才使用麦克风" title="语音转文字；需浏览器支持和单次授权，转写后先核对"')}<input class="sr-only media-file-input" type="file" accept="${accept}" multiple tabindex="-1" aria-label="选择本地附件" data-scope="${escape(scope)}"></div>`;}
  function player(file,compact=false){
    if(file.kind==='image')return `<img src="${file.url}" alt="本地图片预览" class="media-image" loading="lazy">`;
    if(compact)return `<span class="media-kind">${file.kind==='video'?'视频':'音频'}</span>`;
    return file.kind==='video'?`<video src="${file.url}" controls preload="metadata" playsinline aria-label="本地视频预览"></video>`:`<audio src="${file.url}" controls preload="metadata" aria-label="本地音频预览"></audio>`;
  }
  function tray(scope){
    const items=list(scope);
    return `<section class="media-drafts" aria-label="待发送附件" ${items.length||busy.has(scope)||voice?.scope===scope?'':'hidden'}>${items.length?`<div class="media-safety-note">仅在当前浏览器预览 · 未进行内容脱敏扫描。请检查画面、声音、文件名及元数据；敏感内容先处理后再加入对话。</div><div class="media-draft-list">${items.map(file=>`<article class="media-draft">${player(file,true)}<div><strong>${escape(file.name)}</strong><small>${size(file.size)} · 本地待确认</small><label><input type="checkbox" data-media-approve="${file.id}" ${file.approved?'checked':''}>已检查并去除敏感信息</label></div>${button('预览','preview',scope,`data-id="${file.id}"`)}${button(host.icon('x','small'),'remove',scope,`data-id="${file.id}" aria-label="移除此附件" title="移除附件；不删除设备上的原文件"`)}</article>`).join('')}</div>`:''}${busy.has(scope)?'<p class="media-progress" role="status">正在检查格式与可预览性…</p>':''}${voice?.scope===scope&&voice.listening?`<div class="media-recording" role="status"><i></i><strong>正在听写</strong><span>停止后核对，不会自动发送</span>${button('停止并核对','stop',scope)}${button('取消','cancel',scope)}</div>`:''}</section>`;
  }
  function messages(identifiers){return !identifiers?.length?'':`<div class="media-message-list">${identifiers.map(identifier=>{const file=files.get(identifier);return file?`<article class="media-message">${player(file)}<footer><span>${escape(file.name)} · ${size(file.size)}</span><small>本地附件 · 未进行内容解析</small></footer></article>`:'<div class="media-expired">本地附件已释放。刷新后不保留文件，请重新添加。</div>';}).join('')}</div>`;}
  async function identify(file){
    const bytes=new Uint8Array(await file.slice(0,64).arrayBuffer());
    const ascii=new TextDecoder('latin1').decode(bytes);
    if(bytes[0]===137&&ascii.slice(1,4)==='PNG')return 'image';
    if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image';
    if(ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a')||ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')return 'image';
    if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WAVE'||ascii.startsWith('ID3')||bytes[0]===255&&(bytes[1]&224)===224||ascii.startsWith('OggS'))return 'audio';
    if(ascii.slice(4,8)==='ftyp')return file.type.startsWith('audio/')||/\.(m4a)$/i.test(file.name)?'audio':'video';
    if(bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163)return file.type.startsWith('audio/')?'audio':'video';
    throw new Error('不支持此格式或文件头不完整。请使用 PNG、JPG、WebP、GIF、MP4、WebM、MOV、MP3、WAV、M4A 或 OGG。');
  }
  async function decodable(file){
    const element=document.createElement(file.kind==='image'?'img':file.kind);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>finish(false),7000);
      const finish=valid=>{clearTimeout(timer);element.onload=null;element.onerror=null;element.onloadedmetadata=null;element.removeAttribute('src');if(element.load)element.load();valid?resolve():reject(new Error('文件无法预览，可能已损坏或编码不受支持。请转换格式后重试。'));};
      element.onload=()=>finish(element.naturalWidth>0&&element.naturalWidth*element.naturalHeight<=40000000);
      element.onloadedmetadata=()=>finish(Number.isFinite(element.duration)&&element.duration>0);
      element.onerror=()=>finish(false);element.preload='metadata';element.src=file.url;
    });
  }
  async function add(scope,selected){
    if(!scope||busy.has(scope))return host.toast('请等待当前附件检查完成。',true);
    busy.add(scope);host.render();
    const errors=[];
    try{
      for(const file of Array.from(selected)){
        if(list(scope).length>=6){errors.push('每条消息最多添加 6 个附件。');break;}
        if(!file.size||file.size>50*1048576){errors.push('空文件或超过 50 MB，未添加。');continue;}
        if(host.isSensitive(file.name)){errors.push('文件名可能包含敏感信息，请先重命名。');continue;}
        if([...files.values()].reduce((total,item)=>total+item.size,0)+file.size>120*1048576){errors.push('本地附件合计上限 120 MB，请移除草稿附件或刷新释放。');break;}
        let url;
        try{
          const kind=await identify(file);
          if(kind==='image'&&file.size>10*1048576)throw new Error('单张图片上限 10 MB，请压缩后再添加。');
          url=URL.createObjectURL(file);const item={id:'media-'+crypto.randomUUID(),name:file.name||'粘贴的截图.png',size:file.size,kind,url,approved:false};
          await decodable(item);files.set(item.id,item);drafts.set(scope,[...(drafts.get(scope)||[]),item.id]);
        }catch(error){if(url)URL.revokeObjectURL(url);errors.push(error.message);}
      }
    }finally{busy.delete(scope);host.render();}
    if(errors.length)host.toast([...new Set(errors)].join(' '),true);
  }
  function commit(scope){
    if(busy.has(scope))throw new Error('附件还在检查，请稍候。');
    if(list(scope).some(file=>!file.approved))throw new Error('请先预览附件并逐项确认已去除敏感信息。');
    const identifiers=drafts.get(scope)||[];drafts.delete(scope);return identifiers;
  }
  function preview(identifier){const file=files.get(identifier);if(!file)return;host.showDialog('附件预览','仅本地浏览，不上传、不自动识别内容。',`<div class="media-preview">${player(file)}<p>${escape(file.name)} · ${size(file.size)}</p><p>请检查画面、声音、文件名和元数据中的客户信息。这里只验证格式，不能代替内容脱敏检查。</p></div>`,button('返回编辑','close'));}
  function voiceDialog(scope){
    if(window.LIANSHAN_PUBLIC_DEMO){host.showDialog('在线演示不启用语音识别','不会请求麦克风，也不会发送音频。','<p>你仍可输入文字，或使用已脱敏的演示附件进行本地预览。真实转写服务将在后续单独接入与验收。</p>',button('知道了','close'));return;}
    if(voice?.listening)return host.toast('正在听写，请先停止或取消。',true);
    const supported=!!(window.SpeechRecognition||window.webkitSpeechRecognition)&&window.isSecureContext&&location.protocol!=='file:';
    host.showDialog('语音转文字',supported?'先授权听写，结束后核对文字。':'此浏览环境暂不能使用语音识别。',`<div class="voice-consent"><p>语音识别由浏览器提供，可能将音频发送给浏览器的识别服务。这不是本平台的离线转写。</p><p>不要口述客户隐私或凭证。最多听写 60 秒；转写结果先进入核对窗口，不自动发给助手。</p>${supported?'<label class="check-label"><input id="media-voice-consent" type="checkbox">我同意本次使用麦克风及浏览器识别服务</label>':'<p class="media-warning">请在本机服务或 HTTPS 的支持浏览器中打开，并检查麦克风权限。你仍可上传音频用于预览，或直接输入文字；本版未配置服务端转写。</p>'}<p id="media-voice-error" role="alert"></p></div>`,button('取消','close')+(supported?button('开始听写','start',scope):''));
  }
  function stopVoice(cancel=false){if(!voice)return;voice.cancelled=cancel;clearTimeout(voiceTimer);if(recognition){cancel?recognition.abort():recognition.stop();}if(cancel){voice=null;recognition=null;host.render();}}
  function voiceReview(session){
    if(session.cancelled||currentScope()!==session.scope)return;
    if(!session.text.trim()){host.toast(session.error||'没有取得转写文字。请检查权限或改用文字输入。',true);return;}
    if(host.isSensitive(session.text)){host.toast('转写文字含疑似敏感信息，已丢弃，未加入草稿。',true);return;}
    voice=session;
    host.showDialog('核对转写文字','识别可能有误，修改后再放入输入框。',`<div class="field"><label for="media-transcript">转写内容</label><textarea id="media-transcript" rows="6" maxlength="1200">${escape(session.text)}</textarea></div>${session.error?`<p class="media-warning">${escape(session.error)} 以下只保留已识别的片段。</p>`:''}<p>放入草稿不会发送消息，也不会创建任务。</p>`,button('丢弃','discard')+button('放入输入框','apply',session.scope));
  }
  function startVoice(scope){
    if(window.LIANSHAN_PUBLIC_DEMO)return host.toast('在线演示不启用麦克风或语音联网识别。',true);
    if(!document.getElementById('media-voice-consent')?.checked){document.getElementById('media-voice-error').textContent='请先确认本次授权。';return;}
    const Constructor=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Constructor||currentScope()!==scope)return;
    const session={scope,text:'',listening:true,cancelled:false,error:''};voice=session;recognition=new Constructor();recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=false;
    recognition.onresult=event=>{if(session.cancelled)return;for(let index=event.resultIndex;index<event.results.length;index++)if(event.results[index].isFinal)session.text+=event.results[index][0].transcript;};
    recognition.onerror=event=>{session.error=({'not-allowed':'麦克风或识别权限未获批准。','audio-capture':'没有可用的麦克风。',network:'识别服务连接失败。','no-speech':'没有检测到语音。','service-not-allowed':'浏览器识别服务不可用。'})[event.error]||'语音识别已中断。';};
    recognition.onend=()=>{clearTimeout(voiceTimer);session.listening=false;if(voice===session)voice=null;recognition=null;host.render();voiceReview(session);};
    host.closeDialog();
    try{recognition.start();voiceTimer=setTimeout(()=>stopVoice(),60000);host.render();}catch{voice=null;recognition=null;host.toast('未能启动语音输入，请检查浏览器权限。',true);}
  }
  function sync(){if(voice?.listening&&currentScope()!==voice.scope)stopVoice(true);}
  function configure(api){
    host=api;
    document.addEventListener('click',event=>{
      const element=event.target.closest('[data-action^="media-"]');if(!element)return;event.preventDefault();
      const action=element.dataset.action.slice(6);const scope=element.dataset.scope;const identifier=element.dataset.id;
      if(action==='choose')element.closest('form').querySelector('.media-file-input').click();
      if(action==='preview')preview(identifier);
      if(action==='remove'){const file=files.get(identifier);if(file)URL.revokeObjectURL(file.url);files.delete(identifier);drafts.set(scope,(drafts.get(scope)||[]).filter(value=>value!==identifier));host.render();}
      if(action==='voice')voiceDialog(scope);
      if(action==='start')startVoice(scope);
      if(action==='stop')stopVoice();
      if(action==='cancel')stopVoice(true);
      if(action==='close'||action==='discard'){voice=null;host.closeDialog();}
      if(action==='apply'){
        const text=document.getElementById('media-transcript')?.value.trim();
        if(!text||host.isSensitive(text))return host.toast('请填写不含敏感信息的转写文字。',true);
        if(scope!==currentScope())return host.toast('原对话已切换，未写入其他会话。',true);
        const input=document.querySelector('[data-media-scope] textarea');
        if(input.value.length+text.length>1200)return host.toast('内容超过输入框上限，请缩短文字。',true);
        input.value+=(input.value?'\n':'')+text;input.dispatchEvent(new Event('input',{bubbles:true}));voice=null;host.closeDialog();input.focus();
      }
    });
    document.addEventListener('change',event=>{if(event.target.matches('.media-file-input')){const selected=Array.from(event.target.files);event.target.value='';add(event.target.dataset.scope,selected);}if(event.target.dataset.mediaApprove){const file=files.get(event.target.dataset.mediaApprove);if(file)file.approved=event.target.checked;}});
    document.addEventListener('paste',event=>{const form=event.target.closest('[data-media-scope]');if(!form)return;const selected=Array.from(event.clipboardData?.items||[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);if(selected.length){event.preventDefault();add(form.dataset.mediaScope,selected);}});
    document.addEventListener('dragover',event=>{const form=event.target.closest('[data-media-scope]');if(form&&event.dataTransfer?.types.includes('Files')){event.preventDefault();form.classList.add('media-dragover');}});
    document.addEventListener('dragleave',event=>event.target.closest?.('[data-media-scope]')?.classList.remove('media-dragover'));
    document.addEventListener('drop',event=>{if(!event.dataTransfer?.files.length)return;event.preventDefault();const form=event.target.closest('[data-media-scope]');if(form){form.classList.remove('media-dragover');add(form.dataset.mediaScope,event.dataTransfer.files);}});
    window.addEventListener('hashchange',sync);
    window.addEventListener('pagehide',()=>{stopVoice(true);for(const file of files.values())URL.revokeObjectURL(file.url);files.clear();drafts.clear();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&voice?.listening)stopVoice(true);});
  }
  return {configure,tools,tray,messages,add,commit,has:scope=>list(scope).length>0||busy.has(scope),sync,reset(){stopVoice(true);for(const file of files.values())URL.revokeObjectURL(file.url);files.clear();drafts.clear();}};
})();
