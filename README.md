# cv

Personal CV, portfolio and resume site for **Fabio Sussarellu** — DevOps / Platform
Engineer.

Built as a fork of [cv_hub](https://github.com/KeeGooRoomiE/cv_hub) (MIT, © Alexander
Gusarov) with all of the upstream content replaced. The fork keeps the data model —
YAML in, a complete site plus ATS-safe PDF, DOCX and TXT out — and changes what
matters for this deployment: the content, the branding, and the containerised
build-and-serve pipeline below.

## What this produces

| Output | Path |
|---|---|
| Public site | `/` |
| Case studies | `/projects/<project>/` |
| Recruiter PDF (two-column) | `/downloads/resume_en.<hash>.pdf` |
| ATS-safe PDF (single-column) | `/downloads/resume_en_ats.<hash>.pdf` |
| Editable Word | `/downloads/resume_en.<hash>.docx` |
| Plain text | `/downloads/resume_en.<hash>.txt` |

The `<hash>` is a prefix of the file's sha256, added by the `resume:hash` build
step. A changed resume gets a new URL, so the download URLs are content-addressed
and served `immutable` — a returning visitor never keeps a stale CV.

## Content model

Everything on the site derives from YAML under `src/content/`:

```
src/content/
├── cv/en.yaml              # the CV
├── profiles/profiles.yml   # profile registry (slug, label, spec)
├── projects/projects_en.yaml            # project cards (list page)
├── site/site.yml                        # download buttons, footer
└── languages/languages.yml              # locale list
```

Per-project case studies live outside the content collection, because each one is
sourced from its own file:

```
public/media/projects/<slug>/<slug>_en.yaml
```

### Profiles

The site runs a **single profile**. A second "senior" variant was tried and removed:
it overrode only the title, summary and achievements, so switching profiles changed
the header and nothing else — the same page with a different opening paragraph.

Additional profiles are supported if they differ *substantively*. A spec file
(`cv/<lang>_<spec>.yaml`) is a delta over the base CV, and **it replaces the
experience list rather than appending to it** — each entry is shallow-merged over the
base entry whose `company` (and `role`, when given) matches. Any role you want in the
profile must be listed in the spec, in the order you want it. See
`src/scripts/merge.mjs` and `src/content/profiles/profiles.yml`.

### Editing the CV

Edit the YAML, then build. The content layer validates on build, so a malformed
entry fails CI rather than shipping.

```sh
npm install
npm run build
```

To preview locally: `npm run dev`.

## Container image

Multi-stage: the Astro build (plus PDF/DOCX/TXT export and OG image generation) in
Microsoft's official Playwright image, served by `nginx-unprivileged` on `:8080`.

```sh
docker compose up --build    # build the image and serve it on :8080
docker compose down
```

Or with plain Docker:

```sh
docker build -t cv:dev .
docker run --rm -p 8080:8080 cv:dev
```

`compose.yaml` names the project `${COMPOSE_PROJECT_NAME:-cv}`, so the project name
(and the `:dev` image tag) can be overridden from the shell or a local `.env`. The
host port (`CV_PORT`) and build origin (`SITE_URL`) are overridable the same way —
e.g. `CV_PORT=9090 docker compose up --build`.

One deliberate deviation from upstream: **the build stage is the official Playwright
image**, not a plain Node image plus `npx playwright install`. The plain-Node
approach downloads ~120 MB from `cdn.playwright.dev` on every build, and that CDN is
not reliably reachable from inside a Docker-in-Docker build — it failed the `v1.2.1`
release outright. The official image ships Chromium and its OS dependencies, so the
build has no browser-download step at all.

**The image tag must track the `playwright` version in `package-lock.json`.** A
mismatch means the bundled Chromium revision differs from the one Playwright
expects. Keep `mcr.microsoft.com/playwright:v<version>-noble` in step when bumping
Playwright (currently `1.63.0` → `chromium-1243`).

`SITE_URL` is a build arg (default `https://cv.eathtespagheti.eu`) and drives the
canonical URL, `hreflang` and the sitemap.

Browser selection for the PDF/OG steps is the explicit `PLAYWRIGHT_CHANNEL` opt-in
(see `src/scripts/resume-export-pdf.mjs`), defaulting to the bundled Chromium.

`nginx.conf` serves `/healthz` for the container healthcheck and the Kubernetes
probes, sets long-lived caching for hashed `_astro/` assets and shorter caching for
generated `/downloads/`.

## CI/CD

`.gitlab-ci.yml` has two stages:

1. **`validate`** — builds the site on every push. This is where the Astro content
   schema is enforced; a bad YAML edit cannot reach `main`.
2. **`container`** — on **tag pipelines only**, builds and pushes the image.

Deployment to the cluster is **not** done by this pipeline. The image is consumed by
Flux from `registry.gitlab.com/eathtespagheti/cv`, declared in
`home-cluster/flux/apps/cv/`.

### Release

```sh
git tag -a v1.2.0 -m "Add new role" && git push --tags
```

The image tag **is** the git tag, so exactly one image exists per release. This is
deliberate: `git describe` collapses many commits into a single release number, so
building on branch pushes would let every commit after a tag silently overwrite the
same image tag, and a version number would end up pointing at unreviewed code. The
pipeline rejects any tag that is not `vMAJOR.MINOR.PATCH` before building — the shape
the Flux `ImagePolicy` filters on (`^v(?P<ts>.*)$`, semver `>=1`).

## Cover letters

Separate from the site build. Nunjucks (Jinja-compatible) templates plus YAML, in
`cover-letters/`:

```sh
npm run letter -- acme        # render cover-letters/applications/acme.yaml
npm run letter:all
```

Reusable narrative paragraphs in `cover-letters/applicant.yaml` are keyed by theme;
each application selects and orders the themes that match the posting. Outputs
`.md` (for editing) and reflowed `.txt` (for pasting into application forms).
Per-application drafts are gitignored — only the template and the shared facts are
committed. See `cover-letters/README.md`.

## Themes

`frosted` is the **default** — it is imported in `src/components/Layout.astro` after
`global.css`, so it is what a visitor sees at `https://cv.eathtespagheti.eu/` with no
query parameter.

The other themes stay switchable at runtime by query parameter, with no rebuild:

```
https://cv.eathtespagheti.eu/?theme=peachy
https://cv.eathtespagheti.eu/?theme=light
https://cv.eathtespagheti.eu/?theme=nordic
https://cv.eathtespagheti.eu/?theme=editorial
https://cv.eathtespagheti.eu/?theme=slate
```

The inline script in `<head>` appends `/themes/<name>.css`, which loads *after* the
default import — so a query parameter always wins.

Two kinds of theme live here:

- `frosted`, `light`, `peachy`, `nordic` — colour only. Each is a `:root` block that
  redefines the tokens from `global.css`. They must define **every** token the base
  does, or the remaining ones leak through from the base palette (check with
  `diff` before adding one).
- `editorial`, `slate` — also override layout: they flatten the cards, remove the
  animated background and render skills as inline prose. A theme stylesheet loads
  after `global.css`, so it can override any rule, not just variables.

To add one: copy a file in `src/styles/themes/`, edit it, copy it to
`public/themes/` (the runtime switcher serves from there), and add the name to the
`allowed` array in `Layout.astro`.

## Upstream

Kept in sync as the `upstream` remote:

```sh
git remote -v
git fetch upstream && git log upstream/main..main --oneline
```

MIT licence and upstream copyright are preserved in `LICENSE`, per the licence
terms. The footer credit to cv_hub is disabled (`footerCredit: false` in
`site.yml`); the visible footer carries no third-party attribution.
