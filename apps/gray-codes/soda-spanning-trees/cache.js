// Lazy cached sequence around a generator. Holds previously-yielded states in
// memory, but advances the generator ONLY when explicitly told to —
// `get(i)` is now a pure lookup that returns undefined for indices that
// haven't been generated yet. Callers are expected to gate generation
// (chunked reveal, preload buffer) themselves; see app.js' extendShown().
//
// The total count is supplied externally (we know it via Cayley's formula)
// so the UI can render counters / progress without exhausting the iterator.
//
// Nothing here is persisted to disk: the cache lives in this object only,
// and dies with the page or whenever a new TreeSequence is constructed
// (e.g. on n change).

export class TreeSequence {
  constructor(genFactory, totalCount) {
    this.genFactory = genFactory;
    this.iter = genFactory();
    this.cache = [];
    this.exhausted = false;
    this.totalCount = totalCount;
  }

  get total() { return this.totalCount; }

  // Returns the cached state at index i, or undefined if not yet generated.
  // Pure lookup — does not advance the generator.
  get(i) {
    if (i < 0 || i >= this.cache.length) return undefined;
    return this.cache[i];
  }

  has(i) { return i >= 0 && i < this.cache.length; }

  cachedCount() { return this.cache.length; }

  // Advance the generator until cache contains state at `targetIdx`
  // (inclusive). Stops early if the generator exhausts. Returns the
  // resulting cache length.
  generateUpTo(targetIdx) {
    while (this.cache.length <= targetIdx && !this.exhausted) {
      const r = this.iter.next();
      if (r.done) { this.exhausted = true; break; }
      this.cache.push(r.value);
    }
    return this.cache.length;
  }

  // Rough memory footprint estimate for the UI badge. Per-state size scales
  // with n (the parents array). The constants are approximate V8 sizes for
  // small arrays + object headers; treat the result as ±30%.
  estimatedBytes() {
    if (this.cache.length === 0) return 0;
    const sample = this.cache[0];
    const n = sample.parents.length;
    // wrapper object header + parents Int-ish array + op object
    const perState = 32 + (24 + 8 * n) + 100;
    return this.cache.length * perState;
  }
}
