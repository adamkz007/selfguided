import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApplicationMap } from '../discovery/output-schema';
import { discoverApplication } from '../discovery';
import type { GuideFrontmatter } from './frontmatter-schema';

export interface GuideDirectoryEntry extends GuideFrontmatter {
  slug: string;
  body?: string;
  popular?: boolean;
}

export interface GeneratedGuidesRoute {
  framework: 'next-app-router';
  pagePath: string;
  detailPagePath: string;
  source: string;
}

export interface GenerateGuidesRouteOptions { overwrite?: boolean; }

export function generateGuidesRoute(
  appRoot: string,
  guides: GuideDirectoryEntry[],
  applicationMap = discoverApplication({ root: appRoot }),
  options: GenerateGuidesRouteOptions = {},
): GeneratedGuidesRoute {
  if (!isNextAppRouter(applicationMap)) throw new Error('SelfGuided guide directory currently supports Next.js App Router targets only.');
  const pagePath = join(appRoot, 'app', 'guides', 'page.tsx');
  const detailPagePath = join(appRoot, 'app', 'guides', '[slug]', 'page.tsx');
  if (!options.overwrite && [pagePath, detailPagePath].some(existsSync)) throw new Error('A /guides route already exists. Re-run with explicit overwrite approval only after reviewing it.');
  const source = renderNextGuidesPage(guides);
  mkdirSync(join(appRoot, 'app', 'guides', '[slug]'), { recursive: true });
  writeFileSync(pagePath, source);
  writeFileSync(detailPagePath, renderNextGuideDetailPage(guides));
  return { framework: 'next-app-router', pagePath, detailPagePath, source };
}

export function isNextAppRouter(applicationMap: ApplicationMap): boolean {
  return applicationMap.framework.frameworks.some((item) => item.name === 'Next.js') && applicationMap.framework.routingConventions.some((item) => item.name === 'Next.js app router');
}

export function renderNextGuidesPage(guides: GuideDirectoryEntry[]): string {
  return `'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Guide = { slug: string; title: string; description: string; category: string; estimatedTime: string; tags: string[]; audience: string[]; lastVerified: string; popular?: boolean };
const guides: Guide[] = ${JSON.stringify(guides.map(({ body: _body, ...guide }) => guide), null, 2)};
const categories = ['All', ...new Set(guides.map((guide) => guide.category))];
const audiences = ['All', ...new Set(guides.flatMap((guide) => guide.audience))];

export default function GuidesPage() {
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('All'); const [audience, setAudience] = useState('All');
  const filtered = useMemo(() => guides.filter((guide) => [guide.title, guide.description, guide.category, ...guide.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase()) && (category === 'All' || guide.category === category) && (audience === 'All' || guide.audience.includes(audience))), [query, category, audience]);
  const recent = [...filtered].sort((left, right) => right.lastVerified.localeCompare(left.lastVerified)).slice(0, 3);
  return <main className="guides-page"><header><p>Self-guided help</p><h1>Guides</h1><p>Find clear, step-by-step instructions for your workspace.</p></header><div className="filters" role="search"><label>Search guides<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by task or topic" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value)}>{audiences.map((item) => <option key={item}>{item}</option>)}</select></label></div>{filtered.length ? <><GuideSection title="Popular guides" guides={filtered.filter((guide) => guide.popular).slice(0, 3)} /><GuideSection title="Recently updated" guides={recent} /><GuideSection title="All guides" guides={filtered} /></> : <p role="status">No guides found. Try a different search term or filter.</p>}<style jsx>{\`.guides-page{max-width:72rem;margin:auto;padding:3rem 1.5rem}.filters,.grid{display:grid;gap:1rem}.filters{grid-template-columns:2fr 1fr 1fr;margin:2rem 0}label{display:grid;gap:.4rem;font-weight:600}input,select{min-height:2.75rem;padding:.5rem;border:1px solid currentColor;border-radius:.4rem}.grid{grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}.card{border:1px solid #d6d9df;border-radius:.75rem;padding:1.25rem}.meta{color:#596579;font-size:.9rem}@media(max-width:44rem){.filters{grid-template-columns:1fr}}\`}</style></main>;
}
function GuideSection({ title, guides }: { title: string; guides: Guide[] }) { if (!guides.length) return null; return <section><h2>{title}</h2><div className="grid">{guides.map((guide) => <article className="card" key={guide.slug}><p>{guide.category}</p><h3><Link href={\`/guides/\${guide.slug}\`}>{guide.title}</Link></h3><p>{guide.description}</p><p className="meta">{guide.estimatedTime} · Updated {guide.lastVerified}</p></article>)}</div></section>; }
`;
}

export function renderNextGuideDetailPage(guides: GuideDirectoryEntry[]): string {
  return `import Link from 'next/link';
import { notFound } from 'next/navigation';

type Guide = { slug: string; title: string; description: string; category: string; estimatedTime: string; tags: string[]; lastVerified: string; prerequisites: string[]; expectedResults: string[]; relatedGuides: string[]; body?: string };
const guides: Guide[] = ${JSON.stringify(guides, null, 2)};
export function generateStaticParams() { return guides.map((guide) => ({ slug: guide.slug })); }
export default function GuideDetailPage({ params }: { params: { slug: string } }) {
  const guide = guides.find((item) => item.slug === params.slug); if (!guide) notFound();
  const lines = (guide.body || guide.description).split('\\n').filter(Boolean); const headings = lines.filter((line) => line.startsWith('## '));
  return <main className="guide"><Link href="/guides">← All guides</Link><p>{guide.category} · {guide.estimatedTime}</p><h1>{guide.title}</h1><p>{guide.description}</p>{headings.length ? <nav aria-label="On this page"><strong>On this page</strong><ul>{headings.map((heading) => <li key={heading}><a href={\`#\${slug(heading.slice(3))}\`}>{heading.slice(3)}</a></li>)}</ul></nav> : null}<article>{lines.map(renderLine)}</article><section><h2>Related guides</h2>{guide.relatedGuides.length ? <ul>{guide.relatedGuides.map((slug) => <li key={slug}><Link href={\`/guides/\${slug}\`}>{guides.find((item) => item.slug === slug)?.title || slug}</Link></li>)}</ul> : <p>No related guides yet.</p>}</section><p>Last verified {guide.lastVerified}</p><style jsx>{\`.guide{max-width:48rem;margin:auto;padding:3rem 1.5rem}.guide article{line-height:1.7}.guide nav{padding:1rem;border:1px solid #d6d9df;border-radius:.5rem}.guide h2{margin-top:2rem}.guide figure{margin:1.5rem 0}.guide img{max-width:100%;height:auto;border:1px solid #d6d9df;border-radius:.5rem}\`}</style></main>;
}
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function renderLine(line: string, index: number) { const image = line.match(/^!\\[([^\\]]*)\\]\\(([^)]+)\\)$/); if (image) return <figure key={index}><img src={image[2]} alt={image[1]} /><figcaption>{image[1]}</figcaption></figure>; if (line.startsWith('## ')) return <h2 id={slug(line.slice(3))} key={index}>{line.slice(3)}</h2>; if (line.startsWith('- ')) return <li key={index}>{line.slice(2)}</li>; return <p key={index}>{line.replace(/^[0-9]+\\. \\*\\*|\\*\\* — /g, '')}</p>; }
`;
}
