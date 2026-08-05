import * as THREE from 'three';
import { DefaultMediaManager } from '../media/mediaManager';
import { EnvironmentView } from '../scene/environment';
import { RoomView } from '../scene/room';
import { createStore, initialState } from '../state/store';
import type { AppState, MediaSource } from '../state/types';
import { createViewControls } from '../ui/viewControls';
import { setupXrControllers } from '../xr/controllers';
import { setupXrSession } from '../xr/session';
import { PV_SOURCES, USE_CROSSORIGIN } from './config';
import { createStartScreen } from './startScreen';

const initial: AppState = {
  ...initialState,
  params: {
    W: 6000,
    H: 2700,
    D: 4200,
    faces: { front: true, left: true, right: false, floor: true, ceiling: false },
  },
  preset: 'aquarium',
  mode: 'span',
  sources: {},
  assignments: {},
  spanSourceId: null,
  playback: { playing: false, muted: false, seekRequest: null },
  showPeople: true, // クライアントにスケール感を伝えるため表示(2026-07-29確定)
};

const app = document.querySelector('#app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x0a0e14);
app.append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .01, 100);
const store = createStore(initial);
const media = new DefaultMediaManager();
const room = new RoomView(scene, media);
const environment = new EnvironmentView(scene);
const view = createViewControls(camera, renderer.domElement, store);
const disposeXr = setupXrSession(renderer, store, media, view.controls);
const xrControllers = setupXrControllers(renderer, store, media);

const allChanged = new Set(Object.keys(initial) as (keyof AppState)[]);
media.applyState(initial);
room.update(initial, allChanged);
environment.update(initial);
const unsubscribe = store.subscribe((state, changed) => {
  media.applyState(state);
  room.update(state, changed);
  if (changed.has('params') || changed.has('showPeople')) environment.update(state);
});

const wallSource: MediaSource = {
  id: 'pv-wall', kind: 'url', url: PV_SOURCES.wall, name: 'PV wall', content: 'video',
};
const floorSource: MediaSource = {
  id: 'pv-floor', kind: 'url', url: PV_SOURCES.floor, name: 'PV floor', content: 'video',
};

// MediaManager が src を設定する前に crossOrigin を付与する。acquire は各ソース1回だけ。
function acquirePvSource(source: MediaSource) {
  if (!USE_CROSSORIGIN) return media.acquire(source);
  const nativeCreateElement = document.createElement;
  document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
    const element = nativeCreateElement.call(document, tagName, options);
    if (tagName.toLowerCase() === 'video') (element as HTMLVideoElement).crossOrigin = 'anonymous';
    return element;
  }) as typeof document.createElement;
  try {
    return media.acquire(source);
  } finally {
    document.createElement = nativeCreateElement;
  }
}

const videos = [acquirePvSource(wallSource), acquirePvSource(floorSource)].filter(
  (video): video is HTMLVideoElement => video !== null,
);
store.dispatch({ type: 'source/add', source: wallSource });
store.dispatch({ type: 'assign/span', sourceId: wallSource.id });
store.dispatch({ type: 'source/add', source: floorSource });
store.dispatch({ type: 'assign/face', face: 'floor', sourceId: floorSource.id });

const vrSupported = 'xr' in navigator;
const xrEntryButton = document.querySelector<HTMLElement>('.xr-entry-button');
let startScreen: ReturnType<typeof createStartScreen>;
startScreen = createStartScreen({
  vrSupported,
  onStart: () => {
    videos.forEach((video) => { void video.play().catch(() => undefined); });
    if (!store.getState().playback.playing) store.dispatch({ type: 'playback/toggle' });
    if (vrSupported) xrEntryButton?.click();
    startScreen.hide();
  },
});

function updateReadiness() {
  const readyCount = videos.filter((video) => video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA).length;
  startScreen.setLoading(videos.length === 2 ? readyCount / videos.length * 100 : null);
}
const readinessEvents = ['canplay', 'canplaythrough', 'loadeddata', 'progress', 'error'] as const;
videos.forEach((video) => readinessEvents.forEach((event) => video.addEventListener(event, updateReadiness)));
updateReadiness();

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
renderer.setAnimationLoop(() => {
  xrControllers.update();
  view.controls.update();
  renderer.render(scene, camera);
});

addEventListener('beforeunload', () => {
  renderer.setAnimationLoop(null);
  videos.forEach((video) => readinessEvents.forEach((event) => video.removeEventListener(event, updateReadiness)));
  unsubscribe();
  startScreen.dispose();
  xrControllers.dispose();
  disposeXr();
  view.dispose();
  room.dispose();
  environment.dispose();
  media.dispose();
  renderer.dispose();
});
