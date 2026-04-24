import * as core from '@actions/core';
import type { NotificationPayload } from './slack';

export interface LinearConfig {
  tokenSecret: string;
  teamId: string;
  label: string;
  minScore: number;
}

const LINEAR_API = 'https://api.linear.app/graphql';

async function linearRequest<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Linear API HTTP ${response.status}`);
  }

  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Linear API error: ${json.errors.map(e => e.message).join(', ')}`);
  }

  if (!json.data) {
    throw new Error('Linear API returned no data');
  }

  return json.data;
}

export async function notifyLinear(
  config: LinearConfig,
  payload: NotificationPayload,
  branchName: string,
): Promise<void> {
  if (payload.score < config.minScore) return;

  try {
    const labelData = await linearRequest<{
      issueLabels: { nodes: { id: string }[] };
    }>(
      config.tokenSecret,
      `query($teamId: ID!, $labelName: String!) {
        issueLabels(filter: { team: { id: { eq: $teamId } }, name: { eq: $labelName } }) {
          nodes { id }
        }
      }`,
      { teamId: config.teamId, labelName: config.label },
    );

    const labelId = labelData.issueLabels.nodes[0]?.id;
    if (!labelId) {
      core.warning(`Linear: label "${config.label}" not found in team ${config.teamId}`);
      return;
    }

    const issueData = await linearRequest<{
      issues: { nodes: { id: string; labelIds: string[] }[] };
    }>(
      config.tokenSecret,
      `query($teamId: ID!, $branch: String!) {
        issues(filter: { team: { id: { eq: $teamId } }, branchName: { eq: $branch } }) {
          nodes { id labelIds }
        }
      }`,
      { teamId: config.teamId, branch: branchName },
    );

    const issue = issueData.issues.nodes[0];
    if (!issue) {
      core.warning(`Linear: no open issue linked to branch "${branchName}", skipping`);
      return;
    }

    const existingLabelIds: string[] = issue.labelIds ?? [];
    if (existingLabelIds.includes(labelId)) return;

    await linearRequest(
      config.tokenSecret,
      `mutation($id: String!, $labelIds: [String!]!) {
        issueUpdate(id: $id, input: { labelIds: $labelIds }) {
          success
        }
      }`,
      { id: issue.id, labelIds: [...existingLabelIds, labelId] },
    );
  } catch (err) {
    core.warning(`Linear notification error: ${String(err)}`);
  }
}
