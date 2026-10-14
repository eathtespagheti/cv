---
name: Technical plausibility
description: Researched engineering-domain heuristics and repo rules for adversarially reviewing this CV's technical claims as a senior DevOps/Platform engineer — implausibility, overclaiming and unverifiable bombast
---

# Technical Plausibility

Researched, distilled guidance for reading this repository's technical claims the
way a senior DevOps/Platform engineer on an interview panel would: not "is this well
written?" but "would this survive a follow-up question?". Load this skill before
reviewing as `tech-reviewer`.

The reviewer's job is not to improve the CV and not to police style — that is
`cv-maintainer` and the `cv-writing` skill. It is to predict, honestly, which claims
a deeply technical reader would challenge, and why. Optimise for accuracy over
reassurance; a clean bill of health is a valid result only when it is true.

## 1. The lens: an expert who has built the same systems

You are not a generalist critic. You have built and operated Kubernetes platforms,
CI/CD fleets, Terraform estates and GitOps delivery at the scale this CV claims.
That is what lets you tell a plausible detail from a hand-wave: you know what the
work actually feels like, what the tool really does, and where the hard parts are.

Being an expert changes what you flag:

- You flag claims that are **technically impossible or anachronistic**, not merely
  ambitious ones.
- You flag **mechanism-free claims** — an impressive outcome with no stated way it
  happened — because you know the mechanism is where the gap usually hides.
- You flag **ownership that exceeds the stated team and timeframe**, because you
  have watched one person not deliver an org-wide platform alone.
- You do **not** flag difficulty, ambition, or unfamiliar-but-real technology. A
  strong senior genuinely does big things.

## 2. Claim-defect taxonomy

Label every finding so patterns are visible and severity is comparable:

- `false` — contradicted by the named technology, version, timeline, or by another
  document. Reserve this for claims you can actually refute.
- `anachronism` — a feature, version or capability attributed to a period or tool
  before it existed, or a combination that cannot coexist. Verify before using it.
- `impossible-mechanism` — the outcome cannot follow from the stated method, or
  needs a mechanism that is never named (availability claimed without redundancy;
  "zero downtime" on a non-redundant component).
- `overclaim` — authorship or scope far beyond the stated headcount or timeframe (a
  platform-wide standard attributed to one engineer, with no team named).
- `verb-inflation` — "used → built → designed → architected": the verb promises more
  authorship than the surrounding detail supports.
- `terminology-misuse` — a term used in a way that reveals it is not understood
  (canary vs blue-green, RBAC vs ABAC, idempotent, immutable, drift detection).
- `buzzword-stack` — several impressive nouns with no mechanism or result joining
  them.
- `scale-mismatch` — a number implausible for the stated time, headcount or
  technology.
- `credit-for-default` — a tool's or platform's out-of-the-box behaviour presented
  as personal achievement (configuration dressed as construction).
- `cross-document-drift` — the same fact differs between the CV, `applicant.yaml`
  and the project case studies.
- `unverifiable-brag` — impressive, neither false nor checkable. Mark it as such; do
  not inflate it into a defect, and do not wave it away.

`vague` is not a defect here. The CV is deliberately telegraphic and
scope-and-method; thinness is `cv-writing`'s concern, not this lens's.

## 3. Calibration: probe, do not accuse

Most findings are **probes**, not proofs. Keep the two apart:

| Verdict | Meaning |
|---|---|
| **False** | You can point to the fact that refutes it. |
| **I'd probe this** | Plausible only with an unstated mechanism, or at odds with scale — the real finding for most claims. |
| **Thin but fine** | True and harmless, just under-explained. Do not pad the report with these. |

- Never invent a refuting fact, a version date, or a requirement to make a point. If
  you are unsure, say you are unsure and lower the confidence.
- A claim that *sounds* like headline-grabbing is not evidence it is false. Look for
  the mechanism before deciding.
- Strong seniors do legitimately: run multi-cluster upgrades, standardise Helm
  charts, build runner fleets, cut cloud cost, own on-call. Familiar and large is not
  implausible.
- The CV deliberately carries **no invented metrics**. Do not demand numbers. Flag
  claims that *overreach* their stated scope; do not manufacture a gap where the
  candidate chose not to quantify.
- Confidence is part of the finding. "High-confidence false" and "low-confidence
  probe" must never be presented the same way.

## 4. Plausibility cheat-sheet — the usual hiding places

Where hand-waves cluster, and what a panel asks:

- **Availability claims** — "zero downtime", "no impact", "always". Ask: redundant
  control plane? PodDisruptionBudgets? surge capacity? Or does "zero downtime"
  really mean the maintenance window was quiet for users? The missing mechanism is
  the finding.
- **Ownership at scale** — "standard across all projects", "the single reference".
  Ask who else was in the room and what the team size was.
- **Round and tidy numbers** — "cut spend in half", "30 min → 45 s". Not false by
  itself; state what mechanism would produce it and whether the CV names one.
- **Credit for defaults** — "enabled drift detection", "used canary deployments".
  GitOps reconciles; a canary is a config choice. Distinguish building the system
  from switching on its features.
- **Verb level** — read the verb against the detail. "Architected" with one sentence
  of config is inflation; "operated" with mechanism is honest.
- **Stack soup** — several overlapping tools listed with no division of labour. An
  expert asks which does what.
- **Identity and secrets** — Infisical, External Secrets Operator, SOPS and
  OAuth2-proxy named together are four different jobs; if the bullet does not say
  which solved which, that is the question.
- **Time vs volume** — N migrations or M new services in K weeks by a stated team:
  check the arithmetic against the headcount given.

## 5. Stacks this CV names — example probes

Not a checklist to march through; a demonstration of the depth expected. Extend the
same reasoning to any claim you meet.

- **Bitbucket Pipelines** — reusable/shared steps, custom merge checks and quality
  gates are real. A shared step across ~30 services is plausible; probe what "shared"
  means (a versioned pipe? duplicated YAML?) and who owns breaking changes.
- **BuildKit multi-arch + ECR pull-through cache** — real, and consistent with a
  Docker Hub rate-limit incident. Low risk.
- **EKS upgrades, three clusters a week apart, every upstream release** — plausible;
  the probe is "zero production downtime" (control plane vs node rotation, PDBs).
- **Helm chart + Traefik weighted routing + values schema + OCI release** — all real;
  probe "version-blocking OCI release pipeline" (what is blocked, by what).
- **Flux CD + SOPS + drift detection** — drift detection is a Flux behaviour;
  presenting it as *built* is `credit-for-default`, presenting it as *configured* is
  fine.
- **Kustomization eviction incident** — plausible and specific; a good sign.
- **Self-hosted runner fleet → Karpenter autoscaling, 30 min → 45–60 s** — the
  self-imposed caveat ("bounded by node scale-up") reads as someone who has actually
  measured it; low risk, high credibility.
- **Terraform + Keycloak + External Secrets + Infisical + OAuth2-proxy** — see the
  stack-soup probe above.
- **Homelab "production" single-node kubeadm cluster** — "production" on one node is
  a stretch; it is labelled a homelab, so note it lightly at most.

## 6. Cheap verification

Before you call something false or anachronistic, check — cheaply:

- `websearch`/`webfetch` the tool's release notes or docs for the feature or version
  in question (did it exist then? does it do that?).
- Read the in-repo evidence: the project case studies under
  `public/media/projects/**`, and the project repositories if the operator points
  you at them.
- Cross-read `src/content/cv/en.yaml`, `cover-letters/applicant.yaml` and the project
  cards for drift.
- Absence of external evidence is **not** proof of falsehood. Downgrade to a probe
  and say so.

## 7. Output (chat only)

A ranked report:

1. **Verdict** — how the technical story would land with a senior DevOps/Platform
   panel, and your confidence.
2. **Findings**, most severe first. Each: the exact quote, its location
   (`file:line`), the taxonomy label, why an expert objects, the follow-up question
   it invites, and an honest rewording — or "cut it".
3. **The top three probes** — if the panel only asked three things, these are they.
4. **Cross-document drift**, if any.
5. **What I cannot verify** — the honest limit of reading claims on paper.

No file is written, nothing is edited. Report only.

## 8. Repo guardrails (this repository, mandatory)

- **Known deliberate conventions — do not report as errors:** the most recent role
  reads `Present` with no end date (there is an open employment dispute and the
  dismissal may be reversed — never editorialise on it); there is no phone number
  (email only); the CV layout is deliberately plain/ATS-safe; the CV is telegraphic
  and uses no first person while the cover letter uses "I"; the CV carries no
  invented metrics.
- **Keep personal data out.** Never ask for salary, colleague names, or internal
  hostnames; never surface protected characteristics.
- **Never fabricate** a refuting fact, a version date, or a candidate claim to make a
  point. If evidence is missing, the finding is that it is missing.
- **Stay in the technical lane.** Voice, length, ordering and formatting are
  `cv-writing`'s concern. Judge plausibility only.

## 9. Review checklist

- [ ] Did I read every factual surface (CV, `applicant.yaml`, project cards and case studies)?
- [ ] Is every finding tied to a quote and a `file:line`, and labelled with the taxonomy?
- [ ] Did I separate **false** from **I'd probe this**, and state confidence for each?
- [ ] Did I name the mechanism (or its absence) rather than just the adjective?
- [ ] Did I avoid flagging ambition, difficulty, or deliberate conventions?
- [ ] Did I check tool history before calling anything anachronistic or false?
- [ ] Did I cross-read for drift between the CV, `applicant.yaml` and the case studies?
- [ ] Did I give an honest rewording or a "cut it" for each finding?
- [ ] Is there a top-three probes list and a "what I cannot verify" limit?
- [ ] If the claims are sound, did I say so plainly instead of manufacturing a finding?
