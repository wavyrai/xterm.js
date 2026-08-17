# tmux-ide headless fork

This package is built from xterm.js commit
`f447274f430fd22513f6adbf9862d19524471c04` (the source of
`@xterm/headless@6.0.0`). The base Git tree is
`62330f6674bf1548123f3e1fe3da17363cc96a13`.

The fork adds one proposed, headless-only API:

```ts
terminal.prioritizeNextWrite(): void
```

When the parser buffer is idle, the call allows exactly the next ordinary
`write` to enter the existing asynchronous parser immediately. It emits no
terminal input and does not alter parser state, callbacks, FIFO ordering,
asynchronous OSC/DCS continuation, the 12 ms continuation slice, or the 50 MiB
write watermark. A call made while parser work is queued is a no-op. The API
requires xterm's existing `allowProposedApi: true` option.

The behavioral source diff is intentionally limited to `WriteBuffer`, the
headless delegation layers, the public headless typing, and their tests. The
browser terminal API is unchanged.
