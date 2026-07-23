import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { captureApprovedScreenshot } from './screenshotter';
import { containsSensitiveText, redactSensitiveText } from '../assets/screenshots/redact';
import { createBrowserSession, type BrowserLauncherAdapter, type BrowserPageAdapter } from './session';
import { evaluateRunSafety, isDestructiveText, loadApprovedPlan, requiresCredentials, type BrowserRunRequest, type TestCredentials } from './safety-guards';
import type { BrowserTraceStep, PageObservation, VisibleElementSummary } from './trace-schema';

export interface BrowserNavigationOptions extends BrowserRunRequest {
  launcher: BrowserLauncherAdapter;
  runId?: string;
}

export async function runApprovedBrowserJourney(options: BrowserNavigationOptions) {
  const plan = loadApprovedPlan(options.root);
  const session = createBrowserSession({ root: options.root, runId: options.runId, journeySlug: options.journeySlug, appUrl: options.appUrl, approvedPlanPath: plan.path });
  const safetyBlock = evaluateRunSafety(options, plan);
  if (safetyBlock) {
    session.trace.status = 'blocked';
    session.trace.completedAt = new Date().toISOString();
    session.trace.steps.push(blockedStep(0, options.journeySlug, 'preflight safety check', safetyBlock.reason, safetyBlock.message));
    writeArtifacts(session.tracePath, session.observationsPath, session.trace, options.root);
    return session;
  }

  const journey = plan.journeys.find((entry) => entry.slug === options.journeySlug)!;
  const context = await options.launcher.newContext();
  try {
    const page = await context.newPage();
    await page.goto(options.appUrl);
    await recordStep(page, session, 0, 'open approved app URL', plan.approval.screenshotsApproved, options.root);

    let index = 1;
    for (const instruction of journey.steps) {
      if (/captcha/i.test(await pageText(page))) {
        session.trace.steps.push(blockedStep(index, options.journeySlug, instruction, 'captcha', 'CAPTCHA was detected; owner clarification or manual completion is required.'));
        session.trace.status = 'blocked';
        break;
      }
      if (requiresCredentials(instruction) && !options.credentials) {
        session.trace.steps.push(blockedStep(index, options.journeySlug, instruction, 'missing-credentials', 'This step requires owner-approved test credentials before continuing.'));
        session.trace.status = 'blocked';
        break;
      }
      if (isDestructiveText(instruction) && !options.allowDestructiveActions) {
        session.trace.steps.push(blockedStep(index, options.journeySlug, instruction, 'unclear-destructive-action', 'This step appears destructive and needs explicit test-environment approval.'));
        session.trace.status = 'blocked';
        break;
      }
      await executeApprovedInstruction(page, instruction, options.credentials);
      session.trace.steps.push({ index, journeySlug: options.journeySlug, action: redactAction(`approved journey instruction: ${instruction}`), approvedPlanReference: journey.title, observation: await observePage(page, session.screenshotsDirectory, index, instruction, plan.approval.screenshotsApproved), createdAt: new Date().toISOString() });
      index += 1;
    }
    if (session.trace.status === 'running') session.trace.status = 'completed';
    session.trace.completedAt = new Date().toISOString();
  } catch (error) {
    session.trace.status = 'blocked';
    session.trace.completedAt = new Date().toISOString();
    session.trace.steps.push(blockedStep(session.trace.steps.length, options.journeySlug, 'browser navigation', 'navigation-error', error instanceof Error ? error.message : String(error)));
  } finally {
    await context.close();
    writeArtifacts(session.tracePath, session.observationsPath, session.trace, options.root);
  }
  return session;
}


async function executeApprovedInstruction(page: BrowserPageAdapter, instruction: string, credentials?: TestCredentials): Promise<void> {
  const goTo = instruction.match(/(?:go to|open|visit)\s+(https?:\/\/\S+|\/\S*)/i);
  if (goTo) {
    await page.goto(resolveNavigationUrl(page.url(), goTo[1]));
    return;
  }

  const fill = instruction.match(/(?:fill|enter|type)\s+(.+?)\s+(?:with|as)\s+(.+)/i);
  if (fill) {
    const field = fill[1].replace(/(?:field|input)$/i, '').trim();
    const value = credentialValue(fill[2].trim(), credentials);
    if (!value) throw new Error(`Missing owner-approved test credential for ${field}.`);
    const locator = page.locator(`input[name="${field}"],input[placeholder*="${field}"],textarea[name="${field}"],textarea[placeholder*="${field}"]`);
    if (locator.fill) await locator.fill(value);
    return;
  }

  const click = instruction.match(/(?:click|select|press|choose)\s+(.+)/i);
  if (click) {
    const label = click[1].replace(/^the\s+/i, '').trim();
    const locator = page.locator(`text=${label}`);
    if (locator.click) await locator.click();
  }
}

function resolveNavigationUrl(currentUrl: string, target: string): string {
  if (/^https?:\/\//i.test(target)) return target;
  return new URL(target, currentUrl).toString();
}

function credentialValue(token: string, credentials?: TestCredentials): string {
  const normalized = token.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('email')) return credentials?.email ?? '';
  if (normalized.includes('username')) return credentials?.username ?? '';
  if (normalized.includes('password')) return credentials?.password ?? '';
  if (normalized.includes('otp') || normalized.includes('code')) return credentials?.otp ?? '';
  return token;
}

function redactAction(action: string): string {
  return action.replace(/(password|otp|code)\s+(?:with|as)\s+\S+/gi, '$1 with [REDACTED]');
}

async function recordStep(page: BrowserPageAdapter, session: ReturnType<typeof createBrowserSession>, index: number, action: string, screenshotsApproved: boolean, root: string) {
  session.trace.steps.push({ index, journeySlug: session.trace.journeySlug, action, observation: await observePage(page, session.screenshotsDirectory, index, action, screenshotsApproved), createdAt: new Date().toISOString() });
  writeArtifacts(session.tracePath, session.observationsPath, session.trace, root);
}

async function observePage(page: BrowserPageAdapter, screenshotsDirectory: string, stepIndex: number, label: string, screenshotsApproved: boolean): Promise<PageObservation> {
  const headings = await textLocator(page, 'h1,h2,h3');
  const buttons = await textLocator(page, 'button,[role="button"],input[type="submit"]');
  const links = await elementSummaries(page, 'a[href]');
  const formFields = await elementSummaries(page, 'input,textarea,select');
  const states = await textLocator(page, '[role="alert"],[aria-live],.error,.empty,.success,[data-state="empty"],[data-state="success"],[data-state="error"]');
  const hasSensitiveText = containsSensitiveText(await pageText(page));
  const screenshotPath = await captureApprovedScreenshot(page, { screenshotsDirectory, enabled: screenshotsApproved && !hasSensitiveText, stepIndex, label });
  if (screenshotsApproved && !screenshotPath && hasSensitiveText) states.push({ text: 'Screenshot omitted because visible sensitive text requires redaction.' });
  return {
    url: redactUrl(page.url()),
    title: redactSensitiveText(await page.title()),
    headings, buttons, links, formFields, states,
    screenshotPath,
    capturedAt: new Date().toISOString(),
  };
}

async function textLocator(page: BrowserPageAdapter, selector: string): Promise<VisibleElementSummary[]> {
  const values = await page.locator(selector).allTextContents();
  return values.map((text) => ({ text: redactSensitiveText(text.trim()) })).filter((entry) => entry.text);
}

async function elementSummaries(page: BrowserPageAdapter, selector: string): Promise<VisibleElementSummary[]> {
  return page.locator(selector).evaluateAll((elements) => elements.map((element) => ({
    text: redactSensitiveText((element.textContent || '').trim()),
    href: element instanceof HTMLAnchorElement ? redactUrl(element.href) : undefined,
    type: element instanceof HTMLInputElement ? element.type : element.getAttribute('type') || undefined,
    name: redactSensitiveText(element.getAttribute('name') || '') || undefined,
    placeholder: redactSensitiveText(element.getAttribute('placeholder') || '') || undefined,
    required: element.hasAttribute('required') || undefined,
  })).filter((entry) => entry.text || entry.href || entry.name || entry.placeholder));
}

async function pageText(page: BrowserPageAdapter): Promise<string> {
  return (await page.locator('body').allTextContents()).join('\n');
}

function blockedStep(index: number, journeySlug: string, action: string, reason: NonNullable<BrowserTraceStep['blocked']>['reason'], message: string): BrowserTraceStep {
  return { index, journeySlug, action, blocked: { reason, message, needsOwnerClarification: true }, createdAt: new Date().toISOString() };
}

function writeArtifacts(tracePath: string, observationsPath: string, trace: unknown, root: string) {
  writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  const browserTrace = trace as { status: string; steps: BrowserTraceStep[] };
  const lines = [`# Browser observations`, '', `Status: ${browserTrace.status}`, ''];
  for (const step of browserTrace.steps) {
    lines.push(`## Step ${step.index}: ${step.action}`, '');
    if (step.blocked) lines.push(`Blocked: ${step.blocked.reason} — ${step.blocked.message}`, '');
    if (step.observation) {
      lines.push(`- URL: ${step.observation.url}`, `- Title: ${step.observation.title}`);
      appendObservationList(lines, 'Headings', step.observation.headings.map((entry) => entry.text));
      appendObservationList(lines, 'Buttons', step.observation.buttons.map((entry) => entry.text));
      appendObservationList(lines, 'Links', step.observation.links.map((entry) => entry.text || entry.href || '').filter(Boolean));
      appendObservationList(lines, 'Form fields', step.observation.formFields.map((entry) => entry.name || entry.placeholder || entry.type || '').filter(Boolean));
      appendObservationList(lines, 'States', step.observation.states.map((entry) => entry.text));
      if (step.observation.screenshotPath) lines.push(`- Screenshot: ${relative(root, step.observation.screenshotPath)}`);
      lines.push('');
    }
  }
  writeFileSync(observationsPath, `${lines.join('\n')}\n`);
}

function appendObservationList(lines: string[], label: string, values: string[]): void {
  const visibleValues = values.map((value) => value.trim()).filter(Boolean).slice(0, 20);
  if (visibleValues.length) lines.push(`- ${label}: ${visibleValues.join('; ')}`);
}

function redactUrl(value: string): string {
  try { const url = new URL(value); if (url.search || url.hash) return `${url.origin}${url.pathname}?…redacted`; return value; } catch { return redactSensitiveText(value); }
}
