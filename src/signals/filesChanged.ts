import * as github from '@actions/github';
import type { Signal } from './types';

// Score bands: 1-10 files → low risk, 11-50 → medium, 50+ → high
const THRESHOLDS = { low: 10, medium: 50 };

export async function filesChanged(token: string): Promise<Signal> {
  const context = github.context;
  const octokit = github.getOctokit(token);

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request?.number ?? 0,
    per_page: 100,
  });

  const count = files.length;
  const additions = files.reduce((s, f) => s + f.additions, 0);
  const deletions = files.reduce((s, f) => s + f.deletions, 0);
  const changed = additions + deletions;

  let score: number;
  if (count <= THRESHOLDS.low) {
    score = (count / THRESHOLDS.low) * 30;
  } else if (count <= THRESHOLDS.medium) {
    score = 30 + ((count - THRESHOLDS.low) / (THRESHOLDS.medium - THRESHOLDS.low)) * 40;
  } else {
    score = Math.min(70 + ((count - THRESHOLDS.medium) / 50) * 30, 100);
  }

  return {
    score: Math.round(score),
    detail: `${count} files changed (+${additions}/-${deletions}, ${changed} lines total)`,
  };
}
