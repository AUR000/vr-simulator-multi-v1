import * as THREE from 'three';
import { DefaultMediaManager } from '../media/mediaManager';
import { EnvironmentView } from '../scene/environment';
import { RoomView } from '../scene/room';
import { createStore, initialState } from '../state/store';
import type { AppState, MediaSource } from '../state/types';
import { createViewControls } from '../ui/viewControls';
import { setupXrSession } from '../xr/session';
import { PV_INPUT_MODE, PV_SOURCES, USE_CROSSORIGIN } from './config';
import { setupPvControllers } from './controllers';
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
  mode: PV_INPUT_MODE,
  sources: {},
  assignments: {},
  spanSourceId: null,
  playback: { playing: false, muted: false, seekRequest: null },
  showPeople: false, // クライアント向けPVでは人物シルエットを出さない(2026-08-14変更)
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
// 3面版と同じく、部屋一式を奥へずらしてVRの立ち位置を正面壁から離す
const VIEWER_SETBACK_M = 1.2;
const roomAnchor = new THREE.Group(); roomAnchor.position.z = -VIEWER_SETBACK_M; scene.add(roomAnchor);
const room = new RoomView(roomAnchor, media);
const environment = new EnvironmentView(roomAnchor, .7);
const view = createViewControls(camera, renderer.domElement, store, -VIEWER_SETBACK_M);
const disposeXr = setupXrSession(renderer, store, media, view.controls);

const allChanged = new Set(Object.keys(initial) as (keyof AppState)[]);
media.applyState(initial);
room.update(initial, allChanged);
environment.update(initial);
const unsubscribe = store.subscribe((state, changed) => {
  media.applyState(state);
  room.update(state, changed);
  if (changed.has('params') || changed.has('showPeople')) environment.update(state);
});

const configuredSources: MediaSource[] = PV_INPUT_MODE === 'atlas'
  ? [{ id: 'pv-atlas', kind: 'url', url: PV_SOURCES.atlas, name: 'PV atlas', content: 'video' }]
  : [
      { id: 'pv-wall', kind: 'url', url: PV_SOURCES.wall, name: 'PV wall', content: 'video' },
      { id: 'pv-floor', kind: 'url', url: PV_SOURCES.floor, name: 'PV floor', content: 'video' },
    ];

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

const videos = configuredSources.map((source) => acquirePvSource(source)).filter(
  (video): video is HTMLVideoElement => video !== null,
);
configuredSources.forEach((source) => store.dispatch({ type: 'source/add', source }));
if (PV_INPUT_MODE === 'atlas') {
  store.dispatch({ type: 'assign/atlas', sourceId: configuredSources[0].id });
} else {
  store.dispatch({ type: 'assign/span', sourceId: configuredSources[0].id });
  store.dispatch({ type: 'assign/face', face: 'floor', sourceId: configuredSources[1].id });
}

const vrSupported = 'xr' in navigator;
const xrEntryButton = document.querySelector<HTMLElement>('.xr-entry-button');
let startScreen: ReturnType<typeof createStartScreen>;
/** 体験を止めて先頭に戻す。次の人が必ず冒頭から見られるようにする */
function resetPlayback() {
  if (store.getState().playback.playing) store.dispatch({ type: 'playback/toggle' });
  store.dispatch({ type: 'playback/restart' });
  videos.forEach((video) => { video.pause(); try { video.currentTime = 0; } catch { /* metadata not ready */ } });
}

/** 開始ボタンを押してから映像が出るまでの暗転(被る時間を稼ぐ) */
const START_DELAY_MS = 3000;
let startTimer: ReturnType<typeof setTimeout> | null = null;

/** 暗転: 部屋ごと隠して真っ黒にする(動画の1フレーム目も見せない) */
function setBlackout(on: boolean) {
  roomAnchor.visible = !on;
  renderer.setClearColor(on ? 0x000000 : 0x0a0e14);
}

function cancelStartTimer() { if (startTimer !== null) { clearTimeout(startTimer); startTimer = null; } }

startScreen = createStartScreen({
  vrSupported,
  onStart: () => {
    cancelStartTimer();
    setBlackout(true);
    // 常に冒頭から始める(前の体験の続きにならないように)
    videos.forEach((video) => { try { video.currentTime = 0; } catch { /* metadata not ready */ } });
    store.dispatch({ type: 'playback/restart' });
    // ユーザー操作の中で一度 play→pause しておくと、3秒後の再生が自動再生制限に引っかからない
    videos.forEach((video) => { void video.play().then(() => video.pause()).catch(() => undefined); });
    if (vrSupported) xrEntryButton?.click();
    startScreen.hide();

    startTimer = setTimeout(() => {
      startTimer = null;
      setBlackout(false);
      videos.forEach((video) => { try { video.currentTime = 0; } catch { /* metadata not ready */ } void video.play().catch(() => undefined); });
      if (!store.getState().playback.playing) store.dispatch({ type: 'playback/toggle' });
    }, START_DELAY_MS);
  },
});
const disposePvControllers = setupPvControllers(renderer, store, () => {
  cancelStartTimer();
  setBlackout(false);
  resetPlayback();
  startScreen.show();
});

function updateReadiness() {
  const readyCount = videos.filter((video) => video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA).length;
  startScreen.setLoading(videos.length > 0 ? readyCount / videos.length * 100 : null);
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
  view.controls.update();
  renderer.render(scene, camera);
});

addEventListener('beforeunload', () => {
  renderer.setAnimationLoop(null);
  cancelStartTimer();
  videos.forEach((video) => readinessEvents.forEach((event) => video.removeEventListener(event, updateReadiness)));
  unsubscribe();
  startScreen.dispose();
  disposePvControllers();
  disposeXr();
  view.dispose();
  room.dispose();
  environment.dispose();
  media.dispose();
  renderer.dispose();
});
