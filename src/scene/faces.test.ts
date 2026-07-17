import { describe, expect, it } from 'vitest';
import { PRESETS } from '../state/presets';
import { computeFaces, computeSpanUV, type SpanFaceId } from './faces';

describe('computeFaces', () => {
  it('places all five box faces according to the coordinate-system table', () => {
    expect(computeFaces(PRESETS.box)).toEqual([
      { id: 'front', widthM: 6, heightM: 2.7, position: [0, 1.35, -2], rotationDeg: [0, 0, 0], spanRole: 'wall', spanOrder: 1 },
      { id: 'right', widthM: 4, heightM: 2.7, position: [3, 1.35, 0], rotationDeg: [0, -90, 0], spanRole: 'wall', spanOrder: 2 },
      { id: 'left', widthM: 4, heightM: 2.7, position: [-3, 1.35, 0], rotationDeg: [0, 90, 0], spanRole: 'wall', spanOrder: 0 },
      { id: 'floor', widthM: 6, heightM: 4, position: [0, 0, 0], rotationDeg: [-90, 0, 0], spanRole: 'independent' },
      { id: 'ceiling', widthM: 6, heightM: 4, position: [0, 2.7, 0], rotationDeg: [90, 0, 0], spanRole: 'independent' },
    ]);
  });

  it('returns only enabled faces', () => {
    expect(computeFaces(PRESETS.aquarium).map(({ id }) => id)).toEqual(['front', 'right', 'floor']);
  });
});

describe('computeSpanUV', () => {
  it('is mathematically equivalent to legacy spanCrop', () => {
    const legacySpanCrop = (face: SpanFaceId) => {
      const leftWidth = PRESETS.box.faces.left ? PRESETS.box.D : 0;
      const own = face === 'front' ? PRESETS.box.W : PRESETS.box.D;
      const leftOf = face === 'left' ? 0 : face === 'front' ? leftWidth : leftWidth + PRESETS.box.W;
      const total = leftWidth + PRESETS.box.W + PRESETS.box.D;
      return { widthPct: total / own * 100, leftPct: -(leftOf / own) * 100 };
    };

    for (const face of ['left', 'front', 'right'] as const) {
      const legacy = legacySpanCrop(face);
      const uv = computeSpanUV(PRESETS.box, face);
      expect(uv.repeatX).toBeCloseTo(100 / legacy.widthPct);
      expect(uv.offsetX).toBeCloseTo(-legacy.leftPct / legacy.widthPct);
    }
  });

  it('uses the legacy fallback for a disabled wall', () => {
    expect(computeSpanUV(PRESETS.aquarium, 'left')).toEqual({ offsetX: 0, repeatX: 1 });
  });
});
