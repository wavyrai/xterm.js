/**
 * Copyright (c) 2026 tmux-ide contributors.
 * @license MIT
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const esbuildVersion = '0.25.2';
const targets = new Map([
  ['darwin-arm64', {
    name: '@esbuild/darwin-arm64',
    integrity: 'sha512-MpM6LUVTXAzOvN4KbjzU/q5smzryuoNjlriAIx+06RpecwCkL9JpenNzpKd2YMzLJFOdPqBpuub6eVRP5IgiSA=='
  }],
  ['linux-x64', {
    name: '@esbuild/linux-x64',
    integrity: 'sha512-QInHERlqpTTZ4FRB0fROQWXcYRD64lAoiegezDunLpalZMjcUcld3YzZmVJ2H/Cp0wJRZ8Xtjtj0cEHhYc/uUg=='
  }]
]);

const targetKey = `${process.platform}-${process.arch}`;
const target = targets.get(targetKey);
if (!target) {
  throw new Error(`No pinned esbuild binary for release platform ${targetKey}`);
}

const stagingRoot = mkdtempSync(join(tmpdir(), 'tmux-ide-esbuild-'));
try {
  const packed = JSON.parse(run('npm', [
    'pack',
    `${target.name}@${esbuildVersion}`,
    '--json',
    '--pack-destination', stagingRoot
  ]));
  if (packed.length !== 1 || packed[0].name !== target.name || packed[0].version !== esbuildVersion || packed[0].integrity !== target.integrity) {
    throw new Error(`Pinned esbuild artifact mismatch: ${JSON.stringify(packed)}`);
  }
  const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const targetDirectory = resolve(repoRoot, 'node_modules', ...target.name.split('/'));
  const installedPackageJson = resolve(targetDirectory, 'package.json');
  if (!existsSync(installedPackageJson)) {
    const expanded = join(stagingRoot, 'expanded');
    mkdirSync(expanded);
    run('tar', ['-xzf', join(stagingRoot, packed[0].filename), '-C', expanded]);
    mkdirSync(dirname(targetDirectory), { recursive: true });
    cpSync(join(expanded, 'package'), targetDirectory, { recursive: true, errorOnExist: true });
  }
  const installed = JSON.parse(readFileSync(installedPackageJson, 'utf8'));
  if (installed.name !== target.name || installed.version !== esbuildVersion) {
    throw new Error(`Installed esbuild binary mismatch: ${JSON.stringify(installed)}`);
  }
  console.log(`Pinned ${target.name}@${esbuildVersion}: PASS`);
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}
