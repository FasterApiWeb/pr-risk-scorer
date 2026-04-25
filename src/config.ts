import * as fs from 'fs';
import * as path from 'path';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';

// ── Notification schemas ──────────────────────────────────────────────────

const SlackConfigSchema = z.object({
  webhookSecret: z.string(),
  minScore:      z.number().int().min(0).max(100),
  channel:       z.string().optional(),
});

const JiraConfigSchema = z.object({
  baseUrl:      z.string().url(),
  projectKey:   z.string(),
  tokenSecret:  z.string(),
  emailSecret:  z.string(),
  minScore:     z.number().int().min(0).max(100),
});

const LinearConfigSchema = z.object({
  tokenSecret: z.string(),
  teamId:      z.string(),
  label:       z.string(),
  minScore:    z.number().int().min(0).max(100),
});

const NotificationsSchema = z.object({
  slack:  SlackConfigSchema.optional(),
  jira:   JiraConfigSchema.optional(),
  linear: LinearConfigSchema.optional(),
});

// ── AI suggestions schema ─────────────────────────────────────────────────

const AiSuggestionsConfigSchema = z.object({
  enabled:              z.boolean().default(true),
  min_score:            z.number().int().min(0).max(100),
  anthropicTokenSecret: z.string().optional(),
  maxTokens:            z.number().int().positive().optional(),
});

// ── SonarQube signal schema ───────────────────────────────────────────────

const SonarQubeConfigSchema = z.object({
  enabled:            z.boolean().default(false),
  host_url:           z.string().url(),
  token_secret:       z.string(),
  project_key:        z.string(),
  wait_for_analysis:  z.boolean().default(true),
  timeout_seconds:    z.number().int().positive().default(120),
});

// ── Weights schema ────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  filesChanged:         8,
  complexityDelta:      17,
  coverageRatio:        15,
  migrationFiles:       12,
  deadCode:             8,
  secret_leak:          12,
  bundle_size_delta:    4,
  api_breaking_changes: 4,
  sonarqube:            15,
  lang_specific_tests:  5,
} as const;

const WeightsSchema = z
  .object({
    filesChanged:         z.number().min(0).max(100).default(DEFAULT_WEIGHTS.filesChanged),
    complexityDelta:      z.number().min(0).max(100).default(DEFAULT_WEIGHTS.complexityDelta),
    coverageRatio:        z.number().min(0).max(100).default(DEFAULT_WEIGHTS.coverageRatio),
    migrationFiles:       z.number().min(0).max(100).default(DEFAULT_WEIGHTS.migrationFiles),
    deadCode:             z.number().min(0).max(100).default(DEFAULT_WEIGHTS.deadCode),
    secret_leak:          z.number().min(0).max(100).default(DEFAULT_WEIGHTS.secret_leak),
    bundle_size_delta:    z.number().min(0).max(100).default(DEFAULT_WEIGHTS.bundle_size_delta),
    api_breaking_changes: z.number().min(0).max(100).default(DEFAULT_WEIGHTS.api_breaking_changes),
    sonarqube:            z.number().min(0).max(100).default(DEFAULT_WEIGHTS.sonarqube),
    lang_specific_tests:  z.number().min(0).max(100).default(DEFAULT_WEIGHTS.lang_specific_tests),
  })
  .refine(
    (w) => Math.abs(Object.values(w).reduce((sum, v) => sum + v, 0) - 100) < 0.01,
    { message: 'weights must sum to 100' },
  );

// ── Thresholds schema ─────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS = { medium: 40, high: 70 } as const;

const ThresholdsSchema = z.object({
  medium: z.number().int().min(0).max(100).default(40),
  high:   z.number().int().min(0).max(100).default(70),
});

// ── Root config schema ────────────────────────────────────────────────────

const ConfigSchema = z.object({
  weights:            WeightsSchema.default(DEFAULT_WEIGHTS),
  thresholds:         ThresholdsSchema.default(DEFAULT_THRESHOLDS),
  block_merge:        z.number().int().min(0).max(100).optional(),
  required_approvers: z.array(z.string()).optional(),
  notifications:      NotificationsSchema.optional(),
  ai_suggestions:     AiSuggestionsConfigSchema.optional(),
  sonarqube:          SonarQubeConfigSchema.optional(),
});

export type SlackConfig = z.infer<typeof SlackConfigSchema>;
export type JiraConfig = z.infer<typeof JiraConfigSchema>;
export type LinearConfig = z.infer<typeof LinearConfigSchema>;
export type AiSuggestionsConfig = z.infer<typeof AiSuggestionsConfigSchema>;
export type SonarQubeConfig = z.infer<typeof SonarQubeConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

// ── Config loader ─────────────────────────────────────────────────────────

const CONFIG_PATH = '.github/pr-risk-scorer.yml';

export function loadConfig(workspaceDir = '.'): Config {
  const resolved = path.resolve(workspaceDir, CONFIG_PATH);

  if (!fs.existsSync(resolved)) {
    return ConfigSchema.parse({});
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = parseYaml(raw);

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid config at ${CONFIG_PATH}:\n${result.error.issues
        .map(i => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }

  return result.data;
}
