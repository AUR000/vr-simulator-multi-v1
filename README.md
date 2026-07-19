# 多面モニターシミュレーター WebXR版

実寸（mm）で指定した多面スクリーン空間を Three.js で表示し、同じシーンをデスクトップと WebXR で確認できるシミュレーターです。個別動画と、左右壁・正面壁を1本の動画でつなぐ連続表示に対応しています。配布ビルドは Three.js を含む単一HTMLです。

## 開発コマンド

```sh
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

QuestからLAN内の開発サーバへ接続する場合は、HTTPSを有効にして全インターフェースで起動します。

```powershell
$env:HTTPS='1'
npx vite --host
```

Quest Browserで証明書警告を許可し、表示されたPCのIPアドレスのURLを開いてください。

## 全球／半球シミュレーター

360度の全球表示と、equirect動画の上半分を使う半球（ドーム）表示を切り替えて、内側／外側から確認できます。半径、中心高さ、ガイド、地面表示も調整できます。

開発時は `npm run dev` を起動し、`/dome.html` を開きます。公開用の単一HTMLは次のコマンドで `docs/dome/index.html` に生成します。ルートの多面版 `docs/index.html` には影響しません。

```sh
npm run build:dome
```

## 水族館案件向け3面専用版

正面・右側面・床面を水族館プリセット（W6000 × H2700 × D4187.5mm）に固定し、案件相手へそのまま渡せるよう操作UIを簡素化した専用版です。公開先は別リポジトリ `vr-simulator-three-v1` です。

開発時は `npm run dev` を起動して `/aquarium.html` を開きます。配布用の単一HTMLは次のコマンドで `dist-aquarium/index.html` に生成します。

```sh
npm run build:aquarium
```

Questでは、HTTPSで公開した `/dome/` をQuest Browserで開き、Quest本体に保存したequirect動画を画面上で選択してから「ENTER VR」で入場します。VR中は `local-floor` を基準に球の中心直下へ立ち、視点はヘッドセットの姿勢に従います。画面上の内側／外側ビュー設定はVR中には適用されません。

VR内では、左右いずれかのトリガーで再生／停止、右スティック左右で10秒シーク、左右いずれかのグリップで現在の水平位置を中心にリセットできます。Quest Browserのデコード負荷を考慮し、実機では4K〜5.7Kのequirect動画を推奨します（デスクトップではGPU次第で8Kも利用できます）。

## Quest実機での使い方

1. `npm run build` で生成した単一HTMLを、HTTPS対応の静的ホスティングへ配置します。WebXRはセキュアコンテキストが必要なため、`file://` での直開きはできません。
2. 使用する動画をUSB転送などでQuest本体ストレージへ入れます。
3. Quest Browserで配置先URLを開き、画面のファイル選択からQuest内の動画を選び、各面または連続表示へ割り当てます。
4. 「ENTER VR」ボタンでVRへ入場します。

日常利用の基本フローは「URLを開く → 動画を選ぶ → VR入場」です。PCで作成したblob URLはQuestへ引き継げないため、動画選択はQuest Browser上で行ってください。

## VR内操作

- 左右どちらかのトリガー: 再生／停止
- 右スティック左: 10秒戻る
- 右スティック右: 10秒進む
- 左右どちらかのグリップ: 現在の水平位置を部屋中央として視点をリセット

スティック操作は一度中立へ戻すまで再入力されません。シーク位置は0秒から動画の長さの範囲に収まります。ハンドトラッキングなど、gamepadを提供しない入力はスティック操作の対象外です。

## Phase 4 拡張の受け口

- エッジブレンド: `createFaceMaterial` の ShaderMaterial 化と、FaceDescriptorへのブレンド設定追加
- レンズ歪み: 面ごとのRenderTarget描画と歪みメッシュ
- LEDベゼル／タイル: FaceDescriptorへのグリッド設定とシェーダ処理
- N面・斜め壁・多角形: `computeFaces` が返すFaceDescriptor配列の拡張
- 設定保存／共有: シリアライズ可能なStoreをJSONファイルまたはURLハッシュへ出力
- PC操作とHMD鑑賞の同期: StoreのActionをWebSocketで中継

既存のCSS版は `legacy/` に凍結されています。
