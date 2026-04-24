import * as core from '@actions/core';
import { notifySlack } from './slack';
import { notifyJira } from './jira';
import { notifyLinear } from './linear';
import type { SlackConfig, NotificationPayload } from './slack';
import type { JiraConfig } from './jira';
import type { LinearConfig } from './linear';
import type { ScoreResult } from '../scorer';

export interface NotificationsConfig {
  slack?: SlackConfig;
  jira?: JiraConfig;
  linear?: LinearConfig;
}

export interface PrContext {
  prTitle: string;
  prUrl: string;
  branchName: string;
}

export interface NotificationResults {
  slack: boolean;
  jira: string | null;
  linear: boolean;
}

export async function runNotifications(
  config: NotificationsConfig,
  result: ScoreResult,
  prContext: PrContext,
): Promise<NotificationResults> {
  const payload: NotificationPayload = {
    score: result.total,
    band: result.band,
    prTitle: prContext.prTitle,
    prUrl: prContext.prUrl,
    signals: result.signals.map(s => ({
      name: s.name,
      score: s.score,
      detail: s.detail,
    })),
  };

  const [slackSettled, jiraSettled, linearSettled] = await Promise.allSettled([
    config.slack !== undefined
      ? notifySlack(config.slack, payload)
      : Promise.resolve(undefined),
    config.jira !== undefined
      ? notifyJira(config.jira, payload)
      : Promise.resolve(null as string | null),
    config.linear !== undefined
      ? notifyLinear(config.linear, payload, prContext.branchName)
      : Promise.resolve(undefined),
  ]);

  let slack = false;
  if (config.slack !== undefined) {
    if (slackSettled.status === 'fulfilled') {
      core.info('Notification: Slack ✓');
      slack = true;
    } else {
      core.warning(`Notification: Slack failed — ${String(slackSettled.reason)}`);
    }
  }

  let jira: string | null = null;
  if (config.jira !== undefined) {
    if (jiraSettled.status === 'fulfilled') {
      jira = jiraSettled.value;
      if (jira !== null) {
        core.info(`Notification: Jira ✓ — ${jira}`);
      } else {
        core.info('Notification: Jira — no issue created');
      }
    } else {
      core.warning(`Notification: Jira failed — ${String(jiraSettled.reason)}`);
    }
  }

  let linear = false;
  if (config.linear !== undefined) {
    if (linearSettled.status === 'fulfilled') {
      core.info('Notification: Linear ✓');
      linear = true;
    } else {
      core.warning(`Notification: Linear failed — ${String(linearSettled.reason)}`);
    }
  }

  return { slack, jira, linear };
}
