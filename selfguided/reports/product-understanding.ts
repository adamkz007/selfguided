import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApplicationMap, Confidence, Detection, RouteEntry, SourceRef } from '../discovery/output-schema';

export interface ProductUnderstandingReport {
  generatedAt: string;
  productSummary: EvidenceSection;
  primaryUserRolesAndPermissions: EvidenceItem[];
  keyAppAreas: EvidenceItem[];
  importantEntitiesAndWorkflows: EvidenceItem[];
  candidateUserJourneys: GuideCandidate[];
  guideWorthyRoutes: GuideRoute[];
  unknownsRequiringOwnerClarification: string[];
  risksOrAssumptions: string[];
  recommendedGuideBacklog: GuideBacklogItem[];
}

export interface EvidenceSection {
  summary: string;
  confidence: Confidence;
  evidence: SourceRef[];
}

export interface EvidenceItem {
  name: string;
  description: string;
  confidence: Confidence;
  evidence: SourceRef[];
}

export interface GuideCandidate extends EvidenceItem {
  audience: string[];
  entryRoutes: string[];
  prerequisites: string[];
}

export interface GuideRoute {
  path: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  evidence: SourceRef[];
}

export interface GuideBacklogItem {
  title: string;
  priority: 'low' | 'medium' | 'high';
  routePaths: string[];
  audience: string[];
  rationale: string;
  evidence: SourceRef[];
}

export interface ReviewArtifacts {
  appMapJson: ApplicationMap;
  productUnderstandingMarkdown: string;
  guideCandidatesJson: {
    generatedAt: string;
    candidateUserJourneys: GuideCandidate[];
    guideWorthyRoutes: GuideRoute[];
    recommendedGuideBacklog: GuideBacklogItem[];
    unknownsRequiringOwnerClarification: string[];
    risksOrAssumptions: string[];
  };
}

export function generateProductUnderstandingReport(appMap: ApplicationMap): ProductUnderstandingReport {
  const appAreas = deriveKeyAppAreas(appMap.routes);
  const roles = deriveRoles(appMap);
  const entities = deriveEntitiesAndWorkflows(appMap);
  const guideWorthyRoutes = deriveGuideWorthyRoutes(appMap.routes);
  const journeys = deriveCandidateJourneys(appMap, appAreas, entities, guideWorthyRoutes);
  const backlog = deriveGuideBacklog(journeys, guideWorthyRoutes);

  return {
    generatedAt: appMap.generatedAt,
    productSummary: deriveProductSummary(appMap, appAreas, entities),
    primaryUserRolesAndPermissions: roles,
    keyAppAreas: appAreas,
    importantEntitiesAndWorkflows: entities,
    candidateUserJourneys: journeys,
    guideWorthyRoutes,
    unknownsRequiringOwnerClarification: deriveUnknowns(appMap, roles, journeys),
    risksOrAssumptions: deriveRisks(appMap),
    recommendedGuideBacklog: backlog,
  };
}

export function generateReviewArtifacts(appMap: ApplicationMap): ReviewArtifacts {
  const report = generateProductUnderstandingReport(appMap);
  return {
    appMapJson: appMap,
    productUnderstandingMarkdown: renderProductUnderstandingMarkdown(report),
    guideCandidatesJson: {
      generatedAt: report.generatedAt,
      candidateUserJourneys: report.candidateUserJourneys,
      guideWorthyRoutes: report.guideWorthyRoutes,
      recommendedGuideBacklog: report.recommendedGuideBacklog,
      unknownsRequiringOwnerClarification: report.unknownsRequiringOwnerClarification,
      risksOrAssumptions: report.risksOrAssumptions,
    },
  };
}

export function writeReviewArtifacts(appMap: ApplicationMap, outputDir = join(appMap.root, '.selfguided')): ReviewArtifacts {
  const artifacts = generateReviewArtifacts(appMap);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'app-map.json'), stableJson(artifacts.appMapJson));
  writeFileSync(join(outputDir, 'product-understanding.md'), artifacts.productUnderstandingMarkdown);
  writeFileSync(join(outputDir, 'guide-candidates.json'), stableJson(artifacts.guideCandidatesJson));
  return artifacts;
}

export function renderProductUnderstandingMarkdown(report: ProductUnderstandingReport): string {
  return `${title('Product Understanding Report')}

Generated at: ${report.generatedAt}

## Product summary

${report.productSummary.summary}

Confidence: ${report.productSummary.confidence}  
Evidence: ${formatEvidence(report.productSummary.evidence)}

${section('Primary user roles and permissions', report.primaryUserRolesAndPermissions)}
${section('Key app areas', report.keyAppAreas)}
${section('Important entities and workflows', report.importantEntitiesAndWorkflows)}
${journeySection(report.candidateUserJourneys)}
${routeSection(report.guideWorthyRoutes)}
${listSection('Unknowns requiring owner clarification', report.unknownsRequiringOwnerClarification)}
${listSection('Risks or assumptions', report.risksOrAssumptions)}
${backlogSection(report.recommendedGuideBacklog)}
`;
}

function deriveProductSummary(appMap: ApplicationMap, areas: EvidenceItem[], entities: EvidenceItem[]): EvidenceSection {
  const frameworks = appMap.framework.frameworks.map((framework) => framework.name).join(', ') || 'an unidentified web framework';
  const areaNames = areas.slice(0, 4).map((area) => area.name.toLowerCase()).join(', ') || 'application routes';
  const entityNames = entities.slice(0, 3).map((entity) => entity.name.toLowerCase()).join(', ') || 'domain services';
  const evidence = uniqueRefs([...appMap.framework.configFiles, ...areas.flatMap((area) => area.evidence), ...entities.flatMap((entity) => entity.evidence)]).slice(0, 8);
  return {
    summary: `This appears to be a ${frameworks} product with prominent ${areaNames}. The codebase suggests the product centers on ${entityNames}, but this should be reviewed by the owner before guide content is generated.`,
    confidence: evidence.length > 2 ? 'medium' : 'low',
    evidence,
  };
}

function deriveRoles(appMap: ApplicationMap): EvidenceItem[] {
  const roles: EvidenceItem[] = [];
  if (appMap.auth.loginPaths.length || appMap.auth.sessionProviders.length) {
    roles.push({ name: 'Authenticated user', description: 'Can access signed-in areas protected by session checks.', confidence: 'medium', evidence: uniqueRefs([...appMap.auth.loginPaths.map((route) => route.source), ...sources(appMap.auth.sessionProviders)]) });
  }
  if (appMap.auth.signupPaths.length) {
    roles.push({ name: 'New or invited user', description: 'Can enter the product through signup or registration routes.', confidence: 'medium', evidence: appMap.auth.signupPaths.map((route) => route.source) });
  }
  if (appMap.routes.some((route) => route.kind === 'admin') || appMap.auth.roleChecks.length || appMap.auth.permissionGates.length) {
    roles.push({ name: 'Administrator or privileged user', description: 'Likely has elevated access controlled by role or permission checks.', confidence: 'medium', evidence: uniqueRefs([...appMap.routes.filter((route) => route.kind === 'admin').map((route) => route.source), ...sources(appMap.auth.roleChecks), ...sources(appMap.auth.permissionGates)]) });
  }
  if (!roles.length) roles.push({ name: 'Visitor', description: 'No explicit authentication model was detected; owner should confirm audiences and permissions.', confidence: 'low', evidence: appMap.routes.slice(0, 5).map((route) => route.source) });
  return roles;
}

function deriveKeyAppAreas(routes: RouteEntry[]): EvidenceItem[] {
  const groups = new Map<string, RouteEntry[]>();
  for (const route of routes) {
    const firstSegment = route.path.split('/').filter(Boolean)[0] ?? 'home';
    const key = route.kind === 'api' ? 'API' : humanize(firstSegment);
    groups.set(key, [...(groups.get(key) ?? []), route]);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([name, group]) => ({
    name,
    description: `${group.length} route${group.length === 1 ? '' : 's'} detected under this area: ${group.slice(0, 5).map((route) => route.path).join(', ')}${group.length > 5 ? ', …' : ''}.`,
    confidence: 'medium' as const,
    evidence: group.slice(0, 8).map((route) => route.source),
  }));
}

function deriveEntitiesAndWorkflows(appMap: ApplicationMap): EvidenceItem[] {
  const items = [...appMap.domain.databaseModels, ...detectionsFromRefs('API route', appMap.domain.apiRoutes), ...detectionsFromRefs('Server action', appMap.domain.serverActions), ...detectionsFromRefs('Service object', appMap.domain.serviceObjects)];
  return items.slice(0, 30).map((item) => ({ name: humanize(lastPathPart(item.name)), description: `Detected ${item.sources[0]?.kind ?? 'domain'} source that may represent a product entity or workflow.`, confidence: item.confidence, evidence: item.sources }));
}

function deriveGuideWorthyRoutes(routes: RouteEntry[]): GuideRoute[] {
  return routes.filter((route) => route.kind !== 'api').map((route) => {
    const priority: GuideRoute['priority'] = route.kind === 'dashboard' || route.kind === 'admin' || route.kind === 'protected' ? 'high' : route.kind === 'auth' ? 'medium' : 'low';
    return { path: route.path, reason: `${humanize(route.kind)} route likely represents a screen users may need to understand.`, priority, evidence: [route.source] };
  }).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.path.localeCompare(b.path));
}

function deriveCandidateJourneys(appMap: ApplicationMap, areas: EvidenceItem[], entities: EvidenceItem[], routes: GuideRoute[]): GuideCandidate[] {
  const journeys: GuideCandidate[] = [];
  if (appMap.auth.signupPaths.length) journeys.push(journey('Create an account', 'Sign up and reach the first useful product screen.', ['New or invited user'], appMap.auth.signupPaths.map((route) => route.path), appMap.auth.signupPaths.map((route) => route.source)));
  if (appMap.auth.loginPaths.length) journeys.push(journey('Sign in and resume work', 'Authenticate and return to the main app experience.', ['Authenticated user'], appMap.auth.loginPaths.map((route) => route.path), appMap.auth.loginPaths.map((route) => route.source)));
  for (const area of areas.filter((area) => area.name !== 'API').slice(0, 6)) journeys.push(journey(`Use the ${area.name} area`, `Learn the purpose, entry points, and expected outcomes for ${area.name}.`, ['Authenticated user'], routes.filter((route) => route.path.toLowerCase().includes(area.name.toLowerCase())).map((route) => route.path).slice(0, 5), area.evidence));
  for (const entity of entities.slice(0, 5)) journeys.push(journey(`Manage ${entity.name}`, `Understand the workflow around ${entity.name}.`, ['Authenticated user'], [], entity.evidence));
  return journeys;
}

function deriveGuideBacklog(journeys: GuideCandidate[], routes: GuideRoute[]): GuideBacklogItem[] {
  const routeBacklog = routes.slice(0, 8).map((route) => ({ title: `Guide: ${route.path}`, priority: route.priority, routePaths: [route.path], audience: ['Authenticated user'], rationale: route.reason, evidence: route.evidence }));
  const journeyBacklog = journeys.slice(0, 8).map((item) => ({ title: item.name, priority: item.confidence === 'low' ? 'low' as const : 'medium' as const, routePaths: item.entryRoutes, audience: item.audience, rationale: item.description, evidence: item.evidence }));
  return [...routeBacklog, ...journeyBacklog].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.title.localeCompare(b.title));
}

function deriveUnknowns(appMap: ApplicationMap, roles: EvidenceItem[], journeys: GuideCandidate[]): string[] {
  const unknowns = ['Owner-approved product positioning, target customer segments, and terminology.', 'Which candidate journeys are highest priority for the first guide backlog.'];
  if (!appMap.auth.roleChecks.length && !appMap.auth.permissionGates.length) unknowns.push('Exact roles and permission boundaries were not explicit in static analysis.');
  if (!journeys.length) unknowns.push('No obvious end-to-end journeys were detectable from routes alone.');
  if (roles.some((role) => role.confidence === 'low')) unknowns.push('Primary user roles need owner confirmation.');
  return unknowns;
}

function deriveRisks(appMap: ApplicationMap): string[] {
  const risks = ['This report is source-derived and inferred from static code only; it may miss runtime-only navigation, feature flags, and tenant-specific behavior.', 'Guide-worthy routes are candidates, not approved content plans.'];
  if (appMap.domain.apiRoutes.length) risks.push('API routes may indicate backend workflows that are not visible as user-facing screens.');
  if (appMap.routes.some((route) => /:\w+/.test(route.path))) risks.push('Dynamic routes require realistic test data before screenshot-backed guides can be produced.');
  return risks;
}

function section(titleText: string, items: EvidenceItem[]): string {
  return `## ${titleText}\n\n${items.length ? items.map((item) => `- **${item.name}** (${item.confidence}): ${item.description} Evidence: ${formatEvidence(item.evidence)}`).join('\n') : '- None detected.'}\n`;
}

function journeySection(items: GuideCandidate[]): string {
  return `## Candidate user journeys\n\n${items.length ? items.map((item) => `- **${item.name}** (${item.confidence}): ${item.description} Audience: ${item.audience.join(', ')}. Entry routes: ${item.entryRoutes.join(', ') || 'TBD'}. Evidence: ${formatEvidence(item.evidence)}`).join('\n') : '- None detected.'}\n`;
}

function routeSection(items: GuideRoute[]): string {
  return `## Routes that appear guide-worthy\n\n${items.length ? items.map((item) => `- **${item.path}** (${item.priority}): ${item.reason} Evidence: ${formatEvidence(item.evidence)}`).join('\n') : '- None detected.'}\n`;
}

function backlogSection(items: GuideBacklogItem[]): string {
  return `## Recommended guide backlog\n\n${items.length ? items.map((item) => `- **${item.title}** (${item.priority}): ${item.rationale} Routes: ${item.routePaths.join(', ') || 'TBD'}. Audience: ${item.audience.join(', ')}. Evidence: ${formatEvidence(item.evidence)}`).join('\n') : '- None detected.'}\n`;
}

function listSection(titleText: string, items: string[]): string {
  return `## ${titleText}\n\n${items.map((item) => `- ${item}`).join('\n')}\n`;
}

function journey(name: string, description: string, audience: string[], entryRoutes: string[], evidence: SourceRef[]): GuideCandidate {
  return { name, description, audience, entryRoutes, prerequisites: ['Owner review and approval before generating guide content.'], confidence: evidence.length ? 'medium' : 'low', evidence };
}

function detectionsFromRefs(prefix: string, refs: SourceRef[]): Detection[] {
  return refs.map((ref) => ({ name: `${prefix}: ${ref.path}`, confidence: 'medium' as const, sources: [ref] }));
}

function sources(detections: Detection[]): SourceRef[] {
  return uniqueRefs(detections.flatMap((detection) => detection.sources));
}

function uniqueRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.path}:${ref.line ?? ''}:${ref.kind ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatEvidence(refs: SourceRef[]): string {
  return refs.length ? refs.map((ref) => `\`${ref.path}${ref.line ? `:${ref.line}` : ''}\``).join(', ') : 'No direct source evidence.';
}

function humanize(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function lastPathPart(path: string): string {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path;
}

function priorityRank(priority: GuideRoute['priority']): number {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

function title(value: string): string {
  return `# ${value}`;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(sortForJson(value), null, 2)}\n`;
}

function sortForJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, sortForJson(nested)]));
}
