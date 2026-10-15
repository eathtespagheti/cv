//
//  downloads.ts
//  CV Hub — content-addressed URLs for the generated resumes.
//
//  The exporters write stable names (`resume_en.pdf`, `resume_en_ats.pdf`, …).
//  A stable name means the URL never changes when the content does, so a
//  returning visitor can keep an old CV for as long as the cache lives.
//
//  `resume:hash` runs after the export steps and renames each file to
//  `resume_<base>.<sha256-prefix>.<ext>`, so a changed resume gets a new URL and
//  the bytes behind any URL never change. `buildDownloadUrls` resolves the
//  current name from disk for the pages; when no build has run (plain
//  `astro dev`) it falls back to the stable name.
//

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export type DownloadFormat = 'pdf' | 'pdfAts' | 'docx' | 'txt';

export const DOWNLOAD_FORMATS: readonly DownloadFormat[] = ['pdf', 'pdfAts', 'docx', 'txt'];

/** Hex characters of the sha256 digest kept in the filename. */
export const HASH_LENGTH = 8;

// `resume_en.pdf`, `resume_en_ats.pdf`, … — what the exporters write.
const STABLE_NAME_RE = /^resume_([^.]+)\.(pdf|docx|txt)$/;

// `resume_en.1a2b3c4d.pdf`, `resume_en_ats.1a2b3c4d.pdf`, … — what `resume:hash` writes.
const HASHED_NAME_RE = new RegExp(`^resume_[^.]+\\.([0-9a-f]{${HASH_LENGTH}})\\.(pdf|docx|txt)$`);

/** Logical stem for a language + optional profile spec: `resume_en`, `resume_en_devops`. */
export function resumeStem(lang: string, spec?: string | null): string {
  return `resume_${lang}${spec ? `_${spec}` : ''}`;
}

function fileBase(stem: string, format: DownloadFormat): string {
  return format === 'pdfAts' ? `${stem}_ats` : stem;
}

function extension(format: DownloadFormat): string {
  return format === 'txt' ? 'txt' : format === 'docx' ? 'docx' : 'pdf';
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The stable name the exporters write before `resume:hash` runs. */
export function plainFileName(stem: string, format: DownloadFormat): string {
  return `${fileBase(stem, format)}.${extension(format)}`;
}

/** The content-addressed name `resume:hash` produces. */
export function hashedFileName(stem: string, format: DownloadFormat, hash: string): string {
  return `${fileBase(stem, format)}.${hash}.${extension(format)}`;
}

/** The hashed file currently on disk for a stem + format, or null when absent. */
export function findHashedFile(dir: string, stem: string, format: DownloadFormat): string | null {
  if (!existsSync(dir)) return null;
  const re = new RegExp(
    `^${escapeRe(fileBase(stem, format))}\\.([0-9a-f]{${HASH_LENGTH}})\\.${extension(format)}$`,
  );
  return readdirSync(dir).find((name) => re.test(name)) ?? null;
}

/**
 * Rename every stable export in `dir` to include a hash of its own bytes, and
 * drop hashed files left over from an earlier build. Returns the hashed names.
 *
 * With nothing fresh to hash (the export steps did not run), existing hashed
 * files are left untouched.
 */
export function hashResumeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const fresh = readdirSync(dir).filter((name) => STABLE_NAME_RE.test(name));
  if (fresh.length === 0) {
    return readdirSync(dir).filter((name) => HASHED_NAME_RE.test(name));
  }

  const current = new Set<string>();
  for (const name of fresh) {
    const match = STABLE_NAME_RE.exec(name)!;
    const hash = createHash('sha256')
      .update(readFileSync(join(dir, name)))
      .digest('hex')
      .slice(0, HASH_LENGTH);
    const target = `resume_${match[1]}.${hash}.${match[2]}`;
    renameSync(join(dir, name), join(dir, target));
    current.add(target);
  }

  for (const name of readdirSync(dir)) {
    if (HASHED_NAME_RE.test(name) && !current.has(name)) {
      unlinkSync(join(dir, name));
    }
  }

  return [...current];
}

/** Public URLs for every format of one resume, hashed when a build has run. */
export function buildDownloadUrls(
  base: string,
  stem: string,
  downloadsDir: string,
): Record<DownloadFormat, string> {
  const urls = {} as Record<DownloadFormat, string>;
  for (const format of DOWNLOAD_FORMATS) {
    const file = findHashedFile(downloadsDir, stem, format) ?? plainFileName(stem, format);
    urls[format] = `${base}/downloads/${file}`;
  }
  return urls;
}
