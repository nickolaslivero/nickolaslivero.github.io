import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const publicOrigin = 'https://nickolaslivero.github.io';
const pages = [
  { file: 'index.html', lang: 'en', url: `${publicOrigin}/` },
  { file: 'pt-br.html', lang: 'pt-br', url: `${publicOrigin}/pt-br.html` },
];
const alternates = new Map([
  ['en', pages[0].url], ['pt-br', pages[1].url], ['x-default', pages[0].url],
]);
const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.xml', '.txt']);
const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));

function decode(text) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', plus: '+', percnt: '%' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? whole;
    const number = entity[1].toLowerCase() === 'x'
      ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return number <= 0x10ffff ? String.fromCodePoint(number) : whole;
  });
}

// A small scanner for these static pages, not a browser or an HTML conformance parser.
function scanHtml(source) {
  const clean = source.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\r\n]/g, ' '))
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,
      (_, open, tag, body, close) => open + body.replace(/[^\r\n]/g, ' ') + close);
  const root = { tag: '#document', children: [] };
  const stack = [root];
  const nodes = [];
  let cursor = 0;
  for (const match of clean.matchAll(/<\/?[a-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi)) {
    stack.at(-1).children.push(decode(clean.slice(cursor, match.index)));
    cursor = match.index + match[0].length;
    const tag = /^<\/?([\w-]+)/.exec(match[0])[1].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex((node) => node.tag === tag);
      if (index > 0) stack.length = index;
      continue;
    }
    const attrs = Object.create(null);
    const body = match[0].slice(tag.length + 1, -1);
    for (const attr of body.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs[attr[1].toLowerCase()] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    const node = { tag, attrs, children: [], line: clean.slice(0, match.index).split('\n').length };
    stack.at(-1).children.push(node);
    nodes.push(node);
    if (!voidTags.has(tag) && !match[0].endsWith('/>')) stack.push(node);
  }
  stack.at(-1).children.push(decode(clean.slice(cursor)));
  return { root, nodes };
}

function visible(node) {
  if (typeof node === 'string') return node;
  if (['head', 'script', 'style'].includes(node.tag)) return '';
  if ('hidden' in (node.attrs ?? {}) || node.attrs?.['aria-hidden'] === 'true') return '';
  return node.children.map(visible).join(' ').replace(/\s+/g, ' ').trim();
}

function normalized(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function contained(root, target) {
  const path = relative(root, target);
  return path !== '..' && !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(path);
}

export function validateSite(directory = fileURLToPath(new URL('../', import.meta.url))) {
  const errors = [];
  const fail = (file, rule, message) => errors.push(`${file} [${rule}]: ${message}`);
  let root;
  try {
    root = realpathSync(resolve(directory));
    if (!statSync(root).isDirectory()) throw new Error('not a directory');
  } catch {
    return { errors: ['site [root]: expected a readable site directory'], filesChecked: 0 };
  }
  const sources = new Map();
  function read(file) {
    if (sources.has(file)) return sources.get(file);
    try {
      const target = realpathSync(resolve(root, file));
      if (!contained(root, target) || !statSync(target).isFile()) {
        fail(file, 'boundary', 'public file must stay inside the site directory');
        return null;
      }
      const text = readFileSync(target, 'utf8');
      sources.set(file, text);
      return text;
    } catch {
      fail(file, 'read', 'required public file is missing or unreadable');
      return null;
    }
  }

  function reference(file, value, context, module = false) {
    const ref = decode(value).trim();
    if (!ref || ref.startsWith('#') || /^(?:mailto|tel|data):/i.test(ref)) return;
    let url;
    try {
      const base = new URL(file.replaceAll('\\', '/'), `${publicOrigin}/`);
      // Check traversal before URL normalization can erase it.
      if (!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(ref)) {
        const local = decodeURIComponent(ref.split(/[?#]/)[0]);
        const candidate = resolve(local.startsWith('/') ? root : dirname(resolve(root, file)), local.replace(/^\//, ''));
        if (!contained(root, candidate)) throw new Error('outside root');
      }
      url = new URL(ref, base);
    } catch {
      fail(file, 'asset', `${context}: invalid reference or path outside site`);
      return;
    }
    if (!['https:', 'http:'].includes(url.protocol)) {
      fail(file, 'asset', `${context}: unsupported URL scheme`);
      return;
    }
    if (url.origin !== publicOrigin) {
      if (module) fail(file, 'dependency', `${context}: JavaScript modules must be local`);
      return; // No network requests, including external link checks.
    }
    let target;
    try {
      let path = decodeURIComponent(url.pathname).slice(1);
      if (!path || path.endsWith('/')) path += 'index.html';
      target = realpathSync(resolve(root, path));
      if (!contained(root, target) || !statSync(target).isFile()) throw new Error('not a local file');
    } catch {
      fail(file, 'asset', `${context}: target missing, unreadable, or outside site`);
    }
  }

  for (const page of pages) {
    const source = read(page.file);
    if (source === null) continue;
    const { root: document, nodes } = scanHtml(source);
    const elements = (tag) => nodes.filter((node) => node.tag === tag);
    const html = elements('html');
    if (html.length !== 1 || html[0].attrs.lang?.toLowerCase() !== page.lang) {
      fail(page.file, 'lang', `expected one html element with lang=${page.lang}`);
    }
    const titles = elements('title');
    if (titles.length !== 1 || !visible(titles[0])) fail(page.file, 'title', 'expected one non-empty title');
    const mains = elements('main');
    if (mains.length !== 1 || !visible(mains[0])) fail(page.file, 'main', 'expected one non-empty semantic main');
    const headings = elements('h1');
    if (headings.length !== 1 || !visible(headings[0]) || !mains[0] || !mains[0].children.some(function includes(node) {
      return node === headings[0] || (typeof node !== 'string' && node.children.some(includes));
    })) fail(page.file, 'h1', 'expected one non-empty h1 inside main');
    if (elements('base').length) fail(page.file, 'base', 'base overrides are not supported by local validation');
    const links = elements('link');
    const hasRel = (node, rel) => node.attrs.rel?.toLowerCase().split(/\s+/).includes(rel);
    const canonical = links.filter((node) => hasRel(node, 'canonical'));
    if (canonical.length !== 1 || canonical[0].attrs.href !== page.url) {
      fail(page.file, 'canonical', 'expected the public canonical URL for this language');
    }
    for (const [lang, url] of alternates) {
      const matches = links.filter((node) => hasRel(node, 'alternate') && node.attrs.hreflang?.toLowerCase() === lang);
      if (matches.length !== 1 || matches[0].attrs.href !== url) {
        fail(page.file, 'alternate', `expected one public alternate URL for ${lang}`);
      }
    }
    for (const node of nodes) {
      for (const attr of ['href', 'src', 'poster']) {
        if (attr in node.attrs) reference(page.file, node.attrs[attr], `${node.tag}.${attr} at line ${node.line}`, node.tag === 'script');
      }
      if (node.attrs.srcset) {
        for (const entry of node.attrs.srcset.split(',')) reference(page.file, entry.trim().split(/\s+/)[0], `srcset at line ${node.line}`);
      }
    }
    for (const [asset, tag, attr] of [['assets/site.css', 'link', 'href'], ['assets/site.js', 'script', 'src']]) {
      if (!elements(tag).some((node) => {
        if (tag === 'link' && !hasRel(node, 'stylesheet')) return false;
        try { return new URL(node.attrs[attr], `${publicOrigin}/`).pathname === `/${asset}`; }
        catch { return false; }
      })) fail(page.file, 'shared-asset', `expected ${tag} reference to ${asset}`);
    }
    const metadata = [...titles.map(visible), ...elements('meta').map((node) => node.attrs.content ?? '')];
    const text = normalized([visible(document), ...metadata].join(' '));
    if (/(?:\b400\s*\+|\b(?:60|70)\s*(?:%|percent\b|por cento\b))/.test(text)) {
      fail(page.file, 'metric', 'unsupported 400+, 60%, or 70% public claim');
    }
    const mainText = normalized(mains[0] ? visible(mains[0]) : '');
    function visibleDates(node) {
      if (typeof node === 'string' || !visible(node)) return [];
      return [...(node.tag === 'time' ? [node.attrs.datetime ?? ''] : []), ...node.children.flatMap(visibleDates)];
    }
    const dates = mains[0] ? visibleDates(mains[0]) : [];
    const signals = [
      ['NLivero and August 2026', /\bnlivero\b/.test(mainText) && (/(?:\baug(?:ust)?\.?\s+(?:de\s+)?2026\b|\bago(?:sto)?\.?\s+(?:de\s+)?2026\b|\b2026-08(?:-\d{2})?\b)/.test(mainText) || dates.some((date) => /^2026-08(?:-\d{2})?$/.test(date)))],
      ['degree completed September 2025', /\b(?:complet(?:ed|ion)|concluid[oa]|conclusao|graduated|formad[oa])\b/.test(mainText) && (/(?:\bsep(?:t(?:ember)?)?\.?\s+(?:de\s+)?2025\b|\bset(?:embro)?\.?\s+(?:de\s+)?2025\b|\b2025-09(?:-\d{2})?\b)/.test(mainText) || dates.some((date) => /^2025-09(?:-\d{2})?$/.test(date)))],
      ['Technos/IPena', /\btechnos\b/.test(mainText) && /\bipena\b/.test(mainText)],
    ];
    for (const [name, present] of signals) if (!present) fail(page.file, 'fact', `missing visible signal: ${name}`);
  }

  function collect(folder = '') {
    for (const entry of readdirSync(resolve(root, folder), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['scripts', 'node_modules'].includes(entry.name)) continue;
      const file = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) fail(file, 'boundary', 'public symlinks are not supported');
      else if (entry.isDirectory()) collect(file);
      else if (textExtensions.has(extname(file))) read(file);
    }
  }
  try { collect(); } catch { fail('site', 'read', 'cannot enumerate public files'); }
  for (const [file, source] of sources) {
    const text = decode(source);
    const rules = [
      ['private-path', /(?:\b[a-z]:[\\/]|file:\/\/|\\\\[\w.-]+\\|\/(?:home|Users|srv|etc|mnt|var|opt)\/)/i, 'private filesystem path'],
      ['private-endpoint', /(?:\blocalhost\b|\b127(?:\.\d{1,3}){3}\b|\b0\.0\.0\.0\b|\b10(?:\.\d{1,3}){3}\b|\b192\.168(?:\.\d{1,3}){2}\b|\b172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}\b|\b169\.254(?:\.\d{1,3}){2}\b|\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}\b|\[::1\]|\b[\w.-]+\.(?:local|internal|ts\.net)\b|\bhome-server-(?:tailscale|lan)\b)/i, 'private/runtime host'],
      ['credential', /(?:-----BEGIN [\w ]*PRIVATE KEY-----|\b(?:gh[pousr]_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b|\bBearer\s+[\w.+/=-]{8,}|\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\b["']?\s*[:=]\s*["'][^"']+["']|https?:\/\/[^\s/"'<>]+:[^\s/"'<>]+@)/i, 'credential-like material'],
      ['runtime', /(?:\b(?:fetch|WebSocket|EventSource|XMLHttpRequest)\s*\(|https?:\/\/[^\s"'<>]+\/(?:api|heartbeat|healthz?|metrics|swagger)(?:[/?#"'\s]|$))/i, 'runtime request or endpoint in a static public site'],
      ['private-import', /(?:\.\.\/(?:\.\.\/)*(?:resume|profile|_control)\/|\b(?:master-resume|evidence\.md)\b)/i, 'private source import/reference'],
    ];
    for (const [rule, pattern, message] of rules) {
      const match = pattern.exec(text);
      if (match) fail(file, rule, `${message} at line ${text.slice(0, match.index).split('\n').length} (value redacted)`);
    }
    if (extname(file) === '.css') {
      for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)|@import\s+["']([^"']+)["']/gi)) {
        reference(file, match[1] ?? match[2] ?? match[3] ?? match[4], 'CSS URL/import');
      }
    }
    if (['.js', '.mjs'].includes(extname(file))) {
      for (const match of source.matchAll(/(?:\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?|\bimport\s*\()\s*["']([^"']+)["']/g)) {
        const specifier = match[1];
        if (!specifier.startsWith('.') && !specifier.startsWith('/')) fail(file, 'dependency', 'JavaScript imports must be local relative paths');
        else reference(file, specifier, 'JavaScript import', true);
      }
    }
  }
  return { errors, filesChecked: sources.size };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length > 3) {
    console.error('Usage: node scripts/validate-site.mjs [site-directory]');
    process.exitCode = 2;
  } else {
    const result = validateSite(process.argv[2]);
    if (result.errors.length) {
      for (const error of result.errors) console.error(error);
      console.error(`Site validation failed: ${result.errors.length} issue(s).`);
      process.exitCode = 1;
    } else console.log(`Site validation passed (${result.filesChecked} public text files; no network requests).`);
  }
}
