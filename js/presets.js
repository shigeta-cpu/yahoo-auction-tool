// プリセット定義（帯・バッジ）
// ※ 現時点の内容は暫定。ユーザー承認を得ながら data-contracts / SPEC.md と同期して確定していく。
// アイコン方式: 絵文字（無料・オフライン・追加素材不要）を暫定採用。

// 上帯（ロゴ帯）プリセット
// key: 内部キー / label: UI表示名 / logo: C.L.LINKロゴを表示するか / text: ロゴ右のブランド名 / bg: 帯背景色 / fg: 文字色
const TOP_PRESETS = [
  { key: 'brand', label: 'ロゴ＋ジムニーリユースパーツ', logo: true, text: 'ジムニーリユースパーツ', bg: '#ffd200', fg: '#1a1a1a' },
  { key: 'none', label: '（上帯なし）', logo: false, text: '', bg: '#ffffff', fg: '#1a1a1a' },
];

// 下帯（バッジ帯）カテゴリ定義
// 項目ごとに選択する UI にして選択漏れを防ぐ。マークは使わずテキストのみで構成し、
// 文字サイズの強弱でデザイン性・視認性を高める（描画は renderer.js / spec は main.js が生成）。
//
// type:
//   single … 択一（表示しない可）
//   multi  … 複数選択（max 個まで）。選択型式を 1 バッジに集約
//   forced … 全商品強制表示（常に ON・非トグル）
//   toggle … ON/OFF（その他バッジ）
const MODEL_OPTIONS = ['JA11', 'JB31', 'JA22', 'JB32', 'JB23', 'JB33', 'JB43', 'JB64', 'JB74', 'JC74', '汎用'];
const YEAR_OPTIONS = ['2027年', '2026年', '2025年', '2024年', '2023年', '2022年'];

// バッジ表示順（左→右。5個未満は全体をセンター寄せ）
const BADGE_CATEGORIES = [
  { key: 'condition', label: '状態',        group: 'main',  type: 'single', options: ['中古', '未使用', 'アウトレット', '新品'] },
  { key: 'rank',      label: 'ランク',      group: 'main',  type: 'single', options: ['SS', 'S', 'A', 'B', 'C', 'D'] },
  { key: 'tire',      label: 'タイヤの種類', group: 'main',  type: 'single', options: ['サマー', 'スタッドレス'] },
  { key: 'year',      label: '製造年数',    group: 'main',  type: 'multi',  max: 4, options: YEAR_OPTIONS },
  { key: 'model',     label: '適合型式',    group: 'main',  type: 'multi',  max: 4, options: MODEL_OPTIONS },
  { key: 'guarantee', label: '保証付',      group: 'main',  type: 'forced' },
  { key: 'bihin',     label: '美品',        group: 'other', type: 'toggle' },
  { key: 'barimizo',  label: 'バリ溝',      group: 'other', type: 'toggle' },
];

const BADGE_MAX_SLOTS = 5; // 固定サイズは 5 個基準。超過時は自動縮小して収める。

// バッジのカテゴリ別ベースカラー（★暫定）。
// 参考画像（美品=紫/バリ溝=紫/夏タイヤ=橙/ランク=銀/本数=紺・フラット塗り）との
// 類似クレームを避けるため、配色を変え、描画は光沢グラデ（renderer.js）で質感を差別化する。
const BADGE_COLORS = {
  condition: '#0f9d8f', // 状態     … ティール
  rank:      '#c0392b', // ランク   … クリムゾン（参考=銀と差別化）
  tire:      '#2563c9', // タイヤ   … ロイヤルブルー（参考=橙と差別化）
  year:      '#8e44ad', // 製造年数 … アメジスト（他カテゴリと差別化）
  model:     '#5b4bc4', // 適合型式 … インディゴ
  guarantee: '#1f9a4d', // 保証付   … グリーン（信頼色）
  bihin:     '#c2317f', // 美品     … マゼンタ（参考=紫から寄せすぎない）
  barimizo:  '#e08a1e', // バリ溝   … アンバー
};

// export（module 不使用・グローバル参照）
window.PRESETS = { TOP_PRESETS, BADGE_CATEGORIES, MODEL_OPTIONS, YEAR_OPTIONS, BADGE_MAX_SLOTS, BADGE_COLORS };
