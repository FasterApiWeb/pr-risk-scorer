import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

import { filesChanged } from './signals/filesChanged';
import { complexityDelta } from './signals/complexityDelta';
import { coverageRatio } from './signals/coverageRatio';
import { migrationFiles } from './signals/migrationFiles';
import { deadCode } from './signals/deadCode';
import type { Signal } from './signals/types';

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

  const label = riskLabel(totalScore, thresholds);

  core.info('');
  core.info(`Risk score: ${totalScore} (${label})`);
  for (const [name, signal] of Object.entries(signals)) {
    const weight = weights[name as keyof typeof weights] ?? 0;
    core.info(`  ${name}: ${signal.score} (weight ${weight}) — ${signal.detail}`);
  }

  core.setOutput('risk-score', String(totalScore));
  core.setOutput('risk-label', label);
}

run().catch(err => {
  core.setFailed(String(err));
});
