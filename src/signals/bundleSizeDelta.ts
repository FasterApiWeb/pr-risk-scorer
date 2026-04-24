import * as fs from 'fs';
import * as path from 'path';
import { exec } from '@actions/exec';

export interface BundleSizeResult {
  score: number;
  detail: string;
}

interface SizeLimitEntry {
  name: string;
  size: number;
  limit?: number;
  passed: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function bundleSizeDelta(workspaceDir: string = '.'): Promise<BundleSizeResult> {
  const pkgPath = path.join(workspaceDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return { score: 0, detail: 'skipped: no size-limit config' };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return { score: 0, detail: 'skipped: no size-limit config' };
  }

  if (!pkg['size-limit']) {
    return { score: 0, detail: 'skipped: no size-limit config' };
  }

  let stdout = '';
  let stderr = '';

  try {
    await exec('npx', ['size-limit', '--json'], {
      cwd: workspaceDir,
      listeners: {
        stdout: (data: Buffer) => { stdout += data.toString(); },
        stderr: (data: Buffer) => { stderr += data.toString(); },
      },
      ignoreReturnCode: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { score: 0, detail: `size-limit error: ${msg}` };
  }

  let entries: SizeLimitEntry[];
  try {
    entries = JSON.parse(stdout);
  } catch {
    const errMsg = (stderr.trim() || stdout.trim()) || 'unknown error';
    return { score: 0, detail: `size-limit error: ${errMsg}` };
  }

  if (!Array.isArray(entries)) {
    return { score: 0, detail: 'size-limit error: unexpected output format' };
  }

  const failed = entries.filter(e => e.passed === false);

  if (failed.length === 0) {
    return { score: 0, detail: 'all size-limit checks passed' };
  }

  const score = Math.min(5, failed.length * 2);

  const detail = failed
    .map(e => {
      const actual = formatBytes(e.size);
      const limit = e.limit !== undefined ? formatBytes(e.limit) : 'no limit';
      return `${e.name}: ${actual} (limit ${limit})`;
    })
    .join('; ');

  return { score, detail };
}
