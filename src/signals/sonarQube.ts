export interface SonarResult {
  score: number;
  status: 'OK' | 'WARN' | 'ERROR' | 'unavailable';
  detail: string;
  conditions: string[];
}

export interface SonarQubeSignalConfig {
  enabled: boolean;
  host_url: string;
  token_secret: string;
  project_key: string;
  wait_for_analysis?: boolean;
  timeout_seconds?: number;
}

interface QualityGateCondition {
  status: string;
  metricKey: string;
  actualValue?: string;
  errorThreshold?: string;
  comparator?: string;
}

interface QualityGateResponse {
  projectStatus: {
    status: string;
    conditions?: QualityGateCondition[];
  };
}

const SKIPPED: SonarResult = { score: 0, status: 'unavailable', detail: 'skipped', conditions: [] };

const STATUS_SCORES: Record<string, number> = { OK: 0, WARN: 8, ERROR: 15 };

function scoreForStatus(status: string): number {
  return STATUS_SCORES[status] ?? 15;
}

// SonarQube comparator: LT = fails when metric < threshold, GT = fails when metric > threshold
function formatCondition(c: QualityGateCondition): string {
  const op = c.comparator === 'GT' ? '>' : '<';
  if (c.actualValue !== undefined && c.errorThreshold !== undefined) {
    return `${c.metricKey} ${op} ${c.errorThreshold}`;
  }
  return c.metricKey;
}

function authHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
}

async function fetchStatus(url: string, token: string): Promise<QualityGateResponse | null> {
  try {
    const res = await fetch(url, { headers: { Authorization: authHeader(token) } });
    if (!res.ok) return null;
    return (await res.json()) as QualityGateResponse;
  } catch {
    return null;
  }
}

async function pollUntilReady(
  hostUrl: string,
  token: string,
  projectKey: string,
  prNumber: number,
  waitForAnalysis: boolean,
  timeoutMs: number,
): Promise<QualityGateResponse | null> {
  const url =
    `${hostUrl}/api/qualitygates/project_status` +
    `?projectKey=${encodeURIComponent(projectKey)}&pullRequest=${prNumber}`;
  const intervalMs = 5_000;
  const deadline = Date.now() + timeoutMs;

  do {
    const response = await fetchStatus(url, token);
    if (response !== null) {
      const { status } = response.projectStatus;
      if (!waitForAnalysis || status !== 'NONE') return response;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(intervalMs, remaining)));
  } while (Date.now() < deadline);

  return null;
}

export async function sonarQube(
  config: SonarQubeSignalConfig | undefined,
  prNumber: number,
): Promise<SonarResult> {
  if (!config?.enabled) return SKIPPED;

  const token = process.env[config.token_secret];
  if (!token) {
    return {
      score: 0,
      status: 'unavailable',
      detail: `secret ${config.token_secret} not set`,
      conditions: [],
    };
  }

  const timeoutSeconds = config.timeout_seconds ?? 120;
  const waitForAnalysis = config.wait_for_analysis ?? true;

  const response = await pollUntilReady(
    config.host_url,
    token,
    config.project_key,
    prNumber,
    waitForAnalysis,
    timeoutSeconds * 1_000,
  );

  if (!response) {
    return {
      score: 0,
      status: 'unavailable',
      detail: `timed out after ${timeoutSeconds}s`,
      conditions: [],
    };
  }

  const { status, conditions = [] } = response.projectStatus;
  const failed = conditions.filter(c => c.status === 'ERROR' || c.status === 'WARN');
  const conditionStrings = failed.map(formatCondition);

  const sonarStatus: SonarResult['status'] =
    status === 'OK'    ? 'OK'
    : status === 'WARN'  ? 'WARN'
    : status === 'ERROR' ? 'ERROR'
    : 'unavailable';

  return {
    score: scoreForStatus(status),
    status: sonarStatus,
    detail: conditionStrings.length > 0
      ? conditionStrings.join(', ')
      : `quality gate ${status.toLowerCase()}`,
    conditions: conditionStrings,
  };
}
