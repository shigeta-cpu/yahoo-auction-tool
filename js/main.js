// 画面制御・イベント
(function () {
  const { TOP_PRESETS, BADGE_CATEGORIES, BADGE_MAX_SLOTS, BADGE_COLORS } = window.PRESETS;
  const { renderSquare } = window.RENDERER;

  // DOM 参照
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const fileName = document.getElementById('fileName');
  const topPresetList = document.getElementById('topPresetList');
  const badgeList = document.getElementById('badgeList');
  const downloadBtn = document.getElementById('downloadBtn');
  const canvas = document.getElementById('previewCanvas');
  const placeholder = document.getElementById('placeholder');
  const sizeInfo = document.getElementById('sizeInfo');

  // 状態
  const state = {
    image: null,                 // 読み込み済み Image（元画像を保持・劣化させない）
    logoImage: null,             // C.L.LINK ロゴ（上帯用にプリロード）
    topKey: TOP_PRESETS[0].key,   // 選択中の上帯キー
    bottom: {
      condition: null,           // '中古' | '未使用' | null
      rank: null,                // 'A' | 'B' | 'C' | null
      tire: null,                // 'サマー' | 'スタッドレス' | null
      model: [],                 // 適合型式（最大4）
      guarantee: true,           // 保証付（全商品強制・常時ON）
      bihin: false,              // 美品
      barimizo: false,           // バリ溝
    },
  };

  // ロゴをプリロード（読み込み完了後、写真があれば再描画）
  // file:// で直接開いても canvas taint が起きないよう、埋め込み base64（logo-data.js）を優先。
  // 無い場合のみ外部ファイルにフォールバック。
  (function preloadLogo() {
    const logo = new Image();
    logo.onload = () => { state.logoImage = logo; if (state.image) render(); };
    logo.src = window.LOGO_DATA_URL || 'assets/logo.png';
  })();

  // ---- UI 構築 ----

  // 上帯（ラジオ選択）
  function buildTopPresets() {
    topPresetList.innerHTML = '';
    TOP_PRESETS.forEach((p) => {
      const label = document.createElement('label');
      label.className = 'choice' + (p.key === state.topKey ? ' selected' : '');
      label.innerHTML = `
        <input type="radio" name="topPreset" value="${p.key}" ${p.key === state.topKey ? 'checked' : ''}>
        <span>${p.label}</span>`;
      label.querySelector('input').addEventListener('change', () => {
        state.topKey = p.key;
        buildTopPresets();
        render();
      });
      topPresetList.appendChild(label);
    });
  }

  // 選択肢ボタンを生成
  function makeOptBtn(text, active, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt-btn' + (active ? ' active' : '');
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // 1 カテゴリの選択ブロックを生成
  function buildCategory(cat) {
    const b = state.bottom;
    const block = document.createElement('div');
    block.className = 'cat';

    const head = document.createElement('div');
    head.className = 'cat-label';
    head.textContent = cat.label;
    block.appendChild(head);

    const opts = document.createElement('div');
    opts.className = 'opt-list';

    if (cat.type === 'single') {
      cat.options.forEach((v) => {
        opts.appendChild(makeOptBtn(v, b[cat.key] === v, () => {
          b[cat.key] = (b[cat.key] === v) ? null : v; // もう一度押すと解除
          buildBottom(); render();
        }));
      });
      opts.appendChild(makeOptBtn('表示しない', b[cat.key] === null, () => {
        b[cat.key] = null; buildBottom(); render();
      }));

    } else if (cat.type === 'multi') {
      const sel = b[cat.key];
      cat.options.forEach((v) => {
        const active = sel.includes(v);
        opts.appendChild(makeOptBtn(v, active, () => {
          if (active) {
            b[cat.key] = sel.filter((x) => x !== v);
          } else if (sel.length < cat.max) {
            b[cat.key] = sel.concat(v);
          } else {
            return; // 上限（max）に達したら追加しない
          }
          buildBottom(); render();
        }));
      });
      const note = document.createElement('div');
      note.className = 'cat-note';
      note.textContent = `複数選択可（最大${cat.max}個）／選択中 ${sel.length}個`;
      block.appendChild(opts);
      block.appendChild(note);
      return block;

    } else if (cat.type === 'forced') {
      const badge = document.createElement('div');
      badge.className = 'forced-tag';
      badge.textContent = '全商品に常時表示（ON固定）';
      block.appendChild(badge);
      return block;

    } else if (cat.type === 'toggle') {
      opts.appendChild(makeOptBtn(cat.label, b[cat.key], () => {
        b[cat.key] = !b[cat.key]; buildBottom(); render();
      }));
    }

    block.appendChild(opts);
    return block;
  }

  // 下帯 UI（項目ごとに選択）を構築
  function buildBottom() {
    badgeList.innerHTML = '';
    // メイングループ
    BADGE_CATEGORIES.filter((c) => c.group === 'main').forEach((c) => {
      badgeList.appendChild(buildCategory(c));
    });
    // その他グループ
    const others = BADGE_CATEGORIES.filter((c) => c.group === 'other');
    if (others.length) {
      const heading = document.createElement('div');
      heading.className = 'cat-group-heading';
      heading.textContent = 'その他';
      badgeList.appendChild(heading);
      others.forEach((c) => badgeList.appendChild(buildCategory(c)));
    }
  }

  // 状態から描画用バッジ仕様(lines)を生成。表示順=左→右（5個未満は描画側で右詰め）。
  function collectBadges() {
    const b = state.bottom;
    const C = BADGE_COLORS;
    const out = [];
    if (b.condition) out.push({ color: C.condition, lines: [{ t: '状態', r: 0.16, w: '600' }, { t: b.condition, r: 0.30, w: '800' }] });
    if (b.rank) out.push({ color: C.rank, lines: [{ t: 'ランク', r: 0.16, w: '600' }, { t: b.rank, r: 0.52, w: '900' }] });
    if (b.tire) out.push({ color: C.tire, lines: [{ t: 'タイヤ', r: 0.16, w: '600' }, { t: b.tire, r: 0.24, w: '800' }] });
    if (b.model.length) {
      const c = b.model.length;
      const mr = c === 1 ? 0.34 : c === 2 ? 0.24 : c === 3 ? 0.19 : 0.16;
      const lines = [{ t: '適合型式', r: 0.15, w: '600' }];
      b.model.forEach((m) => lines.push({ t: m, r: mr, w: '800' }));
      out.push({ color: C.model, lines });
    }
    if (b.guarantee) out.push({ color: C.guarantee, lines: [{ t: '全商品', r: 0.15, w: '600' }, { t: '保証付', r: 0.30, w: '800' }] });
    if (b.bihin) out.push({ color: C.bihin, lines: [{ t: '美品', r: 0.36, w: '800' }] });
    if (b.barimizo) out.push({ color: C.barimizo, lines: [{ t: 'バリ溝', r: 0.30, w: '800' }] });
    return out;
  }

  // ---- 描画 ----
  function render() {
    if (!state.image) return;
    const topPreset = TOP_PRESETS.find((p) => p.key === state.topKey);
    const badges = collectBadges();
    renderSquare(canvas, state.image, { topPreset, badges, logoImage: state.logoImage });
    canvas.style.display = 'block';
    placeholder.style.display = 'none';
    downloadBtn.disabled = false;
    let info = `出力サイズ: ${canvas.width} × ${canvas.height} px（PNG）`;
    if (badges.length > BADGE_MAX_SLOTS) {
      info += `　※バッジ${badges.length}個（5個超のため自動縮小して表示）`;
    }
    sizeInfo.textContent = info;
  }

  // ---- 画像読み込み ----
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('画像ファイルを選んでください');
      return;
    }
    fileName.textContent = file.name;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      state.image = img;
      // 16:9 から大きくずれていたら警告（切り抜きで対応する旨）
      const ratio = img.naturalWidth / img.naturalHeight;
      if (Math.abs(ratio - 16 / 9) > 0.2) {
        console.warn(`元画像の比率が 16:9 から外れています（${ratio.toFixed(2)}）。中央基準で切り抜きます。`);
      }
      render();
    };
    img.onerror = () => alert('画像を読み込めませんでした');
    img.src = url;
  }

  // ---- イベント ----
  fileInput.addEventListener('change', (e) => loadFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });

  downloadBtn.addEventListener('click', () => {
    // PNG（可逆・劣化なし）で出力
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      a.download = `yahoo-auction-${stamp}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  });

  // 初期化
  buildTopPresets();
  buildBottom();
})();
