import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import type { MediaManager } from '../media/mediaManager';
import type { Store } from '../state/store';

interface XrRenderer {
  xr: {
    enabled: boolean;
    setReferenceSpaceType(type: 'local-floor'): void;
    addEventListener(type: 'sessionstart' | 'sessionend', listener: () => void): void;
    removeEventListener(type: 'sessionstart' | 'sessionend', listener: () => void): void;
  };
}

interface ToggleableControls { enabled: boolean }

export function setupXrSession(
  renderer: XrRenderer,
  store: Store,
  media: MediaManager,
  controls: ToggleableControls,
) {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  const button = VRButton.createButton(renderer);
  button.classList.add('xr-entry-button');
  document.body.append(button);

  let controlsWereEnabled = controls.enabled;
  const onSessionStart = () => {
    controlsWereEnabled = controls.enabled;
    controls.enabled = false;
    const state = store.getState();
    if (state.playback.playing) media.applyState(state);
  };
  const onSessionEnd = () => { controls.enabled = controlsWereEnabled; };

  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', onSessionEnd);

  return () => {
    renderer.xr.removeEventListener('sessionstart', onSessionStart);
    renderer.xr.removeEventListener('sessionend', onSessionEnd);
    button.remove();
  };
}
