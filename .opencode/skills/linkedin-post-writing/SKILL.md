---
name: LinkedIn post writing
description: Researched LinkedIn post guidance and this repo's project-to-draft workflow
---

# LinkedIn Post Writing

Researched guidance for turning one project in this repository into a LinkedIn
post, plus the house workflow that constrains it. Load this skill before
drafting a post about a project.

A post is a showcase, not a summary of the case study: one idea, said in your
own voice, with every claim traceable to a file in this repo.

## 1. When to use

When asked to write, draft, or review a LinkedIn post about a project in this
repo, and before touching anything under `linkedin/`. One post per project slug;
the human names the project, you write that one post.

## 2. Sources, in order of truth

- **Case study** — `public/media/projects/<slug>/<slug_underscored>_en.yaml`.
  The narrative source. `<slug_underscored>` is the slug with `-` replaced by
  `_` (`cv-platform` → `cv_platform_en.yaml`). Blocks are
  `text | divider | image | video | code`; its `tagline`, `role`, `year`, `stack`
  and body prose are the post's material.
- **Card** — `src/content/projects/projects_en.yaml`. Supplies `tags`,
  `metrics`, `stack` and `links`.
- **Cross-check only** — `src/content/cv/en.yaml` and
  `cover-letters/applicant.yaml`. Use them to confirm a fact; do not lift their
  telegraphic voice.
- Italian copy comes from the `_it.yaml` counterparts when a language is
  requested.

## 3. Eligibility gate (mandatory, checked first)

The case study must carry `shareable: true`. If it is `false` or absent,
**stop** and report why — name the flag and the file — rather than writing.
`devops-platform` is the known ineligible one. This is the repo's existing "may
be promoted publicly" marker, the same one that gates the copy-link button on
the project page, so you never have to guess.

## 4. Voice

First person, prose. This is a new prose surface: like case-study bodies and
cover-letter facts, it may say "I". It is not the CV's telegraphic voice. Facts
must still match every other surface in the repo.

English by default; Italian on request, appended to the same draft as a second
`# Post (it)` block (see §11).

## 5. Structure

- **Hook** — the first ~200 characters, which is all that shows before
  "…see more". It must carry the post's whole point; never a warm-up sentence.
- **Framing** — one sentence naming what this is and why a DevOps/Platform peer
  should care.
- **Body** — three to six short paragraphs: the problem, the approach, the
  concrete specifics (named technologies in context), the result. Each paragraph
  must survive the "so what?" test.
- **Takeaway** — the transferable lesson, in one or two sentences.
- **Invitation** — one genuine question, not engagement bait.

The three-to-six-paragraph count covers the **body only**. The framing sentence,
the takeaway and the invitation sit outside it.

There is no job-search CTA anywhere. The post is pure showcase: no
open-to-work signal, no "reach out if you're hiring", nothing that turns it into
an application.

## 6. Links

- Put the project URL as a **plain-text URL**, in the **body** or in the **first
  comment** — one placement, not both. **Do not rely on an attached link preview
  card.**
- Researched basis: a 2026 study of 566,957 LinkedIn posts with synced analytics
  found posts with an attached link preview card reach 414 median impressions
  against 795 without one, while an in-body URL costs essentially nothing (858).
  LinkedIn's 2026 algorithm additionally rewards original point-of-view and
  educational posts.
- The canonical URL is `https://cv.eathtespagheti.eu/projects/<slug>` for English
  (the default language takes no suffix) and
  `https://cv.eathtespagheti.eu/projects/<slug>/it` for Italian. Verify it
  resolves before finalising; if it does not, record it under `# Claims audit`
  rather than ship a dead link.

## 7. Length, format, tags

- Target ~700–1,300 characters, counted as the text of the `# Post` block — its
  URL and hashtags included — and excluding the front-matter and the other
  sections. Short lines, a blank line between paragraphs, no wall of text.
- Zero to five (0–5) **specific** hashtags at the end (`#kubernetes`,
  `#platformengineering`), not generic ones (`#tech`, `#innovation`).
- Emoji sparse and optional; never as bullet substitutes.
- Do not @-mention people who have not opted in.

## 8. Banned phrases

The clichés and engagement-bait the platform demotes — never use them:
"Thrilled to announce", "excited to share", "humbled", "I'm proud to share",
"Thoughts?", "Agree?", "Let that sink in", "🚀".

Each stands in for a fact. Write the fact instead; if there is no fact, cut the
sentence.

## 9. Honesty and safety rules

- Every number and claim must be traceable to a source file; no invented
  metrics.
- The repo's public-data rules apply and bite harder on LinkedIn:
  no internal hostnames, no employer-confidential detail, no colleague names, and
  no named security-vulnerability details against employer systems.
- Attribute reused third-party work as a closing line of the post (e.g. "Built on
  the MIT-licensed cv_hub framework." for `cv-platform`).
- Vague superlatives are dropped, not softened.
- A claim that cannot be sourced is dropped or flagged for human review — never
  published.

## 10. Image guidance

- If the case study has an `image` block (or the project directory has a
  screenshot), name the exact file and give the target size and crop in the same
  terms as the second bullet below — 1200×627 px (1.91:1) landscape or 1080×1350 px
  (4:5) portrait. Only 8 of 23 projects have any image today.
- Otherwise, describe **one** specific image to create: what it must show, why,
  and the upload spec — 1200×627 px (1.91:1) landscape or 1080×1350 px (4:5)
  portrait, ≤5 MB, PNG/JPG, ≥1200 px wide.
- Always write alt text.
- Never invent a screenshot, mock data, or a UI that does not exist.

## 11. Output contract

Write `linkedin/drafts/<slug>.md` (create `linkedin/drafts/` if it is missing)
and print the post in chat. Shape:

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
- "five-step build" -> cv_platform_en.yaml:32
```

`project:` is the project card's `name` (`src/content/projects/projects_en.yaml`),
falling back to the case study's `title`. `# Hooks I didn't use` lists two or
three alternative hooks. When the project URL already appears in the body (§6),
omit `# First comment`, or mark it `none` — never the same link in both places.

`status` is passive metadata for your own tracking. Never enumerate existing
drafts, never flag anything already posted, and never propose what to write next
— the human names the project, you write that one post.

`# Claims audit` records the source of every number, and any link that did not
resolve (see §6).

When Italian is requested, `language:` becomes `en+it` — or `it` alone if only
Italian was requested — and the draft gains a second block headed `# Post (it)`
holding the Italian text. The Italian post's link is
`https://cv.eathtespagheti.eu/projects/<slug>/it`.

## 12. House workflow (mandatory)

1. Run the eligibility gate first; refuse an unshareable or unknown slug.
2. Read the case study, then the card; write exactly one draft to
   `linkedin/drafts/<slug>.md`, and print the post in chat.
3. **Never** commit, **never** publish, and **never** edit anything outside
   `linkedin/drafts/`.
4. Refuse rather than pad: if there is no story worth a post, say so instead of
   producing filler.

## Sources

- MagicPost, *Do External Links Kill Your LinkedIn Reach? The Data* — the
  attached-link-preview penalty, the 414 vs 795 median impressions, and the 858
  in-body URL figure: <https://magicpost.in/blog/linkedin-external-links-reach>
- Hootsuite, *How the LinkedIn algorithm works in 2026* — the platform rewarding
  original point-of-view and educational posts:
  <https://blog.hootsuite.com/linkedin-algorithm/>
- Contentdrips, *LinkedIn Post Size 2026* — the 1200×627 and 1080×1350 image specs
  and the ≤5 MB, PNG/JPG guidance:
  <https://contentdrips.com/blog/2023/12/optimal-linkedin-post-size>

The platform figures above are dated 2026 and should be re-checked if the advice
ever looks stale.
