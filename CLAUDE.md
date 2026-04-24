# PR Risk Scorer — Claude Code Guide

## Project overview

Dual-language GitHub Action: TypeScript orchestrates the GitHub API integration; Python handles static analysis (radon, vulture, coverage.xml). The Node 20 bundle in `dist/index.js` is what runs in GitHub Actions.

## Repository layout

```
src/                  Python analyzers + TypeScript action source
  analyzers/          One file per signal (complexity, coverage, dead_code, diff_size, migration)
  main.py             CLI entry point (also invoked by the action)
  scorer.py           Weighted scoring engine
  reporter.py         GitHub API comment poster
  index.ts            Action entry point (compiled → dist/index.js)
tests/                pytest suite
docs/                 MkDocs Material source
dist/                 Compiled action bundle (committed)
.claude/commands/     Claude Code custom slash commands
```

## Dev commands

```bash
# Python — run from repo root
pip install -e ".[dev]"
pytest tests/ -v --cov=src

# TypeScript
npm ci
npm test
npm run build          # bundles dist/index.js via ncc

# Docs (local preview)
pip install -r requirements-docs.txt
mkdocs serve --config-file mkdocs.local.yml   # http://localhost:8000

# Package build
pip install build
python -m build        # produces dist/*.whl and dist/*.tar.gz
```

## Running tests

```bash
pytest tests/ -v
```

Both `tests/test_scorer.py` and `tests/test_analyzers.py` use `unittest.mock.patch` to stub subprocess calls — no external tools required to run the suite.

## Custom slash commands

| Command | File | What it does |
|---------|------|--------------|
| `/score-pr` | `.claude/commands/score-pr.md` | Runs a live PR risk analysis using inline bash + radon/vulture (no package install needed) |
| `/score-pr-pypi` | `.claude/commands/score-pr-pypi.md` | Installs `pr-risk-scorer` from PyPI then runs the analyzers via the installed package |

### Adding the skill to another project

Any project can use `/score-pr-pypi` without cloning this repo:

1. Create `.claude/commands/score-pr-pypi.md` in the target repo and paste the content from this repo's file (or copy it directly).
2. Inside a Claude Code session run `/score-pr-pypi` — Claude will `pip install pr-risk-scorer` and print the risk table.
3. No GitHub token or CI config required; all analyzers run locally.

## Publishing

### GitHub Action (Marketplace)

Push a semver tag — the `release.yml` workflow builds and publishes automatically:

```bash
git tag v1.2.3
git push origin v1.2.3
```

### Python package (PyPI)

The `publish.yml` workflow uses OIDC Trusted Publishing — no token needed locally. To trigger it, push a `v*.*.*` tag. First-time setup requires adding `fasterapiweb/pr-risk-scorer` as a Trusted Publisher on PyPI.

**Before tagging a new release**, bump the version in two places so they stay in sync:
- `pyproject.toml` → `version = "X.Y.Z"`
- `src/__init__.py` → `__version__ = "X.Y.Z"`

Then build and publish:

```bash
git tag v0.1.0
git push origin v0.1.0
# publish.yml triggers automatically
```

To build locally:

```bash
pip install build
python -m build
# outputs dist/pr_risk_scorer-*.whl and dist/pr_risk_scorer-*.tar.gz
```

## Architecture notes

- Python imports are **relative** (`from .analyzers.X import Y`) so the package installs correctly as `pr_risk_scorer` via the hatchling wheel sources mapping (`src → pr_risk_scorer`).
- Tests still run from the repo root where `src/` is on `sys.path`; patches reference `src.analyzers.*` module paths in that context.
- The `dist/` directory is committed so the action works without a build step for consumers.
