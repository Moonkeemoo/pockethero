import { describe, it, expect } from 'vitest';
import { makeBus } from '../src/sim/events';

describe('makeBus', () => {
  it('collects emitted events in order and drains them', () => {
    const bus = makeBus();
    bus.emit({ type: 'move-start', actor: 'hero', move: 'slice', t: 0 });
    bus.emit({ type: 'hit', source: 'hero', target: 'enemy', amount: 6, crit: false, t: 0.1 });
    const drained = bus.drain();
    expect(drained).toHaveLength(2);
    expect(drained[0]!.type).toBe('move-start');
    expect(bus.drain()).toHaveLength(0); // drain empties the buffer
  });
});
