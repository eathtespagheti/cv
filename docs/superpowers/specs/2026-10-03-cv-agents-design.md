# Custom OpenCode agents for the CV repo — design

Date: 2026-10-03
Status: Design approved in chat, awaiting written-spec review

## Problem

Maintaining this CV is a recurring, multi-document job: the canonical CV
(`src/content/cv/en.yaml`), the cover-letter facts
(`cover-letters/applicant.yaml`), and the showcase
(`src/content/showcase/projects_en.yaml` + `public/media/projects/<slug>/`)
must stay consistent, truthful, and well written. Each job currently starts
from scratch in a general-purpose session. There is no specialist that knows
the house rules, and nothing owns cross-document drift (the repo itself warns
about it in `AGENTS.md` and `applicant.yaml`).

## Goal

Three project-scoped OpenCode agents, backed by two shared guideline skills,
that:
1. keep the canonical CV well written, clean, ordered, detailed, and consistent
   with the other documents;
2. turn a project you point at into reconciled CV/showcase updates;
3. write tailored cover letters for a posting, following researched guidance;
4. produce a tailored CV for a posting, cutting noise and emphasising relevance,
   without touching the canonical files.

Non-goals: changing the CV's runtime/build stack; committing tailored CVs;
adding code or tests (this is a markdown-only change).

## Decisions (agreed in brainstorming)

| Question | Decision |
|---|---|
| Roster shape | **C — three agents, one CV owner.** No separate sync agent; consistency is owned by the CV agent. |
| Agent location | **Project-scoped** in `.opencode/agents/`, versioned with the repo. |
| Edit authority | **Role-appropriate, git diff is the gate.** The CV agent and the two writers edit their own turf; nothing commits or pushes. |
| `cv-maintainer` authority | **Writer** — edits canonical CV, profiles, showcase, case studies, `applicant.yaml`. |
| Guidelines | **Shared skills**, researched once at authoring time and stored in `.opencode/skills/`. |
| Tailored CV output | **Transient per-application artifact**, gitignored. Canonical files untouched. |
| Rendering | **Existing scripts**: write `public/cv/en_<spec>.yaml`, run `resume:generate` + `resume:pdf`. No new code. |
| Guardrail reframing | The "no end date" rule applies to **the most recent position**, not BizAway specifically. |

## Architecture

```
.opencode/
├── agents/
│   ├── cv-maintainer.md          # writer: CV quality + project intake + consistency
│   ├── cover-letter-writer.md    # writer: posting -> applications/<slug>.yaml -> render
│   └── tailored-cv.md            # writer: posting -> public/cv variant -> render
└── skills/
    ├── cv-writing/SKILL.md       # researched tech-CV guidance + repo guardrails
    └── cover-letter-writing/SKILL.md  # researched cover-letter guidance + house workflow
```

Plus an `AGENTS.md` wording change (see "Guardrails"). No `.gitignore` change is
needed: tailored output lands only in already-ignored `public/` (see "Tailored CV").

Each agent is a Markdown file whose YAML frontmatter carries `description`,
`mode: all`, and `permissions`; the body is the system prompt. No model is
pinned, so each agent inherits the session model.

## Agents

### 1. `cv-maintainer` (writer)

Owns the canonical CV and its consistency. Two task types handled by one prompt:

- **Audit.** Review `src/content/cv/en.yaml` (and cross-check
  `cover-letters/applicant.yaml` and the showcase/case studies) against the
  `cv-writing` skill and the repo guardrails. Report findings ordered by
  severity with `file:line`, then apply agreed fixes.
- **Project intake.** Given a local path, git repo, or URL, read the project,
  extract the skills and technologies it actually evidences, judge whether it
  merits a showcase card, and reconcile into `src/content/cv/en.yaml`
  (skills/experience where accurate), `src/content/showcase/projects_en.yaml`,
  and the relevant case study.

Rules:
- Never invent experience, metrics, or technologies. Report gaps instead.
- The most recent experience entry carries no end date; do not add one.
- Keep `en.yaml`, `applicant.yaml`, and the showcase mutually consistent; if a
  claim changes in one, update the others.
- Preserve the Astro content schema; validate by building.
- The repo is public: everything written is published.

### 2. `cover-letter-writer` (writer)

Given a job posting (pasted text, URL, or file) and the CV + showcase:

- Select and order existing themes from `cover-letters/applicant.yaml` so the
  letter leads with what the posting leads with.
- Write only the `opening` and `why_company` prose (the fields that must be
  specific to the posting). Everything else is sourced from `applicant.yaml`.
- Write `cover-letters/applications/<slug>.yaml` in the shape documented by the
  committed `example.yaml`, then run `npm run letter -- <slug>`.
- If a needed claim is not sourced from `applicant.yaml`/CV, **propose a new
  reusable theme paragraph and flag it for review** rather than inventing it.
- Keep `applicant.yaml` consistent with the CV.

### 3. `tailored-cv` (writer)

Given a job posting:

1. Parse the posting into must-haves vs nice-to-haves.
2. Map them to CV evidence; propose a **cut list** (noise) and **emphasis list**
   (relevance) and confirm with the user before writing.
3. Write the tailored merged variant; trim and re-order only, never fabricate.
4. Render and report what was cut/emphasised and why.

Never edits `src/content/cv/en.yaml` or `profiles.yml`.

## Shared skills

**`cv-writing`** — used by `cv-maintainer` and `tailored-cv`. Distilled,
cited guidance covering structure and ordering, the achievement bullet formula
(action → scope → technology → outcome/metric), quantification, tense, length,
ATS-safe phrasing, what to omit, and common failure modes. Candidate sources to
curate at authoring time: Google's XYZ bullet guidance, the Tech Interview
Handbook resume guide, university career-service guides, and reputable
developer-CV writing guides. The skill also restates the repo guardrails.

**`cover-letter-writing`** — used by `cover-letter-writer`. Researched guidance
(three to four paragraphs, no restating the CV, researched company specifics,
concrete evidence over adjectives) plus this repo's house workflow
(`applicant.yaml` themes → `render.mjs`; no unsourced sentences), as documented
in `cover-letters/README.md`.

Skills are researched once and committed; agents may still use `websearch` to
refresh occasional facts such as a company's recent work.

## Tailored CV mechanism

Both resume scripts (`src/scripts/resume-export-pdf.mjs` and
`.github/scripts/generate-resume.js`) iterate `public/cv/*.yaml` and derive the
output suffix from the filename. `public/cv/` and `public/downloads/` are
already gitignored. Therefore:

1. `npm run cv:build` produces the merged `public/cv/en.yaml`.
2. The agent writes the tailored variant to `public/cv/en_<spec>.yaml` in the
   same merged shape.
3. `npm run resume:generate && npm run resume:pdf` render
   `public/downloads/resume_en_<spec>.{txt,docx,pdf}`.

No tracked file changes, no new code, and no `.gitignore` change: `public/cv/`
and `public/downloads/` are already ignored. The variant is never committed, but
nothing removes it automatically — the agent deletes
`public/cv/en_<spec>.yaml` once it has rendered.

## Permissions

Shared for all three: `read`/`glob`/`grep` come from OpenCode's global defaults;
`webfetch`/`websearch` and `skill` are allowed explicitly. `shell *` defaults to
`ask`, while `git push` and `git commit` are denied. Agent-specific turf:

| Agent | May edit | Key shell commands allowed |
|---|---|---|
| `cv-maintainer` | `src/content/cv/**`, `src/content/profiles/**`, `src/content/showcase/**`, `public/media/projects/**`, `cover-letters/applicant.yaml` | `npm run cv:build`, `npm run build`, `npx astro build`, `git status/diff` |
| `cover-letter-writer` | `cover-letters/applications/**`; `cover-letters/applicant.yaml` only to add a proposed theme, flagged in its reply (`ask`) | `npm run letter*`, `git status/diff` |
| `tailored-cv` | `public/cv/**` only | `npm run cv:build`, `npm run resume:generate`, `npm run resume:pdf`, `git status/diff` |

Exact rule ordering follows OpenCode V2 semantics (last matching rule wins;
broad rules precede exceptions).

## Guardrails (encoded in the skills/agents and `AGENTS.md`)

- The most recent position has no end date; do not add one. (`AGENTS.md`'s
  BizAway-specific wording is generalised, keeping the rationale.)
- No personal data: salary, colleague names, specific vulnerability details
  against named employer systems, internal hostnames, phone number. Email only.
- Claims must be consistent across CV, `applicant.yaml`, and showcase.
- The repo is public; committed text is published.

## Verification

No TDD (markdown-only). Verification is static checks plus artifact assertions.

1. **Static:** each agent's frontmatter parses as YAML with `description`,
   `mode`, `permissions`; both `SKILL.md` files exist.
2. **Discovery:** `opencode run --agent <name> "..."` resolves each agent by ID.
3. **Behavioural smoke tests:**
   - `cv-maintainer` audit run: reports the latest-role-no-end-date rule;
     `git status --porcelain` stays clean. Seeded-defect fix run: build passes,
     diff limited to expected files.
   - `cover-letter-writer`: every `themes` key in the output exists in
     `applicant.yaml`; output is gitignored; `npm run letter -- <slug>` exits 0.
   - `tailored-cv`: no tracked-file changes (`git status --porcelain`);
     `public/downloads/resume_en_<spec>.{txt,docx,pdf}` exist.
4. **Guardrail check:** grep prompts and `AGENTS.md` for the generalised rule,
   absence of the BizAway-specific phrasing, and no personal data.
5. **Manual:** select each agent as a primary agent in a fresh session and
   confirm the UX.

## Risks / notes

- Merging audit, intake, and consistency into one agent makes a large prompt
  (the cost of choosing roster C). Shared skills absorb the bulk of the
  guidance; if the prompt still feels overloaded, split consistency into a
  fourth agent later (roster B) without reworking the skills.
- `opencode run --agent` starts a fresh process, so it should discover new
  `.opencode/agents/` files; the interactive TUI may need a restart.
- The tailored variant is lost on the next full build by design. If you later
  want durable, deployable cuts, that is the committed-profile option we
  rejected here.

## Out of scope

- New scripts, tests, or build changes.
- Committed profile variants.
- Any change to the site, themes, or download pipeline.

## Addendum — 2026-10-05: `hr-reviewer` (screener)

A fourth agent was added after the original three, with its own skill:

| | |
|---|---|
| `hr-reviewer` | **Screener / reviewer** — read-only; impersonates a non-technical HR generalist screening one posting. |
| `cv-screening` skill | Researched screening guidance: the 7.4-second skim, the ATS gate, scope-based leveling, a reject-reason taxonomy, legality, and the repo guardrails. |

Design decisions (bounded change, approved in chat):

- **HR-realistic boundary.** The reviewer reads only the posting and the submitted
  artifact(s) — the rendered tailored CV and/or the cover letter. It must not read
  `src/content/cv/en.yaml`, `cover-letters/applicant.yaml`, the case studies, or
  the tailoring rationale, so its judgments stay as shallow as a real screen's.
- **Inputs are flexible.** CV alone, CV + letter, or any packet it is pointed at;
  the posting is required, and it stops without one.
- **Chat-only output.** No files; `edit: *` is denied and no shell write is
  granted. The review is a lens, not a committed artifact.
- **Adversarial, calibrated.** Its default is to find the legitimate skip reason,
  but "strong pass, no material reason to skip" is a valid verdict — not a doom
  machine.
- **Extra passes:** 6-second skim simulation, logistics/deal-breaker scan,
  in-packet consistency and timeline scan, interview-risk forecast, a concrete
  "rejection email", company/role context, and — across multiple packets — a
  rank-plus-systematic-gaps report.
