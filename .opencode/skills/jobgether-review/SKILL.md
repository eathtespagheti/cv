---
name: Jobgether reader
description: Use when reading or updating Jobgether talent data (CV review, profile, skills, premium match, match stats) or when a Jobgether request returns 401 or bounces to the login page — covers the jg-auth-refresh session cookie, the astroapi endpoints, the full-replace profile save, and the fetch script.
---

# Jobgether Reader

Jobgether (`jobgether.com`) holds the CV review, talent profile and
premium-match data for this job hunt, but every talent page is cookie-gated. This
skill is how to read *and* update that data — including the review the CV work is
judged against.

## When to use

- Reading the Jobgether **CV review** (`career-coach/results?reportKey=cv-review`)
- Reading the **LinkedIn optimization report**
  (`career-coach/results?reportKey=linkedin-optimization`)
- Reading the **profile**, or **searching / adding / removing skills**
- **Uploading a CV and requesting a fresh review** (the `refresh-review` flow)
- **Uploading a LinkedIn PDF export and requesting an optimization review** (the
  `refresh-linkedin` flow)
- Reading **premium match** setup, match counts/stats, or other `astroapi` data
- A Jobgether call returns **401 Unauthorized** or the results page bounces to
  the login/home page

## Authentication — the thing that matters

Jobgether has **no API key or bearer token**. Auth is a set of session cookies
on `jobgether.com`, issued by Azure AD B2C (`auth.jobgether.com`).

| Cookie | Role |
|---|---|
| **`jg-auth-refresh`** | **The one that authenticates.** A JWE that the server trades for a session. Alone it returns `200`. |
| `jg-auth` | The B2C access JWT. **On its own it returns `401`** — it is not accepted by itself. |
| `jg_values` | Client-readable, non-sensitive (`userId`). |

Verified: `jg-auth-refresh` alone → `200`; `jg-auth` alone, or no cookie → `401`.

The HTML at `/talent/…/results` is a **client-rendered shell** (its `<title>` is
just "Jobgether - Home"). The real data lives in the `astroapi` **JSON**
endpoints, so fetch those, not the page.

## Get a fresh cookie

The refresh token is a credential — treat it as a password.

1. Log in to <https://jobgether.com> and open any talent page.
2. DevTools → **Application → Cookies → `https://jobgether.com`**.
3. Copy either the whole **Cookie** request header (Network tab → any
   `astroapi` request → Request Headers), or just `jg-auth-refresh=…`.
4. Put it somewhere **outside the repo** and reference it — never paste it into
   a committed file, an issue, or chat:

   ```sh
   mkdir -p ~/.config/jobgether
   $EDITOR ~/.config/jobgether/cookie          # paste the Cookie header
   ```

   The `jg-auth` JWT expires ~24h; when calls start 401-ing, repeat step 3.

## Read the data

The script lives at `src/scripts/jobgether.ts` and has no dependencies:

```sh
node src/scripts/jobgether.ts --list                 # known targets
node src/scripts/jobgether.ts cv-review              # print JSON to stdout
node src/scripts/jobgether.ts linkedin-review        # the LinkedIn optimization report
node src/scripts/jobgether.ts premium-match me \
     --out /tmp/jg                                   # write <target>.json files
```

Known targets: `cv-review`, `linkedin-review`, `me`, `premium-match`,
`match-stats`, `match-count`, `profile`, `applications-count`. Any other endpoint
works as a raw path, e.g. `astroapi/user/applications/count.json`.

| Endpoint | Returns |
|---|---|
| `astroapi/career-coach/results?reportKey=cv-review` | Full CV review: overview, working/missing, scores, 40-point checklist, recommendations |
| `astroapi/career-coach/results?reportKey=linkedin-optimization` | LinkedIn optimization report: overview, working/missing, four scored areas, per-section recommendations, total score |
| `astroapi/user/cv-review.json` | Identity + premium flags + `cv_url` |
| `astroapi/user/premium-match-data.json` | Premium flags, quotas, wished roles |
| `astroapi/match/stats`, `astroapi/match/count` | Match tallies |
| `astroapi/user/profile.json` | The whole talent profile: identity, skills, wished jobs, salary, locations, languages |
| `astroapi/user/applications/count.json` | Application tally |

Cookie resolution order: `--cookie` → `--cookie-file` → `$JOBGETHER_COOKIE` →
`$JOBGETHER_COOKIE_FILE` → `~/.config/jobgether/cookie`.

## Upload a CV and request a fresh review (write side)

The same cookie also *writes*: it can replace the CV Jobgether is reviewing and
queue a new review. Captured from a logged-in session (HAR
`jobgether.com_upload-review.har`), the order and payloads are:

| Step | Request | Notes |
|---|---|---|
| 1 | `POST astroapi/user/cv/upload.json` | `multipart/form-data`, one part named `file` (`application/pdf`) → `{id, url, size, contentType}` |
| 2 | `POST astroapi/user/index.json` | `{cv_url: <url>, cv_filename: <id>}` — points the profile at the new file |
| 3 | `POST astroapi/career-coach` | `{"service":"feedback_user"}` — queues the review |
| 4 | `GET astroapi/career-coach/progress?task=feedback_user` | Poll every ~5 s: `pending` → `processing` (60 %, "Generating feedback") → `completed` (100 %) |
| 5 | `GET astroapi/career-coach/results?reportKey=cv-review` | The new review (same read as `cv-review`) |

```sh
# After `npm run build` the export carries a content hash, so resolve it first:
CV=$(ls public/downloads/resume_en.*.pdf | head -1)

# whole loop: upload → index → queue → poll → print the new review
node src/scripts/jobgether.ts refresh-review "$CV" --out /tmp/jg

# the steps on their own
node src/scripts/jobgether.ts upload "$CV"   # steps 1–2
node src/scripts/jobgether.ts request-review         # step 3, then poll to done
node src/scripts/jobgether.ts progress               # poll the CV task
```

`--poll SEC` sets the poll interval (default 5 s) and `--timeout SEC` bounds the
wait (default 300 s). A non-`completed` terminal status (`failed`, `error`) or a
timeout exits non-zero. The uploaded file goes straight from disk — the script
never logs the cookie.

**This mutates the Jobgether account** — it replaces the CV being reviewed and
spends a review — so run it deliberately, not as part of a read.

## Upload a LinkedIn PDF export and request an optimization review (write side)

Jobgether's **LinkedIn Profile Optimization** is the same shape as the CV loop on
its own endpoints (HAR `linkedin-optimizer.har`). First export the profile from
LinkedIn: on your profile page, **More → Save to PDF** (or *Settings & Privacy →
Data privacy → Get a copy of your data*). Then:

| Step | Request | Notes |
|---|---|---|
| 1 | `POST astroapi/user/cv/upload-linkedin.json` | `multipart/form-data`, one part named `file` (`application/pdf`) → `{id, url, size, contentType}`; the id is prefixed `talent-linkedin/` |
| 2 | `POST astroapi/user/index.json` | `{linkedin_pdf_url: <url>, linkedin_pdf_filename: <id>}` — points the profile at the export |
| 3 *(optional)* | `POST astroapi/user/index.json` | `{profesional_url: <linkedin url>}` — records the profile URL (one `s`, the site's spelling) |
| 4 | `POST astroapi/career-coach` | `{"service":"linkedin_profile_optimization"}` — queues the optimization |
| 5 | `GET astroapi/career-coach/progress?task=linkedin_profile_optimization` | Poll: `pending` → `processing` (`upload_pdf` 40 %, `generate` 60 %) → `completed` |
| 6 | `GET astroapi/career-coach/results?reportKey=linkedin-optimization` | The optimization report (same read as `linkedin-review`) |

```sh
# whole loop: upload → index → queue → poll → print the report
node src/scripts/jobgether.ts refresh-linkedin Profile.pdf --out /tmp/jg

# also record your LinkedIn URL in the profile (step 3)
node src/scripts/jobgether.ts refresh-linkedin Profile.pdf --linkedin https://www.linkedin.com/in/you

# the steps on their own
node src/scripts/jobgether.ts upload-linkedin Profile.pdf   # steps 1–2
node src/scripts/jobgether.ts request-linkedin-review        # step 4, then poll to done
node src/scripts/jobgether.ts progress linkedin_profile_optimization   # poll that task
```

The report is `data.feedback`: `overview`, `whats_working[]`, `whats_missing[]`,
`short_definition`, `scoring_checklist` (four keyed areas of `{Pass, Note}`),
`metrics` (a `score` per area), `actionable_recommendations` (`Headline_photo`,
`About_Section`, `Experience_Section`, `Activity_leadership`,
`Optional_Additions` — each `{current, recommended, why_it_matters, tip, impact}`)
and `total_score` (`score`, `original_score`).

**This mutates the Jobgether account** — it replaces the stored LinkedIn export
and spends an optimization run — so run it deliberately, not as part of a read.
Saving the LinkedIn URL (step 3) is a separate profile write.

## Read and update the profile and skills (write side)

The same cookie reads *and* writes the profile. Captured from a logged-in session
(a profile edit plus a skill add):

| Step | Request | Notes |
|---|---|---|
| read | `GET astroapi/user/profile.json` | The whole profile (read shape) |
| search | `GET astroapi/autocomplete/skills.json?term=…` | `[{"_id","name"}]` candidates; `softSkills.json` for soft skills |
| save | `POST astroapi/user/index.json` | `application/x-www-form-urlencoded` — a **full replace** of every profile field; returns `{"message":"User updated successfully!"}` |

**Skills are not an endpoint.** They are `key_hard_skills[]` / `hard_skills[]` /
`soft_skills[]` fields in the same save form, so adding a skill means rewriting
the whole profile with one more id in the list. The script therefore does
read → patch → POST → re-read (verify) for every write, and carries every other
field through untouched:

```sh
node src/scripts/jobgether.ts profile --out /tmp/jg       # read (JSON)
node src/scripts/jobgether.ts skills terraform            # search the autocomplete
node src/scripts/jobgether.ts skills team --soft
node src/scripts/jobgether.ts skill-add terraform go      # add (hard skills)
node src/scripts/jobgether.ts skill-add keycloak --key    # add to key_hard_skills
node src/scripts/jobgether.ts skill-add team-leadership --soft
node src/scripts/jobgether.ts skill-remove ansible
node src/scripts/jobgether.ts profile-save --set 'description=…'
node src/scripts/jobgether.ts profile-save --from-file patch.json
```

Add `--dry-run` to any write to build and print the change set without POSTing.
`skill-add` resolves each term against the autocomplete (exact `_id`, then exact
`name`, then a sole candidate); `skill-remove` matches existing skills by `_id`
or `name` without a search.

Gotchas:

- **Salary units differ between read and write.** `profile.json` reports
  `wished_salary_min`/`wished_salary_max` in **thousands** (44), while the save
  form takes the **absolute** figure (44000). `profileToForm` scales ×1000.
- The form uses the site's own `profesional_title`/`profesional_url` spelling
  (one `s`). Keep it.
- `dataComplete` is derived from the read `isUserDataComplete` flag.
- A `.har` of this flow is a full credential dump (the cookie *and* the profile).
  Never commit it.

These commands **change the Jobgether profile** — treat them as deliberate.

## Rules

- **Never commit a cookie or a `.har`.** Both are gitignored; keep it that way.
  A `.har` of a logged-in session is a full credential dump.
- **Never print the cookie.** The script doesn't; don't add logging that does.
- **The write commands change the account.** `upload`, `request-review` and
  `refresh-review` replace the CV Jobgether reviews and queue a new review;
  `upload-linkedin`, `request-linkedin-review` and `refresh-linkedin` replace the
  stored LinkedIn export and queue an optimization (and `--linkedin` writes the
  profile URL); `skill-add`, `skill-remove` and `profile-save` rewrite the whole
  profile. Treat them all as deliberate actions, never as a side effect of
  reading. Prefer `--dry-run` first, and prefer the `jobgether` agent for profile
  edits.
- Prefer reading from `~/.config/jobgether/cookie` (outside the repo) so a
  stray `git add -A` cannot capture it.
- Rotate: log out of Jobgether (or clear cookies) once you're done.

## Troubleshooting

- **`401`/`403`** → cookie missing or expired. Re-copy `jg-auth-refresh`; the
  access JWT's ~24h life is the usual cause (the script prints this hint).
- **Redirect to `/`** → same cause: the session isn't being sent.
- **Quoted values 401** → you pasted `name="value"` with the quotes; the script
  strips them, but confirm you passed the whole header, not one mangled value.
- Check the plumbing without network: `node --test src/scripts/jobgether.test.ts`
  (the live test only runs when `JOBGETHER_COOKIE` is set).
