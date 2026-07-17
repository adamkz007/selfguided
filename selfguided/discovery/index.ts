import { relative } from 'node:path';
import type { ApplicationMap, Detection, DocsMap, DomainMap } from './output-schema';
import { buildAuthMap } from './auth-map';
import { detectFramework } from './framework-detectors';
import { buildRouteMap, findNavigationSources } from './route-map';
import { buildThemeMap } from './theme-map';
import { readText, walkFiles } from './utils';

export interface DiscoveryOptions {
  root?: string;
  generatedAt?: string;
}

export function discoverApplication(options: DiscoveryOptions = {}): ApplicationMap {
  const root = options.root ?? process.cwd();
  const routes = buildRouteMap(root);
  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    root,
    framework: detectFramework(root),
    routes,
    navigation: findNavigationSources(root),
    domain: buildDomainMap(root),
    auth: buildAuthMap(root, routes),
    theme: buildThemeMap(root),
    docs: buildDocsMap(root),
  };
}

export function buildDomainMap(root: string): DomainMap {
  const databaseModels: Detection[] = [];
  const apiRoutes = [];
  const graphqlSchemas = [];
  const trpcRouters = [];
  const serverActions = [];
  const serviceObjects = [];

  for (const absolute of walkFiles(root)) {
    const path = relative(root, absolute);
    const content = readText(absolute);
    if (/\.(prisma)$/.test(path) || /models?[\\/].+\.(rb|py|ts|php)$/.test(path) || /class .* extends Model/.test(content)) {
      databaseModels.push({ name: path, confidence: 'medium', sources: [{ path, kind: 'database-model' }] });
    }
    if (/api[\\/].+\.(tsx?|jsx?|rb|php|py)$/.test(path) || /route\.(ts|js)$/.test(path)) apiRoutes.push({ path, kind: 'api-route' });
    if (/\.(graphql|gql)$/.test(path) || /typeDefs|GraphQLSchema/.test(content)) graphqlSchemas.push({ path, kind: 'graphql-schema' });
    if (/trpc|createTRPCRouter|router\(/i.test(content)) trpcRouters.push({ path, kind: 'trpc-router' });
    if (/['"]use server['"]|export async function .*Action/.test(content)) serverActions.push({ path, kind: 'server-action' });
    if (/services?[\\/].+\.(tsx?|jsx?|rb|php|py)$/.test(path) || /class .*Service/.test(content)) serviceObjects.push({ path, kind: 'service-object' });
  }
  return { databaseModels, apiRoutes, graphqlSchemas, trpcRouters, serverActions, serviceObjects };
}

export function buildDocsMap(root: string): DocsMap {
  const markdownFiles = [];
  const helpCenterContent = [];
  const tooltips: Detection[] = [];
  const emptyStates: Detection[] = [];
  const onboardingCopy: Detection[] = [];

  for (const absolute of walkFiles(root)) {
    const path = relative(root, absolute);
    const content = readText(absolute);
    if (/\.mdx?$/.test(path)) markdownFiles.push({ path, kind: 'markdown' });
    if (/help|docs|guide|faq|support/i.test(path)) helpCenterContent.push({ path, kind: 'help-content' });
    if (/tooltip|title=|aria-label=/i.test(content)) tooltips.push({ name: 'Tooltip or inline hint', confidence: 'low', sources: [{ path }] });
    if (/empty state|No .* yet|Nothing here|Get started/i.test(content)) emptyStates.push({ name: 'Empty state copy', confidence: 'low', sources: [{ path }] });
    if (/onboarding|welcome|first project|setup/i.test(content)) onboardingCopy.push({ name: 'Onboarding copy', confidence: 'low', sources: [{ path }] });
  }
  return { markdownFiles, helpCenterContent, tooltips, emptyStates, onboardingCopy };
}

export * from './output-schema';

export { generateProductUnderstandingReport, generateReviewArtifacts, writeReviewArtifacts } from '../reports/product-understanding';
