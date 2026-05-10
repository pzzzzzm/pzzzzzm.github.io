// Pivot Gray code for spanning trees of complete graphs (SODA 2026).
// Direct port of complete_graph.py with extra metadata yielded for visualization:
//   { parents, level, op }
//   - parents: array where parents[i] = parent node val of i, or -1 if root
//   - level:   recursion depth at which the most recent edge change happened
//   - op:      { type, fromEdge, toEdge, level } describing the change (null on first state)

import { k_ary } from './k_ary.js';

class Node {
  constructor(val) {
    this.val = val;
    this.parent = null;
  }
}

class LinkedList {
  constructor() {
    this.map = new Map();
    this.last = -1;
    this.len = 0;
  }
  append(val) {
    this.map.set(val, [this.last, -1]);
    if (this.last !== -1) this.map.get(this.last)[1] = val;
    this.last = val;
    this.len += 1;
  }
  remove(val) {
    const [val_last, val_next] = this.map.get(val);
    if (val_last !== -1) this.map.get(val_last)[1] = val_next;
    if (val_next !== -1) {
      this.map.get(val_next)[0] = val_last;
      this.last = val_next;
    } else {
      this.last = val_last;
    }
    this.map.delete(val);
    this.len -= 1;
  }
}

function liftNode(node) {
  if (node.parent !== null) {
    liftNode(node.parent);
    node.parent.parent = node;
  }
}

export function* generateSpanningTrees(n) {
  // Initialize: path tree 0->1->2->...->n-1 (0 is root)
  const node_list = [];
  let prev = null;
  for (let i = 0; i < n; i++) {
    const nd = new Node(i);
    if (prev !== null) nd.parent = prev;
    node_list.push(nd);
    prev = nd;
  }

  const snapshotParents = () => node_list.map(nd => (nd.parent === null ? -1 : nd.parent.val));

  // The most recent operation; the leaf yield reads this.
  let lastOp = null;

  function* spanning_level(V, t_, n_c, depth) {
    if (n_c === 0) {
      yield { parents: snapshotParents(), level: lastOp ? lastOp.level : null, op: lastOp };
      return;
    }

    const P = V.filter((_, i) => t_[i] > 0);
    const C = V.filter((_, i) => t_[i] === 0);
    const t_l = new Array(n_c).fill(0);
    const C_ = new LinkedList();

    const m = new Map();
    for (let i = 0; i < P.length; i++) m.set(P[i].val, i + 1);

    for (let i = 0; i < C.length; i++) {
      if (m.has(C[i].parent.val)) {
        t_l[i] = m.get(C[i].parent.val);
        C_.append(i);
      }
    }

    yield* spanning_level(C, t_l, C.length - C_.len, depth + 1);

    const k_list = new Array(n_c).fill(P.length);
    const K = k_ary(k_list, t_l);
    K.next(); // discard initial state (already yielded by recursive call above)

    for (const [, idx] of K) {
      let opType, fromEdge = null, toEdge = null;

      if (idx.length > 1) {
        // swap: lift C[idx[1]] to take C[idx[0]]'s parent slot
        const temp = C[idx[0]].parent;
        C[idx[0]].parent = null;
        liftNode(C[idx[1]]);
        C[idx[1]].parent = temp;
        C_.append(idx[1]);
        C_.remove(idx[0]);
        opType = 'lift-swap';
        // After this op, C[idx[0]] is detached from its old parent and re-rooted somewhere along the lifted chain.
        // We don't try to enumerate every flipped edge here; the renderer diffs old vs new parents.
      } else if (t_l[idx[0]] > 0) {
        const oldParent = C[idx[0]].parent;
        C[idx[0]].parent = P[t_l[idx[0]] - 1];
        if (!C_.map.has(idx[0])) C_.append(idx[0]);
        opType = 'reparent';
        fromEdge = oldParent ? [C[idx[0]].val, oldParent.val] : null;
        toEdge = [C[idx[0]].val, P[t_l[idx[0]] - 1].val];
      } else {
        const oldParent = C[idx[0]].parent;
        C_.remove(idx[0]);
        C[idx[0]].parent = C[C_.last];
        opType = 'reattach';
        fromEdge = oldParent ? [C[idx[0]].val, oldParent.val] : null;
        toEdge = [C[idx[0]].val, C[C_.last].val];
      }

      lastOp = { type: opType, level: depth, fromEdge, toEdge };
      yield* spanning_level(C, t_l, C.length - C_.len, depth + 1);
    }
  }

  // top-level call: V = all nodes; t_=[1,0,...,0] (node 0 has children); n_c = n-1 (others are children-to-place)
  const t_top = new Array(n).fill(0);
  t_top[0] = 1;
  yield* spanning_level(node_list, t_top, n - 1, 0);
}

// Cayley count: n^(n-2). For n<=1 returns 1.
export function cayleyCount(n) {
  if (n <= 1) return 1;
  return Math.pow(n, n - 2);
}
