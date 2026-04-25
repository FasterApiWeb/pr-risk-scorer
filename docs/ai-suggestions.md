# AI Suggestions

When enabled, PR Risk Scorer calls the Claude API after scoring and posts a threaded comment with concrete, actionable suggestions for reducing the PR's risk. The feature is opt-in and only fires when the score meets or exceeds a configured threshold.

---

## How it works

1. After all signals are collected, the action checks whether `ai_suggestions.enabled` is `true` and whether the total score is at or above `min_score`.
2. It sends the scored signal breakdown (names, scores, and details) to the Claude API with a structured prompt.
3. Claude returns a ranked list of improvement suggestions — each tied to a specific signal.
4. The action posts the suggestions as a new threaded comment on the PR, separate from the main score comment.

!!! note "Secret leak skip"
    If the secret leak signal fires, AI suggestions are skipped. The PR contains a credential and must be fixed before anything else.

---

## Setup

1. Create an Anthropic API key at [console.anthropic.com](https://console.anthropic.com).
2. Add it as a GitHub Actions secret (e.g., `ANTHROPIC_API_KEY`).
3. Add the following to `.github/pr-risk-scorer.yml`:

```yaml
ai_suggestions:
  enabled: true
  min_score: 50
  anthropicTokenSecret: ANTHROPIC_API_KEY
  maxTokens: 1024
```

That's it — no additional workflow changes are needed.

---

## Configuration reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch. Set to `false` to disable without removing the block. |
| `min_score` | integer 0–100 | *(required)* | Minimum score that triggers the Claude call |
| `anthropicTokenSecret` | string | *(required)* | Name of the GitHub Actions secret holding the Anthropic API key |
| `maxTokens` | integer | `1024` | Maximum tokens in the Claude response; increase for more detailed suggestions |

---

## Example PR comment

When suggestions fire, a threaded reply appears below the main score comment:

```
### 💡 AI Suggestions

**Reduce cyclomatic complexity** — The average CCN of 14.2 is well above the LOW threshold.
Consider extracting the branching logic in `auth/handler.ts` into smaller, single-purpose
functions. Aim for CCN ≤ 5 per function.

**Add tests for changed code** — Coverage dropped to 61%. Focus on the new
`validatePermissions` path in `src/rbac.ts`, which has no direct test coverage.

**Remove unused exports** — 8 symbols are exported but never imported. Run `ts-prune`
locally and delete or internalize symbols that are only used within the same module.
```

---

## Cost and latency

Each trigger makes one API call to `claude-sonnet-4-20250514`. At the default `maxTokens: 1024` the call typically completes in 2–4 seconds and costs less than $0.01 per PR.

To reduce cost, raise `min_score` so suggestions only fire on genuinely risky PRs, or lower `maxTokens`.

---

## Disabling suggestions temporarily

Set `enabled: false` in the config without removing the rest of the block:

```yaml
ai_suggestions:
  enabled: false
  min_score: 50
  anthropicTokenSecret: ANTHROPIC_API_KEY
```

---

**Next step:** [Contributing →](contributing.md)
