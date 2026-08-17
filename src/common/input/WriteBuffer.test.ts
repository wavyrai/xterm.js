/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { WriteBuffer } from './WriteBuffer';

// eslint-disable-next-line @typescript-eslint/naming-convention
declare let Buffer: any;

function toBytes(s: string): Uint8Array {
  return Buffer.from(s);
}

function fromBytes(bytes: Uint8Array): string {
  return bytes.toString();
}

describe('WriteBuffer', () => {
  let wb: WriteBuffer;
  let stack: (string | Uint8Array)[] = [];
  let cbStack: string[] = [];
  beforeEach(() => {
    stack = [];
    cbStack = [];
    wb = new WriteBuffer(data => { stack.push(data); });
  });
  describe('write input', () => {
    it('keeps an idle write deferred by default', done => {
      wb.write('a', () => {
        assert.deepEqual(stack, ['a']);
        done();
      });
      assert.deepEqual(stack, []);
    });
    it('prioritizes exactly the next idle write without reordering callbacks', done => {
      wb.prioritizeNextWrite();
      wb.write('a', () => { cbStack.push('a'); });
      assert.deepEqual(stack, ['a']);
      assert.deepEqual(cbStack, ['a']);
      wb.write('b', () => {
        assert.deepEqual(stack, ['a', 'b']);
        assert.deepEqual(cbStack, ['a']);
        done();
      });
      assert.deepEqual(stack, ['a']);
    });
    it('prioritizes a Uint8Array once and leaves the following idle write deferred', done => {
      wb.prioritizeNextWrite();
      wb.write(toBytes('a'), () => { cbStack.push('a'); });
      assert.deepEqual(stack.map(value => typeof value === 'string' ? value : fromBytes(value)), ['a']);
      assert.deepEqual(cbStack, ['a']);
      wb.write(toBytes('b'), () => {
        assert.deepEqual(stack.map(value => typeof value === 'string' ? value : fromBytes(value)), ['a', 'b']);
        assert.deepEqual(cbStack, ['a']);
        done();
      });
      assert.deepEqual(stack.map(value => typeof value === 'string' ? value : fromBytes(value)), ['a']);
    });
    it('does not arm priority while parser work is already queued', done => {
      wb.write('a');
      wb.prioritizeNextWrite();
      wb.write('b', () => {
        assert.deepEqual(stack, ['a', 'b']);
        done();
      });
      assert.deepEqual(stack, []);
    });
    it('preserves async parser continuation and callback order', async () => {
      let resume: ((value: boolean) => void) | undefined;
      let firstPass = true;
      wb = new WriteBuffer((data, promiseResult) => {
        if (data === 'a' && firstPass) {
          firstPass = false;
          return new Promise<boolean>(resolve => { resume = resolve; });
        }
        assert.equal(promiseResult, true);
        stack.push(data);
      });
      wb.prioritizeNextWrite();
      wb.write('a', () => { cbStack.push('a'); });
      wb.write('b', () => { cbStack.push('b'); });
      assert.deepEqual(stack, []);
      assert.deepEqual(cbStack, []);
      resume!(true);
      await new Promise<void>(resolve => setTimeout(resolve));
      assert.deepEqual(stack, ['a', 'b']);
      assert.deepEqual(cbStack, ['a', 'b']);
    });
    it('preserves callback-enqueued FIFO and the 12ms yield boundary', done => {
      const originalNow = performance.now;
      let nowCall = 0;
      Object.defineProperty(performance, 'now', {
        configurable: true,
        value: () => [1, 14, 15, 16][Math.min(nowCall++, 3)]
      });
      wb.prioritizeNextWrite();
      wb.write('a', () => {
        cbStack.push('a');
        wb.write('b', () => {
          try {
            cbStack.push('b');
            assert.deepEqual(stack, ['a', 'b']);
            assert.deepEqual(cbStack, ['a', 'b']);
            done();
          } finally {
            Object.defineProperty(performance, 'now', { configurable: true, value: originalNow });
          }
        });
      });
      assert.deepEqual(stack, ['a']);
      assert.deepEqual(cbStack, ['a']);
    });
    it('preserves the existing discard watermark while busy', () => {
      const oversized = { length: 50000001 } as Uint8Array;
      wb.write(oversized);
      wb.prioritizeNextWrite();
      assert.throws(() => wb.write('b'), 'write data discarded, use flow control to avoid losing data');
      wb.writeSync('');
    });
    it('string', done => {
      wb.write('a._');
      wb.write('b.x', () => { cbStack.push('b'); });
      wb.write('c._');
      wb.write('d.x', () => { cbStack.push('d'); });
      wb.write('e', () => {
        assert.deepEqual(stack, ['a._', 'b.x', 'c._', 'd.x', 'e']);
        assert.deepEqual(cbStack, ['b', 'd']);
        done();
      });
    });
    it('bytes', done => {
      wb.write(toBytes('a._'));
      wb.write(toBytes('b.x'), () => { cbStack.push('b'); });
      wb.write(toBytes('c._'));
      wb.write(toBytes('d.x'), () => { cbStack.push('d'); });
      wb.write(toBytes('e'), () => {
        assert.deepEqual(stack.map(val => typeof val === 'string' ? '' :  fromBytes(val)), ['a._', 'b.x', 'c._', 'd.x', 'e']);
        assert.deepEqual(cbStack, ['b', 'd']);
        done();
      });
    });
    it('string/bytes mixed', done => {
      wb.write('a._');
      wb.write('b.x', () => { cbStack.push('b'); });
      wb.write(toBytes('c._'));
      wb.write(toBytes('d.x'), () => { cbStack.push('d'); });
      wb.write(toBytes('e'), () => {
        assert.deepEqual(stack.map(val => typeof val === 'string' ? val :  fromBytes(val)), ['a._', 'b.x', 'c._', 'd.x', 'e']);
        assert.deepEqual(cbStack, ['b', 'd']);
        done();
      });
    });
    it('write callback works for empty chunks', done => {
      wb.write('a', () => { cbStack.push('a'); });
      wb.write('', () => { cbStack.push('b'); });
      wb.write(toBytes('c'), () => { cbStack.push('c'); });
      wb.write(new Uint8Array(0), () => { cbStack.push('d'); });
      wb.write('e', () => {
        assert.deepEqual(stack.map(val => typeof val === 'string' ? val :  fromBytes(val)), ['a', '', 'c', '', 'e']);
        assert.deepEqual(cbStack, ['a', 'b', 'c', 'd']);
        done();
      });
    });
    it('writeSync', done => {
      wb.write('a', () => { cbStack.push('a'); });
      wb.write('b', () => { cbStack.push('b'); });
      wb.write('c', () => { cbStack.push('c'); });
      wb.writeSync('d');
      assert.deepEqual(stack, ['a', 'b', 'c', 'd']);
      assert.deepEqual(cbStack, ['a', 'b', 'c']);
      wb.write('x', () => { cbStack.push('x'); });
      wb.write('', () => {
        assert.deepEqual(stack, ['a', 'b', 'c', 'd', 'x', '']);
        assert.deepEqual(cbStack, ['a', 'b', 'c', 'x']);
        done();
      });
    });
    it('writeSync called from action does not overflow callstack - issue #3265', () => {
      wb = new WriteBuffer(data => {
        const num = parseInt(data as string);
        if (num < 1000000) {
          wb.writeSync('' + (num + 1));
        }
      });
      wb.writeSync('1');
    });
    it('writeSync maxSubsequentCalls argument', () => {
      let last: string = '';
      wb = new WriteBuffer(data => {
        last = data as string;
        const num = parseInt(data as string);
        if (num < 1000000) {
          wb.writeSync('' + (num + 1), 10);
        }
      });
      wb.writeSync('1', 10);
      assert.equal(last, '11'); // 1 + 10 sub calls = 11
    });
  });
});
