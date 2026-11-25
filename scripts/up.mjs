import { spawnSync } from 'node:child_process';
import http from 'node:http';

const HEALTH_URL = 'http://localhost:3000/api/health';
const MAX_WAIT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function checkHealthOnce() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3_000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const healthy = await checkHealthOnce();
    if (healthy) {
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  console.error(`[catraca:up] Timeout waiting for ${HEALTH_URL} after ${MAX_WAIT_MS / 1000}s.`);
  process.exit(1);
}

async function main() {
  console.log('[catraca:up] Starting Docker Compose stack...');
  runCommand('docker', ['compose', 'up', '-d', '--build']);

  console.log('[catraca:up] Waiting for http://localhost:3000/api/health ...');
  await waitForHealth();

  console.log('[catraca:up] Running database migrations...');
  runCommand('docker', ['compose', 'exec', '-T', 'app', 'npx', 'tsx', 'src/db/migrate.ts']);

  console.log('[catraca:up] Running idempotent seed...');
  runCommand('docker', ['compose', 'exec', '-T', 'app', 'npx', 'tsx', 'src/db/seed.ts']);

  console.log('[catraca:up] Catraca environment is UP at http://localhost:3000');
}

main().catch((err) => {
  console.error('[catraca:up] Failed:', err);
  process.exit(1);
});
