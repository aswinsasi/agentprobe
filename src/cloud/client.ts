import type { RunSummary } from '../types/index.js';

export interface UploadOptions {
  apiKey: string;
  endpoint?: string;
  gitSha?: string;
  gitBranch?: string;
}

export async function uploadResults(
  summary: RunSummary,
  options: UploadOptions,
): Promise<{ id: string } | { error: string }> {
  const endpoint = options.endpoint ?? 'http://localhost:4700';

  try {
    const res = await fetch(`${endpoint}/api/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        ...summary,
        gitSha: options.gitSha ?? getGitSha(),
        gitBranch: options.gitBranch ?? getGitBranch(),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return { error: body.error ?? `Upload failed: ${res.status}` };
    }

    return await res.json();
  } catch (err) {
    return { error: `Upload failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function getGitSha(): string | undefined {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch { return undefined; }
}

function getGitBranch(): string | undefined {
  try {
    const { execSync } = require('child_process');
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch { return undefined; }
}
