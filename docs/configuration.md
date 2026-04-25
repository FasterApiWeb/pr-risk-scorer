# Configuration

PR Risk Scorer works out of the box with no configuration file. When a file is present it must be valid **YAML** placed at `.github/pr-risk-scorer.yml` (or the path set via the `config-path` action input).

## Full reference

```yaml
thresholds:
  medium: 40
  high: 70

block_merge: 80

weights:
  filesChanged: 8
  complexityDelta: 17
  coverageRatio: 15
  migrationFiles: 12
  deadCode: 8
  secret_leak: 12
  bundle_size_delta: 4
  api_breaking_changes: 4
  sonarqube: 15
  lang_specific_tests: 5

sonarqube:
  enabled: true
  host_url: https://sonarqube.yourorg.com
  token_secret: SONAR_TOKEN
  project_key: your-project-key
  wait_for_analysis: true
  timeout_seconds: 120

required_approvers:
  - alice
  - bob

notifications:
  slack:
    webhookSecret: SLACK_WEBHOOK_URL
    minScore: 70
    channel: "#eng-alerts"
  jira:
    baseUrl: https://your-org.atlassian.net
    projectKey: ENG
    tokenSecret: JIRA_API_TOKEN
    emailSecret: JIRA_EMAIL
    minScore: 70
  linear:
    tokenSecret: LINEAR_API_TOKEN
    teamId: your-team-id
    label: high-risk
    minScore: 70

ai_suggestions:
  enabled: true
  min_score: 50
  anthropicTokenSecret: ANTHROPIC_API_KEY
  maxTokens: 1024
```

All fields are optional. Omitted fields use the defaults shown above.

---

## Fields

### `thresholds`

Controls how the numeric score maps to a risk band.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `medium` | `integer` 0–100 | `40` | Scores ≥ this value are labelled **MEDIUM** |
| `high` | `integer` 0–100 | `70` | Scores > this value are labelled **HIGH** |

Scores below `medium` are labelled **LOW**.

---

### `block_merge`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `block_merge` | `integer` 0–100 | *(unset)* | When the total score reaches this value the commit status is set to **failure**, blocking merge via required status checks. |

!!! tip
    Set `block_merge` to the same value as `thresholds.high` to automatically block all HIGH-risk PRs.

!!! warning "Secret leak override"
    A detected secret always blocks merge regardless of this setting.

---

### `weights`

Each weight is an integer between `0` and `100`. The values **must sum to exactly 100**.

| Key | Default | Signal |
|-----|---------|--------|
| `filesChanged` | `8` | Number of files and lines changed |
| `complexityDelta` | `17` | Cyclomatic complexity of changed functions |
| `coverageRatio` | `15` | Test coverage gap (inverse of line coverage) |
| `migrationFiles` | `12` | Database migration files detected |
| `deadCode` | `8` | Unused exports/symbols introduced |
| `secret_leak` | `12` | Hardcoded secrets detected by gitleaks |
| `bundle_size_delta` | `4` | Bundle size budget violations |
| `api_breaking_changes` | `4` | Breaking API changes (OpenAPI diff / TypeScript) |
| `sonarqube` | `15` | SonarQube quality gate result (OK / WARN / ERROR) |
| `lang_specific_tests` | `5` | Language-specific test signal (reserved for future use) |

!!! note
    Weights are normalized at runtime so partial configs still produce a valid 0–100 result, but the validator will error if the provided values don't sum to 100.

---

### `required_approvers`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `required_approvers` | `string[]` | *(unset)* | GitHub usernames (with or without `@`) to add to `.github/CODEOWNERS` when the score reaches MEDIUM or HIGH. |

---

### `notifications`

Optional integrations that fire when a PR's score reaches or exceeds the configured `minScore`. See [Notifications →](notifications.md) for full setup instructions.

#### `notifications.slack`

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `webhookSecret` | `string` | yes | Name of the GitHub Actions secret holding the Slack Incoming Webhook URL |
| `minScore` | `integer` 0–100 | yes | Minimum score that triggers the notification |
| `channel` | `string` | no | Override the default channel set in the webhook |

#### `notifications.jira`

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `baseUrl` | `string` (URL) | yes | Your Jira Cloud base URL, e.g. `https://your-org.atlassian.net` |
| `projectKey` | `string` | yes | Jira project key, e.g. `ENG` |
| `tokenSecret` | `string` | yes | Name of the secret holding your Jira API token |
| `emailSecret` | `string` | yes | Name of the secret holding the email address associated with the token |
| `minScore` | `integer` 0–100 | yes | Minimum score that triggers issue creation |

#### `notifications.linear`

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `tokenSecret` | `string` | yes | Name of the secret holding your Linear API token |
| `teamId` | `string` | yes | Linear team ID to search for the linked issue |
| `label` | `string` | yes | Label name to apply when the score threshold is met |
| `minScore` | `integer` 0–100 | yes | Minimum score that triggers the label |

---

### `sonarqube`

Connects the SonarQube quality gate signal to your self-hosted or cloud SonarQube instance.

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `enabled` | `boolean` | no | `false` | Master switch. When `false` the signal returns `0`. |
| `host_url` | `string` (URL) | yes | — | Base URL of your SonarQube instance, e.g. `https://sonarqube.yourorg.com` |
| `token_secret` | `string` | yes | — | Name of the GitHub Actions secret holding a SonarQube user/project token |
| `project_key` | `string` | yes | — | SonarQube project key |
| `wait_for_analysis` | `boolean` | no | `true` | Poll until the quality gate is no longer `NONE` (analysis still running) |
| `timeout_seconds` | `integer` | no | `120` | Maximum seconds to wait for analysis before returning `0` |

See [Signals → SonarQube quality gate](signals.md#sonarqube-quality-gate) for full setup instructions.

---

### `ai_suggestions`

Enables Claude-powered improvement suggestions posted as a threaded PR comment. See [AI Suggestions →](ai-suggestions.md) for setup.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | `boolean` | `true` | Master switch for the feature |
| `min_score` | `integer` 0–100 | *(required)* | Minimum score that triggers suggestions |
| `anthropicTokenSecret` | `string` | *(required)* | Name of the secret holding your Anthropic API key |
| `maxTokens` | `integer` | `1024` | Maximum tokens for the Claude response |

---

## Examples

### Strict mode — block anything above 60

```yaml
thresholds:
  medium: 30
  high: 60
block_merge: 60
```

### Emphasize coverage and secrets

```yaml
weights:
  filesChanged: 5
  complexityDelta: 10
  coverageRatio: 30
  migrationFiles: 10
  deadCode: 5
  secret_leak: 20
  bundle_size_delta: 2
  api_breaking_changes: 3
  sonarqube: 10
  lang_specific_tests: 5
```

### Require team leads on risky PRs

```yaml
thresholds:
  high: 65
block_merge: 80
required_approvers:
  - alice
  - bob
  - carol
```

### Slack alerts on high-risk PRs

```yaml
notifications:
  slack:
    webhookSecret: SLACK_WEBHOOK_URL
    minScore: 70
    channel: "#pr-alerts"
```

---

## Validation errors

If the config file contains invalid YAML, the action logs a warning and continues with all defaults. If a value is out of range (e.g., a weight outside `0–100`, or weights that don't sum to 100) the action exits with a non-zero code and an error message listing every invalid field.

---

**Next step:** [Signals →](signals.md)
