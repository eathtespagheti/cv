//
//  content.config.ts
//  CV Hub
//
//  Migrated from src/content/config.ts (Astro 5 legacy `type: 'data'`
//  collections) to Astro 6+ loader-based collections. Each collection here
//  is a flat folder of standalone YAML files — one file, one entry, id =
//  filename without extension — which is exactly what glob() with a
//  wildcard pattern reproduces.
//
//  Created by Alexander Gusarov on 03.03.2026.
//  @spartan121
//

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * NOTE:
 * We validate content shape here, not presentation.
 * Keep schemas permissive enough for real-world resume data (e.g. mailto: links).
 */

const linkSchema = z.object({
  label: z.string().optional().default(''),
  url: z
    .string()
    .optional()
    .default('')
    .refine(
      (v) =>
        v === '' || v.startsWith('https://') || v.startsWith('http://') || v.startsWith('mailto:'),
      { message: 'url must start with https://, http://, or mailto:' }
    ),
});

const cvSkillGroupSchema = z.object({
  group: z.string().optional().default(''),
  items: z.array(z.string()).optional().default([]),
});

const cvExperienceSchema = z.object({
  company: z.string().optional().default(''),
  role: z.string().optional().default(''),
  period: z.string().optional().default(''),
  description: z.array(z.string()).optional().default([]),
  stack: z.array(z.string()).optional().default([]),
});

const cvEducationSchema = z.object({
  institution: z.string().optional().default(''),
  degree: z.string().optional().default(''),
  period: z.string().optional().default(''),
});

const cvLanguageSchema = z.object({
  language: z.string().optional().default(''),
  level: z.string().optional().default(''),
});

const cvProjectSchema = z.object({
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  url: z
    .string()
    .optional()
    .default('')
    .refine(
      (v) => v === '' || v.startsWith('https://') || v.startsWith('http://'),
      { message: 'url must start with https:// or http://' }
    ),
  private: z.boolean().optional().default(false),
});

// The CV's authored source: `src/content/cv/*.yaml` — a base per language plus
// optional `{lang}_{spec}.yaml` deltas. No page queries this collection by id;
// pages and the document exporters read the merged, gitignored `public/cv/`
// artifact that `cv:build` (src/scripts/merge.mjs) writes. But Astro loads and
// validates *every* defined collection on build, so this schema is the gate
// that fails CI on a malformed CV YAML entry (see .gitlab-ci.yml, and "validated
// on build" in AGENTS.md/README). It looks unused and is not — do not delete it
// as dead code without replacing that validation.
const cv = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/cv' }),
  schema: z.object({
    name: z.string().optional().default(''),
    title: z.string().optional().default(''),
    photo: z.string().optional().default(''),
    summary: z.string().optional().default(''),
    contacts: z.array(linkSchema).optional().default([]),
    achievements: z.array(z.string()).optional().default([]),
    skills: z.array(cvSkillGroupSchema).optional().default([]),
    experience: z.array(cvExperienceSchema).optional().default([]),
    education: z.array(cvEducationSchema).optional().default([]),
    languages: z.array(cvLanguageSchema).optional().default([]),
    projects_intro: z.string().optional().default(''),
    projects: z.array(cvProjectSchema).optional().default([]),
    location: z.string().optional().default(''),
    timezone: z.string().optional().default(''),
    work_permit: z.string().optional().default(''),
  }),
});

// Projects
const projectLinkSchema = z.object({
  label: z.string().optional().default(''),
  url: z.string().optional().default(''),
  type: z
    .enum(['repo', 'demo', 'store', 'product', 'video', 'article', 'press', 'other'])
    .optional()
    .default('other'),
});

const projectMetricSchema = z.object({
  label: z.string().optional().default(''),
  value: z.string().optional().default(''),
  source: z.string().optional().default(''),
});

const projectMediaSchema = z.object({
  type: z.enum(['image', 'gif', 'video']).optional().default('image'),
  src: z.string().optional().default(''),
  alt: z.string().optional().default(''),
  featured: z.boolean().optional().default(false),
});

const projectSchema = z.object({
  slug: z.string().optional().default(''),
  name: z.string().optional().default(''),
  order: z.coerce.number().optional(),
  category: z.string().optional().default(''),
  role: z.string().optional().default(''),
  year: z.preprocess(
    (v) => (v === undefined || v === null ? '' : String(v)),
    z.string().optional().default('')
  ),
  description: z.string().optional().default(''),
  platforms: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  theme: z
    .enum(['auto', 'blue', 'cyan', 'emerald', 'magenta'])
    .optional()
    .default('auto'),
  accent: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'accent must be a HEX color like #3b82f6')
    .optional(),
  metrics: z.array(projectMetricSchema).optional().default([]),
  stack: z.array(z.string()).optional().default([]),
  links: z.array(projectLinkSchema).optional().default([]),
  media: z.array(projectMediaSchema).optional().default([]),
  featured: z.boolean().optional().default(false),
  archived: z.boolean().optional().default(false),
  archive: z.boolean().optional().default(false),
}).passthrough();

const projects = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/projects' }),
  schema: z.object({
    projects: z.array(projectSchema).optional().default([]),
  }),
});

// Profiles
const profiles = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/profiles' }),
  schema: z.object({
    profiles: z.array(z.object({
      id: z.string(),
      label: z.string(),
      slug: z.string(),
      spec: z.string().nullable().optional().default(null),
    })),
  }),
});

// Languages
const languages = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/languages' }),
  schema: z.object({
    default: z.string(),
    languages: z.array(z.object({
      id: z.string(),
      label: z.string(),
    })),
  }),
});

// i18n translations
const translationValueSchema = z.record(z.string());

const i18n = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/i18n' }),
  schema: z.object({
    nav: z.record(translationValueSchema).optional().default({}),
    cv: z.record(translationValueSchema).optional().default({}),
    projects: z.record(translationValueSchema).optional().default({}),
    changelog: z.record(translationValueSchema).optional().default({}),
    notfound404: z.record(translationValueSchema).optional().default({}),
    meta: z.record(translationValueSchema).optional().default({}),
  }),
});

// Site — deployment-wide settings, not tied to any profile or language.
// Grows over time (analytics opt-in, "open to work" status, footer credit
// toggle, ...); `downloads` is the first field. See docs/INFO_en.md.
const downloadFormat = z.enum(['pdf', 'pdfAts', 'docx', 'txt']);

const site = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/site' }),
  schema: z.object({
    // Flat = one implicit ungrouped bucket: downloads: [pdf, docx].
    // Grouped = a labeled section per audience — required as soon as two
    // entries would render the same button label (e.g. pdf + pdfAts both
    // show "PDF"); see docs/INFO_en.md §17 for the convention.
    downloads: z.union([
      z.array(downloadFormat),
      z.array(z.object({
        group: z.string().nullable().optional().default(null),
        items: z.array(downloadFormat),
      })),
    ]).optional().default(['pdf', 'docx']),
    // Opt-out "Made with CV Hub" footer credit, next to the GitHub link —
    // always points at the upstream project (not GITHUB_REPOSITORY, unlike
    // the rest of the footer), so every deployed fork stays a discoverable
    // backlink. On by default; set to false to remove it.
    footerCredit: z.boolean().optional().default(true),
  }),
});

export const collections = {
  cv,
  projects,
  profiles,
  languages,
  i18n,
  site,
};
