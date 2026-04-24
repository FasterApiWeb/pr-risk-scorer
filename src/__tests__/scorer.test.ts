import { score } from '../scorer';
import { filesChanged } from '../signals/filesChanged';
import { complexityDelta } from '../signals/complexityDelta';
import { coverageRatio } from '../signals/coverageRatio';
import { migrationFiles } from '../signals/migrationFiles';
import { deadCode } from '../signals/deadCode';
import { secretLeak } from '../signals/secretLeak';

jest.mock('../signals/filesChanged');
jest.mock('../signals/complexityDelta');
jest.mock('../signals/coverageRatio');
jest.mock('../signals/migrationFiles');
jest.mock('../signals/deadCode');
jest.mock('../signals/secretLeak');
jest.mock('child_process', () => ({ spawnSync: jest.fn(() => ({ stdout: '', status: 0 })) }));

const mockFilesChanged = filesChanged as jest.MockedFunction<typeof filesChanged>;
const mockComplexityDelta = complexityDelta as jest.MockedFunction<typeof complexityDelta>;
const mockCoverageRatio = coverageRatio as jest.MockedFunction<typeof coverageRatio>;
const mockMigrationFiles = migrationFiles as jest.MockedFunction<typeof migrationFiles>;
const mockDeadCode = deadCode as jest.MockedFunction<typeof deadCode>;
const mockSecretLeak = secretLeak as jest.MockedFunction<typeof secretLeak>;

describe('score()', () => {
  beforeEach(() => {
    mockFilesChanged.mockResolvedValue({ score: 0, detail: '0 files changed' });
    mockComplexityDelta.mockResolvedValue({ score: 0, detail: 'avg CCN 0' });
    mockCoverageRatio.mockResolvedValue({ score: 0, detail: '100% line coverage' });
    mockMigrationFiles.mockResolvedValue({ score: 0, detail: 'No migration files detected' });
    mockDeadCode.mockResolvedValue({ score: 0, detail: '0 unused exports' });
    mockSecretLeak.mockResolvedValue({ score: 0, triggered: false, detail: 'clean' });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ── zero files ────────────────────────────────────────────────────────────

  describe('zero files', () => {
    it('returns total 0 and LOW band when all signals are zero', async () => {
      const result = await score('token');
      expect(result.total).toBe(0);
      expect(result.band).toBe('LOW');
    });

    it('returns exactly 6 named signals including secretLeak', async () => {
      const result = await score('token');
      expect(result.signals).toHaveLength(6);
      const names = result.signals.map(s => s.name);
      expect(names).toContain('filesChanged');
      expect(names).toContain('complexityDelta');
      expect(names).toContain('coverageRatio');
      expect(names).toContain('migrationFiles');
      expect(names).toContain('deadCode');
      expect(names).toContain('secretLeak');
    });

    it('each signal carries its configured weight', async () => {
      const result = await score('token');
      const byName = Object.fromEntries(result.signals.map(s => [s.name, s]));
      expect(byName['filesChanged'].weight).toBeCloseTo(0.20);
      expect(byName['complexityDelta'].weight).toBeCloseTo(0.30);
      expect(byName['coverageRatio'].weight).toBeCloseTo(0.20);
      expect(byName['migrationFiles'].weight).toBeCloseTo(0.15);
      expect(byName['deadCode'].weight).toBeCloseTo(0.15);
    });
  });

  // ── perfect coverage ──────────────────────────────────────────────────────

  describe('perfect coverage', () => {
    it('score 0 for coverageRatio lowers total vs worst-case coverage', async () => {
      mockFilesChanged.mockResolvedValue({ score: 80, detail: 'many files' });
      mockComplexityDelta.mockResolvedValue({ score: 80, detail: 'high complexity' });
      mockMigrationFiles.mockResolvedValue({ score: 80, detail: 'migrations found' });
      mockDeadCode.mockResolvedValue({ score: 80, detail: 'dead code found' });

      mockCoverageRatio.mockResolvedValue({ score: 0, detail: '100.0% line coverage' });
      const withPerfectCoverage = await score('token');

      mockCoverageRatio.mockResolvedValue({ score: 100, detail: '0% line coverage' });
      const withZeroCoverage = await score('token');

      expect(withPerfectCoverage.total).toBeLessThan(withZeroCoverage.total);
    });

    it('computes exact total when only coverageRatio is zero', async () => {
      // filesChanged:100(w=0.20) + complexityDelta:100(w=0.30) + coverageRatio:0(w=0.20)
      // + migrationFiles:100(w=0.15) + deadCode:100(w=0.15) = 80 / 1.0 = 80
      mockFilesChanged.mockResolvedValue({ score: 100, detail: 'max' });
      mockComplexityDelta.mockResolvedValue({ score: 100, detail: 'max' });
      mockCoverageRatio.mockResolvedValue({ score: 0, detail: '100.0% line coverage' });
      mockMigrationFiles.mockResolvedValue({ score: 100, detail: 'max' });
      mockDeadCode.mockResolvedValue({ score: 100, detail: 'max' });

      const result = await score('token');
      expect(result.total).toBe(80);
      expect(result.band).toBe('HIGH');
    });

    it('coverageRatio signal detail is preserved in result', async () => {
      mockCoverageRatio.mockResolvedValue({ score: 0, detail: '100.0% line coverage (500/500 lines)' });
      const result = await score('token');
      const cr = result.signals.find(s => s.name === 'coverageRatio')!;
      expect(cr.score).toBe(0);
      expect(cr.detail).toContain('100.0%');
    });
  });

  // ── no migrations ─────────────────────────────────────────────────────────

  describe('no migrations', () => {
    it('migrationFiles score 0 contributes nothing to weighted sum', async () => {
      // 100*0.20 + 100*0.30 + 100*0.20 + 0*0.15 + 100*0.15 = 85 / 1.0 = 85
      mockFilesChanged.mockResolvedValue({ score: 100, detail: 'max' });
      mockComplexityDelta.mockResolvedValue({ score: 100, detail: 'max' });
      mockCoverageRatio.mockResolvedValue({ score: 100, detail: 'max' });
      mockMigrationFiles.mockResolvedValue({ score: 0, detail: 'No migration files detected' });
      mockDeadCode.mockResolvedValue({ score: 100, detail: 'max' });

      const result = await score('token');
      expect(result.total).toBe(85);
    });

    it('migrationFiles signal is present with score 0 and correct detail', async () => {
      const result = await score('token');
      const mf = result.signals.find(s => s.name === 'migrationFiles')!;
      expect(mf.score).toBe(0);
      expect(mf.detail).toContain('No migration');
    });

    it('total equals same score as if migrationFiles weight were zero', async () => {
      mockFilesChanged.mockResolvedValue({ score: 60, detail: 'mid' });
      mockComplexityDelta.mockResolvedValue({ score: 60, detail: 'mid' });
      mockCoverageRatio.mockResolvedValue({ score: 60, detail: 'mid' });
      mockMigrationFiles.mockResolvedValue({ score: 0, detail: 'No migration files detected' });
      mockDeadCode.mockResolvedValue({ score: 60, detail: 'mid' });

      // 60*0.20 + 60*0.30 + 60*0.20 + 0*0.15 + 60*0.15 = 60*0.85 / 1.0 = 51
      const result = await score('token');
      expect(result.total).toBe(51);
    });
  });

  // ── custom weights & normalization ────────────────────────────────────────

  describe('custom weights', () => {
    it('applies custom weights and overrides defaults', async () => {
      mockFilesChanged.mockResolvedValue({ score: 100, detail: 'max' });
      // Only filesChanged gets weight; all others are zero
      const result = await score('token', '.', {
        weights: { filesChanged: 1.0, complexityDelta: 0, coverageRatio: 0, migrationFiles: 0, deadCode: 0 },
      });
      expect(result.total).toBe(100);
    });

    it('normalizes correctly when weights do not sum to 1', async () => {
      // All signals at 100; weights sum to 2.0 — normalization gives total = 100
      mockFilesChanged.mockResolvedValue({ score: 100, detail: 'max' });
      mockComplexityDelta.mockResolvedValue({ score: 100, detail: 'max' });
      mockCoverageRatio.mockResolvedValue({ score: 100, detail: 'max' });
      mockMigrationFiles.mockResolvedValue({ score: 100, detail: 'max' });
      mockDeadCode.mockResolvedValue({ score: 100, detail: 'max' });

      const result = await score('token', '.', {
        weights: { filesChanged: 0.4, complexityDelta: 0.6, coverageRatio: 0.4, migrationFiles: 0.3, deadCode: 0.3 },
      });
      expect(result.total).toBe(100);
    });
  });

  // ── risk bands ────────────────────────────────────────────────────────────

  describe('risk bands', () => {
    it('assigns MEDIUM band for score between 40 and 70', async () => {
      // All signals at 50 → total = 50 → MEDIUM
      mockFilesChanged.mockResolvedValue({ score: 50, detail: 'mid' });
      mockComplexityDelta.mockResolvedValue({ score: 50, detail: 'mid' });
      mockCoverageRatio.mockResolvedValue({ score: 50, detail: 'mid' });
      mockMigrationFiles.mockResolvedValue({ score: 50, detail: 'mid' });
      mockDeadCode.mockResolvedValue({ score: 50, detail: 'mid' });

      const result = await score('token');
      expect(result.total).toBe(50);
      expect(result.band).toBe('MEDIUM');
    });

    it('assigns HIGH band when total exceeds default high threshold (70)', async () => {
      mockFilesChanged.mockResolvedValue({ score: 100, detail: 'max' });
      mockComplexityDelta.mockResolvedValue({ score: 100, detail: 'max' });
      mockCoverageRatio.mockResolvedValue({ score: 100, detail: 'max' });
      mockMigrationFiles.mockResolvedValue({ score: 100, detail: 'max' });
      mockDeadCode.mockResolvedValue({ score: 100, detail: 'max' });

      const result = await score('token');
      expect(result.total).toBe(100);
      expect(result.band).toBe('HIGH');
    });

    it('respects custom thresholds', async () => {
      // Score = 50, but custom high threshold = 40 → HIGH
      mockFilesChanged.mockResolvedValue({ score: 50, detail: 'mid' });
      mockComplexityDelta.mockResolvedValue({ score: 50, detail: 'mid' });
      mockCoverageRatio.mockResolvedValue({ score: 50, detail: 'mid' });
      mockMigrationFiles.mockResolvedValue({ score: 50, detail: 'mid' });
      mockDeadCode.mockResolvedValue({ score: 50, detail: 'mid' });

      const result = await score('token', '.', { thresholds: { medium: 20, high: 40 } });
      expect(result.band).toBe('HIGH');
    });

    it('escalates to CRITICAL when secretLeak is triggered regardless of total', async () => {
      mockSecretLeak.mockResolvedValue({ score: 15, triggered: true, detail: '2 secrets found' });

      const result = await score('token');
      expect(result.band).toBe('CRITICAL');
    });

    it('does not escalate to CRITICAL when secretLeak is not triggered', async () => {
      mockSecretLeak.mockResolvedValue({ score: 0, triggered: false, detail: 'clean' });

      const result = await score('token');
      expect(result.band).not.toBe('CRITICAL');
    });

    it('adds secretLeak score as flat bonus to total', async () => {
      // All base signals at 0 → baseTotal = 0; secretLeak adds 15 → total = 15
      mockSecretLeak.mockResolvedValue({ score: 15, triggered: true, detail: '1 secret found' });

      const result = await score('token');
      expect(result.total).toBe(15);
      expect(result.band).toBe('CRITICAL');
    });
  });

  // ── failed signals ────────────────────────────────────────────────────────

  describe('failed signals', () => {
    it('defaults failed signal to score 0 with error detail', async () => {
      mockFilesChanged.mockRejectedValue(new Error('network timeout'));

      const result = await score('token');
      const fc = result.signals.find(s => s.name === 'filesChanged')!;
      expect(fc.score).toBe(0);
      expect(fc.detail).toContain('error');
    });

    it('still computes a valid total when one signal fails', async () => {
      mockComplexityDelta.mockRejectedValue(new Error('lizard not found'));
      mockFilesChanged.mockResolvedValue({ score: 40, detail: 'some files' });

      const result = await score('token');
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
      expect(result.band).toBeDefined();
    });
  });
});
