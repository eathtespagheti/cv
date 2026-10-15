//
//  downloads.test.ts
//  CV Hub — regression tests for content-addressed resume download URLs.
//
//  Node's built-in test runner only, no test framework dependency:
//    npm test
//
//  The generated resumes used to keep stable names (`resume_en.pdf`), so their
//  URL never changed when the content did — a returning visitor kept a stale CV
//  for as long as the cache lived. `hashResumeFiles` renames each export to
//  `resume_<base>.<hash>.<ext>` after the export steps, and the pages resolve
//  that name from disk through `buildDownloadUrls`.
//

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  plainFileName,
  hashedFileName,
  resumeStem,
  findHashedFile,
  hashResumeFiles,
  buildDownloadUrls,
} from './downloads.ts';

function tempDownloads(): string {
  return mkdtempSync(join(tmpdir(), 'cv-downloads-'));
}

// ── naming ──────────────────────────────────────────────────────────────────

test('plainFileName: the stable names the exporters write', () => {
  assert.equal(plainFileName('resume_en', 'pdf'), 'resume_en.pdf');
  assert.equal(plainFileName('resume_en', 'pdfAts'), 'resume_en_ats.pdf');
  assert.equal(plainFileName('resume_en', 'docx'), 'resume_en.docx');
  assert.equal(plainFileName('resume_en', 'txt'), 'resume_en.txt');
});

test('hashedFileName: inserts the hash before the extension', () => {
  assert.equal(hashedFileName('resume_en', 'pdf', '1a2b3c4d'), 'resume_en.1a2b3c4d.pdf');
  assert.equal(hashedFileName('resume_en', 'pdfAts', '1a2b3c4d'), 'resume_en_ats.1a2b3c4d.pdf');
  assert.equal(hashedFileName('resume_en', 'docx', '1a2b3c4d'), 'resume_en.1a2b3c4d.docx');
});

test('resumeStem: profile specs extend the language', () => {
  assert.equal(resumeStem('en'), 'resume_en');
  assert.equal(resumeStem('en', 'devops'), 'resume_en_devops');
  assert.equal(resumeStem('en', null), 'resume_en');
});

// ── hashResumeFiles ─────────────────────────────────────────────────────────

test('hashResumeFiles: renames each export to include a content hash', () => {
  const dir = tempDownloads();
  try {
    writeFileSync(join(dir, 'resume_en.pdf'), 'pdf-bytes');
    writeFileSync(join(dir, 'resume_en_ats.pdf'), 'ats-bytes');
    writeFileSync(join(dir, 'resume_en.docx'), 'docx-bytes');
    writeFileSync(join(dir, 'resume_en.txt'), 'txt-bytes');

    const out = hashResumeFiles(dir);

    assert.equal(out.length, 4);
    for (const name of out) {
      assert.match(name, /^resume_[^.]+(?:\.[0-9a-f]{8})\.(?:pdf|docx|txt)$/);
    }
    // No stable names survive, and the content is unchanged.
    const names = readdirSync(dir);
    assert.equal(names.some((n) => n === 'resume_en.pdf'), false);
    assert.equal(names.some((n) => n === 'resume_en_ats.pdf'), false);
    assert.ok(names.every((n) => /^resume_[^.]+(?:\.[0-9a-f]{8})\.(?:pdf|docx|txt)$/.test(n)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hashResumeFiles: same content yields the same hash, different content differs', () => {
  const a = tempDownloads();
  const b = tempDownloads();
  try {
    writeFileSync(join(a, 'resume_en.pdf'), 'same');
    writeFileSync(join(b, 'resume_en.pdf'), 'same');
    const [ha] = hashResumeFiles(a);
    const [hb] = hashResumeFiles(b);
    assert.equal(ha, hb);

    const c = tempDownloads();
    try {
      writeFileSync(join(c, 'resume_en.pdf'), 'different');
      const [hc] = hashResumeFiles(c);
      assert.notEqual(ha, hc);
    } finally {
      rmSync(c, { recursive: true, force: true });
    }
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('hashResumeFiles: drops hashed files left over from an earlier build', () => {
  const dir = tempDownloads();
  try {
    writeFileSync(join(dir, 'resume_en.deadbeef.pdf'), 'stale');
    writeFileSync(join(dir, 'resume_en.pdf'), 'fresh');

    const out = hashResumeFiles(dir);

    assert.equal(out.length, 1);
    assert.equal(readdirSync(dir).includes('resume_en.deadbeef.pdf'), false);
    assert.equal(readdirSync(dir).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hashResumeFiles: leaves an existing hashed file alone when there is nothing fresh', () => {
  const dir = tempDownloads();
  try {
    writeFileSync(join(dir, 'resume_en.1a2b3c4d.pdf'), 'already hashed');

    const out = hashResumeFiles(dir);

    assert.deepEqual(out, ['resume_en.1a2b3c4d.pdf']);
    assert.ok(readdirSync(dir).includes('resume_en.1a2b3c4d.pdf'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hashResumeFiles: missing directory is a no-op', () => {
  assert.deepEqual(hashResumeFiles(join(tmpdir(), 'cv-downloads-does-not-exist-xyz')), []);
});

// ── findHashedFile / buildDownloadUrls ──────────────────────────────────────

test('findHashedFile: finds the hashed file, ignoring the stable name', () => {
  const dir = tempDownloads();
  try {
    writeFileSync(join(dir, 'resume_en.pdf'), 'stable');
    writeFileSync(join(dir, 'resume_en.1a2b3c4d.pdf'), 'hashed');
    assert.equal(findHashedFile(dir, 'resume_en', 'pdf'), 'resume_en.1a2b3c4d.pdf');
    assert.equal(findHashedFile(dir, 'resume_en', 'docx'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('findHashedFile: the ATS pdf is its own file', () => {
  const dir = tempDownloads();
  try {
    writeFileSync(join(dir, 'resume_en.1a2b3c4d.pdf'), 'human');
    writeFileSync(join(dir, 'resume_en_ats.deadbeef.pdf'), 'ats');
    assert.equal(findHashedFile(dir, 'resume_en', 'pdf'), 'resume_en.1a2b3c4d.pdf');
    assert.equal(findHashedFile(dir, 'resume_en', 'pdfAts'), 'resume_en_ats.deadbeef.pdf');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildDownloadUrls: prefers the hashed name when present', () => {
  const dir = tempDownloads();
  try {
    writeFileSync(join(dir, 'resume_en.1a2b3c4d.pdf'), 'human');
    writeFileSync(join(dir, 'resume_en_ats.deadbeef.pdf'), 'ats');
    writeFileSync(join(dir, 'resume_en.cafebabe.docx'), 'docx');
    writeFileSync(join(dir, 'resume_en.feedface.txt'), 'txt');

    assert.deepEqual(buildDownloadUrls('', 'resume_en', dir), {
      pdf:    '/downloads/resume_en.1a2b3c4d.pdf',
      pdfAts: '/downloads/resume_en_ats.deadbeef.pdf',
      docx:   '/downloads/resume_en.cafebabe.docx',
      txt:    '/downloads/resume_en.feedface.txt',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildDownloadUrls: falls back to the stable name when no hash is on disk', () => {
  const dir = tempDownloads();
  try {
    assert.deepEqual(buildDownloadUrls('/base', 'resume_en', dir), {
      pdf:    '/base/downloads/resume_en.pdf',
      pdfAts: '/base/downloads/resume_en_ats.pdf',
      docx:   '/base/downloads/resume_en.docx',
      txt:    '/base/downloads/resume_en.txt',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
