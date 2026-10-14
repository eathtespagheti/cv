//
//  prune-dist.test.ts
//  CV Hub — regression tests for pruning build-time YAML out of `dist/`.
//
//  Node's built-in test runner only, no test framework dependency:
//    npm test
//
//  `astro build` copies `public/` verbatim, so the YAML the build reads as
//  input — the generated `public/cv/<lang>.yaml` and the case studies under
//  `public/media/projects/**` — also lands in `dist/`, and therefore in the
//  image, where it is publicly reachable and referenced by nothing. These
//  tests lock down the prune step that removes it, and the `--check` mode CI
//  uses to fail if a YAML ever creeps back into a built `dist/`.
//

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findYamlFiles, pruneDistYaml } from './prune-dist.ts';

/** A throwaway `dist/`-shaped tree; returns its root. */
function makeDist(): string {
  const root = mkdtempSync(join(tmpdir(), 'cv-dist-'));
  const write = (rel: string, body = 'x: 1\n') => {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  };
  write('cv/en.yaml');
  write('cv/it.yaml');
  write('media/projects/cv-platform/cv_platform_en.yaml');
  write('media/projects/cv-platform/cv_platform_it.yml');
  write('index.html', '<html></html>');
  write('media/projects/cv-platform/cover.webp', 'binary');
  // A YAML look-alike that is *not* at the end of the path must survive.
  write('cv/notes.yaml.txt', 'not yaml');
  return root;
}

test('findYamlFiles: finds .yaml and .yml, ignoring everything else', () => {
  const root = makeDist();
  try {
    assert.deepEqual(findYamlFiles(root), [
      'cv/en.yaml',
      'cv/it.yaml',
      'media/projects/cv-platform/cv_platform_en.yaml',
      'media/projects/cv-platform/cv_platform_it.yml',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findYamlFiles: returns [] for a missing directory', () => {
  assert.deepEqual(findYamlFiles(join(tmpdir(), 'cv-dist-does-not-exist')), []);
});

test('pruneDistYaml: deletes the YAML and returns what it removed', () => {
  const root = makeDist();
  try {
    const removed = pruneDistYaml(root);
    assert.equal(removed.length, 4);
    assert.equal(findYamlFiles(root).length, 0);
    // Non-YAML files are untouched.
    assert.ok(existsSync(join(root, 'index.html')));
    assert.ok(existsSync(join(root, 'media/projects/cv-platform/cover.webp')));
    assert.ok(existsSync(join(root, 'cv/notes.yaml.txt')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('pruneDistYaml: --check reports the YAML but leaves it in place', () => {
  const root = makeDist();
  try {
    const found = pruneDistYaml(root, { check: true });
    assert.equal(found.length, 4);
    assert.equal(findYamlFiles(root).length, 4);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
