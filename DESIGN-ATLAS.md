# 3面シミュレーター アトラス入力版 — 設計書

- 設計: Claude (Opus 5) / 実装: Codex
- 位置づけ: 既存3面版 `aquarium.html` に**アトラス入力モードを追加**する（既存の2本セパレート入力も残す）
- 目的: 制作フローで壁と床を別々に書き出す手間をなくす。**壁+床をまとめた1本の動画**を読み込めるようにする

---

## 1. アトラスのレイアウト（確定）

**全体解像度 3264×2208**（各面の実画素のちょうど1/2スケール。プレビュー用と割り切った値）

| 領域 | 位置 (x, y) | サイズ | 対応する面 | 実画素との関係 |
|---|---|---|---|---|
| **壁面 34:9** | (0, 0) | 3264×864 | 側面(左)+正面(右) の連続 | 6528×1728 の 1/2 |
| **床面** | (0, 864) | 1920×1344 | 床（手前） | 3840×2688 の 1/2 |
| 未使用 | (1920, 864) | 1344×1344 | — | 空き領域（25.1%） |

- 864 + 1344 = 2208 で全体高と一致
- 全領域が1/2スケールで割り切れるため、UV計算に誤差が出ない
- H.264の4096制限内なので、H.264/60fpsで書き出せる

### UV座標（正規化。Codexはこの値を使うこと）

テクスチャUVは左下原点（three.jsのデフォルト）。**画像座標系のyは上から数える**ので変換に注意。

```
壁面領域（画像座標 y=0..864） → UV では上側
  offset.x = 0,              repeat.x = 1.0            (3264/3264)
  offset.y = 1344/2208,      repeat.y = 864/2208       (= 0.608696..., 0.391304...)

床面領域（画像座標 y=864..2208） → UV では下側
  offset.x = 0,              repeat.x = 1920/3264      (= 0.588235...)
  offset.y = 0,              repeat.y = 1344/2208      (= 0.608696...)
```

さらに**壁面領域の中を、側面(左)と正面(右)に分割**する（既存 `computeSpanUV` と同じ考え方）:

```
壁面領域の幅3264 のうち  側面 = 1344px (2688/2), 正面 = 1920px (3840/2)
  側面(left):  領域内 offset比 = 0,           幅比 = 1344/3264 (= 0.411765...)
  正面(front): 領域内 offset比 = 1344/3264,   幅比 = 1920/3264 (= 0.588235...)

最終的なテクスチャUV（アトラス全体に対して）:
  側面:  offset.x = 0,               repeat.x = 1344/3264
         offset.y = 1344/2208,       repeat.y = 864/2208
  正面:  offset.x = 1344/3264,       repeat.x = 1920/3264
         offset.y = 1344/2208,       repeat.y = 864/2208
  床  :  offset.x = 0,               repeat.x = 1920/3264
         offset.y = 0,               repeat.y = 1344/2208
```

**実装方針**: これらの比率はハードコードせず、**領域定義（px）から計算する純関数**にすること（後述 §3.1）。将来レイアウトや解像度が変わっても定義を書き換えるだけで済むように。

---

## 2. UI仕様（既存3面版への追加）

現在のモード切替 `<select>` に**3つ目の選択肢を追加**する:

```
壁面個別                    （現行: 側面/正面/床を別々に）
壁面連続(34:9を1本)          （現行: 壁を1本+床を1本）
壁+床を1本(アトラス)         ★新規
```

- アトラスモードを選ぶと、ファイルスロットは**「壁+床アトラス」1つだけ**になる
- 情報表示行に、アトラスモード時は期待するレイアウトを表示する:
  `アトラス 3264×2208 ｜ 壁34:9=上部3264×864 ｜ 床=左下1920×1344`
- 動画・静止画の両方を受け付ける（既存の image/video 対応をそのまま活かす）
- 他のUI（境界線、人物表示、視点スライダー、全画面、VR）は現行どおり全て機能すること

---

## 3. 実装仕様

### 3.1 アトラス定義とUV計算（純関数・テスト必須）

```ts
// src/aquarium/atlas.ts （新規）

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

/** 確定レイアウト（各面実画素の1/2スケール） */
export const ATLAS_3264x2208: AtlasLayout = {
  totalW: 3264, totalH: 2208,
  wall:  { x: 0, y: 0,   w: 3264, h: 864 },
  floor: { x: 0, y: 864, w: 1920, h: 1344 },
  sideWidthInWall: 1344,   // = 2688/2（正面は 1920 = 3840/2）
};

/** 画像座標の矩形 → three.js テクスチャの offset/repeat（左下原点に変換） */
export function rectToUv(layout: AtlasLayout, rect: AtlasRect): {
  offsetX: number; offsetY: number; repeatX: number; repeatY: number;
};

/** 各面に対応するUVを返す */
export function atlasFaceUv(layout: AtlasLayout, face: 'left' | 'front' | 'floor'): {
  offsetX: number; offsetY: number; repeatX: number; repeatY: number;
};
```

**Vitestで必ずテストすること:**
- `rectToUv` のy反転が正しい（画像上部の領域がUVの上側=offsetY大 になる）
- `atlasFaceUv('left')` = `{ offsetX: 0, offsetY: 1344/2208, repeatX: 1344/3264, repeatY: 864/2208 }`
- `atlasFaceUv('front')` = `{ offsetX: 1344/3264, ... }`
- `atlasFaceUv('floor')` = `{ offsetX: 0, offsetY: 0, repeatX: 1920/3264, repeatY: 1344/2208 }`
- 側面と正面の repeatX の合計が 1.0 になる（壁面全幅を使い切る）

### 3.2 状態管理

既存の `DisplayMode` は `'separate' | 'span'` の2値。**`'atlas'` を追加する。**

```ts
// src/state/types.ts
export type DisplayMode = 'separate' | 'span' | 'atlas';
```

**重要**: この型変更は多面版(`src/main.ts`)・全球版と共有される。以下を守ること:
- 多面版・全球版の挙動は**一切変えない**（`'atlas'` は3面版のUIからのみ選択可能。多面版のUIには追加しない）
- 既存の `mode === 'span'` 判定箇所で `'atlas'` が来た場合に破綻しないようにする
- **既存テスト17件が全通過すること**が後方互換の担保

アトラス用のソースIDは、既存の `spanSourceId` とは別に持つ:
```ts
// AppState に追加
atlasSourceId: string | null;
```
対応するアクション `{ type: 'assign/atlas'; sourceId: string | null }` を追加。

### 3.3 描画（RoomView）

`src/scene/room.ts` の `texture()` メソッドに atlas 分岐を追加:

```
mode === 'atlas' の場合:
  - front / left / floor の3面すべてが atlasSourceId のテクスチャを参照する
  - 各面ごとに media.cloneTexture(atlasSourceId) して、atlasFaceUv() の値を
    texture.offset / texture.repeat に適用する
  - ceiling / right は atlas モードでは使わない（3面版は faces に含まないので実害なし）
```

- **video要素は1つだけ**（cloneTextureは画像データを共有するのでデコードは1本分）。これがアトラス方式の利点なので必ず守る
- 既存の span / separate の処理は**一切変更しない**（分岐を足すだけ）

### 3.4 MediaManager

- アトラスモード時、`activeIds` に `atlasSourceId` が含まれるようにする（再生・シーク・音声の対象になる）
- ドリフト補正は不要（1本しかないので）

---

## 4. 品質確認（Codexはこれを全て通すこと）

- `npx tsc --noEmit` 通過
- `npm test` 全通過（**既存17件を壊さない** + `atlas.ts` の新規テスト）
- `npm run build` / `build:dome` / `build:aquarium` / `build:pv` すべて成功
- `docs/index.html` が変更されないこと（多面版の公開物）
- dev サーバで `/aquarium.html` を開き、モード選択に「壁+床を1本(アトラス)」が出ること

---

## 5. 実装後の運用（AE等での書き出し）

制作側は**3264×2208**のコンポを作り、以下に配置して1本書き出せばよい:
- 上部全幅（0,0 から 3264×864）に壁面34:9の映像
- 左下（0,864 から 1920×1344）に床面の映像
- 右下（1920,864 の 1344×1344）は未使用（何を置いても表示されない）

※ 高画質の最終確認は、従来の「壁1本+床1本」の2本セパレート（原寸4K）モードで行う。アトラスは日常の制作プレビュー用。
