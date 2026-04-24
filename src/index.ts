import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { Octokit } from '@octokit/rest';

import { filesChanged } from './signals/filesChanged';
import { complexityDelta } from './signals/complexityDelta';
import { coverageRatio } from './signals/coverageRatio';
import { migrationFiles } from './signals/migrationFiles';
import { deadCode } from './signals/deadCode';
import type { Signal } from './signals/types';
import { postComment } from './comment';
import { runNotifications } from './notifications/index';
import type { NotificationsConfig } from './notifications/index';
import type { RiskBand, ScoreResult } from './scorer';

interface Config {
  weights?: {
    filesChanged?: number;
    complexityDelta?: number;
    coverageRatio?: number;
    migrationFiles?: number;
    deadCode?: number;
  };
  thresholds?: {
    medium?: number;
    high?: number;
  };
  block_merge?: number;
  required_approvers?: string[];
  notifications?: NotificationsConfig;
}

const DEFAULT_WEIGHTS = {
  filesChanged: 0.20,
  complexityDelta: 0.30,
  coverageRatio: 0.20,
  migrationFiles: 0.15,
  deadCode: 0.15,
};

const DEFAULT_THRESHOLDS = { medium: 40, high: 70 };

function loadConfig(configPath: string): Config {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) return {};
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8')) as Config;
  } catch {
    core.warning(`Could not parse config at ${configPath}, using defaults`);
    return {};
  }
}

function riskLabel(score: number, thresholds: { medium: number; high: number }): string {
  if (score < thresholds.medium) return 'LOW';
  if (score <= thresholds.high) return 'MEDIUM';
  return 'HIGH';
}

async function run(): Promise<void> {
  const token = core.getInput('github-token', { required: true });
  const configPath = core.getInput('config-path') || '.github/pr-risk-scorer.json';
  const workspace = process.env['GITHUB_WORKSPACE'] ?? '.';

  const config = loadConfig(path.join(workspace, configPath));
  const weights = { ...DEFAULT_WEIGHTS, ...config.weights };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };

  core.info('Running PR risk signal collectors…');

  const [fc, cd, cr, mf, dc] = await Promise.allSettled([
    filesChanged(token),
    complexityDelta(token),
    coverageRatio(workspace),
    migrationFiles(workspace),
    deadCode(),
  ]);

  function resolve(result: PromiseSettledResult<Signal>, name: string): Signal {
    if (result.status === 'fulfilled') return result.value;
    core.warning(`Signal ${name} failed: ${String(result.reason)}`);
    return { score: 0, detail: `error: ${String(result.reason)}` };
  }

  const signals: Record<string, Signal> = {
    filesChanged: resolve(fc, 'filesChanged'),
    complexityDelta: resolve(cd, 'complexityDelta'),
    coverageRatio: resolve(cr, 'coverageRatio'),
    migrationFiles: resolve(mf, 'migrationFiles'),
    deadCode: resolve(dc, 'deadCode'),
  };

  const totalScore = Math.round(
    Object.entries(signals).reduce((sum, [key, signal]) => {
      const weight = weights[key as keyof typeof weights] ?? 0;
      return sum + signal.score * weight;
    }, 0),
  );

  const band = riskLabel(totalScore, thresholds);

  core.info('');
  core.info(`Risk score: ${totalScore} (${band})`);
  for (const [name, signal] of Object.entries(signals)) {
    const weight = weights[name as keyof typeof weights] ?? 0;
    core.info(`  ${name}: ${signal.score} (weight ${weight}) — ${signal.detail}`);
  }

  core.setOutput('risk-score', String(totalScore));
  core.setOutput('risk-label', band);

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const sha =
    (github.context.payload.pull_request?.head?.sha as string | undefined) ??
    github.context.sha;

  const state: 'failure' | 'success' =
    config.block_merge !== undefined && totalScore >= config.block_merge
      ? 'failure'
      : 'success';

  await octokit.rest.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state,
    context: 'pr-risk-scorer',
    description: `Risk: ${totalScore}/100 — ${band}`,
  });

  if ((band === 'MEDIUM' || band === 'HIGH') && config.required_approvers?.length) {
    const approvers = config.required_approvers
      .map(a => (a.startsWith('@') ? a : `@${a}`))
      .join(' ');
    const codeownersContent = `* ${approvers}\n`;
    const codeownersPath = '.github/CODEOWNERS';
    const branch = github.context.payload.pull_request?.head?.ref as string | undefined;

    let existingFileSha: string | undefined;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: codeownersPath,
        ...(branch !== undefined && { ref: branch }),
      });
      if (!Array.isArray(data)) existingFileSha = data.sha;
    } catch {
      // File does not exist yet; will be created
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: codeownersPath,
      message: `chore: set required approvers for ${band.toLowerCase()} risk PR`,
      content: Buffer.from(codeownersContent).toString('base64'),
      ...(existingFileSha !== undefined && { sha: existingFileSha }),
      ...(branch !== undefined && { branch }),
    });
  }

  const prPayload = github.context.payload.pull_request;
  const prNumber = prPayload?.number as number | undefined;

  if (prNumber !== undefined && prPayload !== undefined) {
    const restOctokit = octokit as unknown as Octokit;
    const threshold = thresholds.medium;

    const scoreResult: ScoreResult = {
      total: totalScore,
      band: band.toLowerCase() as RiskBand,
      signals: Object.entries(signals).map(([name, signal]) => ({
        name,
        score: signal.score,
        weight: (weights[name as keyof typeof weights] ?? 0) * 100,
        detail: signal.detail,
      })),
    };

    await postComment(restOctokit, owner, repo, prNumber, scoreResult, threshold);

    if (config.notifications !== undefined) {
      const prContext = {
        prTitle: (prPayload.title as string | undefined) ?? `${owner}/${repo}#${prNumber}`,
        prUrl: (prPayload.html_url as string | undefined) ?? `https://github.com/${owner}/${repo}/pull/${prNumber}`,
        branchName: (prPayload.head?.ref as string | undefined) ?? '',
      };

      const notifResults = await runNotifications(config.notifications, scoreResult, prContext);
      await postComment(restOctokit, owner, repo, prNumber, scoreResult, threshold, notifResults);
    }
  }
}

run().catch(err => {
  core.setFailed(String(err));
});
