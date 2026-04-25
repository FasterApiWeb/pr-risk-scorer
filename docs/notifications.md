# Notifications

PR Risk Scorer can post alerts to Slack, create Jira issues, and label Linear issues when a PR's score reaches a configured threshold. All integrations are optional and independent — enable any combination.

---

## Slack

Posts a Block Kit message to a channel when the score meets or exceeds `minScore`.

### Setup

1. Create a Slack Incoming Webhook in your Slack app settings and copy the URL.
2. Add it as a GitHub Actions secret (e.g., `SLACK_WEBHOOK_URL`).
3. Configure the integration in `.github/pr-risk-scorer.yml`:

```yaml
notifications:
  slack:
    webhookSecret: SLACK_WEBHOOK_URL
    minScore: 70
    channel: "#eng-alerts"   # optional — overrides the webhook default
```

### Message format

The message shows the PR title, score, risk band, and the top 3 signal details:

```
🔶 High Risk PR: 78/100
*Fix user auth flow*
Risk Score: *78/100* — HIGH
complexity: avg CCN 14.2 · dead code: 8 unused exports · migrations: 2 files found
```

### Configuration reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `webhookSecret` | string | yes | Secret name holding the Incoming Webhook URL |
| `minScore` | integer 0–100 | yes | Score threshold that triggers the message |
| `channel` | string | no | Override the default channel (e.g., `#alerts`) |

---

## Jira

Creates a Jira issue (type: **Bug**) when the score meets or exceeds `minScore`. The issue includes a bullet list of all signal details and a link back to the PR.

Priority is set to **High** when the score is ≥ 80, otherwise **Medium**.

### Setup

1. Generate a Jira API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
2. Add two GitHub Actions secrets:
   - Your API token (e.g., `JIRA_API_TOKEN`)
   - The email address associated with the token (e.g., `JIRA_EMAIL`)
3. Configure the integration:

```yaml
notifications:
  jira:
    baseUrl: https://your-org.atlassian.net
    projectKey: ENG
    tokenSecret: JIRA_API_TOKEN
    emailSecret: JIRA_EMAIL
    minScore: 70
```

### Configuration reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `baseUrl` | string (URL) | yes | Jira Cloud base URL |
| `projectKey` | string | yes | Project key to create issues in |
| `tokenSecret` | string | yes | Secret name holding the Jira API token |
| `emailSecret` | string | yes | Secret name holding the associated email |
| `minScore` | integer 0–100 | yes | Score threshold that triggers issue creation |

---

## Linear

Applies a label to the Linear issue linked to the PR's branch when the score meets or exceeds `minScore`. The action looks up the issue by matching the branch name.

### Setup

1. Create a Linear API key at **Settings → API → Personal API keys**.
2. Create the label you want applied (e.g., `high-risk`) in the target team.
3. Add the API key as a GitHub Actions secret (e.g., `LINEAR_API_TOKEN`).
4. Find your team ID in Linear under **Settings → Members → Team ID**, or via the Linear API.
5. Configure the integration:

```yaml
notifications:
  linear:
    tokenSecret: LINEAR_API_TOKEN
    teamId: your-team-id
    label: high-risk
    minScore: 70
```

!!! note "Branch matching"
    Linear matches issues to branches by name. If no issue is linked to the PR's branch, the action logs a warning and skips silently.

### Configuration reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenSecret` | string | yes | Secret name holding the Linear API key |
| `teamId` | string | yes | Linear team ID |
| `label` | string | yes | Label name to apply to the issue |
| `minScore` | integer 0–100 | yes | Score threshold that triggers the label |

---

## Combining integrations

All three integrations can be active simultaneously with different thresholds:

```yaml
notifications:
  slack:
    webhookSecret: SLACK_WEBHOOK_URL
    minScore: 50          # warn on MEDIUM+
  jira:
    baseUrl: https://your-org.atlassian.net
    projectKey: ENG
    tokenSecret: JIRA_API_TOKEN
    emailSecret: JIRA_EMAIL
    minScore: 70          # create ticket on HIGH+
  linear:
    tokenSecret: LINEAR_API_TOKEN
    teamId: abc123
    label: needs-review
    minScore: 70
```

---

## Secret leak escalation

When the secret leak signal fires, all configured notifications trigger regardless of their `minScore` setting — a detected credential always warrants immediate attention.

---

**Next step:** [AI Suggestions →](ai-suggestions.md)
