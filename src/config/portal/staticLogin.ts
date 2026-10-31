// Embedded sample accounts and credential material were removed from the combined app.
// Static login is disabled; authentication must use the configured production login API.
export interface StaticLoginEntry { username: string; passwordSha256: string; record: unknown | null }
export const STATIC_LOGINS: StaticLoginEntry[] = [];
export const staticLoginActive = (): boolean => false;
export type StaticLoginResult = { kind: 'match'; record: unknown } | { kind: 'use-api' } | { kind: 'denied' };
export async function resolveStaticLogin(_username: string, _password: string): Promise<StaticLoginResult> {
  return { kind: 'use-api' };
}
