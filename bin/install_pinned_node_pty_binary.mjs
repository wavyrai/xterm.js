/**
 * Copyright (c) 2026 tmux-ide contributors.
 * @license MIT
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const expectedVersion = '1.1.0-beta19';
const packageJson = require('node-pty/package.json');

if (packageJson.version !== expectedVersion) {
  throw new Error(`Expected node-pty ${expectedVersion}, received ${packageJson.version}`);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rebuild = spawnSync(npmCommand, ['rebuild', `node-pty@${expectedVersion}`, '--foreground-scripts'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  stdio: 'inherit'
});
if (rebuild.error) {
  throw rebuild.error;
}
if (rebuild.status !== 0) {
  throw new Error(`Pinned node-pty rebuild exited with status ${rebuild.status}`);
}

const nodePty = require('node-pty');
if (typeof nodePty.spawn !== 'function') {
  throw new Error('Pinned node-pty native addon did not expose spawn()');
}

console.log(`Pinned node-pty ${expectedVersion} native addon: PASS`);
