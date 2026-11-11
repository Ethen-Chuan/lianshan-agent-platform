const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {readFileSync} = require('node:fs');
const {publicAssets} = require('../scripts/public-assets');

const {createModelConnections} = require('./model-connections-server');
const {createSuperAgentService}=require('./super-agent-server');
const {createOrbitDesignerService}=require('./orbit-designer-server');

function createServer(options={}) {
  const root=__dirname;
  const connections=createModelConnections(options);
  const superAgent=createSuperAgentService(connections,options);
  const orbitDesigner=createOrbitDesignerService(connections,options);
  const files=new Set(['index.html','THIRD_PARTY_LICENSE.txt',...publicAssets(readFileSync(path.join(root,'index.html'),'utf8'))]);
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
  const server=http.createServer(async(request,response)=>{
    let pathname;
    try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end('Bad request');return;}
    if(await connections.handle(request,response,pathname))return;
    if(await superAgent.handle(request,response,pathname))return;
    if(await orbitDesigner.handle(request,response,pathname))return;
    if(request.headers.host!=='127.0.0.1:'+request.socket.localPort){response.writeHead(403);response.end();return;}
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
    const filename=pathname.slice(1)||'index.html';
    if(!files.has(filename)){response.writeHead(404);response.end('Not found');return;}
    try{
      if(!(await fs.lstat(path.join(root,filename))).isFile()){response.writeHead(404);response.end('Not found');return;}
      let content=await fs.readFile(path.join(root,filename));
      if(filename==='index.html')content=Buffer.from(content.toString('utf8').replace("connect-src 'none'","connect-src 'self'"));
      response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
      response.end(request.method==='HEAD'?undefined:content);
    }catch{response.writeHead(404);response.end('Not found');}
  });
  server.on('close',()=>{orbitDesigner.dispose();superAgent.dispose();connections.dispose();});
  server.requestTimeout=15000;
  server.headersTimeout=10000;
  return server;
}
if(require.main===module){
  const server=createServer();
  server.listen(Number(process.env.PORT||4333),'127.0.0.1',()=>console.log(`ServiceHub demo ready on local port ${server.address().port}`));
}
module.exports={createServer};
