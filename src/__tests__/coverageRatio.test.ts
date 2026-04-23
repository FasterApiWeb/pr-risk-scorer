import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { coverageRatio } from '../signals/coverageRatio';

describe('coverageRatio', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-risk-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns score 50 when no coverage file exists', async () => {
    const result = await coverageRatio(tmpDir);
    expect(result.score).toBe(50);
    expect(result.detail).toContain('No coverage report');
  });

  it('parses lcov.info correctly', async () => {
    const lcov = 'DA:1,1\nDA:2,0\nDA:3,1\n';
    fs.writeFileSync(path.join(tmpDir, 'lcov.info'), lcov);
    const result = await coverageRatio(tmpDir);
    // 2 covered out of 3 → 66.7% → score = (1 - 0.667) * 100 ≈ 33
    expect(result.score).toBe(33);
    expect(result.detail).toContain('66.7%');
  });

  it('parses coverage.xml correctly', async () => {
    const xml = `<?xml version="1.0" ?>
<coverage line-rate="0.9" lines-valid="100" lines-covered="90"></coverage>`;
    fs.writeFileSync(path.join(tmpDir, 'coverage.xml'), xml);
    const result = await coverageRatio(tmpDir);
    expect(result.score).toBe(10); // (1 - 0.9) * 100
    expect(result.detail).toContain('90.0%');
  });
});
