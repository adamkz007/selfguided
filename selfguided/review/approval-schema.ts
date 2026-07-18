export const guideDecisions = ['pending', 'approved', 'edited', 'rejected', 'reprioritized'] as const;
export type GuideDecision = (typeof guideDecisions)[number];

export interface GuideApproval {
  decision: GuideDecision;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
  priority?: number;
}

export interface GuideApprovalArtifact {
  schemaVersion: 1;
  generatedAt: string;
  updatedAt: string;
  approvals: Record<string, GuideApproval>;
}

export function createApprovalArtifact(
  guideIds: string[],
  generatedAt = new Date().toISOString(),
): GuideApprovalArtifact {
  return {
    schemaVersion: 1,
    generatedAt,
    updatedAt: generatedAt,
    approvals: Object.fromEntries(guideIds.map((guideId) => [guideId, { decision: 'pending' as const }])),
  };
}

export function validateGuideApprovalArtifact(artifact: GuideApprovalArtifact): string[] {
  const issues: string[] = [];
  if (artifact.schemaVersion !== 1) issues.push('Only approval schema version 1 is supported.');
  for (const [guideId, approval] of Object.entries(artifact.approvals)) {
    if (!guideId.trim()) issues.push('Approval guide IDs must be non-empty.');
    if (!guideDecisions.includes(approval.decision)) issues.push(`Unsupported decision for ${guideId}: ${approval.decision}.`);
    if (approval.decision !== 'pending' && (!approval.reviewedAt || !approval.reviewedBy?.trim())) {
      issues.push(`${guideId} needs reviewedAt and reviewedBy for a non-pending decision.`);
    }
  }
  return issues;
}
