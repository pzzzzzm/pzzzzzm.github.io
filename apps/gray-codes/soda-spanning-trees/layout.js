// Tidy tree layout: given parents[], compute (x, y) for each node.
// Output is normalized to fit within { width, height, padX, padY }.
// Nodes are stratified by BFS depth from the root (parent=-1).
//
// Sizing strategy: each tree is drawn at its NATURAL spacing (fixed gaps
// between siblings and between depth levels). The whole tree is then centered
// in the canvas. If the natural size exceeds the available area, the tree
// scales down uniformly to fit. Trees are never stretched bigger than natural.

const SIBLING_SPACING = 96;
const LEVEL_SPACING = 100;

export function layoutTree(parents, opts = {}) {
  const n = parents.length;
  const W = opts.width  ?? 600;
  const H = opts.height ?? 400;
  const padX = opts.padX ?? 30;
  const padY = opts.padY ?? 30;
  // How much of the available area the tree may fill at most. <1 leaves
  // breathing room (used by thumbnails so trees never touch the card edge).
  const fillFactor = opts.fillFactor ?? 1.0;

  // Build children adjacency, find root.
  const children = Array.from({ length: n }, () => []);
  let root = 0;
  for (let i = 0; i < n; i++) {
    if (parents[i] === -1) root = i;
    else children[parents[i]].push(i);
  }
  // Stable child order by val for visual consistency.
  for (const c of children) c.sort((a, b) => a - b);

  // DFS: leaves get sequential x indices, internals are midpoints of their children.
  const xRaw = new Array(n).fill(0);
  const depth = new Array(n).fill(0);
  let leafCounter = 0;

  function dfs(node, d) {
    depth[node] = d;
    if (children[node].length === 0) {
      xRaw[node] = leafCounter++;
      return;
    }
    for (const c of children[node]) dfs(c, d + 1);
    const cs = children[node];
    xRaw[node] = (xRaw[cs[0]] + xRaw[cs[cs.length - 1]]) / 2;
  }
  dfs(root, 0);

  const leafCount = Math.max(1, leafCounter);
  const maxDepth  = Math.max(0, ...depth);

  // Natural tree dimensions at fixed spacing.
  const natW = (leafCount - 1) * SIBLING_SPACING;
  const natH = maxDepth * LEVEL_SPACING;

  // Available area inside padding.
  const availW = Math.max(0, W - 2 * padX);
  const availH = Math.max(0, H - 2 * padY);

  // Scale down (never up) to fit, with optional breathing room.
  const scaleX = natW > 0 ? Math.min(1, (availW * fillFactor) / natW) : 1;
  const scaleY = natH > 0 ? Math.min(1, (availH * fillFactor) / natH) : 1;
  const scale = Math.min(scaleX, scaleY);

  const treeW = natW * scale;
  const treeH = natH * scale;

  // Center the tree in the canvas.
  const offsetX = (W - treeW) / 2;
  const offsetY = (H - treeH) / 2;

  const positions = [];
  for (let i = 0; i < n; i++) {
    const x = leafCount > 1
      ? offsetX + (xRaw[i] / (leafCount - 1)) * treeW
      : W / 2;
    const y = maxDepth > 0
      ? offsetY + (depth[i] / maxDepth) * treeH
      : H / 2;
    positions.push({ val: i, x, y, depth: depth[i] });
  }

  // Per-BFS-depth y values (used by the locked-region overlay).
  const depthY = [];
  for (let d = 0; d <= maxDepth; d++) {
    depthY.push(maxDepth === 0 ? H / 2 : offsetY + (d / maxDepth) * treeH);
  }

  return { positions, root, maxDepth, depthY, treeW, treeH, offsetX, offsetY };
}

// Regular n-gon layout: vertices on a circle inscribed in the canvas.
// Vertex 0 sits at the top (12 o'clock); the rest go clockwise.
// Used for the K_n companion view next to the tree.
export function polygonLayout(n, opts = {}) {
  const W = opts.width  ?? 400;
  const H = opts.height ?? 400;
  const padX = opts.padX ?? 32;
  const padY = opts.padY ?? 32;
  const maxRadius = opts.maxRadius ?? Infinity;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.max(0, Math.min((W - 2 * padX) / 2, (H - 2 * padY) / 2, maxRadius));

  const positions = [];
  if (n === 1) {
    positions.push({ val: 0, x: cx, y: cy });
    return { positions, radius: 0, cx, cy };
  }
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI;
    positions.push({
      val: i,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return { positions, radius: r, cx, cy };
}

