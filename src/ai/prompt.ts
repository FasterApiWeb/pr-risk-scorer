import { z } from "zod";

export interface SignalSummary {
  name: string;
  score: number;
  detail: string;
}

export interface DiffStats {
  filesChanged: number;
  complexityDelta: number;
  coverage: number;
  migrationCount: number;
}

export type Suggestion = {
  signal: string;
  action: string;
  effort: "low" | "medium" | "high";
};

const SuggestionSchema = z.object({
  signal: z.string(),
  action: z.string(),
  effort: z.enum(["low", "medium", "high"]),
});

const SuggestionsSchema = z.array(SuggestionSchema).length(3);

export function buildSystemPrompt(): string {
  return (
    "You are a senior engineer reviewing a pull request risk report.\n" +
    "You will receive risk signals and diff stats.\n" +
    "Return ONLY a JSON array of exactly 3 suggestions.\n" +
    "Each item: { signal: string, action: string, effort: 'low'|'medium'|'high' }\n" +
    "No preamble. No markdown fences. Raw JSON array only."
  );
}

export function buildUserPrompt(signals: SignalSummary[], stats: DiffStats): string {
  const signalLines = signals
    .filter((s) => s.score > 0)
    .map((s) => `- ${s.name}: score=${s.score}, detail="${s.detail}"`)
    .join("\n");

  return (
    `Risk signals:\n${signalLines || "(none)"}\n\n` +
    `Diff stats:\n` +
    `- filesChanged: ${stats.filesChanged}\n` +
    `- complexityDelta: ${stats.complexityDelta}\n` +
    `- coverage: ${stats.coverage}\n` +
    `- migrationCount: ${stats.migrationCount}`
  );
}

export function parseSuggestions(raw: string): Suggestion[] {
  try {
    const parsed = JSON.parse(raw);
    const result = SuggestionsSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}
