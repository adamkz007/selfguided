import { readFileSync } from 'node:fs';

export interface RedactionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
}

export interface TextObservation {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactionRuleConfig {
  regions?: RedactionRegion[];
  customerNames?: string[];
  extraPatterns?: string[];
}

export interface RedactionPlan {
  regions: RedactionRegion[];
  matchedText: Array<TextObservation & { reason: string }>;
  warnings: string[];
}

const builtInPatterns: Array<{ reason: string; pattern: RegExp }> = [
  { reason: 'email address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { reason: 'api key', pattern: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}/i },
  { reason: 'token', pattern: /\b(?:token|bearer|jwt)\s*[:=]\s*['"]?[A-Za-z0-9._\-]{20,}/i },
  { reason: 'phone number', pattern: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/ },
];

export function loadRedactionRules(path: string): RedactionRuleConfig {
  return JSON.parse(readFileSync(path, 'utf8')) as RedactionRuleConfig;
}

export function buildRedactionPlan(observations: TextObservation[], config: RedactionRuleConfig = {}): RedactionPlan {
  const patterns = [
    ...builtInPatterns,
    ...(config.customerNames ?? []).filter(Boolean).map((name) => ({ reason: 'customer name', pattern: new RegExp(escapeRegExp(name), 'i') })),
    ...(config.extraPatterns ?? []).map((pattern) => ({ reason: 'custom pattern', pattern: new RegExp(pattern, 'i') })),
  ];
  const matchedText = observations.flatMap((observation) => {
    const match = patterns.find(({ pattern }) => pattern.test(observation.text));
    return match ? [{ ...observation, reason: match.reason }] : [];
  });
  return { regions: [...(config.regions ?? []), ...matchedText.map(({ x, y, width, height, reason }) => ({ x, y, width, height, reason }))], matchedText, warnings: [] };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
