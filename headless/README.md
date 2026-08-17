# @tmux-ide/xterm-headless

This is tmux-ide's pinned, source-built fork of the experimental xterm.js
headless terminal package. It is based exactly on xterm.js commit
`f447274f430fd22513f6adbf9862d19524471c04` (the source of
`@xterm/headless@6.0.0`) and adds one proposed scheduling API.

```sh
npm install @tmux-ide/xterm-headless
```

```ts
import { Terminal } from '@tmux-ide/xterm-headless';

const terminal = new Terminal({ allowProposedApi: true });
terminal.prioritizeNextWrite();
terminal.write(outputFromThePty);
```

`prioritizeNextWrite()` affects exactly the next idle write. It bypasses only
the initial deferred timer and emits no input. Parser order, asynchronous
handler continuation, the 12 ms processing slices, callbacks, and flow control
remain those of upstream xterm.js.

The complete public surface is in
[`typings/xterm-headless.d.ts`](typings/xterm-headless.d.ts). Proposed APIs
require `allowProposedApi: true` and may change in a future fork release.

See [`FORK.md`](FORK.md) for the exact patch contract and source provenance,
and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) plus [`LICENSE`](LICENSE)
for attribution. The upstream project is [xterm.js](https://github.com/xtermjs/xterm.js).
