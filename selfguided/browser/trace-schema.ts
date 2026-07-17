export type BrowserBlockReason =
  | 'missing-approval'
  | 'missing-credentials'
  | 'captcha'
  | 'unclear-destructive-action'
  | 'permission-error'
  | 'production-risk'
  | 'journey-not-approved'
  | 'navigation-error';

export interface VisibleElementSummary {
  text: string;
  selector?: string;
  href?: string;
  type?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
}

export interface PageObservation {
  url: string;
  title: string;
  headings: VisibleElementSummary[];
  buttons: VisibleElementSummary[];
  links: VisibleElementSummary[];
  formFields: VisibleElementSummary[];
  states: VisibleElementSummary[];
  screenshotPath?: string;
  capturedAt: string;
}

export interface BrowserTraceStep {
  index: number;
  journeySlug: string;
  action: string;
  approvedPlanReference?: string;
  observation?: PageObservation;
  blocked?: {
    reason: BrowserBlockReason;
    message: string;
    needsOwnerClarification: boolean;
  };
  createdAt: string;
}

export interface BrowserTrace {
  schemaVersion: 1;
  runId: string;
  journeySlug: string;
  appUrl: string;
  approvedPlanPath: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'blocked';
  steps: BrowserTraceStep[];
}

export interface ApprovedJourney {
  slug: string;
  title: string;
  steps: string[];
  sourceLine?: number;
}
