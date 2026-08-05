import { describe, expect, it } from 'vitest';
import { ATLAS_3264x2208, atlasFaceUv, rectToUv } from './atlas';

describe('aquarium atlas UVs', () => {
  it('flips top-origin image y into bottom-origin texture y', () => {
    expect(rectToUv(ATLAS_3264x2208, ATLAS_3264x2208.wall).offsetY).toBe(1344 / 2208);
    expect(rectToUv(ATLAS_3264x2208, ATLAS_3264x2208.floor).offsetY).toBe(0);
  });

  it('maps the left, front, and floor regions', () => {
    expect(atlasFaceUv(ATLAS_3264x2208, 'left')).toEqual({
      offsetX: 0, offsetY: 1344 / 2208, repeatX: 1344 / 3264, repeatY: 864 / 2208,
    });
    expect(atlasFaceUv(ATLAS_3264x2208, 'front')).toEqual({
      offsetX: 1344 / 3264, offsetY: 1344 / 2208, repeatX: 1920 / 3264, repeatY: 864 / 2208,
    });
    // 床は右下（左下1344×1344は未使用領域）
    expect(atlasFaceUv(ATLAS_3264x2208, 'floor')).toEqual({
      offsetX: 1344 / 3264, offsetY: 0, repeatX: 1920 / 3264, repeatY: 1344 / 2208,
    });
  });

  it('uses the complete wall width', () => {
    expect(atlasFaceUv(ATLAS_3264x2208, 'left').repeatX + atlasFaceUv(ATLAS_3264x2208, 'front').repeatX).toBe(1);
  });
});
