//
//  projects.ts
//  CV Hub
//
//  Shared ordering and media selection for the projects list.
//
//  Usage: import { sortProjects, pickFeaturedMedia } from '../scripts/projects';
//  projects = sortProjects(projects);
//
//  Pinned (featured) projects stay on top in their existing `order`. Every
//  other project is sorted newest-first by `year`, falling back to `order`
//  and then name for ties.
//

function orderOf(project: any): number {
  return Number.isFinite(Number(project?.order)) ? Number(project.order) : 9999;
}

function yearOf(project: any): number {
  const match = String(project?.year ?? '').match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

export function sortProjects(projects: any[]): any[] {
  return [...projects].sort((a, b) => {
    const aPinned = a?.featured === true;
    const bPinned = b?.featured === true;

    // Pinned projects come first and keep their configured order.
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      const ao = orderOf(a);
      const bo = orderOf(b);
      if (ao !== bo) return ao - bo;
    } else {
      // Everything else: newest year first, then configured order.
      const ay = yearOf(a);
      const by = yearOf(b);
      if (ay !== by) return by - ay;
      const ao = orderOf(a);
      const bo = orderOf(b);
      if (ao !== bo) return ao - bo;
    }

    return String(a?.name ?? '').toLowerCase().localeCompare(String(b?.name ?? '').toLowerCase());
  });
}

/**
 * Which media entry fronts a project: the one flagged `featured`, else the
 * first, else null. Shared by the card renderer and the list pages' eager-load
 * (LCP) selection so they can never disagree.
 */
export function pickFeaturedMedia(media: any[] | undefined | null): any | null {
  if (!Array.isArray(media) || media.length === 0) return null;
  return media.find((m) => m?.featured) ?? media[0] ?? null;
}
