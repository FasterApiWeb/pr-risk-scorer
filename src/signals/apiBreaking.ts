import { exec } from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';

export interface ApiBreakingResult {
  score: number;
  detail: string;
  breakingCount: number;
}

const SPEC_CANDIDATES = [
  'openapi.yaml',
  'openapi.yml',
  'openapi.json',
  'docs/openapi.yaml',
  'docs/openapi.yml',
  'docs/openapi.json',
];

function findSpec(workspaceDir: string): string | null {
  for (const rel of SPEC_CANDIDATES) {
    if (fs.existsSync(path.join(workspaceDir, rel))) return rel;
  }
  return null;
}

function baseRef(): string {
  return process.env.GITHUB_BASE_REF || 'main';
}

async function gitShow(workspaceDir: string, ref: string, file: string): Promise<string | null> {
  let output = '';
  let exitCode = 0;
  try {
    exitCode = await exec('git', ['show', `${ref}:${file}`], {
      cwd: workspaceDir,
      listeners: {
        stdout: (data: Buffer) => { output += data.toString(); },
        stderr: (_data: Buffer) => { /* suppress */ },
      },
      ignoreReturnCode: true,
      silent: true,
    });
  } catch {
    return null;
  }
  if (exitCode !== 0) return null;
  return output;
}

function extractBreakings(parsed: unknown): string[] {
  const out: string[] = [];
  const push = (item: unknown) => {
    if (typeof item === 'string') out.push(item);
    else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const desc = obj.description ?? obj.message ?? obj.action ?? obj.path;
      out.push(typeof desc === 'string' ? desc : JSON.stringify(obj));
    }
  };

  if (!parsed || typeof parsed !== 'object') return out;
  const root = parsed as Record<string, unknown>;

  for (const key of ['breakingDifferences', 'breakingChanges', 'breaking']) {
    const arr = root[key];
    if (Array.isArray(arr)) arr.forEach(push);
  }
  return out;
}

async function runOpenApiDiff(workspaceDir: string, specPath: string): Promise<string[] | null> {
  let tempDir: string | undefined;
  try {
    const baseContent = await gitShow(workspaceDir, baseRef(), specPath);
    if (baseContent === null) return null;

    tempDir = await mkdtemp(path.join(tmpdir(), 'pr-risk-apibreaking-'));
    const baseSpec = path.join(tempDir, `base-${path.basename(specPath)}`);
    const headSpec = path.join(tempDir, `head-${path.basename(specPath)}`);
    await writeFile(baseSpec, baseContent, 'utf8');
    await writeFile(headSpec, fs.readFileSync(path.join(workspaceDir, specPath), 'utf8'), 'utf8');

    let stdout = '';
    let exitCode = 0;
    try {
      exitCode = await exec('openapi-diff', [baseSpec, headSpec, '--json'], {
        listeners: {
          stdout: (data: Buffer) => { stdout += data.toString(); },
          stderr: (_data: Buffer) => { /* suppress */ },
        },
        ignoreReturnCode: true,
      });
    } catch {
      return null;
    }
    if (exitCode === 127) return null;

    try {
      return extractBreakings(JSON.parse(stdout));
    } catch {
      return null;
    }
  } finally {
    if (tempDir) {
      try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

async function getChangedDtsFiles(workspaceDir: string): Promise<string[]> {
  let output = '';
  try {
    await exec('git', ['diff', '--name-only', `origin/${baseRef()}...HEAD`], {
      cwd: workspaceDir,
      listeners: {
        stdout: (data: Buffer) => { output += data.toString(); },
        stderr: (_data: Buffer) => { /* suppress */ },
      },
      ignoreReturnCode: true,
      silent: true,
    });
  } catch {
    return [];
  }
  return output
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.endsWith('.d.ts') && fs.existsSync(path.join(workspaceDir, l)));
}

async function runTscOnDts(workspaceDir: string, files: string[]): Promise<string[] | null> {
  let output = '';
  let exitCode = 0;
  try {
    exitCode = await exec('npx', ['tsc', '--noEmit', ...files], {
      cwd: workspaceDir,
      listeners: {
        stdout: (data: Buffer) => { output += data.toString(); },
        stderr: (data: Buffer) => { output += data.toString(); },
      },
      ignoreReturnCode: true,
    });
  } catch {
    return null;
  }
  if (exitCode === 127) return null;

  const changedSet = new Set(files.map(f => path.normalize(f)));
  return output
    .split('\n')
    .filter(line => {
      if (!/error TS\d+/.test(line)) return false;
      const fileMatch = line.match(/^([^(]+)\(/);
      if (!fileMatch) return false;
      return changedSet.has(path.normalize(fileMatch[1].trim()));
    });
}

export async function apiBreaking(workspaceDir: string = '.'): Promise<ApiBreakingResult> {
  const changes: string[] = [];
  let ran = false;

  const specPath = findSpec(workspaceDir);
  if (specPath) {
    ran = true;
    const diffs = await runOpenApiDiff(workspaceDir, specPath);
    if (diffs) changes.push(...diffs);
  }

  const hasTsconfig = fs.existsSync(path.join(workspaceDir, 'tsconfig.json'));
  if (hasTsconfig) {
    const dtsFiles = await getChangedDtsFiles(workspaceDir);
    if (dtsFiles.length > 0) {
      ran = true;
      const errors = await runTscOnDts(workspaceDir, dtsFiles);
      if (errors) changes.push(...errors);
    }
  }

  if (!ran) {
    return { score: 0, detail: 'skipped: no API spec found', breakingCount: 0 };
  }

  const breakingCount = changes.length;
  const score = Math.min(5, breakingCount * 3);

  if (breakingCount === 0) {
    return { score: 0, detail: 'no breaking changes detected', breakingCount: 0 };
  }

  const preview = changes.slice(0, 5).join('; ');
  const overflow = breakingCount > 5 ? `; …and ${breakingCount - 5} more` : '';
  return {
    score,
    detail: `${breakingCount} breaking change(s): ${preview}${overflow}`,
    breakingCount,
  };
}
