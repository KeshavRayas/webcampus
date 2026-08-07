import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('exit', (code) => {
      resolve(code ?? 1);
    });

    child.on('error', () => {
      resolve(1);
    });
  });
}

async function runStep(label, command, args, allowFailure = false) {
  console.log(`\n> ${label}`);
  const exitCode = await run(command, args);

  if (exitCode !== 0 && !allowFailure) {
    process.exit(exitCode);
  }
}

await runStep('Banner', 'bunx', ['tsx', 'scripts/banner.ts']);
await runStep('Free development ports', 'bun', ['kill-port', '8080'], true);
await runStep('Free development ports', 'bun', ['kill-port', '3000'], true);
await runStep('Start database services', 'bun', ['dx'], true);
await runStep('Bootstrap required resources', 'bun', ['run', 'bootstrap'], true);
await runStep('Start Turborepo development servers', 'bunx', ['turbo', 'dev']);
