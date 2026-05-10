// 2-Gray code for k-ary / mixed-radix words
// Direct port of k_ary.py — NOT cleaned up so the correspondence stays visible.
// Yields [alpha, idx] where alpha is the live array (mutated in place between yields)
// and idx is the list of positions changed since the last yield.

export function* k_ary(k_list, alpha) {
  const n = k_list.length;
  const d = alpha.map(a => (a !== 1 ? 1 : -1));
  const idx = [];
  const s = [alpha.reduce((x, y) => x + y, 0)];

  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 1; i >= 0; i--) {
    if (k_list[i] > 1) {
      [order[n - 1], order[i]] = [order[i], order[n - 1]];
      break;
    }
  }

  function* _next(i) {
    const i_ = order[i];

    for (let r = 0; r <= k_list[i_]; r++) {
      if (i === n - 1) {
        if (s[0] !== 0) {
          if (idx.length > 1 && idx[0] === idx[1]) idx.pop();
          yield [alpha, idx.slice()];
          idx.length = 0;
        }
      } else {
        const i_next = order[i + 1];
        yield* _next(i + 1);
        d[i_next] = (alpha[i_next] === k_list[i_next]) ? 1 : -d[i_next];
      }

      if (r < k_list[i_]) {
        const a_b = alpha[i_];
        const a_a = (alpha[i_] + d[i_] + k_list[i_] + 1) % (k_list[i_] + 1);
        s[0] += a_a - a_b;
        alpha[i_] = a_a;
        idx.push(i_);
      }
    }
  }

  yield* _next(0);
}
