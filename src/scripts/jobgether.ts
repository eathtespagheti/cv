//
//  jobgether.ts
//  CV Hub — read Jobgether talent data (CV review, premium match, …) and drive
//  the CV-review loop (upload a CV, request a fresh review) from a session cookie.
//
//  Jobgether has no API key: auth is a cookie carried on jobgether.com. The
//  one that matters is `jg-auth-refresh` (an Azure AD B2C JWE). The access JWT
//  `jg-auth` alone is rejected; without `jg-auth-refresh` every endpoint 401s.
//
//  Usage:
//    node src/scripts/jobgether.ts cv-review                      # read the review
//    node src/scripts/jobgether.ts premium-match me --out /tmp/jg
//    node src/scripts/jobgether.ts refresh-review resume_en.pdf   # upload + re-review
//    node src/scripts/jobgether.ts profile --out /tmp/jg          # read the profile
//    node src/scripts/jobgether.ts skills terraform               # search skills
//    node src/scripts/jobgether.ts skill-add terraform go --dry-run
//    node src/scripts/jobgether.ts --list
//
//  Cookie resolution, highest priority first:
//    --cookie <string>                     --cookie-file <path>
//    $JOBGETHER_COOKIE                     $JOBGETHER_COOKIE_FILE
//    ~/.config/jobgether/cookie            (default)
//
//  No dependencies. The cookie is treated as a secret: it is never printed.
//

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const JOBGETHER_ORIGIN = 'https://jobgether.com';

// The site rejects some requests from non-browser clients; a browser UA is part
// of what makes the cookie path work.
export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0';

export const DEFAULT_COOKIE_FILE = join(homedir(), '.config', 'jobgether', 'cookie');

// Profile read + write, captured from a profile-edit session. `profile.json` is
// the read shape; `index.json` is a *full-replace* form save — skills are not a
// separate endpoint, they are key_hard_skills[]/hard_skills[]/soft_skills[]
// fields in that same form, so every write is read → patch → POST → re-read.
export const PROFILE_PATH = 'astroapi/user/profile.json';
export const APPLICATIONS_COUNT_PATH = 'astroapi/user/applications/count.json';
export const AUTOCOMPLETE_SKILLS_PATH = 'astroapi/autocomplete/skills.json';
export const AUTOCOMPLETE_SOFT_SKILLS_PATH = 'astroapi/autocomplete/softSkills.json';

// Named endpoints. Anything not listed can be passed as a raw `astroapi/…` path.
export const TARGETS: Record<string, string> = {
  'cv-review': 'astroapi/career-coach/results?reportKey=cv-review',
  'linkedin-review': 'astroapi/career-coach/results?reportKey=linkedin-optimization',
  me: 'astroapi/user/cv-review.json',
  'premium-match': 'astroapi/user/premium-match-data.json',
  'match-stats': 'astroapi/match/stats',
  'match-count': 'astroapi/match/count',
  profile: PROFILE_PATH,
  'applications-count': APPLICATIONS_COUNT_PATH,
};

// The write side: upload a CV, point the profile at it, and queue a fresh review.
// Distinct from TARGETS (which are read-only GET endpoints).
export const UPLOAD_PATH = 'astroapi/user/cv/upload.json';
// The LinkedIn optimizer takes its own PDF export and stores it under a
// distinct `talent-linkedin/…` prefix; the profile index fields differ too.
export const LINKEDIN_UPLOAD_PATH = 'astroapi/user/cv/upload-linkedin.json';
export const INDEX_PATH = 'astroapi/user/index.json';
export const CAREER_COACH_PATH = 'astroapi/career-coach';
export const PROGRESS_PATH = 'astroapi/career-coach/progress';
/** The career-coach service that (re)generates the CV-review feedback. */
export const REVIEW_SERVICE = 'feedback_user';
/** The career-coach service that (re)generates the LinkedIn optimization report. */
export const LINKEDIN_REVIEW_SERVICE = 'linkedin_profile_optimization';
export const DEFAULT_POLL_INTERVAL_MS = 5000;
export const DEFAULT_POLL_TIMEOUT_MS = 300000;

export interface Target {
  alias: string;
  path: string;
}

export interface Args {
  command: string | null;
  commandArgs: string[];
  targets: string[];
  out: string | null;
  cookie: string | null;
  cookieFile: string | null;
  pollMs: number | null;
  timeoutMs: number | null;
  soft: boolean;
  key: boolean;
  dryRun: boolean;
  set: string[];
  fromFile: string | null;
  linkedin: string | null;
  list: boolean;
  help: boolean;
}

export interface FetchResult {
  status: number;
  url: string;
  body: string;
}

/** The subset of `fetch` this script uses — injectable so the flow is testable. */
export type Fetcher = (
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: Uint8Array | string;
    redirect?: 'manual' | 'follow' | 'error';
  },
) => Promise<{ status: number; text(): Promise<string> }>;

/** What `astroapi/user/cv/upload.json` returns once the file is stored. */
export interface UploadRef {
  id: string;
  url: string;
  size?: number;
  contentType?: string;
}

/** One normalized `career-coach/progress` sample. */
export interface ProgressSample {
  status: string;
  jobId?: string;
  percentage?: number;
  message?: string;
  currentStep?: string | null;
}

/** One autocomplete candidate (a hard or soft skill). */
export interface SkillRef {
  _id: string;
  name: string;
}

/**
 * One `name=value` pair in the profile save form. Order matters: the site
 * interleaves `language[][_id]`/`language[][level]` (and the wished-job pair),
 * and every `[]` field is appended in order, so a plain object would lose it.
 */
export interface FormField {
  key: string;
  value: string;
}

export interface MultipartBody {
  body: Uint8Array;
  contentType: string;
  boundary: string;
}

export interface PollOptions {
  fetch?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  intervalMs?: number;
  timeoutMs?: number;
  /** The career-coach task to poll; defaults to the CV-review service. */
  task?: string;
  onProgress?: (sample: ProgressSample) => void;
}

/**
 * Normalize a pasted cookie jar into a `name=value; name=value` header value.
 *
 * DevTools copies values quoted (`name="value"`). Quotes are stripped per
 * value — a greedy strip is what leaves a stray trailing quote and 401s.
 * A leading `Cookie:` label and newlines are tolerated.
 */
export function normalizeCookie(raw: string): string {
  return raw
    .replace(/^\s*cookie:\s*/i, '')
    .split(';')
    .map((token) => {
      const trimmed = token.trim();
      if (!trimmed) return '';
      const eq = trimmed.indexOf('=');
      if (eq === -1) return trimmed;
      const name = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (value.startsWith('"')) value = value.slice(1);
      if (value.endsWith('"')) value = value.slice(0, -1);
      return `${name}=${value}`;
    })
    .filter(Boolean)
    .join('; ');
}

/** Resolve an alias or raw `astroapi/…` path to a concrete endpoint. */
export function resolveTarget(input: string): Target {
  if (Object.prototype.hasOwnProperty.call(TARGETS, input)) {
    return { alias: input, path: TARGETS[input] };
  }
  if (/^(https?:\/\/|astroapi\/|\/astroapi\/)/.test(input)) {
    return { alias: input, path: input };
  }
  throw new Error(
    `unknown target: ${input} (known: ${Object.keys(TARGETS).join(', ')})`,
  );
}

/** Build the absolute request URL for an endpoint path. */
export function buildUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${JOBGETHER_ORIGIN}/${path.replace(/^\/+/, '')}`;
}

/** Headers for an authenticated request. Never logs the cookie. */
export function buildHeaders(cookie: string): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
    Cookie: cookie,
  };
}

/** A filesystem-safe `.json` filename for a target. */
export function outputName(target: string): string {
  const slug = target
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}.json`;
}

/** The subcommands (everything else is a read target). */
export const COMMANDS = [
  'upload',
  'request-review',
  'refresh-review',
  'upload-linkedin',
  'request-linkedin-review',
  'refresh-linkedin',
  'progress',
  'skills',
  'skill-add',
  'skill-remove',
  'profile-save',
] as const;

/** Parse CLI arguments. Defaults to the `cv-review` read target. */
export function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: null,
    commandArgs: [],
    targets: [],
    out: null,
    cookie: null,
    cookieFile: null,
    pollMs: null,
    timeoutMs: null,
    soft: false,
    key: false,
    dryRun: false,
    set: [],
    fromFile: null,
    linkedin: null,
    list: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i] ?? null;
    else if (a === '--cookie') args.cookie = argv[++i] ?? null;
    else if (a === '--cookie-file') args.cookieFile = argv[++i] ?? null;
    else if (a === '--poll') args.pollMs = toMs(argv[++i]);
    else if (a === '--timeout') args.timeoutMs = toMs(argv[++i]);
    else if (a === '--set') args.set.push(argv[++i] ?? '');
    else if (a === '--from-file') args.fromFile = argv[++i] ?? null;
    else if (a === '--linkedin') args.linkedin = argv[++i] ?? null;
    else if (a === '--soft') args.soft = true;
    else if (a === '--key') args.key = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--list') args.list = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (args.command === null && (COMMANDS as readonly string[]).includes(a)) args.command = a;
    else if (args.command !== null) args.commandArgs.push(a);
    else args.targets.push(a);
  }
  if (args.targets.length === 0 && !args.command && !args.list && !args.help) {
    args.targets = ['cv-review'];
  }
  return args;
}

/** Seconds on the command line → milliseconds; null when absent or not a number. */
function toMs(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
}

/**
 * Resolve the cookie from flags, environment, then the default file.
 * `readFile` is injectable so the precedence can be tested without touching disk.
 */
export function resolveCookie(
  opts: { cookie?: string | null; cookieFile?: string | null },
  env: Record<string, string | undefined>,
  readFile: (path: string) => string,
): { cookie: string; source: string } | null {
  if (opts.cookie) {
    const cookie = normalizeCookie(opts.cookie);
    if (cookie) return { cookie, source: 'argument' };
  }
  if (opts.cookieFile) {
    try {
      const cookie = normalizeCookie(readFile(opts.cookieFile));
      if (cookie) return { cookie, source: `file:${opts.cookieFile}` };
    } catch {
      /* fall through */
    }
  }
  if (env.JOBGETHER_COOKIE) {
    const cookie = normalizeCookie(env.JOBGETHER_COOKIE);
    if (cookie) return { cookie, source: 'env:JOBGETHER_COOKIE' };
  }
  if (env.JOBGETHER_COOKIE_FILE) {
    try {
      const cookie = normalizeCookie(readFile(env.JOBGETHER_COOKIE_FILE));
      if (cookie) return { cookie, source: `file:${env.JOBGETHER_COOKIE_FILE}` };
    } catch {
      /* fall through */
    }
  }
  try {
    const cookie = normalizeCookie(readFile(DEFAULT_COOKIE_FILE));
    if (cookie) return { cookie, source: `file:${DEFAULT_COOKIE_FILE}` };
  } catch {
    /* nothing */
  }
  return null;
}

/** The message shown when a request comes back 401. */
export function unauthorizedHint(): string {
  return (
    '401 Unauthorized — the Jobgether cookie is missing or expired.\n' +
    'Copy a fresh "jg-auth-refresh" cookie: browser DevTools → Application →\n' +
    'Cookies → https://jobgether.com. Save the whole Cookie header (or just\n' +
    'jg-auth-refresh=…) to a file, then pass --cookie-file <path> or\n' +
    'JOBGETHER_COOKIE. Treat it as a password; never commit it.'
  );
}

/** Fetch one target with the given cookie. */
export async function fetchTarget(target: Target, cookie: string): Promise<FetchResult> {
  const url = buildUrl(target.path);
  const res = await fetch(url, {
    headers: buildHeaders(normalizeCookie(cookie)),
    redirect: 'manual',
  });
  const body = await res.text();
  return { status: res.status, url, body };
}

function assertOk(res: FetchResult, what: string): void {
  if (res.status === 401 || res.status === 403) throw new Error(unauthorizedHint());
  if (res.status !== 200) throw new Error(`${what}: HTTP ${res.status}`);
}

/** GET an endpoint path with the cookie (the read side). */
export async function getJson(
  path: string,
  cookie: string,
  doFetch: Fetcher = fetch,
): Promise<FetchResult> {
  const url = buildUrl(path);
  const res = await doFetch(url, {
    headers: buildHeaders(normalizeCookie(cookie)),
    redirect: 'manual',
  });
  return { status: res.status, url, body: await res.text() };
}

/** POST a JSON body with the cookie. */
export async function postJson(
  path: string,
  payload: unknown,
  cookie: string,
  doFetch: Fetcher = fetch,
): Promise<FetchResult> {
  const url = buildUrl(path);
  const res = await doFetch(url, {
    method: 'POST',
    headers: {
      ...buildHeaders(normalizeCookie(cookie)),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    redirect: 'manual',
  });
  return { status: res.status, url, body: await res.text() };
}

/** POST raw bytes (multipart form data) with the cookie. */
export async function postBinary(
  path: string,
  body: Uint8Array,
  contentType: string,
  cookie: string,
  doFetch: Fetcher = fetch,
): Promise<FetchResult> {
  const url = buildUrl(path);
  const res = await doFetch(url, {
    method: 'POST',
    headers: {
      ...buildHeaders(normalizeCookie(cookie)),
      'Content-Type': contentType,
    },
    body,
    redirect: 'manual',
  });
  return { status: res.status, url, body: await res.text() };
}

/** POST an `application/x-www-form-urlencoded` body with the cookie. */
export async function postForm(
  path: string,
  form: FormField[],
  cookie: string,
  doFetch: Fetcher = fetch,
): Promise<FetchResult> {
  const url = buildUrl(path);
  const res = await doFetch(url, {
    method: 'POST',
    headers: {
      ...buildHeaders(normalizeCookie(cookie)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encodeForm(form),
    redirect: 'manual',
  });
  return { status: res.status, url, body: await res.text() };
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  md: 'text/markdown',
};

/** Best-effort MIME type from a filename extension. */
export function guessContentType(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Encode one file as a multipart/form-data body, as Jobgether's upload expects:
 * a single part named `file` carrying the raw bytes and their content type.
 */
export function buildMultipart(
  filename: string,
  contentType: string,
  data: Uint8Array,
  boundary = `----jobgetherformboundary${randomBytes(16).toString('hex')}`,
): MultipartBody {
  const safeName = filename.replace(/[\r\n"]/g, '_');
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const headBytes = new TextEncoder().encode(head);
  const tailBytes = new TextEncoder().encode(tail);
  const body = new Uint8Array(headBytes.length + data.length + tailBytes.length);
  body.set(headBytes, 0);
  body.set(data, headBytes.length);
  body.set(tailBytes, headBytes.length + data.length);
  return { body, contentType: `multipart/form-data; boundary=${boundary}`, boundary };
}

/** Parse the upload response (`{id,url,size,contentType}`). */
export function parseUpload(body: string): UploadRef {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('upload: the response was not JSON');
  }
  const o = parsed as Partial<UploadRef> | null;
  if (!o || typeof o.id !== 'string' || typeof o.url !== 'string') {
    throw new Error('upload: the response is missing id/url');
  }
  return {
    id: o.id,
    url: o.url,
    size: typeof o.size === 'number' ? o.size : undefined,
    contentType: typeof o.contentType === 'string' ? o.contentType : undefined,
  };
}

/** The body that points the profile at a freshly uploaded CV. */
export function buildIndexBody(upload: UploadRef): { cv_url: string; cv_filename: string } {
  return { cv_url: upload.url, cv_filename: upload.id };
}

/** The body that points the profile at a freshly uploaded LinkedIn PDF export. */
export function buildLinkedinIndexBody(upload: UploadRef): {
  linkedin_pdf_url: string;
  linkedin_pdf_filename: string;
} {
  return { linkedin_pdf_url: upload.url, linkedin_pdf_filename: upload.id };
}

/** Build the progress URL for a career-coach task. */
export function progressPath(task: string): string {
  return `${PROGRESS_PATH}?task=${encodeURIComponent(task)}`;
}

/** Normalize a `career-coach/progress` payload (wrapped or flat) into a sample. */
export function parseProgress(body: string): ProgressSample {
  let parsed: any;
  try {
    parsed = JSON.parse(body || '{}');
  } catch {
    return { status: 'unknown' };
  }
  const data = parsed && typeof parsed === 'object' && parsed.data ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || typeof data.status !== 'string') {
    return { status: 'unknown' };
  }
  const progress = data.progress ?? {};
  return {
    status: data.status,
    jobId: typeof data.jobId === 'string' ? data.jobId : undefined,
    percentage: typeof progress.percentage === 'number' ? progress.percentage : undefined,
    message: typeof progress.message === 'string' ? progress.message : undefined,
    currentStep: progress.currentStep ?? null,
  };
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'error', 'cancelled', 'canceled']);

/** Whether a progress status means "stop polling". */
export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Upload a CV and point the profile at it (the two write steps that precede a
 * review). Returns the stored reference and the index response.
 */
export async function uploadCv(
  filePath: string,
  cookie: string,
  opts: { fetch?: Fetcher; readFile?: (path: string) => Uint8Array } = {},
): Promise<{ upload: UploadRef; index: FetchResult }> {
  const doFetch = opts.fetch ?? fetch;
  const readFile = opts.readFile ?? ((p: string) => new Uint8Array(readFileSync(p)));
  const data = readFile(filePath);
  const filename = basename(filePath);
  const mp = buildMultipart(filename, guessContentType(filename), data);

  const up = await postBinary(UPLOAD_PATH, mp.body, mp.contentType, cookie, doFetch);
  assertOk(up, 'upload');
  const upload = parseUpload(up.body);

  const index = await postJson(INDEX_PATH, buildIndexBody(upload), cookie, doFetch);
  assertOk(index, 'index');
  return { upload, index };
}

/**
 * Poll `career-coach/progress` until the `feedback_user` task completes, fails,
 * or the timeout elapses. Each sample is reported through `onProgress`.
 */
export async function pollProgress(
  cookie: string,
  opts: PollOptions = {},
): Promise<ProgressSample> {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  const interval = opts.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeout = opts.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const task = opts.task ?? REVIEW_SERVICE;
  const deadline = now() + timeout;

  for (;;) {
    const res = await getJson(progressPath(task), cookie, doFetch);
    assertOk(res, 'progress');
    const sample = parseProgress(res.body);
    opts.onProgress?.(sample);
    if (isTerminal(sample.status)) {
      if (sample.status === 'completed') return sample;
      throw new Error(
        `review ${sample.status}${sample.message ? `: ${sample.message}` : ''}`,
      );
    }
    if (now() >= deadline) {
      throw new Error(
        `timed out after ${timeout}ms waiting for the review (last status: ${sample.status})`,
      );
    }
    await sleep(interval);
  }
}

/**
 * Queue a fresh CV review (`career-coach` with the `feedback_user` service) and
 * wait for it to finish.
 */
export async function requestReview(
  cookie: string,
  opts: PollOptions = {},
): Promise<{ request: FetchResult; progress: ProgressSample }> {
  const doFetch = opts.fetch ?? fetch;
  const request = await postJson(CAREER_COACH_PATH, { service: REVIEW_SERVICE }, cookie, doFetch);
  assertOk(request, 'review request');
  const progress = await pollProgress(cookie, opts);
  return { request, progress };
}

/**
 * The whole loop in one call: upload → index → request review → poll → read the
 * new review. Returns the review body (what `cv-review` would print).
 */
export async function runRefreshReview(
  filePath: string,
  cookie: string,
  opts: PollOptions & { readFile?: (path: string) => Uint8Array } = {},
): Promise<{ upload: UploadRef; progress: ProgressSample; review: string }> {
  const doFetch = opts.fetch ?? fetch;
  const { upload } = await uploadCv(filePath, cookie, {
    fetch: doFetch,
    readFile: opts.readFile,
  });
  const { progress } = await requestReview(cookie, opts);
  const review = await getJson(TARGETS['cv-review'], cookie, doFetch);
  assertOk(review, 'review fetch');
  return { upload, progress, review: review.body };
}

// ── LinkedIn profile optimization (upload a LinkedIn PDF export → review) ───

/**
 * Upload a LinkedIn PDF export and point the profile at it. Same two write
 * steps as a CV upload, but on `cv/upload-linkedin.json` and with the
 * `linkedin_pdf_url`/`linkedin_pdf_filename` index fields.
 */
export async function uploadLinkedin(
  filePath: string,
  cookie: string,
  opts: { fetch?: Fetcher; readFile?: (path: string) => Uint8Array } = {},
): Promise<{ upload: UploadRef; index: FetchResult }> {
  const doFetch = opts.fetch ?? fetch;
  const readFile = opts.readFile ?? ((p: string) => new Uint8Array(readFileSync(p)));
  const data = readFile(filePath);
  const filename = basename(filePath);
  const mp = buildMultipart(filename, guessContentType(filename), data);

  const up = await postBinary(LINKEDIN_UPLOAD_PATH, mp.body, mp.contentType, cookie, doFetch);
  assertOk(up, 'linkedin upload');
  const upload = parseUpload(up.body);

  const index = await postJson(INDEX_PATH, buildLinkedinIndexBody(upload), cookie, doFetch);
  assertOk(index, 'linkedin index');
  return { upload, index };
}

/** Save the LinkedIn profile URL into the talent profile (`profesional_url`). */
export async function setLinkedinUrl(
  url: string,
  cookie: string,
  opts: { fetch?: Fetcher } = {},
): Promise<FetchResult> {
  const doFetch = opts.fetch ?? fetch;
  const res = await postJson(INDEX_PATH, { profesional_url: url }, cookie, doFetch);
  assertOk(res, 'linkedin url');
  return res;
}

/**
 * Queue a LinkedIn profile-optimization run (`career-coach` with the
 * `linkedin_profile_optimization` service) and wait for it to finish.
 */
export async function requestLinkedinReview(
  cookie: string,
  opts: PollOptions = {},
): Promise<{ request: FetchResult; progress: ProgressSample }> {
  const doFetch = opts.fetch ?? fetch;
  const request = await postJson(
    CAREER_COACH_PATH,
    { service: LINKEDIN_REVIEW_SERVICE },
    cookie,
    doFetch,
  );
  assertOk(request, 'linkedin review request');
  const progress = await pollProgress(cookie, { ...opts, task: LINKEDIN_REVIEW_SERVICE });
  return { request, progress };
}

/**
 * The whole LinkedIn loop in one call: upload the PDF → index → (optionally)
 * save the LinkedIn URL → request the optimization → poll → read the report.
 * Returns the report body (what the `linkedin-review` target prints).
 */
export async function runRefreshLinkedin(
  filePath: string,
  cookie: string,
  opts: PollOptions & { readFile?: (path: string) => Uint8Array; linkedinUrl?: string | null } = {},
): Promise<{ upload: UploadRef; progress: ProgressSample; review: string }> {
  const doFetch = opts.fetch ?? fetch;
  const { upload } = await uploadLinkedin(filePath, cookie, {
    fetch: doFetch,
    readFile: opts.readFile,
  });
  if (opts.linkedinUrl) await setLinkedinUrl(opts.linkedinUrl, cookie, { fetch: doFetch });
  const { progress } = await requestLinkedinReview(cookie, opts);
  const review = await getJson(TARGETS['linkedin-review'], cookie, doFetch);
  assertOk(review, 'linkedin review fetch');
  return { upload, progress, review: review.body };
}

// ── profile + skills (profile read → patch → full-replace POST → verify) ────

/** Parse an autocomplete response into candidates, tolerating junk. */
export function parseSkillSearch(body: string): SkillRef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (x): x is SkillRef =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as SkillRef)._id === 'string' &&
        typeof (x as SkillRef).name === 'string',
    )
    .map((x) => ({ _id: x._id, name: x.name }));
}

/**
 * Pick exactly one candidate for a typed term: exact `_id`, then exact `name`
 * (case-insensitive), then a sole candidate. No match or ambiguity throws.
 */
export function resolveSkill(term: string, candidates: SkillRef[]): SkillRef {
  const want = term.trim().toLowerCase();
  const byId = candidates.find((c) => c._id.toLowerCase() === want);
  if (byId) return byId;
  const byName = candidates.find((c) => c.name.toLowerCase() === want);
  if (byName) return byName;
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) throw new Error(`no skill matches "${term}"`);
  throw new Error(
    `ambiguous skill "${term}" — candidates: ${candidates.map((c) => c._id).join(', ')}`,
  );
}

const formStr = (v: unknown): string => (v == null ? '' : String(v));
const idOf = (x: any): string => (x && typeof x._id === 'string' ? x._id : '');
const idsOf = (arr: unknown): string[] =>
  Array.isArray(arr) ? arr.map(idOf).filter(Boolean) : [];
const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// `profile.json` reports the wished salary in thousands (44) while the save form
// takes the absolute yearly figure (44000). Every write posts the whole form, so
// a missed scale here would quietly rewrite the salary.
const SALARY_SCALE = 1000;
const salaryToForm = (v: unknown): string => {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * SALARY_SCALE)) : '';
};

/**
 * Map the `profile.json` read shape onto the `index.json` full-replace form.
 * Every key the browser posted is emitted, in the same order, including the
 * site's own `profesional_title`/`profesional_url` spelling. A field added
 * here but missed in the read shape would be clobbered on save, so keep it
 * exhaustive — the test asserts the full ordered pair list.
 */
export function profileToForm(profile: any): FormField[] {
  const p = profile ?? {};
  const form: FormField[] = [];
  const push = (key: string, value: string) => form.push({ key, value });

  push('profilePicture', formStr(p.profilePicture));
  push('given_name', formStr(p.given_name));
  push('family_name', formStr(p.family_name));
  push('phone', formStr(p.phone));
  push('description', formStr(p.description));
  push('live_location', idOf(p.live_location));
  for (const id of idsOf(p.authorized_locations)) push('authorized_locations[]', id);
  for (const lang of listOf(p.languages)) {
    push('language[][_id]', idOf((lang as any)?.language));
    push('language[][level]', formStr((lang as any)?.level));
  }
  for (const job of listOf(p.wished_job)) {
    push('wished_job[][_id]', idOf(job));
    push('wished_job[][level]', formStr((job as any)?.experience));
  }
  push('currency', formStr(p.currency));
  push('minSalary', salaryToForm(p.wished_salary_min));
  push('maxSalary', salaryToForm(p.wished_salary_max));
  push('experience', formStr(p.experience));
  push('contributionType.track', formStr(p.contributionType?.track));
  push('contributionType.level', formStr(p.contributionType?.level));
  const current = Array.isArray(p.currentJob) ? p.currentJob[0] : p.currentJob;
  push('currentJob[_id]', idOf(current));
  push('currentJob[name_en]', formStr(current?.name_en));
  for (const v of listOf(p.contractTypes)) push('contractTypes[]', formStr(v));
  for (const v of listOf(p.remoteCategories)) push('remoteCategories[]', formStr(v));
  for (const id of idsOf(p.key_hard_skills)) push('key_hard_skills[]', id);
  for (const id of idsOf(p.hard_skills)) push('hard_skills[]', id);
  for (const id of idsOf(p.soft_skills)) push('soft_skills[]', id);
  for (const v of listOf(p.wishedCompanySizes)) push('wishedCompanySizes[]', formStr(v));
  push('profesional_title', formStr(p.profesional_title));
  push('personal_url', formStr(p.personal_url));
  push('profesional_url', formStr(p.profesional_url));
  push('cv_url', formStr(p.cv_url));
  push('cv_filename', formStr(p.cv_filename));
  push('dataComplete', p.isUserDataComplete ? 'true' : 'false');
  return form;
}

/** One skill list (id + name) from the read profile, e.g. `hard_skills`. */
function skillList(profile: any, field: string): SkillRef[] {
  const key = field.replace(/\[\]$/, '');
  return listOf(profile?.[key])
    .filter((x: any) => x && typeof x._id === 'string')
    .map((x: any) => ({ _id: x._id, name: typeof x.name === 'string' ? x.name : x._id }));
}

/** Serialize ordered form pairs the way a browser form does. */
export function encodeForm(form: FormField[]): string {
  const params = new URLSearchParams();
  for (const { key, value } of form) params.append(key, value);
  return params.toString();
}

/**
 * Replace every pair whose key appears in `patch` (in place, at the first
 * occurrence) and append keys the base did not have. Values of a replaced key
 * come from the patch in order; other keys are left untouched.
 */
export function mergeForm(base: FormField[], patch: FormField[]): FormField[] {
  const patchKeys = new Set(patch.map((f) => f.key));
  const emitted = new Set<string>();
  const out: FormField[] = [];
  for (const f of base) {
    if (!patchKeys.has(f.key)) {
      out.push(f);
      continue;
    }
    if (!emitted.has(f.key)) {
      emitted.add(f.key);
      for (const p of patch) if (p.key === f.key) out.push(p);
    }
  }
  for (const key of patchKeys) {
    if (emitted.has(key)) continue;
    for (const p of patch) if (p.key === key) out.push(p);
  }
  return out;
}

const valuesOf = (form: FormField[], key: string): string[] =>
  form.filter((f) => f.key === key).map((f) => f.value);

/** The keys whose ordered values differ between two forms. */
export function diffForm(
  before: FormField[],
  after: FormField[],
): { key: string; before: string[]; after: string[] }[] {
  const keys: string[] = [];
  for (const f of [...before, ...after]) if (!keys.includes(f.key)) keys.push(f.key);
  const out: { key: string; before: string[]; after: string[] }[] = [];
  for (const key of keys) {
    const b = valuesOf(before, key);
    const a = valuesOf(after, key);
    if (b.length !== a.length || b.some((v, i) => v !== a[i])) out.push({ key, before: b, after: a });
  }
  return out;
}

/** Build form pairs from a JSON patch object (values may be string or string[]). */
export function parsePatch(patch: Record<string, unknown>): FormField[] {
  const out: FormField[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) for (const v of value) out.push({ key, value: formStr(v) });
    else out.push({ key, value: formStr(value) });
  }
  return out;
}

/** Parse a `--set KEY=VALUE` flag. */
export function parseSetFlag(flag: string): FormField {
  const eq = flag.indexOf('=');
  if (eq <= 0) throw new Error(`--set expects KEY=VALUE, got "${flag}"`);
  return { key: flag.slice(0, eq), value: flag.slice(eq + 1) };
}

/** Read the whole profile: the save-form projection plus the raw read shape. */
async function readProfile(
  cookie: string,
  doFetch: Fetcher,
): Promise<{ form: FormField[]; raw: any }> {
  const res = await getJson(PROFILE_PATH, cookie, doFetch);
  assertOk(res, 'profile');
  let raw: unknown;
  try {
    raw = JSON.parse(res.body);
  } catch {
    throw new Error('profile: the response was not JSON');
  }
  return { form: profileToForm(raw), raw };
}

/** Search the skill autocomplete (hard skills, or soft with `soft: true`). */
export async function searchSkills(
  term: string,
  cookie: string,
  opts: { soft?: boolean; fetch?: Fetcher } = {},
): Promise<SkillRef[]> {
  const path = opts.soft ? AUTOCOMPLETE_SOFT_SKILLS_PATH : AUTOCOMPLETE_SKILLS_PATH;
  const res = await getJson(`${path}?term=${encodeURIComponent(term)}`, cookie, opts.fetch ?? fetch);
  assertOk(res, 'skill search');
  return parseSkillSearch(res.body);
}

export interface SkillChangeOptions {
  soft?: boolean;
  key?: boolean;
  dryRun?: boolean;
  fetch?: Fetcher;
}

export interface AddSkillsResult {
  added: SkillRef[];
  skipped: string[];
  form: FormField[];
  verified: boolean;
  mismatches: string[];
}

/** Field a skill lands in: `key_hard_skills`/`hard_skills`/`soft_skills`. */
function skillField(opts: { soft?: boolean; key?: boolean }): string {
  return opts.soft ? 'soft_skills[]' : opts.key ? 'key_hard_skills[]' : 'hard_skills[]';
}

/**
 * Add skills: read the profile, resolve each term against the autocomplete,
 * merge the new ids into the right skill list, POST the full form, then re-read
 * to confirm. Terms already present are reported and skipped; a no-op never
 * POSTs.
 */
export async function addSkills(
  terms: string[],
  cookie: string,
  opts: SkillChangeOptions = {},
): Promise<AddSkillsResult> {
  const doFetch = opts.fetch ?? fetch;
  const field = skillField(opts);
  const { form } = await readProfile(cookie, doFetch);
  const existing = valuesOf(form, field);

  const added: SkillRef[] = [];
  const skipped: string[] = [];
  const seen = new Set(existing);
  for (const term of terms) {
    const candidates = await searchSkills(term, cookie, { soft: opts.soft, fetch: doFetch });
    const skill = resolveSkill(term, candidates);
    if (seen.has(skill._id)) {
      skipped.push(term);
      continue;
    }
    seen.add(skill._id);
    added.push(skill);
  }

  const desired = [...existing, ...added.map((s) => s._id)];
  const nextForm = mergeForm(
    form,
    desired.map((value) => ({ key: field, value })),
  );
  if (added.length === 0 || opts.dryRun) {
    return { added, skipped, form: nextForm, verified: false, mismatches: [] };
  }

  const post = await postForm(INDEX_PATH, nextForm, cookie, doFetch);
  assertOk(post, 'profile save');
  const after = await readProfile(cookie, doFetch);
  const mismatches = added
    .filter((s) => !valuesOf(after.form, field).includes(s._id))
    .map((s) => s._id);
  return { added, skipped, form: nextForm, verified: mismatches.length === 0, mismatches };
}

export interface RemoveSkillsResult {
  removed: string[];
  missing: string[];
  form: FormField[];
  verified: boolean;
  mismatches: string[];
}

/**
 * Remove skills: match each term against the profile's existing skills by `_id`
 * or `name` (so no autocomplete round-trip is needed), drop them from the form,
 * POST, and re-read to confirm. Terms not present are reported.
 */
export async function removeSkills(
  terms: string[],
  cookie: string,
  opts: SkillChangeOptions = {},
): Promise<RemoveSkillsResult> {
  const doFetch = opts.fetch ?? fetch;
  const fields = opts.soft ? ['soft_skills[]'] : ['key_hard_skills[]', 'hard_skills[]'];
  const { form, raw } = await readProfile(cookie, doFetch);

  const removed: string[] = [];
  const missing: string[] = [];
  const matched = new Set<string>();
  const patch: FormField[] = [];
  for (const field of fields) {
    const list = skillList(raw, field);
    const drop = new Set<string>();
    for (const term of terms) {
      const want = term.trim().toLowerCase();
      const hit = list.find(
        (s) => s._id.toLowerCase() === want || s.name.toLowerCase() === want,
      );
      if (hit) {
        drop.add(hit._id);
        matched.add(term);
        removed.push(hit._id);
      }
    }
    for (const id of list.map((s) => s._id)) {
      if (!drop.has(id)) patch.push({ key: field, value: id });
    }
  }
  for (const term of terms) if (!matched.has(term)) missing.push(term);

  const nextForm = removed.length ? mergeForm(form, patch) : form;
  if (removed.length === 0 || opts.dryRun) {
    return { removed, missing, form: nextForm, verified: false, mismatches: [] };
  }

  const post = await postForm(INDEX_PATH, nextForm, cookie, doFetch);
  assertOk(post, 'profile save');
  const after = await readProfile(cookie, doFetch);
  const mismatches = removed.filter((id) =>
    fields.some((field) => valuesOf(after.form, field).includes(id)),
  );
  return { removed, missing, form: nextForm, verified: mismatches.length === 0, mismatches };
}

export interface SaveProfileResult {
  changed: { key: string; before: string[]; after: string[] }[];
  form: FormField[];
  verified: boolean;
  mismatches: string[];
}

/**
 * Save profile fields: read the profile, merge a patch (form-field space),
 * POST the whole form, then re-read and confirm the changed keys stuck. A
 * no-op or `dryRun` never POSTs.
 */
export async function saveProfile(
  patch: FormField[],
  cookie: string,
  opts: { dryRun?: boolean; fetch?: Fetcher } = {},
): Promise<SaveProfileResult> {
  const doFetch = opts.fetch ?? fetch;
  const { form } = await readProfile(cookie, doFetch);
  const nextForm = mergeForm(form, patch);
  const changed = diffForm(form, nextForm);
  if (opts.dryRun || changed.length === 0) {
    return { changed, form: nextForm, verified: false, mismatches: [] };
  }

  const post = await postForm(INDEX_PATH, nextForm, cookie, doFetch);
  assertOk(post, 'profile save');
  const after = await readProfile(cookie, doFetch);
  const mismatches = changed
    .filter((c) => {
      const now = valuesOf(after.form, c.key);
      return now.length !== c.after.length || now.some((v, i) => v !== c.after[i]);
    })
    .map((c) => c.key);
  return { changed, form: nextForm, verified: mismatches.length === 0, mismatches };
}

const USAGE = `Read Jobgether talent data — and drive the CV-review and LinkedIn-optimizer loops.

Read:
  node src/scripts/jobgether.ts <target…> [--out DIR]
  Targets: ${Object.keys(TARGETS).join(', ')}
  or any raw path (e.g. astroapi/user/profile.json)

Write (the CV-review loop):
  node src/scripts/jobgether.ts upload <file>          store a CV and point the profile at it
  node src/scripts/jobgether.ts request-review         queue a review, then wait for it
  node src/scripts/jobgether.ts refresh-review <file>  upload → request → poll → print the review

Write (the LinkedIn-optimizer loop):
  node src/scripts/jobgether.ts upload-linkedin <pdf>          store a LinkedIn PDF export
  node src/scripts/jobgether.ts request-linkedin-review        queue the optimization, then wait
  node src/scripts/jobgether.ts refresh-linkedin <pdf>         upload → request → poll → print
        [--linkedin <url>]                                      also save the profile's LinkedIn URL
  node src/scripts/jobgether.ts progress [task]                poll a task (default feedback_user)

Write (profile + skills — read → patch → full-replace POST → verify):
  node src/scripts/jobgether.ts skills <term>          search the skill autocomplete
  node src/scripts/jobgether.ts skill-add <term…>      add skill(s) to the profile
  node src/scripts/jobgether.ts skill-remove <id…>     remove skill(s) from the profile
  node src/scripts/jobgether.ts profile-save           edit fields (--set/--from-file)

Options:
  --out DIR           write JSON to DIR (default: stdout)
  --poll SEC          seconds between progress polls (default: 5)
  --timeout SEC       give up on the review after SEC (default: 300)
  --soft              target soft skills (skills/skill-add/skill-remove)
  --key               add to key_hard_skills instead of hard_skills
  --set KEY=VALUE     with profile-save: set one form field (repeatable)
  --from-file <json>  with profile-save: a JSON object of form fields to merge
  --linkedin <url>    with refresh-linkedin: also save the LinkedIn profile URL
  --dry-run           build and print the change set, but never POST
  --cookie <str>      cookie header value
  --cookie-file <p>   read the cookie from a file
  --list              list known read targets
  -h, --help          show this help

Cookie also comes from $JOBGETHER_COOKIE / $JOBGETHER_COOKIE_FILE,
or ${DEFAULT_COOKIE_FILE}.`;

/** CLI entry. Returns a process exit code. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.list) {
    for (const [alias, path] of Object.entries(TARGETS)) {
      console.log(`${alias}\t${buildUrl(path)}`);
    }
    return 0;
  }

  const resolved = resolveCookie(args, process.env, (p) =>
    readFileSync(p, 'utf8'),
  );
  if (!resolved) {
    console.error(
      `No cookie found. Provide --cookie, --cookie-file, $JOBGETHER_COOKIE, ` +
        `or write it to ${DEFAULT_COOKIE_FILE}.`,
    );
    return 1;
  }

  if (args.command) {
    try {
      return await runCommand(args, resolved.cookie);
    } catch (err) {
      console.error((err as Error).message);
      return 1;
    }
  }

  let exit = 0;
  for (const name of args.targets) {
    let target: Target;
    try {
      target = resolveTarget(name);
    } catch (err) {
      console.error((err as Error).message);
      exit = 1;
      continue;
    }

    const res = await fetchTarget(target, resolved.cookie);
    if (res.status === 401 || res.status === 403) {
      console.error(unauthorizedHint());
      return 1;
    }
    if (res.status !== 200) {
      console.error(`${target.alias}: HTTP ${res.status}`);
      exit = 1;
      continue;
    }

    if (args.out) {
      mkdirSync(args.out, { recursive: true });
      const dest = join(args.out, outputName(target.alias));
      writeFileSync(dest, res.body);
      console.error(`${target.alias} → ${dest}`);
    } else {
      process.stdout.write(res.body.endsWith('\n') ? res.body : `${res.body}\n`);
    }
  }
  return exit;
}

/** One-line status for CLI progress output. */
function progressLine(sample: ProgressSample): string {
  const pct = typeof sample.percentage === 'number' ? ` ${sample.percentage}%` : '';
  const msg = sample.message ? ` — ${sample.message}` : '';
  return `${sample.status}${pct}${msg}`;
}

/** Print JSON to stdout, or write it into `--out` as <name>.json. */
function emitJson(args: Args, name: string, value: unknown): void {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (args.out) {
    mkdirSync(args.out, { recursive: true });
    const dest = join(args.out, outputName(name));
    writeFileSync(dest, text);
    console.error(`${name} → ${dest}`);
  } else {
    process.stdout.write(text);
  }
}

/** Dispatch a write-side subcommand. Throws with a readable message on failure. */
export async function runCommand(args: Args, cookie: string): Promise<number> {
  const poll = (): PollOptions => ({
    intervalMs: args.pollMs ?? undefined,
    timeoutMs: args.timeoutMs ?? undefined,
    onProgress: (s) => console.error(`  ${progressLine(s)}`),
  });

  switch (args.command) {
    case 'upload': {
      const file = args.commandArgs[0];
      if (!file) throw new Error('upload: pass a file path, e.g. "upload resume_en.pdf"');
      const { upload } = await uploadCv(file, cookie);
      console.error(`uploaded ${file} → ${upload.url}`);
      emitJson(args, 'upload', { upload });
      return 0;
    }
    case 'progress': {
      const task = args.commandArgs[0] || undefined;
      const sample = await pollProgress(cookie, { ...poll(), task });
      console.error(`  ${task ?? REVIEW_SERVICE} ${sample.status}`);
      emitJson(args, 'progress', sample);
      return 0;
    }
    case 'request-review': {
      const { progress } = await requestReview(cookie, poll());
      console.error(`  review ${progress.status}`);
      emitJson(args, 'request-review', progress);
      return 0;
    }
    case 'refresh-review': {
      const file = args.commandArgs[0];
      if (!file) {
        throw new Error('refresh-review: pass a file path, e.g. "refresh-review resume_en.pdf"');
      }
      const { upload, progress, review } = await runRefreshReview(file, cookie, poll());
      console.error(`  uploaded ${upload.url}; review ${progress.status}`);
      if (args.out) {
        mkdirSync(args.out, { recursive: true });
        const dest = join(args.out, outputName('cv-review'));
        writeFileSync(dest, review);
        console.error(`cv-review → ${dest}`);
      } else {
        process.stdout.write(review.endsWith('\n') ? review : `${review}\n`);
      }
      return 0;
    }
    case 'upload-linkedin': {
      const file = args.commandArgs[0];
      if (!file) {
        throw new Error('upload-linkedin: pass a file path, e.g. "upload-linkedin Profile.pdf"');
      }
      const { upload } = await uploadLinkedin(file, cookie);
      console.error(`uploaded ${file} → ${upload.url}`);
      emitJson(args, 'upload-linkedin', { upload });
      return 0;
    }
    case 'request-linkedin-review': {
      const { progress } = await requestLinkedinReview(cookie, poll());
      console.error(`  linkedin ${progress.status}`);
      emitJson(args, 'request-linkedin-review', progress);
      return 0;
    }
    case 'refresh-linkedin': {
      const file = args.commandArgs[0];
      if (!file) {
        throw new Error(
          'refresh-linkedin: pass a file path, e.g. "refresh-linkedin Profile.pdf"',
        );
      }
      const { upload, progress, review } = await runRefreshLinkedin(file, cookie, {
        ...poll(),
        linkedinUrl: args.linkedin,
      });
      console.error(`  uploaded ${upload.url}; linkedin ${progress.status}`);
      if (args.out) {
        mkdirSync(args.out, { recursive: true });
        const dest = join(args.out, outputName('linkedin-review'));
        writeFileSync(dest, review);
        console.error(`linkedin-review → ${dest}`);
      } else {
        process.stdout.write(review.endsWith('\n') ? review : `${review}\n`);
      }
      return 0;
    }
    case 'skills': {
      const term = args.commandArgs[0];
      if (!term) throw new Error('skills: pass a search term, e.g. "skills terraform"');
      const found = await searchSkills(term, cookie, { soft: args.soft });
      if (found.length === 0) console.error(`  no skills match "${term}"`);
      emitJson(args, 'skills', found);
      return 0;
    }
    case 'skill-add': {
      if (args.commandArgs.length === 0) {
        throw new Error('skill-add: pass one or more skill terms, e.g. "skill-add terraform"');
      }
      const out = await addSkills(args.commandArgs, cookie, {
        soft: args.soft,
        key: args.key,
        dryRun: args.dryRun,
      });
      for (const s of out.added) console.error(`  + ${s.name} (${s._id})`);
      for (const t of out.skipped) console.error(`  = ${t} (already present)`);
      if (out.mismatches.length) console.error(`  ! not verified: ${out.mismatches.join(', ')}`);
      if (args.dryRun) console.error('  dry run — not saved');
      emitJson(args, 'skill-add', out);
      return out.mismatches.length ? 1 : 0;
    }
    case 'skill-remove': {
      if (args.commandArgs.length === 0) {
        throw new Error('skill-remove: pass one or more skill ids or names');
      }
      const out = await removeSkills(args.commandArgs, cookie, {
        soft: args.soft,
        dryRun: args.dryRun,
      });
      for (const id of out.removed) console.error(`  - ${id}`);
      for (const t of out.missing) console.error(`  ? ${t} (not present)`);
      if (out.mismatches.length) console.error(`  ! not verified: ${out.mismatches.join(', ')}`);
      if (args.dryRun) console.error('  dry run — not saved');
      emitJson(args, 'skill-remove', out);
      return out.mismatches.length ? 1 : 0;
    }
    case 'profile-save': {
      let patch: FormField[] = [];
      if (args.fromFile) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(readFileSync(args.fromFile, 'utf8'));
        } catch (err) {
          throw new Error(`profile-save: could not read patch file: ${(err as Error).message}`);
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('profile-save: --from-file must be a JSON object of form fields');
        }
        patch = parsePatch(parsed as Record<string, unknown>);
      }
      patch = patch.concat(args.set.map(parseSetFlag));
      const out = await saveProfile(patch, cookie, { dryRun: args.dryRun });
      for (const c of out.changed) {
        console.error(`  ~ ${c.key}: ${c.before.join(', ')} → ${c.after.join(', ')}`);
      }
      if (out.changed.length === 0) console.error('  no changes');
      if (out.mismatches.length) console.error(`  ! not verified: ${out.mismatches.join(', ')}`);
      if (args.dryRun) console.error('  dry run — not saved');
      emitJson(args, 'profile-save', out);
      return out.mismatches.length ? 1 : 0;
    }
    default:
      throw new Error(`unknown command: ${args.command}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
