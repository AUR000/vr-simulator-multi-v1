# 多面モニターシミュレーター WebXR(VR)対応版 — 全体設計書

- 設計: Claude (Fable 5) / 実装: GPT-5.6 Sol + Codex
- ベース: `D:\video-output\多面シミュレーター\多面シミュレーター.html` (2026-07-14版, CSS 3D実装)
- 方針: 最初から完璧な再現(レンズ歪み・物理光学)は目指さず、**後から段階的に拡張しやすい土台**を作る

---

## 1. 現状コードの評価とVR化の課題

### 良い点（そのまま活かす）

1. **パラメータモデルが既に純粋**: `{W, H, D, left, right, floor, ceiling}` のmm単位モデルと `PRESETS` 定義は、レンダラ非依存でそのまま移植できる。
2. **spanCrop の数式が純関数**: 連続モードの分割計算（own/leftOf/total）はUV座標にほぼ直訳できる。
3. **同期戦略がシンプルで実績あり**: マスター1本＋0.08秒閾値のドリフト補正は、VR版の個別モードでもそのまま使える。
4. **音声代表1本の設計**: `pickAudioSource` の優先順位ロジック（正面>右>床>…）は移植可能。
5. **実寸(mm)ベースの思想**: `MM_PER_PX=7.5` で実寸を意識した設計。VRでは mm→メートルの1:1スケールに素直に昇格できる。

### VR化する上での主な技術的課題

| 課題 | 内容 |
|---|---|
| **状態がDOMに散在** | `getParams()` がチェックボックスの `.checked` を直接読む。DOM = 真実の状態になっており、レンダラを2つ（ブラウザ版/VR版）にできない。 |
| **video要素そのものが状態** | `videos` / `spanVideos` が HTMLVideoElement を直接保持。シリアライズ不能で、設定の保存・復元・別レンダラとの共有ができない。 |
| **連続モードの多重デコード** | 現在は同一動画を面ごとに複製再生（最大3本デコード）。スタンドアロンHMD（Quest等）はハードウェアデコーダが少なく、これが最大のボトルネックになる。WebGLなら**1本のVideoTextureをUVで分割**でき、同期問題ごと消せる。 |
| **座標系の変換** | CSS 3D（px, Y下向き, transform-origin依存）→ Three.js（メートル, Y上向き, 中心原点）への配置式の書き直しが必要。天井の `scaleX(-1)` 反転などの流儀も再定義が要る。 |
| **VR中のUI** | immersive-vr セッション中はDOM UIが見えない。DOM Overlayは対応がまちまちなので当てにしない。 |
| **セキュアコンテキスト** | WebXRはHTTPS必須（localhostは例外）。HMD実機からLAN経由で開くにはHTTPSの開発サーバが必要。 |
| **HMDでのファイル入力** | デスクトップの `<input type="file">` の blob URL はHMDに持ち込めない。HMD利用時は動画をサーバ配信する前提が必要。 |

---

## 2. 全体アーキテクチャ

### 2.1 基本方針: 「シリアライズ可能なStore + MediaManager + 2つのビュー」

```
                    ┌─────────────────────┐
                    │   Store (state)      │  ← JSONシリアライズ可能。唯一の真実
                    │  params/mode/assign  │
                    │  playback/view       │
                    └──────┬──────────────┘
              subscribe    │    dispatch(action)
        ┌──────────┬───────┴────────┬──────────────┐
        │          │                │              │
   ┌────▼────┐ ┌───▼──────────┐ ┌──▼─────────┐ ┌──▼──────────┐
   │ ui/panel │ │ MediaManager  │ │ RoomView    │ │ xr/session   │
   │ (DOM UI) │ │ video要素の   │ │ (Three.js   │ │ (WebXR入退場)│
   │          │ │ 生成/同期/音声│ │  シーン構築) │ │              │
   └──────────┘ └──────────────┘ └────────────┘ └─────────────┘
```

- **Store**: プレーンなJSオブジェクト＋dispatch/subscribe。フレームワーク不使用（Codexが依存なしで実装できる）。
- **MediaManager**: HTMLVideoElement の生涯管理を一手に引き受ける。**video要素はStoreに入れない**。Storeは `sourceId`（文字列）だけを持つ。
- **RoomView**: Storeを購読し、Three.jsシーンを差分更新。デスクトップ（OrbitControls）とVR（WebXR）で**同一シーンを共有**。
- **既存CSS版(v1)は凍結して残す**: 軽量プレビューとしてそのまま使い続ける。共有するのは `presets.js` などの純ロジックのみ。

### 2.2 状態管理の具体設計（最重要）

```ts
// ---- state/types.ts ----

type FaceId = 'front' | 'left' | 'right' | 'floor' | 'ceiling';
type DisplayMode = 'separate' | 'span';
type PresetName = 'aquarium' | 'u' | 'l' | 'box' | 'custom';

interface RoomParams {
  W: number;              // 幅 mm
  H: number;              // 高さ mm
  D: number;              // 奥行 mm
  faces: Record<FaceId, boolean>;   // front は常に true
}

interface MediaSource {
  id: string;             // 'src-1' 等の連番。Storeはこれだけ持つ
  kind: 'file' | 'url';
  url: string;            // blob: または http(s)://（HMDはurl系のみ）
  name: string;           // 表示名（設定保存時の再リンク手掛かり）
}

interface PlaybackState {
  playing: boolean;
  muted: boolean;
  seekRequest: { time: number; seq: number } | null; // seqでシーク要求を一意化
}

interface ViewState {                // デスクトップ非XR時のみ使用
  orbit: number; pitch: number; dist: number;
}

interface AppState {
  params: RoomParams;
  preset: PresetName;
  mode: DisplayMode;
  sources: Record<string, MediaSource>;
  assignments: Partial<Record<FaceId, string>>; // 個別モード: face → sourceId
  spanSourceId: string | null;                  // 連続モード用の1本
  playback: PlaybackState;
  view: ViewState;
  showPeople: boolean;
}
```

```ts
// ---- state/actions.ts ----

type Action =
  | { type: 'params/patch';  patch: Partial<Omit<RoomParams,'faces'>> & { faces?: Partial<Record<FaceId, boolean>> } }
  | { type: 'preset/apply';  name: Exclude<PresetName,'custom'> }
  | { type: 'mode/set';      mode: DisplayMode }
  | { type: 'source/add';    source: MediaSource }
  | { type: 'assign/face';   face: FaceId; sourceId: string | null }
  | { type: 'assign/span';   sourceId: string | null }
  | { type: 'playback/toggle' }
  | { type: 'playback/seek'; time: number }        // 秒
  | { type: 'playback/restart' }
  | { type: 'playback/mute'; muted: boolean }
  | { type: 'view/patch';    patch: Partial<ViewState> }
  | { type: 'people/toggle'; show: boolean };
```

```ts
// ---- state/store.ts ----

type ChangedKeys = Set<keyof AppState>;
type Listener = (state: AppState, changed: ChangedKeys) => void;

interface Store {
  getState(): AppState;
  dispatch(action: Action): void;   // reducerで新stateを作り、変更キーを通知
  subscribe(fn: Listener): () => void;
}

function createStore(initial: AppState): Store;
```

**Codex向け実装指針:**

- reducer は1ファイルの純関数 `reduce(state, action): AppState`。イミュータブル更新（スプレッドで十分。ライブラリ不要）。
- `preset/apply` は既存 `PRESETS` を `RoomParams` に展開。`params/patch` 後にプリセット一致判定（既存 `markCustom` 相当）を reducer 内で行い `preset` を更新。
- `changed` キー集合を通知することで、購読側が「paramsが変わった時だけジオメトリ再構築」「playbackだけなら再生制御のみ」と差分処理できる。
- **Storeは丸ごと `JSON.stringify` 可能**（blob URLは保存対象外としてexport時に除去）。→ 設定の保存/復元・URLパラメータ共有が後からタダで手に入る。

### 2.3 MediaManager（video要素と同期の一元管理）

```ts
// ---- media/mediaManager.ts ----

interface MediaManager {
  /** sourceId に対応する video 要素を生成 or 再利用して返す */
  acquire(source: MediaSource): HTMLVideoElement;
  get(sourceId: string): HTMLVideoElement | null;
  /** Storeの playback / assignments を反映（play/pause/mute/シーク） */
  applyState(state: AppState): void;
  /** ドリフト補正。250ms間隔の setInterval で呼ぶ（既存ロジック移植: 閾値0.08s） */
  syncTick(state: AppState): void;
  /** 音声代表1本の選定（既存 pickAudioSource の優先順位を移植） */
  pickAudioSourceId(state: AppState): string | null;
  release(sourceId: string): void;  // revokeObjectURL 含む
  dispose(): void;
}
```

**重要な設計判断: 連続モードは video 1本のみ。**
現在の実装は面ごとに video を複製しているが、VR版では **1つの HTMLVideoElement → 1つの VideoTexture → 面ごとに `texture.clone()` して `offset/repeat` で切り出す**。

- デコード1本分の負荷で済む（Quest系での必須要件）
- 面間の同期ズレが**構造的にゼロ**になる（同一フレームを参照するため）
- `spanCrop` の置き換え式:
  - 旧: `widthPct = total/own*100`, `leftPct = -(leftOf/own)*100`
  - 新: `texture.repeat.x = own/total`, `texture.offset.x = leftOf/total`（そのまま直訳）

個別モードは面ごとに VideoTexture 1本ずつ。同期は既存の interval 方式を移植（VideoTexture はフレーム毎に自動更新されるので、currentTime の補正だけ面倒を見ればよい）。

### 2.4 シーン構築（座標系とファイル配置の具体仕様）

**座標系規約（Codexはこの表の通りに実装すること）:**

- 1 unit = 1m。`meters = mm / 1000`
- Y上向き。**原点 = 床の中心**（`local-floor` 参照空間でユーザーが部屋の中央に立つ）
- 開口部（観客側）は +z。正面壁は z = -D/2

| 面 | PlaneGeometry | position | rotation | 備考 |
|---|---|---|---|---|
| front   | (W, H) | (0, H/2, -D/2) | (0, 0, 0) | 法線 +z（内向き）|
| right   | (D, H) | (+W/2, H/2, 0) | (0, -90°, 0) | 法線 -x（内向き）。u=0 が正面側コーナー → span連続性OK |
| left    | (D, H) | (-W/2, H/2, 0) | (0, +90°, 0) | 法線 +x（内向き）。u=0 が開口側 → 開口→正面コーナーへ流れる。spanの左端に一致 |
| floor   | (W, D) | (0, 0, 0) | (-90°, 0, 0) | 法線 +y。**規約: 動画の上端 = 正面壁側** |
| ceiling | (W, D) | (0, H, 0) | (+90°, 0, 0) | 法線 -y。CSS版の scaleX(-1) 相当の反転が必要か**実機で目視確認**し、必要なら `texture.repeat.x = -1; texture.offset.x = 1` で対応 |

- 面のマテリアルは `MeshBasicMaterial`（unlit。スクリーンは自発光なのでライティング不要）。`side: THREE.FrontSide`。
- `texture.colorSpace = THREE.SRGBColorSpace`、`generateMipmaps = false`、`minFilter = LinearFilter` を必ず設定（動画テクスチャの定石）。
- span時の左右壁のu方向は上表の回転なら自然に連続する（left: 開口→正面コーナー、front: 左→右、right: 正面コーナー→開口）。

```ts
// ---- scene/faces.ts（純関数。テスト可能にする） ----

interface FaceDescriptor {
  id: FaceId;
  widthM: number; heightM: number;
  position: [number, number, number];
  rotationDeg: [number, number, number];
  spanRole: 'wall' | 'independent';   // wall = 連続モード対象
  spanOrder?: 0 | 1 | 2;              // left=0, front=1, right=2
}

function computeFaces(params: RoomParams): FaceDescriptor[];
function computeSpanUV(params: RoomParams, face: 'left'|'front'|'right')
  : { offsetX: number; repeatX: number };
```

**面を「ハードコードされた5面」ではなく FaceDescriptor の配列として生成する**のがポイント。将来のN面対応・斜め壁・LEDベゼル表現は、この配列に要素/属性を足すだけで済む（§4参照）。

```ts
// ---- scene/room.ts ----

class RoomView {
  constructor(scene: THREE.Scene, media: MediaManager);
  /** changed に 'params'|'mode' が含まれる時だけジオメトリ再構築。
      assignments/playback のみならテクスチャ差し替えだけ行う */
  update(state: AppState, changed: ChangedKeys): void;
  dispose(): void;
}
```

環境要素（`scene/environment.ts`）:
- 床の外側に広い暗色グラウンド（現 `#ground` 相当。ただの大きなPlane＋暗いマテリアル）
- 人物シルエット: 高さ1700/1050/1280mmの単純なカプセル or 板ポリ。**VRでは本人がスケール基準になるので優先度低**。デスクトッププレビュー用に `showPeople` で出し分け。

### 2.5 WebXR まわり

```ts
// ---- xr/session.ts ----
// - renderer.xr.enabled = true
// - three/examples の VRButton をそのまま使う（自前実装しない）
// - referenceSpace: 'local-floor'（床基準・実寸1:1が目的そのもの）
// - セッション開始 = ユーザージェスチャ → このタイミングで video.play() を蹴ると
//   自動再生ポリシーも同時に解決できる
```

- **Phase 2まではVR中の操作なし**（入場前にデスクトップUIで設定 → VRは「見る」専用）。DOM Overlayは使わない。
- Phase 3でコントローラ最小操作: トリガー=再生/停止、スティック左右=±10秒シーク、グリップ=位置リセット程度。レイキャストUIパネルはその後。
- 移動はまず不要（部屋中央に立つ体験が本題）。酔い対策としてスナップターンだけ後付け候補。

### 2.6 モジュール構成と技術選定

```
vr-simulator/
  index.html            // デスクトップUI + canvas
  vite.config.ts        // basic-ssl プラグイン（HMD実機用HTTPS）
  public/media/         // HMDで使う動画の置き場（サーバ配信）
  src/
    main.ts             // 起動・配線のみ（ロジックを書かない）
    state/
      types.ts
      store.ts          // createStore + reducer
      presets.ts        // 既存PRESETSをそのまま移植
    media/
      mediaManager.ts
    scene/
      faces.ts          // computeFaces / computeSpanUV（純関数）
      room.ts           // RoomView
      environment.ts    // グラウンド・シルエット
    xr/
      session.ts        // VRButton / referenceSpace
      controllers.ts    // Phase 3
    ui/
      panel.ts          // DOM UI（既存UIのポート）。dispatchするだけ
      viewControls.ts   // OrbitControls ラッパ（非XR時）
    util/
      aspect.ts         // formatAspect / COMMON_RATIOS を移植
```

- **ビルド: Vite + TypeScript + three (npm)**。`@vitejs/plugin-basic-ssl` で `vite --host` すればHMDから `https://<PCのIP>:5173` で開ける（WebXRのセキュアコンテキスト要件を満たす）。※これは**開発中のテスト用**。
- **配布形態は単一HTMLファイル（必須要件）**: `vite-plugin-singlefile` を使い、`vite build` でThree.js含む全アセットをインライン化した `.html` 1ファイルを出力する。モジュール分割は開発時のみの構造。
- 依存は `three` のみ。状態管理ライブラリは入れない。
- CSS版v1は `legacy/` にコピーして凍結（共有したい定数が出たら presets.ts 側を正とする）。

### 2.6.1 Quest実機での想定利用フロー（これを複雑にしない）

1. ビルド済みHTML 1ファイルをHTTPSの静的な場所に配置（GitHub Pages等。WebXRのセキュアコンテキスト要件のため `file://` 直開きは不可）
2. 動画はQuest本体ストレージに入れておく（USB転送等）
3. Quest BrowserでURLを開く → ファイル選択UIでQuest内の動画を選ぶ（同一デバイス内で作ったblob URLは問題なく使える）
4. VRボタンで入場

→ 日常運用は「URLを開く→動画を選ぶ→VR入場」の3手。サーバ運用・PC接続は不要。この体験を壊す機能追加をしないこと。

### 2.7 段階的な移行手順（Codexへの実装順序指示）

1. **Phase 0 — 純ロジック抽出**（半日規模）
   `presets.ts` / `faces.ts` / `aspect.ts` を作り、`computeFaces` と `computeSpanUV` に対する簡単なユニットテスト（Vitest）を書く。既存HTMLは触らない。
2. **Phase 1 — デスクトップThree.js版で機能同等**（本体）
   Store + MediaManager + RoomView + DOM UI。OrbitControlsで現CSS版と同じことができる状態（プリセット/個別/連続/シーク/同期/ミュート/人物表示）。**ここで一度動作確認を挟む。**
3. **Phase 2 — WebXR入場**
   VRButton + local-floor。入場時に部屋中央スポーン。HTTPS配信でQuest実機確認。
4. **Phase 3 — VR内最小操作**
   コントローラボタンマッピング（再生/停止/シーク/位置リセット）。
5. **Phase 4 — 忠実度拡張**（それぞれ独立に着手可能）
   エッジブレンド / レンズ歪み / LEDベゼル / スクリーン光の床への漏れ（§4）。

各Phaseは独立にレビュー・動作確認できる粒度にしてある。**Phase 1完了時点でCSS版の完全上位互換**になるのが中間ゴール。

---

## 3. 特に重要な設計判断ポイント（理由とトレードオフ）

### 判断1: video要素をStoreから追放し、sourceId参照 + MediaManager に分離する

- **理由**: 状態をシリアライズ可能に保つことが、①ブラウザ版/VR版の2レンダラ共存、②設定の保存/復元、③将来のリモート同期（PCで操作→HMDで閲覧）の全部の前提になる。
- **トレードオフ**: 間接参照が1段増え、video のライフサイクル管理（acquire/release, revokeObjectURL）を明示的に書く必要がある。ただし現在のコードも実質同じことを手動でやっており、複雑さの総量は増えない。

### 判断2: 連続モードは「1 video → 1 VideoTexture → UV offset/repeat 分割」

- **理由**: スタンドアロンHMDはハードウェアデコーダが1〜2本しかなく、現行の「面ごとにvideo複製」はQuestでほぼ確実に破綻する。UV分割ならデコード1本・同期ズレ構造的ゼロ・`spanCrop` の式がほぼ直訳できる。
- **トレードオフ**: 1本の動画解像度に上限が出る（Quest系はおおむね4K H.264/H.265まで。3面連続で横4Kだと1面あたり約1300px）。面ごとに高解像度が必要になったら「事前に3分割した動画を個別モードで読む」逃げ道が残る（この用途でも個別モードの同期機構が活きる）。

### 判断3: mm→メートル1:1・local-floor・床中心原点

- **理由**: このツールの価値は「実寸の空間認識」。W/H/Dのmm入力がそのままVR内の実寸になる座標規約を最初に固定すれば、以後の全機能（歪み・ブレンド・N面化）がこの上に安心して乗る。§2.4の配置表を最初に確定させるのが土台作りの核心。
- **トレードオフ**: CSS版との座標変換規約が併存する（v1は凍結するので実害は小さい）。UV向き・天井反転などの「流儀」はPhase 1の目視確認で1度だけ確定させる必要がある。

### 判断4: VR中のUIは当面作らない（デスクトップUIが唯一の設定面）

- **理由**: in-VR UI（レイキャストパネル）は工数が大きく、体験の本質（空間で実寸確認する）に寄与しない。設定→入場→鑑賞→退場→再設定のループで実用上十分。DOM Overlayはブラウザ差があり土台に組み込むには不安定。
- **トレードオフ**: 設定変更のたびにVRを抜ける手間。Phase 3のコントローラ最小操作（再生/シーク）で大半は解消する。フルUIが本当に必要になった時も、Storeにdispatchするだけなので後付けが容易（この設計の効能）。

### 判断5: スクリーンは unlit (MeshBasicMaterial)、ただしマテリアル生成をファクトリ関数に集約

- **理由**: スクリーンは自発光面でありライティング計算は不要（むしろ暗くなって不正確になる）。一方、Phase 4のエッジブレンド/歪みは ShaderMaterial への差し替えで実現するため、**`createFaceMaterial(face, texture, opts)` を唯一の生成点**にしておけば、レイアウトコードを一切触らず拡張できる。
- **トレードオフ**: スクリーン光が床に漏れる表現（実空間の雰囲気再現）は当面なし。必要になったら面ごとの RectAreaLight や平均色ポイントライトで安価に偽装できる（これもファクトリの裏に足すだけ）。

---

## 4. 将来拡張の受け口（今は作らない。ただし壊さない）

| 拡張 | 受け口（今の設計のどこに足すか） |
|---|---|
| エッジブレンド | `createFaceMaterial` を ShaderMaterial 化し、`uBlendLeft/uBlendRight/uGamma` uniform を追加。FaceDescriptor に `blend?: {...}` を足す |
| レンズ歪み（プロジェクタ再現） | 面ごとに RenderTarget へ描画→歪みメッシュに貼る方式。RoomViewの面単位の構造がそのまま使える |
| LEDベゼル/タイル表現 | FaceDescriptor に `grid?: { cols, rows, gapMm }`。シェーダで格子を暗く落とすのが最も安い |
| N面・斜め壁・多角形 | `computeFaces` が返す FaceDescriptor 配列を拡張（プリセットが配列を直接返す形に昇格） |
| 設定の保存/共有 | Store が既にシリアライズ可能。`JSON.stringify`→ファイル/URLハッシュ。sources は name で再リンク |
| PC操作→HMD鑑賞のリモート同期 | Action を WebSocket で中継するだけ（Storeの設計がそのまま同期プロトコルになる） |

## 5. Codex向け実装上の注意（ハマりどころ）

1. **WebXRはHTTPS必須**（localhostは例外）。HMD実機テストは `@vitejs/plugin-basic-ssl` + `vite --host`。証明書警告はHMDブラウザで手動許可。
2. **動画の自動再生**: `muted` + ユーザージェスチャ起点で `play()`。VRButtonクリックが丁度良いジェスチャになる。
3. **blob URLはデバイスをまたげない**（PCで選んだファイルはHMDに持ち込めない）。ただしQuest Browser上で `<input type="file">` からQuest内ストレージの動画を選べば、blob URLはそのまま使える（§2.6.1のフロー）。`public/media/` 配信の `url` ソースは開発テスト用の補助扱い。
4. **VideoTexture設定**: `colorSpace = SRGBColorSpace` / `generateMipmaps = false` / `minFilter = LinearFilter`。忘れると色が浅くなる・パフォーマンスが落ちる。
5. **texture.clone() は image を共有する**（デコードは増えない）。ただし `needsUpdate = true` を忘れない。offset/repeat はclone毎に独立に設定できる。
6. **シーク要求は `seekRequest.seq` で冪等に**: Storeに「現在時刻」を書き続けるとレンダラとの循環更新になる。UI→Store は要求のみ、進行時刻の表示は MediaManager から直接読む（Storeを毎フレーム更新しない）。
7. **ジオメトリ再構築時のリーク**: 面の削除時に `geometry.dispose()` / `material.dispose()` / `texture.dispose()`（ただし共有textureは参照カウントに注意。MediaManagerがtextureも管理すると安全）。
8. 天井のUV反転（CSS版 `scaleX(-1)` 相当）は**Phase 1で目視確認して規約を確定**し、コメントで根拠を残すこと。
