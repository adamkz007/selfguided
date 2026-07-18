export interface AltTextContext {
  guideTitle: string;
  stepTitle: string;
  visibleElements?: string[];
  redacted?: boolean;
}

export function generateAltText(context: AltTextContext): string {
  const elements = context.visibleElements?.filter(Boolean).slice(0, 3).join(', ');
  const suffix = context.redacted ? ' Sensitive information is redacted.' : '';
  return `${context.guideTitle}: ${context.stepTitle}${elements ? ` showing ${elements}` : ''}.${suffix}`;
}
