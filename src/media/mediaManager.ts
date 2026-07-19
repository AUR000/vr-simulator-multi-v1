import { LinearFilter, SRGBColorSpace, VideoTexture } from 'three';
import type { AppState, FaceId, MediaSource } from '../state/types';

const AUDIO_PRIORITY: FaceId[] = ['front', 'right', 'floor', 'left', 'ceiling'];

export function pickAudioSource(state: AppState): string | null {
  for (const face of AUDIO_PRIORITY) {
    if (!state.params.faces[face]) continue;
    const id = state.mode === 'span' && (face === 'front' || face === 'left' || face === 'right') ? state.spanSourceId : state.assignments[face];
    if (id && state.sources[id]) return id;
  }
  return null;
}

export interface MediaManager {
  acquire(source: MediaSource): HTMLVideoElement; get(sourceId: string): HTMLVideoElement | null;
  getTexture(sourceId: string): any | null; cloneTexture(sourceId: string): any | null;
  applyState(state: AppState): void; syncTick(state: AppState): void; pickAudioSourceId(state: AppState): string | null;
  getMaster(state: AppState): HTMLVideoElement | null; release(sourceId: string): void; dispose(): void;
}

type Entry = { source: MediaSource; video: HTMLVideoElement; texture: any };

export class DefaultMediaManager implements MediaManager {
  private entries = new Map<string, Entry>();
  private seekSeq = -1;
  private timer: ReturnType<typeof setInterval>;
  private state: AppState | null = null;

  constructor() { this.timer = setInterval(() => { if (this.state) this.syncTick(this.state); }, 250); }
  acquire(source: MediaSource) {
    const old = this.entries.get(source.id); if (old) return old.video;
    const video = document.createElement('video'); video.src = source.url; video.loop = true; video.muted = true; video.playsInline = true; video.preload = 'auto';
    // anisotropy はレンダラ側の上限に自動クランプされる。斜めから見る面/ドーム周縁の4K素材の解像感に必須
    const texture = new VideoTexture(video); texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = LinearFilter; texture.anisotropy = 16;
    this.entries.set(source.id, { source, video, texture }); return video;
  }
  get(id: string) { return this.entries.get(id)?.video ?? null; }
  getTexture(id: string) { return this.entries.get(id)?.texture ?? null; }
  cloneTexture(id: string) { const texture = this.getTexture(id); if (!texture) return null; const clone = texture.clone(); clone.needsUpdate = true; return clone; }
  private activeIds(state: AppState) {
    const ids = new Set<string>();
    for (const face of AUDIO_PRIORITY) if (state.params.faces[face]) {
      const id = state.mode === 'span' && ['front', 'left', 'right'].includes(face) ? state.spanSourceId : state.assignments[face]; if (id) ids.add(id);
    }
    return ids;
  }
  applyState(state: AppState) {
    this.state = state; Object.values(state.sources).forEach((source) => this.acquire(source));
    const active = this.activeIds(state); const audio = this.pickAudioSourceId(state);
    for (const [id, entry] of this.entries) {
      entry.video.muted = state.playback.muted || id !== audio;
      if (active.has(id) && state.playback.playing) void entry.video.play().catch(() => undefined); else entry.video.pause();
    }
    const request = state.playback.seekRequest;
    if (request && request.seq !== this.seekSeq) { this.seekSeq = request.seq; active.forEach((id) => { const video = this.get(id); if (video) try { video.currentTime = request.time; } catch { /* metadata may not be ready */ } }); }
  }
  syncTick(state: AppState) {
    if (state.mode !== 'separate') return;
    const master = this.getMaster(state); if (!master) return;
    for (const id of this.activeIds(state)) { const video = this.get(id); if (video && video !== master && Math.abs(video.currentTime - master.currentTime) > .08) try { video.currentTime = master.currentTime; } catch { /* ignored */ } }
  }
  pickAudioSourceId(state: AppState) { return pickAudioSource(state); }
  getMaster(state: AppState) { const id = this.pickAudioSourceId(state); return id ? this.get(id) : null; }
  release(id: string) { const entry = this.entries.get(id); if (!entry) return; entry.video.pause(); entry.video.removeAttribute('src'); entry.video.load(); entry.texture.dispose(); if (entry.source.kind === 'file' && entry.source.url.startsWith('blob:')) URL.revokeObjectURL(entry.source.url); this.entries.delete(id); }
  dispose() { clearInterval(this.timer); [...this.entries.keys()].forEach((id) => this.release(id)); this.state = null; }
}
