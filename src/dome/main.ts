import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DefaultMediaManager } from '../media/mediaManager';
import type { Action } from '../state/actions';
import { createStore } from '../state/store';
import type { Store } from '../state/store';
import type { AppState } from '../state/types';
import { setupXrControllers } from '../xr/controllers';
import { setupXrSession } from '../xr/session';
import { createPanel } from './panel';
import { SphereView } from './sphereScene';
import { initialState, reduce, type DomeAction, type DomeState } from './state';

const app = document.querySelector('#app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x0a0e14); app.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .01, 100);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial({ color: 0x091018, side: THREE.DoubleSide })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.006; scene.add(ground);
const store = createStore<DomeState, DomeAction>(initialState, reduce), media = new DefaultMediaManager(), sphere = new SphereView(scene);
let activeId: string | null = null, seekSeq = -1;

function mediaState(state: DomeState): AppState { const source = state.sourceId ? state.sources[state.sourceId] : null; return { params: { W: 1, H: 1, D: 1, faces: { front: true, left: false, right: false, floor: false, ceiling: false } }, preset: 'custom', mode: 'separate', sources: source ? { [source.id]: source } : {}, assignments: source ? { front: source.id } : {}, spanSourceId: null, playback: state.playback, view: { orbit: 0, pitch: 0, dist: 1 }, showPeople: false }; }
// The shared XR helpers consume the multi-face Store shape. This adapter keeps
// media lookup compatible while routing the playback actions to the dome store.
const xrStore: Store = {
  getState: () => mediaState(store.getState()),
  dispatch: (action: Action) => {
    if (action.type === 'playback/toggle' || action.type === 'playback/seek' || action.type === 'playback/restart' || action.type === 'playback/mute') store.dispatch(action);
  },
  subscribe: (listener) => store.subscribe((state, changed) => listener(mediaState(state), changed as Set<keyof AppState>)),
};
function applyMedia(state: DomeState) {
  if (activeId && activeId !== state.sourceId) media.release(activeId);
  activeId = state.sourceId;
  media.applyState(mediaState(state));
  sphere.setTexture(state.sourceId ? media.getTexture(state.sourceId) : null);
  const video = state.sourceId ? media.get(state.sourceId) : null;
  if (video) { video.muted = state.playback.muted; if (state.playback.playing) void video.play().catch(() => undefined); else video.pause(); const request = state.playback.seekRequest; if (request && request.seq !== seekSeq) { seekSeq = request.seq; try { video.currentTime = request.time; } catch { /* metadata not loaded */ } } }
}
// ビュー種別の切替時のみカメラを既定位置へ再配置する
function updateView(state: DomeState) {
  controls.target.set(0, state.centerHeightM, 0); controls.enablePan = state.viewMode === 'outside'; controls.enableZoom = state.viewMode === 'outside';
  if (state.viewMode === 'inside') { camera.position.set(0, state.centerHeightM, .01); controls.minDistance = controls.maxDistance = .01; }
  else { const distance = state.radiusM * 2.2; camera.position.set(distance * .6, state.centerHeightM + distance * .3, distance); controls.minDistance = state.radiusM * 1.05; controls.maxDistance = state.radiusM * 6; }
  controls.update();
}
// 半径・中心高さの変更時はズーム(カメラの相対位置)を維持したまま注視点だけ追従させる
function followViewParams(state: DomeState) {
  const dy = state.centerHeightM - controls.target.y;
  controls.target.y = state.centerHeightM;
  if (state.viewMode === 'inside') { camera.position.set(0, state.centerHeightM, .01); }
  else { camera.position.y += dy; controls.minDistance = state.radiusM * 1.05; controls.maxDistance = state.radiusM * 6; }
  controls.update();
}
// 地面はチェックボックスで自由に切替可（モード切替時は reducer が既定値 全球=OFF/半球=ON に戻す）
function updateGround(state: DomeState) { ground.visible = state.showGround; }
const allChanged = new Set(Object.keys(initialState) as (keyof DomeState)[]); sphere.update(initialState, allChanged); applyMedia(initialState); updateView(initialState); updateGround(initialState);
const unsubscribe = store.subscribe((state, changed) => { applyMedia(state); sphere.update(state, changed); if (changed.has('viewMode')) updateView(state); else if (changed.has('radiusM') || changed.has('centerHeightM')) followViewParams(state); if (changed.has('showGround')) updateGround(state); });
const disposePanel = createPanel(document.querySelector('#ui')!, store, () => { const id = store.getState().sourceId; return id ? media.get(id) : null; });
const disposeXrSession = setupXrSession(renderer, xrStore, media, controls);
const xrControllers = setupXrControllers(renderer, xrStore, media);
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); } addEventListener('resize', resize);
renderer.setAnimationLoop(() => { controls.update(); xrControllers.update(); renderer.render(scene, camera); });
addEventListener('beforeunload', () => { renderer.setAnimationLoop(null); unsubscribe(); disposePanel(); xrControllers.dispose(); disposeXrSession(); controls.dispose(); sphere.dispose(); ground.geometry.dispose(); ground.material.dispose(); media.dispose(); renderer.dispose(); });
