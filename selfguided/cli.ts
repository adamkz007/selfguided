#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { runApprovedBrowserJourney } from './browser/navigator';
import { evaluateRunSafety, loadApprovedPlan } from './browser/safety-guards';
import { discoverApplication } from './discovery';
import { generateReviewArtifacts, writeReviewArtifacts } from './reports/product-understanding';
import { createOwnerAlignmentCheckpoint } from './owner-alignment/questions';
import { validateOwnerAlignmentResult, type OwnerAlignmentResult } from './owner-alignment/schema';
import { writeApprovedGuidePlan } from './owner-alignment/approved-plan';
import { readGuideDirectory } from './guides/content';
import { generateGuidesRoute } from './guides/next-app-router';
import { writeGuideSearchIndex } from './guides/search-index';
import { recordGuideDecision, publishApprovedGuides, stageGuide, writeGuideReview } from './review/guide-review';
import { validateGuides } from './validation';
import { markGuidesStale, writeGuideVerification } from './verification/staleness';
import type { BrowserTrace } from './browser/trace-schema';
import type { GuideGenerationOptions } from './guides/generate-guide';

const [command = 'help', ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
const root = resolve(String(args.root ?? process.cwd()));

try {
  switch (command) {
    case 'discover': discover(); break;
    case 'plan': plan(); break;
    case 'align': align(); break;
    case 'navigate': navigatePreflight(); break;
    case 'draft': draft(); break;
    case 'review': review(); break;
    case 'publish': publish(); break;
    case 'index': index(); break;
    case 'routes': routes(); break;
    case 'validate': validate(); break;
    case 'refresh': refresh(); break;
    case 'help': default: help(); break;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function discover(): void {
  const appMap = discoverApplication({ root });
  const artifacts = writeReviewArtifacts(appMap);
  print({ root, routes: appMap.routes.length, appMap: '.selfguided/app-map.json', report: '.selfguided/product-understanding.md', candidates: '.selfguided/guide-candidates.json', generatedAt: artifacts.appMapJson.generatedAt });
}

function plan(): void {
  const appMap = discoverApplication({ root });
  const artifacts = writeReviewArtifacts(appMap);
  const checkpoint = createOwnerAlignmentCheckpoint({ routeCount: appMap.routes.length, navigationSourceCount: Object.values(appMap.navigation).flat().length, helpContentCount: appMap.docs.helpCenterContent.length });
  print({ report: artifacts.productUnderstandingMarkdown, ownerAlignment: checkpoint });
}

function align(): void {
  const file = required('--file');
  const result = readJson<OwnerAlignmentResult>(file);
  const issues = validateOwnerAlignmentResult(result);
  if (issues.length) throw new Error(`Owner alignment is invalid: ${issues.map((issue) => issue.message).join(' ')}`);
  const output = writeApprovedGuidePlan(root, result);
  print({ alignment: relativeToRoot(output.alignmentJsonPath), plan: relativeToRoot(output.approvedPlanPath) });
}

function navigatePreflight(): void {
  const appUrl = required('--url'); const journeySlug = required('--journey');
  const block = evaluateRunSafety({ root, appUrl, journeySlug, allowProduction: args['allow-production'] === true, allowDestructiveActions: args['allow-destructive'] === true });
  if (block) throw new Error(`${block.reason}: ${block.message}`);
  // The Codex browser adapter supplies the launcher at runtime; this CLI never creates a browser session itself.
  void runApprovedBrowserJourney;
  print({ ready: true, message: 'Preflight passed. Use the SelfGuided browser workflow with an owner-approved browser adapter to run this journey.' });
}

function draft(): void {
  assertGuideWritesApproved();
  const trace = readJson<BrowserTrace>(required('--trace'));
  const options = readJson<GuideGenerationOptions>(required('--options'));
  const staged = stageGuide(root, trace, options);
  const reviewResult = writeGuideReview(root, [staged.entry]);
  print({ draft: relativeToRoot(staged.draftPath), review: relativeToRoot(reviewResult.reviewPath), approvals: relativeToRoot(reviewResult.approvalPath) });
}

function review(): void {
  const guide = required('--guide'); const decision = required('--decision') as 'approved' | 'edited' | 'rejected' | 'reprioritized'; const by = required('--by');
  const artifact = recordGuideDecision(root, guide, decision, by, stringArg('notes'), numberArg('priority'));
  print({ guide, decision: artifact.approvals[guide] });
}

function publish(): void {
  const result = publishApprovedGuides(root, stringArg('content-dir') ?? 'guides');
  const indexPath = writeGuideSearchIndex(root, stringArg('content-dir') ?? 'guides');
  const appMap = discoverApplication({ root });
  for (const guide of readGuideDirectory(root, stringArg('content-dir') ?? 'guides')) {
    const sourcePaths = appMap.routes.filter((route) => route.path === guide.frontmatter.sourceRoute).map((route) => route.source.path);
    writeGuideVerification(root, { schemaVersion: 1, slug: guide.slug, lastVerified: guide.frontmatter.lastVerified, sourceRoutes: [guide.frontmatter.sourceRoute], sourcePaths, assumptions: [], status: 'published' });
  }
  print({ ...result, searchIndex: relativeToRoot(indexPath) });
}

function index(): void { print({ searchIndex: relativeToRoot(writeGuideSearchIndex(root, stringArg('content-dir') ?? 'guides')) }); }

function routes(): void {
  assertGuideWritesApproved();
  const guides = readGuideDirectory(root, stringArg('content-dir') ?? 'guides').map((guide) => ({ ...guide.frontmatter, slug: guide.slug, body: guide.body }));
  const result = generateGuidesRoute(root, guides, discoverApplication({ root }), { overwrite: args.overwrite === true });
  print({ page: relativeToRoot(result.pagePath), detailPage: relativeToRoot(result.detailPagePath) });
}

function validate(): void {
  const result = validateGuides(root, stringArg('content-dir') ?? 'guides');
  print(result);
  if (!result.valid) process.exitCode = 1;
}

function refresh(): void {
  const changed = stringsArg('changed').length ? stringsArg('changed') : changedSince(required('--from'));
  const stale = markGuidesStale(root, changed);
  print({ changed, stale: stale.map((guide) => guide.slug) });
}

function assertGuideWritesApproved(): void {
  const planPath = join(root, '.selfguided', 'approved-guide-plan.md');
  if (!existsSync(planPath) || !/Generated \/guides files may be written:\s*Yes/i.test(readFileSync(planPath, 'utf8'))) throw new Error('Owner approval to write generated /guides files is required. Complete the align phase first.');
}

function changedSince(reference: string): string[] { return execFileSync('git', ['diff', '--name-only', reference], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean); }
function readJson<T>(path: string): T { return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T; }
function relativeToRoot(path: string): string { return path.startsWith(root) ? path.slice(root.length + 1) : path; }
function required(flag: string): string { const value = args[flag.slice(2)]; if (typeof value !== 'string' || !value) throw new Error(`${flag} is required.`); return value; }
function stringArg(name: string): string | undefined { const value = args[name]; return typeof value === 'string' ? value : undefined; }
function numberArg(name: string): number | undefined { const value = stringArg(name); return value === undefined ? undefined : Number(value); }
function stringsArg(name: string): string[] { const value = args[name]; return Array.isArray(value) ? value : typeof value === 'string' ? [value] : []; }
function print(value: unknown): void { console.log(JSON.stringify(value, null, 2)); }
function parseArgs(values: string[]): Record<string, string | true | string[]> { const output: Record<string, string | true | string[]> = {}; for (let index = 0; index < values.length; index += 1) { const value = values[index]; if (!value.startsWith('--')) continue; const key = value.slice(2); const next = values[index + 1]; const entry: string | true = next && !next.startsWith('--') ? (index += 1, next) : true; const existing = output[key]; output[key] = existing === undefined ? entry : Array.isArray(existing) ? [...existing, String(entry)] : [String(existing), String(entry)]; } return output; }
function help(): void { console.log(`SelfGuided commands:\n  discover | plan | align --file alignment.json | navigate --url URL --journey slug\n  draft --trace trace.json --options guide-options.json | review --guide ID --decision approved --by owner\n  publish | index | routes [--overwrite] | validate | refresh --changed path [--changed path] | refresh --from REF\nAll commands accept --root PATH.`); }
