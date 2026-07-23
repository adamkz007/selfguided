import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readGuideDirectory } from './guides/content';
import { buildGuideSearchIndex } from './guides/search-index';
import { isKnownGuideCategory } from './guides/taxonomy';

export interface GuideValidationResult { valid: boolean; issues: string[]; guideCount: number; }

export function validateGuides(root: string, contentDirectory = 'guides', searchIndexPath = join('public', 'guides', 'search-index.json')): GuideValidationResult {
  const issues: string[] = [];
  const contentPath = join(root, contentDirectory);
  if (!existsSync(contentPath)) return { valid: true, issues, guideCount: 0 };
  let guides;
  try { guides = readGuideDirectory(root, contentDirectory); } catch (error) { return { valid: false, issues: [error instanceof Error ? error.message : String(error)], guideCount: 0 }; }
  const slugs = new Set<string>();
  for (const guide of guides) {
    if (slugs.has(guide.slug)) issues.push(`Duplicate guide slug: ${guide.slug}.`);
    slugs.add(guide.slug);
    if (!isKnownGuideCategory(guide.frontmatter.category)) issues.push(`${guide.path} uses an unknown category: ${guide.frontmatter.category}.`);
    for (const screenshot of guide.frontmatter.screenshots) {
      const resolved = screenshot.startsWith('/') ? join(root, 'public', screenshot) : join(root, screenshot);
      if (!existsSync(resolved)) issues.push(`${guide.path} references a missing screenshot: ${screenshot}.`);
    }
    for (const related of guide.frontmatter.relatedGuides) if (!slugs.has(related) && !guides.some((candidate) => candidate.slug === related)) issues.push(`${guide.path} references an unknown related guide: ${related}.`);
    for (const image of guide.body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) if (!image[1].trim()) issues.push(`${guide.path} has an image without alt text.`);
  }
  const expected = buildGuideSearchIndex(root, contentDirectory);
  const indexPath = join(root, searchIndexPath);
  if (!existsSync(indexPath)) issues.push(`Guide search index is missing: ${relative(root, indexPath)}.`);
  else {
    try {
      const current = JSON.parse(readFileSync(indexPath, 'utf8'));
      if (JSON.stringify(current) !== JSON.stringify(expected)) issues.push(`Guide search index is stale: ${relative(root, indexPath)}.`);
    } catch { issues.push(`Guide search index is invalid JSON: ${relative(root, indexPath)}.`); }
  }
  return { valid: issues.length === 0, issues, guideCount: guides.length };
}
