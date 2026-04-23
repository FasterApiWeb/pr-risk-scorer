import { exec } from '@actions/exec';
import type { Signal } from './types';

interface DeadCodeResult {
  count: number;
  tool: string;
  items: string[];
}

async function runTsPrune(): Promise<DeadCodeResult | null> {
  let output = '';
  let exitCode = 0;
  try {
    exitCode = await exec('npx', ['ts-prune', '--error'], {
      listeners: {
        stdout: (data: Buffer) => { output += data.toString(); },
        stderr: (_data: Buffer) => { /* suppress */ },
      },
      ignoreReturnCode: true,
    });
  } catch {
    return null;
  }

  if (exitCode === 127) return null; // command not found

  const lines = output
    .split('\n')
    .filter(l => l.trim() && !l.includes('(used in module)'));

  return { count: lines.length, tool: 'ts-prune', items: lines.slice(0, 5) };
}

async function runVulture(): Promise<DeadCodeResult | null> {
  let output = '';
  let exitCode = 0;
  try {
    exitCode = await exec('vulture', ['src/', '--min-confidence', '80'], {
      listeners: {
        stdout: (data: Buffer) => { output += data.toString(); },
        stderr: (_data: Buffer) => { /* suppress */ },
      },
      ignoreReturnCode: true,
    });
  } catch {
    return null;
  }

  if (exitCode === 127) return null;

  const lines = output.split('\n').filter(l => l.trim());
  return { count: lines.length, tool: 'vulture', items: lines.slice(0, 5) };
}

export async function deadCode(): Promise<Signal> {
  const result = (await runTsPrune()) ?? (await runVulture());

  if (!result) {
    return { score: 0, detail: 'Neither ts-prune nor vulture available' };
  }

  const { count, tool, items } = result;
  let score: number;
  if (count === 0) {
    score = 0;
  } else if (count <= 5) {
    score = count * 10;
  } else if (count <= 20) {
    score = 50 + (count - 5) * 2;
  } else {
    score = Math.min(80 + (count - 20), 100);
  }

  const preview = items.length > 0 ? ` (e.g. ${items[0]})` : '';

  return {
    score,
    detail: `${count} unused export(s) found by ${tool}${preview}`,
  };
}
