import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Store } from '../state/store';

export function createViewControls(camera: any, canvas: HTMLCanvasElement, store: Store) {
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.target.set(0, 1.25, 0);
  function apply() { const { orbit, pitch, dist } = store.getState().view; const radius = 8 * dist / 100, az = THREE.MathUtils.degToRad(orbit), el = THREE.MathUtils.degToRad(22 + pitch); camera.position.set(Math.sin(az)*Math.cos(el)*radius, controls.target.y + Math.sin(el)*radius, Math.cos(az)*Math.cos(el)*radius); controls.update(); }
  apply(); const unsubscribe = store.subscribe((_s,c) => { if(c.has('view')) apply(); });
  return { controls, dispose() { unsubscribe(); controls.dispose(); } };
}
