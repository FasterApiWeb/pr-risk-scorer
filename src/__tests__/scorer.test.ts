import { score, ConfigError, ScorerInput } from '../scorer';

function makeInput(overrides: Partial<ScorerInput> = {}): ScorerInput {
  return {
    filesChanged:    { score: 0, detail: '0 files changed' },
    complexityDelta: { score: 0, detail: 'avg CCN 0' },
    coverageRatio:   { score: 0, detail: '100% line coverage' },
    migrationFiles:  { score: 0, detail: 'No migration files detected' },
    deadCode:        { score: 0, detail: '0 unused exports' },
    secretLeak:      { score: 0, triggered: false, detail: 'clean' },
    bundleSize:      { score: 0, detail: 'all size-limit checks passed' },
    apiBreaking:     { score: 0, detail: 'no breaking changes detected', breakingCount: 0 },
    sonarQube:       { score: 0, status: 'unavailable', detail: 'skipped', conditions: [] },
    ...overrides,
  } as ScorerInput;
}

describe('score()', () => {
  // ── zero-signal baseline ──────────────────────────────────────────────────
  describe('zero signals', () => {
    it('returns total 0 and band=low when all signals are zero', () => {
      const result = score(makeInput());
      expect(result.total).toBe(0);
      expect(result.band).toBe('low');
    });

    it('includes all 10 signals with names', () => {
      const result = score(makeInput());
      expect(result.signals).toHaveLength(10);
      const names = result.signals.map(s => s.name);
      expect(names).toEqual([
        'filesChanged',
        'complexityDelta',
        'coverageRatio',
        'migrationFiles',
        'deadCode',
        'secret_leak',
        'bundle_size_delta',
        'api_breaking_changes',
        'sonarqube',
        'lang_specific_tests',
      ]);
    });

    it('each signal carries its configured default weight', () => {
      const result = score(makeInput());
      const byName = Object.fromEntries(result.signals.map(s => [s.name, s]));
      expect(byName['filesChanged'].weight).toBe(8);
      expect(byName['complexityDelta'].weight).toBe(17);
      expect(byName['coverageRatio'].weight).toBe(15);
      expect(byName['migrationFiles'].weight).toBe(12);
      expect(byName['deadCode'].weight).toBe(8);
      expect(byName['secret_leak'].weight).toBe(12);
      expect(byName['bundle_size_delta'].weight).toBe(4);
      expect(byName['api_breaking_changes'].weight).toBe(4);
      expect(byName['sonarqube'].weight).toBe(15);
      expect(byName['lang_specific_tests'].weight).toBe(5);
    });
  });

  // ── weighted sum over all 8 signals ───────────────────────────────────────
  describe('weighted sum', () => {
    it('computes total as weighted sum across all 10 signals', () => {
      // All scores 100, weights sum to 100 → total = 100
      const result = score(
        makeInput({
          filesChanged:    { score: 100, detail: 'max' },
          complexityDelta: { score: 100, detail: 'max' },
          coverageRatio:   { score: 100, detail: 'max' },
          migrationFiles:  { score: 100, detail: 'max' },
          deadCode:        { score: 100, detail: 'max' },
          secretLeak:      { score: 100, triggered: false, detail: 'untriggered max' },
          bundleSize:      { score: 100, detail: 'max' },
          apiBreaking:     { score: 100, detail: 'max', breakingCount: 99 },
          sonarQube:       { score: 100, status: 'ERROR', detail: 'gate failed', conditions: [] },
          langSpecificTests: { score: 100, detail: 'max' },
        }),
      );
      expect(result.total).toBe(100);
      expect(result.band).toBe('critical');
    });

    it('new signals contribute correctly when isolated', () => {
      // Only bundle_size_delta (weight 4) at 100 → total = 4
      const result = score(
        makeInput({ bundleSize: { score: 100, detail: 'over limit' } }),
      );
      expect(result.total).toBe(4);
      expect(result.band).toBe('low');
    });

    it('api_breaking_changes contributes via weight', () => {
      // Only apiBreaking at 100 with weight 4 → total = 4
      const result = score(
        makeInput({
          apiBreaking: { score: 100, detail: 'broken', breakingCount: 3 },
        }),
      );
      expect(result.total).toBe(4);
    });

    it('secret_leak contributes to weighted sum when not triggered', () => {
      // secretLeak score=50 (weight 12), not triggered → contribution = 6
      const result = score(
        makeInput({
          secretLeak: { score: 50, triggered: false, detail: 'suppressed' },
        }),
      );
      expect(result.total).toBe(6);
      expect(result.band).toBe('low');
    });

    it('combines contributions from all 10 signals additively', () => {
      // 50 across all signals, weights sum to 100 → total = 50
      const inp = makeInput({
        filesChanged:    { score: 50, detail: 'mid' },
        complexityDelta: { score: 50, detail: 'mid' },
        coverageRatio:   { score: 50, detail: 'mid' },
        migrationFiles:  { score: 50, detail: 'mid' },
        deadCode:        { score: 50, detail: 'mid' },
        secretLeak:      { score: 50, triggered: false, detail: 'mid' },
        bundleSize:      { score: 50, detail: 'mid' },
        apiBreaking:     { score: 50, detail: 'mid', breakingCount: 1 },
        sonarQube:       { score: 50, status: 'WARN', detail: 'mid', conditions: [] },
        langSpecificTests: { score: 50, detail: 'mid' },
      });
      const result = score(inp);
      expect(result.total).toBe(50);
      expect(result.band).toBe('medium');
    });
  });

  // ── secret leak override ──────────────────────────────────────────────────
  describe('secret leak override', () => {
    it('triggered secret leak always returns band=critical', () => {
      const result = score(
        makeInput({
          secretLeak: { score: 100, triggered: true, detail: '1 secret found' },
        }),
      );
      expect(result.band).toBe('critical');
      expect(result.override).toBe('secret_leak');
    });

    it('triggered secret leak floors total at 81 even when weighted is lower', () => {
      // All scores 0 → weighted = 0, but override floors at 81
      const result = score(
        makeInput({
          secretLeak: { score: 0, triggered: true, detail: 'redacted' },
        }),
      );
      expect(result.total).toBe(81);
      expect(result.band).toBe('critical');
      expect(result.override).toBe('secret_leak');
    });

    it('triggered secret leak preserves weighted total when it is above 81', () => {
      // All 10 signals at 100 → weighted = 100, above 81 → total stays 100
      const result = score(
        makeInput({
          filesChanged:    { score: 100, detail: 'max' },
          complexityDelta: { score: 100, detail: 'max' },
          coverageRatio:   { score: 100, detail: 'max' },
          migrationFiles:  { score: 100, detail: 'max' },
          deadCode:        { score: 100, detail: 'max' },
          secretLeak:      { score: 100, triggered: true, detail: 'leak' },
          bundleSize:      { score: 100, detail: 'max' },
          apiBreaking:     { score: 100, detail: 'max', breakingCount: 5 },
          sonarQube:       { score: 100, status: 'ERROR', detail: 'max', conditions: [] },
          langSpecificTests: { score: 100, detail: 'max' },
        }),
      );
      expect(result.total).toBe(100);
      expect(result.band).toBe('critical');
      expect(result.override).toBe('secret_leak');
    });

    it('does not set override when secret leak is not triggered', () => {
      const result = score(makeInput());
      expect(result.override).toBeUndefined();
    });
  });

  // ── risk bands ────────────────────────────────────────────────────────────
  describe('risk bands', () => {
    it('band=medium when total is between medium and high thresholds', () => {
      // 8 original signals at 50, sonarQube=0 → total = 50*80/100 = 40 → medium (≥ 40)
      const inp = makeInput({
        filesChanged:    { score: 50, detail: 'mid' },
        complexityDelta: { score: 50, detail: 'mid' },
        coverageRatio:   { score: 50, detail: 'mid' },
        migrationFiles:  { score: 50, detail: 'mid' },
        deadCode:        { score: 50, detail: 'mid' },
        secretLeak:      { score: 50, triggered: false, detail: 'mid' },
        bundleSize:      { score: 50, detail: 'mid' },
        apiBreaking:     { score: 50, detail: 'mid', breakingCount: 1 },
      });
      const result = score(inp);
      expect(result.band).toBe('medium');
    });

    it('band=high when total exceeds high threshold but under critical', () => {
      // All 10 signals at 75 → total = 75 → high (> 70, < 81)
      const inp = makeInput({
        filesChanged:    { score: 75, detail: 'x' },
        complexityDelta: { score: 75, detail: 'x' },
        coverageRatio:   { score: 75, detail: 'x' },
        migrationFiles:  { score: 75, detail: 'x' },
        deadCode:        { score: 75, detail: 'x' },
        secretLeak:      { score: 75, triggered: false, detail: 'x' },
        bundleSize:      { score: 75, detail: 'x' },
        apiBreaking:     { score: 75, detail: 'x', breakingCount: 1 },
        sonarQube:       { score: 75, status: 'ERROR', detail: 'x', conditions: [] },
        langSpecificTests: { score: 75, detail: 'x' },
      });
      const result = score(inp);
      expect(result.total).toBe(75);
      expect(result.band).toBe('high');
    });

    it('band=critical when total meets critical threshold without override', () => {
      // All 10 signals at 90 → total = 90 → critical (≥ 81)
      const inp = makeInput({
        filesChanged:    { score: 90, detail: 'x' },
        complexityDelta: { score: 90, detail: 'x' },
        coverageRatio:   { score: 90, detail: 'x' },
        migrationFiles:  { score: 90, detail: 'x' },
        deadCode:        { score: 90, detail: 'x' },
        secretLeak:      { score: 90, triggered: false, detail: 'x' },
        bundleSize:      { score: 90, detail: 'x' },
        apiBreaking:     { score: 90, detail: 'x', breakingCount: 1 },
        sonarQube:       { score: 90, status: 'ERROR', detail: 'x', conditions: [] },
        langSpecificTests: { score: 90, detail: 'x' },
      });
      const result = score(inp);
      expect(result.total).toBe(90);
      expect(result.band).toBe('critical');
      expect(result.override).toBeUndefined();
    });

    it('respects custom thresholds', () => {
      // 8 original signals at 40, sonarQube=0 → weighted = 40*80/100 = 32
      const result = score(
        makeInput({
          filesChanged:    { score: 40, detail: 'x' },
          complexityDelta: { score: 40, detail: 'x' },
          coverageRatio:   { score: 40, detail: 'x' },
          migrationFiles:  { score: 40, detail: 'x' },
          deadCode:        { score: 40, detail: 'x' },
          secretLeak:      { score: 40, triggered: false, detail: 'x' },
          bundleSize:      { score: 40, detail: 'x' },
          apiBreaking:     { score: 40, detail: 'x', breakingCount: 1 },
        }),
        { thresholds: { medium: 20, high: 30, critical: 50 } },
      );
      expect(result.total).toBe(32);
      expect(result.band).toBe('high');
    });
  });

  // ── config validation ─────────────────────────────────────────────────────
  describe('weight validation', () => {
    it('throws ConfigError when weights do not sum to 100', () => {
      expect(() =>
        score(makeInput(), {
          weights: {
            filesChanged:         10,
            complexityDelta:      10,
            coverageRatio:        10,
            migrationFiles:       10,
            deadCode:             10,
            secret_leak:          10,
            bundle_size_delta:    10,
            api_breaking_changes: 10,
            sonarqube:            10,
            lang_specific_tests:   9, // sum = 99 ≠ 100
          },
        }),
      ).toThrow(ConfigError);
    });

    it('throws ConfigError when override bumps weights above 100', () => {
      expect(() =>
        score(makeInput(), {
          weights: { filesChanged: 50 },
        }),
      ).toThrow(ConfigError);
    });

    it('accepts custom weights that sum to exactly 100', () => {
      const result = score(
        makeInput({ filesChanged: { score: 100, detail: 'max' } }),
        {
          weights: {
            filesChanged:         100,
            complexityDelta:      0,
            coverageRatio:        0,
            migrationFiles:       0,
            deadCode:             0,
            secret_leak:          0,
            bundle_size_delta:    0,
            api_breaking_changes: 0,
            sonarqube:            0,
            lang_specific_tests:  0,
          },
        },
      );
      expect(result.total).toBe(100);
    });
  });
});
