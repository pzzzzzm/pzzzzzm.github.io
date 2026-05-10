// Two layouts:
//   1. layoutLattice — a path drawn as a lattice walk: x = step index,
//      y = cumulative height after each step. Entries +1 (up), 0 (flat),
//      -k (down k). Output covers all (n+1) joint positions plus per-step
//      segment metadata so the renderer can color each segment by step type.
//   2. layoutDecomp — three rows aligned vertically representing the
//      algorithm's three sub-encodings (α, β, γ) so the user can see
//      which slot of which encoding changed step-to-step. Used for the
//      right pane.

// Walk a path tuple, returning per-vertex (x, y) and per-step segment info.
// The y-axis range is auto-fit; caller chooses how to map to pixels.
export function walkPath(path) {
  const n = path.length;
  let y = 0;
  let yMin = 0, yMax = 0;
  const verts = [{ x: 0, y: 0 }];
  const segs = [];
  for (let i = 0; i < n; i++) {
    const step = path[i];
    let kind;
    if (step > 0) kind = 'up';
    else if (step === 0) kind = 'flat';
    else kind = 'down';
    const newY = y + step;
    segs.push({ from: i, to: i + 1, fromY: y, toY: newY, kind, step });
    y = newY;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
    verts.push({ x: i + 1, y });
  }
  return { verts, segs, n, yMin, yMax };
}

// Compute a grid (axis offsets + step sizes) for a path-length n inside a
// box. Caller supplies the global yMin / yMax (across ALL paths) so the
// grid stays fixed — the path itself is drawn against this grid without
// the grid jittering between states.
export function layoutGrid(n, opts = {}) {
  const W = opts.width  ?? 600;
  const H = opts.height ?? 320;
  const padX = opts.padX ?? 36;
  const padY = opts.padY ?? 36;
  const fillFactor = opts.fillFactor ?? 0.94;
  const yMin = opts.yMin ?? 0;
  const yMax = opts.yMax ?? 1;

  const yRange = Math.max(1, yMax - yMin);
  const availW = (W - 2 * padX) * fillFactor;
  const availH = (H - 2 * padY) * fillFactor;

  const xStep = n > 0 ? Math.min(availW / n, 56) : availW;
  const yStep = yRange > 0 ? Math.min(availH / yRange, 32) : availH;

  const drawW = xStep * n;
  const drawH = yStep * yRange;
  const offsetX = (W - drawW) / 2;
  const baselineY = (H + drawH) / 2 - (-yMin) * yStep;

  return { n, yMin, yMax, xStep, yStep, drawW, drawH, offsetX, baselineY };
}

// Walk a path against an already-computed grid and emit per-vertex /
// per-segment screen coordinates. No per-state grid recalculation.
export function walkAgainstGrid(path, grid) {
  const w = walkPath(path);
  const verts = w.verts.map(v => ({
    x: grid.offsetX + v.x * grid.xStep,
    y: grid.baselineY - v.y * grid.yStep,
    pathX: v.x,
    pathY: v.y,
  }));
  const segs = w.segs.map((s, i) => ({
    ...s,
    x1: verts[i].x,     y1: verts[i].y,
    x2: verts[i + 1].x, y2: verts[i + 1].y,
  }));
  return { verts, segs, yMin: w.yMin, yMax: w.yMax };
}

// Back-compat wrapper used by thumbnail rendering — auto-fits y range to
// the path itself (thumbnails are tiny and a fixed grid would waste space).
export function layoutLattice(path, opts = {}) {
  const w = walkPath(path);
  const grid = layoutGrid(w.n, { ...opts, yMin: w.yMin, yMax: w.yMax });
  const { verts, segs } = walkAgainstGrid(path, grid);
  return { ...grid, verts, segs, yMin: w.yMin, yMax: w.yMax };
}

// Decomposition layout: three horizontal "tape" rows + the parity flag
// strip. All rows share the same start x and use a fixed cell width so
// vertical alignment makes the nesting structure of the algorithm obvious.
export function layoutDecomp(op, opts = {}) {
  const W = opts.width  ?? 360;
  const H = opts.height ?? 320;
  const padX = opts.padX ?? 28;
  const padY = opts.padY ?? 48;
  const titleH = 24;
  const rowLabelW = 28;       // room for "α" / "β" / "γ" glyph
  const hintAreaW = 0;        // (no longer a side-aligned hint; hint goes below the row)
  const tapeW = W - 2 * padX - rowLabelW;

  // Determine cell width to fit longest row in available tape space.
  const lens = [
    (op.alpha || []).length,
    op.mode === 'motzkin' ? (op.beta || []).length : 0,
    (op.gamma || []).length,
  ];
  const longest = Math.max(1, ...lens);
  const cellW = Math.min(32, Math.floor(tapeW / longest));
  const cellH = 26;
  const rowGap = 36;          // generous gap so labels/hints don't crowd cells

  const layoutTape = (cells, label, hint) => ({
    label, hint,
    cells,
    cellW, cellH,
    totalW: cellW * cells.length,
  });

  const alphaRow = layoutTape(op.alpha || [], 'α', 'down-step positions');
  const betaRow  = (op.mode === 'motzkin')
    ? layoutTape(op.beta  || [], 'β', 'up vs flat (non-down slots)')
    : null;
  const gammaRow = layoutTape(op.gamma || [], 'γ', 'down magnitudes (shorthand)');
  const rows = [alphaRow, betaRow, gammaRow].filter(Boolean);

  // Tape origin x (where the cells start). Cells flow left-to-right.
  const tapeX = padX + rowLabelW;

  // Vertical centering: the lattice grid in the left pane is centered at
  // stageH/2 (see layoutGrid). Both panes share the same height, so we
  // center the decomp content around decompH/2 to match that horizontal
  // centerline. Falls back to padY when the content is too tall to center.
  const flagH = 36;
  const flagsTopOffset = rows.length * (cellH + rowGap) + 6;
  const totalContentH = flagsTopOffset + flagH;
  const rowStartY = Math.max(padY, (H - totalContentH) / 2);

  return {
    rows, tapeX,
    padX, padY, rowGap, rowLabelW, cellH,
    titleY: rowStartY - 24,
    rowStartY,
    flagsY: rowStartY + flagsTopOffset,
  };
}
