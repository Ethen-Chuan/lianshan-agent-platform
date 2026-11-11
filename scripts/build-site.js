const filesystem = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {publicAssets} = require('./public-assets');

const projectRoot = path.resolve(__dirname, '..');
const appDirectory = path.join(projectRoot, 'app');
const outputDirectory = path.join(projectRoot, 'site');
const pagesDirectory = path.join(projectRoot, 'docs');

async function build() {
  const originalHtml = await filesystem.readFile(path.join(appDirectory, 'index.html'), 'utf8');
  const assets = publicAssets(originalHtml);
  for (const asset of assets) {
    if (!/^[a-z0-9-]+\.(?:js|css)$/.test(asset)) throw new Error(`Unexpected public asset: ${asset}`);
    const metadata = await filesystem.lstat(path.join(appDirectory, asset));
    if (!metadata.isFile()) throw new Error(`Public asset is not a regular file: ${asset}`);
  }
  const publicHtml = originalHtml
    .replace('<meta name="color-scheme" content="light">', '<meta name="color-scheme" content="light">\n  <meta name="robots" content="noindex,nofollow">\n  <meta name="referrer" content="no-referrer">')
    .replace('<title>连山 · 项目协作工作台</title>', '<title>连山 · 在线演示</title>')
    .replace('<script src="icons.js" defer></script>', '<script src="public-mode.js" defer></script>\n  <script src="icons.js" defer></script>');
  if (!publicHtml.includes('public-mode.js')) throw new Error('Public deployment guard was not inserted.');
  await filesystem.rm(outputDirectory, {recursive: true, force: true});
  await filesystem.mkdir(outputDirectory, {recursive: true});
  await filesystem.writeFile(path.join(outputDirectory, 'index.html'), publicHtml);
  for (const asset of [...assets, 'THIRD_PARTY_LICENSE.txt']) {
    await filesystem.copyFile(path.join(appDirectory, asset), path.join(outputDirectory, asset));
  }
  for (const asset of ['public-mode.js', 'about.html', 'robots.txt']) {
    await filesystem.copyFile(path.join(projectRoot, 'deployment', asset), path.join(outputDirectory, asset));
  }
  await filesystem.writeFile(path.join(outputDirectory, '.nojekyll'), '');
  const manifest = [];
  for (const filename of (await filesystem.readdir(outputDirectory)).sort()) {
    const content = await filesystem.readFile(path.join(outputDirectory, filename));
    manifest.push({filename, sha256: crypto.createHash('sha256').update(content).digest('hex')});
  }
  const packageMetadata = JSON.parse(await filesystem.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  await filesystem.writeFile(path.join(outputDirectory, 'release.json'), JSON.stringify({version: packageMetadata.version, mode: 'public-static-demo', files: manifest}, null, 2) + '\n');
  await filesystem.rm(pagesDirectory, {recursive: true, force: true});
  await filesystem.cp(outputDirectory, pagesDirectory, {recursive: true});
  console.log(`Built ${manifest.length + 1} allowlisted public files. No server source or development documentation is included.`);
}

build().catch(error => {console.error(error.message); process.exitCode = 1;});
