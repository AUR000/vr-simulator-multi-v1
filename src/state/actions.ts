import type { DisplayMode, FaceId, MediaSource, PresetName, RoomParams, ViewState } from './types';

export type Action =
  | { type: 'params/patch'; patch: Partial<Omit<RoomParams, 'faces'>> & { faces?: Partial<Record<FaceId, boolean>> } }
  | { type: 'preset/apply'; name: Exclude<PresetName, 'custom'> }
  | { type: 'mode/set'; mode: DisplayMode }
  | { type: 'source/add'; source: MediaSource }
  | { type: 'assign/face'; face: FaceId; sourceId: string | null }
  | { type: 'assign/span'; sourceId: string | null }
  | { type: 'playback/toggle' }
  | { type: 'playback/seek'; time: number }
  | { type: 'playback/restart' }
  | { type: 'playback/mute'; muted: boolean }
  | { type: 'view/patch'; patch: Partial<ViewState> }
  | { type: 'people/toggle'; show: boolean };
