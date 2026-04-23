import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { migrationFiles } from '../signals/migrationFiles';

describe('migrationFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-risk-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns score 0 when no migration files exist', async () => {
    const result = await migrationFiles(tmpDir);
    expect(result.score).toBe(0);
    expect(result.detail).toContain('No migration');
  });

  it('detects SQL migration files', async () => {
    const dir = path.join(tmpDir, 'app', 'migrations');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '001_init.sql'), '-- init');
    const result = await migrationFiles(tmpDir);
    expect(result.score).toBe(50);
    expect(result.detail).toContain('1 migration');
  });

  it('scales score with multiple migration files', async () => {
    const dir = path.join(tmpDir, 'db', 'migrations');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 4; i++) {
      fs.writeFileSync(path.join(dir, `00${i}.py`), '# migration');
    }
    const result = await migrationFiles(tmpDir);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });
});
