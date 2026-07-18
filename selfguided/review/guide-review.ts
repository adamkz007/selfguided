import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import type { BrowserTrace } from '../browser/trace-schema';
import { generateGuide, type GeneratedGuide, type GuideGenerationOptions } from '../guides/generate-guide';
import {
  createApprovalArtifact,
  validateGuideApprovalArtifact,
  type GuideApprovalArtifact,
  type GuideDecision,
} from './approval-schema';

export interface GuideReviewEntry {
  guideId: string;
  draftPath: string;
  title: string;
  audience: string[];
  sourceRoute: string;
  screenshotCount: number;
  assumptions: string[];
  knownGaps: string[];
  priority?: number;
}

export interface GuideReviewArtifact {
  schemaVersion: 1;
  generatedAt: string;
  guides: GuideReviewEntry[];
}

export interface GuideReviewContext {
  assumptions?: string[];
  knownGaps?: string[];
  priority?: number;
  fileName?: string;
}

export interface DraftGuideResult {
  guide: GeneratedGuide;
  entry: GuideReviewEntry;
  draftPath: string;
}

export interface PublishResult {
  published: string[];
  skipped: Array<{ guideId: string; decision: GuideDecision }>;
  indexPath: string;
}

export function stageGuide(
  root: string,
  trace: BrowserTrace,
  options: GuideGenerationOptions,
  context: GuideReviewContext = {},
): DraftGuideResult {
  const draftPath = join(root, '.selfguided', 'drafts', 'guides', context.fileName ?? `${slugify(trace.journeySlug)}.mdx`);
  const guide = generateGuide(trace, { ...options, outputPath: draftPath });
  mkdirSync(dirname(draftPath), { recursive: true });
  writeFileSync(draftPath, guide.markdown);
  return {
    guide,
    draftPath,
    entry: {
      guideId: guide.frontmatter.sourceJourneyTrace,
      draftPath: relative(root, draftPath),
      title: guide.frontmatter.title,
      audience: guide.frontmatter.audience,
      sourceRoute: guide.frontmatter.sourceRoute,
      screenshotCount: guide.frontmatter.screenshots.length,
      assumptions: [...(context.assumptions ?? [])],
      knownGaps: [...(context.knownGaps ?? [])],
      priority: context.priority,
    },
  };
}

export function writeGuideReview(
  root: string,
  entries: GuideReviewEntry[],
  generatedAt = new Date().toISOString(),
): { reviewPath: string; approvalPath: string; review: GuideReviewArtifact; approvals: GuideApprovalArtifact } {
  const review: GuideReviewArtifact = { schemaVersion: 1, generatedAt, guides: entries };
  const approvals = createApprovalArtifact(entries.map((entry) => entry.guideId), generatedAt);
  const reviewPath = join(root, '.selfguided', 'reviews', 'guide-review.md');
  const approvalPath = join(root, '.selfguided', 'reviews', 'approval.json');
  mkdirSync(dirname(reviewPath), { recursive: true });
  writeFileSync(reviewPath, renderGuideReview(review));
  writeFileSync(approvalPath, `${JSON.stringify(approvals, null, 2)}\n`);
  return { reviewPath, approvalPath, review, approvals };
}

export function recordGuideDecision(
  root: string,
  guideId: string,
  decision: Exclude<GuideDecision, 'pending'>,
  reviewedBy: string,
  notes?: string,
  priority?: number,
  reviewedAt = new Date().toISOString(),
): GuideApprovalArtifact {
  if (!reviewedBy.trim()) throw new Error('reviewedBy is required to record an owner decision.');
  const approvalPath = join(root, '.selfguided', 'reviews', 'approval.json');
  const approvals = readApprovalArtifact(approvalPath);
  if (!approvals.approvals[guideId]) throw new Error(`Unknown guide ID: ${guideId}.`);
  approvals.approvals[guideId] = { decision, reviewedAt, reviewedBy, notes, priority };
  approvals.updatedAt = reviewedAt;
  writeFileSync(approvalPath, `${JSON.stringify(approvals, null, 2)}\n`);
  return approvals;
}

export function publishApprovedGuides(
  root: string,
  contentDirectory = 'guides',
  publishedIndexPath = join(contentDirectory, 'index.json'),
): PublishResult {
  const review = readReviewArtifact(join(root, '.selfguided', 'reviews', 'guide-review.md'));
  const approvals = readApprovalArtifact(join(root, '.selfguided', 'reviews', 'approval.json'));
  const published: string[] = [];
  const skipped: PublishResult['skipped'] = [];
  const index: Array<Pick<GuideReviewEntry, 'guideId' | 'title' | 'audience' | 'sourceRoute' | 'screenshotCount' | 'priority'>> = [];

  for (const entry of review.guides) {
    const decision = approvals.approvals[entry.guideId]?.decision ?? 'pending';
    if (decision !== 'approved') {
      skipped.push({ guideId: entry.guideId, decision });
      continue;
    }
    const source = join(root, entry.draftPath);
    const destination = join(root, contentDirectory, basename(entry.draftPath));
    if (!existsSync(source)) throw new Error(`Draft guide is missing: ${source}.`);
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(source, destination);
    published.push(relative(root, destination));
    index.push({ guideId: entry.guideId, title: entry.title, audience: entry.audience, sourceRoute: entry.sourceRoute, screenshotCount: entry.screenshotCount, priority: approvals.approvals[entry.guideId].priority ?? entry.priority });
  }

  const indexFile = join(root, publishedIndexPath);
  mkdirSync(dirname(indexFile), { recursive: true });
  writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  return { published, skipped, indexPath: indexFile };
}

export function renderGuideReview(review: GuideReviewArtifact): string {
  const sections = review.guides.map((guide, index) => [
    `## ${index + 1}. ${guide.title}`,
    '',
    `- Guide ID: \`${guide.guideId}\``,
    `- Draft: \`${guide.draftPath}\``,
    `- Audience: ${guide.audience.join(', ') || 'Unspecified'}`,
    `- Covered route/workflow: \`${guide.sourceRoute}\``,
    `- Screenshots: ${guide.screenshotCount}`,
    `- Assumptions: ${formatReviewList(guide.assumptions)}`,
    `- Known gaps: ${formatReviewList(guide.knownGaps)}`,
    '- Owner decision: pending — approve, edit, reject, or reprioritize.',
  ].join('\n')).join('\n\n');
  return `# Generated Guide Review\n\nGenerated: ${review.generatedAt}\n\nReview each draft and record the owner decision in \`.selfguided/reviews/approval.json\`. Only guides marked \`approved\` are published.\n\n${sections || 'No generated guides are awaiting review.'}\n`;
}

function readApprovalArtifact(path: string): GuideApprovalArtifact {
  if (!existsSync(path)) throw new Error(`Approval record is missing: ${path}.`);
  const artifact = JSON.parse(readFileSync(path, 'utf8')) as GuideApprovalArtifact;
  const issues = validateGuideApprovalArtifact(artifact);
  if (issues.length) throw new Error(`Invalid approval record: ${issues.join(' ')}`);
  return artifact;
}

function readReviewArtifact(path: string): GuideReviewArtifact {
  if (!existsSync(path)) throw new Error(`Guide review is missing: ${path}.`);
  const markdown = readFileSync(path, 'utf8');
  const generatedAt = markdown.match(/^Generated: (.+)$/m)?.[1] ?? '';
  const guides = markdown.split(/^## \d+\. /m).slice(1).map((section) => {
    const lines = section.split('\n');
    const read = (pattern: RegExp): string => section.match(pattern)?.[1] ?? '';
    const audience = read(/^- Audience: (.+)$/m);
    return {
      title: lines[0].trim(),
      guideId: read(/^- Guide ID: `([^`]+)`$/m),
      draftPath: read(/^- Draft: `([^`]+)`$/m),
      audience: audience === 'Unspecified' ? [] : audience.split(', '),
      sourceRoute: read(/^- Covered route\/workflow: `([^`]+)`$/m),
      screenshotCount: Number(read(/^- Screenshots: (\d+)$/m)),
      assumptions: parseReviewList(read(/^- Assumptions: (.+)$/m)),
      knownGaps: parseReviewList(read(/^- Known gaps: (.+)$/m)),
    };
  });
  return { schemaVersion: 1, generatedAt, guides };
}

function formatReviewList(values: string[]): string { return values.length ? values.join('; ') : 'None recorded.'; }
function parseReviewList(value: string): string[] { return value === 'None recorded.' ? [] : value.split('; '); }
function slugify(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guide'; }
