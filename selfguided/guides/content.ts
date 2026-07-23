import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateGuideFrontmatter, type GuideFrontmatter } from './frontmatter-schema';

export interface GuideDocument {
  slug: string;
  path: string;
  frontmatter: GuideFrontmatter;
  body: string;
}

export function readGuideDirectory(root: string, contentDirectory = 'guides'): GuideDocument[] {
  const directory = join(root, contentDirectory);
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((file) => /\.mdx?$/.test(file)).sort().map((file) => readGuideFile(join(directory, file), file.replace(/\.mdx?$/, '')));
}

export function readGuideFile(path: string, slug = path.split(/[\\/]/).pop()?.replace(/\.mdx?$/, '') ?? ''): GuideDocument {
  const source = readFileSync(path, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${path} must start with YAML frontmatter.`);
  const fields = Object.fromEntries(match[1].split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf(':');
    if (separator < 1) throw new Error(`${path} has malformed frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    try { return [key, JSON.parse(value)]; } catch { throw new Error(`${path} frontmatter field ${key} must use JSON-compatible values.`); }
  }));
  const frontmatter = fields as unknown as GuideFrontmatter;
  const issues = validateGuideFrontmatter(frontmatter);
  if (issues.length) throw new Error(`${path} has invalid frontmatter: ${issues.map((issue) => issue.message).join(' ')}`);
  return { slug, path, frontmatter, body: match[2].trim() };
}

export function guideSearchText(document: GuideDocument): string {
  return [
    document.frontmatter.title,
    document.frontmatter.description,
    document.frontmatter.category,
    ...document.frontmatter.tags,
    ...document.frontmatter.audience,
    document.body.replace(/!\[[^\]]*\]\([^)]*\)|[`*_#>-]/g, ' '),
  ].join(' ').replace(/\s+/g, ' ').trim();
}
