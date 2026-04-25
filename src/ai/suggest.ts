import * as core from "@actions/core";
import type { ScoreResult } from "../scorer";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseSuggestions,
  type DiffStats,
  type Suggestion,
} from "./prompt";

export interface AiConfig {
  enabled: boolean;
  minScore: number;
  anthropicTokenSecret: string;
  maxTokens: number;
}

// ScorerOutput is an alias kept for callers; internally ScoreResult is the same shape.
export type ScorerOutput = ScoreResult;

export async function getSuggestions(
  config: AiConfig,
  scorerOutput: ScorerOutput,
  stats: DiffStats
): Promise<Suggestion[] | null> {
  if (!config.enabled || scorerOutput.total < config.minScore) {
    return null;
  }

  if (scorerOutput.override === "secret_leak") {
    return null;
  }

  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: config.maxTokens,
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(scorerOutput.signals, stats),
      },
    ],
  });

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.anthropicTokenSecret,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body,
    });
  } catch (err) {
    core.warning(`ai/suggest: network error — ${String(err)}`);
    return null;
  }

  if (!response.ok) {
    core.warning(
      `ai/suggest: Anthropic API returned ${response.status} ${response.statusText}`
    );
    return null;
  }

  let raw: string;
  try {
    const json = (await response.json()) as {
      content?: Array<{ text?: string }>;
    };
    raw = json.content?.[0]?.text ?? "";
  } catch (err) {
    core.warning(`ai/suggest: failed to parse API response — ${String(err)}`);
    return null;
  }

  const suggestions = parseSuggestions(raw);
  if (suggestions.length === 0) {
    core.warning("ai/suggest: parseSuggestions returned empty array");
    return null;
  }

  return suggestions;
}
