---
description: Analyze the current repository for PR risk and report a structured breakdown across five dimensions (diff size, complexity, coverage gap, dead code, migrations).
---

Run a PR risk analysis on the current working tree. Follow these steps:

## 1. Gather signals

Run these commands in parallel and collect their output:

```bash
# Diff size — lines changed vs HEAD~1
git diff HEAD~1 HEAD --shortstat

# Changed Python files
git diff HEAD~1 HEAD --name-only --diff-filter=AM

# Migration files
git diff HEAD~1 HEAD --name-only
```

## 2. Score each signal

Use the weights and formulas below to compute a 0–100 score for each dimension:

| Signal | Weight | Formula |
|--------|--------|---------|
| **Diff Size** | 20% | `min(total_lines / 1000 * 100, 100)` |
| **Complexity** | 30% | `min((avg_cc - 1) / 25 * 100, 100)` — run `python -m radon cc -s -a <changed_py_files>` |
| **Coverage Gap** | 20% | `(1 - line_rate) * 100` — parse `coverage.xml`; default 60 if missing |
| **Dead Code** | 15% | `min(vulture_items / 20 * 100, 100)` — run `python -m vulture src/ --min-confidence 80` |
| **Migrations** | 15% | 0 files → 0, 1 → 60, 2 → 80, 3+ → 100 (match `migrations?/`, `alembic/versions/`, `schema.prisma`, etc.) |

Weighted total: `score = 0.20*diff + 0.30*complexity + 0.20*coverage + 0.15*dead_code + 0.15*migration`

## 3. Determine risk tier

| Score | Label |
|-------|-------|
| < 40 | 🟢 LOW |
| 40–70 | 🟡 MEDIUM |
| > 70 | 🔴 HIGH |

## 4. Report

Print a Markdown table with each signal's score and the weighted total, like the GitHub Action comment format:

```
## PR Risk Score: <emoji> <LABEL> (<total> / 100)

| Analyzer           | Score | Risk     |
|--------------------|------:|----------|
| Diff Size (20%)    |  XX.X | 🟢/🟡/🔴 |
| Complexity (30%)   |  XX.X | 🟢/🟡/🔴 |
| Coverage Gap (20%) |  XX.X | 🟢/🟡/🔴 |
| Dead Code (15%)    |  XX.X | 🟢/🟡/🔴 |
| Migrations (15%)   |  XX.X | 🟢/🟡/🔴 |
```

Finish with a one-sentence recommendation: what the riskiest signal is and how to reduce it.
