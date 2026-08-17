/**
 * Copyright (c) 2026 tmux-ide contributors.
 * @license MIT
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporaryRoot = mkdtempSync(join(tmpdir(), 'tmux-ide-xterm-pack-'));
const consumerRoot = join(temporaryRoot, 'consumer');

try {
  run('npm', ['run', 'package-headless'], repoRoot);
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temporaryRoot, './headless'], repoRoot));
  if (packed.length !== 1 || packed[0].name !== '@tmux-ide/xterm-headless' || packed[0].version !== '6.0.0-tmuxide.1') {
    throw new Error(`Unexpected pack result: ${JSON.stringify(packed)}`);
  }
  const tarball = join(temporaryRoot, packed[0].filename);
  writeFileSync(join(temporaryRoot, 'package.json'), JSON.stringify({ private: true }));
  run('npm', ['install', '--prefix', consumerRoot, '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', tarball], temporaryRoot);

  writeFileSync(join(consumerRoot, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noEmit: true
    },
    include: ['consumer.mts', 'consumer.cts']
  }));
  writeFileSync(join(consumerRoot, 'consumer.mts'), `
import { Terminal, type ITerminalAddon } from '@tmux-ide/xterm-headless';
const terminal = new Terminal({ allowProposedApi: true });
const addon: ITerminalAddon = {
  activate(value) { value.write('addon'); },
  dispose() {}
};
terminal.loadAddon(addon);
terminal.prioritizeNextWrite();
`);
  writeFileSync(join(consumerRoot, 'consumer.cts'), `
import fork = require('@tmux-ide/xterm-headless');
const terminal = new fork.Terminal({ allowProposedApi: true });
const addon: fork.ITerminalAddon = {
  activate(value) { value.write('addon'); },
  dispose() {}
};
terminal.loadAddon(addon);
terminal.prioritizeNextWrite();
`);
  run(join(repoRoot, 'node_modules', '.bin', 'tsc'), ['-p', join(consumerRoot, 'tsconfig.json')], repoRoot);

  writeFileSync(join(consumerRoot, 'runtime.mjs'), `
import { Terminal } from '@tmux-ide/xterm-headless';
const terminal = new Terminal({ allowProposedApi: true });
terminal.prioritizeNextWrite();
terminal.write('esm', () => {
  if (terminal.buffer.active.getLine(0)?.translateToString(true) !== 'esm') process.exitCode = 1;
});
`);
  writeFileSync(join(consumerRoot, 'runtime.cjs'), `
const { Terminal } = require('@tmux-ide/xterm-headless');
const terminal = new Terminal({ allowProposedApi: true });
terminal.prioritizeNextWrite();
terminal.write('cjs', () => {
  if (terminal.buffer.active.getLine(0).translateToString(true) !== 'cjs') process.exitCode = 1;
});
`);
  run(process.execPath, [join(consumerRoot, 'runtime.mjs')], consumerRoot);
  run(process.execPath, [join(consumerRoot, 'runtime.cjs')], consumerRoot);

  const declarations = readFileSync(join(consumerRoot, 'node_modules', '@tmux-ide', 'xterm-headless', 'typings', 'xterm-headless.d.ts'), 'utf8');
  if (!declarations.includes("declare module '@tmux-ide/xterm-headless'")) {
    throw new Error('Packed declarations do not identify the scoped fork module');
  }
  if (declarations.includes("declare module '@xterm/headless'")) {
    throw new Error('Packed declarations retain the upstream module identity');
  }
  console.log('Packed ESM, CommonJS, NodeNext types, and typed addon: PASS');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}
