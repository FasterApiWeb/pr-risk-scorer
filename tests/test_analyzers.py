from __future__ import annotations

from unittest.mock import MagicMock, patch
from pathlib import Path
import textwrap

import pytest

from src.analyzers.diff_size import DiffSizeAnalyzer, MAX_LINES
from src.analyzers.complexity import ComplexityAnalyzer
from src.analyzers.coverage import CoverageAnalyzer, _DEFAULT_RISK
from src.analyzers.dead_code import DeadCodeAnalyzer, _MAX_DEAD_ITEMS
from src.analyzers.migration import MigrationAnalyzer, _TIERS


# ---------------------------------------------------------------------------
# DiffSizeAnalyzer
# ---------------------------------------------------------------------------

class TestDiffSizeAnalyzer:
    def _run(self, stdout: str) -> float:
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout=stdout, returncode=0)
            return DiffSizeAnalyzer().analyze()

    def test_no_changes(self) -> None:
        assert self._run("") == pytest.approx(0.0)

    def test_small_diff(self) -> None:
        result = self._run(" 3 files changed, 50 insertions(+), 10 deletions(-)")
        assert result == pytest.approx(60 / MAX_LINES * 100)

    def test_large_diff_capped_at_100(self) -> None:
        result = self._run(" 5 files changed, 900 insertions(+), 200 deletions(-)")
        assert result == pytest.approx(100.0)

    def test_only_insertions(self) -> None:
        result = self._run(" 1 file changed, 200 insertions(+)")
        assert result == pytest.approx(200 / MAX_LINES * 100)

    def test_only_deletions(self) -> None:
        result = self._run(" 1 file changed, 300 deletions(-)")
        assert result == pytest.approx(300 / MAX_LINES * 100)


# ---------------------------------------------------------------------------
# ComplexityAnalyzer
# ---------------------------------------------------------------------------

class TestComplexityAnalyzer:
    def test_no_python_files(self) -> None:
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="README.md\n", returncode=0)
            assert ComplexityAnalyzer().analyze() == pytest.approx(0.0)

    def test_simple_complexity(self) -> None:
        diff_output = "src/foo.py\n"
        radon_output = "src/foo.py\n    F 1:0 main - A\nAverage complexity: A (2.0)\n"
        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = [
                MagicMock(stdout=diff_output, returncode=0),
                MagicMock(stdout=radon_output, returncode=0),
            ]
            result = ComplexityAnalyzer().analyze()
            # avg=2.0 → (2-1)/(26-1)*100 = 4.0
            assert result == pytest.approx((2.0 - 1.0) / 25.0 * 100, rel=1e-3)

    def test_max_complexity_capped(self) -> None:
        diff_output = "src/foo.py\n"
        radon_output = "Average complexity: F (30.0)\n"
        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = [
                MagicMock(stdout=diff_output, returncode=0),
                MagicMock(stdout=radon_output, returncode=0),
            ]
            assert ComplexityAnalyzer().analyze() == pytest.approx(100.0)

    def test_no_radon_output(self) -> None:
        diff_output = "src/foo.py\n"
        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = [
                MagicMock(stdout=diff_output, returncode=0),
                MagicMock(stdout="", returncode=0),
            ]
            assert ComplexityAnalyzer().analyze() == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# CoverageAnalyzer
# ---------------------------------------------------------------------------

class TestCoverageAnalyzer:
    def test_full_coverage_zero_risk(self, tmp_path: Path) -> None:
        xml = textwrap.dedent("""\
            <?xml version="1.0" ?>
            <coverage line-rate="1.0" branch-rate="1.0" version="7.0">
            </coverage>
        """)
        cov_file = tmp_path / "coverage.xml"
        cov_file.write_text(xml)
        with patch("src.analyzers.coverage.Path") as mock_path_cls:
            mock_path_cls.side_effect = lambda p: cov_file if "coverage" in p else Path(p)
            result = CoverageAnalyzer._score_from_xml(cov_file)
        assert result == pytest.approx(0.0)

    def test_zero_coverage_full_risk(self, tmp_path: Path) -> None:
        xml = textwrap.dedent("""\
            <?xml version="1.0" ?>
            <coverage line-rate="0.0" branch-rate="0.0" version="7.0">
            </coverage>
        """)
        cov_file = tmp_path / "coverage.xml"
        cov_file.write_text(xml)
        result = CoverageAnalyzer._score_from_xml(cov_file)
        assert result == pytest.approx(100.0)

    def test_partial_coverage(self, tmp_path: Path) -> None:
        xml = textwrap.dedent("""\
            <?xml version="1.0" ?>
            <coverage line-rate="0.75" branch-rate="0.0" version="7.0">
            </coverage>
        """)
        cov_file = tmp_path / "coverage.xml"
        cov_file.write_text(xml)
        result = CoverageAnalyzer._score_from_xml(cov_file)
        assert result == pytest.approx(25.0)

    def test_missing_xml_returns_default(self) -> None:
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=1)
            with patch("src.analyzers.coverage.Path") as mock_path_cls:
                mock_inst = MagicMock()
                mock_inst.exists.return_value = False
                mock_path_cls.return_value = mock_inst
                result = CoverageAnalyzer().analyze()
        assert result == pytest.approx(_DEFAULT_RISK)

    def test_malformed_xml_returns_default(self, tmp_path: Path) -> None:
        bad_xml = tmp_path / "coverage.xml"
        bad_xml.write_text("not xml at all")
        result = CoverageAnalyzer._score_from_xml(bad_xml)
        assert result == pytest.approx(_DEFAULT_RISK)


# ---------------------------------------------------------------------------
# DeadCodeAnalyzer
# ---------------------------------------------------------------------------

class TestDeadCodeAnalyzer:
    def _run(self, stdout: str) -> float:
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout=stdout, returncode=0)
            return DeadCodeAnalyzer().analyze()

    def test_no_dead_code(self) -> None:
        assert self._run("") == pytest.approx(0.0)

    def test_single_dead_item(self) -> None:
        result = self._run("src/foo.py:10: unused variable 'x' (60% confidence)\n")
        assert result == pytest.approx(1 / _MAX_DEAD_ITEMS * 100)

    def test_capped_at_100(self) -> None:
        lines = "\n".join(f"src/foo.py:{i}: unused variable 'x'" for i in range(30))
        assert self._run(lines + "\n") == pytest.approx(100.0)

    def test_exact_max_items(self) -> None:
        lines = "\n".join(f"src/foo.py:{i}: unused variable 'x'" for i in range(_MAX_DEAD_ITEMS))
        assert self._run(lines + "\n") == pytest.approx(100.0)


# ---------------------------------------------------------------------------
# MigrationAnalyzer
# ---------------------------------------------------------------------------

class TestMigrationAnalyzer:
    def _run(self, files: list[str]) -> float:
        stdout = "\n".join(files) + ("\n" if files else "")
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout=stdout, returncode=0)
            return MigrationAnalyzer().analyze()

    def test_no_migrations(self) -> None:
        assert self._run(["src/foo.py", "README.md"]) == pytest.approx(_TIERS[0])

    def test_one_alembic_migration(self) -> None:
        assert self._run(["alembic/versions/001_add_users.py"]) == pytest.approx(_TIERS[1])

    def test_one_django_migration(self) -> None:
        assert self._run(["migrations/0001_initial.py"]) == pytest.approx(_TIERS[1])

    def test_two_migrations(self) -> None:
        assert self._run([
            "alembic/versions/001_add_users.py",
            "migrations/0002_add_orders.py",
        ]) == pytest.approx(_TIERS[2])

    def test_three_or_more_migrations(self) -> None:
        assert self._run([
            "alembic/versions/001_add_users.py",
            "migrations/0002_add_orders.py",
            "migrations/0003_add_products.py",
        ]) == pytest.approx(_TIERS[3])

    def test_prisma_schema_detected(self) -> None:
        assert self._run(["schema.prisma"]) == pytest.approx(_TIERS[1])

    def test_mixed_files(self) -> None:
        assert self._run(["src/app.py", "migrations/0001_initial.py", "README.md"]) == pytest.approx(_TIERS[1])
