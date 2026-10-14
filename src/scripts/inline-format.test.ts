//
//  inline-format.test.ts
//  CV Hub — regression tests for case-study text formatting.
//
//  Node's built-in test runner only, no test framework dependency:
//    npm test
//
//  The bug these lock down: case-study `body`/`bullets` fields are authored
//  as a small Markdown subset (`**bold**`, `*italic*`, `code`), but the
//  renderer used to emit the asterisks literally and left `- ` lines as
//  plain text instead of <ul> lists.
//

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, parseBodyBlocks } from './inline-format.ts';

// ── parseInline ─────────────────────────────────────────────────────────────

test('parseInline: plain text is a single text segment', () => {
  assert.deepEqual(parseInline('plain text'), [
    { type: 'text', text: 'plain text' },
  ]);
});

test('parseInline: backtick span becomes code', () => {
  assert.deepEqual(parseInline('use `kubectl` now'), [
    { type: 'text', text: 'use ' },
    { type: 'code', text: 'kubectl' },
    { type: 'text', text: ' now' },
  ]);
});

test('parseInline: double asterisks become bold', () => {
  assert.deepEqual(parseInline('**L2 announcements** — the node'), [
    { type: 'bold', text: 'L2 announcements' },
    { type: 'text', text: ' — the node' },
  ]);
});

test('parseInline: single asterisks become italic', () => {
  assert.deepEqual(parseInline('a *quick* note'), [
    { type: 'text', text: 'a ' },
    { type: 'italic', text: 'quick' },
    { type: 'text', text: ' note' },
  ]);
});

test('parseInline: bold is not mistaken for two italics', () => {
  assert.deepEqual(parseInline('**bold**'), [
    { type: 'bold', text: 'bold' },
  ]);
});

test('parseInline: mixed bold and code', () => {
  assert.deepEqual(parseInline('**Real-time** per-pipeline with `flux`'), [
    { type: 'bold', text: 'Real-time' },
    { type: 'text', text: ' per-pipeline with ' },
    { type: 'code', text: 'flux' },
  ]);
});

test('parseInline: empty or missing input yields no segments', () => {
  assert.deepEqual(parseInline(''), []);
  assert.deepEqual(parseInline(undefined), []);
  assert.deepEqual(parseInline(null), []);
});

// ── parseBodyBlocks ─────────────────────────────────────────────────────────

test('parseBodyBlocks: blank-line separated paragraphs', () => {
  assert.deepEqual(parseBodyBlocks('one\n\ntwo'), [
    { type: 'paragraph', text: 'one' },
    { type: 'paragraph', text: 'two' },
  ]);
});

test('parseBodyBlocks: consecutive dash lines become one list', () => {
  assert.deepEqual(parseBodyBlocks('- one\n- two'), [
    { type: 'list', items: ['one', 'two'] },
  ]);
});

test('parseBodyBlocks: mixed paragraph, list, paragraph', () => {
  assert.deepEqual(
    parseBodyBlocks('The configuration covers three concerns:\n\n- one\n- two\n- three\n\nOperating it is deliberate.'),
    [
      { type: 'paragraph', text: 'The configuration covers three concerns:' },
      { type: 'list', items: ['one', 'two', 'three'] },
      { type: 'paragraph', text: 'Operating it is deliberate.' },
    ]
  );
});

test('parseBodyBlocks: list markers keep their inline markup', () => {
  assert.deepEqual(parseBodyBlocks('- **bold** and `code`'), [
    { type: 'list', items: ['**bold** and `code`'] },
  ]);
});

test('parseBodyBlocks: paragraph keeps an internal soft line break', () => {
  assert.deepEqual(parseBodyBlocks('line one\nline two'), [
    { type: 'paragraph', text: 'line one\nline two' },
  ]);
});

test('parseBodyBlocks: leading/trailing blank lines are ignored', () => {
  assert.deepEqual(parseBodyBlocks('\n\nhello\n\n'), [
    { type: 'paragraph', text: 'hello' },
  ]);
});

test('parseBodyBlocks: empty input yields no blocks', () => {
  assert.deepEqual(parseBodyBlocks(''), []);
  assert.deepEqual(parseBodyBlocks(undefined), []);
});
