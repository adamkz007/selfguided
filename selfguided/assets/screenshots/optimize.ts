import { copyFileSync, mkdirSync, statSync } from 'node:fs';

export interface OptimizationResult {
  inputPath: string;
  outputPath: string;
  originalBytes: number;
  optimizedBytes: number;
  format: 'png' | 'webp' | 'jpeg' | 'unknown';
  warnings: string[];
}

export async function optimizeImage(inputPath: string, outputPath: string): Promise<OptimizationResult> {
  mkdirSync(parentDirectory(outputPath), { recursive: true });
  const before = statSync(inputPath);
  copyFileSync(inputPath, outputPath);
  const after = statSync(outputPath);
  return {
    inputPath,
    outputPath,
    originalBytes: before.size,
    optimizedBytes: after.size,
    format: detectFormat(outputPath),
    warnings: ['No image optimizer dependency is bundled; copied the image to the optimized output path.'],
  };
}

function detectFormat(path: string): OptimizationResult['format'] {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png' || ext === 'webp' || ext === 'jpeg') return ext;
  if (ext === 'jpg') return 'jpeg';
  return 'unknown';
}

function parentDirectory(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index > 0 ? path.slice(0, index) : '.';
}
