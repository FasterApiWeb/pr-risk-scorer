import type { Signal } from './signals/types';
import type { SecretLeakResult } from './signals/secretLeak';
import type { BundleSizeResult } from './signals/bundleSizeDelta';
import type { ApiBreakingResult } from './signals/apiBreaking';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface ScorerInput {
  filesChanged: Signal;
  complexityDelta: Signal;
  coverageRatio: Signal;
  migrationFiles: Signal;
  deadCode: Signal;
  secretLeak: SecretLeakResult;
  bundleSize: BundleSizeResult;
  apiBreaking: ApiBreakingResult;
}

export interface WeightConfig {
  filesChanged?: number;
  complexityDelta?: number;
  coverageRatio?: number;
  migrationFiles?: number;
  deadCode?: number;
  secret_leak?: number;
  bundle_size_delta?: number;
  api_breaking_changes?: number;
}

export interface ThresholdConfig {
  medium?: number;
  high?: number;
  critical?: number;
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

export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

export interface ScoreResult {
  total: number;
  band: RiskBand;
  signals: SignalResult[];
  override?: string;
}

const DEFAULT_WEIGHTS: Required<WeightConfig> = {
  filesChanged: 15,
  complexityDelta: 20,
  coverageRatio: 15,
  migrationFiles: 10,
  deadCode: 10,
  secret_leak: 10,
  bundle_size_delta: 10,
  api_breaking_changes: 10,
};

const DEFAULT_THRESHOLDS: Required<ThresholdConfig> = {
  medium: 40,
  high: 70,
  critical: 81,
};

function toBand(total: number, thresholds: Required<ThresholdConfig>): RiskBand {
  if (total >= thresholds.critical) return 'critical';
  if (total > thresholds.high) return 'high';
  if (total >= thresholds.medium) return 'medium';
  return 'low';
}

function validateWeights(weights: Required<WeightConfig>): void {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new ConfigError(
      `Weights must sum to 100, got ${sum.toFixed(2)}`,
    );
  }
}

export function score(inputs: ScorerInput, config: ScorerConfig = {}): ScoreResult {
  const weights = { ...DEFAULT_WEIGHTS, ...config.weights };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  validateWeights(weights);

  const signals: SignalResult[] = [
    {
      name: 'filesChanged',
      score: inputs.filesChanged.score,
      weight: weights.filesChanged,
      detail: inputs.filesChanged.detail,
    },
    {
      name: 'complexityDelta',
      score: inputs.complexityDelta.score,
      weight: weights.complexityDelta,
      detail: inputs.complexityDelta.detail,
    },
    {
      name: 'coverageRatio',
      score: inputs.coverageRatio.score,
      weight: weights.coverageRatio,
      detail: inputs.coverageRatio.detail,
    },
    {
      name: 'migrationFiles',
      score: inputs.migrationFiles.score,
      weight: weights.migrationFiles,
      detail: inputs.migrationFiles.detail,
    },
    {
      name: 'deadCode',
      score: inputs.deadCode.score,
      weight: weights.deadCode,
      detail: inputs.deadCode.detail,
    },
    {
      name: 'secret_leak',
      score: inputs.secretLeak.score,
      weight: weights.secret_leak,
      detail: inputs.secretLeak.detail,
    },
    {
      name: 'bundle_size_delta',
      score: inputs.bundleSize.score,
      weight: weights.bundle_size_delta,
      detail: inputs.bundleSize.detail,
    },
    {
      name: 'api_breaking_changes',
      score: inputs.apiBreaking.score,
      weight: weights.api_breaking_changes,
      detail: inputs.apiBreaking.detail,
    },
  ];

  const weighted = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        signals.reduce((sum, s) => sum + (s.score * s.weight) / 100, 0),
      ),
    ),
  );

  if (inputs.secretLeak.triggered) {
    return {
      total: Math.max(weighted, 81),
      band: 'critical',
      override: 'secret_leak',
      signals,
    };
  }

  return { total: weighted, band: toBand(weighted, thresholds), signals };
}
