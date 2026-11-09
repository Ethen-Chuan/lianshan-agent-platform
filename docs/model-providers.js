(function(root){
  const providers = {
    openai:{name:'OpenAI',protocol:'Chat Completions',endpoint:'https://api.openai.com/v1/chat/completions',region:'OpenAI 官方服务'},
    deepseek:{name:'DeepSeek',protocol:'Chat Completions',endpoint:'https://api.deepseek.com/chat/completions',region:'DeepSeek 官方服务'},
    qwen:{name:'通义千问 · 百炼',protocol:'Chat Completions',endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',region:'百炼 · 中国内地（北京）'},
    anthropic:{name:'Claude · Anthropic',protocol:'Messages',endpoint:'https://api.anthropic.com/v1/messages',region:'Anthropic 官方服务'}
  };
  const validModel = value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/.test(value)&&!/(?:^sk-|^AIza|api.?key|bearer|secret|token=)/i.test(value);
  const api = {providers,validModel};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HubModelProviders=api;
})(typeof window==='object'?window:globalThis);
