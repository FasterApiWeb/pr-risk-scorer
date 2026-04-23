import { exec } from '@actions/exec';
import * as github from '@actions/github';
import type { Signal } from './types';

// lizard avg CCN thresholds: ≤5 low, ≤10 medium, >10 high
const CCN_LOW = 5;
const CCN_HIGH = 10;

async function getChangedFiles(token: string): Promise<string[]> {
  const context = github.context;
  const octokit = github.getOctokit(token);
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request?.number ?? 0,
    per_page: 100,
  });
  return files
    .filter(f => /\.(py|js|ts|java|cpp|c|cs|go|rb|swift|kt)$/.test(f.filename))
    .map(f => f.filename);
}

export async function complexityDelta(token: string): Promise<Signal> {
  let files: string[];
  try {
    files = await getChangedFiles(token);
  } catch {
    return { score: 0, detail: 'Could not fetch changed files' };
  }

  if (files.length === 0) {
    return { score: 0, detail: 'No analysable source files changed' };
  }

  let output = '';
  try {
    await exec('lizard', [...files, '--csv'], {
      listeners: {
        stdout: (data: Buffer) => { output += data.toString(); },
        stderr: (_data: Buffer) => { /* suppress */ },
      },
      ignoreReturnCode: true,
    });
  } catch {
    return { score: 0, detail: 'lizard not available' };
  }

  const ccnValues: number[] = [];
  for (const line of output.split('\n')) {
    const parts = line.split(',');
    // lizard CSV: cyclomatic_complexity is column index 2
    if (parts.length >= 3) {
      const ccn = parseFloat(parts[2]);
      if (!isNaN(ccn)) ccnValues.push(ccn);
    }
  }

  if (ccnValues.length === 0) {
    return { score: 0, detail: 'No functions analysed by lizard' };
  }

  const avg = ccnValues.reduce((a, b) => a + b, 0) / ccnValues.length;
  const max = Math.max(...ccnValues);
  let score: number;
  if (avg <= CCN_LOW) {
    score = (avg / CCN_LOW) * 30;
  } else if (avg <= CCN_HIGH) {
    score = 30 + ((avg - CCN_LOW) / (CCN_HIGH - CCN_LOW)) * 40;
  } else {
    score = Math.min(70 + ((avg - CCN_HIGH) / 10) * 30, 100);
  }

  return {
    score: Math.round(score),
    detail: `avg CCN ${avg.toFixed(1)}, max CCN ${max} across ${ccnValues.length} functions`,
  };
}
