export type FaceId = 'front' | 'left' | 'right' | 'floor' | 'ceiling';
export type DisplayMode = 'separate' | 'span';
export type PresetName = 'aquarium' | 'u' | 'l' | 'box' | 'custom';

export interface RoomParams {
  W: number;
  H: number;
  D: number;
  faces: Record<FaceId, boolean>;
}

export interface MediaSource {
  id: string;
  kind: 'file' | 'url';
  url: string;
  name: string;
  /** 素材種別。省略時は 'video'(後方互換)。'image' は静止画(絵コンテ等) */
  content?: 'video' | 'image';
}

export interface PlaybackState {
  playing: boolean;
  muted: boolean;
  seekRequest: { time: number; seq: number } | null;
}

export interface ViewState {
  orbit: number;
  pitch: number;
  dist: number;
}

export interface AppState {
  params: RoomParams;
  preset: PresetName;
  mode: DisplayMode;
  sources: Record<string, MediaSource>;
  assignments: Partial<Record<FaceId, string>>;
  spanSourceId: string | null;
  playback: PlaybackState;
  view: ViewState;
  showPeople: boolean;
}
