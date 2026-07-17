import { describe, expect, it, vi } from 'vitest';
import { createStore, initialState, reduce } from './store';

describe('store reducer', () => {
  it('applies presets immutably and marks matching/custom params', () => {
    const u = reduce(initialState, { type: 'preset/apply', name: 'u' });
    expect(u.preset).toBe('u'); expect(u.params).not.toBe(initialState.params);
    expect(reduce(u, { type: 'params/patch', patch: { D: 3000.005 } }).preset).toBe('u');
    expect(reduce(u, { type: 'params/patch', patch: { D: 3100 } }).preset).toBe('custom');
  });
  it('increments seek sequence and reports changed top-level keys', () => {
    const store = createStore(initialState); const listener = vi.fn(); store.subscribe(listener);
    store.dispatch({ type: 'playback/seek', time: 2 }); store.dispatch({ type: 'playback/seek', time: 2 });
    expect(store.getState().playback.seekRequest?.seq).toBe(2);
    expect([...listener.mock.calls[0][1]]).toEqual(['playback']);
  });
});
