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
export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';
export interface ScoreResult {
    total: number;
    band: RiskBand;
    signals: SignalResult[];
}
export declare function score(token: string, workspaceDir?: string, config?: ScorerConfig): Promise<ScoreResult>;
