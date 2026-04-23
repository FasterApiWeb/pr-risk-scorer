from __future__ import annotations

from abc import ABC, abstractmethod


class BaseAnalyzer(ABC):
    @abstractmethod
    def analyze(self) -> float:
        """Return a risk score between 0 (no risk) and 100 (maximum risk)."""
        ...
