---
name: CV writing
description: Researched guidance and repo rules for reviewing, writing, and tailoring this CV
---

# CV Writing

Researched, distilled guidance for reviewing, editing, and tailoring this
repository's CV. Load this skill before auditing `src/content/cv/en.yaml`,
intaking a project, or producing a tailored CV variant.

The CV is read by two audiences: a recruiter skimming for six to eight seconds,
and an ATS parser that must extract clean text. Optimise for both.

## 1. Structure & ordering

- Sections, in this order: summary, key achievements, skills, experience
  (reverse-chronological), education, languages.
- Lead with the most relevant evidence. A reader who stops after the summary and
  achievements should already understand the value offered.
- Keep it to the length the candidate's experience supports. For a focused
  professional CV, one to two pages; cut anything that does not earn its space.
- Within a role, order bullets by relevance and impact, not chronology or by
  the order the work happened.

## 2. Achievement bullets

Use the XYZ formula popularised by Laszlo Bock (former Google SVP of People
Operations):

> Accomplished **[X]** as measured by **[Y]** by doing **[Z]**.

- **X** — the result or outcome (what changed).
- **Y** — the measurement (a number, percentage, time, cost, scale).
- **Z** — the method or technology that produced it.

Practical shape for this CV: `action verb → scope/context → technology →
measurable outcome`.

Good: "Designed and rolled out a reusable shared release step adopted across ~20
services, cutting per-service release setup and enabling canary deployments."

Weak: "Responsible for CI/CD pipelines." (No result, no scale, no method.)

Rules:
- Quantify wherever the source data allows: counts, percentages, time saved,
  frequency, scale of the estate.
- One idea per bullet. If a bullet needs "and also", split it.
- Prefer outcomes over responsibilities. A list of duties is a job description,
  not a CV.
- If a number is not known, describe concrete scope instead of inventing one.
  **Never fabricate a metric.**

## 3. Language

- Strong, specific action verbs. Banned openers: "responsible for",
  "helped with", "worked on", "involved in".
- Past tense for past roles; present tense only for what is still true of the
  current role.
- No first person ("I", "my") in the CV or in project card descriptions — both
  are telegraphic blurbs. Case-study bodies and cover-letter narrative keep
  first person; that is deliberate, not an oversight.
- Strip filler adjectives ("passionate", "dynamic", "excellent"). Replace them
  with evidence.
- Consistent terminology: name a technology the same way everywhere.
- Expand an acronym once, then use it.

## 4. Detail vs noise

- Specifics beat adjectives. "Mitigated the Docker Hub pull-rate limit with an
  ECR pull-through cache" beats "improved the build process".
- Include a technology only when the CV's owner actually used it and it matters
  to the target role. A wall of tools dilutes the ones that count.
- Prefer concrete nouns (services, clusters, pipelines) over abstractions
  (solutions, initiatives).

## 5. ATS-safe phrasing

- Standard section names: Summary / Experience / Skills / Education. Clever
  headings can stop a parser from recognising a section.
- Plain, single-column structure; no essential information in tables, text
  boxes, graphics, or headers/footers. (The repo's ATS-safe PDF export already
  enforces the layout; keep the *content* parseable.)
- Mirror the exact keywords and job titles from a target posting — truthfully
  and in context. Keyword-stuffing reads as noise to humans and gains little
  with modern parsers.
- Use normal date formats and a clear timeline with no unexplained gaps.

## 6. Common failure modes

- Duty lists with no outcomes.
- Unquantified claims ("significantly improved", "many services").
- First person in the CV or in project card descriptions (it is fine in
  case-study prose and cover letters).
- Inconsistent tense within a role.
- Buzzword padding and repeated verbs.
- Technologies listed that the evidence never supports.
- Claims that contradict the cover-letter facts or the project list.
- Internal jargon an outside reader cannot decode.

## 7. Repo guardrails (this repository, mandatory)

- **The most recent position has no end date.** It is a deliberate rule about the
  latest role, whichever role that is. Do not add an end date.
- **Keep personal data out.** No salary, colleague names, specific
  vulnerability details against named employer systems, internal hostnames, or
  phone number. Email only. The repository is public.
- **Keep the sources consistent.** `src/content/cv/en.yaml`,
  `cover-letters/applicant.yaml`, and the project list must agree. If a claim changes
  in one, update the others.
- **Everything written is published.** Treat every file in this repo as public.
- Claims must be true to what the CV's owner actually did — report gaps rather
  than inventing experience.

## 8. Review checklist

- [ ] Does the summary state the value, not the job title?
- [ ] Does every achievement bullet carry a result and, where possible, a metric?
- [ ] Are there any "responsible for" / "worked on" openers?
- [ ] Is every technology mentioned supported by evidence elsewhere?
- [ ] Is the tense correct per role?
- [ ] Are the skills grouped and ordered by relevance to the target role?
- [ ] Is the most recent role free of an end date?
- [ ] Does anything contradict `applicant.yaml` or the project list?
- [ ] Are the CV and the project card descriptions free of first person?
- [ ] Does any personal data (salary, names, internal hosts, vuln details) appear?
- [ ] Would a reader who stops after the summary know what this person does?

## Sources

- Laszlo Bock, *Work Rules!* — origin of the XYZ ("Accomplished X as measured by
  Y by doing Z") bullet formula. Background summary:
  <https://stylingcv.com/blog/google-xyz-resume-method-how-to-write-bullet-points-that-get-you-hired-2026-guide>
- Tech Interview Handbook — Writing your software engineer resume:
  <https://www.techinterviewhandbook.org/resume/>
- University of Illinois Chicago, Office of Career Services — *Optimizing
  Resumes for Applicant Tracking Systems (ATS)*:
  <https://careerservices.uic.edu/wp-content/uploads/sites/26/2017/08/Ensure-Your-Resume-Is-Read-ATS.pdf>
