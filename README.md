# Nickolas Livero Portfolio

Bilingual static portfolio for software engineering roles and consulting through
NLivero Software e Consultoria Ltda.

[English](https://nickolaslivero.github.io/) |
[Portugues](https://nickolaslivero.github.io/pt-br.html)

## Work represented

- Technos gatehouse/maintenance workflows integrated with TOTVS Protheus,
  delivered through IPena Consultoria.
- Production Android application distribution, with targeted releases and
  installer handoff.
- Modernization of an inherited factory application and ERP logistics dashboards.
- Development/deployment of non-fiscal payroll software, AWS migration and recovery
  checks; separate institutional website delivery with S3 and CloudFront.
- Android QA automation, BERT classification research and bounded freelance work.
- A self-hosted Ubuntu/Docker platform for personal development/preproduction,
  private remote administration and scoped backup/restore checks.

Client source code, operational data and internal endpoints are not included.
A pilot, a delivered frontend MVP and maintained production software are
described separately. No unverified productivity metrics or production-AI
authorship claims are used.

## Files

- `index.html`, `pt-br.html`: English/Portuguese pages.
- `projects.html`, `projetos.html`: bilingual project collection, with category
  anchors and native details for contribution, technology and delivery context.
- `assets/projects.css`: compact collection layout, layered over shared site styles.
- `assets/site.css`, `assets/site.js`, `assets/gallery.js`: responsive styles,
  persistent theme choice and progressively enhanced per-project galleries.
- `assets/`: unchanged portrait, favicons and application icons; a generated office
  background derived from the LinkedIn cover for visual identity. It does not depict
  a client system or claim to be a photograph of an actual office.
- `assets/previews/`: actual reviewed frontend, emulator and physical-handheld captures. Each project
  has at most three images; complex products remain separate galleries, including
  production I-repos 1 and the non-production I-repos 2 pilot. Captions identify
  personal preproduction, test data, emulator or physical-pilot views rather than
  production metrics. ICheck figures come from a test database; the handheld
  view shows the pilot launcher, not proof of kiosk enforcement. Client operational
  records and device identifiers are excluded. Image confidentiality
  still requires human review. No live client application is embedded or linked.
  Without JavaScript, the image links remain available. With native dialog support,
  thumbnails open a keyboard-operable viewer with full-size image links.
- `assets/icons/`: four locally vendored Lucide icons and their ISC/MIT notices.
- `cv-en.pdf`, `cv-pt.pdf`: reviewed public master resumes.
- `resume.pdf`, `resume-pt.pdf`: compatibility aliases of the current public
  masters for previously shared links. Earlier modified files were preserved
  in the private workspace before the owner-authorized replacement.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`: crawler/browser metadata.
- `scripts/`, `.github/workflows/`: public-only validation, not deployment.

## Preview and validate

Open any HTML file in a browser. No framework, build, server, CDN scripts,
analytics, tracking or account credentials are required.

With Node.js 24, run:

```powershell
node --test scripts/validate-site.test.mjs
node --test scripts/gallery.test.mjs
node scripts/validate-site.mjs .
```

Validation is a local/public-content gate, not proof that confidential client
systems work or that a hiring platform will accept an application.

## Project collection

Open [Project collection](projects.html) or [Projetos e pesquisa](projetos.html)
for the broader archive. Professional and freelance systems, personal tools and
infrastructure, pilots, research, coursework and earlier experiments keep their
own contribution and status context.
Related variants are grouped; third-party frameworks are not counted as original
projects. The resume remains a selected, separate document.

Each entry has a concise summary and native details. Historical studies use
purpose-based descriptions, while status labels distinguish active tools,
production systems, pilots and discontinued experiments.

The collection uses native HTML details and only the shared theme script. Reviewed
captures are linked directly rather than duplicated in additional galleries.
Public repository links are selective and do not imply a security audit or sole
authorship. The accessibility paper links to its official publication record.

The validator supports a legacy site with only the homepage pair. Once either
collection page is present, both are required and checked against their own
canonical and language-alternate URLs, alongside the existing semantic, local
asset and public-content checks. Homepage-specific career facts remain homepage
checks.

## Publication

This repository is independent from the private career workspace and GitHub
profile repository. GitHub Pages currently uses `main` from the repository root.
The validation workflow does not change Pages mode or deploy the site.

A local branch, successful tests and an edited README are not publication.
Review the diff, approve the PDF/copy, then explicitly authorize commit/push.
Check the remote workflow result and live pages after publication. Private
evidence, application trackers and customer documentation must never enter
this public repository.
