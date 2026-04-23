from __future__ import annotations

import pytest

from src.scorer import Scorer, WEIGHTS


class TestScorer:
    def test_all_zero_scores(self) -> None:
        scorer = Scorer()
        result = scorer.score({"diff_size": 0, "complexity": 0, "coverage": 0, "dead_code": 0, "migration": 0})
        assert result == pytest.approx(0.0)

    def test_all_hundred_scores(self) -> None:
        scorer = Scorer()
        result = scorer.score({"diff_size": 100, "complexity": 100, "coverage": 100, "dead_code": 100, "migration": 100})
        assert result == pytest.approx(100.0)

    def test_weights_sum_to_one(self) -> None:
        assert sum(WEIGHTS.values()) == pytest.approx(1.0)

    def test_weighted_calculation(self) -> None:
        scorer = Scorer()
        # Only complexity at 100 → 100 * 0.30 = 30
        result = scorer.score({"diff_size": 0, "complexity": 100, "coverage": 0, "dead_code": 0, "migration": 0})
        assert result == pytest.approx(30.0)

    def test_missing_keys_default_to_zero(self) -> None:
        scorer = Scorer()
        result = scorer.score({})
        assert result == pytest.approx(0.0)

    def test_score_clamped_below_zero(self) -> None:
        scorer = Scorer()
        result = scorer.score({"diff_size": -50, "complexity": -50, "coverage": -50, "dead_code": -50, "migration": -50})
        assert result == pytest.approx(0.0)

    def test_score_clamped_above_hundred(self) -> None:
        scorer = Scorer()
        result = scorer.score({"diff_size": 200, "complexity": 200, "coverage": 200, "dead_code": 200, "migration": 200})
        assert result == pytest.approx(100.0)

    def test_partial_scores(self) -> None:
        scorer = Scorer()
        # diff_size=100 (20%), migration=100 (15%) → 35
        result = scorer.score({"diff_size": 100, "complexity": 0, "coverage": 0, "dead_code": 0, "migration": 100})
        assert result == pytest.approx(35.0)

    def test_score_returns_float(self) -> None:
        scorer = Scorer()
        result = scorer.score({"diff_size": 50, "complexity": 50, "coverage": 50, "dead_code": 50, "migration": 50})
        assert isinstance(result, float)

    def test_mixed_scores(self) -> None:
        scorer = Scorer()
        scores = {"diff_size": 20, "complexity": 60, "coverage": 40, "dead_code": 10, "migration": 0}
        expected = 20 * 0.20 + 60 * 0.30 + 40 * 0.20 + 10 * 0.15 + 0 * 0.15
        result = scorer.score(scores)
        assert result == pytest.approx(expected)
