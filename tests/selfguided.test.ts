import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import {
  buildRedactionPlan,
  buildGuideSearchIndex,
  discoverApplication,
  evaluateRunSafety,
  findStaleGuides,
  generateGuidesRoute,
  generateProductUnderstandingReport,
  markGuidesStale,
  processScreenshot,
  redactSensitiveText,
  recordGuideDecision,
  runApprovedBrowserJourney,
  stageGuide,
  validateGuides,
  writeApprovedGuidePlan,
  writeGuideReview,
  writeGuideSearchIndex,
  writeGuideVerification,
  publishApprovedGuides,
  type BrowserTrace,
} from '../selfguided';
import type { OwnerAlignmentResult } from '../selfguided/owner-alignment/schema';
import type { BrowserLauncherAdapter } from '../selfguided/browser/session';

function fixture(): string { return mkdtempSync(join(tmpdir(), 'selfguided-')); }
function write(root: string, path: string, content: string): void { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), content); }
function approval(): OwnerAlignmentResult { return { approvedTargetAudiences: ['end-user'], approvedKeyGoals: ['onboarding'], excludedRoutesOrWorkflows: [], browserNavigationApproved: true, screenshotsApproved: true, authenticatedTestCredentialsAvailable: false, guidesFilesMayBeWritten: true, destructiveActionsApproved: false, productionNavigationApproved: false, approvedBy: 'owner' }; }

test('discovers an App Router product and produces source-derived guide candidates', () => {
  const root = fixture();
  write(root, 'package.json', JSON.stringify({ dependencies: { next: '15.0.0', react: '19.0.0' } }));
  write(root, 'app/page.tsx', 'export default function Page() { return <main>Welcome</main>; }');
  write(root, 'app/settings/team/page.tsx', 'export default function Page() { return <button>Invite teammate</button>; }');
  write(root, 'app/login/page.tsx', 'export default function Page() { return <form>Sign in</form>; }');
  write(root, 'components/Sidebar.tsx', 'export const Sidebar = () => <nav>Settings</nav>;');
  write(root, 'styles/theme.css', ':root { --brand: blue; }');
  const map = discoverApplication({ root, generatedAt: '2026-07-24T00:00:00.000Z' });
  const report = generateProductUnderstandingReport(map);
  assert.equal(map.framework.frameworks[0].name, 'Next.js');
  assert.ok(map.routes.some((route) => route.path === '/settings/team'));
  assert.ok(map.routes.some((route) => route.kind === 'auth'));
  assert.equal(map.navigation.sidebars.length, 1);
  assert.ok(report.guideWorthyRoutes.some((route) => route.path === '/settings/team'));
});

test('blocks browser navigation without owner approval and permits an approved local journey', () => {
  const root = fixture();
  assert.equal(evaluateRunSafety({ root, appUrl: 'http://localhost:3000', journeySlug: 'welcome' })?.reason, 'missing-approval');
  writeApprovedGuidePlan(root, approval());
  write(root, '.selfguided/approved-guide-plan.md', `${readFileSync(join(root, '.selfguided/approved-guide-plan.md'), 'utf8')}\n## Approved user journeys\n\n### Welcome\n\n- Open /\n`);
  assert.equal(evaluateRunSafety({ root, appUrl: 'http://localhost:3000', journeySlug: 'welcome' }), undefined);
  assert.equal(evaluateRunSafety({ root, appUrl: 'https://app.example.com', journeySlug: 'welcome' })?.reason, 'production-risk');
});

test('redacts dynamic observations and omits screenshots when the page contains sensitive text', async () => {
  const root = fixture(); writeApprovedGuidePlan(root, approval());
  write(root, '.selfguided/approved-guide-plan.md', `${readFileSync(join(root, '.selfguided/approved-guide-plan.md'), 'utf8')}\n## Approved user journeys\n\n### Welcome\n\n- Open /\n`);
  let screenshots = 0; let url = 'http://localhost:3000';
  const page = {
    goto: async (next: string) => { url = next; }, title: async () => 'owner@example.com', url: () => url,
    screenshot: async () => { screenshots += 1; },
    locator: (selector: string) => ({ allTextContents: async () => selector === 'body' || selector.startsWith('h1') ? ['owner@example.com'] : [], evaluateAll: async () => [] }),
  };
  const launcher = { newContext: async () => ({ newPage: async () => page, close: async () => undefined }) };
  const result = await runApprovedBrowserJourney({ root, appUrl: 'http://localhost:3000', journeySlug: 'welcome', launcher: launcher as BrowserLauncherAdapter });
  assert.equal(result.trace.status, 'completed');
  assert.equal(screenshots, 0);
  assert.equal(result.trace.steps[0].observation?.title, '[REDACTED]');
  assert.equal(result.trace.steps[0].observation?.headings[0].text, '[REDACTED]');
});

test('redaction and screenshot processing preserve review status and flag sensitive text', async () => {
  const root = fixture();
  const source = join(root, 'source.png'); writeFileSync(source, 'not-a-real-png');
  const plan = buildRedactionPlan([{ text: 'owner@example.com', x: 1, y: 2, width: 3, height: 4 }]);
  assert.equal(plan.regions[0].reason, 'email address');
  assert.equal(redactSensitiveText('Email owner@example.com'), 'Email [REDACTED]');
  const result = await processScreenshot({ sourcePath: source, outputDirectory: join(root, 'out'), guideSlug: 'invite teammate', stepIndex: 1, stepSlug: 'team page', textObservations: [{ text: 'owner@example.com', x: 1, y: 2, width: 3, height: 4 }], altText: { guideTitle: 'Invite teammate', stepTitle: 'Open team page' } });
  assert.equal(result.normalizedFilename, 'invite-teammate-step-01-team-page.png');
  assert.equal(result.status, 'needs-redaction');
  assert.match(result.altText, /Sensitive information is redacted/);
});

test('runs the guide lifecycle from draft through approved publication, search, validation, and staleness', () => {
  const root = fixture();
  writeApprovedGuidePlan(root, approval());
  write(root, 'app/settings/team/page.tsx', 'export default function Team() { return <main>Team</main>; }');
  const screenshot = join(root, 'run.png'); writeFileSync(screenshot, 'screenshot');
  const trace: BrowserTrace = { schemaVersion: 1, runId: 'run-1', journeySlug: 'invite-teammate', appUrl: 'http://localhost:3000/settings/team', approvedPlanPath: '.selfguided/approved-guide-plan.md', startedAt: '2026-07-24T10:00:00.000Z', completedAt: '2026-07-24T10:02:00.000Z', status: 'completed', steps: [{ index: 0, journeySlug: 'invite-teammate', action: 'open team settings', createdAt: '2026-07-24T10:00:00.000Z', observation: { url: 'http://localhost:3000/settings/team', title: 'Team settings', headings: [{ text: 'Team' }], buttons: [{ text: 'Invite teammate' }], links: [], formFields: [], states: [], screenshotPath: screenshot, capturedAt: '2026-07-24T10:00:00.000Z' } }] };
  const staged = stageGuide(root, trace, { audience: ['team-admin'], category: 'Team management', tags: ['team'], relatedGuides: [] });
  writeGuideReview(root, [staged.entry], '2026-07-24T10:03:00.000Z');
  recordGuideDecision(root, 'run-1', 'approved', 'owner', 'Looks good.', 1, '2026-07-24T10:04:00.000Z');
  const published = publishApprovedGuides(root);
  assert.deepEqual(published.published, ['guides/invite-teammate.mdx']);
  assert.ok(readFileSync(join(root, 'guides', 'invite-teammate.mdx'), 'utf8').includes('/guides/assets/invite-teammate-run.png'));
  writeGuideSearchIndex(root);
  assert.equal(validateGuides(root).valid, true);
  assert.equal(buildGuideSearchIndex(root)[0].slug, 'invite-teammate');
  writeGuideVerification(root, { schemaVersion: 1, slug: 'invite-teammate', lastVerified: '2026-07-24', sourceRoutes: ['/settings/team'], sourcePaths: ['app/settings/team/page.tsx'], assumptions: [], status: 'published' });
  assert.deepEqual(findStaleGuides(root, ['app/settings/team/page.tsx']).map((record) => record.slug), ['invite-teammate']);
  assert.equal(markGuidesStale(root, ['app/settings/team/page.tsx'])[0].status, 'stale');
});

test('generates searchable Next App Router index and guide detail pages without overwriting by default', () => {
  const root = fixture();
  write(root, 'package.json', JSON.stringify({ dependencies: { next: '15.0.0' } }));
  write(root, 'app/page.tsx', 'export default function Page() { return null; }');
  const guide = { slug: 'welcome', title: 'Welcome', description: 'Start here.', audience: ['end-user'], category: 'Getting started', tags: ['start'], estimatedTime: '1 minute', sourceRoute: '/', lastVerified: '2026-07-24', screenshots: [], sourceJourneyTrace: 'run-1', prerequisites: [], expectedResults: ['Ready'], relatedGuides: [], body: '## Steps\n\n1. **Open** — Open the app.' };
  const generated = generateGuidesRoute(root, [guide]);
  assert.match(readFileSync(generated.pagePath, 'utf8'), /href=\{`\/guides\/\$\{guide.slug\}`\}/);
  const detail = readFileSync(generated.detailPagePath, 'utf8');
  assert.match(detail, /generateStaticParams/);
  assert.match(detail, /<figure/);
  for (const source of [readFileSync(generated.pagePath, 'utf8'), detail]) {
    const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
    assert.deepEqual(output.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error), []);
  }
  assert.throws(() => generateGuidesRoute(root, [guide]), /already exists/);
});

test('CLI discovery writes the expected review artifacts', () => {
  const root = fixture();
  write(root, 'app/page.tsx', 'export default function Page() { return null; }');
  execFileSync(process.execPath, [join(process.cwd(), 'dist', 'selfguided', 'cli.js'), 'discover', '--root', root], { encoding: 'utf8' });
  assert.ok(readFileSync(join(root, '.selfguided', 'app-map.json'), 'utf8').includes('routes'));
});
