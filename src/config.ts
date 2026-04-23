import * as fs from 'fs';
import * as path from 'path';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';

const WeightsSchema = z.object({
  filesChanged:   z.number().min(0).max(1).default(0.20),
  complexityDelta: z.number().min(0).max(1).default(0.30),
  coverageRatio:  z.number().min(0).max(1).default(0.20),
  migrationFiles: z.number().min(0).max(1).default(0.15),
  deadCode:       z.number().min(0).max(1).default(0.15),
});

const ThresholdsSchema = z.object({
  medium: z.number().int().min(0).max(100).default(40),
  high:   z.number().int().min(0).max(100).default(70),
});

const DEFAULT_WEIGHTS = {
  filesChanged:    0.20,
  complexityDelta: 0.30,
  coverageRatio:   0.20,
  migrationFiles:  0.15,
  deadCode:        0.15,
} as const;

const DEFAULT_THRESHOLDS = { medium: 40, high: 70 } as const;

const ConfigSchema = z.object({
  weights:            WeightsSchema.default(DEFAULT_WEIGHTS),
  thresholds:         ThresholdsSchema.default(DEFAULT_THRESHOLDS),
  block_merge:        z.number().int().min(0).max(100).optional(),
  required_approvers: z.array(z.string()).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

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
