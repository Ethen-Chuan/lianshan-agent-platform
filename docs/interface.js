window.HubUI = (() => {
  const focusSelector = 'button:not(:disabled), a[href], summary, [tabindex="0"]';
  const menuSelector = '.sidebar';
  const focusAttributes = new Set(['id', 'data-action', 'data-id', 'data-page', 'data-value', 'data-tab', 'data-node', 'data-port', 'data-index', 'data-key']);
  let menuReturn = null;
  let menuOpen = false;
  let lastScope = '';
  let feedbackTimer = null;
  let feedbackDeadline = 0;
  let feedbackRemaining = 0;
  let feedbackHovered = false;
  let feedbackReturn = null;
  const compact = window.matchMedia('(max-width: 740px)');

  function visible(element) {
    return !!element && !element.hidden && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0;
  }

  function identity(element) {
    if (!element?.matches(focusSelector)) return null;
    const scope = element.closest(menuSelector) ? menuSelector : element.closest('.topbar') ? '.topbar' : '#main-content';
    const attributes = [...element.attributes].filter(attribute => focusAttributes.has(attribute.name)).map(attribute => [attribute.name, attribute.value]);
    if (!attributes.length) return null;
    return {scope, tag: element.tagName, attributes};
  }

  function findFocus(saved) {
    if (!saved) return null;
    const controls = document.querySelector(saved.scope)?.querySelectorAll(focusSelector) || [];
    const matches = [...controls].filter(element => element.tagName === saved.tag && saved.attributes.every(([name, value]) => element.getAttribute(name) === value) && visible(element));
    return matches.length === 1 ? matches[0] : null;
  }

  function section() {
    return [...document.querySelectorAll('.orbit-workflow .active, .ow-navigation .active, .aw-tab[aria-selected="true"]')].map(element => element.dataset.value).join(':');
  }

  function capture() {
    const main = document.getElementById('main-content');
    return {
      scope: lastScope,
      section: section(),
      focus: identity(document.activeElement),
      scrollTop: main?.scrollTop || 0,
      sidebarTop: document.querySelector(menuSelector)?.scrollTop || 0,
      menuOpen
    };
  }

  function syncMenu() {
    const sidebar = document.querySelector(menuSelector);
    const expanded = !!sidebar && compact.matches && menuOpen;
    document.querySelector('.main-shell')?.toggleAttribute('inert', expanded);
    sidebar?.classList.toggle('open', expanded);
    if (sidebar) {
      sidebar.id = 'primary-navigation';
      if (expanded) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
      } else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
      }
    }
    const scrim = document.getElementById('ui-nav-scrim');
    if (scrim) scrim.hidden = !expanded;
    document.querySelectorAll('[data-action="mobile-menu"]').forEach(button => {
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-controls', 'primary-navigation');
    });
  }

  function closeNavigation(restore = true) {
    menuOpen = false;
    syncMenu();
    if (restore) {
      const target = menuReturn?.isConnected ? menuReturn : document.querySelector('[data-action="mobile-menu"]');
      if (visible(target)) target.focus({preventScroll: true});
    }
    menuReturn = null;
  }

  function toggleNavigation() {
    if (!compact.matches || !document.querySelector(menuSelector)) return;
    if (menuOpen) return closeNavigation();
    menuReturn = document.activeElement;
    menuOpen = true;
    syncMenu();
    const selected = document.querySelector('.sidebar .nav-item.active');
    const target = visible(selected) ? selected : document.querySelector('.ui-nav-close');
    target?.focus({preventScroll: true});
    target?.scrollIntoView({block: 'nearest'});
  }

  function mount(previous, scope) {
    const main = document.getElementById('main-content');
    const same = previous?.scope === scope;
    const sameProject = previous?.scope.split(':')[0] === scope.split(':')[0];
    const sidebar = document.querySelector(menuSelector);
    if (sidebar && !sidebar.querySelector('.ui-nav-close')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'ui-nav-close';
      close.dataset.action = 'ui-close-navigation';
      close.textContent = '收起菜单';
      sidebar.prepend(close);
    }
    if (!same) menuOpen = false;
    syncMenu();
    if (sameProject && sidebar) sidebar.scrollTop = previous.sidebarTop;
    if (main && same && previous.section === section()) main.scrollTop = previous.scrollTop;
    if (main && !same) main.classList.add('ui-enter');
    const focused = document.activeElement;
    const retainsFocus = focused && focused !== document.body && focused.isConnected;
    if (!document.querySelector('[role="dialog"]') && !retainsFocus) {
      if (same && previous?.focus) findFocus(previous.focus)?.focus({preventScroll: true});
      else if (previous?.scope && previous.focus) main?.focus({preventScroll: true});
    }
    if (same && previous?.menuOpen && menuOpen) findFocus(previous.focus)?.focus({preventScroll: true});
    lastScope = scope;
  }

  function dismissFeedback() {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
    feedbackRemaining = 0;
    const root = document.getElementById('toast-root');
    const restore = root?.contains(document.activeElement);
    root?.replaceChildren();
    if (restore) {
      const target = visible(feedbackReturn) && feedbackReturn.isConnected ? feedbackReturn : document.getElementById('main-content');
      target?.focus({preventScroll: true});
    }
    feedbackReturn = null;
  }

  function pauseFeedback() {
    if (!feedbackTimer) return;
    feedbackRemaining = Math.max(0, feedbackDeadline - Date.now());
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }

  function resumeFeedback() {
    const root = document.getElementById('toast-root');
    if (!root?.firstElementChild || feedbackHovered || root.contains(document.activeElement)) return;
    clearTimeout(feedbackTimer);
    feedbackDeadline = Date.now() + feedbackRemaining;
    feedbackTimer = setTimeout(dismissFeedback, feedbackRemaining);
  }

  function feedback(text, error = false) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    clearTimeout(feedbackTimer);
    const focused = root.contains(document.activeElement);
    if (!focused) feedbackReturn = document.activeElement;
    const notice = document.createElement('div');
    notice.className = error ? 'toast error' : 'toast';
    const symbol = document.createElement('span');
    symbol.setAttribute('aria-hidden', 'true');
    symbol.innerHTML = window.HUB_ICONS[error ? 'alert-triangle' : 'circle-check'] || '';
    const message = document.createElement('span');
    message.className = 'toast-message';
    message.textContent = String(text);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-dismiss';
    close.setAttribute('aria-label', '关闭提示');
    close.textContent = '×';
    close.addEventListener('click', dismissFeedback);
    notice.append(symbol, message, close);
    root.replaceChildren(notice);
    feedbackRemaining = error ? 10000 : 6000;
    feedbackHovered = false;
    notice.addEventListener('pointerenter', () => {feedbackHovered = true; pauseFeedback();});
    notice.addEventListener('pointerleave', () => {feedbackHovered = false; resumeFeedback();});
    notice.addEventListener('focusin', pauseFeedback);
    notice.addEventListener('focusout', () => queueMicrotask(resumeFeedback));
    if (focused) close.focus({preventScroll: true});
    resumeFeedback();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-action="ui-close-navigation"]')) closeNavigation();
    if (event.target.closest('.ui-skip-link')) {
      event.preventDefault();
      closeNavigation(false);
      document.getElementById('main-content')?.focus({preventScroll: true});
    }
  });

  document.addEventListener('keydown', event => {
    if (event.isComposing || event.defaultPrevented) return;
    const sidebar = document.querySelector(menuSelector);
    if (menuOpen && sidebar && !document.querySelector('.dialog')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return closeNavigation();
      }
      if (event.key === 'Tab') {
        const controls = [...sidebar.querySelectorAll(focusSelector)].filter(visible);
        const target = event.shiftKey ? controls.at(-1) : controls[0];
        if (controls.length && (event.shiftKey && document.activeElement === controls[0] || !event.shiftKey && document.activeElement === controls.at(-1) || !sidebar.contains(document.activeElement))) {
          event.preventDefault();
          target.focus({preventScroll: true});
        }
      }
    }
    const search = document.getElementById('ui-nav-search');
    const results = document.querySelector('.ui-nav-results');
    if (!search || !results || event.target !== search && !results.contains(event.target)) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || event.target === search && ['Home', 'End'].includes(event.key)) return;
    const options = [...results.querySelectorAll('button:not(:disabled)')].filter(visible);
    if (!options.length) return;
    const index = options.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : index < 0 ? event.key === 'ArrowUp' ? options.length - 1 : 0 : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
    event.preventDefault();
    options[next].focus({preventScroll: true});
    options[next].scrollIntoView({block: 'nearest'});
  });

  compact.addEventListener('change', () => {if (!compact.matches) closeNavigation(false);});
  return {capture, mount, toggleNavigation, closeNavigation, feedback, dismissFeedback};
})();
