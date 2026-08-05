# 3面シミュレーター PVプレビュー版（クライアント向け） — 設計書

- 設計: Claude (Opus 5) / 実装: Codex
- 位置づけ: 既存3面版 `aquarium.html` の**派生**。既存アプリ（multi / dome / aquarium）は一切変更しない
- 目的: 水族館案件のクライアントにPVをVRで体験してもらう。**操作は最小**、URLを開いて再生ボタン1つ

---

## 1. 要件

### 体験フロー（これを壊さない）
1. Quest Browser でURLを開く
2. 画面中央に **「▶ 体験をはじめる」ボタン1つ**だけが表示されている
3. 押す → VRに入場 → 動画が自動再生される
4. 客席位置（部屋の中央手前）に立つと、3面LEDに映像が展開している

### 制作用UIは一切出さない
- ファイル選択、寸法入力、境界線、人物表示、モード切替、視点スライダー、シークバー——**すべて非表示**
- 表示していいのは「体験をはじめる」ボタン（＋VR非対応環境向けの案内文）のみ

### 動画は最初から組み込み
- ファイル選択なし。ページ読み込み時に指定URLの動画を自動でロード
- **動画URLは1箇所の定数で差し替えられる**こと（後述 §3）

---

## 2. レイアウト（既存3面版と同一。変更禁止）

確定仕様（aquarium-display-spec / ディレクター2026-07-26）:

| 面 | 物理寸法 | 実画素 | 配置 |
|---|---|---|---|
| 側面 side | W4,200 × H2,700 mm | 2688×1728 (14:9) | **左** |
| 正面 front | W6,000 × H2,700 mm | 3840×1728 (20:9) | **右** |
| 床面 floor | W6,000 × D4,200 mm | 3840×2688 | 手前 |

- 壁面連続 = 34:9（側面+正面を1本の動画で分割表示）
- 既存 `src/state/presets.ts` / `src/scene/faces.ts` / `RoomView` をそのまま流用すること（座標・UV計算を書き直さない）

---

## 3. 動画ソースの構成

### 入力形式（当面）
**壁面連続（34:9）1本 + 床面1本の、計2本**を想定する。既存の span モード + floor 割り当てと同じ構造。

```ts
// src/pv/config.ts — ここだけ書き換えれば差し替えできる
export const PV_SOURCES = {
  /** 壁面連続 34:9（側面+正面）。相対パス or 絶対URL */
  wall: './media/pv-wall-34x9.mp4',
  /** 床面 */
  floor: './media/pv-floor.mp4',
};
/** 動画の配信元がCORSを要する場合 true（同一オリジンなら false のままでよい） */
export const USE_CROSSORIGIN = false;
```

**将来の①統合アトラス版（DESIGN-ATLAS、別途）に差し替えやすいよう、ソース定義はこのファイルに集約すること。**

### 解像度・フレームレート（確定要件）
**4K相当・60fps の高解像度出力を維持する。** 各面の目標画素は確定仕様どおり:
- 壁面連続 34:9 = **6528×1728**（側面2688 + 正面3840）
- 床面 = **3840×2688**
- H.264 / 60fps

実装上の含意（Codexは以下を守ること）:
- **デコード負荷**: Quest3 は H.264 4K/60fps を概ね2本まで同時デコードできる。壁+床の2本構成はこの上限に近いため、**余計な video 要素を生成しない**こと（未使用ソースを acquire しない／複製再生しない）。既存 MediaManager の span モードは1本のVideoTextureをUV分割する実装なので、その利点を必ず活かす
- **テクスチャ上限**: 壁面 6528px は Quest の WebGL 最大テクスチャ 8192px 以内で収まる。これを超える解像度に上げないこと
- 既存の4K品質設定（anisotropy 16 / framebufferScaleFactor 1.0 / foveation 0）はそのまま継承する

### 配信元についての実装上の注意（重要）
- **Google Drive の共有リンクは使用不可**（HTMLページを返すため `<video>` で再生できない）。同一オリジン配信 or 直リンク可能なストレージ（Cloudflare R2 等）を前提にする
- 相対パス（同一オリジン）が最も確実。GitHub Pages 同梱の場合は `./media/...` に置く
- 外部ホストを使う場合のみ `USE_CROSSORIGIN = true` にし、`video.crossOrigin = 'anonymous'` を設定する（WebGLテクスチャに使うため必須）
- **4K/60fps 2本はファイルが大きい**（尺次第で数百MB〜GB級）。GitHubの1ファイル100MB制限を超える公算が高いため、外部ストレージ配信を前提に設計しておくこと（`config.ts` のURLを絶対URLに変えるだけで切り替わる構造を守る）
- 大容量ストリーミング時の途切れ対策として、`video.preload = 'auto'` を維持し、開始画面で `readyState >= 3` を待ってからボタンを活性化する（§4.3）

---

## 4. 実装仕様

### 4.1 ファイル構成（新規のみ。既存は触らない）

```
vr-simulator/
  pv.html                 // 新規エントリ
  vite.pv.config.ts       // 新規（vite.aquarium.config.ts と同型）
  src/pv/
    main.ts               // 配線
    config.ts             // 動画URL定数（§3）
    startScreen.ts        // 「▶ 体験をはじめる」オーバーレイUI
```

- `package.json` に `"build:pv": "tsc && vite build --config vite.pv.config.ts"` を追加
- `vite.pv.config.ts` の `outDir` は **`dist-pv`**（docs/ には出力しない。公開は別リポジトリ想定）
- `public/` は使わない設定のため、動画同梱が必要な場合は別途 §6 で扱う

### 4.2 main.ts の構成

`src/aquarium/main.ts` を土台にするが、以下を変更:

- **createPanel は使わない**。代わりに `startScreen.ts` のオーバーレイのみ
- store の初期状態:
  - params: 3面確定仕様（W6000 / H2700 / D4200、faces = front+left+floor）
  - **mode: `'span'`**（壁面連続で固定。切替UIなし）
  - showPeople: **false**（クライアント向けなので人物シルエットは出さない。※出したい場合は §7 の判断ポイント参照）
- 起動時に `PV_SOURCES` から MediaSource を生成して dispatch:
  - `{ id:'pv-wall', kind:'url', url: PV_SOURCES.wall, content:'video' }` → `assign/span`
  - `{ id:'pv-floor', kind:'url', url: PV_SOURCES.floor, content:'video' }` → `assign/face: 'floor'`
- 既存の `setupXrSession` / `setupXrControllers` はそのまま使う（4K品質設定も継承される）
- 非XR時の視点は OrbitControls（既存 `createViewControls`）でよいが、**デスクトップでも見られる保険**として残す

### 4.3 startScreen.ts の仕様

```ts
export function createStartScreen(opts: {
  onStart: () => void;          // 押されたら呼ぶ
  vrSupported: boolean;         // navigator.xr の判定結果
}): { setLoading(pct: number | null): void; hide(): void; dispose(): void };
```

- 画面全面を覆う暗いオーバーレイ（既存ダークテーマ準拠 `#0a0e14`）
- 中央に大きなボタン「**▶ 体験をはじめる**」
- **動画のプリロード状況**を簡易表示（「読み込み中…」→ 準備できたらボタン活性化）。`video.readyState >= 3`(HAVE_FUTURE_DATA) を目安にする
- VR非対応環境（PCブラウザ等）の場合は、ボタン文言を「▶ 再生（PCプレビュー）」に変え、押下時はVR入場せず再生のみ行う
- 押下後はオーバーレイを隠す

### 4.4 開始シーケンス（自動再生ポリシー対策：重要）

ブラウザは**ユーザー操作なしの音付き再生を禁止**する。ボタン押下という「ユーザージェスチャ」の中で必ず再生を開始すること。

```
ボタン押下（ユーザージェスチャ内）
  ├─ 1) 全 video 要素に対して play() を呼ぶ（await しない、catch する）
  ├─ 2) VR対応なら VRButton 相当の処理でXRセッション開始
  └─ 3) オーバーレイを隠す
```

- 既存の `setupXrSession` は three の `VRButton` を DOM に追加する実装になっている。**PV版ではその標準ボタンは非表示にし（CSSで `display:none`）、自前の「体験をはじめる」ボタンから同じ入場処理を呼ぶ**こと
  - 実装方法: `VRButton.createButton()` が返す要素を隠したまま保持し、開始ボタン押下時に `.click()` を発火させる（最小改修で確実）
  - もしくは `navigator.xr.requestSession('immersive-vr', { requiredFeatures:['local-floor'] })` を自前で呼び、`renderer.xr.setSession()` に渡す
- **音声**: PVに音声がある場合、壁面動画をミュート解除して再生する（既存 MediaManager の音声代表1本の仕組みに従う）。初期状態は `muted: false` とするが、自動再生失敗時のフォールバックとして「ミュートで再生 → 押下で解除」は不要（ジェスチャ内起動なので問題ない）

### 4.5 ループ再生
- PV終了後もそのまま鑑賞できるよう **loop 再生**（既存 MediaManager は `video.loop = true` 済み）

### 4.6 VR内操作
- 既存 `setupXrControllers` をそのまま接続（トリガー=再生/停止、右スティック=±10秒シーク、グリップ=位置リセット）
- クライアントが誤操作しても復帰できるよう**グリップの位置リセットは必ず有効にしておく**

---

## 5. 品質確認（Codexはこれを全て通すこと）

- `npx tsc --noEmit` 通過
- `npm test` 全通過（既存17件を壊さない）
- `npm run build` / `build:dome` / `build:aquarium` がすべて従来通り成功
- `npm run build:pv` 成功 → `dist-pv/index.html` が単一ファイルで生成される
- `docs/index.html` が変更されないこと
- **既存の `src/main.ts` / `src/ui/` / `src/dome/` / `src/aquarium/` / `src/scene/` / `src/media/` / `src/state/` を変更しないこと**（PV版は追加のみで実装する。どうしても共有モジュールの変更が必要な場合は、後方互換を保ち既存テスト全通過を条件とする）
- `npx vite` の dev サーバで `/pv.html` が開けること

---

## 6. 動画の配置（実装後の運用）

**配信先は未確定。** 4K/60fpsのため各ファイルは確実に100MB超で、GitHub同梱は不可。
よって `src/pv/config.ts` の**URL定数を差し替えるだけで、どの配信方式にも切り替えられる**ことを設計上の必須要件とする。

想定される切り替え先（いずれも `config.ts` の変更のみで対応できること）:
1. **外部ストレージ直リンク**（Cloudflare R2 等）→ 絶対URL + `USE_CROSSORIGIN = true`
2. **ローカルPCのHTTPS配信**（同一LAN）→ `https://<PCのIP>:5173/media/...` の絶対URL
3. **同一オリジン配信** → `./media/xxx.mp4` の相対パス（`USE_CROSSORIGIN = false`）

Codexへの指示: 上記3方式すべてが**コード変更なし（config.tsの文字列変更のみ）**で成立するよう実装すること。`crossOrigin` の設定有無も `USE_CROSSORIGIN` フラグで一元制御する。

---

## 7. 判断が要るポイント（実装前に確認済み/未確認）

| 項目 | 状態（2026-07-29 確定） |
|---|---|
| 動画の配信元 | **Cloudflare R2**（直リンク配信・CORS設定必要 → `USE_CROSSORIGIN = true`） |
| 人物シルエット表示 | **表示する**（クライアントにスケール感を伝えるため `showPeople: true`） |
| 音声 | **あり**（§4.4 のジェスチャ内起動で音付き再生。`muted: false`） |
| 壁面/床の入力形式 | 当面は「34:9連続 + 床」の2本。統合アトラス版ができたら `config.ts` を差し替える |
