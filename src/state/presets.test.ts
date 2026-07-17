import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';

describe('PRESETS', () => {
  it('expands legacy booleans into RoomParams faces', () => {
    expect(PRESETS.aquarium).toEqual({
      W: 6000,
      H: 2700,
      D: 4187.5,
      faces: { front: true, left: false, right: true, floor: true, ceiling: false },
    });
    expect(PRESETS.box.faces).toEqual({ front: true, left: true, right: true, floor: true, ceiling: true });
  });
});
