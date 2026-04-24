# Configuration

PR Risk Scorer works out of the box with no configuration file. When a file is present it must be valid JSON placed at the path specified by the `config-path` input (default: `.github/pr-risk-scorer.json`).

## Full reference

```json
{
  "thresholds": {
    "medium": 40,
    "high": 70
  },
  "block_merge": 80,
  "weights": {
    "filesChanged": 0.20,
    "complexityDelta": 0.30,
    "coverageRatio": 0.20,
    "migrationFiles": 0.15,
    "deadCode": 0.15
  },
  "required_approvers": ["alice", "bob"]
}
```

All fields are optional. Omitted fields use the defaults shown above.

## Fields

### `thresholds`

Controls how the numeric score maps to a risk band.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `medium` | `integer` 0–100 | `40` | Scores ≥ this value are labelled **MEDIUM** |
| `high` | `integer` 0–100 | `70` | Scores > this value are labelled **HIGH** |

Scores below `medium` are labelled **LOW**.

### `block_merge`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `block_merge` | `integer` 0–100 | *(unset)* | When the total score reaches this value the commit status is set to **failure**, blocking merge via required status checks. |

!!! tip
    Set `block_merge` to the same value as `thresholds.high` to automatically block all HIGH-risk PRs.

### `weights`

Each weight is a fraction between `0.0` and `1.0`. Weights are normalized at runtime, so they do not need to sum to exactly `1.0`.

| Key | Default | Signal |
|-----|---------|--------|
| `filesChanged` | `0.20` | Number of files and lines changed |
| `complexityDelta` | `0.30` | Cyclomatic complexity of changed functions |
| `coverageRatio` | `0.20` | Test coverage gap (inverse of line coverage) |
| `migrationFiles` | `0.15` | Database migration files detected |
| `deadCode` | `0.15` | Unused exports/symbols introduced |

### `required_approvers`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `required_approvers` | `string[]` | *(unset)* | GitHub usernames (with or without `@`) to add to `.github/CODEOWNERS` when the score reaches MEDIUM or HIGH. |

## Examples

### Strict mode — block anything above 60

```json
{
  "thresholds": {
    "medium": 30,
    "high": 60
  },
  "block_merge": 60
}
```

### Heavily weighted toward coverage

```json
{
  "weights": {
    "filesChanged": 0.10,
    "complexityDelta": 0.20,
    "coverageRatio": 0.50,
    "migrationFiles": 0.10,
    "deadCode": 0.10
  }
}
```

### Require team leads on risky PRs

```json
{
  "thresholds": {
    "high": 65
  },
  "block_merge": 80,
  "required_approvers": ["alice", "bob", "carol"]
}
```

## Validation errors

If the config file contains invalid JSON, the action logs a warning and continues with all defaults. If a value is out of range (e.g., a weight outside `0–1`) the action exits with a non-zero code and an error message listing every invalid field.

---

**Next step:** [Signals →](signals.md)
