// SODA 2026 — Pivot Gray Code for Spanning Trees of K_n
// Glue: tree + K_n polygon co-views, transitions, playback, thumbnails.

import { generateSpanningTrees, cayleyCount } from './algorithm.js?v=lazy1';
import { layoutTree, polygonLayout } from './layout.js?v=lazy1';
import { TreeSequence } from './cache.js?v=lazy1';

// ----- DOM -----
const $ = (sel) => document.querySelector(sel);
const stage      = $('#stage');
const polyStage  = $('#poly-stage');
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

const SVG_NS = 'http://www.w3.org/2000/svg';

// ----- State -----
let n = 4;
let seq = null;
let idx = 0;
let isPlaying = false;
let stageW = 0, stageH = 0;
let polyW = 0, polyH = 0;
let polyLay = null;            // polygon vertex layout (recomputed when n changes)

// Tree pane DOM cache
const nodeEls = new Map();          // val -> <circle>
const labelEls = new Map();         // val -> <text>
const stableEdgeEls = new Map();    // child_val -> <line>
const lockedRect = document.createElementNS(SVG_NS, 'rect');
lockedRect.setAttribute('class', 'locked-rect');
lockedRect.setAttribute('opacity', '0');
let edgesGroup, nodesGroup, labelsGroup, lockedGroup;

// Polygon pane DOM cache
const polyNodeEls = new Map();
const polyLabelEls = new Map();
const polyStableEdgeEls = new Map();
let polyBgGroup, polyEdgesGroup, polyNodesGroup, polyLabelsGroup;

let currentLayout = null;
let currentParents = null;
let currentOp = null;
let isAnimating = false;
// Set by transitionTo while an animation is in flight; calling it stops the
// animation, resolves the promise, and frees isAnimating. We invoke it before
// any code path that wipes the SVG (reset / init / resize) so a half-finished
// animation can't try to manipulate elements that no longer exist.
let cancelTransition = null;

// ----- Layout helpers -----
function nodeRadius() {
  return Math.max(11, 18 - (n - 4) * 1.0);
}
function polyNodeRadius() {
  // Match the tree side so the two views feel like the same diagram.
  return nodeRadius();
}

function ensureSvgInit() {
  // Tree pane
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  const r = stage.getBoundingClientRect();
  stageW = Math.max(280, r.width  | 0);
  stageH = Math.max(280, r.height | 0);
  stage.setAttribute('viewBox', `0 0 ${stageW} ${stageH}`);

  lockedGroup = document.createElementNS(SVG_NS, 'g');
  lockedGroup.setAttribute('class', 'locked');
  lockedGroup.appendChild(lockedRect);
  // reset rect to invisible until updated
  lockedRect.setAttribute('opacity', '0');
  stage.appendChild(lockedGroup);

  edgesGroup = document.createElementNS(SVG_NS, 'g');
  edgesGroup.setAttribute('class', 'edges');
  stage.appendChild(edgesGroup);

  nodesGroup = document.createElementNS(SVG_NS, 'g');
  nodesGroup.setAttribute('class', 'nodes');
  stage.appendChild(nodesGroup);

  labelsGroup = document.createElementNS(SVG_NS, 'g');
  labelsGroup.setAttribute('class', 'labels');
  stage.appendChild(labelsGroup);

  nodeEls.clear();
  labelEls.clear();
  stableEdgeEls.clear();

  // Polygon pane
  while (polyStage.firstChild) polyStage.removeChild(polyStage.firstChild);
  const pr = polyStage.getBoundingClientRect();
  polyW = Math.max(220, pr.width  | 0);
  polyH = Math.max(220, pr.height | 0);
  polyStage.setAttribute('viewBox', `0 0 ${polyW} ${polyH}`);

  polyBgGroup = document.createElementNS(SVG_NS, 'g');
  polyBgGroup.setAttribute('class', 'poly-bg-edges');
  polyStage.appendChild(polyBgGroup);

  polyEdgesGroup = document.createElementNS(SVG_NS, 'g');
  polyEdgesGroup.setAttribute('class', 'edges');
  polyStage.appendChild(polyEdgesGroup);

  polyNodesGroup = document.createElementNS(SVG_NS, 'g');
  polyNodesGroup.setAttribute('class', 'nodes');
  polyStage.appendChild(polyNodesGroup);

  polyLabelsGroup = document.createElementNS(SVG_NS, 'g');
  polyLabelsGroup.setAttribute('class', 'labels');
  polyStage.appendChild(polyLabelsGroup);

  polyNodeEls.clear();
  polyLabelEls.clear();
  polyStableEdgeEls.clear();

  // Polygon vertex positions (fixed for given n).
  // maxRadius caps how big the polygon gets even when the pane is wide —
  // keeps it visually balanced against the (compact) tree on the left.
  polyLay = polygonLayout(n, {
    width: polyW, height: polyH,
    padX: 64, padY: 68, maxRadius: 130,
  });

  // K_n background edges (faint)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = polyLay.positions[i];
      const b = polyLay.positions[j];
      const ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
      ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
      ln.setAttribute('class', 'poly-bg-edge');
      polyBgGroup.appendChild(ln);
    }
  }
}

function computeLayout(parents) {
  return layoutTree(parents, {
    width: stageW,
    height: stageH,
    padX: 38,
    padY: 38,
  });
}

// ----- Locked-region overlay -----
// Returns the bounding rectangle (in stage coords) for nodes at depth ≤ op.level,
// padded outward by node radius, or null when the overlay should be hidden.
function computeLockedBox(lay, op) {
  if (!op || op.level == null) return null;
  const level = Math.min(op.level, lay.maxDepth);
  const r = nodeRadius();
  const padX = r + 14;
  const padY = r + 10;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of lay.positions) {
    if (p.depth <= level) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return {
    x: minX - padX,
    y: minY - padY,
    w: (maxX - minX) + 2 * padX,
    h: (maxY - minY) + 2 * padY,
  };
}

function applyLockedRect(box, opacity) {
  if (!box || opacity <= 0.001) {
    lockedRect.setAttribute('opacity', '0');
    return;
  }
  lockedRect.setAttribute('x', box.x);
  lockedRect.setAttribute('y', box.y);
  lockedRect.setAttribute('width',  box.w);
  lockedRect.setAttribute('height', box.h);
  lockedRect.setAttribute('opacity', String(opacity));
}

function lerpBox(a, b, t) {
  if (a && b) return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
  if (b) return b;     // appearing — caller fades opacity
  if (a) return a;     // disappearing — caller fades opacity
  return null;
}

// ----- Op-line text -----
function updateOpLine(state) {
  if (!state.op) {
    opLine.textContent = 'initial state';
    opLine.dataset.kind = 'init';
    return;
  }
  const op = state.op;
  const fmt = (e) => e ? `(${e[0] + 1}—${e[1] + 1})` : '∅';
  let label;
  if (op.type === 'reparent' || op.type === 'reattach') {
    label = `${fmt(op.fromEdge)} → ${fmt(op.toEdge)}`;
  } else {
    label = 'subtree lift-swap';
  }
  opLine.textContent = label;
  opLine.dataset.kind = op.type;
}

// ----- Initial render (no animation) -----
function renderInitial(state) {
  ensureSvgInit();
  const lay = computeLayout(state.parents);
  currentLayout = lay;
  currentParents = state.parents.slice();
  currentOp = state.op;

  // ---- Tree pane ----
  for (const p of lay.positions) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', p.x);
    c.setAttribute('cy', p.y);
    c.setAttribute('r', nodeRadius());
    c.setAttribute('class', p.val === lay.root ? 'node node-root' : 'node');
    nodesGroup.appendChild(c);
    nodeEls.set(p.val, c);

    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', p.x);
    t.setAttribute('y', p.y);
    t.setAttribute('class', p.val === lay.root ? 'node-label is-root' : 'node-label');
    t.textContent = String(p.val + 1);
    labelsGroup.appendChild(t);
    labelEls.set(p.val, t);
  }

  for (let i = 0; i < state.parents.length; i++) {
    const par = state.parents[i];
    if (par === -1) continue;
    const a = lay.positions[i];
    const b = lay.positions[par];
    const ln = document.createElementNS(SVG_NS, 'line');
    ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
    ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
    ln.setAttribute('class', 'edge');
    edgesGroup.appendChild(ln);
    stableEdgeEls.set(i, ln);
  }

  applyLockedRect(computeLockedBox(lay, state.op), state.op ? 1 : 0);
  updateOpLine(state);

  // ---- Polygon pane ----
  // Root: same convention as tree (val === 0 for our generator).
  const root = lay.root;
  for (const p of polyLay.positions) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', p.x);
    c.setAttribute('cy', p.y);
    c.setAttribute('r', polyNodeRadius());
    c.setAttribute('class', p.val === root ? 'node node-root' : 'node');
    polyNodesGroup.appendChild(c);
    polyNodeEls.set(p.val, c);

    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', p.x);
    t.setAttribute('y', p.y);
    t.setAttribute('class', p.val === root ? 'node-label is-root' : 'node-label');
    t.textContent = String(p.val + 1);
    polyLabelsGroup.appendChild(t);
    polyLabelEls.set(p.val, t);
  }

  for (let i = 0; i < state.parents.length; i++) {
    const par = state.parents[i];
    if (par === -1) continue;
    const key = uKey(i, par);
    if (polyStableEdgeEls.has(key)) continue;
    const a = polyLay.positions[i];
    const b = polyLay.positions[par];
    const ln = document.createElementNS(SVG_NS, 'line');
    ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
    ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
    ln.setAttribute('class', 'edge');
    polyEdgesGroup.appendChild(ln);
    polyStableEdgeEls.set(key, ln);
  }
}

// Undirected edge keys for the polygon side. Lift-swaps reverse parent
// directions but don't change the underlying edge set, so keying by
// {min, max} lets us detect "which undirected edges actually changed".
function uKey(i, j) { return i < j ? `${i}-${j}` : `${j}-${i}`; }
function parseUKey(k) { const [a, b] = k.split('-').map(Number); return [a, b]; }

// ----- Animated transition -----
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function transitionTo(state, durationMs) {
  return new Promise((resolve) => {
    const oldLay = currentLayout;
    const newLay = computeLayout(state.parents);
    const oldParents = currentParents;
    const newParents = state.parents;

    // Demote any "just-arrived" edges from the previous step back to default
    // so the upcoming green-flash uniquely marks edges that change THIS step.
    for (const el of edgesGroup.querySelectorAll('.edge-new')) {
      el.setAttribute('class', 'edge');
    }
    for (const el of polyEdgesGroup.querySelectorAll('.edge-new')) {
      el.setAttribute('class', 'edge');
    }

    // Diff edges by child index — same on tree and polygon panes.
    const fadingOut = [];
    const fadingIn  = [];
    const carry     = [];
    for (let i = 0; i < newParents.length; i++) {
      const oldP = oldParents[i];
      const newP = newParents[i];
      if (oldP === -1 && newP === -1) continue;
      if (oldP === newP) carry.push({ child: i, parent: newP });
      else {
        if (oldP !== -1) fadingOut.push({ child: i, parent: oldP });
        if (newP !== -1) fadingIn.push({ child: i, parent: newP });
      }
    }

    // ----- Tree pane edge bookkeeping -----
    const newEdgeEls = new Map();
    for (const { child, parent } of fadingIn) {
      const ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('class', 'edge edge-new');
      ln.setAttribute('opacity', '0');
      edgesGroup.appendChild(ln);
      newEdgeEls.set(child, { el: ln, parent });
    }
    const fadingOutEls = [];
    for (const { child, parent } of fadingOut) {
      const el = stableEdgeEls.get(child);
      if (el) {
        el.setAttribute('class', 'edge edge-old');
        fadingOutEls.push({ el, child, parent });
        stableEdgeEls.delete(child);
      }
    }

    // ----- Polygon pane: undirected edge diff -----
    // Compute which undirected edges {i, j} are added/removed. Lift-swap
    // reverses chains but doesn't change the underlying edge set — so
    // reparent / reattach / lift-swap all collapse to "1 removed + 1 added"
    // when they share a vertex, which we render as a single arc-pivot.
    const oldUEs = new Set();
    for (let i = 0; i < oldParents.length; i++) {
      if (oldParents[i] !== -1) oldUEs.add(uKey(i, oldParents[i]));
    }
    const newUEs = new Set();
    for (let i = 0; i < newParents.length; i++) {
      if (newParents[i] !== -1) newUEs.add(uKey(i, newParents[i]));
    }
    const removedKeys = [...oldUEs].filter(k => !newUEs.has(k));
    const addedKeys   = [...newUEs].filter(k => !oldUEs.has(k));

    // Detect the single-pivot case (1 removed + 1 added sharing a vertex).
    let polyPivot = null;
    if (removedKeys.length === 1 && addedKeys.length === 1) {
      const [a, b] = parseUKey(removedKeys[0]);
      const [c, d] = parseUKey(addedKeys[0]);
      let anchor, fromV, toV;
      if      (a === c) { anchor = a; fromV = b; toV = d; }
      else if (a === d) { anchor = a; fromV = b; toV = c; }
      else if (b === c) { anchor = b; fromV = a; toV = d; }
      else if (b === d) { anchor = b; fromV = a; toV = c; }
      if (anchor !== undefined) {
        polyPivot = { anchor, fromV, toV,
          removedKey: removedKeys[0], addedKey: addedKeys[0] };
      }
    }

    // Pivot edge: reuse the existing stable line, anchor x1,y1, animate x2,y2.
    let polyPivotEl = null;
    if (polyPivot) {
      polyPivotEl = polyStableEdgeEls.get(polyPivot.removedKey);
      if (polyPivotEl) {
        const anchorPos = polyLay.positions[polyPivot.anchor];
        const fromPos   = polyLay.positions[polyPivot.fromV];
        polyPivotEl.setAttribute('x1', anchorPos.x);
        polyPivotEl.setAttribute('y1', anchorPos.y);
        polyPivotEl.setAttribute('x2', fromPos.x);
        polyPivotEl.setAttribute('y2', fromPos.y);
        polyPivotEl.setAttribute('class', 'edge edge-new');
        polyStableEdgeEls.delete(polyPivot.removedKey);
      } else {
        polyPivot = null;       // fall through to fade if element vanished
      }
    }

    // Non-pivot fadings.
    const polyFadingOutEls = [];
    for (const key of removedKeys) {
      if (polyPivot && key === polyPivot.removedKey) continue;
      const el = polyStableEdgeEls.get(key);
      if (el) {
        el.setAttribute('class', 'edge edge-old');
        polyFadingOutEls.push({ el, key });
        polyStableEdgeEls.delete(key);
      }
    }
    const polyNewEdgeEls = [];
    for (const key of addedKeys) {
      if (polyPivot && key === polyPivot.addedKey) continue;
      const [i, j] = parseUKey(key);
      const a = polyLay.positions[i];
      const b = polyLay.positions[j];
      const ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('class', 'edge edge-new');
      ln.setAttribute('opacity', '0');
      ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
      ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
      polyEdgesGroup.appendChild(ln);
      polyNewEdgeEls.push({ el: ln, key });
    }

    // Locked-box endpoints for animation
    const oldBox = computeLockedBox(oldLay, currentOp);
    const newBox = computeLockedBox(newLay, state.op);

    function nodePos(val, t) {
      const o = oldLay.positions[val];
      const n_ = newLay.positions[val];
      return { x: o.x + (n_.x - o.x) * t, y: o.y + (n_.y - o.y) * t };
    }

    const start = performance.now();
    isAnimating = true;
    const FRAME_MS = 16;

    const intervalId = setInterval(() => {
      const now = performance.now();
      const tt = Math.min(1, (now - start) / durationMs);
      const e = easeInOut(tt);

      // ----- Tree pane updates -----
      for (const p of newLay.positions) {
        const pos = nodePos(p.val, e);
        const c = nodeEls.get(p.val);
        const lab = labelEls.get(p.val);
        c.setAttribute('cx', pos.x);
        c.setAttribute('cy', pos.y);
        lab.setAttribute('x', pos.x);
        lab.setAttribute('y', pos.y);
      }
      for (const { child, parent } of carry) {
        const el = stableEdgeEls.get(child);
        if (!el) continue;
        const a = nodePos(child, e);
        const b = nodePos(parent, e);
        el.setAttribute('x1', a.x); el.setAttribute('y1', a.y);
        el.setAttribute('x2', b.x); el.setAttribute('y2', b.y);
      }
      for (const { el, child, parent } of fadingOutEls) {
        const a = nodePos(child, e);
        const b = nodePos(parent, e);
        el.setAttribute('x1', a.x); el.setAttribute('y1', a.y);
        el.setAttribute('x2', b.x); el.setAttribute('y2', b.y);
        el.setAttribute('opacity', String(1 - e));
      }
      for (const [child, { el, parent }] of newEdgeEls) {
        const a = nodePos(child, e);
        const b = nodePos(parent, e);
        el.setAttribute('x1', a.x); el.setAttribute('y1', a.y);
        el.setAttribute('x2', b.x); el.setAttribute('y2', b.y);
        el.setAttribute('opacity', String(e));
      }

      // ----- Locked-rect tween -----
      const interpBox = lerpBox(oldBox, newBox, e);
      let opacity;
      if (oldBox && newBox)       opacity = 1;
      else if (newBox && !oldBox) opacity = e;
      else if (oldBox && !newBox) opacity = 1 - e;
      else                        opacity = 0;
      applyLockedRect(interpBox, opacity);

      // ----- Polygon pane: arc-pivot for the changed edge, fade for any extras -----
      if (polyPivotEl && polyPivot) {
        const anchor = polyLay.positions[polyPivot.anchor];
        const fromB  = polyLay.positions[polyPivot.fromV];
        const toB    = polyLay.positions[polyPivot.toV];
        const r0 = Math.hypot(fromB.x - anchor.x, fromB.y - anchor.y);
        const r1 = Math.hypot(toB.x   - anchor.x, toB.y   - anchor.y);
        const a0 = Math.atan2(fromB.y - anchor.y, fromB.x - anchor.x);
        const a1 = Math.atan2(toB.y   - anchor.y, toB.x   - anchor.x);
        let dA = a1 - a0;
        if (dA >  Math.PI) dA -= 2 * Math.PI;
        if (dA < -Math.PI) dA += 2 * Math.PI;
        const angle = a0 + dA * e;
        const r     = r0 + (r1 - r0) * e;
        polyPivotEl.setAttribute('x2', anchor.x + r * Math.cos(angle));
        polyPivotEl.setAttribute('y2', anchor.y + r * Math.sin(angle));
      }
      for (const { el } of polyFadingOutEls) el.setAttribute('opacity', String(1 - e));
      for (const { el } of polyNewEdgeEls)  el.setAttribute('opacity', String(e));

      if (tt >= 1) {
        clearInterval(intervalId);
        cancelTransition = null;

        // Tree-pane cleanup
        for (const { el } of fadingOutEls) {
          if (el.parentNode === edgesGroup) edgesGroup.removeChild(el);
        }
        for (const [child, { el }] of newEdgeEls) stableEdgeEls.set(child, el);

        // Polygon-pane cleanup
        for (const { el } of polyFadingOutEls) {
          if (el.parentNode === polyEdgesGroup) polyEdgesGroup.removeChild(el);
        }
        for (const { el, key } of polyNewEdgeEls) polyStableEdgeEls.set(key, el);
        if (polyPivotEl && polyPivot) {
          // Pivot edge becomes the new stable edge under its added-key.
          polyStableEdgeEls.set(polyPivot.addedKey, polyPivotEl);
        }

        currentLayout = newLay;
        currentParents = state.parents.slice();
        currentOp = state.op;
        applyLockedRect(newBox, newBox ? 1 : 0);
        updateOpLine(state);
        isAnimating = false;
        resolve();
      }
    }, FRAME_MS);

    // Expose a cancel hook for reset/init/resize. Stops the timer, drops
    // pending DOM mutations, and resolves the promise so any awaiter unblocks.
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

  // Defensive: usually `i` is inside the cached range (visible thumbs +
  // preload buffer), but if a caller jumps further we generate up to it.
  if (i >= seq.cachedCount()) seq.generateUpTo(i);

  const target = seq.get(i);
  if (!target) return Promise.resolve();

  idx = i;
  refreshCounter();
  refreshThumbsHighlight();

  // When the user lands on (or past) the last visible thumbnail, auto-reveal
  // the next chunk and extend the preload buffer behind it.
  if (idx >= shownCount - 1 && shownCount < seq.total) {
    extendShown();
  }

  if (animate) {
    const dur = currentDuration();
    return transitionTo(target, dur);
  } else {
    renderInitial(target);
    return Promise.resolve();
  }
}

function currentDuration() {
  // speedRange.value is 1..10; map to 800..150ms
  const v = +speedRange.value;
  return 800 - (v - 1) * (650 / 9);
}

function refreshCounter() {
  counter.textContent = `${idx + 1} / ${seq.total}`;
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
  while (isPlaying && idx < seq.total - 1) {
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

// ----- Thumbnail wall (chunked reveal + invisible preload buffer) -----
//
//   visible thumbnails ──┐    cached but not shown
//   ────────────────┐    │    ──────────────┐
//   [ 0 .. shownCount-1 ] [ shownCount .. shownCount+PRELOAD-1 ]
//
// Generation is gated on user action: the user has to either reach the last
// visible thumbnail (via a click, a → step, or playback) or press the
// "load more" button. We reveal the next CHUNK and then top up the preload
// buffer behind the scenes so playback doesn't stutter at the boundary.
const THUMB_W = 110;
const THUMB_H = 80;
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

  const lay = layoutTree(state.parents, {
    width: THUMB_W, height: THUMB_H, padX: 8, padY: 8, fillFactor: 0.82,
  });

  for (let j = 0; j < state.parents.length; j++) {
    const p = state.parents[j];
    if (p === -1) continue;
    const a = lay.positions[j], b = lay.positions[p];
    const ln = document.createElementNS(SVG_NS, 'line');
    ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
    ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
    ln.setAttribute('class', 'thumb-edge');
    svg.appendChild(ln);
  }
  for (const p of lay.positions) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', 3.5);
    c.setAttribute('class', p.val === lay.root ? 'thumb-node thumb-root' : 'thumb-node');
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

// Reveal the next CHUNK of thumbnails. Most of the work (the algorithm
// generation) was already done by the buffer; this just builds DOM.
function extendShown() {
  if (shownCount >= seq.total) return;
  const newShown = Math.min(seq.total, shownCount + CHUNK);
  // Make sure these states are in cache (they should be from the buffer,
  // but generate synchronously if we've outrun it).
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

// Top up the invisible preload buffer up to (shownCount + PRELOAD_BUFFER).
// Done in an idle callback so it doesn't block the current frame.
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
  } else {
    setTimeout(run, 0);
  }
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

// ----- Init / wire-up -----
function init(newN) {
  pause();
  if (cancelTransition) cancelTransition();
  n = newN;
  seq = new TreeSequence(() => generateSpanningTrees(n), cayleyCount(n));
  idx = 0;
  // Generate the very first state synchronously so renderInitial has data.
  seq.generateUpTo(0);
  const first = seq.get(0);
  ensureSvgInit();
  renderInitial(first);
  refreshCounter();
  // Reveal the first chunk of thumbnails (and trigger background buffer fill).
  clearThumbs();
  extendShown();
  updateMemEstimate();
}

playBtn.addEventListener('click', () => isPlaying ? pause() : play());
prevBtn.addEventListener('click', () => step(-1));
nextBtn.addEventListener('click', () => step(1));
resetBtn.addEventListener('click', () => reset());
nInput.addEventListener('change', () => {
  const v = Math.max(2, Math.min(10, parseInt(nInput.value || '4', 10)));
  nInput.value = String(v);
  init(v);
});
loadMoreBtn.addEventListener('click', () => extendShown());
thumbsToggle.addEventListener('click', () => {
  const open = thumbsRoot.parentElement.classList.toggle('open');
  thumbsToggle.textContent = open ? '▾ thumbnails' : '▸ thumbnails';
});

// Re-render whenever the stage container changes size.
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

// Keyboard nav
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  if (e.key === ' ')          { e.preventDefault(); isPlaying ? pause() : play(); }
});

init(parseInt(nInput.value || '4', 10));
