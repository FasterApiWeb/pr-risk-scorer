---
description: Install pr-risk-scorer from PyPI and run a live risk analysis on the current working tree.
---

Score the current repository's PR risk using the published `pr-risk-scorer` PyPI package.

## Steps

### 1. Install the package

```bash
pip install pr-risk-scorer -q
```

If already installed, this is a no-op. To upgrade to the latest version:

```bash
pip install --upgrade pr-risk-scorer -q
```

### 2. Run the analyzers

Run this Python snippet — it imports the installed package and scores the working tree without needing any GitHub env vars:

```bash
python - <<'EOF'
from pr_risk_scorer.analyzers.complexity import ComplexityAnalyzer
from pr_risk_scorer.analyzers.coverage import CoverageAnalyzer
from pr_risk_scorer.analyzers.dead_code import DeadCodeAnalyzer
from pr_risk_scorer.analyzers.diff_size import DiffSizeAnalyzer
from pr_risk_scorer.analyzers.migration import MigrationAnalyzer
from pr_risk_scorer.scorer import Scorer

scores = {
    "diff_size":  DiffSizeAnalyzer().analyze(),
    "complexity": ComplexityAnalyzer().analyze(),
    "coverage":   CoverageAnalyzer().analyze(),
    "dead_code":  DeadCodeAnalyzer().analyze(),
    "migration":  MigrationAnalyzer().analyze(),
}
total = Scorer().score(scores)
risk = "LOW" if total < 40 else ("MEDIUM" if total <= 70 else "HIGH")

WEIGHTS = {"diff_size": 20, "complexity": 30, "coverage": 20, "dead_code": 15, "migration": 15}
LABELS  = {"diff_size": "Diff Size", "complexity": "Complexity",
           "coverage": "Coverage Gap", "dead_code": "Dead Code", "migration": "Migrations"}
EMOJI   = lambda s: "🟢" if s < 40 else ("🟡" if s <= 70 else "🔴")

emoji = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🔴"}[risk]
print(f"\n## PR Risk Score: {emoji} {risk} ({total:.1f} / 100)\n")
print(f"| {'Analyzer':<22} | {'Score':>5} | Risk |")
print(f"|{'-'*24}|{'-'*7}:|------|")
for key, score in scores.items():
    label = f"{LABELS[key]} ({WEIGHTS[key]}%)"
    print(f"| {label:<22} | {score:>5.1f} | {EMOJI(score)} |")
print()
EOF
```

### 3. Report

Print the Markdown table produced above. Then add a one-sentence recommendation naming the highest-scoring signal and how to reduce it.

---

## Using this skill in your own project

To add `/score-pr-pypi` to any project:

1. Copy this file to `.claude/commands/score-pr-pypi.md` in your repo root.
2. Invoke it with `/score-pr-pypi` inside a Claude Code session.
3. No GitHub token or CI setup required — the analyzers run entirely locally.

To install the package globally once:

```bash
pip install pr-risk-scorer
```
