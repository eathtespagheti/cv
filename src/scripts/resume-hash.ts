//
//  resume-hash.ts
//  CV Hub — content-address the generated resume downloads.
//
//  Usage: node src/scripts/resume-hash.ts
//  Renames the files the export steps wrote to public/downloads/ so each name
//  carries a hash of its own bytes (`resume_en.1a2b3c4d.pdf`). Run after
//  `resume:generate` and `resume:pdf`, before `astro build`.
//

import { join } from 'node:path';
import { hashResumeFiles } from './downloads.ts';

const dir = join(process.cwd(), 'public/downloads');
const hashed = hashResumeFiles(dir);

if (hashed.length === 0) {
  console.log('No resume exports to hash — run resume:generate and resume:pdf first.');
} else {
  for (const name of hashed) {
    console.log(`✓ ${name}`);
  }
}
