export interface GuideFrontmatter {
  title: string;
  description: string;
  audience: string[];
  category: string;
  tags: string[];
  estimatedTime: string;
  sourceRoute: string;
  lastVerified: string;
  screenshots: string[];
  sourceJourneyTrace: string;
  prerequisites: string[];
  expectedResults: string[];
  relatedGuides: string[];
}

export interface FrontmatterValidationIssue {
  path: string;
  message: string;
}

const requiredStringFields: Array<keyof GuideFrontmatter> = [
  'title',
  'description',
  'category',
  'estimatedTime',
  'sourceRoute',
  'lastVerified',
  'sourceJourneyTrace',
];

const listFields: Array<keyof GuideFrontmatter> = [
  'audience',
  'tags',
  'screenshots',
  'prerequisites',
  'expectedResults',
  'relatedGuides',
];

export function validateGuideFrontmatter(frontmatter: GuideFrontmatter): FrontmatterValidationIssue[] {
  const issues: FrontmatterValidationIssue[] = [];

  for (const field of requiredStringFields) {
    if (typeof frontmatter[field] !== 'string' || !frontmatter[field].trim()) {
      issues.push({ path: field, message: `${field} is required.` });
    }
  }

  for (const field of listFields) {
    const value = frontmatter[field];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
      issues.push({ path: field, message: `${field} must be an array of non-empty strings.` });
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.lastVerified)) {
    issues.push({ path: 'lastVerified', message: 'lastVerified must use YYYY-MM-DD format.' });
  }

  if (!frontmatter.sourceRoute.startsWith('/')) {
    issues.push({ path: 'sourceRoute', message: 'sourceRoute must be an application path beginning with /.' });
  }

  return issues;
}

export function renderYamlFrontmatter(frontmatter: GuideFrontmatter): string {
  const scalar = (value: string): string => JSON.stringify(value);
  const list = (values: string[]): string =>
    values.length ? `[${values.map(scalar).join(', ')}]` : '[]';

  return [
    '---',
    `title: ${scalar(frontmatter.title)}`,
    `description: ${scalar(frontmatter.description)}`,
    `audience: ${list(frontmatter.audience)}`,
    `category: ${scalar(frontmatter.category)}`,
    `tags: ${list(frontmatter.tags)}`,
    `estimatedTime: ${scalar(frontmatter.estimatedTime)}`,
    `sourceRoute: ${scalar(frontmatter.sourceRoute)}`,
    `lastVerified: ${scalar(frontmatter.lastVerified)}`,
    `screenshots: ${list(frontmatter.screenshots)}`,
    `sourceJourneyTrace: ${scalar(frontmatter.sourceJourneyTrace)}`,
    `prerequisites: ${list(frontmatter.prerequisites)}`,
    `expectedResults: ${list(frontmatter.expectedResults)}`,
    `relatedGuides: ${list(frontmatter.relatedGuides)}`,
    '---',
  ].join('\n');
}
