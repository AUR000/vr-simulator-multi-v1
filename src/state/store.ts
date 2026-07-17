import type { Action } from './actions';
import { PRESETS } from './presets';
import type { AppState, PresetName, RoomParams } from './types';

export type ChangedKeys = Set<keyof AppState>;
export type Listener = (state: AppState, changed: ChangedKeys) => void;
export interface Store { getState(): AppState; dispatch(action: Action): void; subscribe(fn: Listener): () => void }

function matchingPreset(params: RoomParams): PresetName {
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (Math.abs(params.W - preset.W) < .01 && Math.abs(params.H - preset.H) < .01 && Math.abs(params.D - preset.D) < .01 &&
      Object.keys(params.faces).every((id) => params.faces[id as keyof RoomParams['faces']] === preset.faces[id as keyof RoomParams['faces']])) return name as PresetName;
  }
  return 'custom';
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'params/patch': {
      const params = { ...state.params, ...action.patch, faces: { ...state.params.faces, ...action.patch.faces } };
      return { ...state, params, preset: matchingPreset(params) };
    }
    case 'preset/apply': return { ...state, preset: action.name, params: { ...PRESETS[action.name], faces: { ...PRESETS[action.name].faces } } };
    case 'mode/set': return action.mode === state.mode ? state : { ...state, mode: action.mode };
    case 'source/add': return { ...state, sources: { ...state.sources, [action.source.id]: action.source } };
    case 'assign/face': { const assignments = { ...state.assignments }; action.sourceId ? assignments[action.face] = action.sourceId : delete assignments[action.face]; return { ...state, assignments }; }
    case 'assign/span': return { ...state, spanSourceId: action.sourceId };
    case 'playback/toggle': return { ...state, playback: { ...state.playback, playing: !state.playback.playing } };
    case 'playback/seek': return { ...state, playback: { ...state.playback, seekRequest: { time: action.time, seq: (state.playback.seekRequest?.seq ?? 0) + 1 } } };
    case 'playback/restart': return { ...state, playback: { ...state.playback, seekRequest: { time: 0, seq: (state.playback.seekRequest?.seq ?? 0) + 1 } } };
    case 'playback/mute': return action.muted === state.playback.muted ? state : { ...state, playback: { ...state.playback, muted: action.muted } };
    case 'view/patch': return { ...state, view: { ...state.view, ...action.patch } };
    case 'people/toggle': return action.show === state.showPeople ? state : { ...state, showPeople: action.show };
  }
}

export function createStore(initial: AppState): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return;
      const changed = new Set<keyof AppState>();
      for (const key of Object.keys(state) as (keyof AppState)[]) if (state[key] !== next[key]) changed.add(key);
      state = next;
      listeners.forEach((listener) => listener(state, changed));
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export const initialState: AppState = {
  params: { ...PRESETS.aquarium, faces: { ...PRESETS.aquarium.faces } }, preset: 'aquarium', mode: 'separate',
  sources: {}, assignments: {}, spanSourceId: null,
  playback: { playing: false, muted: true, seekRequest: null },
  view: { orbit: 18, pitch: 14, dist: 100 }, showPeople: true,
};
