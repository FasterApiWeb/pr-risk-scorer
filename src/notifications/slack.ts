import * as core from '@actions/core';

export interface SlackConfig {
  webhookSecret: string;
  minScore: number;
  channel?: string;
}

export interface SignalSummary {
  name: string;
  score: number;
  detail: string;
}

export interface NotificationPayload {
  score: number;
  band: string;
  prTitle: string;
  prUrl: string;
  signals: SignalSummary[];
}

export async function notifySlack(
  config: SlackConfig,
  payload: NotificationPayload,
): Promise<void> {
  if (payload.score < config.minScore) return;

  try {
    const top3 = [...payload.signals]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.detail)
      .join(' · ');

    const body: Record<string, unknown> = {
      text: `🔶 High Risk PR: ${payload.score}/100`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*<${payload.prUrl}|${payload.prTitle}>*\nRisk Score: *${payload.score}/100* — ${payload.band}`,
          },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: top3 }],
        },
      ],
    };

    if (config.channel !== undefined) {
      body['channel'] = config.channel;
    }

    const response = await fetch(config.webhookSecret, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      core.warning(`Slack notification failed: HTTP ${response.status}`);
    }
  } catch (err) {
    core.warning(`Slack notification error: ${String(err)}`);
  }
}
