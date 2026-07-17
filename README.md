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
