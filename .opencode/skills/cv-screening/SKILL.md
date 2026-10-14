---
name: CV screening
description: Researched recruiter-screening guidance and repo rules for adversarially reviewing a tailored CV or application packet as a non-technical HR generalist
---

# CV Screening

Researched guidance for reviewing a submitted CV — or a CV + cover-letter packet —
the way a non-technical HR generalist running a first-pass screen would. Load this
skill before reviewing an application as `hr-reviewer`.

The reviewer's job is not to improve the CV. It is to predict, honestly and
unsentimentally, what a real screener at a real company would conclude — including
the reasons to move on. Optimise for accuracy, not comfort.

## 1. The screen is fast, shallow, and non-verbal

- The average initial resume screen runs about **7.4 seconds** (Ladders 2018
  eye-tracking study), and recruiters in that study spent more time on **job
  titles** than on any other element. Assume one pass, spent on titles, current
  employer, dates, and the left margin.
- Recruiters read in an **F/E pattern**, scanning the left edge. Anything not
  surfaced there — a summary, a title, the first bullet of a role — is effectively
  invisible on the first pass.
- A screen is a **filter**, not an assessment. The default outcome of the pile is
  "no"; the second look has to be earned in the first glance.
- A non-technical screener recognises **terms and rough seniority signals**, not
  depth. It cannot tell a strong engineer from a weak one; it can tell whether the
  document looks like the role.

## 2. The ATS gate, and what "passed it" means

- Over **90% of employers** use a recruitment-management/ATS system to *initially
  filter or rank* candidates (Harvard Business School, *Hidden Workers*, 2021).
  The machine usually screens before a human sees anything.
- The machine matches the posting's **must-have terms** against the document,
  extracts name/titles/dates/employers, and **fails to parse** anything that is not
  plain text (images, tables, multi-column layouts, headers/footers, unusual
  headings or fonts).
- "Passed the ATS" is often a **keyword match, not a fit match**. A *fair* pass
  requires that the must-have terms are **backed by evidence in the document**. A
  term with nothing behind it is stuffing; a human will catch it even when the
  machine let it through.

## 3. Leveling is about scope, not years

Titles and years are a proxy; **scope is the real signal**. A screen calibrates the
document against the level the posting asks for.

| Level | Rough signal | What the work looks like |
|---|---|---|
| Junior | 0–2 yrs | task-level, supervised, defined work |
| Mid | 2–5 yrs | owns features, works with some autonomy |
| Senior | 5+ yrs | owns systems, mentors, handles ambiguity |
| Staff / Principal | 8+ yrs | org-wide, cross-team, sets direction |

- **Underqualified** risk: the document shows feature-level scope for a role that
  asks for ownership of systems.
- **Overqualified** risk: the document reads well above the req. Employers fear
  boredom, retention, and cost — "why is this person applying for this?" is a real
  skip reason.

## 4. The reject-reason taxonomy

Label every dislike so patterns are visible across many applications:

- **`must-have-miss`** — a required term or credential is absent, or present
  without evidence.
- **`level-mismatch`** — reads under or over the posted level.
- **`logistics`** — eligibility, location/remote, travel/on-call, language,
  notice period, an obvious salary or seniority mismatch.
- **`credibility`** — unexplained gaps, overlapping dates, title inflation, claims
  the document contradicts, a current role with no visible momentum.
- **`signal-noise`** — the evidence exists but is buried, jargon-logged, or
  undecodable to an outside reader.
- **`overqualified`** — a specific case of `level-mismatch` with its own framing.

## 5. The competing pile and the bar

A screen is comparative. The useful question is not "is this good?" but "**why
this one over the pile?**" The strongest output names:

- the **archetype** of candidate who would rank above this one (title, years,
  domain, must-have coverage); and
- the **few concrete gaps** that put them there — not a wish list.

## 6. What a non-technical screen cannot judge

Say so, do not bluff:

- whether the technical claims are **true or deep**;
- whether the candidate can **do the job** — only whether the document looks like
  it;
- culture fit, personality, or anything not in the document.

Flagging this limit is part of doing the job honestly.

## 7. Legality and bias guardrail

- Never score **protected characteristics** (age, sex, nationality, health, family
  status). Recruiters are trained not to, and the reviewer should not either.
- If a real risk is a **proxy** for one (for example, an unusually long career, or
  a gap that is likely caregiving), name the **document signal**, not the trait.
  "Timeline not explained" is a finding; "probably a parent" is not.

## 8. Repo guardrails (this repository, mandatory)

- **Known deliberate conventions — do not report as errors:** the most recent role
  reads `Present` with no end date; there is no phone number (email only); the
  layout is deliberately plain/ATS-safe; the CV is telegraphic and uses no first
  person, while the cover letter deliberately uses "I".
- **Keep personal data out.** Never ask for salary, phone, or colleague names,
  and never surface protected characteristics.
- **Never fabricate** a posting requirement, a company fact, or a candidate claim
  to make a point. If evidence is missing, the finding is that it is missing.

## 9. Review checklist

- [ ] Did I state **why** the document passed the ATS gate, and test that pass for
      fairness?
- [ ] Is every must-have and nice-to-have marked met / partial / missing against a
      specific line — or its admitted absence?
- [ ] Does the document read at the posted **level** in a single glance?
- [ ] Is every pain point labelled with the taxonomy and tied to a line or
      omission, ordered by how likely a real screen stops there?
- [ ] Is there a **verdict** with confidence and the deciding factor?
- [ ] Is there a **bar** — who outranks this candidate and the minimal gap?
- [ ] Did I name what a non-technical screen **cannot** judge?
- [ ] Did I avoid protected characteristics and treat proxies as document signals?
- [ ] If everything is strong, did I say so plainly instead of manufacturing a
      concern?

## Sources

- Ladders, *Eye-Tracking Study* (2018) — 7.4-second initial scan, titles dominate:
  <https://www.theladders.com/static/images/basicSite/pdfs/TheLadders-EyeTracking-StudyC2.pdf>
- Harvard Business School, *Hidden Workers: Untapped Talent* (2021) — 90%+ of
  employers use an RMS/ATS to initially filter or rank candidates:
  <https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf>
- Full Scale, *The 9 Software Engineer Levels* — leveling is scope, not years:
  <https://fullscale.io/blog/software-engineer-titles-hierarchy>
- DEPT, *Junior vs. Mid vs. Senior Software Engineers* — years/skills per level:
  <https://www.deptagency.com/insight/junior-vs-mid-vs-senior-software-engineers-experience-skills-expectations-2>
- Pin, *Top 10 Candidate Rejection Reasons* — missing credentials, gaps,
  work-authorization, skills mismatch, minimum-experience filters:
  <https://www.pin.com/blog/top-rejection-reasons-modern-hiring>
- University of Illinois Chicago, Office of Career Services — *Optimizing Resumes
  for Applicant Tracking Systems (ATS)*:
  <https://careerservices.uic.edu/wp-content/uploads/sites/26/2017/08/Ensure-Your-Resume-Is-Read-ATS.pdf>
