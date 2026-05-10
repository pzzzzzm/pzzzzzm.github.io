// Two layouts for the IWOCA visualizer:
//   1. layoutMeander — horizontal stamp strip with the consecutive-integer
//      arcs alternating above/below the baseline. This is the canonical
//      semi-meandric drawing where each stamp has the strip enter from one
//      side and exit on the other (no self-crossings for valid foldings).
//   2. layoutRecursionTree — given (perm, q), produces the n-row branch
//      from the root of the paper's recursive computation tree (Fig. 2.2)
//      down to the current size-n leaf. Each row holds the size-(t+1)
//      meander obtained by projecting the current perm to elements ≤ t+1.

const STAMP_GAP_X = 36;     // natural horizontal spacing between stamps

// Layout a horizontal meander.
//   perm   — array of n stamp values, in left-to-right slot order
//   opts   — { width, height, padX, padY, fillFactor }
// Returns { positions, byStamp, baselineY, radius, stripLeft, stripRight }.
export function layoutMeander(perm, opts = {}) {
  const n = perm.length;
  const W = opts.width  ?? 600;
  const H = opts.height ?? 240;
  const padX = opts.padX ?? 28;
  const padY = opts.padY ?? 28;
  const fillFactor = opts.fillFactor ?? 1.0;

  const natW = Math.max(0, (n - 1) * STAMP_GAP_X);
  const availW = Math.max(0, (W - 2 * padX) * fillFactor);
  const availH = Math.max(0, (H - 2 * padY) * fillFactor);
  // Arc max height is ~half the longest gap; bound the layout so the tallest
  // arc doesn't run off-pane.
  const longestGap = natW;
  const arcCap = availH / (longestGap > 0 ? longestGap * 0.45 : 1);
  const wScale = natW > 0 ? availW / natW : 1;
  const scale = Math.min(1, wScale, arcCap > 0 ? arcCap : 1);

  const stripW = natW * scale;
  const stripLeft = (W - stripW) / 2;
  const baselineY = H / 2;

  const positions = perm.map((stamp, i) => ({
    slot: i,
    stamp,
    x: n > 1 ? stripLeft + (i / (n - 1)) * stripW : W / 2,
    y: baselineY,
  }));
  const byStamp = new Map(positions.map(p => [p.stamp, p]));

  return {
    positions, byStamp, baselineY,
    stripLeft, stripRight: stripLeft + stripW,
    radius: Math.max(5, 10 - Math.max(0, n - 5) * 0.4),
  };
}

// SVG path for the arc connecting two stamps along the baseline. `above`
// chooses which side; the caller decides via parity (arc(k,k+1) is above
// iff k is odd, so consecutive arcs at every stamp are on opposite sides).
export function meanderArcPath(p1, p2, above) {
  const [a, b] = p1.x <= p2.x ? [p1, p2] : [p2, p1];
  const dx = Math.max(1, b.x - a.x);
  const rx = dx / 2;
  const ry = Math.max(10, dx * 0.5);
  // SVG y is downward; sweep=0 means counterclockwise → arc rises above.
  const sweep = above ? 0 : 1;
  return `M ${a.x} ${a.y} A ${rx} ${ry} 0 0 ${sweep} ${b.x} ${b.y}`;
}

// Project the current perm onto its size-(level+1) sub-meander, in
// cyclic-canonical form (rotated so stamp 1 sits at position 0).
//
// Why canonical: the iterative algorithm rotates a substring of size t+1 at
// level t. That rotation preserves the cyclic order of the substring's
// elements — only the starting position changes. So the "level-m structure"
// (the semimeander you'd see in the paper's recursion tree at that depth)
// is invariant under any rotation at level k ≥ m, and only changes when
// some level k < m takes a step. Realigning to put stamp 1 first makes
// that invariance visible: rotations that preserve cyclic order produce
// the same canonical form.
//
// Concretely:
//   - Rotating at top level (algorithm t = n−1, display m = n): every
//     level's canonical form is preserved → the entire branch is static.
//   - Rotating at algorithm level t (display m = t+1): canonical forms
//     at all m' ≤ t+1 are preserved; canonical forms at m' > t+1 may
//     change. The set of changed levels matches exactly the set of
//     q-bits that flipped in the iterative loop, which is what we mark
//     with the "flip-trace" tint.
export function projectToLevel(perm, level) {
  const out = [];
  for (const s of perm) if (s <= level + 1) out.push(s);
  const i1 = out.indexOf(1);
  if (i1 <= 0) return out;
  return out.slice(i1).concat(out.slice(0, i1));
}

// Layout the n-row branch from the root of the recursion tree down to the
// current state. Each row is a small horizontal meander.
//   perm        — full size-n permutation
//   q           — direction flags q[0..n-1]
//   activeLevel — the level whose rotation just produced this state, or null
//   opts        — { width, height, padX, padY }
export function layoutRecursionTree(perm, q, activeLevel, opts = {}) {
  const n = perm.length;
  const W = opts.width  ?? 360;
  const H = opts.height ?? 600;
  const padX = opts.padX ?? 18;
  const padY = opts.padY ?? 28;

  const rowGap = (H - 2 * padY) / Math.max(1, n);
  // Each row's meander is laid out at this width.
  const meanderW = W - 2 * padX - 36;   // leave room on the left for q[t] glyph

  const rows = [];
  for (let t = 0; t < n; t++) {
    const projected = projectToLevel(perm, t);
    // Position the row's meander box: x from (padX + 36) to (W - padX),
    // vertical center at top + (t+0.5)*rowGap.
    const yc = padY + (t + 0.5) * rowGap;
    const meanderH = Math.min(rowGap * 0.78, 64);
    const meanderLay = layoutMeander(projected, {
      width: meanderW,
      height: meanderH,
      padX: 8,
      padY: 6,
      fillFactor: 0.92,
    });
    rows.push({
      level: t,
      m: t + 1,
      perm: projected,
      qVal: q[t],
      active: t === activeLevel,
      origin: { x: padX + 36, y: yc - meanderH / 2 },
      box: { w: meanderW, h: meanderH },
      meanderLay,
    });
  }
  return { rows, padX, padY };
}
