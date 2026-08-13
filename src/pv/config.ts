/** PV input format. Change this file only to switch between the two formats. */
export const PV_INPUT_MODE: 'span' | 'atlas' = 'atlas';

/**
 * 配信元: Cloudflare R2 (bucket: aquarium-pv)
 * 差し替えは R2 に同名でアップロードし直すだけでよい（このファイルの変更は不要）。
 */
const R2 = 'https://pub-24e4b789bbff405f8440f3e63c0f51fe.r2.dev';

export const PV_SOURCES = {
  /** 壁面連続 34:9（側面 + 正面）。相対パスまたは絶対 URL。 */
  wall: `${R2}/pv-wall-34x9.mp4`,
  /** 床面。相対パスまたは絶対 URL。 */
  floor: `${R2}/pv-floor.mp4`,
  /** Combined wall + floor atlas (3264x2208). */
  atlas: `${R2}/pv-atlas.mp4`,
} as const;

/** 外部配信元が CORS を必要とする場合だけ true にする。 */
export const USE_CROSSORIGIN = true;
