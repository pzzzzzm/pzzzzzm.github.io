// IWOCA / journal extension — Liu, Wong, Lam, Im 2024 (arXiv 2411.05458).
// Iterative Gray-code generator for stamp foldings and semi-meanders.
// Direct port of Appendix B (GenI) — naming preserved so a reader with the
// paper open can follow it line-for-line.
//
// Each yield emits:
//   { perm: number[n],    // current permutation p1 .. pn (1-indexed values)
//     q:    number[n],    // direction flags q[0]..q[n-1] (1 = right, 0 = left)
//     op:   { kind, dir, level, j, windowStart, windowLen } | null }
//
// Op kinds:
//   - null              initial state
//   - 'stamp-step'      whole-permutation rotation by 1 inside the t==n-1
//                       inner loop (only fires when type === 'stamp')
//   - 'semi-step'       whole-permutation rotation by j (semi-meander mode at
//                       t == n-1 OR stamp-folding mode finishing the t==n-1
//                       block with the next-semi-meander jump)
//   - 'sub-rotate'      rotation of substring p_i .. p_{i+t} by j (t > 0,
//                       the most common interior step)
//
// `windowStart` / `windowLen` describe the contiguous block of the current
// permutation that just rotated — what the UI highlights as "rotated 块".

// ---- Doubly-linked circular list ----
class Node {
  constructor(val) { this.val = val; this.prev = this; this.next = this; }
}

function buildCircular(n) {
  const nodes = Array.from({ length: n }, (_, i) => new Node(i + 1));
  for (let i = 0; i < n; i++) {
    nodes[i].next = nodes[(i + 1) % n];
    nodes[i].prev = nodes[(i - 1 + n) % n];
  }
  return nodes[0];
}

function snapshot(head, n) {
  const out = new Array(n);
  let p = head;
  for (let i = 0; i < n; i++) { out[i] = p.val; p = p.next; }
  return out;
}

// Move the head pointer by k positions; d=1 → next, d=0 → prev.
function rotate(p, k, d, n) {
  k = ((k % n) + n) % n;
  for (let i = 0; i < k; i++) p = d ? p.next : p.prev;
  return p;
}

// Find element e in the (sub)list starting from p; r = list length, t = same r.
// Returns 1..r (1-indexed). Direction d governs scan order.
function indexOf(e, p, r, t, n) {
  if (r) {
    let q = p;
    for (let i = 1; i <= n; i++) {
      if (q.val === e) return i;
      q = q.next;
    }
  } else {
    let q = p.prev;
    for (let i = 1; i <= n; i++) {
      if (q.val === e) return t - i + 1;
      q = q.prev;
    }
  }
  return 1;
}

function nextSemiMeander(head, r, d, n) {
  const j = d ? head.val : head.prev.val;
  if (j === 1 && (r % 2 === 0)) return 1;
  if (j % 2 === r % 2) {
    if (d) return indexOf(j + 1, head, d, r, n);
    else return r - indexOf(j + 1, head, d, r, n) + 1;
  } else {
    if (d) return indexOf(j - 1, head, d, r, n);
    else return r - indexOf(j - 1, head, d, r, n) + 1;
  }
}

// Distance from `p` to `target` going forward in the circular list.
function fwdDistance(p, target, n) {
  let q = p, d = 0;
  while (q !== target && d < n) { q = q.next; d++; }
  return d;
}

// Iterative generator. Mode = 'stamp' or 'semi'.
export function* generateRotationGray(n, mode = 'stamp') {
  if (n < 2) {
    yield { perm: [1], q: [1], op: null };
    return;
  }
  const q = new Array(n).fill(1);
  let p = buildCircular(n);
  let lastOp = null;
  let t = n - 1;

  do {
    yield { perm: snapshot(p, n), q: q.slice(), op: lastOp };

    let head = p, tail = p.prev;
    for (t = n - 1; t >= 0; t--) {
      if (q[t] && head.val === t + 1) {
        q[t] = 1 - q[t];
        head = head.next; tail = tail.next;
      } else if (!q[t] && tail.val === t + 1) {
        q[t] = 1 - q[t];
      } else {
        break;
      }
      tail = tail.prev;
    }

    if (t === n - 1) {
      // Whole-permutation rotation. Stamp mode emits n-2 simple rotations
      // first (each a separate yield), then a final j rotation.
      if (mode === 'stamp') {
        lastOp = { kind: 'stamp-step', dir: q[t], level: t,
                   j: 1, windowStart: 0, windowLen: n };
        for (let i = 0; i < n - 2; i++) {
          p = rotate(p, 1, q[t], n);
          yield { perm: snapshot(p, n), q: q.slice(), op: lastOp };
        }
        // Final step toward the next group.
        p = rotate(p, 1, q[t], n);
        lastOp = { kind: 'stamp-step', dir: q[t], level: t,
                   j: 1, windowStart: 0, windowLen: n };
      } else {
        const j = nextSemiMeander(p, t + 1, q[t], n);
        p = rotate(p, j, q[t], n);
        lastOp = { kind: 'semi-step', dir: q[t], level: t,
                   j, windowStart: 0, windowLen: n };
      }
    } else if (t > 0) {
      // Substring rotation: detach head..tail, rotate inside, reconnect.
      const windowStart = fwdDistance(p, head, n);
      const windowLen = t + 1;
      const beforeHead = head.prev, afterTail = tail.next;
      head.prev = tail; tail.next = head;
      const j = nextSemiMeander(head, t + 1, q[t], n);
      let newHead;
      if (p === head) {
        newHead = rotate(head, j, q[t], n);
        p = newHead;
      } else {
        newHead = rotate(head, j, q[t], n);
      }
      beforeHead.next = newHead;
      afterTail.prev = newHead.prev;
      beforeHead.next.prev = beforeHead;
      afterTail.prev.next = afterTail;
      lastOp = { kind: 'sub-rotate', dir: q[t], level: t,
                 j, windowStart, windowLen };
    }
  } while (t > 0);
}

// Total counts for n in [2, 10] for both modes, computed from the recursive
// reference. Stored here so the UI can show "step X / N" without exhausting
// the generator on init.
const TOTALS = {
  stamp: { 2: 2, 3: 6, 4: 16, 5: 50, 6: 144, 7: 462, 8: 1392, 9: 4536, 10: 14060 },
  semi:  { 2: 2, 3: 4, 4: 10, 5: 24, 6: 66,  7: 174, 8: 504,  9: 1406, 10: 4210 },
};

export function totalCount(n, mode) {
  return (TOTALS[mode] || {})[n] ?? null;
}
