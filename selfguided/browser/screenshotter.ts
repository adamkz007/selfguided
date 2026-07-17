import { join } from 'node:path';
import type { BrowserPageAdapter } from './session';

export interface ScreenshotOptions {
  screenshotsDirectory: string;
  enabled: boolean;
  stepIndex: number;
  label: string;
}

export async function captureApprovedScreenshot(page: BrowserPageAdapter, options: ScreenshotOptions): Promise<string | undefined> {
  if (!options.enabled) return undefined;
  const filename = `${String(options.stepIndex).padStart(3, '0')}-${slugify(options.label)}.png`;
  const path = join(options.screenshotsDirectory, filename);
  await page.screenshot({ path, fullPage: true });
  return path;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'step';
}
