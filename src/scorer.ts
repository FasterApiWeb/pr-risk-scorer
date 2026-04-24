import { spawnSync } from 'child_process';
import { filesChanged } from './signals/filesChanged';
import { complexityDelta } from './signals/complexityDelta';
import { coverageRatio } from './signals/coverageRatio';
import { migrationFiles } from './signals/migrationFiles';
import { deadCode } from './signals/deadCode';
import { secretLeak } from './signals/secretLeak';
import type { Signal } from './signals/types';

export interface WeightConfig {
  filesChanged?: number;
  complexityDelta?: number;
  coverageRatio?: number;
  migrationFiles?: number;
  deadCode?: number;
}

export interface ThresholdConfig {
  medium?: number;
  high?: number;
}

export interface ScorerConfig {
  weights?: WeightConfig;
  thresholds?: ThresholdConfig;
}

export interface SignalResult {
  name: string;
  score: number;
  weight: number;
  detail: string;
}

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ScoreResult {
  total: number;
  band: RiskBand;
  signals: SignalResult[];
}

const DEFAULT_WEIGHTS: Required<WeightConfig> = {
  filesChanged: 0.20,
  complexityDelta: 0.30,
  coverageRatio: 0.20,
  migrationFiles: 0.15,
  deadCode: 0.15,
};

const DEFAULT_THRESHOLDS = { medium: 40, high: 70 };

function toBand(total: number, thresholds: { medium: number; high: number }): RiskBand {
  if (total < thresholds.medium) return 'LOW';
  if (total <= thresholds.high) return 'MEDIUM';
  return 'HIGH';
}

function fetchGitDiff(workspaceDir: string): string {
  try {
    const result = spawnSync('git', ['diff', 'HEAD~1'], {
      cwd: workspaceDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.stdout ?? '';
  } catch {
    return '';
  }
}

export async function score(
  token: string,
  workspaceDir = '.',
  config: ScorerConfig = {},
): Promise<ScoreResult> {
  const weights = { ...DEFAULT_WEIGHTS, ...config.weights };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };

  const diff = fetchGitDiff(workspaceDir);

  const [fc, cd, cr, mf, dc, sl] = await Promise.allSettled([
    filesChanged(token),
    complexityDelta(token),
    coverageRatio(workspaceDir),
    migrationFiles(workspaceDir),
    deadCode(),
    secretLeak(diff),
  ]);

  function resolve(result: PromiseSettledResult<Signal>, name: string): Signal {
    if (result.status === 'fulfilled') return result.value;
    return { score: 0, detail: `error: ${String(result.reason)}` };
  }

  const named: Array<{ name: keyof Required<WeightConfig>; signal: Signal }> = [
    { name: 'filesChanged', signal: resolve(fc, 'filesChanged') },
    { name: 'complexityDelta', signal: resolve(cd, 'complexityDelta') },
    { name: 'coverageRatio', signal: resolve(cr, 'coverageRatio') },
    { name: 'migrationFiles', signal: resolve(mf, 'migrationFiles') },
    { name: 'deadCode', signal: resolve(dc, 'deadCode') },
  ];

  const signals: SignalResult[] = named.map(({ name, signal }) => ({
    name,
    score: signal.score,
    weight: weights[name],
    detail: signal.detail,
  }));

  const weightSum = signals.reduce((s, r) => s + r.weight, 0);
  const weightedSum = signals.reduce((s, r) => s + r.score * r.weight, 0);
  const baseTotal = weightSum > 0
    ? Math.min(100, Math.max(0, Math.round(weightedSum / weightSum)))
    : 0;

  const slResult = sl.status === 'fulfilled'
    ? sl.value
    : { score: 0, triggered: false, detail: `error: ${String(sl.reason)}` };

  signals.push({ name: 'secretLeak', score: slResult.score, weight: 0, detail: slResult.detail });

  const total = Math.min(100, baseTotal + slResult.score);
  const band: RiskBand = slResult.triggered ? 'CRITICAL' : toBand(total, thresholds);

  return { total, band, signals };
}
