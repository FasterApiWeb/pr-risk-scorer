# pr-risk-scorer

[![Self Test](https://github.com/FasterApiWeb/pr-risk-scorer/actions/workflows/self_test.yml/badge.svg)](https://github.com/FasterApiWeb/pr-risk-scorer/actions/workflows/self_test.yml)
[![Deploy Docs](https://github.com/FasterApiWeb/pr-risk-scorer/actions/workflows/docs.yml/badge.svg)](https://github.com/FasterApiWeb/pr-risk-scorer/actions/workflows/docs.yml)
[![Docs](https://img.shields.io/badge/docs-mkdocs--material-blue?logo=readthedocs)](https://fasterapiweb.github.io/pr-risk-scorer/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/FasterApiWeb/pr-risk-scorer?logo=github)](https://github.com/FasterApiWeb/pr-risk-scorer/releases)
[![Node.js 20](https://img.shields.io/badge/node-20-brightgreen?logo=node.js)](https://nodejs.org)

A GitHub Action that scores pull requests by **structural risk** across five dimensions and posts the result as a PR comment.

---

## Quick Start

Add this step to any workflow that runs on `pull_request` events:

```yaml
- name: Score PR Risk
  uses: FasterApiWeb/pr-risk-scorer@v2
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | Yes | — | Token used to post the PR comment (`secrets.GITHUB_TOKEN` works) |
| `config-path` | No | `.github/pr-risk-scorer.yml` | Path to `pr-risk-scorer.yml` config file |

> **Secrets** (`SLACK_WEBHOOK_URL`, `JIRA_API_TOKEN`, `JIRA_EMAIL`, `LINEAR_API_TOKEN`, `ANTHROPIC_API_KEY`) are passed as `env:` vars on the step, not as `inputs:`. See the full workflow example below.

## Outputs

| Output | Description |
|--------|-------------|
| `risk-score` | Numeric score `0–100` |
| `risk-label` | `LOW`, `MEDIUM`, or `HIGH` |

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

Full workflow with all integrations wired:

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
        uses: FasterApiWeb/pr-risk-scorer@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          config-path: .github/pr-risk-scorer.yml
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          LINEAR_API_TOKEN: ${{ secrets.LINEAR_API_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Minimal config (Slack only)

`.github/pr-risk-scorer.yml`:

```yaml
slack:
  enabled: true
  # SLACK_WEBHOOK_URL is read from the environment
  notify_on: [high, medium]   # omit to notify on all scores
```

### Score Bands

| Score | Label | Meaning |
|-------|-------|---------|
| 0 – 39 | 🟢 LOW | Routine change, low review overhead |
| 40 – 70 | 🟡 MEDIUM | Notable change, standard review recommended |
| 71 – 100 | 🔴 HIGH | Large or complex change, careful review required |

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
