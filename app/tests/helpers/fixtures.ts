import * as fs from 'fs';
import { DEFAULT_PASSWORD, FIXTURES_PATH } from './env';

// Shape written by `npm run seed` (app/BUILD-DECISIONS.md):
// { orgs: {"ORG-0":{id,name}}, users: {"U-51":{email,password,orgKey}}, quotes: {"Q-MULTI":{id,reference}} }
export interface Fixtures {
  orgs: Record<string, { id: string; name?: string; quoteIds?: string[] }>;
  users: Record<string, { email: string; password?: string; orgKey?: string }>;
  quotes: Record<string, any>;
}

// Always read fresh: the seed (and therefore the fixtures file) can be rewritten by resetSeed().
export function loadFixtures(): Fixtures {
  if (!fs.existsSync(FIXTURES_PATH)) {
    throw new Error(`Fixtures file not found at ${FIXTURES_PATH}. Run "npm run seed" in app/backend first.`);
  }
  const f = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));
  return { orgs: f.orgs ?? {}, users: f.users ?? {}, quotes: f.quotes ?? {} };
}

function pick<T>(group: Record<string, T>, key: string, kind: string): T {
  if (group[key]) return group[key];
  const alt = Object.keys(group).find((k) => k.toLowerCase() === key.toLowerCase());
  if (alt) return group[alt];
  throw new Error(`Fixture ${kind} "${key}" missing. Available: ${Object.keys(group).join(', ')}`);
}

export function org(key: string) {
  return pick(loadFixtures().orgs, key, 'org');
}
export function user(key: string) {
  const u = pick(loadFixtures().users, key, 'user');
  return { key, email: u.email, password: u.password ?? DEFAULT_PASSWORD, orgKey: u.orgKey };
}
export function quote(key: string) {
  return pick(loadFixtures().quotes, key, 'quote') as { id: string; reference: string; title?: string; orgKey?: string };
}
export function quoteId(key: string): string {
  return String(quote(key).id);
}
export function orgId(key: string): string {
  return String(org(key).id);
}
/** Ids of the Q-TIES group. Accepts an array, {ids:[...]}, or keys named Q-TIES-1, Q-TIES-2 ... */
export function tiesIds(): string[] {
  const q = loadFixtures().quotes;
  const g = q['Q-TIES'];
  if (Array.isArray(g)) return g.map((x) => String(x.id ?? x));
  if (g && Array.isArray(g.ids)) return g.ids.map(String);
  if (g && Array.isArray(g.quotes)) return g.quotes.map((x: any) => String(x.id ?? x));
  const keys = Object.keys(q).filter((k) => /^Q-TIES[-_]?\d*$/i.test(k) && k !== 'Q-TIES');
  if (keys.length) return keys.map((k) => String(q[k].id));
  throw new Error('Q-TIES ids not found in fixtures (expected array, {ids}, or Q-TIES-n keys).');
}
