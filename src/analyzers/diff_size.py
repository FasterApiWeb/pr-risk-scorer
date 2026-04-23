from __future__ import annotations

import re
import subprocess

from src.analyzers import BaseAnalyzer

# Lines changed before reaching maximum risk score
MAX_LINES: int = 1000


class DiffSizeAnalyzer(BaseAnalyzer):
    def analyze(self) -> float:
        result = subprocess.run(
            ["git", "diff", "HEAD~1", "HEAD", "--shortstat"],
            capture_output=True,
            text=True,
        )
        total = sum(int(m.group(1)) for m in re.finditer(r"(\d+) (insertion|deletion)", result.stdout))
        return min(total / MAX_LINES * 100, 100.0)
