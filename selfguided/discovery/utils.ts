import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ignoredDirectories = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo']);

export function walkFiles(root: string, include: (absolutePath: string) => boolean = () => true): string[] {
  const output: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (ignoredDirectories.has(entry)) continue;
      const absolute = join(dir, entry);
      const stat = statSync(absolute);
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile() && include(absolute)) output.push(absolute);
    }
  };
  visit(root);
  return output.sort();
}

export function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}
