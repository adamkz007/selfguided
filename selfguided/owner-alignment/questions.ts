import { keyGoals, targetAudiences, type KeyGoal, type OwnerAlignmentResult, type TargetAudience } from './schema';

export type OwnerAlignmentQuestionType = 'multi-select' | 'free-text-list' | 'boolean' | 'credentials-availability';

export interface OwnerAlignmentQuestion<TAnswer = unknown> {
  id: keyof OwnerAlignmentResult;
  type: OwnerAlignmentQuestionType;
  prompt: string;
  description: string;
  options?: readonly TAnswer[];
  required: boolean;
}

export const ownerAlignmentQuestions: readonly OwnerAlignmentQuestion[] = [
  {
    id: 'approvedTargetAudiences',
    type: 'multi-select',
    prompt: 'Which target audiences are approved for generated guides?',
    description: 'Pick every audience the guide plan may cover after static codebase discovery.',
    options: targetAudiences,
    required: true,
  } satisfies OwnerAlignmentQuestion<TargetAudience>,
  {
    id: 'approvedKeyGoals',
    type: 'multi-select',
    prompt: 'Which key goals are approved for generated guides?',
    description: 'Pick every product outcome the guide plan may cover.',
    options: keyGoals,
    required: true,
  } satisfies OwnerAlignmentQuestion<KeyGoal>,
  {
    id: 'excludedRoutesOrWorkflows',
    type: 'free-text-list',
    prompt: 'Which routes or workflows should SelfGuided exclude?',
    description: 'List sensitive, destructive, unfinished, or out-of-scope routes/workflows and optional reasons.',
    required: false,
  },
  {
    id: 'browserNavigationApproved',
    type: 'boolean',
    prompt: 'Is browser navigation approved?',
    description: 'Approval is required before opening the app, a local dev server, admin console, or third-party service.',
    required: true,
  },
  {
    id: 'screenshotsApproved',
    type: 'boolean',
    prompt: 'Are screenshots approved?',
    description: 'Approval is required before capturing screenshots, screen recordings, or other visual evidence.',
    required: true,
  },
  {
    id: 'authenticatedTestCredentialsAvailable',
    type: 'credentials-availability',
    prompt: 'Are authenticated test credentials available?',
    description: 'Confirm only whether approved test credentials are available; do not store secrets in alignment artifacts.',
    required: true,
  },
  {
    id: 'guidesFilesMayBeWritten',
    type: 'boolean',
    prompt: 'May generated /guides files be written?',
    description: 'Approval is required before writing generated guides, indexes, screenshots, or /guides implementation files.',
    required: true,
  },
] as const;

export function getOwnerAlignmentQuestions(): readonly OwnerAlignmentQuestion[] {
  return ownerAlignmentQuestions;
}

export function formatOwnerAlignmentPrompt(): string {
  return ownerAlignmentQuestions
    .map((question, index) => {
      const options = question.options?.length ? `\n   Options: ${question.options.join(', ')}` : '';
      return `${index + 1}. ${question.prompt}\n   ${question.description}${options}`;
    })
    .join('\n\n');
}

export interface OwnerAlignmentDiscoverySummary {
  routeCount: number;
  navigationSourceCount: number;
  helpContentCount: number;
}

export interface OwnerAlignmentCheckpoint {
  phase: 'after-static-discovery';
  blockedUntilOwnerApproval: true;
  discoverySummary?: OwnerAlignmentDiscoverySummary;
  prompt: string;
  questions: readonly OwnerAlignmentQuestion[];
  outputFiles: readonly ['.selfguided/owner-alignment.json', '.selfguided/approved-guide-plan.md'];
}

export function createOwnerAlignmentCheckpoint(discoverySummary?: OwnerAlignmentDiscoverySummary): OwnerAlignmentCheckpoint {
  return {
    phase: 'after-static-discovery',
    blockedUntilOwnerApproval: true,
    discoverySummary,
    prompt: formatOwnerAlignmentPrompt(),
    questions: ownerAlignmentQuestions,
    outputFiles: ['.selfguided/owner-alignment.json', '.selfguided/approved-guide-plan.md'],
  };
}
