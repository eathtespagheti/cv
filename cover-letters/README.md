# Cover letters

Generator for tailored cover letters. Prose lives in YAML and a Nunjucks
(Jinja-compatible) template; the script merges the two and writes `.md` and `.txt`.

## Why a template at all

The letter is the one document where a generic draft is obvious. The template
exists to guarantee the *structure* — greeting, why-this-role, evidence, why-this-
company, close — while every sentence that must be specific to the posting is an
input you (or an agent) write per application. No sentence is generated that you
did not supply or deliberately select.

## How it works

```
applicant.yaml               reusable facts + narrative paragraphs, keyed by theme
templates/cover-letter.md.j2 the document structure
applications/<name>.yaml     per-job inputs: role, company, which themes, why-company
        │
        ▼  npm run letter -- <name>
applications/<name>.md       structured, for editing
applications/<name>.txt      re-flowed prose, for pasting into application forms
```

`applicant.yaml` holds `paragraphs` — each a complete, signable paragraph — keyed
by theme (`ci_cd`, `containers`, `kubernetes`, `gitops`, `terraform`,
`security`, `runners`, `observability`, `e2e`, `platform_tooling`, `aws_cloud`,
`backend`, `mentoring`, `documentation`, `homelab`, `ai_tooling`). An
application selects the themes that match the posting, in the order they should
appear. That ordering *is* the argument the letter makes, so it is worth thinking
about: lead with what the posting leads with.

## Writing one

```sh
cp cover-letters/applications/example.yaml cover-letters/applications/acme.yaml
$EDITOR cover-letters/applications/acme.yaml
npm run letter -- acme
```

Render every application at once:

```sh
npm run letter:all
```

The script validates before rendering and names what is missing — an unknown theme
lists the available ones, a missing field names the field.

## Working with an agent

The intended flow for a real application:

1. Paste the job posting and ask for a theme selection, ordered, with reasoning.
2. Write `opening` and `why_company` yourself, or have them drafted and then edit
   them hard. These two paragraphs are what a reader notices; the rest is evidence
   and is deliberately reusable.
3. Render and read it once out loud. If a sentence could appear in a letter to a
   different company, it belongs in `applicant.yaml`, not in `why_company`.

## Keeping it honest

`applicant.yaml` must not claim more than `src/content/cv/en.yaml` supports. Both
are read by the same person at different moments, and a letter that contradicts the
CV is worse than no letter. When a claim changes on the CV, change it here too.

Nothing here is published by the site build — `applications/` is gitignored, so
drafts and company names stay local. Only `applicant.yaml` and the template are
committed.
