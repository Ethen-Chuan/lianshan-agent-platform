const test = require('node:test');
const assert = require('node:assert/strict');
const filesystem = require('node:fs');
const path = require('node:path');
const fixture = require('./helpers/interface-fixture');
const read = file => filesystem.readFileSync(path.join(__dirname, '../app', file), 'utf8');

test('the shared skin loads last and the interaction module mounts after the existing composer owners', () => {
  const html = read('index.html');
  const styles = [...html.matchAll(/href="([\w-]+\.css)"/g)].map(match => match[1]);
  assert.equal(styles.at(-1), 'interface.css');
  assert.ok(html.indexOf('interface.js') < html.indexOf('src="app.js"'));
  assert.match(html, /body class="ui-refined"/);
  assert.match(html, /ui-skip-link/);
  const source = read('app.js');
  const render = source.slice(source.indexOf('function render()'), source.indexOf('function workspacePage()'));
  assert.ok(render.indexOf('window.HubUI?.mount') > render.indexOf('window.GroupChat?.mount'));
  assert.match(source, /window\.HubUI\?\.closeNavigation\(false\)/);
});

test('only route changes play the page entrance; same-view updates retain scroll and exact focus', () => {
  const session = fixture();
  const before = session.current();
  assert.equal(before.main.classList.contains('ui-enter'), true);
  before.main.scrollTop = 380;
  before.rail.scrollTop = 64;
  before.control.setAttribute('data-icon-help', '动态提示');
  before.control.focus();
  const after = session.redraw();
  assert.equal(after.main.classList.contains('ui-enter'), false);
  assert.equal(after.main.scrollTop, 380);
  assert.equal(after.rail.scrollTop, 64);
  assert.equal(session.document.activeElement, after.control);
});

test('switching a section starts its content at the top without resetting sidebar position', () => {
  const session = fixture();
  session.current().main.scrollTop = 410;
  session.current().rail.scrollTop = 40;
  const after = session.redraw({section: 'tests'});
  assert.equal(after.main.scrollTop, 0);
  assert.equal(after.rail.scrollTop, 40);
});

test('cross-project navigation never applies another project scroll or record focus', () => {
  const session = fixture();
  session.current().control.focus();
  session.current().main.scrollTop = 420;
  session.current().rail.scrollTop = 90;
  const after = session.redraw({scope: 'RETAIL:orbit'});
  assert.equal(after.main.scrollTop, 0);
  assert.equal(after.rail.scrollTop, 0);
  assert.equal(session.document.activeElement, after.main);
});

test('existing composer focus, selection and draft remain owned by the chat module', () => {
  const session = fixture();
  session.current().control.focus();
  const after = session.redraw({activeFocus: true});
  assert.equal(session.document.activeElement, after.input);
  assert.equal(after.input.value, '保留草稿');
  assert.equal(after.input.selectionStart, 2);
});

test('ambiguous or disabled focus targets are not guessed after a redraw', () => {
  const session = fixture();
  session.current().control.focus();
  const saved = session.ui.capture();
  const after = session.redraw();
  const duplicate = session.element('button', {'data-action': 'edit', 'data-id': 'record-1'});
  after.main.append(duplicate);
  session.document.activeElement = session.document.body;
  session.ui.mount(saved, 'AFTERSALES:orbit');
  assert.equal(session.document.activeElement, session.document.body);
  duplicate.setAttribute('disabled', '');
  after.control.setAttribute('disabled', '');
  session.ui.mount(saved, 'AFTERSALES:orbit');
  assert.equal(session.document.activeElement, session.document.body);
});

test('compact navigation exposes its state, contains focus and returns to the opener on Escape', () => {
  const session = fixture();
  session.compact(true);
  const nodes = session.current();
  nodes.trigger.focus();
  session.ui.toggleNavigation();
  assert.equal(nodes.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(nodes.trigger.getAttribute('aria-controls'), nodes.rail.id);
  assert.equal(nodes.mainShell.getAttribute('inert'), '');
  assert.equal(nodes.rail.getAttribute('aria-modal'), 'true');
  assert.equal(session.scrim.hidden, false);
  assert.equal(session.document.activeElement, nodes.entry);
  nodes.other.focus();
  assert.equal(session.emit('keydown', {target: nodes.other, key: 'Tab'}).defaultPrevented, true);
  assert.equal(session.document.activeElement, nodes.rail.querySelector('.ui-nav-close'));
  assert.equal(session.emit('keydown', {target: session.document.activeElement, key: 'Tab', shiftKey: true}).defaultPrevented, true);
  assert.equal(session.document.activeElement, nodes.other);
  session.emit('keydown', {target: nodes.other, key: 'Escape'});
  assert.equal(nodes.mainShell.getAttribute('inert'), null);
  assert.equal(nodes.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(session.scrim.hidden, true);
  assert.equal(session.document.activeElement, nodes.trigger);
});

test('navigation closes on backdrop, new destination and viewport expansion', () => {
  const session = fixture();
  session.compact(true);
  session.current().trigger.focus();
  session.ui.toggleNavigation();
  session.emit('click', {target: session.scrim});
  assert.equal(session.scrim.hidden, true);
  session.ui.toggleNavigation();
  const after = session.redraw({scope: 'AFTERSALES:knowledge'});
  assert.equal(session.scrim.hidden, true);
  assert.equal(after.mainShell.getAttribute('inert'), null);
  session.ui.toggleNavigation();
  session.compact(false);
  assert.equal(after.mainShell.getAttribute('inert'), null);
  assert.equal(after.rail.classList.contains('open'), false);
  session.ui.toggleNavigation();
  assert.equal(after.rail.classList.contains('open'), false);
});

test('same-view background updates keep a mobile menu open without losing its selected control', () => {
  const session = fixture();
  session.compact(true);
  session.ui.toggleNavigation();
  const after = session.redraw();
  assert.equal(after.rail.classList.contains('open'), true);
  assert.equal(session.document.activeElement, after.entry);
  assert.equal(after.mainShell.getAttribute('inert'), '');
});

test('navigation cleanup does not clear modal isolation and does not steal dialog focus', () => {
  const session = fixture();
  session.compact(true);
  session.ui.toggleNavigation();
  session.app.setAttribute('inert', '');
  session.ui.closeNavigation(false);
  assert.equal(session.app.getAttribute('inert'), '');
  const dialog = session.element('section', {class: 'dialog', role: 'dialog'});
  session.overlay.append(dialog);
  dialog.focus();
  session.redraw();
  assert.equal(session.document.activeElement, dialog);
});

test('the skip link focuses the work area without changing routes or creating a task', () => {
  const session = fixture();
  const link = session.element('a', {class: 'ui-skip-link', href: '#main-content'});
  session.document.body.append(link);
  assert.equal(session.emit('click', {target: link}).defaultPrevented, true);
  assert.equal(session.document.activeElement, session.current().main);
});

test('function-search arrows skip hidden results and never activate a destination on their own', () => {
  const session = fixture();
  const search = session.element('input', {id: 'ui-nav-search'});
  const results = session.element('div', {class: 'ui-nav-results'});
  const options = [session.element('button'), session.element('button', {hidden: ''}), session.element('button')];
  results.append(...options);
  session.overlay.append(search, results);
  search.focus();
  assert.equal(session.emit('keydown', {target: search, key: 'Home'}).defaultPrevented, false);
  session.emit('keydown', {target: search, key: 'ArrowDown', isComposing: true});
  assert.equal(session.document.activeElement, search);
  session.emit('keydown', {target: search, key: 'ArrowDown'});
  assert.equal(session.document.activeElement, options[0]);
  session.emit('keydown', {target: options[0], key: 'ArrowDown'});
  assert.equal(session.document.activeElement, options[2]);
  session.emit('keydown', {target: options[2], key: 'ArrowDown'});
  assert.equal(session.document.activeElement, options[0]);
  session.emit('keydown', {target: options[0], key: 'End'});
  assert.equal(session.document.activeElement, options[2]);
});

test('feedback renders untrusted content as text and never steals composer focus', () => {
  const session = fixture();
  session.current().input.focus();
  const content = '<img src=x onerror=unsafe()>请先核对资料';
  session.ui.feedback(content, true);
  assert.equal(session.toast.querySelector('.toast-message').textContent, content);
  assert.equal(session.toast.querySelector('.toast-message').innerHTML, '');
  assert.equal(session.document.activeElement, session.current().input);
  session.tick(9900);
  assert.ok(session.toast.firstElementChild);
  session.tick(100);
  assert.equal(session.toast.firstElementChild, null);
});

test('hover pauses feedback and continues with the remaining reading time', () => {
  const session = fixture();
  session.ui.feedback('配置已保存');
  session.tick(2000);
  const notice = session.toast.firstElementChild;
  notice.emit('pointerenter');
  session.tick(12000);
  assert.ok(session.toast.firstElementChild);
  notice.emit('pointerleave');
  session.tick(3999);
  assert.ok(session.toast.firstElementChild);
  session.tick(1);
  assert.equal(session.toast.firstElementChild, null);
});

test('keyboard reading pauses feedback, blur resumes it, and dismiss restores the previous control', () => {
  const session = fixture();
  session.current().control.focus();
  session.ui.feedback('已保存');
  const notice = session.toast.firstElementChild;
  notice.querySelector('button').focus();
  notice.emit('focusin');
  session.tick(12000);
  assert.ok(session.toast.firstElementChild);
  notice.emit('focusout');
  session.current().input.focus();
  session.flush();
  session.tick(6000);
  assert.equal(session.toast.firstElementChild, null);
  session.current().control.focus();
  session.ui.feedback('另一个提示');
  const close = session.toast.querySelector('button');
  close.focus();
  close.emit('click');
  assert.equal(session.toast.firstElementChild, null);
  assert.equal(session.document.activeElement, session.current().control);
});

test('new feedback replaces the old timeout and preserves keyboard focus within the notification', () => {
  const session = fixture();
  session.ui.feedback('第一次保存');
  session.tick(5000);
  session.ui.feedback('第二次保存');
  session.tick(1000);
  assert.equal(session.toast.querySelector('.toast-message').textContent, '第二次保存');
  session.toast.querySelector('button').focus();
  session.ui.feedback('需要核对', true);
  assert.equal(session.document.activeElement, session.toast.querySelector('button'));
  session.tick(20000);
  assert.ok(session.toast.firstElementChild);
});

test('motion is opt-out, preserves toast centering and never transforms canvas ports or nodes', () => {
  const css = read('interface.css');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /animation:\s*none !important/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /hover:\s*hover/);
  assert.match(css, /pointer:\s*coarse/);
  assert.match(css, /@keyframes ui-feedback-in\s*\{\s*from \{[^}]*translate\(-50%, 5px\)/);
  assert.doesNotMatch(css, /\.flow-(?:port|stage|node)[^{]*\{[^}]*(?:transform|width|height):/);
  assert.doesNotMatch(css, /transition:\s*all|will-change:|background-clip:\s*text/);
  assert.match(css, /flow-node[^\{]*:not\(\.can-connect\):not\(\.is-proposed\)/);
});

test('the UI module has no business persistence, network calls or pointer gesture handlers', () => {
  const source = read('interface.js');
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|\.click\(\)|setInterval|addEventListener\('pointer(?:down|move|up)'/);
  assert.doesNotMatch(source, /AgentHarness|ProjectStudio|ManagerEngine|ServiceJourney/);
});
