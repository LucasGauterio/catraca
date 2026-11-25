import { spawnSync } from 'node:child_process';

function main() {
  console.log('[catraca:down] Stopping Docker Compose stack...');
  const result = spawnSync('docker', ['compose', 'down', '--remove-orphans'], {
    stdio: 'inherit',
  });
  if (result.error) {
    console.error('[catraca:down] Failed:', result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  console.log('[catraca:down] All Catraca containers stopped and removed.');
}

main();
