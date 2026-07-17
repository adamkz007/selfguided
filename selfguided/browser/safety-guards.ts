import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApprovedJourney, BrowserBlockReason } from './trace-schema';

export interface BrowserOwnerApproval {
  browserNavigationApproved: boolean;
  screenshotsApproved: boolean;
  authenticatedTestCredentialsAvailable: boolean;
  destructiveActionsApproved: boolean;
  productionNavigationApproved: boolean;
  notes?: string;
}

export interface TestCredentials {
  username?: string;
  email?: string;
  password?: string;
  otp?: string;
  [key: string]: string | undefined;
}

export interface BrowserRunRequest {
  root: string;
  appUrl: string;
  journeySlug: string;
  credentials?: TestCredentials;
  allowDestructiveActions?: boolean;
  allowProduction?: boolean;
}

export interface SafetyBlock {
  reason: BrowserBlockReason;
  message: string;
}

export interface ApprovedPlanContext {
  path: string;
  markdown: string;
  approval: BrowserOwnerApproval;
  journeys: ApprovedJourney[];
}

const DESTRUCTIVE_WORDS = ['delete', 'remove', 'destroy', 'cancel subscription', 'charge', 'send email', 'invite users', 'publish', 'archive'];
const PRODUCTION_HOST_HINTS = ['app.', 'www.', 'dashboard.', 'admin.'];

export function loadApprovedPlan(root: string): ApprovedPlanContext {
  const path = join(root, '.selfguided', 'approved-guide-plan.md');
  if (!existsSync(path)) {
    return { path, markdown: '', approval: emptyApproval(), journeys: [] };
  }
  const markdown = readFileSync(path, 'utf8');
  return { path, markdown, approval: parseApproval(markdown), journeys: parseApprovedJourneys(markdown) };
}

export function evaluateRunSafety(request: BrowserRunRequest, plan = loadApprovedPlan(request.root)): SafetyBlock | undefined {
  if (!plan.approval.browserNavigationApproved) return block('missing-approval', 'Owner approval for browser navigation is required.');
  if (isProductionLikeUrl(request.appUrl) && !request.allowProduction && !plan.approval.productionNavigationApproved) {
    return block('production-risk', 'The app URL looks production-like; owner approval for production navigation is required.');
  }
  const journey = plan.journeys.find((entry) => entry.slug === request.journeySlug);
  if (!journey) return block('journey-not-approved', `Journey "${request.journeySlug}" is not listed in the approved guide plan.`);
  if (journey.steps.some(isDestructiveText) && !request.allowDestructiveActions && !plan.approval.destructiveActionsApproved) {
    return block('unclear-destructive-action', 'The approved journey appears to include destructive or side-effecting actions; explicit test-environment approval is required.');
  }
  if (plan.approval.authenticatedTestCredentialsAvailable && !hasCredentials(request.credentials)) {
    return block('missing-credentials', 'Owner-approved test credentials are required before authenticating.');
  }
  return undefined;
}

export function isDestructiveText(text: string): boolean {
  const lower = text.toLowerCase();
  return DESTRUCTIVE_WORDS.some((word) => lower.includes(word));
}

export function isProductionLikeUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) && PRODUCTION_HOST_HINTS.some((hint) => url.hostname.startsWith(hint));
  } catch {
    return true;
  }
}

function parseApproval(markdown: string): BrowserOwnerApproval {
  return {
    browserNavigationApproved: /Browser navigation approved:\s*Yes/i.test(markdown),
    screenshotsApproved: /Screenshots approved:\s*Yes/i.test(markdown),
    authenticatedTestCredentialsAvailable: /Authenticated test credentials available:\s*Yes/i.test(markdown),
    destructiveActionsApproved: /Destructive actions approved:\s*Yes/i.test(markdown),
    productionNavigationApproved: /Production navigation approved:\s*Yes/i.test(markdown),
    notes: markdown.match(/## Notes\s+([\s\S]*)$/i)?.[1]?.trim(),
  };
}

function parseApprovedJourneys(markdown: string): ApprovedJourney[] {
  const lines = markdown.split(/\r?\n/);
  const journeys: ApprovedJourney[] = [];
  let inSection = false;
  let current: ApprovedJourney | undefined;
  lines.forEach((line, index) => {
    if (/^##\s+Approved user journeys/i.test(line)) { inSection = true; return; }
    if (inSection && /^##\s+/.test(line)) inSection = false;
    if (!inSection) return;
    const heading = line.match(/^###\s+(.+)/);
    if (heading) {
      current = { title: heading[1].trim(), slug: slugify(heading[1]), steps: [], sourceLine: index + 1 };
      journeys.push(current);
      return;
    }
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet && current) current.steps.push(bullet[1].trim());
  });
  return journeys;
}

function hasCredentials(credentials?: TestCredentials): boolean {
  return Boolean(credentials && (credentials.password || credentials.otp) && (credentials.email || credentials.username));
}

function block(reason: BrowserBlockReason, message: string): SafetyBlock { return { reason, message }; }
function emptyApproval(): BrowserOwnerApproval { return { browserNavigationApproved: false, screenshotsApproved: false, authenticatedTestCredentialsAvailable: false, destructiveActionsApproved: false, productionNavigationApproved: false }; }
function slugify(text: string): string { return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'journey'; }
