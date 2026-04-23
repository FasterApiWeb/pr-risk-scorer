import { glob } from 'glob';
import type { Signal } from './types';

const MIGRATION_PATTERN = '**/migrations/**/*.{sql,py,rb,ts}';

// Score bands: 0 files → 0, 1-2 → medium, 3+ → high
export async function migrationFiles(workspaceDir: string = '.'): Promise<Signal> {
  const matches = await glob(MIGRATION_PATTERN, {
    cwd: workspaceDir,
    ignore: ['node_modules/**', '.git/**', 'dist/**'],
  });

  const count = matches.length;
  let score: number;

  if (count === 0) {
    score = 0;
  } else if (count <= 2) {
    score = 50 + (count - 1) * 15;
  } else {
    score = Math.min(80 + (count - 3) * 5, 100);
  }

  const fileList = matches.slice(0, 5).join(', ');
  const overflow = count > 5 ? ` …and ${count - 5} more` : '';

  return {
    score,
    detail: count === 0
      ? 'No migration files detected'
      : `${count} migration file(s): ${fileList}${overflow}`,
  };
}
