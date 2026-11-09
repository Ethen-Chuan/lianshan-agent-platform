const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const {createModelConnections} = require('./model-connections-server');

function createServer(options={}) {
  const root=__dirname;
  const connections=createModelConnections(options);
  const files=new Set(['index.html','styles.css','trace.css','seat-assist.css','manager.css','ui.css','identity.css','identity.js','analytics-data.js','analytics.js','analytics.css','problem-data.js','problem-insights.js','problem-insights.css','icon-help.js','icon-help.css','project-hub.js','project-hub.css','media-composer.js','media-composer.css','app.js','trace.js','seat-assist.js','manager-engine.js','manager.js','icons.js','model-providers.js','model-connections.js','model-connections.css','THIRD_PARTY_LICENSE.txt','README.md']);
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
  const server=http.createServer(async(request,response)=>{
    let pathname;
    try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end('Bad request');return;}
    if(await connections.handle(request,response,pathname))return;
    if(request.headers.host!=='127.0.0.1:'+request.socket.localPort){response.writeHead(403);response.end();return;}
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
    const filename=pathname.slice(1)||'index.html';
    if(!files.has(filename)){response.writeHead(404);response.end('Not found');return;}
    try{
      let content=await fs.readFile(path.join(root,filename));
      if(filename==='index.html')content=Buffer.from(content.toString('utf8').replace("connect-src 'none'","connect-src 'self'"));
      response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
      response.end(request.method==='HEAD'?undefined:content);
    }catch{response.writeHead(404);response.end('Not found');}
  });
  server.on('close',connections.dispose);
  server.requestTimeout=15000;
  server.headersTimeout=10000;
  return server;
}
if(require.main===module){
  const server=createServer();
  server.listen(Number(process.env.PORT||4333),'127.0.0.1',()=>console.log(`ServiceHub demo ready on local port ${server.address().port}`));
}
module.exports={createServer};
