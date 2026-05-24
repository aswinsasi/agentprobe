import http from 'http';
import { generateApiKey, validateApiKey, saveRun, getRuns, getRunDetail, getDashboardStats } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '4700');

// ── Helpers ──────────────────────────────────────────────

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function error(res: http.ServerResponse, msg: string, status = 400) {
  json(res, { error: msg }, status);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getApiKeyId(req: http.IncomingMessage, res: http.ServerResponse): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    error(res, 'Missing Authorization: Bearer <api_key>', 401);
    return null;
  }
  const keyId = validateApiKey(auth.slice(7));
  if (!keyId) {
    error(res, 'Invalid API key', 401);
    return null;
  }
  return keyId;
}

// ── Server ───────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const method = req.method ?? 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  try {
    // ── Static: Dashboard ──────────────────────────────
    if (method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard')) {
      const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(fs.readFileSync(htmlPath));
      }
      return error(res, 'Dashboard not found', 404);
    }

    // ── Health ─────────────────────────────────────────
    if (method === 'GET' && url.pathname === '/api/health') {
      return json(res, { status: 'ok', version: '0.1.0' });
    }

    // ── Generate API Key ───────────────────────────────
    if (method === 'POST' && url.pathname === '/api/keys') {
      const body = JSON.parse(await readBody(req));
      const { id, key } = generateApiKey(body.name ?? 'default');
      return json(res, {
        id,
        key,
        message: 'Save this key — it will not be shown again.',
      }, 201);
    }

    // ── Upload Probe Run ───────────────────────────────
    if (method === 'POST' && url.pathname === '/api/runs') {
      const keyId = getApiKeyId(req, res);
      if (!keyId) return;

      const body = JSON.parse(await readBody(req));
      const runId = saveRun(keyId, body);
      return json(res, { id: runId, message: 'Run uploaded successfully' }, 201);
    }

    // ── List Runs ──────────────────────────────────────
    if (method === 'GET' && url.pathname === '/api/runs') {
      const keyId = getApiKeyId(req, res);
      if (!keyId) return;

      const limit = parseInt(url.searchParams.get('limit') ?? '50');
      const runs = getRuns(keyId, limit);
      return json(res, { runs });
    }

    // ── Get Run Detail ─────────────────────────────────
    if (method === 'GET' && url.pathname.startsWith('/api/runs/')) {
      const keyId = getApiKeyId(req, res);
      if (!keyId) return;

      const runId = url.pathname.split('/api/runs/')[1];
      const run = getRunDetail(runId);
      if (!run) return error(res, 'Run not found', 404);
      return json(res, run);
    }

    // ── Dashboard Stats ────────────────────────────────
    if (method === 'GET' && url.pathname === '/api/dashboard') {
      const keyId = getApiKeyId(req, res);
      if (!keyId) return;

      const stats = getDashboardStats(keyId);
      return json(res, stats);
    }

    // ── 404 ────────────────────────────────────────────
    error(res, 'Not found', 404);

  } catch (err) {
    console.error('Server error:', err);
    error(res, 'Internal server error', 500);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ⚡ AgentProbe Cloud');
  console.log(`  Dashboard: http://localhost:${PORT}`);
  console.log(`  API:       http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('  To generate an API key:');
  console.log(`  curl -X POST http://localhost:${PORT}/api/keys -H "Content-Type: application/json" -d '{"name":"my-project"}'`);
  console.log('');
});
