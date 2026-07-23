import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateAltText, type AltTextContext } from './alt-text';
import { optimizeImage, type OptimizationResult } from './optimize';
import { buildRedactionPlan, type RedactionPlan, type RedactionRuleConfig, type TextObservation } from './redact';

export interface ScreenshotProcessingInput {
  sourcePath: string;
  outputDirectory: string;
  guideSlug: string;
  stepIndex: number;
  stepSlug: string;
  redactionRules?: RedactionRuleConfig;
  textObservations?: TextObservation[];
  altText: AltTextContext;
  ownerReviewed?: boolean;
  applyRedactions?: (inputPath: string, outputPath: string, plan: RedactionPlan) => Promise<void> | void;
}

export interface ProcessedScreenshot {
  normalizedFilename: string;
  optimizedPath: string;
  redactionPlan: RedactionPlan;
  optimization: OptimizationResult;
  altText: string;
  status: 'awaiting-owner-review' | 'needs-redaction' | 'finalized';
}

export async function processScreenshot(input: ScreenshotProcessingInput): Promise<ProcessedScreenshot> {
  const normalizedFilename = normalizeScreenshotFilename(input.guideSlug, input.stepIndex, input.stepSlug);
  mkdirSync(input.outputDirectory, { recursive: true });
  const optimizedPath = join(input.outputDirectory, normalizedFilename);
  const redactionPlan = buildRedactionPlan(input.textObservations ?? [], input.redactionRules);
  const optimization = await optimizeImage(input.sourcePath, optimizedPath);
  if (redactionPlan.regions.length && input.applyRedactions) await input.applyRedactions(input.sourcePath, optimizedPath, redactionPlan);
  return {
    normalizedFilename,
    optimizedPath,
    redactionPlan,
    optimization,
    altText: generateAltText({ ...input.altText, redacted: redactionPlan.regions.length > 0 }),
    status: redactionPlan.regions.length && !input.applyRedactions ? 'needs-redaction' : input.ownerReviewed ? 'finalized' : 'awaiting-owner-review',
  };
}

export function normalizeScreenshotFilename(guideSlug: string, stepIndex: number, stepSlug: string): string {
  return `${slugify(guideSlug)}-step-${String(stepIndex).padStart(2, '0')}-${slugify(stepSlug)}.png`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'screenshot';
}
