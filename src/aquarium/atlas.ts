/** アトラス内の矩形領域（画像座標系・左上原点・px） */
export interface AtlasRect { x: number; y: number; w: number; h: number }

export interface AtlasLayout {
  totalW: number;
  totalH: number;
  /** 壁面34:9の領域（この中をさらに側面/正面に分割する） */
  wall: AtlasRect;
  /** 床面の領域 */
  floor: AtlasRect;
  /** 壁面領域内での側面の幅（px）。残りが正面 */
  sideWidthInWall: number;
}

export interface AtlasUv { offsetX: number; offsetY: number; repeatX: number; repeatY: number }

/**
 * 確定レイアウト（各面実画素の1/2スケール）
 * 壁34:9=上部全幅 / 床=右下 / 左下1344×1344は未使用（灰色＝表示範囲外の意味）
 */
export const ATLAS_3264x2208: AtlasLayout = {
  totalW: 3264, totalH: 2208,
  wall: { x: 0, y: 0, w: 3264, h: 864 },
  floor: { x: 1344, y: 864, w: 1920, h: 1344 },
  sideWidthInWall: 1344,
};

/** 画像座標の矩形をthree.jsテクスチャの左下原点offset/repeatへ変換する。 */
export function rectToUv(layout: AtlasLayout, rect: AtlasRect): AtlasUv {
  return {
    offsetX: rect.x / layout.totalW,
    offsetY: (layout.totalH - rect.y - rect.h) / layout.totalH,
    repeatX: rect.w / layout.totalW,
    repeatY: rect.h / layout.totalH,
  };
}

/** 各表示面に対応するアトラスUVを返す。 */
export function atlasFaceUv(layout: AtlasLayout, face: 'left' | 'front' | 'floor'): AtlasUv {
  if (face === 'floor') return rectToUv(layout, layout.floor);
  const isLeft = face === 'left';
  return rectToUv(layout, {
    x: layout.wall.x + (isLeft ? 0 : layout.sideWidthInWall),
    y: layout.wall.y,
    w: isLeft ? layout.sideWidthInWall : layout.wall.w - layout.sideWidthInWall,
    h: layout.wall.h,
  });
}
