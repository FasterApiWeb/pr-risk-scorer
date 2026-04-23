import { jest } from '@jest/globals';

// Mock @actions/github before importing the module under test
jest.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    payload: { pull_request: { number: 42 } },
  },
  getOctokit: () => ({
    rest: {
      pulls: {
        listFiles: async () => ({
          data: [
            { filename: 'src/a.ts', additions: 20, deletions: 5 },
            { filename: 'src/b.ts', additions: 10, deletions: 2 },
          ],
        }),
      },
    },
  }),
}));

import { filesChanged } from '../signals/filesChanged';

describe('filesChanged', () => {
  it('returns a score and detail for a small PR', async () => {
    const result = await filesChanged('fake-token');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.detail).toContain('2 files changed');
  });
});
