from __future__ import annotations

import os
import sys

from .analyzers.complexity import ComplexityAnalyzer
from .analyzers.coverage import CoverageAnalyzer
from .analyzers.dead_code import DeadCodeAnalyzer
from .analyzers.diff_size import DiffSizeAnalyzer
from .analyzers.migration import MigrationAnalyzer
from .reporter import Reporter
from .scorer import Scorer


def main() -> None:
    github_token = os.environ["GITHUB_TOKEN"]
    repository = os.environ["GITHUB_REPOSITORY"]
    pr_number_str = os.environ.get("PR_NUMBER", "")
    threshold = float(os.environ.get("PR_THRESHOLD", "70"))
    fail_on_high = os.environ.get("FAIL_ON_HIGH", "true").lower() == "true"

    if not pr_number_str:
        print("PR_NUMBER not set — skipping comment posting.")
        pr_number = 0
    else:
        pr_number = int(pr_number_str)

    scores: dict[str, float] = {
        "diff_size": DiffSizeAnalyzer().analyze(),
        "complexity": ComplexityAnalyzer().analyze(),
        "coverage": CoverageAnalyzer().analyze(),
        "dead_code": DeadCodeAnalyzer().analyze(),
        "migration": MigrationAnalyzer().analyze(),
    }

    total = Scorer().score(scores)

    risk_level = "LOW" if total < 40 else ("MEDIUM" if total <= 70 else "HIGH")
    print(f"Risk score: {total:.1f} ({risk_level})")
    for name, value in scores.items():
        print(f"  {name}: {value:.1f}")

    # Write GitHub Actions step outputs when running inside Actions
    github_output = os.environ.get("GITHUB_OUTPUT", "")
    if github_output:
        with open(github_output, "a") as fh:
            fh.write(f"risk_score={total:.1f}\n")
            fh.write(f"risk_level={risk_level}\n")

    if pr_number > 0:
        Reporter(github_token=github_token, repository=repository, pr_number=pr_number).post_comment(
            total_score=total,
            scores=scores,
            threshold=threshold,
        )

    if fail_on_high and total > threshold:
        print(f"Score {total:.1f} exceeds threshold {threshold:.0f}. Failing.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
