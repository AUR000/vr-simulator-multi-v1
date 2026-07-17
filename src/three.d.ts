declare const process: { env: Record<string, string | undefined> };
declare const XRReferenceSpace: unknown;
interface XRRigidTransformConstructor { new(position?: { x?: number; y?: number; z?: number }): unknown }
interface Window { XRRigidTransform?: XRRigidTransformConstructor }
declare var XRRigidTransform: XRRigidTransformConstructor | undefined;

declare module 'three' {
  export const LinearFilter: any, SRGBColorSpace: any, FrontSide: any, DoubleSide: any, MathUtils: any;
  export const VideoTexture: any, Group: any, Scene: any, Mesh: any, PlaneGeometry: any, MeshBasicMaterial: any;
  export const CapsuleGeometry: any, SphereGeometry: any, PerspectiveCamera: any, WebGLRenderer: any;
}
declare module 'three/examples/jsm/controls/OrbitControls.js' {
  export class OrbitControls { constructor(camera:any,element:HTMLElement); enabled:boolean; enableDamping:boolean; target:any; update():void; dispose():void }
}
declare module 'three/examples/jsm/webxr/VRButton.js' {
  export class VRButton { static createButton(renderer:any, sessionInit?:any): HTMLElement }
}
