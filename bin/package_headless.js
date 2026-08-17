/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const { join } = require('path');

const repoRoot = join(__dirname, '..');
const headlessRoot = join(repoRoot, 'headless');

console.log('> headless/package.json');
const xtermPackageJson = require('../package.json');
const xtermHeadlessPackageJson = {
  ...xtermPackageJson,
  name: '@tmux-ide/xterm-headless',
  version: '6.0.0-tmuxide.1',
  description: 'tmux-ide pinned xterm.js headless fork with one-shot interactive write priority',
  repository: {
    type: 'git',
    url: 'git+https://github.com/wavyrai/xterm.js.git',
    directory: 'headless'
  },
  homepage: 'https://github.com/wavyrai/xterm.js/tree/v6.0.0-tmuxide.1/headless',
  bugs: { url: 'https://github.com/wavyrai/xterm.js/issues' },
  tmuxIdeFork: {
    upstreamCommit: 'f447274f430fd22513f6adbf9862d19524471c04',
    upstreamTree: '62330f6674bf1548123f3e1fe3da17363cc96a13',
    releaseTag: 'v6.0.0-tmuxide.1',
    api: 'prioritize-next-write-v1'
  },
  main: 'lib-headless/xterm-headless.js',
  module: 'lib-headless/xterm-headless.mjs',
  types: 'typings/xterm-headless.d.ts',
  exports: {
    '.': {
      types: './typings/xterm-headless.d.ts',
      import: './lib-headless/xterm-headless.mjs',
      require: './lib-headless/xterm-headless.js'
    }
  },
};
delete xtermHeadlessPackageJson['scripts'];
delete xtermHeadlessPackageJson['devDependencies'];
delete xtermHeadlessPackageJson['style'];
delete xtermHeadlessPackageJson['workspaces'];
fs.writeFileSync(join(headlessRoot, 'package.json'), JSON.stringify(xtermHeadlessPackageJson, null, 1));
console.log(fs.readFileSync(join(headlessRoot, 'package.json')).toString());

console.log('> headless/typings/');
mkdirF(join(headlessRoot, 'typings'));
const upstreamTypes = fs.readFileSync(join(repoRoot, 'typings/xterm-headless.d.ts'), 'utf8');
const upstreamModuleDeclaration = "declare module '@xterm/headless'";
const scopedModuleDeclaration = "declare module '@tmux-ide/xterm-headless'";
if (upstreamTypes.split(upstreamModuleDeclaration).length !== 2) {
  throw new Error(`Expected exactly one ${upstreamModuleDeclaration} declaration`);
}
fs.writeFileSync(
  join(headlessRoot, 'typings/xterm-headless.d.ts'),
  upstreamTypes.replace(upstreamModuleDeclaration, scopedModuleDeclaration)
);

console.log('> headless/LICENSE');
fs.copyFileSync(join(repoRoot, 'LICENSE'), join(headlessRoot, 'LICENSE'));

console.log('> headless/FORK.md');
fs.copyFileSync(join(repoRoot, 'FORK.md'), join(headlessRoot, 'FORK.md'));

console.log('> headless/THIRD_PARTY_NOTICES.md');
fs.copyFileSync(
  join(repoRoot, 'THIRD_PARTY_NOTICES.md'),
  join(headlessRoot, 'THIRD_PARTY_NOTICES.md')
);

console.log('> headless/logo-full.png');
fs.copyFileSync(
  join(repoRoot, 'images/logo-full.png'),
  join(headlessRoot, 'logo-full.png')
);

function mkdirF(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p);
  }
}

console.log('> Pack dry run');
console.log(execFileSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: headlessRoot,
  encoding: 'utf8'
}));
