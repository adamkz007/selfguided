import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type GuideValidationStatus = 'draft' | 'approved' | 'published' | 'needs-review' | 'stale';

export interface GuideVerificationRecord {
  schemaVersion: 1;
  slug: string;
  lastVerified: string;
  appUrl?: string;
  gitCommit?: string;
  sourceRoutes: string[];
  sourcePaths: string[];
  screenshotCapturedAt?: string;
  ownerApprovalDate?: string;
  assumptions: string[];
  status: GuideValidationStatus;
}

export function writeGuideVerification(root: string, record: GuideVerificationRecord): string {
  const path = join(root, '.selfguided', 'verification', `${record.slug}.json`);
  mkdirSync(join(root, '.selfguided', 'verification'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  return path;
}

export function readGuideVerifications(root: string): GuideVerificationRecord[] {
  const directory = join(root, '.selfguided', 'verification');
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((file) => file.endsWith('.json')).sort().map((file) => JSON.parse(readFileSync(join(directory, file), 'utf8')) as GuideVerificationRecord);
}

export function findStaleGuides(root: string, changedPaths: string[]): GuideVerificationRecord[] {
  const changed = new Set(changedPaths.map(normalizePath));
  return readGuideVerifications(root).filter((record) => record.sourcePaths.some((path) => changed.has(normalizePath(path))));
}

export function markGuidesStale(root: string, changedPaths: string[], now = new Date().toISOString()): GuideVerificationRecord[] {
  return findStaleGuides(root, changedPaths).map((record) => {
    const stale = { ...record, status: 'stale' as const, lastVerified: record.lastVerified || now.slice(0, 10) };
    writeGuideVerification(root, stale);
    return stale;
  });
}

function normalizePath(path: string): string { return path.replace(/\\/g, '/').replace(/^\.\//, ''); }
