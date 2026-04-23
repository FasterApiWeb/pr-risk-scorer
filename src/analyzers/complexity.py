from __future__ import annotations

import subprocess

from src.analyzers import BaseAnalyzer

# Radon scale: A=1-5, B=6-10, C=11-15, D=16-20, E=21-25, F=26+
# Map raw average complexity (1-26+) onto 0-100 risk.
_RADON_MAX: float = 26.0


class ComplexityAnalyzer(BaseAnalyzer):
    def analyze(self) -> float:
        changed = subprocess.run(
            ["git", "diff", "HEAD~1", "HEAD", "--name-only", "--diff-filter=AM"],
            capture_output=True,
            text=True,
        )
        py_files = [f for f in changed.stdout.splitlines() if f.endswith(".py")]
        if not py_files:
            return 0.0

        complexities: list[float] = []
        for filepath in py_files:
            cc = subprocess.run(
                ["python", "-m", "radon", "cc", "-s", "-a", filepath],
                capture_output=True,
                text=True,
            )
            for line in cc.stdout.splitlines():
                if "Average complexity" in line:
                    # Format: "Average complexity: A (1.5)"
                    parts = line.rsplit("(", maxsplit=1)
                    if len(parts) == 2:
                        try:
                            complexities.append(float(parts[1].rstrip(")")))
                        except ValueError:
                            pass

        if not complexities:
            return 0.0

        avg = sum(complexities) / len(complexities)
        return min(max((avg - 1.0) / (_RADON_MAX - 1.0) * 100, 0.0), 100.0)
