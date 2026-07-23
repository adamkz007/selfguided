export const defaultGuideCategories = [
  'Getting started', 'Account setup', 'Workspace setup', 'Team management', 'Core workflows',
  'Data import/export', 'Integrations', 'Reporting', 'Billing', 'Security and permissions', 'Troubleshooting',
] as const;

export interface GuideTaxonomy {
  categories: readonly string[];
}

export const defaultGuideTaxonomy: GuideTaxonomy = { categories: defaultGuideCategories };

export function isKnownGuideCategory(category: string, taxonomy: GuideTaxonomy = defaultGuideTaxonomy): boolean {
  return taxonomy.categories.includes(category);
}
