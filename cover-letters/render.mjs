#!/usr/bin/env node
//
//  render.mjs
//
//  Render a cover letter from applicant.yaml + an application file.
//
//  Usage:
//    node cover-letters/render.mjs <application>       # by name, no extension
//    node cover-letters/render.mjs cover-letters/applications/acme.yaml
//    node cover-letters/render.mjs --all
//
//  Writes <application>.md and <application>.txt next to the input, and prints
//  the letter to stdout. .txt is plain prose for pasting into application forms;
//  .md keeps the paragraph structure if you want to edit before sending.
//

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import { parse } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, 'templates');
const APPLICATIONS = join(HERE, 'applications');

// Wrap at this many columns for the .txt output. Prose, not code.
const WRAP = 88;

function loadYaml(path) {
  return parse(readFileSync(path, 'utf8'));
}

// Collapse the YAML block scalars (`>` folds newlines but leaves a trailing
// newline and can leave runs of spaces) into single-spaced prose.
function tidy(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Re-flow a paragraph to `WRAP` columns without breaking words.
function wrap(text, width = WRAP) {
  return tidy(text)
    .split(' ')
    .reduce((lines, word) => {
      const last = lines[lines.length - 1];
      if (last && `${last} ${word}`.length <= width) {
        lines[lines.length - 1] = `${last} ${word}`;
      } else {
        lines.push(word);
      }
      return lines;
    }, [])
    .join('\n');
}

function resolveApplication(arg) {
  if (arg.endsWith('.yaml') || arg.endsWith('.yml')) return resolve(arg);
  return join(APPLICATIONS, `${arg}.yaml`);
}

function renderOne(appPath) {
  if (!existsSync(appPath)) {
    console.error(`✗ No such application: ${appPath}`);
    process.exitCode = 1;
    return;
  }

  const applicant = loadYaml(join(HERE, 'applicant.yaml'));
  const app = loadYaml(appPath);

  // --- Validate before rendering, so the failure names the missing field -----
  const required = ['role', 'company', 'opening', 'why_company', 'closing'];
  const missing = required.filter((k) => !app[k]);
  if (missing.length) {
    console.error(`✗ ${basename(appPath)}: missing ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const themes = app.themes ?? [];
  const unknown = themes.filter((t) => !(t in (applicant.paragraphs ?? {})));
  if (unknown.length) {
    console.error(
      `✗ ${basename(appPath)}: unknown theme(s): ${unknown.join(', ')}\n` +
        `  available: ${Object.keys(applicant.paragraphs ?? {}).join(', ')}`
    );
    process.exitCode = 1;
    return;
  }

  // Merge: applicant facts first, application overrides on top, and every
  // theme paragraph resolved so the template can index by key.
  const context = {
    ...applicant,
    ...app,
    role: tidy(app.role),
    company: tidy(app.company),
    greeting: tidy(app.greeting ?? 'Dear Hiring Manager'),
    closing: tidy(app.closing),
    paragraphs: Object.fromEntries(
      Object.entries(applicant.paragraphs ?? {}).map(([k, v]) => [k, tidy(v)])
    ),
    themes,
  };

  const env = nunjucks.configure(TEMPLATES, { autoescape: false, trimBlocks: true });
  const md = env.render('cover-letter.md.j2', context).replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // Plain-text version: re-flow every paragraph, drop markdown heading markers.
  const txt =
    md
      .split(/\n{2,}/)
      .map((block) => wrap(block.replace(/^#+\s*/gm, '')))
      .join('\n\n') + '\n';

  const stem = appPath.replace(/\.ya?ml$/, '');
  writeFileSync(`${stem}.md`, md, 'utf8');
  writeFileSync(`${stem}.txt`, txt, 'utf8');

  console.log(`✓ ${basename(stem)}.md`);
  console.log(`✓ ${basename(stem)}.txt`);
  console.log('\n' + '─'.repeat(WRAP) + '\n');
  console.log(txt);
}

// --- Main ---------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    'usage: node cover-letters/render.mjs <application|--all>\n' +
      `applications: ${
        existsSync(APPLICATIONS)
          ? readdirSync(APPLICATIONS)
              .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
              .map((f) => f.replace(/\.ya?ml$/, ''))
              .join(', ') || '(none)'
          : '(none)'
      }`
  );
  process.exit(1);
}

if (args[0] === '--all') {
  for (const f of readdirSync(APPLICATIONS).filter((f) => /\.ya?ml$/.test(f))) {
    renderOne(join(APPLICATIONS, f));
  }
} else {
  for (const arg of args) renderOne(resolveApplication(arg));
}
