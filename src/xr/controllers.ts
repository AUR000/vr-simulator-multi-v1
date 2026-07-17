import type { MediaManager } from '../media/mediaManager';
import type { Store } from '../state/store';

const STICK_THRESHOLD = 0.5;
const SEEK_SECONDS = 10;

interface XrGamepad { axes: readonly number[] }
interface XrInputSource { handedness: string; gamepad?: XrGamepad }
interface XrReferenceSpace {
  getOffsetReferenceSpace(transform: unknown): XrReferenceSpace;
}
interface XrViewerPose { transform: { position: { x: number; z: number } } }
interface XrFrame {
  getViewerPose(space: XrReferenceSpace): XrViewerPose | null;
}
interface XrInputEvent extends Event { frame?: XrFrame }
interface XrSession {
  inputSources: readonly XrInputSource[];
  addEventListener(type: 'selectstart' | 'squeezestart', listener: (event: XrInputEvent) => void): void;
  removeEventListener(type: 'selectstart' | 'squeezestart', listener: (event: XrInputEvent) => void): void;
}
interface XrManager {
  addEventListener(type: 'sessionstart' | 'sessionend', listener: () => void): void;
  removeEventListener(type: 'sessionstart' | 'sessionend', listener: () => void): void;
  getSession(): XrSession | null;
  getReferenceSpace(): XrReferenceSpace | null;
  setReferenceSpace(space: XrReferenceSpace): void;
}
interface XrRenderer { xr: XrManager }

export interface XrControllerBindings {
  update(): void;
  dispose(): void;
}

export function setupXrControllers(
  renderer: XrRenderer,
  store: Store,
  media: MediaManager,
): XrControllerBindings {
  let session: XrSession | null = null;
  let stickLatched = false;

  const onSelectStart = () => store.dispatch({ type: 'playback/toggle' });

  const onSqueezeStart = (event: XrInputEvent) => {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const pose = referenceSpace && event.frame?.getViewerPose(referenceSpace);
    const RigidTransform = globalThis.XRRigidTransform;
    if (!referenceSpace || !pose || typeof RigidTransform !== 'function') return;

    const { x, z } = pose.transform.position;
    renderer.xr.setReferenceSpace(referenceSpace.getOffsetReferenceSpace(
      new RigidTransform({ x, y: 0, z }),
    ));
  };

  const detachSession = () => {
    if (!session) return;
    session.removeEventListener('selectstart', onSelectStart);
    session.removeEventListener('squeezestart', onSqueezeStart);
    session = null;
    stickLatched = false;
  };

  const onSessionStart = () => {
    detachSession();
    session = renderer.xr.getSession();
    session?.addEventListener('selectstart', onSelectStart);
    session?.addEventListener('squeezestart', onSqueezeStart);
  };
  const onSessionEnd = detachSession;

  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', onSessionEnd);

  return {
    update() {
      if (!session) return;
      const right = [...session.inputSources].find((source) => source.handedness === 'right' && source.gamepad);
      const axis = right?.gamepad?.axes[2];
      if (typeof axis !== 'number' || !Number.isFinite(axis)) return;
      if (Math.abs(axis) < STICK_THRESHOLD) {
        stickLatched = false;
        return;
      }
      if (stickLatched) return;
      stickLatched = true;

      const video = media.getMaster(store.getState());
      if (!video) return;
      const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      const duration = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
      const time = Math.min(duration, Math.max(0, current + (axis > 0 ? SEEK_SECONDS : -SEEK_SECONDS)));
      store.dispatch({ type: 'playback/seek', time });
    },
    dispose() {
      detachSession();
      renderer.xr.removeEventListener('sessionstart', onSessionStart);
      renderer.xr.removeEventListener('sessionend', onSessionEnd);
    },
  };
}
