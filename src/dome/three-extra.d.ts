declare module 'three' {
  export const Texture: any, Vector3: any, BufferGeometry: any, Float32BufferAttribute: any;
  export const LineSegments: any, LineBasicMaterial: any, TorusGeometry: any, AmbientLight: any;
}
declare module 'three/examples/jsm/controls/OrbitControls.js' {
  interface OrbitControls { enablePan: boolean; enableZoom: boolean; minDistance: number; maxDistance: number; }
}
