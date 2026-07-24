# バグ再発防止台帳（error-catalog）

> 発生したバグと修正・再発防止策を記録する台帳。
> バグを修正したら必ずここに追記すること（SPEC.md と二重の再発防止）。
> 実装前・修正前にこの台帳を読み、同じ轍を踏まないこと。

## 記録フォーマット

```
### [YYYY-MM-DD] バグの短いタイトル
- 症状: どういう不具合だったか
- 原因: 根本原因
- 修正: 何をどう直したか（file:line）
- 再発防止: 今後どう防ぐか / チェック項目
```

## よくある想定リスク（着手前チェック用）

このプロジェクトで特に注意すべきポイント（実際に起きたら上に正式記録する）:

- 画質劣化: Canvas を表示サイズで作ってしまい出力がぼやける
  → 元画像の実ピクセルで Canvas を作る
- 画質劣化: JPEG 出力にしてしまい劣化する → PNG で出力する
- 正方形にならない: 帯高さの計算ミスで 1:1 にならない
- 写真の歪み: 16:9 を無理に伸縮して比率が崩れる → アスペクト比保持
- 文字はみ出し: 長いキャッチコピー/値でバッジからはみ出る → measureText で調整
- バッジ崩れ: 選択数が多い/少ないときにレイアウトが破綻する
- 無料原則違反: 外部 API/有料サービス/外部送信が混入する

---

## 記録

### [2026-07-24] file:// で開くとロゴのcanvas taintで描画が全く出ない
- 症状: 配布ZIPを解凍し `index.html` をダブルクリック（file://）で開くと、写真を選んでもプレビューが生成されない（placeholderのまま・ダウンロード無効）。HTTPサーバー経由では正常。
- 原因: `getProcessedLogo` の `getImageData`（ロゴ輝度→アルファ変換）で、file:// から読み込んだ `assets/logo.png` が「別オリジン（null origin）」扱いになり canvas が汚染（taint）。SecurityError を投げ `renderSquare` が例外終了 → render() が途中で止まり canvas が表示されない。
- 修正:
  - ロゴを base64 データURIで埋め込み（`js/logo-data.js` の `window.LOGO_DATA_URL`）、`index.html` で最初に読込。`js/main.js` preloadLogo は `window.LOGO_DATA_URL || 'assets/logo.png'`。データURIは同一オリジン扱いで canvas を汚染しない。
  - `js/renderer.js` `getProcessedLogo`: `getImageData` を try/catch し、失敗時は null を返す。`drawTopBand` は logo が null ならロゴをスキップ（描画全体は止めない）。
- 再発防止:
  - **オフライン/ローカル配布するアプリで getImageData / toBlob / toDataURL を使う画像は、外部ファイル参照ではなく base64 データURIで埋め込む**（file:// の cross-origin taint 回避）。
  - 検証は HTTP サーバーだけでなく、**配布ZIPを解凍して file:// でも動作確認する**こと。
  - canvas のピクセル読み取り処理は try/catch で保護し、失敗しても画面全体を巻き添えにしない。
