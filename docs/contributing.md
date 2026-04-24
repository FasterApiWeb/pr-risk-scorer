# Contributing

Thank you for your interest in contributing to PR Risk Scorer!

## Development setup

```bash
git clone https://github.com/FasterApiWeb/pr-risk-scorer.git
cd pr-risk-scorer
npm install
```

## Project structure

```
pr-risk-scorer/
├── action.yml                    # GitHub Action definition (inputs, outputs, entry point)
├── src/
│   ├── index.ts                  # Entry point — orchestrates signals → score → comment
│   ├── scorer.ts                 # Weighted scoring engine
│   ├── comment.ts                # Builds and posts the PR comment via Octokit
│   ├── config.ts                 # Zod-validated YAML config loader
│   └── signals/
│       ├── types.ts              # Signal interface
│       ├── filesChanged.ts       # GitHub API — PR file list
│       ├── complexityDelta.ts    # lizard cyclomatic complexity
│       ├── coverageRatio.ts      # lcov.info / coverage.xml parser
│       ├── migrationFiles.ts     # Filesystem glob for migration files
│       └── deadCode.ts           # ts-prune / vulture dead-code count
├── src/__tests__/                # Jest unit tests
├── dist/                         # Bundled output (committed — required by GitHub Actions)
├── docs/                         # MkDocs source (this site)
└── mkdocs.yml                    # MkDocs configuration
```

## Running tests

```bash
npm test          # Jest unit tests
npm run typecheck # TypeScript type checking (tsc --noEmit)
npm run build     # Bundle with ncc → dist/
```

All tests must pass and `tsc --noEmit` must report zero errors before a PR is merged.

## Adding a new signal

1. Create `src/signals/my_signal.ts` exporting an async function that returns a `Signal`:

    ```typescript
    import type { Signal } from './types';

    export async function mySignal(workspaceDir: string): Promise<Signal> {
      // ... compute score 0–100
      return { score: 42, detail: 'human-readable explanation' };
    }
    ```

2. Import and call it in `src/scorer.ts` alongside the existing `Promise.allSettled` call.

3. Add a weight key in `src/scorer.ts` under `DEFAULT_WEIGHTS`. Weights are normalized, so you only need to maintain relative proportions.

4. Expose the new weight key in `WeightConfig` and `ConfigSchema` inside `src/config.ts`.

5. Add unit tests in `src/__tests__/my_signal.test.ts`.

6. Document the signal in [`docs/signals.md`](signals.md).

## Building the docs locally

```bash
pip install mkdocs-material
mkdocs serve        # live-reload preview at http://localhost:8000
mkdocs build        # static output → site/
```

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add dependency-age signal
fix: clamp filesChanged score at 100 when diff is empty
docs: add Go coverage example to signals page
chore: upgrade lizard to 1.17
```

## Pull request checklist

- [ ] `npm test` passes with no failures
- [ ] `npm run typecheck` reports zero errors
- [ ] New signal has corresponding unit tests
- [ ] `dist/` is rebuilt with `npm run build` and committed
- [ ] PR description explains the *why* of the change
