/**
 * resume-export-pdf.mjs
 *
 * Created by Alexander Gusarov on 04.03.2026.
 * @spartan121
 *
 * Reads src/content/cv/en.yaml and ru.yaml,
 * builds a clean two-column print HTML and exports PDF via Playwright.
 * Also renders a second, single-column ATS-safe PDF from the same data —
 * see htmlAts() below.
 *
 * Usage:
 *   npm run resume:pdf
 *
 * Output (per lang[_spec] found in public/cv/, e.g. en, en_devops, ru):
 *   public/downloads/resume_{suffix}.pdf       — two-column, for humans
 *   public/downloads/resume_{suffix}_ats.pdf   — single-column, for ATS parsers
 *
 * The `resume:hash` step then renames these to carry a content hash
 * (`resume_en.1a2b3c4d.pdf`) — see src/scripts/downloads.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { chromium } from 'playwright';

const ROOT       = path.resolve('.');
const CONTENT    = path.join(ROOT, 'src/content/cv');
const OUTPUT_DIR = path.join(ROOT, 'public/downloads');

const FILES = [
  { yaml: 'en.yaml', suffix: 'en' },
  { yaml: 'ru.yaml', suffix: 'ru' },
];

const T = {
  en: {
    about:        'About me',
    achievements: 'Key Achievements',
    skills:       'Skills',
    experience:   'Experience',
    education:    'Education',
    languages:    'Languages',
    projects:     'Selected Projects',
    private:      'private',
  },
  ru: {
    about:        'Обо мне',
    achievements: 'Ключевые достижения',
    skills:       'Навыки',
    experience:   'Опыт',
    education:    'Образование',
    languages:    'Языки',
    projects:     'Личные проекты',
    private:      'приватный',
  },
  it: {
    about:        'Profilo',
    achievements: 'Risultati chiave',
    skills:       'Competenze',
    experience:   'Esperienza',
    education:    'Istruzione',
    languages:    'Lingue',
    projects:     'Progetti selezionati',
    private:      'privato',
  },
};

// Escape user data before interpolating into HTML — a stray < or & in a
// company name / bullet / URL would otherwise break or inject into the PDF.
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadYaml(filename) {
  const raw = fs.readFileSync(path.join(ROOT, 'public/cv', filename), 'utf8');
  return parse(raw);
}

function cleanPeriod(period = '') {
  return period
    .replace(/—\s*undefined/g, '')
    .replace(/—\s*$/,          '')
    .trim();
}

function html(cv, lang = 'en') {
  const tr = T[lang] ?? T.en;

  /* ── Photo (data URI so Playwright needs no file access) ── */
  const photoRel = (cv.photo ?? '').replace(/^\//, '');
  const photoPath = photoRel ? path.join(ROOT, 'public', photoRel) : '';
  const photoHtml = photoPath && fs.existsSync(photoPath)
    ? `<img class="sidebar-photo" src="data:image/jpeg;base64,${fs.readFileSync(photoPath).toString('base64')}" alt="${esc(cv.name ?? '')}"/>`
    : '';

  /* ── Contacts: label as clickable link, URL hidden ── */
  const contactsHtml = (cv.contacts ?? [])
    .map(c => `<div class="contact-row"><a href="${esc(c.url)}">${esc(c.label)}</a></div>`)
    .join('');

  /* ── Location / timezone — eligibility-relevant for remote roles ── */
  const locationHtml = cv.location
    ? `<div class="cv-location">${esc(cv.location)}${cv.timezone ? ` · ${esc(cv.timezone)}` : ''}</div>`
    : '';

  /* ── Education ── */
  const educationHtml = (cv.education ?? []).length ? `
    <div class="sidebar-section">
      <div class="sidebar-divider"></div>
      <h3>${tr.education}</h3>
      ${(cv.education ?? []).map(e => `
        <div class="edu-item">
          <div class="edu-institution">${esc(e.institution)}</div>
          ${e.period ? `<div class="edu-period">${esc(e.period)}</div>` : ''}
          ${e.degree ? `<div class="edu-degree">${esc(e.degree)}</div>` : ''}
          ${e.field  ? `<div class="edu-field">${esc(e.field)}</div>`   : ''}
        </div>
      `).join('')}
    </div>` : '';

  /* ── Skills ── */
  const skillsHtml = (cv.skills ?? []).length ? `
    <div class="sidebar-section">
      <div class="sidebar-divider"></div>
      <h3>${tr.skills}</h3>
      ${(cv.skills ?? []).map(s => {
        const groupName = typeof s === 'string' ? null : (s.group ?? null);
        const items = typeof s === 'string' ? [s] : (s.items ?? []);
        return `
        <div class="skill-group-block">
          ${groupName ? `<div class="skill-group-name">${esc(groupName)}</div>` : ''}
          <div class="skill-items">${items.map(esc).join(' · ')}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  /* ── Languages ── */
  const languagesHtml = (cv.languages ?? []).length ? `
    <div class="sidebar-section">
      <div class="sidebar-divider"></div>
      <h3>${tr.languages}</h3>
      ${(cv.languages ?? []).map(l => `
        <div class="lang-row">
          <div class="lang-name">${esc(l.language)}</div>
          <div class="lang-level">${esc(l.level)}</div>
        </div>
      `).join('')}
    </div>` : '';

  /* ── About / Summary ── */
  const aboutHtml = cv.summary ? `
    <section class="content-section">
      <h2>${tr.about}</h2>
      <p class="summary-text">${esc(cv.summary)}</p>
    </section>` : '';

  /* ── Achievements ── */
  const achievementsHtml = (cv.achievements ?? []).length ? `
    <section class="content-section">
      <h2>${tr.achievements}</h2>
      <ul class="bullets">
        ${(cv.achievements ?? []).map(a => `<li>${esc(a)}</li>`).join('')}
      </ul>
    </section>` : '';

  /* ── Experience ── */
  const experienceHtml = (cv.experience ?? []).length ? `
    <section class="content-section">
      <h2>${tr.experience}</h2>
      ${(cv.experience ?? []).map(exp => {
        const desc = Array.isArray(exp.description) ? exp.description.filter(Boolean) : [];
        return `
        <div class="exp-entry">
          <div class="exp-lead">
            <div class="exp-header">
              <div class="exp-company">${esc(exp.company)}${exp.role ? ` <span class="exp-role">— ${esc(exp.role)}</span>` : ''}</div>
              <div class="exp-period">${esc(cleanPeriod(exp.period))}</div>
            </div>
          </div>
          ${desc.length ? `<ul class="bullets">${desc.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
          ${exp.stack?.length ? `<div class="exp-stack">${exp.stack.map(esc).join(', ')}</div>` : ''}
        </div>`;
      }).join('')}
    </section>` : '';

  /* ── Personal Projects ── */
  const projectsHtml = (cv.projects ?? []).length ? `
    <section class="content-section">
      <h2>${tr.projects}</h2>
      ${cv.projects_intro ? `<p class="summary-text">${esc(cv.projects_intro)}</p>` : ''}
      <ul class="bullets">
        ${(cv.projects ?? []).map(p => `<li>${p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name)}${p.private ? ` (${tr.private})` : ''} — ${esc(p.description)}</li>`).join('')}
      </ul>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --accent:     #1F439B;
      --text:       #1a1a1a;
      --muted:      #555555;
      --light:      #888888;
      --sidebar-bg: #F5F5F5;
      --divider:    #1a1a1a;
    }

    html, body {
      width: 210mm;
      min-height: 297mm;
    }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      font-weight: 400;
      color: var(--text);
      background: #fff;
      display: grid;
      grid-template-columns: 66mm 1fr;
      line-height: 1.5;
    }

    a { color: inherit; text-decoration: none; }

    /* ─────────────────────────────────────────
       SIDEBAR
       ───────────────────────────────────────── */
    .sidebar {
      background: var(--sidebar-bg);
      padding: 13mm 7mm 13mm 8mm;
      display: flex;
      flex-direction: column;
    }

    .sidebar-photo {
      display: block;
      width: 100%;
      aspect-ratio: 3 / 4;
      object-fit: cover;
      object-position: 50% 18%;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    .cv-name {
      font-size: 18pt;
      font-weight: 600;
      line-height: 1.15;
      color: var(--text);
      margin-bottom: 3px;
    }

    /* General role — black, lighter weight */
    .cv-title {
      font-size: 9.5pt;
      font-weight: 400;
      color: var(--text);
      margin-bottom: 4px;
      line-height: 1.4;
    }

    /* Location / timezone */
    .cv-location {
      font-size: 8.5pt;
      color: var(--muted);
      margin-bottom: 10px;
      line-height: 1.4;
    }

    /* Contacts: label only as link */
    .contact-row {
      margin-bottom: 3px;
      font-size: 8.5pt;
    }

    .contact-row a {
      color: var(--accent);
      font-weight: 500;
    }

    /* Sidebar sections */
    .sidebar-section { margin-top: 2px; }

    .sidebar-divider {
      border: none;
      border-top: 1px solid #d0d0d0;
      margin: 10px 0 8px;
    }

    .sidebar-section h3 {
      font-size: 8.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text);
      margin-bottom: 7px;
    }

    /* Education */
    .edu-item { margin-bottom: 8px; }

    .edu-institution {
      font-weight: 600;
      color: var(--accent);
      font-size: 8.5pt;
    }

    .edu-period {
      font-size: 8pt;
      color: var(--light);
    }

    .edu-degree, .edu-field {
      font-size: 8.5pt;
      color: var(--muted);
    }

    /* Skills */
    .skill-group-block { margin-bottom: 7px; }

    .skill-group-name {
      font-weight: 600;
      color: var(--accent);
      font-size: 8.5pt;
      margin-bottom: 1px;
    }

    .skill-items {
      font-size: 8.5pt;
      color: var(--muted);
      line-height: 1.55;
    }

    /* Languages — stacked, not side-by-side */
    .lang-row {
      margin-bottom: 5px;
    }

    .lang-name {
      font-weight: 600;
      font-size: 8.5pt;
      color: var(--text);
    }

    .lang-level {
      font-size: 8pt;
      color: var(--muted);
    }

    /* ─────────────────────────────────────────
       MAIN CONTENT
       ───────────────────────────────────────── */
    .content {
      padding: 13mm 10mm 13mm 10mm;
      display: block;
    }

    .content-section { margin-bottom: 13px; }

    /* Section titles — bigger, black, thicker divider */
    .content-section h2 {
      font-size: 13pt;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid var(--divider);
      break-after: avoid;
      page-break-after: avoid;
    }

    /* Summary */
    .summary-text {
      font-size: 9.5pt;
      color: #333;
      line-height: 1.6;
    }

    /* Experience — a long entry may span a page boundary instead of being
       pushed wholesale to the next page (which left the first page almost
       blank). The heading is kept with the first bullet so an entry never
       starts with an orphaned heading. */
    .exp-entry {
      margin-bottom: 11px;
    }

    /* Header stays glued to the first bullet within an entry */
    .exp-lead {
      break-inside: avoid;
      break-after: avoid;
      page-break-after: avoid;
    }

    .exp-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 3px;
    }

    .exp-company {
      font-size: 10pt;
      font-weight: 600;
      color: var(--accent);
      flex: 1;
    }

    /* Role — same color as company */
    .exp-role {
      font-weight: 400;
      color: var(--accent);
      font-size: 9.5pt;
    }

    .exp-period {
      font-size: 8.5pt;
      color: var(--light);
      white-space: nowrap;
    }

    /* Stack — indented to align with bullet text, not bullet marker */
    .exp-stack {
      font-size: 8pt;
      color: var(--light);
      margin-top: 3px;
      padding-left: 13px;
      font-style: italic;
    }

    /* Bullets */
    .bullets {
      padding-left: 13px;
      margin: 3px 0;
    }

    .bullets li {
      font-size: 9pt;
      color: #333;
      margin-bottom: 2px;
      line-height: 1.5;
    }

    .bullets li::marker {
      color: var(--accent);
      font-size: 8pt;
    }
  </style>
</head>
<body>

  <!-- SIDEBAR -->
  <div class="sidebar">
    ${photoHtml}
    <div class="cv-name">${esc(cv.name)}</div>
    <div class="cv-title">${esc(cv.title)}</div>
    ${locationHtml}

    ${contactsHtml}
    ${educationHtml}
    ${skillsHtml}
    ${languagesHtml}
  </div>

  <!-- CONTENT -->
  <div class="content">
    ${aboutHtml}
    ${achievementsHtml}
    ${experienceHtml}
    ${projectsHtml}
  </div>

</body>
</html>`;
}

// ATS-safe variant: single linear column, reading order top-to-bottom exactly
// matches DOM order (nothing an ATS text-extractor could re-shuffle across
// columns), standard section headings, no icons, no header/footer regions —
// contacts sit in the normal document flow. Same data, same esc()/tr, laid
// out flat instead of sidebar + content.
function htmlAts(cv, lang = 'en') {
  const tr = T[lang] ?? T.en;

  const contactsHtml = (cv.contacts ?? []).length ? `
    <div class="contacts">
      ${(cv.contacts ?? []).map(c => `<a href="${esc(c.url)}">${esc(c.label)}</a>`).join('<span class="sep">·</span>')}
    </div>` : '';

  const locationHtml = cv.location
    ? `<div class="cv-location">${esc(cv.location)}${cv.timezone ? ` · ${esc(cv.timezone)}` : ''}</div>`
    : '';

  const aboutHtml = cv.summary ? `
    <section class="section">
      <h2>${tr.about}</h2>
      <p>${esc(cv.summary)}</p>
    </section>` : '';

  const skillsHtml = (cv.skills ?? []).length ? `
    <section class="section">
      <h2>${tr.skills}</h2>
      ${(cv.skills ?? []).map(s => {
        const groupName = typeof s === 'string' ? null : (s.group ?? null);
        const items = typeof s === 'string' ? [s] : (s.items ?? []);
        return `<p class="skill-line">${groupName ? `<strong>${esc(groupName)}:</strong> ` : ''}${items.map(esc).join(', ')}</p>`;
      }).join('')}
    </section>` : '';

  const achievementsHtml = (cv.achievements ?? []).length ? `
    <section class="section">
      <h2>${tr.achievements}</h2>
      <ul>${(cv.achievements ?? []).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    </section>` : '';

  const experienceHtml = (cv.experience ?? []).length ? `
    <section class="section">
      <h2>${tr.experience}</h2>
      ${(cv.experience ?? []).map(exp => {
        const desc = Array.isArray(exp.description) ? exp.description.filter(Boolean) : [];
        return `
        <div class="entry">
          <p class="entry-head">
            <strong>${esc(exp.company)}</strong>${exp.role ? ` — ${esc(exp.role)}` : ''}, ${esc(cleanPeriod(exp.period))}
          </p>
          ${desc.length ? `<ul>${desc.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
          ${exp.stack?.length ? `<p class="entry-stack">${exp.stack.map(esc).join(', ')}</p>` : ''}
        </div>`;
      }).join('')}
    </section>` : '';

  const projectsHtml = (cv.projects ?? []).length ? `
    <section class="section">
      <h2>${tr.projects}</h2>
      ${cv.projects_intro ? `<p>${esc(cv.projects_intro)}</p>` : ''}
      <ul>${(cv.projects ?? []).map(p => `<li>${esc(p.name)}${p.private ? ` (${tr.private})` : ''} — ${esc(p.description)}${p.url ? ` (${esc(p.url)})` : ''}</li>`).join('')}</ul>
    </section>` : '';

  const educationHtml = (cv.education ?? []).length ? `
    <section class="section">
      <h2>${tr.education}</h2>
      ${(cv.education ?? []).map(e => `
        <p class="entry-head">
          <strong>${esc(e.institution)}</strong>${e.degree ? `, ${esc(e.degree)}` : ''}${e.period ? `, ${esc(e.period)}` : ''}
        </p>`).join('')}
    </section>` : '';

  const languagesHtml = (cv.languages ?? []).length ? `
    <section class="section">
      <h2>${tr.languages}</h2>
      <p>${(cv.languages ?? []).map(l => `${esc(l.language)} — ${esc(l.level)}`).join(', ')}</p>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      font-weight: 400;
      color: #1a1a1a;
      background: #fff;
      line-height: 1.35;
    }

    a { color: inherit; text-decoration: underline; }

    .cv-name {
      font-size: 20pt;
      font-weight: 700;
    }

    .cv-title {
      font-size: 12pt;
      font-weight: 400;
      margin-top: 2px;
    }

    .cv-location {
      margin-top: 6px;
      font-size: 10.5pt;
      color: #333;
    }

    .contacts {
      margin-top: 8px;
      font-size: 10.5pt;
    }

    .contacts .sep { margin: 0 6px; }

    .section { margin-top: 12px; }

    .section h2 {
      font-size: 13pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #1a1a1a;
      padding-bottom: 2px;
      margin-bottom: 6px;
    }

    .section p { margin-bottom: 4px; }

    .skill-line { font-size: 11pt; }

    .entry { margin-bottom: 10px; }
    .entry-head { break-inside: avoid; }
    .entry-stack { font-style: italic; color: #333; font-size: 10.5pt; }

    ul { padding-left: 18px; margin: 2px 0 5px; }
    li { font-size: 11pt; margin-bottom: 1px; }
  </style>
</head>
<body>
  <div class="cv-name">${esc(cv.name)}</div>
  <div class="cv-title">${esc(cv.title)}</div>
  ${locationHtml}
  ${contactsHtml}
  ${aboutHtml}
  ${achievementsHtml}
  ${skillsHtml}
  ${experienceHtml}
  ${projectsHtml}
  ${educationHtml}
  ${languagesHtml}
</body>
</html>`;
}

async function run() {
  ensureDir(OUTPUT_DIR);

  const files = fs.readdirSync(path.join(ROOT, 'public/cv'))
    .filter(f => f.endsWith('.yaml'));

  // Browser selection is an explicit opt-in, NOT derived from `CI`.
  //
  // The original code keyed off `process.env.CI` to use a runner's preinstalled
  // Google Chrome. That breaks on any CI that sets `CI=true` without branded
  // Chrome present — GitLab CI does exactly this, so the build failed with
  // "Chromium distribution 'chrome' is not found". Playwright's bundled
  // Chromium is the default everywhere; set PLAYWRIGHT_CHANNEL=chrome to opt
  // into the system Chrome instead.
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch(channel ? { channel } : {});
  const page    = await browser.newPage();

  for (const file of files) {
    const suffix  = file.replace('.yaml', '');
    const lang    = suffix.split('_')[0];
    const cv      = loadYaml(file);
    const content = html(cv, lang);

    await page.setContent(content, { waitUntil: 'networkidle' });

    const outPath = path.join(OUTPUT_DIR, `resume_${suffix}.pdf`);
    await page.pdf({
      path:            outPath,
      format:          'A4',
      printBackground: true,
      margin:          { top: '0', right: '0', bottom: '0', left: '0' },
    });

    console.log(`✔ ${outPath}`);

    // ATS variant — flows naturally across as many pages as the content
    // needs (unlike the fixed one-page two-column design above), so it gets
    // real page margins instead of the zero-margin/fixed-height trick.
    const contentAts = htmlAts(cv, lang);
    await page.setContent(contentAts, { waitUntil: 'networkidle' });

    const outPathAts = path.join(OUTPUT_DIR, `resume_${suffix}_ats.pdf`);
    await page.pdf({
      path:            outPathAts,
      format:          'A4',
      printBackground: true,
      margin:          { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' },
    });

    console.log(`✔ ${outPathAts}`);
  }

  await browser.close();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
