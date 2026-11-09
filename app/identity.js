window.HubIdentity = (() => {
  const palettes = {
    clay:{paper:'#f3e9e1',edge:'#e2cfc1',light:'#e6b6a1',main:'#b9664d',ink:'#783e32'},
    blue:{paper:'#e8eef6',edge:'#ccd8e8',light:'#adc4e1',main:'#6488b6',ink:'#3c557b'},
    amber:{paper:'#f4eddd',edge:'#e5d6b5',light:'#e5c579',main:'#b58a3e',ink:'#78592b'},
    teal:{paper:'#e5efeb',edge:'#c8ddd4',light:'#9fcbb8',main:'#568e7a',ink:'#315e50'},
    plum:{paper:'#f0e8ed',edge:'#dfcdd8',light:'#d0acc4',main:'#a47697',ink:'#6f4d68'},
    slate:{paper:'#eceeec',edge:'#d5dbd7',light:'#becac3',main:'#82978b',ink:'#495e52'}
  };
  const types = {store:'服务门店',technician:'技术人员',customer:'客户 · 类型未标注',staff:'人工客服',archive:'只读历史资料'};
  const workers = {
    manager:{label:'项目助手 · AI',tone:'clay',art:'manager'},
    service:{label:'售后接待助手 · AI',tone:'teal',art:'service'},
    knowledge:{label:'知识查找 · AI',tone:'amber',art:'knowledge'},
    ticket:{label:'工单填写助手 · AI',tone:'blue',art:'ticket'},
    quality:{label:'对话质检助手 · AI',tone:'plum',art:'quality'},
    analytics:{label:'大盘助手 · 本地分析',tone:'amber',art:'analytics'},
    expert:{label:'外部专家 · 模拟端点',tone:'slate',art:'expert'}
  };
  const channels = {wechat:'微信客服',ding:'钉钉',feishu:'飞书',archive:'历史存档'};
  const escape = value => String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const owns = (record,key) => Object.prototype.hasOwnProperty.call(record,key);
  const toneFor = value => owns(palettes,value)?value:'slate';
  const sizeFor = value => ['xs','sm','md','lg','xl'].includes(value)?value:'md';
  const hash = value => Array.from(String(value??'')).reduce((total,character)=>(total*31+character.codePointAt(0))>>>0,0);

  function describe(item={}) {
    const type=owns(types,item.entityType)?item.entityType:item.owner==='readonly'?'archive':'customer';
    const tone=owns(palettes,item.identityTone)?item.identityTone:type==='archive'?'slate':Object.keys(palettes)[hash(item.id||item.organization||item.name)%5];
    const variant=Number.isInteger(item.identityVariant)&&item.identityVariant>=0&&item.identityVariant<3?item.identityVariant:hash(item.organization||item.id)%3;
    return {type,tone,variant,label:types[type]};
  }

  function frame(palette,content,round=false) {
    return `<svg class="identity-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false"><rect x="1" y="1" width="62" height="62" rx="${round?31:17}" fill="${palette.paper}" stroke="${palette.edge}"/><circle cx="46" cy="18" r="10" fill="${palette.light}" opacity=".22"/>${content}</svg>`;
  }

  function store(palette,variant) {
    const storefront=variant===1
      ? `<path d="M11.0 26.0h42.0l-4.0-10.0H15.0z" fill="${palette.main}"/><path d="M14.0 26.0v5.0c0.0 3.0 6.0 3.0 6.0 0.0 0.0 3.0 6.0 3.0 6.0 0.0 0.0 3.0 6.0 3.0 6.0 0.0 0.0 3.0 6.0 3.0 6.0 0.0 0.0 3.0 6.0 3.0 6.0 0.0 0.0 3.0 6.0 3.0 6.0 0.0v-5.0" fill="${palette.light}"/><path fill="none" d="m21.0 16.0-2.0 10.0m11.0-10.0v10.0m11.0-10.0 2.0 10.0" stroke="#fffaf4" stroke-width="5"/><path fill="none" d="M11.0 26.0h42.0" stroke="${palette.ink}" stroke-width="1.5"/>`
      : variant===2
        ? `<path d="m12.0 24.0 20.0-12.0 20.0 12.0" fill="${palette.main}" stroke="${palette.ink}" stroke-width="1.5" stroke-linejoin="round"/><rect x="13" y="24" width="38" height="8" rx="2" fill="${palette.main}"/><path fill="none" d="M22.0 28.0h20.0" stroke="#fffaf4" stroke-width="2" stroke-linecap="round"/>`
        : `<rect x="15" y="14" width="34" height="10" rx="3" fill="${palette.ink}"/><path fill="none" d="M25.0 19.0h14.0" stroke="#fffaf4" stroke-width="2" stroke-linecap="round"/><path d="M15.0 24.0h34.0l4.0 9.0H11.0z" fill="${palette.main}"/><path fill="none" d="m22.0 24.0-1.0 9.0m11.0-9.0v9.0m10.0-9.0 1.0 9.0" stroke="#fffaf4" stroke-width="5"/><path fill="none" d="M11.0 33.0h42.0" stroke="${palette.ink}" stroke-width="1.5"/>`;
    return frame(palette,`<ellipse cx="32" cy="54" rx="23" ry="3" fill="${palette.ink}" opacity=".09"/><rect x="15" y="24" width="34" height="29" rx="2" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.5"/>${storefront}<rect x="20" y="37" width="12" height="10" rx="1.5" fill="${palette.light}"/><path fill="none" d="M26.0 38.0v8.0" stroke="#fffcf6" stroke-width="1.5"/><path fill="none" d="m21.0 43.0 7.0-5.0" stroke="#fffcf6" stroke-width="1.5" opacity=".8"/><path d="M37.0 53.0V37.0h8.0v16.0" fill="${palette.main}"/><circle cx="42" cy="45" r="1" fill="#fffcf6"/><path fill="none" d="M13.0 53.0h38.0" stroke="${palette.ink}" stroke-width="2" stroke-linecap="round"/>`);
  }

  function person(palette,type) {
    const technician=type==='technician';
    const staff=type==='staff';
    const hair=technician?'<path d="M20.0 25.0c0.0-11.0 22.0-14.0 24.0 0.0l-4.0 4.0-2.0-8.0-14.0 7.0z" fill="#414745"/>':'<path d="M19.0 30.0c-3.0-19.0 26.0-20.0 26.0-2.0l-4.0 7.0-2.0-12.0c-4.0 5.0-10.0 6.0-17.0 5.0l1.0 7.0z" fill="#514238"/>';
    return frame(palette,`<path d="M12.0 54.0c0.0-10.0 9.0-16.0 20.0-16.0s20.0 6.0 20.0 16.0" fill="${palette.main}"/><path d="m26.0 38.0 6.0 9.0 6.0-9.0" fill="#fffbf3"/><path d="M27.0 34.0h10.0v8.0c-2.0 4.0-8.0 4.0-10.0 0.0z" fill="#dba981"/>${hair}<ellipse cx="32" cy="29" rx="10" ry="12" fill="#edc6a1"/><path d="M22.0 25.0c3.0-1.0 8.0-3.0 11.0-7.0 3.0 4.0 6.0 5.0 10.0 5.0-3.0-10.0-17.0-12.0-21.0 2.0" fill="${technician?'#414745':'#514238'}"/><path fill="none" d="M27.0 30.0h1.0m8.0 0.0h1.0" stroke="#514238" stroke-width="2" stroke-linecap="round"/><path fill="none" d="M29.0 35.0q3.0 2.0 6.0 0.0" stroke="#a66e54" stroke-width="1.5" stroke-linecap="round"/>${technician?`<rect x="22" y="26" width="9" height="7" rx="2" stroke="${palette.ink}" stroke-width="1.8"/><rect x="33" y="26" width="9" height="7" rx="2" stroke="${palette.ink}" stroke-width="1.8"/><path fill="none" d="M31.0 28.0h2.0" stroke="${palette.ink}" stroke-width="1.8"/><path fill="none" d="m42.0 44.0-5.0 8.0m3.0-9.0 4.0 3.0" stroke="#fffcf6" stroke-width="2.5" stroke-linecap="round"/>`:''}${staff?`<path fill="none" d="M18.0 30.0v-4.0c0.0-18.0 28.0-18.0 28.0 0.0v7.0c0.0 6.0-4.0 8.0-10.0 8.0" stroke="${palette.ink}" stroke-width="2.5" stroke-linecap="round"/><rect x="16" y="27" width="6" height="10" rx="3" fill="${palette.ink}"/><rect x="42" y="27" width="6" height="10" rx="3" fill="${palette.ink}"/><rect x="32" y="39" width="6" height="4" rx="2" fill="${palette.ink}"/>`:''}<path fill="none" d="M12.0 54.0h40.0" stroke="${palette.ink}" stroke-width="1.5" stroke-linecap="round"/>`,true);
  }

  function symbol(palette,kind) {
    const glyphs={
      manager:`<rect x="13" y="26" width="7" height="14" rx="3.5"/><rect x="23" y="17" width="7" height="31" rx="3.5"/><rect x="33" y="22" width="7" height="21" rx="3.5"/><rect x="43" y="29" width="7" height="14" rx="3.5"/>`,
      service:`<path d="M15.0 20.0h34.0v23.0H29.0l-10.0 7.0v-7.0h-4.0z" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.8" stroke-linejoin="round"/><rect x="21" y="27" width="4" height="8" rx="2"/><rect x="30" y="24" width="4" height="14" rx="2"/><rect x="39" y="28" width="4" height="6" rx="2"/>`,
      analytics:`<path d="M14 47V18a4 4 0 0 1 4-4h29" fill="none" stroke="${palette.ink}" stroke-width="2" stroke-linecap="round"/><rect x="21" y="34" width="7" height="14" rx="2" fill="${palette.main}"/><rect x="32" y="25" width="7" height="23" rx="2" fill="${palette.ink}"/><rect x="43" y="19" width="7" height="29" rx="2" fill="${palette.light}"/><path d="M14 51h38" stroke="${palette.ink}" stroke-width="2" stroke-linecap="round"/>`,
      ticket:`<rect x="18" y="15" width="29" height="38" rx="4" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.8"/><rect x="25" y="11" width="15" height="8" rx="3"/><path fill="none" d="m24.0 29.0 2.0 2.0 4.0-4.0m-6.0 13.0 2.0 2.0 4.0-4.0m4.0-10.0h7.0m-7.0 11.0h7.0" stroke="${palette.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      quality:`<path d="m32.0 12.0 18.0 7.0v13.0c0.0 10.0-9.0 17.0-18.0 21.0-9.0-4.0-18.0-11.0-18.0-21.0V19.0z" fill="${palette.light}" stroke="${palette.ink}" stroke-width="1.8"/><path fill="none" d="m23.0 32.0 6.0 6.0 12.0-13.0" stroke="${palette.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
      knowledge:`<path d="M13.0 17.0h12.0c4.0 0.0 7.0 2.0 7.0 5.0 0.0-3.0 3.0-5.0 7.0-5.0h12.0v31.0H39.0c-4.0 0.0-7.0 2.0-7.0 4.0 0.0-2.0-3.0-4.0-7.0-4.0H13.0z" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.8" stroke-linejoin="round"/><path fill="none" d="M32.0 22.0v30.0M19.0 25.0h7.0m-7.0 7.0h7.0m12.0-7.0h7.0m-7.0 7.0h7.0" stroke="${palette.main}" stroke-width="2" stroke-linecap="round"/><path d="M41.0 17.0h5.0v11.0l-2.5-2.0-2.5 2.0z"/>`,
      expert:`<path d="m32.0 12.0 17.0 10.0v20.0L32.0 52.0 15.0 42.0V22.0z" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.8"/><path d="m25.0 24.0 7.0-4.0 7.0 4.0v8.0l-7.0 4.0-7.0-4.0z"/><path fill="none" d="m22.0 42.0 10.0-6.0 10.0 6.0" stroke="${palette.ink}" stroke-width="2" stroke-linejoin="round"/>`,
      archive:`<path d="M17.0 19.0h13.0l4.0 5.0h16.0v29.0H15.0V23.0z" fill="${palette.light}"/><rect x="20" y="13" width="25" height="32" rx="3" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.8"/><path fill="none" d="M26.0 21.0h13.0m-13.0 6.0h9.0" stroke="${palette.main}" stroke-width="2" stroke-linecap="round"/><rect x="13" y="32" width="39" height="21" rx="4" fill="${palette.main}" stroke="${palette.ink}" stroke-width="1.5"/><path fill="none" d="M27.0 40.0h11.0" stroke="#fffcf6" stroke-width="2" stroke-linecap="round"/>`,
      fault:`<rect x="13" y="16" width="36" height="28" rx="4" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.8"/><path fill="none" d="M20.0 49.0h22.0m-16.0-5.0v5.0m10.0-5.0v5.0" stroke="${palette.ink}" stroke-width="2" stroke-linecap="round"/><path fill="none" d="m24.0 27.0 4.0 4.0 8.0-8.0" stroke="${palette.main}" stroke-width="3" stroke-linecap="round"/><circle cx="47" cy="43" r="10" fill="${palette.main}"/><path fill="none" d="M47.0 38.0v6.0m0.0 3.0v.5.0" stroke="#fffcf6" stroke-width="2" stroke-linecap="round"/>`,
      software:`<rect x="13" y="15" width="38" height="35" rx="4" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.8"/><path fill="none" d="M13.0 25.0h38.0" stroke="${palette.ink}" stroke-width="1.5"/><circle cx="20" cy="20" r="1.5"/><circle cx="26" cy="20" r="1.5"/><path fill="none" d="m26.0 32.0-5.0 5.0 5.0 5.0m12.0-10.0 5.0 5.0-5.0 5.0m-4.0-12.0-4.0 14.0" stroke="${palette.main}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      document:`<path d="M20.0 12.0h18.0l10.0 10.0v30.0H20.0z" fill="#fffcf6" stroke="${palette.ink}" stroke-width="1.8" stroke-linejoin="round"/><path fill="none" d="M38.0 12.0v10.0h10.0M27.0 31.0h14.0m-14.0 7.0h14.0m-14.0 7.0h8.0" stroke="${palette.main}" stroke-width="2" stroke-linecap="round"/>`
    };
    return frame(palette,`<g fill="${palette.main}">${owns(glyphs,kind)?glyphs[kind]:glyphs.document}</g>`);
  }

  function channelBadge(channel) {
    if(!owns(channels,channel))return '';
    const shapes={
      wechat:'<path d="M3.0 8.0c0.0-3.0 3.0-5.0 6.0-5.0s6.0 2.0 6.0 5.0-3.0 5.0-6.0 5.0H7.0l-3.0 2.0 1.0-3.0C4.0 11.0 3.0 10.0 3.0 8.0Z" fill="currentColor"/><path d="M10.0 12.0c0.0-2.0 2.0-4.0 5.0-4.0s5.0 2.0 5.0 4.0-2.0 4.0-5.0 4.0h-1.0l-2.0 2.0v-3.0c-1.0-1.0-2.0-2.0-2.0-3.0Z" fill="currentColor" stroke="#fffdf9" stroke-width="1.2"/>',
      ding:'<path d="m4.0 4.0 13.0 3.0-3.0 3.0 3.0 2.0-7.0 7.0 1.0-6.0-4.0-1.0 2.0-3.0-5.0-2.0Z" fill="currentColor"/>',
      feishu:'<path d="m3.0 5.0 8.0 3.0 8.0-4.0-6.0 10.0-10.0-9.0Z" fill="currentColor"/><path d="m8.0 13.0 4.0 3.0 4.0-2.0-4.0 6.0-4.0-7.0Z" fill="currentColor" opacity=".6"/>',
      archive:'<rect x="4" y="8" width="14" height="11" rx="2" fill="currentColor"/><path d="M3.0 4.0h16.0v4.0H3.0z" fill="currentColor"/><path fill="none" d="M9.0 12.0h4.0" stroke="#fffdf9" stroke-width="1.5" stroke-linecap="round"/>'
    };
    return `<span class="identity-channel identity-channel-${channel}" aria-hidden="true"><svg viewBox="0 0 22 22" focusable="false">${shapes[channel]}</svg></span>`;
  }

  function wrap(art,{type,tone,label,size='md',channel=''}) {
    return `<span class="identity-avatar identity-size-${sizeFor(size)} identity-${type} identity-tone-${toneFor(tone)}" data-entity-type="${type}" data-tone="${toneFor(tone)}" role="img" aria-label="${escape(label)}" title="${escape(label)}">${art}${channelBadge(channel)}</span>`;
  }

  function avatar(item={},options={}) {
    const identity=describe(item);
    const palette=palettes[identity.tone];
    const channel=options.channel&&owns(channels,item.channel)?item.channel:'';
    const art=identity.type==='store'?store(palette,identity.variant):identity.type==='archive'?symbol(palette,'archive'):person(palette,identity.type);
    return wrap(art,{...identity,size:options.size,channel,label:identity.label+(channel?' · '+channels[channel]:'')});
  }

  function worker(identifier,size='md') {
    const worker=owns(workers,identifier)?workers[identifier]:{label:'自动化助手',tone:'slate',art:'manager'};
    return wrap(symbol(palettes[worker.tone],worker.art),{...worker,type:'assistant',size});
  }

  function knowledge(entry={},size='md') {
    const categories={'故障排查':{art:'fault',tone:'clay'},'服务规范':{art:'quality',tone:'plum'},'操作咨询':{art:'knowledge',tone:'amber'},'软件问题':{art:'software',tone:'blue'}};
    const category=owns(categories,entry.category)?categories[entry.category]:{art:'document',tone:'slate'};
    return wrap(symbol(palettes[category.tone],category.art),{type:'knowledge',tone:category.tone,size,label:entry.category?String(entry.category)+'知识':'知识文档'});
  }

  return {avatar,worker,knowledge,describe,channelBadge};
})();
