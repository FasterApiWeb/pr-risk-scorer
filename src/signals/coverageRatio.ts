import * as fs from 'fs';
import * as path from 'path';
import type { Signal } from './types';

interface CoverageResult {
  covered: number;
  total: number;
}

function parseLcov(content: string): CoverageResult {
  let covered = 0;
  let total = 0;
  for (const line of content.split('\n')) {
    if (line.startsWith('DA:')) {
      const parts = line.slice(3).split(',');
      if (parts.length >= 2) {
        total++;
        if (parseInt(parts[1], 10) > 0) covered++;
      }
    }
  }
  return { covered, total };
}

function parseCoverageXml(content: string): CoverageResult {
  // Parse <coverage line-rate="0.85" ...> or <lines-valid>/<lines-covered>
  const rateMatch = content.match(/line-rate="([0-9.]+)"/);
  const validMatch = content.match(/lines-valid="(\d+)"/);
  const coveredMatch = content.match(/lines-covered="(\d+)"/);

  if (rateMatch && validMatch && coveredMatch) {
    return {
      covered: parseInt(coveredMatch[1], 10),
      total: parseInt(validMatch[1], 10),
    };
  }
  if (rateMatch) {
    const rate = parseFloat(rateMatch[1]);
    return { covered: Math.round(rate * 1000), total: 1000 };
  }
  return { covered: 0, total: 0 };
}

export async function coverageRatio(workspaceDir: string = '.'): Promise<Signal> {
  const lcovPath = path.join(workspaceDir, 'lcov.info');
  const xmlPath = path.join(workspaceDir, 'coverage.xml');

  let result: CoverageResult | null = null;
  let source = '';

  if (fs.existsSync(lcovPath)) {
    result = parseLcov(fs.readFileSync(lcovPath, 'utf8'));
    source = 'lcov.info';
  } else if (fs.existsSync(xmlPath)) {
    result = parseCoverageXml(fs.readFileSync(xmlPath, 'utf8'));
    source = 'coverage.xml';
  }

  if (!result || result.total === 0) {
    return { score: 50, detail: 'No coverage report found (lcov.info or coverage.xml)' };
  }

  const ratio = result.covered / result.total;
  // Invert: high coverage → low risk, low coverage → high risk
  const score = Math.round((1 - ratio) * 100);

  return {
    score,
    detail: `${(ratio * 100).toFixed(1)}% line coverage (${result.covered}/${result.total} lines) from ${source}`,
  };
}
