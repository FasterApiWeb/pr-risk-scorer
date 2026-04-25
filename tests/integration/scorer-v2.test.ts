import { score, ConfigError, type ScorerInput } from '../../src/scorer';
import { getSuggestions } from '../../src/ai/suggest';
import { notifySlack } from '../../src/notifications/slack';
import { loadConfig } from '../../src/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setFailed: jest.fn(),
}));

function makeZeroInput(): ScorerInput {
  return {
    filesChanged:    { score: 0, detail: '0 files changed' },
    complexityDelta: { score: 0, detail: 'avg CCN 0' },
    coverageRatio:   { score: 0, detail: '100% line coverage' },
    migrationFiles:  { score: 0, detail: 'no migration files' },
    deadCode:        { score: 0, detail: '0 unused exports' },
    secretLeak:      { score: 0, triggered: false, detail: 'clean' },
    bundleSize:      { score: 0, detail: 'within size limit' },
    apiBreaking:     { score: 0, detail: 'no breaking changes', breakingCount: 0 },
  };
}

describe('scorer-v2 integration', () => {
  describe('secret leak overrides band to critical regardless of other scores', () => {
    it('sets total >= 81, band=critical, override=secret_leak when all other signals score 0', () => {
      const result = score({
        ...makeZeroInput(),
        secretLeak: { score: 0, triggered: true, detail: 'leak detected' },
      });
      expect(result.total).toBeGreaterThanOrEqual(81);
      expect(result.band).toBe('critical');
      expect(result.override).toBe('secret_leak');
    });
  });

  describe('weights not summing to 100 throws ConfigError', () => {
    it('throws ConfigError with message matching "sum to 100" when weights sum to 95', () => {
      const badWeights = {
        filesChanged:         12,
        complexityDelta:      12,
        coverageRatio:        12,
        migrationFiles:       12,
        deadCode:             12,
        secret_leak:          12,
        bundle_size_delta:    12,
        api_breaking_changes: 11, // sum = 95
      };
      expect(() => score(makeZeroInput(), { weights: badWeights })).toThrow(ConfigError);
      expect(() => score(makeZeroInput(), { weights: badWeights })).toThrow(/sum to 100/);
    });
  });

  describe('notifications fire only above minScore', () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
    });

    afterEach(() => {
      mockFetch.mockReset();
    });

    const slackConfig = { webhookSecret: 'https://hooks.slack.com/test', minScore: 60 };
    const basePayload = {
      score: 0,
      band: 'medium',
      prTitle: 'Test PR',
      prUrl: 'https://github.com/test/repo/pull/1',
      signals: [],
    };

    it('does not send Slack webhook when score is below minScore', async () => {
      await notifySlack(slackConfig, { ...basePayload, score: 55 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends Slack webhook once when score is above minScore', async () => {
      await notifySlack(slackConfig, { ...basePayload, score: 65 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('AI suggestions skipped when secretLeak triggered', () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
    });

    afterEach(() => {
      mockFetch.mockReset();
    });

    it('returns null without calling Anthropic API when override is secret_leak', async () => {
      const aiConfig = {
        enabled: true,
        minScore: 50,
        anthropicTokenSecret: 'test-key',
        maxTokens: 1024,
      };
      const scorerOutput = {
        total: 90,
        band: 'critical' as const,
        override: 'secret_leak',
        signals: [],
      };
      const result = await getSuggestions(aiConfig, scorerOutput, {
        filesChanged: 5,
        complexityDelta: 3,
        coverage: 0.8,
        migrationCount: 0,
      });
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('AI suggestions return null on API failure', () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);
    });

    afterEach(() => {
      mockFetch.mockReset();
    });

    it('returns null and does not throw when Anthropic API returns 500', async () => {
      const aiConfig = {
        enabled: true,
        minScore: 50,
        anthropicTokenSecret: 'test-key',
        maxTokens: 1024,
      };
      const scorerOutput = {
        total: 75,
        band: 'high' as const,
        signals: [],
      };
      await expect(
        getSuggestions(aiConfig, scorerOutput, {
          filesChanged: 10,
          complexityDelta: 5,
          coverage: 0.6,
          migrationCount: 1,
        }),
      ).resolves.toBeNull();
    });
  });

  describe('v1 config loads cleanly with v2 defaults', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-risk-v1-config-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true });
    });

    it('applies all v2 defaults when config contains only v1 keys', () => {
      const githubDir = path.join(tmpDir, '.github');
      fs.mkdirSync(githubDir);
      fs.writeFileSync(
        path.join(githubDir, 'pr-risk-scorer.yml'),
        'block_merge: 75\n',
      );

      const config = loadConfig(tmpDir);

      expect(config.block_merge).toBe(75);
      expect(config.weights).toBeDefined();
      expect(config.weights.filesChanged).toBe(15);
      expect(config.weights.complexityDelta).toBe(25);
      expect(config.weights.coverageRatio).toBe(15);
      expect(config.thresholds).toBeDefined();
      expect(config.thresholds.medium).toBe(40);
      expect(config.thresholds.high).toBe(70);
      expect(config.ai_suggestions).toBeUndefined();
      expect(config.notifications).toBeUndefined();
    });
  });
});
