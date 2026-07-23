import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BrowserTrace, BrowserTraceStep } from '../browser/trace-schema';
import { generateAltText } from '../assets/screenshots/alt-text';
import {
  renderYamlFrontmatter,
  validateGuideFrontmatter,
  type GuideFrontmatter,
  type FrontmatterValidationIssue,
} from './frontmatter-schema';

export interface GuideGenerationOptions {
  title?: string;
  description?: string;
  audience: string[];
  category: string;
  tags?: string[];
  estimatedTime?: string;
  prerequisites?: string[];
  expectedResults?: string[];
  troubleshooting?: string;
  relatedGuides?: string[];
  sourceRoute?: string;
  lastVerified?: string;
  outputPath?: string;
}

export interface GuideStep {
  number: number;
  title: string;
  instruction: string;
  caption?: string;
  altText?: string;
  screenshotPath?: string;
}

export interface GeneratedGuide {
  frontmatter: GuideFrontmatter;
  steps: GuideStep[];
  markdown: string;
  outputPath?: string;
}

export class GuideGenerationError extends Error {
  constructor(message: string, public readonly issues: FrontmatterValidationIssue[] = []) {
    super(message);
    this.name = 'GuideGenerationError';
  }
}

export function generateGuide(trace: BrowserTrace, options: GuideGenerationOptions): GeneratedGuide {
  validateApprovedTrace(trace);

  const observations = trace.steps.filter((step): step is BrowserTraceStep & { observation: NonNullable<BrowserTraceStep['observation']> } => Boolean(step.observation));
  const title = options.title?.trim() || humanize(trace.journeySlug);
  const sourceRoute = options.sourceRoute?.trim() || routeFromUrl(observations[0].observation.url);
  const screenshots = observations.flatMap((step) => step.observation.screenshotPath ? [step.observation.screenshotPath] : []);
  const frontmatter: GuideFrontmatter = {
    title,
    description: options.description?.trim() || `Learn how to ${sentenceCase(trace.journeySlug)}.`,
    audience: [...options.audience],
    category: options.category,
    tags: [...(options.tags ?? [])],
    estimatedTime: options.estimatedTime ?? estimateTime(observations.length),
    sourceRoute,
    lastVerified: options.lastVerified ?? dateOnly(trace.completedAt ?? trace.startedAt),
    screenshots,
    sourceJourneyTrace: trace.runId,
    prerequisites: [...(options.prerequisites ?? [])],
    expectedResults: [...(options.expectedResults ?? [`The ${trace.journeySlug} workflow is complete.`])],
    relatedGuides: [...(options.relatedGuides ?? [])],
  };
  const issues = validateGuideFrontmatter(frontmatter);
  if (issues.length) throw new GuideGenerationError('Guide frontmatter is invalid.', issues);

  const steps = observations.map((step, index) => createGuideStep(title, step, index));
  const markdown = renderGuide(frontmatter, steps, options.troubleshooting);
  return { frontmatter, steps, markdown, outputPath: options.outputPath };
}

export function writeGuide(trace: BrowserTrace, options: GuideGenerationOptions): GeneratedGuide {
  if (!options.outputPath) throw new GuideGenerationError('outputPath is required when writing a guide.');
  const guide = generateGuide(trace, options);
  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, guide.markdown);
  return guide;
}

export function loadGuideTemplate(templatePath = join(__dirname, 'templates', 'how-to-guide.mdx')): string {
  return existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : defaultGuideTemplate;
}

const defaultGuideTemplate = `{{frontmatter}}

# {{title}}

{{description}}

## Prerequisites

{{prerequisites}}

## Steps

{{steps}}

## Expected result

{{expectedResults}}

## Troubleshooting

{{troubleshooting}}

## Related guides

{{relatedGuides}}

Last verified: {{lastVerified}}

Source journey trace: {{sourceJourneyTrace}}
`;

function validateApprovedTrace(trace: BrowserTrace): void {
  const issues: FrontmatterValidationIssue[] = [];
  if (trace.schemaVersion !== 1) issues.push({ path: 'schemaVersion', message: 'Only trace schema version 1 is supported.' });
  if (trace.status !== 'completed') issues.push({ path: 'status', message: 'Only completed journey traces can generate guides.' });
  if (!trace.approvedPlanPath?.trim()) issues.push({ path: 'approvedPlanPath', message: 'Trace must reference an approved journey plan.' });
  if (!trace.steps.length) issues.push({ path: 'steps', message: 'Trace must contain at least one step.' });
  trace.steps.forEach((step, index) => {
    if (step.blocked) issues.push({ path: `steps.${index}.blocked`, message: `Step is blocked: ${step.blocked.reason}.` });
    if (!step.observation) issues.push({ path: `steps.${index}.observation`, message: 'Every generated guide step needs a page observation.' });
  });
  if (issues.length) throw new GuideGenerationError('Journey trace is not approved for guide generation.', issues);
}

function createGuideStep(guideTitle: string, step: BrowserTraceStep & { observation: NonNullable<BrowserTraceStep['observation']> }, index: number): GuideStep {
  const observation = step.observation;
  const title = humanize(step.action || observation.title || `step ${index + 1}`);
  const visible = [...observation.headings, ...observation.buttons, ...observation.links].map((element) => element.text).filter(Boolean);
  return {
    number: index + 1,
    title,
    instruction: step.action.trim() || `Review the ${observation.title} page.`,
    caption: observation.screenshotPath ? `The ${title.toLowerCase()} screen.` : undefined,
    altText: observation.screenshotPath ? generateAltText({ guideTitle, stepTitle: title, visibleElements: visible }) : undefined,
    screenshotPath: observation.screenshotPath,
  };
}

function renderGuide(frontmatter: GuideFrontmatter, steps: GuideStep[], troubleshooting = 'If the page or control looks different, confirm that you are using the expected workspace and have the required permissions. Then retry the step from the source route.'): string {
  const renderedSteps = steps.map((step) => {
    const image = step.screenshotPath ? `\n\n![${step.altText}](${step.screenshotPath})\n\n*${step.caption}*` : '';
    return `${step.number}. **${step.title}** — ${step.instruction}${image}`;
  }).join('\n\n');
  const list = (values: string[]) => values.length ? values.map((value) => `- ${value}`).join('\n') : '- None.';
  return loadGuideTemplate()
    .replace('{{frontmatter}}', renderYamlFrontmatter(frontmatter))
    .replace('{{title}}', frontmatter.title)
    .replace('{{description}}', frontmatter.description)
    .replace('{{prerequisites}}', list(frontmatter.prerequisites))
    .replace('{{steps}}', renderedSteps)
    .replace('{{expectedResults}}', list(frontmatter.expectedResults))
    .replace('{{troubleshooting}}', troubleshooting.trim() || 'No known issues.')
    .replace('{{relatedGuides}}', list(frontmatter.relatedGuides))
    .replace('{{lastVerified}}', frontmatter.lastVerified)
    .replace('{{sourceJourneyTrace}}', frontmatter.sourceJourneyTrace);
}

function humanize(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function sentenceCase(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/^./, (letter) => letter.toLowerCase());
}

function routeFromUrl(url: string): string {
  try { return new URL(url).pathname || '/'; } catch { return url.startsWith('/') ? url : '/'; }
}

function dateOnly(value: string): string { return value.slice(0, 10); }

function estimateTime(stepCount: number): string { return `${Math.max(1, Math.ceil(stepCount * 1.5))} minutes`; }
