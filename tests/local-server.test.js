const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const {createServer}=require('../app/server');
const {publicAssets}=require('../scripts/public-assets');
const html=filesystem.readFileSync(path.join(__dirname,'../app/index.html'),'utf8');

async function request(server,url,options={}) {
  let status;let headers;
  const incoming={url,method:options.method||'GET',headers:{host:'127.0.0.1:4333',...options.headers},socket:{localPort:4333}};
  let content;
  const response={writeHead(value,fields){status=value;headers=fields;},end(value){content=String(value||'');}};
  await server.listeners('request')[0](incoming,response);
  return {status,headers,content};
}

test('the local server serves every script and stylesheet required by its HTML',async()=>{
  const server=createServer();
  for(const asset of publicAssets(html)){
    const result=await request(server,'/'+asset+'?v=service-focus');
    assert.equal(result.status,200,asset);assert.ok(result.content.length,asset);assert.equal(result.headers['X-Content-Type-Options'],'nosniff');
  }
  const result=await request(server,'/');assert.equal(result.status,200);assert.match(result.content,/connect-src 'self'/);
});
test('local static serving rejects backend, metadata, traversal and unrecognized hosts',async()=>{
  const server=createServer();
  for(const resource of ['server.js','model-connections-server.js','model-client-server.js','orbit-designer-server.js','super-agent-server.js','super-agent-runtime.js','super-agent-store.js','super-agent-policy.js','work/super-agent/tasks.sqlite','tasks.sqlite','../scripts/public-assets.js','README.md','.env','.git/config','%2e%2e%2fpackage.json','public-mode.js'])assert.equal((await request(server,'/'+resource)).status,404,resource);
  assert.equal((await request(server,'/',{headers:{host:'untrusted.example'}})).status,403);
  assert.equal((await request(server,'/',{method:'POST'})).status,405);
  assert.equal((await request(server,'/%invalid')).status,400);
  assert.equal((await request(server,'/index.html',{method:'HEAD'})).content,'');
});
test('the shared asset manifest rejects backend filenames, URLs and traversal',()=>{
  assert.deepEqual(publicAssets('<script src="app.js"></script><link href="styles.css"><script src="app.js"></script>'),['app.js','styles.css']);
  for(const asset of ['server.js','model-connections-server.js','orbit-designer-server.js','super-agent-runtime.js','super-agent-store.js','super-agent-policy.js','../app.js','https://example.com/app.js','app.js?key=example'])assert.throws(()=>publicAssets('<script src="'+asset+'"></script>'),/Unexpected public asset/);
});
