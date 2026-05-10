// LATIN — 2-Gray code for grand Motzkin / grand Dyck paths with air
// pockets. Left pane = lattice walk; right pane = the (α, β, γ)
// decomposition tapes the algorithm enumerates over.

import { generatePaths, totalCount } from './algorithm.js?v=latin8';
import { layoutLattice, layoutGrid, walkAgainstGrid, layoutDecomp } from './layout.js?v=latin8';
import { PathSequence } from './cache.js?v=latin8';

const $ = (s) => document.querySelector(s);
const stage     = $('#stage');
const decompStage = $('#decomp-stage');
const opLine    = $('#op-line');
const counter   = $('#counter');
const nInput    = $('#n-input');
const playBtn   = $('#play-btn');
const prevBtn   = $('#prev-btn');
const nextBtn   = $('#next-btn');
const resetBtn  = $('#reset-btn');
const speedRange = $('#speed-range');
const thumbsRoot = $('#thumbs');
const thumbsToggle = $('#thumbs-toggle');
const loadMoreBtn = $('#load-more');
const memEstimate = $('#mem-estimate');
const modeRadios = document.querySelectorAll('input[name="mode"]');

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---- State ----
let n = 5;
let mode = 'motzkin';
let seq = null;
let idx = 0;
let isPlaying = false;
let stageW = 0, stageH = 0;
let decompW = 0, decompH = 0;
let grid = null;             // fixed grid for the current n + global y range
let globalYMin = 0;
let globalYMax = 0;
let currentState = null;
let prevPath = null;
let cancelTransition = null;

// Lattice DOM cache (persisted across state changes; we animate via rAF
// — see transitionTo — because SVG line x1/y1/x2/y2 transitions via CSS
// aren't reliable across browsers/versions).
let latticeAxisGroup, latticeSegmentsGroup, latticeVertsGroup, latticeFlagGroup, latticeStringGroup;
const sceneEls = {
  vertEls: [],                 // n+1 circles
  segEls: [],                  // n line segments
  stringEl: null,              // <text> showing path tuple
};
// Last vertex coords applied to the DOM. Used as the `from` snapshot when
// the next transition starts, so rapid-fire clicks animate from wherever
// the lattice is RIGHT NOW (not from the previous transition's target).
let currentScreenVerts = [];

// ---- SVG init ----
function ensureSvgInit() {
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  const r = stage.getBoundingClientRect();
  stageW = Math.max(280, r.width  | 0);
  stageH = Math.max(220, r.height | 0);
  stage.setAttribute('viewBox', `0 0 ${stageW} ${stageH}`);

  // Order matters: axis underneath, segments above, verts on top of segments,
  // string label below the grid as a static text element.
  latticeAxisGroup     = svgGroup('axis');
  latticeSegmentsGroup = svgGroup('segments');
  latticeVertsGroup    = svgGroup('verts');
  latticeFlagGroup     = svgGroup('flags');
  latticeStringGroup   = svgGroup('string');

  stage.appendChild(latticeAxisGroup);
  stage.appendChild(latticeSegmentsGroup);
  stage.appendChild(latticeVertsGroup);
  stage.appendChild(latticeFlagGroup);
  stage.appendChild(latticeStringGroup);

  // Reset DOM-cache references — they'll be re-populated by buildScene().
  sceneEls.vertEls   = [];
  sceneEls.segEls    = [];
  sceneEls.stringEl  = null;
  currentScreenVerts = [];

  while (decompStage.firstChild) decompStage.removeChild(decompStage.firstChild);
  const dr = decompStage.getBoundingClientRect();
  decompW = Math.max(220, dr.width  | 0);
  decompH = Math.max(280, dr.height | 0);
  decompStage.setAttribute('viewBox', `0 0 ${decompW} ${decompH}`);
}

function svgGroup(cls) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', cls);
  return g;
}

// Sample paths to find the maximum y excursion (above and below the
// x-axis) so the grid is sized once and never jitters between states.
function computeGlobalYRange() {
  const sample = Math.min(60, seq.total);
  seq.generateUpTo(sample - 1);
  let yMin = 0, yMax = 0;
  for (let i = 0; i < sample; i++) {
    const s = seq.get(i);
    if (!s) break;
    let y = 0;
    for (const step of s.path) {
      y += step;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  // Pad by 1 in each direction so paths never touch the grid edge.
  globalYMin = yMin - 1;
  globalYMax = yMax + 1;
}

// ---- Build scene (once per n / mode / resize) -----------------------
// Creates the grid, axis labels, persistent vert + seg + magnitude-badge
// elements, and the string-representation text node. Subsequent state
// changes only update attributes; CSS transitions handle the morph.
function buildScene() {
  ensureSvgInit();
  grid = layoutGrid(n, {
    width: stageW, height: stageH, padX: 48, padY: 70,
    fillFactor: 0.9, yMin: globalYMin, yMax: globalYMax,
  });

  const xLeft  = grid.offsetX;
  const xRight = grid.offsetX + grid.drawW;
  const yTopScreen = grid.baselineY - globalYMax * grid.yStep;
  const yBotScreen = grid.baselineY - globalYMin * grid.yStep;

  // Vertical grid lines at every integer x in [0, n]
  for (let i = 0; i <= n; i++) {
    const x = grid.offsetX + i * grid.xStep;
    appendLine(latticeAxisGroup, x, yTopScreen, x, yBotScreen, 'grid-line');
  }
  // Horizontal grid lines at every integer y; y=0 emphasized as axis
  for (let y = globalYMin; y <= globalYMax; y++) {
    const yScreen = grid.baselineY - y * grid.yStep;
    appendLine(latticeAxisGroup, xLeft, yScreen, xRight, yScreen,
               y === 0 ? 'axis-line' : 'grid-line');
    if (y !== 0 && Math.abs(y) <= 12) {
      const ty = document.createElementNS(SVG_NS, 'text');
      ty.setAttribute('x', xLeft - 10);
      ty.setAttribute('y', yScreen);
      ty.setAttribute('class', 'axis-label axis-y');
      ty.textContent = String(y);
      latticeAxisGroup.appendChild(ty);
    }
  }
  // x-step labels under the grid
  for (let i = 1; i <= n; i++) {
    const x = grid.offsetX + (i - 0.5) * grid.xStep;
    const tx = document.createElementNS(SVG_NS, 'text');
    tx.setAttribute('x', x);
    tx.setAttribute('y', yBotScreen + 14);
    tx.setAttribute('class', 'axis-label');
    tx.textContent = String(i);
    latticeAxisGroup.appendChild(tx);
  }

  // Persistent segment lines (n of them). Magnitude is read off the
  // grid directly — no badge needed (the y-drop of a down-step IS the
  // magnitude).
  for (let i = 0; i < n; i++) {
    const ln = document.createElementNS(SVG_NS, 'line');
    ln.setAttribute('class', 'segment seg-flat');
    latticeSegmentsGroup.appendChild(ln);
    sceneEls.segEls.push(ln);
  }

  // Persistent vertex circles (n+1 of them).
  for (let i = 0; i <= n; i++) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('r', 4);
    c.setAttribute('class', (i === 0 || i === n) ? 'vert vert-anchor' : 'vert');
    // Park x at its fixed slot — y will be set by updateScene.
    c.setAttribute('cx', grid.offsetX + i * grid.xStep);
    c.setAttribute('cy', grid.baselineY);
    latticeVertsGroup.appendChild(c);
    sceneEls.vertEls.push(c);
  }

  // Path tuple readout below the x-axis labels.
  const stringEl = document.createElementNS(SVG_NS, 'text');
  stringEl.setAttribute('x', (xLeft + xRight) / 2);
  stringEl.setAttribute('y', yBotScreen + 38);
  stringEl.setAttribute('class', 'path-string');
  latticeStringGroup.appendChild(stringEl);
  sceneEls.stringEl = stringEl;
}

function appendLine(parent, x1, y1, x2, y2, cls) {
  const ln = document.createElementNS(SVG_NS, 'line');
  ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
  ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
  ln.setAttribute('class', cls);
  parent.appendChild(ln);
}

// Apply vertex + segment coordinates directly to the DOM.
// `segs[i].kind` (up / flat / down) drives the segment color via class.
function applyToDom(verts, segs) {
  for (let i = 0; i <= n; i++) {
    sceneEls.vertEls[i].setAttribute('cx', verts[i].x);
    sceneEls.vertEls[i].setAttribute('cy', verts[i].y);
  }
  for (let i = 0; i < n; i++) {
    const seg = sceneEls.segEls[i];
    seg.setAttribute('x1', segs[i].x1);
    seg.setAttribute('y1', segs[i].y1);
    seg.setAttribute('x2', segs[i].x2);
    seg.setAttribute('y2', segs[i].y2);
    seg.setAttribute('class', `segment seg-${segs[i].kind}`);
  }
  currentScreenVerts = verts.map(v => ({ x: v.x, y: v.y }));
}

// Format the path as a compact, readable tuple with aligned signs.
function pathToString(path) {
  return '[ ' + path.map(v => v >= 0 ? ` ${v}` : `${v}`).join(', ') + ' ]';
}

// Side renderings (decomp, string, op-line) — always instant; only the
// lattice walk is animated.
function applySideUpdates(state) {
  currentState = state;
  prevPath = state.path.slice();
  drawDecomp(state.op, null);
  updateOpLine(state);
  sceneEls.stringEl.textContent = pathToString(state.path);
}

// Snap to a state with no animation. Used by init / reset / resize.
function renderStateInstant(state) {
  applySideUpdates(state);
  const { verts, segs } = walkAgainstGrid(state.path, grid);
  applyToDom(verts, segs);
}

// ---- Decomposition pane ----
function drawDecomp(op, prevOp) {
  while (decompStage.firstChild) decompStage.removeChild(decompStage.firstChild);
  // padY=44 gives clearance below the pane-label without an extra SVG title
  const lay = layoutDecomp(op, { width: decompW, height: decompH, padX: 28, padY: 44 });

  let yCur = lay.rowStartY;
  for (const row of lay.rows) {
    const cellTop = yCur;
    const cellMid = yCur + lay.cellH / 2;

    // Row label (greek letter) at the very left, vertically centered on cells
    const lbl = document.createElementNS(SVG_NS, 'text');
    lbl.setAttribute('x', lay.padX);
    lbl.setAttribute('y', cellMid + 1);
    lbl.setAttribute('class', 'decomp-row-label');
    lbl.textContent = row.label;
    decompStage.appendChild(lbl);

    // Cells — start at tapeX so all rows align
    for (let i = 0; i < row.cells.length; i++) {
      const cellX = lay.tapeX + i * row.cellW;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', cellX + 1);
      rect.setAttribute('y', cellTop);
      rect.setAttribute('width', row.cellW - 2);
      rect.setAttribute('height', lay.cellH);
      const v = row.cells[i];
      const isFilled = v !== 0;
      rect.setAttribute('class', isFilled ? 'decomp-cell decomp-cell-on' : 'decomp-cell');
      decompStage.appendChild(rect);
      const tx = document.createElementNS(SVG_NS, 'text');
      tx.setAttribute('x', cellX + row.cellW / 2);
      tx.setAttribute('y', cellMid + 1);
      tx.setAttribute('class', isFilled ? 'decomp-cell-text on' : 'decomp-cell-text');
      tx.textContent = String(v);
      decompStage.appendChild(tx);
    }

    // Hint UNDER the row (not on the side — that crowded the cells)
    const hint = document.createElementNS(SVG_NS, 'text');
    hint.setAttribute('x', lay.tapeX);
    hint.setAttribute('y', cellTop + lay.cellH + 14);
    hint.setAttribute('class', 'decomp-row-hint');
    hint.textContent = row.hint;
    decompStage.appendChild(hint);

    yCur += lay.cellH + lay.rowGap;
  }

  // Parity flags + d count — laid out evenly with proper gaps
  const flagItems = [
    ['d',  String(op.d)],
    ['dd', String(op.dd)],
    ['di', String(op.di)],
  ];
  const flagW = 56, flagH = 36, flagGap = 10;
  let flagX = lay.padX;
  for (const [name, val] of flagItems) {
    const grp = document.createElementNS(SVG_NS, 'g');
    grp.setAttribute('transform', `translate(${flagX}, ${lay.flagsY})`);
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('width', flagW); r.setAttribute('height', flagH);
    r.setAttribute('class', 'flag-pill');
    grp.appendChild(r);
    const lbl = document.createElementNS(SVG_NS, 'text');
    lbl.setAttribute('x', 8); lbl.setAttribute('y', 12);
    lbl.setAttribute('class', 'flag-name');
    lbl.textContent = name;
    grp.appendChild(lbl);
    const v = document.createElementNS(SVG_NS, 'text');
    v.setAttribute('x', 8); v.setAttribute('y', 28);
    v.setAttribute('class', 'flag-val');
    v.textContent = val;
    grp.appendChild(v);
    decompStage.appendChild(grp);
    flagX += flagW + flagGap;
  }
}

// ---- Op line ----
function updateOpLine(state) {
  if (!state.op || state.op.kind === 'init') {
    opLine.textContent = 'initial state';
    opLine.dataset.kind = 'init';
    return;
  }
  if (state.op.sentinel) {
    opLine.textContent = 'sentinel · all-flat path';
    opLine.dataset.kind = 'sentinel';
    return;
  }
  // Diff vs prev path: count differing positions
  if (prevPath) {
    let diffs = [];
    const len = Math.max(prevPath.length, state.path.length);
    for (let i = 0; i < len; i++) {
      if (prevPath[i] !== state.path[i]) diffs.push(i + 1);
    }
    if (diffs.length > 0 && diffs.length <= 2) {
      opLine.textContent = `2-Gray · pos ${diffs.join(',')} changed`;
      opLine.dataset.kind = 'step';
      return;
    }
  }
  opLine.textContent = state.op.kind === 'gd' ? 'grand Dyck step' : 'grand Motzkin step';
  opLine.dataset.kind = 'step';
}

// ---- Transition: rAF-driven interpolation of vertex coords. Each frame
//      computes interpolated verts AND derives segment endpoints from
//      those interpolated verts — so segments stay attached to their
//      moving endpoints (rather than appearing/disappearing).
//      Cancellation: cancelTransition() stops the rAF loop and resolves
//      the promise immediately. Because we sample currentScreenVerts as
//      `from`, the next animation starts from wherever the lattice is
//      currently rendered, giving rapid clicks a smooth chained feel.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function transitionTo(state, durationMs) {
  return new Promise((resolve) => {
    // Side panels update instantly so the op-line and decomp tape reflect
    // the new state as soon as the user clicks (no perceived lag).
    applySideUpdates(state);

    const target = walkAgainstGrid(state.path, grid);
    // Snapshot the current screen positions BEFORE we start mutating
    // — this is the animation's `from` state.
    const from = currentScreenVerts.length === n + 1
      ? currentScreenVerts.map(v => ({ x: v.x, y: v.y }))
      : target.verts.map(v => ({ x: v.x, y: v.y }));

    // Set segment classes once at the start so colors are correct from
    // frame 0; only positions change per frame.
    for (let i = 0; i < n; i++) {
      sceneEls.segEls[i].setAttribute('class', `segment seg-${target.segs[i].kind}`);
    }

    const startTime = performance.now();
    let rafId = null;

    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const e = easeInOutCubic(t);

      // Interpolate every vertex (x and y) from `from` to `target.verts`.
      const iv = new Array(n + 1);
      for (let i = 0; i <= n; i++) {
        const f = from[i], tg = target.verts[i];
        iv[i] = { x: f.x + (tg.x - f.x) * e, y: f.y + (tg.y - f.y) * e };
      }
      // Derive segment endpoints from interpolated verts so segments
      // always connect their two adjacent verts visibly during motion.
      const isegs = new Array(n);
      for (let i = 0; i < n; i++) {
        isegs[i] = {
          kind: target.segs[i].kind,
          x1: iv[i].x,     y1: iv[i].y,
          x2: iv[i + 1].x, y2: iv[i + 1].y,
        };
      }
      applyToDom(iv, isegs);

      if (t >= 1) {
        rafId = null;
        cancelTransition = null;
        resolve();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);

    cancelTransition = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      cancelTransition = null;
      resolve();
    };
  });
}

// ---- Playback ----
function setIndex(i, animate) {
  i = Math.max(0, Math.min(seq.total - 1, i));
  if (i === idx) return Promise.resolve();
  if (i >= seq.cachedCount()) seq.generateUpTo(i);
  const target = seq.get(i);
  if (!target) return Promise.resolve();
  idx = i;
  refreshCounter();
  refreshThumbsHighlight();
  if (idx >= shownCount - 1 && shownCount < seq.total) extendShown();
  if (animate) return transitionTo(target, currentDuration());
  renderStateInstant(target);
  return Promise.resolve();
}

function currentDuration() {
  const v = +speedRange.value;
  return 800 - (v - 1) * (650 / 9);
}

function refreshCounter() {
  counter.textContent = `${idx + 1} / ${seq.total ?? '?'}`;
}

async function step(delta) {
  // Cancel any in-flight transition so rapid clicks feel responsive —
  // each click advances idx by `delta` and starts a fresh transition
  // from wherever the elements are currently rendered.
  if (cancelTransition) cancelTransition();
  await setIndex(idx + delta, true);
}

const PLAY_SVG  = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3.5v9l7-4.5z"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4.5" y="3.5" width="2.5" height="9" rx="0.5"/><rect x="9" y="3.5" width="2.5" height="9" rx="0.5"/></svg>';

async function play() {
  if (isPlaying) return;
  isPlaying = true;
  playBtn.innerHTML = PAUSE_SVG;
  while (isPlaying && idx < (seq.total ?? Infinity) - 1) {
    await step(1);
    if (!isPlaying) break;
    await new Promise(r => setTimeout(r, 30));
  }
  pause();
}
function pause() {
  isPlaying = false;
  playBtn.innerHTML = PLAY_SVG;
}
function reset() {
  pause();
  if (cancelTransition) cancelTransition();
  idx = 0;
  const s = seq.get(0);
  prevPath = null;
  renderStateInstant(s);
  refreshCounter();
  refreshThumbsHighlight();
}

// ---- Thumbnails ----
const THUMB_W = 110;
const THUMB_H = 64;
const CHUNK = 100;
const PRELOAD_BUFFER = 100;
let shownCount = 0;
let bufferingPending = false;

function clearThumbs() {
  while (thumbsRoot.firstChild) thumbsRoot.removeChild(thumbsRoot.firstChild);
  shownCount = 0;
}

function renderThumbnail(i, state) {
  const div = document.createElement('div');
  div.className = 'thumb';
  div.dataset.idx = String(i);
  if (i === idx) div.classList.add('active');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${THUMB_W} ${THUMB_H}`);
  svg.setAttribute('class', 'thumb-svg');

  const lay = layoutLattice(state.path, {
    width: THUMB_W, height: THUMB_H, padX: 6, padY: 6, fillFactor: 0.94,
  });
  // baseline
  const ax = document.createElementNS(SVG_NS, 'line');
  ax.setAttribute('x1', lay.offsetX - 2);
  ax.setAttribute('y1', lay.baselineY);
  ax.setAttribute('x2', lay.offsetX + lay.drawW + 2);
  ax.setAttribute('y2', lay.baselineY);
  ax.setAttribute('class', 'thumb-axis');
  svg.appendChild(ax);
  for (const s of lay.segs) {
    const ln = document.createElementNS(SVG_NS, 'line');
    ln.setAttribute('x1', s.x1); ln.setAttribute('y1', s.y1);
    ln.setAttribute('x2', s.x2); ln.setAttribute('y2', s.y2);
    ln.setAttribute('class', `thumb-segment seg-${s.kind}`);
    svg.appendChild(ln);
  }

  div.appendChild(svg);
  const lbl = document.createElement('div');
  lbl.className = 'thumb-label';
  lbl.textContent = String(i + 1);
  div.appendChild(lbl);

  div.addEventListener('click', () => {
    pause();
    setIndex(i, !isAnimating);
  });
  thumbsRoot.appendChild(div);
}

function extendShown() {
  if (shownCount >= seq.total) return;
  const newShown = Math.min(seq.total, shownCount + CHUNK);
  seq.generateUpTo(newShown - 1);
  for (let i = shownCount; i < newShown; i++) {
    const s = seq.get(i);
    if (!s) break;
    renderThumbnail(i, s);
  }
  shownCount = newShown;
  updateLoadMoreLabel();
  updateMemEstimate();
  scheduleBufferFill();
}
function scheduleBufferFill() {
  if (bufferingPending) return;
  if (shownCount >= seq.total) return;
  if (seq.cachedCount() >= shownCount + PRELOAD_BUFFER) return;
  bufferingPending = true;
  const run = () => {
    bufferingPending = false;
    const target = Math.min(seq.total, shownCount + PRELOAD_BUFFER) - 1;
    seq.generateUpTo(target);
    updateMemEstimate();
  };
  if (typeof window.requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 200 });
  } else setTimeout(run, 0);
}
function updateLoadMoreLabel() {
  const remaining = seq.total - shownCount;
  loadMoreBtn.disabled = remaining <= 0;
  loadMoreBtn.textContent = remaining <= 0
    ? `all ${seq.total} loaded`
    : `load ${Math.min(CHUNK, remaining)} more (${shownCount}/${seq.total} shown)`;
}
function updateMemEstimate() {
  if (!memEstimate) return;
  const bytes = seq.estimatedBytes();
  let label;
  if (bytes < 1024) label = `${bytes} B`;
  else if (bytes < 1024 * 1024) label = `${(bytes / 1024).toFixed(0)} KB`;
  else label = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  memEstimate.textContent = `~${label}`;
  memEstimate.classList.toggle('warn', bytes > 100 * 1024 * 1024);
}
function refreshThumbsHighlight() {
  const els = thumbsRoot.querySelectorAll('.thumb');
  for (const el of els) {
    const i = +el.dataset.idx;
    el.classList.toggle('active', i === idx);
  }
}

// ---- Init ----
function init(newN, newMode) {
  pause();
  if (cancelTransition) cancelTransition();
  n = newN;
  mode = newMode;
  const total = totalCount(n, mode);
  seq = new PathSequence(() => generatePaths(n, mode), total);
  idx = 0;
  seq.generateUpTo(0);
  computeGlobalYRange();           // determines fixed grid bounds
  buildScene();                    // creates persistent grid + verts + segs
  prevPath = null;
  renderStateInstant(seq.get(0));
  refreshCounter();
  clearThumbs();
  extendShown();
  updateMemEstimate();
}

playBtn.addEventListener('click', () => isPlaying ? pause() : play());
prevBtn.addEventListener('click', () => step(-1));
nextBtn.addEventListener('click', () => step(1));
resetBtn.addEventListener('click', () => reset());
nInput.addEventListener('change', () => {
  const v = Math.max(2, Math.min(10, parseInt(nInput.value || '5', 10)));
  nInput.value = String(v);
  init(v, mode);
});
modeRadios.forEach(r => r.addEventListener('change', () => {
  if (r.checked) init(n, r.value);
}));
loadMoreBtn.addEventListener('click', () => extendShown());
thumbsToggle.addEventListener('click', () => {
  const open = thumbsRoot.parentElement.classList.toggle('open');
  thumbsToggle.textContent = open ? '▾ thumbnails' : '▸ thumbnails';
});

const ro = new ResizeObserver(() => {
  if (!seq) return;
  const r = stage.getBoundingClientRect();
  if (r.width < 50 || r.height < 50) return;
  const cur = seq.get(idx);
  if (!cur) return;
  if (cancelTransition) cancelTransition();
  prevPath = null;
  buildScene();                    // grid depends on stageW/stageH
  renderStateInstant(cur);
});
const vizWrap = document.querySelector('.viz-wrap');
if (vizWrap) ro.observe(vizWrap);

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  if (e.key === ' ')          { e.preventDefault(); isPlaying ? pause() : play(); }
});

init(parseInt(nInput.value || '5', 10), mode);
