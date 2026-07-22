import * as THREE from 'three';
import { DefaultMediaManager } from '../media/mediaManager';
import { EnvironmentView } from '../scene/environment';
import { computeFaces } from '../scene/faces';
import { RoomView } from '../scene/room';
import { PRESETS } from '../state/presets';
import { createStore, initialState } from '../state/store';
import type { AppState } from '../state/types';
import { createViewControls } from '../ui/viewControls';
import { setupXrControllers } from '../xr/controllers';
import { setupXrSession } from '../xr/session';
import { createPanel } from './panel';

const initial = { ...initialState, params: { ...PRESETS.aquarium, faces: { ...PRESETS.aquarium.faces } }, preset: 'aquarium' as const };

/** 各面の輪郭を明るい線で描くグループ。面の境界を説明で示すため。面構成は固定なので一度だけ構築 */
function createBorders(scene: any, state: AppState) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const material = new THREE.LineBasicMaterial({ color: 0xff3860 });
  for (const face of computeFaces(state.params)) {
    const geometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(face.widthM, face.heightM));
    const line = new THREE.LineSegments(geometry, material);
    line.position.set(...face.position);
    line.rotation.set(...face.rotationDeg.map(THREE.MathUtils.degToRad) as [number, number, number]);
    group.add(line);
  }
  return { setVisible(show: boolean) { group.visible = show; }, dispose() { group.traverse((o: any) => o.geometry?.dispose()); material.dispose(); scene.remove(group); } };
}
const app=document.querySelector('#app')!;const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x0a0e14);app.append(renderer.domElement);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.01,100),store=createStore(initial),media=new DefaultMediaManager(),room=new RoomView(scene,media),environment=new EnvironmentView(scene),view=createViewControls(camera,renderer.domElement,store),disposeXr=setupXrSession(renderer,store,media,view.controls),xrControllers=setupXrControllers(renderer,store,media);const allChanged=new Set(Object.keys(initial)as(keyof typeof initial)[]);media.applyState(initial);room.update(initial,allChanged);environment.update(initial);const unsubscribe=store.subscribe((state,changed)=>{media.applyState(state);room.update(state,changed);if(changed.has('params')||changed.has('showPeople'))environment.update(state);}),borders=createBorders(scene,initial),disposePanel=createPanel(document.querySelector('#ui')!,store,media,(show)=>borders.setVisible(show));function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);renderer.setAnimationLoop(()=>{xrControllers.update();view.controls.update();renderer.render(scene,camera)});addEventListener('beforeunload',()=>{renderer.setAnimationLoop(null);unsubscribe();disposePanel();xrControllers.dispose();disposeXr();view.dispose();room.dispose();environment.dispose();media.dispose();borders.dispose();renderer.dispose();});
