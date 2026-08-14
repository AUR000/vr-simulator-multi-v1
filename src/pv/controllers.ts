import type { Store } from '../state/store';

interface XrSession {
  addEventListener(type: 'selectstart' | 'squeezestart', listener: () => void): void;
  removeEventListener(type: 'selectstart' | 'squeezestart', listener: () => void): void;
  end(): Promise<void>;
}

interface XrManager {
  addEventListener(type: 'sessionstart' | 'sessionend', listener: () => void): void;
  removeEventListener(type: 'sessionstart' | 'sessionend', listener: () => void): void;
  getSession(): XrSession | null;
}

interface XrRenderer { xr: XrManager }

export function setupPvControllers(
  renderer: XrRenderer,
  store: Store,
  onSessionEnd: () => void,
) {
  let session: XrSession | null = null;

  const onSelectStart = () => store.dispatch({ type: 'playback/toggle' });
  const onSqueezeStart = () => { void renderer.xr.getSession()?.end().catch(() => undefined); };

  const detachSession = () => {
    if (!session) return;
    session.removeEventListener('selectstart', onSelectStart);
    session.removeEventListener('squeezestart', onSqueezeStart);
    session = null;
  };

  const onSessionStart = () => {
    detachSession();
    session = renderer.xr.getSession();
    session?.addEventListener('selectstart', onSelectStart);
    session?.addEventListener('squeezestart', onSqueezeStart);
  };
  const handleSessionEnd = () => {
    detachSession();
    onSessionEnd();
  };

  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', handleSessionEnd);

  return () => {
    detachSession();
    renderer.xr.removeEventListener('sessionstart', onSessionStart);
    renderer.xr.removeEventListener('sessionend', handleSessionEnd);
  };
}
