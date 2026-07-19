import * as THREE from 'three';
import type { DomeState, ProjectionMode } from './state';

export class SphereView {
  private group = new THREE.Group();
  private mesh: any | null = null;
  private material = new THREE.MeshBasicMaterial({ color: 0x17232d, side: THREE.FrontSide });
  private guides = new THREE.Group();
  private texture: any | null = null;
  private projection: ProjectionMode | null = null;
  private radius = -1;

  constructor(private scene: any) { this.group.add(this.guides); scene.add(this.group); }

  setTexture(texture: any | null) {
    if (texture === this.texture) return;
    this.texture = texture;
    this.material.map = texture;
    this.material.color.set(texture ? 0xffffff : 0x17232d);
    this.applyTextureUv(this.projection ?? 'sphere');
    this.material.needsUpdate = true;
  }

  private applyTextureUv(mode: ProjectionMode) {
    if (!this.texture) return;
    this.texture.offset.set(0, mode === 'dome' ? .5 : 0);
    this.texture.repeat.set(1, mode === 'dome' ? .5 : 1);
    // wrapT intentionally remains its default ClampToEdgeWrapping.
    this.texture.needsUpdate = true;
  }

  private geometry(mode: ProjectionMode, radius: number) {
    const geometry = mode === 'sphere'
      ? new THREE.SphereGeometry(radius, 64, 48)
      : new THREE.SphereGeometry(radius, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    geometry.scale(-1, 1, 1);
    return geometry;
  }

  private clearGuides() {
    for (const child of [...this.guides.children]) {
      child.traverse((object: any) => { object.geometry?.dispose(); object.material?.dispose(); });
      this.guides.remove(child);
    }
  }

  private buildGuides(mode: ProjectionMode, radius: number) {
    this.clearGuides();
    const r = radius + .01, positions: number[] = [], segments = 96;
    const addArc = (point: (t: number) => any) => {
      for (let i = 0; i < segments; i++) {
        const a = point(i / segments), b = point((i + 1) / segments);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    };
    const thetaMax = mode === 'sphere' ? Math.PI : Math.PI / 2;
    for (let m = 0; m < 24; m++) {
      const phi = m / 24 * Math.PI * 2;
      addArc(t => { const theta = t * thetaMax; return new THREE.Vector3(r * Math.sin(theta) * Math.cos(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(phi)); });
    }
    for (let l = 1; l <= 12; l++) {
      const theta = l / 12 * thetaMax;
      if (Math.abs(theta - Math.PI / 2) < 1e-6) continue;
      addArc(t => new THREE.Vector3(r * Math.sin(theta) * Math.cos(t * Math.PI * 2), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(t * Math.PI * 2)));
    }
    const gridGeometry = new THREE.BufferGeometry(); gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.guides.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: 0x2596ad, transparent: true, opacity: .35 })));
    const equator = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 6, 128), new THREE.MeshBasicMaterial({ color: 0xe15151, transparent: true, opacity: .8 })); equator.rotation.x = Math.PI / 2; this.guides.add(equator);
    const zenith = new THREE.Mesh(new THREE.SphereGeometry(Math.max(.04, radius * .012), 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 })); zenith.position.y = r; this.guides.add(zenith);
  }

  update(state: DomeState, changed: Set<keyof DomeState>) {
    if (!this.mesh || changed.has('projection') || changed.has('radiusM')) {
      this.mesh?.geometry.dispose();
      const geometry = this.geometry(state.projection, state.radiusM);
      if (this.mesh) this.mesh.geometry = geometry;
      else { this.mesh = new THREE.Mesh(geometry, this.material); this.group.add(this.mesh); }
      this.projection = state.projection; this.radius = state.radiusM;
      this.applyTextureUv(state.projection); this.buildGuides(state.projection, state.radiusM);
    }
    this.group.position.y = state.centerHeightM;
    this.guides.visible = state.showGuides;
    this.material.side = state.viewMode === 'outside' ? THREE.DoubleSide : THREE.FrontSide; // Outside is mirrored; this is an inspection view.
    this.material.needsUpdate = true;
  }

  dispose() { this.clearGuides(); this.mesh?.geometry.dispose(); this.material.dispose(); this.scene.remove(this.group); }
}
