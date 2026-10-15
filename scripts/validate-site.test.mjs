import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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

function addCatalogs(root) {
  writeFileSync(join(root, 'assets/projects.css'), '.catalog { min-width: 0; }');
  for (const [file, lang, heading] of [
    ['projects.html', 'en', 'Project collection'], ['projetos.html', 'pt-BR', 'Projetos e pesquisa'],
  ]) {
    writeFileSync(join(root, file), `<!doctype html>
<html lang="${lang}"><head><title>${heading}</title>
<link rel="canonical" href="${origin}/${file}">
<link rel="alternate" hreflang="en" href="${origin}/projects.html">
<link rel="alternate" hreflang="pt-BR" href="${origin}/projetos.html">
<link rel="alternate" hreflang="x-default" href="${origin}/projects.html">
<link rel="stylesheet" href="assets/site.css">
<link rel="stylesheet" href="assets/projects.css">
<script src="assets/site.js" defer></script></head>
<body><main><h1>${heading}</h1><section><h2>Research</h2>
<details><summary>Research prototype</summary><p>Academic contribution, not a production service.</p></details>
<img src="assets/photo.png" alt="Portrait"></section></main></body></html>`);
  }
}

test('optional catalog pair passes without homepage founder, degree or client facts', (t) => {
  const root = fixture(t);
  addCatalogs(root);
  const result = validateSite(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.filesChecked, 7);
});

const catalogInventory = [
  ['professional', ['sistech', 'irepos-1', 'factory-app', 'ranking', 'payroll-cloud', 'ipena-site']],
  ['independent', ['project-management', 'whatsapp-assistants', 'offline-receipts', 'python-migration']],
  ['infrastructure', ['career-hub', 'self-hosted']],
  ['pilots', ['irepos-2', 'erp-assistance', 'cafe-management']],
  ['research', ['voice-assistant', 'android-qa', 'bert-qa', 'embedded-research']],
  ['academic', [
    'sorting-algorithms', 'vaccination-records', 'wallet-transfers', 'auction-prototype',
    'encrypted-chat', 'culture-chatbot', 'laptop-recommendation', 'pet-monitor', 'flask-calendar',
    'thermal-printer', 'retrieval-assistant', 'pizza-orders', 'movie-recommendation', 'classroom-app',
    'java-bank', 'route-optimization', 'pong-study', 'regex-study',
  ]],
  ['historical', [
    'box-checking', 'offline-pdf', 'parking-demo', 'liturgical-calendar', 'substitution-cipher',
    'protheus-study', 'macos-study', 'campaign-attribution',
  ]],
];

for (const [file, categoryLabel] of [
  ['projects.html', 'Project categories'], ['projetos.html', 'Categorias de projetos'],
]) {
  test(`${file} retains 45 grouped entries and native details without additional runtime`, () => {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const indexes = [...source.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)]
      .filter(([, attrs]) => /\bclass="collection-index wrap"/.test(attrs));
    assert.equal(indexes.length, 1, 'one native category disclosure');
    assert.equal([...source.matchAll(/\bclass="collection-index wrap"/g)].length, 1, 'one index wrapper');
    assert.doesNotMatch(indexes[0][1], /\bopen(?:\s|=|$)/i, 'closed by default at every viewport');
    const navigation = indexes[0][2].match(new RegExp(
      `^\\s*<summary>${categoryLabel}</summary>\\s*<nav aria-label="${categoryLabel}">([\\s\\S]*?)</nav>\\s*$`));
    assert.ok(navigation, 'localized native summary followed by a labeled navigation landmark');
    assert.deepEqual([...navigation[1].matchAll(/<a href="#([^"]+)">[^<]+<\/a>/g)]
      .map(([, target]) => target), catalogInventory.map(([id]) => id));
    const groups = [...source.matchAll(/<section class="collection-category wrap" id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)]
      .map(([, id, section]) => [id, [...section.matchAll(/<article class="project-row" id="([^"]+)"/g)]
        .map(([, project]) => project)]);
    assert.deepEqual(groups, catalogInventory);
    const entries = [...source.matchAll(/<article class="project-row" id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
    assert.equal(entries.length, 45);
    for (const [, id, entry] of entries) {
      assert.equal([...entry.matchAll(/<details>/g)].length, 1, `${id}: native details`);
      assert.match(entry, /<details><summary>[^<]+<\/summary>/, `${id}: named disclosure`);
      for (const name of ['project-state', 'project-context', 'project-summary']) {
        assert.match(entry, new RegExp(`<p class="${name}">[^<]+</p>`), `${id}: ${name}`);
      }
    }
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
    assert.equal(new Set(ids).size, ids.length, 'all IDs must be unique');
    for (const [, target] of source.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), target);
    assert.deepEqual([...source.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)]
      .map(([script]) => script), ['<script src="assets/site.js" defer></script>']);
    assert.doesNotMatch(source, /class="(?:project-gallery|gallery-trigger)"/);
    for (const href of [
      'https://wa.me/5592988023281', 'https://doi.org/10.5753/sbie.2024.244662',
      'https://sol.sbc.org.br/index.php/sbie/article/view/31461', 'https://github.com/nickolaslivero/PAIC',
    ]) assert.equal(source.split(`href="${href}"`).length - 1, 1, `one approved link: ${href}`);
  });
}

for (const missing of ['projects.html', 'projetos.html']) {
  test(`an optional catalog requires its missing counterpart: ${missing}`, (t) => {
    reject(t, (root) => {
      addCatalogs(root);
      rmSync(join(root, missing));
    }, 'read');
  });
}

for (const [homepage, catalog] of [
  ['index.html', 'projects.html'], ['pt-br.html', 'projetos.html'],
]) {
  test(`${homepage} leads with client value and keeps independent work attributed`, () => {
    const source = readFileSync(new URL(`../${homepage}`, import.meta.url), 'utf8');
    const intro = source.match(/<section class="intro"[\s\S]*?<\/section>/)[0];
    assert.match(intro, /custom web and Android software|sistemas web e Android sob medida/);
    assert.doesNotMatch(intro, /IPena|Technos/);
    const timeline = source.match(/<ol class="timeline">([\s\S]*?)<\/ol>/)[1];
    const titles = [...timeline.matchAll(/<h3>([^<]+)<\/h3>/g)].map(([, title]) => title);
    assert.deepEqual(titles, homepage === 'index.html'
      ? ['NLivero', 'IPena Consultoria (commercial brand)', 'Freelance projects', 'INDT', 'LUDUS / UEA']
      : ['NLivero', 'IPena Consultoria (marca comercial)', 'Projetos freelance', 'INDT', 'LUDUS / UEA']);
    const freelance = [...timeline.matchAll(/<li>([\s\S]*?)<\/li>/g)][2][1];
    assert.match(freelance, /2024/);
    assert.doesNotMatch(freelance, /<time\b/);
    assert.match(source, /non-fiscal payroll|folha não fiscal/);
  });

  test(`${homepage} and ${catalog} retain reviewed payroll and handheld evidence`, () => {
    const home = readFileSync(new URL(`../${homepage}`, import.meta.url), 'utf8');
    const collection = readFileSync(new URL(`../${catalog}`, import.meta.url), 'utf8');
    const galleries = [...home.matchAll(/<div class="project-gallery" data-gallery-title="([^"]+)">([\s\S]*?)<\/ul>/g)];
    const expected = [
      ['ICheck', ['payroll-dashboard.jpg', 'payroll-login.jpg']],
      ['I-repos 2', ['android-management-handheld.png', 'android-management-pilot.jpg', 'android-management-login.jpg']],
    ];
    for (const [name, images] of expected) {
      const gallery = galleries.find(([, title]) => title.startsWith(name));
      assert.ok(gallery, `${name}: named gallery`);
      assert.deepEqual([...gallery[2].matchAll(/href="assets\/previews\/([^"]+)"/g)]
        .map(([, filename]) => filename), images, `${name}: reviewed image order and per-project limit`);
      for (const filename of images) {
        assert.equal(collection.split(`href="assets/previews/${filename}"`).length - 1, 1,
          `${name}: one matching collection link for ${filename}`);
      }
    }
    assert.match(galleries.find(([, title]) => title.startsWith('ICheck'))[2], /data-caption="[^"]*(?:test database|Base de teste)[^"]*"/);
    assert.doesNotMatch(home + collection, /handheld-unlocked/i);
  });
}

for (const [name, file, from, to, rule] of [
  ['language', 'projetos.html', 'lang="pt-BR"', 'lang="en"', 'lang'],
  ['title', 'projects.html', '<title>Project collection</title>', '<title> </title>', 'title'],
  ['main', 'projects.html', '<main>', '<div>', 'main'],
  ['h1', 'projects.html', '<h1>Project collection</h1>', '<h2>Project collection</h2>', 'h1'],
  ['canonical', 'projects.html', `rel="canonical" href="${origin}/projects.html"`, `rel="canonical" href="${origin}/"`, 'canonical'],
  ['Portuguese canonical', 'projetos.html', `rel="canonical" href="${origin}/projetos.html"`, `rel="canonical" href="${origin}/pt-br.html"`, 'canonical'],
  ['English alternate', 'projetos.html', `hreflang="en" href="${origin}/projects.html"`, `hreflang="en" href="${origin}/"`, 'alternate'],
  ['Portuguese alternate', 'projects.html', `hreflang="pt-BR" href="${origin}/projetos.html"`, `hreflang="pt-BR" href="${origin}/pt-br.html"`, 'alternate'],
  ['default alternate', 'projects.html', `hreflang="x-default" href="${origin}/projects.html"`, `hreflang="x-default" href="${origin}/"`, 'alternate'],
  ['local image reference', 'projects.html', 'src="assets/photo.png"', 'src="assets/missing.png"', 'asset'],
  ['local stylesheet reference', 'projetos.html', 'href="assets/projects.css"', 'href="assets/missing.css"', 'asset'],
  ['shared stylesheet', 'projects.html', 'href="assets/site.css"', 'href="assets/projects.css"', 'shared-asset'],
  ['external executable', 'projects.html', '</head>', '<script src="https://example.com/widget.js"></script></head>', 'dependency'],
  ['base override', 'projects.html', '</head>', '<base href="/other/"></head>', 'base'],
  ['public metric', 'projects.html', '<h1>Project collection</h1>', '<h1>Project collection 400+</h1>', 'metric'],
  ['private path', 'projects.html', '</main>', '<p>C:\\dev\\private</p></main>', 'private-path'],
  ['private endpoint', 'projetos.html', '</main>', '<p>https://192.168.7.23</p></main>', 'private-endpoint'],
  ['credential', 'projects.html', '</main>', '<p>password="synthetic-not-a-real-secret"</p></main>', 'credential'],
]) {
  test(`catalog retains ${name} validation`, (t) => {
    reject(t, (root) => {
      addCatalogs(root);
      edit(root, file, from, to);
    }, rule);
  });
}

function addPreviews(root, count = 1, attributes = '', extension = 'jpg') {
  const asset = `assets/previews/example.${extension}`;
  mkdirSync(join(root, 'assets/previews'));
  writeFileSync(join(root, asset), 'synthetic image placeholder');
  const preview = `<img class="project-preview-image" src="${asset}" width="800" height="400" loading="lazy" alt="Synthetic dashboard" ${attributes}>`;
  edit(root, 'index.html', '</main>', preview.repeat(count) + '</main>');
}

function addGalleries(root, counts = [1], file = 'index.html', extension = 'jpg') {
  const asset = `assets/previews/example.${extension}`;
  mkdirSync(join(root, 'assets/previews'), { recursive: true });
  writeFileSync(join(root, asset), 'synthetic image placeholder');
  const galleries = counts.map((count, project) => {
    const links = Array.from({ length: count }, (_, index) =>
      `<li><a href="${asset}" data-caption="Preview ${project + 1}-${index + 1}">Preview ${index + 1}</a></li>`).join('\n');
    return `<figure class="project-gallery" data-gallery-title="Project ${project + 1}">
<div><button class="gallery-trigger" type="button" hidden aria-label="Open gallery">
<img class="project-preview-image" src="${asset}" width="800" height="400" loading="lazy" alt="Synthetic dashboard">
<span>${count}</span></button></div>
<div class="gallery-fallback"><ul class="gallery-links">${links}</ul></div>
</figure>`;
  }).join('\n');
  edit(root, file, '</main>', galleries + '</main>');
}

test('up to three dimensioned, lazy local project previews pass', (t) => {
  const root = fixture(t);
  addPreviews(root, 3);
  assert.deepEqual(validateSite(root).errors, []);
});

test('four fallback images in a single project gallery are rejected', (t) => {
  reject(t, (root) => addGalleries(root, [4]), 'gallery');
});

test('six galleries per page accept one to three images each, not a global limit', (t) => {
  const root = fixture(t);
  addGalleries(root, [1, 2, 3, 1, 2, 3]);
  addGalleries(root, [3, 3, 3, 3, 3, 3], 'pt-br.html');
  edit(root, 'pt-br.html', 'data-gallery-title="Project 1"', "data-gallery-title='Projeto &amp; imagens'");
  edit(root, 'pt-br.html', 'data-caption="Preview 1-1"', "data-caption='Pr&#233;via localizada'");
  assert.deepEqual(validateSite(root).errors, []);
});

test('six mixed JPG/PNG galleries per page accept eighteen local image links', (t) => {
  const root = fixture(t);
  addGalleries(root, [3, 3, 3, 3, 3, 3]);
  addGalleries(root, [3, 3, 3, 3, 3, 3], 'pt-br.html', 'png');
  edit(root, 'index.html', 'src="assets/previews/example.jpg"', 'src="assets/previews/example.png"');
  edit(root, 'index.html', 'href="assets/previews/example.jpg"', 'href="assets/previews/example.png"');
  assert.deepEqual(validateSite(root).errors, []);
});

test('standalone PNG previews retain legacy markup without a global count', (t) => {
  const root = fixture(t);
  addPreviews(root, 4, '', 'png');
  assert.deepEqual(validateSite(root).errors, []);
});

test('legacy standalone previews need no gallery markup or global count', (t) => {
  const root = fixture(t);
  addPreviews(root, 4);
  assert.deepEqual(validateSite(root).errors, []);
});

test('an empty gallery cannot borrow image links from another project', (t) => {
  const root = fixture(t);
  addGalleries(root, [0, 3]);
  const errors = validateSite(root).errors;
  assert.equal(errors.length, 1);
  assert.match(errors[0], /index\.html \[gallery\].*line \d+.*1 to 3/);
});

test('non-gallery links do not count toward a project image limit', (t) => {
  const root = fixture(t);
  addGalleries(root, [3]);
  edit(root, 'index.html', '</main>', '<a href="assets/previews/example.jpg">Separate image</a></main>');
  assert.deepEqual(validateSite(root).errors, []);
});

for (const [name, href] of [
  ['external', 'https://example.com/image.jpg'],
  ['protocol-relative', '//example.com/image.jpg'],
  ['same-origin absolute', `${origin}/assets/previews/example.jpg`],
  ['root-relative', '/assets/previews/example.jpg'],
  ['data URL', 'data:image/jpeg;base64,AA=='],
  ['traversal', 'assets/previews/../example.jpg'],
  ['encoded path', 'assets/previews/example%2ejpg'],
  ['nested path', 'assets/previews/sub/example.jpg'],
  ['JPEG extension other than jpg', 'assets/previews/example.jpeg'],
  ['uppercase slug', 'assets/previews/EXAMPLE.jpg'],
  ['query', 'assets/previews/example.jpg?size=1'],
  ['fragment', 'assets/previews/example.jpg#image'],
  ['leading whitespace', ' assets/previews/example.jpg'],
  ['trailing newline', 'assets/previews/example.jpg&#10;'],
  ['empty', ''],
  ['SVG', 'assets/previews/example.svg'],
  ['GIF', 'assets/previews/example.gif'],
  ['WebP', 'assets/previews/example.webp'],
  ['uppercase extension', 'assets/previews/example.PNG'],
  ['external PNG', 'https://example.com/image.png'],
  ['protocol-relative PNG', '//example.com/image.png'],
  ['PNG data URL', 'data:image/png;base64,AA=='],
  ['PNG traversal', 'assets/previews/../example.png'],
  ['encoded PNG traversal', 'assets/previews/%2e%2e/example.png'],
  ['root-relative PNG', '/assets/previews/example.png'],
  ['PNG query', 'assets/previews/example.png?size=1'],
  ['PNG fragment', 'assets/previews/example.png#image'],
  ['PNG trailing newline', 'assets/previews/example.png&#10;'],
]) {
  test(`gallery links reject ${name} references`, (t) => {
    reject(t, (root) => {
      addGalleries(root);
      edit(root, 'index.html', 'href="assets/previews/example.jpg"', `href="${href}"`);
    }, 'gallery');
  });
}

for (const [name, from, to] of [
  ['missing title', ' data-gallery-title="Project 1"', ''],
  ['empty title', 'data-gallery-title="Project 1"', 'data-gallery-title=""'],
  ['whitespace title', 'data-gallery-title="Project 1"', 'data-gallery-title=" &#160; "'],
  ['missing caption', ' data-caption="Preview 1-1"', ''],
  ['empty caption', 'data-caption="Preview 1-1"', 'data-caption=""'],
  ['whitespace caption', 'data-caption="Preview 1-1"', 'data-caption=" &#160; "'],
  ['missing link target', ' href="assets/previews/example.jpg"', ''],
  ['missing trigger', 'class="gallery-trigger"', 'class="other-trigger"'],
  ['visible trigger', 'type="button" hidden', 'type="button"'],
  ['non-button trigger', '<button class="gallery-trigger"', '<span class="gallery-trigger"'],
  ['duplicate trigger', '</button>', '</button><button class="gallery-trigger" hidden>Duplicate</button>'],
  ['missing fallback', 'class="gallery-links"', 'class="other-links"'],
  ['non-list fallback', '<ul class="gallery-links"', '<div class="gallery-links"'],
  ['duplicate fallback', '</ul>', '</ul><ul class="gallery-links"></ul>'],
  ['hidden fallback', '<ul class="gallery-links"', '<ul hidden class="gallery-links"'],
  ['ARIA-hidden fallback', '<ul class="gallery-links"', '<ul aria-hidden="true" class="gallery-links"'],
  ['hidden fallback wrapper', '<div class="gallery-fallback"', '<div hidden class="gallery-fallback"'],
  ['hidden link', '<a href="assets/previews/example.jpg"', '<a hidden href="assets/previews/example.jpg"'],
  ['hidden list item', '<li>', '<li hidden>'],
  ['link outside a list item', '<li><a ', '<a '],
  ['link nested below a list item', '<li><a ', '<li><span><a '],
]) {
  test(`gallery contract rejects ${name}`, (t) => {
    reject(t, (root) => {
      addGalleries(root);
      edit(root, 'index.html', from, to);
    }, 'gallery');
  });
}

test('gallery links retain local-file existence validation', (t) => {
  reject(t, (root) => {
    addGalleries(root, [2]);
    edit(root, 'index.html', 'href="assets/previews/example.jpg"', 'href="assets/previews/missing.jpg"');
  }, 'asset');
});

test('PNG gallery links retain local-file existence validation', (t) => {
  reject(t, (root) => {
    addGalleries(root, [2], 'index.html', 'png');
    edit(root, 'index.html', 'href="assets/previews/example.png"', 'href="assets/previews/missing.png"');
  }, 'asset');
});

test('gallery thumbnails retain preview alt, dimensions, lazy and srcset checks', (t) => {
  for (const extension of ['jpg', 'png']) {
    for (const [from, to] of [
      ['alt="Synthetic dashboard"', 'alt=""'],
      ['width="800"', 'width="0"'],
      ['height="400"', ''],
      ['loading="lazy"', 'loading="eager"'],
      [`src="assets/previews/example.${extension}"`, `src="https://example.com/image.${extension}"`],
      ['loading="lazy"', `loading="lazy" srcset="assets/previews/example.${extension} 2x"`],
    ]) {
      const root = fixture(t);
      addGalleries(root, [1], 'index.html', extension);
      edit(root, 'index.html', from, to);
      assert.ok(validateSite(root).errors.some((error) => error.includes('[preview]')), `${extension}: ${from}`);
    }
  }
});

test('preview sources accept only strict local lowercase jpg/png paths', (t) => {
  for (const src of [
    'assets/previews/example.svg', 'assets/previews/example.gif', 'assets/previews/example.webp',
    'assets/previews/example.jpeg', 'assets/previews/example.PNG', 'assets/previews/EXAMPLE.jpg',
    'data:image/png;base64,AA==', 'https://example.com/image.png', '//example.com/image.png',
    '/assets/previews/example.png', 'assets/previews/../example.png', 'assets/previews/%2e%2e/example.png',
    'assets/previews/example.png?x=1', 'assets/previews/example.png#x', 'assets/previews/example.png&#10;',
    'assets/previews/example.jpg&#10;', ' assets/previews/example.png', 'assets/previews/sub/example.png',
  ]) {
    const root = fixture(t);
    addPreviews(root);
    edit(root, 'index.html', 'src="assets/previews/example.jpg"', `src="${src}"`);
    assert.ok(validateSite(root).errors.some((error) => error.includes('[preview]')), src);
  }
});

test('project previews cannot override reviewed src through srcset', (t) => {
  reject(t, (root) => addPreviews(root, 1, 'srcset="https://example.com/preview.jpg 2x"'), 'preview');
});

for (const [name, from, to] of [
  ['missing alt text', 'alt="Synthetic dashboard"', 'alt=""'],
  ['zero width', 'width="800"', 'width="0"'],
  ['missing height', 'height="400"', ''],
  ['eager loading', 'loading="lazy"', 'loading="eager"'],
  ['remote preview', 'src="assets/previews/example.jpg"', 'src="https://example.com/preview.jpg"'],
]) {
  test(`project previews reject ${name}`, (t) => {
    reject(t, (root) => {
      addPreviews(root);
      edit(root, 'index.html', from, to);
    }, 'preview');
  });
}

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

test('external stylesheet cannot satisfy required shared CSS', (t) => {
  const root = fixture(t);
  edit(root, 'index.html', 'href="assets/site.css?v=1"', 'href="https://example.com/assets/site.css?v=1"');
  const { errors } = validateSite(root);
  assert.ok(errors.some((error) => error.includes('[shared-asset]')));
  assert.ok(errors.some((error) => error.includes('[dependency]')));
});

test('data URL scripts are rejected with the local shared script present', (t) => {
  reject(t, (root) => edit(root, 'index.html', '</head>',
    '<script src="data:text/javascript,void%200"></script></head>'), 'asset');
});

test('same-origin shared assets accept absolute and root-relative URLs', (t) => {
  const root = fixture(t);
  edit(root, 'index.html', 'href="assets/site.css?v=1"', `href="${origin}/assets/site.css?v=1"`);
  edit(root, 'index.html', 'src="assets/site.js"', 'src="/assets/site.js?v=1"');
  edit(root, 'pt-br.html', 'href="assets/site.css?v=1"', 'href="/assets/site.css?v=1"');
  edit(root, 'pt-br.html', 'src="assets/site.js"', `src="${origin}/assets/site.js"`);
  assert.deepEqual(validateSite(root).errors, []);
});

test('external ordinary links and data images remain allowed', (t) => {
  const root = fixture(t);
  edit(root, 'index.html', '</main>', '<a href="https://example.com/assets/site.css">External resource</a>' +
    '<a href="mailto:example@example.com">Email</a><a href="tel:+123456789">Phone</a>' +
    '<img src="data:image/png;base64,AA==" alt="Synthetic image"></main>');
  writeFileSync(join(root, 'assets/site.css'), 'body { background: url("data:image/png;base64,AA=="); }');
  assert.deepEqual(validateSite(root).errors, []);
});

test('local CSS imports in quoted and URL forms remain allowed', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'assets/colors.css'), ':root { color: black; }');
  writeFileSync(join(root, 'assets/site.css'), '@import "./colors.css"; @import url("/assets/colors.css");');
  assert.deepEqual(validateSite(root).errors, []);
});

test('shared assets must use their exact local paths', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'assets/other.css'), 'body { color: black; }');
  writeFileSync(join(root, 'assets/other.js'), 'void 0;');
  edit(root, 'index.html', 'href="assets/site.css?v=1"', 'href="assets/other.css"');
  edit(root, 'index.html', 'src="assets/site.js"', 'src="assets/other.js"');
  assert.equal(validateSite(root).errors.filter((error) => error.includes('[shared-asset]')).length, 2);
});

test('realpath boundary rejects assets through an outside directory link', (t) => {
  const root = fixture(t);
  const outside = mkdtempSync(join(tmpdir(), 'public-site-boundary-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, 'photo.png'), 'synthetic image placeholder');
  symlinkSync(outside, join(root, 'assets/outside'), 'junction');
  edit(root, 'index.html', 'src="assets/photo.png"', 'src="assets/outside/photo.png"');
  const { errors } = validateSite(root);
  assert.ok(errors.some((error) => error.includes('[asset]')));
  assert.ok(errors.some((error) => error.includes('[boundary]')));
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
  ['mailto script scheme', (root) => edit(root, 'index.html', '</head>', '<script src="mailto:example@example.com"></script></head>'), 'asset'],
  ['tel script scheme', (root) => edit(root, 'index.html', '</head>', '<script src="tel:+123456789"></script></head>'), 'asset'],
  ['blob script scheme', (root) => edit(root, 'index.html', '</head>', `<script src="blob:${origin}/synthetic"></script></head>`), 'asset'],
  ['additional external stylesheet', (root) => edit(root, 'index.html', '</head>', '<link rel="stylesheet" href="https://example.com/colors.css"></head>'), 'dependency'],
  ['protocol-relative external stylesheet', (root) => edit(root, 'index.html', '</head>', '<link rel="stylesheet" href="//example.com/colors.css"></head>'), 'dependency'],
  ['HTTP stylesheet on the public hostname', (root) => edit(root, 'index.html', 'href="assets/site.css?v=1"', `href="${origin.replace('https:', 'http:')}/assets/site.css"`), 'dependency'],
  ['data stylesheet scheme', (root) => edit(root, 'index.html', '</head>', '<link rel="stylesheet" href="data:text/css,body%7Bcolor:black%7D"></head>'), 'asset'],
  ['external quoted CSS import', (root) => writeFileSync(join(root, 'assets/site.css'), '@import "https://example.com/colors.css";'), 'dependency'],
  ['external URL CSS import', (root) => writeFileSync(join(root, 'assets/site.css'), '@import url("//example.com/colors.css");'), 'dependency'],
  ['data URL CSS import', (root) => writeFileSync(join(root, 'assets/site.css'), '@import url("data:text/css,body%7Bcolor:black%7D");'), 'asset'],
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
