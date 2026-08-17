import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const { Terminal } = require('../headless');

const sampleCount = 40;
const deferred = await samples(false);
const prioritized = await samples(true);
const burstSampleCount = 10;
const deferredBurst = await burstSamples(false);
const prioritizedBurst = await burstSamples(true);
const report = {
  sampleCount,
  deferredMs: distribution(deferred),
  prioritizedMs: distribution(prioritized),
  burstSampleCount,
  burstChunks: 5000,
  deferredBurstMs: distribution(deferredBurst),
  prioritizedBurstMs: distribution(prioritizedBurst)
};
console.log(JSON.stringify(report, null, 2));

if (report.prioritizedMs.p95 >= 1) {
  throw new Error(`prioritized p95 ${report.prioritizedMs.p95}ms exceeded 1ms`);
}
if (report.deferredMs.p95 < 10) {
  throw new Error(`deferred p95 ${report.deferredMs.p95}ms did not exercise timer starvation`);
}
if (report.prioritizedBurstMs.p95 > report.deferredBurstMs.p95 * 1.5 + 5) {
  throw new Error(`prioritized burst p95 ${report.prioritizedBurstMs.p95}ms materially regressed deferred ${report.deferredBurstMs.p95}ms`);
}

async function samples(priority) {
  const terminal = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  const values = [];
  try {
    for (let sample = 0; sample < sampleCount; sample++) {
      if (priority) terminal.prioritizeNextWrite();
      const started = performance.now();
      let callbackAt = Number.NaN;
      const parsed = new Promise(resolve => terminal.write('x', () => {
        callbackAt = performance.now();
        resolve();
      }));
      for (let turn = 0; turn < 20; turn++) {
        queueMicrotask(() => {
          const deadline = performance.now() + 0.75;
          while (performance.now() < deadline) {
            // Deliberately occupy the current event-loop turn.
          }
        });
      }
      await parsed;
      values.push(callbackAt - started);
    }
  } finally {
    terminal.dispose();
  }
  return values;
}

async function burstSamples(priority) {
  const values = [];
  for (let sample = 0; sample < burstSampleCount; sample++) {
    const terminal = new Terminal({ cols: 80, rows: 24, allowProposedApi: true, scrollback: 0 });
    try {
      if (priority) terminal.prioritizeNextWrite();
      const started = performance.now();
      await new Promise(resolve => {
        for (let chunk = 0; chunk < 5000; chunk++) {
          terminal.write('x', chunk === 4999 ? resolve : undefined);
        }
      });
      values.push(performance.now() - started);
    } finally {
      terminal.dispose();
    }
  }
  return values;
}

function distribution(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted.at(-1)
  };
}

function percentile(sorted, quantile) {
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}
