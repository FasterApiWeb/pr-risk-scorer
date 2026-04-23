from __future__ import annotations

import re
import subprocess

from src.analyzers import BaseAnalyzer

_MIGRATION_PATTERNS: list[str] = [
    r"migrations?/.*\.py$",
    r"alembic/versions/.*\.py$",
    r"db/migrate/.*\.rb$",
    r"\d{4}.*migration.*\.sql$",
    r"schema\.prisma$",
    r"flyway/.*\.sql$",
    r"liquibase/.*\.xml$",
]

# Tiered risk: 0 files → 0, 1 → 60, 2 → 80, 3+ → 100
_TIERS: list[float] = [0.0, 60.0, 80.0, 100.0]


class MigrationAnalyzer(BaseAnalyzer):
    def analyze(self) -> float:
        result = subprocess.run(
            ["git", "diff", "HEAD~1", "HEAD", "--name-only"],
            capture_output=True,
            text=True,
        )
        count = sum(
            1
            for filepath in result.stdout.splitlines()
            if any(re.search(pat, filepath, re.IGNORECASE) for pat in _MIGRATION_PATTERNS)
        )
        return _TIERS[min(count, len(_TIERS) - 1)]
