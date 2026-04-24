from __future__ import annotations

import subprocess

from . import BaseAnalyzer

# Items before reaching maximum risk score
_MAX_DEAD_ITEMS: int = 20
_MIN_CONFIDENCE: str = "80"


class DeadCodeAnalyzer(BaseAnalyzer):
    def analyze(self) -> float:
        result = subprocess.run(
            ["python", "-m", "vulture", "src", "--min-confidence", _MIN_CONFIDENCE],
            capture_output=True,
            text=True,
        )
        dead_items = [line for line in result.stdout.splitlines() if line.strip()]
        return min(len(dead_items) / _MAX_DEAD_ITEMS * 100, 100.0)
