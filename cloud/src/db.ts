import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'agentprobe.db');

// Ensure data directory exists
import fs from 'fs';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS probe_runs (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL,
    total INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    skipped INTEGER DEFAULT 0,
    total_cost REAL NOT NULL,
    total_duration INTEGER NOT NULL,
    security_score INTEGER,
    git_sha TEXT,
    git_branch TEXT,
    report_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
  );

  CREATE TABLE IF NOT EXISTS probe_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file TEXT,
    status TEXT NOT NULL,
    duration INTEGER NOT NULL,
    cost REAL NOT NULL,
    steps INTEGER DEFAULT 0,
    error TEXT,
    assertions_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES probe_runs(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_runs_key ON probe_runs(api_key_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_results_run ON probe_results(run_id);
  CREATE INDEX IF NOT EXISTS idx_results_name ON probe_results(name, created_at DESC);
`);

// ── API Key Management ───────────────────────────────────

export function generateApiKey(name: string): { id: string; key: string } {
  const id = crypto.randomUUID();
  const key = `ap_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  db.prepare(`INSERT INTO api_keys (id, key_hash, name) VALUES (?, ?, ?)`)
    .run(id, keyHash, name);

  return { id, key };
}

export function validateApiKey(key: string): string | null {
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const row = db.prepare(`SELECT id FROM api_keys WHERE key_hash = ?`).get(keyHash) as any;
  return row?.id ?? null;
}

// ── Probe Runs ───────────────────────────────────────────

export function saveRun(apiKeyId: string, data: any): string {
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO probe_runs (id, api_key_id, total, passed, failed, skipped,
      total_cost, total_duration, security_score, git_sha, git_branch, report_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, apiKeyId, data.total, data.passed, data.failed, data.skipped ?? 0,
    data.totalCost, data.totalDuration, data.securityScore ?? null,
    data.gitSha ?? null, data.gitBranch ?? null, JSON.stringify(data),
  );

  // Save individual results
  const insertResult = db.prepare(`
    INSERT INTO probe_results (id, run_id, name, file, status, duration, cost, steps, error, assertions_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of data.results ?? []) {
    insertResult.run(
      crypto.randomUUID(), id, r.name, r.file ?? '', r.status,
      r.duration, r.cost, r.steps ?? 0, r.error ?? null,
      JSON.stringify(r.assertions ?? []),
    );
  }

  return id;
}

export function getRuns(apiKeyId: string, limit = 50): any[] {
  return db.prepare(`
    SELECT id, total, passed, failed, skipped, total_cost, total_duration,
      security_score, git_sha, git_branch, created_at
    FROM probe_runs WHERE api_key_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(apiKeyId, limit);
}

export function getRunDetail(runId: string): any {
  const run = db.prepare(`SELECT * FROM probe_runs WHERE id = ?`).get(runId) as any;
  if (!run) return null;

  const results = db.prepare(`
    SELECT * FROM probe_results WHERE run_id = ? ORDER BY name
  `).all(runId);

  return { ...run, results };
}

// ── Dashboard Stats ──────────────────────────────────────

export function getDashboardStats(apiKeyId: string): any {
  const totals = db.prepare(`
    SELECT COUNT(*) as total_runs,
      SUM(total) as total_probes, SUM(passed) as total_passed,
      SUM(failed) as total_failed, SUM(total_cost) as total_cost
    FROM probe_runs WHERE api_key_id = ?
  `).get(apiKeyId) as any;

  const recent = db.prepare(`
    SELECT passed, failed, total_cost, total_duration, security_score, created_at
    FROM probe_runs WHERE api_key_id = ?
    ORDER BY created_at DESC LIMIT 30
  `).all(apiKeyId);

  const regressions = db.prepare(`
    SELECT pr.name, pr.status, pr.run_id, prn.created_at
    FROM probe_results pr
    JOIN probe_runs prn ON pr.run_id = prn.id
    WHERE prn.api_key_id = ? AND pr.status = 'failed'
    ORDER BY prn.created_at DESC LIMIT 20
  `).all(apiKeyId);

  return { totals, recent, regressions };
}

export default db;
