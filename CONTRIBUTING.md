# Contributing to pr-risk-scorer

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/FasterApiWeb/pr-risk-scorer.git
cd pr-risk-scorer

pip install hatch
hatch env create
```

## Project Structure

```
pr-risk-scorer/
├── action.yml              # Composite GitHub Action definition
├── src/
│   ├── main.py             # Entry point — orchestrates analyzers → scorer → reporter
│   ├── scorer.py           # Weighted scoring engine (0-100)
│   ├── reporter.py         # Posts PR comment via GitHub REST API
│   └── analyzers/
│       ├── __init__.py     # BaseAnalyzer ABC
│       ├── diff_size.py    # Lines changed in the diff
│       ├── complexity.py   # Cyclomatic complexity via radon
│       ├── coverage.py     # Test coverage gap via coverage.py
│       ├── dead_code.py    # Unused symbols via vulture
│       └── migration.py    # Database migration file detection
└── tests/
    ├── test_scorer.py
    └── test_analyzers.py
```

## Running Tests

```bash
hatch run test          # pytest + coverage
hatch run typecheck     # mypy --strict
hatch run lint          # vulture dead-code scan
```

All tests must pass and `mypy --strict` must report zero errors before a PR can be merged.

## Adding a New Analyzer

1. Create `src/analyzers/my_analyzer.py` with a class that extends `BaseAnalyzer`.
2. Implement `analyze(self) -> float` returning a value between `0.0` and `100.0`.
3. Register it in `src/main.py` under the `scores` dict.
4. Add a corresponding weight in `src/scorer.py` — weights must still sum to `1.0`.
5. Write tests in `tests/test_analyzers.py`.

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new analyzer for dependency age
fix: clamp diff size score correctly when diff is empty
docs: add example PR comment screenshot
```

## Pull Request Checklist

- [ ] `hatch run test` passes with no failures
- [ ] `hatch run typecheck` reports zero errors
- [ ] New code is covered by tests
- [ ] `WEIGHTS` in `scorer.py` still sum to `1.0`
- [ ] PR description explains the "why" of the change
