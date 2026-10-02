# Public Site Validation

Run from the independent site repository with Node.js 24. No installation,
framework, build step, or package.json is required.

```powershell
node --test scripts/validate-site.test.mjs
node scripts/validate-site.mjs .
node scripts/validate-site.mjs "path/to/another/site"
```

With no path, the validator checks the site directory above this script,
regardless of the working directory. Exit codes: 0 passed, 1 validation issues,
2 invalid command usage. Diagnostics identify the file, rule, and location when
available; potentially sensitive values are redacted.

Tests create and remove only their own synthetic temporary fixtures. They do
not validate or modify the actual portfolio. Run the second command only after
both rebuilt pages and shared assets are ready.

Checks cover EN/PT language, title/main/h1, public canonical and alternate URLs,
local HTML references, CSS URLs/imports and literal JS imports, shared site
assets, unsupported public metrics, and basic visible timeline/attribution
signals. Public text files are screened for common private paths, runtime hosts,
requests, credentials, and private source references. The scripts and hidden
directories are excluded from public-content scanning.

These are lightweight static checks, not browser rendering, a full HTML/CSS/JS
parser, comprehensive secret detection, or evidence verification. CSS visibility,
dynamic asset references, binary files/PDF contents, and external link availability
still require review. No private source files are loaded or network requests made.

The workflow performs these checks on push and pull requests. It installs no
dependencies, uploads no artifacts or PDFs, and has no deployment job. Its
presence does not change or verify the repository's GitHub Pages publishing mode.
