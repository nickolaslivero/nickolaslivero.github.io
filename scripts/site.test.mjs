import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/site.js', import.meta.url), 'utf8');

function fixture({ preference = null, systemDark = false, storageBlocked = false, observer = true, togglePresent = true } = {}) {
  const variables = new Map();
  const attributes = new Map();
  const listeners = new Map();
  const windowListeners = new Map();
  const stored = new Map(preference ? [['portfolio-theme', preference]] : []);
  const root = { dataset: {}, style: { setProperty: (name, value) => variables.set(name, value) } };
  const toggle = {
    hidden: true,
    dataset: { darkLabel: 'Switch to dark theme', lightLabel: 'Switch to light theme' },
    setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (type, handler) => listeners.set(type, handler),
  };
  let headerHeight = 86.2;
  const header = { getBoundingClientRect: () => ({ height: headerHeight }) };
  const meta = {};
  let observeCallback;
  let observedHeader;
  runInNewContext(source, {
    document: {
      documentElement: root,
      getElementById: (id) => id === 'theme-toggle' && togglePresent ? toggle : null,
      querySelector: (selector) => selector === '.site-header' ? header : meta,
    },
    window: {
      matchMedia: () => ({ matches: systemDark }),
      addEventListener: (type, handler) => windowListeners.set(type, handler),
    },
    localStorage: {
      getItem: (name) => {
        if (storageBlocked) throw new Error('Storage unavailable');
        return stored.get(name) ?? null;
      },
      setItem: (name, value) => {
        if (storageBlocked) throw new Error('Storage unavailable');
        stored.set(name, value);
      },
    },
    ...(observer ? { ResizeObserver: class {
      constructor(callback) { observeCallback = callback; }
      observe(element) { observedHeader = element; }
    } } : {}),
  });
  return {
    root, toggle, attributes, stored, variables, meta, header, observedHeader,
    click: () => listeners.get('click')(),
    resize: (height) => {
      headerHeight = height;
      (observeCallback ?? windowListeners.get('resize'))();
    },
  };
}

for (const [preference, systemDark, expected] of [
  [null, false, 'light'], [null, true, 'dark'], ['light', true, 'light'], ['dark', false, 'dark'],
]) {
  test(`theme initializes from ${preference ?? 'system'} with system dark=${systemDark}`, () => {
    const state = fixture({ preference, systemDark });
    assert.equal(state.root.dataset.theme, expected);
    assert.equal(state.attributes.get('aria-pressed'), String(expected === 'dark'));
    assert.equal(state.toggle.hidden, false);
    assert.equal(state.toggle.title, expected === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    assert.equal(state.meta.content, expected === 'dark' ? '#1b2021' : '#f7f8f7');
  });
}

test('theme button toggles and persists state on consecutive clicks', () => {
  const state = fixture();
  state.click();
  assert.equal(state.root.dataset.theme, 'dark');
  assert.equal(state.attributes.get('aria-pressed'), 'true');
  assert.equal(state.stored.get('portfolio-theme'), 'dark');
  state.click();
  assert.equal(state.root.dataset.theme, 'light');
  assert.equal(state.attributes.get('aria-pressed'), 'false');
  assert.equal(state.stored.get('portfolio-theme'), 'light');
});

test('blocked browser storage still permits interactive theme changes', () => {
  const state = fixture({ storageBlocked: true, systemDark: true });
  assert.equal(state.root.dataset.theme, 'dark');
  assert.doesNotThrow(() => state.click());
  assert.equal(state.root.dataset.theme, 'light');
});

for (const observer of [true, false]) {
  test(`sticky-header offset follows actual height with ResizeObserver=${observer}`, () => {
    const state = fixture({ observer });
    assert.equal(state.variables.get('--header-height'), '87px');
    if (observer) assert.equal(state.observedHeader, state.header);
    state.resize(151.4);
    assert.equal(state.variables.get('--header-height'), '152px');
  });
}

test('sticky-header offsets remain active when a theme control is absent', () => {
  const state = fixture({ togglePresent: false });
  assert.equal(state.variables.get('--header-height'), '87px');
  state.resize(110);
  assert.equal(state.variables.get('--header-height'), '110px');
  assert.equal(state.toggle.hidden, true);
});

test('sticky header and icon controls retain safe layering and touch targets', () => {
  const css = readFileSync(new URL('../assets/site.css', import.meta.url), 'utf8');
  const header = /^\.site-header\s*\{([^}]+)\}/m.exec(css)?.[1];
  assert.match(header, /position:\s*sticky/);
  assert.match(header, /top:\s*0/);
  assert.match(header, /z-index:\s*10/);
  assert.match(header, /background:\s*var\(--bg\)/);
  assert.match(css, /scroll-padding-top:\s*calc\(var\(--header-height\) \+ 16px\)/);
  assert.match(css, /\.skip-link\s*\{[^}]*z-index:\s*20/);
  assert.match(css, /\.site-header nav a, \.language\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.theme-control \.theme-sun\s*\{\s*display:\s*none/);
  assert.match(css, /html\[data-theme="dark"\] \.theme-control \.theme-sun\s*\{\s*display:\s*block/);
});

for (const file of ['index.html', 'pt-br.html', 'projects.html', 'projetos.html']) {
  test(`${file} uses language codes and an accessible sun/moon button without a checkbox`, () => {
    const page = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const header = page.match(/<header class="site-header wrap">([\s\S]*?)<\/header>/)?.[1];
    assert.match(header, /<a class="language"[^>]*title="[^"]+"[^>]*><img class="icon" src="assets\/icons\/languages\.svg"[^>]*>(?:EN-US|PT-BR)<\/a>/);
    assert.match(header, /<button id="theme-toggle"[^>]*type="button"[^>]*\bhidden\b[^>]*aria-label="[^"]+"[^>]*aria-pressed="false"/);
    for (const icon of ['moon', 'sun']) assert.match(header, new RegExp(`src="assets/icons/${icon}\\.svg"`));
    assert.doesNotMatch(header, /type="checkbox"|<label|role="switch"/);
  });
}
