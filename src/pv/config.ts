/** PV input format. Change this file only to switch between the two formats. */
export const PV_INPUT_MODE: 'span' | 'atlas' = 'span';

export const PV_SOURCES = {
  /** 壁面連続 34:9（側面 + 正面）。相対パスまたは絶対 URL。 */
  wall: './media/pv-wall-34x9.mp4',
  /** 床面。相対パスまたは絶対 URL。 */
  floor: './media/pv-floor.mp4',
  /** Combined wall + floor atlas (3264x2208). */
  atlas: './media/pv-atlas-3264x2208.mp4',
} as const;

/** 外部配信元が CORS を必要とする場合だけ true にする。 */
export const USE_CROSSORIGIN = false;
