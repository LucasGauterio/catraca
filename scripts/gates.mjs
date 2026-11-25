import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runNpm(args) {
  const cmd = ['npm', ...args].join(' ');
  const result = spawnSync(cmd, {
    stdio: 'inherit',
    shell: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('[catraca:gates] node_modules not found; running npm ci...');
    runNpm(['ci', '--no-audit', '--no-fund']);
  }

  console.log('[catraca:gates] 1/3 TypeScript typecheck...');
  runNpm(['run', 'typecheck']);

  console.log('[catraca:gates] 2/3 ESLint...');
  runNpm(['run', 'lint']);

  console.log('[catraca:gates] 3/3 Vitest test suite...');
  runNpm(['test']);

  console.log('[catraca:gates] All gates PASSED.');
}

main();
