//
//  projects.test.ts
//  CV Hub — regression tests for project ordering and media selection.
//
//  Node's built-in test runner only, no test framework dependency:
//    npm test
//
//  `sortProjects` is the project-list ordering (featured pinned first,
//  then newest year, then configured order, then name). `pickFeaturedMedia`
//  is the single source of truth for "which image fronts this project" —
//  used by ProjectCard and by both list pages for eager-load selection.
//

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortProjects, pickFeaturedMedia } from './projects.ts';

// ── pickFeaturedMedia ───────────────────────────────────────────────────────

test('pickFeaturedMedia: prefers the entry flagged featured', () => {
  const media = [
    { src: '/a.webp', alt: 'a' },
    { src: '/b.webp', alt: 'b', featured: true },
  ];
  assert.equal(pickFeaturedMedia(media)?.src, '/b.webp');
});

test('pickFeaturedMedia: falls back to the first entry', () => {
  const media = [{ src: '/a.webp' }, { src: '/b.webp' }];
  assert.equal(pickFeaturedMedia(media)?.src, '/a.webp');
});

test('pickFeaturedMedia: returns null for missing or empty media', () => {
  assert.equal(pickFeaturedMedia(undefined), null);
  assert.equal(pickFeaturedMedia([]), null);
});

// ── sortProjects ────────────────────────────────────────────────────────────

test('sortProjects: featured projects come first, keeping their order', () => {
  const out = sortProjects([
    { name: 'B', year: '2020' },
    { name: 'A', year: '2019', featured: true },
    { name: 'C', year: '2021', featured: true, order: 1 },
    { name: 'D', year: '2022', featured: true, order: 2 },
  ]);
  assert.deepEqual(
    out.map((p) => p.name),
    ['C', 'D', 'A', 'B']
  );
});

test('sortProjects: non-featured projects are newest year first', () => {
  const out = sortProjects([
    { name: 'old', year: '2018' },
    { name: 'new', year: '2024' },
    { name: 'mid', year: '2021' },
  ]);
  assert.deepEqual(
    out.map((p) => p.name),
    ['new', 'mid', 'old']
  );
});

test('sortProjects: does not mutate the input array', () => {
  const input = [{ name: 'b' }, { name: 'a' }];
  sortProjects(input);
  assert.deepEqual(input.map((p) => p.name), ['b', 'a']);
});
