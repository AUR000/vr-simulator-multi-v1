# 全球/半球シミュレーター WebXR版 — 設計書

- 設計: Claude (Fable 5) / 実装: GPT-5.6 Sol + Codex
- 前提: 本リポジトリ（vr-simulator）の多面モニター版 Phase 0-3 が完了済み。**その土台を最大限流用する**
- 要件: エクイレクタングラー動画を入力とし、**全球（360°）と半球（ドーム）を切り替え**できる。デスクトップ（内部/外部ビュー）と WebXR（Quest）の両対応。配布は単一HTML

---

## 1. 全体方針

**同一リポジトリ内の第2アプリ**として実装する（別リポジトリにしない）。

- 流用（変更せずそのまま import）: `media/mediaManager.ts`、`xr/session.ts`、`xr/controllers.ts`、`state/store.ts` の createStore 機構、`PlaybackState` 型
- 新規: ドーム用の状態型・reducer、球体シーン、専用UI、専用エントリ
- 多面版の既存コード・既存ビルド（docs/index.html）には**一切手を触れない**

```
vr-simulator/
  index.html            // 既存: 多面版（触らない）
  dome.html             // 新規: 全球/半球版エントリ
  vite.dome.config.ts   // 新規: dome用ビルド設定（→ docs/dome/index.html）
  src/
    dome/
      main.ts           // dome版の配線
      state.ts          // DomeState + reducer + initialState
      sphereScene.ts    // SphereView（ジオメトリ/マテリアル/切替）
      panel.ts          // dome版DOM UI
    （既存モジュールは変更なし）
```

ビルド: `package.json` に追記
```json
"build:dome": "tsc && vite build --config vite.dome.config.ts"
```
`vite.dome.config.ts` は既存configを基に `build.rollupOptions.input = dome.html`、`outDir = docs/dome`、vite-plugin-singlefile 適用。**成果物は docs/dome/index.html の単一ファイル**（公開URLは `https://aur000.github.io/vr-simulator-multi-v1/dome/`）。

## 2. 状態設計

```ts
// ---- src/dome/state.ts ----
import type { MediaSource, PlaybackState } from '../state/types';

export type ProjectionMode = 'sphere' | 'dome';   // 全球 / 半球
export type DomeViewMode = 'inside' | 'outside';  // 内部視点 / 外部視点（非XR時のみ）

export interface DomeState {
  projection: ProjectionMode;
  radiusM: number;            // 球/ドーム半径（実寸m）。既定 7.5（直径15mドーム相当）
  centerHeightM: number;      // 球中心の床からの高さ。既定: sphere=1.6（目線）, dome=0（ドーム基部が床）
  viewMode: DomeViewMode;
  sources: Record<string, MediaSource>;
  sourceId: string | null;    // 動画は常に1本
  playback: PlaybackState;    // 既存型を再利用
  showGuides: boolean;        // 経緯線グリッド + 水平線/天頂マーカー表示
}

export type DomeAction =
  | { type: 'projection/set'; mode: ProjectionMode }   // 切替時に centerHeightM も既定値へ更新
  | { type: 'radius/set'; radiusM: number }
  | { type: 'centerHeight/set'; heightM: number }
  | { type: 'view/set'; mode: DomeViewMode }
  | { type: 'source/add'; source: MediaSource }
  | { type: 'source/select'; sourceId: string | null }
  | { type: 'playback/toggle' } | { type: 'playback/seek'; time: number }
  | { type: 'playback/restart' } | { type: 'playback/mute'; muted: boolean }
  | { type: 'guides/toggle'; show: boolean };
```

createStore は既存の汎用機構をジェネリクス化して使う。**既存の createStore(AppState専用) のシグネチャを壊さないこと**: `createStore<S, A>(initial, reduce)` の汎用版を追加し、多面版は現行呼び出しのまま動くようにする（最小の後方互換リファクタ。既存テストが全通過することで担保）。

MediaManager は「1面に1ソース」の最小ケースとして再利用する。dome では assignments/span を使わず、`sourceId` の1本を acquire して VideoTexture を1枚得るだけ。既存インターフェースがそのまま使えない場合は、`acquire`/`get`/`applyPlayback`/`syncTick` 相当の薄いラッパを dome/main.ts 側に書く（mediaManager.ts 本体の変更は最小限に）。

## 3. 球体シーンの実装仕様（核心）

```ts
// ---- src/dome/sphereScene.ts ----
export class SphereView {
  constructor(scene: THREE.Scene);
  update(state: DomeState, changed: Set<keyof DomeState>): void;
  dispose(): void;
}
```

### 3.1 ジオメトリとUV（この表の通りに実装）

| モード | ジオメトリ | テクスチャUV | 配置 |
|---|---|---|---|
| 全球 sphere | `SphereGeometry(r, 64, 48)` + `geometry.scale(-1, 1, 1)`（内側から正像で見るための標準手法） | equirect をそのまま（offset/repeat デフォルト） | 中心 y = centerHeightM（既定1.6） |
| 半球 dome | `SphereGeometry(r, 64, 24, 0, 2π, 0, π/2)`（上半球のみ）+ `geometry.scale(-1, 1, 1)` | **`texture.offset.y = 0.5; texture.repeat.y = 0.5`**（エクイレクタングラーの上半分 = 水平線から天頂まで） | 基部リング y = centerHeightM（既定0 = ドームの縁が床) |

- マテリアル: `MeshBasicMaterial`（unlit）、`side: THREE.FrontSide`（scale(-1,1,1) 済みなので内側が表になる）
- VideoTexture 設定は多面版と同一の定石: `colorSpace=SRGBColorSpace` / `generateMipmaps=false` / `minFilter=LinearFilter`
- **注意**: SphereGeometry は部分球でも UV を 0..1 に正規化して生成する。上半球 (thetaLength=π/2) の v は天頂=1〜赤道=0 に張られるため、offset.y=0.5/repeat.y=0.5 で「equirect の上半分」に正しく対応する。実装後、経緯線グリッド（3.3）で目視確認すること
- モード切替時: 旧ジオメトリを `dispose()` して作り直し。テクスチャは同一インスタンスを使い回し offset/repeat だけ変更（動画の再生状態を切らさない）

### 3.2 内部/外部ビュー（非XR時）

- inside: カメラを球中心付近（y=centerHeightM）に置き OrbitControls を回転専用（`enablePan=false`, `enableZoom=false`, 距離固定 0.01）にして「見回す」操作にする
- outside: カメラを半径の約2.2倍の距離に置き通常の OrbitControls。マテリアルを `side: DoubleSide` に切り替えて外からも映像を確認できるようにする（外面は鏡像になるが確認用途なので許容。コメントで明記）
- 環境: 暗色グラウンド（多面版 environment.ts を流用可）。dome モードでは床にドーム基部の縁が接する

### 3.3 ガイド表示（showGuides）

- `SphereGeometry` と同半径+0.01m の WireframeGeometry または経緯線 LineSegments（経線24本/緯線12本、色 #2596ad、透明度0.35）
- 水平線（赤道）を強調色、天頂に小マーカー。**equirect の貼り付け向き・上下の検証に必須**なので省略しないこと

### 3.4 WebXR

- 既存 `setupXrSession` / `setupXrControllers` をそのまま使う（トリガー=再生/停止、右スティック=±10秒シーク、グリップ=位置リセット）
- local-floor でユーザーは原点（=球の中心直下/ドームの中心）に立つ。sphere モード時は centerHeightM=1.6 で映像の水平線がほぼ目線に合う
- XRセッション中は viewMode を無視（常に実位置からの内部視点）

## 4. UI（src/dome/panel.ts）

多面版のダークテーマを踏襲。1行目: 動画選択 / 再生 / 先頭へ / シーク / ミュート。2行目: **全球⇔半球トグル**、内部⇔外部ビュートグル、半径(m)入力、中心高さ(m)入力、ガイド表示チェック、動画の解像度とアスペクト表示（equirect は 2:1、ドーム用上半分は実質 2:1 の上半分である旨を表示）。

## 5. 実装フェーズ

1. **Phase D0**: createStore ジェネリクス化（既存テスト全通過を確認）+ DomeState/reducer + reducer テスト
2. **Phase D1**: dome.html + sphereScene + panel でデスクトップ動作（全球/半球切替、内外ビュー、ガイド、再生同期）
3. **Phase D2**: WebXR 接続（既存モジュール流用）+ `build:dome` で docs/dome/index.html 単一ファイル出力
4. 将来拡張（今は作らない、受け口だけ）: 180°フィッシュアイ/ドームマスター入力（ShaderMaterial でUV変換）、ドーム傾斜角（ジオメトリを rotateX）、水平画角210°/230°ドーム、多面版とのUI統合

## 6. ハマりどころ（Codex向け）

1. `geometry.scale(-1,1,1)` を忘れると映像が鏡像になる（テキスト入り映像で確認）
2. equirect 動画の向き: 動画の中央（u=0.5）が -z（正面）に来るのが three の標準マッピング。ガイド表示で確認し、必要なら `texture.offset.x` で回転補正の受け口を残す
3. **Quest の動画デコード上限**: 360°全球で実用画質にするには本来8Kが欲しいが、Quest Browser の H.264/H.265 デコードは実質4K〜5.7K程度が上限。README に「Quest では 4K〜5.7K equirect を推奨」と明記する。デスクトップは8K可（GPU次第）
4. モード切替時にテクスチャを dispose しない（動画・再生位置を維持）。ジオメトリだけ作り直す
5. 半球モードで `texture.wrapT` はデフォルト(ClampToEdge)のままにする（repeat.y=0.5 でラップさせない）
6. 多面版の既存ファイル・既存ビルドへの変更は createStore のジェネリクス化以外禁止。変更後は既存テストが全通過すること
