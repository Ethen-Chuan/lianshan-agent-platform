const http = require('node:http');
const filesystem = require('node:fs/promises');
const path = require('node:path');
const configuration = require('../vercel.json');
const root = path.resolve(__dirname, '..', 'site');
const mimeTypes = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.txt':'text/plain; charset=utf-8'};
const securityHeaders = Object.fromEntries(configuration.headers[0].headers.map(header => [header.key, header.value]));

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {response.writeHead(405); response.end(); return;}
  let filename;
  try {filename = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1) || 'index.html';}
  catch {response.writeHead(400); response.end(); return;}
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {response.writeHead(404); response.end(); return;}
  try {
    const content = await filesystem.readFile(path.join(root, filename));
    response.writeHead(200, {...securityHeaders, 'Content-Type': mimeTypes[path.extname(filename)] || 'application/octet-stream'});
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {response.writeHead(404, securityHeaders); response.end('Not found');}
});

server.listen(Number(process.env.PORT || 4340), '127.0.0.1', () => console.log(`Static demo preview on http://127.0.0.1:${server.address().port}`));
