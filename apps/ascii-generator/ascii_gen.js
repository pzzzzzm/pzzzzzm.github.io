// ASCII art generator — OpenCV.js conversion pipeline + UI glue.
//
// Methods (radio value → name):
//   0 → 点阵阈值法 (dot-based threshold)
//   3 → 点阵边缘法 (edge-detected dot)
//   1 → 块阵灰度法 (block-based 8-level grayscale)
//   2 → 块阵均衡法 (histogram-equalized block)
//
// Real-time toggle drives both sliders. Threshold field is greyed out for
// block methods (which use 8-level depth, not a threshold).
//
// Caching strategy: the raw image's RGBA + grayscale Mats are kept across
// renders, and the (expensive) edge-detect result is cached lazily. Slider
// changes don't redo decoding/cvtColor — they just call resize + convert.
// Result: dragging a slider feels instant for typical-size images.

// ---- State ----
let isRendering = false;
let renderRAF = null;
const cached = {
  src:  null,    // currently-cached <img>.src
  raw:  null,    // cv.Mat from cv.imread
  gray: null,    // grayscale of raw
  edge: null,    // Canny + dilate + invert (built lazily)
};

// ---- DOM refs (resolved at script load — script lives at bottom of body) ----
const widthInput   = document.getElementById('width-input');
const widthRange   = document.getElementById('width-range');
const threshInput  = document.getElementById('thresh-input');
const threshRange  = document.getElementById('thresh-range');
const threshField  = document.getElementById('thresh-field');
const threshHint   = document.getElementById('thresh-hint');
const realtimeToggle = document.getElementById('realtime-toggle');
const generateBtn  = document.getElementById('generate-btn');
const outputEl     = document.getElementById('output-text');

// ---- Cache management ----
function invalidateCache() {
  if (cached.raw)  { cached.raw.delete();  cached.raw  = null; }
  if (cached.gray) { cached.gray.delete(); cached.gray = null; }
  if (cached.edge) { cached.edge.delete(); cached.edge = null; }
  cached.src = null;
}
window.invalidateCache = invalidateCache;   // exposed for the file-change handler in HTML

function ensureRawAndGray() {
  const img = document.getElementById('raw-img');
  if (cached.src === img.src && cached.raw && cached.gray) return;
  invalidateCache();
  cached.raw  = cv.imread('raw-img');
  cached.gray = new cv.Mat();
  cv.cvtColor(cached.raw, cached.gray, cv.COLOR_RGBA2GRAY, 0);
  cached.src = img.src;
}

function ensureEdge() {
  if (cached.edge) return cached.edge;
  ensureRawAndGray();
  cached.edge = computeEdge(cached.gray);
  return cached.edge;
}

// ---- OpenCV ops ----
function computeEdge(grayMat) {
  const edge = new cv.Mat();
  cv.Canny(grayMat, edge, 50, 200);

  const dilated = new cv.Mat();
  const M = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.dilate(edge, dilated, M, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
  edge.delete();
  M.delete();

  // Invert so edges are dark on white (matches grayscale convention)
  const w = dilated.size().width, h = dilated.size().height;
  const onesArr = new Array(w * h).fill(255);
  const ones = cv.matFromArray(h, w, cv.CV_8U, onesArr);
  const inverted = new cv.Mat();
  const empty = new cv.Mat();
  cv.subtract(ones, dilated, inverted, empty, -1);
  ones.delete();
  dilated.delete();
  empty.delete();
  return inverted;
}

// Resize-and-pad to a character grid sized for the chosen output width.
// Width = number of character cells across; each cell is 3 source pixels
// wide × 5 (dot) or 2 (block) tall after this resize. Caller is responsible
// for deleting the returned mat.
function resizeForChars(srcMat, charCols) {
  const sw = srcMat.size().width, sh = srcMat.size().height;
  const w_char = 3 * charCols;
  const h_char = Math.floor(sh / sw * w_char);
  const h_pad  = (h_char % 5) ? 5 - (h_char % 5) : 0;

  const resized = new cv.Mat();
  cv.resize(srcMat, resized, new cv.Size(w_char, h_char), 0, 0, cv.INTER_AREA);

  const padded = new cv.Mat();
  cv.copyMakeBorder(resized, padded, 0, h_pad, 0, 0, cv.BORDER_CONSTANT, new cv.Scalar(255));
  resized.delete();
  return padded;
}

// 8-dot Braille per 3×5-pixel cell, threshold-based
function dotBasedConvert(charMat, thresh) {
  const w = charMat.size().width, h = charMat.size().height;
  const out = [];
  for (let r = 0; r < h; r += 5) {
    let line = '';
    for (let c = 0; c < w; c += 3) {
      let sum = 10241;
      if (charMat.data[(r + 1) * w + c]     < thresh) sum += 2;
      if (charMat.data[(r + 2) * w + c]     < thresh) sum += 4;
      if (charMat.data[(r + 3) * w + c]     < thresh) sum += 64;
      if (charMat.data[ r      * w + c + 1] < thresh) sum += 8;
      if (charMat.data[(r + 1) * w + c + 1] < thresh) sum += 16;
      if (charMat.data[(r + 2) * w + c + 1] < thresh) sum += 32;
      if (charMat.data[(r + 3) * w + c + 1] < thresh) sum += 128;
      line += String.fromCharCode(0x2800 | (sum - 10240));
    }
    out.push(line);
  }
  return out.join('\n');
}

// Braille block per 1-cell × 2-row, 8-level grayscale quantization
function blockBasedConvert(charMatIn, isEqualized) {
  const w = Math.floor(charMatIn.size().width / 3);
  const h = Math.floor(charMatIn.size().height / 2.5);
  const sample = new cv.Mat();
  cv.resize(charMatIn, sample, new cv.Size(w, h), 0, 0, cv.INTER_AREA);
  if (isEqualized) cv.equalizeHist(sample, sample);

  const out = [];
  for (let r = 0; r < h; r += 2) {
    let line = '';
    for (let c = 0; c < w; c += 1) {
      let sum = 10240;
      const d1 = Math.floor(sample.data[r * w + c] / 32);
      const d2 = Math.floor(sample.data[(r + 1) * w + c] / 32);
      if (d1 < 2) sum += 1;
      if (d1 < 4) sum += 16;
      if (d1 < 6) sum += 8;
      if (d1 < 8) sum += 2;
      if (d2 < 2) sum += 128;
      if (d2 < 4) sum += 4;
      if (d2 < 6) sum += 64;
      if (d2 < 8) sum += 32;
      if (d1 === 7 && d2 === 7) sum = 10242;
      line += String.fromCharCode(sum);
    }
    out.push(line);
  }
  sample.delete();
  return out.join('\n');
}

// ---- Render pipeline ----
function getCurrentMethod() {
  return document.querySelector('input[name="method"]:checked').value;
}

function render() {
  if (!window.isCvLoaded && typeof cv === 'undefined') return;
  if (typeof cv === 'undefined' || !cv.imread) return;
  if (isRendering) return;       // re-entrancy guard
  isRendering = true;
  try {
    ensureRawAndGray();
    const method = getCurrentMethod();
    const width  = clamp(parseInt(widthInput.value || '75', 10),  20, 200);
    const thresh = clamp(parseInt(threshInput.value || '185', 10), 0, 255);

    const baseMat = method === '3' ? ensureEdge() : cached.gray;
    const charMat = resizeForChars(baseMat, width);

    let text;
    switch (method) {
      case '0': text = dotBasedConvert(charMat, thresh); break;
      case '3': text = dotBasedConvert(charMat, thresh); break;
      case '1': text = blockBasedConvert(charMat, false); break;
      case '2': text = blockBasedConvert(charMat, true);  break;
    }
    charMat.delete();

    outputEl.textContent = text;
  } catch (e) {
    console.error('render failed:', e);
  } finally {
    isRendering = false;
  }
}
window.scheduleRender = scheduleRender;

function scheduleRender() {
  if (renderRAF !== null) return;
  renderRAF = requestAnimationFrame(() => {
    renderRAF = null;
    render();
  });
}

function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

// ---- Slider sync + threshold availability ----
function pairSlider(numEl, rangeEl) {
  numEl.addEventListener('input', () => {
    rangeEl.value = numEl.value;
    if (realtimeToggle.checked) scheduleRender();
  });
  rangeEl.addEventListener('input', () => {
    numEl.value = rangeEl.value;
    if (realtimeToggle.checked) scheduleRender();
  });
  // Number-input committed changes (blur/Enter) always trigger a render so
  // turning realtime off + typing a number still updates.
  numEl.addEventListener('change', () => {
    rangeEl.value = numEl.value;
    if (!realtimeToggle.checked) scheduleRender();
  });
}
pairSlider(widthInput,  widthRange);
pairSlider(threshInput, threshRange);

function updateThreshAvailability() {
  const method = getCurrentMethod();
  const usable = (method === '0' || method === '3');
  threshField.classList.toggle('disabled', !usable);
  threshHint.textContent = usable
    ? '0–255，仅适用于点阵法'
    : '该方法使用 8 阶灰度，本字段无效';
}

document.querySelectorAll('input[name="method"]').forEach(r => {
  r.addEventListener('change', () => {
    updateThreshAvailability();
    scheduleRender();
  });
});

generateBtn.addEventListener('click', () => render());

// ---- Reset parameters (keeps the currently selected image + cache) ----
const resetBtn = document.getElementById('reset-btn');
resetBtn.addEventListener('click', () => {
  document.querySelector('input[name="method"][value="0"]').checked = true;
  widthInput.value  = '75';  widthRange.value  = '75';
  threshInput.value = '185'; threshRange.value = '185';
  updateThreshAvailability();
  scheduleRender();
});

// ---- Copy ASCII output to clipboard ----
const copyBtn = document.getElementById('copy-btn');
let copyResetTimer = null;
copyBtn.addEventListener('click', async () => {
  const text = outputEl.textContent;
  if (!text) return;
  const original = '复制结果';
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = '已复制 ✓';
  } catch (e) {
    // Fallback for older browsers / non-secure contexts.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); copyBtn.textContent = '已复制 ✓'; }
    catch (err) { copyBtn.textContent = '复制失败'; }
    document.body.removeChild(ta);
  }
  if (copyResetTimer) clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => { copyBtn.textContent = original; }, 1400);
});

// ---- Initial state ----
updateThreshAvailability();
