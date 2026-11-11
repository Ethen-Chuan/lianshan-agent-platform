const {providers}=require('./model-providers');

async function modelCompletion(entry,{messages,system='',maxTokens=1800}, {fetchImpl=globalThis.fetch,signal}={}){
  const fail=message=>{throw Object.assign(new Error(message),{status:502});};
  const headers={'Content-Type':'application/json'};
  const payload={model:entry.model,messages,stream:false};
  if(entry.provider==='anthropic'){
    headers['x-api-key']=entry.key;
    headers['anthropic-version']='2026-10-21';
    payload.max_tokens=maxTokens;
    if(system)payload.system=system;
  }else{
    headers.Authorization='Bearer '+entry.key;
    if(system)payload.messages=[{role:'system',content:system},...messages];
    payload[entry.provider==='openai'?'max_completion_tokens':'max_tokens']=maxTokens;
    if(entry.provider==='openai')payload.store=false;
  }
  const response=await fetchImpl(providers[entry.provider].endpoint,{method:'POST',headers,body:JSON.stringify(payload),signal,redirect:'error'});
  if(!response.ok){
    await response.body?.cancel();
    fail(response.status===401||response.status===403?'密钥或模型访问权限未通过，请核对连接配置。':response.status===429?'服务商限流或额度不足，请核对账户后重试。':response.status===400||response.status===404?'模型 ID 或接口不兼容，请核对文本对话模型配置。':'模型服务暂未完成请求，请稍后重试。');
  }
  const reader=response.body?.getReader();
  if(!reader)fail('模型没有返回可读取的响应。');
  const chunks=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>131072){await reader.cancel();fail('模型响应过长，未保留原文。');}chunks.push(Buffer.from(part.value));}
  let result;
  try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('模型响应格式不正确，未保留原文。');}
  const message=result.choices?.[0]?.message;
  if(result.stop_reason==='max_tokens'||result.choices?.[0]?.finish_reason==='length')fail('模型输出达到长度上限，未展示不完整回复。');
  if(message?.tool_calls?.length||result.content?.some(block=>block.type==='tool_use'))fail('此入口不执行工具调用。');
  const text=entry.provider==='anthropic'?result.content?.filter(block=>block.type==='text').map(block=>block.text).join(''):message?.content;
  if(typeof text!=='string'||!text.trim())fail('模型未返回文本，请核对模型配置后重试。');
  if(text.includes(entry.key))fail('模型响应包含疑似凭证，已阻止展示。');
  return text;
}

module.exports={modelCompletion};
