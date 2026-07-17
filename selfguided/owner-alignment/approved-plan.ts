import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createOwnerAlignmentArtifact, type OwnerAlignmentArtifact, type OwnerAlignmentResult } from './schema';

export interface ApprovedGuidePlanWriteResult {
  alignmentJsonPath: string;
  approvedPlanPath: string;
  artifact: OwnerAlignmentArtifact;
  markdown: string;
}

export function renderApprovedGuidePlan(artifact: OwnerAlignmentArtifact): string {
  const { result } = artifact;
  const excluded = result.excludedRoutesOrWorkflows.length
    ? result.excludedRoutesOrWorkflows.map((entry) => `- ${entry.pathOrWorkflow}${entry.reason ? ` — ${entry.reason}` : ''}`).join('\n')
    : '- None approved for exclusion.';

  return `# Approved Guide Plan\n\n` +
    `Generated: ${artifact.generatedAt}\n\n` +
    `Status: ${artifact.status}\n\n` +
    `## Approved target audiences\n\n${result.approvedTargetAudiences.map((audience) => `- ${audience}`).join('\n')}\n\n` +
    `## Approved key goals\n\n${result.approvedKeyGoals.map((goal) => `- ${goal}`).join('\n')}\n\n` +
    `## Excluded routes or workflows\n\n${excluded}\n\n` +
    `## Owner approvals\n\n` +
    `- Browser navigation approved: ${yesNo(result.browserNavigationApproved)}\n` +
    `- Screenshots approved: ${yesNo(result.screenshotsApproved)}\n` +
    `- Authenticated test credentials available: ${yesNo(result.authenticatedTestCredentialsAvailable)}\n` +
    `- Generated /guides files may be written: ${yesNo(result.guidesFilesMayBeWritten)}\n\n` +
    `## Notes\n\n${result.notes?.trim() || 'None.'}\n`;
}

export function writeApprovedGuidePlan(root: string, result: OwnerAlignmentResult): ApprovedGuidePlanWriteResult {
  const artifact = createOwnerAlignmentArtifact(result);
  const markdown = renderApprovedGuidePlan(artifact);
  const directory = join(root, '.selfguided');
  const alignmentJsonPath = join(directory, 'owner-alignment.json');
  const approvedPlanPath = join(directory, 'approved-guide-plan.md');

  mkdirSync(directory, { recursive: true });
  writeFileSync(alignmentJsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(approvedPlanPath, markdown);

  return { alignmentJsonPath, approvedPlanPath, artifact, markdown };
}

function yesNo(value: boolean): 'Yes' | 'No' {
  return value ? 'Yes' : 'No';
}
