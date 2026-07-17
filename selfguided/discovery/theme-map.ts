import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ThemeMap } from './output-schema';
import { readText, walkFiles } from './utils';

export function buildThemeMap(root: string): ThemeMap {
  const tailwindConfig = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs'].filter((path) => existsSync(join(root, path))).map((path) => ({ path, kind: 'tailwind-config' }));
  const cssFiles = walkFiles(root, (file) => /\.(css|scss|sass|less)$/.test(file));
  const componentLibraries = [];
  const cssVariables = [];
  const typography = [];
  const spacing = [];

  const packageJson = join(root, 'package.json');
  if (existsSync(packageJson)) {
    const content = readText(packageJson);
    for (const lib of ['@mui/material', 'antd', '@chakra-ui/react', 'shadcn', '@radix-ui/react-slot', 'tailwindcss']) {
      if (content.includes(`"${lib}"`)) componentLibraries.push({ name: lib, confidence: 'high' as const, sources: [{ path: 'package.json' }] });
    }
  }

  for (const absolute of cssFiles) {
    const path = relative(root, absolute);
    const content = readText(absolute);
    if (/--[a-z0-9-]+\s*:/i.test(content)) cssVariables.push({ name: 'CSS variables', confidence: 'high' as const, sources: [{ path }] });
    if (/font-family|font-size|line-height|text-/.test(content)) typography.push({ name: 'Typography conventions', confidence: 'medium' as const, sources: [{ path }] });
    if (/spacing|gap|margin|padding|space-/.test(content)) spacing.push({ name: 'Spacing conventions', confidence: 'medium' as const, sources: [{ path }] });
  }

  const designTokens = walkFiles(root, (file) => /tokens|theme|design-system/i.test(file)).map((file) => ({ path: relative(root, file), kind: 'design-token-source' }));
  return { tailwindConfig, cssVariables, designTokens, componentLibraries, typography, spacing };
}
