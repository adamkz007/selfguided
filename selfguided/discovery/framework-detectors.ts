import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Detection, FrameworkMap, SourceRef } from './output-schema';

const packageManagers: Array<[string, string]> = [
  ['package-lock.json', 'npm'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['Gemfile.lock', 'bundler'],
  ['poetry.lock', 'poetry'],
  ['Pipfile.lock', 'pipenv'],
  ['composer.lock', 'composer'],
];

const configFrameworks: Array<[string, string]> = [
  ['next.config.js', 'Next.js'],
  ['next.config.mjs', 'Next.js'],
  ['next.config.ts', 'Next.js'],
  ['remix.config.js', 'Remix'],
  ['vite.config.ts', 'Vite'],
  ['vite.config.js', 'Vite'],
  ['config/routes.rb', 'Rails'],
  ['manage.py', 'Django'],
  ['artisan', 'Laravel'],
];

const dependencyFrameworks: Array<[string, string]> = [
  ['next', 'Next.js'],
  ['@remix-run/react', 'Remix'],
  ['react-router', 'React Router'],
  ['@rails/actioncable', 'Rails'],
  ['django', 'Django'],
  ['laravel', 'Laravel'],
];

export function detectFramework(root: string): FrameworkMap {
  const frameworks = new Map<string, Detection>();
  const configFiles: SourceRef[] = [];
  const detectedPackageManagers: Detection[] = [];
  const routingConventions: Detection[] = [];

  for (const [file, name] of packageManagers) {
    if (existsSync(join(root, file))) {
      detectedPackageManagers.push({ name, confidence: 'high', sources: [{ path: file, kind: 'lockfile' }] });
    }
  }

  for (const [file, name] of configFrameworks) {
    if (existsSync(join(root, file))) {
      const source = { path: file, kind: 'framework-config' };
      configFiles.push(source);
      frameworks.set(name, { name, confidence: 'high', sources: [source] });
    }
  }

  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    configFiles.push({ path: 'package.json', kind: 'package-manifest' });
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const [dep, name] of dependencyFrameworks) {
      if (deps[dep]) {
        frameworks.set(name, {
          name,
          confidence: 'high',
          sources: [{ path: 'package.json', kind: `dependency:${dep}` }],
          metadata: { version: deps[dep] },
        });
      }
    }
  }

  const conventions: Array<[string, string]> = [
    ['app', 'Next.js app router'],
    ['pages', 'Next.js pages router'],
    ['src/routes', 'Remix/React Router routes'],
    ['app/controllers', 'Rails controllers'],
    ['routes/web.php', 'Laravel web routes'],
    ['urls.py', 'Django URL config'],
  ];

  for (const [file, name] of conventions) {
    if (existsSync(join(root, file))) {
      routingConventions.push({ name, confidence: 'medium', sources: [{ path: file, kind: 'routing-convention' }] });
    }
  }

  return { frameworks: [...frameworks.values()], packageManagers: detectedPackageManagers, configFiles, routingConventions };
}
