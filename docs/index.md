# PR Risk Scorer

**PR Risk Scorer** is a GitHub Action that analyzes pull request structure and emits a 0–100 risk score as a PR comment. It gives reviewers an instant, objective signal before they open the diff.

[![Self Test](https://github.com/FasterApiWeb/pr-risk-scorer/actions/workflows/self_test.yml/badge.svg)](https://github.com/FasterApiWeb/pr-risk-scorer/actions/workflows/self_test.yml)
[![Docs](https://img.shields.io/badge/docs-mkdocs--material-blue?logo=readthedocs)](https://fasterapiweb.github.io/pr-risk-scorer/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/FasterApiWeb/pr-risk-scorer/blob/main/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/FasterApiWeb/pr-risk-scorer?logo=github)](https://github.com/FasterApiWeb/pr-risk-scorer/releases)
[![Node.js 20](https://img.shields.io/badge/node-20-brightgreen?logo=node.js)](https://nodejs.org)

---

## What it does

On every pull request the action:

1. Collects five structural signals from the PR and the workspace
2. Computes a weighted 0–100 score
3. Posts (or updates) a comment with a per-signal breakdown
4. Sets a commit status — blocking merge when the score exceeds your configured threshold

## Score bands

| Score | Label | Action |
|-------|-------|--------|
| 0 – 39 | 🟢 **Low Risk** | Auto-approve eligible |
| 40 – 70 | 🟡 **Moderate Risk** | Flag for review |
| 71 – 100 | 🔴 **High Risk** | Block merge / require extra approvals |

## Example PR comment

```
## PR Risk Score: 🔴 HIGH (74 / 100)

> Threshold: 70 | Status: ❌ FAIL

| Analyzer              | Score | Risk        |
|-----------------------|------:|-------------|
| Diff Size (20%)       |  72.0 | 🔴 HIGH     |
| Complexity (30%)      |  60.0 | 🟡 MEDIUM   |
| Coverage Gap (20%)    |  55.0 | 🟡 MEDIUM   |
| Dead Code (15%)       |  20.0 | 🟢 LOW      |
| Migrations (15%)      | 100.0 | 🔴 HIGH     |
```

## Signals at a glance

| Signal | Max weight | Source |
|--------|-----------|--------|
| Files changed | 20% | GitHub API — PR file list |
| Cyclomatic complexity | 30% | `lizard` |
| Test coverage gap | 20% | `lcov.info` / `coverage.xml` |
| Migration files | 15% | Path glob |
| Dead code introduced | 15% | `ts-prune` / `vulture` |

---

**Next step:** [Getting Started →](getting-started.md)
