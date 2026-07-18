import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApplicationMap } from '../discovery/output-schema';
import { discoverApplication } from '../discovery';
import type { GuideFrontmatter } from './frontmatter-schema';

export interface GuideDirectoryEntry extends GuideFrontmatter {
  slug: string;
  popular?: boolean;
}

export interface GeneratedGuidesRoute {
  framework: 'next-app-router';
  pagePath: string;
  source: string;
}

export function generateGuidesRoute(
  appRoot: string,
  guides: GuideDirectoryEntry[],
  applicationMap = discoverApplication({ root: appRoot }),
): GeneratedGuidesRoute {
  if (!isNextAppRouter(applicationMap)) {
    throw new Error('SelfGuided guide directory currently supports Next.js App Router targets only.');
  }
  const pagePath = join(appRoot, 'app', 'guides', 'page.tsx');
  const source = renderNextGuidesPage(guides);
  mkdirSync(join(appRoot, 'app', 'guides'), { recursive: true });
  writeFileSync(pagePath, source);
  return { framework: 'next-app-router', pagePath, source };
}

export function isNextAppRouter(applicationMap: ApplicationMap): boolean {
  return applicationMap.framework.frameworks.some((item) => item.name === 'Next.js') &&
    applicationMap.framework.routingConventions.some((item) => item.name === 'Next.js app router');
}

export function renderNextGuidesPage(guides: GuideDirectoryEntry[]): string {
  const data = JSON.stringify(guides, null, 2);
  return `'use client';

import { useMemo, useState } from 'react';

type Guide = ${JSON.stringify({} as GuideDirectoryEntry).replace('{}', '{ slug: string; title: string; description: string; category: string; estimatedTime: string; tags: string[]; audience: string[]; lastVerified: string; popular?: boolean }')};

const guides: Guide[] = ${data};
const categories = ['All', ...new Set(guides.map((guide) => guide.category))];
const audiences = ['All', ...new Set(guides.flatMap((guide) => guide.audience))];

export default function GuidesPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [audience, setAudience] = useState('All');
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => guides.filter((guide) => {
    const searchable = [guide.title, guide.description, guide.category, ...guide.tags].join(' ').toLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (category === 'All' || guide.category === category) &&
      (audience === 'All' || guide.audience.includes(audience));
  }), [normalizedQuery, category, audience]);
  const popular = filtered.filter((guide) => guide.popular).slice(0, 3);
  const recent = [...filtered].sort((a, b) => b.lastVerified.localeCompare(a.lastVerified)).slice(0, 3);

  return <main className="guides-page">
    <style jsx>{\`\n      .guides-page { max-width: 1120px; margin: 0 auto; padding: 48px 24px 72px; color: #172033; }\n      .hero { margin-bottom: 32px; }\n      .eyebrow { color: #5367d8; font-size: .8rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }\n      h1 { margin: 8px 0; font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -.04em; }\n      .intro { max-width: 660px; color: #5d687c; font-size: 1.05rem; }\n      .toolbar { display: grid; grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(150px, 220px)); gap: 12px; margin: 28px 0 44px; }\n      label { display: grid; gap: 6px; color: #4c5870; font-size: .85rem; font-weight: 650; }\n      input, select { min-height: 44px; border: 1px solid #c9d0dc; border-radius: 8px; background: white; padding: 0 12px; color: inherit; font: inherit; }\n      input:focus-visible, select:focus-visible, a:focus-visible { outline: 3px solid #aab7ff; outline-offset: 2px; }\n      .filter-group { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 20px; }\n      .filter { border: 1px solid #c9d0dc; border-radius: 999px; background: white; padding: 8px 14px; color: #4c5870; cursor: pointer; font: inherit; }\n      .filter[aria-pressed="true"] { border-color: #5367d8; background: #eef0ff; color: #3143aa; }\n      section { margin-top: 36px; }\n      .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 14px; }\n      h2 { margin: 0; font-size: 1.35rem; }\n      .count { color: #68748a; font-size: .9rem; }\n      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }\n      .card { display: flex; min-height: 190px; flex-direction: column; border: 1px solid #dbe0e8; border-radius: 12px; padding: 20px; background: white; box-shadow: 0 5px 18px rgb(35 46 71 / 6%); }\n      .card h3 { margin: 10px 0 8px; font-size: 1.08rem; }\n      .card p { flex: 1; margin: 0 0 16px; color: #5d687c; line-height: 1.5; }\n      .meta { display: flex; flex-wrap: wrap; gap: 8px 12px; color: #68748a; font-size: .82rem; }\n      .category { color: #5367d8; font-size: .78rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }\n      .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }\n      .tag { border-radius: 5px; background: #f0f2f6; padding: 4px 7px; color: #59657a; font-size: .75rem; }\n      .empty { border: 1px dashed #b9c1cf; border-radius: 12px; padding: 36px 20px; text-align: center; color: #5d687c; }\n      .empty h2 { margin-bottom: 8px; color: #172033; }\n      @media (max-width: 760px) { .guides-page { padding: 32px 16px 48px; } .toolbar { grid-template-columns: 1fr; } .grid { grid-template-columns: 1fr; } .section-heading { align-items: flex-start; flex-direction: column; gap: 4px; } }\n    \`} </style>
    <header className="hero">
      <div className="eyebrow">Self-guided help</div>
      <h1>Guides</h1>
      <p className="intro">Find clear, step-by-step instructions for getting the most out of your workspace.</p>
    </header>
    <div className="toolbar" role="search" aria-label="Search and filter guides">
      <label>Search guides<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by task or topic" type="search" /></label>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value)}>{audiences.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="filter-group" aria-label="Category filters">{categories.map((item) => <button className="filter" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    {filtered.length ? <>
      {popular.length ? <GuideSection title="Popular guides" guides={popular} /> : null}
      {recent.length ? <GuideSection title="Recently updated" guides={recent} /> : null}
      <GuideSection title="All guides" guides={filtered} />
    </> : <div className="empty" role="status"><h2>No guides found</h2><p>Try a different search term or clear one of the filters.</p></div>}
  </main>;
}

function GuideSection({ title, guides }: { title: string; guides: Guide[] }) {
  return <section aria-labelledby={title.replaceAll(' ', '-').toLowerCase()}><div className="section-heading"><h2 id={title.replaceAll(' ', '-').toLowerCase()}>{title}</h2><span className="count">{guides.length} {guides.length === 1 ? 'guide' : 'guides'}</span></div><div className="grid">{guides.map((guide) => <article className="card" key={guide.slug}><div className="category">{guide.category}</div><h3>{guide.title}</h3><p>{guide.description}</p><div className="meta"><span>{guide.estimatedTime}</span><span>Updated {guide.lastVerified}</span></div><div className="tags" aria-label={\`Tags for \${guide.title}\`}>{guide.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></article>)}</div></section>;
}
`;
}
