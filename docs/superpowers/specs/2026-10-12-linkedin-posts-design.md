# LinkedIn project posts — design

Date: 2026-10-12
Status: Design approved in chat, awaiting written-spec review

## Problem

The CV site already showcases projects as case studies
(`public/media/projects/<slug>/`) and cards
(`src/content/projects/projects_en.yaml`), but nothing turns one into a post on
LinkedIn. Writing one by hand starts from a blank composer every time: the
sources are scattered, the house rules that apply to public text (no internal
hostnames, no employer-confidential detail, no invented numbers) live in
`AGENTS.md`, and general LinkedIn advice is easy to get wrong — the most common
mistake, attaching a link preview, measurably halves reach.

There is no specialist that knows the house rules and the platform, and no
convention for where a draft lives.

## Goal

One OpenCode agent, backed by one researched guideline skill, that turns a
project slug into a ready-to-publish LinkedIn post draft:

1. a post written to current LinkedIn best practice (hook, structure, length,
   link handling, hashtags);
2. honest and sourced — every claim traceable to the repo, nothing invented;
3. safe to publish — the public-data guardrails hold, and only projects the repo
   already marks shareable are eligible;
4. with image guidance: reuse an existing screenshot where one exists, describe a
   specific image to create where one does not, alt text always.

Non-goals: publishing through the LinkedIn API, rendering images, scheduling,
analytics, or tracking a backlog of posts. No source code, no build-step change,
no new runtime dependency.

## Decisions (agreed in brainstorming)

| Question | Decision |
|---|---|
| Scope | **Skill + agent.** Mirrors every other writer role in the repo. |
| Deliverable | **Post text + image guidance**, saved as a draft file *and* printed in chat. |
| Draft location | `linkedin/drafts/<slug>.md`, **gitignored** (mirrors `cover-letters/applications/`). A committed `linkedin/README.md` documents the convention. |
| Language | **English by default; Italian on request** (appended to the same draft). |
| Project selection | **Only the one named.** No candidate ranking, no backlog, no "what next" engine. |
| Job-search signal | **None.** The post is pure showcase; no open-to-work CTA. |
| Draft format | **Markdown with front-matter**, not structured YAML + renderer (approach C deferred — YAGNI). |
| Guidance home | **Researched skill**, in `.opencode/skills/`, per repo convention. |

## Architecture

```
.opencode/
├── agents/
│   └── linkedin-post-writer.md          # writer: slug -> eligible project -> draft
└── skills/
    └── linkedin-post-writing/SKILL.md   # researched LinkedIn guidance + house workflow
linkedin/
├── README.md                            # committed: the convention, how to run
└── drafts/<slug>.md                     # gitignored output
```

Plus two edits: a `.gitignore` entry for `linkedin/drafts/*.md`, and `AGENTS.md`
roster/doc updates (see "Documentation"). No change to `src/`, `package.json`,
the build, or CI.

## The skill — `linkedin-post-writing`

Modeled on `cover-letter-writing/SKILL.md`: frontmatter `name` + `description`,
then described sections. Content:

### 1. When to use
When asked to write, draft, or review a LinkedIn post about a project in this
repo, before touching anything under `linkedin/`.

### 2. Sources, in order of truth
- **Case study** — `public/media/projects/<slug>/<slug_underscored>_en.yaml`.
  The narrative source. Blocks are `text | divider | image | video | code`; its
  `tagline`, `role`, `year`, `stack` and body prose are the post's material.
- **Card** — `src/content/projects/projects_en.yaml`. Supplies `tags`, `metrics`,
  `stack`, `links`.
- **Cross-check only** — `src/content/cv/en.yaml` and
  `cover-letters/applicant.yaml`. Use to confirm a fact; do not lift their
  telegraphic voice.
- Italian copy comes from the `_it.yaml` counterparts when a language is
  requested.

Note: `<slug_underscored>` means the slug with `-` replaced by `_`
(`cv-platform` → `cv_platform_en.yaml`).

### 3. Eligibility gate (mandatory, checked first)
The case study must carry `shareable: true`. If it is `false` or absent, **stop**
and report why rather than writing. `devops-platform` is the known ineligible
project. This is the repo's existing "may be promoted publicly" marker — the same
one that gates the copy-link button on the project page — so the agent never has
to guess.

### 4. Voice
First person, prose. This is a new **prose surface**: like case-study bodies and
cover-letter facts, it may say "I". It is not the CV's telegraphic voice. Facts
must still match every other surface.

### 5. Structure
- **Hook** — the first ~200 characters, which is all that shows before
  "…see more". It must carry the post's whole point; never a warm-up sentence.
- **Framing** — one sentence naming what this is and why a DevOps/Platform peer
  should care.
- **Body** — three to six short paragraphs: the problem, the approach, the
  concrete specifics (named technologies in context), the result. Each paragraph
  must survive the "so what?" test.
- **Takeaway** — the transferable lesson, in one or two sentences.
- **Invitation** — one genuine question, not engagement bait.

### 6. Links
- Put the project URL as a **plain-text URL** in the body, and/or in the first
  comment. **Do not rely on an attached link preview card.** Researched basis: a
  2026 study of 566,957 LinkedIn posts with synced analytics found posts with an
  attached link preview reach 414 median impressions against 795 without one,
  while an in-body URL costs essentially nothing (858); LinkedIn's 2026 algorithm
  additionally rewards original point-of-view and educational posts.
- The canonical URL is `https://cv.eathtespagheti.eu/projects/<slug>` for English
  and `https://cv.eathtespagheti.eu/projects/<slug>/it` for Italian (the default
  language, `en`, takes no suffix — `src/content/languages/languages.yml` and
  `src/pages/projects/[...rest].astro`). Verify it resolves before finalising.

### 7. Length, format, tags
- Target ~700–1,300 characters. Short lines, a blank line between paragraphs, no
  wall of text.
- Zero to five **specific** hashtags at the end (`#kubernetes`, `#platformengineering`),
  not generic ones (`#tech`, `#innovation`).
- Emoji sparse and optional; never as bullet substitutes.
- Do not @-mention people who have not opted in.

### 8. Banned phrases
"Thrilled to announce", "excited to share", "humbled", "I'm proud to share",
"Thoughts?", "Agree?", "Let that sink in", "🚀". These are the clichés and
engagement-bait the platform demotes.

### 9. Honesty and safety rules
- Every number and claim must be traceable to a source file; no invented metrics.
- The repo's public-data rules apply and bite harder on LinkedIn: no internal
  hostnames, no employer-confidential detail, no colleague names, no named
  security-vulnerability details against employer systems.
- Attribute reused third-party work (e.g. MIT `cv_hub` for `cv-platform`).
- Vague superlatives are dropped, not softened.

### 10. Image guidance
- If the case study has an `image` block (or the project directory has a
  screenshot), name the exact file and suggest a crop. Only 8 of ~22 projects
  have any image today.
- Otherwise, describe **one** specific image to create: what it must show, why,
  and the upload spec — 1200×627 px (1.91:1) landscape or 1080×1350 px (4:5)
  portrait, ≤5 MB, PNG/JPG, ≥1200 px wide.
- Always write alt text.
- Never invent a screenshot, mock data, or a UI that does not exist.

### 11. Output contract
Write `linkedin/drafts/<slug>.md` and print the post in chat. Shape:

```markdown
---
slug: cv-platform
project: "CV & Cover-Letter Platform"
language: en
status: draft          # draft | posted — for your own tracking
link: https://cv.eathtespagheti.eu/projects/cv-platform
generated: 2026-10-12
sources:
  - public/media/projects/cv-platform/cv_platform_en.yaml
  - src/content/projects/projects_en.yaml
---

# Post
<exact text to paste — nothing else>

# Hooks I didn't use
- ...

# Image
Use public/media/projects/cv-platform/screenshot.png (1200x627 crop).
Alt text: "..."

# First comment
<link, if you prefer the first-comment placement>

# Claims audit
- "five-step build" -> cv_platform_en.yaml:23
```

`status` is passive metadata for your own tracking. The agent never enumerates
existing drafts, never flags anything already posted, and never proposes what to
write next — you name the project, it writes that one post.

## The agent — `linkedin-post-writer`

Frontmatter follows `cover-letter-writer.md`: `description`, `mode: all`,
`permissions`. No model pinned, so it inherits the session model.

Permissions:

| Action | Resource | Effect |
|---|---|---|
| shell | `*` | ask |
| shell | `git status*`, `git diff*`, `git log*` | allow |
| shell | `git commit*`, `git push*` | deny |
| edit | `*` | deny |
| edit | `linkedin/drafts/**` | allow |
| webfetch | `*` | allow |
| websearch | `*` | allow |
| skill | `*` | allow |

Body (system prompt), in order:
1. Load the `linkedin-post-writing` skill first; do not substitute memory for it.
2. Take the project slug from the request.
3. Read the case study and the card; run the eligibility gate.
4. Write exactly one draft to `linkedin/drafts/<slug>.md` and print the post.
5. Never commit, never publish, never edit anything outside `linkedin/drafts/`.
6. If the slug is unknown, ineligible, or genuinely without a story worth a post,
   say so instead of producing filler.

## Error handling

| Situation | Behaviour |
|---|---|
| `shareable: false` / absent | Refuse; name the flag and the file. |
| Slug has no case study | Report the missing path; suggest the closest match. |
| Only `_it.yaml` exists | Use it; mark `language: it`. |
| No image in the project | Produce image guidance, not a fake screenshot. |
| Claim that cannot be sourced | Drop it, or flag it for human review — never publish it. |
| URL does not resolve | Say so in the draft's notes; do not silently ship a dead link. |

## Verification

Manual acceptance checklist (documented in the plan, no new test harness):

1. `cv-platform` — has a screenshot; check the draft, the image line, and the
   claims audit.
2. `kubernetes-homelab` — has `image` blocks; check image selection.
3. `devops-platform` — `shareable: false`; check the refusal.
4. `npm test` — unchanged and green (markdown-only change).
5. Fetch the produced URL and confirm it resolves.
6. Read the draft as a non-technical recruiter: is the hook self-contained? Is
   there a job-search CTA (there must not be)?

## Documentation

- `AGENTS.md` — add `linkedin-post-writer` to the agent prose, add the skill to
  the skills list, and extend "Voice is per surface" to name LinkedIn posts as a
  prose surface. Note the `shareable:` eligibility gate and the gitignored draft
  directory.
- `linkedin/README.md` — the convention: why drafts are local, how to invoke the
  agent, where the sources are.
- `.gitignore` — `linkedin/drafts/*.md` with a comment, in the style of the
  existing cover-letter block.

## Risks

- **Skill rot.** Platform guidance changes; the skill's researched numbers are
  dated 2026 and should be re-checked if the advice ever looks stale.
- **Filler posts.** "Just write the one I name" means a weak project produces a
  weak post; the agent is instructed to refuse rather than pad.
- **Scope creep.** The deferred structured-schema/renderer (approach C) is the
  natural next step if posts ever need to be generated in bulk.

## Out of scope

Publishing or drafting through the LinkedIn API, image rendering, scheduling,
analytics, candidate suggestion and backlog tracking, and any change to the site
build, the CV content, or the existing agents.
