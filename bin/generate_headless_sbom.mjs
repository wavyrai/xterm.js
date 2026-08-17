/**
 * Copyright (c) 2026 tmux-ide contributors.
 * @license MIT
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , tarballArgument, outputArgument] = process.argv;
if (!tarballArgument || !outputArgument) {
  throw new Error('Usage: generate_headless_sbom.mjs <package.tgz> <output.json>');
}

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'headless/package.json'), 'utf8'));
if (packageJson.name !== '@tmux-ide/xterm-headless' || packageJson.version !== '6.0.0-tmuxide.2') {
  throw new Error(`Unexpected package identity: ${packageJson.name}@${packageJson.version}`);
}
if (packageJson.license !== 'MIT' || Object.hasOwn(packageJson, 'dependencies')) {
  throw new Error('The released headless package must be MIT and dependency-free');
}

const sourceDateEpoch = Number.parseInt(process.env.SOURCE_DATE_EPOCH ?? '', 10);
if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch <= 0) {
  throw new Error('SOURCE_DATE_EPOCH must be a positive integer');
}
const tarball = readFileSync(resolve(tarballArgument));
const sha256 = createHash('sha256').update(tarball).digest('hex');
const tag = packageJson.tmuxIdeFork?.releaseTag;
if (tag !== 'v6.0.0-tmuxide.2') {
  throw new Error(`Unexpected release tag: ${tag}`);
}

const downloadLocation = `https://github.com/wavyrai/xterm.js/releases/download/${tag}/tmux-ide-xterm-headless-6.0.0-tmuxide.2.tgz`;
const document = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: `${packageJson.name}-${packageJson.version}`,
  documentNamespace: `https://github.com/wavyrai/xterm.js/releases/tag/${tag}/sbom/${sha256}`,
  creationInfo: {
    created: new Date(sourceDateEpoch * 1000).toISOString(),
    creators: ['Tool: tmux-ide-xterm-headless-sbom-v1']
  },
  packages: [{
    SPDXID: 'SPDXRef-Package',
    name: packageJson.name,
    versionInfo: packageJson.version,
    downloadLocation,
    filesAnalyzed: false,
    checksums: [{ algorithm: 'SHA256', checksumValue: sha256 }],
    licenseConcluded: 'MIT',
    licenseDeclared: 'MIT',
    copyrightText: [
      'Copyright (c) 2017-2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)',
      'Copyright (c) 2014-2016, SourceLair Private Company (https://www.sourcelair.com)',
      'Copyright (c) 2012-2013, Christopher Jeffrey (https://github.com/chjj/)'
    ].join('\n'),
    externalRefs: [{
      referenceCategory: 'PACKAGE-MANAGER',
      referenceType: 'purl',
      referenceLocator: 'pkg:npm/%40tmux-ide/xterm-headless@6.0.0-tmuxide.2'
    }]
  }],
  relationships: [{
    spdxElementId: 'SPDXRef-DOCUMENT',
    relationshipType: 'DESCRIBES',
    relatedSpdxElement: 'SPDXRef-Package'
  }]
};

writeFileSync(resolve(outputArgument), `${JSON.stringify(document, null, 2)}\n`);
console.log(`SPDX SBOM for ${packageJson.name}@${packageJson.version} (${sha256}): PASS`);
