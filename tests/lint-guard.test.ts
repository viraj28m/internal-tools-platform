import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..');

/** SPEC §7.2: the guard must fire on DB imports outside /lib/data. */
describe('SPEC §7.2 — DAL import guard', () => {
  it('fails lint for a file outside /lib/data that imports the DB client', async () => {
    const dir = mkdtempSync(path.join(repoRoot, 'lib', 'guard-fixture-'));
    const file = path.join(dir, 'violation.ts');
    writeFileSync(
      file,
      ["import { getDb } from '@/lib/data/db';", '', 'export const db = getDb();', ''].join('\n'),
    );

    try {
      const result = await run('npx', ['eslint', path.relative(repoRoot, file)], { cwd: repoRoot })
        .then(() => ({ code: 0, stdout: '' }))
        .catch((error: { code: number; stdout: string }) => error);

      expect(result.code).not.toBe(0);
      expect(result.stdout).toMatch(/Database access belongs in \/lib\/data/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('allows the DAL itself to import the DB client', async () => {
    await expect(run('npx', ['eslint', 'lib/data'], { cwd: repoRoot })).resolves.toBeTruthy();
  });
});
