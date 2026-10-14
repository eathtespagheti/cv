//
//  jobgether.test.ts
//  CV Hub — regression tests for the Jobgether talent-API reader.
//
//  Node's built-in test runner only, no test framework dependency:
//    npm test
//
//  The bug these lock down: Jobgether auth is a session cookie
//  (`jg-auth-refresh`), and cookies copied from DevTools are quoted
//  (`name="value"`). A greedy one-pass strip left a stray trailing quote on
//  the value, so every request 401'd. Normalization must strip each value's
//  quotes independently.
//
//  The live network test is skipped unless JOBGETHER_COOKIE is set, so the CI
//  validate gate (npm test) stays hermetic.
//

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCookie,
  resolveTarget,
  buildUrl,
  buildHeaders,
  outputName,
  parseArgs,
  resolveCookie,
  unauthorizedHint,
  TARGETS,
  USER_AGENT,
  DEFAULT_COOKIE_FILE,
  guessContentType,
  buildMultipart,
  parseUpload,
  buildIndexBody,
  parseProgress,
  isTerminal,
  progressPath,
  postJson,
  postBinary,
  pollProgress,
  uploadCv,
  requestReview,
  runRefreshReview,
  buildLinkedinIndexBody,
  uploadLinkedin,
  setLinkedinUrl,
  requestLinkedinReview,
  runRefreshLinkedin,
  UPLOAD_PATH,
  INDEX_PATH,
  LINKEDIN_UPLOAD_PATH,
  LINKEDIN_REVIEW_SERVICE,
  CAREER_COACH_PATH,
  PROFILE_PATH,
  APPLICATIONS_COUNT_PATH,
  AUTOCOMPLETE_SKILLS_PATH,
  AUTOCOMPLETE_SOFT_SKILLS_PATH,
  parseSkillSearch,
  resolveSkill,
  profileToForm,
  mergeForm,
  diffForm,
  encodeForm,
  parsePatch,
  parseSetFlag,
  postForm,
  searchSkills,
  addSkills,
  removeSkills,
  saveProfile,
} from './jobgether.ts';

// ── normalizeCookie ─────────────────────────────────────────────────────────

test('normalizeCookie: strips quotes from each value independently', () => {
  assert.equal(
    normalizeCookie('jg_values="{%22userId%22:%22abc%22}"; jg-auth="x.y.z"'),
    'jg_values={%22userId%22:%22abc%22}; jg-auth=x.y.z',
  );
});

test('normalizeCookie: drops a leading "Cookie:" label and splits on newlines', () => {
  assert.equal(normalizeCookie('Cookie: a="1";\n   b="2"\n'), 'a=1; b=2');
});

test('normalizeCookie: leaves unquoted values untouched', () => {
  assert.equal(normalizeCookie('a=1; b=2'), 'a=1; b=2');
});

test('normalizeCookie: does not mangle a value containing "=" or "%"', () => {
  assert.equal(
    normalizeCookie('k=abc.def-ghi_jkl'),
    'k=abc.def-ghi_jkl',
  );
});

test('normalizeCookie: blank input yields an empty string', () => {
  assert.equal(normalizeCookie('   \n  '), '');
});

// ── resolveTarget ───────────────────────────────────────────────────────────

test('resolveTarget: known alias maps to its endpoint', () => {
  assert.deepEqual(resolveTarget('cv-review'), {
    alias: 'cv-review',
    path: 'astroapi/career-coach/results?reportKey=cv-review',
  });
  assert.equal(resolveTarget('premium-match').path, TARGETS['premium-match']);
});

test('resolveTarget: a raw astroapi path passes through', () => {
  assert.deepEqual(resolveTarget('astroapi/match/stats'), {
    alias: 'astroapi/match/stats',
    path: 'astroapi/match/stats',
  });
});

test('resolveTarget: unknown alias throws with a helpful message', () => {
  assert.throws(() => resolveTarget('nope'), /unknown target/i);
});

// ── buildUrl / buildHeaders ─────────────────────────────────────────────────

test('buildUrl: joins an endpoint to the origin', () => {
  assert.equal(
    buildUrl('astroapi/match/stats'),
    'https://jobgether.com/astroapi/match/stats',
  );
});

test('buildUrl: an absolute URL is returned as-is', () => {
  assert.equal(buildUrl('https://example.com/x'), 'https://example.com/x');
});

test('buildHeaders: carries the cookie and a browser UA, never a bare token', () => {
  const headers = buildHeaders('jg-auth-refresh=abc');
  assert.equal(headers.Cookie, 'jg-auth-refresh=abc');
  assert.equal(headers['User-Agent'], USER_AGENT);
  assert.match(headers['User-Agent'], /Firefox/);
});

// ── outputName ──────────────────────────────────────────────────────────────

test('outputName: alias becomes a safe .json filename', () => {
  assert.equal(outputName('cv-review'), 'cv-review.json');
  assert.equal(outputName('astroapi/match/stats'), 'astroapi-match-stats.json');
});

// ── parseArgs ───────────────────────────────────────────────────────────────

test('parseArgs: collects targets and flags', () => {
  const a = parseArgs(['cv-review', 'premium-match', '--out', '/tmp/x', '--cookie-file', '/tmp/c']);
  assert.deepEqual(a.targets, ['cv-review', 'premium-match']);
  assert.equal(a.out, '/tmp/x');
  assert.equal(a.cookieFile, '/tmp/c');
  assert.equal(a.list, false);
});

test('parseArgs: defaults to the cv-review target when none are given', () => {
  assert.deepEqual(parseArgs([]).targets, ['cv-review']);
});

test('parseArgs: --list and --help are recognised', () => {
  assert.equal(parseArgs(['--list']).list, true);
  assert.equal(parseArgs(['--help']).help, true);
});

// ── resolveCookie ───────────────────────────────────────────────────────────

const readFile = (content: string) => (p: string) => {
  if (p === 'missing') throw new Error('ENOENT');
  return content;
};

test('resolveCookie: an explicit --cookie wins', () => {
  const r = resolveCookie({ cookie: 'a="1"' }, {}, readFile('b=2'));
  assert.equal(r?.cookie, 'a=1');
  assert.equal(r?.source, 'argument');
});

test('resolveCookie: a --cookie-file is read and normalized', () => {
  const r = resolveCookie({ cookieFile: 'somefile' }, {}, readFile('a="1"; b="2"'));
  assert.equal(r?.cookie, 'a=1; b=2');
  assert.equal(r?.source, 'file:somefile');
});

test('resolveCookie: JOBGETHER_COOKIE env is used when no flag is given', () => {
  const r = resolveCookie({}, { JOBGETHER_COOKIE: 'x="9"' }, readFile('unused'));
  assert.equal(r?.cookie, 'x=9');
  assert.equal(r?.source, 'env:JOBGETHER_COOKIE');
});

test('resolveCookie: falls back to the default cookie file', () => {
  const r = resolveCookie({}, {}, readFile('d="3"'));
  assert.equal(r?.cookie, 'd=3');
  assert.equal(r?.source, `file:${DEFAULT_COOKIE_FILE}`);
});

test('resolveCookie: returns null when the configured file is unreadable', () => {
  assert.equal(resolveCookie({ cookieFile: 'missing' }, {}, readFile('')), null);
});

// ── unauthorizedHint ────────────────────────────────────────────────────────

test('unauthorizedHint: names the cookie that matters and how to refresh it', () => {
  const hint = unauthorizedHint();
  assert.match(hint, /jg-auth-refresh/);
  assert.match(hint, /401|expired/i);
});

// ── live network test (opt-in only) ─────────────────────────────────────────

test('live: career-coach cv-review is readable with a real cookie', { skip: !process.env.JOBGETHER_COOKIE }, async () => {
  const { fetchTarget } = await import('./jobgether.ts');
  const res = await fetchTarget(
    resolveTarget('cv-review'),
    process.env.JOBGETHER_COOKIE as string,
  );
  assert.equal(res.status, 200);
  assert.match(res.body, /feedback|overview/);
});

// ── upload + review-request flow (from jobgether.com_upload-review.har) ──────
//
// The write side of Jobgether: upload a CV (multipart), point the profile at it,
// request a fresh `feedback_user` review, poll until it finishes. These tests are
// hermetic — a fake fetch/sleep/clock stands in for the network, so no cookie and
// no live call is involved.

type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

function fakeFetch(responses: Array<{ status?: number; body: string }>) {
  const calls: Call[] = [];
  const fn = async (url: string, init: any) => {
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body,
    });
    const r = responses.shift() ?? { status: 200, body: '{}' };
    return { status: r.status ?? 200, text: async () => r.body };
  };
  return { fn, calls };
}

function clock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

test('guessContentType: maps common CV formats', () => {
  assert.equal(guessContentType('resume_en.pdf'), 'application/pdf');
  assert.equal(
    guessContentType('CV.DOCX'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  assert.equal(guessContentType('cv.odt'), 'application/vnd.oasis.opendocument.text');
  assert.match(guessContentType('noextension'), /octet-stream/);
});

test('buildMultipart: encodes a single "file" part with the given bytes', () => {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
  const mp = buildMultipart('resume_en.pdf', 'application/pdf', bytes, 'BOUNDARY');
  assert.equal(mp.contentType, 'multipart/form-data; boundary=BOUNDARY');
  const text = Buffer.from(mp.body).toString('latin1');
  assert.match(text, /^--BOUNDARY\r\n/);
  assert.match(text, /Content-Disposition: form-data; name="file"; filename="resume_en\.pdf"\r\n/);
  assert.match(text, /Content-Type: application\/pdf\r\n\r\n/);
  assert.ok(text.includes('%PDF'));
  assert.match(text, /--BOUNDARY--\r\n$/);
});

test('buildMultipart: generates a unique boundary by default', () => {
  const a = buildMultipart('a.pdf', 'application/pdf', new Uint8Array());
  const b = buildMultipart('a.pdf', 'application/pdf', new Uint8Array());
  assert.notEqual(a.boundary, b.boundary);
  assert.match(a.contentType, /^multipart\/form-data; boundary=/);
});

test('parseUpload: extracts the id and url from the upload response', () => {
  const ref = parseUpload(
    '{"id":"talent-cv/x.pdf","size":12,"contentType":"application/pdf","url":"https://cdn-s3.jobgether.com/talent-cv/x.pdf"}',
  );
  assert.equal(ref.id, 'talent-cv/x.pdf');
  assert.equal(ref.url, 'https://cdn-s3.jobgether.com/talent-cv/x.pdf');
  assert.equal(ref.size, 12);
});

test('parseUpload: rejects a response that is not a JSON object with id+url', () => {
  assert.throws(() => parseUpload('not json'), /upload/i);
  assert.throws(() => parseUpload('{"id":"x"}'), /upload/i);
});

test('buildIndexBody: wires the upload into cv_url + cv_filename', () => {
  assert.deepEqual(
    buildIndexBody({ id: 'talent-cv/x.pdf', url: 'https://cdn/x.pdf' }),
    { cv_url: 'https://cdn/x.pdf', cv_filename: 'talent-cv/x.pdf' },
  );
});

test('parseProgress: normalizes the wrapped progress payload', () => {
  const p = parseProgress(
    '{"success":true,"data":{"status":"processing","jobId":"j1","progress":{"currentStep":"generate","percentage":60,"message":"Generating feedback"}}}',
  );
  assert.equal(p.status, 'processing');
  assert.equal(p.jobId, 'j1');
  assert.equal(p.percentage, 60);
  assert.equal(p.message, 'Generating feedback');
});

test('parseProgress: tolerates a flat payload and an empty body', () => {
  assert.equal(parseProgress('{"status":"completed"}').status, 'completed');
  assert.equal(parseProgress('').status, 'unknown');
});

test('isTerminal: completed/failed/error are terminal, pending/processing are not', () => {
  for (const s of ['completed', 'failed', 'error', 'cancelled']) {
    assert.equal(isTerminal(s), true, s);
  }
  for (const s of ['pending', 'processing', 'queued', 'unknown']) {
    assert.equal(isTerminal(s), false, s);
  }
});

test('progressPath: builds the task progress URL', () => {
  assert.equal(progressPath('feedback_user'), 'astroapi/career-coach/progress?task=feedback_user');
});

test('postJson: POSTs JSON with the cookie and a JSON content type', async () => {
  const { fn, calls } = fakeFetch([{ body: '{"ok":true}' }]);
  const res = await postJson('astroapi/user/index.json', { a: 1 }, 'jg-auth-refresh=x', fn as any);
  assert.equal(res.status, 200);
  assert.equal(calls[0].url, 'https://jobgether.com/astroapi/user/index.json');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['Content-Type'], 'application/json');
  assert.equal(calls[0].headers.Cookie, 'jg-auth-refresh=x');
  assert.equal(calls[0].body, JSON.stringify({ a: 1 }));
});

test('postBinary: sends raw bytes with the supplied content type', async () => {
  const { fn, calls } = fakeFetch([{ body: '{}' }]);
  const body = new Uint8Array([1, 2, 3]);
  await postBinary(UPLOAD_PATH, body, 'multipart/form-data; boundary=B', 'c=1', fn as any);
  assert.equal(calls[0].headers['Content-Type'], 'multipart/form-data; boundary=B');
  assert.equal(calls[0].body, body);
});

test('pollProgress: polls until completed and reports every sample', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"success":true,"data":{"status":"pending"}}' },
    { body: '{"success":true,"data":{"status":"processing","progress":{"percentage":60}}}' },
    { body: '{"success":true,"data":{"status":"completed","jobId":"j1"}}' },
  ]);
  const c = clock();
  const seen: string[] = [];
  const out = await pollProgress('c=1', {
    fetch: fn as any,
    now: c.now,
    sleep: c.sleep,
    intervalMs: 1000,
    timeoutMs: 60000,
    onProgress: (p) => seen.push(p.status),
  });
  assert.equal(out.status, 'completed');
  assert.equal(out.jobId, 'j1');
  assert.deepEqual(seen, ['pending', 'processing', 'completed']);
  assert.equal(calls.length, 3);
  assert.equal(new URL(calls[0].url).search, '?task=feedback_user');
});

test('pollProgress: throws when the task fails', async () => {
  const { fn } = fakeFetch([
    { body: '{"success":true,"data":{"status":"failed","progress":{"message":"boom"}}}' },
  ]);
  const c = clock();
  await assert.rejects(
    () => pollProgress('c=1', { fetch: fn as any, now: c.now, sleep: c.sleep }),
    /failed/i,
  );
});

test('pollProgress: throws on timeout rather than looping forever', async () => {
  const { fn } = fakeFetch(
    Array.from({ length: 10 }, () => ({ body: '{"success":true,"data":{"status":"processing"}}' })),
  );
  const c = clock();
  await assert.rejects(
    () =>
      pollProgress('c=1', {
        fetch: fn as any,
        now: c.now,
        sleep: c.sleep,
        intervalMs: 5000,
        timeoutMs: 12000,
      }),
    /timed out/i,
  );
});

test('pollProgress: maps 401 to the cookie hint', async () => {
  const { fn } = fakeFetch([{ status: 401, body: '' }]);
  const c = clock();
  await assert.rejects(
    () => pollProgress('c=1', { fetch: fn as any, now: c.now, sleep: c.sleep }),
    /jg-auth-refresh/,
  );
});

test('uploadCv: uploads the file then indexes the returned url', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"id":"talent-cv/x.pdf","url":"https://cdn/x.pdf","size":4,"contentType":"application/pdf"}' },
    { body: '{"message":"User updated successfully!","uid":"u1"}' },
  ]);
  const { upload, index } = await uploadCv('/tmp/resume_en.pdf', 'c=1', {
    fetch: fn as any,
    readFile: () => new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  });
  assert.equal(upload.id, 'talent-cv/x.pdf');
  assert.equal(index.status, 200);
  assert.equal(new URL(calls[0].url).pathname, '/astroapi/user/cv/upload.json');
  assert.match(calls[0].headers['Content-Type'], /^multipart\/form-data; boundary=/);
  assert.ok(Buffer.from(calls[0].body as Uint8Array).toString('latin1').includes('resume_en.pdf'));
  assert.equal(new URL(calls[1].url).pathname, '/astroapi/user/index.json');
  assert.deepEqual(JSON.parse(String(calls[1].body)), {
    cv_url: 'https://cdn/x.pdf',
    cv_filename: 'talent-cv/x.pdf',
  });
});

test('requestReview: POSTs the feedback_user service then polls', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"status":"queued","response":{}}' },
    { body: '{"success":true,"data":{"status":"completed","jobId":"j1"}}' },
  ]);
  const c = clock();
  const { progress } = await requestReview('c=1', {
    fetch: fn as any,
    now: c.now,
    sleep: c.sleep,
  });
  assert.equal(progress.status, 'completed');
  assert.equal(new URL(calls[0].url).pathname, '/astroapi/career-coach');
  assert.equal(calls[0].body, JSON.stringify({ service: 'feedback_user' }));
  assert.equal(new URL(calls[1].url).pathname, '/astroapi/career-coach/progress');
});

test('runRefreshReview: drives upload → index → request → poll → results', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"id":"talent-cv/x.pdf","url":"https://cdn/x.pdf"}' },
    { body: '{"message":"ok"}' },
    { body: '{"status":"queued","response":{}}' },
    { body: '{"success":true,"data":{"status":"processing"}}' },
    { body: '{"success":true,"data":{"status":"completed","jobId":"j1"}}' },
    { body: '{"overview":"great","recommendations":[]}' },
  ]);
  const c = clock();
  const { upload, progress, review } = await runRefreshReview('/tmp/resume_en.pdf', 'c=1', {
    fetch: fn as any,
    readFile: () => new Uint8Array([1]),
    now: c.now,
    sleep: c.sleep,
    intervalMs: 1000,
    timeoutMs: 60000,
  });
  assert.equal(upload.id, 'talent-cv/x.pdf');
  assert.equal(progress.status, 'completed');
  assert.match(review, /overview/);
  assert.deepEqual(
    calls.map((x) => new URL(x.url).pathname),
    [
      '/astroapi/user/cv/upload.json',
      '/astroapi/user/index.json',
      '/astroapi/career-coach',
      '/astroapi/career-coach/progress',
      '/astroapi/career-coach/progress',
      '/astroapi/career-coach/results',
    ],
  );
});

test('buildLinkedinIndexBody: wires the upload into linkedin_pdf_url + linkedin_pdf_filename', () => {
  assert.deepEqual(buildLinkedinIndexBody({ id: 'talent-linkedin/x.pdf', url: 'https://cdn/x.pdf' }), {
    linkedin_pdf_url: 'https://cdn/x.pdf',
    linkedin_pdf_filename: 'talent-linkedin/x.pdf',
  });
});

test('uploadLinkedin: uploads to cv/upload-linkedin.json then indexes the linkedin keys', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"id":"talent-linkedin/x.pdf","url":"https://cdn/x.pdf","size":4,"contentType":"application/pdf"}' },
    { body: '{"message":"User updated successfully!","uid":"u1"}' },
  ]);
  const { upload, index } = await uploadLinkedin('/tmp/Profile.pdf', 'c=1', {
    fetch: fn as any,
    readFile: () => new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  });
  assert.equal(upload.id, 'talent-linkedin/x.pdf');
  assert.equal(index.status, 200);
  assert.equal(new URL(calls[0].url).pathname, '/astroapi/user/cv/upload-linkedin.json');
  assert.match(calls[0].headers['Content-Type'], /^multipart\/form-data; boundary=/);
  assert.ok(Buffer.from(calls[0].body as Uint8Array).toString('latin1').includes('Profile.pdf'));
  assert.equal(new URL(calls[1].url).pathname, '/astroapi/user/index.json');
  assert.deepEqual(JSON.parse(String(calls[1].body)), {
    linkedin_pdf_url: 'https://cdn/x.pdf',
    linkedin_pdf_filename: 'talent-linkedin/x.pdf',
  });
});

test('setLinkedinUrl: saves profesional_url through index.json', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"message":"User updated successfully!","uid":"u1"}' },
  ]);
  const res = await setLinkedinUrl('https://www.linkedin.com/in/ada', 'c=1', { fetch: fn as any });
  assert.equal(res.status, 200);
  assert.equal(new URL(calls[0].url).pathname, '/astroapi/user/index.json');
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].body)), {
    profesional_url: 'https://www.linkedin.com/in/ada',
  });
});

test('pollProgress: a task option targets a different career-coach task', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"success":true,"data":{"status":"completed","jobId":"j1"}}' },
  ]);
  const c = clock();
  const sample = await pollProgress('c=1', {
    fetch: fn as any,
    now: c.now,
    sleep: c.sleep,
    task: LINKEDIN_REVIEW_SERVICE,
  });
  assert.equal(sample.status, 'completed');
  assert.equal(
    new URL(calls[0].url).searchParams.get('task'),
    'linkedin_profile_optimization',
  );
});

test('requestLinkedinReview: POSTs the linkedin service then polls its task', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"status":"queued","response":{}}' },
    { body: '{"success":true,"data":{"status":"completed","jobId":"j1"}}' },
  ]);
  const c = clock();
  const { progress } = await requestLinkedinReview('c=1', {
    fetch: fn as any,
    now: c.now,
    sleep: c.sleep,
  });
  assert.equal(progress.status, 'completed');
  assert.equal(new URL(calls[0].url).pathname, '/astroapi/career-coach');
  assert.equal(calls[0].body, JSON.stringify({ service: 'linkedin_profile_optimization' }));
  assert.equal(
    new URL(calls[1].url).searchParams.get('task'),
    'linkedin_profile_optimization',
  );
});

test('runRefreshLinkedin: drives upload → index → url → queue → poll → results', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"id":"talent-linkedin/x.pdf","url":"https://cdn/x.pdf"}' },
    { body: '{"message":"ok"}' },
    { body: '{"message":"ok"}' },
    { body: '{"status":"queued","response":{}}' },
    { body: '{"success":true,"data":{"status":"completed","jobId":"j1"}}' },
    { body: '{"success":true,"data":{"status":"completed","feedback":{"overview":"great"}}}' },
  ]);
  const c = clock();
  const { upload, progress, review } = await runRefreshLinkedin('/tmp/Profile.pdf', 'c=1', {
    fetch: fn as any,
    readFile: () => new Uint8Array([1]),
    now: c.now,
    sleep: c.sleep,
    intervalMs: 1000,
    timeoutMs: 60000,
    linkedinUrl: 'https://www.linkedin.com/in/ada',
  });
  assert.equal(upload.id, 'talent-linkedin/x.pdf');
  assert.equal(progress.status, 'completed');
  assert.match(review, /overview/);
  assert.deepEqual(
    calls.map((x) => new URL(x.url).pathname),
    [
      '/astroapi/user/cv/upload-linkedin.json',
      '/astroapi/user/index.json',
      '/astroapi/user/index.json',
      '/astroapi/career-coach',
      '/astroapi/career-coach/progress',
      '/astroapi/career-coach/results',
    ],
  );
  assert.equal(
    new URL(calls[5].url).searchParams.get('reportKey'),
    'linkedin-optimization',
  );
  assert.deepEqual(JSON.parse(String(calls[2].body)), {
    profesional_url: 'https://www.linkedin.com/in/ada',
  });
});

test('runRefreshLinkedin: omits the profile-url step when no linkedin url is given', async () => {
  const { fn, calls } = fakeFetch([
    { body: '{"id":"talent-linkedin/x.pdf","url":"https://cdn/x.pdf"}' },
    { body: '{"message":"ok"}' },
    { body: '{"status":"queued","response":{}}' },
    { body: '{"success":true,"data":{"status":"completed"}}' },
    { body: '{"success":true,"data":{"status":"completed","feedback":{}}}' },
  ]);
  const c = clock();
  await runRefreshLinkedin('/tmp/Profile.pdf', 'c=1', {
    fetch: fn as any,
    readFile: () => new Uint8Array([1]),
    now: c.now,
    sleep: c.sleep,
  });
  assert.deepEqual(
    calls.map((x) => new URL(x.url).pathname),
    [
      '/astroapi/user/cv/upload-linkedin.json',
      '/astroapi/user/index.json',
      '/astroapi/career-coach',
      '/astroapi/career-coach/progress',
      '/astroapi/career-coach/results',
    ],
  );
});

test('parseArgs: recognises the linkedin commands and --linkedin', () => {
  const a = parseArgs([
    'refresh-linkedin',
    '/tmp/Profile.pdf',
    '--linkedin',
    'https://www.linkedin.com/in/ada',
  ]);
  assert.equal(a.command, 'refresh-linkedin');
  assert.deepEqual(a.commandArgs, ['/tmp/Profile.pdf']);
  assert.equal(a.linkedin, 'https://www.linkedin.com/in/ada');
  assert.equal(parseArgs(['upload-linkedin', 'x.pdf']).command, 'upload-linkedin');
  assert.equal(parseArgs(['request-linkedin-review']).command, 'request-linkedin-review');
  assert.equal(
    parseArgs(['progress', 'linkedin_profile_optimization']).commandArgs[0],
    'linkedin_profile_optimization',
  );
});

test('resolveTarget: the linkedin-review alias maps to the optimization report', () => {
  assert.equal(
    TARGETS['linkedin-review'],
    'astroapi/career-coach/results?reportKey=linkedin-optimization',
  );
});

test('parseArgs: recognises the upload/review commands and their file argument', () => {
  const a = parseArgs(['refresh-review', '/tmp/resume_en.pdf', '--out', '/tmp/jg']);
  assert.equal(a.command, 'refresh-review');
  assert.deepEqual(a.commandArgs, ['/tmp/resume_en.pdf']);
  assert.deepEqual(a.targets, []);
  assert.equal(a.out, '/tmp/jg');
});

test('parseArgs: a read target is still a target, not a command', () => {
  const a = parseArgs(['cv-review']);
  assert.equal(a.command, null);
  assert.deepEqual(a.targets, ['cv-review']);
});

test('parseArgs: --poll and --timeout are read in seconds', () => {
  const a = parseArgs(['request-review', '--poll', '2', '--timeout', '600']);
  assert.equal(a.pollMs, 2000);
  assert.equal(a.timeoutMs, 600000);
});

test('parseArgs: upload with no file has an empty command argument', () => {
  const a = parseArgs(['upload']);
  assert.equal(a.command, 'upload');
  assert.deepEqual(a.commandArgs, []);
});

// ── profile + skills (from profile_edit.har) ────────────────────────────────
//
// The profile edit flow: GET the whole profile, save it back as an
// application/x-www-form-urlencoded form (a full replace), and search skills via
// the autocomplete endpoint. Skills are not a separate endpoint — they are
// key_hard_skills[]/hard_skills[]/soft_skills[] fields in that same form, so
// every write is read → patch → POST → re-read (verify).
//
// These tests are hermetic: a synthetic profile (no real personal data) and the
// fakeFetch/clock helpers above stand in for the network.

test('resolveTarget: the profile and applications targets map to their endpoints', () => {
  assert.equal(resolveTarget('profile').path, PROFILE_PATH);
  assert.equal(resolveTarget('applications-count').path, APPLICATIONS_COUNT_PATH);
});

test('parseSkillSearch: extracts id/name candidates and tolerates junk', () => {
  assert.deepEqual(parseSkillSearch('[{"_id":"terraform","name":"Terraform"}]'), [
    { _id: 'terraform', name: 'Terraform' },
  ]);
  assert.deepEqual(parseSkillSearch('not json'), []);
  assert.deepEqual(parseSkillSearch('{"_id":"x"}'), []);
  assert.deepEqual(parseSkillSearch('[{"_id":"a","name":"A"},{"_id":7},{"name":"B"}]'), [
    { _id: 'a', name: 'A' },
  ]);
});

test('resolveSkill: exact id wins, then exact name (case-insensitive)', () => {
  const candidates = [
    { _id: 'terraform', name: 'Terraform' },
    { _id: 'terragrunt', name: 'Terragrunt' },
  ];
  assert.equal(resolveSkill('terraform', candidates)._id, 'terraform');
  assert.equal(resolveSkill('Terragrunt', candidates)._id, 'terragrunt');
});

test('resolveSkill: a single candidate is accepted when nothing matches exactly', () => {
  assert.equal(
    resolveSkill('Cursor', [{ _id: 'database-cursor', name: 'Database Cursor' }])._id,
    'database-cursor',
  );
});

test('resolveSkill: no match or an ambiguous match throws with the candidates', () => {
  assert.throws(() => resolveSkill('nope', []), /no skill matches "nope"/);
  assert.throws(
    () =>
      resolveSkill('cloud', [
        { _id: 'aws', name: 'Cloud (AWS)' },
        { _id: 'gcp', name: 'Cloud (GCP)' },
      ]),
    /ambiguous.*aws, gcp|ambiguous.*Cloud/,
  );
});

// A synthetic profile in the shape `astroapi/user/profile.json` returns. No
// real personal data: names, urls and ids are placeholders.
const SAMPLE_PROFILE = {
  given_name: 'Ada',
  family_name: 'Lovelace',
  phone: '',
  description: 'Engineer.',
  profilePicture: 'https://cdn.example/x.webp',
  live_location: { _id: 'loc-it', name: 'Italy' },
  authorized_locations: [{ _id: 'loc-us' }, { _id: 'loc-uk' }],
  languages: [
    { language: { _id: 'lang-en', name_en: 'English' }, level: 'Professional proficiency' },
    { language: { _id: 'lang-it', name_en: 'Italian' }, level: 'Native or bilingual' },
  ],
  wished_job: [
    { _id: 'job-1', name_en: 'Platform Engineer', experience: '5-10 years' },
    { _id: 'job-2', name_en: 'DevOps Engineer', experience: '5-10 years' },
  ],
  currency: 'eur',
  wished_salary_min: 44,
  wished_salary_max: 400,
  experience: 'senior',
  contributionType: { track: 'Track 1', level: 'L4' },
  currentJob: [{ _id: 'job-1', name_en: 'Platform Engineer' }],
  contractTypes: ['Full time', 'Part time'],
  remoteCategories: ['hybrid'],
  key_hard_skills: [{ _id: 'kubernetes', name: 'Kubernetes' }],
  hard_skills: [
    { _id: 'terraform', name: 'Terraform' },
    { _id: 'ansible', name: 'Ansible' },
  ],
  soft_skills: [{ _id: 'team-leadership', name: 'Team Leadership' }],
  wishedCompanySizes: [''],
  profesional_title: 'Platform Engineer',
  personal_url: 'https://example.test/cv',
  profesional_url: 'https://linkedin.test/in/ada',
  cv_url: 'https://cdn.example/cv.pdf',
  cv_filename: 'talent-cv/cv.pdf',
  isUserDataComplete: true,
};

test('profileToForm: maps the profile onto the full-replace form in endpoint order', () => {
  const form = profileToForm(SAMPLE_PROFILE);
  assert.deepEqual(form, [
    { key: 'profilePicture', value: 'https://cdn.example/x.webp' },
    { key: 'given_name', value: 'Ada' },
    { key: 'family_name', value: 'Lovelace' },
    { key: 'phone', value: '' },
    { key: 'description', value: 'Engineer.' },
    { key: 'live_location', value: 'loc-it' },
    { key: 'authorized_locations[]', value: 'loc-us' },
    { key: 'authorized_locations[]', value: 'loc-uk' },
    { key: 'language[][_id]', value: 'lang-en' },
    { key: 'language[][level]', value: 'Professional proficiency' },
    { key: 'language[][_id]', value: 'lang-it' },
    { key: 'language[][level]', value: 'Native or bilingual' },
    { key: 'wished_job[][_id]', value: 'job-1' },
    { key: 'wished_job[][level]', value: '5-10 years' },
    { key: 'wished_job[][_id]', value: 'job-2' },
    { key: 'wished_job[][level]', value: '5-10 years' },
    { key: 'currency', value: 'eur' },
    { key: 'minSalary', value: '44000' },
    { key: 'maxSalary', value: '400000' },
    { key: 'experience', value: 'senior' },
    { key: 'contributionType.track', value: 'Track 1' },
    { key: 'contributionType.level', value: 'L4' },
    { key: 'currentJob[_id]', value: 'job-1' },
    { key: 'currentJob[name_en]', value: 'Platform Engineer' },
    { key: 'contractTypes[]', value: 'Full time' },
    { key: 'contractTypes[]', value: 'Part time' },
    { key: 'remoteCategories[]', value: 'hybrid' },
    { key: 'key_hard_skills[]', value: 'kubernetes' },
    { key: 'hard_skills[]', value: 'terraform' },
    { key: 'hard_skills[]', value: 'ansible' },
    { key: 'soft_skills[]', value: 'team-leadership' },
    { key: 'wishedCompanySizes[]', value: '' },
    { key: 'profesional_title', value: 'Platform Engineer' },
    { key: 'personal_url', value: 'https://example.test/cv' },
    { key: 'profesional_url', value: 'https://linkedin.test/in/ada' },
    { key: 'cv_url', value: 'https://cdn.example/cv.pdf' },
    { key: 'cv_filename', value: 'talent-cv/cv.pdf' },
    { key: 'dataComplete', value: 'true' },
  ]);
});

test('profileToForm: tolerates a sparse profile and empty arrays', () => {
  const form = profileToForm({ given_name: 'X', isUserDataComplete: false });
  const get = (key: string) => form.find((f) => f.key === key)?.value;
  assert.equal(get('given_name'), 'X');
  assert.equal(get('dataComplete'), 'false');
  assert.equal(get('live_location'), '');
  assert.equal(form.filter((f) => f.key === 'hard_skills[]').length, 0);
});

test('profileToForm: the read salary is in thousands, the save form is absolute', () => {
  const form = profileToForm({ wished_salary_min: 44, wished_salary_max: 400 });
  assert.equal(form.find((f) => f.key === 'minSalary')!.value, '44000');
  assert.equal(form.find((f) => f.key === 'maxSalary')!.value, '400000');
  const empty = profileToForm({});
  assert.equal(empty.find((f) => f.key === 'minSalary')!.value, '');
});

test('encodeForm: uses browser form encoding and preserves paired-array order', () => {
  const q = encodeForm(profileToForm(SAMPLE_PROFILE));
  // Brackets, spaces and the paired language fields must survive a normal parse.
  assert.match(q, /authorized_locations%5B%5D=loc-us&authorized_locations%5B%5D=loc-uk/);
  const params = new URLSearchParams(q);
  assert.deepEqual(params.getAll('language[][_id]'), ['lang-en', 'lang-it']);
  assert.deepEqual(params.getAll('language[][level]'), [
    'Professional proficiency',
    'Native or bilingual',
  ]);
  // Interleaved, not grouped: _id then level then _id then level.
  const raw = q;
  assert.ok(
    raw.indexOf('language%5B%5D%5B_id%5D=lang-en') <
      raw.indexOf('language%5B%5D%5Blevel%5D=Professional') &&
      raw.indexOf('language%5B%5D%5Blevel%5D=Professional') <
        raw.indexOf('language%5B%5D%5B_id%5D=lang-it'),
  );
});

test('mergeForm: replaces a key in place and appends a new one', () => {
  const base = profileToForm(SAMPLE_PROFILE);
  const merged = mergeForm(base, [
    { key: 'description', value: 'New description.' },
    { key: 'hard_skills[]', value: 'terraform' },
    { key: 'hard_skills[]', value: 'go' },
    { key: 'custom_field', value: 'v' },
  ]);
  const descIdx = merged.findIndex((f) => f.key === 'description');
  assert.equal(merged[descIdx].value, 'New description.');
  assert.deepEqual(
    merged.filter((f) => f.key === 'hard_skills[]').map((f) => f.value),
    ['terraform', 'go'],
  );
  assert.equal(merged[merged.length - 1].key, 'custom_field');
  // The originals are untouched.
  assert.equal(base.find((f) => f.key === 'description')!.value, 'Engineer.');
});

test('diffForm: reports only the keys whose values changed', () => {
  const before = [
    { key: 'a', value: '1' },
    { key: 'b', value: '2' },
  ];
  const after = [
    { key: 'a', value: '9' },
    { key: 'b', value: '2' },
  ];
  assert.deepEqual(diffForm(before, after), [{ key: 'a', before: ['1'], after: ['9'] }]);
});

test('parsePatch / parseSetFlag: build ordered form pairs', () => {
  assert.deepEqual(parsePatch({ description: 'Hi', 'hard_skills[]': ['a', 'b'] }), [
    { key: 'description', value: 'Hi' },
    { key: 'hard_skills[]', value: 'a' },
    { key: 'hard_skills[]', value: 'b' },
  ]);
  assert.deepEqual(parseSetFlag('minSalary=50000'), { key: 'minSalary', value: '50000' });
  assert.deepEqual(parseSetFlag('description=a=b'), { key: 'description', value: 'a=b' });
  assert.throws(() => parseSetFlag('nosep'), /KEY=VALUE/);
});

test('searchSkills: hits the hard-skill autocomplete, or the soft one with --soft', async () => {
  const hard = fakeFetch([{ body: '[{"_id":"terraform","name":"Terraform"}]' }]);
  const found = await searchSkills('terraform', 'c=1', { fetch: hard.fn as any });
  assert.deepEqual(found, [{ _id: 'terraform', name: 'Terraform' }]);
  assert.equal(new URL(hard.calls[0].url).pathname, '/astroapi/autocomplete/skills.json');
  assert.equal(new URL(hard.calls[0].url).searchParams.get('term'), 'terraform');

  const soft = fakeFetch([{ body: '[]' }]);
  await searchSkills('team', 'c=1', { fetch: soft.fn as any, soft: true });
  assert.equal(new URL(soft.calls[0].url).pathname, '/astroapi/autocomplete/softSkills.json');
});

test('addSkills: GET profile → search → POST form → re-read to verify', async () => {
  const updated = {
    ...SAMPLE_PROFILE,
    hard_skills: [...SAMPLE_PROFILE.hard_skills, { _id: 'go', name: 'Go' }],
  };
  const { fn, calls } = fakeFetch([
    { body: JSON.stringify(SAMPLE_PROFILE) },
    { body: '[{"_id":"go","name":"Go"}]' },
    { body: '{"message":"User updated successfully!","uid":"u1"}' },
    { body: JSON.stringify(updated) },
  ]);
  const out = await addSkills(['go'], 'c=1', { fetch: fn as any });
  assert.deepEqual(out.added, [{ _id: 'go', name: 'Go' }]);
  assert.deepEqual(out.skipped, []);
  assert.equal(out.verified, true);
  assert.deepEqual(
    calls.map((x) => `${x.method} ${new URL(x.url).pathname}`),
    [
      'GET /astroapi/user/profile.json',
      'GET /astroapi/autocomplete/skills.json',
      'POST /astroapi/user/index.json',
      'GET /astroapi/user/profile.json',
    ],
  );
  const body = new URLSearchParams(String(calls[2].body));
  assert.equal(String(calls[2].headers['Content-Type']), 'application/x-www-form-urlencoded');
  assert.deepEqual(body.getAll('hard_skills[]'), ['terraform', 'ansible', 'go']);
  assert.equal(body.get('description'), 'Engineer.');
});

test('addSkills: a skill already present is skipped and nothing is posted', async () => {
  const { fn, calls } = fakeFetch([
    { body: JSON.stringify(SAMPLE_PROFILE) },
    { body: '[{"_id":"terraform","name":"Terraform"}]' },
  ]);
  const out = await addSkills(['terraform'], 'c=1', { fetch: fn as any });
  assert.deepEqual(out.added, []);
  assert.deepEqual(out.skipped, ['terraform']);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
});

test('addSkills: --dry-run builds the form but never posts', async () => {
  const { fn, calls } = fakeFetch([
    { body: JSON.stringify(SAMPLE_PROFILE) },
    { body: '[{"_id":"go","name":"Go"}]' },
  ]);
  const out = await addSkills(['go'], 'c=1', { fetch: fn as any, dryRun: true });
  assert.equal(out.added.length, 1);
  assert.equal(out.verified, false);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
  const body = encodeForm(out.form);
  assert.match(body, /hard_skills%5B%5D=go/);
});

test('addSkills: a --soft skill goes to soft_skills, a --key hard skill to key_hard_skills', async () => {
  const soft = fakeFetch([
    { body: JSON.stringify(SAMPLE_PROFILE) },
    { body: '[{"_id":"time-management","name":"Time Management"}]' },
    { body: '{"message":"ok"}' },
    { body: JSON.stringify({ ...SAMPLE_PROFILE, soft_skills: [] }) },
  ]);
  await addSkills(['time-management'], 'c=1', { fetch: soft.fn as any, soft: true });
  const softBody = new URLSearchParams(String(soft.calls[2].body));
  assert.deepEqual(softBody.getAll('soft_skills[]'), ['team-leadership', 'time-management']);

  const key = fakeFetch([
    { body: JSON.stringify(SAMPLE_PROFILE) },
    { body: '[{"_id":"flux-cd","name":"Flux CD"}]' },
    { body: '{"message":"ok"}' },
    { body: JSON.stringify({ ...SAMPLE_PROFILE, key_hard_skills: [] }) },
  ]);
  await addSkills(['flux-cd'], 'c=1', { fetch: key.fn as any, key: true });
  const keyBody = new URLSearchParams(String(key.calls[2].body));
  assert.deepEqual(keyBody.getAll('key_hard_skills[]'), ['kubernetes', 'flux-cd']);
});

test('removeSkills: drops the skill from the form and verifies it is gone', async () => {
  const updated = {
    ...SAMPLE_PROFILE,
    hard_skills: [{ _id: 'ansible', name: 'Ansible' }],
  };
  const { fn, calls } = fakeFetch([
    { body: JSON.stringify(SAMPLE_PROFILE) },
    { body: '{"message":"ok"}' },
    { body: JSON.stringify(updated) },
  ]);
  const out = await removeSkills(['terraform'], 'c=1', { fetch: fn as any });
  assert.deepEqual(out.removed, ['terraform']);
  assert.equal(out.verified, true);
  const body = new URLSearchParams(String(calls[1].body));
  assert.deepEqual(body.getAll('hard_skills[]'), ['ansible']);
});

test('removeSkills: a skill that is not present is reported, not sent', async () => {
  const { fn, calls } = fakeFetch([{ body: JSON.stringify(SAMPLE_PROFILE) }]);
  const out = await removeSkills(['nope'], 'c=1', { fetch: fn as any });
  assert.deepEqual(out.removed, []);
  assert.deepEqual(out.missing, ['nope']);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
});

test('saveProfile: merges the patch, POSTs the whole form, and verifies', async () => {
  const updated = { ...SAMPLE_PROFILE, description: 'New description.' };
  const { fn, calls } = fakeFetch([
    { body: JSON.stringify(SAMPLE_PROFILE) },
    { body: '{"message":"User updated successfully!","uid":"u1"}' },
    { body: JSON.stringify(updated) },
  ]);
  const out = await saveProfile([{ key: 'description', value: 'New description.' }], 'c=1', {
    fetch: fn as any,
  });
  assert.equal(out.verified, true);
  assert.deepEqual(out.changed, [{ key: 'description', before: ['Engineer.'], after: ['New description.'] }]);
  const body = new URLSearchParams(String(calls[1].body));
  assert.equal(body.get('description'), 'New description.');
  // A full replace still carries every untouched field.
  assert.equal(body.get('given_name'), 'Ada');
  assert.ok(body.getAll('hard_skills[]').includes('ansible'));
});

test('saveProfile: --dry-run returns the change set without posting', async () => {
  const { fn, calls } = fakeFetch([{ body: JSON.stringify(SAMPLE_PROFILE) }]);
  const out = await saveProfile([{ key: 'profesional_title', value: 'SRE' }], 'c=1', {
    fetch: fn as any,
    dryRun: true,
  });
  assert.deepEqual(out.changed, [
    { key: 'profesional_title', before: ['Platform Engineer'], after: ['SRE'] },
  ]);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
});

test('postForm: sends a urlencoded body with the cookie and no JSON content type', async () => {
  const { fn, calls } = fakeFetch([{ body: '{"message":"ok"}' }]);
  const res = await postForm(INDEX_PATH, [{ key: 'a', value: 'b c' }], 'jg-auth-refresh=x', fn as any);
  assert.equal(res.status, 200);
  assert.equal(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(calls[0].body, 'a=b+c');
  assert.equal(calls[0].headers.Cookie, 'jg-auth-refresh=x');
});

test('parseArgs: recognises the profile/skill commands and their flags', () => {
  const a = parseArgs(['skill-add', 'terraform', 'go', '--soft', '--key', '--dry-run']);
  assert.equal(a.command, 'skill-add');
  assert.deepEqual(a.commandArgs, ['terraform', 'go']);
  assert.equal(a.soft, true);
  assert.equal(a.key, true);
  assert.equal(a.dryRun, true);

  const b = parseArgs(['profile-save', '--set', 'description=Hi', '--from-file', '/tmp/p.json']);
  assert.equal(b.command, 'profile-save');
  assert.deepEqual(b.set, ['description=Hi']);
  assert.equal(b.fromFile, '/tmp/p.json');

  assert.equal(parseArgs(['skills', 'terraform']).command, 'skills');
  assert.equal(parseArgs(['profile']).command, null);
  assert.deepEqual(parseArgs(['profile']).targets, ['profile']);
});

test('AUTOCOMPLETE paths and PROFILE/APPLICATIONS targets are the captured endpoints', () => {
  assert.equal(PROFILE_PATH, 'astroapi/user/profile.json');
  assert.equal(APPLICATIONS_COUNT_PATH, 'astroapi/user/applications/count.json');
  assert.equal(AUTOCOMPLETE_SKILLS_PATH, 'astroapi/autocomplete/skills.json');
  assert.equal(AUTOCOMPLETE_SOFT_SKILLS_PATH, 'astroapi/autocomplete/softSkills.json');
});
