import type { FaceId, RoomParams } from '../state/types';

export interface FaceDescriptor {
  id: FaceId;
  widthM: number;
  heightM: number;
  position: [number, number, number];
  rotationDeg: [number, number, number];
  spanRole: 'wall' | 'independent';
  spanOrder?: 0 | 1 | 2;
}

export type SpanFaceId = 'left' | 'front' | 'right';

export function computeFaces(params: RoomParams): FaceDescriptor[] {
  const W = params.W / 1000;
  const H = params.H / 1000;
  const D = params.D / 1000;

  const faces: FaceDescriptor[] = [
    { id: 'front', widthM: W, heightM: H, position: [0, H / 2, -D / 2], rotationDeg: [0, 0, 0], spanRole: 'wall', spanOrder: 1 },
    { id: 'right', widthM: D, heightM: H, position: [W / 2, H / 2, 0], rotationDeg: [0, -90, 0], spanRole: 'wall', spanOrder: 2 },
    { id: 'left', widthM: D, heightM: H, position: [-W / 2, H / 2, 0], rotationDeg: [0, 90, 0], spanRole: 'wall', spanOrder: 0 },
    { id: 'floor', widthM: W, heightM: D, position: [0, 0, 0], rotationDeg: [-90, 0, 0], spanRole: 'independent' },
    { id: 'ceiling', widthM: W, heightM: D, position: [0, H, 0], rotationDeg: [90, 0, 0], spanRole: 'independent' },
  ];

  return faces.filter((face) => params.faces[face.id]);
}

export function computeSpanUV(
  params: RoomParams,
  face: SpanFaceId,
): { offsetX: number; repeatX: number } {
  const leftWidth = params.faces.left ? params.D : 0;
  const frontWidth = params.W;
  const rightWidth = params.faces.right ? params.D : 0;
  const total = leftWidth + frontWidth + rightWidth;

  const own = face === 'front' ? frontWidth : face === 'left' ? leftWidth : rightWidth;
  const leftOf = face === 'left' ? 0 : face === 'front' ? leftWidth : leftWidth + frontWidth;

  if (total <= 0 || own <= 0) return { offsetX: 0, repeatX: 1 };
  return { offsetX: leftOf / total, repeatX: own / total };
}
