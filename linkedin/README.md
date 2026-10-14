# LinkedIn posts

One draft per project, written for you to review and post by hand. Nothing here
is published by the tooling — LinkedIn has no API in this repo, and a post is a
thing you say in your own voice, so the last step is always yours.

Drafts live in `linkedin/drafts/<slug>.md` and are gitignored. The posts are
per-project and often refer to work you have not announced yet; the convention
is worth committing, the drafts are not.

## Writing one

Ask the `linkedin-post-writer` agent for a project slug:

```
Write a LinkedIn post for cv-platform.
```

The agent reads the project and writes `linkedin/drafts/cv-platform.md`. Open it,
edit it, paste it into LinkedIn. To retry or rewrite, ask again — the file is
overwritten.

## Where the content comes from

- The case study: `public/media/projects/<slug>/<slug_underscored>_en.yaml` — the
  detail page body, with the technical narrative and the images. Hyphens become
  underscores in the filename, so `cv-platform` is
  `public/media/projects/cv-platform/cv_platform_en.yaml`.
- The card: `src/content/projects/projects_en.yaml` — the entry on `/projects`,
  with the tagline, stack and metrics.

The agent writes from those two sources, and may cross-check the CV and
cover-letter facts to confirm one. Every claim in a draft is still one the project
page already makes.

## Eligibility

Only projects with `shareable: true` in their case study are eligible. That flag
already means "safe to share publicly" — it is what turns on the project page's
share button. A project without it is off limits, and the agent will refuse.

## Writing rules

The agent follows `.opencode/skills/linkedin-post-writing/SKILL.md`, which holds
the voice, structure and length rules for these posts.
