import { exec } from '@actions/exec';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export interface SecretLeakResult {
  score: number;
  triggered: boolean;
  detail: string;
}

export async function secretLeak(diff: string): Promise<SecretLeakResult> {
  if (!diff.trim()) {
    return { score: 0, triggered: false, detail: 'clean' };
  }

  let tempDir: string | undefined;

  try {
    tempDir = await mkdtemp(join(tmpdir(), 'pr-risk-gitleaks-'));
    const tempFile = join(tempDir, 'diff.patch');
    await writeFile(tempFile, diff, 'utf8');

    let stdout = '';
    let exitCode = 0;

    try {
      exitCode = await exec(
        'gitleaks',
        ['detect', '--source', tempFile, '--no-git', '--redact'],
        {
          listeners: {
            stdout: (data: Buffer) => { stdout += data.toString(); },
            stderr: (_data: Buffer) => { /* suppress */ },
          },
          ignoreReturnCode: true,
        },
      );
    } catch {
      return { score: 0, triggered: false, detail: 'gitleaks unavailable' };
    }

    if (exitCode === 127) {
      return { score: 0, triggered: false, detail: 'gitleaks unavailable' };
    }

    if (exitCode === 0) {
      return { score: 0, triggered: false, detail: 'clean' };
    }

    const count = parseLeakCount(stdout);
    return {
      score: 15,
      triggered: true,
      detail: `${count} secret${count !== 1 ? 's' : ''} found`,
    };

  } catch {
    return { score: 0, triggered: false, detail: 'gitleaks unavailable' };
  } finally {
    if (tempDir) {
      try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

function parseLeakCount(output: string): number {
  const summaryMatch = output.match(/(\d+)\s+leaks?\s+detected/i);
  if (summaryMatch) return parseInt(summaryMatch[1], 10);

  const ruleMatches = [...output.matchAll(/RuleID:/gi)];
  if (ruleMatches.length > 0) return ruleMatches.length;

  return 1;
}
