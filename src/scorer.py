from __future__ import annotations

from collections.abc import Mapping

WEIGHTS: dict[str, float] = {
    "diff_size": 0.20,
    "complexity": 0.30,
    "coverage": 0.20,
    "dead_code": 0.15,
    "migration": 0.15,
}


class Scorer:
    def score(self, analyzer_scores: Mapping[str, float]) -> float:
        total = sum(
            analyzer_scores.get(key, 0.0) * weight
            for key, weight in WEIGHTS.items()
        )
        return min(max(total, 0.0), 100.0)
