// IWOCA — Rotation Gray code for stamp foldings & semi-meanders.
// Left pane:  horizontal meander with arcs alternating above/below the baseline.
// Right pane: the n-row branch of the paper's recursive computation tree
//             (Fig. 2.2) — each row is the size-(t+1) sub-meander obtained
//             by projecting the current permutation onto stamps ≤ t+1.

import { generateRotationGray, totalCount } from './algorithm.js?v=iwoca3';
import { layoutMeander, meanderArcPath, layoutRecursionTree } from './layout.js?v=iwoca3';
import { FoldingSequence } from './cache.js?v=iwoca3';

const $ = (sel) => document.querySelector(sel);
const stage      = $('#stage');
const treeStage  = $('#ladder-stage');
const opLine     = $('#op-line');
const counter    = $('#counter');
const nInput     = $('#n-input');
const playBtn    = $('#play-btn');
const prevBtn    = $('#prev-btn');
const nextBtn    = $('#next-btn');
const resetBtn   = $('#reset-btn');
const speedRange = $('#speed-range');
const thumbsRoot = $('#thumbs');
const thumbsToggle = $('#thumbs-toggle');
const loadMoreBtn = $('#load-more');
const memEstimate = $('#mem-estimate');
const modeRadios = document.querySelectorAll('input[name="mode"]');

const SVG_NS = 'http://www.w3.org/2000/svg';

let n = 5;
let mode = 'stamp';
let seq = null;
let idx = 0;
let isPlaying = false;
let stageW = 0, stageH = 0;
let treeW = 0, treeH = 0;
let currentMeanderLay = null;
let currentState = null;
let prevQ = null;
let isAnimating = false;
let cancelTransition = null;

// Left pane DOM cache
const stampEls = new Map();      // stamp value -> <circle>
const stampLabelEls = new Map(); // stamp value -> <text>
const arcEls = new Map();        // k -> <path> for arc(k, k+1)
const blockRect = document.createElementNS(SVG_NS, 'rect');
blockRect.setAttribute('class', 'block-rect');
blockRect.setAttribute('opacity', '0');
let foldBlockGroup, foldArcsGroup, foldStampsGroup, foldLabelsGroup, baselineEl;

// Right pane (recursion tree branch)
let treeBranchGroup;
let treePrevQ = null;

// ----- SVG init -----
function ensureSvgInit() {
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  const r = stage.getBoundingClientRect();
  stageW = Math.max(280, r.width  | 0);
  stageH = Math.max(220, r.height | 0);
  stage.setAttribute('viewBox', `0 0 ${stageW} ${stageH}`);

  foldBlockGroup = document.createElementNS(SVG_NS, 'g');
  foldBlockGroup.setAttribute('class', 'block');
  foldBlockGroup.appendChild(blockRect);
  blockRect.setAttribute('opacity', '0');
  stage.appendChild(foldBlockGroup);

  // Baseline (a faint horizontal line through the center)
  baselineEl = document.createElementNS(SVG_NS, 'line');
  baselineEl.setAttribute('class', 'baseline');
  stage.appendChild(baselineEl);

  foldArcsGroup = document.createElementNS(SVG_NS, 'g');
  foldArcsGroup.setAttribute('class', 'arcs');
  stage.appendChild(foldArcsGroup);

  foldStampsGroup = document.createElementNS(SVG_NS, 'g');
  foldStampsGroup.setAttribute('class', 'stamps');
  stage.appendChild(foldStampsGroup);

  foldLabelsGroup = document.createElementNS(SVG_NS, 'g');
  foldLabelsGroup.setAttribute('class', 'stamp-labels');
  stage.appendChild(foldLabelsGroup);

  stampEls.clear();
  stampLabelEls.clear();
  arcEls.clear();

  // Right pane
  while (treeStage.firstChild) treeStage.removeChild(treeStage.firstChild);
  const tr = treeStage.getBoundingClientRect();
  treeW = Math.max(220, tr.width  | 0);
  treeH = Math.max(280, tr.height | 0);
  treeStage.setAttribute('viewBox', `0 0 ${treeW} ${treeH}`);
  treeBranchGroup = document.createElementNS(SVG_NS, 'g');
  treeBranchGroup.setAttribute('class', 'tree-branch');
  treeStage.appendChild(treeBranchGroup);
}

function computeMeander(perm) {
  return layoutMeander(perm, {
    width: stageW, height: stageH, padX: 36, padY: 60, fillFactor: 0.92,
  });
}

// Block highlight: rectangle wrapping the rotated stamps' x-range, tall
// enough to cover the largest arc above/below the baseline.
function blockBox(op, lay) {
  if (!op || op.windowLen == null) return null;
  const start = op.windowStart;
  const end = op.windowStart + op.windowLen - 1;
  const a = lay.positions[start];
  const b = lay.positions[end];
  if (!a || !b) return null;
  // Vertical extent: enclose arcs of length up to (windowLen-1) gaps.
  const inner = (op.windowLen - 1) * (lay.positions[1] ? lay.positions[1].x - lay.positions[0].x : 30);
  const arcReach = Math.max(28, inner * 0.55);
  const padX = lay.radius + 12;
  return {
    x: Math.min(a.x, b.x) - padX,
    y: lay.baselineY - arcReach - 8,
    w: Math.abs(b.x - a.x) + 2 * padX,
    h: 2 * (arcReach + 8),
  };
}

function applyBlockRect(box, opacity) {
  if (!box || opacity <= 0.001) {
    blockRect.setAttribute('opacity', '0');
    return;
  }
  blockRect.setAttribute('x', box.x);
  blockRect.setAttribute('y', box.y);
  blockRect.setAttribute('width',  box.w);
  blockRect.setAttribute('height', box.h);
  blockRect.setAttribute('opacity', String(opacity));
}

function lerpBox(a, b, t) {
  if (a && b) return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
  return b || a || null;
}

// ----- Initial render -----
function renderInitial(state) {
  ensureSvgInit();
  const lay = computeMeander(state.perm);
  currentMeanderLay = lay;
  currentState = state;
  prevQ = state.q.slice();

  // Baseline
  baselineEl.setAttribute('x1', lay.stripLeft - 14);
  baselineEl.setAttribute('y1', lay.baselineY);
  baselineEl.setAttribute('x2', lay.stripRight + 14);
  baselineEl.setAttribute('y2', lay.baselineY);

  // Stamps + labels
  for (const p of lay.positions) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', lay.radius);
    c.setAttribute('class', p.stamp === 1 ? 'stamp stamp-root' : 'stamp');
    foldStampsGroup.appendChild(c);
    stampEls.set(p.stamp, c);

    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', p.x);
    t.setAttribute('y', p.y - lay.radius - 6);
    t.setAttribute('class', 'stamp-label');
    t.textContent = String(p.stamp);
    foldLabelsGroup.appendChild(t);
    stampLabelEls.set(p.stamp, t);
  }

  // Arcs alternate above/below the baseline. Arc(k, k+1) is above iff k odd.
  for (let k = 1; k < n; k++) {
    const a = lay.byStamp.get(k);
    const b = lay.byStamp.get(k + 1);
    if (!a || !b) continue;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'arc');
    path.setAttribute('d', meanderArcPath(a, b, k % 2 === 1));
    foldArcsGroup.appendChild(path);
    arcEls.set(k, path);
  }

  applyBlockRect(state.op ? blockBox(state.op, lay) : null, state.op ? 1 : 0);

  // Right pane
  renderTree(state, prevQ);
  updateOpLine(state);
}

// ----- Recursion tree branch (right pane) -----
//
// Renders n stacked rows, one per level t = 0..n-1. Each row contains a small
// horizontal meander of size t+1 (the projection of the current perm onto
// stamps ≤ t+1) plus a q[t] direction glyph. Active level (op.level) gets a
// soft highlight; levels whose q-bit flipped this step get a "trace" tint
// so you can see the unwinding from level n-1 back down to active level.
function renderTree(state, prevQVec) {
  while (treeBranchGroup.firstChild) treeBranchGroup.removeChild(treeBranchGroup.firstChild);

  const layout = layoutRecursionTree(state.perm, state.q, state.op ? state.op.level : null, {
    width: treeW, height: treeH, padX: 16, padY: 24,
  });

  // Spine connecting consecutive rows
  if (layout.rows.length > 1) {
    const first = layout.rows[0];
    const last  = layout.rows[layout.rows.length - 1];
    const spine = document.createElementNS(SVG_NS, 'line');
    spine.setAttribute('class', 'tree-spine');
    spine.setAttribute('x1', 28);
    spine.setAttribute('x2', 28);
    spine.setAttribute('y1', first.origin.y + first.box.h / 2);
    spine.setAttribute('y2', last.origin.y + last.box.h / 2);
    treeBranchGroup.appendChild(spine);
  }

  for (const row of layout.rows) {
    // Highlight band for active level
    if (row.active) {
      const band = document.createElementNS(SVG_NS, 'rect');
      band.setAttribute('class', 'tree-row-band');
      band.setAttribute('x', 4);
      band.setAttribute('y', row.origin.y - 6);
      band.setAttribute('width', treeW - 8);
      band.setAttribute('height', row.box.h + 12);
      treeBranchGroup.appendChild(band);
    }
    // Trace highlight for q-bits that flipped this step
    if (prevQVec && prevQVec[row.level] !== state.q[row.level]) {
      const flip = document.createElementNS(SVG_NS, 'rect');
      flip.setAttribute('class', 'tree-row-flip');
      flip.setAttribute('x', 4);
      flip.setAttribute('y', row.origin.y - 6);
      flip.setAttribute('width', treeW - 8);
      flip.setAttribute('height', row.box.h + 12);
      treeBranchGroup.appendChild(flip);
    }

    // q[t] glyph at left
    const dirText = document.createElementNS(SVG_NS, 'text');
    dirText.setAttribute('class', 'tree-q-glyph');
    dirText.setAttribute('x', 14);
    dirText.setAttribute('y', row.origin.y + row.box.h / 2 + 1);
    dirText.textContent = row.qVal ? '→' : '←';
    treeBranchGroup.appendChild(dirText);

    // m label (size of this sub-meander)
    const mText = document.createElementNS(SVG_NS, 'text');
    mText.setAttribute('class', 'tree-m-label');
    mText.setAttribute('x', treeW - 8);
    mText.setAttribute('y', row.origin.y + row.box.h / 2 + 1);
    mText.textContent = `m=${row.m}`;
    treeBranchGroup.appendChild(mText);

    // Mini-meander for this row
    const subGroup = document.createElementNS(SVG_NS, 'g');
    subGroup.setAttribute('transform', `translate(${row.origin.x}, ${row.origin.y})`);
    treeBranchGroup.appendChild(subGroup);

    // baseline
    const bl = document.createElementNS(SVG_NS, 'line');
    bl.setAttribute('class', 'mini-baseline');
    bl.setAttribute('x1', row.meanderLay.stripLeft - 6);
    bl.setAttribute('y1', row.meanderLay.baselineY);
    bl.setAttribute('x2', row.meanderLay.stripRight + 6);
    bl.setAttribute('y2', row.meanderLay.baselineY);
    subGroup.appendChild(bl);

    // arcs
    const m = row.perm.length;
    for (let k = 1; k < m; k++) {
      const a = row.meanderLay.byStamp.get(k);
      const b = row.meanderLay.byStamp.get(k + 1);
      if (!a || !b) continue;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'mini-arc');
      path.setAttribute('d', meanderArcPath(a, b, k % 2 === 1));
      subGroup.appendChild(path);
    }
    // stamps
    for (const p of row.meanderLay.positions) {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
      c.setAttribute('r', Math.min(row.meanderLay.radius, 4));
      c.setAttribute('class', p.stamp === 1 ? 'mini-stamp mini-root' : 'mini-stamp');
      subGroup.appendChild(c);
    }
  }
}

// ----- Op text -----
function updateOpLine(state) {
  if (!state.op) {
    opLine.textContent = 'initial state';
    opLine.dataset.kind = 'init';
    return;
  }
  const op = state.op;
  const dirArrow = op.dir ? '→' : '←';
  let label;
  if (op.kind === 'sub-rotate') {
    label = `level ${op.level} · rotate p[${op.windowStart + 1}..${op.windowStart + op.windowLen}] ${dirArrow}${op.j}`;
  } else if (op.kind === 'stamp-step' || op.kind === 'semi-step') {
    label = `level ${op.level} · whole rotate ${dirArrow}${op.j}`;
  } else {
    label = op.kind || 'step';
  }
  opLine.textContent = label;
  opLine.dataset.kind = op.kind;
}

// ----- Transitions -----
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function transitionTo(state, durationMs) {
  return new Promise((resolve) => {
    const oldLay = currentMeanderLay;
    const newLay = computeMeander(state.perm);
    const oldBox = currentState && currentState.op ? blockBox(currentState.op, oldLay) : null;
    const newBox = state.op ? blockBox(state.op, newLay) : null;
    const prevQVec = prevQ ? prevQ.slice() : state.q.slice();

    const start = performance.now();
    isAnimating = true;
    const FRAME_MS = 16;

    const intervalId = setInterval(() => {
      const now = performance.now();
      const tt = Math.min(1, (now - start) / durationMs);
      const e = easeInOut(tt);

      // Stamps move from old to new x positions
      for (const p of newLay.positions) {
        const o = oldLay.byStamp.get(p.stamp);
        if (!o) continue;
        const x = o.x + (p.x - o.x) * e;
        const y = o.y + (p.y - o.y) * e;
        const c = stampEls.get(p.stamp);
        const lab = stampLabelEls.get(p.stamp);
        if (c) { c.setAttribute('cx', x); c.setAttribute('cy', y); }
        if (lab) {
          lab.setAttribute('x', x);
          lab.setAttribute('y', y - newLay.radius - 6);
        }
      }
      // Arcs redrawn against interpolated positions
      for (let k = 1; k < n; k++) {
        const path = arcEls.get(k);
        if (!path) continue;
        const a1 = oldLay.byStamp.get(k);
        const a2 = newLay.byStamp.get(k);
        const b1 = oldLay.byStamp.get(k + 1);
        const b2 = newLay.byStamp.get(k + 1);
        if (!a1 || !a2 || !b1 || !b2) continue;
        const pa = { x: a1.x + (a2.x - a1.x) * e, y: a1.y + (a2.y - a1.y) * e };
        const pb = { x: b1.x + (b2.x - b1.x) * e, y: b1.y + (b2.y - b1.y) * e };
        path.setAttribute('d', meanderArcPath(pa, pb, k % 2 === 1));
      }
      // Block rect tween
      const interpBox = lerpBox(oldBox, newBox, e);
      let opacity;
      if (oldBox && newBox)       opacity = 1;
      else if (newBox && !oldBox) opacity = e;
      else if (oldBox && !newBox) opacity = 1 - e;
      else                        opacity = 0;
      applyBlockRect(interpBox, opacity);

      if (tt >= 1) {
        clearInterval(intervalId);
        cancelTransition = null;
        currentMeanderLay = newLay;
        currentState = state;
        applyBlockRect(newBox, newBox ? 1 : 0);
        renderTree(state, prevQVec);
        prevQ = state.q.slice();
        updateOpLine(state);
        isAnimating = false;
        resolve();
      }
    }, FRAME_MS);

    cancelTransition = () => {
      clearInterval(intervalId);
      cancelTransition = null;
      isAnimating = false;
      resolve();
    };
  });
}

// ----- Playback / step navigation -----
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
  renderInitial(target);
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
  if (isAnimating) return;
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
  renderInitial(s);
  refreshCounter();
  refreshThumbsHighlight();
}

// ----- Thumbnail wall (lazy chunked, same as SODA) -----
const THUMB_W = 110;
const THUMB_H = 70;
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

  const lay = layoutMeander(state.perm, {
    width: THUMB_W, height: THUMB_H, padX: 6, padY: 6, fillFactor: 0.9,
  });

  // baseline
  const bl = document.createElementNS(SVG_NS, 'line');
  bl.setAttribute('class', 'thumb-baseline');
  bl.setAttribute('x1', lay.stripLeft - 4);
  bl.setAttribute('y1', lay.baselineY);
  bl.setAttribute('x2', lay.stripRight + 4);
  bl.setAttribute('y2', lay.baselineY);
  svg.appendChild(bl);
  // arcs
  for (let k = 1; k < state.perm.length; k++) {
    const a = lay.byStamp.get(k);
    const b = lay.byStamp.get(k + 1);
    if (!a || !b) continue;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'thumb-arc');
    path.setAttribute('d', meanderArcPath(a, b, k % 2 === 1));
    svg.appendChild(path);
  }
  // stamps
  for (const p of lay.positions) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', 2);
    c.setAttribute('class', p.stamp === 1 ? 'thumb-stamp thumb-root' : 'thumb-stamp');
    svg.appendChild(c);
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

// ----- Init -----
function init(newN, newMode) {
  pause();
  if (cancelTransition) cancelTransition();
  n = newN;
  mode = newMode;
  const total = totalCount(n, mode);
  seq = new FoldingSequence(() => generateRotationGray(n, mode), total);
  idx = 0;
  seq.generateUpTo(0);
  const first = seq.get(0);
  ensureSvgInit();
  renderInitial(first);
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
  ensureSvgInit();
  renderInitial(cur);
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
