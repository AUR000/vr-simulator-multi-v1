import { describe, expect, it } from 'vitest';
import { COMMON_RATIOS, formatAspect } from './aspect';

describe('aspect formatting', () => {
  it('ports the legacy ratio table', () => {
    expect(COMMON_RATIOS).toEqual([[16, 9], [20, 9], [21, 9], [14, 9], [4, 3], [1, 1], [2, 1]]);
  });

  it('annotates ratios within the legacy three-percent threshold', () => {
    expect(formatAspect(1920, 1080)).toBe('1.78 (16:9)');
    expect(formatAspect(6000, 2700)).toBe('2.22 (20:9)');
  });

  it('omits distant common ratios and handles a zero height', () => {
    expect(formatAspect(1700, 1000)).toBe('1.70');
    expect(formatAspect(1000, 0)).toBe('—');
  });
});
