import { relative } from 'node:path';
import type { AuthMap, RouteEntry } from './output-schema';
import { readText, walkFiles } from './utils';

export function buildAuthMap(root: string, routes: RouteEntry[]): AuthMap {
  const loginPaths = routes.filter((route) => /\/(login|signin|sign-in)$/i.test(route.path));
  const signupPaths = routes.filter((route) => /\/(signup|register|sign-up)$/i.test(route.path));
  const sessionProviders = [];
  const roleChecks = [];
  const permissionGates = [];

  for (const absolute of walkFiles(root, (file) => /\.(tsx?|jsx?|rb|php|py)$/.test(file))) {
    const path = relative(root, absolute);
    const content = readText(absolute);
    if (/SessionProvider|AuthProvider|getServerSession|createServerClient|current_user|Auth::user|request\.user/.test(content)) {
      sessionProviders.push({ name: 'Session provider', confidence: 'medium' as const, sources: [{ path }] });
    }
    if (/role|roles|isAdmin|adminOnly|can\?|hasRole|permission/i.test(content)) {
      roleChecks.push({ name: 'Role check', confidence: 'medium' as const, sources: [{ path }] });
    }
    if (/PermissionGate|CanCan|policy|authorize|Ability|Gate::|@can/.test(content)) {
      permissionGates.push({ name: 'Permission gate', confidence: 'medium' as const, sources: [{ path }] });
    }
  }
  return { loginPaths, signupPaths, sessionProviders, roleChecks, permissionGates };
}
