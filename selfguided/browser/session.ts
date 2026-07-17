import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserTrace } from './trace-schema';

export interface BrowserLocatorAdapter {
  allTextContents(): Promise<string[]>;
  evaluateAll<T>(fn: (elements: Element[]) => T): Promise<T>;
  click?: () => Promise<void>;
  fill?: (value: string) => Promise<void>;
}

export interface BrowserPageAdapter {
  goto(url: string): Promise<void>;
  title(): Promise<string>;
  url(): string;
  screenshot(options: { path: string; fullPage?: boolean }): Promise<void>;
  locator(selector: string): BrowserLocatorAdapter;
}

export interface BrowserContextAdapter { newPage(): Promise<BrowserPageAdapter>; close(): Promise<void>; }
export interface BrowserLauncherAdapter { newContext(): Promise<BrowserContextAdapter>; }

export interface BrowserSessionOptions {
  root: string;
  runId?: string;
  journeySlug: string;
  appUrl: string;
  approvedPlanPath: string;
}

export interface BrowserSession {
  runId: string;
  journeyDirectory: string;
  screenshotsDirectory: string;
  tracePath: string;
  observationsPath: string;
  trace: BrowserTrace;
}

export function createBrowserSession(options: BrowserSessionOptions): BrowserSession {
  const runId = options.runId ?? createRunId();
  const journeyDirectory = join(options.root, '.selfguided', 'runs', runId, 'journeys', options.journeySlug);
  const screenshotsDirectory = join(journeyDirectory, 'screenshots');
  mkdirSync(screenshotsDirectory, { recursive: true });
  const trace: BrowserTrace = {
    schemaVersion: 1,
    runId,
    journeySlug: options.journeySlug,
    appUrl: options.appUrl,
    approvedPlanPath: options.approvedPlanPath,
    startedAt: new Date().toISOString(),
    status: 'running',
    steps: [],
  };
  return {
    runId,
    journeyDirectory,
    screenshotsDirectory,
    tracePath: join(journeyDirectory, 'trace.json'),
    observationsPath: join(journeyDirectory, 'observations.md'),
    trace,
  };
}

function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
