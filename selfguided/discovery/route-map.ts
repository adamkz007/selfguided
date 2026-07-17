import { statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { NavigationMap, RouteEntry, SourceRef } from './output-schema';
import { readText, walkFiles } from './utils';

const routeFiles = new Set(['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'route.ts', 'route.js', 'index.tsx', 'index.jsx']);
const ignoredSegments = new Set(['node_modules', '.git', '.next', 'dist', 'build']);

function normalizeRoute(file: string): string {
  const parts = file.split(/[\\/]/).filter(Boolean);
  const clean = parts.filter((part) => !part.startsWith('(') && !part.startsWith('@'));
  const last = clean[clean.length - 1];
  if (last && routeFiles.has(last)) clean.pop();
  if (clean[0] === 'app' || clean[0] === 'pages') clean.shift();
  if (clean[0] === 'src' && clean[1] === 'routes') clean.splice(0, 2);
  const route = '/' + clean.map((part) => part.replace(/\.[tj]sx?$/, '').replace(/^\[(.+)\]$/, ':$1')).filter((part) => part !== 'index').join('/');
  return route === '/' ? '/' : route.replace(/\/+/g, '/');
}

function classify(path: string, content: string): RouteEntry['kind'] {
  if (/\/api(\/|$)/.test(path)) return 'api';
  if (/\/(login|signin|sign-in)(\/|$)/i.test(path)) return 'auth';
  if (/\/(admin)(\/|$)/i.test(path) || /adminOnly|requireAdmin|isAdmin/i.test(content)) return 'admin';
  if (/\/(dashboard|app|account|settings|billing)(\/|$)/i.test(path)) return 'dashboard';
  if (/requireAuth|withAuth|auth\(|middleware|ProtectedRoute/i.test(content)) return 'protected';
  if (/\/(pricing|about|blog|features|contact)(\/|$)/i.test(path)) return 'marketing';
  return 'app';
}

export function buildRouteMap(root: string): RouteEntry[] {
  return walkFiles(root, (file) => {
    if (file.split(sep).some((part) => ignoredSegments.has(part))) return false;
    const base = file.split(/[\\/]/).pop() ?? '';
    return routeFiles.has(base) || /routes[\\/].+\.(tsx?|jsx?|rb|php|py)$/.test(file);
  }).map((absolute) => {
    const path = relative(root, absolute);
    const content = readText(absolute);
    const route = normalizeRoute(path);
    return { path: route, kind: classify(route, content), source: { path, kind: statSync(absolute).isFile() ? 'route-file' : 'route' } };
  });
}

export function findNavigationSources(root: string): NavigationMap {
  const sources = walkFiles(root, (file) => /\.(tsx?|jsx?|vue|svelte|rb|php)$/.test(file));
  const buckets: NavigationMap = { sidebars: [], headers: [], navComponents: [], routeConstants: [], breadcrumbs: [] };
  for (const absolute of sources) {
    const path = relative(root, absolute);
    const content = readText(absolute);
    const ref: SourceRef = { path };
    if (/sidebar/i.test(path) || /<Sidebar|function Sidebar|const Sidebar/.test(content)) buckets.sidebars.push(ref);
    if (/header|navbar/i.test(path) || /<Header|function Header|const Header|<Navbar/i.test(content)) buckets.headers.push(ref);
    if (/nav(igation)?/i.test(path) || /routes\s*=|NAV_ITEMS|navigationItems/i.test(content)) buckets.navComponents.push(ref);
    if (/ROUTES|routePaths|paths\s*=|as const.*\//s.test(content)) buckets.routeConstants.push(ref);
    if (/breadcrumb/i.test(path) || /breadcrumbs?/i.test(content)) buckets.breadcrumbs.push(ref);
  }
  return buckets;
}
