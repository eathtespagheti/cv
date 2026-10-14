---
name: Cover letter writing
description: Researched cover-letter guidance and this repo's applicant.yaml + render.mjs workflow
---

# Cover Letter Writing

Researched guidance for writing this repository's cover letters, plus the house
workflow that constrains them. Load this skill before drafting a letter for a
job posting.

A cover letter is not a summary of the CV. It is a short argument for fit,
written for one specific posting at one specific company.

## 1. When to use

When asked to write, tailor, or review a cover letter for a job posting, and
before touching anything under `cover-letters/`.

## 2. Structure

- **Greeting** — "Dear <name>" when a hiring manager can be found, otherwise
  "Dear Hiring Manager".
- **Opening** — one or two sentences: what you are applying for and why. This is
  the only paragraph written from scratch for every application.
- **Evidence** — one or more paragraphs drawing on relevant, proven experience.
  Each should lead with a specific, quantified outcome.
- **Why this company** — two or three sentences that could only be said about
  this company. Vague flattery is worse than omitting it.
- **Close** — one sentence thanking them and restating the strongest fit, then a
  sign-off.

## 3. Length & restraint

- Three to four paragraphs, no longer than three-quarters of a page.
- Never restate the CV. The letter adds interpretation and intent; the CV carries
  the evidence.
- No humour, creative prose, or quotations. It is a professional document.
- Plain, direct sentences. The reader is skimming.

## 4. Evidence over adjectives

- Replace claims with proof: a specific example, a number, a named technology in
  context.
- "I own the delivery pipeline for about 30 microservices across roughly 20
  repositories" beats "I am an experienced DevOps engineer".
- One strong example per point; do not stack adjectives.

## 5. Research the company

- Look at what they do, their values, their engineering writing, and the posting
  itself.
- Say only what you could only say about them. If a sentence would fit any
  company, it does not belong in the "why this company" paragraph.
- Never invent details about the company; if research turns up nothing usable,
  say so rather than padding.

## 6. House workflow (this repository, mandatory)

- The letter is assembled from `cover-letters/applicant.yaml` (reusable facts and
  theme paragraphs) and one per-application file, rendered by
  `cover-letters/render.mjs`.
- Select themes **only** from the keys under `paragraphs` in `applicant.yaml`,
  and order them so the letter leads with what the posting leads with. That
  ordering *is* the argument.
- `opening` and `why_company` are the only original prose written per
  application. Everything else is sourced from `applicant.yaml`.
- Write the per-application file as `cover-letters/applications/<slug>.yaml` in
  the shape of the committed `example.yaml` (fields: `role`, `company`,
  `source`, `greeting`, `opening`, `themes`, `why_company`, `closing`).
- Render with `npm run letter -- <slug>`. It validates themes and required fields
  and names what is missing.
- `applications/` is gitignored; drafts and company names stay local.

## 7. Sourcing rule

No sentence may be generated that was not supplied or deliberately selected. If
the strongest claim for a posting is not yet in `applicant.yaml`:

- propose a new reusable theme paragraph for `applicant.yaml`, and
- flag it for human review rather than slipping it into a draft.

`applicant.yaml` must never claim more than `src/content/cv/en.yaml` supports. A
letter that contradicts the CV is worse than no letter. When a claim changes on
the CV, change it here too.

## 8. Review checklist

- [ ] Does the opening name the role and the reason for applying?
- [ ] Are there three to four paragraphs, within three-quarters of a page?
- [ ] Does every evidence point carry a specific, quantified example?
- [ ] Does the "why this company" paragraph pass the "only about them" test?
- [ ] Does every `themes` entry exist under `paragraphs` in `applicant.yaml`, in a deliberate order?
- [ ] Is the opening the only place first-person "I" carries new information, and
  is the "why this company" line specific?
- [ ] Does anything claim more than the CV supports?
- [ ] Is every company-specific fact researched, not invented?
- [ ] Would any sentence fit a letter to a different company?

## Sources

- ASME, *4 Tips on How to Write the Best Engineering Cover Letter*:
  <https://www.asme.org/topics-resources/content/4-tips-how-to-write-the-best-engineering-cover-letter>
- Colorado College Career Center, *Cover Letter Guide* (structure, research the
  company, one page): <https://www.coloradocollege.edu/offices/careercenter/documents/guides/coverletterguide>
- This repo's `cover-letters/README.md` ("Working with an agent", "Keeping it
  honest") and `cover-letters/templates/cover-letter.md.j2`.
