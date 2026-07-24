# コーディング規約（coding-standards）

> yahoo-auction-image-maker のコーディング規約。ブラウザ完結（HTML + CSS + Vanilla JS + Canvas）。
> 新しいルールを決めたら随時追記する。

## 技術スタック

- **ブラウザ完結**: HTML + CSS + Vanilla JavaScript（フレームワーク不要でも可）
- **画像処理**: Canvas 2D API（`<canvas>` + `getContext('2d')`）
- **ビルド不要**: 静的ファイルのみ。GitHub Pages でそのまま公開できる構成にする
- **依存を増やさない**: 有料・重い外部ライブラリは入れない（無料運用の原則）
- 外部 CDN に頼りすぎない（オフラインでも動くのが理想）

## ファイル構成（初期案）

```
index.html        ← エントリ（UI）
css/style.css      ← スタイル
js/main.js         ← 画面制御・イベント
js/renderer.js     ← Canvas 描画・正方形化ロジック
js/presets.js      ← プリセット定義（帯・バッジ）
assets/            ← ロゴ・アイコン等
```
※ 規模が小さいうちは 1 ファイルでも可。肥大化したら分割する。

## 命名規則

- 変数・関数: `camelCase`
- 定数: `UPPER_SNAKE_CASE`
- クラス/コンストラクタ: `PascalCase`
- ファイル名: `kebab-case` または `lowerCamel`（統一する）
- 意味のある名前を付ける（`x1`,`tmp` 等は避ける）

## 高解像度・画質の鉄則（最優先）

- Canvas の `width`/`height` は **元画像の実ピクセル基準** で設定する。CSS の表示サイズと混同しない。
- `ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';`
- 出力は `canvas.toBlob(cb, 'image/png')`（可逆・劣化なし）。JPEG は避ける。
- 文字・帯も高解像度 Canvas 上で直接描画し、後から拡大しない。
- 元画像は劣化させず保持し、加工は Canvas 上で行う。

## Canvas 描画の指針

- 描画順: 背景（帯）→ 写真 → バッジ・文字 → ロゴ、の順で重なりを管理
- 座標・サイズは出力サイズ `S` に対する比率で計算し、解像度非依存にする
- フォントは `ctx.font` にピクセル指定。`textAlign`/`textBaseline` を明示
- はみ出し対策: 文字幅を `measureText` で測り、必要なら縮小/改行

## UI の指針

- スタッフが迷わないよう、操作はボタン中心・手順は最小
- プリセットは選択式（チェックボックス/ボタン）。自由入力は最小限
- プレビューを常時表示し、ダウンロード前に結果を確認できるようにする

## コメント

- 自明なコードにはコメント不要
- 計算ロジック（帯高さ・座標）や画質維持のための処理には「なぜ」を書く

## Git

- 大きな変更前にコミット
- コミットメッセージは変更内容を正確に
- 破壊的コマンドはユーザー確認必須
