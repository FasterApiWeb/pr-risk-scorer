import * as core from '@actions/core';
import type { NotificationPayload } from './slack';

export interface JiraConfig {
  baseUrl: string;
  projectKey: string;
  tokenSecret: string;
  emailSecret: string;
  minScore: number;
}

export async function notifyJira(
  config: JiraConfig,
  payload: NotificationPayload,
): Promise<string | null> {
  if (payload.score < config.minScore) return null;

  try {
    const auth = Buffer.from(`${config.emailSecret}:${config.tokenSecret}`).toString('base64');

    const signalList = payload.signals
      .sort((a, b) => b.score - a.score)
      .map(s => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `${s.name}: ${s.detail} (${s.score}/100)` }],
          },
        ],
      }));

    const description = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Risk signals detected in this pull request:' },
          ],
        },
        {
          type: 'bulletList',
          content: signalList,
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Pull request: ' },
            {
              type: 'inlineCard',
              attrs: { url: payload.prUrl },
            },
          ],
        },
      ],
    };

    const body = {
      fields: {
        project: { key: config.projectKey },
        summary: `[PR Risk] ${payload.prTitle} — Score ${payload.score}/100`,
        issuetype: { name: 'Bug' },
        priority: { name: payload.score >= 80 ? 'High' : 'Medium' },
        description,
      },
    };

    const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      core.warning(`Jira notification failed: HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { key?: string };
    if (!data.key) {
      core.warning('Jira notification succeeded but response contained no issue key');
      return null;
    }

    return data.key;
  } catch (err) {
    core.warning(`Jira notification error: ${String(err)}`);
    return null;
  }
}
