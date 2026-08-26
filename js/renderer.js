// Canvas 描画・正方形化ロジック
// 画質の鉄則: Canvas は元画像の実ピクセル基準。座標は出力 1 辺 S に対する比率で計算し解像度非依存。

// レイアウト比率（S に対する割合）— 暫定値。目視で調整して data-contracts に確定記録する。
// 上帯はロゴ帯として細く（参考画像準拠）。減らした分は写真部に回し 1:1 を維持（写真は cover 描画）。
const LAYOUT = {
  TOP_BAND_RATIO: 0.114,    // ブランド帯画像(4000x456・左寄せ短縮版)のアスペクト比に一致（歪みゼロ）
  BOTTOM_BAND_RATIO: 0.21,  // 正方形バッジ（5個固定サイズ）が収まる高さ
  // 写真部 = 1 - TOP - BOTTOM（renderSquare で算出）
};

// 写真領域のジオメトリ（S に対する固定比率）を算出。ドラッグ操作の座標計算にも共用する。
function computeLayout(S) {
  const topH = Math.round(S * LAYOUT.TOP_BAND_RATIO);
  const bottomH = Math.round(S * LAYOUT.BOTTOM_BAND_RATIO);
  const photoH = S - topH - bottomH;
  return { S, topH, bottomH, photoH, photo: { y: topH, h: photoH } };
}

// 初期表示の view（全体表示=contain・中央配置）を返す。
// view = { base, scale, cx, cy }
//   base : 全体が収まる基準倍率（スライダー1.0の位置）
//   scale: 実際の描画倍率（= base * ズーム）
//   cx,cy: 画像中心の canvas 座標（ドラッグ移動で変化）
function getDefaultView(img, S) {
  const L = computeLayout(S);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.min(L.S / iw, L.photoH / ih); // 全体が収まる倍率
  return { base, scale: base, cx: L.S / 2, cy: L.photo.y + L.photoH / 2 };
}

// 写真を view（倍率・中心位置）で写真領域に描く。領域を白で埋め、はみ出しは領域にクリップする。
// どんなサイズ・比率でも、ユーザーがドラッグ移動＋拡大縮小した通りに描画し、
// 領域外にはみ出した部分は出力（正方形）でも同様に切り取られる。歪めない。
function drawPhoto(ctx, img, region, view, bg) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.w, region.h);
  ctx.clip();
  ctx.fillStyle = bg || '#ffffff';
  ctx.fillRect(region.x, region.y, region.w, region.h);
  const dw = img.naturalWidth * view.scale;
  const dh = img.naturalHeight * view.scale;
  ctx.drawImage(img, view.cx - dw / 2, view.cy - dh / 2, dw, dh);
  ctx.restore();
}

// 角丸矩形パス
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 帯背景（ベタ塗り）
function drawBand(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// はみ出し防止: 指定最大幅に収まるフォントサイズを二分探索的に縮小して返す
function fitFontSize(ctx, text, fontFamily, maxWidth, startSize, weight) {
  let size = startSize;
  const minSize = Math.max(8, startSize * 0.4);
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

const FONT_FAMILY = '"Hiragino Sans", "Yu Gothic", "Meiryo", system-ui, sans-serif';

// #rrggbb を量 amt(-1..1) で明暗調整（+で白へ寄せ / -で黒へ寄せ）。光沢グラデの生成に使う。
function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    const k = 1 + amt;
    r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
  }
  return `rgb(${r},${g},${b})`;
}

// 黒ロゴ（白背景）を「透過した黒ロゴ」に変換し、周囲の余白をトリミングしてキャッシュする。
// 輝度→アルファ変換: 白(明)=透明 / 黒(暗)=不透明。黄色帯に直接ロゴを乗せられる。
function getProcessedLogo(logoImg) {
  if (logoImg._processed) return logoImg._processed;
  const w = logoImg.naturalWidth, h = logoImg.naturalHeight;
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sctx = src.getContext('2d');
  sctx.drawImage(logoImg, 0, 0);
  // canvas が汚染（別オリジン画像）だと getImageData が例外。失敗しても描画全体は止めず
  // ロゴをスキップする（null を返す）。埋め込み base64 なら通常発生しない。
  let data;
  try {
    data = sctx.getImageData(0, 0, w, h);
  } catch (e) {
    console.warn('ロゴの透過処理に失敗（canvas taint の可能性）。ロゴなしで描画します。', e);
    logoImg._processed = null;
    return null;
  }
  const px = data.data;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const a = 255 - lum;              // 白→0(透明) 黒→255(不透明)
      px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = a; // 黒 + 可変アルファ
      if (a > 12) {                     // 内容のある画素で bbox を更新
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  sctx.putImageData(data, 0, 0);

  // トリミング（内容の外接矩形で切り出し）
  if (maxX < minX || maxY < minY) { logoImg._processed = src; return src; } // 念のため
  const tw = maxX - minX + 1, th = maxY - minY + 1;
  const trimmed = document.createElement('canvas');
  trimmed.width = tw; trimmed.height = th;
  trimmed.getContext('2d').drawImage(src, minX, minY, tw, th, 0, 0, tw, th);
  logoImg._processed = trimmed;
  return trimmed;
}

// 上帯（ロゴ帯）描画: 黄色背景 + 左にロゴ + その右にブランド名
function drawTopBand(ctx, S, band, topPreset, logoImg, bandImg) {
  if (!topPreset || topPreset.key === 'none') {
    drawBand(ctx, 0, band.y, S, band.h, '#ffffff'); // 帯なしは白（1:1は維持）
    return;
  }

  // ブランド帯はリファレンス完全一致の帯画像（4000x555）をそのまま貼る。
  // フォント非依存＝Mac/Windows/オフラインで同一表示。帯比率は画像アスペクトに一致させ歪めない。
  if (topPreset.key === 'brand' && bandImg && bandImg.complete && bandImg.naturalWidth) {
    ctx.drawImage(bandImg, 0, band.y, S, band.h);
    return;
  }

  // フォールバック（帯画像が未ロードの場合のみ）: 従来のロゴ+テキスト描画。
  drawBand(ctx, 0, band.y, S, band.h, topPreset.bg);

  const cy = band.y + band.h / 2;
  const padX = S * 0.03;
  let cursorX = padX;

  // ロゴ描画（高さを帯の 66% に合わせ、アスペクト保持）。処理失敗(null)時はロゴをスキップ。
  const logo = (topPreset.logo && logoImg && logoImg.complete && logoImg.naturalWidth)
    ? getProcessedLogo(logoImg) : null;
  if (logo) {
    const logoH = band.h * 0.66;
    const logoW = logoH * (logo.width / logo.height);
    ctx.drawImage(logo, cursorX, cy - logoH / 2, logoW, logoH);
    cursorX += logoW + S * 0.025; // ロゴとテキストの間隔
  }

  // ブランド名テキスト（ロゴの右・縦中央）。残り幅に収まるよう縮小。
  if (topPreset.text) {
    const maxTextW = S - cursorX - padX;
    ctx.fillStyle = topPreset.fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const size = fitFontSize(ctx, topPreset.text, FONT_FAMILY, maxTextW, band.h * 0.5, '700');
    ctx.font = `700 ${size}px ${FONT_FAMILY}`;
    ctx.fillText(topPreset.text, cursorX, cy);
  }
}

// 1 個の正方形バッジを描画。lines = [{ t, r, w }] (t:文字 / r:サイズ比(辺に対する) / w:太さ)。
// accent = ベースカラー(#rrggbb)。上明→下暗の光沢グラデ + トップのグロス + 白文字(影)で
// フラット塗りの参考画像とは質感を差別化しつつ、色で目立たせる。accent 省略時はグレー。
function drawBadgeSquare(ctx, x, y, size, lines, accent) {
  const radius = size * 0.16;
  const base = accent || '#565656';

  // 背景: 立体的な光沢グラデーション（上=明・中=ベース・下=暗）
  const g = ctx.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, shadeColor(base, 0.30));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shadeColor(base, -0.38));
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.fillStyle = g;
  ctx.fill();

  // 上半分のグロスハイライト（角丸内にクリップして光沢感を出す）
  ctx.save();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  const hl = ctx.createLinearGradient(x, y, x, y + size * 0.52);
  hl.addColorStop(0, 'rgba(255,255,255,0.30)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(x, y, size, size * 0.52);
  ctx.restore();

  // 内側に明るい縁取りで立体感・輪郭を強調
  const lw = Math.max(1, size * 0.02);
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  roundRectPath(ctx, x + lw / 2, y + lw / 2, size - lw, size - lw, radius);
  ctx.stroke();

  const pad = size * 0.10;
  const innerW = size - pad * 2;
  const avail = size - pad * 2;

  // 行高（辺サイズ比）と行間を算出し、収まらなければ全体を縮小
  let gap = size * 0.05;
  let lineHeights = lines.map((l) => size * l.r);
  let totalH = lineHeights.reduce((a, b) => a + b, 0) + gap * (lines.length - 1);
  if (totalH > avail) {
    const scale = avail / totalH;
    lineHeights = lineHeights.map((h) => h * scale);
    gap *= scale;
    totalH = avail;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  // 白文字を色地でも読めるよう軽い影を付与（描画後にリセット）
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = size * 0.035;
  ctx.shadowOffsetY = Math.max(1, size * 0.01);
  let cursorY = y + (size - totalH) / 2;
  const cx = x + size / 2;
  for (let i = 0; i < lines.length; i++) {
    const h = lineHeights[i];
    // 行高からフォントサイズを決め、幅超過なら縮小してはみ出しを防ぐ
    let fs = h * 0.95;
    const weight = lines[i].w || '700';
    ctx.font = `${weight} ${fs}px ${FONT_FAMILY}`;
    while (ctx.measureText(lines[i].t).width > innerW && fs > 8) {
      fs -= 1;
      ctx.font = `${weight} ${fs}px ${FONT_FAMILY}`;
    }
    ctx.fillText(lines[i].t, cx, cursorY + h / 2);
    cursorY += h + gap;
  }
  // 影をリセット（他の描画に影響させない）
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// 下帯（バッジ帯）描画。正方形バッジを固定サイズ（5個基準）でセンター寄せ配置。
// 5個未満は左右に空白を均等に配してセンター寄せ。5個超は自動縮小して収める。
function drawBottomBand(ctx, S, band, badges) {
  drawBand(ctx, 0, band.y, S, band.h, '#f2f2f2');
  if (!badges.length) return;

  const outerPad = S * 0.028;
  const gap = S * 0.018;
  const slots = 5;
  // 5個基準の固定辺長
  let size = (S - outerPad * 2 - gap * (slots - 1)) / slots;
  const n = badges.length;
  if (n > slots) {
    // 超過分は縮小して全数を収める（正方形・右詰めは維持）
    size = (S - outerPad * 2 - gap * (n - 1)) / n;
  }
  const by = band.y + (band.h - size) / 2; // 縦中央

  // センター寄せ: バッジ群を帯の水平中央に配置（左右の余白は均等）
  const totalW = n * size + gap * (n - 1);
  let x = (S - totalW) / 2;
  for (const b of badges) {
    drawBadgeSquare(ctx, x, by, size, b.lines, b.color);
    x += size + gap;
  }
}

// メイン: canvas に正方形画像を描画する
// options = { topPreset, badges, logoImage, view }
//   view 省略時は全体表示（getDefaultView）で描画する。
function renderSquare(canvas, img, options) {
  const S = img.naturalWidth; // 出力 1 辺 = 元画像実幅（写真を等倍で保持）
  canvas.width = S;
  canvas.height = S;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 各領域の高さ（px）。写真部は残り（端数を吸収し合計を厳密に S にする）。
  const L = computeLayout(S);
  const topBand = { y: 0, h: L.topH };
  const bottomBand = { y: L.topH + L.photoH, h: L.bottomH };
  const region = { x: 0, y: L.photo.y, w: S, h: L.photoH };
  const view = options.view || getDefaultView(img, S);

  // 描画順: 帯背景 → 写真 → バッジ・文字
  drawTopBand(ctx, S, topBand, options.topPreset, options.logoImage, options.bandImage);
  drawPhoto(ctx, img, region, view, '#ffffff');
  drawBottomBand(ctx, S, bottomBand, options.badges || []);

  return canvas;
}

window.RENDERER = { renderSquare, LAYOUT, computeLayout, getDefaultView };
