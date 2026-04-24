# Getting Started

## Prerequisites

- A GitHub repository with pull request workflows enabled
- `GITHUB_TOKEN` (automatically provided by GitHub Actions)
- Optional: a coverage report (`lcov.info` or `coverage.xml`) generated before this step
- Optional: `lizard` installed for cyclomatic complexity analysis

## Minimal setup

Add the following step to any workflow that triggers on `pull_request`:

```yaml
name: PR Quality Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  statuses: write

jobs:
  risk-score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # needed for diff-based signals

      - name: Score PR Risk
        uses: FasterApiWeb/pr-risk-scorer@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

The action posts a comment on the PR and sets a commit status. No configuration file is required — all thresholds and weights have sensible defaults.

## Full example — Python project with coverage

```yaml
name: PR Quality Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  statuses: write

jobs:
  risk-score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install pytest pytest-cov lizard

      - name: Run tests with coverage
        run: pytest --cov=src --cov-report=xml   # produces coverage.xml

      - name: Score PR Risk
        id: risk
        uses: FasterApiWeb/pr-risk-scorer@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          config-path: .github/pr-risk-scorer.json

      - name: Fail on high risk
        if: steps.risk.outputs.risk-label == 'HIGH'
        run: |
          echo "Risk score ${{ steps.risk.outputs.risk-score }} exceeds threshold."
          exit 1
```

## Full example — Node.js / TypeScript project

```yaml
name: PR Quality Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  statuses: write

jobs:
  risk-score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci

      - name: Run tests with coverage
        run: npm test -- --coverage --coverageReporters=lcov   # produces lcov.info

      - name: Score PR Risk
        id: risk
        uses: FasterApiWeb/pr-risk-scorer@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Print outputs
        run: |
          echo "Score : ${{ steps.risk.outputs.risk-score }}"
          echo "Label : ${{ steps.risk.outputs.risk-label }}"
```

## Action inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | **Yes** | — | GitHub token for reading PR data and posting comments. Use `secrets.GITHUB_TOKEN`. |
| `config-path` | No | `.github/pr-risk-scorer.json` | Workspace-relative path to the JSON configuration file. |

## Action outputs

| Output | Description |
|--------|-------------|
| `risk-score` | Numeric score, `0`–`100` |
| `risk-label` | `LOW`, `MEDIUM`, or `HIGH` |

## Required permissions

| Permission | Reason |
|------------|--------|
| `pull-requests: write` | Post / update the risk comment |
| `statuses: write` | Set a commit status (pass/fail indicator) |
| `contents: read` | Read source files for complexity and dead-code analysis |

---

**Next step:** [Configuration →](configuration.md)
