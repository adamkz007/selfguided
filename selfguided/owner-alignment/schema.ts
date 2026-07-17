export const targetAudiences = [
  'end-user',
  'team-admin',
  'workspace-owner',
  'billing-admin',
  'internal-support',
] as const;

export type TargetAudience = (typeof targetAudiences)[number];

export const keyGoals = [
  'onboarding',
  'account-setup',
  'team-setup',
  'data-import',
  'core-feature-usage',
  'reporting-exporting',
  'billing-subscription-management',
] as const;

export type KeyGoal = (typeof keyGoals)[number];

export interface ExcludedWorkflow {
  pathOrWorkflow: string;
  reason?: string;
}

export interface OwnerAlignmentApproval {
  browserNavigationApproved: boolean;
  screenshotsApproved: boolean;
  authenticatedTestCredentialsAvailable: boolean;
  guidesFilesMayBeWritten: boolean;
}

export interface OwnerAlignmentResult extends OwnerAlignmentApproval {
  approvedTargetAudiences: TargetAudience[];
  approvedKeyGoals: KeyGoal[];
  excludedRoutesOrWorkflows: ExcludedWorkflow[];
  notes?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface OwnerAlignmentArtifact {
  schemaVersion: 1;
  generatedAt: string;
  status: 'owner-approved-guide-plan';
  result: OwnerAlignmentResult;
}

export interface OwnerAlignmentValidationIssue {
  path: string;
  message: string;
}

export function createOwnerAlignmentArtifact(
  result: OwnerAlignmentResult,
  generatedAt = new Date().toISOString(),
): OwnerAlignmentArtifact {
  return {
    schemaVersion: 1,
    generatedAt,
    status: 'owner-approved-guide-plan',
    result: {
      ...result,
      approvedTargetAudiences: [...result.approvedTargetAudiences],
      approvedKeyGoals: [...result.approvedKeyGoals],
      excludedRoutesOrWorkflows: result.excludedRoutesOrWorkflows.map((entry) => ({ ...entry })),
      approvedAt: result.approvedAt ?? generatedAt,
    },
  };
}

export function validateOwnerAlignmentResult(result: OwnerAlignmentResult): OwnerAlignmentValidationIssue[] {
  const issues: OwnerAlignmentValidationIssue[] = [];
  const audienceSet = new Set(targetAudiences);
  const goalSet = new Set(keyGoals);

  if (result.approvedTargetAudiences.length === 0) {
    issues.push({ path: 'approvedTargetAudiences', message: 'Select at least one approved target audience.' });
  }
  for (const audience of result.approvedTargetAudiences) {
    if (!audienceSet.has(audience)) {
      issues.push({ path: 'approvedTargetAudiences', message: `Unsupported target audience: ${audience}.` });
    }
  }

  if (result.approvedKeyGoals.length === 0) {
    issues.push({ path: 'approvedKeyGoals', message: 'Select at least one approved key goal.' });
  }
  for (const goal of result.approvedKeyGoals) {
    if (!goalSet.has(goal)) {
      issues.push({ path: 'approvedKeyGoals', message: `Unsupported key goal: ${goal}.` });
    }
  }

  for (const [index, excluded] of result.excludedRoutesOrWorkflows.entries()) {
    if (!excluded.pathOrWorkflow.trim()) {
      issues.push({ path: `excludedRoutesOrWorkflows.${index}.pathOrWorkflow`, message: 'Excluded route or workflow is required.' });
    }
  }

  return issues;
}
