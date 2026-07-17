export type Confidence = 'low' | 'medium' | 'high';

export interface SourceRef {
  path: string;
  line?: number;
  kind?: string;
}

export interface Detection<T = Record<string, unknown>> {
  name: string;
  confidence: Confidence;
  sources: SourceRef[];
  metadata?: T;
}

export interface FrameworkMap {
  frameworks: Detection[];
  packageManagers: Detection[];
  configFiles: SourceRef[];
  routingConventions: Detection[];
}

export interface RouteEntry {
  path: string;
  kind: 'app' | 'api' | 'marketing' | 'dashboard' | 'admin' | 'auth' | 'protected' | 'unknown';
  source: SourceRef;
  protection?: Detection[];
  metadata?: Record<string, unknown>;
}

export interface NavigationMap {
  sidebars: SourceRef[];
  headers: SourceRef[];
  navComponents: SourceRef[];
  routeConstants: SourceRef[];
  breadcrumbs: SourceRef[];
}

export interface DomainMap {
  databaseModels: Detection[];
  apiRoutes: SourceRef[];
  graphqlSchemas: SourceRef[];
  trpcRouters: SourceRef[];
  serverActions: SourceRef[];
  serviceObjects: SourceRef[];
}

export interface AuthMap {
  loginPaths: RouteEntry[];
  signupPaths: RouteEntry[];
  sessionProviders: Detection[];
  roleChecks: Detection[];
  permissionGates: Detection[];
}

export interface ThemeMap {
  tailwindConfig: SourceRef[];
  cssVariables: Detection[];
  designTokens: SourceRef[];
  componentLibraries: Detection[];
  typography: Detection[];
  spacing: Detection[];
}

export interface DocsMap {
  markdownFiles: SourceRef[];
  helpCenterContent: SourceRef[];
  tooltips: Detection[];
  emptyStates: Detection[];
  onboardingCopy: Detection[];
}

export interface ApplicationMap {
  generatedAt: string;
  root: string;
  framework: FrameworkMap;
  routes: RouteEntry[];
  navigation: NavigationMap;
  domain: DomainMap;
  auth: AuthMap;
  theme: ThemeMap;
  docs: DocsMap;
}
