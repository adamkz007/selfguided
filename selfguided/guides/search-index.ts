import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { guideSearchText, readGuideDirectory } from './content';

export interface GuideSearchIndexEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  audience: string[];
  tags: string[];
  estimatedTime: string;
  bodyExcerpt: string;
  lastVerified: string;
  keywords: string[];
}

export function buildGuideSearchIndex(root: string, contentDirectory = 'guides'): GuideSearchIndexEntry[] {
  return readGuideDirectory(root, contentDirectory).map((guide) => {
    const searchText = guideSearchText(guide);
    return {
      slug: guide.slug,
      title: guide.frontmatter.title,
      description: guide.frontmatter.description,
      category: guide.frontmatter.category,
      audience: guide.frontmatter.audience,
      tags: guide.frontmatter.tags,
      estimatedTime: guide.frontmatter.estimatedTime,
      bodyExcerpt: guide.body.replace(/\s+/g, ' ').slice(0, 240),
      lastVerified: guide.frontmatter.lastVerified,
      keywords: [...new Set(searchText.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [])].sort(),
    };
  });
}

export function writeGuideSearchIndex(root: string, contentDirectory = 'guides', outputPath = join('public', 'guides', 'search-index.json')): string {
  const path = join(root, outputPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(buildGuideSearchIndex(root, contentDirectory), null, 2)}\n`);
  return path;
}
