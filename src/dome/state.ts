import type { MediaSource, PlaybackState } from '../state/types';

export type ProjectionMode = 'sphere' | 'dome';
export type DomeViewMode = 'inside' | 'outside';

export interface DomeState {
  projection: ProjectionMode;
  radiusM: number;
  centerHeightM: number;
  viewMode: DomeViewMode;
  sources: Record<string, MediaSource>;
  sourceId: string | null;
  playback: PlaybackState;
  showGuides: boolean;
  showGround: boolean;
}

export type DomeAction =
  | { type: 'projection/set'; mode: ProjectionMode }
  | { type: 'radius/set'; radiusM: number }
  | { type: 'centerHeight/set'; heightM: number }
  | { type: 'view/set'; mode: DomeViewMode }
  | { type: 'source/add'; source: MediaSource }
  | { type: 'source/select'; sourceId: string | null }
  | { type: 'playback/toggle' }
  | { type: 'playback/seek'; time: number }
  | { type: 'playback/restart' }
  | { type: 'playback/mute'; muted: boolean }
  | { type: 'guides/toggle'; show: boolean }
  | { type: 'ground/toggle'; show: boolean };

export const initialState: DomeState = {
  projection: 'sphere', radiusM: 7.5, centerHeightM: 1.6, viewMode: 'inside',
  sources: {}, sourceId: null,
  playback: { playing: false, muted: true, seekRequest: null }, showGuides: true,
  showGround: false,
};

export function reduce(state: DomeState, action: DomeAction): DomeState {
  switch (action.type) {
    // モード切替時は中心高さと地面表示を各モードの実用既定値へ戻す(全球=目線1.6m/地面なし、半球=床置き/地面あり)
    case 'projection/set': return action.mode === state.projection ? state : { ...state, projection: action.mode, centerHeightM: action.mode === 'sphere' ? 1.6 : 0, showGround: action.mode === 'dome' };
    case 'radius/set': return action.radiusM === state.radiusM ? state : { ...state, radiusM: action.radiusM };
    case 'centerHeight/set': return action.heightM === state.centerHeightM ? state : { ...state, centerHeightM: action.heightM };
    case 'view/set': return action.mode === state.viewMode ? state : { ...state, viewMode: action.mode };
    case 'source/add': return { ...state, sources: { ...state.sources, [action.source.id]: action.source } };
    case 'source/select': return action.sourceId === state.sourceId ? state : { ...state, sourceId: action.sourceId };
    case 'playback/toggle': return { ...state, playback: { ...state.playback, playing: !state.playback.playing } };
    case 'playback/seek': return { ...state, playback: { ...state.playback, seekRequest: { time: action.time, seq: (state.playback.seekRequest?.seq ?? 0) + 1 } } };
    case 'playback/restart': return { ...state, playback: { ...state.playback, seekRequest: { time: 0, seq: (state.playback.seekRequest?.seq ?? 0) + 1 } } };
    case 'playback/mute': return action.muted === state.playback.muted ? state : { ...state, playback: { ...state.playback, muted: action.muted } };
    case 'guides/toggle': return action.show === state.showGuides ? state : { ...state, showGuides: action.show };
    case 'ground/toggle': return action.show === state.showGround ? state : { ...state, showGround: action.show };
  }
}
