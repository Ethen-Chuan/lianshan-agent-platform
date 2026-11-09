const assert = require('node:assert/strict');
const test = require('node:test');
const filesystem = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = filename => filesystem.readFileSync(path.join(root, filename), 'utf8');

test('all application and deployment JavaScript parses', () => {
  for (const directory of ['app', 'deployment', 'scripts']) {
    for (const filename of filesystem.readdirSync(path.join(root, directory)).filter(filename => filename.endsWith('.js'))) {
      execFileSync(process.execPath, ['--check', path.join(root, directory, filename)]);
    }
  }
});

test('public artifacts are allowlisted and backend-free', () => {
  const filenames = filesystem.readdirSync(path.join(root, 'site'));
  for (const forbidden of ['server.js', 'model-connections-server.js', 'README.md', 'package.json', '.env', 'auth.json', '.git']) assert.ok(!filenames.includes(forbidden));
  assert.ok(filenames.includes('about.html'));
  assert.ok(filenames.includes('THIRD_PARTY_LICENSE.txt'));
});

test('public mode is loaded before any model or microphone code', () => {
  const html = read('site/index.html');
  assert.ok(html.indexOf('public-mode.js') < html.indexOf('model-connections.js'));
  assert.ok(html.indexOf('public-mode.js') < html.indexOf('media-composer.js'));
  assert.match(read('site/public-mode.js'), /window\.LIANSHAN_PUBLIC_DEMO = true/);
  assert.match(read('site/model-connections.js'), /localServer=!window\.LIANSHAN_PUBLIC_DEMO/);
  assert.match(read('site/media-composer.js'), /function startVoice\(scope\)\{\s*if\(window\.LIANSHAN_PUBLIC_DEMO\)return/);
});

test('optional Vercel headers are restrictive and Pages HTML independently blocks connections', () => {
  const configuration = JSON.parse(read('vercel.json'));
  const headers = Object.fromEntries(configuration.headers[0].headers.map(header => [header.key, header.value]));
  assert.match(headers['Content-Security-Policy'], /connect-src 'none'/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(headers['Permissions-Policy'], /microphone=\(\)/);
  assert.match(headers['X-Robots-Tag'], /noindex/);
  assert.match(read('site/index.html'), /connect-src 'none'/);
  assert.match(read('site/index.html'), /name="referrer" content="no-referrer"/);
  assert.match(read('site/about.html'), /name="referrer" content="no-referrer"/);
});

test('release manifest matches the built files', () => {
  const release = JSON.parse(read('site/release.json'));
  assert.equal(release.mode, 'public-static-demo');
  for (const entry of release.files) {
    const content = filesystem.readFileSync(path.join(root, 'site', entry.filename));
    assert.equal(crypto.createHash('sha256').update(content).digest('hex'), entry.sha256);
  }
});

test('deployed source contains no home directory paths or known private key formats', () => {
  for (const filename of filesystem.readdirSync(path.join(root, 'site'))) {
    const content = read('site/' + filename);
    assert.doesNotMatch(content, /\/Users\/|\/var\/folders\/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[a-zA-Z0-9]{30,}/);
  }
});

test('production boundaries are disclosed to visitors', () => {
  const guide = read('site/about.html');
  for (const phrase of ['不是生产系统', '当前浏览器', '不在不同访客或设备间同步', '不提供业务提交接口', '工程源码与预置样例公开可见']) assert.ok(guide.includes(phrase));
});

test('optional Pages workflow template tests the build and publishes only static artifacts', () => {
  const workflow = read('deployment/pages-workflow.yml');
  assert.match(workflow, /branches: \[master\]/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /path: site/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.ok(workflow.indexOf('run: npm test') < workflow.indexOf('actions/upload-pages-artifact@'));
});

test('committed Pages directory exactly matches the allowlisted build', () => {
  const filenames = filesystem.readdirSync(path.join(root, 'site')).sort();
  assert.deepEqual(filesystem.readdirSync(path.join(root, 'docs')).sort(), filenames);
  assert.ok(filenames.includes('.nojekyll'));
  for (const filename of filenames) assert.equal(read('docs/' + filename), read('site/' + filename));
});
