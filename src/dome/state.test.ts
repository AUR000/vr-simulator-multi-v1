import { describe, expect, it } from 'vitest';
import { createStore } from '../state/store';
import { initialState, reduce, type DomeAction, type DomeState } from './state';

describe('dome reducer', () => {
  it('uses the specified defaults', () => {
    expect(initialState).toMatchObject({ projection: 'sphere', radiusM: 7.5, centerHeightM: 1.6, viewMode: 'inside', showGuides: true });
  });
  it('resets center height when projection changes', () => {
    const custom = { ...initialState, centerHeightM: 3 };
    const dome = reduce(custom, { type: 'projection/set', mode: 'dome' });
    expect(dome.centerHeightM).toBe(0);
    expect(reduce(dome, { type: 'projection/set', mode: 'sphere' }).centerHeightM).toBe(1.6);
  });
  it('updates media playback and scalar settings', () => {
    let state = reduce(initialState, { type: 'playback/seek', time: 12 });
    state = reduce(state, { type: 'playback/restart' });
    expect(state.playback.seekRequest).toEqual({ time: 0, seq: 2 });
    expect(reduce(state, { type: 'radius/set', radiusM: 9 }).radiusM).toBe(9);
    expect(reduce(state, { type: 'guides/toggle', show: false }).showGuides).toBe(false);
  });
  it('toggles dome input format and keeps fisheye as the default', () => {
    expect(initialState.domeInput).toBe('fisheye');
    const equirect = reduce(initialState, { type: 'domeInput/set', format: 'equirect' });
    expect(equirect.domeInput).toBe('equirect');
    expect(reduce(equirect, { type: 'domeInput/set', format: 'equirect' })).toBe(equirect);
  });
  it('works with the generic store and reports changed keys', () => {
    const store = createStore<DomeState, DomeAction>(initialState, reduce);
    let changed: Set<keyof DomeState> | undefined;
    store.subscribe((_state, keys) => { changed = keys; });
    store.dispatch({ type: 'view/set', mode: 'outside' });
    expect(store.getState().viewMode).toBe('outside');
    expect(changed).toEqual(new Set(['viewMode']));
  });
});
