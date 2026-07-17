import * as THREE from 'three';
import type { AppState } from '../state/types';

export class EnvironmentView {
  private group = new THREE.Group(); private people = new THREE.Group();
  constructor(private scene: any) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x091018, side: THREE.DoubleSide })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.006; this.group.add(ground, this.people); scene.add(this.group);
  }
  private clearPeople() { for (const child of [...this.people.children]) { child.traverse((o:any) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); o.material.dispose(); } }); this.people.remove(child); } }
  update(state: AppState) {
    this.people.visible = state.showPeople; this.clearPeople();
    const specs = [[.3125,1.7,-.16],[.3625,1.05,-.15],[.675,1.7,-.30],[.8625,1.7,-.11],[.8125,1.28,-.125]];
    for (const [x,h,z] of specs) { const person = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({color:0x030609}); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.12, Math.max(.25,h-.38), 4, 8), mat); body.position.y=(h-.18)/2; const head = new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),mat); head.position.y=h-.12; person.add(body,head); person.position.set((x-.5)*state.params.W/1000,0,z*state.params.D/1000); this.people.add(person); }
  }
  dispose() { this.clearPeople(); this.group.traverse((o:any) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); o.material.dispose(); } }); this.scene.remove(this.group); }
}
