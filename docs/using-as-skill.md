# Using PR Risk Scorer as an AI Coding Skill

You can integrate PR Risk Scorer into AI coding assistants so they score pull requests automatically as part of code reviews.

---

## Claude Code

### `/score-pr` slash command

The repository ships a custom Claude Code slash command at `.claude/commands/score-pr.md`. When you open the project in Claude Code, the `/score-pr` command becomes available.

**Usage:**

```
/score-pr
```

Claude will:

1. Run `git diff HEAD~1 HEAD` to collect structural signals
2. Score each dimension using the same weights as the GitHub Action
3. Print a Markdown risk table with per-signal scores and a weighted total
4. Recommend which signal to address first

**Install for any project:**

Copy `.claude/commands/score-pr.md` into the target repository's `.claude/commands/` directory. The command is immediately available in Claude Code without configuration.

**Global install:**

To make the command available in every project, copy the file to your user-level commands directory:

```bash
mkdir -p ~/.claude/commands
cp .claude/commands/score-pr.md ~/.claude/commands/score-pr.md
```

---

## GitHub Copilot (Codex / Chat)

Add the scorer's rubric to your workspace instructions so Copilot considers structural risk during code reviews.

### Step 1 — Create workspace instructions

Create `.github/copilot-instructions.md` in your repository:

````markdown
## PR review checklist

When reviewing a pull request, compute a structural risk score using these five dimensions:

| Signal | Weight | Method |
|--------|--------|--------|
| Diff Size | 20% | `min(total_lines / 1000 * 100, 100)` |
| Cyclomatic Complexity | 30% | Average radon CC score, normalized 1–26 → 0–100 |
| Coverage Gap | 20% | `(1 - line_rate) * 100` from coverage.xml |
| Dead Code | 15% | Vulture items, capped at 20 → 100 |
| Migrations | 15% | 0 files=0, 1=60, 2=80, 3+=100 |

Weighted total: `score = 0.20*diff + 0.30*complexity + 0.20*coverage + 0.15*dead + 0.15*migration`

Risk tiers: < 40 = LOW 🟢, 40–70 = MEDIUM 🟡, > 70 = HIGH 🔴

Include the score table in every PR review comment.
````

### Step 2 — Use Copilot Chat

In VS Code, open Copilot Chat and ask:

```
@workspace Score this PR for structural risk using the rubric in copilot-instructions.md
```

Copilot will apply the weights and return a formatted risk table.

---

## Cursor

Add the scoring rubric to your project's `.cursor/rules` file (or `cursor_rules.md`):

```markdown
## PR Risk Scoring

Before approving any PR, compute and display a risk score:
- Diff Size (20%): lines changed / 1000, capped at 100
- Complexity (30%): average cyclomatic complexity via radon, normalized 0–100
- Coverage Gap (20%): 1 − coverage line-rate, as a percentage
- Dead Code (15%): vulture items / 20, capped at 100
- Migrations (15%): 0→0, 1→60, 2→80, 3+→100

Total = weighted sum. LOW < 40, MEDIUM 40–70, HIGH > 70.
```

---

## OpenAI Codex / ChatGPT

You can attach the scoring rubric as a system prompt or a file upload. Create a plain-text file `pr-risk-rubric.txt`:

```
PR Risk Scoring Rubric

Signals and weights:
  Diff Size     20%  min(lines_changed / 1000 * 100, 100)
  Complexity    30%  min((avg_cc - 1) / 25 * 100, 100)   [radon output]
  Coverage Gap  20%  (1 - line_rate) * 100                [coverage.xml]
  Dead Code     15%  min(vulture_items / 20 * 100, 100)
  Migrations    15%  0→0, 1→60, 2→80, 3+→100

Total = weighted sum. Tiers: LOW < 40, MEDIUM 40–70, HIGH > 70.

For every PR, output a Markdown table with each signal's score and the weighted total.
```

Attach this file in the ChatGPT conversation or include it in your Codex system prompt.

---

## GitHub Actions (automated)

The fastest way to get risk scores on every PR is the GitHub Action itself. See [Getting Started](getting-started.md) for the workflow YAML.

The action posts the score as a PR comment and sets a commit status — no AI assistant required.

---

**Next step:** [Configuration →](configuration.md)
