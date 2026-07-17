import * as THREE from 'three';
import type { MediaManager } from '../media/mediaManager';
import type { ChangedKeys } from '../state/store';
import type { AppState, FaceId } from '../state/types';
import { computeFaces, computeSpanUV, type FaceDescriptor } from './faces';

export function createFaceMaterial(_face: FaceDescriptor, texture: any | null) {
  return new THREE.MeshBasicMaterial({ map: texture, color: texture ? 0xffffff : 0x0b1926, side: THREE.FrontSide });
}

export class RoomView {
  private group = new THREE.Group();
  private meshes = new Map<FaceId, any>();
  constructor(private scene: any, private media: MediaManager) { scene.add(this.group); }
  private texture(state: AppState, face: FaceDescriptor) {
    const span = state.mode === 'span' && face.spanRole === 'wall';
    const id = span ? state.spanSourceId : state.assignments[face.id]; if (!id) return null;
    const texture = this.media.cloneTexture(id); if (!texture) return null;
    if (span) { const uv = computeSpanUV(state.params, face.id as 'left'|'front'|'right'); texture.offset.x = uv.offsetX; texture.repeat.x = uv.repeatX; }
    if (face.id === 'ceiling') { texture.repeat.x *= -1; texture.offset.x = 1; }
    texture.needsUpdate = true; return texture;
  }
  private clear() { for (const mesh of this.meshes.values()) { mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); this.group.remove(mesh); } this.meshes.clear(); }
  private rebuild(state: AppState) {
    this.clear();
    for (const face of computeFaces(state.params)) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(face.widthM, face.heightM), createFaceMaterial(face, this.texture(state, face)));
      mesh.position.set(...face.position); mesh.rotation.set(...face.rotationDeg.map(THREE.MathUtils.degToRad) as [number,number,number]);
      this.group.add(mesh); this.meshes.set(face.id, mesh);
    }
  }
  private swapTextures(state: AppState) { for (const face of computeFaces(state.params)) { const material = this.meshes.get(face.id)?.material; if (!material) continue; material.map?.dispose(); material.map = this.texture(state, face); material.color.set(material.map ? 0xffffff : 0x0b1926); material.needsUpdate = true; } }
  update(state: AppState, changed: ChangedKeys) { if (!this.meshes.size || changed.has('params') || changed.has('mode')) this.rebuild(state); else if (changed.has('assignments') || changed.has('spanSourceId') || changed.has('sources')) this.swapTextures(state); }
  dispose() { this.clear(); this.scene.remove(this.group); }
}
