import * as THREE from 'three';
import type { DomeInputFormat, DomeState, ProjectionMode } from './state';

export class SphereView {
  private group = new THREE.Group();
  private mesh: any | null = null;
  private material = new THREE.MeshBasicMaterial({ color: 0x17232d, side: THREE.FrontSide });
  private guides = new THREE.Group();
  private texture: any | null = null;
  private projection: ProjectionMode | null = null;
  private radius = -1;
  private domeInput: DomeInputFormat = 'fisheye';

  constructor(private scene: any) { this.group.add(this.guides); scene.add(this.group); }

  setTexture(texture: any | null) {
    if (texture === this.texture) return;
    this.texture = texture;
    this.material.map = texture;
    this.material.color.set(texture ? 0xffffff : 0x17232d);
    this.applyTextureUv(this.projection ?? 'sphere', this.domeInput);
    this.material.needsUpdate = true;
  }

  private applyTextureUv(mode: ProjectionMode, input: DomeInputFormat) {
    if (!this.texture) return;
    // 半球equirect時のみ上半分をoffset/repeatで切り出す。魚眼はジオメトリ側のUVで展開するため全面参照
    const useHalf = mode === 'dome' && input === 'equirect';
    this.texture.offset.set(0, useHalf ? .5 : 0);
    this.texture.repeat.set(1, useHalf ? .5 : 1);
    // wrapT intentionally remains its default ClampToEdgeWrapping.
    this.texture.needsUpdate = true;
  }

  /**
   * ドームマスター(正方形魚眼)用UV: 画像中心=天頂、画像下端=正面(-z)、等距離射影。
   * 前提の向き規約: 観客が-z(正面)を向いたとき画像の右端が観客の右(+x)に来る標準ドームマスター。
   */
  private applyFisheyeUv(geometry: any) {
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const r = Math.sqrt(x * x + y * y + z * z) || 1;
      const theta = Math.acos(Math.min(1, Math.max(-1, y / r)));   // 天頂からの角度 0..π/2
      const phi = Math.atan2(x, -z);                                // 正面(-z)基準の方位角
      const R = theta / (Math.PI / 2) * .5;                         // 等距離射影: 天頂0 → 縁0.5
      uv.setXY(i, .5 + R * Math.sin(phi), .5 - R * Math.cos(phi));
    }
    uv.needsUpdate = true;
  }

  private geometry(mode: ProjectionMode, radius: number, input: DomeInputFormat) {
    if (mode === 'sphere') {
      const geometry = new THREE.SphereGeometry(radius, 64, 48);
      geometry.scale(-1, 1, 1);
      return geometry;
    }
    // 魚眼はUVマッピングが非線形なので分割を細かくして歪みを抑える
    const fisheye = input === 'fisheye';
    const geometry = new THREE.SphereGeometry(radius, fisheye ? 96 : 64, fisheye ? 48 : 24, 0, Math.PI * 2, 0, Math.PI / 2);
    geometry.scale(-1, 1, 1);
    if (fisheye) this.applyFisheyeUv(geometry);
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
    if (!this.mesh || changed.has('projection') || changed.has('radiusM') || changed.has('domeInput')) {
      this.mesh?.geometry.dispose();
      const geometry = this.geometry(state.projection, state.radiusM, state.domeInput);
      if (this.mesh) this.mesh.geometry = geometry;
      else { this.mesh = new THREE.Mesh(geometry, this.material); this.group.add(this.mesh); }
      this.projection = state.projection; this.radius = state.radiusM; this.domeInput = state.domeInput;
      this.applyTextureUv(state.projection, state.domeInput); this.buildGuides(state.projection, state.radiusM);
    }
    this.group.position.y = state.centerHeightM;
    this.guides.visible = state.showGuides;
    this.material.side = state.viewMode === 'outside' ? THREE.DoubleSide : THREE.FrontSide; // Outside is mirrored; this is an inspection view.
    this.material.needsUpdate = true;
  }

  dispose() { this.clearGuides(); this.mesh?.geometry.dispose(); this.material.dispose(); this.scene.remove(this.group); }
}
