import { execFile, execFileSync } from 'child_process';
import { BACKEND_DIR, NO_RESET, REVISE_CMD, SEED_CMD } from './env';
import { bumpSessionGeneration, getQuoteDetail } from './api';
import { quoteId } from './fixtures';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** QA-02: reset the database to the known seed state (Q-P5: re-running the seed resets without duplicates). */
export function resetSeed(): void {
  if (NO_RESET) return;
  execFileSync(npm, ['run', SEED_CMD, '--silent'], { cwd: BACKEND_DIR, stdio: 'pipe', timeout: 120_000 });
  bumpSessionGeneration(); // cached sessions and the fixtures file may be stale after a reseed
}

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs `npm run seed:revise -- <id>` and returns the raw outcome (TC-070, TC-071 need the exit code). */
export function reviseRaw(id: string): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(npm, ['run', REVISE_CMD, '--silent', '--', id], { cwd: BACKEND_DIR, timeout: 120_000 }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as any).code === 'number' ? (err as any).code : 1) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** QA-02: run seed:revise for a quote (by fixture key or id) and return the new current version number. */
export async function reviseQuote(quoteKeyOrId: string, asUserKey = 'U-51'): Promise<number> {
  let id = quoteKeyOrId;
  try {
    id = quoteId(quoteKeyOrId);
  } catch {
    /* treat as a raw id */
  }
  const r = await reviseRaw(id);
  if (r.code !== 0) throw new Error(`seed:revise failed (${r.code}): ${r.stderr || r.stdout}`);
  const d = await getQuoteDetail(asUserKey, id);
  return d.currentVersionNo;
}
