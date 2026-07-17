export const COMMON_RATIOS: ReadonlyArray<readonly [number, number]> = [
  [16, 9], [20, 9], [21, 9], [14, 9], [4, 3], [1, 1], [2, 1],
];

export function formatAspect(widthMm: number, heightMm: number): string {
  if (!heightMm) return '—';
  const ratio = widthMm / heightMm;
  let nearest: string | null = null;
  let best = Infinity;

  for (const [width, height] of COMMON_RATIOS) {
    const difference = Math.abs(ratio - width / height);
    if (difference < best) {
      best = difference;
      nearest = `${width}:${height}`;
    }
  }

  const note = best / ratio < 0.03 ? ` (${nearest})` : '';
  return ratio.toFixed(2) + note;
}
