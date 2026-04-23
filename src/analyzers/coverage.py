from __future__ import annotations

import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

from src.analyzers import BaseAnalyzer

_COVERAGE_XML_CANDIDATES: list[str] = ["coverage.xml", ".coverage.xml"]
# When no coverage data exists, assume medium-high risk.
_DEFAULT_RISK: float = 60.0


class CoverageAnalyzer(BaseAnalyzer):
    def analyze(self) -> float:
        for candidate in _COVERAGE_XML_CANDIDATES:
            path = Path(candidate)
            if path.exists():
                return self._score_from_xml(path)

        # Attempt to generate coverage for the current project.
        subprocess.run(
            ["python", "-m", "pytest", "--cov=src", "--cov-report=xml:coverage.xml", "-q", "--tb=no"],
            capture_output=True,
        )
        path = Path("coverage.xml")
        if path.exists():
            return self._score_from_xml(path)

        return _DEFAULT_RISK

    @staticmethod
    def _score_from_xml(path: Path) -> float:
        try:
            root = ET.parse(path).getroot()
            line_rate = float(root.get("line-rate", "0"))
            # Invert: 100% coverage → 0 risk, 0% coverage → 100 risk.
            return (1.0 - line_rate) * 100.0
        except (ET.ParseError, ValueError):
            return _DEFAULT_RISK
