declare const process: { cwd(): string };

declare module 'node:fs' {
  export interface Stats { isDirectory(): boolean; isFile(): boolean; }
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string): void;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): Stats;
}

declare module 'node:path' {
  export const sep: string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}
