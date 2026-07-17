import type { PresetName, RoomParams } from './types';

export type BuiltInPresetName = Exclude<PresetName, 'custom'>;

export const PRESETS: Record<BuiltInPresetName, RoomParams> = {
  aquarium: {
    W: 6000, H: 2700, D: 4187.5,
    faces: { front: true, left: false, right: true, floor: true, ceiling: false },
  },
  u: {
    W: 6000, H: 2700, D: 3000,
    faces: { front: true, left: true, right: true, floor: false, ceiling: false },
  },
  l: {
    W: 6000, H: 2700, D: 4000,
    faces: { front: true, left: false, right: true, floor: false, ceiling: false },
  },
  box: {
    W: 6000, H: 2700, D: 4000,
    faces: { front: true, left: true, right: true, floor: true, ceiling: true },
  },
};
