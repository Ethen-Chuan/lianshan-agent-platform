const filesystem = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function fixture() {
  const listeners = {};
  const timers = new Map();
  const microtasks = [];
  let clock = 0;
  let timerId = 0;
  let document;
  const media = {matches: false, addEventListener(name, handler) {this.change = handler;}};

  class Element {
    constructor(tag, attributes = {}) {
      this.tagName = tag.toUpperCase();
      this.values = {...attributes};
      this.children = [];
      this.events = {};
      this.parentElement = null;
      this.scrollTop = 0;
      this.textContent = '';
      this.innerHTML = '';
      this.rendered = true;
      this.dataset = new Proxy({}, {
        get: (target, key) => this.getAttribute('data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())) || undefined,
        set: (target, key, value) => {this.setAttribute('data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()), value); return true;}
      });
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: name => {this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), name])].join(' ');},
        toggle: (name, force) => {const present = force ?? !this.classList.contains(name); this.className = this.className.split(/\s+/).filter(value => value !== name).concat(present ? [name] : []).join(' '); return present;}
      };
    }
    get attributes() {return Object.entries(this.values).map(([name, value]) => ({name, value}));}
    get id() {return this.values.id || '';}
    set id(value) {this.values.id = value;}
    get className() {return this.values.class || '';}
    set className(value) {this.values.class = value;}
    get hidden() {return this.values.hidden !== undefined;}
    set hidden(value) {this.toggleAttribute('hidden', value);}
    get isConnected() {return document.body === this || document.body.contains(this);}
    get firstElementChild() {return this.children[0] || null;}
    setAttribute(name, value) {this.values[name] = String(value);}
    getAttribute(name) {return this.values[name] ?? null;}
    removeAttribute(name) {delete this.values[name];}
    toggleAttribute(name, enabled) {if (enabled) this.setAttribute(name, ''); else this.removeAttribute(name);}
    append(...children) {for (const child of children) {child.parentElement = this; this.children.push(child);}}
    prepend(child) {child.parentElement = this; this.children.unshift(child);}
    replaceChildren(...children) {
      if (this.contains(document.activeElement)) document.activeElement = document.body;
      for (const child of this.children) child.parentElement = null;
      this.children = [];
      this.append(...children);
    }
    contains(element) {return this === element || this.children.some(child => child.contains(element));}
    getClientRects() {return this.rendered ? [{}] : [];}
    focus() {document.activeElement = this;}
    scrollIntoView(options) {this.scrolled = options;}
    addEventListener(name, handler) {(this.events[name] ||= []).push(handler);}
    emit(name, event = {}) {for (const handler of this.events[name] || []) handler(event);}
    matches(selectors) {
      return selectors.split(',').some(raw => {
        const selector = raw.trim();
        const parts = selector.split(/\s+/);
        if (parts.length > 1) {
          const last = parts.pop();
          return this.matches(last) && !!this.parentElement?.closest(parts.join(' '));
        }
        if (selector.includes(':not(:disabled)') && this.values.disabled !== undefined) return false;
        const clean = selector.replace(':not(:disabled)', '');
        const tag = clean.match(/^[a-z]+/i)?.[0];
        if (tag && tag.toUpperCase() !== this.tagName) return false;
        for (const match of clean.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(match[1])) return false;
        for (const match of clean.matchAll(/#([\w-]+)/g)) if (this.id !== match[1]) return false;
        for (const match of clean.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
          if (this.getAttribute(match[1]) === null || match[2] !== undefined && this.getAttribute(match[1]) !== match[2]) return false;
        }
        return true;
      });
    }
    closest(selector) {return this.matches(selector) ? this : this.parentElement?.closest(selector) || null;}
    querySelectorAll(selector) {return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);}
    querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  }

  const element = (tag, attributes) => new Element(tag, attributes);
  document = {
    body: element('body'),
    activeElement: null,
    addEventListener(name, handler) {(listeners[name] ||= []).push(handler);},
    createElement: tag => element(tag),
    querySelector(selector) {return this.body.querySelector(selector);},
    querySelectorAll(selector) {return this.body.querySelectorAll(selector);},
    getElementById(id) {return this.querySelector('#' + id);}
  };
  document.activeElement = document.body;
  const app = element('div', {id: 'app'});
  const overlay = element('div', {id: 'overlay-root'});
  const toast = element('div', {id: 'toast-root'});
  const scrim = element('button', {id: 'ui-nav-scrim', class: 'ui-nav-scrim', hidden: '', 'data-action': 'ui-close-navigation'});
  document.body.append(app, overlay, toast, scrim);
  const window = {matchMedia: () => media, HUB_ICONS: {'circle-check': '<svg></svg>', 'alert-triangle': '<svg></svg>'}};
  vm.runInNewContext(filesystem.readFileSync(path.join(__dirname, '../../app/interface.js'), 'utf8'), {
    window, document, Date: {now: () => clock},
    setTimeout(handler, duration) {const identifier = ++timerId; timers.set(identifier, {handler, deadline: clock + duration}); return identifier;},
    clearTimeout: identifier => timers.delete(identifier),
    queueMicrotask: callback => microtasks.push(callback)
  });
  let nodes;
  function redraw({section = 'workbench', scope = 'AFTERSALES:orbit', activeFocus = false, sidebar = true} = {}) {
    const previous = window.HubUI.capture();
    const mainShell = element('div', {class: 'main-shell'});
    const header = element('header', {class: 'topbar'});
    const trigger = element('button', {'data-action': 'mobile-menu'});
    const main = element('main', {id: 'main-content', tabindex: '-1'});
    const navigation = element('nav', {class: 'orbit-workflow'});
    const selectedTab = element('button', {class: 'active', 'data-action': 'studio-tab', 'data-value': section});
    navigation.append(selectedTab);
    const control = element('button', {'data-action': 'edit', 'data-id': 'record-1'});
    const input = element('textarea', {id: 'project-group-prompt'});
    input.value = '保留草稿';
    input.selectionStart = 2;
    main.append(navigation, control, input);
    header.append(trigger);
    mainShell.append(header, main);
    const rail = element('aside', {class: 'sidebar'});
    const entry = element('button', {class: 'nav-item active', 'data-page': 'orbit', 'data-action': 'studio-orbit'});
    const other = element('button', {class: 'nav-item', 'data-page': 'knowledge', 'data-action': 'navigate'});
    rail.append(entry, other);
    app.replaceChildren(...(sidebar ? [rail] : []), mainShell);
    if (activeFocus) input.focus();
    window.HubUI.mount(previous, scope);
    nodes = {mainShell, main, trigger, rail, entry, other, selectedTab, control, input};
    return nodes;
  }
  function emit(name, properties) {
    const event = {defaultPrevented: false, ...properties, preventDefault() {this.defaultPrevented = true;}, stopImmediatePropagation() {this.stopped = true;}};
    for (const handler of listeners[name] || []) {handler(event); if (event.stopped) break;}
    return event;
  }
  function tick(milliseconds) {
    const end = clock + milliseconds;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.deadline <= end).sort((left, right) => left[1].deadline - right[1].deadline)[0];
      if (!next) break;
      clock = next[1].deadline;
      timers.delete(next[0]);
      next[1].handler();
    }
    clock = end;
  }
  redraw();
  return {ui: window.HubUI, document, element, app, overlay, toast, scrim, emit, tick, redraw, timers, current: () => nodes,
    compact(value) {media.matches = value; media.change?.();},
    flush() {while (microtasks.length) microtasks.shift()();}
  };
};
