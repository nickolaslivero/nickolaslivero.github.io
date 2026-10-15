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
- `assets/site.css`, `assets/site.js`: shared responsive styles and theme toggle.
- `assets/`: unchanged portrait, favicons and application icons; a generated office
  background derived from the LinkedIn cover for visual identity. It does not depict
  a client system or claim to be a photograph of an actual office.
- `assets/previews/`: two actual, cropped SisTech/I-repos frontend captures from
  personal preproduction. Account headers and device history are excluded.
  These are interface previews, not production metrics or client acceptance.
  A maximum of three previews is enforced; image confidentiality still requires
  human review. No live client application is embedded or linked.
- `cv-en.pdf`, `cv-pt.pdf`: reviewed public master resumes.
- `resume.pdf`, `resume-pt.pdf`: compatibility aliases of the current public
  masters for previously shared links. Earlier modified files were preserved
  in the private workspace before the owner-authorized replacement.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`: crawler/browser metadata.
- `scripts/`, `.github/workflows/`: public-only validation, not deployment.

## Preview and validate

Open either HTML file in a browser. No framework, build, server, CDN scripts,
analytics, tracking or account credentials are required.

With Node.js 24, run:

```powershell
node --test scripts/validate-site.test.mjs
node scripts/validate-site.mjs .
```

Validation is a local/public-content gate, not proof that confidential client
systems work or that a hiring platform will accept an application.

## Publication

This repository is independent from the private career workspace and GitHub
profile repository. GitHub Pages currently uses `main` from the repository root.
The validation workflow does not change Pages mode or deploy the site.

A local branch, successful tests and an edited README are not publication.
Review the diff, approve the PDF/copy, then explicitly authorize commit/push.
Check the remote workflow result and live pages after publication. Private
evidence, application trackers and customer documentation must never enter
this public repository.
