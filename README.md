# pr-risk-scorer

[![Self Test](https://github.com/FasterApiWeb/pr-risk-scorer/actions/workflows/self_test.yml/badge.svg)](https://github.com/FasterApiWeb/pr-risk-scorer/actions/workflows/self_test.yml)

A GitHub Action that scores pull requests by **structural risk** across five dimensions and posts the result as a PR comment.

---

## Quick Start

Add this step to any workflow that runs on `pull_request` events:

```yaml
- name: Score PR Risk
  uses: FasterApiWeb/pr-risk-scorer@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    threshold: 70         # fail if score > 70
    fail_on_high: true
```

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github_token` | Yes | — | Token used to post the PR comment (`secrets.GITHUB_TOKEN` works) |
| `threshold` | No | `70` | Scores above this value are flagged as high risk |
| `fail_on_high` | No | `true` | Exit with a non-zero code when score exceeds threshold |

## Outputs

| Output | Description |
|--------|-------------|
| `risk_score` | Numeric score `0–100` |
| `risk_level` | `LOW`, `MEDIUM`, or `HIGH` |

---

## Score Breakdown

The total score is a **weighted average** of five analyzers (0 = no risk, 100 = maximum risk):

| Dimension | Weight | Method |
|-----------|--------|--------|
| Diff Size | **20%** | Lines added + deleted, scaled to 1 000 max |
| Complexity | **30%** | Average cyclomatic complexity of changed `.py` files via [radon](https://radon.readthedocs.io/) |
| Coverage Gap | **20%** | `1 − line_rate` from `coverage.xml` (inverse of test coverage) |
| Dead Code | **15%** | Count of unused symbols via [vulture](https://github.com/jendrikseipp/vulture), capped at 20 items |
| Migrations | **15%** | Presence of DB migration files (0 → 0, 1 → 60, 2 → 80, 3+ → 100) |

### Risk Tiers

| Emoji | Level | Score Range |
|-------|-------|-------------|
| 🟢 | LOW | < 40 |
| 🟡 | MEDIUM | 40 – 70 |
| 🔴 | HIGH | > 70 |

---

## Example PR Comment

> **Screenshot placeholder** — paste a screenshot of a real PR comment here after first run.

```
## PR Risk Score: 🟡 MEDIUM (54.5 / 100)

> Threshold: 70 | Status: ✅ PASS

| Analyzer         | Score | Risk        |
|------------------|------:|-------------|
| Diff Size (20%)  |  42.0 | 🟡 MEDIUM   |
| Complexity (30%) |  60.0 | 🟡 MEDIUM   |
| Coverage Gap (20%)|  55.0| 🟡 MEDIUM   |
| Dead Code (15%)  |  20.0 | 🟢 LOW      |
| Migrations (15%) |   0.0 | 🟢 LOW      |
```

---

## Full Example Workflow

```yaml
name: PR Quality Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  risk-score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # required for git diff HEAD~1

      - name: Generate coverage report
        run: |
          pip install pytest pytest-cov
          pytest --cov=src --cov-report=xml

      - name: Score PR Risk
        uses: FasterApiWeb/pr-risk-scorer@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          threshold: 70
          fail_on_high: true
```

---

## Local Development

```bash
# Install hatch
pip install hatch

# Run tests
hatch run test

# Type check
hatch run typecheck

# Lint for dead code
hatch run lint
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
