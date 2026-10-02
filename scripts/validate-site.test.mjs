import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateSite } from './validate-site.mjs';

const origin = 'https://nickolaslivero.github.io';
const cli = fileURLToPath(new URL('./validate-site.mjs', import.meta.url));

function page(portuguese = false) {
  const lang = portuguese ? 'pt-BR' : 'en';
  const canonical = portuguese ? `${origin}/pt-br.html` : `${origin}/`;
  const facts = portuguese
    ? '<p>NLivero: <time datetime="2026-08">Ago 2026</time>.</p><p>Bacharelado conclu&#237;do em <time datetime="2025-09">Set 2025</time>.</p>'
    : '<p>NLivero: <time datetime="2026-08">Aug 2026</time>.</p><p>Degree completed <time datetime="2025-09">Sep 2025</time>.</p>';
  return `<!doctype html>
<html lang="${lang}"><head><title>Public portfolio</title>
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="en" href="${origin}/">
<link rel="alternate" hreflang="pt-BR" href="${origin}/pt-br.html">
<link rel="alternate" hreflang="x-default" href="${origin}/">
<link rel="stylesheet" href="assets/site.css?v=1">
<script src="assets/site.js" defer></script></head>
<body><main><header><h1>Software Engineer</h1></header>
${facts}<section><h2>Consulting</h2><p>Technos through IPena.</p></section>
<a href="${portuguese ? 'index.html' : 'pt-br.html'}">Language</a>
<a href="${portuguese ? 'cv-pt.pdf' : 'cv-en.pdf'}">CV</a>
<img src="assets/photo.png" alt="Portrait">
</main></body></html>`;
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'public-site-validation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'assets'));
  for (const [name, content] of Object.entries({
    'index.html': page(), 'pt-br.html': page(true),
    'assets/site.css': 'body { background: url("./photo.png"); width: 60%; }',
    'assets/site.js': 'document.documentElement.dataset.ready = "true";',
    'assets/photo.png': 'synthetic image placeholder',
    'cv-en.pdf': 'synthetic PDF placeholder', 'cv-pt.pdf': 'synthetic PDF placeholder',
  })) writeFileSync(join(root, name), content);
  return root;
}

function edit(root, file, from, to) {
  const path = join(root, file);
  const before = readFileSync(path, 'utf8');
  assert.ok(before.includes(from), `fixture edit target not found: ${file}`);
  writeFileSync(path, before.replace(from, to));
}

function reject(t, change, rule) {
  const root = fixture(t);
  change(root);
  assert.ok(validateSite(root).errors.some((error) => error.includes(`[${rule}]`)), `expected ${rule}`);
}

test('valid bilingual fixtures pass; CSS percentages are not public claims', (t) => {
  const result = validateSite(fixture(t));
  assert.deepEqual(result.errors, []);
  assert.equal(result.filesChecked, 4);
});

test('wording, case, attribute order, quotation and date variants pass', (t) => {
  const root = fixture(t);
  for (const file of ['index.html', 'pt-br.html']) {
    edit(root, file, '<h1>Software Engineer</h1>', "<h1 class='headline'>Backend <em>&amp; Mobile</em></h1>");
    edit(root, file, '<link rel="stylesheet" href="assets/site.css?v=1">', "<LINK href='./assets/site.css' REL='stylesheet'>");
  }
  edit(root, 'index.html', 'Aug 2026', 'August 2026');
  edit(root, 'index.html', 'Sep 2025', 'September 2025');
  edit(root, 'pt-br.html', 'Ago 2026', 'agosto de 2026');
  edit(root, 'pt-br.html', 'Set 2025', 'setembro de 2025');
  assert.deepEqual(validateSite(root).errors, []);
});

test('visible time elements support machine-readable dates', (t) => {
  const root = fixture(t);
  edit(root, 'index.html', 'Aug 2026', 'Company opening');
  edit(root, 'index.html', 'Sep 2025', 'Graduation date');
  assert.deepEqual(validateSite(root).errors, []);
});

test('local CSS and JavaScript imports resolve without dependencies', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'assets/colors.css'), ':root { color: black; }');
  writeFileSync(join(root, 'assets/theme.js'), 'export const theme = "light";');
  writeFileSync(join(root, 'assets/site.css'), '@import "./colors.css";');
  writeFileSync(join(root, 'assets/site.js'), 'import { theme } from "./theme.js";');
  assert.deepEqual(validateSite(root).errors, []);
});

const negatives = [
  ['missing bilingual page', (root) => rmSync(join(root, 'pt-br.html')), 'read'],
  ['wrong language', (root) => edit(root, 'pt-br.html', 'lang="pt-BR"', 'lang="en"'), 'lang'],
  ['empty title', (root) => edit(root, 'index.html', 'Public portfolio', '  '), 'title'],
  ['missing main', (root) => edit(root, 'index.html', '<main>', '<div>'), 'main'],
  ['empty h1', (root) => edit(root, 'index.html', 'Software Engineer', ''), 'h1'],
  ['h1 outside main', (root) => edit(root, 'index.html', '<main><header><h1>Software Engineer</h1></header>', '<h1>Software Engineer</h1><main>'), 'h1'],
  ['wrong canonical', (root) => edit(root, 'index.html', 'rel="canonical"', 'rel="not-canonical"'), 'canonical'],
  ['wrong alternate', (root) => edit(root, 'index.html', 'hreflang="pt-BR"', 'hreflang="fr"'), 'alternate'],
  ['base override', (root) => edit(root, 'index.html', '<head>', '<head><base href="/other/">'), 'base'],
  ['missing stylesheet', (root) => rmSync(join(root, 'assets/site.css')), 'asset'],
  ['missing script', (root) => rmSync(join(root, 'assets/site.js')), 'asset'],
  ['missing image', (root) => rmSync(join(root, 'assets/photo.png')), 'asset'],
  ['missing new CV', (root) => rmSync(join(root, 'cv-en.pdf')), 'asset'],
  ['missing CSS import', (root) => writeFileSync(join(root, 'assets/site.css'), '@import "missing.css";'), 'asset'],
  ['missing JS import', (root) => writeFileSync(join(root, 'assets/site.js'), 'import "./missing.js";'), 'asset'],
  ['external JS dependency', (root) => writeFileSync(join(root, 'assets/site.js'), 'import "some-framework";'), 'dependency'],
  ['path traversal', (root) => edit(root, 'index.html', 'assets/photo.png', '../private.png'), 'asset'],
  ['encoded traversal', (root) => edit(root, 'index.html', 'assets/photo.png', '%2e%2e/private.png'), 'asset'],
  ['shared asset mentioned only in comment', (root) => edit(root, 'index.html', '<script src="assets/site.js" defer></script>', '<!-- assets/site.js -->'), 'shared-asset'],
  ['stale company date', (root) => edit(root, 'index.html', '<time datetime="2026-08">Aug 2026</time>', 'Aug 2024'), 'fact'],
  ['missing completion signal', (root) => edit(root, 'index.html', 'Degree completed', 'Degree in progress'), 'fact'],
  ['missing consulting attribution', (root) => edit(root, 'index.html', 'Technos through IPena', 'Consulting'), 'fact'],
  ['hidden factual signal', (root) => edit(root, 'index.html', '<p>NLivero:', '<p hidden>NLivero:'), 'fact'],
  ['hidden machine-readable company date', (root) => edit(root, 'index.html', '<time datetime="2026-08">Aug 2026</time>', '<span hidden><time datetime="2026-08">Opening</time></span>'), 'fact'],
  ['facts only in comment', (root) => edit(root, 'index.html', 'Technos through IPena.', '<!-- Technos through IPena. -->'), 'fact'],
  ['Windows private path', (root) => edit(root, 'index.html', 'Consulting</h2>', 'Consulting</h2><p>C:\\dev\\private</p>'), 'private-path'],
  ['POSIX private path', (root) => writeFileSync(join(root, 'assets/site.js'), '// /srv/private/config'), 'private-path'],
  ['private runtime IP', (root) => writeFileSync(join(root, 'assets/site.js'), 'const host = "https://192.168.7.23";'), 'private-endpoint'],
  ['Tailscale runtime IP', (root) => writeFileSync(join(root, 'assets/site.js'), 'const host = "https://100.64.1.2";'), 'private-endpoint'],
  ['private IPv6 loopback', (root) => writeFileSync(join(root, 'assets/site.js'), 'const host = "http://[::1]";'), 'private-endpoint'],
  ['runtime request', (root) => writeFileSync(join(root, 'assets/site.js'), 'fetch("https://example.com/status");'), 'runtime'],
  ['private source import', (root) => writeFileSync(join(root, 'assets/site.js'), 'import "../../profile/evidence.md";'), 'private-import'],
  ['credential assignment', (root) => writeFileSync(join(root, 'assets/site.js'), 'const apiKey = "synthetic-not-a-real-secret";'), 'credential'],
  ['unsupported title metric', (root) => edit(root, 'index.html', 'Public portfolio', 'Portfolio 400+'), 'metric'],
  ['unsupported meta description metric', (root) => edit(root, 'index.html', '<head>', '<head><meta name="description" content="Saved 60%">'), 'metric'],
];
for (const [name, change, rule] of negatives) test(name, (t) => reject(t, change, rule));

for (const metric of ['400+', '60%', '70%', '400&#43;', '60&#37;', '70 percent']) {
  test(`unsupported metric ${metric}`, (t) => reject(t,
    (root) => edit(root, 'index.html', 'Software Engineer', `Software Engineer ${metric}`), 'metric'));
}

test('CLI accepts an explicit fixture path and returns useful redacted failures', (t) => {
  const root = fixture(t);
  const good = spawnSync(process.execPath, [cli, root], { encoding: 'utf8' });
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /Site validation passed/);
  writeFileSync(join(root, 'assets/site.js'), 'const password = "synthetic-private-value";');
  const bad = spawnSync(process.execPath, [cli, root], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /assets\/site\.js \[credential\].*line 1/);
  assert.ok(!bad.stderr.includes('synthetic-private-value'));
});

test('CLI rejects extra arguments without checking a site', () => {
  const result = spawnSync(process.execPath, [cli, 'unused', 'extra'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test('missing root is reported without throwing', () => {
  assert.match(validateSite(join(tmpdir(), 'missing-public-site-validation', 'nonexistent')).errors[0], /\[root\]/);
});
