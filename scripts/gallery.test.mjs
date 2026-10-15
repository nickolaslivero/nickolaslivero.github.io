import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/gallery.js', import.meta.url), 'utf8');

test('gallery grid and image minimums keep intrinsic image size within the stage', () => {
  const css = readFileSync(new URL('../assets/site.css', import.meta.url), 'utf8');
  const stage = /^\.gallery-stage\s*\{([^}]+)\}/m.exec(css)?.[1];
  const image = /^#gallery-image\s*\{([^}]+)\}/m.exec(css)?.[1];
  assert.ok(stage, 'expected the shared gallery stage rule');
  assert.ok(image, 'expected the shared gallery image rule');
  assert.match(stage, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(stage, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(image, /min-width:\s*0\s*;/);
  assert.match(image, /min-height:\s*0\s*;/);
  assert.match(image, /(?:^|;)\s*width:\s*100%\s*;/);
  assert.match(image, /(?:^|;)\s*height:\s*100%\s*;/);
  assert.match(image, /object-fit:\s*contain\s*;/);
});

test('mobile gallery uses content height with a bounded image rather than a tall empty stage', () => {
  const css = readFileSync(new URL('../assets/site.css', import.meta.url), 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 540px)'));
  assert.match(mobile, /\.gallery-stage\s*\{[^}]*height:\s*auto\s*;[^}]*min-height:\s*160px/);
  assert.match(mobile, /#gallery-image\s*\{[^}]*height:\s*auto\s*;[^}]*max-height:\s*min\(55dvh,\s*480px\)/);
});

// Only the DOM surface used by the gallery; no browser, network or filesystem writes.
function fixture({ projects = [3], supported = true, missing, readyState = 'complete', original = false, status = false } = {}) {
  const document = { readyState, activeElement: null };
  const requests = [];
  function element(attributes = {}) {
    const attrs = new Map(Object.entries(attributes));
    const listeners = new Map();
    return {
      hidden: false, disabled: false, textContent: '',
      getAttribute: (name) => attrs.get(name) ?? null,
      setAttribute: (name, value) => attrs.set(name, String(value)),
      removeAttribute: (name) => attrs.delete(name),
      set src(value) { attrs.set('src', value); requests.push(value); },
      get src() { return attrs.get('src') ?? ''; },
      set innerHTML(_) { assert.fail('Text must not be inserted as HTML'); },
      focus() { document.activeElement = this; },
      addEventListener(type, handler, options) {
        const entries = listeners.get(type) ?? [];
        entries.push({ handler, once: options?.once });
        listeners.set(type, entries);
      },
      fire(type, properties = {}) {
        const event = {
          target: this, defaultPrevented: false,
          preventDefault() { this.defaultPrevented = true; },
          ...properties,
        };
        for (const entry of [...(listeners.get(type) ?? [])]) {
          entry.handler(event);
          if (entry.once) listeners.get(type).splice(listeners.get(type).indexOf(entry), 1);
        }
        this[`on${type}`]?.(event);
        return event;
      },
    };
  }
  const events = element();
  document.addEventListener = events.addEventListener;
  document.fire = events.fire;
  Object.defineProperty(document, 'documentElement', {
    get() { assert.fail('The gallery must not access theme state'); },
  });
  const parts = Object.fromEntries(
    ['title', 'image', 'caption', 'count', 'close', 'prev', 'next', 'error'].map((id) => [id, element()]),
  );
  if (original) {
    parts.original = element({ target: '_blank', rel: 'noopener', 'aria-label': 'Localized original', title: 'Localized original' });
  }
  if (status) {
    parts.status = element({ role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  }
  parts.error.textContent = 'Localized image error';
  parts.error.hidden = true;
  parts.close.setAttribute('aria-label', 'Localized close');
  if (!status) parts.count.setAttribute('aria-live', 'polite');
  const dialog = element();
  dialog.open = false;
  dialog.querySelector = (selector) => parts[selector.replace('#gallery-', '')] ?? null;
  dialog.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 400 });
  dialog.showModal = supported ? () => { dialog.open = true; } : undefined;
  dialog.close = () => {
    if (!dialog.open) return;
    dialog.open = false;
    dialog.fire('close');
  };
  const galleries = projects.map((size, projectIndex) => {
    const links = Array.from({ length: size }, (_, index) => element({
      href: `assets/previews/project-${projectIndex}-${index}.jpg`,
      'data-caption': `Caption ${projectIndex}-${index}`,
    }));
    const trigger = element();
    trigger.hidden = true;
    const list = element();
    list.querySelectorAll = (selector) => {
      assert.equal(selector, ':scope > li > a');
      return links;
    };
    const project = element({ 'data-gallery-title': `Project ${projectIndex}` });
    project.querySelector = (selector) => ({
      'button.gallery-trigger': trigger, 'ul.gallery-links': list,
    })[selector] ?? null;
    return { project, trigger, list, links };
  });
  document.getElementById = (id) => id === 'project-gallery-dialog' && missing !== 'dialog' ? dialog : null;
  document.querySelectorAll = (selector) => {
    assert.equal(selector, '.project-gallery');
    return galleries.map((gallery) => gallery.project);
  };
  if (missing && missing !== 'dialog') delete parts[missing];
  const init = () => runInNewContext(source, { document });
  return { document, dialog, parts, galleries, requests, init };
}

test('enhancement is per project, with no global three-image limit or eager requests', () => {
  const f = fixture({ projects: [1, 2, 3, 0, 4] });
  f.init();
  assert.deepEqual(f.requests, []);
  f.galleries.forEach((gallery, index) => {
    assert.equal(gallery.trigger.hidden, index > 2);
    assert.equal(gallery.list.hidden, index < 3);
  });
});

test('mixed local JPG and PNG images navigate without changing their source paths', () => {
  const f = fixture();
  const paths = ['assets/previews/android-main.png', 'assets/previews/dashboard.jpg', 'assets/previews/android-second.png'];
  f.galleries[0].links.forEach((link, index) => link.setAttribute('href', paths[index]));
  f.init();
  assert.equal(f.galleries[0].trigger.hidden, false);
  f.galleries[0].trigger.fire('click');
  assert.equal(f.parts.image.src, paths[0]);
  f.parts.next.fire('click');
  assert.equal(f.parts.image.src, paths[1]);
  f.parts.next.fire('click');
  assert.equal(f.parts.image.src, paths[2]);
  assert.equal(f.parts.count.textContent, '3 / 3');
  assert.equal(f.parts.next.disabled, true);
  assert.deepEqual(f.requests, paths);
});

test('optional original link follows navigation and clears on every close', () => {
  const f = fixture({ projects: [3, 1], original: true });
  const paths = ['assets/previews/wide-dashboard.jpg', 'assets/previews/android-main.png', 'assets/previews/android-second.png'];
  f.galleries[0].links.forEach((link, index) => link.setAttribute('href', paths[index]));
  const original = f.parts.original;
  f.init();
  assert.equal(original.getAttribute('href'), null);
  f.galleries[0].trigger.fire('click');
  assert.equal(original.getAttribute('href'), paths[0]);
  f.parts.next.fire('click');
  assert.equal(original.getAttribute('href'), paths[1]);
  f.dialog.fire('keydown', { key: 'ArrowRight' });
  assert.equal(original.getAttribute('href'), paths[2]);
  f.parts.next.fire('click');
  assert.equal(original.getAttribute('href'), paths[2]);
  f.parts.prev.fire('click');
  assert.equal(original.getAttribute('href'), paths[1]);
  f.dialog.fire('keydown', { key: 'ArrowLeft' });
  assert.equal(original.getAttribute('href'), paths[0]);
  assert.equal(original.fire('click').defaultPrevented, false);
  f.parts.close.fire('click');
  assert.equal(original.getAttribute('href'), null);
  f.galleries[1].trigger.fire('click');
  assert.equal(original.getAttribute('href'), 'assets/previews/project-1-0.jpg');
  f.dialog.close();
  assert.equal(original.getAttribute('href'), null);
  f.galleries[0].trigger.fire('click');
  assert.equal(original.getAttribute('href'), paths[0]);
  f.dialog.fire('click', { clientX: 0, clientY: 0 });
  assert.equal(original.getAttribute('href'), null);
  for (const [name, value] of Object.entries({
    target: '_blank', rel: 'noopener', 'aria-label': 'Localized original', title: 'Localized original',
  })) assert.equal(original.getAttribute(name), value);
});

test('navigation keeps focus on an enabled control at each boundary', () => {
  const f = fixture();
  f.init();
  f.galleries[0].trigger.fire('click');
  f.parts.next.focus();
  f.parts.next.fire('click');
  assert.equal(f.document.activeElement, f.parts.next);
  f.parts.next.fire('click');
  assert.equal(f.parts.next.disabled, true);
  assert.equal(f.document.activeElement, f.parts.close);
  f.parts.prev.focus();
  f.parts.prev.fire('click');
  f.parts.prev.fire('click');
  assert.equal(f.parts.prev.disabled, true);
  assert.equal(f.document.activeElement, f.parts.close);
  f.parts.close.focus();
  f.dialog.fire('keydown', { key: 'ArrowRight' });
  assert.equal(f.document.activeElement, f.parts.close);
});

test('single-image galleries hide navigation and restore it for larger galleries', () => {
  const css = readFileSync(new URL('../assets/site.css', import.meta.url), 'utf8');
  assert.match(css, /\.icon-button\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
  const f = fixture({ projects: [1, 3] });
  f.init();
  f.galleries[0].trigger.fire('click');
  assert.equal(f.parts.count.textContent, '1 / 1');
  assert.equal(f.parts.prev.hidden, true);
  assert.equal(f.parts.next.hidden, true);
  assert.equal(f.document.activeElement, f.parts.close);
  f.dialog.close();
  f.galleries[1].trigger.fire('click');
  assert.equal(f.parts.prev.hidden, false);
  assert.equal(f.parts.next.hidden, false);
  assert.equal(f.parts.prev.disabled, true);
  assert.equal(f.parts.next.disabled, false);
});

test('optional status updates localized caption and position together and clears on close', () => {
  const f = fixture({ projects: [2], status: true });
  const captions = ['Painel de produ\u00e7\u00e3o', 'Inspe\u00e7\u00e3o <b>local</b>'];
  f.galleries[0].links.forEach((link, index) => link.setAttribute('data-caption', captions[index]));
  const status = f.parts.status;
  const updates = [];
  let text = '';
  Object.defineProperty(status, 'textContent', {
    get: () => text,
    set(value) { text = value; updates.push(value); },
  });
  f.init();
  assert.deepEqual(updates, []);
  f.galleries[0].trigger.fire('click');
  assert.equal(status.textContent, `${captions[0]} (1 / 2)`);
  assert.equal(f.parts.count.textContent, '1 / 2');
  f.parts.next.fire('click');
  assert.equal(status.textContent, `${captions[1]} (2 / 2)`);
  assert.equal(f.parts.count.textContent, '2 / 2');
  f.parts.next.fire('click');
  assert.equal(updates.length, 2);
  f.dialog.fire('keydown', { key: 'ArrowLeft' });
  assert.equal(status.textContent, `${captions[0]} (1 / 2)`);
  f.parts.close.fire('click');
  assert.equal(status.textContent, '');
  assert.deepEqual(updates, [
    `${captions[0]} (1 / 2)`, `${captions[1]} (2 / 2)`, `${captions[0]} (1 / 2)`, '',
  ]);
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.getAttribute('aria-atomic'), 'true');
  assert.equal(f.parts.count.getAttribute('aria-live'), null);
});

test('PNG galleries retain one-to-three bounds per project, not globally', () => {
  const f = fixture({ projects: [1, 2, 3, 3, 3, 3, 0, 4] });
  for (const gallery of f.galleries) {
    for (const link of gallery.links) {
      link.setAttribute('href', link.getAttribute('href').replace('.jpg', '.png'));
    }
  }
  f.init();
  f.galleries.forEach((gallery, index) => {
    assert.equal(gallery.trigger.hidden, index >= 6);
    assert.equal(gallery.list.hidden, index < 6);
  });
  assert.deepEqual(f.requests, []);
});

for (const options of [
  { supported: false }, { missing: 'dialog' },
  ...['title', 'image', 'caption', 'count', 'close', 'prev', 'next', 'error'].map((missing) => ({ missing })),
]) {
  test(`incomplete or unsupported dialog preserves fallback: ${JSON.stringify(options)}`, () => {
    const f = fixture(options);
    f.init();
    assert.equal(f.galleries[0].trigger.hidden, true);
    assert.equal(f.galleries[0].list.hidden, false);
    assert.deepEqual(f.requests, []);
  });
}

test('initialization also works when loaded before the HTML', () => {
  const f = fixture({ readyState: 'loading' });
  f.init();
  assert.equal(f.galleries[0].trigger.hidden, true);
  f.document.fire('DOMContentLoaded');
  assert.equal(f.galleries[0].trigger.hidden, false);
});

test('one invalid URL leaves that entire project as fallback, not other projects', () => {
  for (const href of [
    'https://example.com/image.jpg', '//example.com/image.jpg', 'data:image/jpeg;base64,AA==',
    'assets/previews/../image.jpg', '/assets/previews/image.jpg', 'assets/previews/image.jpeg',
    'assets/previews/IMAGE.jpg', 'assets/previews/image.jpg?x=1', 'assets/previews/image.jpg#x',
    'assets/previews/image.jpg\n', ' assets/previews/image.jpg', 'assets/previews/image%2e.jpg',
    'assets/previews/sub/image.jpg', '',
    'assets/previews/image.svg', 'assets/previews/image.gif', 'assets/previews/image.webp',
    'assets/previews/image.PNG', 'assets/previews/image.JPG',
    'https://example.com/image.png', '//example.com/image.png', 'data:image/png;base64,AA==',
    'assets/previews/../image.png', 'assets/previews/%2e%2e/image.png', '/assets/previews/image.png',
    'assets/previews/image.png?x=1', 'assets/previews/image.png#x', 'assets/previews/image.png\n',
    ' assets/previews/image.png', 'assets/previews/sub/image.png', 'assets/previews/IMAGE.png',
  ]) {
    const f = fixture({ projects: [2, 1], original: true });
    f.galleries[0].links[1].setAttribute('href', href);
    f.init();
    assert.equal(f.galleries[0].trigger.hidden, true, href);
    assert.equal(f.galleries[0].list.hidden, false, href);
    assert.equal(f.galleries[1].trigger.hidden, false, href);
    f.galleries[0].trigger.fire('click');
    assert.equal(f.parts.original.getAttribute('href'), null, href);
    assert.deepEqual(f.requests, []);
  }
});

test('missing localized title, caption or error text preserves fallback', () => {
  for (const field of ['title', 'caption', 'error']) {
    const f = fixture();
    if (field === 'title') f.galleries[0].project.removeAttribute('data-gallery-title');
    if (field === 'caption') f.galleries[0].links[0].removeAttribute('data-caption');
    if (field === 'error') f.parts.error.textContent = ' ';
    f.init();
    assert.equal(f.galleries[0].trigger.hidden, true);
    assert.equal(f.galleries[0].list.hidden, false);
  }
});

test('opening uses localized plain text, focuses close and bounds navigation', () => {
  const f = fixture();
  const { image, title, caption, count, close, prev, next } = f.parts;
  f.galleries[0].links[0].setAttribute('data-caption', '<b>Caption & text</b>');
  f.init();
  f.galleries[0].trigger.fire('click');
  assert.equal(f.dialog.open, true);
  assert.equal(f.document.activeElement, close);
  assert.equal(title.textContent, 'Project 0');
  assert.equal(caption.textContent, '<b>Caption & text</b>');
  assert.equal(image.alt, caption.textContent);
  assert.equal(count.textContent, '1 / 3');
  assert.equal(prev.disabled, true);
  assert.equal(next.disabled, false);
  prev.fire('click');
  assert.equal(count.textContent, '1 / 3');
  next.fire('click');
  assert.equal(count.textContent, '2 / 3');
  assert.equal(prev.disabled, false);
  next.fire('click');
  assert.equal(count.textContent, '3 / 3');
  assert.equal(next.disabled, true);
  next.fire('click');
  assert.equal(count.textContent, '3 / 3');
  assert.equal(f.requests.length, 3);
  assert.equal(close.getAttribute('aria-label'), 'Localized close');
  assert.equal(count.getAttribute('aria-live'), 'polite');
});

test('a single-image gallery disables both directions and projects reopen at the first image', () => {
  const f = fixture({ projects: [3, 1] });
  f.init();
  f.galleries[0].trigger.fire('click');
  f.parts.next.fire('click');
  f.parts.close.fire('click');
  assert.equal(f.document.activeElement, f.galleries[0].trigger);
  f.galleries[1].trigger.fire('click');
  assert.equal(f.parts.title.textContent, 'Project 1');
  assert.equal(f.parts.count.textContent, '1 / 1');
  assert.equal(f.parts.prev.disabled, true);
  assert.equal(f.parts.next.disabled, true);
  f.parts.close.fire('click');
  assert.equal(f.document.activeElement, f.galleries[1].trigger);
  f.galleries[0].trigger.fire('click');
  assert.equal(f.parts.count.textContent, '1 / 3');
});

test('arrow keys act only while open without alt/ctrl/meta; Escape stays native', () => {
  const f = fixture();
  f.init();
  assert.equal(f.dialog.fire('keydown', { key: 'ArrowRight' }).defaultPrevented, false);
  f.galleries[0].trigger.fire('click');
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
    assert.equal(f.dialog.fire('keydown', { key: 'ArrowRight', [modifier]: true }).defaultPrevented, false);
    assert.equal(f.parts.count.textContent, '1 / 3');
  }
  assert.equal(f.dialog.fire('keydown', { key: 'ArrowRight', shiftKey: true }).defaultPrevented, true);
  assert.equal(f.parts.count.textContent, '2 / 3');
  f.dialog.fire('keydown', { key: 'ArrowLeft' });
  assert.equal(f.parts.count.textContent, '1 / 3');
  assert.equal(f.dialog.fire('keydown', { key: 'Escape' }).defaultPrevented, false);
  assert.equal(f.dialog.fire('cancel').defaultPrevented, false);
  f.dialog.close(); // Simulate the native default; not browser validation of Escape.
  assert.equal(f.document.activeElement, f.galleries[0].trigger);
});

test('only backdrop clicks outside the rectangle close the dialog', () => {
  const f = fixture();
  f.init();
  f.galleries[0].trigger.fire('click');
  f.dialog.fire('click', { clientX: 200, clientY: 200 });
  assert.equal(f.dialog.open, true);
  f.dialog.fire('click', { target: f.parts.image, clientX: 0, clientY: 0 });
  assert.equal(f.dialog.open, true);
  for (const [clientX, clientY] of [[99, 200], [501, 200], [200, 99], [200, 401]]) {
    f.dialog.fire('click', { clientX, clientY });
    assert.equal(f.dialog.open, false);
    assert.equal(f.document.activeElement, f.galleries[0].trigger);
    f.galleries[0].trigger.fire('click');
  }
});

test('loading, visible errors and captions reset across navigation and close', () => {
  const f = fixture();
  const { image, error, next, caption } = f.parts;
  f.init();
  f.galleries[0].trigger.fire('click');
  assert.equal(image.hidden, true);
  assert.equal(image.loading, 'eager');
  assert.equal(image.getAttribute('aria-busy'), 'true');
  image.fire('load');
  assert.equal(image.hidden, false);
  assert.equal(image.getAttribute('aria-busy'), 'false');
  const staleLoad = image.onload;
  const staleError = image.onerror;
  next.fire('click');
  staleLoad();
  staleError();
  assert.equal(image.hidden, true);
  assert.equal(error.hidden, true);
  assert.equal(image.getAttribute('aria-busy'), 'true');
  image.fire('error');
  assert.equal(image.getAttribute('aria-busy'), 'false');
  assert.equal(error.hidden, false);
  assert.equal(error.textContent, 'Localized image error');
  next.fire('click');
  assert.equal(error.hidden, true);
  assert.equal(caption.textContent, 'Caption 0-2');
  const closedLoad = image.onload;
  const closedError = image.onerror;
  f.parts.close.fire('click');
  closedLoad();
  closedError();
  assert.equal(image.src, '');
  assert.equal(image.hidden, true);
  assert.equal(image.getAttribute('aria-busy'), 'false');
  assert.equal(error.hidden, true);
  assert.equal(caption.textContent, '');
});

test('a showModal failure restores fallback and is not swallowed', () => {
  const f = fixture({ projects: [1, 2] });
  f.dialog.showModal = () => { throw new Error('Synthetic modal failure'); };
  f.init();
  assert.throws(() => f.galleries[0].trigger.fire('click'), /Synthetic modal failure/);
  for (const gallery of f.galleries) {
    assert.equal(gallery.trigger.hidden, true);
    assert.equal(gallery.list.hidden, false);
  }
  assert.deepEqual(f.requests, []);
});
