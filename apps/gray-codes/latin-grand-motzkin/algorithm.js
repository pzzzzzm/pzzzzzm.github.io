// LATIN 2026 — Dong / Liu / Wong / Chen / Lam / Im, "Generating 2-Gray
// codes for grand Motzkin paths and grand Dyck paths with air pockets in
// constant amortized time".
//
// Direct port of the paper's Appendix-A Python (kept variable names so
// readers can follow line-for-line).
//
// Each path is a length-n tuple where each entry is:
//    1     up step       (+1 in y)
//    0     flat step      (0)  — only in grand Motzkin mode
//   -k     down step k    (-k) — k ≥ 1, no two consecutive downs
// The path starts at (0,0) and ends at (n,0). "Grand" = it can dip below
// the x-axis between endpoints. "Air pockets" = down-steps may be steeper
// than 1 (encoded as -2, -3, … with no two consecutive downs).
//
// Each yield is { path, op } where:
//   path = the decoded length-n tuple
//   op   = { kind, alpha, beta, gamma, dd, di, du, sUh, d, changed: [posIdx,…] }
// `op` exposes the three building-block encodings (α, β, γ) and the parity
// flags (i, j, h, z mapped to dd, di, du, …) so the right pane can render
// the decomposition view.

// ---- IntComp: drives both Fibonacci words (no_consecutive=true) and
//      integer compositions (no_consecutive=false). Idiomatic port of the
//      paper's class — `idx` exposes the swap positions when `next()`
//      moves to the next Gray-code word. ----
class IntComp {
  constructor(n, k, no_consecutive = false) {
    this.n = n;
    this.k = k;
    this.nc = no_consecutive;
    this.idx = [];
    if (!no_consecutive) {
      this.s = [];
      for (let i = 0; i <= k; i++) this.s.push(i);
      this.s.push(n + 1);
      this.c = new Array(k + 1).fill(1);
      this.d = new Array(k + 1).fill(0);
      this.p = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 1; i <= k; i++) this.p[i][i] = 1;
    } else {
      this.s = [];
      for (let i = 0; i <= k; i++) this.s.push(2 * i - 1);
      this.s.push(n + 2);
      this.s[0] = -1;
      this.c = new Array(k + 1).fill(1);
      this.d = new Array(k + 1).fill(0);
      this.p = Array.from({ length: 2 * k + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 1; i <= k; i++) this.p[2 * i - 1][2 * i - 1] = 1;
    }
  }

  next() {
    for (let i = 1; i <= this.k; i++) {
      if (this.d[i]) {
        const cond = (!this.nc && this.s[i] === i)
                  || ( this.nc && this.s[i] === 2 * i - 1);
        if (cond) {
          this.d[i] = 0;
        } else {
          const j = !this.nc
            ? Math.max(this.s[i - 1] + 1, i)
            : Math.max(this.s[i - 1] + 2, 2 * i - 1);
          this.idx = [this.s[i] - 1, j - 1];
          this.s[i] = j;
          this.p[i][j] = this.c[i];
          for (let t = 1; t < i; t++) {
            this.d[t] = 1;
            this.c[t] += 1;
            this.p[t][this.s[t]] = this.c[t];
          }
          return true;
        }
      }
      const upper = this.s[i + 1] - (this.nc ? 1 : 0);
      for (let j = this.s[i] + 1; j < upper; j++) {
        if (this.p[i][j] !== this.c[i]) {
          this.idx = [this.s[i] - 1, j - 1];
          this.s[i] = j;
          this.p[i][j] = this.c[i];
          for (let t = 1; t < i; t++) {
            this.d[t] = 1;
            this.c[t] += 1;
            this.p[t][this.s[t]] = this.c[t];
          }
          return true;
        }
      }
    }
    return false;
  }

  output() {
    const res = [];
    let j = 1;
    for (let i = 1; i <= this.n; i++) {
      if (this.s[j] !== i) res.push(0);
      else { res.push(1); j += 1; }
    }
    return res;
  }
}

// ---- BRGC over binary strings of length n with at least k ones.
//      Yields [bits, weight] pairs. ----
function* brgc_k(n, k, d) {
  const a = new Array(n + 1).fill(0);
  a[n] = 1;
  function* Gen(t, z, w) {
    if (t < 1 || t + w <= k) {
      if (t < 1) {
        yield [a.slice(1, n + 1), w];
      } else {
        const out = new Array(t).fill(1).concat(a.slice(t + 1, n + 1));
        yield [out, w + t];
      }
    } else {
      if (!(z % 2)) {
        a[t] = 1;
        yield* Gen(t - 1, 0, w + 1);
        a[t] = 0;
        yield* Gen(t - 1, 1, w);
      } else {
        a[t] = 0;
        yield* Gen(t - 1, 0, w);
        a[t] = 1;
        yield* Gen(t - 1, 1, w + 1);
        a[t] = 0;
      }
    }
  }
  yield* Gen(n, 1 - d, 0);
}

// ---- Grand Dyck path generator (Algorithm 2) ----
function* grandDyck(n) {
  let d1 = 1, d2 = 1;
  for (let u = n - 1; u >= Math.ceil(n / 2); u--) {
    const ic1 = new IntComp(n, n - u, true);
    while (true) {
      const a = ic1.output();
      const ic2 = new IntComp(u - 1, n - u - 1);
      while (true) {
        const b = ic2.output();
        yield { kind: 'gd', a: a.slice(), d1, b: b.slice(), d2,
                idx1: ic1.idx.slice(), idx2: ic2.idx.slice() };
        if (!ic2.next()) break;
      }
      d2 = 1 - d2;            // flip AFTER inner while ends (per Python ref)
      if (!ic1.next()) break;
    }
    d1 = 1 - d1;              // flip AFTER outer while ends
  }
}

function decodeGD(a, d1, b, d2) {
  const downList = [];
  if (d2) {
    let down = 0;
    for (const i of b) {
      down -= 1;
      if (i === 1) { downList.push(down); down = 0; }
    }
    down -= 1;
    downList.push(down);
  } else {
    let down = -1;
    for (let i = b.length - 1; i >= 0; i--) {
      if (b[i] === 1) { downList.push(down); down = 0; }
      down -= 1;
    }
    downList.push(down);
  }
  const aSeq = d1 ? a : [...a].reverse();
  const res = [];
  let idx = 0;
  for (const v of aSeq) {
    if (v === 0) res.push(1);
    else { res.push(downList[idx]); idx += 1; }
  }
  return res;
}

// ---- Grand Motzkin path generator (Algorithm 1) ----
function* grandMotzkin(n) {
  let du = 1, dd = 1, di = 1;
  let u_ = 0;
  let s_uh = null;
  for (let uh = Math.ceil(n / 2); uh < n; uh++) {
    const d = n - uh;
    const dDistIc = new IntComp(n, d, true);
    while (true) {
      const dDist = dDistIc.output();
      if (s_uh === null) {
        s_uh = [];
        for (let i = 0; i < dDist.length; i++) {
          if (dDist[i] === 0) s_uh.push(i);
        }
      } else if (dDistIc.idx.length > 0) {
        for (let i = 0; i < s_uh.length; i++) {
          if ((s_uh[i] === dDistIc.idx[1] && dd === 1) ||
              (s_uh[i] === n - dDistIc.idx[1] - 1 && dd === 0)) {
            s_uh[i] = dd ? dDistIc.idx[0] : n - dDistIc.idx[0] - 1;
          }
        }
      }
      let lastUhDist = null;
      const uhDistGen = brgc_k(uh, d, du);
      for (const [uhDist, u] of uhDistGen) {
        if (u_ === 1 && u === 1) {
          yield { kind: 'gm', sentinel: true, n,
                  dDist: null, dd, uhDist: null, sUh: null, dComp: null, di, d };
          u_ = -1;
        }
        if (u_ !== -1) u_ = u;
        const dCompIc = new IntComp(u - 1, d - 1);
        while (true) {
          const dComp = dCompIc.output();
          yield { kind: 'gm', sentinel: false,
                  dDist: dDist.slice(), dd,
                  uhDist: uhDist.slice(), sUh: s_uh.slice(),
                  dComp: dComp.slice(), di, d,
                  idxComp: dCompIc.idx.slice() };
          if (!dCompIc.next()) break;
        }
        di = 1 - di;             // flip AFTER inner while ends (per Python ref)
        lastUhDist = uhDist;
      }
      du = lastUhDist[lastUhDist.length - 1];
      if (!dDistIc.next()) break;
    }
    dd = 1 - dd;                 // flip AFTER outer while ends
    s_uh = [dd === 1 ? 2 * d - 2 : n - 2 * d + 1, ...s_uh];
  }
}

function decodeGM(state) {
  if (state.sentinel) return new Array(state.n).fill(0);
  const { dDist, dd, uhDist, sUh, dComp, di } = state;
  const downList = [];
  if (di) {
    let down = 0;
    for (const i of dComp) {
      down -= 1;
      if (i === 1) { downList.push(down); down = 0; }
    }
    down -= 1;
    downList.push(down);
  } else {
    let down = -1;
    for (let i = dComp.length - 1; i >= 0; i--) {
      if (dComp[i] === 1) { downList.push(down); down = 0; }
      down -= 1;
    }
    downList.push(down);
  }
  const dDistView = dd ? dDist : [...dDist].reverse();
  const res = [];
  let idxI = 0;
  for (let i = 0; i < dDistView.length; i++) {
    if (dDistView[i] === 0) {
      res.push(uhDist[sUh.indexOf(i)]);
    } else {
      res.push(downList[idxI]);
      idxI += 1;
    }
  }
  return res;
}

// Combined entry point: yields { path, op } where op carries the
// decomposition for the right pane.
export function* generatePaths(n, mode = 'motzkin') {
  if (n < 2) {
    yield { path: [0], op: { kind: 'init', alpha: [0], beta: [], gamma: [],
                              dd: 1, di: 1, du: 1, d: 0, mode } };
    return;
  }
  if (mode === 'dyck') {
    for (const state of grandDyck(n)) {
      const path = decodeGD(state.a, state.d1, state.b, state.d2);
      yield {
        path,
        op: {
          kind: 'gd',
          alpha: state.a,           // Fibonacci word (down positions)
          beta: [],                 // Dyck has no beta stage
          gamma: state.b,           // composition shorthand → magnitudes
          dd: state.d1, du: 0, di: state.d2,
          d: state.a.filter(x => x === 1).length,
          mode,
        },
      };
    }
  } else {
    for (const state of grandMotzkin(n)) {
      const path = decodeGM(state);
      yield {
        path,
        op: {
          kind: 'gm',
          sentinel: state.sentinel,
          alpha: state.dDist || new Array(n).fill(0),
          beta:  state.uhDist || [],
          gamma: state.dComp  || [],
          dd: state.dd, du: 0, di: state.di,
          d: state.d,
          mode,
        },
      };
    }
  }
}

// Closed-form counts (Theorems 5 / 6).
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}

export function totalCount(n, mode) {
  if (n < 2) return 1;
  if (mode === 'dyck') {
    let s = 0;
    for (let k = 1; k <= Math.floor(n / 2); k++) {
      s += comb(n - k + 1, k) * comb(n - k - 1, k - 1);
    }
    return s;
  }
  // motzkin
  let s = 1;     // +1 for the all-flat path
  for (let k = 1; k <= Math.floor(n / 2); k++) {
    let inner = 0;
    for (let i = 0; i <= n - 2; i++) {
      inner += comb(n - k, n - k - i) * comb(n - k - i - 1, k - 1);
    }
    s += comb(n - k + 1, k) * inner;
  }
  return s;
}
